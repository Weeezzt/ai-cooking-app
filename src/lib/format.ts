/**
 * Swedish number formatting (`sv-SE`).
 *
 * House rules (visual-direction §2.2):
 *  - decimal comma
 *  - space as thousands separator, normalised to a non-breaking space
 *  - a non-breaking space before the unit — `1 249,50 kr`, `129,50 kr/kg`,
 *    `450 g`, `2,5 dl`, `18 min`
 *
 * The engine works in integer öre (`engineering-rules` "Money & numbers"); SEK is
 * only ever formatted for display, here, at the render edge.
 */

const NBSP = " ";

/** Collapse every space-like separator ICU may emit (U+0020, U+00A0, U+202F). */
function normalizeSpaces(input: string): string {
  return input.replace(/\s+/gu, NBSP);
}

function formatDecimal(
  value: number,
  minFractionDigits: number,
  maxFractionDigits: number,
): string {
  return normalizeSpaces(
    new Intl.NumberFormat("sv-SE", {
      minimumFractionDigits: minFractionDigits,
      maximumFractionDigits: maxFractionDigits,
    }).format(value),
  );
}

export interface FormatSekOptions {
  /**
   * Force decimals on/off. Default: show `,00` only when the amount is not a
   * whole krona (`450,00 kr` reads as machine output; `129,50 kr` needs it).
   */
  decimals?: boolean;
  /** Unit suffix. Default `kr`. Pass `kr/kg`, `kr/st`, … for unit prices. */
  unit?: string;
}

/** Öre → `1 249,50 kr`. */
export function formatSek(ore: number, options: FormatSekOptions = {}): string {
  const kronor = ore / 100;
  const showDecimals = options.decimals ?? !Number.isInteger(kronor);
  const digits = showDecimals ? 2 : 0;
  const unit = options.unit ?? "kr";
  return `${formatDecimal(kronor, digits, digits)}${NBSP}${unit}`;
}

/** `(450, "g")` → `450 g`; `(2.5, "dl")` → `2,5 dl`; `(18, "min")` → `18 min`. */
export function formatQuantity(
  value: number,
  unit: string,
  maxFractionDigits = 2,
): string {
  return `${formatDecimal(value, 0, maxFractionDigits)}${NBSP}${unit}`;
}

/** Bare Swedish number, no unit — `1 249,5`. */
export function formatNumber(value: number, maxFractionDigits = 2): string {
  return formatDecimal(value, 0, maxFractionDigits);
}
