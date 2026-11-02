// IndexNow: tells Bing (which Copilot and ChatGPT search lean on) and the other IndexNow search engines about new or
// changed pages straight away, so nobody has to submit them by hand. Google doesn't use IndexNow; it reads
// /sitemap.xml by itself (submitted once in Search Console). The key file is public/<INDEXNOW_KEY>.txt.
// Sent once at start-up (pages changed in the last 3 days, so each deploy announces its new pages) and when the
// blog job publishes a post. Production only; a failure is logged and never breaks anything.

import db from "../db.server";
import { isoDay, postPath } from "./blog/pages";
import { sitemapPages } from "./tools/site-files";
import { SITE, SITE_HOST } from "./tools/site";

export const INDEXNOW_KEY = "9800dfd6c895bef395aa87b10d00c7fc";
const RECENT_DAYS = 3;

/** The body IndexNow expects for a list of paths on usegeo.app. */
export function indexNowBody(paths: string[]) {
  return {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
    urlList: [...new Set(paths)].map((p) => `${SITE}${p}`),
  };
}

/** Sitemap pages whose date is within the last few days. */
export function recentPaths(pages: { path: string; updated: string }[], now = new Date()): string[] {
  const since = isoDay(new Date(now.getTime() - RECENT_DAYS * 86_400_000));
  return pages.filter((p) => p.updated >= since).map((p) => p.path);
}

export async function pingIndexNow(paths: string[]) {
  if (process.env.NODE_ENV !== "production" || paths.length === 0) return;
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(indexNowBody(paths)),
      signal: AbortSignal.timeout(15_000),
    });
    console.log(`[indexnow] sent ${paths.length} page(s): ${res.status}`);
  } catch (err) {
    console.error(`[indexnow] failed: ${(err as Error).message}`);
  }
}

/** At start-up: announce the pages that changed in the last few days. */
export async function pingRecentPages() {
  try {
    const posts = await db.blogPost.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, select: { slug: true, updatedAt: true } });
    const pages = sitemapPages(posts.map((p) => ({ path: postPath(p.slug), updated: isoDay(p.updatedAt) })));
    await pingIndexNow(recentPaths(pages));
  } catch (err) {
    console.error(`[indexnow] start-up check failed: ${(err as Error).message}`);
  }
}
