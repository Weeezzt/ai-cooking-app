import type { ConstraintTone } from "@/lib/planView";

export type { ConstraintTone };

export interface Constraint {
  /** e.g. "Budget", "Tillagningstid", "Avstånd". */
  label: string;
  /** The measured value, e.g. "382 / 400 kr", "ca 28 min (uppskattning)". */
  value: string;
  /**
   * AD-5 taxonomy, not a boolean:
   *  - `pass`       verified and met — `✓`, `--ink`, no colour
   *  - `fail`       verified and provably not met — `--negative`, the only
   *                 coloured thing on the screen
   *  - `estimate`   model/heuristic value — `≈`, never a hard check
   *  - `disclaimer` cannot be established from the data (allergens, diet
   *                 guarantees) — never rendered as a pass
   */
  tone: ConstraintTone;
}

export interface ConstraintTableProps {
  caption?: string;
  rows: readonly Constraint[];
}

const MARK: Record<ConstraintTone, { glyph: string; label: string }> = {
  pass: { glyph: "✓", label: "uppfyllt" },
  fail: { glyph: "✕", label: "ej uppfyllt" },
  estimate: { glyph: "≈", label: "uppskattning" },
  disclaimer: { glyph: "!", label: "kan inte verifieras" },
};

/**
 * The constraint verdict as a mono table — NOT a row of green chips
 * (design-system.md, mandatory change 3). The deterministic engine speaking
 * directly to the user, above the fold. Pass rows carry no colour at all; a
 * failing row is the only coloured thing on the screen, which is exactly what
 * the IA wants from it. An `unsupported` check never gets a check mark.
 */
export function ConstraintTable({ caption, rows }: ConstraintTableProps) {
  return (
    <div className="scroll-x">
      <table className="constraint-table t-meta">
        {caption ? <caption className="t-micro">{caption}</caption> : null}
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={`constraint-table__row constraint-table__row--${row.tone}`}
            >
              <td className="constraint-table__label">{row.label}</td>
              <td className="constraint-table__value">{row.value}</td>
              <td className="constraint-table__mark">
                <span aria-hidden="true">{MARK[row.tone].glyph}</span>
                <span className="sr-only"> {MARK[row.tone].label}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
