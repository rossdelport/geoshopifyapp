// AI Crawler Checker, server side: find where the site really lives (resolveSiteHome: a bare domain that
// lands on a checkout domain's redirect page is read at its www address), read that site's live robots.txt
// and home page, pick the pages to test (the home page, the page the visitor typed, one product page and one
// collection page linked from the home page), and check every bot (crawler.ts). Free: two plain page reads
// per check in the usual case, four at most, no paid calls. Every read goes through the guarded fetch (no
// private addresses, redirects checked hop by hop) and waits for a slot in toolFetchGate. We never pretend
// to be a bot (docs/tools/spec.md 0.9), so a firewall or CDN that turns bots away can't show here; the page
// says so.

import { robotsFetch, type RobotsFetcher } from "../robots.server";
import { checkBots, isShopifyKind, robotsKind, type SiteCheck, type TestedPath } from "./crawler";
import { fetchSiteFile, HTML_ACCEPT, movedNote, OUTCOME_COPY, resolveSiteHome, type FetchOutcome } from "./fetch.server";
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
/** A product shown inside a collection ("/collections/sale/products/oil"): its own page is "/products/oil". */
const COLLECTION_PRODUCT = new RegExp(`^(/${LOCALE})collections/[^/]+/(products/[^/]+)/?$`, "i");

/**
 * The first product and collection page linked from the home page (same site, query and #hash dropped).
 * Themes that only link products inside a collection give that product's own address instead.
 */
export function findStorePages(html: string, pageUrl: string): { product: string | null; collection: string | null } {
  let product: string | null = null;
  let inCollection: string | null = null;
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
    else if (!inCollection) {
      const m = COLLECTION_PRODUCT.exec(path);
      if (m) inCollection = `${m[1]}${m[2]}`;
    }
    if (product && collection) break;
  }
  return { product: product ?? inCollection, collection };
}

/** Shopify's storefront script or CDN on the home page (the first 1 MB). */
export const looksLikeShopify = (html: string) => html.includes("Shopify.shop") || html.includes("cdn.shopify.com");

/** `url`: the address that finally answered (after redirects). */
type RobotsAnswer =
  | { kind: "file"; text: string; url: string }
  | { kind: "html"; status: number; url: string }
  | { kind: "no-file"; status: number; url: string }
  | { kind: "turned-away"; status: number; url: string }
  | { kind: "server-error"; status: number; url: string }
  | { kind: "unreachable" };

/** robots.txt answers, mapped like the in-app check (robots.server.ts checkCrawlers). */
async function readRobots(url: string, fetcher: RobotsFetcher): Promise<RobotsAnswer> {
  try {
    const res = await fetcher(url);
    const s = res.status;
    const at = res.url || url;
    if (s >= 200 && s < 300) return looksLikeHtml(res.text) ? { kind: "html", status: s, url: at } : { kind: "file", text: res.text, url: at };
    // Not "no file": the site turned us away (a firewall or bot protection, which may turn AI bots away
    // too) or asked us to slow down. Never "all clear".
    if (s === 401 || s === 403 || s === 429) return { kind: "turned-away", status: s, url: at };
    // No robots.txt at all: every bot may read everything (RFC 9309 2.3.1.3).
    if (s >= 400 && s < 500) return { kind: "no-file", status: s, url: at };
    if (s >= 500 && s < 600) return { kind: "server-error", status: s, url: at };
    return { kind: "unreachable" }; // a redirect without a Location, or anything else we can't read
  } catch {
    return { kind: "unreachable" };
  }
}

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

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
 * The robots.txt is read from where the site really lives (resolveSiteHome); the typed address's robots.txt
 * is asked for at the same time and used when it came from there too, so the usual check stays two reads.
 * Never throws: a site we can't reach gives the shared "couldn't reach" copy.
 */
export async function checkSite(input: { origin: string; host: string; path: string }, deps: SiteDeps = defaultDeps): Promise<SiteOutcome> {
  const key = `${input.origin}|${input.path}`;
  const cached = recent.get(key);
  if (cached) return { ok: true, site: cached };

  const page = (url: string) => deps.page(url).catch((): FetchOutcome => ({ kind: "unreachable" }));
  const [where, typedRobots] = await Promise.all([resolveSiteHome(input, page), readRobots(`${input.origin}/robots.txt`, deps.robots)]);
  const askedUrl = `${where.origin}/robots.txt`;
  const sameAnswer = where.origin === input.origin || (typedRobots.kind !== "unreachable" && originOf(typedRobots.url) === where.origin);
  const robots = sameAnswer ? typedRobots : await readRobots(askedUrl, deps.robots);
  if (robots.kind === "unreachable") return { ok: false, error: OUTCOME_COPY.unreachable };

  const home = where.home;
  const homeHtml = home.kind === "ok" ? home.text : "";
  const links = homeHtml && home.kind === "ok" ? findStorePages(homeHtml, home.url) : { product: null, collection: null };
  const fileText = robots.kind === "file" ? robots.text : "";
  const shopifyHome = looksLikeShopify(homeHtml);
  // The address we read: where the file finally came from; when there was no file, where we asked.
  const robotsUrl = robots.kind === "file" ? robots.url : askedUrl;
  const hostNote = movedNote(input.host, where);
  const base = { host: where.host, robotsUrl, ...(hostNote ? { hostNote } : {}) };

  let site: SiteCheck;
  if (robots.kind === "turned-away" || robots.kind === "server-error") {
    site = { ...base, status: robots.kind, httpStatus: robots.status, shopify: shopifyHome, report: null, pathNote: null };
  } else {
    const shopify = shopifyHome || (fileText ? isShopifyKind(robotsKind(fileText)) : false);
    const { paths, pathNote } = pagesToTest(input.path, links, shopify);
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
