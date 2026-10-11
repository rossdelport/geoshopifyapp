// AI Crawler Checker, server side: read a site's live robots.txt and home page, pick the pages to test
// (the home page, the page the visitor typed, one product page and one collection page linked from the
// home page), and check every bot (crawler.ts). Free: two plain page reads per check, no paid calls.
// Both reads go through the guarded fetch (no private addresses, redirects checked hop by hop) and wait
// for a slot in toolFetchGate. We never pretend to be a bot (docs/tools/spec.md 0.9), so a firewall or
// CDN that turns bots away can't show here; the page says so.

import { robotsFetch, type RobotsFetcher } from "../robots.server";
import { checkBots, isShopifyKind, robotsKind, type SiteCheck, type TestedPath } from "./crawler";
import { fetchSiteFile, HTML_ACCEPT, OUTCOME_COPY, type FetchOutcome } from "./fetch.server";
import { looksLikeHtml, sameHostLinks } from "./html";
import { TtlCache, toolFetchGate } from "./limits.server";
import { SITE_COPY } from "./copy/ai-crawler-checker";

export type SiteOutcome = { ok: true; site: SiteCheck } | { ok: false; error: string };

export interface SiteDeps {
  robots: RobotsFetcher;
  page: (url: string) => Promise<FetchOutcome>;
}

const HOME_MAX_BYTES = 1_000_000;

const defaultDeps: SiteDeps = {
  // robotsFetch: 5 s per hop, 4 redirects, 512 KB (Google reads the first 500 KiB).
  robots: (url) => toolFetchGate.run(() => robotsFetch(url)),
  page: (url) => fetchSiteFile(url, { maxBytes: HOME_MAX_BYTES, accept: HTML_ACCEPT }),
};

/** Double submits within a minute get the same answer (and cost no new fetches). */
const recent = new TtlCache<SiteCheck>(500);
const CACHE_MS = 60_000;

/** Forget cached checks (tests only). */
export function clearCrawlerCache() {
  recent.clear();
}

const LOCALE = "(?:[a-z]{2}(?:-[a-z0-9]{2,4})?/)?";
const PRODUCT_PATH = new RegExp(`^/${LOCALE}products/[^/]+/?$`, "i");
const COLLECTION_PATH = new RegExp(`^/${LOCALE}collections/[^/]+/?$`, "i");

/** The first product and collection page linked from the home page (same site, query and #hash dropped). */
export function findStorePages(html: string, pageUrl: string): { product: string | null; collection: string | null } {
  let product: string | null = null;
  let collection: string | null = null;
  for (const link of sameHostLinks(html, pageUrl)) {
    let path: string;
    try {
      path = new URL(link.href).pathname;
    } catch {
      continue;
    }
    if (path.length > 300) continue;
    if (!product && PRODUCT_PATH.test(path)) product = path;
    else if (!collection && COLLECTION_PATH.test(path)) collection = path;
    if (product && collection) break;
  }
  return { product, collection };
}

/** Shopify's storefront script or CDN on the home page (the first 1 MB). */
export const looksLikeShopify = (html: string) => html.includes("Shopify.shop") || html.includes("cdn.shopify.com");

type RobotsAnswer =
  | { kind: "file"; text: string }
  | { kind: "html"; status: number }
  | { kind: "no-file"; status: number }
  | { kind: "turned-away"; status: number }
  | { kind: "server-error"; status: number }
  | { kind: "unreachable" };

/** robots.txt answers, mapped like the in-app check (robots.server.ts checkCrawlers). */
async function readRobots(url: string, fetcher: RobotsFetcher): Promise<RobotsAnswer> {
  try {
    const res = await fetcher(url);
    const s = res.status;
    if (s >= 200 && s < 300) return looksLikeHtml(res.text) ? { kind: "html", status: s } : { kind: "file", text: res.text };
    // Not "no file": the site turned us away (a firewall or bot protection, which may turn AI bots away
    // too) or asked us to slow down. Never "all clear".
    if (s === 401 || s === 403 || s === 429) return { kind: "turned-away", status: s };
    // No robots.txt at all: every bot may read everything (RFC 9309 2.3.1.3).
    if (s >= 400 && s < 500) return { kind: "no-file", status: s };
    if (s >= 500 && s < 600) return { kind: "server-error", status: s };
    return { kind: "unreachable" }; // a redirect without a Location, or anything else we can't read
  } catch {
    return { kind: "unreachable" };
  }
}

/** The pages to test. `path` is the page the visitor typed ("/" when they typed only the site). */
function pagesToTest(path: string, home: { product: string | null; collection: string | null }, shopify: boolean) {
  const paths: TestedPath[] = [{ label: "your home page", path: "/" }];
  const add = (p: TestedPath) => {
    if (!paths.some((x) => x.path === p.path)) paths.push(p);
  };
  const entered = path !== "/" && path !== "/robots.txt" && path.length <= 300;
  if (entered) add({ label: "the page you entered", path });
  const product = home.product ?? (shopify ? "/products/example" : null);
  const collection = home.collection ?? (shopify ? "/collections/all" : null);
  if (product) add({ label: "a product page", path: product });
  if (collection) add({ label: "a collection page", path: collection });
  const pathNote = !home.product && !shopify ? (entered ? SITE_COPY.noProductLinksEntered : SITE_COPY.noProductLinks) : null;
  return { paths, pathNote };
}

/**
 * Check a site. `input` comes from normalizeSiteInput (origin like "https://yourstore.com", the typed path).
 * Never throws: a site we can't reach gives the shared "couldn't reach" copy.
 */
export async function checkSite(input: { origin: string; host: string; path: string }, deps: SiteDeps = defaultDeps): Promise<SiteOutcome> {
  const key = `${input.origin}|${input.path}`;
  const cached = recent.get(key);
  if (cached) return { ok: true, site: cached };

  const robotsUrl = `${input.origin}/robots.txt`;
  const [robots, page] = await Promise.all([readRobots(robotsUrl, deps.robots), deps.page(`${input.origin}/`).catch((): FetchOutcome => ({ kind: "unreachable" }))]);
  if (robots.kind === "unreachable") return { ok: false, error: OUTCOME_COPY.unreachable };

  const homeHtml = page.kind === "ok" ? page.text : "";
  const home = homeHtml ? findStorePages(homeHtml, page.kind === "ok" ? page.url : `${input.origin}/`) : { product: null, collection: null };
  const fileText = robots.kind === "file" ? robots.text : "";
  const shopifyHome = looksLikeShopify(homeHtml);
  const base = { host: input.host, robotsUrl };

  let site: SiteCheck;
  if (robots.kind === "turned-away" || robots.kind === "server-error") {
    site = { ...base, status: robots.kind, httpStatus: robots.status, shopify: shopifyHome, report: null, pathNote: null };
  } else {
    const shopify = shopifyHome || (fileText ? isShopifyKind(robotsKind(fileText)) : false);
    const { paths, pathNote } = pagesToTest(input.path, home, shopify);
    const report = checkBots(fileText, paths);
    if (robots.kind !== "file") {
      // No file at all: say that instead of "your robots.txt has no rules", and skip the sitemap tip.
      report.notes = report.notes.filter((n) => n.id !== "no-rules" && n.id !== "no-sitemap");
    }
    site =
      robots.kind === "file"
        ? { ...base, status: "file", shopify, report, pathNote }
        : { ...base, status: "no-file", httpStatus: robots.status, html: robots.kind === "html" || undefined, shopify, report, pathNote };
  }
  recent.set(key, site, CACHE_MS);
  return { ok: true, site };
}
