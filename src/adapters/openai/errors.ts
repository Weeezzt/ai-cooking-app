export type RecipeGenerationErrorCode =
  | "missing_api_key"
  | "deadline_exceeded"
  | "model_unavailable"
  | "invalid_output"
  | "provider_failure";

export class RecipeGenerationError extends Error {
  readonly name = "RecipeGenerationError";

  constructor(
    readonly code: RecipeGenerationErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}
