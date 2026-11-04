// The public website's fixed facts: one canonical origin and the brand names, for page heads,
// JSON-LD, robots.txt, sitemap.xml and llms.txt. Pure and browser-safe (meta runs in the browser too),
// so the origin is a constant, never read from env or request.url.

export const SITE = "https://firstpicked.com.au"; // canonical origin, never from env
export const SITE_HOST = "firstpicked.com.au";
export const BRAND = "FirstPicked";
export const BRAND_ALT = "First Picked";
/** The last real change to the home page, app/home/new-home.html (git log -1 --format=%cs app/home/new-home.html). Sitemap lastmod for "/". */
export const HOME_UPDATED = "2026-11-03";
/** The last real change to the pages in other languages, app/home/home-<code>.html. Sitemap lastmod for /de, /fr, /nl, /es, /it. */
export const HOME_LANGS_UPDATED = "2026-10-23";
/** The home page in other languages, at firstpicked.com.au/<code> (built by design/overview/i18n.mjs into app/home/home-<code>.html). */
export const HOME_LANGS = ["de", "fr", "nl", "es", "it"] as const;
export type HomeLang = (typeof HOME_LANGS)[number];
/** The last edit of the privacy page (routes/privacy.tsx). Sitemap lastmod for "/privacy". */
export const PRIVACY_UPDATED = "2026-11-03";
/** The last edit of the terms of service (routes/terms.tsx). Sitemap lastmod for "/terms". */
export const TERMS_UPDATED = "2026-11-03";

/** A site path as an absolute URL on the canonical origin: "/" -> "https://firstpicked.com.au/". */
export const abs = (path: string) => SITE + (path === "/" ? "/" : path);
