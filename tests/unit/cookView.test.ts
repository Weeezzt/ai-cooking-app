import { describe, expect, it } from "vitest";

import type { RecipeStep } from "@/core/types";
import {
  buildCookView,
  clampCookPosition,
  ingredientsForStep,
  timerRemainingSeconds,
  wrapCookQuantities,
} from "@/lib/cookView";
import { OK_PLAN, SUPPRESSED_PLAN } from "../helpers/planFixtures";

describe("cook navigation", () => {
  it("clamps at the first step and the summary boundary", () => {
    expect(clampCookPosition(-5, 3)).toBe(0);
    expect(clampCookPosition(2, 3)).toBe(2);
    expect(clampCookPosition(99, 3)).toBe(3);
  });
});

describe("cook ingredient attribution", () => {
  const basket = OK_PLAN.basket!;
  const firstId = `opt-coop_232400-${basket.lines[0].product.id}`;

  it("joins a step option ref to its scaled recipe amount", () => {
    const step: RecipeStep = { text: "Tillaga.", durationSeconds: 0, ingredientRefs: [firstId] };
    expect(ingredientsForStep(step, basket)).toEqual({
      ingredients: ["320\u00a0G KYCKLINGBRÖSTFILÉ MÖRAD"],
      usesCombinedIngredients: false,
    });
  });

  it("degrades to the combined list when refs are absent", () => {
    const step: RecipeStep = { text: "Smaka av.", durationSeconds: 0, ingredientRefs: [] };
    const view = ingredientsForStep(step, basket);
    expect(view.usesCombinedIngredients).toBe(true);
    expect(view.ingredients).toHaveLength(basket.lines.length);
  });

  it("degrades to the combined list when a ref does not resolve (partial attribution)", () => {
    const step: RecipeStep = {
      text: "Stek.",
      durationSeconds: 0,
      ingredientRefs: [firstId, "opt-coop_232400-substituted-sku"],
    };
    const view = ingredientsForStep(step, basket);
    // One ref resolves, one doesn't — must not silently drop the missing one.
    expect(view.usesCombinedIngredients).toBe(true);
    expect(view.ingredients).toHaveLength(basket.lines.length);
  });
});

describe("cook instruction quantities", () => {
  it("marks durations and temperatures without marking ingredient amounts", () => {
    const parts = wrapCookQuantities("Stek 400 g kyckling i 8 minuter vid 200 °C, vila 30 sek.");
    expect(parts.filter((part) => part.quantity).map((part) => part.text)).toEqual([
      "8 minuter",
      "200 °C",
      "30 sek",
    ]);
  });
});

describe("cook summary", () => {
  it("shows total cost and per-portion kcal and protein", () => {
    expect(buildCookView(OK_PLAN)?.summary).toMatchObject({
      total: "208,99\u00a0kr",
      nutrition: "612 kcal · 41,1\u00a0g protein / portion",
    });
  });

  it("withholds suppressed nutrition", () => {
    expect(buildCookView(SUPPRESSED_PLAN)?.summary.nutrition).toBeNull();
  });
});

describe("cook timer", () => {
  it("recomputes remaining time from start and current timestamps", () => {
    expect(timerRemainingSeconds(60, 1_000, 11_000)).toBe(50);
    expect(timerRemainingSeconds(60, 1_000, 61_001)).toBe(0);
  });
});
