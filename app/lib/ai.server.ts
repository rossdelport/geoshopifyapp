// Claude helper: ask for JSON that matches a zod schema, track the cost per shop.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { env } from "./env.server";
import { recordCost } from "./cost.server";
import { envLimit, gate } from "./gate";

// USD per 1M tokens [input, output].
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};

// House style for text a person reads (fixes, pitches, profiles, questions, reports). Calls that only
// extract data (parse-answer) leave it off. Stores sell worldwide, so spelling follows the country the
// prompt names (the store's, or the shopper's in the free check), with US spelling when none is named.
export const STYLE_RULE =
  "Writing style for any text a person will read: never use an em dash or a spaced en dash as punctuation. Use a full stop, comma, colon or the word 'and' instead. Write ranges with 'to' (3 to 4, $20 to $300). Spell words the way people in the store's or shopper's country do when the prompt names one; otherwise use US spelling.";

// At most this many Claude calls open at once in this process; the rest wait their turn. Keeps a busy
// moment (two free checks and a store scan) under the rate limit instead of failing over to text matching.
export const claudeGate = gate(() => envLimit("CLAUDE_MAX_OPEN", 16));

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
  style?: boolean; // add the house writing style (default true; false for calls that only extract data)
}

/** Ask Claude and get back typed JSON. Throws if the model refuses or the JSON is unusable. */
export async function askJson<S extends z.ZodType>(opts: AskOptions<S>): Promise<z.infer<S>> {
  const smart = opts.tier === "smart";
  const model = smart ? env.modelSmart : env.modelFast;
  const response = await claudeGate.run(() =>
    getClient().beta.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 8000,
      system: opts.style === false ? opts.system : `${opts.system}\n\n${STYLE_RULE}`,
      messages: [{ role: "user", content: opts.prompt }],
      output_config: {
        format: betaZodOutputFormat(opts.schema),
        effort: opts.effort ?? (smart ? "medium" : "low"),
      },
      // Smart model: if a safety check declines, the API retries on a fallback model.
      ...(smart ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    }),
  );

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

interface ChatOptions<S extends z.ZodType> {
  schema: S;
  /** Stable instructions and knowledge: cached, so repeat messages read it at a tenth of the price. */
  system: string;
  /** Per-request facts (the person's store): after the cache breakpoint, so they don't break the cache. */
  context: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  shopId?: string | null;
  label: string;
}

/** A multi-turn chat that answers in typed JSON (Ask GEO). Smart model, low effort, cached system prompt. */
export async function chatJson<S extends z.ZodType>(opts: ChatOptions<S>): Promise<z.infer<S>> {
  const model = env.modelSmart;
  const response = await claudeGate.run(() =>
    getClient().beta.messages.parse({
      model,
      max_tokens: opts.maxTokens ?? 4000,
      system: [
        { type: "text", text: `${opts.system}\n\n${STYLE_RULE}`, cache_control: { type: "ephemeral" } },
        { type: "text", text: opts.context },
      ],
      messages: opts.messages,
      output_config: { format: betaZodOutputFormat(opts.schema), effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default" as const,
    }),
  );

  const [inPrice, outPrice] = PRICES[response.model] ?? PRICES[model] ?? [4, 20];
  const u = response.usage;
  const usd =
    (u.input_tokens * inPrice +
      (u.cache_creation_input_tokens ?? 0) * inPrice * 1.25 +
      (u.cache_read_input_tokens ?? 0) * inPrice * 0.1 +
      u.output_tokens * outPrice) /
    1_000_000;
  await recordCost(opts.shopId, "anthropic", `${opts.label}:${model}`, usd).catch(() => {});

  if (response.stop_reason === "refusal") throw new Error("Claude declined this request");
  if (response.stop_reason === "max_tokens") throw new Error("Claude ran out of room (max_tokens)");
  if (!response.parsed_output) throw new Error("Claude returned no usable JSON");
  return response.parsed_output as z.infer<S>;
}
