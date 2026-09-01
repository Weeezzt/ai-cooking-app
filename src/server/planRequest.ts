import { z } from "zod";

import type { MealRequest } from "@/core/types";

const nullablePositiveInteger = z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.coerce.number().int().positive().max(480).nullable(),
);

const RawPlanRequestSchema = z.object({
  location: z.preprocess((value) => typeof value === "string" && value.trim() === "" ? null : value, z.string().trim().min(2).max(120).nullable().optional()),
  budgetSek: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().regex(/^\d{1,6}(?:[.,]\d{1,2})?$/)),
  portions: z.coerce.number().int().min(1).max(12),
  maxDistanceKm: z.coerce.number().positive().max(100),
  maxCookMinutes: nullablePositiveInteger,
  dietary: z.array(z.object({ id: z.string().trim().min(1).max(60), label: z.string().trim().min(1).max(100), safetyCritical: z.boolean() })).max(20).default([]),
  pantry: z.array(z.object({ raw: z.string().trim().min(1).max(100), concept: z.string().trim().min(1).max(100) })).max(30).default([]),
  vibe: z.string().trim().max(500).default(""),
  attempt: z.coerce.number().int().min(0).max(3).default(0),
}).strict();

export type ParsedPlanRequest = { readonly request: MealRequest; readonly attempt: number };

export function parsePlanRequest(body: unknown, opts: { readonly requireLocation: boolean }): ParsedPlanRequest {
  const parsed = RawPlanRequestSchema.parse(body);
  if (opts.requireLocation && !parsed.location) {
    throw new z.ZodError([{ code: "custom", path: ["location"], message: "Postnummer eller ort krävs i live-läge" }]);
  }
  return {
    attempt: parsed.attempt,
    request: {
      location: parsed.location ?? null,
      budgetSek: parsed.budgetSek,
      portions: parsed.portions,
      maxDistanceKm: parsed.maxDistanceKm,
      maxCookMinutes: parsed.maxCookMinutes,
      dietary: parsed.dietary,
      pantry: parsed.pantry,
      vibe: parsed.vibe,
    },
  };
}
