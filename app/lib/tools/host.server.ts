// One canonical host for the public website. Railway serves the same pages on usegeo.app, www.usegeo.app
// and the *.up.railway.app address, with no redirect between them (codebase-brief §1.7). Public page views
// on the other two get a 301 to https://usegeo.app. The Shopify app keeps working on the Railway address:
// /app, /auth, /webhooks, /api, /healthz and report pages are never redirected, nor is any URL carrying
// Shopify's admin parameters. robots.txt is served on every host (bots must read it, not be redirected).

import { redirect } from "react-router";
import { SITE, SITE_HOST } from "./site";

/** Query parameters Shopify adds when the admin opens the app: those visits must stay where they are. */
const SHOPIFY_PARAMS = ["shop", "host", "embedded", "hmac", "id_token"];

const EXACT_PUBLIC = new Set(["/", "/check", "/check/", "/tools", "/tools/", "/stories", "/stories/", "/privacy", "/privacy/", "/sitemap.xml", "/llms.txt"]);

function isPublicPath(path: string): boolean {
  if (path.endsWith(".data")) return false; // React Router's own data requests come from the page's host
  return EXACT_PUBLIC.has(path) || path.startsWith("/tools/") || path.startsWith("/stories/");
}

/** The host the visitor asked for: x-forwarded-host (Railway's proxy), else host, else the URL's. No port, lowercase. */
export function requestHost(request: Request): string {
  let raw = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host")?.trim() || "";
  if (!raw) {
    try {
      raw = new URL(request.url).host;
    } catch {
      raw = "";
    }
  }
  return raw.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

/** True for the hosts that should send visitors to usegeo.app. */
const isOtherHost = (host: string) => host === `www.${SITE_HOST}` || host.endsWith(".up.railway.app");

/**
 * A 301 to https://usegeo.app with the same path and query, when a public page is viewed on www or the
 * Railway address in production. Otherwise null. Loaders `throw` the response.
 */
export function publicHostRedirect(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (process.env.NODE_ENV !== "production") return null;
  if (!isOtherHost(requestHost(request))) return null;
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  if (SHOPIFY_PARAMS.some((p) => url.searchParams.has(p))) return null;
  if (!isPublicPath(url.pathname)) return null;
  return redirect(`${SITE}${url.pathname}${url.search}`, 301);
}
