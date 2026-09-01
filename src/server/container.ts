import { FixturePriceSource, FixtureProductSearch, FixtureStoreDiscovery } from "@/adapters/fixtures";
import { FixtureNutritionSource } from "@/adapters/nutrition/FixtureNutritionSource";
import { FixtureRecipeGenerator } from "@/adapters/openai/FixtureRecipeGenerator";
import { OpenAiRecipeGenerator } from "@/adapters/openai/OpenAiRecipeGenerator";
import { verifyModels } from "@/adapters/openai/models";
import { PrimatClient, PrimatPriceSource, PrimatProductSearch, PrimatStoreDiscovery, PRIMAT_ATTRIBUTION } from "@/adapters/primat";
import type { PipelineDeps, PriceSource, ProductSearch, RecipeGenerator, StoreDiscovery } from "@/ports";

export interface DataSourceStatus {
  readonly mode: "live" | "fixture";
  readonly isDemoData: boolean;
  readonly usedFallback: boolean;
  readonly fallbackProviders: readonly ("stores" | "products" | "prices")[];
  readonly attribution: typeof PRIMAT_ATTRIBUTION;
}
export interface ContainerStatus extends DataSourceStatus { readonly isDemoRecipes: boolean }
export interface ServerContainer { readonly deps: PipelineDeps; readonly status: () => ContainerStatus }
export interface ServerContainerOptions { readonly dataSource?: string; readonly appMode?: string; readonly apiKey?: string }
interface DataContainer { readonly stores: StoreDiscovery; readonly products: ProductSearch; readonly prices: PriceSource; readonly status: () => DataSourceStatus }

function createDataContainer(mode: string | undefined): DataContainer {
  const selected = mode === "live" ? "live" : "fixture";
  const rawFixtureStores = new FixtureStoreDiscovery();
  const recorded = new Set(["coop:232400", "willys:2276", "ica:1003828"]);
  const fixtureStores: StoreDiscovery = { async resolve(place, options) { const result = await rawFixtureStores.resolve(place, options); return { ...result, stores: result.stores.filter((store) => recorded.has(`${store.chain}:${store.storeId}`)) }; } };
  const fixtureProducts = new FixtureProductSearch();
  const fixturePrices = new FixturePriceSource();
  const fallback = new Set<"stores" | "products" | "prices">();
  let fixtureSession = selected === "fixture";
  const status = (): DataSourceStatus => ({ mode: selected, isDemoData: fixtureSession, usedFallback: fallback.size > 0, fallbackProviders: [...fallback], attribution: PRIMAT_ATTRIBUTION });
  if (selected === "fixture") return { stores: fixtureStores, products: fixtureProducts, prices: fixturePrices, status };
  const client = new PrimatClient();
  const liveStores = new PrimatStoreDiscovery(client);
  const liveProducts = new PrimatProductSearch(client);
  const livePrices = new PrimatPriceSource(client);
  let fixtureDiscovery: Awaited<ReturnType<StoreDiscovery["resolve"]>> | undefined;
  const fixtureStoreFor = async (store: Parameters<ProductSearch["search"]>[0]["store"], options: Parameters<ProductSearch["search"]>[1]) => {
    fixtureDiscovery ??= await fixtureStores.resolve(null, options);
    return fixtureDiscovery.stores.find((candidate) => candidate.chain === store.chain) ?? fixtureDiscovery.stores[0];
  };
  return {
    stores: { async resolve(place, options) { try { return fixtureSession ? await fixtureStores.resolve(place, options) : await liveStores.resolve(place, options); } catch { fixtureSession = true; fallback.add("stores"); return fixtureStores.resolve(place, options); } } },
    products: { async search(query, options) {
      if (fixtureSession) return fixtureProducts.search({ ...query, store: await fixtureStoreFor(query.store, options) }, options);
      try { return await liveProducts.search(query, options); }
      catch { fixtureSession = true; fallback.add("products"); return fixtureProducts.search({ ...query, store: await fixtureStoreFor(query.store, options) }, options); }
    } },
    prices: { async quote(ids, store, options) { try { return fixtureSession ? await fixturePrices.quote(ids, store, options) : await livePrices.quote(ids, store, options); } catch { fixtureSession = true; fallback.add("prices"); return fixturePrices.quote(ids, store, options); } } },
    status,
  };
}

export async function createServerContainer(opts: ServerContainerOptions = {}): Promise<ServerContainer> {
  const data = createDataContainer(opts.dataSource ?? process.env.DATA_SOURCE);
  const appMode = opts.appMode ?? process.env.APP_MODE;
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  const fixtureRecipes = new FixtureRecipeGenerator();
  let isDemoRecipes = appMode === "demo" || !apiKey;
  let recipes: RecipeGenerator = fixtureRecipes;
  if (!isDemoRecipes) {
    await verifyModels();
    const liveRecipes = new OpenAiRecipeGenerator();
    recipes = { async generate(input, options) {
      if (input.demoFallbackOnly) { isDemoRecipes = true; return fixtureRecipes.generate(input, options); }
      const fallbackAfterMs = Math.max(0, options.deadlineAt - options.clock.now() - 1_000);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          liveRecipes.generate(input, options),
          new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("recipe_fallback_deadline")), fallbackAfterMs); timer.unref?.(); }),
        ]);
      } catch {
        isDemoRecipes = true;
        return fixtureRecipes.generate(input, options);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } };
  }
  return {
    deps: { stores: data.stores, products: data.products, prices: data.prices, nutrition: new FixtureNutritionSource(), recipes },
    status: () => { const current = data.status(); return { ...current, isDemoRecipes, isDemoData: current.isDemoData || isDemoRecipes }; },
  };
}
