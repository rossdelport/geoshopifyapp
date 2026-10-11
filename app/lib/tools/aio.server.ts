// The AI Overview Checker's live search: one Google search through Treg, kept for 24 hours.
// Crawl4AI first (the real results page, US$0.00015), AnyAPI only when that fails, times out or gives
// no usable page (US$0.0015 to US$0.0018; docs/tools/spec.md 0.1). Each live search passes three
// guards, in order: the 24-hour cache (repeats are free and never count), the database spend cap
// (survives deploys), then the per-visitor and daily limits. Failures are never cached and never shown
// raw, and no visitor waits more than WAIT_MS.

import db from "../../db.server";
import { recordCost } from "../cost.server";
import { tregCall } from "../treg.server";
import { normalizeQuery, parseAnyApi, parseCrawl4ai, type AioResult } from "./aio";
import { FAIL_COPY, SPEND_COPY } from "./copy/ai-overview-checker";
import { LIMIT_STATUS, TOOL_LIMITS, TtlCache, takeToolSlot } from "./limits.server";
import { AIO_SAMPLE } from "./samples/aio-sample";

export const CRAWL4AI_ENDPOINT = "crawl4ai.google.serp.organic";
export const ANYAPI_ENDPOINT = "anyapi.google.serp.ai_overview";
/** Treg catalog price per Crawl4AI page (verified 9 Oct 2026). Crawl4AI reports its charge only in a header, so tregCall logs 0. */
export const CRAWL4AI_USD = 0.00015;

const DAY = 24 * 60 * 60 * 1000;
/**
 * The longest a visitor waits. Both providers together time out after 50 seconds, but Treg calls also
 * queue behind the app's own scans (tregGate), so the page gives up first; a late answer is still kept.
 */
export const WAIT_MS = 60_000;

/** One result per search for 24 hours (the visitor's website isn't part of the key). */
export const aioCache = new TtlCache<AioResult>(1_000);

/**
 * The example search on the page is already answered, so trying it costs no live search for the first
 * day after each start (the seed then expires like any result, and the next try searches live).
 */
export function seedAioCache() {
  aioCache.set(normalizeQuery(AIO_SAMPLE.query), AIO_SAMPLE, DAY);
}
seedAioCache();

/** Live searches already on their way, so two visitors asking at once share one paid call. */
const inflight = new Map<string, Promise<AioResult | null>>();

/** A number from the environment; unset or unreadable means the default, and 0 means 0 (live searches off). */
function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw?.trim() ? Number(raw) : fallback;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** True when the free Google checks spent today's budget (GEO_TOOLS_USD_PER_DAY, default US$2, last 24 hours). */
export async function overToolsSpendCap(): Promise<boolean> {
  const cap = envNumber("GEO_TOOLS_USD_PER_DAY", 2);
  const sum = await db.apiCost.aggregate({
    _sum: { usd: true },
    where: { shopId: null, endpoint: { in: [CRAWL4AI_ENDPOINT, ANYAPI_ENDPOINT] }, createdAt: { gte: new Date(Date.now() - DAY) } },
  });
  return (sum._sum.usd ?? 0) >= cap;
}

/** Crawl4AI, then AnyAPI. Null when neither gave a usable answer. */
async function searchGoogle(query: string): Promise<AioResult | null> {
  const checkedAt = new Date().toISOString();
  try {
    const raw = await tregCall(CRAWL4AI_ENDPOINT, { method: "GET", query: { q: query, country: "us", language: "en" }, timeoutMs: 20_000, shopId: null });
    // Any answer may be charged (only errors are free), so it counts toward the spend cap even when unusable.
    await recordCost(null, "treg", CRAWL4AI_ENDPOINT, CRAWL4AI_USD).catch((err) => console.error("[aio] cost not recorded:", (err as Error).message));
    // Crawl4AI may answer from its own recent copy of the page; `age_s` says how old it is.
    const age = Number(raw?.age_s);
    const seen = Number.isFinite(age) && age > 0 && age < DAY / 1000 ? new Date(Date.now() - age * 1000).toISOString() : checkedAt;
    const result = parseCrawl4ai(raw, query, seen);
    if (result) return result;
    console.warn("[aio] Crawl4AI answered without a usable results page; trying AnyAPI");
  } catch (err) {
    console.warn("[aio] Crawl4AI failed; trying AnyAPI:", (err as Error).message);
  }
  try {
    // tregCall records AnyAPI's own reported charge (costUsd).
    const raw = await tregCall(ANYAPI_ENDPOINT, { body: { prompt: query }, timeoutMs: 30_000, shopId: null });
    const result = parseAnyApi(raw, query, checkedAt);
    if (result) return result;
    console.warn("[aio] AnyAPI answered without an overview field");
  } catch (err) {
    console.warn("[aio] AnyAPI failed:", (err as Error).message);
  }
  return null;
}

export type AioCheck = { ok: true; result: AioResult; cached: boolean } | { ok: false; status: number; error: string };

/** A shared answer, labelled with this visitor's own words ("Beard oil?" and "beard oil" share one search). */
const asAsked = (result: AioResult, query: string): AioResult => (result.query === query ? result : { ...result, query });

/** Keep a result for 24 hours from when Google showed it (Crawl4AI's own copy may already be hours old). */
function keepFor(result: AioResult): number {
  const age = Date.now() - Date.parse(result.checkedAt);
  return Number.isFinite(age) && age > 0 ? Math.max(60_000, DAY - age) : DAY;
}

/**
 * The AI Overview for a search (already checked with checkQuery). Cached answers and searches already on
 * their way are free and don't count toward the visitor's limits; a live search does.
 */
export async function checkAio(query: string, ipHash: string): Promise<AioCheck> {
  const key = normalizeQuery(query);
  const hit = aioCache.get(key);
  if (hit) return { ok: true, result: asAsked(hit, query), cached: true };

  let pending = inflight.get(key);
  if (!pending) {
    try {
      if (await overToolsSpendCap()) return { ok: false, status: LIMIT_STATUS, error: SPEND_COPY };
    } catch (err) {
      console.error("[aio] spend cap check failed:", (err as Error).message);
      return { ok: false, status: 502, error: FAIL_COPY };
    }
    const slot = takeToolSlot("aio", ipHash, TOOL_LIMITS.aio);
    if (!slot.ok) return { ok: false, status: LIMIT_STATUS, error: slot.error };
    pending = inflight.get(key); // another visitor may have started it while we checked the cap
    if (!pending) {
      pending = searchGoogle(query)
        .then((found) => {
          if (found) aioCache.set(key, found, keepFor(found)); // kept even when every visitor stopped waiting
          return found;
        })
        .finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const gaveUp = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), WAIT_MS);
  });
  const result = await Promise.race([pending, gaveUp]).finally(() => clearTimeout(timer));
  if (!result) return { ok: false, status: 502, error: FAIL_COPY };
  return { ok: true, result: asAsked(result, query), cached: false };
}

/** Forget cached and in-flight searches, then re-seed the example (tests only). */
export function resetAio() {
  aioCache.clear();
  inflight.clear();
  seedAioCache();
}
