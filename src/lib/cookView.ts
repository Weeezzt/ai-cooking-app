import type { Basket, PlanResult, RecipeStep } from "@/core/types";
import { formatNumber, formatQuantity, formatSek } from "@/lib/format";

export interface CookTextPart { readonly text: string; readonly quantity: boolean }
export interface CookStepView { readonly instruction: readonly CookTextPart[]; readonly ingredients: readonly string[]; readonly durationSeconds: number; readonly usesCombinedIngredients: boolean }
export interface CookSummaryView { readonly title: string; readonly portions: string; readonly total: string; readonly nutrition: string | null }
export interface CookView { readonly title: string; readonly steps: readonly CookStepView[]; readonly summary: CookSummaryView }

const QUANTITY = /\d+(?:[,.]\d+)?\s*(?:minuter|min|°\s*C|grader|sek(?:under)?)/giu;

/** Split step copy into normal and mono-accent duration/temperature runs. */
export function wrapCookQuantities(text: string): readonly CookTextPart[] {
  const parts: CookTextPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(QUANTITY)) {
    const index = match.index;
    if (index > cursor) parts.push({ text: text.slice(cursor, index), quantity: false });
    parts.push({ text: match[0], quantity: true });
    cursor = index + match[0].length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), quantity: false });
  return parts.length > 0 ? parts : [{ text, quantity: false }];
}

function ingredientLabel(line: Basket["lines"][number]): string {
  const value = line.recipeAmount ?? line.recipeGrams;
  const unit = line.unit ?? "g";
  return `${formatQuantity(value, unit)} ${line.product.name}`.toLocaleUpperCase("sv-SE");
}

/**
 * Join the model's step ingredient refs to basket lines. Degrades to the full
 * basket list (with `usesCombinedIngredients: true`, surfaced as a notice) when
 * NONE — or only SOME — of a step's refs resolve, so a step's line never
 * silently omits an ingredient the model attributed to it.
 */
export function ingredientsForStep(step: RecipeStep, basket: Basket): { readonly ingredients: readonly string[]; readonly usesCombinedIngredients: boolean } {
  const refs = new Set(step.ingredienser.map((name) => name.toLocaleLowerCase("sv-SE")));
  const lineIds = new Set(basket.lines.map((line) => line.namn.toLocaleLowerCase("sv-SE")));
  const fullyResolved = refs.size > 0 && [...refs].every((ref) => lineIds.has(ref));
  const joined = basket.lines.filter((line) => refs.has(line.namn.toLocaleLowerCase("sv-SE")));
  const lines = fullyResolved ? joined : basket.lines;
  return { ingredients: lines.map(ingredientLabel), usesCombinedIngredients: !fullyResolved };
}

export function clampCookPosition(position: number, stepCount: number): number {
  return Math.max(0, Math.min(stepCount, Math.trunc(position)));
}

/** Whole-second display value derived from timestamps, including background time. */
export function timerRemainingSeconds(durationSeconds: number, startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil(durationSeconds - (nowMs - startedAtMs) / 1000));
}

export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.trunc(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function buildCookView(plan: PlanResult): CookView | null {
  if (!plan.recipe || !plan.basket || plan.recipe.steps.length === 0) return null;
  const nutrition = plan.nutrition;
  return {
    title: plan.recipe.title,
    steps: plan.recipe.steps.map((step) => ({ ...ingredientsForStep(step, plan.basket!), instruction: wrapCookQuantities(step.text), durationSeconds: step.durationSeconds })),
    summary: {
      title: plan.recipe.title,
      portions: `${formatNumber(plan.recipe.portions)} portioner`,
      total: formatSek(plan.basket.totalOre),
      nutrition: !nutrition || nutrition.suppressed ? null : `${formatNumber(Math.round(nutrition.perPortion.kcal))} kcal · ${formatQuantity(nutrition.perPortion.proteinG, "g")} protein / portion`,
    },
  };
}
