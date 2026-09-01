import type { CandidateRejection, CanonicalUnit, Product, StoreOption } from "@/core/types";
import { storeKey } from "@/core/types";

const FOOD_CATEGORY: Record<string, readonly RegExp[]> = {
  banan: [/frukt/iu, /banan/iu], lime: [/frukt/iu, /citrus/iu], "färsk lime": [/frukt/iu, /citrus/iu],
  kyckling: [/kött|fågel|kyckling/iu], ris: [/ris|torrvar|skafferi/iu], pasta: [/pasta|torrvar|skafferi/iu],
  kokosmjölk: [/kokos|asiat|konserv|skafferi/iu], tomat: [/frukt|grönt|grönsak/iu],
  lök: [/frukt|grönt|grönsak/iu], vitlök: [/frukt|grönt|grönsak|krydd/iu],
  grädde: [/mejeri|grädde/iu], ägg: [/mejeri|ägg/iu], paprika: [/frukt|grönt|grönsak|krydd/iu],
};
const AMOUNT_RANGES: Record<string, Partial<Record<CanonicalUnit, readonly [number, number]>>> = {
  banan: { g:[20,50_000] }, lime:{ g:[10,10_000] }, "färsk lime":{ g:[10,10_000] }, kyckling:{ g:[50,30_000] },
  ris:{ g:[50,25_000] }, pasta:{ g:[50,25_000] }, kokosmjölk:{ ml:[50,10_000] }, tomat:{ g:[10,30_000] },
  lök:{ g:[10,30_000] }, vitlök:{ g:[5,5_000] }, grädde:{ ml:[50,10_000] }, ägg:{ st:[1,100] },
};

function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sv-SE");
}

function escaped(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export interface CandidateFilterOptions { readonly requiredUnit?: CanonicalUnit }
export interface CandidateFilterResult { readonly kept: Product[]; readonly rejections: CandidateRejection[] }

export function filterCandidates(concept: string, products: readonly Product[], store: StoreOption, options: CandidateFilterOptions = {}): CandidateFilterResult {
  const kept: Product[] = []; const rejections: CandidateRejection[] = [];
  const canonical = concept.trim().toLocaleLowerCase("sv-SE");
  const foldedConcept = fold(canonical);
  const patterns = FOOD_CATEGORY[canonical];
  for (const product of products) {
    let reason: CandidateRejection["reason"] | null = null;
    const path = product.categoryPath.join(" > ");
    const searchable = fold(`${product.name} ${path}`);
    const nameMatches = new RegExp(`\\b${escaped(foldedConcept)}\\w*`, "iu").test(searchable);
    const categoryMatches = patterns?.some((pattern) => pattern.test(path)) ?? false;
    const freshLimeNoise = canonical.includes("lime") && /juice|koncentrat|dryck/iu.test(`${product.name} ${path}`);
    const conceptMatches = patterns ? nameMatches && (categoryMatches || product.categoryPath.length === 0) : nameMatches;
    if (freshLimeNoise || !conceptMatches) reason = "concept_mismatch";
    else if (options.requiredUnit && options.requiredUnit !== product.packageUnit && !(options.requiredUnit === "g" && product.comparison.unit === "kg")) reason = "unit_incompatible";
    else if (!Number.isSafeInteger(product.priceOre) || product.priceOre <= 0 || !Number.isSafeInteger(product.comparison.priceOre) || product.comparison.priceOre <= 0 || product.comparison.priceOre > 1_000_000) reason = "invalid_price";
    else {
      const range = AMOUNT_RANGES[canonical]?.[product.packageUnit] ?? ([product.packageUnit === "st" ? 1 : 1, product.packageUnit === "st" ? 1_000 : 100_000] as const);
      if (!Number.isFinite(product.packageSize) || product.packageSize < range[0] || product.packageSize > range[1] || (product.packageUnit === "st" && !Number.isInteger(product.packageSize))) reason = "invalid_amount";
      else {
        const comparableAmount = product.comparison.unit === "kg" && product.packageUnit === "g" ? product.packageSize / 1000 : product.comparison.unit === "l" && product.packageUnit === "ml" ? product.packageSize / 1000 : product.comparison.unit === "st" && product.packageUnit === "st" ? product.packageSize : null;
        if (comparableAmount !== null) { const ratio = product.priceOre / (product.comparison.priceOre * comparableAmount); if (ratio < 0.1 || ratio > 10) reason = "invalid_price"; }
      }
    }
    if (reason) rejections.push({ storeKey: storeKey(store), concept, productId: product.id, reason }); else kept.push(product);
  }
  return { kept, rejections };
}
