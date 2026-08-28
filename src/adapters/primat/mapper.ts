import { ore, parseSekToOre } from "@/core/money";
import type { Product, StoreOption } from "@/core/types";
import { categoryPath } from "./category";
import type { PrimatProduct, PrimatResolveResponse } from "./types";

function money(value: number) { return parseSekToOre(String(value)); }

export function mapResolveResponse(raw: PrimatResolveResponse): { location: { lat:number; lon:number; label:string; isDemoDefault:boolean }; stores: StoreOption[] } {
  return {
    location: { lat: raw.place.latitude, lon: raw.place.longitude, label: raw.place.label, isDemoDefault: false },
    stores: raw.stores.map((store) => ({
      chain: store.chain, storeId: String(store.store_id), name: store.name,
      tier: store.tier === null ? "register_only" : store.tier,
      distanceKm: store.km, confirmedAt: store.confirmed_at ?? "1970-01-01T00:00:00.000Z",
    })),
  };
}

export function mapProduct(raw: PrimatProduct, concept: string): Product {
  if (!Number.isFinite(raw.amount) || raw.amount <= 0) throw new RangeError("Invalid Primat product amount");
  if (!Number.isFinite(raw.prices.regular) || raw.prices.regular <= 0) throw new RangeError("Invalid Primat regular price");
  const sourceUnit = raw.unit;
  const packageUnit = sourceUnit === "kg" ? "g" : sourceUnit === "l" ? "ml" : sourceUnit;
  if (packageUnit !== "g" && packageUnit !== "ml" && packageUnit !== "st") throw new RangeError("Unsupported Primat product unit");
  const amount = sourceUnit === "kg" || sourceUnit === "l" ? raw.amount * 1000 : raw.amount;
  const comparison = raw.prices.comparison;
  const comparisonPrice = comparison && comparison.price > 0 ? money(comparison.price) : money(raw.prices.regular);
  const variableWeight = comparison?.unit.toLowerCase() === "kg" && comparison.price > 0;
  const comparisonUnit = variableWeight ? "kg" : comparison?.unit.toLowerCase() === "l" ? "l" : "st";
  return {
    id: raw.product_id, name: raw.name, concept, brand: raw.brand,
    priceOre: money(raw.prices.regular), packageSize: amount, packageUnit,
    comparison: { priceOre: comparisonPrice, unit: comparisonUnit },
    categoryPath: categoryPath(raw.category), dietaryTags: [],
  };
}

export function tryMapProduct(raw: PrimatProduct, concept: string): Product | null {
  try { return mapProduct(raw, concept); } catch { return null; }
}

export function regularQuote(raw: PrimatProduct, retrievedAtIso: string) {
  return { productId: raw.product_id, storeKey: `${raw.chain}:${raw.store_id}`, priceOre: money(raw.prices.regular), priceType: "regular" as const, retrievedAtIso };
}

export { ore };
