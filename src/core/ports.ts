/**
 * Port interfaces the engine depends on (AD-2 "ports", AD-9).
 *
 * These are **app-owned inward-facing interfaces**: the engine defines the shape
 * it needs, and adapters (issues #4–#6) implement them. They live here, inside
 * `src/core`, because `tests/architecture.test.ts` allows the core to import only
 * from within `src/core` — a type-only import of `@/ports` would trip that guard.
 * `src/ports/*` re-exports each interface so the rest of the app has the
 * AD-2 file layout without the core reaching outward.
 *
 * TS signatures only. No implementations anywhere in this file.
 */

import type { Clock } from "./clock";
import type {
  NutrientVector,
  Ore,
  Product,
  RequirementRole,
  StoreOption,
} from "./types";

/** Every port call carries the shared deadline (AD-3, engineering-rules). */
export interface PortCallOptions {
  readonly deadlineAt: number;
  readonly clock: Clock;
}

// ---------------------------------------------------------------------------
// StoreDiscovery (issue #4)
// ---------------------------------------------------------------------------

export interface ResolvedLocation {
  /** Rounded to ~1 km before it reaches a provider (AD-10). */
  readonly lat: number;
  readonly lon: number;
  readonly label: string;
  /** `true` when this is the visibly-labelled demo default (AD-11). */
  readonly isDemoDefault: boolean;
}

export interface StoreDiscoveryResult {
  readonly location: ResolvedLocation;
  /** Ranked nearest-first; the engine re-applies its own shortlist rules. */
  readonly stores: readonly StoreOption[];
}

export interface StoreDiscovery {
  resolve(place: string | null, options: PortCallOptions): Promise<StoreDiscoveryResult>;
}

// ---------------------------------------------------------------------------
// ProductSearch (issue #4)
// ---------------------------------------------------------------------------

export interface ProductSearchQuery {
  readonly concept: string;
  readonly store: StoreOption;
  /** Hard cap per concept per store (AD-3 step 5). */
  readonly limit: number;
}

export interface ProductSearch {
  search(query: ProductSearchQuery, options: PortCallOptions): Promise<readonly Product[]>;
}

// ---------------------------------------------------------------------------
// PriceSource (issue #4) — price refinement / re-check for already-known SKUs
// ---------------------------------------------------------------------------

export interface PriceQuote {
  readonly productId: string;
  readonly storeKey: string;
  readonly priceOre: Ore;
  readonly priceType: "regular" | "member" | "offer" | "multiprice";
  readonly retrievedAtIso: string;
}

export interface PriceSource {
  quote(
    productIds: readonly string[],
    store: StoreOption,
    options: PortCallOptions,
  ): Promise<readonly PriceQuote[]>;
}

// ---------------------------------------------------------------------------
// NutritionSource (issue #5)
// ---------------------------------------------------------------------------

export interface NutritionFact {
  readonly concept: string;
  /** Macros per 100 g of the edible ingredient. */
  readonly per100g: NutrientVector;
  readonly source: string;
  readonly retrievedAtIso: string;
}

export interface NutritionLookup {
  readonly concept: string;
  readonly gtin?: string;
}

export interface NutritionSource {
  /**
   * Returns a fact per resolvable concept. Concepts with no data are simply
   * absent from the result — the engine turns that into a coverage ratio.
   */
  lookup(
    concepts: readonly NutritionLookup[],
    options: PortCallOptions,
  ): Promise<readonly NutritionFact[]>;
}

// ---------------------------------------------------------------------------
// RecipeGenerator (issue #6)
// ---------------------------------------------------------------------------

/** Sanitized per-option projection — the ONLY product data the model sees (AD-6). */
export interface RecipeOptionHandle {
  readonly optionId: string;
  readonly concept: string;
  /** Generic ingredient label, e.g. `"kokosmjölk"`. Never a brand. */
  readonly label: string;
  readonly form: string;
  readonly coarseCategory: string;
  readonly dietaryTags: readonly string[];
}

export interface RecipeGenerationInput {
  readonly portions: number;
  readonly vibe: string;
  readonly dietary: readonly string[];
  readonly options: readonly RecipeOptionHandle[];
}

export interface RecipeRequirementDraft {
  readonly optionId: string;
  readonly requiredGrams: number;
  readonly role: RequirementRole;
}

export interface RecipeStepDraft {
  readonly text: string;
  readonly durationSeconds: number;
  readonly optionRefs: readonly string[];
}

export interface RecipeDraft {
  readonly title: string;
  readonly portions: number;
  readonly requirements: readonly RecipeRequirementDraft[];
  readonly steps: readonly RecipeStepDraft[];
  /** Treated as an `estimated` fact (AD-5). */
  readonly estimatedCookMinutes: number;
  /** Swedish user-facing "why this fits". */
  readonly explanation: string;
}

export interface RecipeGenerator {
  generate(input: RecipeGenerationInput, options: PortCallOptions): Promise<RecipeDraft>;
}

// ---------------------------------------------------------------------------
// Aggregate dependency bag for the pipeline (AD-3)
// ---------------------------------------------------------------------------

export interface PipelineDeps {
  readonly stores: StoreDiscovery;
  readonly products: ProductSearch;
  readonly prices: PriceSource;
  readonly nutrition: NutritionSource;
  readonly recipes: RecipeGenerator;
}
