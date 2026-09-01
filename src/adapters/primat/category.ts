import type { StoreSection } from "@/core/types";

export const PRODUCT_SECTIONS = ["FRUKT & GRÖNT", "KÖTT & PROTEIN", "MEJERI", "TORRVAROR", "KRYDDOR", "ÖVRIGT"] as const satisfies readonly StoreSection[];

const RULES: readonly [RegExp, StoreSection][] = [
  [/^(frukt (&|och) gr(ö|o)n|frukt-och-gront|frukt & grönsaker)/iu, "FRUKT & GRÖNT"],
  [/^(k(ö|o)tt|f(å|a)gel|fisk|vegetariskt|vego|protein)/iu, "KÖTT & PROTEIN"],
  [/^(mejeri|mj(ö|o)lk|ost|ägg|agg)/iu, "MEJERI"],
  [/^(skafferi|torrvaror|pasta|ris|gryn|konserver)/iu, "TORRVAROR"],
  [/^(kryddor|krydda|smaks(ä|a)ttare)/iu, "KRYDDOR"],
];

export function categoryPath(category: string | null): string[] {
  return category?.split(">", 20).map((part) => part.trim()).filter(Boolean) ?? [];
}

export function normalizeCategorySection(category: string | null, chain = ""): StoreSection {
  const root = /^(willys|hemkop)$/i.test(chain)
    ? (category?.split(">", 1)[0]?.trim() ?? "")
    : (categoryPath(category)[0] ?? "");
  return RULES.find(([pattern]) => pattern.test(root))?.[1] ?? "ÖVRIGT";
}
