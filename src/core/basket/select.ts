/**
 * Package selection (AD-3 step 10, AD-4).
 *
 * Two branches, chosen by `isVariableWeight`:
 *   - **fixed pack** — buy the smallest number of whole packs that covers the
 *     recipe need; the basket is charged the full pack price(s). A pack is never
 *     prorated.
 *   - **variable weight** — buy exactly the grams the recipe needs, priced at the
 *     product's per-kg `comparison` price, rounded half-up to whole öre.
 */

import { mulOre } from "../money";
import type { Ore, Product } from "../types";
import { isVariableWeight, packsForNeed, variableWeightPriceOre } from "../units";

export interface PackagingChoice {
  /** Grams the basket actually acquires (pack multiple, or the exact cut). */
  readonly purchasedGrams: number;
  readonly purchasedAmount: number;
  /** Cost of that acquisition, integer öre. */
  readonly priceOre: Ore;
  /** Whole packs bought; `null` for a variable-weight cut. */
  readonly packs: number | null;
  readonly variableWeight: boolean;
  /** Grams bought but not consumed by the recipe (`purchasedGrams - need`). */
  readonly leftoverGrams: number;
}

/** Resolve how `recipeAmount` of `product` is actually purchased and priced. */
export function resolvePurchase(recipeAmount: number, product: Product): PackagingChoice {
  if (!Number.isFinite(recipeAmount) || recipeAmount < 0) {
    throw new RangeError(`resolvePurchase(): bad recipeAmount ${recipeAmount}`);
  }

  if (isVariableWeight(product)) {
    const priceOre = variableWeightPriceOre(recipeAmount, product.comparison);
    return {
      purchasedGrams: recipeAmount,
      purchasedAmount: recipeAmount,
      priceOre,
      packs: null,
      variableWeight: true,
      leftoverGrams: 0,
    };
  }

  const packs = packsForNeed(recipeAmount, product.packageSize);
  const purchasedGrams = packs * product.packageSize;
  return {
    purchasedGrams,
    purchasedAmount: purchasedGrams,
    priceOre: mulOre(product.priceOre, packs),
    packs,
    variableWeight: false,
    leftoverGrams: Math.max(0, purchasedGrams - recipeAmount),
  };
}

/**
 * Deterministic best candidate for one concept: lowest resolved purchase price
 * for the given need, then lowest comparison unit price, then lowest leftover,
 * then lexicographically smallest product id (the stable key).
 */
export function selectCandidate(
  recipeAmount: number,
  candidates: readonly Product[],
): { product: Product; purchase: PackagingChoice } | null {
  let best: { product: Product; purchase: PackagingChoice } | null = null;

  for (const product of candidates) {
    const purchase = resolvePurchase(recipeAmount, product);
    if (best === null) {
      best = { product, purchase };
      continue;
    }
    if (isBetter({ product, purchase }, best)) {
      best = { product, purchase };
    }
  }
  return best;
}

function isBetter(
  a: { product: Product; purchase: PackagingChoice },
  b: { product: Product; purchase: PackagingChoice },
): boolean {
  if (a.purchase.priceOre !== b.purchase.priceOre) {
    return a.purchase.priceOre < b.purchase.priceOre;
  }
  if (a.product.comparison.priceOre !== b.product.comparison.priceOre) {
    return a.product.comparison.priceOre < b.product.comparison.priceOre;
  }
  if (a.purchase.leftoverGrams !== b.purchase.leftoverGrams) {
    return a.purchase.leftoverGrams < b.purchase.leftoverGrams;
  }
  return a.product.id < b.product.id;
}
