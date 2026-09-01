import { zodTextFormat } from "openai/helpers/zod";

import type { PortCallOptions, RecipeDraft, RecipeGenerationInput, RecipeGenerator } from "@/ports";

import { getOpenAiClient } from "./client";
import { RecipeGenerationError } from "./errors";
import { verifyModels } from "./models";
import { buildRecipeInput, buildRepairInput } from "./prompt";
import { RecipeDraftSchema } from "./schema";
import { validateRecipe } from "./validate";

const RECIPE_TIMEOUT_MS = 45_000;
export const RECIPE_MAX_OUTPUT_TOKENS = 3_000;

function requestSignal(options: PortCallOptions): AbortSignal {
  const remaining = options.deadlineAt - options.clock.now();
  if (remaining <= 0) {
    throw new RecipeGenerationError("deadline_exceeded", "Recipe generation deadline has passed");
  }
  return AbortSignal.timeout(Math.min(remaining, RECIPE_TIMEOUT_MS));
}

export class OpenAiRecipeGenerator implements RecipeGenerator {
  async generate(input: RecipeGenerationInput, options: PortCallOptions): Promise<RecipeDraft> {
    const models = await verifyModels();
    let previousResponseId: string | undefined;
    let validationIssues = [...(input.validationIssues ?? [])];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (attempt > 0 && options.deadlineAt - options.clock.now() < 10_000) break;
      try {
        const response = await getOpenAiClient().responses.parse(
          {
            model: previousResponseId || attempt === 0 ? models.recipe : models.recipeFallback,
            input:
              attempt === 0
                ? buildRecipeInput(input)
                : previousResponseId
                  ? buildRepairInput(validationIssues.length ? validationIssues : ["Svaret kunde inte valideras"])
                  : `${buildRecipeInput(input)}\n\nTidigare leverantörsanrop misslyckades. Skapa receptet från underlaget ovan.`,
            ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
            text: { format: zodTextFormat(RecipeDraftSchema, "generated_recipe") },
            max_output_tokens: RECIPE_MAX_OUTPUT_TOKENS,
          },
          { signal: requestSignal(options), timeout: RECIPE_TIMEOUT_MS },
        );
        previousResponseId = response.id;
        if (!response.output_parsed) {
          validationIssues = ["Modellen returnerade inget strukturerat recept"];
          continue;
        }
        const checked = validateRecipe(RecipeDraftSchema.parse(response.output_parsed), input);
        if (checked.recipe) return checked.recipe;
        validationIssues = [...checked.issues];
      } catch (error) {
        if (error instanceof RecipeGenerationError) throw error;
        validationIssues = [error instanceof Error ? error.message : "Okänt leverantörsfel"];
      }
    }

    throw new RecipeGenerationError(
      "invalid_output",
      `Recipe output remained invalid after one repair: ${validationIssues.join("; ")}`,
    );
  }
}
