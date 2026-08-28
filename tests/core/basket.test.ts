import { describe, expect, it } from "vitest";

import {
  buildBasket,
  compareStores,
  resolvePurchase,
  selectCandidate,
  type BasketRequirement,
} from "@/core/basket";
import { ore } from "@/core/money";
import type { Product, StoreOption } from "@/core/types";

function product(over: Partial<Product> & Pick<Product, "id">): Product {
  return {
    name: over.id,
    concept: "tomat",
    brand: null,
    priceOre: ore(1000),
    packageSize: 500,
    packageUnit: "g",
    comparison: { priceOre: ore(2000), unit: "st" },
    categoryPath: ["FRUKT & GRÖNT"],
    dietaryTags: [],
    ...over,
  };
}

function store(over: Partial<StoreOption> = {}): StoreOption {
  return {
    chain: "ica",
    storeId: "1001",
    name: "ICA Test",
    tier: "full",
    distanceKm: 1.2,
    confirmedAt: "2026-08-20T00:00:00.000Z",
    ...over,
  };
}

describe("resolvePurchase — fixed pack (AD-4: never prorate a pack)", () => {
  it("charges the full 700 g pack price for a 500 g need", () => {
    const p = product({ id: "pasta700", packageSize: 700, priceOre: ore(1895), concept: "pasta" });
    const choice = resolvePurchase(500, p);
    expect(choice).toEqual({
      purchasedGrams: 700,
      purchasedAmount: 700,
      priceOre: 1895,
      packs: 1,
      variableWeight: false,
      leftoverGrams: 200,
    });
  });
  it("buys multiple packs when one is not enough", () => {
    const p = product({ id: "ris500", packageSize: 500, priceOre: ore(1500) });
    const choice = resolvePurchase(1200, p);
    expect(choice.packs).toBe(3);
    expect(choice.purchasedGrams).toBe(1500);
    expect(choice.priceOre).toBe(4500);
  });
});

describe("resolvePurchase — variable weight (AD-4)", () => {
  it("buys exact grams at comparison price / 1000, half-up", () => {
    const p = product({
      id: "notfars_KG",
      concept: "nötfärs",
      comparison: { priceOre: ore(9900), unit: "kg" },
    });
    const choice = resolvePurchase(500, p);
    expect(choice.variableWeight).toBe(true);
    expect(choice.packs).toBeNull();
    expect(choice.purchasedGrams).toBe(500);
    expect(choice.priceOre).toBe(4950); // 500 g * 99,00 kr/kg
  });
  it("buys an _KG product as a whole pack without a usable kg comparison", () => {
    const choice = resolvePurchase(500, product({ id: "hint_KG", packageSize: 700, comparison: { priceOre: ore(1000), unit: "st" } }));
    expect(choice.variableWeight).toBe(false);
    expect(choice.purchasedGrams).toBe(700);
  });
  it("uses exact grams for a ca-name product with kg comparison", () => {
    const choice = resolvePurchase(250, product({ id: "meat", name: "Kött ca 800 g", comparison: { priceOre: ore(8000), unit: "kg" } }));
    expect(choice.variableWeight).toBe(true);
    expect(choice.purchasedGrams).toBe(250);
  });
  it("keeps a plain fixed pack whole", () => {
    expect(resolvePurchase(100, product({ id: "plain", packageSize: 400 })).purchasedGrams).toBe(400);
  });
});

describe("selectCandidate", () => {
  it("picks the lowest resolved purchase price, then the stable id", () => {
    const cheap = product({ id: "a", packageSize: 500, priceOre: ore(1200) });
    const dear = product({ id: "b", packageSize: 500, priceOre: ore(1800) });
    const tieHigherId = product({ id: "c", packageSize: 500, priceOre: ore(1200) });
    const picked = selectCandidate(400, [dear, tieHigherId, cheap]);
    expect(picked?.product.id).toBe("a");
  });
  it("returns null for an empty candidate list", () => {
    expect(selectCandidate(100, [])).toBeNull();
  });
});

describe("buildBasket", () => {
  const requirements: BasketRequirement[] = [
    { concept: "pasta", recipeAmount: 500, role: "core" },
    { concept: "tomat", recipeAmount: 400, role: "core" },
    { concept: "basilika", recipeAmount: 10, role: "optional_garnish" },
  ];

  it("totals in integer öre and reports coverage + missing concepts", () => {
    const candidates = new Map<string, Product[]>([
      ["pasta", [product({ id: "pasta700", concept: "pasta", packageSize: 700, priceOre: ore(1895) })]],
      ["tomat", [product({ id: "tomat400", concept: "tomat", packageSize: 400, priceOre: ore(1290) })]],
      // basilika missing entirely
    ]);
    const basket = buildBasket({
      store: store(),
      requirements,
      candidatesByConcept: candidates,
      source: "primat",
      retrievedAtIso: "2026-08-27T09:00:00.000Z",
    });
    expect(basket.totalOre).toBe(1895 + 1290);
    expect(basket.lines).toHaveLength(2);
    expect(basket.missingConcepts).toEqual(["basilika"]);
    // coverage measured over core+supporting only → both core covered
    expect(basket.coverageRatio).toBe(1);
    expect(basket.lines[0].recipeGrams).toBe(500);
    expect(basket.lines[0].purchase.purchasedGrams).toBe(700);
  });

  it("honours a forced product id (repair substitution pin)", () => {
    const candidates = new Map<string, Product[]>([
      [
        "pasta",
        [
          product({ id: "cheap", concept: "pasta", packageSize: 500, priceOre: ore(900) }),
          product({ id: "pinned", concept: "pasta", packageSize: 500, priceOre: ore(1400) }),
        ],
      ],
    ]);
    const basket = buildBasket({
      store: store(),
      requirements: [{ concept: "pasta", recipeAmount: 500, role: "core", forcedProductId: "pinned" }],
      candidatesByConcept: candidates,
      source: "primat",
      retrievedAtIso: "2026-08-27T09:00:00.000Z",
    });
    expect(basket.lines[0].product.id).toBe("pinned");
  });
});

describe("compareStores — deterministic objective", () => {
  const requirements: BasketRequirement[] = [
    { concept: "pasta", recipeAmount: 500, role: "core" },
    { concept: "tomat", recipeAmount: 400, role: "core" },
  ];
  const pasta = (over: Partial<Product>) =>
    product({ id: "pasta", concept: "pasta", packageSize: 500, ...over });
  const tomat = (over: Partial<Product>) =>
    product({ id: "tomat", concept: "tomat", packageSize: 400, ...over });

  it("prefers coverage over a cheaper incomplete basket", () => {
    const full = {
      store: store({ chain: "ica", storeId: "full", distanceKm: 5 }),
      candidatesByConcept: new Map<string, Product[]>([
        ["pasta", [pasta({ priceOre: ore(2000) })]],
        ["tomat", [tomat({ priceOre: ore(2000) })]],
      ]),
    };
    const cheapButPartial = {
      store: store({ chain: "coop", storeId: "partial", distanceKm: 1 }),
      candidatesByConcept: new Map<string, Product[]>([["pasta", [pasta({ priceOre: ore(500) })]]]),
    };
    const result = compareStores({
      requirements,
      stores: [cheapButPartial, full],
      source: "primat",
      retrievedAtIso: "2026-08-27T09:00:00.000Z",
    });
    expect(result.comparison.chosenStoreKey).toBe("ica:full");
  });

  it("weights core coverage strictly above supporting coverage", () => {
    const weighted: BasketRequirement[] = [{ concept: "pasta", recipeAmount: 100, role: "core" }, { concept: "tomat", recipeAmount: 100, role: "supporting" }];
    const coreStore = { store: store({ storeId: "core" }), candidatesByConcept: new Map([["pasta", [pasta({})]]]) };
    const supportingStore = { store: store({ storeId: "support" }), candidatesByConcept: new Map([["tomat", [tomat({})]]]) };
    expect(compareStores({ requirements: weighted, stores: [supportingStore, coreStore], source: "test", retrievedAtIso: "2026-01-01T00:00:00.000Z" }).chosen.store.storeId).toBe("core");
  });

  it("breaks an equal-coverage tie by cost, then distance, then stable key", () => {
    const mk = (chain: string, id: string, price: number, dist: number) => ({
      store: store({ chain, storeId: id, distanceKm: dist }),
      candidatesByConcept: new Map<string, Product[]>([
        ["pasta", [pasta({ priceOre: ore(price) })]],
        ["tomat", [tomat({ priceOre: ore(price) })]],
      ]),
    });
    const cheaper = compareStores({
      requirements,
      stores: [mk("ica", "a", 2000, 1), mk("coop", "b", 1500, 9)],
      source: "primat",
      retrievedAtIso: "2026-08-27T09:00:00.000Z",
    });
    expect(cheaper.comparison.chosenStoreKey).toBe("coop:b"); // cost wins over distance

    const stable = compareStores({
      requirements,
      stores: [mk("coop", "b", 1500, 2), mk("ica", "a", 1500, 2)],
      source: "primat",
      retrievedAtIso: "2026-08-27T09:00:00.000Z",
    });
    expect(stable.comparison.chosenStoreKey).toBe("coop:b"); // "coop:b" < "ica:a"
  });
});
