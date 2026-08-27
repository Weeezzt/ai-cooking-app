import { describe, expect, it } from "vitest";

import { ore } from "@/core/money";
import type { ComparisonUnitPrice, Product } from "@/core/types";
import {
  isVariableWeight,
  normalizeAmount,
  packsForNeed,
  variableWeightPriceOre,
} from "@/core/units";

describe("normalizeAmount", () => {
  it("normalizes mass to grams", () => {
    expect(normalizeAmount(1, "kg")).toEqual({ value: 1000, unit: "g" });
    expect(normalizeAmount(2, "hg")).toEqual({ value: 200, unit: "g" });
    expect(normalizeAmount(500, "g")).toEqual({ value: 500, unit: "g" });
  });
  it("normalizes volume to ml", () => {
    expect(normalizeAmount(1, "l")).toEqual({ value: 1000, unit: "ml" });
    expect(normalizeAmount(2, "dl")).toEqual({ value: 200, unit: "ml" });
  });
  it("passes counts through", () => {
    expect(normalizeAmount(3, "st")).toEqual({ value: 3, unit: "st" });
  });
  it("rejects unknown units and bad values", () => {
    expect(() => normalizeAmount(1, "cups")).toThrow();
    expect(() => normalizeAmount(-1, "g")).toThrow();
  });
});

function makeProduct(over: Partial<Product>): Product {
  return {
    id: "P1",
    name: "Testvara",
    concept: "test",
    brand: null,
    priceOre: ore(1000),
    packageSize: 500,
    packageUnit: "g",
    comparison: { priceOre: ore(2000), unit: "kg" },
    categoryPath: ["ÖVRIGT"],
    dietaryTags: [],
    ...over,
  };
}

describe("isVariableWeight", () => {
  it("is true when comparison unit is kg", () => {
    expect(isVariableWeight(makeProduct({ comparison: { priceOre: ore(9900), unit: "kg" } }))).toBe(
      true,
    );
  });
  it("is true for an _KG sku id", () => {
    expect(
      isVariableWeight(
        makeProduct({ id: "1234_KG", comparison: { priceOre: ore(500), unit: "st" } }),
      ),
    ).toBe(true);
  });
  it("is true for a 'ca' pack name", () => {
    expect(
      isVariableWeight(
        makeProduct({ name: "Fläskkotlett ca 800 g", comparison: { priceOre: ore(500), unit: "st" } }),
      ),
    ).toBe(true);
  });
  it("is false for a normal fixed pack", () => {
    expect(
      isVariableWeight(makeProduct({ name: "Krossade tomater 400 g", comparison: { priceOre: ore(300), unit: "st" } })),
    ).toBe(false);
  });
});

describe("variableWeightPriceOre", () => {
  it("prices exact grams at comparison price per kg, half-up to öre", () => {
    // 500 g at 99,00 kr/kg → 4950 öre exactly
    const cmp: ComparisonUnitPrice = { priceOre: ore(9900), unit: "kg" };
    expect(variableWeightPriceOre(500, cmp)).toBe(4950);
  });
  it("rounds half-up", () => {
    // 333 g at 100,00 kr/kg → 3330 öre; 333 g at 100,01 → 3330.333 → 3330
    expect(variableWeightPriceOre(333, { priceOre: ore(10000), unit: "kg" })).toBe(3330);
    // 5 g at 100,10 kr/kg = 50.05 öre → 50
    expect(variableWeightPriceOre(5, { priceOre: ore(10010), unit: "kg" })).toBe(50);
    // 5 g at 101,00 kr/kg = 50.5 öre → 51 (half-up)
    expect(variableWeightPriceOre(5, { priceOre: ore(10100), unit: "kg" })).toBe(51);
  });
  it("rejects a non-kg comparison unit", () => {
    expect(() => variableWeightPriceOre(100, { priceOre: ore(100), unit: "st" })).toThrow();
  });
});

describe("packsForNeed", () => {
  it("is the smallest sufficient whole-pack count", () => {
    expect(packsForNeed(500, 700)).toBe(1);
    expect(packsForNeed(700, 700)).toBe(1);
    expect(packsForNeed(701, 700)).toBe(2);
    expect(packsForNeed(0, 700)).toBe(0);
  });
  it("tolerates float division noise", () => {
    expect(packsForNeed(0.3, 0.1)).toBe(3);
  });
  it("rejects bad inputs", () => {
    expect(() => packsForNeed(-1, 100)).toThrow();
    expect(() => packsForNeed(100, 0)).toThrow();
  });
});
