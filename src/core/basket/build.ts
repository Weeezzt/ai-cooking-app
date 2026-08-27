/**
 * Per-store basket build (AD-3 steps 7 & 12).
 *
 * Given a set of requirements (concept + recipe amount + role) and the filtered
 * candidate products for one store, deterministically pick one product per
 * concept, resolve its purchase, and total the basket in integer öre. Concepts
 * with no candidate are reported as `missingConcepts`; coverage is measured over
 * `core` + `supporting` requirements only.
 */

import { sumOre, ZERO_ORE } from "../money";
import type { Basket, BasketLine, Product, RequirementRole, StoreOption } from "../types";
import { resolvePurchase, selectCandidate } from "./select";

export interface BasketRequirement {
  readonly concept: string;
  /** Recipe consumption in the canonical unit; drives nutrition, not cost. */
  readonly recipeAmount: number;
  readonly role: RequirementRole;
  /** Optional pin: when set, this exact product is used (repair substitutions). */
  readonly forcedProductId?: string;
}

export interface BuildBasketInput {
  readonly store: StoreOption;
  readonly requirements: readonly BasketRequirement[];
  /** concept → filtered candidate products for this store. */
  readonly candidatesByConcept: ReadonlyMap<string, readonly Product[]>;
  readonly source: string;
  readonly retrievedAtIso: string;
}

function isCounted(role: RequirementRole): boolean {
  return role === "core" || role === "supporting";
}

export function buildBasket(input: BuildBasketInput): Basket {
  const { store, requirements, candidatesByConcept, source, retrievedAtIso } = input;
  const lines: BasketLine[] = [];
  const missingConcepts: string[] = [];
  let counted = 0;
  let covered = 0;

  for (const requirement of requirements) {
    if (isCounted(requirement.role)) counted += 1;

    const candidates = candidatesByConcept.get(requirement.concept) ?? [];
    const pool =
      requirement.forcedProductId === undefined
        ? candidates
        : candidates.filter((c) => c.id === requirement.forcedProductId);

    let picked: { product: Product; purchase: ReturnType<typeof resolvePurchase> } | null;
    if (requirement.forcedProductId !== undefined && pool.length === 1) {
      picked = { product: pool[0], purchase: resolvePurchase(requirement.recipeAmount, pool[0]) };
    } else {
      picked = selectCandidate(requirement.recipeAmount, pool);
    }

    if (picked === null) {
      if (!missingConcepts.includes(requirement.concept)) {
        missingConcepts.push(requirement.concept);
      }
      continue;
    }

    if (isCounted(requirement.role)) covered += 1;

    lines.push({
      concept: requirement.concept,
      product: picked.product,
      role: requirement.role,
      recipeGrams: requirement.recipeAmount,
      purchase: {
        purchasedGrams: picked.purchase.purchasedGrams,
        priceOre: picked.purchase.priceOre,
        packs: picked.purchase.packs,
        variableWeight: picked.purchase.variableWeight,
      },
      provenance: {
        source,
        retrievedAt: retrievedAtIso,
        priceType: "regular",
      },
    });
  }

  const totalOre = lines.length === 0 ? ZERO_ORE : sumOre(lines.map((l) => l.purchase.priceOre));

  return {
    store,
    lines,
    totalOre,
    missingConcepts,
    coverageRatio: counted === 0 ? 1 : covered / counted,
  };
}
