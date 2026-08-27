import type {
  NutritionBreakdown,
  NutritionRequirement,
} from "@/core/types";

export interface NutritionAttribution {
  readonly source: "Open Food Facts" | "Livsmedelsverket";
  readonly text: string;
}

/** Deterministic, offline nutrition lookup boundary. */
export interface NutritionSource {
  resolveRecipe(
    requirements: readonly NutritionRequirement[],
  ): Promise<NutritionBreakdown>;

  getAttributions(): readonly NutritionAttribution[];
}
