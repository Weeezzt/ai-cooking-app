import type { RecipeDraft, RecipeGenerationInput, RecipeGenerator, PortCallOptions } from "@/ports";

import { DEMO_RECIPE } from "./demoRecipe";

export class FixtureRecipeGenerator implements RecipeGenerator {
  async generate(input: RecipeGenerationInput, _options: PortCallOptions): Promise<RecipeDraft> {
    const selected = [...new Map(input.options.map((option) => [option.concept, option])).values()].slice(0, 3);
    const [first, second = first, third = second] = selected;
    if (!first) return DEMO_RECIPE;

    const quantity = (option: typeof first, amount: number) => option.form === "flytande" ? { requiredMl: amount } : { requiredGrams: amount };

    return {
      ...DEMO_RECIPE,
      portions: input.portions,
      requirements: [
        { optionId: first.optionId, ...quantity(first, 320), role: "core" },
        { optionId: second.optionId, ...quantity(second, 400), role: "core" },
        { optionId: third.optionId, ...quantity(third, 240), role: "supporting" },
      ],
      steps: DEMO_RECIPE.steps.map((step, index) => ({
        ...step,
        optionRefs: index === 0 ? [first.optionId] : [second.optionId, third.optionId],
      })),
    };
  }
}
