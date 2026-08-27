/**
 * Guard for the AI boundary (AD-6): no AI request/response schema may carry a key
 * that would leak a factual store value into the model call.
 *
 * TODO(issue #6): flesh this out to walk real schema shapes — zod schema `.shape`,
 * JSON Schema `properties`/`items`/`$defs`, `text.format` json_schema — not just a
 * plain nested object. For now it recursively scans plain object keys, which is
 * enough for a placeholder passing test.
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

function collectKeys(value: unknown, acc: Set<string>, seen: Set<object>): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, acc, seen);
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    acc.add(key);
    collectKeys(child, acc, seen);
  }
}

/**
 * Throws if `schema` contains any forbidden key (case-insensitive, exact key
 * match — not substring, so `priceLabel` is currently allowed; issue #6 decides
 * whether to tighten that).
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
