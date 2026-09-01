import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FixedClock } from "@/core/clock";
import { ore } from "@/core/money";
import type { Product, StoreOption } from "@/core/types";
import { FixturePriceSource, FixtureProductSearch, FixtureStoreDiscovery } from "@/adapters/fixtures";
import { filterCandidates, mapProduct, mapResolveResponse, normalizeCategorySection, PRIMAT_ATTRIBUTION } from "@/adapters/primat";
import type { PrimatProduct, PrimatProductsResponse, PrimatResolveResponse } from "@/adapters/primat";

const root = resolve(__dirname, "../.."); const clock = new FixedClock(); const options = { clock, deadlineAt: clock.now() + 10_000 };
const raw = <T>(name: string) => JSON.parse(readFileSync(resolve(root, `src/fixtures/raw/${name}`), "utf8")) as T;
const recording = raw<{ recordedAt: string }>("recording.json");

describe("Primat category normalization", () => {
  it.each([
    ["Frukt & Grönsaker > Frukt & bär > Banan", "coop", "FRUKT & GRÖNT"],
    ["Frukt & Grönt > Frukt > Banan", "ica", "FRUKT & GRÖNT"],
    ["frukt-och-gront > frukt > bananer", "willys", "FRUKT & GRÖNT"],
    ["Kött & Fågel > Kyckling", "ica", "KÖTT & PROTEIN"],
    [null, "willys", "ÖVRIGT"],
  ] as const)("maps %s", (category, chain, expected) => expect(normalizeCategorySection(category, chain)).toBe(expected));
});

const store: StoreOption = { chain: "coop", storeId: "232400", name: "Stora Coop Avion", tier: "full", distanceKm: 2.4, confirmedAt: "2026-08-27T00:00:00Z" };
const product = (id:string, name:string, path:string[], unit:Product["packageUnit"]="g"): Product => ({ id, name, concept:"banan", brand:null, priceOre:ore(2_000), packageSize:500, packageUnit:unit, comparison:{priceOre:ore(4_000),unit:unit === "g" ? "kg" : "st"}, section:"FRUKT & GRÖNT", categoryPath:path,dietaryTags:[] });
describe("candidate filter", () => {
  it("rejects banana toys and keeps fruit", () => {
    const result = filterCandidates("banan", [product("real","Banan",["Frukt & Grönsaker","Banan"]), product("game","It's Bananas",["Leksaker","Spel"],"st"), product("plush","Chimpanzini Bananini",["Leksaker","Mjukisdjur"],"st")], store, { requiredUnit:"g" });
    expect(result.kept.map((item) => item.id)).toEqual(["real"]); expect(result.rejections).toEqual(expect.arrayContaining([{storeKey:"coop:232400",concept:"banan",productId:"game",reason:"concept_mismatch"},{storeKey:"coop:232400",concept:"banan",productId:"plush",reason:"concept_mismatch"}]));
  });
  it("rejects concentrated lime juice and keeps fresh lime", () => {
    const fresh = product("fresh","Färsk lime",["Frukt & Grönsaker","Citrus"]); const juice = product("juice","Limejuice från koncentrat",["Skafferi","Juice"],"ml");
    expect(filterCandidates("färsk lime", [fresh, juice], store, { requiredUnit:"g" }).kept).toEqual([fresh]);
  });
});

describe("adapter contracts: raw-fed mapper and fixture implementation", () => {
  it("returns identical normalized stores", async () => {
    const mapped = mapResolveResponse(raw<PrimatResolveResponse>("resolve-umea.json"), recording.recordedAt); const fixture = await new FixtureStoreDiscovery().resolve(null, options);
    expect(fixture.stores).toEqual(mapped.stores); expect(fixture.location).toEqual({ ...mapped.location, isDemoDefault:true });
    expect(fixture.stores.filter((item) => item.tier === "full").length).toBeGreaterThanOrEqual(3);
  });
  it("returns identical normalized products and regular quotes", async () => {
    const storeOption = (await new FixtureStoreDiscovery().resolve(null, options)).stores.find((item) => item.chain === "coop" && item.storeId === "232400")!;
    const response = raw<PrimatProductsResponse>("products-banan.json"); const mapped = response.data.filter((item) => item.available && item.chain === "coop" && item.store_id === "232400").map((item) => { try{return mapProduct(item,"banan")}catch{return null} }).filter((item):item is Product=>item!==null); const expected = filterCandidates("banan", mapped, storeOption).kept.slice(0,5);
    const fixture = await new FixtureProductSearch().search({concept:"banan",store:storeOption,limit:5},options); expect(fixture.products).toEqual(expected);
    const quotes = await new FixturePriceSource().quote(fixture.products.map((item)=>item.id),storeOption,options); expect(quotes.every((quote)=>quote.priceType === "regular" && Number.isInteger(quote.priceOre))).toBe(true);
  });
});

describe("Primat mapping rules", () => {
  it("uses regular price and only comparison kg for variable weight", () => {
    const source = raw<PrimatProductsResponse>("products-banan.json").data.find((item)=>item.prices.comparison?.unit === "kg") as PrimatProduct;
    const mapped = mapProduct(source,"banan"); expect(mapped.priceOre).toBe(ore(Math.round(source.prices.regular*100))); expect(mapped.comparison.unit).toBe("kg");
    expect(mapProduct({...source,product_id:"CA_PACK",prices:{...source.prices,comparison:{price:0,unit:"kg"}}},"banan").comparison.unit).toBe("st");
  });
  it("surfaces mandatory attribution", async () => {
    expect(PRIMAT_ATTRIBUTION).toEqual({ text: "Prisdata från primat.nu", url: "https://primat.nu" });
    const stores = await new FixtureStoreDiscovery().resolve(null, options);
    const products = await new FixtureProductSearch().search({ concept: "banan", store: stores.stores[0], limit: 1 }, options);
    expect(stores.attribution).toEqual(PRIMAT_ATTRIBUTION);
    expect(products.attribution).toEqual(PRIMAT_ATTRIBUTION);
  });
});
