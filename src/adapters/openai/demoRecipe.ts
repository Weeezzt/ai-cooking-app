import type { RecipeDraft } from "@/ports";
export interface DemoRecipeResult { readonly recipe: RecipeDraft; readonly isDemoFallback: true }
export const DEMO_RECIPE: RecipeDraft = {
  titel: "Krämig tomatpasta med vita bönor", forklaring: "En enkel svensk vardagsrätt med få moment och mättande bönor.", uppskattadTidMin: 20,
  ingredienser: [
    { namn: "pasta", mangd: 320, enhet: "g", kategori: "TORRVAROR", roll: "huvud" },
    { namn: "krossade tomater", mangd: 400, enhet: "g", kategori: "TORRVAROR", roll: "huvud" },
    { namn: "vita bönor", mangd: 240, enhet: "g", kategori: "TORRVAROR", roll: "komplement" },
  ],
  steg: [
    { text: "Koka 320 g pasta i 10 minuter tills den är al dente; spara 1 dl kokvatten.", tidSek: 600, ingredienser: ["pasta"] },
    { text: "Sjud 400 g krossade tomater och 240 g avrunna vita bönor i 8 minuter.", tidSek: 480, ingredienser: ["krossade tomater", "vita bönor"] },
    { text: "Vänd ner pastan och rör i 2 minuter tills såsen är krämig.", tidSek: 120, ingredienser: ["pasta", "krossade tomater", "vita bönor"] },
  ],
};
export const DEMO_RECIPE_RESULT: DemoRecipeResult = { recipe: DEMO_RECIPE, isDemoFallback: true };
