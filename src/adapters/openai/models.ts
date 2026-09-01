import { getOpenAiClient } from "./client";
import { RecipeGenerationError } from "./errors";

export const MODEL_DEFAULTS = {
  recipeCandidates: ["gpt-4.1", "gpt-5.4", "gpt-5.6-terra"] as const,
};

export interface VerifiedModels {
  readonly recipe: string;
  readonly recipeFallback: string;
}

let verified: Promise<VerifiedModels> | undefined;

function candidates(envValue: string | undefined, defaults: readonly string[]): string[] {
  const configured = envValue?.split(",").map((id) => id.trim()).filter(Boolean);
  return [...new Set(configured?.length ? configured : defaults)];
}

async function supportsStructuredResponses(model: string): Promise<boolean> {
  try {
    const response = await getOpenAiClient().responses.create({
      model,
      input: "Returnera {\"ok\":true}.",
      text: {
        format: {
          type: "json_schema",
          name: "model_health",
          strict: true,
          schema: {
            type: "object",
            properties: { ok: { type: "boolean", const: true } },
            required: ["ok"],
            additionalProperties: false,
          },
        },
      },
      max_output_tokens: 256,
    }, { timeout: 15_000 });
    return response.status === "completed" && response.output_text.includes('"ok":true');
  } catch {
    return false;
  }
}

async function resolvePair(
  kind: string,
  requested: string[],
  available: ReadonlySet<string>,
  support: ReadonlyMap<string, boolean>,
): Promise<readonly [string, string]> {
  const present = requested.filter((model) => available.has(model));
  const supported = present.filter((model) => support.get(model));
  if (supported.length < 2) {
    throw new RecipeGenerationError(
      "model_unavailable",
      `Could not resolve primary and fallback ${kind} models with Responses API structured-output support`,
    );
  }
  return [supported[0], supported[1]];
}

export function verifyModels(): Promise<VerifiedModels> {
  verified ??= (async () => {
    const recipeCandidates = candidates(process.env.OPENAI_RECIPE_MODELS, MODEL_DEFAULTS.recipeCandidates);
    const available = new Set((await getOpenAiClient().models.list()).data.map((model) => model.id));
    const probeCandidates = recipeCandidates.filter((model) => available.has(model));
    const probeResults = await Promise.all(
      probeCandidates.map(async (model) => [model, await supportsStructuredResponses(model)] as const),
    );
    const support = new Map(probeResults);
    const recipe = await resolvePair("recipe", recipeCandidates, available, support);
    return {
      recipe: recipe[0],
      recipeFallback: recipe[1],
    };
  })();
  return verified;
}

export function resetModelVerificationForTests(): void {
  verified = undefined;
}
