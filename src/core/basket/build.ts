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
  readonly unit?: import("../types").CanonicalUnit;
  readonly requirementId?: string;
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
  let coreTotal = 0, coreCovered = 0, supportingTotal = 0, supportingCovered = 0;

  for (const requirement of requirements) {
    if (isCounted(requirement.role)) counted += 1;
    if (requirement.role === "core") coreTotal += 1;
    if (requirement.role === "supporting") supportingTotal += 1;

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
    if (requirement.role === "core") coreCovered += 1;
    if (requirement.role === "supporting") supportingCovered += 1;

    lines.push({
      concept: requirement.concept,
      product: picked.product,
      role: requirement.role,
      recipeGrams: requirement.recipeAmount,
      recipeAmount: requirement.recipeAmount,
      unit: requirement.unit ?? picked.product.packageUnit,
      purchase: {
        purchasedGrams: picked.purchase.purchasedGrams,
        purchasedAmount: picked.purchase.purchasedAmount,
        unit: requirement.unit ?? picked.product.packageUnit,
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
    coreCoverageRatio: coreTotal === 0 ? 1 : coreCovered / coreTotal,
    supportingCoverageRatio: supportingTotal === 0 ? 1 : supportingCovered / supportingTotal,
  };
}
