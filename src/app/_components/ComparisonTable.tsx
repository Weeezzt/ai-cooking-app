import type { StoreRowView } from "@/lib/planView";

export interface ComparisonTableProps {
  rows: readonly StoreRowView[];
  /** The stated selection reason — a silently chosen store is a trust hole. */
  caption?: string;
}

/**
 * The multi-store comparison (product-ux §2.2 Block C): every candidate store's
 * basket total, coverage and distance, with the chosen one marked. This is the
 * cheapest, highest-value proof that the numbers came from real store data — so
 * it is a table of real figures, right-aligned and tabular, not a summary chip.
 */
export function ComparisonTable({ rows, caption }: ComparisonTableProps) {
  return (
    <div className="scroll-x">
      <table className="comparison t-meta">
        {caption ? <caption className="t-micro">{caption}</caption> : null}
        <thead>
          <tr>
            <th scope="col" className="comparison__head t-micro">Butik</th>
            <th scope="col" className="comparison__head comparison__head--num t-micro">Korg</th>
            <th scope="col" className="comparison__head comparison__head--num t-micro">Täckning</th>
            <th scope="col" className="comparison__head comparison__head--num t-micro">Avstånd</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={`comparison__row${row.chosen ? " comparison__row--chosen" : ""}`}
            >
              <th scope="row" className="comparison__store">
                {row.name}
                {row.chosen ? (
                  <span className="comparison__tag t-micro">Vald</span>
                ) : null}
              </th>
              <td className="comparison__num num-s">{row.totalLabel}</td>
              <td className="comparison__num num-s">{row.coverageLabel}</td>
              <td className="comparison__num num-s">{row.distanceLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
