/**
 * `PlanResult` → formatted view models for the SHOP screen.
 *
 * The render edge for HANDLA, mirroring `planView.ts`: every number is turned
 * into `sv-SE` here exactly once (`format.ts`), every piece of copy is chosen
 * here, and `app/_components/ShopScreen` renders the result without knowing a
 * thing about baskets, öre, or store sections (engineering-rules: "Business
 * logic never lives in a React component").
 *
 * Nothing here recomputes an engine decision. The basket, its totals and the
 * pantry caps were all decided by `runPlanPipeline`; this only groups the lines
 * into the six store sections SHOP walks and says the rest in Swedish.
 *
 * The running total is deliberately *not* precomputed — it depends on which
 * rows the user has checked, which is UI state. `shopTally` derives it from the
 * checked-id set on every toggle.
 */

import type {
  Basket,
  BasketAdjustment,
  BasketLine,
  PlanResult,
  StoreSection,
} from "@/core/types";

import { formatNumber, formatQuantity, formatSek } from "./format";

/** Physical store-walk order (product-ux §1.6), never alphabetical. */
const SECTION_ORDER: readonly StoreSection[] = [
  "FRUKT & GRÖNT",
  "KÖTT & PROTEIN",
  "MEJERI",
  "TORRVAROR",
  "KRYDDOR",
  "ÖVRIGT",
];

const UNIT_LABEL: Record<string, string> = { g: "g", ml: "ml", st: "st" };

/** `null` / unknown → ÖVRIGT (AD-9 category normalizer contract). */
function sectionOf(section: StoreSection | null | undefined): StoreSection {
  return section && SECTION_ORDER.includes(section) ? section : "ÖVRIGT";
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface ShopRowView {
  readonly id: string;
  readonly name: string;
  /** Quantity numeral for the shelf-label stack. */
  readonly quantity: string;
  /** Unit under the numeral — `PKT`, `G`, `ML`. */
  readonly unit: string;
  /** Mono metadata segments — brand, package size, surplus. */
  readonly meta: string[];
  /** Line price, `sv-SE`. */
  readonly price: string;
  /** Line price in öre — the running-total math reads this, never the string. */
  readonly priceOre: number;
}

export interface ShopSectionView {
  readonly section: StoreSection;
  readonly count: number;
  /** Right-aligned figure on the inverted bar — `4 ST`. */
  readonly countLabel: string;
  readonly rows: readonly ShopRowView[];
}

export interface PantryRowView {
  readonly id: string;
  readonly name: string;
  readonly note: string;
}

/** The shelf-label numeral + unit: purchased weight, or the pack count. */
function shelfLabel(line: BasketLine): { quantity: string; unit: string } {
  if (line.purchase.variableWeight) {
    const unit = line.purchase.unit ?? "g";
    return {
      quantity: formatNumber(line.purchase.purchasedGrams, 0),
      unit: (UNIT_LABEL[unit] ?? unit).toUpperCase(),
    };
  }
  return { quantity: formatNumber(line.purchase.packs ?? 1, 0), unit: "PKT" };
}

/** Brand · package size · surplus (surplus only when there actually is some). */
function rowMeta(line: BasketLine): string[] {
  const size = formatQuantity(
    line.product.packageSize,
    UNIT_LABEL[line.product.packageUnit] ?? line.product.packageUnit,
    0,
  );
  const over = line.purchase.purchasedGrams - line.recipeGrams;
  const surplus = over > 0 ? `${formatQuantity(over, "g", 0)} över` : "";
  return [line.product.brand ?? "", size, surplus].filter(Boolean);
}

export function shopSections(basket: Basket): ShopSectionView[] {
  return SECTION_ORDER.flatMap((section) => {
    const lines = basket.lines.filter((line) => sectionOf(line.product.section) === section);
    if (lines.length === 0) return [];
    return [
      {
        section,
        count: lines.length,
        countLabel: `${formatNumber(lines.length, 0)} ST`,
        rows: lines.map((line) => {
          const { quantity, unit } = shelfLabel(line);
          return {
            id: line.product.id,
            name: line.product.name,
            quantity,
            unit,
            meta: rowMeta(line),
            price: formatSek(line.purchase.priceOre),
            priceOre: line.purchase.priceOre,
          };
        }),
      },
    ];
  });
}

/**
 * `pantry_cap` adjustments name the staples the user already had at home; the
 * engine removed those lines from the basket. They render as a separate
 * pre-checked section, excluded from the total and the progress denominator
 * (product-ux §3.10).
 */
export function pantrySection(adjustments: readonly BasketAdjustment[]): PantryRowView[] {
  return adjustments
    .filter((adjustment) => adjustment.kind === "pantry_cap")
    .map((adjustment) => ({
      id: `pantry:${adjustment.concept}`,
      name: adjustment.concept.charAt(0).toUpperCase() + adjustment.concept.slice(1),
      note: "Räknas inte in i priset",
    }));
}

// ---------------------------------------------------------------------------
// The whole screen
// ---------------------------------------------------------------------------

export interface ShopView {
  readonly storeName: string;
  readonly storeMeta: string[];
  readonly sections: readonly ShopSectionView[];
  readonly pantry: readonly PantryRowView[];
  /** Non-pantry item count — the progress and running-total denominator. */
  readonly buyableCount: number;
  readonly totalOre: number;
  /** The plan total, always with decimals — it is the receipt denominator. */
  readonly totalLabel: string;
  readonly priceSourceLabel: string;
  readonly isDemo: boolean;
}

export function shopView(
  plan: PlanResult,
  status: { readonly isDemoData: boolean },
): ShopView | null {
  if (!plan.basket) return null;

  const sections = shopSections(plan.basket);
  const buyableCount = sections.reduce((sum, section) => sum + section.rows.length, 0);

  return {
    storeName: plan.basket.store.name,
    storeMeta: [
      `${formatNumber(buyableCount, 0)} varor`,
      `ca ${formatQuantity(plan.basket.store.distanceKm, "km", 1)}`,
    ],
    sections,
    pantry: pantrySection(plan.adjustments),
    buyableCount,
    totalOre: plan.basket.totalOre,
    totalLabel: formatSek(plan.basket.totalOre, { decimals: true }),
    priceSourceLabel: "Prisdata från primat.nu",
    isDemo: status.isDemoData,
  };
}

// ---------------------------------------------------------------------------
// Running total + progress (derived from checked UI state on every toggle)
// ---------------------------------------------------------------------------

export interface ShopTally {
  readonly checkedCount: number;
  readonly buyableCount: number;
  /** `3 av 8 varor` — pantry never in the denominator. */
  readonly progressLabel: string;
  /** 0–100, by item count. */
  readonly pct: number;
  readonly checkedOre: number;
  /** Checked-items total — `128,50 kr`. */
  readonly checkedLabel: string;
  /** The climbing figure with its denominator — `128,50 kr av 237,00 kr`. */
  readonly runningLabel: string;
  /** `108,50 kr kvar`. */
  readonly remainingLabel: string;
  /** Every non-pantry item checked. */
  readonly complete: boolean;
}

export function shopTally(view: ShopView, checkedIds: readonly string[]): ShopTally {
  const checked = new Set(checkedIds);
  let checkedOre = 0;
  let checkedCount = 0;

  for (const section of view.sections) {
    for (const row of section.rows) {
      if (checked.has(row.id)) {
        checkedOre += row.priceOre;
        checkedCount += 1;
      }
    }
  }

  const denominator = Math.max(view.buyableCount, 1);

  return {
    checkedCount,
    buyableCount: view.buyableCount,
    progressLabel: `${formatNumber(checkedCount, 0)} av ${formatNumber(view.buyableCount, 0)} varor`,
    pct: Math.round((checkedCount / denominator) * 100),
    checkedOre,
    checkedLabel: formatSek(checkedOre, { decimals: true }),
    runningLabel: `${formatSek(checkedOre, { decimals: true })} av ${formatSek(view.totalOre, { decimals: true })}`,
    remainingLabel: `${formatSek(Math.max(view.totalOre - checkedOre, 0), { decimals: true })} kvar`,
    complete: view.buyableCount > 0 && checkedCount === view.buyableCount,
  };
}
