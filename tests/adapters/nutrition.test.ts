import { describe, expect, it } from "vitest";

import {
  FixtureNutritionSource,
  NUTRITION_ATTRIBUTIONS,
} from "@/adapters/nutrition/FixtureNutritionSource";
import { FixedClock } from "@/core/clock";

const TEST_CSV = `canonical_name,kcal,protein_g,carb_g,fat_g,source
jasminris torr,350,7,78,1,"Livsmedelsverket food-composition data, CC BY 4.0"
`;
const TEST_OFF = {
  attribution: "Open Food Facts ODbL attribution",
  products: {
    "7312345678901": {
      productName: "Testprodukt",
      per100g: { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5 },
    },
  },
} as const;
const clock = new FixedClock("2026-08-28T10:00:00.000Z");
const options = { clock, deadlineAt: clock.now() + 1_000 };

describe("FixtureNutritionSource", () => {
  const source = new FixtureNutritionSource(TEST_OFF, TEST_CSV);

  it("returns an OFF fact for a GTIN hit", async () => {
    const result = await source.lookup(
      [{ gtin: "7312345678901", concept: "jasminris torr" }],
      options,
    );

    expect(result).toEqual([{
      concept: "jasminris torr",
      per100g: { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5 },
      source: "Open Food Facts (ODbL)",
      retrievedAtIso: "2026-08-28T10:00:00.000Z",
    }]);
  });

  it("falls back to a normalized Livsmedelsverket CSV concept", async () => {
    const result = await source.lookup(
      [{ gtin: "missing", concept: "  Jasminris   torr " }],
      options,
    );

    expect(result).toEqual([{
      concept: "  Jasminris   torr ",
      per100g: { kcal: 350, proteinG: 7, carbsG: 78, fatG: 1 },
      source: "Livsmedelsverket (CC BY 4.0)",
      retrievedAtIso: "2026-08-28T10:00:00.000Z",
    }]);
  });

  it("omits a concept when neither fixture contains a match", async () => {
    const result = await source.lookup([{ concept: "mystisk råvara" }], options);

    expect(result).toEqual([]);
  });

  it("exposes both required attribution strings", () => {
    expect(source.getAttributions()).toEqual([
      "Open Food Facts (ODbL)",
      "Livsmedelsverket (CC BY 4.0)",
    ]);
    expect(NUTRITION_ATTRIBUTIONS).toEqual(source.getAttributions());
  });
});
