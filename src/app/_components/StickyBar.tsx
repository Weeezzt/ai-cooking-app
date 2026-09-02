import type { ReactNode } from "react";

export interface StickyBarProps {
  /** Full-width primary action — inside the thumb zone. */
  children: ReactNode;
  /** Secondary text actions, rendered above the primary. */
  secondary?: ReactNode;
  /** Muted mono line above the actions (basket total, item count). */
  summary?: ReactNode;
}

/**
 * The bottom action dock. Solid ground plus a 1px rule on the leading edge —
 * never a shadow, never a floating rounded panel, no drag handle. Every primary
 * CTA in the app lives here so the thumb always knows where to go.
 */
export function StickyBar({ children, secondary, summary }: StickyBarProps) {
  return (
    <div className="sticky-bar">
      <hr className="rule rule--hair" />
      {summary ? <div className="sticky-bar__summary t-meta">{summary}</div> : null}
      {secondary ? <div className="sticky-bar__secondary">{secondary}</div> : null}
      <div className="sticky-bar__primary">{children}</div>
    </div>
  );
}
