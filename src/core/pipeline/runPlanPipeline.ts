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
import { mergeDuplicateRequirements, repairOverBudget } from "../constraints/repair";
import { isPastDeadline, type PipelineContext } from "../clock";
import { sumOre, ZERO_ORE } from "../money";
import { aggregateNutrition, type NutritionInputLine } from "../nutrition/aggregate";
import type { PipelineDeps, PortCallOptions, RecipeOptionHandle, RecipeDraft, RecipeRequirementDraft } from "@/ports";
import type {
  Basket,
  BasketAdjustment,
  MealRequest,
  PlanOutcome,
  PlanResult,
  Product,
  Provenance,
  StoreOption,
  CandidateRejection,
  CanonicalUnit,
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
    recipe: null,
    candidateRejections: [],
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
function filterCandidates(concept: string, products: readonly Product[], store: StoreOption, rejections: CandidateRejection[]): Product[] {
  return products.filter((p) => {
    const reason = p.concept !== concept ? "concept_mismatch" : p.priceOre <= 0 || p.comparison.priceOre <= 0 ? "invalid_price" : p.packageSize <= 0 ? "invalid_amount" : null;
    if (reason) rejections.push({ storeKey: storeKey(store), concept, productId: p.id, reason });
    return reason === null;
  }).sort((a,b) => a.id.localeCompare(b.id));
}

function draftQuantity(r: RecipeRequirementDraft): { amount: number; unit: CanonicalUnit } | null {
  const set = [[r.requiredGrams, "g"], [r.requiredMl, "ml"], [r.requiredCount, "st"]] as const;
  const present = set.filter(([v]) => v !== undefined);
  if (present.length !== 1 || !Number.isFinite(present[0][0]) || (present[0][0] as number) <= 0) return null;
  return { amount: present[0][0] as number, unit: present[0][1] };
}

function compatible(product: Product, unit: CanonicalUnit): boolean {
  return product.packageUnit === unit || (unit === "g" && product.comparison.unit === "kg") || (unit === "ml" && product.comparison.unit === "l");
}

export class RecipeInvalid extends Error {
  constructor(readonly issues: readonly string[], readonly coreCoverageImpossible: boolean) { super(issues.join("; ")); this.name = "RecipeInvalid"; }
}

function validateDraft(draft: RecipeDraft, portions: number, optionMap: ReadonlyMap<string, Product>, coreConcepts: readonly string[]): { draft: RecipeDraft; requirements: readonly { raw: RecipeRequirementDraft; product: Product; amount: number; unit: CanonicalUnit }[] } {
  const issues: string[] = [];
  if (draft.portions !== portions) issues.push("portion_mismatch");
  const requirements = draft.requirements.flatMap((raw) => {
    const product = optionMap.get(raw.optionId); const q = draftQuantity(raw);
    if (!product) { issues.push(`unknown_option:${raw.optionId}`); return []; }
    if (!q) { issues.push(`invalid_quantity:${raw.optionId}`); return []; }
    if (!compatible(product, q.unit)) { issues.push(`unit_incompatible:${raw.optionId}`); return []; }
    return [{ raw, product, ...q }];
  });
  const covered = new Set(requirements.map((r) => r.product.concept));
  const missing = coreConcepts.filter((c) => !covered.has(c));
  if (missing.length) issues.push(`missing_core:${missing.join(",")}`);
  if (issues.length) throw new RecipeInvalid(issues, missing.length > 0 && issues.every((issue) => issue.startsWith("missing_core:")));
  return { draft, requirements };
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
  const candidateRejections: CandidateRejection[] = [];

  const guard = (): PlanResult | null =>
    isPastDeadline(ctx) ? terminal("unknown", "deadline_exceeded") : null;

  // --- 2. Resolve location → stores ------------------------------------
  {
    const past = guard();
    if (past) return past;
  }
  let discovery;
  try { discovery = await deps.stores.resolve(request.location, port); } catch { return terminal("unknown", "store_discovery_failed"); }
  { const past = guard(); if (past) return past; }
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
      { const past = guard(); if (past) return past; }
      let found; try { found = await deps.products.search({ concept, store, limit: RESULTS_PER_CONCEPT }, port); } catch { return terminal("unknown", "product_search_failed"); }
      { const past = guard(); if (past) return past; }
      byConcept.set(concept, filterCandidates(concept, found, store, candidateRejections));
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
  const chosenMissingCore = coreConcepts.filter((c) => (chosenCandidates.get(c) ?? []).length === 0);
  if (chosenMissingCore.length) return terminal("infeasible", `chosen_store_missing_core:${chosenMissingCore.join(",")}`);

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
  let validated: ReturnType<typeof validateDraft> | null = null;
  let invalid: RecipeInvalid | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let draft: RecipeDraft;
    try { draft = await deps.recipes.generate(
      {
        portions: interpreted.portions,
        vibe: interpreted.vibe,
        dietary: interpreted.dietary.map((d) => d.id),
        options: handles,
        validationIssues: attempt === 0 ? undefined : invalid?.issues,
      },
      port,
    ); } catch { return terminal("unknown", "recipe_generation_failed"); }
    { const past = guard(); if (past) return past; }
    try { validated = validateDraft(draft, interpreted.portions, optionMap, coreConcepts); break; } catch (error) { invalid = error as RecipeInvalid; }
  }
  if (!validated) return terminal(invalid?.coreCoverageImpossible ? "infeasible" : "unknown", `recipe_invalid:${invalid?.issues.join(",") ?? "unknown"}`);
  const draft = validated.draft;

  // --- 10. Resolve purchase quantities -------------------------
  const rawRequirements: BasketRequirement[] = validated.requirements.map(({ raw: r, product, amount, unit }) => {
    return {
      concept: product.concept,
      recipeAmount: amount,
      unit,
      requirementId: r.optionId,
      role: r.role,
      forcedProductId: product.id,
    };
  });
  const merged = mergeDuplicateRequirements(rawRequirements);
  const requirements = merged.requirements;

  const builtBasket = compareStores({
    requirements,
    stores: [{ store: chosenStore, candidatesByConcept: chosenCandidates }],
    source: "primat",
    retrievedAtIso: nowIso,
  }).chosen;

  // --- 11. Pantry caps ---------------------------------------
  const pantry = applyPantryCaps(builtBasket.lines, request.pantry);
  let workingBasket = basketWithLines(builtBasket, pantry.lines);
  let adjustments: BasketAdjustment[] = [...merged.adjustments, ...pantry.adjustments];

  // --- 12. Nutrition (from recipeGrams, includes pantry items) ----
  {
    const past = guard();
    if (past) return past;
  }
  let facts; try { facts = await deps.nutrition.lookup(
    requirements.map((r) => ({ concept: r.concept })),
    port,
  ); } catch { return terminal("unknown", "nutrition_lookup_failed"); }
  { const past = guard(); if (past) return past; }
  const per100gByConcept = new Map(facts.map((f) => [f.concept, f.per100g]));
  const nutritionLines: NutritionInputLine[] = requirements.filter((r) => r.unit === "g").map((r) => ({
    concept: r.concept,
    recipeGrams: r.recipeAmount,
    per100g: per100gByConcept.get(r.concept) ?? null,
  }));
  const nutrition = aggregateNutrition(nutritionLines, draft.portions);

  // --- 13. Constraints + deterministic over-budget repair --------
  let overshootOre = ZERO_ORE;
  let workingSteps = draft.steps.map((s) => ({ text: s.text, durationSeconds: s.durationSeconds, ingredientRefs: s.optionRefs }));
  if (workingBasket.totalOre > interpreted.budgetOre) {
    const repair = repairOverBudget({
      basket: workingBasket,
      budgetOre: interpreted.budgetOre,
      requirements: requirements.filter((r) => workingBasket.lines.some((l) => l.concept === r.concept)),
      candidatesByConcept: chosenCandidates,
      steps: draft.steps.map((s) => ({ text: s.text, durationSeconds: s.durationSeconds, ingredientRefs: s.optionRefs })),
    });
    workingBasket = repair.basket;
    adjustments = [...adjustments, ...repair.adjustments];
    overshootOre = repair.overshootOre;
    workingSteps = [...repair.steps];
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
    recipe: { title: draft.title, portions: draft.portions, steps: workingSteps },
    candidateRejections,
    overshootOre,
    reason: null,
    provenance,
  };
}
