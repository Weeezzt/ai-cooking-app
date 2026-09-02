/**
 * The PLAN input model.
 *
 * The structured/free-text rule (product-ux §1.2): anything the deterministic
 * engine must *check* is a structured control — budget, portions, time,
 * distance, location, pantry. Anything only the model interprets is prose —
 * cuisine, mood, dislikes, allergy phrasing. A hard constraint parsed out of
 * prose is a hard constraint we can silently get wrong.
 *
 * The form component renders this; it does not own it.
 */

import type { DietaryConstraint, PantryClaim } from "@/core/types";

import { formatSek } from "./format";
import { sekStringToOre } from "./planView";
import { allergyConstraint, composeVibe, detectAllergy } from "./vibe";

export interface PlanFormValues {
  readonly budgetSek: string;
  readonly portions: number;
  readonly maxCookMinutes: string;
  readonly maxDistanceKm: string;
  readonly location: string;
  readonly vibe: string;
  readonly dislikes: string;
  readonly dietary: readonly string[];
  readonly pantry: readonly string[];
}

export const DEFAULT_FORM_VALUES: PlanFormValues = {
  budgetSek: "300",
  portions: 4,
  maxCookMinutes: "40",
  maxDistanceKm: "5",
  location: "",
  vibe: "Något fräscht, kryddstarkt och asiatiskt-inspirerat, gärna högt protein",
  dislikes: "",
  dietary: [],
  pantry: [],
};

export const BUDGET_PRESETS = ["150", "200", "250", "300", "400", "500"] as const;
export const COOK_TIME_PRESETS = ["15", "30", "40", "60", "90"] as const;
export const DISTANCE_PRESETS = ["1", "2", "5", "10"] as const;

/** Dietary toggles. `safetyCritical` drives the AD-5 `unsupported` disclaimer. */
export const DIETARY_OPTIONS: readonly DietaryConstraint[] = [
  { id: "vegetarian", label: "Vegetariskt", safetyCritical: false },
  { id: "vegan", label: "Veganskt", safetyCritical: false },
  { id: "pork_free", label: "Fläskfritt", safetyCritical: false },
  { id: "gluten_free", label: "Glutenfritt", safetyCritical: true },
  { id: "lactose_free", label: "Laktosfritt", safetyCritical: true },
];

/** The staples people plausibly already own. Keys match the engine's concepts. */
export const PANTRY_OPTIONS: readonly PantryClaim[] = [
  { raw: "Salt", concept: "salt" },
  { raw: "Svartpeppar", concept: "svartpeppar" },
  { raw: "Olivolja", concept: "olivolja" },
  { raw: "Ris", concept: "ris" },
  { raw: "Pasta", concept: "pasta" },
  { raw: "Sojasås", concept: "sojasås" },
  { raw: "Vitlök", concept: "vitlök" },
  { raw: "Gul lök", concept: "gul lök" },
  { raw: "Ägg", concept: "ägg" },
  { raw: "Ost", concept: "ost" },
  { raw: "Morot", concept: "morot" },
  { raw: "Grädde", concept: "grädde" },
];

/** The full free text the model sees — vibe plus dislikes as an exclusion. */
export function fullVibe(values: PlanFormValues): string {
  return composeVibe(values.vibe, values.dislikes);
}

/** An allergy phrase anywhere in the prose → non-dismissible disclaimer. */
export function hasAllergyText(values: PlanFormValues): boolean {
  return (
    detectAllergy(fullVibe(values)) ||
    values.dietary.some(
      (id) => DIETARY_OPTIONS.find((option) => option.id === id)?.safetyCritical,
    )
  );
}

/** `"300"` + 4 portions → `"75 kr/portion"`. Live caption under the budget field. */
export function perPortionCaption(values: PlanFormValues): string {
  const ore = sekStringToOre(values.budgetSek);
  if (ore <= 0 || values.portions <= 0) return "";
  return `≈ ${formatSek(Math.round(ore / values.portions))}/portion`;
}

/** Pre-generation hint (§3.4). Non-blocking — generation still runs. */
export function tightBudgetHint(values: PlanFormValues): string | null {
  const ore = sekStringToOre(values.budgetSek);
  if (ore <= 0 || values.portions <= 0) return null;
  const perPortion = ore / values.portions;
  return perPortion < 2500
    ? `${formatSek(Math.round(perPortion))}/portion är tajt — förslagen blir enkla.`
    : null;
}

export interface PlanRequestBody {
  readonly location: string | null;
  readonly budgetSek: string;
  readonly portions: number;
  readonly maxDistanceKm: number;
  readonly maxCookMinutes: number | null;
  readonly dietary: readonly DietaryConstraint[];
  readonly pantry: readonly PantryClaim[];
  readonly vibe: string;
  readonly attempt: number;
}

/** Form values → the `POST /api/plan` body. The one place the mapping lives. */
export function toRequestBody(values: PlanFormValues, attempt: number): PlanRequestBody {
  const boundedAttempt = Math.max(0, Math.min(3, Math.floor(attempt) || 0));
  const vibe = fullVibe(values);
  const dietary = [
    ...DIETARY_OPTIONS.filter((option) => values.dietary.includes(option.id)),
    ...(allergyConstraint(vibe) ? [allergyConstraint(vibe) as DietaryConstraint] : []),
  ];

  return {
    location: values.location.trim() || null,
    budgetSek: values.budgetSek.trim(),
    portions: values.portions,
    maxDistanceKm: Number(values.maxDistanceKm),
    maxCookMinutes: values.maxCookMinutes ? Number(values.maxCookMinutes) : null,
    dietary,
    pantry: PANTRY_OPTIONS.filter((option) => values.pantry.includes(option.concept)),
    vibe,
    attempt: boundedAttempt,
  };
}

/** The next distance rung offered on `infeasible` — never applied automatically. */
export function nextDistanceRung(current: string): string | null {
  const value = Number(current);
  const next = DISTANCE_PRESETS.map(Number).find((rung) => rung > value);
  return next === undefined ? null : String(next);
}
