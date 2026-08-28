import { describe, expect, it } from "vitest";

import { buildBasket, type BasketRequirement } from "@/core/basket";
import {
  aggregateOutcome,
  applyPantryCaps,
  evaluateConstraints,
  evidenceClassFor,
  lookupPantryCap,
  repairOverBudget,
} from "@/core/constraints";
import { ore } from "@/core/money";
import type { BasketLine, PantryClaim, Product, StoreOption } from "@/core/types";

function store(): StoreOption {
  return {
    chain: "ica",
    storeId: "1001",
    name: "ICA Test",
    tier: "full",
    distanceKm: 1.0,
    confirmedAt: "2026-08-20T00:00:00.000Z",
  };
}

function product(over: Partial<Product> & Pick<Product, "id" | "concept">): Product {
  return {
    name: over.id,
    brand: null,
    priceOre: ore(1000),
    packageSize: 500,
    packageUnit: "g",
    comparison: { priceOre: ore(2000), unit: "st" },
    categoryPath: ["ÖVRIGT"],
    dietaryTags: [],
    ...over,
  };
}

function line(over: Partial<BasketLine> & Pick<BasketLine, "concept">): BasketLine {
  return {
    product: product({ id: over.concept, concept: over.concept }),
    role: "supporting",
    recipeGrams: 10,
    purchase: { purchasedGrams: 500, priceOre: ore(2495), packs: 1, variableWeight: false },
    provenance: { source: "primat", retrievedAt: "2026-08-27T09:00:00.000Z", priceType: "regular" },
    ...over,
  };
}

describe("taxonomy", () => {
  it("classifies checks by evidence class (AD-5)", () => {
    expect(evidenceClassFor("budget")).toBe("verified");
    expect(evidenceClassFor("cook_time")).toBe("estimated");
    expect(evidenceClassFor("allergy")).toBe("unsupported");
  });
});

describe("pantry caps (AD-3 step 11)", () => {
  it("maps 'olja' to olivolja and caps at 30 g", () => {
    expect(lookupPantryCap("olivolja")).toEqual({ capAmount: 30, staple: true });
    expect(lookupPantryCap("kycklinglårfilé")).toBeNull();
  });

  it("'har olja' removes only a capped oil line", () => {
    const lines = [
      line({ concept: "olivolja", recipeGrams: 20, purchase: { purchasedGrams: 500, priceOre: ore(2900), packs: 1, variableWeight: false } }),
      line({ concept: "pasta", recipeGrams: 500, role: "core" }),
    ];
    const pantry: PantryClaim[] = [{ raw: "har olja", concept: "olja" }];
    const result = applyPantryCaps(lines, pantry);
    expect(result.lines.map((l) => l.concept)).toEqual(["pasta"]);
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0].kind).toBe("pantry_cap");
    expect(result.adjustments[0].deltaOre).toBe(-2900);
  });

  it("a large non-staple pantry claim does not zero the line", () => {
    const lines = [line({ concept: "kycklinglårfilé", recipeGrams: 600, role: "core" })];
    const result = applyPantryCaps(lines, [{ raw: "har kyckling", concept: "kyckling" }]);
    expect(result.lines).toHaveLength(1);
    expect(result.adjustments).toHaveLength(0);
  });

  it("an over-cap staple amount stays in the basket", () => {
    const lines = [line({ concept: "olivolja", recipeGrams: 200 })];
    const result = applyPantryCaps(lines, [{ raw: "har olja", concept: "olja" }]);
    expect(result.lines).toHaveLength(1);
    expect(result.adjustments).toHaveLength(0);
  });
});

describe("over-budget repair (AD-7)", () => {
  const requirements: BasketRequirement[] = [
    { concept: "kyckling", recipeAmount: 500, role: "core" },
    { concept: "ris", recipeAmount: 300, role: "core" },
    { concept: "persilja", recipeAmount: 10, role: "optional_garnish" },
  ];

  const candidates = new Map<string, Product[]>([
    [
      "kyckling",
      [
        product({ id: "kyckling-dyr", concept: "kyckling", packageSize: 500, priceOre: ore(9900) }),
        product({ id: "kyckling-billig", concept: "kyckling", packageSize: 500, priceOre: ore(6900) }),
      ],
    ],
    ["ris", [product({ id: "ris-1", concept: "ris", packageSize: 500, priceOre: ore(2500) })]],
    ["persilja", [product({ id: "persilja-1", concept: "persilja", packageSize: 25, priceOre: ore(1900) })]],
  ]);

  function baseline() {
    return buildBasket({
      store: store(),
      requirements: requirements.map((r) => ({
        ...r,
        forcedProductId:
          r.concept === "kyckling" ? "kyckling-dyr" : r.concept === "ris" ? "ris-1" : "persilja-1",
      })),
      candidatesByConcept: candidates,
      source: "primat",
      retrievedAtIso: "2026-08-27T09:00:00.000Z",
    });
  }

  it("substitutes a cheaper authorized SKU, then removes the garnish, then terminates over_budget with the exact overshoot", () => {
    const basket = baseline(); // 9900 + 2500 + 1900 = 14300
    expect(basket.totalOre).toBe(14300);
    const budgetOre = ore(9000);

    const repair = repairOverBudget({ basket, budgetOre, requirements, candidatesByConcept: candidates });

    // cheaper kyckling (6900) + ris (2500) still = 9400 > 9000, garnish removed → 9400 still > 9000
    expect(repair.withinBudget).toBe(false);
    expect(repair.basket.totalOre).toBe(9400);
    expect(repair.overshootOre).toBe(400); // exact overshoot
    const kinds = repair.adjustments.map((a) => a.kind);
    expect(kinds).toContain("substitute_cheaper");
    expect(kinds).toContain("remove_optional_garnish");
    // audit trail carries the öre deltas
    const sub = repair.adjustments.find((a) => a.kind === "substitute_cheaper");
    expect(sub?.deltaOre).toBe(-3000);
  });

  it("is a no-op when already within budget", () => {
    const basket = baseline();
    const repair = repairOverBudget({
      basket,
      budgetOre: ore(20000),
      requirements,
      candidatesByConcept: candidates,
    });
    expect(repair.withinBudget).toBe(true);
    expect(repair.adjustments).toHaveLength(0);
    expect(repair.overshootOre).toBe(0);
  });

  it("repairs to ok when a substitution is enough", () => {
    const basket = baseline();
    const repair = repairOverBudget({
      basket,
      budgetOre: ore(9500),
      requirements,
      candidatesByConcept: candidates,
    });
    expect(repair.withinBudget).toBe(true);
    expect(repair.basket.totalOre).toBe(9400);
    expect(repair.overshootOre).toBe(0);
  });

  it("is pure — the input basket is not mutated", () => {
    const basket = baseline();
    const snapshot = JSON.stringify(basket);
    repairOverBudget({ basket, budgetOre: ore(1), requirements, candidatesByConcept: candidates });
    expect(JSON.stringify(basket)).toBe(snapshot);
  });

  it("uses the lexicographic waste tiebreak instead of greedy largest saving", () => {
    const req: BasketRequirement[] = [{ concept: "a", recipeAmount: 100, role: "core" }];
    const options = new Map([["a", [product({ id: "original", concept: "a", packageSize: 500, priceOre: ore(1000) }), product({ id: "large-saving-high-waste", concept: "a", packageSize: 1000, priceOre: ore(500) }), product({ id: "smaller-saving-low-waste", concept: "a", packageSize: 100, priceOre: ore(600) })]]]);
    const basket = buildBasket({ store: store(), requirements: [{ ...req[0], forcedProductId: "original" }], candidatesByConcept: options, source: "test", retrievedAtIso: "2026-01-01T00:00:00.000Z" });
    const repaired = repairOverBudget({ basket, budgetOre: ore(700), requirements: req, candidatesByConcept: options });
    expect(repaired.basket.lines[0].product.id).toBe("smaller-saving-low-waste");
  });

  it("strips garnish references and drops a garnish-only step", () => {
    const basket = baseline();
    const repaired = repairOverBudget({ basket, budgetOre: ore(9000), requirements: requirements.map((r) => ({ ...r, requirementId: r.concept })), candidatesByConcept: candidates, steps: [{ text: "Toppa med persilja", durationSeconds: 10, ingredientRefs: ["persilja"] }, { text: "Servera", durationSeconds: 0, ingredientRefs: [] }] });
    expect(repaired.steps).toEqual([{ text: "Servera", durationSeconds: 0, ingredientRefs: [] }]);
    expect(repaired.adjustments.some((a) => a.kind === "remove_optional_garnish")).toBe(true);
  });

  it("merges duplicate concept requirements with an audit entry", () => {
    const duplicate = [requirements[0], { ...requirements[0], recipeAmount: 100 }];
    const repaired = repairOverBudget({ basket: baseline(), budgetOre: ore(1), requirements: duplicate, candidatesByConcept: candidates });
    expect(repaired.adjustments.some((a) => a.kind === "merge_duplicate" && a.concept === "kyckling")).toBe(true);
    expect(repaired.basket.lines.find((l) => l.concept === "kyckling")?.recipeAmount).toBe(600);
  });
});

describe("evaluate + aggregate outcome (AD-5)", () => {
  it("passes budget/portions/distance and adds a dietary disclaimer", () => {
    const report = evaluateConstraints({
      budgetOre: ore(15000),
      basketTotalOre: ore(12000),
      requestedPortions: 4,
      recipePortions: 4,
      maxDistanceKm: 5,
      storeDistanceKm: 1.2,
      dietary: [{ id: "nut_allergy", label: "Nötallergi", safetyCritical: true }],
      nutrition: null,
      estimatedCookMinutes: 35,
      coverageImpossible: false,
      providerFailure: false,
    });
    expect(report.outcome).toBe("ok");
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    expect(byId.budget.status).toBe("pass");
    expect(byId["dietary:nut_allergy"].status).toBe("disclaimer");
    expect(byId["dietary:nut_allergy"].evidence).toBe("unsupported");
    expect(byId.cook_time.evidence).toBe("estimated");
  });

  it("aggregates outcomes per AD-5", () => {
    expect(aggregateOutcome({ withinBudget: true, verifiedChecksPass: true, coverageImpossible: false, providerFailure: false })).toBe("ok");
    expect(aggregateOutcome({ withinBudget: true, verifiedChecksPass: false, coverageImpossible: false, providerFailure: false })).toBe("unknown");
    expect(aggregateOutcome({ withinBudget: false, coverageImpossible: false, providerFailure: false })).toBe("over_budget");
    expect(aggregateOutcome({ withinBudget: true, coverageImpossible: true, providerFailure: false })).toBe("infeasible");
    expect(aggregateOutcome({ withinBudget: true, coverageImpossible: false, providerFailure: true })).toBe("unknown");
  });
});
