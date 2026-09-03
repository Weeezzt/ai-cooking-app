import type { PriceSource, ProductSearch, StoreDiscovery } from "@/ports";
import { PrimatClient, PRIMAT_ATTRIBUTION } from "./client";
import { mapProduct, mapResolveResponse, regularQuote, tryMapProduct } from "./mapper";

export class PrimatStoreDiscovery implements StoreDiscovery {
  constructor(private readonly client = new PrimatClient()) {}
  async resolve(place: string | null, options: Parameters<StoreDiscovery["resolve"]>[1]) {
    if (!place?.trim()) throw new Error("A place or postcode is required for live store discovery");
    const response = await this.client.resolve(place.trim(), options);
    return { ...mapResolveResponse(response, options.clock.nowIso()), attribution: response.attribution ?? PRIMAT_ATTRIBUTION };
  }
}
export class PrimatProductSearch implements ProductSearch {
  constructor(private readonly client = new PrimatClient()) {}
  async search(query: Parameters<ProductSearch["search"]>[0], options: Parameters<ProductSearch["search"]>[1]) {
    const response = await this.client.products(query.concept, [`${query.store.chain}:${query.store.storeId}`], options);
    const mapped = response.data.filter((raw) => raw.available && raw.chain === query.store.chain && String(raw.store_id) === query.store.storeId).map((raw) => tryMapProduct(raw, query.concept)).filter((p): p is NonNullable<typeof p> => p !== null);
    return { products: mapped.slice(0, query.limit), rejections: [], attribution: response.attribution ?? PRIMAT_ATTRIBUTION };
  }
}
export class PrimatPriceSource implements PriceSource {
  constructor(private readonly client = new PrimatClient()) {}
  async quote(productIds: readonly string[], store: Parameters<PriceSource["quote"]>[1], options: Parameters<PriceSource["quote"]>[2]) {
    if (productIds.length === 0) return [];
    const storeKey = `${store.chain}:${store.storeId}`;
    return this.client.observedProducts(storeKey, productIds).map((raw) => regularQuote(raw, options.clock.nowIso()));
  }
}
export { PrimatClient, PRIMAT_ATTRIBUTION, mapProduct, mapResolveResponse };
export * from "./category";
export * from "./filter";
export type * from "./types";
