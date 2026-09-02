/**
 * Free-text helpers for the PLAN input screen.
 *
 * The structured/free-text split (product-ux §1.2) puts everything the engine
 * must *check* in a structured control and everything only the model interprets
 * in prose. These helpers do the small, deterministic reading of that prose the
 * UI needs: which macro to emphasise in the nutrition label, and whether the
 * text contains allergy-like language (AD-5 `unsupported` → non-dismissible
 * disclaimer, never a green pass).
 *
 * They never gate generation and never claim allergen safety.
 */

import type { DietaryConstraint } from "@/core/types";

export type EmphasisedMacro = "protein" | "carbs" | "fat" | null;

const MACRO_PATTERNS: readonly (readonly [EmphasisedMacro, RegExp])[] = [
  ["protein", /protein|proteinrik|proteinhalt|muskel/i],
  ["carbs", /kolhydrat|lowcarb|low[- ]carb|lchf|kolhydratsnål/i],
  ["fat", /fettrik|hög fetthalt|fetare|mycket fett/i],
];

/**
 * Which macro the user's own words emphasised — drives the single `--accent`
 * reference bar in the nutrition label (visual-direction §5.2). `null` when the
 * text asks for nothing in particular: no bar is emphasised rather than a
 * guessed one.
 */
export function emphasisedMacro(text: string): EmphasisedMacro {
  for (const [macro, pattern] of MACRO_PATTERNS) {
    if (pattern.test(text)) return macro;
  }
  return null;
}

const ALLERGY_PATTERN =
  /allerg|allergi|intoleran|celiaki|glutenfri|laktosfri|tål\s+(?:inte|ej)|nötfri|nickelallergi|anafyla/i;

/**
 * Allergy-like language in the free text. Deliberately generous: a false
 * positive costs one honest disclaimer, a false negative costs a safety claim
 * we are not allowed to make.
 */
export function detectAllergy(text: string): boolean {
  return ALLERGY_PATTERN.test(text);
}

/**
 * The safety-critical dietary constraint an allergy phrase produces. The engine
 * turns `safetyCritical` into an AD-5 `unsupported` check, which the constraint
 * table renders as a disclaimer row — never a pass.
 */
export function allergyConstraint(text: string): DietaryConstraint | null {
  return detectAllergy(text)
    ? { id: "allergy_freetext", label: "Allergi angiven i fritext", safetyCritical: true }
    : null;
}

/**
 * The single `vibe` string the API takes, assembled from the two prose fields.
 * Dislikes are phrased as an instruction so the model reads them as exclusions.
 */
export function composeVibe(vibe: string, dislikes: string): string {
  const parts = [vibe.trim(), dislikes.trim() ? `Undvik: ${dislikes.trim()}` : ""];
  return parts.filter(Boolean).join(". ").trim();
}
