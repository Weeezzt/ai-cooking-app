/**
 * `RecipeGenerator` port (AD-2, AD-6). Canonical definition: `src/core/ports.ts`.
 *
 * The generation input is the sanitized projection from AD-6: opaque `optionId`s
 * plus generic culinary descriptors only — never a price, pack size, brand,
 * retailer, macro, or distance.
 */
export type {
  RecipeGenerator,
  RecipeGenerationInput,
  RecipeOptionHandle,
  RecipeRequirementDraft,
  RecipeStepDraft,
  RecipeDraft,
  PortCallOptions,
} from "@/core/ports";
