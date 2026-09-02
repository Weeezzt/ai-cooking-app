import type { BudgetView } from "@/lib/planView";

import { Notice } from "./Notice";

export interface BudgetBlockProps {
  view: BudgetView;
}

/**
 * Block B (product-ux §2.2): the money anchor. The basket total is the two-step
 * numeral jump on this screen — 34px tabular mono against the 15px rows below
 * it. One horizontal bar, 4px, zero radius; the overshoot segment is the only
 * `--negative` fill in the app outside a failed constraint row.
 *
 * The repair ladder is shown as an audit list, never silently (§3.3).
 */
export function BudgetBlock({ view }: BudgetBlockProps) {
  return (
    <div className="budget">
      <div className="budget__figures">
        <span className="budget__total num-l">{view.totalLabel}</span>
        <span className="budget__of t-meta">av {view.budgetLabel}</span>
      </div>

      <div className="budget__bar" aria-hidden="true">
        <span className="budget__fill" style={{ width: `${view.fillPct}%` }} />
        {view.overshootPct > 0 ? (
          <span className="budget__over" style={{ width: `${view.overshootPct}%` }} />
        ) : null}
      </div>

      <p className="budget__legend t-meta">
        <span className={view.overBudget ? "budget__delta--over" : "budget__delta"}>
          {view.overshootLabel ?? view.remainingLabel}
        </span>
        <span className="budget__sep" aria-hidden="true">
          ·
        </span>
        <span>{view.perPortionLabel}</span>
      </p>

      {view.headline ? (
        <Notice eyebrow="Över budget" tone="warning">
          {view.headline} Vi hittade ingen kombination inom din budget — det här
          är den billigaste giltiga korgen. Du kan gå vidare ändå.
        </Notice>
      ) : null}

      {view.audit.length > 0 ? (
        <div className="budget__audit">
          <span className="budget__audit-head t-micro">Vad vi bytte</span>
          <ul className="budget__audit-list">
            {view.audit.map((item) => (
              <li key={item.text} className="budget__audit-row">
                <span className="t-body-s">{item.text}</span>
                <span className="budget__audit-delta num-s">{item.delta}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
