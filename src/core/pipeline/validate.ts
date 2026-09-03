/**
 * Request validation (AD-3 step 1). Plain TS — `src/core` cannot import Zod
 * (eslint `core-boundary`), and the engine is meant to be plain TS anyway.
 * Zod-based validation of the raw HTTP payload belongs in `src/server`.
 */

import { parseSekToOre } from "../money";
import type { InterpretedRequest, MealRequest } from "../types";

export class PipelineValidationError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(`Invalid meal request: ${issues.join("; ")}`);
    this.name = "PipelineValidationError";
    this.issues = issues;
  }
}

export function validateRequest(request: MealRequest): InterpretedRequest {
  const issues: string[] = [];

  let budgetOre = parseSekToOre("0");
  try {
    budgetOre = parseSekToOre(request.budgetSek);
    if (budgetOre <= 0) issues.push("budget must be greater than 0");
  } catch {
    issues.push(`budget is not a SEK amount: ${JSON.stringify(request.budgetSek)}`);
  }

  if (!Number.isInteger(request.portions) || request.portions < 1 || request.portions > 12) {
    issues.push("portions must be an integer between 1 and 12");
  }
  if (!Number.isFinite(request.maxDistanceKm) || request.maxDistanceKm <= 0) {
    issues.push("maxDistanceKm must be greater than 0");
  }
  if (request.maxCookMinutes !== null && (!Number.isInteger(request.maxCookMinutes) || request.maxCookMinutes <= 0)) {
    issues.push("maxCookMinutes must be a positive integer or null");
  }

  const seenDietary = new Set<string>();
  for (const d of request.dietary) {
    if (d.id.trim().length === 0) issues.push("dietary constraint has an empty id");
    if (seenDietary.has(d.id)) issues.push(`duplicate dietary constraint: ${d.id}`);
    seenDietary.add(d.id);
  }

  if (issues.length > 0) {
    throw new PipelineValidationError(issues);
  }

  return {
    budgetOre,
    portions: request.portions,
    maxDistanceKm: request.maxDistanceKm,
    maxCookMinutes: request.maxCookMinutes,
    dietary: request.dietary,
    pantry: request.pantry,
    vibe: request.vibe,
  };
}
