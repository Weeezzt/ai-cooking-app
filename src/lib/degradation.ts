import type { PlanOutcome } from "@/core/types";

export type DecisionState = "plan" | "retry" | "infeasible" | "over_budget";

export function decisionState(outcome: PlanOutcome): DecisionState {
  if (outcome === "unknown") return "retry";
  if (outcome === "infeasible") return "infeasible";
  if (outcome === "over_budget") return "over_budget";
  return "plan";
}

export function degradationNotices(input: { readonly isDemoData: boolean; readonly isDemoRecipes: boolean; readonly nutritionSuppressed: boolean; readonly stale: boolean }): readonly string[] {
  const notices: string[] = [];
  if (input.isDemoData) notices.push("Demodata används som reservkälla.");
  if (input.isDemoRecipes) notices.push("Demorecept används som reserv.");
  if (input.nutritionSuppressed) notices.push("Näringsvärden per portion visas inte eftersom täckningen är under 70 %.");
  if (input.stale) notices.push("Planens priser är äldre än 24 timmar.");
  return notices;
}
