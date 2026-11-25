// The public website's fixed facts: one canonical origin and the brand names, for page heads,
// JSON-LD, robots.txt, sitemap.xml and llms.txt. Pure and browser-safe (meta runs in the browser too),
// so the origin is a constant, never read from env or request.url.

export const SITE = "https://rankwithross.com.au"; // canonical origin, never from env
/** The logo mark for emails: Ross's face on purple, round, as a PNG (inboxes don't all show WebP). */
export const EMAIL_LOGO = `<img src="${SITE}/brand/ross-mark.png" width="26" height="26" alt="" style="display:inline-block;width:26px;height:26px;border:0;border-radius:50%;margin-right:9px;vertical-align:middle;">`;
export const SITE_HOST = "rankwithross.com.au";
export const BRAND = "Rank with Ross";
export const BRAND_ALT = "RankWithRoss";
/** The last real change to the home page, app/home/new-home.html (git log -1 --format=%cs app/home/new-home.html). Sitemap lastmod for "/". */
export const HOME_UPDATED = "2026-11-25";
/** The last real change to the pages in other languages, app/home/home-<code>.html. Sitemap lastmod for /de, /fr, /nl, /es, /it. */
export const HOME_LANGS_UPDATED = "2026-11-25";
/** The home page in other languages, at rankwithross.com.au/<code> (built by design/overview/i18n.mjs into app/home/home-<code>.html). */
export const HOME_LANGS = ["de", "fr", "nl", "es", "it"] as const;
export type HomeLang = (typeof HOME_LANGS)[number];
/** The last edit of the privacy page (routes/privacy.tsx). Sitemap lastmod for "/privacy". */
export const PRIVACY_UPDATED = "2026-11-25";
/** The last edit of the terms of service (routes/terms.tsx). Sitemap lastmod for "/terms". */
export const TERMS_UPDATED = "2026-11-25";

/** A site path as an absolute URL on the canonical origin: "/" -> "https://rankwithross.com.au/". */
export const abs = (path: string) => SITE + (path === "/" ? "/" : path);
