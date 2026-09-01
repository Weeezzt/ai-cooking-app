/**
 * Constraint evaluation + outcome aggregation (AD-5).
 */

import { formatOre } from "../money";
import type {
  ConstraintCheck,
  ConstraintReport,
  DietaryConstraint,
  NutritionBreakdown,
  Ore,
  PlanOutcome,
} from "../types";
import { evidenceClassFor } from "./taxonomy";

export interface EvaluateInput {
  readonly budgetOre: Ore;
  readonly basketTotalOre: Ore;
  readonly requestedPortions: number;
  readonly recipePortions: number;
  readonly maxDistanceKm: number;
  readonly storeDistanceKm: number;
  readonly dietary: readonly DietaryConstraint[];
  readonly nutrition: NutritionBreakdown | null;
  readonly estimatedCookMinutes: number | null;
  readonly maxCookMinutes: number | null;
  /** A verified check is provably failed by valid facts (AD-5). */
  readonly coverageImpossible: boolean;
  /** A provider/coverage failure blocked a verified check (AD-5). */
  readonly providerFailure: boolean;
}

export function evaluateConstraints(input: EvaluateInput): ConstraintReport {
  const checks: ConstraintCheck[] = [];

  const withinBudget = input.basketTotalOre <= input.budgetOre;
  checks.push({
    id: "budget",
    label: "Budget",
    evidence: evidenceClassFor("budget"),
    status: withinBudget ? "pass" : "fail",
    detail: withinBudget
      ? `Korgen kostar ${formatOre(input.basketTotalOre)} av ${formatOre(input.budgetOre)}`
      : `Korgen kostar ${formatOre(input.basketTotalOre)} — ${formatOre(
          (input.basketTotalOre - input.budgetOre) as Ore,
        )} över budget`,
  });

  const portionsOk = input.requestedPortions === input.recipePortions;
  checks.push({
    id: "portions",
    label: "Portioner",
    evidence: evidenceClassFor("portions"),
    status: portionsOk ? "pass" : "fail",
    detail: portionsOk
      ? `${input.recipePortions} portioner`
      : `Receptet ger ${input.recipePortions}, du bad om ${input.requestedPortions}`,
  });

  const distanceOk = input.storeDistanceKm <= input.maxDistanceKm;
  checks.push({
    id: "distance",
    label: "Avstånd",
    evidence: evidenceClassFor("distance"),
    status: distanceOk ? "pass" : "fail",
    detail: `${input.storeDistanceKm.toFixed(1)} km (max ${input.maxDistanceKm.toFixed(1)} km)`,
  });

  if (input.estimatedCookMinutes !== null) {
    const withinPreference = input.maxCookMinutes === null || input.estimatedCookMinutes <= input.maxCookMinutes;
    checks.push({
      id: "cook_time",
      label: "Tillagningstid",
      evidence: evidenceClassFor("cook_time"),
      status: withinPreference ? "pass" : "unknown",
      detail: input.maxCookMinutes === null
        ? `ca ${input.estimatedCookMinutes} min (uppskattning)`
        : `ca ${input.estimatedCookMinutes} min (önskemål max ${input.maxCookMinutes} min, uppskattning)`,
    });
  }

  if (input.nutrition !== null) {
    const pct = Math.round(input.nutrition.coverageRatio * 100);
    checks.push({
      id: "nutrition",
      label: "Näringsvärde",
      evidence: evidenceClassFor("nutrition"),
      status: "pass",
      detail: input.nutrition.suppressed
        ? `Täckning ${pct}% — per portion döljs (under 70%)`
        : `ca ${Math.round(input.nutrition.perPortion.kcal)} kcal/portion (täckning ${pct}%)`,
    });
  }

  for (const constraint of input.dietary) {
    checks.push({
      id: `dietary:${constraint.id}`,
      label: constraint.label,
      evidence: evidenceClassFor(constraint.safetyCritical ? "allergy" : "dietary"),
      status: "disclaimer",
      detail: constraint.safetyCritical
        ? "Allergisäkerhet kan inte garanteras från butiksdata — kontrollera förpackningen"
        : "Kostval kan inte verifieras fullt ut från butiksdata",
    });
  }

  return {
    checks,
    outcome: aggregateOutcome({
      withinBudget,
      verifiedChecksPass: portionsOk && distanceOk,
      coverageImpossible: input.coverageImpossible,
      providerFailure: input.providerFailure,
    }),
  };
}

export function aggregateOutcome(input: {
  readonly withinBudget: boolean;
  readonly verifiedChecksPass?: boolean;
  readonly coverageImpossible: boolean;
  readonly providerFailure: boolean;
}): PlanOutcome {
  if (input.providerFailure) return "unknown";
  if (input.coverageImpossible) return "infeasible";
  if (input.verifiedChecksPass === false) return "unknown";
  if (!input.withinBudget) return "over_budget";
  return "ok";
}
