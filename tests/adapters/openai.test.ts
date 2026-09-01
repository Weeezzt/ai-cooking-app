import { describe, expect, it } from "vitest";

import { FixedClock } from "@/core/clock";
import { FixtureRecipeGenerator } from "@/adapters/openai/FixtureRecipeGenerator";
import { RecipeService } from "@/adapters/openai/RecipeService";
import { RecipeDraftSchema } from "@/adapters/openai/schema";
import { validateRecipe } from "@/adapters/openai/validate";
import type { RecipeGenerationInput, RecipeGenerator } from "@/ports";

const input: RecipeGenerationInput = {
  portions: 2,
  vibe: "snabb och mustig",
  dietary: ["vegetarisk"],
  options: [
    { optionId: "opt-a", concept: "pasta", label: "pasta", form: "torr", coarseCategory: "dry_goods", dietaryTags: ["vegetarisk"] },
    { optionId: "opt-b", concept: "tomat", label: "tomat", form: "krossad", coarseCategory: "produce", dietaryTags: ["vegansk"] },
  ],
};
const callOptions = { deadlineAt: Date.parse("2026-08-28T12:01:00Z"), clock: new FixedClock("2026-08-28T12:00:00Z") };

describe("OpenAI recipe adapter", () => {
  it("fixture returns a valid recipe using only supplied handles", async () => {
    const recipe = await new FixtureRecipeGenerator().generate(input, callOptions);
    expect(recipe.portions).toBe(2);
    expect(recipe.requirements.every((item) => ["opt-a", "opt-b"].includes(item.optionId))).toBe(true);
  });

  it("semantic validation rejects unknown handles and ambiguous quantities", () => {
    const parsed = RecipeDraftSchema.parse({
      title: "Test",
      portions: 2,
      requirements: [{ optionId: "unknown", requiredGrams: 1, requiredMl: 1, requiredCount: null, role: "core" }],
      steps: [{ text: "Koka i 1 minut.", durationSeconds: 60, optionRefs: ["unknown"] }],
      estimatedCookMinutes: 1,
      explanation: "Test.",
    });
    expect(validateRecipe(parsed, input).issues).toEqual(expect.arrayContaining([
      expect.stringMatching(/okänt optionId/),
      expect.stringMatching(/exakt en mängddimension/),
    ]));
  });

  it("wraps provider failure in an explicitly badged demo result", async () => {
    const failing: RecipeGenerator = { generate: async () => { throw new Error("offline"); } };
    const result = await new RecipeService(failing).generate(input, callOptions);
    expect(result.isDemoFallback).toBe(true);
    expect(result.recipe.title).toMatch(/pasta/i);
  });
});
