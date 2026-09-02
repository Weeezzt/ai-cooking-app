import type { PlanView } from "@/lib/planView";

import { BudgetBlock } from "./BudgetBlock";
import { ComparisonTable } from "./ComparisonTable";
import { ConstraintTable } from "./ConstraintTable";
import { InvertedBar } from "./InvertedBar";
import { MetaLine } from "./MetaLine";
import { Notice } from "./Notice";
import { NutritionPanel } from "./NutritionPanel";
import { ProductLineItem } from "./ProductLineItem";
import { Rule } from "./Rule";
import { SectionHead } from "./SectionHead";

export interface PlanResultViewProps {
  view: PlanView;
  /** `status.isDemoData` — the persistent, unmissable demo badge (AD-9). */
  demo?: boolean;
  /** An allergy phrase was detected; never claim allergen safety (§3.11). */
  allergyDisclaimer?: boolean;
  /** Degradation notices from `lib/degradation` (AD-11). */
  notices?: readonly string[];
}

/**
 * The PLAN result screen, in the one reading order the IA mandates
 * (product-ux §2.2): **constraint verdict → budget → store → products → recipe
 * → nutrition**. Money and place come before products because they are the
 * filters that produced the products.
 *
 * Purely presentational: every string it renders was formatted by
 * `lib/planView`. It computes nothing.
 */
export function PlanResultView({
  view,
  demo = false,
  allergyDisclaimer = false,
  notices = [],
}: PlanResultViewProps) {
  return (
    <div className="result">
      {demo ? (
        <InvertedBar as="aside" className="full-bleed" trailing="EXEMPELDATA">
          Demoläge — priser och produkter är exempeldata
        </InvertedBar>
      ) : null}

      {/* ---------------------------------------------- A · verdict (anchor) */}
      <section className="result__block result__block--verdict">
        <h2 className="result__title t-h1">{view.recipeTitle ?? "Din måltid"}</h2>
        {view.rationale ? (
          <p className="result__rationale t-lead">{view.rationale}</p>
        ) : null}
        {view.interpretation ? (
          <MetaLine items={[`Tolkat som: ${view.interpretation}`]} variant="scan" />
        ) : null}
        <Rule weight="heavy" />
        <ConstraintTable caption="Villkor" rows={view.constraints} />
        {allergyDisclaimer ? (
          <Notice eyebrow="Allergi" tone="warning">
            Vi kan inte garantera allergiinformation. Kontrollera alltid
            förpackningen.
          </Notice>
        ) : null}
        {notices.map((notice) => (
          <Notice key={notice}>{notice}</Notice>
        ))}
      </section>

      {/* ---------------------------------------------------- B · budget */}
      {view.budget ? (
        <section className="result__block">
          <SectionHead eyebrow="B" title="Budget" titleClass="t-h3" />
          <BudgetBlock view={view.budget} />
        </section>
      ) : null}

      {/* ----------------------------------------------------- C · store */}
      {view.store ? (
        <section className="result__block">
          <SectionHead
            eyebrow="C"
            title="Butik"
            aside={view.store.distanceLabel}
            titleClass="t-h3"
          />
          <p className="result__store-name t-h4">{view.store.name}</p>
          <p className="result__store-reason t-body-s">{view.store.reason}</p>
          <ComparisonTable rows={view.store.rows} caption="Jämförda butiker" />
        </section>
      ) : null}

      {/* -------------------------------------------------- D · products */}
      {view.sections.length > 0 ? (
        <section className="result__block">
          <SectionHead
            eyebrow="D"
            title="Varor"
            aside={view.budget?.totalLabel}
            titleClass="t-h3"
          />
          {view.sections.map((section) => (
            <div key={section.section} className="result__section">
              <InvertedBar className="full-bleed" trailing={section.subtotal}>
                {section.section}
              </InvertedBar>
              {section.rows.map((row) => (
                <ProductLineItem
                  key={row.id}
                  name={row.name}
                  meta={row.meta}
                  quantity={row.quantity}
                  linePrice={row.linePrice}
                  unitPrice={row.unitPrice}
                  swapped={row.swapped}
                />
              ))}
            </div>
          ))}
          <p className="result__attribution t-micro">{view.priceSourceLabel}</p>
        </section>
      ) : null}

      {/* ---------------------------------------------------- E · recipe */}
      {view.recipeTitle ? (
        <section className="result__block">
          <SectionHead
            eyebrow="E"
            title="Recept"
            aside={`${view.stepCount} steg`}
            titleClass="t-h3"
          />
          <p className="result__store-name t-h4">{view.recipeTitle}</p>
          {view.cookTimeLabel ? (
            <MetaLine items={[view.cookTimeLabel]} variant="scan" />
          ) : null}
          <ol className="result__steps">
            {view.stepPreview.map((step, index) => (
              <li key={step} className="result__step">
                <span className="result__step-num t-micro">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="t-body-s">{step}</span>
              </li>
            ))}
          </ol>
          <p className="result__steps-more t-meta">
            Hela receptet visas steg för steg i LAGA.
          </p>
        </section>
      ) : null}

      {/* ------------------------------------------------- F · nutrition */}
      {view.nutrition ? (
        <section className="result__block">
          <SectionHead
            eyebrow="F"
            title="Näringsvärde"
            aside={view.nutrition.coverageLabel}
            titleClass="t-h3"
          />
          <NutritionPanel
            energy={{
              kcal: view.nutrition.energyPerPortion,
              kj: view.nutrition.energyKj,
              total: view.nutrition.energyTotal,
            }}
            rows={view.nutrition.rows.map((row) => ({
              label: row.label,
              value: row.perPortion,
              totalValue: row.total,
              referencePct: row.referencePct,
              emphasised: row.emphasised,
            }))}
            suppressed={view.nutrition.suppressed}
            footnote={view.nutrition.footnote ?? undefined}
            source={view.nutrition.source}
          />
        </section>
      ) : null}
    </div>
  );
}
