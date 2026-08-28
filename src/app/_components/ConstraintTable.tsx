export interface Constraint {
  /** e.g. "BUDGET", "TID", "PROTEIN", "GLUTENFRI". */
  label: string;
  /** The measured value, e.g. "382 / 400 kr", "28 min", "41 g". */
  value: string;
  /** Pass = `--ink` and a check, no colour. Fail = `--negative`, nothing else. */
  ok: boolean;
}

export interface ConstraintTableProps {
  caption?: string;
  rows: Constraint[];
}

/**
 * The constraint verdict as a mono table — NOT a row of green chips
 * (design-system.md, mandatory change 3). Pass rows carry no colour at all; a
 * failing row is the only coloured thing on the screen, which is exactly what the
 * IA wants from it.
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
              className={`constraint-table__row constraint-table__row--${row.ok ? "ok" : "fail"}`}
            >
              <td className="constraint-table__label">{row.label}</td>
              <td className="constraint-table__value">{row.value}</td>
              <td className="constraint-table__mark">
                <span aria-hidden="true">{row.ok ? "✓" : "✕"}</span>
                <span className="sr-only">
                  {row.ok ? " uppfyllt" : " ej uppfyllt"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
