import type { PlanResult } from "@/core/types";

const LATEST_KEY = "plan:latest";
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export interface StoredPlanPayload {
  readonly plan: PlanResult;
  readonly status: { readonly isDemoData: boolean; readonly isDemoRecipes: boolean; readonly usedFallback: boolean; readonly fallbackProviders: readonly string[] };
}
export interface LoadedPlan extends StoredPlanPayload { readonly planId: string; readonly savedAtIso: string; readonly stale: boolean }
interface StoredEnvelope extends StoredPlanPayload { readonly planId: string; readonly savedAtIso: string }

function planKey(planId: string): string { return `plan:${planId}`; }
function parse(raw: string | null): StoredEnvelope | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredEnvelope>;
    return value.plan && value.status && typeof value.planId === "string" && typeof value.savedAtIso === "string" ? value as StoredEnvelope : null;
  } catch { return null; }
}

export function savePlan(planId: string, payload: StoredPlanPayload): boolean {
  const envelope: StoredEnvelope = { ...payload, planId, savedAtIso: new Date().toISOString() };
  const serialized = JSON.stringify(envelope);
  let sessionSaved = false;
  let localSaved = false;
  try { sessionStorage.setItem(planKey(planId), serialized); sessionStorage.setItem(LATEST_KEY, planId); sessionSaved = true; } catch {}
  try { localStorage.setItem(planKey(planId), serialized); localStorage.setItem(LATEST_KEY, planId); localSaved = true; } catch {}
  return sessionSaved || localSaved;
}

export function loadPlan(planId: string): LoadedPlan | null {
  let envelope: StoredEnvelope | null = null;
  try { envelope = parse(sessionStorage.getItem(planKey(planId))); } catch {}
  if (!envelope) { try { envelope = parse(localStorage.getItem(planKey(planId))); } catch {} }
  if (!envelope) return null;
  const age = Date.now() - Date.parse(envelope.savedAtIso);
  return { ...envelope, stale: !Number.isFinite(age) || age > STALE_AFTER_MS };
}

export function loadLatestPlan(): LoadedPlan | null {
  let planId: string | null = null;
  try { planId = sessionStorage.getItem(LATEST_KEY); } catch {}
  if (!planId) { try { planId = localStorage.getItem(LATEST_KEY); } catch {} }
  return planId ? loadPlan(planId) : null;
}

export function saveShopChecks(planId: string, ids: readonly string[]): boolean {
  try { localStorage.setItem(`${planKey(planId)}:shop`, JSON.stringify([...new Set(ids)])); return true; } catch { return false; }
}
export function loadShopChecks(planId: string): readonly string[] {
  try { const value = JSON.parse(localStorage.getItem(`${planKey(planId)}:shop`) ?? "[]"); return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : []; } catch { return []; }
}
export function saveCookStep(planId: string, step: number): boolean {
  try { localStorage.setItem(`${planKey(planId)}:cook`, String(Math.max(0, Math.trunc(step)))); return true; } catch { return false; }
}
export function loadCookStep(planId: string): number {
  try { const value = Number(localStorage.getItem(`${planKey(planId)}:cook`)); return Number.isInteger(value) && value >= 0 ? value : 0; } catch { return 0; }
}
