import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import type { Clock } from "@/core/clock";
import { runPlanPipeline } from "@/core/pipeline";
import type { PlanResult } from "@/core/types";
import { createServerContainer, type ContainerStatus } from "@/server/container";
import { parsePlanRequest } from "@/server/planRequest";

export const runtime = "nodejs";
/** #8's narrated-activity UI covers this shared live-planning wait. */
export const PLAN_DEADLINE_MS = 32_000;
const MAX_IDEMPOTENCY_ENTRIES = 100;

class SystemClock implements Clock {
  now(): number { return Date.now(); }
  nowIso(): string { return new Date(this.now()).toISOString(); }
}

interface SuccessBody { readonly plan: PlanResult; readonly status: ContainerStatus; readonly planId: string }
const idempotencyCache = new Map<string, SuccessBody>();

function errorResponse(status: 422 | 503, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function cacheResult(key: string, body: SuccessBody): void {
  if (idempotencyCache.size >= MAX_IDEMPOTENCY_ENTRIES) {
    const oldest = idempotencyCache.keys().next().value;
    if (oldest !== undefined) idempotencyCache.delete(oldest);
  }
  idempotencyCache.set(key, body);
}

export async function POST(httpRequest: Request) {
  const idempotencyKey = httpRequest.headers.get("Idempotency-Key")?.trim();
  if (idempotencyKey && idempotencyKey.length <= 200) {
    const cached = idempotencyCache.get(idempotencyKey);
    if (cached) return NextResponse.json(cached);
  }

  let raw: unknown;
  try { raw = await httpRequest.json(); } catch { return errorResponse(422, "INVALID_REQUEST", "Begäran måste vara giltig JSON"); }
  let parsed;
  try {
    parsed = parsePlanRequest(raw, { requireLocation: process.env.DATA_SOURCE === "live" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const locationRequired = error.issues.some((issue) => issue.path[0] === "location" && issue.code === "custom");
      return errorResponse(422, locationRequired ? "LOCATION_REQUIRED" : "INVALID_REQUEST", locationRequired ? "Postnummer eller ort krävs i live-läge" : "Kontrollera formulärets uppgifter");
    }
    return errorResponse(422, "INVALID_REQUEST", "Begäran kunde inte valideras");
  }

  const clock = new SystemClock();
  const deadlineAt = clock.now() + PLAN_DEADLINE_MS;
  let container;
  try { container = await createServerContainer(); } catch { return errorResponse(503, "SERVICE_UNAVAILABLE", "Planeringstjänsten är tillfälligt otillgänglig"); }

  try {
    const timeout = new Promise<PlanResult>((resolve) => {
      const timer = setTimeout(() => resolve({ outcome: "unknown", basket: null, nutrition: null, comparison: null, constraints: { checks: [], outcome: "unknown" }, adjustments: [], recipe: null, unmatchedIngredients: [], candidateRejections: [], overshootOre: 0 as PlanResult["overshootOre"], reason: "deadline_exceeded", provenance: [] }), PLAN_DEADLINE_MS);
      timer.unref?.();
    });
    const plan = await Promise.race([runPlanPipeline(parsed.request, container.deps, { clock, deadlineAt, nonce: parsed.attempt }), timeout]);
    const body: SuccessBody = { plan, status: container.status(), planId: randomBytes(12).toString("base64url").slice(0, 16) };
    if (idempotencyKey && idempotencyKey.length <= 200 && plan.outcome !== "unknown") cacheResult(idempotencyKey, body);
    return NextResponse.json(body);
  } catch {
    return errorResponse(503, "SERVICE_UNAVAILABLE", "Planeringstjänsten är tillfälligt otillgänglig");
  }
}
