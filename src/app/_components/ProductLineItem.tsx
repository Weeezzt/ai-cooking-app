import { MetaLine } from "./MetaLine";
import { NumericColumn } from "./NumericColumn";

export interface ProductLineItemProps {
  name: string;
  /** Metadata segments — brand, package size, unit price. */
  meta: string[];
  /** Product image URL. Missing ⇒ a `--surface-2` tile with the initial. */
  imageUrl?: string;
  /** Quantity line above the price, e.g. "2 ×". */
  quantity?: string;
  /** Formatted line price, `sv-SE`. */
  linePrice: string;
  /** Formatted per-unit price under the line price, e.g. "32,25 kr/st". */
  unitPrice?: string;
  /** Product was swapped — 1px `--negative` underline + a BYTT tag. */
  swapped?: boolean;
}

/**
 * PLAN basket / product picker row. Not a card — a full-width row bounded above
 * and below by `--rule-hair`, min-height 64px. The metadata line under the name
 * is the system signature and appears under every product everywhere.
 */
export function ProductLineItem({
  name,
  meta,
  imageUrl,
  quantity,
  linePrice,
  unitPrice,
  swapped = false,
}: ProductLineItemProps) {
  return (
    <div className="product-line">
      <span className="product-line__thumb">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- grocery feed URL, unmodified; no next/image domain config in #2
          <img
            src={imageUrl}
            alt=""
            width={56}
            height={56}
            className="product-line__thumb-img"
          />
        ) : (
          <span className="product-line__thumb-initial" aria-hidden="true">
            {name.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </span>

      <div className="product-line__body">
        <p
          className={`product-line__name${swapped ? " product-line__name--swapped" : ""}`}
        >
          {name}
          {swapped ? <span className="product-line__tag">BYTT</span> : null}
        </p>
        <MetaLine items={meta} variant="eyebrow" />
      </div>

      <span className="product-line__rail">
        <NumericColumn
          secondary={quantity}
          primary={linePrice}
          tertiary={unitPrice}
        />
      </span>
    </div>
  );
}
