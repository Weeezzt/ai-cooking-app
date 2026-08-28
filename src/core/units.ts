/**
 * Unit normalization + packaging math (AD-3 step 4, AD-4).
 *
 * Canonical units: `g` (mass), `ml` (volume), `st` (count). Everything is
 * converted to one of these once, on the way in. Variable-weight products are
 * priced per gram from their `comparison` price, rounded half-up to whole öre —
 * the same rounding rule as `money.ts`.
 */

import { ore, roundHalfUp } from "./money";
import type { CanonicalUnit, ComparisonUnitPrice, Ore, Product } from "./types";

const MASS_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  kg: 1000,
  hg: 100,
  mg: 0.001,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  liter: 1000,
};

const COUNT_UNITS = new Set(["st", "stk", "pcs", "x"]);

export interface NormalizedAmount {
  readonly value: number;
  readonly unit: CanonicalUnit;
}

/** Normalize a `{ value, unit }` pair to canonical `g` / `ml` / `st`. */
export function normalizeAmount(value: number, unit: string): NormalizedAmount {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`normalizeAmount(): bad value ${value}`);
  }
  const key = unit.trim().toLowerCase();

  if (key in MASS_TO_GRAMS) {
    return { value: value * MASS_TO_GRAMS[key], unit: "g" };
  }
  if (key in VOLUME_TO_ML) {
    return { value: value * VOLUME_TO_ML[key], unit: "ml" };
  }
  if (COUNT_UNITS.has(key)) {
    return { value, unit: "st" };
  }
  throw new RangeError(`normalizeAmount(): unknown unit ${JSON.stringify(unit)}`);
}

/**
 * Variable-weight detection (AD-4). A product is bought by exact grams when any
 * of these hold:
 *   - its comparison unit is `kg` (loose fruit/veg/meat priced per kilo), or
 *   - its SKU id ends `_KG` (the Primat convention for a weighed line), or
 *   - its name is prefixed `ca ` / contains ` ca ` ("cirka" — approximate pack).
 */
export function isVariableWeight(product: Pick<Product, "comparison">): boolean {
  return (
    (product.comparison.unit === "kg" || product.comparison.unit === "l") &&
    Number.isSafeInteger(product.comparison.priceOre) &&
    product.comparison.priceOre > 0
  );
}

/** Price, in öre, of `grams` of a variable-weight product (half-up to öre). */
export function variableWeightPriceOre(grams: number, comparison: ComparisonUnitPrice): Ore {
  if (comparison.unit !== "kg" && comparison.unit !== "l") {
    throw new RangeError(
      `variableWeightPriceOre(): comparison unit must be "kg" or "l", got ${comparison.unit}`,
    );
  }
  if (!Number.isFinite(grams) || grams < 0) {
    throw new RangeError(`variableWeightPriceOre(): bad grams ${grams}`);
  }
  // comparison.priceOre is öre per kg → per gram is / 1000.
  return ore(roundHalfUp((grams * comparison.priceOre) / 1000));
}

/**
 * Smallest number of fixed packs of `packSize` that covers `need`
 * (`⌈need / packSize⌉`, never zero for a positive need).
 */
export function packsForNeed(need: number, packSize: number): number {
  if (!Number.isFinite(need) || need < 0) {
    throw new RangeError(`packsForNeed(): bad need ${need}`);
  }
  if (!Number.isFinite(packSize) || packSize <= 0) {
    throw new RangeError(`packsForNeed(): bad packSize ${packSize}`);
  }
  if (need === 0) return 0;
  return Math.ceil(need / packSize - 1e-9);
}
