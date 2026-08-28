export interface NutritionRow {
  label: string;
  /** Formatted value, already `sv-SE` (e.g. "41 g", "1,2 g"). */
  value: string;
  /** Indented sub-nutrient (varav mättat fett, varav sockerarter). */
  sub?: boolean;
  /** Percent of daily reference, shown at the right end of the bar. */
  referencePct?: number;
  /** This is the macro the user's request emphasised — bar fills `--accent`. */
  emphasised?: boolean;
}

export interface NutritionPanelProps {
  /** Panel title. Default "NÄRINGSVÄRDE". */
  title?: string;
  /** Which basis is active. */
  basis?: "portion" | "100g";
  energy: { kcal: string; kj: string };
  rows: NutritionRow[];
  /** Data source, named in the footnote. Trust comes from citing, not a badge. */
  source: string;
}

/**
 * Literally a nutrition label — 2px frame, zero radius, no chart widget. Shell
 * only: it takes formatted strings and renders the structure. Behaviour (basis
 * switching, live values) is filled by the nutrition experience (#5 / #8–#10).
 */
export function NutritionPanel({
  title = "NÄRINGSVÄRDE",
  basis = "portion",
  energy,
  rows,
  source,
}: NutritionPanelProps) {
  return (
    <section className="nutrition" aria-label={title}>
      <h3 className="nutrition__title">{title}</h3>
      <hr className="rule rule--heavy" />

      <div className="nutrition__basis">
        <button
          type="button"
          className="nutrition__basis-btn"
          aria-pressed={basis === "portion"}
        >
          Per portion
        </button>
        <span aria-hidden="true">|</span>
        <button
          type="button"
          className="nutrition__basis-btn"
          aria-pressed={basis === "100g"}
        >
          Per 100 g
        </button>
      </div>

      <div className="nutrition__energy">
        <span className="nutrition__energy-label t-body-s">Energi</span>
        <span className="nutrition__energy-value">
          <span className="num-l">{energy.kcal}</span>
          <span className="nutrition__energy-kj t-meta">{energy.kj}</span>
        </span>
      </div>
      <hr className="rule rule--mid" />

      <table className="nutrition__rows">
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className={`nutrition__row${row.sub ? " nutrition__row--sub" : ""}`}
            >
              <th scope="row" className="nutrition__row-label t-body-s">
                {row.label}
              </th>
              <td className="nutrition__row-value num-s">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.some((r) => typeof r.referencePct === "number") ? (
        <div className="nutrition__bars" aria-hidden="true">
          {rows
            .filter((r) => typeof r.referencePct === "number")
            .map((r) => (
              <div key={r.label}>
                <div className="nutrition__bar">
                  <div
                    className={`nutrition__bar-fill${r.emphasised ? " nutrition__bar-fill--accent" : ""}`}
                    style={{ width: `${Math.min(100, r.referencePct ?? 0)}%` }}
                  />
                </div>
                <span className="nutrition__ref t-micro">
                  {r.label} {r.referencePct}%
                </span>
              </div>
            ))}
        </div>
      ) : null}

      <hr className="rule rule--mid" />
      <span className="nutrition__source t-micro">Källa: {source}</span>
    </section>
  );
}
