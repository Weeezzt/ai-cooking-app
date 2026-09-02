import { MetaLine } from "./MetaLine";

export interface ShoppingRowProps {
  /** Quantity numeral, shown above the unit in a shelf-label stack. */
  quantity: string;
  /** Unit under the quantity — ST, G, PKT. */
  unit: string;
  name: string;
  /** Metadata segments — brand, package size, surplus. */
  meta?: string[];
  /** Formatted price, `sv-SE`. */
  price: string;
  checked?: boolean;
  /** Toggle the check. When omitted the row is a static, non-interactive line. */
  onToggle?: () => void;
}

/**
 * SHOP list row — denser, mono-forward, thumb-scannable at arm's length
 * (visual-direction §5.3). The whole row is the check target; the effective hit
 * area clears 44px via the row's 64px min-height. Checked rows drop to 0.42
 * opacity and strike the name — they do NOT move, reflow, or reorder. Position
 * is memory in a store.
 */
export function ShoppingRow({
  quantity,
  unit,
  name,
  meta = [],
  price,
  checked = false,
  onToggle,
}: ShoppingRowProps) {
  const className = `shopping-row${checked ? " shopping-row--checked" : ""}`;

  const inner = (
    <>
      <span className="shopping-row__check" aria-hidden="true">
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
        >
          <path d="M3 9.5 7 13.5 15 5" />
        </svg>
      </span>

      <span className="shopping-row__qty num-s">
        {quantity}
        <span className="shopping-row__qty-unit t-micro">{unit}</span>
      </span>

      <span className="shopping-row__body">
        <span className="shopping-row__name">{name}</span>
        <MetaLine items={meta} variant="scan" />
      </span>

      <span className="shopping-row__price num-s">{price}</span>
    </>
  );

  if (!onToggle) {
    return <div className={className}>{inner}</div>;
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={name}
      className={className}
      onClick={onToggle}
    >
      {inner}
    </button>
  );
}
