import { z } from "zod";

export const RecipeInputProjectionSchema = z
  .object({
    portions: z.number().int().positive().finite(),
    vibe: z.string(),
    dietary: z.array(z.string()),
    options: z.array(
      z
        .object({
          optionId: z.string().min(1),
          concept: z.string(),
          label: z.string(),
          form: z.string(),
          coarseCategory: z.string(),
          dietaryTags: z.array(z.string()),
        })
        .strict(),
    ),
  })
  .strict();

const RequirementRoleSchema = z.enum(["core", "supporting", "optional_garnish"]);

export const RecipeRequirementDraftSchema = z
  .object({
    optionId: z.string().min(1),
    requiredGrams: z.number().finite().positive().nullable(),
    requiredMl: z.number().finite().positive().nullable(),
    requiredCount: z.number().finite().positive().nullable(),
    role: RequirementRoleSchema,
  })
  .strict();

export const RecipeStepDraftSchema = z
  .object({
    text: z.string().min(1),
    durationSeconds: z.number().int().positive().finite(),
    optionRefs: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const RecipeDraftSchema = z
  .object({
    title: z.string().min(1),
    portions: z.number().int().positive().finite(),
    requirements: z.array(RecipeRequirementDraftSchema).min(1),
    steps: z.array(RecipeStepDraftSchema).min(1),
    estimatedCookMinutes: z.number().int().positive().finite(),
    explanation: z.string().min(1),
  })
  .strict();

export const AI_SCHEMAS = [RecipeInputProjectionSchema, RecipeDraftSchema] as const;

export type ParsedRecipeDraft = z.infer<typeof RecipeDraftSchema>;
