/**
 * Integer-öre money (AD-4). SEK floats exist only at this formatting/parsing
 * boundary; everything else in the engine passes `Ore`.
 *
 * Rounding rule: **half-up = round half away from zero** (Java `RoundingMode.HALF_UP`).
 * All money amounts in this app are non-negative, so this is also "round half toward
 * +∞" in practice. The rule is applied once, here and in `units.ts`, and nowhere else.
 */

import type { Ore } from "./types";

/** Round half away from zero. `2.5 → 3`, `-2.5 → -3`, `2.4999 → 2`. */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`roundHalfUp: non-finite value ${value}`);
  }
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Brand a known-integer number as `Ore`. Throws on non-integers. */
export function ore(value: number): Ore {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`ore(): expected an integer öre amount, got ${value}`);
  }
  return value as Ore;
}

/** `0` öre. */
export const ZERO_ORE: Ore = ore(0);

export function addOre(a: Ore, b: Ore): Ore {
  return ore(a + b);
}

export function subOre(a: Ore, b: Ore): Ore {
  return ore(a - b);
}

/** Multiply öre by a non-negative integer count (e.g. pack multiples). */
export function mulOre(amount: Ore, count: number): Ore {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(`mulOre(): count must be a non-negative integer, got ${count}`);
  }
  return ore(amount * count);
}

/** Scale öre by an arbitrary factor, rounding half-up back to whole öre. */
export function scaleOre(amount: Ore, factor: number): Ore {
  return ore(roundHalfUp(amount * factor));
}

export function sumOre(amounts: readonly Ore[]): Ore {
  return ore(amounts.reduce((acc, cur) => acc + cur, 0));
}

/** `a - b` clamped at `0` (budget remaining never goes negative). */
export function clampSubOre(a: Ore, b: Ore): Ore {
  return ore(Math.max(0, a - b));
}

/**
 * Parse a SEK decimal string to öre, rounding half-up. Accepts `,` or `.` as the
 * decimal separator, an optional `kr`/`SEK` suffix, and thin/regular spaces as
 * thousands separators. Rejects anything else.
 */
export function parseSekToOre(input: string): Ore {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[\s\u00a0\u202f]/gu, "")
    .replace(/kr$|sek$/i, "");

  const match = /^(-?)(\d+)(?:[.,](\d+))?$/.exec(cleaned);
  if (!match) {
    throw new RangeError(`parseSekToOre(): not a SEK amount: ${JSON.stringify(input)}`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const kronor = Number.parseInt(match[2], 10);
  if (!Number.isSafeInteger(kronor)) {
    throw new RangeError("parseSekToOre(): amount exceeds safe integer range");
  }
  // Pad to at least 3 fraction digits: 2 for öre + 1 rounding digit. Digits
  // beyond the third never change a half-up decision for a positive amount.
  const fraction = (match[3] ?? "").padEnd(3, "0");
  let magnitude = kronor * 100 + Number.parseInt(fraction.slice(0, 2), 10);
  if (Number.parseInt(fraction[2], 10) >= 5) {
    magnitude += 1;
  }
  if (!Number.isSafeInteger(magnitude)) {
    throw new RangeError("parseSekToOre(): amount exceeds safe integer öre range");
  }
  return ore(sign * magnitude);
}

/** Öre as an unrounded SEK number. Only for the formatting boundary. */
export function oreToSek(amount: Ore): number {
  return amount / 100;
}

const SEK_FORMAT = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format öre as a sv-SE currency string, e.g. `149,90 kr`. */
export function formatOre(amount: Ore): string {
  return SEK_FORMAT.format(oreToSek(amount));
}
