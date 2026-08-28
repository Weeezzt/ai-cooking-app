#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const USER_AGENT = "cookingapp-research/0.1 william.vesterberg00@gmail.com";
const REQUEST_INTERVAL_MS = 6_100; // Deliberately below the requested maximum of 10 requests/minute.
const ATTRIBUTION =
  "Data from Open Food Facts, made available under the Open Database License (ODbL): https://opendatacommons.org/licenses/odbl/1-0/";
const SEEDED_SWEDISH_GTINS = [
  "7394376616037", "5000112637939", "7311870010970", "7392672104104",
  "7310865008060", "5000112637922", "6408430102068", "7310070005250",
  "4000339697908", "5449000000439", "7340083443893", "7311070338188",
  "7311070001952", "59032823", "7310240060157", "7311070008708",
  "4016241050526", "7311631524128", "0037600160490", "8715700016504",
  "7311071330525", "7310865005168", "8719200052543", "7311311020599",
  "7340083442612", "7311870011076", "4013265001053", "7340083443886",
  "5000184321064", "5000396026993",
];

const fixtureRoot = resolve(process.cwd(), "src/fixtures");
const domainRoot = join(fixtureRoot, "domain");
const outputPath = join(fixtureRoot, "off-nutrition.json");

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await listFiles(path));
    else paths.push(path);
  }
  return paths;
}

async function fixtureGtins() {
  if (!existsSync(domainRoot)) return [];
  const gtins = new Set();
  for (const path of await listFiles(domainRoot)) {
    if (![".json", ".jsonl", ".ts"].includes(extname(path))) continue;
    const contents = await readFile(path, "utf8");
    for (const match of contents.matchAll(/(?:"gtin"\s*:\s*|gtin\s*[:=]\s*)["']?(\d{8,14})/g)) {
      gtins.add(match[1]);
    }
  }
  return [...gtins].sort();
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function fetchProduct(gtin) {
  const fields = "code,product_name,nutriments";
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${gtin}.json?fields=${fields}`,
    { headers: { "User-Agent": USER_AGENT } },
  );
  if (!response.ok) throw new Error(`OFF ${gtin}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.status !== 1) return undefined;
  const nutrients = payload.product?.nutriments ?? {};
  const values = {
    kcal: nutrients["energy-kcal_100g"],
    proteinG: nutrients.proteins_100g,
    carbsG: nutrients.carbohydrates_100g,
    fatG: nutrients.fat_100g,
  };
  if (Object.values(values).some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    return undefined;
  }
  return { productName: payload.product.product_name || gtin, per100g: values };
}

const discoveredGtins = await fixtureGtins();
const gtins = discoveredGtins.length > 0 ? discoveredGtins : SEEDED_SWEDISH_GTINS;
const products = {};

console.log(`Capturing ${gtins.length} OFF products at <= 10 requests/minute.`);
for (const [index, gtin] of gtins.entries()) {
  const product = await fetchProduct(gtin);
  if (product) products[gtin] = product;
  console.log(`${index + 1}/${gtins.length} ${gtin}: ${product ? "captured" : "missing nutrition"}`);
  if (index < gtins.length - 1) await wait(REQUEST_INTERVAL_MS);
}

await writeFile(
  outputPath,
  `${JSON.stringify({ attribution: ATTRIBUTION, capturedAt: new Date().toISOString(), products }, null, 2)}\n`,
  "utf8",
);
console.log(`Wrote ${Object.keys(products).length}/${gtins.length} products to ${outputPath}.`);
