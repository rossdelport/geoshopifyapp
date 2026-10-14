/* eslint-disable @typescript-eslint/no-explicit-any -- reads raw third-party JSON of many shapes */
// Treg = one gateway for all outside data (AI answers, keyword volume, emails).
// HTTP: POST/GET https://treg.to/call/<endpoint_id> with the X-Treg-Token header.
// The provider's response comes back unchanged. One function per job below.

import { env } from "./env.server";
import { recordCost } from "./cost.server";
import type { Engine } from "./plans";
import { normalizeAnswer, type EngineAnswer } from "./answers";
import { envLimit, gate } from "./gate";

// At most this many Treg calls open at once in this process (free checks and stores' scans together).
// The rest wait their turn; their timeout only starts once they're sent.
export const tregGate = gate(() => envLimit("TREG_MAX_OPEN", 40));

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
  "scrapecreators.reddit.search.posts": 0.00188,
  "anyapi.reddit.search": 0.0012,
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
  const { res, text } = await tregGate.run(() => send(url, method, endpointId, opts));
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

/** One HTTP call to Treg, body read in full (the gate's slot is held until then). */
async function send(url: string, method: "GET" | "POST", endpointId: string, opts: CallOptions): Promise<{ res: Response; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 100_000);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "X-Treg-Token": env.tregToken,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
      signal: controller.signal,
    });
    return { res, text: await res.text() };
  } catch (err) {
    throw new TregError(`Network error: ${(err as Error).message}`, 0, endpointId);
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Country helpers ----------

// DataForSEO / Google Ads country codes (2000 + the ISO number). Stores sell worldwide: keep this in
// step with MARKET_COUNTRIES in countries.ts. A country not listed is checked as a shopper in the US.
const LOCATION_CODES: Record<string, number> = {
  US: 2840, GB: 2826, CA: 2124, AU: 2036, NZ: 2554, IE: 2372,
  AE: 2784, AT: 2040, BE: 2056, BR: 2076, CH: 2756, DE: 2276, DK: 2208, ES: 2724, FI: 2246,
  FR: 2250, HK: 2344, IN: 2356, IT: 2380, JP: 2392, MX: 2484, MY: 2458, NL: 2528, NO: 2578,
  PH: 2608, PL: 2616, PT: 2620, SE: 2752, SG: 2702, ZA: 2710,
};
const GOOGLE_DOMAINS: Record<string, string> = {
  AU: "google.com.au", NZ: "google.co.nz", GB: "google.co.uk", CA: "google.ca", IE: "google.ie",
};
export const locationCode = (country: string) => LOCATION_CODES[(country ?? "").toUpperCase()] ?? LOCATION_CODES.US;

/** The country every provider is asked as: the store's own when we have it, else the US (never a mix in one scan). */
export const scanCountry = (country: string | null | undefined): string => {
  const c = (country ?? "").trim().toUpperCase();
  return LOCATION_CODES[c] ? c : "US";
};

// ---------- AI answers ----------

type Attempt = { endpoint: string; run: () => Promise<any> };

// Countries cloro refuses (its own docs, checked October 2026). For these the DataForSEO attempt goes
// first, instead of a refused cloro call before every answer. Of our markets that's Hong Kong.
const CLORO_REFUSED = new Set(["CN", "CZ", "HK", "IR", "MO", "RU", "VE"]);

function attemptsFor(engine: Engine, prompt: string, country: string, shopId?: string): Attempt[] {
  const c = scanCountry(country);
  const all = providerAttempts(engine, prompt, c, shopId);
  const usable = CLORO_REFUSED.has(c) ? all.filter((a) => !a.endpoint.startsWith("cloro.")) : all;
  return usable.length ? usable : all;
}

function providerAttempts(engine: Engine, prompt: string, c: string, shopId?: string): Attempt[] {
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
    body: [{ keywords: clean, location_code: locationCode(scanCountry(country)), language_code: "en" }],
    shopId,
  });
  const out: Record<string, number> = {};
  for (const row of raw?.tasks?.[0]?.result ?? []) {
    if (row?.keyword) out[String(row.keyword).toLowerCase()] = Number(row.search_volume) || 0;
  }
  return out;
}

// ---------- Author email ----------

export interface AuthorInfo {
  email: string | null;
  name: string | null;
  position: string | null;
  company: string | null;
  linkedin: string | null;
  twitter: string | null;
}

/** The writer of an article (Tomba author finder, about US$0.009): name, email, role, company, LinkedIn and X. */
export async function findAuthor(articleUrl: string, shopId?: string): Promise<AuthorInfo> {
  const empty = { email: null, name: null, position: null, company: null, linkedin: null, twitter: null };
  try {
    const raw = await tregCall("tomba.people.email.find.author", {
      method: "GET",
      query: { url: articleUrl },
      shopId,
      timeoutMs: 30_000,
    });
    const d = raw?.data ?? {};
    const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null);
    const link = (v: unknown) => {
      const t = text(v);
      return t && /^https?:\/\//i.test(t) ? t : null;
    };
    return {
      email: text(d.email),
      name: text(d.full_name) || text([d.first_name, d.last_name].filter(Boolean).join(" ")),
      position: text(d.position),
      company: text(d.company),
      linkedin: link(d.linkedin),
      twitter: link(d.twitter) ?? (text(d.twitter) ? `https://x.com/${text(d.twitter)!.replace(/^@/, "")}` : null),
    };
  } catch {
    return empty;
  }
}

export async function findAuthorEmail(articleUrl: string, shopId?: string): Promise<{ email: string | null; name: string | null }> {
  const a = await findAuthor(articleUrl, shopId);
  return { email: a.email, name: a.name };
}
