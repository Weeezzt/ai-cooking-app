import type { PortCallOptions, RecipeDraft, RecipeGenerationInput, RecipeGenerator } from "@/ports";

import { DEMO_RECIPE_RESULT, type DemoRecipeResult } from "./demoRecipe";

export type RecipeServiceResult =
  | { readonly recipe: RecipeDraft; readonly isDemoFallback: false }
  | DemoRecipeResult;

export class RecipeService {
  /**
   * @param demoSource `true` when `generator` is the fixture generator — every
   *   result it produces is demo data and must be badged, per AD-6 / AD-11.
   */
  constructor(
    private readonly generator: RecipeGenerator,
    private readonly demoSource = false,
  ) {}

  async generate(input: RecipeGenerationInput, options: PortCallOptions): Promise<RecipeServiceResult> {
    try {
      const recipe = await this.generator.generate(input, options);
      if (this.demoSource) return { recipe, isDemoFallback: true };
      return { recipe, isDemoFallback: false };
    } catch (error) {
      // Server-side signal for operators; never reaches the client, carries no secret.
      console.error(
        "[recipe] generation failed — serving pre-baked demo recipe:",
        error instanceof Error ? error.message : String(error),
      );
      return DEMO_RECIPE_RESULT;
    }
  }
}
