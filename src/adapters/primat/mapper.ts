import { ore, roundHalfUp } from "@/core/money";
import type { Product, StoreOption } from "@/core/types";
import { categoryPath, normalizeCategorySection } from "./category";
import type { PrimatProduct, PrimatResolveResponse } from "./types";

function money(value: number) { return ore(roundHalfUp(value * 100)); }

export function mapResolveResponse(raw: PrimatResolveResponse, recordedAt: string): { location: { lat:number; lon:number; label:string; isDemoDefault:boolean }; stores: StoreOption[] } {
  return {
    location: { lat: raw.place.latitude, lon: raw.place.longitude, label: raw.place.label, isDemoDefault: false },
    stores: raw.stores.map((store) => ({
      chain: store.chain, storeId: String(store.store_id), name: store.name,
      tier: store.tier === null ? "register_only" : store.tier,
      distanceKm: store.km, confirmedAt: store.confirmed_at ?? recordedAt,
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
  const variableWeight = /_KG$/i.test(raw.product_id) || /\bca\.?\b/i.test(raw.name);
  const rawComparisonUnit = comparison?.unit.toLowerCase();
  const comparisonUnit = variableWeight && (rawComparisonUnit === "kg" || rawComparisonUnit === "l") ? rawComparisonUnit : "st";
  return {
    id: raw.product_id, name: raw.name, concept, brand: raw.brand,
    priceOre: money(raw.prices.regular), packageSize: amount, packageUnit,
    comparison: { priceOre: comparisonPrice, unit: comparisonUnit },
    section: normalizeCategorySection(raw.category, raw.chain),
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
