/**
 * Multi-store comparison + the deterministic store-selection objective
 * (AD-3 step 7, AD-4).
 *
 * Lexicographic objective, best-first:
 *   1. core+supporting concept coverage  (higher wins)
 *   2. complete basket cost               (lower wins) — only compared directly
 *      when coverage is equal; a lower total on worse coverage never wins
 *   3. distance                           (lower wins)
 *   4. stable key `"<chain>:<storeId>"`   (lexicographically smaller wins)
 */

import type {
  Basket,
  Product,
  StoreComparison,
  StoreComparisonEntry,
  StoreOption,
} from "../types";
import { storeKey } from "../types";
import { buildBasket, type BasketRequirement } from "./build";

export interface StoreCandidates {
  readonly store: StoreOption;
  readonly candidatesByConcept: ReadonlyMap<string, readonly Product[]>;
}

export interface CompareStoresInput {
  readonly requirements: readonly BasketRequirement[];
  readonly stores: readonly StoreCandidates[];
  readonly source: string;
  readonly retrievedAtIso: string;
}

export interface CompareStoresResult {
  readonly chosen: Basket;
  readonly comparison: StoreComparison;
  /** Every store's basket, best-first by the objective. */
  readonly baskets: readonly Basket[];
}

function compareBaskets(a: Basket, b: Basket): number {
  if (a.coreCoverageRatio !== b.coreCoverageRatio) return (b.coreCoverageRatio ?? 0) - (a.coreCoverageRatio ?? 0);
  if (a.supportingCoverageRatio !== b.supportingCoverageRatio) return (b.supportingCoverageRatio ?? 0) - (a.supportingCoverageRatio ?? 0);
  if (a.coverageRatio !== b.coverageRatio) return b.coverageRatio - a.coverageRatio;
  if (a.totalOre !== b.totalOre) return a.totalOre - b.totalOre;
  if (a.store.distanceKm !== b.store.distanceKm) return a.store.distanceKm - b.store.distanceKm;
  return storeKey(a.store) < storeKey(b.store) ? -1 : storeKey(a.store) > storeKey(b.store) ? 1 : 0;
}

export function compareStores(input: CompareStoresInput): CompareStoresResult {
  if (input.stores.length === 0) {
    throw new RangeError("compareStores(): no stores to compare");
  }

  const baskets = input.stores
    .map((sc) =>
      buildBasket({
        store: sc.store,
        requirements: input.requirements,
        candidatesByConcept: sc.candidatesByConcept,
        source: input.source,
        retrievedAtIso: input.retrievedAtIso,
      }),
    )
    .sort(compareBaskets);

  const chosen = baskets[0];
  const chosenKey = storeKey(chosen.store);

  const entries: StoreComparisonEntry[] = baskets.map((basket) => ({
    store: basket.store,
    totalOre: basket.totalOre,
    coverageRatio: basket.coverageRatio,
    distanceKm: basket.store.distanceKm,
    missingConcepts: basket.missingConcepts,
    chosen: storeKey(basket.store) === chosenKey,
  }));

  return {
    chosen,
    baskets,
    comparison: { entries, chosenStoreKey: chosenKey },
  };
}
