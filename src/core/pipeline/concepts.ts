/**
 * Deterministic vibe → search-concept mapping (AD-3 step 4).
 *
 * Concepts are generic culinary archetypes ("kokosmjölk", "kycklinglårfilé"),
 * never SKUs. A small timed AI intent call is *allowed* by AD-3 but only if an
 * eval shows it improves Swedish recall — the engine ships with this pure map and
 * the pipeline works entirely without it.
 */

import type { MealRequest, RequirementRole } from "../types";

export interface DerivedConcept {
  readonly concept: string;
  readonly role: RequirementRole;
}

/** Always present — pantry staples, classified `supporting`. */
const BASE: readonly DerivedConcept[] = [
  { concept: "olivolja", role: "supporting" },
  { concept: "salt", role: "supporting" },
  { concept: "svartpeppar", role: "supporting" },
  { concept: "gul lök", role: "supporting" },
  { concept: "vitlök", role: "supporting" },
];

/** Keyword → additional concepts (all `core`). First match order is stable. */
const KEYWORD_CONCEPTS: readonly (readonly [RegExp, readonly string[]])[] = [
  [/curry|currygryta|indisk|tikka|masala/i, ["kycklinglårfilé", "kokosmjölk", "currypasta", "jasminris"]],
  [/pasta|spaghetti|bolognese|carbonara/i, ["pasta", "krossade tomater", "riven parmesan", "färsk basilika"]],
  [/taco|tacos|tex[- ]?mex|burrito/i, ["tortilla", "nötfärs", "tacokrydda", "riven ost"]],
  [/gryta|stew|höst|mysig|comfort/i, ["högrev", "rotfrukter", "buljong", "potatis"]],
  [/sallad|fräsch|lätt|somrig/i, ["bladsallad", "körsbärstomat", "fetaost", "gurka"]],
  [/fisk|lax|torsk|skaldjur/i, ["laxfilé", "citron", "dill", "kokt potatis"]],
  [/vegetarisk|vegansk|grön|linser|bönor/i, ["röda linser", "kokosmjölk", "spenat", "basmatiris"]],
  [/soppa|soup/i, ["morot", "buljong", "grädde", "bröd"]],
];

const FALLBACK: readonly string[] = ["kycklingfilé", "krossade tomater", "ris", "grädde"];

/**
 * 6–8 concepts, deterministic for a given request. Order: base staples, then
 * keyword-matched concepts in table order, de-duplicated, capped at 8.
 */
export function deriveConcepts(request: Pick<MealRequest, "vibe" | "dietary">): DerivedConcept[] {
  const out: DerivedConcept[] = [...BASE];
  const seen = new Set(out.map((c) => c.concept));

  const add = (concept: string, role: RequirementRole): void => {
    if (!seen.has(concept)) {
      seen.add(concept);
      out.push({ concept, role });
    }
  };

  const haystack = `${request.vibe} ${request.dietary.map((d) => d.label).join(" ")}`;
  let matched = false;
  for (const [pattern, concepts] of KEYWORD_CONCEPTS) {
    if (pattern.test(haystack)) {
      matched = true;
      for (const concept of concepts) add(concept, "core");
    }
  }
  if (!matched) {
    for (const concept of FALLBACK) add(concept, "core");
  }

  return out.slice(0, 8);
}
