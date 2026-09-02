import type { RecipeDraft, RecipeGenerationInput, RecipeRequirementDraft } from "@/ports";

import type { ParsedRecipeDraft } from "./schema";

function quantityCount(requirement: ParsedRecipeDraft["requirements"][number]): number {
  return [requirement.requiredGrams, requirement.requiredMl, requirement.requiredCount].filter(
    (value) => value !== null,
  ).length;
}

export function validateRecipe(
  parsed: ParsedRecipeDraft,
  input: RecipeGenerationInput,
): { readonly recipe?: RecipeDraft; readonly issues: readonly string[] } {
  const known = new Set(input.options.map((option) => option.optionId));
  const issues: string[] = [];
  if (parsed.portions !== input.portions) issues.push(`portions ska vara ${input.portions}`);
  if (!parsed.requirements.some((requirement) => requirement.role === "core")) {
    issues.push("minst ett krav måste ha rollen core");
  }
  for (const requirement of parsed.requirements) {
    if (!known.has(requirement.optionId)) issues.push(`okänt optionId i krav: ${requirement.optionId}`);
    if (quantityCount(requirement) !== 1) {
      issues.push(`exakt en mängddimension krävs för ${requirement.optionId}`);
    }
  }
  for (const [index, step] of parsed.steps.entries()) {
    for (const ref of step.optionRefs) {
      if (!known.has(ref)) issues.push(`okänt optionId i steg ${index + 1}: ${ref}`);
    }
    if (!/\d/.test(step.text)) issues.push(`steg ${index + 1} saknar mängd eller tid i texten`);
  }
  if (issues.length > 0) return { issues };

  // Safety net: the model sometimes echoes an option handle inline in the
  // human-readable step text ("koka 400 g pasta (opt-coop_236018-733…)"). Strip
  // any `opt-…` token and tidy the leftover punctuation/whitespace — the handles
  // belong only in `optionRefs`.
  const cleanSteps = parsed.steps.map((step) => ({
    ...step,
    text: step.text
      .replace(/\s*\(\s*opt-[A-Za-z0-9_-]+\s*\)/g, "")
      .replace(/\s*opt-[A-Za-z0-9_-]+/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([.,;:])/g, "$1")
      .trim(),
  }));

  const requirements: RecipeRequirementDraft[] = parsed.requirements.map((requirement) => ({
    optionId: requirement.optionId,
    ...(requirement.requiredGrams === null ? {} : { requiredGrams: requirement.requiredGrams }),
    ...(requirement.requiredMl === null ? {} : { requiredMl: requirement.requiredMl }),
    ...(requirement.requiredCount === null ? {} : { requiredCount: requirement.requiredCount }),
    role: requirement.role,
  }));
  return {
    issues,
    recipe: {
      title: parsed.title,
      portions: parsed.portions,
      requirements,
      steps: cleanSteps,
      estimatedCookMinutes: parsed.estimatedCookMinutes,
      explanation: parsed.explanation,
    },
  };
}
