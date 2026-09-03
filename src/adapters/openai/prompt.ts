import type { RecipeGenerationInput } from "@/ports";

import { RecipeInputProjectionSchema } from "./schema";

const SYSTEM_PROMPT = `Du är en svensk receptutvecklare. Svara direkt på svenska med vanliga, verkliga svenska livsmedelsnamn.
Returnera bara recept och ingrediensnamn med mängder. Du känner inte till butik, produkter, varumärken, lager eller priser och får aldrig påstå sådana fakta.
Varje namn ska vara ETT enda kort basord som går att söka på i en butik: "pasta", "kyckling", "lök", "vitlök", "grädde", "persilja", "paprika", "salt". Skriv INTE sammansatta eller beskrivande namn ("gul lök", "bladpersilja", "kycklinglårfilé", "krossade tomater") — använd basordet ("lök", "persilja", "kyckling", "tomat"). Lägg aldrig alternativ, exempel, parenteser, mängder eller kommentarer i namn-fältet.
Ange grönsaker, kött, fisk och torrvaror i gram, vätskor i milliliter; använd styck bara när varan normalt säljs och söks i styck, främst ägg.
Varje steg ska vara självbärande: ange relevanta mängder, kärl/metod och tid i texten. Skriv aldrig koder eller handtag.
Ingrediensreferenserna i steg måste exakt motsvara namn i ingredienslistan. Respektera dietary strikt och använd exakt angivet antal portioner.
Om rätten uttryckligen är en fisksoppa ska en rå fiskfilé, exempelvis laxfilé eller torskfilé, vara en huvudråvara; skaldjur ensamt räcker inte.
BudgetTier är bara en kulinarisk ledtråd: snav betyder enkelt och billigt, generos får vara lite mer premium. Det är aldrig ett belopp.`;

export function buildRecipeInput(input: RecipeGenerationInput): string {
  const safeProjection = RecipeInputProjectionSchema.parse({
    portions: input.portions,
    vibe: input.vibe,
    dietary: input.dietary,
    maxCookMinutes: input.maxCookMinutes,
    pantry: input.pantry,
    budgetTier: input.budgetTier,
  });
  return `${SYSTEM_PROMPT}\n\nSkapa ett komplett recept från detta underlag:\n${JSON.stringify(safeProjection)}`;
}

export function buildRepairInput(issues: readonly string[]): string {
  return `Följande regler bröts: ${issues.join("; ")}. Returnera hela receptobjektet igen, korrigerat och på svenska.`;
}
