import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const rawDir = resolve(root, "src/fixtures/raw");
const headers = { Accept: "application/json" };
const base = "https://primat.nu/api/v3/demo/";
const concepts = ["banan", "lime", "kyckling", "ris", "pasta", "kokosmjölk", "tomat", "lök", "vitlök", "grädde", "ägg", "paprika", "morot"];
const stores = "coop:232400,willys:2276,ica:1003828";

async function get(path) {
  const response = await fetch(new URL(path, base), { headers });
  if (!response.ok) throw new Error(`Recording failed with HTTP ${response.status}`);
  return response.text();
}

await mkdir(rawDir, { recursive: true });
await writeFile(resolve(rawDir, "recording.json"), `${JSON.stringify({ recordedAt: new Date().toISOString(), source: base }, null, 2)}\n`);
await writeFile(resolve(rawDir, "resolve-umea.json"), await get("stores/resolve?place=Ume%C3%A5"));
for (const concept of concepts) {
  const params = new URLSearchParams({ q: concept, stores });
  await writeFile(resolve(rawDir, `products-${concept}.json`), await get(`products?${params}`));
}
console.log(`Recorded resolve + ${concepts.length} concept responses for 3 Umeå stores.`);
