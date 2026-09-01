"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadCookStep, loadLatestPlan, saveCookStep, type LoadedPlan } from "@/lib/planStore";
export default function CookPage() {
  const [saved, setSaved] = useState<LoadedPlan | null | undefined>();
  const [step, setStep] = useState(0);
  useEffect(() => { const timer = setTimeout(() => { const latest = loadLatestPlan(); setSaved(latest); if (latest) setStep(loadCookStep(latest.planId)); }, 0); return () => clearTimeout(timer); }, []);
  if (saved === undefined) return <main><h1>COOK</h1><p>Läser planen…</p></main>;
  if (!saved?.plan.recipe) return <main><h1>COOK</h1><p>Ingen plan ännu. <Link href="/plan">Gå till PLAN</Link>.</p></main>;
  const steps = saved.plan.recipe.steps; const current = Math.min(step, steps.length - 1);
  const move = (next: number) => { const bounded = Math.max(0, Math.min(steps.length - 1, next)); setStep(bounded); saveCookStep(saved.planId, bounded); };
  return <main><h1>COOK</h1><h2>{saved.plan.recipe.title}</h2><p>Steg {current + 1} av {steps.length}</p><p>{steps[current]?.text}</p><button type="button" disabled={current === 0} onClick={() => move(current - 1)}>Föregående</button> <button type="button" disabled={current >= steps.length - 1} onClick={() => move(current + 1)}>Nästa</button></main>;
}
