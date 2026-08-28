import type { ReactNode } from "react";

export interface NumericColumnProps {
  /** The dominant figure — line price, total. Plex Mono, `--ink`. */
  primary: ReactNode;
  /** Optional line above the primary (quantity, `2 ×`). */
  secondary?: ReactNode;
  /** Optional line below the primary (unit price, `kr/st`). */
  tertiary?: ReactNode;
  /** Column width. `narrow` 84px · default 110px · `wide` 140px. */
  width?: "narrow" | "default" | "wide";
  className?: string;
}

/**
 * The right-aligned fixed-width tabular numeric column that runs down the edge of
 * every list. A global law — columns align across every row. Never ragged.
 */
export function NumericColumn({
  primary,
  secondary,
  tertiary,
  width = "default",
  className,
}: NumericColumnProps) {
  const cls = [
    "numeric-column",
    width === "narrow" ? "numeric-column--narrow" : "",
    width === "wide" ? "numeric-column--wide" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={cls}>
      {secondary ? (
        <span className="numeric-column__secondary t-num-s">{secondary}</span>
      ) : null}
      <span className="numeric-column__primary num-s">{primary}</span>
      {tertiary ? (
        <span className="numeric-column__secondary t-meta">{tertiary}</span>
      ) : null}
    </span>
  );
}
