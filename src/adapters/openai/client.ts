import OpenAI from "openai";

import { RecipeGenerationError } from "./errors";

let client: OpenAI | undefined;

export function getOpenAiClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new RecipeGenerationError("missing_api_key", "OPENAI_API_KEY is not configured");
  }
  client ??= new OpenAI({ apiKey, maxRetries: 0 });
  return client;
}
