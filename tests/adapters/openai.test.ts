import { describe, expect, it } from "vitest";
import { FixtureRecipeGenerator } from "@/adapters/openai/FixtureRecipeGenerator";
import { buildRecipeInput } from "@/adapters/openai/prompt";
import { RecipeDraftSchema } from "@/adapters/openai/schema";
import { validateRecipe } from "@/adapters/openai/validate";
import { FixedClock } from "@/core/clock";
import type { RecipeGenerationInput } from "@/ports";

const input: RecipeGenerationInput = { vibe:"billig pasta",portions:4,dietary:["vegetarian"],maxCookMinutes:30,pantry:["salt"],budgetTier:"snav" };
describe("recipe generation",()=>{
  it("projects only recipe intent and returns the Swedish schema",async()=>{const recipe=await new FixtureRecipeGenerator().generate(input,{clock:new FixedClock(),deadlineAt:99_999});expect(RecipeDraftSchema.parse(recipe)).toEqual(recipe);const prompt=buildRecipeInput(input);expect(prompt).toContain('"budgetTier":"snav"');expect(prompt).not.toMatch(/"(?:price|pris|gtin|butik)"\s*:/i);});
  it("rejects step references that are not ingredient names",()=>{const parsed=RecipeDraftSchema.parse({titel:"Pasta",forklaring:"Enkel",uppskattadTidMin:10,ingredienser:[{namn:"pasta",mangd:100,enhet:"g",kategori:"TORRVAROR",roll:"huvud"}],steg:[{text:"Koka i 8 minuter.",ingredienser:["ris"],tidSek:480}]});expect(validateRecipe(parsed,input).issues).toContain("okänd ingrediens i steg 1: ris");});
});
