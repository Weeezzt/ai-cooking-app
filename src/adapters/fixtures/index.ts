import storesFixture from "@/fixtures/domain/stores.json";
import productsFixture from "@/fixtures/domain/products.json";
import { ore } from "@/core/money";
import type { Product, StoreOption } from "@/core/types";
import type { PriceSource, ProductSearch, StoreDiscovery } from "@/ports";
import { PRIMAT_ATTRIBUTION } from "@/adapters/primat/client";

interface ProductRow { readonly storeKey: string; readonly product: Product; readonly confirmedAt: string }
const fixtureProducts = productsFixture as unknown as Record<string, readonly ProductRow[]>;
function ensureDeadline(options: { deadlineAt:number; clock:{ now():number } }) { if (options.clock.now() >= options.deadlineAt) throw new Error("Fixture provider deadline exceeded"); }

export class FixtureStoreDiscovery implements StoreDiscovery {
  async resolve(_place: string | null, options: Parameters<StoreDiscovery["resolve"]>[1]) {
    ensureDeadline(options); return { ...(storesFixture as { location: typeof storesFixture.location; stores: StoreOption[] }), attribution: PRIMAT_ATTRIBUTION };
  }
}
export class FixtureProductSearch implements ProductSearch {
  async search(query: Parameters<ProductSearch["search"]>[0], options: Parameters<ProductSearch["search"]>[1]) {
    ensureDeadline(options); const key = `${query.store.chain}:${query.store.storeId}`;
    return { products: (fixtureProducts[query.concept.toLocaleLowerCase("sv-SE")] ?? []).filter((row) => row.storeKey === key).map((row) => row.product).slice(0, query.limit), rejections: [], attribution: PRIMAT_ATTRIBUTION };
  }
}
export class FixturePriceSource implements PriceSource {
  async quote(productIds: readonly string[], store: Parameters<PriceSource["quote"]>[1], options: Parameters<PriceSource["quote"]>[2]) {
    ensureDeadline(options); const ids = new Set(productIds); const key = `${store.chain}:${store.storeId}`;
    return Object.values(fixtureProducts).flat().filter((row) => row.storeKey === key && ids.has(row.product.id)).map((row) => ({ productId: row.product.id, storeKey: key, priceOre: ore(row.product.priceOre), priceType: "regular" as const, retrievedAtIso: options.clock.nowIso() }));
  }
}
