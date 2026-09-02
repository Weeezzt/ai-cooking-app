import { describe, expect, it } from "vitest";

import {
  buildPlanView,
  budgetView,
  constraintRows,
  nutritionView,
  productSections,
  sekStringToOre,
  selectionReason,
  storeView,
} from "@/lib/planView";
import type { Ore } from "@/core/types";

import {
  INFEASIBLE_PLAN,
  OK_PLAN,
  OVER_BUDGET_PLAN,
  REQUEST,
  SINGLE_STORE_PLAN,
  SUPPRESSED_PLAN,
} from "../helpers/planFixtures";

/**
 * Every formatted string carries a non-breaking space before its unit
 * (`format.ts`, asserted in `format.test.ts`). Normalise it here so these
 * expectations stay readable, and assert the NBSP itself once, explicitly.
 */
const sv = (value: string | null | undefined) => value?.replace(/\u00a0/gu, " ");

describe("constraintRows (AD-5 taxonomy)", () => {
  const rows = constraintRows(OK_PLAN.constraints, {
    basket: OK_PLAN.basket,
    maxDistanceKm: REQUEST.maxDistanceKm,
  });

  it("maps verified passes to `pass`", () => {
    expect(rows.find((row) => row.id === "budget")?.tone).toBe("pass");
    expect(rows.find((row) => row.id === "portions")?.tone).toBe("pass");
  });

  it("never renders an estimated check as a hard pass", () => {
    const cook = rows.find((row) => row.id === "cook_time");
    expect(cook?.tone).toBe("estimate");
    expect(cook?.value).toContain("ca ");
    expect(cook?.value).toContain("uppskattning");
  });

  it("renders an unsupported check as a disclaimer, never a pass", () => {
    const allergy = rows.find((row) => row.id.startsWith("dietary:"));
    expect(allergy?.tone).toBe("disclaimer");
  });

  it("re-formats the distance row to sv-SE (the engine emits a decimal point)", () => {
    const distance = rows.find((row) => row.id === "distance");
    expect(distance?.value).toContain("2,4");
    expect(distance?.value).not.toContain("2.4");
  });

  it("marks a failed verified check as the only `fail`", () => {
    const failing = constraintRows(OVER_BUDGET_PLAN.constraints, {
      basket: OVER_BUDGET_PLAN.basket,
      maxDistanceKm: REQUEST.maxDistanceKm,
    });
    expect(failing.filter((row) => row.tone === "fail").map((row) => row.id)).toEqual([
      "budget",
    ]);
  });
});

describe("budgetView", () => {
  it("reports the remainder when within budget", () => {
    const view = budgetView({
      basket: OK_PLAN.basket,
      budgetOre: REQUEST.budgetOre,
      portions: 4,
      overshootOre: OK_PLAN.overshootOre,
      adjustments: [],
    });
    expect(view?.overBudget).toBe(false);
    expect(sv(view?.remainingLabel)).toBe("91,01 kr kvar");
    expect(view?.overshootLabel).toBeNull();
    expect(sv(view?.perPortionLabel)).toBe("52,25 kr/portion");
    expect(view?.headline).toBeNull();
  });

  it("states the overshoot honestly and keeps the audit trail", () => {
    const view = budgetView({
      basket: OVER_BUDGET_PLAN.basket,
      budgetOre: 6000 as Ore,
      portions: 4,
      overshootOre: OVER_BUDGET_PLAN.overshootOre,
      adjustments: OVER_BUDGET_PLAN.adjustments,
    });
    expect(view?.overBudget).toBe(true);
    expect(sv(view?.headline)).toBe("Billigaste giltiga korgen är 35,45 kr över budget.");
    expect(view?.overshootPct).toBeGreaterThan(0);
    expect(view?.audit).toHaveLength(2);
    expect(sv(view?.audit[0]?.delta)).toBe("−88,46 kr");
  });

  it("is absent without a basket", () => {
    expect(
      budgetView({
        basket: null,
        budgetOre: REQUEST.budgetOre,
        portions: 4,
        overshootOre: 0 as Ore,
        adjustments: [],
      }),
    ).toBeNull();
  });
});

describe("selectionReason", () => {
  it("claims 'bäst pris' only when price actually decided", () => {
    expect(
      selectionReason({
        chosenStoreKey: "a:1",
        entries: [
          { ...OK_PLAN.comparison!.entries[0], totalOre: 1000 as Ore, coverageRatio: 1, chosen: true },
          { ...OK_PLAN.comparison!.entries[1], totalOre: 2000 as Ore, coverageRatio: 1, chosen: false },
        ],
      }),
    ).toContain("bäst pris");
  });

  it("says coverage when coverage decided — the table would disprove a price claim", () => {
    expect(selectionReason(OK_PLAN.comparison)).toContain("bäst täckning");
  });

  it("never claims a comparison with a single viable store", () => {
    expect(selectionReason(SINGLE_STORE_PLAN.comparison)).toBe(
      "Närmaste butik med tillräcklig täckning.",
    );
  });
});

describe("storeView", () => {
  it("carries every candidate store with total, coverage and distance", () => {
    const view = storeView(OK_PLAN.basket, OK_PLAN.comparison);
    expect(view?.rows).toHaveLength(3);
    expect({ ...view!.rows[0], totalLabel: sv(view!.rows[0].totalLabel), coverageLabel: sv(view!.rows[0].coverageLabel), distanceLabel: sv(view!.rows[0].distanceLabel) }).toMatchObject({
      name: "Stora Coop Avion",
      totalLabel: "218,56 kr",
      coverageLabel: "100 %",
      distanceLabel: "2,4 km",
      chosen: true,
    });
    expect(view?.rows.filter((row) => row.chosen)).toHaveLength(1);
  });
});

describe("productSections", () => {
  const sections = productSections(OK_PLAN.basket, OVER_BUDGET_PLAN.adjustments);

  it("groups by the six SHOP sections, in walk order", () => {
    expect(sections.map((section) => section.section)).toEqual([
      "FRUKT & GRÖNT",
      "KÖTT & PROTEIN",
      "MEJERI",
    ]);
  });

  it("formats every number sv-SE and keeps recipe grams separate from the purchase", () => {
    const chicken = sections[1].rows[0];
    expect(sv(chicken.linePrice)).toBe("131,95 kr");
    expect(chicken.meta.map(sv)).toContain("65,97 kr/kg");
    expect(sv(chicken.unitPrice)).toBe("receptet: 320 g");
    // …and the separator really is the non-breaking space, not an ASCII one.
    expect(chicken.linePrice).toBe("131,95\u00a0kr");
  });

  it("flags a swapped product", () => {
    expect(sections[1].rows[0].swapped).toBe(true);
    expect(sections[0].rows[0].swapped).toBe(false);
  });
});

describe("nutritionView", () => {
  it("shows both per portion and total, and emphasises the requested macro", () => {
    const view = nutritionView(OK_PLAN.nutrition, {
      vibe: REQUEST.vibe,
      provenance: OK_PLAN.provenance,
    });
    expect(view?.suppressed).toBe(false);
    const protein = view?.rows.find((row) => row.label === "Protein");
    expect(sv(protein?.perPortion)).toBe("41,1 g");
    expect(sv(protein?.total)).toBe("164,4 g");
    expect(protein?.emphasised).toBe(true);
    expect(view?.rows.filter((row) => row.emphasised)).toHaveLength(1);
  });

  it("suppresses below the 0.7 coverage floor and says why", () => {
    const view = nutritionView(SUPPRESSED_PLAN.nutrition, {
      vibe: REQUEST.vibe,
      provenance: SUPPRESSED_PLAN.provenance,
    });
    expect(view?.suppressed).toBe(true);
    expect(sv(view?.footnote)).toBe(
      "Näringsvärde visas inte — data saknas för 69 % av korgen.",
    );
  });

  it("cites the data source", () => {
    const view = nutritionView(OK_PLAN.nutrition, {
      vibe: "",
      provenance: OK_PLAN.provenance,
    });
    expect(view?.source).toContain("Livsmedelsverket");
    expect(view?.rows.some((row) => row.emphasised)).toBe(false);
  });
});

describe("buildPlanView", () => {
  it("assembles the whole screen from an `ok` plan", () => {
    const view = buildPlanView(OK_PLAN, REQUEST);
    expect(view.recipeTitle).toBe("Krämig tomatpasta med vita bönor");
    expect(sv(view.rationale)).toBe("Klar på ca 20 min, 91,01 kr kvar av budgeten.");
    expect(view.stepPreview).toHaveLength(3);
    expect(view.priceSourceLabel).toContain("primat.nu");
  });

  it("degrades to empty blocks for `infeasible` without throwing", () => {
    const view = buildPlanView(INFEASIBLE_PLAN, REQUEST);
    expect(view.budget).toBeNull();
    expect(view.store).toBeNull();
    expect(view.nutrition).toBeNull();
    expect(view.sections).toEqual([]);
    expect(view.constraints).toEqual([]);
  });
});

describe("sekStringToOre", () => {
  it("parses both decimal separators, half-up", () => {
    expect(sekStringToOre("300")).toBe(30000);
    expect(sekStringToOre("149,90")).toBe(14990);
    expect(sekStringToOre("149.905")).toBe(14991);
    expect(sekStringToOre("")).toBe(0);
  });
});
