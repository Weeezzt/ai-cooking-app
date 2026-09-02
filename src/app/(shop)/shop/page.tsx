"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, ModeHeader, ShopScreen } from "@/app/_components";
import { loadLatestPlan, loadShopChecks, saveShopChecks, type LoadedPlan } from "@/lib/planStore";
import { shopTally, shopView } from "@/lib/shopView";

export default function ShopPage() {
  const router = useRouter();
  const [saved, setSaved] = useState<LoadedPlan | null | undefined>();
  const [checked, setChecked] = useState<readonly string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Client route reading the one shared snapshot (AD-8). A 0ms defer keeps the
  // first paint identical between server and client — storage is read after.
  useEffect(() => {
    const timer = setTimeout(() => {
      const latest = loadLatestPlan();
      setSaved(latest);
      if (latest) setChecked(loadShopChecks(latest.planId));
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Persist on every change — but only after the restore above, so the initial
  // empty state never clobbers stored checks (AD-8: localStorage keyed by plan).
  useEffect(() => {
    if (!hydrated || !saved) return;
    saveShopChecks(saved.planId, checked);
  }, [checked, hydrated, saved]);

  const view = useMemo(
    () => (saved?.plan ? shopView(saved.plan, saved.status) : null),
    [saved],
  );
  const tally = useMemo(
    () => (view ? shopTally(view, checked) : null),
    [view, checked],
  );

  const toggle = useCallback((id: string) => {
    setChecked((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }, []);

  const startCooking = useCallback(() => router.push("/cook"), [router]);

  if (saved === undefined) {
    return (
      <>
        <ModeHeader mode="shop" />
        <main className="page page--shop">
          <div className="shop">
            <p className="shop-head t-meta">Läser planen…</p>
          </div>
        </main>
      </>
    );
  }

  if (!saved || !view || !tally) {
    return (
      <>
        <ModeHeader mode="shop" />
        <main className="page page--shop">
          <div className="shop">
            <div className="shop-head">
              <p className="shop-head__store t-h4">Ingen plan ännu</p>
              <p className="shop-head__progress t-body-s">
                Skapa en måltid i PLAN, så blir den din handlingslista här.
              </p>
              <Link href="/plan" className="btn btn--outline btn--block">
                Gå till PLAN
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <ModeHeader mode="shop" />
      <main className="page page--shop">
        <ShopScreen
          view={view}
          checkedIds={checked}
          tally={tally}
          onToggle={toggle}
          onStartCooking={startCooking}
          stale={saved.stale}
        />
      </main>
    </>
  );
}
