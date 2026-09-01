import type { PortCallOptions, RecipeDraft, RecipeGenerationInput, RecipeGenerator } from "@/ports";

import { DEMO_RECIPE_RESULT, type DemoRecipeResult } from "./demoRecipe";

export type RecipeServiceResult =
  | { readonly recipe: RecipeDraft; readonly isDemoFallback: false }
  | DemoRecipeResult;

export class RecipeService {
  constructor(private readonly generator: RecipeGenerator) {}

  async generate(input: RecipeGenerationInput, options: PortCallOptions): Promise<RecipeServiceResult> {
    try {
      return { recipe: await this.generator.generate(input, options), isDemoFallback: false };
    } catch {
      return DEMO_RECIPE_RESULT;
    }
  }
}
