import type { RecipeDraft } from "@/ports";

export interface DemoRecipeResult {
  readonly recipe: RecipeDraft;
  readonly isDemoFallback: true;
}

export const DEMO_RECIPE: RecipeDraft = {
  title: "Krämig tomatpasta med vita bönor",
  portions: 4,
  requirements: [
    { optionId: "demo-pasta", requiredGrams: 320, role: "core" },
    { optionId: "demo-tomat", requiredGrams: 400, role: "core" },
    { optionId: "demo-bonor", requiredGrams: 240, role: "supporting" },
  ],
  steps: [
    {
      text: "Koka 320 g pasta enligt anvisningen tills den är al dente; spara 1 dl kokvatten.",
      durationSeconds: 600,
      optionRefs: ["demo-pasta"],
    },
    {
      text: "Sjud 400 g tomat och 240 g avrunna vita bönor i en rymlig panna i 8 minuter.",
      durationSeconds: 480,
      optionRefs: ["demo-tomat", "demo-bonor"],
    },
    {
      text: "Vänd ner pastan och späd med lite kokvatten; rör i 2 minuter tills såsen är krämig.",
      durationSeconds: 120,
      optionRefs: ["demo-pasta", "demo-tomat", "demo-bonor"],
    },
  ],
  estimatedCookMinutes: 20,
  explanation: "En enkel svensk vardagsrätt med få moment och mättande bönor.",
};

export const DEMO_RECIPE_RESULT: DemoRecipeResult = {
  recipe: DEMO_RECIPE,
  isDemoFallback: true,
};
