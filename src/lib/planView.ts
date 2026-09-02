/**
 * `PlanResult` → formatted view models for the PLAN result screen.
 *
 * This is the render edge. Every number is converted to `sv-SE` here exactly
 * once (`format.ts`), every piece of copy is chosen here, and the components in
 * `app/_components` render the result without knowing a thing about baskets,
 * öre, or constraint taxonomies (engineering-rules: "Business logic never lives
 * in a React component").
 *
 * Nothing here recomputes an engine decision. It reads what `runPlanPipeline`
 * already decided and says it in Swedish.
 */

import type {
  Basket,
  BasketAdjustment,
  ConstraintReport,
  NutritionBreakdown,
  Ore,
  PlanResult,
  Provenance,
  StoreComparison,
  StoreSection,
} from "@/core/types";

import { formatNumber, formatQuantity, formatSek } from "./format";
import { emphasisedMacro, type EmphasisedMacro } from "./vibe";

// ---------------------------------------------------------------------------
// Constraint verdict (AD-5)
// ---------------------------------------------------------------------------

/**
 * `pass` — verified and met. `fail` — verified and provably not met; the only
 * coloured thing on the screen. `estimate` — a model/heuristic value, shown with
 * `ca` and never a hard check. `disclaimer` — cannot be established from the
 * available data (allergens, diet guarantees); never rendered as a pass.
 */
export type ConstraintTone = "pass" | "fail" | "estimate" | "disclaimer";

export interface ConstraintRowView {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly tone: ConstraintTone;
}

function toneFor(status: string, evidence: string): ConstraintTone {
  if (status === "fail") return "fail";
  if (status === "disclaimer" || evidence === "unsupported") return "disclaimer";
  if (evidence === "estimated" || status === "unknown") return "estimate";
  return "pass";
}

/**
 * The distance detail the engine emits uses `toFixed(1)` — a decimal point, not
 * the Swedish comma. Rebuild that one row from the structured facts rather than
 * reformatting prose.
 */
function distanceValue(basket: Basket | null, maxDistanceKm: number): string | null {
  if (!basket) return null;
  return `${formatQuantity(basket.store.distanceKm, "km", 1)} (max ${formatQuantity(maxDistanceKm, "km", 1)})`;
}

export function constraintRows(
  report: ConstraintReport,
  context: { readonly basket: Basket | null; readonly maxDistanceKm: number },
): ConstraintRowView[] {
  return report.checks.map((check) => ({
    id: check.id,
    label: check.label,
    value:
      check.id === "distance"
        ? distanceValue(context.basket, context.maxDistanceKm) ?? check.detail
        : check.detail,
    tone: toneFor(check.status, check.evidence),
  }));
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export interface BudgetAuditItem {
  readonly text: string;
  readonly delta: string;
}

export interface BudgetView {
  readonly totalLabel: string;
  readonly budgetLabel: string;
  readonly perPortionLabel: string;
  /** `null` when over budget. */
  readonly remainingLabel: string | null;
  /** `null` unless over budget. */
  readonly overshootLabel: string | null;
  /** The honest over-budget headline (product-ux §3.3 rung 4). */
  readonly headline: string | null;
  readonly overBudget: boolean;
  /** Percent of the bar the basket fills (0–100). */
  readonly fillPct: number;
  /** Percent of the bar drawn as overshoot, in `--negative`. */
  readonly overshootPct: number;
  /** The repair ladder, shown as an audit trail — never silent (§3.3). */
  readonly audit: readonly BudgetAuditItem[];
}

const AUDIT_KINDS = new Set<BasketAdjustment["kind"]>([
  "substitute_cheaper",
  "remove_optional_garnish",
  "pantry_cap",
]);

export function budgetView(input: {
  readonly basket: Basket | null;
  readonly budgetOre: Ore;
  readonly portions: number;
  readonly overshootOre: Ore;
  readonly adjustments: readonly BasketAdjustment[];
}): BudgetView | null {
  if (!input.basket) return null;
  const total = input.basket.totalOre;
  const budget = input.budgetOre;
  const overBudget = total > budget;
  const remaining = (budget - total) as Ore;
  const overshoot = (total - budget) as Ore;
  const perPortion = input.portions > 0 ? Math.round(total / input.portions) : total;

  const denominator = Math.max(budget, total, 1);
  return {
    totalLabel: formatSek(total),
    budgetLabel: formatSek(budget),
    perPortionLabel: `${formatSek(perPortion)}/portion`,
    remainingLabel: overBudget ? null : `${formatSek(remaining)} kvar`,
    overshootLabel: overBudget ? `${formatSek(overshoot)} över budget` : null,
    headline: overBudget
      ? `Billigaste giltiga korgen är ${formatSek(input.overshootOre > 0 ? input.overshootOre : overshoot)} över budget.`
      : null,
    overBudget,
    fillPct: Math.round((Math.min(total, budget) / denominator) * 100),
    overshootPct: overBudget ? Math.round((overshoot / denominator) * 100) : 0,
    audit: input.adjustments
      .filter((adjustment) => AUDIT_KINDS.has(adjustment.kind))
      .map((adjustment) => ({
        text: adjustment.detail,
        delta:
          adjustment.deltaOre === 0
            ? ""
            : `${adjustment.deltaOre < 0 ? "−" : "+"}${formatSek(Math.abs(adjustment.deltaOre))}`,
      })),
  };
}

// ---------------------------------------------------------------------------
// Store + multi-store comparison
// ---------------------------------------------------------------------------

export interface StoreRowView {
  readonly key: string;
  readonly name: string;
  readonly totalLabel: string;
  readonly coverageLabel: string;
  readonly distanceLabel: string;
  readonly chosen: boolean;
}

export interface StoreView {
  readonly name: string;
  readonly distanceLabel: string;
  /** The stated selection reason. A silently chosen store is a trust hole. */
  readonly reason: string;
  readonly rows: readonly StoreRowView[];
}

export function storeView(
  basket: Basket | null,
  comparison: StoreComparison | null,
): StoreView | null {
  if (!basket) return null;
  const entries = comparison?.entries ?? [];
  const rows: StoreRowView[] = entries.map((entry) => ({
    key: `${entry.store.chain}:${entry.store.storeId}`,
    name: entry.store.name,
    totalLabel: formatSek(entry.totalOre),
    coverageLabel: `${formatNumber(Math.round(entry.coverageRatio * 100), 0)} %`,
    distanceLabel: formatQuantity(entry.distanceKm, "km", 1),
    chosen: entry.chosen,
  }));

  return {
    name: basket.store.name,
    distanceLabel: formatQuantity(basket.store.distanceKm, "km", 1),
    reason: selectionReason(comparison),
    rows,
  };
}

/**
 * The engine's objective is lexicographic: coverage, then cost, then distance
 * (`core/basket/compare.ts`). Name the rung that actually decided it — claiming
 * "bäst pris" when coverage decided would be a lie the comparison table itself
 * disproves.
 */
export function selectionReason(comparison: StoreComparison | null): string {
  const entries = comparison?.entries ?? [];
  if (entries.length <= 1) return "Närmaste butik med tillräcklig täckning.";

  const chosen = entries.find((entry) => entry.chosen) ?? entries[0];
  const best = Math.max(...entries.map((entry) => entry.coverageRatio));
  const tied = entries.filter((entry) => entry.coverageRatio === best);
  const count = `${entries.length} butiker`;

  if (tied.length === 1) return `${count} — vald för bäst täckning av din korg.`;
  if (tied.every((entry) => chosen.totalOre <= entry.totalOre)) {
    return `${count} — vald för bäst pris på din korg.`;
  }
  return `${count} — vald för kortast avstånd.`;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface ProductRowView {
  readonly id: string;
  readonly name: string;
  readonly meta: string[];
  readonly quantity: string;
  readonly linePrice: string;
  readonly unitPrice?: string;
  readonly swapped: boolean;
}

export interface ProductSectionView {
  readonly section: StoreSection;
  readonly subtotal: string;
  readonly rows: readonly ProductRowView[];
}

const SECTION_ORDER: readonly StoreSection[] = [
  "FRUKT & GRÖNT",
  "KÖTT & PROTEIN",
  "MEJERI",
  "TORRVAROR",
  "KRYDDOR",
  "ÖVRIGT",
];

const UNIT_LABEL: Record<string, string> = { g: "g", ml: "ml", st: "st" };

function comparisonPrice(priceOre: Ore, unit: "kg" | "l" | "st"): string {
  return formatSek(priceOre, { unit: `kr/${unit}` });
}

/**
 * Grouped by the same six store sections SHOP walks, so the PLAN → SHOP mapping
 * is 1:1 and learned once (product-ux §2.2 Block D).
 */
export function productSections(
  basket: Basket | null,
  adjustments: readonly BasketAdjustment[],
): ProductSectionView[] {
  if (!basket) return [];
  const swapped = new Set(
    adjustments.filter((a) => a.kind === "substitute_cheaper").map((a) => a.concept),
  );

  return SECTION_ORDER.flatMap((section) => {
    const lines = basket.lines.filter((line) => line.product.section === section);
    if (lines.length === 0) return [];
    const subtotal = lines.reduce((sum, line) => sum + line.purchase.priceOre, 0);
    return [
      {
        section,
        subtotal: formatSek(subtotal),
        rows: lines.map((line) => ({
          id: line.product.id,
          name: line.product.name,
          meta: [
            line.product.brand ?? "",
            formatQuantity(line.product.packageSize, UNIT_LABEL[line.product.packageUnit] ?? line.product.packageUnit, 0),
            comparisonPrice(line.product.comparison.priceOre, line.product.comparison.unit),
          ].filter(Boolean),
          quantity: line.purchase.variableWeight
            ? formatQuantity(line.purchase.purchasedGrams, "g", 0)
            : `${formatNumber(line.purchase.packs ?? 1, 0)} ×`,
          linePrice: formatSek(line.purchase.priceOre),
          unitPrice: `receptet: ${formatQuantity(line.recipeGrams, "g", 0)}`,
          swapped: swapped.has(line.concept),
        })),
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------------

export interface NutritionRowView {
  readonly label: string;
  readonly perPortion: string;
  readonly total: string;
  readonly referencePct?: number;
  readonly emphasised?: boolean;
}

export interface NutritionView {
  readonly suppressed: boolean;
  readonly energyPerPortion: string;
  readonly energyTotal: string;
  readonly energyKj: string;
  readonly rows: readonly NutritionRowView[];
  readonly coverageLabel: string;
  /** Set when suppressed — the honest replacement for the numbers. */
  readonly footnote: string | null;
  readonly source: string;
}

/** Daily reference intakes used only to scale the 4px bars — never as advice. */
const REFERENCE = { proteinG: 50, carbsG: 260, fatG: 70 } as const;

function macroKey(macro: EmphasisedMacro): keyof typeof REFERENCE | null {
  if (macro === "protein") return "proteinG";
  if (macro === "carbs") return "carbsG";
  if (macro === "fat") return "fatG";
  return null;
}

export function nutritionView(
  nutrition: NutritionBreakdown | null,
  input: { readonly vibe: string; readonly provenance: readonly Provenance[] },
): NutritionView | null {
  if (!nutrition) return null;
  const emphasis = macroKey(emphasisedMacro(input.vibe));
  const coveragePct = formatNumber(Math.round(nutrition.coverageRatio * 100), 0);
  const source = input.provenance.some((p) => p.source === "nutrition")
    ? "Livsmedelsverket + Open Food Facts, via produktdata"
    : "produktdata";

  const rows: NutritionRowView[] = (
    [
      ["Protein", "proteinG", "g"],
      ["Kolhydrater", "carbsG", "g"],
      ["Fett", "fatG", "g"],
    ] as const
  ).map(([label, key, unit]) => ({
    label,
    perPortion: formatQuantity(nutrition.perPortion[key], unit, 1),
    total: formatQuantity(nutrition.total[key], unit, 1),
    referencePct: Math.min(
      100,
      Math.round((nutrition.perPortion[key] / REFERENCE[key]) * 100),
    ),
    emphasised: emphasis === key,
  }));

  return {
    suppressed: nutrition.suppressed,
    energyPerPortion: formatQuantity(Math.round(nutrition.perPortion.kcal), "kcal", 0),
    energyTotal: formatQuantity(Math.round(nutrition.total.kcal), "kcal", 0),
    energyKj: formatQuantity(Math.round(nutrition.perPortion.kcal * 4.184), "kJ", 0),
    rows,
    coverageLabel: `Täckning ${coveragePct} %`,
    footnote: nutrition.suppressed
      ? `Näringsvärde visas inte — data saknas för ${formatNumber(Math.round((1 - nutrition.coverageRatio) * 100), 0)} % av korgen.`
      : "Näringsvärden är uppskattade utifrån produktdata och avser tillagad portion.",
    source,
  };
}

// ---------------------------------------------------------------------------
// The whole screen
// ---------------------------------------------------------------------------

export interface PlanViewRequest {
  readonly budgetOre: Ore;
  readonly portions: number;
  readonly maxDistanceKm: number;
  readonly vibe: string;
}

export interface PlanView {
  readonly constraints: readonly ConstraintRowView[];
  readonly budget: BudgetView | null;
  readonly store: StoreView | null;
  readonly sections: readonly ProductSectionView[];
  readonly nutrition: NutritionView | null;
  readonly recipeTitle: string | null;
  /** The interpretation echo — the user's own words, read back (§3.11). */
  readonly interpretation: string;
  /**
   * "Varför detta passar", assembled only from facts the plan actually carries:
   * the estimated cook time and the real budget delta. Never a claim the engine
   * did not make.
   */
  readonly rationale: string | null;
  readonly stepCount: number;
  readonly stepPreview: readonly string[];
  readonly cookTimeLabel: string | null;
  readonly priceSourceLabel: string;
}

const PREVIEW_CHARS = 72;

function truncate(text: string): string {
  return text.length <= PREVIEW_CHARS ? text : `${text.slice(0, PREVIEW_CHARS).trimEnd()}…`;
}

function rationaleFor(
  budget: BudgetView | null,
  cookMinutes: string | null,
): string | null {
  const parts: string[] = [];
  if (cookMinutes) parts.push(`klar på ${cookMinutes}`);
  if (budget?.remainingLabel) parts.push(`${budget.remainingLabel} av budgeten`);
  else if (budget?.overshootLabel) parts.push(`${budget.overshootLabel}`);
  return parts.length > 0
    ? `${parts.join(", ")}.`.replace(/^./, (c) => c.toUpperCase())
    : null;
}

/** `ca 20 min (önskemål max 30 min, uppskattning)` → `ca 20 min`. */
function shortCookTime(detail: string | null | undefined): string | null {
  if (!detail) return null;
  return detail.replace(/\s*\(.*\)\s*$/u, "").trim() || null;
}

export function buildPlanView(plan: PlanResult, request: PlanViewRequest): PlanView {
  const cookCheck = plan.constraints.checks.find((check) => check.id === "cook_time");
  const priceProvenance = plan.provenance.find((p) => p.source === "primat");
  const budget = budgetView({
    basket: plan.basket,
    budgetOre: request.budgetOre,
    portions: request.portions,
    overshootOre: plan.overshootOre,
    adjustments: plan.adjustments,
  });

  return {
    constraints: constraintRows(plan.constraints, {
      basket: plan.basket,
      maxDistanceKm: request.maxDistanceKm,
    }),
    budget,
    store: storeView(plan.basket, plan.comparison),
    sections: productSections(plan.basket, plan.adjustments),
    nutrition: nutritionView(plan.nutrition, {
      vibe: request.vibe,
      provenance: plan.provenance,
    }),
    recipeTitle: plan.recipe?.title ?? null,
    interpretation: request.vibe.trim(),
    rationale: rationaleFor(budget, shortCookTime(cookCheck?.detail)),
    stepCount: plan.recipe?.steps.length ?? 0,
    stepPreview: (plan.recipe?.steps ?? []).slice(0, 3).map((step) => truncate(step.text)),
    cookTimeLabel: cookCheck?.detail ?? null,
    priceSourceLabel: priceProvenance
      ? `Prisdata från primat.nu · ${priceProvenance.priceType === "regular" ? "ordinarie pris" : "pris"}`
      : "Prisdata från primat.nu",
  };
}

/** SEK decimal string (as the form submits it) → integer öre, half-up. */
export function sekStringToOre(value: string): Ore {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return (Number.isFinite(parsed) ? Math.round(parsed * 100) : 0) as Ore;
}
