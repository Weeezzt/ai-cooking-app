import type { PriceSource, ProductSearch, StoreDiscovery } from "@/ports";
import { FixturePriceSource, FixtureProductSearch, FixtureStoreDiscovery } from "@/adapters/fixtures";
import { PrimatClient, PrimatPriceSource, PrimatProductSearch, PrimatStoreDiscovery, PRIMAT_ATTRIBUTION } from "@/adapters/primat";

export interface DataSourceStatus {
  readonly mode: "live" | "fixture"; readonly isDemoData: boolean; readonly usedFallback: boolean;
  readonly fallbackProviders: readonly ("stores" | "products" | "prices")[]; readonly attribution: typeof PRIMAT_ATTRIBUTION;
}
export interface DataContainer { readonly stores: StoreDiscovery; readonly products: ProductSearch; readonly prices: PriceSource; readonly status: () => DataSourceStatus }

export function createDataContainer(mode: string | undefined = process.env.DATA_SOURCE): DataContainer {
  const selected = mode === "live" ? "live" : "fixture";
  const fixtureStores = new FixtureStoreDiscovery(); const fixtureProducts = new FixtureProductSearch(); const fixturePrices = new FixturePriceSource();
  const fallback = new Set<"stores" | "products" | "prices">();
  let fixtureSession = selected === "fixture";
  const status = (): DataSourceStatus => ({ mode: selected, isDemoData: fixtureSession, usedFallback: fallback.size > 0, fallbackProviders: [...fallback], attribution: PRIMAT_ATTRIBUTION });
  if (selected === "fixture") return { stores: fixtureStores, products: fixtureProducts, prices: fixturePrices, status };
  const client = new PrimatClient(); const liveStores = new PrimatStoreDiscovery(client); const liveProducts = new PrimatProductSearch(client); const livePrices = new PrimatPriceSource(client);
  return {
    stores: { async resolve(place, options) { if (fixtureSession) return fixtureStores.resolve(place, options); try { return await liveStores.resolve(place, options); } catch { fixtureSession = true; fallback.add("stores"); return fixtureStores.resolve(place, options); } } },
    products: { async search(query, options) { if (fixtureSession) return fixtureProducts.search(query, options); try { return await liveProducts.search(query, options); } catch { fixtureSession = true; fallback.add("products"); return fixtureProducts.search(query, options); } } },
    prices: { async quote(ids, store, options) { if (fixtureSession) return fixturePrices.quote(ids, store, options); try { return await livePrices.quote(ids, store, options); } catch { fixtureSession = true; fallback.add("prices"); return fixturePrices.quote(ids, store, options); } } },
    status,
  };
}
