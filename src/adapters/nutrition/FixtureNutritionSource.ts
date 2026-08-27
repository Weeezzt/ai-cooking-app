import { readFileSync } from "node:fs";

import offNutritionJson from "@/fixtures/off-nutrition.json";
import type {
  NutritionBreakdown,
  NutritionMacros,
  NutritionRequirement,
  ResolvedNutritionRequirement,
} from "@/core/types";
import type {
  NutritionAttribution,
  NutritionSource,
} from "@/ports/NutritionSource";

interface OffProduct {
  readonly productName: string;
  readonly per100g: NutritionMacros;
}

interface OffSnapshot {
  readonly attribution: string;
  readonly products: Readonly<Record<string, OffProduct>>;
}

interface IngredientRow {
  readonly macros: NutritionMacros;
  readonly source: string;
}

const LIVSMEDELSVERKET_SOURCE = "Livsmedelsverket" as const;
const OFF_SOURCE = "Open Food Facts" as const;

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
      macros: { kcal: values[0], proteinG: values[1], carbsG: values[2], fatG: values[3] },
      source,
    });
  }
  return rows;
}

function scaleMacros(per100g: NutritionMacros, grams: number): NutritionMacros {
  const factor = grams / 100;
  return {
    kcal: per100g.kcal * factor,
    proteinG: per100g.proteinG * factor,
    carbsG: per100g.carbsG * factor,
    fatG: per100g.fatG * factor,
  };
}

function addMacros(total: NutritionMacros, next: NutritionMacros): NutritionMacros {
  return {
    kcal: total.kcal + next.kcal,
    proteinG: total.proteinG + next.proteinG,
    carbsG: total.carbsG + next.carbsG,
    fatG: total.fatG + next.fatG,
  };
}

export class FixtureNutritionSource implements NutritionSource {
  private readonly ingredients: Map<string, IngredientRow>;
  private readonly off: OffSnapshot;
  private readonly attributions: readonly NutritionAttribution[];

  constructor(
    off: OffSnapshot = offNutritionJson as OffSnapshot,
    ingredientCsv: string = readFileSync(
      new URL("../../fixtures/ingredient-nutrition.csv", import.meta.url),
      "utf8",
    ),
  ) {
    this.off = off;
    this.ingredients = parseIngredientTable(ingredientCsv);
    const ingredientAttribution = this.ingredients.values().next().value?.source;
    if (!ingredientAttribution) throw new Error("Ingredient nutrition fixture is empty");
    this.attributions = [
      { source: OFF_SOURCE, text: off.attribution },
      { source: LIVSMEDELSVERKET_SOURCE, text: ingredientAttribution },
    ];
  }

  async resolveRecipe(
    requirements: readonly NutritionRequirement[],
  ): Promise<NutritionBreakdown> {
    let coveredMassGrams = 0;
    let totalMassGrams = 0;
    let total: NutritionMacros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
    const resolved: ResolvedNutritionRequirement[] = [];

    for (const requirement of requirements) {
      if (!Number.isFinite(requirement.recipeGrams) || requirement.recipeGrams < 0) {
        throw new RangeError("recipeGrams must be a finite, non-negative number");
      }
      totalMassGrams += requirement.recipeGrams;
      const gtinProduct = requirement.gtin ? this.off.products[requirement.gtin] : undefined;
      const ingredient = this.ingredients.get(normalizeCanonicalName(requirement.canonicalName));
      const match = gtinProduct?.per100g ?? ingredient?.macros;

      if (!match) {
        resolved.push({ ...requirement, status: "unknown" });
        continue;
      }

      const macros = scaleMacros(match, requirement.recipeGrams);
      coveredMassGrams += requirement.recipeGrams;
      total = addMacros(total, macros);
      resolved.push({
        ...requirement,
        status: "covered",
        matchedBy: gtinProduct ? "gtin" : "canonical_name",
        macros,
      });
    }

    return {
      total,
      coverageRatio: totalMassGrams === 0 ? 0 : coveredMassGrams / totalMassGrams,
      coveredMassGrams,
      totalMassGrams,
      requirements: resolved,
    };
  }

  getAttributions(): readonly NutritionAttribution[] {
    return this.attributions;
  }
}
