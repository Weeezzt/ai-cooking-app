/** Deterministic request → coarse grocery-search archetypes (AD-3 step 4). */
import type { MealRequest, RequirementRole } from "../types";

export interface DerivedConcept {
  readonly concept: string;
  readonly role: RequirementRole;
}

const BASE = ["olivolja", "salt", "svartpeppar", "gul lök", "vitlök"] as const;
const INGREDIENTS = {
  protein: ["kyckling", "nötfärs", "fläskkött", "lax", "torsk", "räkor", "tofu", "halloumi", "kikärtor", "linser", "ägg", "korv"],
  carb: ["pasta", "ris", "potatis", "nudlar", "bulgur", "couscous", "quinoa", "bröd", "tortilla"],
  other: ["tomat", "paprika", "majs", "morot", "spenat", "sallad", "gurka", "citron", "lime", "lök", "vitlök", "ost", "grädde", "kokosmjölk", "dill"],
} as const;
interface ArchetypeSet { readonly pattern: RegExp; readonly core: readonly [string, string]; readonly supporting: readonly string[] }
const ARCHETYPES: readonly ArchetypeSet[] = [
  { pattern: /curry|indisk|tikka|masala/i, core: ["kyckling", "ris"], supporting: ["kokosmjölk", "currypasta", "spenat"] },
  { pattern: /pasta|spaghetti|bolognese|carbonara/i, core: ["nötfärs", "pasta"], supporting: ["krossade tomater", "ost", "gul lök"] },
  { pattern: /taco|tex[- ]?mex|burrito/i, core: ["nötfärs", "tortillabröd"], supporting: ["riven ost", "paprika", "majs"] },
  { pattern: /gryta|stew|mysig|comfort|höst/i, core: ["nötkött", "potatis"], supporting: ["morot", "buljong", "gul lök"] },
  { pattern: /sallad|fräsch|lätt|somrig/i, core: ["kyckling", "sallad"], supporting: ["körsbärstomat", "fetaost", "gurka"] },
  { pattern: /fisk|lax|torsk|skaldjur/i, core: ["lax", "potatis"], supporting: ["citron", "crème fraiche", "dill"] },
  { pattern: /soppa|soup/i, core: ["morot", "potatis"], supporting: ["buljong", "grädde", "gul lök"] },
  { pattern: /wok|asiatisk|thai|nudlar/i, core: ["kyckling", "nudlar"], supporting: ["sojasås", "paprika", "purjolök"] },
];
const FALLBACK: ArchetypeSet = { pattern: /(?:)/, core: ["kyckling", "ris"], supporting: ["krossade tomater", "gul lök", "grädde"] };

function dietKind(request: Pick<MealRequest, "dietary">): "vegan" | "vegetarian" | null {
  const labels = request.dietary.map(({ id, label }) => `${id} ${label}`).join(" ");
  if (/vegan|vegansk/i.test(labels)) return "vegan";
  return /vegetarian|vegetarisk|lakto|ovo/i.test(labels) ? "vegetarian" : null;
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sv-SE");
}

/**
 * Does an ingredient term appear in the vibe? Swedish jams words together
 * ("kycklingpasta", "laxsoppa", "potatisgratäng"), so a whole-word check misses
 * most real requests. Match when a word IS the term, STARTS with it (compound
 * head — "kyckling"pasta) or ENDS with it (compound tail — chicken"pasta"),
 * requiring ≥3 chars for the tail case to avoid noise.
 */
function namedIngredient(vibe: string, terms: readonly string[]): string | null {
  const words = fold(vibe).split(/[^a-z0-9]+/u).filter(Boolean);
  return (
    terms.find((term) => {
      const t = fold(term);
      return words.some(
        (word) => word === t || word.startsWith(t) || (t.length >= 3 && word.endsWith(t)),
      );
    }) ?? null
  );
}

/** At most two core slots: a main/protein and a carb/base. */
export function deriveConcepts(request: Pick<MealRequest, "vibe" | "dietary">): DerivedConcept[] {
  const selected = ARCHETYPES.find(({ pattern }) => pattern.test(request.vibe)) ?? FALLBACK;
  const diet = dietKind(request);
  const namedProtein = namedIngredient(request.vibe, INGREDIENTS.protein);
  const namedCarb = namedIngredient(request.vibe, INGREDIENTS.carb);
  const namedOther = INGREDIENTS.other.filter((term) => namedIngredient(request.vibe, [term]) !== null);
  const main = diet === "vegan" ? "kikärtor" : diet === "vegetarian" ? "halloumi" : namedProtein ?? selected.core[0];
  const ordered: DerivedConcept[] = [
    { concept: main, role: "core" }, { concept: namedCarb ?? selected.core[1], role: "core" },
    ...selected.supporting.map((concept) => ({ concept, role: "supporting" as const })),
    ...namedOther.map((concept) => ({ concept, role: "supporting" as const })),
    ...BASE.map((concept) => ({ concept, role: "supporting" as const })),
  ];
  return ordered.filter((item, index) => ordered.findIndex(({ concept }) => concept === item.concept) === index).slice(0, 8);
}
