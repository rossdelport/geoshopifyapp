// The site files for usegeo.app: robots.txt, sitemap.xml and llms.txt, built from the tool registry, the
// stories and the plans, so they never drift from the pages. Pure. Served by routes/robots[.]txt.ts,
// sitemap[.]xml.ts and llms[.]txt.ts. Never add public/robots.txt, public/sitemap.xml or public/llms.txt:
// static files are served before routes and would hide these.

import { PLANS, formatUsd } from "../plans";
import { STORIES } from "../stories";
import { STORIES_HUB, STORIES_UPDATED, storyPath } from "../stories/pages";
import { HOME_UPDATED, PRIVACY_UPDATED, SITE, abs } from "./site";
import { HUB, TOOLS } from "./registry";

/**
 * Every public page is open to search engines and AI assistants. Only the app and private paths are
 * closed. `/app$`, `/app?` and `/app/` instead of `/app`: rules match by prefix, so `Disallow: /app` would
 * also block /apple-touch-icon.png. Report pages (/check/...), /tips and /unsubscribe are NOT disallowed:
 * they send noindex, and Google must be able to fetch them to see it. No bot-specific groups (RFC 9309:
 * a group naming a bot replaces the `*` group for that bot entirely).
 */
export function siteRobotsTxt(): string {
  return [
    "# usegeo.app: search engines and AI assistants are welcome on every public page.",
    "User-agent: *",
    "Allow: /",
    "Disallow: /app$",
    "Disallow: /app?",
    "Disallow: /app/",
    "Disallow: /auth/",
    "Disallow: /api/",
    "Disallow: /webhooks/",
    "",
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ].join("\n");
}

/**
 * The pages in the sitemap, with the date each last really changed. Not listed: /check (its canonical
 * is the AI Visibility Checker), report pages, /auth, /app, /tips and /unsubscribe.
 * A function, not a constant: the llms.txt Checker imports this module in the browser (for siteLlmsTxt), and a
 * list built when the module loads would ship stories.json with that page.
 */
export function sitemapPages(): { path: string; updated: string }[] {
  return [
    { path: "/", updated: HOME_UPDATED },
    { path: HUB.path, updated: HUB.updated },
    ...TOOLS.map((t) => ({ path: t.path, updated: t.updated })),
    { path: STORIES_HUB.path, updated: STORIES_UPDATED },
    ...STORIES.map((s) => ({ path: storyPath(s.slug), updated: STORIES_UPDATED })),
    { path: "/privacy", updated: PRIVACY_UPDATED },
  ];
}

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** sitemaps.org format: <loc> and <lastmod> only (Google and Bing ignore priority and changefreq). */
export function sitemapXml(): string {
  const urls = sitemapPages().map(
    (p) => `  <url>\n    <loc>${xmlEscape(abs(p.path))}</loc>\n    <lastmod>${p.updated}</lastmod>\n  </url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** The plans in one sentence, from PLANS (prices are never typed in). */
function plansLine(): string {
  const { core, pro } = PLANS;
  const trial =
    core.trialDays === pro.trialDays
      ? `both with a ${core.trialDays}-day free trial`
      : `with a ${core.trialDays}-day and a ${pro.trialDays}-day free trial`;
  return `GEO has two plans: ${core.name} at ${formatUsd(core.priceUsd)} a month and ${pro.name} at ${formatUsd(pro.priceUsd)} a month, ${trial}. The free tools below need no sign-up.`;
}

/**
 * llms.txt in the llmstxt.org format: H1, a blockquote summary, a line of detail, then H2 link lists. The stories
 * get one line (their hub): the llms.txt Checker shows this file as its example in the browser, and a line per story
 * would ship every story's text with that page (the sitemap lists each story).
 */
export function siteLlmsTxt(): string {
  return [
    "# GEO",
    "",
    "> GEO is a Shopify app that helps stores get their products recommended by AI assistants like ChatGPT, Gemini and Perplexity, and shows the sales that come from AI.",
    "",
    plansLine(),
    "",
    "## Free tools",
    "",
    ...TOOLS.map((t) => `- [${t.name}](${abs(t.path)}): ${t.short}`),
    "",
    "## About GEO",
    "",
    `- [Home](${abs("/")}): what GEO does, how it works and pricing`,
    `- [All free tools](${abs(HUB.path)}): the full list of free tools`,
    `- [Stories](${abs(STORIES_HUB.path)}): other brands' sales and sign-ups from AI assistants, as their sources reported them (none are GEO customers)`,
    `- [Privacy policy](${abs("/privacy")}): what data GEO collects and why`,
    "",
  ].join("\n");
}
