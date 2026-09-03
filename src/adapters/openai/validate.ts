import type { RecipeDraft, RecipeGenerationInput } from "@/ports";
import type { ParsedRecipeDraft } from "./schema";

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("sv-SE");

export function validateRecipe(parsed: ParsedRecipeDraft, input: RecipeGenerationInput): { readonly recipe?: RecipeDraft; readonly issues: readonly string[] } {
  const issues: string[] = [];
  const names = new Set(parsed.ingredienser.map((item) => fold(item.namn)));
  if (!parsed.ingredienser.some((item) => item.roll === "huvud")) issues.push("minst en ingrediens måste ha rollen huvud");
  if (names.size !== parsed.ingredienser.length) issues.push("ingrediensnamn måste vara unika");
  for (const [index, step] of parsed.steg.entries()) {
    for (const ref of step.ingredienser) if (!names.has(fold(ref))) issues.push(`okänd ingrediens i steg ${index + 1}: ${ref}`);
    if (!/\d/.test(step.text)) issues.push(`steg ${index + 1} saknar mängd eller tid i texten`);
  }
  if (input.maxCookMinutes !== null && parsed.uppskattadTidMin <= 0) issues.push("ogiltig uppskattad tid");
  return issues.length ? { issues } : { issues, recipe: parsed };
}
