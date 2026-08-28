import type { ReactNode } from "react";

export interface InvertedBarProps {
  /** Left-aligned label — set in condensed Archivo caps. */
  children: ReactNode;
  /** Right-aligned trailing figure (item count, `4 ST`). */
  trailing?: ReactNode;
  /** Stick to the top of the scroll container (SHOP section bars). */
  sticky?: boolean;
  /** Semantic role. `banner` for demoläge / offline notices. */
  as?: "div" | "header" | "aside";
  className?: string;
}

/**
 * A full paper-white block on the dark ground — the shelf sign, the section bar,
 * the unmissable banner. Promoted to a co-signature of the identity: one inverted
 * block per screen, always full-bleed to at least one container edge.
 */
export function InvertedBar({
  children,
  trailing,
  sticky = false,
  as: Tag = "div",
  className,
}: InvertedBarProps) {
  const cls = [
    "inverted-bar",
    sticky ? "inverted-bar--sticky" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={cls}>
      <span className="inverted-bar__label">{children}</span>
      {trailing ? <span className="inverted-bar__trailing">{trailing}</span> : null}
    </Tag>
  );
}
