import { storeKey, type CandidateRejection, type Product, type StoreOption } from "../types";
export interface ResolvableIngredient {
  readonly namn:string; readonly mangd:number; readonly enhet:import("../types").CanonicalUnit;
  readonly kategori:import("../types").StoreSection; readonly roll:"huvud"|"komplement"|"garnering";
}

const fold = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("sv-SE").trim();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PREPARED_PATH = /fardigmat|fardigratter|frys|fryst|konserv/iu;
const PREPARED_NAME = /frozen|fryst|fardig|take\s*away|gourmetgrillad|grillad|tillagad|rokt/iu;
const PREPARED_EXEMPT = /sas|olja|vinager|buljong|fond|krydd|salt|peppar|senap|ketchup|majonnas|sylt|inlagd|krossade tomat|bonor/iu;
// Reject a "derivative" of the wanted ingredient (paprika CHIPS, tomato JUICE)
// — but NOT the spice aisle: paprikapulver, spiskummin etc. are real ingredients.
const DERIVATIVE_CATEGORY = /snacks|chips|godis|glass|dryck|juice|lask/iu;

/**
 * Does an ingredient name plausibly refer to this product? Deliberately
 * generous — a slightly-off match beats "hittades inte" for a staple. Accept
 * when any significant word of the ingredient name appears in the product name
 * as a whole word, a compound head, or a compound tail
 * ("paprika" ⊂ "padronpaprika", "spetspaprika").
 */
export function ingredientNameMatches(ingredientName: string, productName: string): boolean {
  const actual = fold(productName).replace(/[^a-z0-9]/g, " ");
  const words = fold(ingredientName).split(/\s+/u).filter((w) => w.length >= 3);
  const terms = words.length ? words : [fold(ingredientName)];
  return terms.some((term) => {
    if (new RegExp(`(?:^|[^a-z0-9])${escape(term)}(?:$|[^a-z0-9])`, "u").test(actual)) return true;
    return actual.split(/\s+/u).some((w) => w.startsWith(term) || (term.length >= 4 && w.endsWith(term)));
  });
}

function acceptable(ingredient: ResolvableIngredient, product: Product): CandidateRejection["reason"] | null {
  if (!ingredientNameMatches(ingredient.namn, product.name)) return "concept_mismatch";
  // Section is used for SHOP grouping, not filtering — the per-chain category
  // normalizer is unreliable and the model's `kategori` is a guess.
  if (DERIVATIVE_CATEGORY.test(fold(product.categoryPath.join(" > "))) && !PREPARED_EXEMPT.test(fold(ingredient.namn))) return "concept_mismatch";
  const prepared = PREPARED_PATH.test(fold(product.categoryPath.join(" > ")));
  if ((prepared || PREPARED_NAME.test(fold(product.name))) && ingredient.roll !== "garnering" && !PREPARED_EXEMPT.test(fold(ingredient.namn))) return "concept_mismatch";
  if (!Number.isSafeInteger(product.priceOre) || product.priceOre <= 0 || !Number.isSafeInteger(product.comparison.priceOre) || product.comparison.priceOre <= 0) return "invalid_price";
  if (!Number.isFinite(product.packageSize) || product.packageSize <= 0) return "invalid_amount";
  if (product.packageUnit !== ingredient.enhet && !(ingredient.enhet === "g" && product.comparison.unit === "kg") && !(ingredient.enhet === "ml" && product.comparison.unit === "l")) return "unit_incompatible";
  return null;
}

export interface IngredientResolution {
  readonly candidatesByName: ReadonlyMap<string, readonly Product[]>;
  readonly unmatched: readonly ResolvableIngredient[];
  readonly rejections: readonly CandidateRejection[];
}

export function resolveIngredients(store: StoreOption, ingredients: readonly ResolvableIngredient[], productsByName: ReadonlyMap<string, readonly Product[]>): IngredientResolution {
  const candidatesByName = new Map<string, readonly Product[]>();
  const unmatched: ResolvableIngredient[] = [];
  const rejections: CandidateRejection[] = [];
  for (const ingredient of ingredients) {
    const kept: Product[] = [];
    for (const product of productsByName.get(ingredient.namn) ?? []) {
      const reason = acceptable(ingredient, product);
      if (reason) rejections.push({ storeKey: storeKey(store), concept: ingredient.namn, productId: product.id, reason });
      else kept.push({ ...product, concept: ingredient.namn });
    }
    kept.sort((a, b) => {
      const aEnough = a.packageSize >= ingredient.mangd ? 0 : 1;
      const bEnough = b.packageSize >= ingredient.mangd ? 0 : 1;
      return aEnough - bEnough || a.packageSize - b.packageSize || a.comparison.priceOre - b.comparison.priceOre || a.id.localeCompare(b.id);
    });
    candidatesByName.set(ingredient.namn, kept);
    if (kept.length === 0) unmatched.push(ingredient);
  }
  return { candidatesByName, unmatched, rejections };
}
