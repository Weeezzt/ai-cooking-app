import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const rawDir = resolve(root, "src/fixtures/raw");
const domainDir = resolve(root, "src/fixtures/domain");
const splitCategory = (value) => value?.split(">").map((part) => part.trim()).filter(Boolean) ?? [];
const ore = (sek) => Math.round(Number(sek) * 100);
const resolveRaw = JSON.parse(await readFile(resolve(rawDir, "resolve-umea.json"), "utf8"));
const stores = resolveRaw.stores.map((store) => ({ chain: store.chain, storeId: String(store.store_id), name: store.name, tier: store.tier ?? "register_only", distanceKm: store.km, confirmedAt: store.confirmed_at ?? "1970-01-01T00:00:00.000Z" }));
const location = { lat: resolveRaw.place.latitude, lon: resolveRaw.place.longitude, label: resolveRaw.place.label, isDemoDefault: true };
const products = {};
for (const file of (await readdir(rawDir)).filter((name) => name.startsWith("products-"))) {
  const concept = file.slice(9, -5); const raw = JSON.parse(await readFile(resolve(rawDir, file), "utf8"));
  const perStore = new Map();
  products[concept] = raw.data.filter((item) => {
    const key = `${item.chain}:${item.store_id}`; const count = perStore.get(key) ?? 0;
    if (!item.available || item.amount <= 0 || item.prices.regular <= 0 || !["g", "ml", "st", "kg", "l"].includes(item.unit) || count >= 5) return false;
    perStore.set(key, count + 1); return true;
  }).map((item) => {
    const sourceUnit = item.unit; const packageUnit = sourceUnit === "kg" ? "g" : sourceUnit === "l" ? "ml" : sourceUnit;
    const comparison = item.prices.comparison; const variable = comparison?.unit?.toLowerCase() === "kg" && comparison.price > 0;
    return { storeKey: `${item.chain}:${item.store_id}`, product: { id: item.product_id, name: item.name, concept, brand: item.brand, priceOre: ore(item.prices.regular), packageSize: ["kg", "l"].includes(sourceUnit) ? item.amount * 1000 : item.amount, packageUnit, comparison: { priceOre: ore(comparison?.price > 0 ? comparison.price : item.prices.regular), unit: variable ? "kg" : comparison?.unit?.toLowerCase() === "l" ? "l" : "st" }, categoryPath: splitCategory(item.category), dietaryTags: [] }, confirmedAt: item.confirmed_at };
  });
}
await mkdir(domainDir, { recursive: true });
await writeFile(resolve(domainDir, "stores.json"), `${JSON.stringify({ location, stores }, null, 2)}\n`);
await writeFile(resolve(domainDir, "products.json"), `${JSON.stringify(products, null, 2)}\n`);
console.log(`Mapped ${Object.keys(products).length} concepts into domain fixtures.`);
