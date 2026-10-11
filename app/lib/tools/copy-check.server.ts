// AI Bot Checker, server side: link mode only (docs/tools/spec.md T6). Pasted text is checked in the browser,
// or by the page's own render when JavaScript is off; nothing here sees it. For a product link we read the
// description with readProduct (check.server.ts: the guarded fetch, no private addresses, redirects checked
// hop by hop; up to 2 plain reads, the page and Shopify's product record; storeCountry stays off, so no
// /meta.json). It waits for a slot in toolFetchGate. Free: no paid calls. A thrown error's message is never shown.

import { readProduct } from "../check.server";
import { TtlCache, toolFetchGate } from "./limits.server";
import { URL_COPY } from "./copy/ai-bot-checker";

/** What the page needs from a product page: the description and where it came from. */
export interface LinkedDescription {
  /** The address we ended up reading (after redirects, tracking dropped). */
  url: string;
  domain: string;
  /** Plain text. readProduct keeps the first 1,500 characters (and ends it with an ellipsis when it cuts). */
  text: string;
  /** readProduct cut the description short. */
  clipped: boolean;
  /** Only the page's short summary (meta description), not the full description. */
  summaryOnly: boolean;
}

export type LinkOutcome = { ok: true; product: LinkedDescription } | { ok: false; status: 400 | 502; error: string };

/** Double submits within a minute get the same answer (and cost no new fetches). */
const recent = new TtlCache<LinkedDescription>(500);
const CACHE_MS = 60_000;
/** readProduct cuts descriptions to 1,500 characters and ends them with an ellipsis. */
const CLIP_AT = 1_500;

/** Forget cached reads (tests only). */
export function clearCopyCache() {
  recent.clear();
}

/**
 * Read the description of one product page. `url` comes from normalizeCheckUrl (https, no tracking
 * parameters, not a marketplace). Never throws: anything that goes wrong gets our one plain sentence.
 */
export async function readLinkedDescription(url: string): Promise<LinkOutcome> {
  const cached = recent.get(url);
  if (cached) return { ok: true, product: cached };

  let read: Awaited<ReturnType<typeof readProduct>>;
  try {
    read = await toolFetchGate.run(() => readProduct(url));
  } catch {
    // Unreachable, turned away, not a page we can read, or no product on it: the same plain words.
    return { ok: false, status: 502, error: URL_COPY.noDescription };
  }
  const text = (read.description ?? "").trim();
  if (!text) return { ok: false, status: 400, error: URL_COPY.noDescription };

  const product: LinkedDescription = {
    url: read.url,
    domain: read.domain,
    text,
    clipped: text.endsWith("\u2026") && text.length >= CLIP_AT - 100,
    summaryOnly: read.descriptionSource === "meta",
  };
  recent.set(url, product, CACHE_MS);
  return { ok: true, product };
}
