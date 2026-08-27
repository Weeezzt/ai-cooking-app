/**
 * Deterministic over-budget repair (AD-7).
 *
 * Pure and terminating. No AI, no network. Given the post-pantry basket and the
 * filtered candidates for the chosen store:
 *
 *   1. Enumerate authorized alternatives — other filtered candidates for the same
 *      canonical concept (a cheaper SKU / a different sufficient pack size).
 *   2. Apply substitutions by a fixed lexicographic objective: largest öre saving
 *      first, then concept asc, then product id asc. Stop as soon as the basket
 *      is within budget (this minimises the substitution count); if it never is,
 *      every beneficial substitution ends up applied (this minimises overshoot).
 *   3. If still over budget, remove `optional_garnish` lines in concept order,
 *      stopping as soon as within budget.
 *   4. Terminal: within budget → `ok`; otherwise `over_budget` with the exact
 *      remaining overshoot and the cheapest basket found under the objective.
 *
 * Termination: each substitution strictly lowers the total and touches a line at
 * most once; garnish removals are bounded by the line count.
 */

import { buildBasket, type BasketRequirement } from "../basket/build";
import { selectCandidate } from "../basket/select";
import { ore, subOre, sumOre, ZERO_ORE } from "../money";
import type { Basket, BasketAdjustment, Ore, Product } from "../types";

export interface RepairInput {
  readonly basket: Basket;
  readonly budgetOre: Ore;
  readonly requirements: readonly BasketRequirement[];
  readonly candidatesByConcept: ReadonlyMap<string, readonly Product[]>;
}

export interface RepairResult {
  readonly basket: Basket;
  readonly adjustments: readonly BasketAdjustment[];
  /** `true` once the repaired basket fits the budget. */
  readonly withinBudget: boolean;
  /** Exact overshoot after repair, `0` when within budget. */
  readonly overshootOre: Ore;
}

function overshoot(totalOre: Ore, budgetOre: Ore): Ore {
  return ore(Math.max(0, totalOre - budgetOre));
}

function requirementFor(
  concept: string,
  requirements: readonly BasketRequirement[],
): BasketRequirement | undefined {
  return requirements.find((r) => r.concept === concept);
}

export function repairOverBudget(input: RepairInput): RepairResult {
  const { budgetOre, requirements, candidatesByConcept } = input;

  // Working copy: concept -> chosen product id (or removed).
  const chosen = new Map<string, string>();
  for (const line of input.basket.lines) chosen.set(line.concept, line.product.id);
  const removed = new Set<string>();

  const adjustments: BasketAdjustment[] = [];

  const rebuild = (): Basket =>
    buildBasket({
      store: input.basket.store,
      requirements: requirements
        .filter((r) => chosen.has(r.concept) && !removed.has(r.concept))
        .map((r) => ({ ...r, forcedProductId: chosen.get(r.concept) })),
      candidatesByConcept,
      source: input.basket.lines[0]?.provenance.source ?? "repair",
      retrievedAtIso: input.basket.lines[0]?.provenance.retrievedAt ?? "1970-01-01T00:00:00.000Z",
    });

  let current = input.basket;
  if (overshoot(current.totalOre, budgetOre) === 0) {
    return { basket: current, adjustments: [], withinBudget: true, overshootOre: ZERO_ORE };
  }

  // --- Step 1 & 2: substitutions -----------------------------------------
  interface Sub {
    readonly concept: string;
    readonly productId: string;
    readonly savingOre: number;
    readonly detail: string;
  }

  const subs: Sub[] = [];
  for (const line of input.basket.lines) {
    const req = requirementFor(line.concept, requirements);
    if (req === undefined) continue;
    const alternatives = (candidatesByConcept.get(line.concept) ?? []).filter(
      (c) => c.id !== line.product.id,
    );
    const best = selectCandidate(req.recipeAmount, alternatives);
    if (best === null) continue;
    const saving = line.purchase.priceOre - best.purchase.priceOre;
    if (saving <= 0) continue;
    subs.push({
      concept: line.concept,
      productId: best.product.id,
      savingOre: saving,
      detail: `Byte: ${line.product.name} → ${best.product.name} (−${saving} öre)`,
    });
  }

  subs.sort(
    (a, b) =>
      b.savingOre - a.savingOre ||
      (a.concept < b.concept ? -1 : a.concept > b.concept ? 1 : 0) ||
      (a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0),
  );

  for (const sub of subs) {
    chosen.set(sub.concept, sub.productId);
    adjustments.push({
      kind: "substitute_cheaper",
      concept: sub.concept,
      deltaOre: ore(-sub.savingOre),
      detail: sub.detail,
    });
    current = rebuild();
    if (overshoot(current.totalOre, budgetOre) === 0) break;
  }

  // --- Step 3: optional_garnish removal ---------------------------------
  if (overshoot(current.totalOre, budgetOre) > 0) {
    const garnish = [...input.basket.lines]
      .filter((l) => requirementFor(l.concept, requirements)?.role === "optional_garnish")
      .map((l) => l.concept)
      .sort();

    for (const concept of garnish) {
      const line = current.lines.find((l) => l.concept === concept);
      const price = line?.purchase.priceOre ?? ZERO_ORE;
      removed.add(concept);
      adjustments.push({
        kind: "remove_optional_garnish",
        concept,
        deltaOre: ore(-price),
        detail: `Garnering borttagen för att nå budget: ${concept}`,
      });
      current = rebuild();
      if (overshoot(current.totalOre, budgetOre) === 0) break;
    }
  }

  const finalOvershoot = overshoot(current.totalOre, budgetOre);

  // Sanity: recomputed total must equal the sum of its line prices.
  const recomputed =
    current.lines.length === 0 ? ZERO_ORE : sumOre(current.lines.map((l) => l.purchase.priceOre));
  if (recomputed !== current.totalOre) {
    throw new Error("repairOverBudget(): basket total desynced from its lines");
  }

  return {
    basket: current,
    adjustments,
    withinBudget: finalOvershoot === 0,
    overshootOre: finalOvershoot === 0 ? ZERO_ORE : subOre(current.totalOre, budgetOre),
  };
}
