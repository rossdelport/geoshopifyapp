// Product Schema Checker, server side: fetch a product page the way a crawler first sees it (no JavaScript)
// and, for Shopify product links, the store's public product record (/products/<handle>.js) to compare
// price and stock, then check the page's product data (schema.ts). Free: two plain reads per check, no paid
// calls. Both go through the guarded fetch (no private addresses, redirects checked hop by hop) and wait for
// a slot in toolFetchGate. A thrown error's message is never shown.

import { cleanCheckUrl, shopifyHandle } from "../check-read";
import { checkSchema, parseShopifyRecord, type SchemaReport, type ShopifyRecord } from "./schema";
import { fetchSiteFile, HTML_ACCEPT, HTML_PAGE_BYTES, outcomeMessage, TEXT_FILE_BYTES, type FetchOutcome } from "./fetch.server";
import { TtlCache } from "./limits.server";
import { URL_COPY } from "./copy/product-schema-checker";

/** What the page shows for a checked link: the address we ended up reading, and the report. */
export interface UrlCheck {
  url: string;
  /** True when Shopify's product record was read and compared. */
  record: boolean;
  report: SchemaReport;
}

export type UrlOutcome = { ok: true; check: UrlCheck } | { ok: false; status: 400 | 502; error: string };

export interface SchemaDeps {
  page: (url: string) => Promise<FetchOutcome>;
  record: (url: string) => Promise<FetchOutcome>;
}

const defaultDeps: SchemaDeps = {
  // docs/tools/spec.md T3: the page 2 MB and 10 s, the record 512 KB and 5 s.
  page: (url) => fetchSiteFile(url, { accept: HTML_ACCEPT, maxBytes: HTML_PAGE_BYTES, timeoutMs: 10_000 }),
  record: (url) => fetchSiteFile(url, { accept: "application/json", maxBytes: TEXT_FILE_BYTES, timeoutMs: 5_000 }),
};

/** Double submits within a minute get the same answer (and cost no new fetches). */
const recent = new TtlCache<UrlCheck>(500);
const CACHE_MS = 60_000;

/** Forget cached checks (tests only). */
export function clearSchemaCache() {
  recent.clear();
}

/** True when the page we ended up on is Shopify's password page (/password, after redirects). */
function isPasswordPage(url: string): boolean {
  try {
    return new URL(url).pathname.replace(/\/+$/, "").toLowerCase() === "/password";
  } catch {
    return false;
  }
}

/** Shopify's product record, or null when it's missing, blocked, not JSON or not a product. */
function readRecord(o: FetchOutcome): ShopifyRecord | null {
  if (o.kind !== "ok" || o.html) return null;
  try {
    return parseShopifyRecord(JSON.parse(o.text));
  } catch {
    return null;
  }
}

/**
 * Check one product link. `url` comes from normalizeCheckUrl (https, no tracking parameters, not a
 * marketplace). Never throws: a page we can't read gives the shared copy, a missing page our own.
 */
export async function checkProductUrl(url: string, deps: SchemaDeps = defaultDeps): Promise<UrlOutcome> {
  const cached = recent.get(url);
  if (cached) return { ok: true, check: cached };

  const handle = shopifyHandle(url);
  const recordUrl = handle ? `${new URL(url).origin}/products/${handle}.js` : null;
  const never = (): FetchOutcome => ({ kind: "unreachable" });
  const [page, rec] = await Promise.all([deps.page(url).catch(never), recordUrl ? deps.record(recordUrl).catch(never) : null]);

  if (page.kind === "missing") return { ok: false, status: 400, error: URL_COPY.missing };
  if (page.kind !== "ok") return { ok: false, status: 502, error: outcomeMessage(page) ?? URL_COPY.missing };
  // A password-protected Shopify store answers every page with its password page: never "no product data".
  if (isPasswordPage(page.url)) return { ok: false, status: 400, error: URL_COPY.password };

  const record = rec ? readRecord(rec) : null;
  const report = checkSchema(page.text, { source: "page", record, url: page.url });
  const check: UrlCheck = { url: cleanCheckUrl(page.url), record: record !== null, report };
  recent.set(url, check, CACHE_MS);
  return { ok: true, check };
}
