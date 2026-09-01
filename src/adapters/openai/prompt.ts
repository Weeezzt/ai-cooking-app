import type { RecipeGenerationInput } from "@/ports";

import { RecipeInputProjectionSchema } from "./schema";

const SYSTEM_PROMPT = `Du är en svensk receptutvecklare. Svara direkt på svenska.
Använd endast de optionId som finns i underlaget. Varje ingrediensmängd måste knytas till exakt ett optionId.
Varje steg ska vara självbärande: ange relevanta mängder, kärl/metod och tid i själva stegtexten.
Hitta aldrig på andra ingredienser. estimatedCookMinutes är en uppskattning.`;

export function buildRecipeInput(input: RecipeGenerationInput): string {
  const safeProjection = RecipeInputProjectionSchema.parse({
    portions: input.portions,
    vibe: input.vibe,
    dietary: input.dietary,
    options: input.options.map(({ optionId, concept, label, form, coarseCategory, dietaryTags }) => ({
      optionId,
      concept,
      label,
      form,
      coarseCategory,
      dietaryTags,
    })),
  });
  return `${SYSTEM_PROMPT}\n\nSkapa ett komplett recept från detta underlag:\n${JSON.stringify(safeProjection)}`;
}

export function buildRepairInput(issues: readonly string[]): string {
  return `Följande regler bröts: ${issues.join("; ")}. Returnera hela receptobjektet igen, korrigerat och på svenska.`;
}
