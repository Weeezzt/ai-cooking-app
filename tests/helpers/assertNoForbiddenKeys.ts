/**
 * Guard for the AI boundary (AD-6): no AI request/response schema may carry a key
 * that would leak a factual store value into the model call.
 *
 * Walks Zod object/array/union shapes and JSON Schema properties/items/$defs.
 */

/** From AD-6. Matched case-insensitively against each key. */
export const FORBIDDEN_KEYS: readonly string[] = [
  "price",
  "pris",
  "kr",
  "ore",
  "store",
  "butik",
  "retailer",
  "kcal",
  "kalori",
  "protein",
  "carb",
  "kolhydrat",
  "fat",
  "fett",
  "gtin",
  "distance",
  "avstånd",
  "stock",
  "lager",
];

type UnknownRecord = Record<string, unknown>;

function record(value: object): UnknownRecord {
  return value as UnknownRecord;
}

function collectKeys(value: unknown, acc: Set<string>, seen: Set<object>): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc, seen);
    return;
  }

  const candidate = record(value);

  // Zod v3/v4 expose object fields through `.shape` or `._def.shape`.
  const directShape = candidate.shape;
  const definition = candidate._def && typeof candidate._def === "object" ? record(candidate._def) : undefined;
  const shapeSource = directShape ?? definition?.shape;
  const shape = typeof shapeSource === "function" ? shapeSource() : shapeSource;
  if (shape && typeof shape === "object" && !Array.isArray(shape)) {
    for (const [key, child] of Object.entries(shape)) {
      acc.add(key);
      collectKeys(child, acc, seen);
    }
  }

  // JSON Schema: property names are data keys; definitions are containers.
  const properties = candidate.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    for (const [key, child] of Object.entries(properties)) {
      acc.add(key);
      collectKeys(child, acc, seen);
    }
  }
  for (const containerKey of ["items", "$defs", "definitions", "anyOf", "oneOf", "allOf"] as const) {
    collectKeys(candidate[containerKey], acc, seen);
  }

  // Zod wrappers/arrays/unions keep nested schemas in their definitions.
  if (definition) {
    for (const key of ["innerType", "element", "type", "options", "in", "out"] as const) {
      collectKeys(definition[key], acc, seen);
    }
  }

  // Plain schema-like objects and definition maps may nest arbitrarily.
  for (const [key, child] of Object.entries(candidate)) {
    acc.add(key);
    collectKeys(child, acc, seen);
  }
}

/**
 * Throws if `schema` contains any forbidden key (case-insensitive, exact key
 * match, as specified by AD-6.
 */
export function assertNoForbiddenKeys(schema: unknown): void {
  const keys = new Set<string>();
  collectKeys(schema, keys, new Set<object>());

  const forbidden = new Set(FORBIDDEN_KEYS.map((k) => k.toLowerCase()));
  const offenders = [...keys].filter((k) => forbidden.has(k.toLowerCase()));

  if (offenders.length > 0) {
    throw new Error(
      `AI schema contains forbidden key(s): ${offenders.sort().join(", ")} (AD-6)`,
    );
  }
}
