// Claude helper: ask for JSON that matches a zod schema, track the cost per shop.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { env } from "./env.server";
import { recordCost } from "./cost.server";

// USD per 1M tokens [input, output].
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};

let client: Anthropic | null = null;
function getClient() {
  if (!env.anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set");
  client ??= new Anthropic({ apiKey: env.anthropicKey, maxRetries: 3, timeout: 180_000 });
  return client;
}

export type ModelTier = "fast" | "smart";

interface AskOptions<S extends z.ZodType> {
  schema: S;
  system: string;
  prompt: string;
  tier?: ModelTier;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  shopId?: string | null;
  label: string; // for cost logs, e.g. "parse-answer"
}

/** Ask Claude and get back typed JSON. Throws if the model refuses or the JSON is unusable. */
export async function askJson<S extends z.ZodType>(opts: AskOptions<S>): Promise<z.infer<S>> {
  const smart = opts.tier === "smart";
  const model = smart ? env.modelSmart : env.modelFast;
  const response = await getClient().beta.messages.parse({
    model,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: {
      format: betaZodOutputFormat(opts.schema),
      effort: opts.effort ?? (smart ? "medium" : "low"),
    },
    // Smart model: if a safety check declines, the API retries on a fallback model.
    ...(smart ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });

  const [inPrice, outPrice] = PRICES[response.model] ?? PRICES[model] ?? [4, 20];
  const usd =
    ((response.usage.input_tokens + (response.usage.cache_creation_input_tokens ?? 0)) * inPrice +
      response.usage.output_tokens * outPrice) /
    1_000_000;
  await recordCost(opts.shopId, "anthropic", `${opts.label}:${model}`, usd).catch(() => {});

  if (response.stop_reason === "refusal") throw new Error("Claude declined this request");
  if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of room (max_tokens)");
  if (!response.parsed_output) throw new Error("Claude returned no usable JSON");
  return response.parsed_output as z.infer<S>;
}

export const aiConfigured = () => Boolean(env.anthropicKey);
