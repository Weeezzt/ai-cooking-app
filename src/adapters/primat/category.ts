export const PRODUCT_SECTIONS = ["FRUKT & GRÖNT", "KÖTT & PROTEIN", "MEJERI", "TORRVAROR", "KRYDDOR", "ÖVRIGT"] as const;
export type ProductSection = (typeof PRODUCT_SECTIONS)[number];

const RULES: readonly [RegExp, ProductSection][] = [
  [/^(frukt (&|och) gr(ö|o)n|frukt-och-gront|frukt & grönsaker)/iu, "FRUKT & GRÖNT"],
  [/^(k(ö|o)tt|f(å|a)gel|fisk|vegetariskt|vego|protein)/iu, "KÖTT & PROTEIN"],
  [/^(mejeri|mj(ö|o)lk|ost|ägg|agg)/iu, "MEJERI"],
  [/^(skafferi|torrvaror|pasta|ris|gryn|konserver)/iu, "TORRVAROR"],
  [/^(kryddor|krydda|smaks(ä|a)ttare)/iu, "KRYDDOR"],
];

export function categoryPath(category: string | null): string[] {
  return category?.split(">", 20).map((part) => part.trim()).filter(Boolean) ?? [];
}

export function normalizeCategorySection(category: string | null, _chain?: string): ProductSection {
  const root = categoryPath(category)[0] ?? "";
  return RULES.find(([pattern]) => pattern.test(root))?.[1] ?? "ÖVRIGT";
}
