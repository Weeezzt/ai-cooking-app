import type { ShopTally, ShopView } from "@/lib/shopView";

import { Button } from "./Button";
import { InvertedBar } from "./InvertedBar";
import { MetaLine } from "./MetaLine";
import { Notice } from "./Notice";
import { ShoppingRow } from "./ShoppingRow";
import { StickyBar } from "./StickyBar";

export interface ShopScreenProps {
  view: ShopView;
  /** Ids of the checked buy rows. Position is memory — this never reorders. */
  checkedIds: readonly string[];
  /** Running total + progress, derived from `checkedIds` by `lib/shopView`. */
  tally: ShopTally;
  onToggle: (id: string) => void;
  onStartCooking: () => void;
  /** Storage was blocked — check state will not survive a reload (AD-11). */
  storageBlocked?: boolean;
  /** Plan is older than 24h — prices may have moved (product-ux §3.14). */
  stale?: boolean;
}

/**
 * HANDLA — the plan as an in-store picking list (product-ux §1.6). Receipt
 * character: full-bleed inverted section bars in store-walk order, mono
 * metadata under every name, a tabular price column, and a receipt totals block
 * whose figure climbs toward the plan total as rows are checked.
 *
 * Purely presentational — every string was formatted by `lib/shopView`, and the
 * running-total math lives in `shopTally`, not here.
 */
export function ShopScreen({
  view,
  checkedIds,
  tally,
  onToggle,
  onStartCooking,
  storageBlocked = false,
  stale = false,
}: ShopScreenProps) {
  const checked = new Set(checkedIds);
  const allHome = view.sections.length === 0 && view.pantry.length > 0;

  return (
    <div className="shop">
      {view.isDemo ? (
        <InvertedBar as="aside" className="full-bleed" trailing="EXEMPELDATA">
          Demoläge — priser och produkter är exempeldata, inte live butiksdata
        </InvertedBar>
      ) : null}

      <header className="shop-head">
        <p className="shop-head__store t-h4">{view.storeName}</p>
        <MetaLine items={view.storeMeta} variant="scan" />
        <p className="shop-head__progress t-meta">
          {tally.progressLabel} · {tally.runningLabel}
        </p>
        <div className="shop-head__track" aria-hidden="true">
          <span className="shop-head__track-fill" style={{ width: `${tally.pct}%` }} />
        </div>
        <p className="shop-head__offline t-micro">Listan fungerar utan uppkoppling</p>
      </header>

      {stale ? (
        <Notice eyebrow="Obs">
          Planens priser är äldre än 24 timmar — de kan ha ändrats i butiken.
        </Notice>
      ) : null}

      {storageBlocked ? (
        <Notice eyebrow="Lagring blockerad" tone="warning" alert>
          Webbläsaren blockerade lagring — ibockade varor sparas inte om du laddar
          om sidan.
        </Notice>
      ) : null}

      {allHome ? (
        <Notice eyebrow="Klart">
          Du har redan allt hemma! Tryck på Börja laga.
        </Notice>
      ) : null}

      {view.sections.map((section) => (
        <section key={section.section} className="shop-section" aria-label={section.section}>
          <InvertedBar sticky className="full-bleed" trailing={section.countLabel}>
            {section.section}
          </InvertedBar>
          <ul className="shop-section__rows">
            {section.rows.map((row) => (
              <li key={row.id}>
                <ShoppingRow
                  quantity={row.quantity}
                  unit={row.unit}
                  name={row.name}
                  meta={row.meta}
                  price={row.price}
                  checked={checked.has(row.id)}
                  onToggle={() => onToggle(row.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {view.pantry.length > 0 ? (
        <section className="shop-section" aria-label="Har hemma">
          <InvertedBar sticky className="full-bleed" trailing={`${view.pantry.length} ST`}>
            Har hemma
          </InvertedBar>
          <ul className="shop-pantry">
            {view.pantry.map((item) => (
              <li key={item.id} className="shop-pantry__row">
                <span className="shop-pantry__check" aria-hidden="true">
                  <svg
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
                <span className="shop-pantry__name">{item.name}</span>
                <span className="shop-pantry__note t-meta">{item.note}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="receipt-total full-bleed">
        <span className="receipt-total__label t-micro">Summa</span>
        <span className="receipt-total__value">
          <span className="num-l">{tally.checkedLabel}</span>
          <span className="receipt-total__of t-meta"> av {view.totalLabel}</span>
        </span>
      </div>

      <p className="shop-attribution t-micro">{view.priceSourceLabel}</p>

      <StickyBar summary={`${tally.progressLabel} · ${tally.remainingLabel}`}>
        <Button
          variant={tally.complete ? "solid" : "outline"}
          block
          onClick={onStartCooking}
        >
          Börja laga
        </Button>
      </StickyBar>
    </div>
  );
}
