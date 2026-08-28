/**
 * Consumed-gram nutrition aggregation (AD-3 step 12, AD-5, AD-9).
 *
 * Rules:
 *   - aggregate from `recipeGrams` (never from the purchased amount);
 *   - keep full floating precision internally — totals and per-portion values in
 *     `NutritionBreakdown` are UNROUNDED. Round only at display (`roundVector`),
 *     and reconcile `perPortion × portions ≈ total` from the unrounded numbers;
 *   - coverage ratio = grams with nutrition data / total recipe grams;
 *   - `suppressed` when coverage `< 0.7` (hide per-portion macros with a footnote).
 */

import type { NutrientVector, NutritionBreakdown } from "../types";

export const COVERAGE_SUPPRESSION_THRESHOLD = 0.7;

export interface NutritionInputLine {
  readonly concept: string;
  readonly recipeGrams: number;
  /** Macros per 100 g, or `null` when the concept has no nutrition data. */
  readonly per100g: NutrientVector | null;
}

const EMPTY: NutrientVector = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

function add(a: NutrientVector, b: NutrientVector): NutrientVector {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

function scale(v: NutrientVector, factor: number): NutrientVector {
  return {
    kcal: v.kcal * factor,
    proteinG: v.proteinG * factor,
    carbsG: v.carbsG * factor,
    fatG: v.fatG * factor,
  };
}

/** Round a vector for display only. Never feed the result back into a total. */
export function roundVector(v: NutrientVector): NutrientVector {
  return {
    kcal: Math.round(v.kcal),
    proteinG: Math.round(v.proteinG * 10) / 10,
    carbsG: Math.round(v.carbsG * 10) / 10,
    fatG: Math.round(v.fatG * 10) / 10,
  };
}

export function aggregateNutrition(
  lines: readonly NutritionInputLine[],
  portions: number,
): NutritionBreakdown {
  if (!Number.isInteger(portions) || portions <= 0) {
    throw new RangeError(`aggregateNutrition(): portions must be a positive integer, got ${portions}`);
  }

  let total: NutrientVector = EMPTY;
  let totalGrams = 0;
  let coveredGrams = 0;

  for (const line of lines) {
    if (!Number.isFinite(line.recipeGrams) || line.recipeGrams < 0) {
      throw new RangeError(`aggregateNutrition(): bad recipeGrams for ${line.concept}`);
    }
    totalGrams += line.recipeGrams;
    if (line.per100g !== null) {
      coveredGrams += line.recipeGrams;
      total = add(total, scale(line.per100g, line.recipeGrams / 100));
    }
  }

  const coverageRatio = totalGrams === 0 ? 0 : coveredGrams / totalGrams;

  return {
    total,
    perPortion: scale(total, 1 / portions),
    portions,
    coverageRatio,
    suppressed: coverageRatio < COVERAGE_SUPPRESSION_THRESHOLD,
  };
}
