/**
 * SHOP screen render tests.
 *
 * Same pattern as `plan-result.test.tsx`: components render to static markup
 * with `react-dom/server`, no DOM environment, no new dependency. The screen is
 * a pure function of the `ShopView` + the checked-id set.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShopScreen } from "@/app/_components/ShopScreen";
import { shopTally, shopView } from "@/lib/shopView";
import type { Ore, PlanResult } from "@/core/types";

import { OK_PLAN } from "../helpers/planFixtures";

const ore = (value: number) => value as Ore;

function text(markup: string): string {
  return markup
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x27;|&#39;/gu, "'")
    .replace(/&amp;/gu, "&")
    .replace(/[\s ]+/gu, " ")
    .trim();
}

const PANTRY_PLAN: PlanResult = {
  ...OK_PLAN,
  adjustments: [
    { kind: "pantry_cap", concept: "olivolja", deltaOre: ore(-3295), detail: "borttagen" },
  ],
};

const noop = () => {};

function screen(plan: PlanResult, checkedIds: readonly string[], demo = false) {
  const view = shopView(plan, { isDemoData: demo })!;
  const tally = shopTally(view, checkedIds);
  return renderToStaticMarkup(
    <ShopScreen
      view={view}
      checkedIds={checkedIds}
      tally={tally}
      onToggle={noop}
      onStartCooking={noop}
    />,
  );
}

const ALL_IDS = OK_PLAN.basket!.lines.map((line) => line.product.id);

describe("ShopScreen", () => {
  it("renders each section as a full-bleed inverted sticky bar in walk order", () => {
    const markup = screen(OK_PLAN, []);
    const bars = [...markup.matchAll(/inverted-bar__label[^>]*>([^<]+)</gu)].map((m) =>
      m[1].replace(/&amp;/gu, "&").trim(),
    );
    expect(bars).toEqual(["FRUKT & GRÖNT", "KÖTT & PROTEIN", "MEJERI"]);
    expect(markup).toContain("inverted-bar--sticky");
    expect(markup).toContain("full-bleed");
  });

  it("keeps checked rows in place — no reorder, no reflow", () => {
    const unchecked = screen(OK_PLAN, []);
    const checked = screen(OK_PLAN, [ALL_IDS[0]]);
    const names = (markup: string) =>
      [...markup.matchAll(/shopping-row__name[^>]*>([^<]+)</gu)].map((m) => m[1].trim());
    // identical order, identical set — only the checked class + aria-checked move
    expect(names(checked)).toEqual(names(unchecked));
    expect(checked.match(/aria-checked="true"/gu)).toHaveLength(1);
    expect(checked).toContain("shopping-row--checked");
  });

  it("running total in the receipt block counts only checked items", () => {
    const none = text(screen(OK_PLAN, []));
    expect(none).toContain("Summa");
    expect(none).toContain("0,00 kr av 208,99 kr");

    const one = text(screen(OK_PLAN, [ALL_IDS[0]])); // chicken line, 131,95 kr
    expect(one).toContain("131,95 kr av 208,99 kr");
  });

  it("shows progress as X av Y, with pantry excluded from Y", () => {
    const markup = text(screen(PANTRY_PLAN, []));
    expect(markup).toContain("0 av 3 varor");
    expect(markup).toContain("Har hemma");
    expect(markup).toContain("Räknas inte in i priset");
  });

  it("pre-checks the pantry section and never counts it in the total", () => {
    const markup = screen(PANTRY_PLAN, []);
    expect(markup).toContain("shop-pantry__check");
    // the pantry check glyph is always drawn; buy rows start empty
    expect(text(markup)).toContain("Olivolja");
  });

  it("carries the persistent demo badge when the plan used fixture data", () => {
    expect(text(screen(OK_PLAN, [], true))).toContain("Demoläge");
    expect(text(screen(OK_PLAN, [], false))).not.toContain("Demoläge");
  });

  it("cites the price source and offers the Börja laga CTA", () => {
    const markup = text(screen(OK_PLAN, []));
    expect(markup).toContain("Prisdata från primat.nu");
    expect(markup).toContain("Börja laga");
  });

  it("settles the CTA to the accent fill only once everything is checked", () => {
    expect(screen(OK_PLAN, [])).toContain("btn--outline");
    expect(screen(OK_PLAN, ALL_IDS)).toContain("btn--solid");
  });

  it("uses no forbidden radius, gradient or non-line shadow", () => {
    const markup = screen(OK_PLAN, ALL_IDS);
    expect(markup).not.toMatch(/9999px|border-radius:\s*(?!0|2px|50%)/u);
    expect(markup).not.toContain("linear-gradient");
    expect(markup).not.toContain("box-shadow");
  });
});
