"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Button,
  DecisionScreen,
  ModeHeader,
  NarratedPipeline,
  Notice,
  PlanForm,
  PlanResultView,
  StickyBar,
  type PipelineStage,
} from "@/app/_components";
import { decisionState, degradationNotices } from "@/lib/degradation";
import { formatQuantity } from "@/lib/format";
import {
  DEFAULT_FORM_VALUES,
  hasAllergyText,
  fullVibe,
  nextDistanceRung,
  toRequestBody,
  type PlanFormValues,
} from "@/lib/planForm";
import { buildPlanView, sekStringToOre } from "@/lib/planView";
import { savePlan, type StoredPlanPayload } from "@/lib/planStore";

interface ApiResult extends StoredPlanPayload {
  readonly planId: string;
}

type Phase = "input" | "generating" | "result";

/** Narrated activity, not progress (AD-3). Advances on a timer while we wait. */
const STAGES: readonly string[] = [
  "Tolkar din önskan",
  "Hittar butiker nära dig",
  "Väljer varor",
  "Skapar receptet",
];

const STAGE_MS = 1_600;
/** The store-name reveal is a moment — hold it before the result replaces it. */
const REVEAL_MS = 800;

export default function PlanPage() {
  const router = useRouter();
  const [values, setValues] = useState<PlanFormValues>(DEFAULT_FORM_VALUES);
  const [phase, setPhase] = useState<Phase>("input");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storable, setStorable] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [storeReveal, setStoreReveal] = useState<string | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stage ticks run while the single POST is in flight. They report activity,
  // never a fraction of an unknown total, and they stop on the last stage.
  useEffect(() => {
    if (phase !== "generating") return;
    const timer = setInterval(
      () => setStageIndex((index) => Math.min(STAGES.length - 1, index + 1)),
      STAGE_MS,
    );
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => () => {
    if (revealTimer.current) clearTimeout(revealTimer.current);
  }, []);

  const submit = useCallback(
    async (nextAttempt: number, submitted: PlanFormValues) => {
      setPhase("generating");
      setStageIndex(0);
      setStoreReveal(null);
      setError(null);
      setResult(null);

      try {
        const response = await fetch("/api/plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify(toRequestBody(submitted, nextAttempt)),
        });
        const data = (await response.json()) as ApiResult | { error?: { message?: string } };
        if (!response.ok || !("plan" in data)) {
          setError(
            "error" in data && data.error?.message
              ? data.error.message
              : "Planen kunde inte skapas.",
          );
          setPhase("input");
          return;
        }
        setResult(data);
        setStorable(savePlan(data.planId, { plan: data.plan, status: data.status }));
        setStoreReveal(data.plan.basket?.store.name ?? null);
        revealTimer.current = setTimeout(() => setPhase("result"), REVEAL_MS);
      } catch {
        setError("Planeringstjänsten kunde inte nås. Försök igen.");
        setPhase("input");
      }
    },
    [],
  );

  const stages: PipelineStage[] = STAGES.map((label, index) => ({
    label,
    detail: index === 1 && storeReveal ? storeReveal : undefined,
  }));

  const editRequest = () => {
    setPhase("input");
    setResult(null);
  };

  const retry = () => {
    const next = Math.min(3, attempt + 1);
    setAttempt(next);
    void submit(next, values);
  };

  const widenDistance = () => {
    const next = nextDistanceRung(values.maxDistanceKm);
    if (!next) return;
    const widened = { ...values, maxDistanceKm: next };
    setValues(widened);
    void submit(attempt, widened);
  };

  const toShoppingList = () => {
    if (!result) return;
    const saved = savePlan(result.planId, { plan: result.plan, status: result.status });
    setStorable(saved);
    if (saved) router.push("/shop");
  };

  return (
    <>
      <ModeHeader mode="plan" />
      <main className="page page--plan">
        {phase === "input" ? (
          <>
            {error ? (
              <Notice eyebrow="Fel" tone="warning" alert>
                {error}
              </Notice>
            ) : null}
            <PlanForm values={values} onChange={setValues} demoLocation />
          </>
        ) : null}

        {phase === "generating" ? (
          <section className="generating">
            <h2 className="generating__title t-h2">Bygger din plan</h2>
            <NarratedPipeline
              stages={stages}
              activeIndex={stageIndex}
              done={storeReveal !== null}
            />
            <p className="generating__note t-meta">
              Vi jämför riktiga butikspriser innan receptet skrivs.
            </p>
          </section>
        ) : null}

        {phase === "result" && result ? (
          <PlanOutcomeView
            result={result}
            values={values}
            storable={storable}
            onRetry={retry}
            onWiden={widenDistance}
            onEdit={editRequest}
            onContinue={toShoppingList}
          />
        ) : null}

        {/* The dock lives inside the padded page so its full-bleed negative
         * margins cancel the page padding instead of overflowing the viewport. */}
        {phase === "input" ? (
          <StickyBar>
            <Button variant="solid" block onClick={() => void submit(attempt, values)}>
              Hitta min måltid
            </Button>
          </StickyBar>
        ) : null}
      </main>
    </>
  );
}

function PlanOutcomeView({
  result,
  values,
  storable,
  onRetry,
  onWiden,
  onEdit,
  onContinue,
}: {
  readonly result: ApiResult;
  readonly values: PlanFormValues;
  readonly storable: boolean;
  readonly onRetry: () => void;
  readonly onWiden: () => void;
  readonly onEdit: () => void;
  readonly onContinue: () => void;
}) {
  const { plan, status } = result;
  const state = decisionState(plan.outcome);
  const maxDistance = formatQuantity(Number(values.maxDistanceKm), "km", 1);
  const widened = nextDistanceRung(values.maxDistanceKm);

  if (state === "infeasible") {
    const onlyPartial = plan.reason === "only_partial_stores_in_range";
    return (
      <DecisionScreen
        eyebrow="Inget förslag"
        title={onlyPartial ? "Bara kampanjpriser i närheten" : "Ingen fullsortimentsbutik inom räckhåll"}
        body={
          <>
            {onlyPartial ? (
              <p>
                Butikerna inom {maxDistance} har bara kampanjpriser, så vi kan
                inte bygga en komplett korg.
                {plan.nearestFullStore ? ` Närmaste fullsortiment är ${plan.nearestFullStore.name}, ${formatQuantity(plan.nearestFullStore.distanceKm, "km", 1)} bort.` : ""}
              </p>
            ) : (
              <p>
                Vi hittade ingen fullsortimentsbutik inom {maxDistance} från din
                plats, så vi kunde inte bygga en korg som håller dina villkor. Vi
                utökar aldrig avståndet åt dig.
              </p>
            )}
            <p className="t-body-s">Anledning: {plan.reason ?? "okänd"}.</p>
          </>
        }
        actions={
          <>
            {widened ? (
              <Button variant="solid" block onClick={onWiden}>
                Utöka till {widened} km
              </Button>
            ) : null}
            <Button variant="outline" block onClick={onEdit}>
              Byt plats
            </Button>
          </>
        }
      />
    );
  }

  if (state === "retry") {
    return (
      <DecisionScreen
        eyebrow="Avbrutet"
        title="Vi når inte butiksdatan just nu"
        body={
          <p>
            Butiksdatan kunde inte hämtas säkert, så vi visar hellre ingenting än
            siffror vi inte kan stå för.
          </p>
        }
        actions={
          <>
            <Button variant="solid" block onClick={onRetry}>
              Försök igen
            </Button>
            <Button variant="outline" block onClick={onEdit}>
              Ändra önskemål
            </Button>
          </>
        }
      />
    );
  }

  const view = buildPlanView(plan, {
    budgetOre: sekStringToOre(values.budgetSek),
    portions: values.portions,
    maxDistanceKm: Number(values.maxDistanceKm),
    vibe: fullVibe(values),
  });

  return (
    <>
      <PlanResultView
        view={view}
        demo={status.isDemoData}
        allergyDisclaimer={hasAllergyText(values)}
        notices={degradationNotices({
          isDemoData: status.isDemoData,
          isDemoRecipes: status.isDemoRecipes,
          nutritionSuppressed: plan.nutrition?.suppressed ?? false,
          stale: false,
        })}
      />

      {!storable ? (
        <Notice eyebrow="Lagring blockerad" tone="warning" alert>
          Planen visas här, men webbläsaren blockerade lagring. HANDLA och LAGA är
          därför avstängda för den här planen.
        </Notice>
      ) : null}

      <StickyBar
        summary={
          view.budget
            ? `${view.budget.totalLabel} · ${view.budget.perPortionLabel}`
            : undefined
        }
        secondary={
          <Button variant="text" onClick={onEdit}>
            Ändra önskemål
          </Button>
        }
      >
        <Button variant="solid" block disabled={!storable} onClick={onContinue}>
          Gör till handlingslista
        </Button>
      </StickyBar>
    </>
  );
}
