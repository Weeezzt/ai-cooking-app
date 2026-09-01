import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { filterCandidates } from "../../adapters/primat/filter";
import { mapProduct, mapResolveResponse } from "../../adapters/primat/mapper";
import type { PrimatProductsResponse, PrimatResolveResponse } from "../../adapters/primat/types";

const root = resolve(import.meta.dirname, "../../..");
const rawDir = resolve(root, "src/fixtures/raw");
const domainDir = resolve(root, "src/fixtures/domain");
const recording = JSON.parse(await readFile(resolve(rawDir, "recording.json"), "utf8")) as { recordedAt: string };
const resolveRaw = JSON.parse(await readFile(resolve(rawDir, "resolve-umea.json"), "utf8")) as PrimatResolveResponse;
const mappedResolve = mapResolveResponse(resolveRaw, recording.recordedAt);
const storesByKey = new Map(mappedResolve.stores.map((store) => [`${store.chain}:${store.storeId}`, store]));
const products: Record<string, { storeKey: string; product: ReturnType<typeof mapProduct>; confirmedAt: string }[]> = {};

for (const file of (await readdir(rawDir)).filter((name) => name.startsWith("products-") && name.endsWith(".json"))) {
  const concept = file.slice(9, -5);
  const raw = JSON.parse(await readFile(resolve(rawDir, file), "utf8")) as PrimatProductsResponse;
  products[concept] = [];
  for (const [key, store] of storesByKey) {
    const rows = raw.data.filter((item) => item.available && `${item.chain}:${item.store_id}` === key).flatMap((item) => {
      try { return [{ raw: item, product: mapProduct(item, concept) }]; } catch { return []; }
    });
    const filtered = filterCandidates(concept, rows.map((row) => row.product), store);
    const keptIds = new Set(filtered.kept.map((product) => product.id));
    products[concept].push(...rows.filter((row) => keptIds.has(row.product.id)).map((row) => ({
      storeKey: key,
      product: row.product,
      confirmedAt: row.raw.confirmed_at || row.raw.changed_at,
    })));
  }
}

await mkdir(domainDir, { recursive: true });
await writeFile(resolve(domainDir, "stores.json"), `${JSON.stringify({ location: { ...mappedResolve.location, isDemoDefault: true }, stores: mappedResolve.stores, attribution: resolveRaw.attribution }, null, 2)}\n`);
await writeFile(resolve(domainDir, "products.json"), `${JSON.stringify(products, null, 2)}\n`);
console.log(`Mapped ${Object.keys(products).length} concepts through the production mapper and filter.`);
