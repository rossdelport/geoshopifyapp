/* eslint-disable @typescript-eslint/no-explicit-any -- reads raw third-party JSON of many shapes */
// Treg = one gateway for all outside data (AI answers, keyword volume, emails).
// HTTP: POST/GET https://treg.to/call/<endpoint_id> with the X-Treg-Token header.
// The provider's response comes back unchanged. One function per job below.

import { env } from "./env.server";
import { recordCost } from "./cost.server";
import type { Engine } from "./plans";
import { normalizeAnswer, type EngineAnswer } from "./answers";

// Approximate prices (USD per call) from the Treg catalog, used for cost tracking
// when the response doesn't report its own cost.
const PRICES: Record<string, number> = {
  "cloro.ai-search.chatgpt.scrape": 0.0036,
  "dataforseo.x.ai-optimization-chat-gpt-llm-scraper-live-advanced": 0.004,
  "cloro.ai-search.gemini.scrape": 0.0024,
  "dataforseo.x.ai-optimization-gemini-llm-scraper-live-advanced": 0.004,
  "dataforseo.x.ai-optimization-perplexity-llm-responses-live": 0.0059,
  "cloro.ai-search.perplexity.answer": 0.0024,
  "litescrape.google.serp.ai_overview": 0.00015,
  "anyapi.google.serp.ai_overview": 0.0018,
  "dataforseo.x.ai-optimization-claude-llm-responses-live": 0.0245,
  "dataforseo.google.keywords.volume": 0.09,
  "tomba.people.email.find.author": 0.0089,
};

export class TregError extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
  ) {
    super(message);
  }
}

interface CallOptions {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  shopId?: string | null;
}

export async function tregCall<T = any>(endpointId: string, opts: CallOptions = {}): Promise<T> {
  if (!env.tregToken) throw new TregError("TREG_API_KEY is not set", 0, endpointId);
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const url = `${env.tregBaseUrl}/call/${endpointId}${qs.size ? `?${qs}` : ""}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 100_000);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "X-Treg-Token": env.tregToken,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new TregError(`Network error: ${(err as Error).message}`, 0, endpointId);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new TregError(`HTTP ${res.status}: ${text.slice(0, 300)}`, res.status, endpointId);
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new TregError(`Bad JSON from ${endpointId}`, res.status, endpointId);
  }
  // Use the exact charge when the provider reports it (DataForSEO: cost, AnyAPI: costUsd).
  const reported = Number(json?.cost ?? json?.output?.costUsd ?? json?.costUsd);
  const cost = Number.isFinite(reported) && reported > 0 ? reported : PRICES[endpointId] ?? 0;
  await recordCost(opts.shopId, "treg", endpointId, cost).catch(() => {});
  return json as T;
}

// ---------- Country helpers ----------

const LOCATION_CODES: Record<string, number> = {
  AU: 2036, NZ: 2554, US: 2840, GB: 2826, CA: 2124, IE: 2372,
};
const GOOGLE_DOMAINS: Record<string, string> = {
  AU: "google.com.au", NZ: "google.co.nz", GB: "google.co.uk", CA: "google.ca", IE: "google.ie",
};
export const locationCode = (country: string) => LOCATION_CODES[country] ?? 2036;

// ---------- AI answers ----------

type Attempt = { endpoint: string; run: () => Promise<any> };

function attemptsFor(engine: Engine, prompt: string, country: string, shopId?: string): Attempt[] {
  const c = country.toUpperCase();
  const loc = locationCode(c);
  const call = (endpoint: string, o: CallOptions) => ({
    endpoint,
    run: () => tregCall(endpoint, { ...o, shopId }),
  });
  switch (engine) {
    case "chatgpt":
      return [
        call("cloro.ai-search.chatgpt.scrape", {
          body: { prompt, country: c, include: { markdown: true, shopping: true } },
        }),
        call("dataforseo.x.ai-optimization-chat-gpt-llm-scraper-live-advanced", {
          body: [{ keyword: prompt, location_code: loc, language_code: "en", force_web_search: true }],
        }),
      ];
    case "gemini":
      return [
        call("cloro.ai-search.gemini.scrape", {
          body: { prompt, country: c, include: { markdown: true } },
        }),
        call("dataforseo.x.ai-optimization-gemini-llm-scraper-live-advanced", {
          body: [{ keyword: prompt, location_code: loc, language_code: "en" }],
        }),
      ];
    case "perplexity":
      return [
        call("dataforseo.x.ai-optimization-perplexity-llm-responses-live", {
          body: [{ user_prompt: prompt, model_name: "sonar", web_search_country_iso_code: c, max_output_tokens: 1500 }],
        }),
        call("cloro.ai-search.perplexity.answer", {
          body: { prompt, country: c, include: { markdown: true } },
        }),
      ];
    case "aio":
      return [
        call("litescrape.google.serp.ai_overview", {
          method: "GET",
          query: { q: prompt, gl: c.toLowerCase(), hl: "en", google_domain: GOOGLE_DOMAINS[c] ?? "google.com" },
        }),
        call("anyapi.google.serp.ai_overview", { body: { prompt } }),
      ];
    case "claude":
      return [
        call("dataforseo.x.ai-optimization-claude-llm-responses-live", {
          body: [{
            user_prompt: prompt,
            model_name: "claude-sonnet-4-5",
            web_search: true,
            web_search_country_iso_code: c,
            max_output_tokens: 1500,
          }],
        }),
      ];
  }
}

/** Ask one AI engine one question. Tries the main provider, then the backup. */
export async function askEngine(
  engine: Engine,
  prompt: string,
  country: string,
  shopId?: string,
): Promise<EngineAnswer> {
  const errors: string[] = [];
  for (const attempt of attemptsFor(engine, prompt, country, shopId)) {
    try {
      const raw = await attempt.run();
      const answer = normalizeAnswer(attempt.endpoint, raw);
      if (answer.text || answer.empty) return { ...answer, provider: attempt.endpoint };
      errors.push(`${attempt.endpoint}: empty answer`);
    } catch (err) {
      errors.push(`${attempt.endpoint}: ${(err as Error).message}`);
    }
  }
  throw new Error(errors.join(" | "));
}

// ---------- Keyword volume ----------

/** Monthly Google searches for each keyword (one paid call for up to 1,000 keywords). */
export async function keywordVolumes(
  keywords: string[],
  country: string,
  shopId?: string,
): Promise<Record<string, number>> {
  const clean = [...new Set(keywords.map((k) => k.toLowerCase().trim()).filter(Boolean))]
    .filter((k) => k.length <= 80 && k.split(/\s+/).length <= 10)
    .slice(0, 1000);
  if (!clean.length) return {};
  const raw = await tregCall("dataforseo.google.keywords.volume", {
    body: [{ keywords: clean, location_code: locationCode(country), language_code: "en" }],
    shopId,
  });
  const out: Record<string, number> = {};
  for (const row of raw?.tasks?.[0]?.result ?? []) {
    if (row?.keyword) out[String(row.keyword).toLowerCase()] = Number(row.search_volume) || 0;
  }
  return out;
}

// ---------- Author email ----------

export async function findAuthorEmail(
  articleUrl: string,
  shopId?: string,
): Promise<{ email: string | null; name: string | null }> {
  try {
    const raw = await tregCall("tomba.people.email.find.author", {
      method: "GET",
      query: { url: articleUrl },
      shopId,
      timeoutMs: 30_000,
    });
    const d = raw?.data ?? {};
    const name = d.full_name || [d.first_name, d.last_name].filter(Boolean).join(" ") || null;
    return { email: d.email || null, name };
  } catch {
    return { email: null, name: null };
  }
}
