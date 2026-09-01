/**
 * Domain types for the deterministic plan engine (AD-3..AD-7).
 *
 * Every value here is plain data. Money is integer öre (`Ore`), never a SEK
 * float. `BasketLine` keeps the recipe quantity (`recipeGrams`, drives nutrition)
 * strictly separate from the purchase quantity (`purchase.*`, drives cost).
 */

/** Integer öre. The only money representation inside the engine (AD-4). */
export type Ore = number & { readonly __brand: "Ore" };

/** Canonical unit after normalization (AD-3 step 4, `units.ts`). */
export type CanonicalUnit = "g" | "ml" | "st";

/** Evidence class for a constraint check (AD-5). */
export type EvidenceClass = "verified" | "estimated" | "unsupported";

/** Role of a requirement in the recipe (AD-7 objective + garnish removal). */
export type RequirementRole = "core" | "supporting" | "optional_garnish";

/** Terminal outcome of a plan (AD-5 aggregation). */
export type PlanOutcome = "ok" | "over_budget" | "infeasible" | "unknown";

/** Store tier — only `full` stores can carry a full-basket claim (AD-3 step 3). */
export type StoreTier = "full" | "offers_only" | "register_only";

export type StoreSection = "FRUKT & GRÖNT" | "KÖTT & PROTEIN" | "MEJERI" | "TORRVAROR" | "KRYDDOR" | "ÖVRIGT";

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export interface DietaryConstraint {
  /** Stable id, e.g. `"vegetarian"`, `"gluten_free"`, `"nut_allergy"`. */
  readonly id: string;
  /** Swedish user-facing label. */
  readonly label: string;
  /** `true` when the user framed it as an allergy / safety requirement. */
  readonly safetyCritical: boolean;
}

export interface PantryClaim {
  /** Free-text pantry item as the user typed it, e.g. `"har olja"`. */
  readonly raw: string;
  /** Normalized concept key the claim maps to, e.g. `"olja"`. */
  readonly concept: string;
}

export interface MealRequest {
  /** Free-text place or postcode. Demo/fixture mode may leave this empty. */
  readonly location: string | null;
  /** Budget as the user typed it (SEK decimal string), e.g. `"150"` / `"149,90"`. */
  readonly budgetSek: string;
  readonly portions: number;
  /** Max walking/travel distance in km. */
  readonly maxDistanceKm: number;
  /** Optional estimated cooking-time preference in minutes. */
  readonly maxCookMinutes: number | null;
  readonly dietary: readonly DietaryConstraint[];
  readonly pantry: readonly PantryClaim[];
  /** Free-text "vibe". Never logged, never fixtured (AD-10). */
  readonly vibe: string;
}

/** Request after validation + classification (AD-3 step 1). */
export interface InterpretedRequest {
  readonly budgetOre: Ore;
  readonly portions: number;
  readonly maxDistanceKm: number;
  readonly maxCookMinutes: number | null;
  readonly dietary: readonly DietaryConstraint[];
  readonly pantry: readonly PantryClaim[];
  readonly vibe: string;
  /** Deterministic concept list derived from the request (AD-3 step 4). */
  readonly concepts: readonly string[];
}

// ---------------------------------------------------------------------------
// Stores & products
// ---------------------------------------------------------------------------

export interface StoreOption {
  readonly chain: string;
  readonly storeId: string;
  readonly name: string;
  readonly tier: StoreTier;
  readonly distanceKm: number;
  /** ISO timestamp the store record was last confirmed (freshness tiebreak). */
  readonly confirmedAt: string;
}

/** Stable key for deterministic tiebreaks: `"<chain>:<storeId>"`. */
export function storeKey(store: Pick<StoreOption, "chain" | "storeId">): string {
  return `${store.chain}:${store.storeId}`;
}

export interface ComparisonUnitPrice {
  /** Price per `unit` for cross-product comparison, in öre. */
  readonly priceOre: Ore;
  /** `"kg"` | `"l"` | `"st"` — `"kg"` implies a variable-weight product (AD-4). */
  readonly unit: "kg" | "l" | "st";
}

export interface Product {
  /** Retailer SKU id. Ends `_KG` for variable-weight lines in the Primat feed. */
  readonly id: string;
  readonly name: string;
  /** Canonical concept this product was matched to. */
  readonly concept: string;
  readonly brand: string | null;
  /** Shelf price a non-member pays (`prices.regular`, AD-4). */
  readonly priceOre: Ore;
  /** Declared package size, normalized. `st` for count packs. */
  readonly packageSize: number;
  readonly packageUnit: CanonicalUnit;
  readonly comparison: ComparisonUnitPrice;
  readonly section: StoreSection;
  /** Retailer category path, coarse → fine. Used by the candidate filter. */
  readonly categoryPath: readonly string[];
  /** Dietary assertions with known provenance (e.g. `["vegetarian"]`). */
  readonly dietaryTags: readonly string[];
}

// ---------------------------------------------------------------------------
// Requirements & basket
// ---------------------------------------------------------------------------

export interface IngredientRequirement {
  readonly concept: string;
  /** Amount the recipe consumes, in the canonical unit. Drives nutrition. */
  readonly recipeAmount: number;
  readonly unit: CanonicalUnit;
  readonly role: RequirementRole;
  /** Opaque request-scoped handle the model selected (AD-3 step 8). */
  readonly optionId: string;
}

export interface PurchaseResolution {
  /** Grams actually bought (pack multiple, or exact for variable weight). */
  readonly purchasedGrams: number;
  /** Purchase amount in the product's canonical dimension. */
  readonly purchasedAmount?: number;
  readonly unit?: CanonicalUnit;
  /** Cost of that purchase, integer öre. Drives the basket total. */
  readonly priceOre: Ore;
  /** Number of fixed packs bought. `null` for a variable-weight cut. */
  readonly packs: number | null;
  readonly variableWeight: boolean;
}

export interface Provenance {
  readonly source: string;
  /** ISO timestamp the fact was retrieved. */
  readonly retrievedAt: string;
  readonly priceType?: "regular" | "member" | "offer" | "multiprice";
  /** Coverage ratio for estimated facts (nutrition). */
  readonly coverage?: number;
}

export interface BasketLine {
  readonly concept: string;
  readonly product: Product;
  readonly role: RequirementRole;
  /** Recipe consumption in grams. NEVER derived from `purchase` (AD-4). */
  readonly recipeGrams: number;
  readonly recipeAmount?: number;
  readonly unit?: CanonicalUnit;
  readonly purchase: PurchaseResolution;
  readonly provenance: Provenance;
}

export interface Basket {
  readonly store: StoreOption;
  readonly lines: readonly BasketLine[];
  readonly totalOre: Ore;
  /** Concepts with no line (uncovered). */
  readonly missingConcepts: readonly string[];
  /** Covered core+supporting concepts / total core+supporting concepts. */
  readonly coverageRatio: number;
  readonly coreCoverageRatio?: number;
  readonly supportingCoverageRatio?: number;
}

export interface StoreComparisonEntry {
  readonly store: StoreOption;
  readonly totalOre: Ore;
  readonly coverageRatio: number;
  readonly distanceKm: number;
  readonly missingConcepts: readonly string[];
  readonly chosen: boolean;
}

export interface StoreComparison {
  readonly entries: readonly StoreComparisonEntry[];
  readonly chosenStoreKey: string;
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export interface NutrientVector {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}

export interface NutritionBreakdown {
  /** Unrounded totals for the whole dish. */
  readonly total: NutrientVector;
  /** Unrounded per-portion values (`total / portions`). */
  readonly perPortion: NutrientVector;
  readonly portions: number;
  /** grams with nutrition data / total recipe grams. */
  readonly coverageRatio: number;
  /** `true` when `coverageRatio < 0.7` — hide per-portion macros (AD-9). */
  readonly suppressed: boolean;
}

// ---------------------------------------------------------------------------
// Constraints & adjustments
// ---------------------------------------------------------------------------

export type ConstraintStatus = "pass" | "fail" | "unknown" | "disclaimer";

export interface ConstraintCheck {
  readonly id: string;
  readonly label: string;
  readonly evidence: EvidenceClass;
  readonly status: ConstraintStatus;
  /** Swedish detail string for the UI. */
  readonly detail: string;
}

export interface ConstraintReport {
  readonly checks: readonly ConstraintCheck[];
  readonly outcome: PlanOutcome;
}

export type AdjustmentKind =
  | "pantry_cap"
  | "merge_duplicate"
  | "substitute_cheaper"
  | "remove_optional_garnish";

export interface BasketAdjustment {
  readonly kind: AdjustmentKind;
  readonly concept: string;
  /** Cost delta from this adjustment (negative = saving), integer öre. */
  readonly deltaOre: Ore;
  readonly detail: string;
}

export interface RecipeStep {
  readonly text: string;
  readonly durationSeconds: number;
  readonly ingredientRefs: readonly string[];
}

export interface CandidateRejection {
  readonly storeKey: string;
  readonly concept: string;
  readonly productId: string;
  readonly reason: "concept_mismatch" | "invalid_price" | "invalid_amount" | "unit_incompatible";
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export interface PlanResult {
  readonly outcome: PlanOutcome;
  /** Present unless `infeasible` / `unknown` before a basket exists. */
  readonly basket: Basket | null;
  readonly nutrition: NutritionBreakdown | null;
  readonly comparison: StoreComparison | null;
  readonly constraints: ConstraintReport;
  readonly adjustments: readonly BasketAdjustment[];
  readonly recipe: { readonly title: string; readonly portions: number; readonly steps: readonly RecipeStep[] } | null;
  readonly candidateRejections: readonly CandidateRejection[];
  /** Exact amount over budget after repair, integer öre. `0` unless `over_budget`. */
  readonly overshootOre: Ore;
  /** Machine reason for `infeasible` / `unknown`. */
  readonly reason: string | null;
  readonly provenance: readonly Provenance[];
}
