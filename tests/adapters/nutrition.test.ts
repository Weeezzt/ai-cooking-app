import { describe, expect, it } from "vitest";

import { FixtureNutritionSource } from "@/adapters/nutrition/FixtureNutritionSource";

const OFF_ATTRIBUTION = "Open Food Facts ODbL attribution";
const CSV_ATTRIBUTION = "Livsmedelsverket food-composition data, CC BY 4.0";
const TEST_CSV = `canonical_name,kcal,protein_g,carb_g,fat_g,source
jasminris torr,350,7,78,1,"${CSV_ATTRIBUTION}"
`;
const TEST_OFF = {
  attribution: OFF_ATTRIBUTION,
  products: {
    "7312345678901": {
      productName: "Testprodukt",
      per100g: { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5 },
    },
  },
} as const;

describe("FixtureNutritionSource", () => {
  const source = new FixtureNutritionSource(TEST_OFF, TEST_CSV);

  it("uses a GTIN hit first and scales macros from consumed recipeGrams", async () => {
    const result = await source.resolveRecipe([
      { gtin: "7312345678901", canonicalName: "jasminris torr", recipeGrams: 250 },
    ]);

    expect(result.total).toEqual({ kcal: 500, proteinG: 25, carbsG: 50, fatG: 12.5 });
    expect(result.requirements[0]).toMatchObject({ status: "covered", matchedBy: "gtin" });
    expect(result.coverageRatio).toBe(1);
  });

  it("falls back to a normalized canonical ingredient name", async () => {
    const result = await source.resolveRecipe([
      { gtin: "missing", canonicalName: "  Jasminris   torr ", recipeGrams: 50 },
    ]);

    expect(result.total).toEqual({ kcal: 175, proteinG: 3.5, carbsG: 39, fatG: 0.5 });
    expect(result.requirements[0]).toMatchObject({
      status: "covered",
      matchedBy: "canonical_name",
    });
  });

  it("marks a miss unknown and lowers mass-weighted coverage without fabricated macros", async () => {
    const result = await source.resolveRecipe([
      { canonicalName: "jasminris torr", recipeGrams: 75 },
      { canonicalName: "mystisk råvara", recipeGrams: 25 },
    ]);

    expect(result.coverageRatio).toBe(0.75);
    expect(result.coveredMassGrams).toBe(75);
    expect(result.totalMassGrams).toBe(100);
    expect(result.requirements[1]).toEqual({
      canonicalName: "mystisk råvara",
      recipeGrams: 25,
      status: "unknown",
    });
    expect(result.requirements[1]).not.toHaveProperty("macros");
  });

  it("exposes both required attribution strings", () => {
    expect(source.getAttributions()).toEqual([
      { source: "Open Food Facts", text: OFF_ATTRIBUTION },
      { source: "Livsmedelsverket", text: CSV_ATTRIBUTION },
    ]);
  });

  it("covers at least 70% of a representative demo basket", async () => {
    const fixtures = new FixtureNutritionSource();
    const result = await fixtures.resolveRecipe([
      { canonicalName: "kycklinglårfilé", recipeGrams: 600 },
      { canonicalName: "jasminris torr", recipeGrams: 300 },
      { canonicalName: "kokosmjölk", recipeGrams: 400 },
      { canonicalName: "purjolök", recipeGrams: 150 },
      { canonicalName: "vitlök", recipeGrams: 20 },
      { canonicalName: "rapsolja", recipeGrams: 20 },
      { canonicalName: "koriander färsk", recipeGrams: 15 },
      { canonicalName: "okänd garnering", recipeGrams: 25 },
    ]);

    expect(result.coverageRatio).toBeCloseTo(1505 / 1530);
    expect(result.coverageRatio).toBeGreaterThanOrEqual(0.7);
  });
});
