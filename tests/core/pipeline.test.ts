import { describe, expect, it } from "vitest";

import { FixedClock, type PipelineContext } from "@/core/clock";
import { ore } from "@/core/money";
import type {
  NutritionFact,
  NutritionLookup,
  PipelineDeps,
  PortCallOptions,
  PriceQuote,
  ProductSearchQuery,
  ProductSearchResult,
  RecipeDraft,
  RecipeGenerationInput,
  StoreDiscoveryResult,
} from "@/ports";
import { runPlanPipeline } from "@/core/pipeline";
import { PipelineValidationError } from "@/core/pipeline";
import type { MealRequest, NutrientVector, Product, StoreOption } from "@/core/types";

// --------------------------------------------------------------------------
// Fakes
// --------------------------------------------------------------------------

const UMEA_STORES: StoreOption[] = [
  { chain: "ica", storeId: "1001", name: "ICA Maxi Umeå", tier: "full", distanceKm: 1.0, confirmedAt: "2026-08-25T00:00:00.000Z" },
  { chain: "coop", storeId: "2002", name: "Coop Umeå", tier: "full", distanceKm: 2.0, confirmedAt: "2026-08-25T00:00:00.000Z" },
  { chain: "willys", storeId: "3003", name: "Willys Umeå", tier: "full", distanceKm: 3.0, confirmedAt: "2026-08-25T00:00:00.000Z" },
];

function p(over: Partial<Product> & Pick<Product, "id" | "concept">): Product {
  return {
    name: over.id,
    brand: null,
    priceOre: ore(1000),
    packageSize: 500,
    packageUnit: "g",
    comparison: { priceOre: ore(2000), unit: "st" },
    section: "TORRVAROR",
    categoryPath: ["TORRVAROR"],
    dietaryTags: [],
    ...over,
  };
}

const CATALOG: Map<string, Product[]> = new Map([
  ["olivolja", [p({ id: "olivolja-500", concept: "olivolja", packageSize: 500, priceOre: ore(2900) })]],
  ["salt", [p({ id: "salt-500", concept: "salt", packageSize: 500, priceOre: ore(900) })]],
  ["svartpeppar", [p({ id: "svartpeppar-50", concept: "svartpeppar", packageSize: 50, priceOre: ore(2500) })]],
  ["gul lök", [p({ id: "gul-lok_KG", concept: "gul lök", comparison: { priceOre: ore(1990), unit: "kg" }, packageSize: 1000 })]],
  ["ost", [p({ id: "ost-100", concept: "ost", packageSize: 100, priceOre: ore(1500) })]],
  [
    "pasta",
    [
      p({ id: "pasta-700", concept: "pasta", packageSize: 700, priceOre: ore(1895) }),
      p({ id: "pasta-500-billig", concept: "pasta", packageSize: 500, priceOre: ore(1200) }),
    ],
  ],
  ["krossade tomater", [p({ id: "tomat-400", concept: "krossade tomater", packageSize: 400, priceOre: ore(1290) })]],
  ["halloumi", [p({ id: "halloumi_KG", concept: "halloumi", comparison: { priceOre: ore(9900), unit: "kg" }, packageSize: 1000 })]],
]);

const NUTRITION: Map<string, NutrientVector> = new Map([
  ["olivolja", { kcal: 884, proteinG: 0, carbsG: 0, fatG: 100 }],
  ["salt", { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }],
  ["svartpeppar", { kcal: 251, proteinG: 10, carbsG: 64, fatG: 3.3 }],
  ["gul lök", { kcal: 40, proteinG: 1.1, carbsG: 9.3, fatG: 0.1 }],
  ["ost", { kcal: 149, proteinG: 6.4, carbsG: 33, fatG: 0.5 }],
  ["pasta", { kcal: 371, proteinG: 13, carbsG: 75, fatG: 1.5 }],
  ["krossade tomater", { kcal: 32, proteinG: 1.6, carbsG: 6, fatG: 0.3 }],
  ["halloumi", { kcal: 431, proteinG: 38, carbsG: 4, fatG: 29 }],
]);

const RECIPE_PLAN: { concept: string; hint: string; grams: number; role: "core" | "supporting" }[] = [
  { concept: "olivolja", hint: "olivolja", grams: 15, role: "supporting" },
  { concept: "salt", hint: "salt", grams: 5, role: "supporting" },
  { concept: "svartpeppar", hint: "svartpeppar", grams: 3, role: "supporting" },
  { concept: "gul lök", hint: "gul-lok_KG", grams: 500, role: "supporting" },
  { concept: "ost", hint: "ost-100", grams: 8, role: "supporting" },
  { concept: "pasta", hint: "pasta-700", grams: 500, role: "core" },
  { concept: "krossade tomater", hint: "tomat-400", grams: 380, role: "core" },
  { concept: "halloumi", hint: "halloumi_KG", grams: 40, role: "core" },
];

function makeDeps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    stores: {
      async resolve(): Promise<StoreDiscoveryResult> {
        return {
          location: { lat: 63.83, lon: 20.26, label: "Umeå (demo)", isDemoDefault: true },
          stores: UMEA_STORES,
        };
      },
    },
    products: {
      async search(query: ProductSearchQuery): Promise<ProductSearchResult> {
        return { products: CATALOG.get(query.concept) ?? [], rejections: [] };
      },
    },
    prices: {
      async quote(): Promise<readonly PriceQuote[]> {
        return [];
      },
    },
    nutrition: {
      async lookup(concepts: readonly NutritionLookup[]): Promise<readonly NutritionFact[]> {
        return concepts
          .filter((c) => NUTRITION.has(c.concept))
          .map((c) => ({
            concept: c.concept,
            per100g: NUTRITION.get(c.concept) as NutrientVector,
            source: "off-snapshot",
            retrievedAtIso: "2026-08-27T09:00:00.000Z",
          }));
      },
    },
    recipes: {
      async generate(input: RecipeGenerationInput): Promise<RecipeDraft> {
        const requirements = RECIPE_PLAN.flatMap((plan) => {
          const handle = input.options.find(
            (o) => o.concept === plan.concept && o.optionId.includes(plan.hint),
          );
          return handle
            ? [{ optionId: handle.optionId, requiredGrams: plan.grams, role: plan.role }]
            : [];
        });
        return {
          title: "Krämig tomatpasta",
          portions: input.portions,
          requirements,
          steps: [{ text: "Koka pastan.", durationSeconds: 600, optionRefs: [] }],
          estimatedCookMinutes: 25,
          explanation: "Passar din mysiga pastakväll.",
        };
      },
    },
    ...overrides,
  };
}

const BASE_REQUEST: MealRequest = {
  location: "Umeå",
  budgetSek: "150",
  portions: 4,
  maxDistanceKm: 5,
  maxCookMinutes: 30,
  dietary: [{ id: "vegetarian", label: "Vegetarisk", safetyCritical: false }],
  pantry: [],
  vibe: "mysig pastakväll",
};

function ctx(clock = new FixedClock("2026-08-27T09:00:00.000Z")): PipelineContext {
  return { clock, deadlineAt: clock.now() + 30_000 };
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("runPlanPipeline — happy path", () => {
  it("returns an ok plan within budget", async () => {
    const result = await runPlanPipeline(BASE_REQUEST, makeDeps(), ctx());
    expect(result.outcome).toBe("ok");
    expect(result.basket).not.toBeNull();
    expect(result.basket?.store.storeId).toBe("1001"); // closest of three identical baskets
    expect(result.basket?.totalOre).toBe(12376);
    expect(result.comparison?.entries).toHaveLength(3);
    expect(result.overshootOre).toBe(0);
  });

  it("diversifies the shortlist by chain before adding another store from the same chain", async () => {
    const stores: StoreOption[] = [
      { ...UMEA_STORES[1], storeId: "coop-1", distanceKm: 0.5 },
      { ...UMEA_STORES[1], storeId: "coop-2", distanceKm: 0.6 },
      { ...UMEA_STORES[1], storeId: "coop-3", distanceKm: 0.7 },
      { ...UMEA_STORES[0], storeId: "ica-1", distanceKm: 1.5 },
    ];
    const result = await runPlanPipeline(BASE_REQUEST, makeDeps({ stores: { async resolve() { return { location: { lat: 0, lon: 0, label: "Umeå", isDemoDefault: false }, stores }; } } }), ctx());
    expect(new Set(result.comparison?.entries.map(({ store }) => store.chain))).toEqual(new Set(["coop", "ica"]));
  });

  it("case: 700 g pack for a 500 g need — full pack price billed, nutrition uses 500 g", async () => {
    const result = await runPlanPipeline(BASE_REQUEST, makeDeps(), ctx());
    const pasta = result.basket?.lines.find((l) => l.concept === "pasta");
    expect(pasta?.product.id).toBe("pasta-700");
    expect(pasta?.recipeGrams).toBe(500);
    expect(pasta?.purchase.purchasedGrams).toBe(700);
    expect(pasta?.purchase.priceOre).toBe(1895); // full pack, not prorated
    expect(pasta?.purchase.packs).toBe(1);
  });

  it("case: variable-weight item, 500 g need — charged at comparison price / 1000, half-up", async () => {
    const result = await runPlanPipeline(BASE_REQUEST, makeDeps(), ctx());
    const lok = result.basket?.lines.find((l) => l.concept === "gul lök");
    expect(lok?.purchase.variableWeight).toBe(true);
    expect(lok?.purchase.packs).toBeNull();
    expect(lok?.purchase.purchasedGrams).toBe(500);
    expect(lok?.purchase.priceOre).toBe(995); // 500 g * 19,90 kr/kg
  });

  it("case: per-portion macros × portions reconcile to the total from unrounded values", async () => {
    const result = await runPlanPipeline(BASE_REQUEST, makeDeps(), ctx());
    const n = result.nutrition;
    expect(n).not.toBeNull();
    for (const key of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
      expect((n?.perPortion[key] ?? 0) * (n?.portions ?? 1)).toBeCloseTo(n?.total[key] ?? 0, 9);
    }
    expect(n?.coverageRatio).toBe(1);
    expect(n?.suppressed).toBe(false);
  });
});

describe("runPlanPipeline — pantry caps", () => {
  it("case: 'har olja' removes only the capped oil line; the rest of the basket is intact", async () => {
    const request: MealRequest = { ...BASE_REQUEST, pantry: [{ raw: "har olja", concept: "olja" }] };
    const result = await runPlanPipeline(request, makeDeps(), ctx());
    expect(result.basket?.lines.some((l) => l.concept === "olivolja")).toBe(false);
    expect(result.basket?.lines).toHaveLength(RECIPE_PLAN.length - 1);
    expect(result.basket?.totalOre).toBe(12376 - 2900);
    const adj = result.adjustments.find((a) => a.kind === "pantry_cap");
    expect(adj?.concept).toBe("olivolja");
    expect(adj?.deltaOre).toBe(-2900);
  });

  it("a large non-staple pantry claim does not zero its line", async () => {
    const request: MealRequest = {
      ...BASE_REQUEST,
      pantry: [{ raw: "har massor av parmesan", concept: "parmesan" }],
    };
    const result = await runPlanPipeline(request, makeDeps(), ctx());
    expect(result.basket?.lines.some((l) => l.concept === "halloumi")).toBe(true);
    expect(result.adjustments).toHaveLength(0);
  });
});

describe("runPlanPipeline — over budget", () => {
  it("case: repair picks a cheaper authorized SKU, then terminates over_budget with the exact overshoot + audit trail", async () => {
    const request: MealRequest = {
      ...BASE_REQUEST,
      budgetSek: "85",
      pantry: [{ raw: "har olja", concept: "olja" }],
    };
    const result = await runPlanPipeline(request, makeDeps(), ctx());
    expect(result.outcome).toBe("over_budget");
    // 9476 basket − 695 pasta substitution = 8781; budget 8500 → overshoot 281
    expect(result.basket?.totalOre).toBe(8781);
    expect(result.overshootOre).toBe(281);
    const kinds = result.adjustments.map((a) => a.kind);
    expect(kinds).toEqual(["pantry_cap", "substitute_cheaper"]);
    const sub = result.adjustments.find((a) => a.kind === "substitute_cheaper");
    expect(sub?.concept).toBe("pasta");
    expect(sub?.deltaOre).toBe(-695);
    const budgetCheck = result.constraints.checks.find((c) => c.id === "budget");
    expect(budgetCheck?.status).toBe("fail");
    expect(budgetCheck?.evidence).toBe("verified");
  });
});

describe("runPlanPipeline — infeasible", () => {
  it("case: no store in range → infeasible (not a mutilated result)", async () => {
    const deps = makeDeps({
      stores: {
        async resolve(): Promise<StoreDiscoveryResult> {
          return {
            location: { lat: 0, lon: 0, label: "Ingenstans", isDemoDefault: false },
            stores: UMEA_STORES.map((s) => ({ ...s, distanceKm: 42 })),
          };
        },
      },
    });
    const result = await runPlanPipeline(BASE_REQUEST, deps, ctx());
    expect(result.outcome).toBe("infeasible");
    expect(result.reason).toBe("no_store_in_range");
    expect(result.basket).toBeNull();
    expect(result.nutrition).toBeNull();
  });

  it("distinguishes partial-only stores and reports the nearest full store", async () => {
    const deps = makeDeps({ stores: { async resolve() { return {
      location: { lat: 0, lon: 0, label: "Sorsele", isDemoDefault: false },
      stores: [
        { chain: "ica", storeId: "near", name: "ICA Nära", tier: "offers_only", distanceKm: 5.5, confirmedAt: "2026-08-25T00:00:00.000Z" },
        { chain: "coop", storeId: "full", name: "Coop Sorsele", tier: "full", distanceKm: 27, confirmedAt: "2026-08-25T00:00:00.000Z" },
      ],
    }; } } });
    await expect(runPlanPipeline(BASE_REQUEST, deps, ctx())).resolves.toMatchObject({
      outcome: "infeasible",
      reason: "only_partial_stores_in_range",
      nearestFullStore: { name: "Coop Sorsele", distanceKm: 27 },
    });
  });

  it("core-concept coverage impossible → infeasible", async () => {
    const deps = makeDeps({
      products: {
        async search(query: ProductSearchQuery): Promise<ProductSearchResult> {
          if (query.concept === "pasta") return { products: [], rejections: [] };
          return { products: CATALOG.get(query.concept) ?? [], rejections: [] };
        },
      },
    });
    const result = await runPlanPipeline(BASE_REQUEST, deps, ctx());
    expect(result.outcome).toBe("infeasible");
    expect(result.reason).toMatch(/^core_coverage_impossible:/);
  });

  it("a blown deadline returns unknown, not a partial plan", async () => {
    const clock = new FixedClock("2026-08-27T09:00:00.000Z");
    const result = await runPlanPipeline(BASE_REQUEST, makeDeps(), {
      clock,
      deadlineAt: clock.now() - 1,
    });
    expect(result.outcome).toBe("unknown");
    expect(result.reason).toBe("deadline_exceeded");
  });
});

describe("runPlanPipeline — validation", () => {
  it("throws PipelineValidationError on a bad request", async () => {
    await expect(
      runPlanPipeline({ ...BASE_REQUEST, budgetSek: "0" }, makeDeps(), ctx()),
    ).rejects.toBeInstanceOf(PipelineValidationError);
  });

  it("retries once, requests the demo fallback, then returns unknown if that is also invalid", async () => {
    let calls = 0;
    const deps = makeDeps({ recipes: { async generate(input): Promise<RecipeDraft> { calls += 1; const base = await makeDeps().recipes.generate(input, { deadlineAt: 0, clock: new FixedClock() }); return { ...base, requirements: [{ optionId: "not-issued", requiredGrams: 100, role: "core" }] }; } } });
    const result = await runPlanPipeline(BASE_REQUEST, deps, ctx());
    expect(calls).toBe(3);
    expect(result.outcome).toBe("unknown");
    expect(result.reason).toContain("unknown_option");
  });

  it("returns infeasible when recipe output drops a core concept", async () => {
    const baseRecipes = makeDeps().recipes;
    const deps = makeDeps({ recipes: { async generate(input, options): Promise<RecipeDraft> { const draft = await baseRecipes.generate(input, options); return { ...draft, requirements: draft.requirements.filter((r) => !input.options.find((o) => o.optionId === r.optionId)?.concept.includes("pasta")) }; } } });
    const result = await runPlanPipeline(BASE_REQUEST, deps, ctx());
    expect(result.outcome).toBe("infeasible");
    expect(result.reason).toContain("missing_core:pasta");
  });

  it("portion mismatch cannot aggregate to ok", async () => {
    const baseRecipes = makeDeps().recipes;
    const deps = makeDeps({ recipes: { async generate(input, options): Promise<RecipeDraft> { return { ...(await baseRecipes.generate(input, options)), portions: input.portions + 1 }; } } });
    const result = await runPlanPipeline(BASE_REQUEST, deps, ctx());
    expect(result.outcome).toBe("unknown");
    expect(result.reason).toContain("portion_mismatch");
  });

  it("turns a provider exception into unknown", async () => {
    const deps = makeDeps({ products: { async search(): Promise<ProductSearchResult> { throw new Error("offline"); } } });
    await expect(runPlanPipeline(BASE_REQUEST, deps, ctx())).resolves.toMatchObject({ outcome: "unknown", reason: "product_search_failed" });
  });

  it("checks the shared deadline immediately after a provider call", async () => {
    let now = 0;
    const clock = { now: () => now, nowIso: () => "2026-01-01T00:00:00.000Z" };
    const deps = makeDeps({ stores: { async resolve(): Promise<StoreDiscoveryResult> { now = 10; return { location: { lat: 0, lon: 0, label: "x", isDemoDefault: false }, stores: UMEA_STORES }; } } });
    const result = await runPlanPipeline(BASE_REQUEST, deps, { clock, deadlineAt: 10 });
    expect(result).toMatchObject({ outcome: "unknown", reason: "deadline_exceeded" });
  });

  it("rejects a count requirement for a grams-only product", async () => {
    const baseRecipes = makeDeps().recipes;
    const deps = makeDeps({ recipes: { async generate(input, options): Promise<RecipeDraft> { const draft = await baseRecipes.generate(input, options); return { ...draft, requirements: draft.requirements.map((r) => input.options.find((o) => o.optionId === r.optionId)?.concept === "pasta" ? { optionId: r.optionId, requiredCount: 1, role: r.role } : r) }; } } });
    const result = await runPlanPipeline(BASE_REQUEST, deps, ctx());
    expect(result.outcome).toBe("unknown");
    expect(result.reason).toContain("unit_incompatible");
  });

  it("records deterministic candidate rejection reasons", async () => {
    const deps = makeDeps({ products: { async search(query): Promise<ProductSearchResult> { const valid = CATALOG.get(query.concept) ?? []; return { products: [...valid, p({ id: `bad-${query.concept}`, concept: query.concept, priceOre: ore(0) })], rejections: [{ storeKey: `${query.store.chain}:${query.store.storeId}`, concept: query.concept, productId: `adapter-${query.concept}`, reason: "concept_mismatch" }] }; } } });
    const result = await runPlanPipeline(BASE_REQUEST, deps, ctx());
    expect(result.candidateRejections).toContainEqual(expect.objectContaining({ productId: "bad-pasta", reason: "invalid_price" }));
    expect(result.candidateRejections).toContainEqual(expect.objectContaining({ productId: "adapter-pasta", reason: "concept_mismatch" }));
  });
});

describe("golden determinism (AD-4)", () => {
  it("produces a deep-equal PlanResult on two runs with frozen inputs + FixedClock", async () => {
    const request: MealRequest = { ...BASE_REQUEST, budgetSek: "85", pantry: [{ raw: "har olja", concept: "olja" }] };
    const a = await runPlanPipeline(request, makeDeps(), ctx());
    const b = await runPlanPipeline(request, makeDeps(), ctx());
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
