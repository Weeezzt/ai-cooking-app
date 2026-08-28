import { readFileSync } from "node:fs";

import offNutritionJson from "@/fixtures/off-nutrition.json";
import type { NutrientVector } from "@/core/types";
import type { NutritionFact, NutritionLookup, NutritionSource, PortCallOptions } from "@/ports";

interface OffProduct {
  readonly productName: string;
  readonly per100g: NutrientVector;
}

interface OffSnapshot {
  readonly attribution: string;
  readonly products: Readonly<Record<string, OffProduct>>;
}

interface IngredientRow {
  readonly per100g: NutrientVector;
}

export const NUTRITION_ATTRIBUTIONS = [
  "Open Food Facts (ODbL)",
  "Livsmedelsverket (CC BY 4.0)",
] as const;

const [OFF_SOURCE, LIVSMEDELSVERKET_SOURCE] = NUTRITION_ATTRIBUTIONS;

function normalizeCanonicalName(name: string): string {
  return name.trim().toLocaleLowerCase("sv-SE").replace(/\s+/g, " ");
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

function parseIngredientTable(csv: string): Map<string, IngredientRow> {
  const lines = csv.trim().split(/\r?\n/);
  const header = parseCsvLine(lines.shift() ?? "");
  const expected = ["canonical_name", "kcal", "protein_g", "carb_g", "fat_g", "source"];
  if (header.length !== expected.length || header.some((value, index) => value !== expected[index])) {
    throw new Error("Invalid ingredient nutrition CSV header");
  }

  const rows = new Map<string, IngredientRow>();
  for (const line of lines) {
    if (!line.trim()) continue;
    const [name, kcal, protein, carbs, fat, source] = parseCsvLine(line);
    const values = [kcal, protein, carbs, fat].map(Number);
    if (!name || !source || values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new Error(`Invalid ingredient nutrition row: ${line}`);
    }
    rows.set(normalizeCanonicalName(name), {
      per100g: { kcal: values[0], proteinG: values[1], carbsG: values[2], fatG: values[3] },
    });
  }
  return rows;
}

export class FixtureNutritionSource implements NutritionSource {
  private readonly ingredients: Map<string, IngredientRow>;
  private readonly off: OffSnapshot;

  constructor(
    off: OffSnapshot = offNutritionJson as OffSnapshot,
    ingredientCsv: string = readFileSync(
      new URL("../../fixtures/ingredient-nutrition.csv", import.meta.url),
      "utf8",
    ),
  ) {
    this.off = off;
    this.ingredients = parseIngredientTable(ingredientCsv);
    if (this.ingredients.size === 0) throw new Error("Ingredient nutrition fixture is empty");
  }

  async lookup(
    concepts: readonly NutritionLookup[],
    options: PortCallOptions,
  ): Promise<readonly NutritionFact[]> {
    const facts: NutritionFact[] = [];
    for (const lookup of concepts) {
      if (options.clock.now() >= options.deadlineAt) break;

      const offProduct = lookup.gtin ? this.off.products[lookup.gtin] : undefined;
      const ingredient = this.ingredients.get(normalizeCanonicalName(lookup.concept));
      const per100g = offProduct?.per100g ?? ingredient?.per100g;
      if (!per100g) continue;

      facts.push({
        concept: lookup.concept,
        per100g,
        source: offProduct ? OFF_SOURCE : LIVSMEDELSVERKET_SOURCE,
        retrievedAtIso: options.clock.nowIso(),
      });
    }
    return facts;
  }

  getAttributions(): typeof NUTRITION_ATTRIBUTIONS {
    return NUTRITION_ATTRIBUTIONS;
  }
}
