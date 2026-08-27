/** Minimal nutrition domain types for Issue #5; reconcile with Issue #3's shared types. */
export interface NutritionMacros {
  readonly kcal: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
}

export interface NutritionRequirement {
  readonly canonicalName: string;
  readonly recipeGrams: number;
  readonly gtin?: string;
}

export interface CoveredNutritionRequirement extends NutritionRequirement {
  readonly status: "covered";
  readonly macros: NutritionMacros;
  readonly matchedBy: "gtin" | "canonical_name";
}

export interface UnknownNutritionRequirement extends NutritionRequirement {
  readonly status: "unknown";
}

export type ResolvedNutritionRequirement =
  | CoveredNutritionRequirement
  | UnknownNutritionRequirement;

export interface NutritionBreakdown {
  readonly total: NutritionMacros;
  readonly coverageRatio: number;
  readonly coveredMassGrams: number;
  readonly totalMassGrams: number;
  readonly requirements: readonly ResolvedNutritionRequirement[];
}
