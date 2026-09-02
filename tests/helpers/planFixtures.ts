/**
 * `PlanResult` fixtures for the UI tests.
 *
 * Shaped from a real `POST /api/plan` response in `DATA_SOURCE=fixture
 * APP_MODE=demo` (Umeå store set, Coop/ICA/Willys), then trimmed to the fields
 * the PLAN screen reads. The `ok` fixture carries nutrition coverage above the
 * 0.7 suppression floor so the macro rows and the accent bar are exercised; the
 * `suppressed` variant drops below it.
 */

import type {
  Basket,
  BasketLine,
  Ore,
  PlanResult,
  Product,
  StoreOption,
} from "@/core/types";

const ore = (value: number) => value as Ore;

const COOP: StoreOption = {
  chain: "coop",
  storeId: "232400",
  name: "Stora Coop Avion",
  tier: "full",
  distanceKm: 2.4,
  confirmedAt: "2026-09-01T07:50:06.691Z",
};

const ICA: StoreOption = {
  chain: "ica",
  storeId: "1003828",
  name: "Maxi ICA Stormarknad Umeå",
  tier: "full",
  distanceKm: 4.1,
  confirmedAt: "2026-09-01T07:50:06.691Z",
};

const WILLYS: StoreOption = {
  chain: "willys",
  storeId: "2276",
  name: "Willys Umeå Syd",
  tier: "full",
  distanceKm: 2.5,
  confirmedAt: "2026-09-01T07:50:06.691Z",
};

function product(overrides: Partial<Product> & Pick<Product, "id" | "name" | "concept">): Product {
  return {
    brand: "Xtra",
    priceOre: ore(13195),
    packageSize: 2000,
    packageUnit: "g",
    comparison: { priceOre: ore(6597), unit: "kg" },
    section: "KÖTT & PROTEIN",
    categoryPath: ["kött"],
    dietaryTags: [],
    ...overrides,
  };
}

function line(overrides: Partial<BasketLine> & Pick<BasketLine, "concept" | "product">): BasketLine {
  return {
    role: "core",
    recipeGrams: 320,
    purchase: {
      purchasedGrams: 2000,
      purchasedAmount: 2000,
      unit: "g",
      priceOre: ore(13195),
      packs: 1,
      variableWeight: false,
    },
    provenance: { source: "primat", retrievedAt: "2026-09-01T08:02:15.965Z", priceType: "regular" },
    ...overrides,
  };
}

const LINES: BasketLine[] = [
  line({
    concept: "kyckling",
    product: product({ id: "7340191130128", name: "Kycklingbröstfilé mörad", concept: "kyckling" }),
  }),
  line({
    concept: "körsbärstomat",
    product: product({
      id: "7340191179417",
      name: "Körsbärstomater",
      concept: "körsbärstomat",
      brand: "Mutti",
      priceOre: ore(2224),
      packageSize: 400,
      comparison: { priceOre: ore(5560), unit: "kg" },
      section: "FRUKT & GRÖNT",
    }),
    recipeGrams: 240,
    purchase: {
      purchasedGrams: 400,
      purchasedAmount: 400,
      unit: "g",
      priceOre: ore(2224),
      packs: 1,
      variableWeight: false,
    },
  }),
  line({
    concept: "sallad",
    product: product({
      id: "8005110550508",
      name: "Salladsost",
      concept: "sallad",
      priceOre: ore(2740),
      packageSize: 250,
      comparison: { priceOre: ore(10960), unit: "kg" },
      section: "MEJERI",
    }),
    role: "supporting",
    recipeGrams: 400,
    purchase: {
      purchasedGrams: 500,
      purchasedAmount: 500,
      unit: "g",
      priceOre: ore(5480),
      packs: 2,
      variableWeight: false,
    },
  }),
];

const BASKET: Basket = {
  store: COOP,
  lines: LINES,
  totalOre: ore(20899),
  missingConcepts: [],
  coverageRatio: 1,
  coreCoverageRatio: 1,
  supportingCoverageRatio: 1,
};

const COMPARISON = {
  entries: [
    { store: COOP, totalOre: ore(21856), coverageRatio: 1, distanceKm: 2.4, missingConcepts: [], chosen: true },
    { store: ICA, totalOre: ore(14004), coverageRatio: 0.75, distanceKm: 4.1, missingConcepts: ["olivolja"], chosen: false },
    { store: WILLYS, totalOre: ore(22718), coverageRatio: 0.75, distanceKm: 2.5, missingConcepts: ["sallad"], chosen: false },
  ],
  chosenStoreKey: "coop:232400",
} as const;

const RECIPE = {
  title: "Krämig tomatpasta med vita bönor",
  portions: 4,
  steps: [
    { text: "Koka 320 g pasta enligt anvisningen tills den är al dente; spara 1 dl kokvatten.", durationSeconds: 600, ingredientRefs: ["a"] },
    { text: "Sjud 400 g tomat och 240 g avrunna vita bönor i en rymlig panna i 8 minuter.", durationSeconds: 480, ingredientRefs: ["b"] },
    { text: "Vänd ner pastan och späd med lite kokvatten; rör i 2 minuter tills såsen är krämig.", durationSeconds: 120, ingredientRefs: ["c"] },
  ],
} as const;

const PROVENANCE = [
  { source: "primat", retrievedAt: "2026-09-01T08:02:15.965Z", priceType: "regular" as const },
  { source: "nutrition", retrievedAt: "2026-09-01T08:02:15.965Z", coverage: 0.92 },
  { source: "recipe-generator", retrievedAt: "2026-09-01T08:02:15.965Z" },
];

/** Coverage 0.92 — above the 0.7 floor, so macros render. */
const NUTRITION_OK = {
  total: { kcal: 2448, proteinG: 164.4, carbsG: 192.2, fatG: 96.8 },
  perPortion: { kcal: 612, proteinG: 41.1, carbsG: 48.05, fatG: 24.2 },
  portions: 4,
  coverageRatio: 0.92,
  suppressed: false,
};

/** Coverage 0.31 — below the floor (AD-9), macros suppressed with a footnote. */
const NUTRITION_SUPPRESSED = {
  ...NUTRITION_OK,
  coverageRatio: 0.31,
  suppressed: true,
};

export const OK_PLAN: PlanResult = {
  outcome: "ok",
  basket: BASKET,
  nutrition: NUTRITION_OK,
  comparison: COMPARISON,
  constraints: {
    outcome: "ok",
    checks: [
      { id: "budget", label: "Budget", evidence: "verified", status: "pass", detail: "Korgen kostar 208,99 kr av 300,00 kr" },
      { id: "portions", label: "Portioner", evidence: "verified", status: "pass", detail: "4 portioner" },
      { id: "distance", label: "Avstånd", evidence: "verified", status: "pass", detail: "2.4 km (max 5.0 km)" },
      { id: "cook_time", label: "Tillagningstid", evidence: "estimated", status: "pass", detail: "ca 20 min (önskemål max 30 min, uppskattning)" },
      { id: "nutrition", label: "Näringsvärde", evidence: "estimated", status: "pass", detail: "ca 612 kcal/portion (täckning 92%)" },
      { id: "dietary:allergy_freetext", label: "Allergi angiven i fritext", evidence: "unsupported", status: "disclaimer", detail: "Allergisäkerhet kan inte garanteras från butiksdata — kontrollera förpackningen" },
    ],
  },
  adjustments: [],
  recipe: RECIPE,
  candidateRejections: [],
  overshootOre: ore(0),
  reason: null,
  provenance: PROVENANCE,
};

export const SUPPRESSED_PLAN: PlanResult = {
  ...OK_PLAN,
  nutrition: NUTRITION_SUPPRESSED,
};

export const OVER_BUDGET_PLAN: PlanResult = {
  ...OK_PLAN,
  outcome: "over_budget",
  basket: { ...BASKET, totalOre: ore(9545) },
  overshootOre: ore(3545),
  constraints: {
    outcome: "over_budget",
    checks: [
      { id: "budget", label: "Budget", evidence: "verified", status: "fail", detail: "Korgen kostar 95,45 kr — 35,45 kr över budget" },
      ...OK_PLAN.constraints.checks.slice(1),
    ],
  },
  adjustments: [
    { kind: "substitute_cheaper", concept: "kyckling", deltaOre: ore(-8846), detail: "Byte: Kycklingbröstfilé mörad → Krämig Kycklinggryta" },
    { kind: "substitute_cheaper", concept: "sallad", deltaOre: ore(-1751), detail: "Byte: Salladsost → Salladskål" },
  ],
};

export const INFEASIBLE_PLAN: PlanResult = {
  outcome: "infeasible",
  basket: null,
  nutrition: null,
  comparison: null,
  constraints: { checks: [], outcome: "infeasible" },
  adjustments: [],
  recipe: null,
  candidateRejections: [],
  overshootOre: ore(0),
  reason: "no_store_in_range",
  provenance: [],
};

export const SINGLE_STORE_PLAN: PlanResult = {
  ...OK_PLAN,
  comparison: { entries: [COMPARISON.entries[0]], chosenStoreKey: "coop:232400" },
};

/** `budgetOre` matches the 300 kr the demo scenario submits. */
export const REQUEST = {
  budgetOre: ore(30000),
  portions: 4,
  maxDistanceKm: 5,
  vibe: "Något fräscht, kryddstarkt och asiatiskt-inspirerat, gärna högt protein",
};
