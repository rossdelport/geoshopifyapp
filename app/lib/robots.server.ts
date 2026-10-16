// AI crawler check, server side: fetch the store's robots.txt (free, a plain page read through the free
// check's guarded fetch), test the AI bots against a real product page, the home page and a guide page,
// and save the result in Shop.crawlers. Re-checked weekly by the worker (job "crawlers.check"), and from
// the Fixes screen's "Check again" button. US$0: no paid calls.

import db from "../db.server";
import { safeFetch } from "./check.server";
import { enqueue, registerJob } from "./jobs.server";
import { checkRobots, type CrawlerCheck, type CrawlerPath } from "./robots";

export type RobotsFetcher = (url: string) => Promise<{ status: number; url: string; text: string }>;

// Google reads the first 500 KiB of a robots.txt; we read up to 512 KB, 5 s per hop. RFC 9309 asks
// crawlers to follow at least 5 redirects; the guarded fetch allows 4 (myshopify.com to the shop's own
// domain is one).
const ROBOTS_MAX_BYTES = 512_000;
export const robotsFetch: RobotsFetcher = (url) => safeFetch(url, "text/plain,*/*;q=0.5", { timeoutMs: 5_000, maxRedirects: 4, maxBytes: ROBOTS_MAX_BYTES });

export const CRAWLER_CHECK_DAYS = 7;
/** A check that couldn't read the file is tried again the next day, not a week later. */
export const CRAWLER_RETRY_DAYS = 1;
const DAY = 86_400_000;

/** The paths that matter: one of the store's own product pages, the home page, and a guide page we published. */
export async function crawlerPaths(shopId: string): Promise<CrawlerPath[]> {
  const [product, guide] = await Promise.all([
    db.product.findFirst({ where: { shopId, status: "ACTIVE" }, orderBy: { syncedAt: "desc" }, select: { handle: true } }),
    db.fix.findFirst({
      where: { shopId, type: "guide_page", status: "applied", revertedAt: null, resultUrl: { not: null } },
      orderBy: { appliedAt: "desc" },
      select: { resultUrl: true },
    }),
  ]);
  const paths: CrawlerPath[] = [
    { label: "product pages", path: `/products/${product?.handle ?? "example"}` },
    { label: "your home page", path: "/" },
  ];
  if (guide?.resultUrl) {
    try {
      paths.push({ label: "guide pages", path: new URL(guide.resultUrl).pathname });
    } catch {
      // not a URL: skip it
    }
  }
  return paths;
}

/** Check the store's robots.txt now and save the result. Never throws for a site problem. */
export async function checkCrawlers(shopId: string, opts: { fetch?: RobotsFetcher; now?: Date } = {}): Promise<CrawlerCheck> {
  const now = opts.now ?? new Date();
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, select: { domain: true, primaryDomain: true } });
  const robotsUrl = `https://${shop.primaryDomain ?? shop.domain}/robots.txt`;
  const paths = await crawlerPaths(shopId);
  const base = { checkedAt: now.toISOString(), robotsUrl, paths };
  let result: CrawlerCheck;
  try {
    const res = await (opts.fetch ?? robotsFetch)(robotsUrl);
    if (res.status >= 200 && res.status < 300) {
      result = { ...base, ...checkRobots(res.text, paths) };
    } else if (res.status === 401 || res.status === 403 || res.status === 429) {
      // Not "no file": the store turned us away (a firewall or bot protection, which may turn AI bots
      // away too) or asked us to slow down (Google treats 429 like a server error). Never "all clear".
      result = { ...base, status: "unreachable", httpStatus: res.status, bots: [] };
    } else if (res.status >= 400 && res.status < 500) {
      // No robots.txt at all: every bot may read everything (RFC 9309 2.3.1.3).
      result = { ...base, status: "no-file", httpStatus: res.status, bots: checkRobots("", paths).bots };
    } else {
      // A server error: search engines treat this as "read nothing" until it works again.
      result = { ...base, status: "unreachable", httpStatus: res.status, bots: [] };
    }
  } catch {
    result = { ...base, status: "unreachable", bots: [] };
  }
  await db.shop.update({ where: { id: shopId }, data: { crawlers: result as object, crawlersCheckedAt: now } });
  return result;
}

/** Due for its weekly check? A check that couldn't read the file is due again the next day. */
export function crawlerCheckDue(checkedAt: Date | null | undefined, now = new Date(), lastStatus?: string | null): boolean {
  const days = lastStatus === "unreachable" ? CRAWLER_RETRY_DAYS : CRAWLER_CHECK_DAYS;
  return !checkedAt || now.getTime() - checkedAt.getTime() >= days * DAY - 3_600_000;
}

export function queueCrawlerCheck(shopId: string) {
  return enqueue("crawlers.check", {}, { shopId, dedupeKey: `crawlers:${shopId}`, ifFailedWaitMs: 6 * 3_600_000 });
}

registerJob("crawlers.check", async (job) => {
  const r = await checkCrawlers(job.shopId!);
  console.log(`[crawlers] ${job.shopId}: ${r.status}`);
});
