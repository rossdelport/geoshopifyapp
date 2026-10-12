// The public website's fixed facts: one canonical origin and the brand names, for page heads,
// JSON-LD, robots.txt, sitemap.xml and llms.txt. Pure and browser-safe (meta runs in the browser too),
// so the origin is a constant, never read from env or request.url.

export const SITE = "https://usegeo.app"; // canonical origin, never from env
export const SITE_HOST = "usegeo.app";
export const BRAND = "GEO";
export const BRAND_ALT = "GEO for Shopify";
/** The last real change to app/home/home.html (git log -1 --format=%cs app/home/home.html). Sitemap lastmod for "/". */
export const HOME_UPDATED = "2026-10-12";
/** The last edit of the privacy page (routes/privacy.tsx). Sitemap lastmod for "/privacy". */
export const PRIVACY_UPDATED = "2026-10-11";

/** A site path as an absolute URL on the canonical origin: "/" -> "https://usegeo.app/". */
export const abs = (path: string) => SITE + (path === "/" ? "/" : path);
