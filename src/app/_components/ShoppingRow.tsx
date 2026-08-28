import { MetaLine } from "./MetaLine";

export interface ShoppingRowProps {
  /** Quantity numeral, shown above the unit in a shelf-label stack. */
  quantity: string;
  /** Unit under the quantity — ST, G, PKT. */
  unit: string;
  name: string;
  /** Metadata segments — brand, package size, shelf location. */
  meta?: string[];
  /** Formatted price, `sv-SE`. */
  price: string;
  checked?: boolean;
}

/**
 * SHOP list row — denser, mono-forward, thumb-scannable at arm's length. Shell
 * only: the check is a static button here; toggle behaviour is filled by SHOP
 * (#9). Checked rows drop to 0.42 opacity and strike the name — they do NOT
 * move, reflow, or reorder. Position is memory in a store.
 */
export function ShoppingRow({
  quantity,
  unit,
  name,
  meta = [],
  price,
  checked = false,
}: ShoppingRowProps) {
  return (
    <div className={`shopping-row${checked ? " shopping-row--checked" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={`Bocka av ${name}`}
        className="shopping-row__check"
      >
        <svg
          className="shopping-row__check-glyph"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          aria-hidden="true"
        >
          <path d="M3 9.5 7 13.5 15 5" />
        </svg>
      </button>

      <span className="shopping-row__qty num-s">
        {quantity}
        <span className="shopping-row__qty-unit t-micro">{unit}</span>
      </span>

      <div className="shopping-row__body">
        <p className="shopping-row__name">{name}</p>
        <MetaLine items={meta} variant="scan" />
      </div>

      <span className="shopping-row__price num-s">{price}</span>
    </div>
  );
}
