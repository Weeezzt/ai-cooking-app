import type { RecipeDraft, RecipeGenerationInput, RecipeGenerator, PortCallOptions } from "@/ports";

import { DEMO_RECIPE } from "./demoRecipe";

export class FixtureRecipeGenerator implements RecipeGenerator {
  async generate(input: RecipeGenerationInput, _options: PortCallOptions): Promise<RecipeDraft> {
    const ids = [...new Map(input.options.map((option) => [option.concept, option.optionId])).values()].slice(-3);
    const [first, second = first, third = second] = ids;
    if (!first) return DEMO_RECIPE;

    return {
      ...DEMO_RECIPE,
      portions: input.portions,
      requirements: [
        { optionId: first, requiredGrams: 320, role: "core" },
        { optionId: second, requiredGrams: 400, role: "core" },
        { optionId: third, requiredGrams: 240, role: "supporting" },
      ],
      steps: DEMO_RECIPE.steps.map((step, index) => ({
        ...step,
        optionRefs: index === 0 ? [first] : [second, third],
      })),
    };
  }
}
