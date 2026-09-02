import type { ReactNode } from "react";

export type NoticeTone = "neutral" | "warning";

export interface NoticeProps {
  /** Uppercase mono eyebrow — "OBS", "DEMOLÄGE", "NÄRINGSVÄRDE". */
  eyebrow?: string;
  children: ReactNode;
  /**
   * `warning` draws the 3px `--negative` leading edge. Reserved for things the
   * user must not miss: the allergy disclaimer and the over-budget statement.
   */
  tone?: NoticeTone;
  /** Rendered with `role="alert"` when the notice must be announced. */
  alert?: boolean;
}

/**
 * A full-width bounded block with a 3px leading edge — a real border, never a
 * shadow, never a rounded "alert card". Non-dismissible by construction: there
 * is no close affordance, because the two things this carries (allergen
 * disclaimer, over-budget) must ride with the plan.
 */
export function Notice({ eyebrow, children, tone = "neutral", alert = false }: NoticeProps) {
  return (
    <div
      className={`notice notice--${tone}`}
      role={alert ? "alert" : "note"}
    >
      {eyebrow ? <span className="notice__eyebrow t-micro">{eyebrow}</span> : null}
      <p className="notice__body t-body-s">{children}</p>
    </div>
  );
}
