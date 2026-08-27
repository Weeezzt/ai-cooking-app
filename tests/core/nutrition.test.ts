import { describe, expect, it } from "vitest";

import {
  aggregateNutrition,
  COVERAGE_SUPPRESSION_THRESHOLD,
  roundVector,
  type NutritionInputLine,
} from "@/core/nutrition";
import type { NutrientVector } from "@/core/types";

const chicken: NutrientVector = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6 };
const rice: NutrientVector = { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3 };

describe("aggregateNutrition", () => {
  it("aggregates from recipeGrams, not purchased grams", () => {
    const lines: NutritionInputLine[] = [
      { concept: "kyckling", recipeGrams: 300, per100g: chicken },
      { concept: "ris", recipeGrams: 200, per100g: rice },
    ];
    const n = aggregateNutrition(lines, 2);
    // total kcal = 3*165 + 2*130 = 755
    expect(n.total.kcal).toBeCloseTo(755, 6);
    expect(n.coverageRatio).toBe(1);
    expect(n.suppressed).toBe(false);
  });

  it("per-portion × portions reconciles to total from UNROUNDED values", () => {
    const lines: NutritionInputLine[] = [
      { concept: "kyckling", recipeGrams: 333, per100g: chicken },
      { concept: "ris", recipeGrams: 217, per100g: rice },
    ];
    const n = aggregateNutrition(lines, 3);
    for (const key of ["kcal", "proteinG", "carbsG", "fatG"] as const) {
      expect(n.perPortion[key] * n.portions).toBeCloseTo(n.total[key], 9);
    }
    // rounding the per-portion display would NOT reconcile — prove the values are unrounded
    const rounded = roundVector(n.perPortion);
    expect(rounded.kcal * n.portions).not.toBe(n.total.kcal);
  });

  it("computes a coverage ratio and suppresses below 0.7", () => {
    const lines: NutritionInputLine[] = [
      { concept: "kyckling", recipeGrams: 300, per100g: chicken },
      { concept: "specialsås", recipeGrams: 200, per100g: null },
    ];
    const n = aggregateNutrition(lines, 2);
    expect(n.coverageRatio).toBeCloseTo(0.6, 6);
    expect(n.coverageRatio).toBeLessThan(COVERAGE_SUPPRESSION_THRESHOLD);
    expect(n.suppressed).toBe(true);
  });

  it("does not suppress exactly at the 0.7 threshold", () => {
    const lines: NutritionInputLine[] = [
      { concept: "a", recipeGrams: 70, per100g: chicken },
      { concept: "b", recipeGrams: 30, per100g: null },
    ];
    expect(aggregateNutrition(lines, 1).suppressed).toBe(false);
  });

  it("rejects a non-positive portion count", () => {
    expect(() => aggregateNutrition([], 0)).toThrow();
  });
});
