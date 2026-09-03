import type { RecipeDraft, RecipeGenerationInput, RecipeGenerator, PortCallOptions } from "@/ports";
import { DEMO_RECIPE } from "./demoRecipe";
export class FixtureRecipeGenerator implements RecipeGenerator {
  async generate(input: RecipeGenerationInput, _options: PortCallOptions): Promise<RecipeDraft> {
    const scale = input.portions / 4;
    return { ...DEMO_RECIPE, ingredienser: DEMO_RECIPE.ingredienser.map((item) => ({ ...item, mangd: item.mangd * scale })) };
  }
}
