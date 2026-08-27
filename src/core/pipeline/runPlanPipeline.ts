/**
 * `runPlanPipeline` — the canonical orchestrator (AD-3).
 *
 * Pure orchestration: every capability is injected via `deps` (typed against the
 * port interfaces), every side-effecting call is bounded by the shared
 * `ctx.deadlineAt`, and time comes only from `ctx.clock`. Real adapters arrive in
 * issues #4–#6; the engine tests drive this with in-memory fakes.
 *
 * `infeasible` / `unknown` are **business results** (AD-5) — a complete
 * `PlanResult`, never a thrown error and never a mutilated basket.
 */

import { type BasketRequirement } from "../basket/build";
import { compareStores, type StoreCandidates } from "../basket/compare";
import { applyPantryCaps } from "../constraints/pantry";
import { evaluateConstraints } from "../constraints/evaluate";
import { repairOverBudget } from "../constraints/repair";
import { isPastDeadline, type PipelineContext } from "../clock";
import { sumOre, ZERO_ORE } from "../money";
import { aggregateNutrition, type NutritionInputLine } from "../nutrition/aggregate";
import type { PipelineDeps, PortCallOptions, RecipeOptionHandle } from "../ports";
import type {
  Basket,
  BasketAdjustment,
  MealRequest,
  PlanOutcome,
  PlanResult,
  Product,
  Provenance,
  StoreOption,
} from "../types";
import { storeKey } from "../types";
import { deriveConcepts } from "./concepts";
import { validateRequest } from "./validate";

const PROXY_GRAMS = 200;
const RESULTS_PER_CONCEPT = 5;
const MAX_STORES = 3;

function terminal(
  outcome: Extract<PlanOutcome, "infeasible" | "unknown">,
  reason: string,
  provenance: readonly Provenance[] = [],
): PlanResult {
  return {
    outcome,
    basket: null,
    nutrition: null,
    comparison: null,
    constraints: { checks: [], outcome },
    adjustments: [],
    overshootOre: ZERO_ORE,
    reason,
    provenance,
  };
}

function shortlistStores(
  stores: readonly StoreOption[],
  maxDistanceKm: number,
): StoreOption[] {
  return [...stores]
    .filter((s) => s.tier === "full" && s.distanceKm <= maxDistanceKm)
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm ||
        b.confirmedAt.localeCompare(a.confirmedAt) ||
        (storeKey(a) < storeKey(b) ? -1 : storeKey(a) > storeKey(b) ? 1 : 0),
    )
    .slice(0, MAX_STORES);
}

/** Deterministic candidate filter (AD-3 step 6) — kept light for the engine. */
function filterCandidates(concept: string, products: readonly Product[]): Product[] {
  return products
    .filter(
      (p) =>
        p.concept === concept &&
        p.priceOre > 0 &&
        p.packageSize > 0 &&
        p.comparison.priceOre > 0,
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function optionIdFor(store: StoreOption, product: Product): string {
  return `opt-${storeKey(store)}-${product.id}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

function sanitizeOption(optionId: string, product: Product): RecipeOptionHandle {
  return {
    optionId,
    concept: product.concept,
    label: product.concept,
    form: product.packageUnit === "st" ? "styck" : product.packageUnit === "ml" ? "flytande" : "fast",
    coarseCategory: product.categoryPath[0] ?? "övrigt",
    dietaryTags: product.dietaryTags,
  };
}

function basketWithLines(base: Basket, lines: Basket["lines"]): Basket {
  return {
    ...base,
    lines,
    totalOre: lines.length === 0 ? ZERO_ORE : sumOre(lines.map((l) => l.purchase.priceOre)),
  };
}

export async function runPlanPipeline(
  request: MealRequest,
  deps: PipelineDeps,
  ctx: PipelineContext,
): Promise<PlanResult> {
  const interpreted = validateRequest(request);
  const port: PortCallOptions = { deadlineAt: ctx.deadlineAt, clock: ctx.clock };
  const nowIso = ctx.clock.nowIso();

  const guard = (): PlanResult | null =>
    isPastDeadline(ctx) ? terminal("unknown", "deadline_exceeded") : null;

  // --- 2. Resolve location → stores ------------------------------------
  {
    const past = guard();
    if (past) return past;
  }
  const discovery = await deps.stores.resolve(request.location, port);
  const shortlisted = shortlistStores(discovery.stores, interpreted.maxDistanceKm);
  if (shortlisted.length === 0) {
    return terminal("infeasible", "no_store_in_range");
  }

  // --- 4. Derive search concepts -------------------------------------
  const derived = deriveConcepts(request);
  const coreConcepts = derived.filter((c) => c.role === "core").map((c) => c.concept);

  // --- 5. Search products for every concept × store -----------------
  {
    const past = guard();
    if (past) return past;
  }
  const storeCandidates: StoreCandidates[] = [];
  for (const store of shortlisted) {
    const byConcept = new Map<string, readonly Product[]>();
    for (const { concept } of derived) {
      const found = await deps.products.search(
        { concept, store, limit: RESULTS_PER_CONCEPT },
        port,
      );
      byConcept.set(concept, filterCandidates(concept, found));
    }
    storeCandidates.push({ store, candidatesByConcept: byConcept });
  }

  // --- core coverage feasibility (AD-11) ---------------------------
  const impossibleCore = coreConcepts.filter(
    (concept) =>
      !storeCandidates.some((sc) => (sc.candidatesByConcept.get(concept) ?? []).length > 0),
  );
  if (impossibleCore.length > 0) {
    return terminal("infeasible", `core_coverage_impossible:${impossibleCore.join(",")}`);
  }

  // --- 7. Proxy baskets + deterministic store selection -----------
  const proxyRequirements: BasketRequirement[] = derived.map((c) => ({
    concept: c.concept,
    recipeAmount: PROXY_GRAMS,
    role: c.role,
  }));
  const selection = compareStores({
    requirements: proxyRequirements,
    stores: storeCandidates,
    source: "primat",
    retrievedAtIso: nowIso,
  });
  const chosenStore = selection.chosen.store;
  const chosenCandidates =
    storeCandidates.find((sc) => storeKey(sc.store) === storeKey(chosenStore))
      ?.candidatesByConcept ?? new Map<string, readonly Product[]>();

  // --- 8. Option handles for the chosen store --------------------
  const optionMap = new Map<string, Product>();
  const handles: RecipeOptionHandle[] = [];
  for (const { concept } of derived) {
    for (const product of chosenCandidates.get(concept) ?? []) {
      const id = optionIdFor(chosenStore, product);
      optionMap.set(id, product);
      handles.push(sanitizeOption(id, product));
    }
  }

  // --- 9. Generate recipe ---------------------------------------
  {
    const past = guard();
    if (past) return past;
  }
  let draft;
  try {
    draft = await deps.recipes.generate(
      {
        portions: interpreted.portions,
        vibe: interpreted.vibe,
        dietary: interpreted.dietary.map((d) => d.id),
        options: handles,
      },
      port,
    );
  } catch {
    return terminal("unknown", "recipe_generation_failed");
  }

  const validRequirements = draft.requirements.filter(
    (r) => optionMap.has(r.optionId) && Number.isFinite(r.requiredGrams) && r.requiredGrams > 0,
  );
  if (validRequirements.length === 0 || !Number.isInteger(draft.portions) || draft.portions < 1) {
    return terminal("unknown", "recipe_invalid");
  }

  // --- 10. Resolve purchase quantities -------------------------
  const requirements: BasketRequirement[] = validRequirements.map((r) => {
    const product = optionMap.get(r.optionId) as Product;
    return {
      concept: product.concept,
      recipeAmount: r.requiredGrams,
      role: r.role,
      forcedProductId: product.id,
    };
  });

  const builtBasket = compareStores({
    requirements,
    stores: [{ store: chosenStore, candidatesByConcept: chosenCandidates }],
    source: "primat",
    retrievedAtIso: nowIso,
  }).chosen;

  // --- 11. Pantry caps ---------------------------------------
  const pantry = applyPantryCaps(builtBasket.lines, request.pantry);
  let workingBasket = basketWithLines(builtBasket, pantry.lines);
  let adjustments: BasketAdjustment[] = [...pantry.adjustments];

  // --- 12. Nutrition (from recipeGrams, includes pantry items) ----
  {
    const past = guard();
    if (past) return past;
  }
  const facts = await deps.nutrition.lookup(
    requirements.map((r) => ({ concept: r.concept })),
    port,
  );
  const per100gByConcept = new Map(facts.map((f) => [f.concept, f.per100g]));
  const nutritionLines: NutritionInputLine[] = requirements.map((r) => ({
    concept: r.concept,
    recipeGrams: r.recipeAmount,
    per100g: per100gByConcept.get(r.concept) ?? null,
  }));
  const nutrition = aggregateNutrition(nutritionLines, draft.portions);

  // --- 13. Constraints + deterministic over-budget repair --------
  let overshootOre = ZERO_ORE;
  if (workingBasket.totalOre > interpreted.budgetOre) {
    const repair = repairOverBudget({
      basket: workingBasket,
      budgetOre: interpreted.budgetOre,
      requirements,
      candidatesByConcept: chosenCandidates,
    });
    workingBasket = repair.basket;
    adjustments = [...adjustments, ...repair.adjustments];
    overshootOre = repair.overshootOre;
  }

  const constraints = evaluateConstraints({
    budgetOre: interpreted.budgetOre,
    basketTotalOre: workingBasket.totalOre,
    requestedPortions: interpreted.portions,
    recipePortions: draft.portions,
    maxDistanceKm: interpreted.maxDistanceKm,
    storeDistanceKm: chosenStore.distanceKm,
    dietary: interpreted.dietary,
    nutrition,
    estimatedCookMinutes: draft.estimatedCookMinutes,
    coverageImpossible: false,
    providerFailure: false,
  });

  const provenance: Provenance[] = [
    { source: "primat", retrievedAt: nowIso, priceType: "regular" },
    { source: "nutrition", retrievedAt: nowIso, coverage: nutrition.coverageRatio },
    { source: "recipe-generator", retrievedAt: nowIso },
  ];

  // --- 14. Assemble the immutable PlanResult -------------------
  return {
    outcome: constraints.outcome,
    basket: workingBasket,
    nutrition,
    comparison: selection.comparison,
    constraints,
    adjustments,
    overshootOre,
    reason: null,
    provenance,
  };
}
