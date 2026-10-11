// The website a visitor types into a site tool (AI crawler, llms.txt): "yourstore.com", a full link,
// or any page on the site. Pure and browser-safe. Unlike normalizeCheckUrl (product links), it accepts
// marketplaces and big retailers: anyone may check any site's robots.txt or llms.txt.
// The fetch itself still goes through safeFetch's SSRF guard (fetch.server.ts); this is the first check.

import { fetchableUrl, isBlockedHostname, isIpLiteral } from "../check-read";

export const SITE_INPUT_EMPTY = "Type your website, like yourstore.com.";
export const SITE_INPUT_BAD = "That doesn't look like a web address. Try something like yourstore.com.";

const MAX_INPUT = 2_000;

export type SiteInput = { ok: true; origin: string; host: string; path: string } | { ok: false; error: string };

/**
 * "YourStore.com/products/x?utm=1#top" -> { origin: "https://yourstore.com", host: "yourstore.com", path: "/products/x" }.
 * http and https only, no user or password, default ports only, a public-looking name with a dot
 * (no IP addresses, no localhost or internal names). Query and #hash are dropped.
 */
export function normalizeSiteInput(input: string): SiteInput {
  let raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: SITE_INPUT_EMPTY };
  if (raw.length > MAX_INPUT) return { ok: false, error: SITE_INPUT_BAD };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw.replace(/^\/+/, "")}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: SITE_INPUT_BAD };
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!fetchableUrl(u) || !host.includes(".") || isIpLiteral(host) || isBlockedHostname(host)) {
    return { ok: false, error: SITE_INPUT_BAD };
  }
  const port = u.port ? `:${u.port}` : "";
  return { ok: true, origin: `${u.protocol}//${host}${port}`, host, path: u.pathname || "/" };
}
