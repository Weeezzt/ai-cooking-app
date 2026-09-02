import { describe, expect, it } from "vitest";

import { selectCandidate, resolvePurchase } from "@/core/basket";
import { FixedClock, isPastDeadline } from "@/core/clock";
import { ore } from "@/core/money";
import { deriveConcepts, PipelineValidationError, validateRequest } from "@/core/pipeline";
import type { MealRequest, Product } from "@/core/types";
import { variableWeightPriceOre } from "@/core/units";

const GOOD_REQUEST: MealRequest = {
  location: "Umeå",
  budgetSek: "150",
  portions: 4,
  maxDistanceKm: 5,
  maxCookMinutes: 30,
  dietary: [],
  pantry: [],
  vibe: "currygryta",
};

describe("validateRequest", () => {
  it("interprets a good request: budget → öre, concepts derived", () => {
    const interpreted = validateRequest(GOOD_REQUEST);
    expect(interpreted.budgetOre).toBe(15000);
    expect(interpreted.concepts.length).toBeGreaterThanOrEqual(6);
    expect(interpreted.concepts.length).toBeLessThanOrEqual(8);
  });

  it("collects every issue for a bad request", () => {
    try {
      validateRequest({
        ...GOOD_REQUEST,
        budgetSek: "nope",
        portions: 0,
        maxDistanceKm: -1,
        dietary: [
          { id: "", label: "x", safetyCritical: false },
          { id: "dup", label: "a", safetyCritical: false },
          { id: "dup", label: "b", safetyCritical: false },
        ],
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PipelineValidationError);
      const issues = (err as PipelineValidationError).issues;
      expect(issues.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("rejects a non-positive budget", () => {
    expect(() => validateRequest({ ...GOOD_REQUEST, budgetSek: "-5" })).toThrow(PipelineValidationError);
  });
});

describe("deriveConcepts", () => {
  it("falls back to a generic concept set when nothing matches", () => {
    const derived = deriveConcepts({ vibe: "xyzzy", dietary: [] });
    expect(derived.some((c) => c.role === "core")).toBe(true);
    expect(derived).toHaveLength(8);
  });

  it("is deterministic for the same input", () => {
    expect(deriveConcepts({ vibe: "taco kväll", dietary: [] })).toEqual(
      deriveConcepts({ vibe: "taco kväll", dietary: [] }),
    );
  });
  it("uses at most two coarse core concepts and respects plant diets", () => {
    const vegan = deriveConcepts({ vibe: "fisk och potatis", dietary: [{ id: "vegan", label: "Vegansk", safetyCritical: false }] });
    expect(vegan.filter((concept) => concept.role === "core")).toEqual([
      { concept: "kikärtor", role: "core" }, { concept: "potatis", role: "core" },
    ]);
  });

  it.each([
    ["pasta med kyckling", [], ["kyckling", "pasta"]],
    ["laxsoppa", [], ["lax", "potatis"]],
    ["currygryta med tofu", [], ["tofu", "ris"]],
    ["pasta med kyckling", [{ id: "vegetarian", label: "Vegetarisk", safetyCritical: false }], ["halloumi", "pasta"]],
  ] as const)("respects named ingredients in %s", (vibe, dietary, expected) => {
    const concepts = deriveConcepts({ vibe, dietary }).filter(({ role }) => role === "core").map(({ concept }) => concept);
    expect(concepts).toEqual(expected);
    if (dietary.length) expect(deriveConcepts({ vibe, dietary }).some(({ concept }) => concept === "kyckling")).toBe(false);
  });
});

describe("FixedClock", () => {
  it("exposes epoch ms and ISO", () => {
    const clock = new FixedClock("2026-08-27T09:00:00.000Z");
    expect(clock.now()).toBe(Date.parse("2026-08-27T09:00:00.000Z"));
    expect(clock.nowIso()).toBe("2026-08-27T09:00:00.000Z");
    expect(clock.now()).toBe(new FixedClock(clock.now()).now());
  });
  it("throws on an unparseable instant", () => {
    expect(() => new FixedClock("not-a-date")).toThrow();
  });
  it("isPastDeadline compares against the clock", () => {
    const clock = new FixedClock(1_000);
    expect(isPastDeadline({ clock, deadlineAt: 2_000 })).toBe(false);
    expect(isPastDeadline({ clock, deadlineAt: 500 })).toBe(true);
  });
});

describe("select edge cases", () => {
  const prod = (over: Partial<Product> & Pick<Product, "id">): Product => ({
    name: over.id,
    concept: "c",
    brand: null,
    priceOre: ore(1000),
    packageSize: 500,
    packageUnit: "g",
    comparison: { priceOre: ore(2000), unit: "st" },
    section: "ÖVRIGT",
    categoryPath: [],
    dietaryTags: [],
    ...over,
  });

  it("breaks a price tie by comparison unit price, then leftover, then id", () => {
    const a = prod({ id: "z", priceOre: ore(1000), comparison: { priceOre: ore(1000), unit: "st" } });
    const b = prod({ id: "a", priceOre: ore(1000), comparison: { priceOre: ore(900), unit: "st" } });
    expect(selectCandidate(400, [a, b])?.product.id).toBe("a");
  });

  it("resolvePurchase rejects a negative amount", () => {
    expect(() => resolvePurchase(-1, prod({ id: "x" }))).toThrow();
  });

  it("variableWeightPriceOre rejects a negative gram count", () => {
    expect(() => variableWeightPriceOre(-1, { priceOre: ore(1000), unit: "kg" })).toThrow();
  });
});
