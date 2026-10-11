// Response headers for the public tool pages. Every tool route exports `headers = toolHeaders`:
// a child route without its own `headers` copies its parent's and would lose its action's headers.
// Pure (no server imports), so route modules can import it freely.

import type { HeadersFunction } from "react-router";

/** Sent with every tool page. */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
} as const;

/**
 * For results a visitor asked for (a POST): never cached, never indexed. Return it from actions as
 * `data(result, { headers: noStore })`. No result ever gets its own URL.
 */
export const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } as const;

/** Normal page views: browsers may keep the page for 5 minutes (no CDN sits in front). */
const PAGE_CACHE = "public, max-age=300";

function withSecurity(from?: Headers): Headers {
  const out = new Headers(from);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.set(k, v);
  return out;
}

/**
 * The action's headers when it set Cache-Control (a POST result: no-store, noindex), else the loader's
 * when it set them (the 404 page), else the normal page cache. Errors are never cached.
 */
export const toolHeaders: HeadersFunction = ({ actionHeaders, loaderHeaders, errorHeaders }) => {
  if (errorHeaders) return withSecurity(new Headers({ "Cache-Control": "no-store" }));
  if (actionHeaders?.has("Cache-Control")) return withSecurity(actionHeaders);
  if (loaderHeaders?.has("Cache-Control")) return withSecurity(loaderHeaders);
  return withSecurity(new Headers({ "Cache-Control": PAGE_CACHE }));
};
