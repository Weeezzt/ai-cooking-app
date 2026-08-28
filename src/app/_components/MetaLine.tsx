import { Fragment } from "react";

export interface MetaLineProps {
  /** Segments joined by ` · ` — brand, package size, unit price, … */
  items: Array<string | null | undefined>;
  /**
   * `eyebrow` (default): 11px uppercase `--muted` — PLAN eyebrows, desktop labels.
   * `scan`: 13px `--ink-2`, not uppercase — SHOP and any row read while moving
   * (visual-critique SHOULD-FIX-1). The signature must not be the first thing to
   * disappear.
   */
  variant?: "eyebrow" | "scan";
  className?: string;
}

/**
 * The uppercase-mono metadata signature line that sits under every product name
 * everywhere in the app. Mono + ` · ` separators + the position under the name
 * are the recognisable part.
 */
export function MetaLine({ items, variant = "eyebrow", className }: MetaLineProps) {
  const parts = items.filter((v): v is string => Boolean(v && v.trim()));
  if (parts.length === 0) return null;

  const base = variant === "scan" ? "meta-line meta-line--scan t-meta" : "meta-line t-micro";

  return (
    <span className={className ? `${base} ${className}` : base}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="meta-line__sep" aria-hidden="true">·</span> : null}
          {part}
        </Fragment>
      ))}
    </span>
  );
}
