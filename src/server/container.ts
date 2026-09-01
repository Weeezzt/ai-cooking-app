import type { PriceSource, ProductSearch, RecipeGenerator, StoreDiscovery } from "@/ports";
import { FixturePriceSource, FixtureProductSearch, FixtureStoreDiscovery } from "@/adapters/fixtures";
import { PrimatClient, PrimatPriceSource, PrimatProductSearch, PrimatStoreDiscovery, PRIMAT_ATTRIBUTION } from "@/adapters/primat";
import { FixtureRecipeGenerator } from "@/adapters/openai/FixtureRecipeGenerator";
import { OpenAiRecipeGenerator } from "@/adapters/openai/OpenAiRecipeGenerator";
import { RecipeService } from "@/adapters/openai/RecipeService";
import { verifyModels } from "@/adapters/openai/models";

// NOTE (#7): the plan pipeline wants one `createServerContainer()` that assembles
// PipelineDeps { stores, products, prices, nutrition, recipes }. This file currently
// exposes the data + recipe halves separately; #7 unifies them (and adds nutrition).

// ---------------------------------------------------------------------------
// Data providers (Primat live + badged fixture fallback) — from issue #4
// ---------------------------------------------------------------------------

export interface DataSourceStatus {
  readonly mode: "live" | "fixture"; readonly isDemoData: boolean; readonly usedFallback: boolean;
  readonly fallbackProviders: readonly ("stores" | "products" | "prices")[]; readonly attribution: typeof PRIMAT_ATTRIBUTION;
}
export interface DataContainer { readonly stores: StoreDiscovery; readonly products: ProductSearch; readonly prices: PriceSource; readonly status: () => DataSourceStatus }

export function createDataContainer(mode: string | undefined = process.env.DATA_SOURCE): DataContainer {
  if (mode !== undefined && mode !== "live" && mode !== "fixture") console.warn(`Unrecognized DATA_SOURCE ${JSON.stringify(mode)}; using fixture data`);
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

// ---------------------------------------------------------------------------
// Recipe provider (OpenAI + badged demo fallback) — from issue #6
// ---------------------------------------------------------------------------

export interface RecipeContainer {
  readonly recipes: RecipeGenerator;
  readonly recipeService: RecipeService;
  /** `true` when the recipe path is the fixture/demo generator (no live model). */
  readonly isDemoRecipes: boolean;
}

/**
 * Live recipes require BOTH `APP_MODE !== "demo"` and an `OPENAI_API_KEY`.
 * Anything else uses the fixture generator, and its output is badged as demo
 * data by `RecipeService` (AD-6: no silent unbadged fixture recipe).
 */
export async function createRecipeContainer(
  appMode: string | undefined = process.env.APP_MODE,
  apiKey: string | undefined = process.env.OPENAI_API_KEY,
): Promise<RecipeContainer> {
  const wantLive = appMode !== "demo" && Boolean(apiKey);
  if (wantLive) {
    await verifyModels();
    const recipes = new OpenAiRecipeGenerator();
    return { recipes, recipeService: new RecipeService(recipes, false), isDemoRecipes: false };
  }
  const recipes = new FixtureRecipeGenerator();
  return { recipes, recipeService: new RecipeService(recipes, true), isDemoRecipes: true };
}
