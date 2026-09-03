import { z } from "zod";

export const RecipeInputProjectionSchema = z
  .object({
    portions: z.number().int().positive().finite(),
    vibe: z.string(),
    dietary: z.array(z.string()),
    maxCookMinutes: z.number().int().positive().nullable(),
    pantry: z.array(z.string()),
    budgetTier: z.enum(["snav", "lagom", "generos"]),
  })
  .strict();

const StoreSectionSchema = z.enum(["FRUKT & GRÖNT", "KÖTT & PROTEIN", "MEJERI", "TORRVAROR", "KRYDDOR", "ÖVRIGT"]);
const IngredientRoleSchema = z.enum(["huvud", "komplement", "garnering"]);

export const RecipeIngredientDraftSchema = z
  .object({
    namn: z.string().min(1),
    mangd: z.number().finite().positive(),
    enhet: z.enum(["g", "ml", "st"]),
    kategori: StoreSectionSchema,
    roll: IngredientRoleSchema,
  })
  .strict();

export const RecipeStepDraftSchema = z
  .object({
    text: z.string().min(1),
    ingredienser: z.array(z.string().min(1)),
    tidSek: z.number().int().nonnegative().finite(),
  })
  .strict();

export const RecipeDraftSchema = z
  .object({
    titel: z.string().min(1),
    forklaring: z.string().min(1),
    uppskattadTidMin: z.number().int().positive().finite(),
    ingredienser: z.array(RecipeIngredientDraftSchema).min(1),
    steg: z.array(RecipeStepDraftSchema).min(1),
  })
  .strict();

export const AI_SCHEMAS = [RecipeInputProjectionSchema, RecipeDraftSchema] as const;

export type ParsedRecipeDraft = z.infer<typeof RecipeDraftSchema>;
