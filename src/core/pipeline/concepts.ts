/** Deterministic request → coarse grocery-search archetypes (AD-3 step 4). */
import type { MealRequest, RequirementRole } from "../types";

export interface DerivedConcept {
  readonly concept: string;
  readonly role: RequirementRole;
}

const BASE = ["olivolja", "salt", "svartpeppar", "gul lök", "vitlök"] as const;
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

/** At most two core slots: a main/protein and a carb/base. */
export function deriveConcepts(request: Pick<MealRequest, "vibe" | "dietary">): DerivedConcept[] {
  const selected = ARCHETYPES.find(({ pattern }) => pattern.test(request.vibe)) ?? FALLBACK;
  const diet = dietKind(request);
  const main = diet === "vegan" ? "kikärtor" : diet === "vegetarian" ? "halloumi" : selected.core[0];
  const ordered: DerivedConcept[] = [
    { concept: main, role: "core" }, { concept: selected.core[1], role: "core" },
    ...selected.supporting.map((concept) => ({ concept, role: "supporting" as const })),
    ...BASE.map((concept) => ({ concept, role: "supporting" as const })),
  ];
  return ordered.filter((item, index) => ordered.findIndex(({ concept }) => concept === item.concept) === index).slice(0, 8);
}
