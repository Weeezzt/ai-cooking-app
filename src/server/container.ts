import { FixtureRecipeGenerator } from "@/adapters/openai/FixtureRecipeGenerator";
import { OpenAiRecipeGenerator } from "@/adapters/openai/OpenAiRecipeGenerator";
import { RecipeService } from "@/adapters/openai/RecipeService";
import { verifyModels } from "@/adapters/openai/models";
import type { RecipeGenerator } from "@/ports";

export interface ServerContainer {
  readonly recipes: RecipeGenerator;
  readonly recipeService: RecipeService;
}

export async function createServerContainer(): Promise<ServerContainer> {
  if (process.env.OPENAI_API_KEY) await verifyModels();
  const recipes = process.env.OPENAI_API_KEY ? new OpenAiRecipeGenerator() : new FixtureRecipeGenerator();
  return {
    recipes,
    recipeService: new RecipeService(recipes),
  };
}
