/**
 * PLAN screen render tests.
 *
 * Components are rendered to static markup with `react-dom/server` — no DOM
 * environment and no new dependency. Everything the PLAN screen renders is a
 * pure function of props, which is what makes this possible and is the pattern
 * SHOP (#9) and COOK (#10) inherit.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConstraintTable } from "@/app/_components/ConstraintTable";
import { DecisionScreen } from "@/app/_components/DecisionScreen";
import { NarratedPipeline } from "@/app/_components/NarratedPipeline";
import { PlanForm } from "@/app/_components/PlanForm";
import { PlanResultView } from "@/app/_components/PlanResultView";
import { DEFAULT_FORM_VALUES } from "@/lib/planForm";
import { buildPlanView } from "@/lib/planView";

import {
  INFEASIBLE_PLAN,
  OK_PLAN,
  OVER_BUDGET_PLAN,
  REQUEST,
  SINGLE_STORE_PLAN,
  SUPPRESSED_PLAN,
} from "../helpers/planFixtures";

/** Collapse NBSP + entities so assertions read like the rendered page. */
function text(markup: string): string {
  return markup
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x27;|&#39;/gu, "'")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#x2F;/gu, "/")
    .replace(/[ \s]+/gu, " ")
    .trim();
}

const render = (node: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(node);

describe("PlanResultView · ok", () => {
  const markup = render(
    <PlanResultView view={buildPlanView(OK_PLAN, REQUEST)} demo allergyDisclaimer />,
  );
  const body = text(markup);

  it("renders the six blocks in the mandated reading order", () => {
    // verdict → budget → store → products → recipe → nutrition
    const order = [
      "constraint-table",
      "budget__bar",
      "comparison__row",
      "product-line",
      "result__steps",
      'class="nutrition"',
    ].map((marker) => markup.indexOf(marker));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("puts the constraint verdict above the budget block", () => {
    expect(body.indexOf("Villkor")).toBeLessThan(body.indexOf("218,56"));
  });

  it("renders the constraint table as a mono table, not chips", () => {
    expect(markup).toContain('class="constraint-table t-meta"');
    expect(markup).toContain("constraint-table__row--pass");
    expect(markup).toContain("constraint-table__row--estimate");
    expect(markup).toContain("constraint-table__row--disclaimer");
  });

  it("shows the cook-time estimate as `ca … (uppskattning)`, never a hard pass", () => {
    expect(body).toContain("ca 20 min (önskemål max 30 min, uppskattning)");
  });

  it("never marks an unsupported allergy check as a pass", () => {
    const allergyRow = markup
      .split("<tr")
      .find((row) => row.includes("Allergi angiven i fritext"));
    expect(allergyRow).toContain("constraint-table__row--disclaimer");
    expect(allergyRow).not.toContain("uppfyllt");
  });

  it("renders the budget with the remainder and the per-portion figure", () => {
    expect(body).toContain("208,99 kr");
    expect(body).toContain("91,01 kr kvar");
    expect(body).toContain("52,25 kr/portion");
  });

  it("renders the multi-store comparison with every candidate and one chosen", () => {
    expect(body).toContain("3 butiker");
    expect(body).toContain("Stora Coop Avion");
    expect(body).toContain("Maxi ICA Stormarknad Umeå");
    expect(body).toContain("Willys Umeå Syd");
    expect(markup.match(/comparison__row--chosen/gu)).toHaveLength(1);
    expect(body).toContain("218,56 kr");
    expect(body).toContain("140,04 kr");
  });

  it("renders product rows with the mono metadata line and a numeric column", () => {
    expect(markup).toContain("product-line__name");
    expect(markup).toContain("meta-line");
    expect(markup).toContain("numeric-column");
    expect(body).toContain("65,97 kr/kg");
    expect(body).toContain("131,95 kr");
  });

  it("shows both per-portion and total nutrition and one accent macro bar", () => {
    expect(body).toContain("Per portion");
    expect(body).toContain("Totalt");
    expect(body).toContain("41,1 g");
    expect(body).toContain("164,4 g");
    expect(markup.match(/nutrition__bar-fill--accent/gu)).toHaveLength(1);
  });

  it("cites the data sources", () => {
    expect(body).toContain("Prisdata från primat.nu");
    expect(body).toContain("Livsmedelsverket");
  });

  it("carries the persistent demo badge and the allergy disclaimer", () => {
    expect(body).toContain("Demoläge");
    expect(body).toContain("Vi kan inte garantera allergiinformation");
  });

  it("uses no forbidden radius, gradient or emoji-as-icon", () => {
    expect(markup).not.toMatch(/9999px|border-radius:\s*(?!0|2px|50%)/u);
    expect(markup).not.toContain("linear-gradient");
    expect(markup).not.toContain("box-shadow");
  });
});

describe("PlanResultView · over_budget", () => {
  const markup = render(
    <PlanResultView
      view={buildPlanView(OVER_BUDGET_PLAN, { ...REQUEST, budgetOre: 6000 as never })}
    />,
  );
  const body = text(markup);

  it("states the overshoot honestly with the product-ux copy", () => {
    expect(body).toContain("Billigaste giltiga korgen är 35,45 kr över budget.");
  });

  it("colours only the failed budget row", () => {
    expect(markup.match(/constraint-table__row--fail/gu)).toHaveLength(1);
  });

  it("draws an overshoot segment on the budget bar", () => {
    expect(markup).toContain("budget__over");
    expect(markup).toContain("budget__delta--over");
  });

  it("shows the repair audit — never a silent substitution", () => {
    expect(body).toContain("Vad vi bytte");
    expect(body).toContain("Byte: Kycklingbröstfilé mörad → Krämig Kycklinggryta");
    expect(body).toContain("−88,46 kr");
  });

  it("flags the swapped product line", () => {
    expect(markup).toContain("product-line__name--swapped");
    expect(body).toContain("BYTT");
  });
});

describe("PlanResultView · nutrition suppressed", () => {
  const markup = render(<PlanResultView view={buildPlanView(SUPPRESSED_PLAN, REQUEST)} />);
  const body = text(markup);

  it("suppresses the per-portion macros and says why", () => {
    expect(body).toContain("Näringsvärde visas inte — data saknas för 69 % av korgen.");
    expect(body).not.toContain("41,1 g");
  });

  it("draws no reference bars when the numbers are withheld", () => {
    expect(markup).not.toContain("nutrition__bar-fill");
  });
});

describe("PlanResultView · single viable store", () => {
  it("never claims a price comparison it cannot back up", () => {
    const body = text(render(<PlanResultView view={buildPlanView(SINGLE_STORE_PLAN, REQUEST)} />));
    expect(body).toContain("Närmaste butik med tillräcklig täckning.");
    expect(body).not.toContain("bäst pris");
  });
});

describe("DecisionScreen · infeasible", () => {
  const markup = render(
    <DecisionScreen
      eyebrow="Inget förslag"
      title="Ingen fullsortimentsbutik inom räckhåll"
      body={<p>Vi hittade ingen fullsortimentsbutik inom 5,0 km. Anledning: {INFEASIBLE_PLAN.reason}.</p>}
      actions={<button type="button">Utöka till 10 km</button>}
    />,
  );

  it("names what failed and offers a choice — never an automatic widening", () => {
    const body = text(markup);
    expect(body).toContain("Ingen fullsortimentsbutik inom räckhåll");
    expect(body).toContain("no_store_in_range");
    expect(body).toContain("Utöka till 10 km");
  });

  it("renders no basket, budget or nutrition for an infeasible plan", () => {
    const view = buildPlanView(INFEASIBLE_PLAN, REQUEST);
    const resultMarkup = render(<PlanResultView view={view} />);
    expect(resultMarkup).not.toContain("budget__bar");
    expect(resultMarkup).not.toContain("nutrition");
    expect(resultMarkup).not.toContain("comparison__row");
  });
});

describe("NarratedPipeline", () => {
  const stages = [
    { label: "Tolkar din önskan" },
    { label: "Hittar butiker nära dig", detail: "Stora Coop Avion" },
    { label: "Väljer varor" },
    { label: "Skapar receptet" },
  ];

  it("narrates activity as a stepped sequence, not a percentage", () => {
    const markup = render(<NarratedPipeline stages={stages} activeIndex={2} />);
    expect(markup).not.toContain("role=\"progressbar\"");
    expect(markup).not.toContain("aria-valuenow");
    // While generating (not `done`), no stage is marked verified-complete —
    // the single POST gives no per-stage evidence. Passed/current stages are
    // "active", not "done".
    expect(markup).not.toContain("pipeline__segment--done");
    expect(markup.match(/pipeline__segment--active/gu)).toHaveLength(3);
    expect(markup).toContain("pipeline__row--active");
  });

  it("marks every stage complete only once the result has arrived", () => {
    const markup = render(<NarratedPipeline stages={stages} activeIndex={3} done />);
    expect(markup.match(/pipeline__segment--done/gu)).toHaveLength(4);
  });

  it("reveals the store name as a stage detail", () => {
    const body = text(render(<NarratedPipeline stages={stages} activeIndex={2} />));
    expect(body).toContain("Hittar butiker nära dig Stora Coop Avion");
  });

  it("marks every stage done once the plan has arrived", () => {
    const markup = render(<NarratedPipeline stages={stages} activeIndex={3} done />);
    expect(markup.match(/pipeline__segment--done/gu)).toHaveLength(4);
    expect(markup).toContain('aria-busy="false"');
  });
});

describe("ConstraintTable", () => {
  it("gives each AD-5 class its own mark and never a check for a disclaimer", () => {
    const markup = render(
      <ConstraintTable
        rows={[
          { label: "Budget", value: "382 / 400 kr", tone: "pass" },
          { label: "Tid", value: "ca 28 min", tone: "estimate" },
          { label: "Portioner", value: "3 av 4", tone: "fail" },
          { label: "Glutenfri", value: "kan inte verifieras", tone: "disclaimer" },
        ]}
      />,
    );
    expect(markup).toContain("✓");
    expect(markup).toContain("≈");
    expect(markup).toContain("✕");
    expect(markup).toContain("kan inte verifieras");
    const disclaimerRow = markup.split("<tr").find((row) => row.includes("Glutenfri"));
    expect(disclaimerRow).not.toContain("✓");
  });
});

describe("PlanForm", () => {
  const markup = render(<PlanForm values={DEFAULT_FORM_VALUES} onChange={() => {}} demoLocation />);

  it("uses rule-bounded selector strips and a stepper, never pills", () => {
    expect(markup).toContain("selector-strip__cell");
    expect(markup).toContain("stepper__btn");
    expect(markup).not.toContain("9999px");
    expect(markup).not.toMatch(/border-radius:\s*(?!0|2px|50%)/u);
  });

  it("offers the structured controls the engine actually checks", () => {
    const body = text(markup);
    for (const label of [
      "Budget (totalt)",
      "Portioner",
      "Max tillagningstid",
      "Max avstånd till butik",
      "Plats (ort eller postnummer)",
      "Har du redan hemma",
    ]) {
      expect(body).toContain(label);
    }
  });

  it("keeps prose for what only the model interprets", () => {
    const body = text(markup);
    expect(body).toContain("Fritext-önskemål");
    expect(body).toContain("Undvik (allergier, ogillar)");
  });

  it("labels the demo location default rather than guessing silently", () => {
    expect(text(markup)).toContain("Plats: Umeå (demostandard)");
  });

  it("shows a non-dismissible allergy disclaimer once allergy text is present", () => {
    const withAllergy = render(
      <PlanForm
        values={{ ...DEFAULT_FORM_VALUES, dislikes: "nötallergi i familjen" }}
        onChange={() => {}}
      />,
    );
    const body = text(withAllergy);
    expect(body).toContain("Vi kan inte garantera allergiinformation");
    expect(withAllergy).not.toContain("Stäng");
    expect(withAllergy).toContain('role="alert"');
  });
});
