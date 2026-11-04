// One canonical host for the public website: https://firstpicked.com.au (the rebrand from GEO, Ross 4 Nov 2026).
// The same Railway service can be reached on other addresses: www.firstpicked.com.au, the old usegeo.app and
// www.usegeo.app, and the *.up.railway.app address. A page viewed on any of them gets a 301 to the same path and
// query on https://firstpicked.com.au, so old links, bookmarks, sign-in emails and Google all land on the new site.
// What must keep working where it is never moves: the Shopify app (/app, /auth), webhooks, the tracking code's
// endpoint (/api/pixel: stores pasted code that posts to https://usegeo.app/api/pixel), /healthz, robots.txt
// (bots must read it, not be redirected), POSTs, React Router's data requests and any URL carrying Shopify's
// admin parameters. The root route's loader calls this for every page; resource routes (llms.txt, sitemap.xml)
// call it themselves.

import { redirect } from "react-router";
import { SITE, SITE_HOST } from "./site";

/** Query parameters Shopify adds when the admin opens the app: those visits must stay where they are. */
const SHOPIFY_PARAMS = ["shop", "host", "embedded", "hmac", "id_token"];

/** The old brand's addresses (GEO, until 4 Nov 2026). */
export const OLD_HOSTS = ["usegeo.app", "www.usegeo.app"];

/** Paths that stay on whatever host they were asked on. */
const STAYS = /^\/(app|auth|webhooks|api|healthz)(\/|$)|^\/robots\.txt$|\.data$/;

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

/** True for the hosts that should send visitors to the canonical site. */
const isOtherHost = (host: string) => host === `www.${SITE_HOST}` || OLD_HOSTS.includes(host) || host.endsWith(".up.railway.app");

/**
 * A 301 to https://firstpicked.com.au with the same path and query, when a page is viewed on another of our
 * addresses in production. Otherwise null. Loaders `throw` the response.
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
  if (STAYS.test(url.pathname)) return null;
  return redirect(`${SITE}${url.pathname}${url.search}`, 301);
}
