"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, CookStep, ModeHeader, Notice, Rule } from "@/app/_components";
import { buildCookView, clampCookPosition, formatTimer, timerRemainingSeconds } from "@/lib/cookView";
import { loadCookStep, loadLatestPlan, saveCookStep, type LoadedPlan } from "@/lib/planStore";

interface TimerState { readonly remaining: number; readonly startedAt: number | null }

export default function CookPage() {
  const [saved, setSaved] = useState<LoadedPlan | null | undefined>();
  const [position, setPosition] = useState(0);
  const [now, setNow] = useState(0);
  const [timer, setTimer] = useState<TimerState>({ remaining: 0, startedAt: null });
  const view = useMemo(() => saved ? buildCookView(saved.plan) : null, [saved]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const latest = loadLatestPlan();
      setSaved(latest);
      if (latest) setPosition(loadCookStep(latest.planId));
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  const duration = view?.steps[position]?.durationSeconds ?? 0;

  useEffect(() => {
    if (timer.startedAt === null) return;
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [timer.startedAt]);

  if (saved === undefined) return <main className="cook-page"><ModeHeader mode="cook" /><p className="cook-state">Läser planen…</p></main>;
  if (!saved || !view) return <main className="cook-page"><ModeHeader mode="cook" /><p className="cook-state">Ingen plan ännu — <Link href="/plan">gå till PLAN</Link>.</p></main>;

  const stepCount = view.steps.length;
  const current = clampCookPosition(position, stepCount);
  const summary = current === stepCount;
  const step = view.steps[current];
  const remaining = timer.startedAt === null ? (timer.remaining || duration) : timerRemainingSeconds(timer.remaining, timer.startedAt, now);
  const move = (next: number) => {
    const bounded = clampCookPosition(next, stepCount);
    setPosition(bounded);
    setTimer({ remaining: 0, startedAt: null });
    saveCookStep(saved.planId, bounded);
  };
  const toggleTimer = () => {
    if (timer.startedAt === null) {
      const nextRemaining = remaining === 0 ? duration : remaining;
      setTimer({ remaining: nextRemaining, startedAt: Date.now() });
      setNow(Date.now());
    } else setTimer({ remaining, startedAt: null });
  };

  return (
    <main className="cook-page">
      <ModeHeader mode="cook" />
      {summary ? (
        <section className="cook-summary" aria-labelledby="cook-summary-title">
          <p className="t-micro">Klar</p>
          <h1 id="cook-summary-title" className="cook-summary__heading">Smaklig måltid!</h1>
          <div className="cook-receipt">
            <Rule weight="receipt" />
            <h2>{view.summary.title}</h2>
            <dl>
              <div><dt>Portioner</dt><dd>{view.summary.portions}</dd></div>
              <div><dt>Total kostnad</dt><dd>{view.summary.total}</dd></div>
              <div><dt>Per portion</dt><dd>{view.summary.nutrition ?? "Näringsvärde visas inte"}</dd></div>
            </dl>
            <Rule weight="receipt" />
          </div>
          <Link className="cook-summary__link" href="/plan">Tillbaka till planen</Link>
        </section>
      ) : step ? (
        <>
          <div className="cook-content" onClick={() => move(current + 1)}>
            <CookStep step={current + 1} total={stepCount} ingredients={[...step.ingredients]} instruction={step.instruction.map((part, index) => part.quantity ? <span className="q" key={index}>{part.text}</span> : part.text)} />
            {step.usesCombinedIngredients ? <Notice eyebrow="Ingredienser">Steget saknar ingredienskoppling. Hela ingredienslistan visas.</Notice> : null}
            {step.durationSeconds > 0 ? (
              <section className="cook-timer" aria-label="Timer" onClick={(event) => event.stopPropagation()}>
                <span className="t-micro">Timer</span>
                <output className="cook-timer__display" aria-live="off">{formatTimer(remaining)}</output>
                <Button variant={timer.startedAt === null ? "solid" : "outline"} block cook onClick={toggleTimer}>{timer.startedAt === null ? "Start" : "Pausa"}</Button>
              </section>
            ) : null}
          </div>
          <nav className="cook-actions" aria-label="Stegnavigering">
            <Button cook block variant="outline" disabled={current === 0} onClick={() => move(current - 1)}>Föregående</Button>
            <Button cook block variant="solid" onClick={() => move(current + 1)}>{current === stepCount - 1 ? "Klar" : "Nästa steg"}</Button>
          </nav>
        </>
      ) : null}
    </main>
  );
}
