/**
 * Pantry caps (AD-3 step 11, AD-7 pre-processing).
 *
 * A pantry claim ("har olja", "har salt") removes a line from the shopping
 * basket **only** when the concept is a finite low-quantity staple AND the recipe
 * needs no more than the capped amount. A larger quantity, or a non-staple claim
 * ("har kycklingfilé"), leaves the line untouched — you still have to buy it.
 *
 * The removed amount is still consumed by the dish, so nutrition aggregation
 * keeps using every requirement's `recipeGrams` regardless of pantry state.
 */

import type { BasketAdjustment, BasketLine, PantryClaim } from "../types";
import { ore } from "../money";

export interface PantryCap {
  /** Cap in the canonical unit (grams / ml). */
  readonly capAmount: number;
  readonly staple: boolean;
}

/**
 * Cap table. Keys are matched as substrings of a requirement concept
 * (case-insensitive), so `"olja"` also covers `"olivolja"` / `"rapsolja"`.
 * Ordered most-specific-first is not required — the longest matching key wins.
 */
export const PANTRY_CAP_TABLE: ReadonlyMap<string, PantryCap> = new Map([
  ["salt", { capAmount: 15, staple: true }],
  ["flingsalt", { capAmount: 15, staple: true }],
  ["peppar", { capAmount: 10, staple: true }],
  ["svartpeppar", { capAmount: 10, staple: true }],
  ["vitpeppar", { capAmount: 10, staple: true }],
  ["olja", { capAmount: 30, staple: true }],
  ["olivolja", { capAmount: 30, staple: true }],
  ["rapsolja", { capAmount: 30, staple: true }],
  ["matolja", { capAmount: 30, staple: true }],
  ["vinäger", { capAmount: 30, staple: true }],
  ["soja", { capAmount: 30, staple: true }],
  ["sojasås", { capAmount: 30, staple: true }],
  ["socker", { capAmount: 30, staple: true }],
  ["strösocker", { capAmount: 30, staple: true }],
  ["buljong", { capAmount: 20, staple: true }],
  ["krydda", { capAmount: 8, staple: true }],
  ["paprikapulver", { capAmount: 8, staple: true }],
  ["spiskummin", { capAmount: 8, staple: true }],
  ["oregano", { capAmount: 8, staple: true }],
  ["timjan", { capAmount: 8, staple: true }],
  ["chiliflakes", { capAmount: 8, staple: true }],
  ["curry", { capAmount: 8, staple: true }],
  ["kanel", { capAmount: 8, staple: true }],
  ["gurkmeja", { capAmount: 8, staple: true }],
]);

/** The cap for a concept, or `null` when it is not a recognised pantry staple. */
export function lookupPantryCap(concept: string): PantryCap | null {
  const needle = concept.trim().toLowerCase();
  let best: { key: string; cap: PantryCap } | null = null;
  for (const [key, cap] of PANTRY_CAP_TABLE) {
    if (needle.includes(key) && (best === null || key.length > best.key.length)) {
      best = { key, cap };
    }
  }
  return best?.cap ?? null;
}

function claimMatchesConcept(claim: PantryClaim, concept: string): boolean {
  const c = concept.trim().toLowerCase();
  const k = claim.concept.trim().toLowerCase();
  if (k.length === 0) return false;
  return c === k || c.includes(k) || k.includes(c);
}

export interface PantryResult {
  readonly lines: readonly BasketLine[];
  readonly adjustments: readonly BasketAdjustment[];
}

/**
 * Remove pantry-covered staple lines from `lines`. Deterministic: input order is
 * preserved for kept lines, adjustments follow the removed lines' order.
 */
export function applyPantryCaps(
  lines: readonly BasketLine[],
  pantry: readonly PantryClaim[],
): PantryResult {
  const kept: BasketLine[] = [];
  const adjustments: BasketAdjustment[] = [];

  for (const line of lines) {
    const claim = pantry.find((p) => claimMatchesConcept(p, line.concept));
    const cap = claim ? lookupPantryCap(line.concept) : null;

    const covered =
      claim !== undefined &&
      cap !== null &&
      cap.staple &&
      line.recipeGrams <= cap.capAmount;

    if (covered) {
      adjustments.push({
        kind: "pantry_cap",
        concept: line.concept,
        deltaOre: ore(-line.purchase.priceOre),
        detail: `"${claim.raw}" täcker ${line.recipeGrams} g ${line.concept} (tak ${cap.capAmount} g) — borttagen från inköpslistan`,
      });
    } else {
      kept.push(line);
    }
  }

  return { lines: kept, adjustments };
}
