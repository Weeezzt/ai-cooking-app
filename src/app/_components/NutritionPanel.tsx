export interface NutritionRow {
  label: string;
  /** Formatted per-portion value, already `sv-SE` (e.g. "41 g"). */
  value: string;
  /** Formatted whole-dish value. Both columns are always shown. */
  totalValue?: string;
  /** Indented sub-nutrient (varav mättat fett, varav sockerarter). */
  sub?: boolean;
  /** Percent of daily reference — scales the 4px bar, never shown as advice. */
  referencePct?: number;
  /** This is the macro the user's request emphasised — bar fills `--accent`. */
  emphasised?: boolean;
}

export interface NutritionPanelProps {
  /** Panel title. Default "NÄRINGSVÄRDE". */
  title?: string;
  /** Column headers. The label is a real column head, not a segmented control. */
  columns?: { primary: string; secondary: string };
  energy: { kcal: string; kj: string; total?: string };
  rows: NutritionRow[];
  /**
   * Coverage below 0.7 (AD-9): the numbers are withheld and the footnote says
   * why. Suppressing beats guessing — no macro row is rendered.
   */
  suppressed?: boolean;
  /** Always rendered. Names the data source or the reason numbers are absent. */
  footnote?: string;
  /** Data source, named in the footnote. Trust comes from citing, not a badge. */
  source: string;
}

/**
 * Literally a nutrition label — 2px frame, zero radius, no chart widget. Total
 * AND per portion side by side, because the promise of the product is that the
 * numbers are real and reconcilable.
 */
export function NutritionPanel({
  title = "NÄRINGSVÄRDE",
  columns = { primary: "Per portion", secondary: "Totalt" },
  energy,
  rows,
  suppressed = false,
  footnote,
  source,
}: NutritionPanelProps) {
  const barRows = suppressed
    ? []
    : rows.filter((row) => typeof row.referencePct === "number");

  return (
    <section className="nutrition" aria-label={title}>
      <h3 className="nutrition__title">{title}</h3>
      <hr className="rule rule--heavy" />

      <div className="nutrition__energy">
        <span className="nutrition__energy-label t-body-s">Energi</span>
        <span className="nutrition__energy-value">
          <span className="num-l">{suppressed ? "—" : energy.kcal}</span>
          <span className="nutrition__energy-kj t-meta">
            {suppressed ? "uppgift saknas" : energy.kj}
          </span>
        </span>
      </div>
      <hr className="rule rule--mid" />

      <table className="nutrition__rows">
        <thead>
          <tr>
            <th scope="col" className="nutrition__col-head t-micro">
              Näringsämne
            </th>
            <th scope="col" className="nutrition__col-head nutrition__col-head--num t-micro">
              {columns.primary}
            </th>
            <th scope="col" className="nutrition__col-head nutrition__col-head--num t-micro">
              {columns.secondary}
            </th>
          </tr>
        </thead>
        <tbody>
          {suppressed ? (
            <tr className="nutrition__row">
              <th scope="row" className="nutrition__row-label t-body-s">
                Per portion
              </th>
              <td className="nutrition__row-value num-s">—</td>
              <td className="nutrition__row-value num-s">—</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.label}
                className={`nutrition__row${row.sub ? " nutrition__row--sub" : ""}`}
              >
                <th scope="row" className="nutrition__row-label t-body-s">
                  {row.label}
                </th>
                <td className="nutrition__row-value num-s">{row.value}</td>
                <td className="nutrition__row-value nutrition__row-value--total num-s">
                  {row.totalValue ?? "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {barRows.length > 0 ? (
        <div className="nutrition__bars" aria-hidden="true">
          {barRows.map((row) => (
            <div key={row.label}>
              <div className="nutrition__bar">
                <div
                  className={`nutrition__bar-fill${row.emphasised ? " nutrition__bar-fill--accent" : ""}`}
                  style={{ width: `${Math.min(100, row.referencePct ?? 0)}%` }}
                />
              </div>
              <span className="nutrition__ref t-micro">
                {row.label} {row.referencePct}% av dagsbehov
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <hr className="rule rule--mid" />
      {footnote ? (
        <span className="nutrition__source t-micro">{footnote}</span>
      ) : null}
      <span className="nutrition__source t-micro">Källa: {source}</span>
    </section>
  );
}
