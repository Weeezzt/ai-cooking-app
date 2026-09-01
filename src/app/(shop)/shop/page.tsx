"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { degradationNotices } from "@/lib/degradation";
import { loadLatestPlan, loadShopChecks, saveShopChecks, type LoadedPlan } from "@/lib/planStore";
export default function ShopPage() {
  const [saved, setSaved] = useState<LoadedPlan | null | undefined>();
  const [checked, setChecked] = useState<readonly string[]>([]);
  useEffect(() => { const timer = setTimeout(() => { const latest = loadLatestPlan(); setSaved(latest); if (latest) setChecked(loadShopChecks(latest.planId)); }, 0); return () => clearTimeout(timer); }, []);
  if (saved === undefined) return <main><h1>SHOP</h1><p>Läser planen…</p></main>;
  if (!saved?.plan.basket) return <main><h1>SHOP</h1><p>Ingen plan ännu. <Link href="/plan">Gå till PLAN</Link>.</p></main>;
  const toggle = (id: string) => { const next = checked.includes(id) ? checked.filter((value) => value !== id) : [...checked, id]; setChecked(next); saveShopChecks(saved.planId, next); };
  return <main><h1>SHOP</h1><p>{saved.plan.basket.store.name}</p><ul>{saved.plan.basket.lines.map((line) => <li key={line.product.id}><label><input type="checkbox" checked={checked.includes(line.product.id)} onChange={() => toggle(line.product.id)} /> {line.product.name}</label></li>)}</ul>{degradationNotices({ isDemoData: saved.status.isDemoData, isDemoRecipes: saved.status.isDemoRecipes, nutritionSuppressed: saved.plan.nutrition?.suppressed ?? false, stale: saved.stale }).map((notice) => <p role="note" key={notice}>{notice}</p>)}</main>;
}
