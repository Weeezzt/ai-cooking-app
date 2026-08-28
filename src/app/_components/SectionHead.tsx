import type { ReactNode } from "react";

export interface SectionHeadProps {
  /** Uppercase mono eyebrow above the title. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Right-aligned metadata on the title row (count, timestamp…). */
  aside?: ReactNode;
  /** Heading level for the document outline. Default 2. */
  as?: "h1" | "h2" | "h3" | "h4";
  /** Title type class. Default `t-h2`. */
  titleClass?: string;
}

/**
 * A section head followed by the editorial 3px `--rule-heavy`. The rule is part
 * of the component so it can never be forgotten or restyled.
 */
export function SectionHead({
  eyebrow,
  title,
  aside,
  as: Heading = "h2",
  titleClass = "t-h2",
}: SectionHeadProps) {
  return (
    <div className="section-head">
      {eyebrow ? (
        <span className="section-head__eyebrow t-micro">{eyebrow}</span>
      ) : null}
      <div className="section-head__row">
        <Heading className={`section-head__title ${titleClass}`}>{title}</Heading>
        {aside ? (
          <span className="section-head__aside t-meta">{aside}</span>
        ) : null}
      </div>
      <hr className="rule rule--heavy" />
    </div>
  );
}
