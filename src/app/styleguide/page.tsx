import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  Button,
  ConstraintTable,
  CookStep,
  InvertedBar,
  MetaLine,
  ModeHeader,
  NumericColumn,
  NutritionPanel,
  ProductLineItem,
  Rule,
  SectionHead,
  ShoppingRow,
} from "@/app/_components";
import { formatQuantity, formatSek } from "@/lib/format";

import styles from "./styleguide.module.css";

export const metadata: Metadata = {
  title: "Styleguide — Midnight Supermarket Editorial",
  robots: { index: false, follow: false },
};

const COLOURS: Array<{ name: string; value: string }> = [
  { name: "--bg-base", value: "#0B0D0C" },
  { name: "--bg-sunk", value: "#070908" },
  { name: "--surface-1", value: "#131614" },
  { name: "--surface-2", value: "#1B1F1D" },
  { name: "--ink", value: "#F2F4F1" },
  { name: "--ink-2", value: "#C2C7C1" },
  { name: "--muted", value: "#838B84" },
  { name: "--rule", value: "#262B27" },
  { name: "--rule-strong", value: "#3A413B" },
  { name: "--rule-ink", value: "#F2F4F1" },
  { name: "--accent", value: "#FFD100" },
  { name: "--positive", value: "#57C98A" },
  { name: "--negative", value: "#FF5A3C" },
  { name: "--invert-bg", value: "#F2F4F1" },
];

const SPACING = [
  "--s-1 · 4",
  "--s-2 · 8",
  "--s-3 · 12",
  "--s-4 · 16",
  "--s-5 · 20",
  "--s-6 · 24",
  "--s-8 · 32",
  "--s-10 · 40",
  "--s-14 · 56",
  "--s-18 · 72",
  "--s-24 · 96",
  "--s-32 · 128",
];

// px at 390 / px at >=904, from tokens.css.
const TYPE_SCALE: Array<{ cls: string; label: string; sample: string }> = [
  { cls: "t-micro", label: "t-micro · 11 / 12 · Plex 500 caps", sample: "AVDELNING · FRUKT & GRÖNT" },
  { cls: "t-meta", label: "t-meta · 13 / 13 · Plex 400", sample: "KRONFÅGEL · 700 g · 92,14 kr/kg" },
  { cls: "t-body-s", label: "t-body-s · 15 / 15 · Grotesk 400", sample: "Tät listtext och sekundär brödtext." },
  { cls: "t-body", label: "t-body · 17 / 17 · Grotesk 400", sample: "Standardbrödtext för PLAN-prosa." },
  { cls: "t-lead", label: "t-lead · 21 / 24 · Grotesk 400", sample: "Ingress under en PLAN-rubrik." },
  { cls: "t-h4", label: "t-h4 · 22 / 26 · Grotesk 600", sample: "Underrubrik i prosa" },
  { cls: "t-h3", label: "t-h3 · 28 / 32 · Archivo 700 wdth 112", sample: "Panelrubrik" },
  { cls: "t-h2", label: "t-h2 · 34 / 44 · Archivo 700 wdth 115", sample: "Sektionshuvud" },
  { cls: "t-h1", label: "t-h1 · 44 / 64 · Archivo 800 wdth 118", sample: "Måltid på 30 min" },
  { cls: "t-display", label: "t-display · 68 / 104 · Archivo 800 wdth 125", sample: "LAGA" },
  { cls: "t-step", label: "t-step · 25 / 32 · Grotesk 500", sample: "Stek kycklingen tills den fått färg." },
];

const NUM_SCALE: Array<{ cls: string; label: string; sample: string }> = [
  { cls: "num-s", label: "num-s · 15 · Plex 600", sample: "64,50 kr" },
  { cls: "num", label: "num · 20 / 22 · Plex 600", sample: "382,00 kr" },
  { cls: "num-l", label: "num-l · 34 / 44 · Plex 600", sample: "1 249,50 kr" },
];

const RULES: Array<{ weight: "hair" | "mid" | "heavy" | "double" | "receipt"; note: string }> = [
  { weight: "hair", note: "--rule-hair · 1px solid --rule · between list rows" },
  { weight: "mid", note: "--rule-mid · 2px solid --rule-strong · frames a group" },
  { weight: "heavy", note: "--rule-heavy · 3px solid --rule-ink · under a section head" },
  { weight: "double", note: "--rule-double · 3px + 1px, 4px gap · mode header only" },
  { weight: "receipt", note: "--rule-receipt · 1px dashed --rule-strong · SHOP totals" },
];

export default function StyleguidePage() {
  // Dev-only surface (issue #2): never served in a production build.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className={styles.page}>
      <header className={styles.block}>
        <span className="t-micro" style={{ color: "var(--muted)" }}>
          DESIGN SYSTEM · DEV ONLY
        </span>
        <h1 className="t-h1">Midnight Supermarket Editorial</h1>
        <p className={`t-body ${styles.note}`}>
          Token layer + UI primitives. Dark-only, mobile-first, zero-radius,
          rule-based. Material is type, rules, alignment and numbers — not
          containers.
        </p>
      </header>

      {/* ------------------------------------------------------ colour */}
      <section className={styles.block}>
        <SectionHead eyebrow="01" title="Colour" aside="dark palette only" />
        <p className={`t-body-s ${styles.note}`}>
          One accent. Positive / negative only for budget and safety. No third
          hue, no tint ramp, no gradient.
        </p>
        <div className={styles.swatches}>
          {COLOURS.map((c) => (
            <div key={c.name} className={styles.swatch}>
              <div
                className={styles.swatchChip}
                style={{ background: `var(${c.name})` }}
              />
              <div className={styles.swatchMeta}>
                <span className={`t-meta ${styles.swatchName}`}>{c.name}</span>
                <span className={`t-meta ${styles.swatchValue}`}>{c.value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ spacing */}
      <section className={styles.block}>
        <SectionHead eyebrow="02" title="Spacing" aside="4px base" />
        <div className={styles.spec}>
          {SPACING.map((s) => (
            <span key={s} className="t-meta">
              {s}
            </span>
          ))}
        </div>
        <div style={{ marginTop: "var(--s-4)" }}>
          {["--s-2", "--s-4", "--s-6", "--s-8", "--s-14"].map((s) => (
            <div
              key={s}
              style={{
                height: "8px",
                width: `var(${s})`,
                background: "var(--accent)",
                marginBottom: "var(--s-2)",
              }}
            />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ type scale */}
      <section className={styles.block}>
        <SectionHead eyebrow="03" title="Type scale" aside="mobile / desktop px" />
        <p className={`t-body-s ${styles.note}`}>
          Fixed mobile steps — the 390px value is the designed value and scales up
          at ≥904px, never down. Display ladder 22 → 28 → 34 → 44.
        </p>
        {TYPE_SCALE.map((t) => (
          <div key={t.cls} className={styles.scaleRow}>
            <span className={`t-meta ${styles.scaleTag}`}>{t.label}</span>
            <span className={`${t.cls} ${styles.scaleSample}`}>{t.sample}</span>
          </div>
        ))}
        <h3 className="t-h4" style={{ marginTop: "var(--s-8)" }}>
          Numerals — IBM Plex Mono, tabular
        </h3>
        {NUM_SCALE.map((t) => (
          <div key={t.cls} className={styles.scaleRow}>
            <span className={`t-meta ${styles.scaleTag}`}>{t.label}</span>
            <span className={`${t.cls} ${styles.scaleSample}`}>{t.sample}</span>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------ Archivo width proof */}
      <section className={styles.block}>
        <SectionHead eyebrow="04" title="Archivo width axis" aside="wdth ≥ 112" />
        <p className={`t-body-s ${styles.note}`}>
          The variable font ships with the <code>wdth</code> axis (62–125). Every
          display role drives it to ≥ 112 — signage, not a plain grotesque.
        </p>
        <div className={styles.stackTight}>
          <span className="t-h2" style={{ fontVariationSettings: '"wght" 700, "wdth" 100' }}>
            NÄRINGSVÄRDE (wdth 100)
          </span>
          <span className="t-h2" style={{ fontVariationSettings: '"wght" 700, "wdth" 112' }}>
            NÄRINGSVÄRDE (wdth 112)
          </span>
          <span className="t-h2" style={{ fontVariationSettings: '"wght" 700, "wdth" 125' }}>
            NÄRINGSVÄRDE (wdth 125)
          </span>
        </div>
      </section>

      {/* ------------------------------------------------------ rules */}
      <section className={styles.block}>
        <SectionHead eyebrow="05" title="Rules" aside="the structural device" />
        {RULES.map((r) => (
          <div key={r.weight} className={styles.ruleRow}>
            <span className="t-meta">{r.note}</span>
            <Rule weight={r.weight} />
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------ buttons */}
      <section className={styles.block}>
        <SectionHead eyebrow="06" title="Button" aside="solid / outline / text" />
        <div className={styles.row}>
          <Button variant="solid">Börja handla</Button>
          <Button variant="outline">Byt produkt</Button>
          <Button variant="text">Lägg till mer</Button>
        </div>
        <div style={{ marginTop: "var(--s-4)" }}>
          <Button variant="solid" block cook>
            Nästa steg
          </Button>
        </div>
      </section>

      {/* ------------------------------------------------------ MetaLine */}
      <section className={styles.block}>
        <SectionHead eyebrow="07" title="MetaLine" aside="system signature" />
        <p className={`t-body-s ${styles.note}`}>eyebrow variant (PLAN, 11px caps)</p>
        <MetaLine items={["Kronfågel", "700 g", "92,14 kr/kg"]} />
        <p className={`t-body-s ${styles.note}`} style={{ marginTop: "var(--s-4)" }}>
          scan variant (SHOP, 13px --ink-2)
        </p>
        <MetaLine items={["ICA", "1 kg nät", "Hylla 12"]} variant="scan" />
      </section>

      {/* ------------------------------------------------------ NumericColumn */}
      <section className={styles.block}>
        <SectionHead eyebrow="08" title="NumericColumn" aside="right-aligned, fixed width" />
        <div className={styles.stackTight}>
          {[
            { q: "1 ×", p: formatSek(6450), u: "64,50 kr/st" },
            { q: "2 ×", p: formatSek(12900), u: "64,50 kr/st" },
            { q: "1 ×", p: formatSek(2495), u: "24,95 kr/st" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "flex-end" }}>
              <NumericColumn secondary={r.q} primary={r.p} tertiary={r.u} />
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ InvertedBar */}
      <section className={styles.block}>
        <SectionHead eyebrow="09" title="InvertedBar" aside="shelf sign / banner" />
        <div className={styles.stackTight}>
          <InvertedBar trailing="4 ST">Frukt &amp; Grönt</InvertedBar>
          <InvertedBar>Demoläge — priser är exempeldata</InvertedBar>
        </div>
      </section>

      {/* ------------------------------------------------------ ConstraintTable */}
      <section className={styles.block}>
        <SectionHead eyebrow="10" title="ConstraintTable" aside="mono table, not chips" />
        <ConstraintTable
          caption="VILLKOR"
          rows={[
            { label: "Budget", value: "382 / 400 kr", ok: true },
            { label: "Tid", value: "28 / 30 min", ok: true },
            { label: "Protein", value: "41 g", ok: true },
            { label: "Glutenfri", value: "vetemjöl i sås", ok: false },
          ]}
        />
      </section>

      {/* ------------------------------------------------------ ModeHeader */}
      <section className={styles.block}>
        <SectionHead eyebrow="11" title="ModeHeader" aside="one journey" />
        <div className={styles.stackTight}>
          <ModeHeader mode="plan" />
          <ModeHeader mode="shop" />
          <ModeHeader mode="cook" />
        </div>
      </section>

      {/* ------------------------------------------------------ ProductLineItem */}
      <section className={styles.block}>
        <SectionHead eyebrow="12" title="ProductLineItem" aside="PLAN basket row" />
        <ProductLineItem
          name="Kycklinglårfilé"
          meta={["Kronfågel", "700 g", "92,14 kr/kg"]}
          quantity="2 ×"
          linePrice={formatSek(12900)}
          unitPrice="64,50 kr/st"
        />
        <ProductLineItem
          name="Krossade tomater"
          meta={["Mutti", "400 g", "37,25 kr/kg"]}
          quantity="1 ×"
          linePrice={formatSek(1490)}
          unitPrice="14,90 kr/st"
          swapped
        />
      </section>

      {/* ------------------------------------------------------ ShoppingRow */}
      <section className={styles.block}>
        <SectionHead eyebrow="13" title="ShoppingRow" aside="SHOP picking list" />
        <div className={styles.demoGround + " " + styles.demoSurface}>
          <InvertedBar trailing="3 ST">Frukt &amp; Grönt</InvertedBar>
          <ShoppingRow
            quantity="2"
            unit="ST"
            name="Gul lök"
            meta={["ICA", "1 kg nät"]}
            price={formatSek(990)}
          />
          <ShoppingRow
            quantity="1"
            unit="ST"
            name="Ingefära"
            meta={["Färsk", "ca 150 g"]}
            price={formatSek(2400)}
            checked
          />
          <ShoppingRow
            quantity="3"
            unit="ST"
            name="Vitlök"
            meta={["Netto", "3-pack"]}
            price={formatSek(1750)}
          />
        </div>
      </section>

      {/* ------------------------------------------------------ NutritionPanel */}
      <section className={styles.block}>
        <SectionHead eyebrow="14" title="NutritionPanel" aside="literal label" />
        <NutritionPanel
          basis="portion"
          energy={{ kcal: "612 kcal", kj: "2 560 kJ" }}
          rows={[
            { label: "Fett", value: formatQuantity(24, "g"), referencePct: 34 },
            { label: "varav mättat fett", value: formatQuantity(7.1, "g"), sub: true },
            { label: "Kolhydrater", value: formatQuantity(48, "g"), referencePct: 18 },
            { label: "varav sockerarter", value: formatQuantity(6, "g"), sub: true },
            { label: "Protein", value: formatQuantity(41, "g"), referencePct: 82, emphasised: true },
            { label: "Salt", value: formatQuantity(2.1, "g") },
          ]}
          source="Livsmedelsverkets livsmedelsdatabas (2024)"
        />
      </section>

      {/* ------------------------------------------------------ CookStep */}
      <section className={styles.block}>
        <SectionHead eyebrow="15" title="CookStep" aside="one idea per screen" />
        <div className={styles.demoGround + " " + styles.demoSunk}>
          <CookStep
            step={3}
            total={7}
            ingredients={["400 G KYCKLINGLÅRFILÉ", "2 MSK RAPSOLJA", "1 TSK SALT"]}
            instruction={
              <>
                Hetta upp oljan i en stekpanna och stek kycklingen i{" "}
                <span className="q">6 min</span> tills den fått fin färg, vänd
                efter halva tiden.
              </>
            }
          />
        </div>
      </section>
    </main>
  );
}
