import { describe, expect, it } from "vitest";

import { pantrySection, shopSections, shopTally, shopView } from "@/lib/shopView";
import type { BasketLine, Ore, PlanResult, StoreSection } from "@/core/types";

import { INFEASIBLE_PLAN, OK_PLAN, OVER_BUDGET_PLAN } from "../helpers/planFixtures";

const ore = (value: number) => value as Ore;
const sv = (value: string | null | undefined) => value?.replace(/\u00a0/gu, " ");

const STATUS = { isDemoData: false };
const DEMO_STATUS = { isDemoData: true };

/** OK_PLAN plus two pantry caps — the staples the user already had at home. */
const PANTRY_PLAN: PlanResult = {
  ...OK_PLAN,
  adjustments: [
    { kind: "pantry_cap", concept: "olivolja", deltaOre: ore(-3295), detail: '"har olja" täcker 30 g olivolja (tak 300 g) — borttagen från inköpslistan' },
    { kind: "pantry_cap", concept: "salt", deltaOre: ore(-1995), detail: '"salt" täcker 5 g salt (tak 100 g) — borttagen från inköpslistan' },
  ],
};

describe("shopView", () => {
  it("returns null without a basket (the no-plan / infeasible state)", () => {
    expect(shopView(INFEASIBLE_PLAN, STATUS)).toBeNull();
  });

  it("groups the basket into store-walk sections, omitting the empty ones", () => {
    const view = shopView(OK_PLAN, STATUS)!;
    expect(view.sections.map((section) => section.section)).toEqual([
      "FRUKT & GRÖNT",
      "KÖTT & PROTEIN",
      "MEJERI",
    ]);
    expect(view.sections.every((section) => section.rows.length > 0)).toBe(true);
  });

  it("counts only buy rows toward buyableCount — pantry is separate", () => {
    const view = shopView(PANTRY_PLAN, STATUS)!;
    expect(view.buyableCount).toBe(3);
    expect(view.pantry.map((row) => row.name)).toEqual(["Olivolja", "Salt"]);
    expect(view.pantry.every((row) => row.note === "Räknas inte in i priset")).toBe(true);
  });

  it("formats the plan total with decimals and cites primat.nu", () => {
    const view = shopView(OK_PLAN, STATUS)!;
    expect(sv(view.totalLabel)).toBe("208,99 kr");
    expect(view.priceSourceLabel).toBe("Prisdata från primat.nu");
  });

  it("carries the demo flag through to the badge", () => {
    expect(shopView(OK_PLAN, DEMO_STATUS)!.isDemo).toBe(true);
    expect(shopView(OK_PLAN, STATUS)!.isDemo).toBe(false);
  });

  it("builds a shelf-label stack and a mono metadata line per row", () => {
    const view = shopView(OK_PLAN, STATUS)!;
    const tomato = view.sections[0].rows[0];
    expect(tomato.name).toBe("Körsbärstomater");
    expect(tomato.unit).toBe("PKT");
    expect(sv(tomato.price)).toBe("22,24 kr");
    expect(tomato.meta.map(sv)).toContain("Mutti");
  });
});

describe("shopSections — unknown section falls back to ÖVRIGT", () => {
  it("routes a null / unrecognised section to ÖVRIGT", () => {
    const rogue = {
      ...OK_PLAN.basket!.lines[0],
      product: { ...OK_PLAN.basket!.lines[0].product, id: "rogue-1", section: null as unknown as StoreSection },
    } as BasketLine;
    const sections = shopSections({ ...OK_PLAN.basket!, lines: [rogue] });
    expect(sections.map((section) => section.section)).toEqual(["ÖVRIGT"]);
  });
});

describe("pantrySection", () => {
  it("only picks up pantry_cap adjustments", () => {
    const rows = pantrySection(OVER_BUDGET_PLAN.adjustments);
    expect(rows).toEqual([]);
  });
});

describe("shopTally — running total counts only checked rows", () => {
  const view = shopView(OK_PLAN, STATUS)!;
  const ids = view.sections.flatMap((section) => section.rows.map((row) => row.id));

  it("is zero with nothing checked", () => {
    const tally = shopTally(view, []);
    expect(tally.checkedOre).toBe(0);
    expect(sv(tally.progressLabel)).toBe("0 av 3 varor");
    expect(sv(tally.runningLabel)).toBe("0,00 kr av 208,99 kr");
    expect(tally.pct).toBe(0);
    expect(tally.complete).toBe(false);
  });

  it("sums only the checked line prices, climbing toward the plan total", () => {
    const tally = shopTally(view, [ids[0]]);
    // first row is Körsbärstomater at 22,24 kr
    expect(sv(tally.checkedLabel)).toBe("22,24 kr");
    expect(sv(tally.progressLabel)).toBe("1 av 3 varor");
    expect(tally.pct).toBe(33);
  });

  it("is complete once every buy row is checked (pantry never required)", () => {
    const withPantry = shopView(PANTRY_PLAN, STATUS)!;
    const buyIds = withPantry.sections.flatMap((s) => s.rows.map((r) => r.id));
    const tally = shopTally(withPantry, [...buyIds, "pantry:olivolja"]);
    expect(tally.complete).toBe(true);
    expect(tally.checkedCount).toBe(3);
    expect(sv(tally.remainingLabel)).toBe("0,00 kr kvar");
  });

  it("ignores pantry ids in the total and the denominator", () => {
    const withPantry = shopView(PANTRY_PLAN, STATUS)!;
    const tally = shopTally(withPantry, ["pantry:olivolja", "pantry:salt"]);
    expect(tally.checkedOre).toBe(0);
    expect(tally.buyableCount).toBe(3);
  });
});
