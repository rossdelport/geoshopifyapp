# Free tool pages: build spec

Seven free tools, one hub, and the site files that go with them, for https://usegeo.app.
Written 11 October 2026 from the research in `docs/tools/research/` (seo-2026, geo-2026, facts-2026,
competitors, codebase-brief) plus four live checks made for this spec (section 0). Builders: read section 0
to 4 first, then only your own tool section.

Ground rules for every word on these pages (CLAUDE.md, house rules):
- Plain English for non-technical store owners. Short sentences.
- **Never an em dash** in our copy, and no spaced en dash. Use a full stop, comma, colon or "and".
- Never invent numbers, stats, reviews, authors or facts. Every number in copy below has a source comment.
  Label every sample as a sample.
- No "GEO", "AEO" or "LLM" as jargon in copy. "GEO" appears only as the brand name. "llms.txt" is allowed
  because it is the file's name.
- Copy in this spec is final unless marked "draft". Copy it exactly into the copy modules. If a fact needs
  changing, change the copy module and the source comment together.

---

## 0. Read first: where this spec changes the lead's decisions

The lead's decisions stand except for these. Each change comes from research or a live check.

1. **AI Overview data source: Crawl4AI first, AnyAPI as backup (was: AnyAPI only).**
   Live checks on 11 Oct 2026 (Treg MCP):
   - `crawl4ai.google.serp.organic` (GET, query `q`, `country=us`, `language=en`) returned the real Google
     results page as JSON: a `blocks` list (`"ai_overview"` present when Google showed one), `ai_overview.text`
     (the overview as shown before "Show more"), `ai_overview.sources[{title,url}]`, the top organic results
     with positions, and "People also ask". Price US$0.00015 per page (Treg catalog, verified 9 Oct 2026),
     answered in 0.7 to 1.9 s in our 3 calls; Treg's measured p50 7.1 s, p95 11.5 s, ok rate 92%.
   - `anyapi.google.serp.ai_overview` (POST `{prompt}`) costs US$0.0015 to US$0.0018, Treg measured p50 10 s
     and **p95 142 s**, a Treg reviewer reports `found:false` answers are still billed, and its own example
     output starts "AI Mode replied:". Our call for "best sunscreen for oily skin" returned the same overview as
     Crawl4AI but with the product names stripped and a trailing "Share public link" line.
   - `litescrape.google.serp.ai_overview` (the app's current first choice in `askEngine("aio")`) answered
     **402 "This API key has no calls remaining"** on 11 Oct 2026. Tell Ross: the in-app AI Overview scans are
     silently falling back to AnyAPI until Litescrape is topped up.
   - Decision: the tool calls Crawl4AI, then AnyAPI only if Crawl4AI fails or times out. A bonus: Crawl4AI also
     gives the top 10 normal results, so we can show "ranks #3 and is cited" vs "ranks #1 but not cited".
2. **robots.txt must not disallow report pages (was: disallow report pages).** All three research files agree:
   `/check/:id` already sends `noindex`, and a robots.txt block would stop Google ever seeing that `noindex`.
   Disallow only the app and private paths: `/app$`, `/app?`, `/app/`, `/auth/`, `/api/`, `/webhooks/` (3.11).
3. **The llms.txt generator cannot loop over collections in Liquid (competitors.md suggested it).** Shopify's
   `llms.txt.liquid` docs (read 11 Oct 2026 via Treg): "this template renders with a restricted Liquid context:
   only the `request` object and the `agents` object are available, and the standard global Liquid objects such
   as `shop`, `articles`, and `collections` are not injected." So the Shopify version uses `agents.store_name`,
   `agents.store_url`, `agents.sitemap_url` and typed-in links, and tells the owner to re-run it when links change.
   Source: https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid
4. **`/check` and `/tools/ai-visibility-checker` would compete for one search intent.** Default in this spec
   (reversible, Ross to confirm): `/check` keeps working exactly as now (the home hero form posts to it), its
   page gets `<link rel="canonical" href="https://usegeo.app/tools/ai-visibility-checker">`, and `/check` leaves
   the sitemap. The footer links the tool page, not `/check` (Google: link to canonical URLs).
5. **Do not use the fact pack's line "Google shows AI Overviews for only a small share of shopping searches".**
   It rests on Ahrefs' September 2025 data (3.2% of shopping keywords). On 11 Oct 2026 all 3 shopping searches
   we ran showed an AI Overview ("best sunscreen for oily skin", "beard oil", "allbirds tree runners"), and the
   SEO research saw one on all 7 tool searches. That is a tiny sample, so copy states no current rate for shopping searches.
6. **Query-string URLs get a canonical, not `noindex`.** The tools never put state in GET URLs (every run is a
   POST or runs in the browser), so a query string only comes from tracking links, including ChatGPT's own
   `?utm_source=chatgpt.com`. Google prefers `rel=canonical` for duplicates within a site. POST responses send
   `X-Robots-Tag: noindex` anyway.
7. **The one button under each result goes to the GEO home page** (the product page), with a tool-specific label
   and anchor. Next steps to other free tools are plain text links, never a second button. Ross to confirm.
8. **AI visibility sample:** the lead asked for a real sample. A real report needs a real product we may show.
   Plan: a real report on a product from Ross's own dev store (or Shopify's public demo store), frozen with its
   date. Until that exists, the page shows the made-up sample report already used in tests, labelled
   "Sample report for a made-up store". See T7.
9. **No live "request as each bot" test in v1** for the crawler checker. How Shopify's bot protection treats a
   fake Googlebot user agent from our server is UNVERIFIED (competitors.md), and a false "blocked" would scare
   owners. Phase 2, only after testing on 10 stores.
10. **FAQ generator "pull questions from a link" is phase 2** and, if built, only reads existing FAQPage JSON-LD
    and `<details><summary>` pairs. v1 ships without it.

## 1. Decisions for Ross (the build goes ahead on the defaults shown)

| # | Question | Default used in this spec |
|---|---|---|
| R1 | `/check` vs `/tools/ai-visibility-checker`: which is the one indexable page? | Tool page indexable; `/check` canonicalised to it (0.4). Alternative: 301 GET `/check` to the tool page. |
| R2 | The one button: home page, free check, or install? | Home page section (`/?ref=tool-<slug>#how` or `#money`). |
| R3 | Brand string so assistants can tell GEO the company from "GEO" the topic | Titles end `\| GEO`; Organization JSON-LD `name: "GEO"`, `alternateName: "GEO for Shopify"`. No `sameAs` until real profiles exist. |
| R4 | A named person as maker ("Made by Ross ...")? | "Made by GEO", linking to the home page. No About page in this build. |
| R5 | Real sample for the AI visibility page | Made-up sample until Ross runs one check on his own product (T7). |
| R6 | Top up Litescrape (in-app AI Overview scans are falling back to AnyAPI) | Not needed for the tools. |
| R7 | Google's spam policy names "automated access to Google Search" without permission. The AI Overview checker reads Google through a data provider, like many SEO tools do. No case of a site being penalised for showing such data was found (UNVERIFIED either way). | Build it, cache 24 h, rate limit. Ross should know the policy text exists. |
| R8 | CDN for US visitors (server is in Singapore). Note: Cloudflare blocks AI crawlers by default on new zones (geo-2026 §5), so its AI bot setting must be turned off if added. | No CDN in this build. |
| R9 | Search Console + Bing Webmaster Tools verification, IndexNow key | Ross does the post-launch steps in section 9. |

## 2. Build order and who owns which file

Three roles. Builders never edit a file another role owns. If you need a change in a shared file, write it
down in your hand-off note and the integrator makes it.

**Phase A: foundation builder (F), alone, first.** Builds every shared piece in section 3, the hub, the site
files and the home page changes, with tests. Merges before phase B starts.

**Phase B: seven tool builders (T1 to T7), in parallel.** Each owns only the files listed in their section.

**Phase C: integrator (I), last.** Cross-tool tests, the `CheckShell` footer swap, full verification, OG image
check, commit, push, live checks.

### 2.1 Files under review: import only, never edit (codebase-brief §8)

`app/lib/robots.ts`, `app/lib/robots.server.ts`, `app/components/check-ui.tsx`, `app/lib/check-read.ts`,
`app/lib/check.server.ts`, `app/lib/ai-ready.ts`, `app/lib/check-types.ts`, `app/lib/treg.server.ts`,
`app/lib/sources.ts`, `app/lib/plans.ts`, `app/lib/answers.ts` (not in the commit, but treat as shared),
`prisma/schema.prisma`, and every other file listed in codebase-brief §8. Run `git status` before starting;
if the reviewer has left uncommitted changes in any of them, stop and ask.

Never create `public/robots.txt`, `public/sitemap.xml` or `public/llms.txt` (static files shadow routes).
No new npm packages. No Prisma migration.

### 2.2 Ownership table

| Role | Owns (creates or edits) |
|---|---|
| **F** | `app/lib/tools/site.ts`, `registry.ts`, `seo.ts`, `http.ts`, `site-files.ts`, `site-input.ts`, `html.ts`, `format.ts`, `host.server.ts`, `guard.server.ts`, `limits.server.ts`, `fetch.server.ts`; `app/components/tool-ui.tsx`, `app/components/site-footer.tsx`; `app/styles/tools.css`; `app/routes/tools.tsx`, `tools._index.tsx`, `tools.$.tsx`, `robots[.]txt.ts`, `sitemap[.]xml.ts`, `llms[.]txt.ts`; edits to `app/routes/_index/route.tsx`, `app/routes/check._index.tsx` (meta + loader only), `app/routes/privacy.tsx`; `design/overview/parts/10-nav.html`, `45-cta-footer.html`, `45-cta-footer.css`, `design/overview/assemble.mjs`, rebuilt `app/home/home.html`; `scripts/tools-og.py`, `public/og/*.png`; tests `test/tools-foundation.test.ts`, `test/tools-site-files.test.ts`, edits to `test/home.test.ts` |
| **T1** AI Overview | `app/routes/tools.ai-overview-checker.tsx`; `app/lib/tools/aio.ts`, `aio.server.ts`, `copy/ai-overview-checker.ts`, `samples/aio-sample.ts`; `app/components/tools/aio-result.tsx`; `app/styles/tool-aio.css`; `test/tools-aio.test.ts`; `test/fixtures/tools/crawl4ai-serp-*.json` |
| **T2** AI crawler | `app/routes/tools.ai-crawler-checker.tsx`; `app/lib/tools/crawler.ts`, `crawler.server.ts`, `copy/ai-crawler-checker.ts`, `samples/crawler-sample.ts`; `app/components/tools/crawler-result.tsx`; `app/styles/tool-crawler.css`; `test/tools-crawler.test.ts`; `test/fixtures/tools/robots-*.txt` |
| **T3** Product schema | `app/routes/tools.product-schema-checker.tsx`; `app/lib/tools/schema.ts`, `schema.server.ts`, `copy/product-schema-checker.ts`, `samples/schema-sample.ts`; `app/components/tools/schema-result.tsx`; `app/styles/tool-schema.css`; `test/tools-schema.test.ts`; `test/fixtures/tools/schema-*.html` |
| **T4** FAQ schema | `app/routes/tools.faq-schema-generator.tsx`; `app/lib/tools/faq-schema.ts`, `copy/faq-schema-generator.ts`, `samples/faq-sample.ts`; `app/components/tools/faq-editor.tsx`; `app/styles/tool-faq.css`; `test/tools-faq.test.ts` (name is `faq-schema.ts` because `app/lib/faq.ts` already exists) |
| **T5** llms.txt | `app/routes/tools.llms-txt-checker.tsx`; `app/lib/tools/llms.ts`, `llms.server.ts`, `copy/llms-txt-checker.ts`; `app/components/tools/llms-result.tsx`; `app/styles/tool-llms.css`; `test/tools-llms.test.ts`; `test/fixtures/tools/llms-*.txt` |
| **T6** AI bot (copy) | `app/routes/tools.ai-bot-checker.tsx`; `app/lib/tools/copy-check.ts`, `copy-check.server.ts`, `copy/ai-bot-checker.ts`, `samples/copy-sample.ts`; `app/components/tools/copy-result.tsx`; `app/styles/tool-copy.css`; `test/tools-copy-check.test.ts` |
| **T7** AI visibility | `app/routes/tools.ai-visibility-checker.tsx`; `app/lib/tools/copy/ai-visibility-checker.ts`, `samples/visibility-sample.ts`; `app/components/tools/visibility-sample.tsx`; `app/styles/tool-visibility.css`; `test/tools-visibility.test.ts` |
| **I** | One-line swap in `app/components/check-ui.tsx` (`ck-foot` to `<SiteFooter />`) **only after the review of commit `4d49e5f` is finished**; `test/tools-cross.test.ts`; any fixes found in review; the commit and push |

Each tool's stylesheet is optional. Keep it small and prefix its classes `tl-<tool>-` (for example
`tl-aio-source`). Shared styles belong in `tools.css` (F).

## 3. Shared foundation (F)

All `app/lib/tools/*.ts` files without `.server` must be pure and browser-safe (they run in `meta` and in the
browser). Never import `env.server.ts` or any `.server` file into them.

### 3.1 `site.ts`

```ts
export const SITE = "https://usegeo.app";          // canonical origin, never from env
export const SITE_HOST = "usegeo.app";
export const BRAND = "GEO";
export const BRAND_ALT = "GEO for Shopify";
export const HOME_UPDATED = "YYYY-MM-DD";           // F: date of the last real change to app/home/home.html (git log -1 --format=%cs app/home/home.html, after the footer edit)
export const PRIVACY_UPDATED = "YYYY-MM-DD";        // F: date of the privacy page edit in this build
export const abs = (path: string) => SITE + (path === "/" ? "/" : path);
```

### 3.2 `registry.ts` (one list for footer, hub, related tools, sitemap, llms.txt, tests)

```ts
export type ToolSlug =
  | "ai-visibility-checker" | "ai-overview-checker" | "ai-crawler-checker" | "product-schema-checker"
  | "llms-txt-checker" | "faq-schema-generator" | "ai-bot-checker";

export interface ToolEntry {
  slug: ToolSlug;
  path: `/tools/${ToolSlug}`;
  name: string;        // exact tool name, same in H1 (unless h1 says otherwise), footer, hub, JSON-LD
  h1: string;
  title: string;       // <title>, og:title. Under 60 characters including " | GEO"
  description: string; // meta + og:description. Under 155 characters
  short: string;       // one line for hub cards, related tools and llms.txt notes (under 95 characters)
  keyword: string;     // the main search term
  group: "stand" | "read" | "improve";
  related: [ToolSlug, ToolSlug, ToolSlug];
  timing: string;      // the trust line after "Free · No sign-up · "
  updated: string;     // ISO date the tool shipped; change ONLY when the tool or its copy really changes
  ogImage: string;     // "/og/<slug>.png"
  ogAlt: string;
}
export const TOOLS: ToolEntry[];                   // in the order below (footer and hub use it)
export const toolBySlug: (s: ToolSlug) => ToolEntry;
export const HUB = { path: "/tools", name: "Free tools", title, description, h1, updated /* = latest tool date */ };
```

Registry data (F types these in exactly; `updated` = the date the tools first deploy):

| slug | name | h1 | title | description | short | keyword | group | related | timing |
|---|---|---|---|---|---|---|---|---|---|
| ai-visibility-checker | AI Visibility Checker | AI Visibility Checker | AI Visibility Checker: Does ChatGPT Recommend You? \| GEO | Free AI visibility checker for Shopify products. See if ChatGPT, Gemini and Perplexity recommend your product and who they pick instead. No sign-up. | See if ChatGPT, Gemini and Perplexity recommend your product, and who they pick instead. | ai visibility checker | stand | ai-overview-checker, ai-crawler-checker, ai-bot-checker | Results in about 2 minutes |
| ai-overview-checker | AI Overview Checker | AI Overview Checker | AI Overview Checker: Is Your Site Cited by Google AI? \| GEO | Free AI Overview checker. Type a shopping search to see if Google shows an AI Overview, which sites it cites and if yours is one. No sign-up. | See if Google shows an AI Overview for a search, which sites it cites and if yours is one. | ai overview checker | stand | ai-visibility-checker, ai-crawler-checker, product-schema-checker | Usually under 15 seconds |
| ai-crawler-checker | AI Crawler Checker | AI Crawler Checker | AI Crawler Checker: Which AI Bots Can Read Your Site \| GEO | Free AI crawler checker. See which AI bots your robots.txt lets in, like OAI-SearchBot, GPTBot and PerplexityBot, with Shopify fixes. No sign-up. | See which AI bots your robots.txt lets in, and which blocks really hide you from AI answers. | ai crawler checker | read | llms-txt-checker, product-schema-checker, ai-visibility-checker | Results in seconds |
| product-schema-checker | Product Schema Checker | Product Schema Checker | Product Schema Checker: What Google and AI Can Read \| GEO | Free product schema checker for Shopify. Paste a product link to see which facts Google and AI shopping tools can read and what's missing. No sign-up. | See which product facts Google and AI shopping tools can read from your product page. | product schema checker | read | faq-schema-generator, ai-bot-checker, ai-visibility-checker | Results in seconds |
| llms-txt-checker | llms.txt Checker | llms.txt Checker | llms.txt Checker: Validate and Generate Your File \| GEO | Free llms.txt checker and generator. See if your site has an llms.txt, check it against the llmstxt.org format and copy a starter file. No sign-up. | Check your llms.txt against the llmstxt.org format and copy a starter file. | llms.txt checker | read | ai-crawler-checker, product-schema-checker, ai-visibility-checker | Results in seconds |
| faq-schema-generator | FAQ Schema Generator | FAQ Schema Generator | FAQ Schema Generator: Free JSON-LD for Shopify \| GEO | Free FAQ schema generator. Type questions and answers, then copy FAQPage JSON-LD or a ready Shopify section. Runs in your browser. No sign-up. | Turn your questions and answers into FAQ markup and a ready Shopify section. | faq schema generator | improve | product-schema-checker, ai-bot-checker, ai-visibility-checker | Runs in your browser |
| ai-bot-checker | AI Bot Checker | AI Bot Checker for product descriptions | AI Bot Checker for Product Descriptions \| GEO | Does your product copy sound like a bot wrote it? Free checker for vague phrases, hype words and missing facts shoppers and AI need. No sign-up. | Check if your product copy sounds generic, and which facts shoppers and AI are missing. | ai bot checker | improve | faq-schema-generator, product-schema-checker, ai-visibility-checker | Runs in your browser |

`ogAlt` per tool (F): "AI visibility checker result: how often ChatGPT, Gemini and Perplexity name a product",
"AI Overview checker result: an AI Overview with its cited sites", "AI crawler checker result: AI bots allowed and
blocked", "Product schema checker result: product facts found and missing", "llms.txt checker result: line by
line checks", "FAQ schema generator: questions and answers with the generated code", "AI bot checker result:
vague phrases highlighted in a product description".

Hub: title `Free AI Search Tools for Shopify Stores | GEO`; description `Seven free tools that show how AI
search sees your Shopify store: AI Overviews, AI crawlers, product schema, FAQ schema, llms.txt and product copy.`;
h1 `Free AI search tools for Shopify stores`.

### 3.3 `seo.ts` (one helper for every public page's head)

```ts
import type { MetaDescriptor } from "react-router";
export interface PageSeo {
  path: string;            // "/tools/ai-crawler-checker"
  title: string;
  description: string;
  image?: string;          // site path, default "/og/tools.png"
  imageAlt?: string;
  noindex?: boolean;       // 404 page only; never on tool pages
  jsonLd?: Record<string, unknown>;   // one @graph object
}
export function pageMeta(p: PageSeo): MetaDescriptor[];
export function toolJsonLd(t: ToolEntry, faqs: { q: string; a: string }[]): Record<string, unknown>;
export function hubJsonLd(): Record<string, unknown>;
```

`pageMeta` returns, in this order: `{ title }`, `{ name: "description" }`, `{ tagName: "link", rel: "canonical",
href: abs(path) }`, `robots: noindex` only when asked, `og:type=website`, `og:site_name=GEO`, `og:title`,
`og:description`, `og:url=abs(path)`, `og:image=abs(image)`, `og:image:width=1200`, `og:image:height=630`,
`og:image:alt`, `twitter:card=summary_large_image`, and `{ "script:ld+json": jsonLd }` when given. Never a
`nosnippet` or `max-snippet` directive. The canonical never comes from `request.url` or env.

`toolJsonLd` returns one `@graph`:
- `Organization` `@id https://usegeo.app/#org`: `name` "GEO", `alternateName` "GEO for Shopify", `url`
  "https://usegeo.app/", `logo` "https://usegeo.app/apple-touch-icon.png". No `sameAs` (R3).
- `WebApplication` `@id <url>#app`: `name` = tool name, `url`, `description` = registry description,
  `applicationCategory` "BusinessApplication", `operatingSystem` "Any", `isAccessibleForFree` true,
  `offers` `{ "@type": "Offer", price: "0", priceCurrency: "USD" }`, `publisher` `{ @id #org }`.
  **No `aggregateRating`, no `review`** (we have no real ones; Google added a rule on fake reviews on 24 Jul 2026).
- `WebPage` `@id <url>`: `url`, `name` = title without " | GEO", `dateModified` = registry `updated`,
  `primaryImageOfPage` = og image URL, `mainEntity` `{ @id #app }`, `breadcrumb` `{ @id #crumbs }`,
  `isPartOf` `{ "@type": "WebSite", "@id": "https://usegeo.app/#website", url, name: "GEO" }`.
- `BreadcrumbList` `@id <url>#crumbs`: Home (`https://usegeo.app/`), Free tools (`https://usegeo.app/tools`),
  tool name (no `item` on the last one).
- `FAQPage` `@id <url>#faq` with `mainEntity` built from the **same array** the page renders, so the text is
  identical word for word. It is harmless when it matches visible text and earns no Google display since 7 May
  2026 (facts §3). Never say on any page that it gets rich results.

`hubJsonLd`: Organization, `CollectionPage` (`@id https://usegeo.app/tools`, `dateModified`), `ItemList` of the 7
tools (`ListItem` position, name, url), BreadcrumbList (Home, Free tools).

React Router 7.18.2 renders `script:ld+json` with HTML escaping, so `</script>` inside strings is safe
(codebase-brief §1.3). Keep JSON-LD under 8 KB per page.

### 3.4 `http.ts`

```ts
export const toolHeaders: HeadersFunction = ({ actionHeaders }) => ...
```
- Normal GET: `Cache-Control: public, max-age=300`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`.
- When the action set headers: return those (`Cache-Control: no-store`, `X-Robots-Tag: noindex`, plus the two
  security headers).
Every tool route exports `export const headers = toolHeaders;` because a child route without `headers` copies
its parent's and would lose its own action headers (codebase-brief §1.4).
Helper: `export const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }` for `data(result, { headers: noStore })`.

### 3.5 `format.ts`

`formatUpdated("2026-10-11") -> "11 October 2026"` (UTC, English month names, no weekday).
`plural(n, "bot")`. Tests cover both.

### 3.6 `site-input.ts` (pure) and `html.ts` (pure, bounded)

`normalizeSiteInput(input: string): { ok: true; origin: string; host: string; path: string } | { ok: false; error: string }`
- Trim; max 2,000 characters; add `https://` when there is no scheme; `http` or `https` only; no user or
  password; port empty, 80 or 443; host lowercased, must contain a dot; reject IP literals (`isIpLiteral`) and
  `isBlockedHostname` (both imported from `check-read.ts`); path defaults to `/`; drop query and hash.
- Unlike `normalizeCheckUrl`, it does not reject marketplaces (anyone may check any site's robots.txt or llms.txt).
- Errors: empty -> "Type your website, like yourstore.com."; bad -> "That doesn't look like a web address. Try
  something like yourstore.com."

`html.ts` (copy the `indexOf` style of `check-read.ts`; house rule: no regex that can rescan a 2 MB page from many
starts; every regex runs on a slice of at most 2,000 characters):
- `jsonLdBlocks(html, max = 20): string[]` (own copy; the one in `check-read.ts` is private).
- `titleOf(html): string | null`, `metaContent(html, nameOrProperty): string | null` (description,
  og:site_name, og:title). Decode with `decodeEntities` from `check-read.ts`.
- `sameHostLinks(html, pageUrl, max = 300): { href: string; text: string }[]` (absolute, same host, no
  `#`-only, no `mailto:`/`tel:`/`javascript:`, de-duplicated).
- `looksLikeHtml(text): boolean` = `/^\s*(<!doctype html|<html|<head|<body)/i` on the first 500 characters.
- `hasMicrodataProduct(html): boolean` (`itemtype="http(s)://schema.org/Product"` in the first 2 MB).

### 3.7 `host.server.ts` (one canonical host)

```ts
export function publicHostRedirect(request: Request): Response | null
```
Returns a 301 to `https://usegeo.app<path><search>` when ALL of:
- method is GET or HEAD;
- `process.env.NODE_ENV === "production"`;
- the host (`x-forwarded-host`, else `host`, port stripped, lowercased) is `www.usegeo.app` or ends with
  `.up.railway.app`;
- the URL has none of `shop`, `host`, `embedded`, `hmac`, `id_token` in its query (Shopify admin traffic);
- the path is public: `/`, `/check`, `/tools`, `/tools/*`, `/privacy`, `/sitemap.xml`, `/llms.txt`.
`/robots.txt` is served on every host (bots must read it, not be redirected). `/app/*`, `/auth/*`,
`/webhooks/*`, `/api/*`, `/healthz`, `/check/:id` are never redirected (the Shopify app URL points at Railway).

Wire it in: `tools.tsx` loader (covers `/tools` and every tool), `_index/route.tsx` loader **after** its existing
`?shop=` redirect, a new `loader` in `check._index.tsx`, `privacy.tsx` loader, `sitemap[.]xml.ts`, `llms[.]txt.ts`.
Use `throw` of the Response inside loaders.

### 3.8 `guard.server.ts` (every tool POST)

```ts
export function allowedPost(request: Request): boolean
export async function readToolForm(request: Request, maxBytes: number): Promise<URLSearchParams | null>  // wraps readSmallForm from public-form.server.ts
export const honeypot = (form: URLSearchParams) => String(form.get("website") ?? "") !== "";
```
`allowedPost` is true when `sec-fetch-site` is `same-origin`, `same-site` or `none`; or there is no `Origin`
header; or the `Origin` host is one of: the request's `x-forwarded-host`/`host`, `usegeo.app`,
`www.usegeo.app`, the host of `SHOPIFY_APP_URL`. False when `sec-fetch-site` is `cross-site`.
(`fromAnotherSite` in `public-form.server.ts` compares origins with `request.url`, which is `http://` behind
Railway's proxy, so www visitors may be refused there: codebase-brief §1.7.)

Every tool form includes the honeypot exactly like `CheckForm`: a visually hidden `website` text field with
`tabIndex={-1}` and `autoComplete="off"`. **No visible field may be named `website`.** A tripped honeypot gets
the normal empty result, not an error.

Form size caps for `readToolForm`: URL forms 8 KB; paste forms 1 MB (the longest paste is 300,000 characters of
JSON-LD or HTML, and URL encoding can more than double it). Each tool still caps its own text length.

### 3.9 `limits.server.ts` (in memory, one Railway replica)

```ts
export function hit(tool: string, ipHash: string, rule: { perHour: number; perDay: number }): { ok: true } | { ok: false; error: string }
export function globalDaily(tool: string, max: number): boolean   // true while under today's (UTC) cap; counts the call
export class TtlCache<V> { constructor(max: number); get(k: string): V | undefined; set(k: string, v: V, ttlMs: number): void }
export const toolFetchGate: Gate;  // gate(() => envLimit("TOOLS_MAX_OPEN", 8)) from app/lib/gate.ts
```
- Sliding windows per `tool:ipHash`, where `ipHash = hashIp(clientIp(request))` from `public-form.server.ts`.
  Never store raw IPs. Prune entries older than 24 h on each call; cap the map at 50,000 keys (drop oldest).
- Limit message: "You've run a lot of checks. Please try again in an hour." (per hour) and "You've reached
  today's free checks. Please try again tomorrow." (per day). Global cap: "Our free checks are busy today.
  Please try again tomorrow." HTTP 429.
- Resets on deploy and doubles briefly while old and new processes overlap (codebase-brief §7.3). Fine for
  free fetches. The AI Overview tool also has a database spend cap (T1).

Per-tool limits:

| Tool | Per IP per hour | Per IP per day | Global per day | Paid calls |
|---|---|---|---|---|
| AI Overview (live searches; cached repeats don't count) | 10 | 30 | 1,000 | yes, see T1 |
| AI crawler (URL mode) | 20 | 100 | 5,000 | no |
| Product schema (URL mode) | 20 | 100 | 5,000 | no |
| llms.txt (URL mode) | 20 | 100 | 5,000 | no |
| AI bot checker (link mode) | 20 | 100 | 5,000 | no |
| Any paste-mode POST (no-JS fallback) | 60 | 300 | none | no |
| AI visibility | (uses the free check's existing DB limits: 3 good checks and 10 tries per IP per 24 h, 150 a day overall, US$10 a day) | | | yes, existing |

### 3.10 `fetch.server.ts` (guarded fetches for site tools)

```ts
export type FetchOutcome =
  | { kind: "ok"; status: number; url: string; text: string; html: boolean }
  | { kind: "missing"; status: number }          // 404, 410 and other 4xx except below
  | { kind: "turned-away"; status: number }      // 401, 403, 429
  | { kind: "server-error"; status: number }     // 5xx
  | { kind: "unreachable" };                     // bad address, private IP, DNS, timeout, too many redirects
export async function fetchSiteFile(url: string, opts?: { timeoutMs?: number; maxBytes?: number; accept?: string }): Promise<FetchOutcome>
```
- Wraps `safeFetch` from `check.server.ts` (SSRF guard, DNS rebinding guard, 4 redirects, UTF-8). Runs inside
  `toolFetchGate`. Defaults: 6 s per hop, 512 KB for text files, 2 MB for HTML pages.
- `safeFetch` returns no headers, so `html` comes from `looksLikeHtml(text)`.
- Never show a thrown error's message. Map every throw to `unreachable`.
- Our user agent stays `Mozilla/5.0 (compatible; GEO-check/1.0)` (set in `http-get.server.ts`). We never send a
  bot's user agent (0.9).

Plain error copy for the outcomes (shared, in `fetch.server.ts` as `OUTCOME_COPY`):
- unreachable: "We couldn't reach that site. Check the address, or try again in a minute."
- turned-away: "Your site turned our check away (a firewall or bot protection answered {status}). AI bots may be turned away too, so check your firewall or bot settings."
- server-error: "Your site answered with a server error ({status}). Try again in a few minutes."

### 3.11 `site-files.ts` (pure): robots.txt, sitemap.xml and llms.txt for usegeo.app

```ts
export function siteRobotsTxt(): string
export function sitemapXml(): string
export function siteLlmsTxt(): string
export const SITEMAP_PAGES: { path: string; updated: string }[]
```

robots.txt (exact):
```
# usegeo.app: search engines and AI assistants are welcome on every public page.
User-agent: *
Allow: /
Disallow: /app$
Disallow: /app?
Disallow: /app/
Disallow: /auth/
Disallow: /api/
Disallow: /webhooks/

Sitemap: https://usegeo.app/sitemap.xml
```
Why `/app$`, `/app?` and `/app/` instead of `/app`: robots rules match by prefix, so `Disallow: /app` would also
block `/apple-touch-icon.png`. (`/app?` covers the embedded app opened with `?shop=...`.) Do not disallow `/check/`, `/tips` or `/unsubscribe` (they carry `noindex`, which
Google must be able to read). No bot-specific groups (RFC 9309: a named group replaces the `*` group entirely).

sitemap.xml: UTF-8, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`, one `<url>` per page with
`<loc>` and `<lastmod>` (W3C date `YYYY-MM-DD`), no `<priority>` or `<changefreq>` (Google and Bing ignore them).
Pages: `/` (HOME_UPDATED), `/tools` (HUB.updated), the 7 tools in registry order (their `updated`), `/privacy`
(PRIVACY_UPDATED). Not listed: `/check` (0.4), `/check/:id`, `/auth/*`, `/app/*`, `/tips`, `/unsubscribe`.

llms.txt (built from the registry and `PLANS` in `plans.ts`; must pass the T5 checker with no problems):
```
# GEO

> GEO is a Shopify app that helps stores get their products recommended by AI assistants like ChatGPT, Gemini and Perplexity, and shows the sales that come from AI.

GEO has two plans: Standard at US$97 a month and Done-for-you at US$497 a month, both with a 7-day free trial. The free tools below need no sign-up.

## Free tools

- [AI Visibility Checker](https://usegeo.app/tools/ai-visibility-checker): See if ChatGPT, Gemini and Perplexity recommend your product, and who they pick instead.
- (one line per tool, registry order, `[name](url): short`)

## About GEO

- [Home](https://usegeo.app/): what GEO does, how it works and pricing
- [All free tools](https://usegeo.app/tools): the full list of free tools
- [Privacy policy](https://usegeo.app/privacy): what data GEO collects and why
```
Prices come from `PLANS.core.priceUsd`, `PLANS.pro.priceUsd`, `PLANS.core.trialDays` (never typed in).

Routes (resource routes, no default export): `robots[.]txt.ts` (`text/plain; charset=utf-8`,
`public, max-age=3600`), `sitemap[.]xml.ts` (`application/xml; charset=utf-8`, `public, max-age=3600`),
`llms[.]txt.ts` (`text/plain; charset=utf-8`, `public, max-age=3600`). HEAD must work.

### 3.12 `tool-ui.tsx` (shared components)

Reuse the `ck-*` frame classes from `check.css`; new classes `tl-*` live in `tools.css`.

```tsx
<ToolShell page={entry} hero={...} result={...} cta={{ text, href }} announce={string}>{children}</ToolShell>
// page: a ToolEntry, or { name, path } for the hub and the 404 page (breadcrumb then ends at "Free tools")
```
`ToolShell` renders, in order (so every page gets exactly one CTA, always right under the result):
1. `div.ck.tl` > `main.ck-page` > `div.ck-band` with the header (logo link to `/`, pill link "Free tools" to
   `/tools`), the visible breadcrumb `nav[aria-label="Breadcrumb"]` (Home > Free tools > {name}), then `hero`.
2. `div.ck-main` > `section.tl-result` (`result`, inside a wrapper with `min-height` so the page doesn't jump)
   then `ToolCta` (one `<a class="ck-btn ck-btn-dark tl-cta">`), then `children`.
3. `p.ck-sr[aria-live=polite]` with `announce`.
4. `<SiteFooter />`.
`cta` is required on every page except the 404 page.

Other exports:
- `ToolHero({ h1, intro, timing?, children })`: `h1.ck-h1`, `p.ck-lead` = intro, then the form (`children`),
  then the trust line `Free · No sign-up · {timing}` (tools pass `tool.h1` and `tool.timing`; the hub passes no timing).
- `SampleLabel({ children })`: the grey "Example" chip shown on every on-load sample.
- `WhatItChecks({ items })`: H2 "What this tool checks" + a short list.
- `Explainer({ id, question, children })`: an H2 question section.
- `HowItWorks({ items, updated })`: H2 "How this tool works" + list + "Maintained by GEO. Updated {date}."
- `ToolFaq({ faqs })`: H2 "Questions people ask", then H3 + paragraph per FAQ. **Always visible**, never collapsed
  (Microsoft: AI systems may not render hidden content; Google's "read more" links need visible text).
- `RelatedTools({ slugs })`: H2 "More free tools", three cards (name link + short line), then a plain link
  "See all free tools" to `/tools`.
- `UpdatedLine({ date })`: "Updated 11 October 2026 · Made by GEO" (GEO links to `/`).
- `CopyBox({ label, code, filename? })`: `<pre><code>` (scrolls inside the card, never the page) + a real
  `<button>` "Copy" that uses `navigator.clipboard.writeText`, falls back to selecting the text, and announces
  "Copied" politely. Without JS the code is still selectable.
- `StatusChip({ tone: "good" | "warn" | "bad" | "info" | "neutral", children })`.
- `ToolError({ message })`: `role="alert"` paragraph.
- `useToolSubmit()`: thin wrapper over `useFetcher` returning `{ Form, data, busy }`; after a result arrives it
  moves focus to the result heading (`tabIndex={-1}`). It never touches the URL or history.

Form controls: every input has a visible `<label>`; URL inputs use `type="text"`, `inputMode="url"`,
`autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}`, font size 16 px or more; buttons are real
`<button type="submit">`. The submit button shows "Checking…" while busy and works without JS.

### 3.13 `site-footer.tsx`

```tsx
<SiteFooter />
```
```
footer.tl-foot
  nav[aria-label="Free tools"]  "Free tools" heading, then "All free tools" (/tools) and the 7 tools in registry order (name as link text)
  nav[aria-label="GEO"]         Home (/), How it works (/#how), Pricing (/#pricing), Privacy (/privacy)
  p                              "GEO · Helps ChatGPT & co recommend your products"
```
Plain `<a href>` only. Two columns on phones, four on wide screens.

### 3.14 `tools.css`

- Scope everything under `.tl` (the shell adds it next to `.ck`). Set `color-scheme: light` (the site is light only).
- Define on `.tl` the neutral tokens from `design/overview/base.css`: `--warm-50 #f8f7f4`, `--warm-100 #f1f0ec`,
  `--line-soft #e6e5e0`, `--ink-2 #3d3e52`, a neutral soft shadow and `--ring-soft`.
- Result cards: white, 1 px `--line-soft` border, radius 24 px (20 px under 640 px), neutral shadow. Status
  colours reuse `check.css` green, amber and red tokens.
- **Purple only for focal points** (`docs/copy-deck.md` §14b): the hero band, the input form and its glow, and
  the single CTA card. Everything else neutral (white or `--warm-50`, grey chips, navy links with underline).
- Phones: 16 px side gutter; no horizontal page scroll at 360 px; `pre` and long URLs use
  `overflow-wrap: anywhere` or scroll inside their card; tap targets at least 44 px high.
- Respect `prefers-reduced-motion`. Visible focus rings (cobalt, as on the check pages). Text contrast at least 4.5:1.

### 3.15 `tools.tsx` (layout), `tools._index.tsx` (hub), `tools.$.tsx` (404)

- `tools.tsx`: `loader` = `publicHostRedirect`; `links` = `[...CHECK_FONT_LINKS, check.css, tools.css]`;
  `headers = toolHeaders`; an `ErrorBoundary` that renders `ToolShell`-style frame with "Something went wrong.
  Please try again." and the footer. Renders `<Outlet />`. No `meta` (each child sets its own).
- `tools.$.tsx`: status 404, `meta` with `noindex`, text "We couldn't find that tool." plus the 7 tool links.
- Hub page, see section 6.

### 3.16 Home page, `/check`, privacy

- `design/overview/parts/45-cta-footer.html`: add the block below inside `.foot-main`, after the existing
  `foot-links` nav; style it in `45-cta-footer.css` (two-column grid on phones, wraps cleanly on desktop):
  ```html
  <nav class="foot-tools" aria-label="Free tools">
    <p class="foot-tools-h">Free tools</p>
    <a href="/tools">All free tools</a>
    <a href="/tools/ai-visibility-checker">AI Visibility Checker</a>
    <a href="/tools/ai-overview-checker">AI Overview Checker</a>
    <a href="/tools/ai-crawler-checker">AI Crawler Checker</a>
    <a href="/tools/product-schema-checker">Product Schema Checker</a>
    <a href="/tools/llms-txt-checker">llms.txt Checker</a>
    <a href="/tools/faq-schema-generator">FAQ Schema Generator</a>
    <a href="/tools/ai-bot-checker">AI Bot Checker</a>
  </nav>
  ```
- `10-nav.html`: add `<li><a href="/tools">Free tools</a></li>` to `ul.nav-links`.
- `assemble.mjs` head template (`site` string): add `<link rel="canonical" href="https://usegeo.app/">`, OG tags
  (`og:type website`, `og:site_name GEO`, `og:title` = the page title, `og:description` = the existing meta
  description, `og:url https://usegeo.app/`, `og:image https://usegeo.app/og/home.png` with width, height,
  alt), `twitter:card summary_large_image`, and one JSON-LD `@graph` with the Organization (same as 3.3) and
  `WebSite` (`@id https://usegeo.app/#website`, `name` "GEO", `alternateName` "GEO for Shopify", `url`,
  `publisher` `#org`). Keep the title exactly as `test/home.test.ts` expects.
- Rebuild with `node design/overview/assemble.mjs`; commit the parts **and** `app/home/home.html` (Railway skips
  commits that only touch `design/**`). `npx vitest run test/home.test.ts` must stay green; add assertions
  that the footer links `/tools` and every registry path.
- `_index/route.tsx`: call `publicHostRedirect` after the existing `?shop=` redirect. Nothing else.
- `check._index.tsx`: add to `meta` the canonical `{ tagName: "link", rel: "canonical", href: "https://usegeo.app/tools/ai-visibility-checker" }`
  (R1); add `export const loader = ({ request }) => { const r = publicHostRedirect(request); if (r) throw r; return null; }`.
  Do not touch its action.
- `privacy.tsx`: `meta` via `pageMeta` (title "GEO privacy policy", a one-line description, canonical
  `/privacy`); add a "Free tools" section (text in section 8.2).

### 3.17 OG images: `scripts/tools-og.py`

Python 3 + Pillow (installed in this sandbox; dev-time only, not part of the Docker build). Writes 1200 x 630 PNGs
to `public/og/`: `home.png` (centre crop of `design/overview/img/clay-storefront.jpg`), `tools.png`, and one per
tool slug. Each tool image is a clean drawing of that tool's result (white card on a soft lilac-to-white
background: rows with green and grey dots for the crawler checker, a numbered source list for AI Overviews, code
lines for FAQ and llms.txt, a field list with ticks for product schema, highlighted text lines for the bot
checker, a score ring for AI visibility). At most the tool name as text; no logo (Google advises against logos
and text-heavy images for thumbnails). Under 200 KB each. Commit the PNGs. Static files in `public/` are served
before routes, so `/og/*` never collides with a route.

### 3.18 Foundation tests (`test/tools-foundation.test.ts`, `test/tools-site-files.test.ts`)

- Registry: 7 entries; unique slugs; slug matches `^[a-z0-9-]+$`; `path === "/tools/" + slug`; title length
  under 60; description length under 155; short under 95; `related` has 3 valid slugs, none equal to itself;
  `updated` is an ISO date not in the future; `ogImage` file exists in `public/`.
- No em dash (U+2014) and no spaced en dash (U+2013 with a space on each side) in: the registry, `site-files.ts` output, `tool-ui.tsx`,
  `site-footer.tsx`, and (added by each tool builder) every `copy/*.ts` module.
- `pageMeta`: exactly one canonical, absolute, on `https://usegeo.app`; og:url equals the canonical; no
  `nosnippet`; `toolJsonLd` parses as JSON, has no `aggregateRating`/`review`, `dateModified` equals `updated`,
  FAQPage questions equal the given FAQ array exactly.
- robots.txt: parse it with `parseRobots`/`isAllowed` from `robots.ts`: for `Googlebot`, `OAI-SearchBot`,
  `GPTBot`, `PerplexityBot`, `ClaudeBot`: `/`, `/tools/ai-crawler-checker`, `/check/abc`,
  `/apple-touch-icon.png`, `/llms.txt` allowed; `/app`, `/app?shop=a.myshopify.com`, `/app/fixes`, `/auth/login`, `/webhooks/x`, `/api/pixel`
  blocked. Contains the Sitemap line. `existsSync("public/robots.txt")` is false (same for sitemap.xml, llms.txt).
- sitemap.xml: well-formed; exactly the 10 expected `<loc>`s; every `<loc>` starts `https://usegeo.app/`; no
  `priority`/`changefreq`; lastmod values match the registry.
- `SiteFooter` (render with `createElement` + `renderToStaticMarkup`): links `/tools` and all 7 registry paths.
- `home.html` contains every registry path and `/tools` (keep in sync with the registry by test).
- `publicHostRedirect`: 301 for `www.usegeo.app/tools` and `x.up.railway.app/`; none for `usegeo.app`, for
  POST, for `/app`, for `/?shop=a.myshopify.com`, for `/robots.txt`, outside production.
- `allowedPost`: allows same-origin, www to apex, no Origin; refuses `sec-fetch-site: cross-site` and
  `Origin: https://evil.example`.
- `limits.server.ts`: the 11th AI Overview hit in an hour is refused; windows slide; `TtlCache` expires and caps.
- `normalizeSiteInput`: adds https, keeps path, drops query and hash, rejects `localhost`, `10.0.0.1`,
  `http://a.com:8080`, `user:pw@a.com`, empty input, 2,001 characters.

## 4. The page template (every tool page)

### 4.1 Order on the page (phone first, 360 px)

1. Band: header, breadcrumb, **H1**, the one or two sentence answer-first intro ("The X is a free tool that..."),
   the form, the trust line. The form must be visible without scrolling on a 360 x 740 screen.
2. **Result area**: on load, a sample result (labelled with `SampleLabel`) or a live in-browser result from
   pre-filled text. After a run, the visitor's result replaces it in the same place. Space is reserved so the
   page doesn't jump (CLS under 0.1).
3. **The one button** (`ToolShell` `cta`). Nothing else styled as a button below the result.
4. "What this tool checks" (3 to 5 bullets).
5. Explainer sections where the tool needs them (H2 questions, each answered in its first sentence, 80 to 200 words).
6. "How this tool works" (methodology).
7. "Questions people ask" (4 to 6 FAQs, visible).
8. "More free tools" (3 related + link to the hub).
9. "Updated {date} · Made by GEO".
10. Site footer (all 7 tools, hub, home, pricing, privacy).

### 4.2 Server and client split (all tools)

- **Server-rendered on first load, with JavaScript off:** title, meta description, canonical, OG and Twitter tags,
  JSON-LD, breadcrumb, H1, intro, the form, the sample result, the CTA, every explainer, methodology and FAQ
  text, related tools, updated line, footer. Check with `curl` (section 7.3).
- **Every tool works without JavaScript:** forms are real `<form method="post">` that the route's `action`
  answers with the full page. With JavaScript, `useToolSubmit` posts the same form through a fetcher and swaps
  only the result.
- **Paste-mode tools run live in the browser** (debounced about 250 ms) using the same pure module the server uses
  for the sample and for no-JS posts. Pure modules must stay small (no new packages).
- **POST only** for anything that fetches a page or spends money, so links and crawlers can't trigger work.
  Action responses use `noStore` headers. No result ever gets its own URL; nothing is written to the address bar
  (no `pushState`, so the back button is never trapped).
- Action return shape: `{ ok: true, result } | { ok: false, error: string }`; validation errors are 400, limits
  429, our own failures 502 with friendly copy. Never put a raw `err.message` on screen.
- Every action: `allowedPost` (else 403 "Please run the check from usegeo.app."), `readToolForm` (else 413),
  honeypot, `normalize` input, limits, then work.

### 4.3 Copy rules for every page

- The H1 holds the exact search term. The first sentence under it is a definition: "The {Tool} is a free tool
  that ...". Name things precisely (OpenAI's OAI-SearchBot, Google AI Overviews, Shopify, llmstxt.org).
- Every result opens with a one-line verdict in plain words, then the detail.
- Each factual claim in explainers and FAQs links to its primary source on the page where it helps (a plain
  "Source" link after the sentence or a "Sources" line under the FAQ), using the URL in the source comment.
- Never claim llms.txt, schema, FAQ markup or any single fix gets a store into ChatGPT or Google's AI. Never say
  FAQ markup gets rich results.
- Don't promise speed you can't measure. Use the registry `timing` line only.
- Each copy module exports `INTRO`, `WHAT_IT_CHECKS`, `EXPLAINERS?`, `HOW_IT_WORKS`, `FAQS`, `CTA` and any result
  strings, and its test asserts no em dash.

### 4.4 Structured data and head (all tools)

`meta = () => pageMeta({ path: tool.path, title: tool.title, description: tool.description, image: tool.ogImage, imageAlt: tool.ogAlt, jsonLd: toolJsonLd(tool, FAQS) })`.
`links` come from the `tools.tsx` layout plus the tool's own stylesheet. `headers = toolHeaders`.

---

## 5. The seven tools

Each section has: URL, SEO fields, intro, inputs and on-load state, result layout, the button, methodology, FAQs,
secondary keywords, structured data, server and client split, limits and costs, edge cases and errors, tests.
SEO fields (title, meta description, H1) are in the registry (3.2) and repeated here for convenience.

### T1. AI Overview Checker

- **URL:** `/tools/ai-overview-checker`
- **Title:** `AI Overview Checker: Is Your Site Cited by Google AI? | GEO`
- **Meta description:** `Free AI Overview checker. Type a shopping search to see if Google shows an AI Overview, which sites it cites and if yours is one. No sign-up.`
- **H1:** `AI Overview Checker`
- **Intro:** "The AI Overview Checker is a free tool that searches Google for you and shows whether Google answered with
  an AI Overview, which websites it cited, and whether your site is one of them. Results come from Google in the
  United States."

**Inputs**
- `q` (required): label "What would a shopper type into Google?", placeholder `best beard oil for dry skin`,
  2 to 200 characters after trimming.
- `domain` (optional): label "Your website (optional)", placeholder `yourstore.com`. Parsed with
  `normalizeSiteInput`; only the host is kept. (Not named `website`: that is the honeypot.)
- Submit: "Check Google".
- Example buttons under the form, inside the same form, `name="example"`, with `formNoValidate` (the `q` field is
  `required`, so without it an empty box would block the example):
  "best sunscreen for oily skin", "beard oil for dry skin", "vegan protein powder for women". The action uses
  `example` when present. Work without JS.

**On load:** the real sample captured for this spec (below), labelled: "Example result: “best sunscreen for oily
skin”, Google US, checked 11 October 2026". No domain is set in the sample.

**Result layout**
1. Verdict: "Google showed an AI Overview for this search" (neutral-good chip) or "No AI Overview for this
   search" (neutral chip) + one line: "Google doesn't show one for every search, and it can change from one
   search to the next."
2. If a domain was given, a "Your site" line, one of:
   - "Your site is cited: source {n} of {N}."
   - "Your site isn't cited, but it ranks #{k} in the normal results below."
   - "Your site isn't cited and isn't in the top 10 normal results."
   - (no overview) "No AI Overview here. Your site ranks #{k} in the normal results." / "...isn't in the top 10."
3. "Start of the overview" quote block, plain text, at most 700 characters, with the note "As Google shows it
   before “Show more”." when the text was cut (Crawl4AI). From AnyAPI, the full text trimmed to 1,200 characters.
4. "Sites the overview cites": ordered list. Each: number, domain (link out, `rel="nofollow noopener noreferrer"`,
   `target="_blank"`), page title, type chip from `guessSourceType(url, domain)` in `sources.ts` with the labels
   used on the check pages (Review site, Retailer, Forum or video, Brand site, Marketplace, Other), an
   "Also ranks #k" tag when the same domain is in the top 10, and a "Your site" badge on a match.
5. "What this means for you": 1 to 4 lines picked by rule from the cited types (no numbers invented):
   - editorial present: "Review and roundup pages are cited here. Getting your product onto one of them is the most direct way into this answer."
   - retailer present: "Big retailers are cited. If you sell through them, complete product details there help."
   - ugc present: "Forum and video pages are cited. Helpful answers in those threads, where you say who you are, can help."
   - brand present: "Brand and shop pages are cited directly. Product pages with clear facts near the top give yours the same chance."
   - always last: "Track this over time for free in Google Search Console's Generative AI performance report."
6. "Normal results (top 10)": compact list of rank, domain, and a "cited" marker. Hidden when the source gave none.
7. "People also ask" (up to 4 questions, only from Crawl4AI) + plain link "Answer questions like these with the
   FAQ Schema Generator" to `/tools/faq-schema-generator`.
8. Small print: "One search, one moment. AI Overviews change between searches and can differ by country and
   device. We search Google in the United States, signed out, in English."

**Button:** "See how GEO gets you into AI answers" → `/?ref=tool-ai-overview-checker#how`

**What this tool checks:** "Whether Google showed an AI Overview for your search" · "Every site the overview
links to, in order" · "Whether your site is cited, and where it ranks in the normal results" · "What kind of sites
Google trusts for this search" · "Questions people also ask".

**How this tool works (methodology)**
- "We send your search to Google in the United States through a search data provider and read the results page
  as it loads for a signed-out visitor. If that doesn't answer, we ask a second provider for the AI Overview."
- "We show the overview as Google displays it before you press “Show more”, every site it links to, and the top
  10 normal results."
- "If you add your website, we compare it with every cited link and every normal result. Subdomains count, so
  shop.yourstore.com counts as yourstore.com."
- "We sort cited pages into types (review site, retailer, forum or video, brand site, marketplace) from the web
  address. It's a quick guess, not a judgement."
- "We keep each result for 24 hours, so the same search within a day shows the same answer."
- "Limits: one search at one moment, from the US, in English. This tool doesn't check AI Mode, which Google says
  can show different answers and links."

**FAQs** (exact text; the same array feeds FAQPage JSON-LD)
1. **What is a Google AI Overview?**
   An AI Overview is a short answer written by Google's AI that appears above the normal results for some
   searches, with links to the pages it used. Google says it shows one when its systems decide generative AI can
   be especially helpful, so many searches don't get one.
   <!-- source: https://support.google.com/websearch/answer/14901683 (facts §6.1, §6.3) -->
2. **Why didn't my search show an AI Overview?**
   Google only shows an AI Overview when it decides one will help, and the answer can change from one search to
   the next. Try the search the way a shopper would ask it, as a full question. In Ahrefs' study of 146 million
   desktop searches (September 2025 data), 57.9% of question searches showed an AI Overview, compared with
   20.5% of all searches.
   <!-- source: https://ahrefs.com/blog/ai-overview-triggers/ (facts §6.2); published 10 Nov 2025 -->
3. **How do I get my store cited in AI Overviews?**
   AI Overviews draw on Google's normal search index, so your page has to be indexed and allowed to show a
   snippet. Then make sure Googlebot can read your product pages, put clear facts near the top of each page, and
   work on getting your products onto the review and roundup pages AI Overviews already cite. The cited sites in
   your result are your list of pages to approach.
   <!-- source: https://developers.google.com/search/docs/appearance/ai-features ; https://developers.google.com/search/docs/fundamentals/ai-optimization-guide -->
4. **Can I keep my site out of AI Overviews?**
   Yes. In Google Search Console, go to Settings, then Search generative AI, and choose Exclude. That keeps your
   site out of AI Overviews and AI Mode, and changes take about 1 to 2 days. Blocking Google-Extended in
   robots.txt doesn't do this: it affects the Gemini app, not Google Search.
   <!-- source: https://support.google.com/webmasters/answer/16908024 ; Google-Extended: https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers (facts §1.2, §6.3) -->
5. **Why is my result different from what I see on Google?**
   AI Overviews change between searches and can differ by country and device, and Google personalises AI Mode
   for signed-in users. We search from the United States, signed out, so your own Google may show something
   different. Treat each result as one snapshot.
   <!-- source: https://support.google.com/websearch/answer/16011537 (AI Mode personalisation, facts §6.4). AI Overview personalisation is UNVERIFIED, so it is not claimed. -->
6. **Is AI Mode the same as AI Overviews?**
   No. AI Mode is a separate, chat-style way to search Google. Google says AI Mode and AI Overviews may use
   different models and techniques, so the answers and links can differ. This tool checks AI Overviews only.
   <!-- source: https://developers.google.com/search/docs/appearance/ai-features -->

**Secondary keywords (work in naturally, never stuff):** google ai overview checker, ai overviews checker free,
check if my site is in ai overview, ai overview citation checker, ai overview tracker free, sge checker,
is my product in google ai overview.

**Structured data:** standard tool graph (3.3) with these FAQs.

**Server and client split**
- Pure `aio.ts`: `normalizeQuery`, `parseCrawl4ai(raw)`, `parseAnyApi(raw)`, `matchDomain(result, host)`,
  `meaningLines(result)`, types. Used by server and tests.
- `aio.server.ts`: `checkAio(query): Promise<AioResult>` with cache, caps and Treg calls.
- Route: SSR with the sample; action runs `checkAio`, then `matchDomain` with the visitor's host.

```ts
export interface AioResult {
  query: string; checkedAt: string; country: "US";
  provider: "crawl4ai" | "anyapi";
  shown: boolean;
  text: string;                 // "" when not shown
  textCut: boolean;             // true when Google's "Show more" cut it (Crawl4AI)
  sources: { url: string; title: string; domain: string; type: SourceType | null }[];
  organic: { position: number; url: string; domain: string; title: string }[];  // [] from AnyAPI
  peopleAlsoAsk: string[];      // [] from AnyAPI
}
```

Provider calls (both through `tregCall` from `treg.server.ts`, `shopId: null`):
1. `tregCall("crawl4ai.google.serp.organic", { method: "GET", query: { q, country: "us", language: "en" }, timeoutMs: 20_000 })`.
   Parse: `shown = blocks.includes("ai_overview") && ai_overview?.text`; `text = ai_overview.text`;
   `textCut = true` for every Crawl4AI overview (it returns the text shown before "Show more", so always label it
   "Start of the overview"); `sources = ai_overview.sources`;
   `organic = results.map(position, url, domain, title)`; `peopleAlsoAsk = people_also_ask.slice(0, 4)`.
   The "no AI Overview" shape (likely `ai_overview` missing or null, and `blocks` without it) is UNVERIFIED:
   handle missing, null and empty text the same way, and save a fixture the first time one is seen.
2. Only if step 1 throws, times out or returns no `blocks`: `tregCall("anyapi.google.serp.ai_overview", { body: { prompt: q }, timeoutMs: 30_000 })`.
   Parse with the same rules as `fromAnyApiAio` in `answers.ts`: `output.found` and
   `output.data.{answerMarkdown|answer, citations[{title,url}]}`. If the answer starts with "AI Mode replied",
   set `shown: false` and add the line "Google offered an AI Mode answer for this search, not an AI Overview."
   Strip a trailing "Share public link" line. Show the text as plain text (no Markdown rendering).
3. Both fail: error "Google's results didn't come through this time. Please try again in a minute." (502). Don't cache failures.

**Limits and costs**
- Cache: `TtlCache<AioResult>` keyed by `normalizeQuery(q)` (lowercase, trim, collapse spaces, strip trailing
  `?!.`, NFC), 24 hours, max 1,000 entries. The domain is not in the key. Cached answers don't count toward limits.
  The sample query is pre-seeded in the cache from the sample (no call).
- Per IP 10 live searches an hour, 30 a day; 1,000 live searches a day per process.
- Spend cap in the database (survives deploys): before a live search, sum `ApiCost.usd` where `shopId` is null,
  `endpoint` in the two endpoints above, `createdAt` in the last 24 h; refuse when at or over
  `GEO_TOOLS_USD_PER_DAY` (new env var, default `2`, read with a safe default). Copy: "Our free Google checks are
  busy today. Please try again tomorrow."
- Cost logging: `tregCall` records the provider-reported cost. Crawl4AI reports its charge only in a header, so
  `tregCall` records 0 for it. After each successful Crawl4AI call, `aio.server.ts` adds
  `recordCost(null, "treg", "crawl4ai.google.serp.organic", 0.00015)` (`cost.server.ts`). When the review of
  `treg.server.ts` is done, the integrator may move that price into its `PRICES` table and delete the extra call.
- Expected cost: US$0.00015 per live search on Crawl4AI, US$0.0015 to US$0.0018 on the AnyAPI backup
  (Treg catalog, 11 Oct 2026). These rows also count toward the free check's US$10 daily cap
  (`platformSpend` sums every `shopId: null` row), which the US$2 tools cap keeps small.

**Edge cases and errors**
- Empty or 1 character: "Type a search, like best beard oil for dry skin." (400)
- Over 200 characters: "Please keep the search under 200 characters." (400)
- A URL typed as the search: allowed (Google accepts it), no special case.
- Bad domain: "That doesn't look like a web address. Try something like yourstore.com." Run the search anyway and
  skip the "Your site" line.
- Overview shown but no sources: show the text and "Google didn't link any sites in this overview."
- Duplicate domains in sources: keep each link, show "Your site" on every match.
- Non-English results: shown as they come.

**Sample data** (`samples/aio-sample.ts`), captured with Crawl4AI on 11 Oct 2026 about 06:33 UTC. Store as an
`AioResult`. The overview text is trimmed to its first sentence on purpose (the rest contains prices and
ratings formatted with dashes; the trimmed text is exact):
```ts
export const AIO_SAMPLE: AioResult = {
  query: "best sunscreen for oily skin", checkedAt: "2026-10-11", country: "US", provider: "crawl4ai",
  shown: true, textCut: true,
  text: "The best sunscreens for oily and acne-prone skin are lightweight, oil-free, non-comedogenic formulas that provide a shine-free or matte finish.",
  sources: [
    { url: "https://www.walmart.com/ip/Eucerin-Sun-Clear-Skin-Oil-Control-Face-Sunscreen-Lotion-SPF-50-2-5-fl-oz-Bottle/900570371", title: "Walmart", domain: "walmart.com", type: "retailer" },
    { url: "https://www.target.com/p/eucerin-face-oil-control-sunscreen-lotion-spf-50-2-5-fl-oz/-/A-83695787", title: "Target", domain: "target.com", type: "retailer" },
    { url: "https://www.allure.com/gallery/best-sunscreen-for-oily-skin", title: "These Are the Best Sunscreens for Oily Skin Types, Full Stop | Allure", domain: "allure.com", type: "editorial" },
    { url: "https://www.osvidermatology.com/press/17-best-sunscreens-for-oily-skin-that-dont-feel-greasy-tested-and-reviewed-for-2023", title: "17 Best Sunscreens for Oily Skin that Don't Feel Greasy (Tested and Reviewed for 2023)", domain: "osvidermatology.com", type: "editorial" },
    { url: "https://charlottaeve.com/2018/05/09/best-sunscreens-for-oily-skin/", title: "Best sunscreens for oily skin", domain: "charlottaeve.com", type: "editorial" },
  ],
  organic: [
    { position: 1, domain: "reddit.com", url: "https://www.reddit.com/r/AsianBeauty/comments/1eg3w7y/oily_skin_girlies_what_sunscreen_and_moisturizer/", title: "oily skin girlies, what sunscreen and moisturizer do u ..." },
    { position: 2, domain: "osvidermatology.com", url: "https://www.osvidermatology.com/press/17-best-sunscreens-for-oily-skin-that-dont-feel-greasy-tested-and-reviewed-for-2023", title: "17 Best Sunscreens for Oily Skin that Don't Feel Greasy ..." },
    { position: 3, domain: "allure.com", url: "https://www.allure.com/gallery/best-sunscreen-for-oily-skin", title: "These Are the Best Sunscreens for Oily Skin Types, Full Stop" },
    { position: 4, domain: "intothegloss.com", url: "https://intothegloss.com/2016/04/best-sunscreens-for-oily-skin/", title: "The Best Sunscreens For Oily, Acne-Prone Skin" },
    { position: 5, domain: "target.com", url: "https://www.target.com/s/sunscreen+for+oily+skin", title: "Sunscreen for Oily Skin: Lightweight SPF Options" },
    { position: 6, domain: "facebook.com", url: "https://www.facebook.com/ChoiceLegacyOfficial/posts/the-perfect-sunscreens-for-oily-skin-this-summer-oilyskinsunscreen-summerskincar/944821835219991/", title: "The Perfect Sunscreens for Oily Skin This Summer! ..." },
    { position: 7, domain: "advanceddermchi.com", url: "https://advanceddermchi.com/best-sunscreen-for-oily-skin-expert-dermatologist-approved-picks-for-2025/", title: "Best Sunscreen for Oily Skin: Dermatologist Tips" },
    { position: 8, domain: "youtube.com", url: "https://www.youtube.com/shorts/1qcSaSdfhmU", title: "Sunscreen for Oily Skin (No Breakouts)" },
    { position: 9, domain: "stream2sea.com", url: "https://stream2sea.com/collections/best-sunscreen-for-oily-skin-dermatologist-recommended", title: "Dermatologist Recommended Sunscreen for Oily Skin" },
  ],
  peopleAlsoAsk: ["Which brand sunscreen is best for oily skin?", "What sunscreen is best for oily skin?", "What is the best SPF for oily skin?", "What is the best daily sunscreen for oily skin?"],
};
```
(Walmart and Target URLs above have their tracking parameters removed. `type` values: run `guessSourceType` in
the test and use whatever it returns; if it returns null for a domain, show "Other". The sample shows a useful
pattern: Allure and OSVI rank in the top 3 and are cited, Reddit ranks #1 and is not.)

**Tests (`test/tools-aio.test.ts`)**
- `parseCrawl4ai` on a fixture saved from the three 11 Oct 2026 responses (`crawl4ai-serp-aio.json`): shown,
  5 sources, 9 organic, 4 PAA. On a hand-made "no overview" fixture (`ai_overview` absent, and a second with
  `null`): `shown: false`, no crash.
- `parseAnyApi` on `test/fixtures/anyapi-aio.json`: answer starting "AI Mode replied" gives `shown: false`.
- `matchDomain`: `www.allure.com` matches `allure.com`; `shop.allure.com` matches `allure.com`; `notallure.com`
  doesn't; organic rank found.
- `normalizeQuery`: case, spaces, trailing `?`.
- Action with `treg.server` and `cost.server` mocked: cache hit makes no call; Crawl4AI failure falls back to
  AnyAPI; both failing gives 502 copy; the 11th live search in an hour gives 429; spend over the cap makes no
  Treg call (mock the DB sum); cross-site POST 403; honeypot gives an empty result and no call; extra
  `recordCost` written once per Crawl4AI success.
- Meta test (3.18 rules) and no em dash in `copy/ai-overview-checker.ts`.
- No-JS: `curl` the built page and see the H1, the intro and "Sites the overview cites" from the sample.

### T2. AI Crawler Checker

- **URL:** `/tools/ai-crawler-checker`
- **Title:** `AI Crawler Checker: Which AI Bots Can Read Your Site | GEO`
- **Meta description:** `Free AI crawler checker. See which AI bots your robots.txt lets in, like OAI-SearchBot, GPTBot and PerplexityBot, with Shopify fixes. No sign-up.`
- **H1:** `AI Crawler Checker`
- **Intro:** "The AI Crawler Checker is a free tool that reads your site's robots.txt and shows which AI bots, like
  OpenAI's OAI-SearchBot and GPTBot, may read your pages, which blocks actually hide you from AI answers, and how
  to fix them on Shopify."

**Inputs**
- Form 1 (`intent=fetch`): `url`, label "Your website or any page on it", placeholder `yourstore.com`; submit
  "Check my site". Parsed with `normalizeSiteInput`.
- Form 2 (`intent=paste`), inside the result card: `text` textarea, label "Test a robots.txt before you publish
  it", max 100,000 characters; submit "Test this robots.txt" (no JS); with JS it re-checks live as you type.

**On load:** the paste card, pre-filled with the made-up sample below and its result, labelled "Example: a
made-up robots.txt that blocks two bots. Edit it to test your own rules."
```
# Example robots.txt (made up)
User-agent: *
Disallow: /cart
Disallow: /checkout

User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Disallow: /products/
```
It teaches both lessons at once: GPTBot blocked (training only, ChatGPT search unaffected) and PerplexityBot
blocked from products (hides products from Perplexity's answers).

**Bots checked** (`TOOL_BOTS` in `crawler.ts`, separate from `AI_BOTS` in `robots.ts`, which drives the in-app
check and its tests and must not change). Facts from `facts-2026.md` §1.2, each company's own docs, checked
11 Oct 2026. `level` sets the verdict: high and medium blocks are problems, low is a tip, info is a note.

| token | owner | group | level | what (exact copy) | docs |
|---|---|---|---|---|---|
| Googlebot | Google | recommend | high | Google Search's crawler. Google AI Overviews and AI Mode answer from what it reads. | https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers |
| OAI-SearchBot | OpenAI | recommend | high | Decides whether your pages can show up in ChatGPT search answers. OpenAI says changes take about 24 hours. | https://developers.openai.com/api/docs/bots |
| PerplexityBot | Perplexity | recommend | high | Decides whether your pages can show up in Perplexity's answers. | https://docs.perplexity.ai/guides/bots |
| Bingbot | Microsoft | recommend | high | Bing's crawler. Microsoft Copilot answers come from Bing, and ChatGPT search also uses Microsoft as a search provider. | https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0 |
| Claude-SearchBot | Anthropic | recommend | medium | Reads pages for Claude's search results. Anthropic says blocking it may reduce your visibility in Claude. | https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler |
| Google-Extended | Google | recommend | medium | A robots.txt setting, not a crawler. It lets Gemini use your pages for training and to ground answers in the Gemini app. It doesn't affect Google Search or AI Overviews. | Google common crawlers (above) |
| Applebot | Apple | recommend | medium | Apple's crawler for Siri, Spotlight and Safari, including Apple's AI answers with links. If your file doesn't name Applebot, Apple follows your Googlebot rules. | https://support.apple.com/en-us/119829 |
| Meta-WebIndexer | Meta | recommend | medium | Helps Meta AI cite and link to your pages in its answers. | https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers.md |
| Amzn-SearchBot | Amazon | recommend | medium | Lets your pages appear in Amazon search experiences such as Alexa. Amazon says it isn't used for AI training. | https://developer.amazon.com/amazonbot |
| DuckAssistBot | DuckDuckGo | recommend | medium | Reads pages for DuckDuckGo's AI-assisted answers. It doesn't affect normal DuckDuckGo results. | https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot |
| Storebot-Google | Google | recommend | medium | Google Shopping's crawler. It affects all Google Shopping surfaces, like the Shopping tab. | Google common crawlers |
| MistralAI-Index | Mistral | recommend | low | Indexes pages for Mistral's search, which answers questions in Mistral's assistant. | https://docs.mistral.ai/robots |
| ChatGPT-User | OpenAI | fetch | info | Fetches a page when someone asks ChatGPT about it. OpenAI says robots.txt rules may not apply to it. | OpenAI bots |
| Claude-User | Anthropic | fetch | medium | Fetches a page when someone asks Claude about it. Anthropic says it follows robots.txt, so a block stops Claude reading your page for that person. | Anthropic article |
| Perplexity-User | Perplexity | fetch | info | Fetches a page when someone asks Perplexity about it. Perplexity says it generally ignores robots.txt. | Perplexity bots |
| meta-externalfetcher | Meta | fetch | info | Fetches a page when someone asks Meta AI to. Meta says it may bypass robots.txt. | Meta crawlers |
| Amzn-User | Amazon | fetch | info | Fetches a page live when someone asks Alexa a question. Amazon says it may not follow every robots.txt rule. | Amazon bots |
| MistralAI-User | Mistral | fetch | info | Fetches a page when someone asks Mistral's assistant to. | Mistral robots |
| GPTBot | OpenAI | training | info | Collects pages to train OpenAI's models. Blocking it stops training use, not ChatGPT search. | OpenAI bots |
| ClaudeBot | Anthropic | training | info | Collects pages to train Anthropic's models. Blocking it stops training use, not Claude's answers. | Anthropic article |
| Applebot-Extended | Apple | training | info | A robots.txt setting for training Apple's AI models. Apple says blocking it doesn't remove you from its search results. | Apple |
| meta-externalagent | Meta | training | info | Collects pages to train Meta's AI models or improve its products. Meta doesn't say blocking it hides you from Meta AI. | Meta crawlers |
| Amazonbot | Amazon | training | info | Collects pages to improve Amazon's products and may train its AI models. Blocking it doesn't block Amzn-SearchBot. | Amazon bots |
| CCBot | Common Crawl | training | info | Builds Common Crawl's open web archive, which many AI training sets are built from. | https://commoncrawl.org/faq |
| MistralAI-Training | Mistral | training | info | Collects pages to train Mistral's models. Mistral says it isn't used for search or live answers. | Mistral robots |

Group headings (exact): "Can recommend or cite you", "Fetch a page when someone asks", "Training only:
blocking these doesn't hide you from answers". Do not add Bytespider or any xAI token (no official docs found,
facts §1.2). Google-Agent is not a robots.txt token: mention it only in the limits box.

**Fallback rule:** `fallbacks: { Applebot: ["Googlebot"] }`. For each bot, pick the first token in
`[bot, ...fallbacks]` that has its own group (`groups.some(g => g.agents.includes(t.toLowerCase()))`), else the
bot's own token (which falls back to `*` inside `isAllowed`). Show it: "No Applebot rules, so Apple follows your
Googlebot rules." Amazon's "follows the rules for other search bots" is too vague to code (facts §1.4): treat
Amzn-SearchBot like any other bot.

**Pages tested:** the home page `/`; the path the visitor entered (if not `/`); one product page and one
collection page found on the home page (first same-host `/products/<handle>` and `/collections/<handle>` link from
`sameHostLinks`, query stripped). On a Shopify store with none found, use `/products/a` labelled "a product page"
and `/collections/all` labelled "a collection page". On other sites, only `/` and the entered path, plus the line
"We couldn't find product links on your home page, so we tested your home page."

**Shopify detection:** home page HTML has `Shopify.shop` or `cdn.shopify.com`, or the robots.txt has Shopify's
markers. Robots file kinds:
- `shopify-new-default`: first line starts `# Shopify storefront.` (facts §1.3, observed on Shopify's Horizon demo).
- `shopify-old-default`: Shopify layout markers (`Disallow: /checkouts/`, `-remote` rules, the old header comment)
  and no group naming any bot in `TOOL_BOTS`. Verify the old header comment text on a live store before
  matching it; the structural markers are enough on their own.
- `shopify-custom`: Shopify markers plus at least one group naming a bot in `TOOL_BOTS`.
- `other`.

**Result layout**
1. Verdict:
   - "{n} bots that affect AI answers are blocked" (bad) when any high or medium bot, in any group, is blocked
     anywhere tested (Claude-User is medium, so it counts);
   - else "All the bots that affect AI answers can read your pages" (good);
   - second line about training bots: "{n} training bots are blocked. That only stops AI training." or
     "Training bots are allowed too." 
   - Shopify standard file: add "You have Shopify's standard robots.txt. It blocks no AI bot."
2. "Pages we tested" chips with paths.
3. Three groups. Each bot row: name (link to the owner's docs), owner, the `what` line, status per page
   (Allowed / Blocked), the rule source when blocked: "Blocked by line {n}: `Disallow: /products/` (in the
   `User-agent: PerplexityBot` group)". For `fetch` bots marked "may not follow robots.txt", add that note even
   when allowed. Rows sorted: blocked first within each group.
4. "Fix it on Shopify" box, shown when the site is Shopify or anything high/medium is blocked:
   - Steps (exact): "In Shopify admin, go to Online Store, then Themes. Next to your live theme, click the three
     dots and choose Edit code. In the Templates folder, open robots.txt.liquid. Delete the lines shown below,
     save, then run this check again."
   - A `CopyBox` titled "Lines to delete" listing the exact blocking lines with their line numbers (from
     `explainBlock`). Never generate replacement rules that block anything.
   - "No robots.txt.liquid file? Then your store uses Shopify's standard file, and the block comes from somewhere
     else: an app, a developer, or a service in front of your store such as Cloudflare. Ask them to remove it."
   - "Want Shopify's standard rules back? Delete robots.txt.liquid (copy it somewhere first)." Verify against
     Shopify's robots.txt.liquid docs before shipping this sentence; if unverifiable, drop it.
5. "What robots.txt can't show" box (always): "A firewall or bot protection, such as Cloudflare's setting that
   blocks AI bots, can turn bots away before they read robots.txt. Google also has a switch in Search Console
   (Settings, then Search generative AI) that can keep a site out of AI Overviews. And some assistants fetch a
   page when a person asks and say robots.txt may not apply to those visits, including Google-Agent."
6. Button.

**Button:** "Let GEO check this for you every week" → `/?ref=tool-ai-crawler-checker#how`
(True: the app reads each store's robots.txt weekly, `robots.server.ts`, docs/geo-research.md §2.)

**What this tool checks:** "Your live robots.txt, read the way the robots.txt standard (RFC 9309) says bots
read it" · "{TOOL_BOTS.length} bots (25 today) from OpenAI, Google, Anthropic, Perplexity, Microsoft, Apple, Meta, Amazon, DuckDuckGo,
Mistral and Common Crawl" · "Your home page, a product page and a collection page" · "The exact line that blocks
each bot, and how to remove it on Shopify".

**Explainers (H2, server-rendered, after "What this tool checks")**
- **What is GPTBot?** "GPTBot is OpenAI's crawler that collects pages to train its AI models. Blocking it in
  robots.txt tells OpenAI not to use your pages for training. It doesn't change whether ChatGPT search can show
  your pages: that's OAI-SearchBot. OpenAI publishes GPTBot's addresses at openai.com/gptbot.json, so a firewall
  can tell the real bot from fakes." <!-- source: https://developers.openai.com/api/docs/bots (facts §1.2) -->
- **What is OAI-SearchBot?** "OAI-SearchBot is OpenAI's search crawler. It decides whether your pages can appear
  in ChatGPT search answers. OpenAI says robots.txt changes take about 24 hours to apply, and asks sites to allow
  its published addresses (openai.com/searchbot.json) at their firewall or CDN. For a store that wants ChatGPT to
  recommend it, this is the OpenAI bot that matters most." <!-- source: OpenAI bots page; https://help.openai.com/en/articles/9237897-chatgpt-search -->
- **Every bot we check** (table rendered from `TOOL_BOTS`: bot, company, what it does, link to docs; caption
  "From each company's own crawler pages, checked {updated}").

**How this tool works (methodology)**
- "We fetch /robots.txt from your site's main address, following up to 4 redirects, and read up to 512 KB of it.
  Google reads the first 500 KB."
- "We read it the way the robots.txt standard (RFC 9309) describes: a group that names a bot replaces the general
  `*` group for that bot, and the longest matching rule wins. Allow wins a tie."
- "Apple says Applebot follows your Googlebot rules when your file doesn't name Applebot, so we do the same."
- "We test your home page, one product page and one collection page we find on your home page, plus the page you
  entered."
- "We don't visit your site pretending to be each bot, so firewall or CDN blocks don't show here."
- "If your site answers 401, 403 or 429, we say it turned us away, and never call that all clear. If there's no
  robots.txt (404), every bot is allowed."
- "The bot list comes from each company's own crawler pages, checked {updated}. We review it every 3 months."

**FAQs**
1. **Does blocking GPTBot hide my store from ChatGPT?**
   No. GPTBot only collects pages to train OpenAI's models. Whether your pages can appear in ChatGPT search is
   decided by a different bot, OAI-SearchBot. OpenAI says sites that block OAI-SearchBot won't be shown in
   ChatGPT search answers, though they can still appear as plain navigational links.
   <!-- source: https://developers.openai.com/api/docs/bots -->
2. **Should I block AI training bots?**
   It's your choice. Blocking training bots like GPTBot or ClaudeBot stops those companies using your pages to
   train future models, and their docs say it doesn't remove you from their live answers. Google-Extended is
   different: it also controls whether the Gemini app can use your pages to ground its answers. If you want AI
   assistants to know your products, leaving them open is the simpler choice.
   <!-- source: facts §1.2 (OpenAI bots, Anthropic article, Google common crawlers) -->
3. **What does Shopify's robots.txt block by default?**
   Shopify's standard robots.txt blocks no AI bot. It keeps all bots out of pages like the cart, checkout and
   customer accounts, and lets them read products, collections, pages and blogs. Blocks usually come from edits
   to the robots.txt.liquid file, an app, or a service in front of the store.
   <!-- source: observed https://theme-horizon-demo.myshopify.com/robots.txt on 11 Oct 2026 (facts §1.3) -->
4. **How do I edit robots.txt on Shopify?**
   In Shopify admin, go to Online Store, then Themes. Next to your live theme, click the three dots and choose
   Edit code. In the Templates folder, open robots.txt.liquid, delete the lines that block the bot, save, and run
   this check again. If there's no robots.txt.liquid, your store uses Shopify's standard file.
   <!-- source: app/lib/robots.ts ROBOTS_FIX; verify the theme editor wording against Shopify's robots.txt.liquid docs -->
5. **My robots.txt allows every bot. Can AI still be blocked?**
   Yes. A firewall or bot protection, such as Cloudflare's setting that blocks AI bots, can turn bots away before
   they read robots.txt, and that doesn't show here. Google also has a separate switch in Search Console, called
   Search generative AI, that can keep a site out of AI Overviews. OpenAI and Perplexity ask sites to allow their
   published IP addresses at the firewall.
   <!-- source: https://support.google.com/webmasters/answer/16908024 ; OpenAI help 9237897 ; Perplexity bots page -->
6. **Do AI bots follow robots.txt?**
   The crawlers that build search indexes say they do, including OAI-SearchBot, PerplexityBot, Claude-SearchBot,
   Googlebot and Applebot. Some fetchers that open a page because a person asked say robots.txt may not apply to
   them, such as ChatGPT-User and Perplexity-User. Anthropic says its Claude-User fetcher does follow robots.txt.
   <!-- source: facts §1.2 -->

**Secondary keywords:** gptbot checker, is gptbot blocked, gptbot, oai-searchbot, robots.txt ai checker, ai
crawler access checker, check if chatgpt can crawl my site, shopify robots.txt ai bots, robots.txt.liquid,
claudebot, perplexitybot, should I block gptbot. One page covers them all (no separate "GPTBot checker" page:
scaled content abuse, seo-2026 §1.3).

**Structured data:** standard tool graph.

**Server and client split**
- Pure `crawler.ts` (runs in the browser for paste mode): `TOOL_BOTS`, `FALLBACKS`, `checkBots(text, paths)`
  using `parseRobots` and `isAllowed` from `robots.ts` (import, never copy or edit), `explainBlock(text, token,
  path)`, `robotsKind(text)`, `verdict(report)`.
- `explainBlock` re-scans the text line by line with the same rules as `parseRobots` (trim, `#` comments,
  case-insensitive keys, user-agent runs, the run-together split) but keeps line numbers, and returns the group's
  first `User-agent` line number and text plus the winning rule's line number and text, using the same "longest
  match, Allow wins ties" logic. A test asserts it always agrees with `isAllowed`.
- `crawler.server.ts`: `checkSite(input)`: in parallel `robotsFetch(origin + "/robots.txt")` (import from
  `robots.server.ts`; 5 s, 512 KB) and `fetchSiteFile(origin + "/", { maxBytes: 1_000_000 })`, both through
  `toolFetchGate`. Map the robots answer exactly like `checkCrawlers` (codebase-brief §3.4): 2xx text parse;
  2xx but HTML = "no robots.txt file (your site shows a web page at that address), so every bot is allowed";
  401, 403, 429 = turned away (never "all clear"); other 4xx = no file, all allowed; 5xx or throw = couldn't read.
  For 5xx add: "While robots.txt shows a server error, search engines may treat the whole site as blocked." Verify
  this against Google's robots.txt docs before shipping; drop it if unverifiable.
- Cache per origin 60 seconds (`TtlCache`) to absorb double submits.

**Limits and costs:** 20 per IP per hour, 100 per day, 5,000 a day overall. No paid calls. Two outbound fetches
per check.

**Edge cases and errors**
- Not a web address: the shared copy (3.6). Can't reach: shared copy (3.10).
- Turned away: "Your site turned our check away (it answered {status}). AI bots may be turned away too: check
  your firewall or bot settings. We couldn't read your robots.txt."
- Empty file or only comments: every bot allowed; say "Your robots.txt has no rules, so every bot is allowed."
- Rules before any `User-agent`: ignored (RFC 9309), note "Line {n} isn't under a User-agent line, so bots ignore it."
- `Crawl-delay`: note "Google ignores Crawl-delay. Some other bots follow it." (no verdict change).
- File over 512 KB: "Your robots.txt is very large. Google reads only the first 500 KB."
- `Sitemap:` lines: list them; if none: tip "Add a Sitemap line so bots can find all your pages." (low)
- Paste mode over 100,000 characters: "That's a very long file. Paste up to 100,000 characters."

**Tests (`test/tools-crawler.test.ts`)**
- Sample file: GPTBot blocked everywhere (training, info), PerplexityBot blocked on the product page only (high),
  verdict "1 bot that affects AI answers is blocked". Use correct singular and plural.
- Applebot follows a `Googlebot` group when there's no Applebot group; follows `*` when neither exists; follows
  its own group when present.
- `explainBlock` agrees with `isAllowed` for every bot and path over 6 fixtures (Shopify new default as described
  in facts §1.3, an old default with `-remote` lines and an `Amazonbot` block, Cloudflare-style blocks of many AI
  bots, empty file, rules before any user-agent, `Allow` overriding a longer `Disallow`).
- `robotsKind` on each fixture.
- Every `TOOL_BOTS` entry has a unique token, a group, a level, a `what` line and an https docs URL.
- Action (mock `robots.server` and `fetch.server`): 403 robots gives "turned away" and never "all clear"; 404
  gives all allowed; HTML at /robots.txt gives "no file"; private address gives the unreachable copy; limits;
  cross-site POST; honeypot.
- Meta test, no em dash in the copy module. No-JS `curl` shows the H1, intro, the sample table and "What is GPTBot?".

---

### T3. Product Schema Checker

- **URL:** `/tools/product-schema-checker`
- **Title:** `Product Schema Checker: What Google and AI Can Read | GEO`
- **Meta description:** `Free product schema checker for Shopify. Paste a product link to see which facts Google and AI shopping tools can read and what's missing. No sign-up.`
- **H1:** `Product Schema Checker`
- **Intro:** "The Product Schema Checker is a free tool that reads the product structured data (JSON-LD) on a
  product page and shows which facts Google and AI shopping tools can read, what's missing, and where to fix it
  in Shopify."

**Inputs**
- Form 1 (`intent=fetch`): `url`, label "Product page link", placeholder `yourstore.com/products/...`; submit
  "Check product". Normalised with `normalizeCheckUrl` from `check-read.ts` (it also refuses marketplace links:
  "This tool checks your own store's product pages.").
- Form 2 (`intent=paste`): `text`, label "Or paste the product's JSON-LD or the page's HTML", max 300,000
  characters; live in the browser with JS. Text starting with `{` or `[` is read as JSON-LD, anything else as HTML.

**On load:** paste mode pre-filled with this sample and its result, labelled "Example: the kind of product data a
standard Shopify theme adds (made-up product). Paste your own, or check a link above." The shape follows what
Shopify's Horizon theme output on 11 Oct 2026 (facts §2.4); values are made up:
```json
{
  "@context": "https://schema.org",
  "@type": "ProductGroup",
  "@id": "https://example-store.com/products/cedar-beard-oil#product",
  "name": "Cedar Beard Oil",
  "description": "Beard oil with jojoba and argan oil for dry skin under short to medium beards.",
  "url": "https://example-store.com/products/cedar-beard-oil",
  "brand": { "@type": "Brand", "name": "Example Grooming Co" },
  "category": "Beard Oil",
  "productGroupID": "1000000001",
  "hasVariant": [
    { "@type": "Product", "@id": "https://example-store.com/products/cedar-beard-oil?variant=1#variant",
      "name": "Cedar Beard Oil - 30 ml", "sku": "CBO-30", "gtin": "0000000000017",
      "image": "https://example-store.com/cdn/cedar-30.jpg",
      "offers": { "@type": "Offer", "price": "24.00", "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url": "https://example-store.com/products/cedar-beard-oil?variant=1" } },
    { "@type": "Product", "@id": "https://example-store.com/products/cedar-beard-oil?variant=2#variant",
      "name": "Cedar Beard Oil - 50 ml", "sku": "CBO-50",
      "image": "https://example-store.com/cdn/cedar-50.jpg",
      "offers": { "@type": "Offer", "price": "34.00", "priceCurrency": "USD", "availability": "https://schema.org/InStock", "url": "https://example-store.com/products/cedar-beard-oil?variant=2" } }
  ]
}
```
(Sample result: required facts all found; barcode on 1 of 2 variants; no `variesBy`, shipping, returns, condition.)
The variant names use a plain hyphen as Shopify outputs "Title - Option"; that's data, not our copy.

**What we check** (from Google's merchant listing and product variant guides, updated 8 Sep 2026, facts §2.2):
- **Needed by Google** (merchant listing required): product `name`; `image`; `offers`; offer `price` (or
  `priceSpecification.price`); `priceCurrency`. For a ProductGroup: group `name`, and every variant has its own
  name, image, price and currency (show "{x} of {y} variants" when partial).
- **Recommended by Google:** `brand.name`; `description`; offer `availability`; a GTIN (`gtin`, `gtin8`, `gtin12`,
  `gtin13`, `gtin14` or `isbn`); `sku`; `mpn`; offer `itemCondition`; offer `url`; `shippingDetails`;
  `hasMerchantReturnPolicy`; for groups `productGroupID` and `variesBy`; `aggregateRating`/`review` (see rule below).
- **Extra facts AI shopping tools can use** (our advice, labelled as such): `category`; `color`, `size`,
  `material` on products or variants; `audience`; `hasCertification` (only if real). Label line: "Our advice:
  OpenAI says ChatGPT shopping reads structured product data such as price and description. These extra facts
  make your product easier to match to a shopper's question." <!-- source: https://help.openai.com/en/articles/11128490-shopping-in-chatgpt -->

Status words: Found (with the value, for example "24.00 USD"), Missing, Some variants only, Not on this page
(shipping and returns: they can be set store-wide or in Merchant Center, facts §2.3), Not needed (for example
`priceValidUntil` without a sale).

Ratings rule: never mark missing reviews as a problem. Show "Reviews: none in the product data. Only add
ratings markup if real customer reviews show on the page." <!-- source: Google changelog 24 Jul 2026 -->

**Problems we flag** (each with a plain fix)
- More than one Product or ProductGroup block, with any disagreement on name, price, currency or availability:
  "Your page has {n} product data blocks that disagree on the price ({a} vs {b}). Usually one comes from your
  theme and one from an app. Keep one." Show both blocks side by side.
- A JSON-LD block that isn't valid JSON: "One product data block has a typo, so Google can't read it."
- Price in the data differs from Shopify's own product record (`/products/<handle>.js`, prices in cents, lowest
  variant) by more than 0.01: "Your product data says {a}, but your store's product record says {b}."
- Availability says InStock but the Shopify record says no variant is available (or the reverse).
- `price` with a currency symbol or comma ("$24.00", "24,00") or `priceCurrency` not 3 letters.
- No JSON-LD product but microdata found (`hasMicrodataProduct`): "This page describes the product with
  microdata. This tool reads JSON-LD only, which is what Shopify themes use."
- No product data at all.
- **Not flagged on purpose:** brand equal to the store name (many stores sell their own brand, and Shopify uses
  the Vendor field).

**Result layout**
1. Verdict: "Ready for Google's product results: all required facts found" / "Missing {n} facts Google needs" /
   "No product data found on this page".
2. One line: "Found a ProductGroup with 2 variants in the page's HTML." (or Product, or nothing).
3. Problems (if any), worst first.
4. The three field groups as rows: plain field name, status, value, why it matters (one line), "Where to fix
   it in Shopify".
5. "Fix it in Shopify" box: admin fixes first (table below); code only if no product data exists at all.
6. "Show the product data we found" (`<details>`, closed; it's raw code, not an answer) with pretty JSON in a `CopyBox`.
7. Button.

Where to fix it in Shopify (copy for each field):

| Field | Where (exact copy) |
|---|---|
| Brand | "Products > the product > Vendor. Most themes use Vendor as the brand." |
| Barcode (GTIN) | "Products > the product > the variant > Barcode (ISBN, UPC, GTIN, etc.). Fill it in for every variant that has one." |
| SKU | "Products > the product > the variant > SKU." |
| Description | "Products > the product > Description. Start with who it's for and its key facts." |
| Image | "Products > the product > Media. Add at least one image." |
| Stock status | "Comes from your inventory settings. If it's wrong, check the variant's inventory and 'Continue selling when out of stock'." |
| Shipping and returns | "Add them once for the whole store: in Google Merchant Center or Search Console's shipping and returns settings, or with store-wide markup on your home page. Google reads those too." |
| Colour, size, material | "Use clear variant option names (Colour, Size) and fill in the product's category and metafields in Shopify admin." |
| No product data at all | Code fix below. |

Code fix when there is no product data (exact, from Shopify's docs): "Ask your developer, or in Online Store >
Themes > Edit code, open your product section (often `sections/main-product.liquid`) and add this line:"
```liquid
<script type="application/ld+json">{{ product | structured_data }}</script>
```
"This uses Shopify's own `structured_data` filter, so the facts always match your product. Add it only if your
theme has no product data already, or you'll have two blocks."
<!-- source: https://shopify.dev/docs/api/liquid/filters/structured_data ; Dawn main-product.liquid (facts §2.4) -->

**Button:** "See how GEO fixes your product pages for AI" → `/?ref=tool-product-schema-checker#how`

**What this tool checks:** "Google's required product facts: name, image, price and currency" · "Recommended facts
like brand, barcode, SKU, stock status, shipping and returns" · "Variants grouped as a ProductGroup" · "Problems
like two product blocks that disagree, or a price that doesn't match your store".

**How this tool works**
- "We download the product page the way a crawler first sees it, before any JavaScript runs, and read every
  JSON-LD block (up to 20). Google recommends putting product data in the page's HTML, because data added later
  by JavaScript can make shopping crawls less reliable."
- "On Shopify stores we also read the product's public data file (/products/{handle}.js) to compare price and stock."
- "We check the facts against Google's merchant listing and product variant guides (required and recommended).
  The extra facts group is our own advice."
- "We read JSON-LD only, not microdata or RDFa."
- "Shipping and returns can be set for the whole store or in Google Merchant Center, so when they're not on the
  page we say 'not on this page', not 'missing'."
- "We don't run Google's Rich Results Test, and passing here doesn't guarantee a rich result."

**FAQs**
1. **What is product schema?**
   Product schema is a small block of code on a product page that states the product's facts, like its name,
   price, currency, stock status and brand, in a format machines can read without guessing. Most stores add it as
   JSON-LD. Google uses it for product results in Search, and AI shopping tools can read the same facts.
   <!-- source: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing ; OpenAI shopping help -->
2. **Does Shopify add product schema automatically?**
   Shopify's own themes, like Dawn and Horizon, do. They use Shopify's structured_data filter, which outputs a
   Product for products without variants and a ProductGroup for products with variants, with the brand,
   description, price, currency, stock status and, when you've filled in the barcode field, the GTIN. Other themes
   vary, so check yours. Shipping, returns and ratings usually need extra setup.
   <!-- source: https://shopify.dev/docs/api/liquid/filters/structured_data ; Horizon demo observed 11 Oct 2026 (facts §2.4) -->
3. **Which product schema fields does Google require?**
   For product results on pages where shoppers can buy, Google requires the product name, an image, and an offer
   with a price and currency. It recommends many more, including brand, GTIN, SKU, stock status, shipping details
   and a return policy.
   <!-- source: merchant listing doc, updated 8 Sep 2026 -->
4. **Does product schema help me get recommended by ChatGPT?**
   It helps AI tools read your facts correctly, but it won't get you recommended on its own. Google says its AI
   features need no special schema, and OpenAI says ChatGPT already gets Shopify product data through Shopify
   Catalog with no extra work from merchants. Clear facts on the page and mentions on sites AI trusts matter more.
   <!-- source: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide ; https://help.openai.com/en/articles/11128490-shopping-in-chatgpt -->
5. **Should I add review stars to my product schema?**
   Only if real customer reviews show on the page. Google's review guidelines don't allow fake or undisclosed
   incentivised reviews. If a reviews app adds ratings, check it puts them in the page's HTML: Google says data
   added later by JavaScript can make shopping crawls less reliable.
   <!-- source: https://developers.google.com/search/updates (24 Jul 2026); merchant listing doc -->
6. **Why does my page have two product blocks?**
   Usually your theme adds one and an app, often a reviews or SEO app, adds another. If they disagree, for example
   on price or stock, machines can't tell which is right. Keep one complete block: turn off the app's product data
   if your theme already has it, or the other way round.
   <!-- our advice (competitors §5) -->

**Secondary keywords:** shopify schema markup, product schema generator, shopify product schema, product structured
data test, json-ld product checker, shopify structured data checker, gtin schema shopify, merchant listing
structured data, rich results test alternative.

**Structured data:** standard tool graph.

**Server and client split**
- Pure `schema.ts` (also runs in the browser): `extractNodes(input)` (JSON-LD blocks via `jsonLdBlocks` from
  `html.ts`; `JSON.parse` each in try/catch; walk arrays, `@graph`, `mainEntity`, `hasVariant`, `isVariantOf`;
  depth 6, at most 500 nodes; `@type` may be a string, an array or a full URL like `http://schema.org/Product`);
  `evaluate(nodes, shopifyRecord?)` returning `{ kind, blocks, invalidBlocks, fields, problems, variants }`;
  `parseShopifyRecord(json)` reading `price` (cents), `available`, `variants[].available`, `variants[].sku`,
  `variants[].barcode` defensively (whether `barcode` is in the `.js` file is UNVERIFIED: if absent, skip barcode
  comparisons).
- `schema.server.ts`: fetch the page (`fetchSiteFile`, 2 MB, 10 s) and, when `shopifyHandle(url)` finds a handle,
  `/products/<handle>.js` (512 KB, 5 s), in parallel inside `toolFetchGate`.
- Cache per URL 60 s.

**Limits and costs:** 20 per IP per hour, 100 per day, 5,000 a day overall. No paid calls.

**Edge cases and errors**
- A collection or home page: "This doesn't look like a product page. Google's product results only support pages
  about one product (or its variants)." (still show what was found)
- Page is HTML but the store blocks us: shared turned-away copy.
- Prices in several currencies: compare only when currencies match.
- More than 100 variants: evaluate the first 100 and say so.
- Paste mode over 300,000 characters: "That's a lot of text. Paste just the JSON-LD block, or up to 300,000 characters."
- JSON-LD is an array of several types (Organization, BreadcrumbList, Product): ignore the others, count them.

**Tests (`test/tools-schema.test.ts`)**
- Sample: required all found; GTIN "Some variants only (1 of 2)"; shipping and returns "Not on this page";
  verdict "Ready for Google's product results".
- Fixtures: Product without variants; ProductGroup with `@graph`; `@type` as an array and as a full URL; two
  blocks disagreeing on price (problem raised); invalid JSON block (problem raised, others still read); price
  "$24.00" (problem); microdata only (note); no data (verdict); theme block + reviews app block agreeing (no
  problem).
- `parseShopifyRecord`: cents to decimals; availability; missing fields don't crash.
- Bounded parsing: a 2 MB page of junk finishes under 200 ms.
- Action (mock `fetch.server`): marketplace link refused; page 404 "We couldn't find that page."; limits; honeypot.
- Meta test, no em dash in the copy module, no-JS `curl` shows the H1, intro and the sample field card.

### T4. FAQ Schema Generator

- **URL:** `/tools/faq-schema-generator`
- **Title:** `FAQ Schema Generator: Free JSON-LD for Shopify | GEO`
- **Meta description:** `Free FAQ schema generator. Type questions and answers, then copy FAQPage JSON-LD or a ready Shopify section. Runs in your browser. No sign-up.`
- **H1:** `FAQ Schema Generator`
- **Intro:** "The FAQ Schema Generator is a free tool that turns your questions and answers into FAQPage structured
  data (JSON-LD), plus a ready-to-paste Shopify section that shows the same FAQ on your page. It runs in your
  browser."
- **Honest note** (right under the intro, inside the band, always visible): "Good to know: Google stopped showing
  FAQ rich results on 7 May 2026. FAQ markup is still valid, and clear questions and answers on your page still
  help shoppers and AI tools. Only mark up questions that are visible on the page, word for word."
  <!-- source: https://developers.google.com/search/updates (8 May 2026 and 15 Jun 2026 entries; facts §3.1) -->

**Inputs** (one form; with JS everything updates live, without JS "Make my code" posts the rows)
- Up to 20 rows. Each row: `question` (input, label "Question {n}", max 300 characters) and `answer` (textarea,
  label "Answer {n}", max 2,000 characters). Buttons per row: "Remove" and "Move up". Under the rows: "Add a
  question". Posted as repeated `question` and `answer` fields (`form.getAll`), paired by index.
- Starter questions (buttons that add a row with the question filled and the answer empty, never an invented
  answer): "How long does shipping take?", "What's your returns policy?", "What size should I get?", "What is it
  made of?", "How do I use it?". Without JS these are hidden (they need JS); the four blank rows below cover it.
- Without JS, the server renders the example rows plus 4 empty rows.

**On load:** pre-filled with this example and its output, labelled "Example questions for a made-up beard oil.
Replace them with your own."
1. Q "How long does a 30 ml bottle last?" A "About two months if you use three or four drops a day."
2. Q "Is it fragrance-free?" A "Yes. It's made with jojoba and argan oil and has no added fragrance."
3. Q "Do you ship outside the US?" A "Yes, we ship to most countries. You'll see the delivery time and cost at checkout."

**Output** (three blocks, all rendered in the HTML; with JS a small switcher shows one at a time, but the code is
always in the page):
1. **JSON-LD for any website**: the full `<script type="application/ld+json">` tag in a `CopyBox`.
2. **Shopify section (shows the FAQ and adds the markup)**: a complete `sections/geo-faq.liquid` file. Its
   `{% schema %}` has a `preset` whose blocks are pre-filled with the visitor's questions and answers, so after
   pasting the file the owner adds the "FAQ" section in the theme editor and the questions are already there.
   Visible FAQ and markup render from the same block settings, so they can't drift apart. Steps (exact):
   "In Shopify admin, go to Online Store, then Themes. Next to your live theme, click the three dots and choose
   Edit code. In the Sections folder, add a new section called geo-faq and replace its contents with this code.
   Save. Then click Customize, open the page or product template you want, choose Add section, and pick FAQ."
3. **A different FAQ on each product (product metafield)**: steps to create a product metafield definition
   (Settings > Custom data > Products > Add definition; Name "FAQ", namespace and key `custom.faq`, type JSON),
   the JSON value to paste into one product's metafield (`[{"q":"...","a":"..."}]`), and a section file
   `sections/geo-product-faq.liquid` that reads `product.metafields.custom.faq.value` and renders the visible FAQ
   and the markup from it (same structure as the app's own `extensions/geo-faq/blocks/product-faq.liquid`, but
   with answers visible rather than inside `<details>`).

Section code to generate (T4 finalises; rules that must hold):
- Visible text: `{{ block.settings.question | escape }}` in an `<h3>`, answer `{{ block.settings.answer | escape | newline_to_br }}` in a `<p>`. Never `<details>` (answers stay visible).
- Markup: `"name": {{ block.settings.question | json }}`, `"text": {{ block.settings.answer | json }}` (Liquid's `json` filter escapes safely), commas with `{% unless forloop.last %},{% endunless %}`.
- Settings: `question` type `text`, `answer` type `textarea`. Preset name "FAQ", heading setting default "Questions and answers".
- The `{% schema %}` JSON is produced with `JSON.stringify` so quotes and line breaks in the visitor's text can't break it.
- Max 20 blocks.

**Checks shown inline** (pure, in `faq-schema.ts`; tone in brackets):
- Empty question or answer: row skipped, note "Question {n} has no answer, so we left it out." (warn)
- Duplicate question (case and spaces ignored): "Questions {a} and {b} are the same." (warn)
- Question over 300 or answer over 2,000 characters: blocked at input with a counter.
- Answer contains HTML tags: "We'll show tags as plain text. Write plain sentences." (info)
- Advert words in an answer ("% off", "discount code", "buy now", "limited time", "sale ends"): "Google's old FAQ
  rules said not to use FAQ markup for advertising." (warn) <!-- source: Google FAQ doc archived 1 Mar 2026 (facts §3.3) -->
- Fewer than 2 complete questions: "Most product FAQs answer 4 to 6 questions." (tip; our advice, matches the
  AI-ready check's fix line in `ai-ready.ts`)
- Question doesn't end with "?": "Write questions the way shoppers ask them." (tip)

**Escaping (must be tested):** JSON-LD built with `JSON.stringify`, then every `<` replaced by `<` (and
`>` by `>`, `&` by `&`) so a pasted `</script>` can't close the tag. Line breaks kept as `\n` in
answers. Unicode left as is.

**Result layout**
1. Verdict: "{n} questions ready" (good) or "Add at least one question and answer" (neutral), plus the warnings.
2. The three output blocks with copy buttons and steps.
3. A small preview: "How the FAQ looks on your page" (the questions and answers as plain HTML).
4. Button.

**Button:** "See how GEO writes FAQs that AI can quote" → `/?ref=tool-faq-schema-generator#how`
(True: the app writes product FAQs the store approves and adds them with its theme block, CLAUDE.md §11.)

**What this tool checks:** "Builds FAQPage JSON-LD that follows schema.org" · "Gives you a Shopify section that
shows the FAQ and adds the markup from the same text" · "Flags empty, repeated or advert-style answers" ·
"Escapes your text so it can't break your page".

**How this tool works**
- "Everything runs in your browser. Your questions aren't sent to us, unless JavaScript is off in your browser:
  then the form is sent to our server once to build the code, and nothing is kept."
- "The output follows schema.org's FAQPage type and the properties Google last documented: a FAQPage with a
  mainEntity list, each Question with a name and an acceptedAnswer, and each Answer with text."
- "We escape quotes, line breaks and the characters that could break a script tag."
- "The Shopify section shows the FAQ and adds the markup from the same text, so they always match."
- "Google no longer shows FAQ rich results (since 7 May 2026), so we don't promise any change in how your page
  looks in Google."

**FAQs**
1. **Does FAQ schema still work in 2026?**
   The markup is still valid, but Google no longer shows FAQ rich results. Google limited them to well-known
   government and health sites in 2023, stopped showing them on 7 May 2026, and removed the documentation in June
   2026. Clear questions and answers on the page still help shoppers, and AI tools can read them.
   <!-- source: https://developers.google.com/search/updates (facts §3.1) -->
2. **Is FAQ schema bad for SEO now?**
   We found no statement from Google that FAQ markup harms a page. Google's general rule still applies:
   structured data must match what's visible on the page. Markup for questions people can't see, or the same FAQ
   copied onto every page, is what to avoid.
   <!-- source: facts §3.2 (Google AI features doc, structured data guidelines) -->
3. **Do AI assistants read FAQs?**
   Microsoft's Bing team says question-and-answer pairs can often be lifted word for word into AI answers, and
   warns that answers hidden in tabs or expandable menus may not be read. So keep answers short, factual and
   visible. Google says its AI features need no special markup.
   <!-- source: https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers ; Google AI optimization guide -->
4. **How do I add FAQ schema to Shopify?**
   The simplest way is the Shopify section above: add it as a new section file in Online Store, Themes, Edit
   code, then add the FAQ section to a product or page template in the theme editor. It shows the questions and
   adds the markup from the same text. For a different FAQ on each product, use the product metafield version.
5. **Should I put FAQ schema in theme.liquid?**
   No. theme.liquid loads on every page, so the same FAQ markup would appear on pages that don't show those
   questions. Google's old FAQ rules said to mark up a repeated FAQ only once on your site, and each page's markup
   should match what that page shows.
   <!-- source: Google FAQ doc archived 1 Mar 2026 (facts §3.3) -->
6. **What should my product FAQs answer?**
   The questions shoppers ask before buying: size and fit, what it's made of, how to use it, who it suits,
   shipping times and returns. Answer with facts, not praise. If you don't know an answer, find out rather than guess.
   <!-- our advice -->

**Secondary keywords:** faq schema generator shopify, faq schema shopify, shopify faq schema metafield, faqpage
json-ld generator, faq structured data generator, faq schema markup generator, does faq schema still work, faq
rich results 2026, faq schema for product pages.

**Structured data:** standard tool graph. (Our own page's FAQPage block comes from `FAQS`, like every tool.)

**Server and client split**
- Pure `faq-schema.ts`: `cleanRows(rows)`, `checkRows(rows)`, `toJsonLd(rows)`, `toScriptTag(rows)`,
  `toShopifySection(rows)`, `toMetafieldJson(rows)`, `productFaqSection()`. Runs in the browser (live) and on the
  server (SSR of the example, no-JS posts).
- Action: no fetch, no cost. Paste-mode limits (60 per hour per IP).
- Phase 2 (not v1): "Import from a page": POST a URL, fetch it (`fetchSiteFile`), read only existing FAQPage
  JSON-LD and `<details><summary>` pairs, fill the rows. Limits 20 per hour.

**Edge cases and errors**
- All rows empty: show the empty verdict, no code.
- 21st row: "Add up to 20 questions."
- Form over the 1 MB cap (no JS): "That's too much to send at once. Try fewer or shorter answers."
- Emoji, accents, quotes, `</script>`, `{{ }}` and `{% %}` in text: stay text in all outputs (Liquid tags in a
  setting default are not executed, but test the generated file renders them as text in the preview).

**Tests (`test/tools-faq.test.ts`)**
- `toJsonLd` output: `@type` FAQPage, one Question per complete row, `name` and `acceptedAnswer.text` exact.
- Escaping: an answer containing `</script><script>alert(1)</script>` produces no literal `</script` in the tag
  output; `JSON.parse` of the content (after reversing `<`) gives the original text.
- The Shopify section's schema JSON parses with `JSON.parse` for tricky text (quotes, newlines, emoji).
- Checks: duplicates, empty answers, advert words, under 2 questions.
- No-JS action with 3 posted rows renders all three outputs; oversized body gives 413; honeypot.
- Meta test, no em dash in the copy module, no-JS `curl` shows the H1, the honest note and the example's code.

---

### T5. llms.txt Checker

- **URL:** `/tools/llms-txt-checker`
- **Title:** `llms.txt Checker: Validate and Generate Your File | GEO`
- **Meta description:** `Free llms.txt checker and generator. See if your site has an llms.txt, check it against the llmstxt.org format and copy a starter file. No sign-up.`
- **H1:** `llms.txt Checker`
- **Intro:** "The llms.txt Checker is a free tool that fetches your site's /llms.txt, checks it line by line against
  the llmstxt.org format, and builds a starter file you can copy. It also tells you when a store is using
  Shopify's automatic file."
- **Evidence box** (right under the result, before the button, titled "Before you spend time on it"): "Google says
  llms.txt has no effect on Google Search, good or bad. In Ahrefs' study of 137,210 sites (May 2026 traffic), 97%
  of llms.txt files got no requests at all. No major AI assistant has said it reads llms.txt for its answers. It's
  cheap to have, but fix crawler access and product data first." Links: "AI Crawler Checker" and "Product Schema
  Checker" (plain links).
  <!-- source: https://developers.google.com/search/updates (15 Jun 2026); https://ahrefs.com/blog/llmstxt-study/ ; facts §4.2 (no statement from OpenAI, Anthropic, Perplexity found) -->

**Inputs**
- Form 1 (`intent=fetch`): `url`, label "Your website", placeholder `yourstore.com`; submit "Check llms.txt".
- Form 2 (`intent=paste`): `text`, label "Or paste an llms.txt to check it", max 200,000 characters; live with JS.

**On load:** paste mode pre-filled with **this site's own llms.txt** (`siteLlmsTxt()` from `site-files.ts`, so it
is always the real file), labelled "Example: the llms.txt on this site, usegeo.app". Its result shows all
checks passing, which also proves our own file passes our checker.

**Checks** (llmstxt.org v2, August 2026, facts §4.1; "our tip" = our advice, not the format)

| id | When | Tone | Copy |
|---|---|---|---|
| missing | 404 or other "missing" | info | "No llms.txt found. That's fine: it's optional." |
| html | the response is a web page | problem | "We got a web page, not a text file. Your site may be showing a page at /llms.txt instead of a file." |
| h1 | first line that isn't blank or a byte-order mark is not `# Title` | problem | "The file must start with a title line, like `# Your Store`. It's the only required part." |
| h1-many | more than one `# ` line | problem | "There's more than one # title line (lines {a} and {b}). Keep one." |
| summary | no `> ` line right after the title (blank lines allowed) | tip | "Add a one-line summary starting with `>` under the title." |
| heading-early | any heading other than the H1 before the first `## ` | problem | "Line {n} is a heading before the first ## section. Only plain text can go there." |
| list-link | a list item inside an `## ` section without a `[name](url)` link | problem | "Line {n} is a list item without a link. Use `- [Page name](https://...): short note`." |
| link-relative | a link that isn't a full `https://` address | tip (our tip) | "Line {n} uses a short link. Full addresses (https://...) work everywhere." |
| section-empty | an `## ` section with no list items | tip | "The ## {name} section has no links." |
| md-links | no links end in `.md` | info | "Your links point to web pages. The format also lets you link to plain-text (.md) versions." |
| optional | an `## Optional` section | info | "Since version 2 of the format, an Optional section is just a normal section." |
| shopify-default | Shopify's automatic file (rule below) | info | (Shopify box) |
| full | /llms-full.txt status | info | "Found /llms-full.txt. It isn't part of the llmstxt.org format, so we don't check it." / "No /llms-full.txt. That's fine: it isn't part of the format." |
| agents | /agents.md status | info | "Found /agents.md." / "No /agents.md." |
| size | file over 200 KB | tip | "Your file is very long. The format is meant to be a short summary with links." |

Each check shows a line number and a short excerpt of that line (escaped, at most 120 characters).

**Shopify's automatic file** (facts §4.3): the first line starts `# Agent Instructions` and the file mentions
`shop.app/SKILL.md` or `/.well-known/ucp`. Box copy: "This is Shopify's automatic file. It's fine to leave. It
tells AI shopping agents how to browse and buy from your store, but it doesn't list your products, collections or
guides. Shopify recommends keeping it for most stores. To replace it, see the starter file below." The automatic
file passes the only hard rule (the title) and has no `>` summary; that is expected, so don't call it broken.

**Generator** ("A starter llms.txt for {host}"), built from the home page (fetched in URL mode):
- Title: `og:site_name`, else `<title>` cut at the first " | " or " - ", else the host.
- Summary: the meta description (one line), else nothing.
- `## Main pages`: up to 15 same-host links from the home page (`sameHostLinks`): collections, pages, blog, about
  and contact first; skip cart, account, search, login, checkout, policies, `#` and duplicates. Link text = the
  anchor text, else the path.
- `## Policies`: `/policies/shipping-policy`, `/policies/refund-policy`, `/policies/privacy-policy` when linked
  from the home page (Shopify stores).
- Shown in an editable textarea that re-runs the checks live, plus a `CopyBox`.
- **Shopify version** (`templates/llms.txt.liquid`): the same file with the title as `# {{ agents.store_name }}`,
  a line `Store: {{ agents.store_url }}` and `Sitemap: {{ agents.sitemap_url }}`, and the links typed in. Note
  (exact): "Shopify only lets this template use a few store values, like the store name, address and sitemap, so
  the links are typed in. Run this generator again when you add important pages." Steps (exact): "In Shopify
  admin, go to Online Store, then Themes. Next to your live theme, click the three dots and choose Edit code. In
  the Templates folder, add a new template file named llms.txt.liquid, paste this and save. It changes only
  /llms.txt. /agents.md and /llms-full.txt keep Shopify's automatic file."
  <!-- source: https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid (read 11 Oct 2026); lookup order https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid -->
- In paste mode there is no home page, so the generator section shows: "Check a site above to build a starter file."

**Result layout**
1. Verdict: "Your llms.txt follows the format" (good) / "Your llms.txt has {n} problems" (warn) / "No llms.txt
   found. That's fine: it's optional." (neutral) / "This is Shopify's automatic llms.txt" (neutral).
2. Files row: /llms.txt, /llms-full.txt, /agents.md with Found / Not found / Web page instead.
3. The checks, problems first, then tips, then info.
4. Shopify box when detected.
5. Generator.
6. Evidence box.
7. Button.

**Button:** "See what actually gets AI to recommend you" → `/?ref=tool-llms-txt-checker#how`

**What this tool checks:** "Whether /llms.txt exists and is a text file, not a web page" · "Every line against the
llmstxt.org format (version 2)" · "Whether it's Shopify's automatic file" · "/llms-full.txt and /agents.md" ·
"Builds a starter llms.txt from your home page".

**How this tool works**
- "We fetch /llms.txt, /llms-full.txt and /agents.md from your site's main address, following up to 4 redirects,
  up to 512 KB each, and read your home page for the starter file."
- "We check /llms.txt against version 2 of the llmstxt.org proposal (August 2026): a title line first, then an
  optional > summary, optional notes, then ## sections that list links as - [name](url): notes. Checks marked
  'our tip' are our own advice."
- "/llms-full.txt isn't part of the llmstxt.org format, so we only say whether it's there."
- "We spot Shopify's automatic file by its first line (# Agent Instructions) and its links for shopping agents."
- "The starter file uses only what's on your home page. Check it before you publish."

**FAQs**
1. **What is llms.txt?**
   llms.txt is a plain text file at yourdomain.com/llms.txt that gives AI tools a short summary of a site and a
   list of its most useful links, written in Markdown. It's a proposal from llmstxt.org, not an official web
   standard, and the proposal itself says it's used most for software documentation that coding agents read.
   <!-- source: https://llmstxt.org/ (v2, Aug 2026) -->
2. **Do ChatGPT and Google read llms.txt?**
   Google says Google Search doesn't use it, and that it won't help or hurt your rankings. We found no statement
   from OpenAI, Anthropic or Perplexity that their assistants read it for answers. In Ahrefs' server-log study of
   May 2026 traffic, 97% of llms.txt files got no requests at all.
   <!-- source: https://developers.google.com/search/updates (15 Jun 2026); https://ahrefs.com/blog/llmstxt-study/ -->
3. **Does my Shopify store have an llms.txt?**
   Most likely. Since 28 May 2026, Shopify serves /llms.txt, /llms-full.txt and /agents.md for every store. By
   default all three show the same automatic file, which tells AI shopping agents how to browse and buy from the
   store but doesn't list your products or guides. Stores with a custom (headless) storefront may not have it.
   <!-- source: https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd ; headless note is an inference from one observed store (facts §4.3) -->
4. **How do I change llms.txt on Shopify?**
   In Shopify admin, go to Online Store, then Themes, then Edit code on your live theme. In the Templates folder,
   add a new template file named llms.txt.liquid and paste your file. It only changes /llms.txt. Shopify
   recommends keeping its automatic file for most stores, and only a few store values, like the store name and
   sitemap address, work inside this template.
   <!-- source: https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid -->
5. **What's the difference between llms.txt and llms-full.txt?**
   llms.txt is the short file from the llmstxt.org proposal: a title, a summary and lists of links. llms-full.txt
   isn't part of that proposal; it's a common habit of putting a site's full text in one file. On Shopify, both
   show the automatic file unless you add your own template.
   <!-- source: llmstxt.org (llms-full.txt not in spec); Shopify changelog 28 May 2026 -->
6. **Is llms.txt the same as robots.txt?**
   No. robots.txt tells bots which pages they may crawl, and the big AI crawlers say they follow it. llms.txt only
   suggests what to read and doesn't allow or block anything. If you want AI assistants to find your products,
   robots.txt matters far more.
   <!-- source: facts §1.2, §4.1 -->

**Secondary keywords:** llms.txt validator, llms.txt generator, shopify llms.txt, llms.txt generator shopify,
llms.txt example, llms.txt format, agents.md shopify, llms-full.txt, llms.txt.liquid, check llms.txt, does chatgpt
read llms.txt. One page covers checker, validator and generator (no near-duplicate pages).

**Structured data:** standard tool graph.

**Server and client split**
- Pure `llms.ts` (browser too): `checkLlms(text): Check[]`, `isShopifyDefault(text)`, `buildStarter(home: { title,
  description, links })`, `toShopifyTemplate(starter)`. Line scanning is linear; ignore lines over 4,000 characters
  after the first 4,000.
- `llms.server.ts`: in parallel `fetchSiteFile(origin + "/llms.txt")`, `/llms-full.txt`, `/agents.md` (512 KB,
  6 s each) and the home page (1 MB), inside `toolFetchGate`. A "found" file that `looksLikeHtml` is reported as
  "web page instead".
- Cache per origin 60 s.

**Limits and costs:** 20 per IP per hour, 100 per day, 5,000 a day overall. No paid calls. Four fetches per check.

**Edge cases and errors**
- /llms.txt redirects to /agents.md (Shopify did this for a while in May 2026, facts §4.3): follow it, check the
  content, and note "Your /llms.txt redirects to {path}."
- Turned away / unreachable: shared copy.
- A file with a byte-order mark: allowed (v2).
- Windows line endings: handled.
- Empty file: problem "The file is empty."

**Tests (`test/tools-llms.test.ts`)**
- `siteLlmsTxt()` passes with zero problems and zero tips (cross-check owned by I in `tools-cross.test.ts`, but T5
  adds its own copy of the fixture).
- Fixtures: Shopify's automatic file (`llms-shopify-default.txt`, built from the structure in facts §4.3, H1
  `# Agent Instructions` + the store name, no `>` line, the H2 sections listed there) is detected and has no
  problems; a file with `###` before the first `##`; a list item without a link; two H1s; relative links;
  `## Optional`; BOM + CRLF; an HTML 404 page.
- `buildStarter`: picks collections and pages, skips cart and account, caps at 15, de-duplicates; the Shopify
  template uses only `agents.*` objects (assert no `shop.`, `collections` or `linklists` in the output).
- Action (mock `fetch.server`): 404 gives the "optional" verdict, HTML gives "web page instead", limits, honeypot.
- Meta test, no em dash in the copy module, no-JS `curl` shows the H1, intro, evidence box and the example checks.

### T6. AI Bot Checker (for product descriptions)

Searchers typing "ai bot checker" mostly want AI-text detectors (competitors §8). We meet the intent honestly:
the first screen says what this does and doesn't do (Google's "misleading functionality" spam policy, seo-2026 §1.3).

- **URL:** `/tools/ai-bot-checker`
- **Title:** `AI Bot Checker for Product Descriptions | GEO`
- **Meta description:** `Does your product copy sound like a bot wrote it? Free checker for vague phrases, hype words and missing facts shoppers and AI need. No sign-up.`
- **H1:** `AI Bot Checker for product descriptions`
- **Intro:** "The AI Bot Checker is a free tool that checks whether your product description reads like generic,
  bot-style copy: filler phrases, hype words and missing facts. It doesn't guess who wrote it, because no tool can
  prove that. It shows you what to fix."
- **Honesty line** (directly under the form, always visible): "Not an AI detector. No tool can prove who wrote a
  piece of text. This check looks for vague patterns and missing facts, whoever wrote it."
  <!-- source: facts §5.1, ready line §7 -->

**Inputs**
- `text` textarea (label "Paste a product description", max 20,000 characters). With JS: live results as you type
  (debounced). Without JS: submit "Check my copy" (`intent=paste`).
- `url` (label "Or paste a product link", `intent=fetch`): the server reads the description with `readProduct`
  from `check.server.ts`, puts it in the textarea and checks it. Note under the result: "We checked the first
  1,500 characters of the description on {domain}." (`readProduct` cuts descriptions to 1,500 characters.)

**On load:** pre-filled with this made-up text and its live result, labelled "Example description (made up)":
> Elevate your grooming routine with our premium beard oil. Crafted with the finest ingredients, this
> game-changer will unleash your beard's full potential. Whether you're a seasoned beard veteran or just starting
> your journey, our innovative formula delivers an unparalleled experience. Experience the difference today!

**What is checked** (pure, `copy-check.ts`):
1. **Filler phrases** (our list, label it as ours): "elevate your", "take your ... to the next level", "unleash",
   "game-changer"/"game changer", "look no further", "whether you're ... or", "in today's fast-paced world",
   "designed with you in mind", "crafted with care", "the finest ingredients", "the perfect blend of", "perfect for
   any occasion", "must-have", "level up", "experience the difference", "say goodbye to", "say hello to",
   "transform your", "redefine", "embark on", "journey", "seamless"/"seamlessly", "indulge in", "treat yourself",
   "boasts", "unlock", "harness the power of", "full potential". Wildcards match at most 40 characters inside one
   sentence (`[^.!?\n]{0,40}`).
2. **Hype words with no fact in the same sentence**: the `FLUFF` list from `ai-ready.ts` (private there: copy it,
   with a comment pointing at the original, and use `.match`, never `.test` on a global regex) plus "innovative",
   "eco", "next-gen", "cutting-edge" (Microsoft's own examples), "high-quality", "top-quality", "best-in-class",
   "state-of-the-art", "finest". A hype word counts only when its sentence has no concrete fact (a number with a
   unit, a material or ingredient word, or a "for {who}" phrase), which is Microsoft's point: "anchor claims in
   measurable facts". <!-- source: Microsoft Advertising blog, 8 Oct 2025 (facts §5.3) -->
3. **Facts shoppers and AI assistants look for** (7):
   - Who it's for: `AUDIENCE` from `ai-ready.ts`.
   - Size, amount or dimensions: `SIZE` from `ai-ready.ts`.
   - Materials or ingredients: `MATERIAL` from `ai-ready.ts`, run on the text with the bare nouns "ingredient(s)",
     "material(s)" and "fabric" removed first, so "the finest ingredients" doesn't count as naming any.
   - How to use it: `/\b(?:how to use|directions|apply|use (?:\d+|one|two|three|a few)|massage|rinse|wash|wear|pour|mix|spray|\d+\s?drops?)\b/i`
   - Care or storage: `/\b(?:care|machine wash|hand wash|wipe clean|dishwasher[- ]safe|store (?:in|at|away)|keep (?:out of|away from)|shelf life)\b/i`
   - What's included: `/\b(?:includes?|in the box|comes with|set of|pack of|kit contains)\b/i`
   - Where it's made or ships from: copy `MADE_IN` and `PLACE` from `ai-ready.ts` (private there; copy with a comment).
   Each missing fact becomes a question for the owner, never an invented answer:
   "Who is it for? For example: men with dry skin, beginners, sensitive skin." · "What size or amount is it?" ·
   "What is it made of, or what's in it?" · "How do you use it?" · "How do you care for it or store it?" · "What
   comes in the box?" · "Where is it made, and where do you ship?"
4. **Readability notes** (tips): more than 120 words with no line break ("Break it into short paragraphs or a
   list."); sentences over 35 words; decorative symbols such as →, ★ or "!!!", and em dashes (Microsoft advises
   avoiding decorative symbols and being cautious with em dashes); the same 3-word phrase 3 or more times; under 50
   words ("Too short to give shoppers and AI assistants much to repeat."); text that `looksEnglish` says isn't
   English ("This check only reads English.").
   <!-- source for symbols and em dashes: Microsoft Advertising blog 8 Oct 2025 -->

**Verdict** (never a percentage, never "written by AI"):
- "Specific and clear": 4 or more of the 7 facts and at most 1 flag (filler + unanchored hype) per 100 words.
- "Sounds generic": 1 or fewer facts, or 4 or more flags per 100 words.
- Otherwise "Some specifics, some filler".
- Line under it: "{x} vague phrases, {y} of 7 key facts found." The thresholds are listed in "How this tool works".

**Result layout**
1. Verdict + line.
2. The text with flagged phrases marked (`<mark>` segments built like `highlightSegments` in `check-ui.tsx`: React
   text nodes, never `dangerouslySetInnerHTML`), each with a short reason on hover and in the list below.
3. "Phrases to rewrite": phrase, why, how. Example: "“premium”: says nothing a shopper can check. Say what makes it
   better, like the material or where it's made."
4. "Facts shoppers and AI assistants look for": 7 rows, found or missing; missing rows show the question.
5. "In numbers": words, sentences, average sentence length, facts found, vague phrases (all counted, none invented).
6. Tips.
7. A static before and after, labelled "Example rewrite (made up)": the sample above, then:
   "Beard oil for dry skin under short and medium beards. 30 ml glass bottle with a dropper, about two
   months of daily use. Made with jojoba, argan and sweet almond oil, with no added fragrance. Use 3 to 4 drops
   after a shower and comb through. Made in Melbourne, ships worldwide."
8. Button.

**Button:** "See how GEO rewrites product pages with your facts" → `/?ref=tool-ai-bot-checker#how`
(True: the fix engine rewrites descriptions from catalog facts only and the store approves, CLAUDE.md §11.)

**What this tool checks:** "Filler phrases that make copy sound generic" · "Hype words with no fact to back them
up" · "7 facts shoppers and AI assistants ask about, and which are missing" · "Long sentences, walls of text and
decorative symbols".

**How this tool works**
- "The check runs in your browser. Pasted text isn't sent to us, unless JavaScript is off: then it's sent to our
  server once to build the result, and not kept. If you paste a product link, our server reads that page once."
- "We look for three things: filler phrases common in generic product copy, hype words with no fact in the same
  sentence, and which of 7 key facts are missing."
- "The hype words innovative, eco, next-gen and cutting-edge, and the advice on decorative symbols and dashes,
  come from Microsoft Bing's guidance on writing for AI answers (October 2025). The rest of the lists are our own
  judgement."
- "Verdict: 'Specific and clear' means at least 4 of the 7 facts and no more than 1 vague phrase per 100 words.
  'Sounds generic' means 1 fact or fewer, or 4 or more vague phrases per 100 words."
- "It's a pattern check in English. It can miss things and can flag a fair use of a word. It never says whether
  a person or an AI wrote the text."

**FAQs**
1. **Can this tell if AI wrote my product description?**
   No, and no tool can prove it. OpenAI withdrew its own AI-text classifier in July 2023 because of its low
   accuracy, and said it was very unreliable on texts under 1,000 characters, which most product descriptions
   are. This checker looks at what matters to shoppers instead: vague phrases and missing facts.
   <!-- source: https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/ (facts §5.1) -->
2. **Is it bad to use AI to write product descriptions?**
   Not by itself. Google says AI-written content is fine when it's accurate and useful, and that using AI to
   mass-produce pages without adding value can break its spam policies. Check every fact, add details only you
   know, and never let a tool invent ingredients, sizes or claims.
   <!-- source: https://developers.google.com/search/docs/fundamentals/using-gen-ai-content (updated 1 Oct 2026) -->
3. **Why do vague words hurt with AI shopping assistants?**
   AI assistants answer shopper questions with facts they can repeat, like "for dry skin", "30 ml" or "made with
   jojoba". Microsoft's Bing team advises avoiding words like "innovative" or "eco" without specifics and
   anchoring claims in measurable facts: "42 dB dishwasher" instead of "quiet dishwasher".
   <!-- source: Microsoft Advertising blog, 8 Oct 2025 -->
4. **What should a good product description include?**
   Who it's for, what it's made of, its size or amount, how to use and care for it, what's included, and where
   it's made or ships from. Put who it's for and the key facts in the first two sentences, then the brand story.
   <!-- our advice, consistent with ai-ready.ts "key facts near the top" -->
5. **Are AI detectors accurate?**
   They've improved on long texts but still make mistakes. In Epoch AI's July 2026 test on 500-word passages,
   leading detectors rarely flagged human writing but missed 10% to 18% of AI text written to imitate a real
   author. A 2023 Stanford study found detectors flagged essays by non-native English writers as AI-written 61% of
   the time on average. Short product copy is harder still.
   <!-- source: https://epoch.ai/data-insights/ai-detectors-false-negatives ; https://arxiv.org/abs/2304.02819 (facts §5.1) -->

**Secondary keywords:** ai detector for product descriptions, chatgpt product description checker, ai generated
product description checker, does my product description sound like ai, ai product description checker, ai copy
checker shopify. Don't chase "ai detector" itself (our tool isn't one).

**Structured data:** standard tool graph.

**Server and client split**
- Pure `copy-check.ts` (browser and server): `checkCopy(text): CopyReport` with `segments` for highlighting,
  `phrases`, `facts`, `numbers`, `tips`, `verdict`. Linear-time scanning; every regex bounded; input capped at
  20,000 characters before scanning.
- `copy-check.server.ts`: link mode only: `normalizeCheckUrl`, then `readProduct(url)` inside `toolFetchGate`,
  then `checkCopy(description)`. If `readProduct` throws or the description is empty: "We couldn't find a product
  description on that page. Paste the text instead."
- Cache per URL 60 s.

**Limits and costs:** link mode 20 per IP per hour, 100 per day, 5,000 a day overall; paste posts 60 per hour.
No paid calls. (`readProduct` makes up to 2 fetches; `storeCountry` stays off.)

**Edge cases and errors**
- Empty text: verdict hidden, "Paste a product description to check it."
- HTML pasted: strip tags with `htmlToText` from `check-read.ts` before checking.
- Over 20,000 characters: "That's very long for a product description. We checked the first 20,000 characters."
- Not English: show the note, skip the phrase lists, keep the numbers.
- Marketplace link: `normalizeCheckUrl`'s own copy.

**Tests (`test/tools-copy-check.test.ts`)**
- The sample: verdict "Sounds generic"; "Materials or ingredients" is missing (bare word rule); flags include "Elevate your", "premium", "game-changer", "unleash",
  "Whether you're ... or", "journey", "innovative", "unparalleled", "Experience the difference".
- The rewrite: verdict "Specific and clear"; facts found: who, size, materials, how to use, origin.
- "premium cotton" in a sentence that also says "100% organic cotton, 180 gsm" is not counted as unanchored.
- Wildcard phrases don't cross sentence ends; a 20,000-character adversarial input finishes under 100 ms.
- Segments rebuild the exact original text when joined.
- No output string contains "%" next to "AI", "AI-written", "human" or "detected" (guard against detector-style copy).
- Action link mode with `readProduct` mocked; failure copy; honeypot; limits.
- Meta test, no em dash in the copy module (the pattern list may contain the em dash character only as a
  `\u2014` escape, never typed), no-JS `curl` shows the H1, the honesty line and the sample's verdict.

---

### T7. AI Visibility Checker

An SEO landing page for the existing free product check. No new server code: the form posts to `/check`.

- **URL:** `/tools/ai-visibility-checker`
- **Title:** `AI Visibility Checker: Does ChatGPT Recommend You? | GEO`
- **Meta description:** `Free AI visibility checker for Shopify products. See if ChatGPT, Gemini and Perplexity recommend your product and who they pick instead. No sign-up.`
- **H1:** `AI Visibility Checker`
- **Intro:** "The AI Visibility Checker is a free tool that asks ChatGPT, Gemini and Perplexity real shopper
  questions about your product and shows whether they recommend it, which brands they name instead, and which
  websites they trust. It takes about 2 minutes."

**Inputs:** `<CheckForm />` imported from `check-ui.tsx` unchanged (a plain `<form method="post" action="/check">`
with `url` and the `website` honeypot; its hint already says "Free. No sign-up. We ask ChatGPT, Gemini and
Perplexity 3 questions, twice each, as a shopper where your store is."). It works without JS and redirects to the
report at `/check/:id`. Errors (limit reached, bad link) show on `/check`; that is acceptable in v1. Phase 2 option:
a tool-route action copying `check._index.tsx`'s action so errors stay on this page.

**On load: the sample report** (`visibility-sample.tsx`), labelled "Sample report for a made-up store. Your report
uses live answers about your product." Source of the data, in order of preference:
1. A real report on a product from Ross's own dev store (or Shopify's public demo store), run on the live site and
   frozen into `samples/visibility-sample.ts` with its date. Then the label becomes "Real example: a check run on
   {date} for a product from {store}." Needs Ross (R5).
2. Until then: the made-up sample from `test/fixtures/check-sample.ts` (Kōwhai & Co, fictional NZ lip balm, made-up
   rivals and sites). Copy the data needed into `app/lib/tools/samples/visibility-sample.ts` (app code must not
   import from `test/`), keep "made-up" in the label.

Sample card content (compact, not the full report): the product line (name, store, price), the score ring
(`PercentRing` from `check-ui.tsx`), "Named in {x} of {y} answers", a row per assistant (ChatGPT, Gemini,
Perplexity: named or not), "Brands named instead" (top 3), "Sites the answers cite" (top 3 with type chips), the 3
questions asked. Every number comes from the sample data via the same `buildReport` logic the real report uses
(`check-report.ts`), never typed in.

**Result layout:** the real result is the existing report page `/check/:id`. This page only shows the sample.

**Button:** "See the sales AI sends you" → `/?ref=tool-ai-visibility-checker#money`

**What this tool checks:** "3 shopper questions written for your product, asked twice on each assistant" ·
"Whether your brand is named, and how often" · "The brands named instead of you" · "The websites the answers cite"
· "How easy your product page is for AI to quote".

**How this tool works**
- "We read your product page, and Shopify's product data when the store runs on Shopify, work out where the store
  sells, and write 3 questions a shopper there might ask."
- "We ask ChatGPT, Gemini and Perplexity each question twice, because AI answers change from one run to the next.
  Two runs give a fairer picture than one."
- "We record which brands each answer names, in what order, and which websites it cites, then score how often your
  brand is named."
- "We also score how easy your page is for AI to quote: who it's for, key facts near the top, an FAQ and product data."
- "Limits: 3 questions are a small sample, answers change over time, and assistants can answer differently for
  different people. Reports aren't listed publicly and search engines are told not to index them."
(T7 checks each line against `check.server.ts` and `docs/free-check.md` before shipping; fix the copy, not the code.)

**FAQs**
1. **What is AI visibility?**
   AI visibility is how often AI assistants like ChatGPT, Gemini and Perplexity name your brand or product when
   shoppers ask them what to buy. It's like ranking on Google, except there's no list of ten links: the assistant
   names a few brands and the sites it trusts.
2. **How is this different from other AI visibility checkers?**
   Many free checkers give a readiness score from your site's code, or look your brand up in a database of past
   prompts. This one asks the assistants live, with questions written for one product, and shows the actual
   answers, the brands named and the sites cited.
   <!-- source: competitors §9 (Ahrefs database lookup; arobis and Kedra readiness scores). No competitor named on the page. -->
3. **Why does ChatGPT recommend my competitors instead?**
   AI assistants tend to name brands that trusted sites already mention, like review roundups, retailers and
   forums, and products whose pages state clear facts. Your report lists the sites each assistant cited, which are
   the places to get your product mentioned, and what to fix on your page.
   <!-- source: geo-2026 §2.11 (Chen et al. 2025, earned media bias); docs/geo-research.md -->
4. **Do the results change each time?**
   Yes. AI answers vary between runs, so we ask every question twice and report both. Answers also change as
   assistants update and new pages appear, so check again after you make changes.
5. **Is it really free?**
   Yes. There's no sign-up and no card. Each check costs us real money to run, so there's a limit of 3 checks per
   person per day.
   <!-- source: createCheck limits (codebase-brief §3.6: 3 good checks per hashed IP in 24 h). Update if the limit changes. -->
6. **What does GEO do with my product link?**
   We use it to run your check and show your report. Reports aren't listed publicly, search engines are told not
   to index them, and they're deleted after a set time. Our privacy policy has the details.
   <!-- source: check.$id noindex; RETENTION.publicCheckDays shown on /privacy -->

**Secondary keywords:** ai visibility checker free, chatgpt visibility checker, ai search visibility checker, is my
brand in chatgpt, does chatgpt recommend my product, shopify ai visibility, ai brand visibility checker. ("llm
visibility checker" only if it reads naturally; never "LLM" as jargon.)

**Structured data:** standard tool graph.

**Server and client split:** SSR only (no action, no loader beyond the layout's). JS only for `CheckForm`'s own
effects.

**Limits and costs:** the free check's existing limits (3 good checks and 10 tries per hashed IP per 24 h, 150 a day
overall, US$10 a day) and cost (about A$0.27 per check, task brief). Nothing new.

**Edge cases:** the honeypot and cross-site guard live in `/check`'s action. A visitor from `www.usegeo.app` is
redirected to the apex by `publicHostRedirect` before they ever see the form (fixes the www Origin issue for this
page, codebase-brief §1.7).

**Tests (`test/tools-visibility.test.ts`)**
- Renders a `form[method=post][action="/check"]` with an input named `url` and the `website` honeypot.
- The sample card's numbers equal what `buildReport` returns for the sample data.
- The sample label contains "made-up" (or "Real example" with a date when R5 is done).
- Meta test, no em dash in the copy module, no-JS `curl` shows the H1, intro, form and sample.

---

## 6. The hub: `/tools`

- **Title:** `Free AI Search Tools for Shopify Stores | GEO`
- **Meta description:** `Seven free tools that show how AI search sees your Shopify store: AI Overviews, AI crawlers, product schema, FAQ schema, llms.txt and product copy.`
- **H1:** `Free AI search tools for Shopify stores`
- **Intro:** "Seven free tools that show how Google's AI Overviews, ChatGPT, Gemini and Perplexity see your store, and
  what to fix. No sign-up, and every result shows right on the page."
- **Groups** (from `group` in the registry), each an H2 with cards (name as a link, `short`, `timing`):
  - "See where you stand": AI Visibility Checker, AI Overview Checker.
  - "Check that AI can read your store": AI Crawler Checker, Product Schema Checker, llms.txt Checker.
  - "Improve what AI reads": AI Bot Checker, FAQ Schema Generator.
- A short "Where to start" paragraph: "Not sure? Start with the AI Visibility Checker to see if AI recommends your
  product today. Then check that AI bots can read your store with the AI Crawler Checker."
- One button at the end: "See how GEO works" → `/?ref=tools-hub#how`.
- Updated line (`HUB.updated`), footer.
- JSON-LD: `hubJsonLd()`. No FAQ block.
- Head via `pageMeta({ path: "/tools", ..., image: "/og/tools.png" })`.

## 7. Acceptance tests and checks

### 7.1 Every tool route (each tool builder, in their own test file)

- `meta()` output: one `<title>` equal to the registry title (under 60 characters); description equal to the
  registry (under 155); exactly one canonical `https://usegeo.app/tools/<slug>`; `og:url` equal to it; `og:image`
  absolute with width 1200 and height 630; `twitter:card` `summary_large_image`; no `robots` meta.
- JSON-LD parses; has WebApplication (price "0", no ratings), WebPage (`dateModified` = registry `updated`),
  BreadcrumbList (3 items), Organization, and FAQPage whose questions and answers equal `FAQS` exactly.
- Render the page with `createRoutesStub` (route + `tools.tsx` layout) and `renderToStaticMarkup`: exactly one `h1`
  with the registry H1; the intro text; the sample or live-from-prefilled result; exactly one `a.tl-cta` with the
  spec's text and href; every FAQ question as an `h3` with its answer visible (no `hidden`, no `details`); 3 related
  tool links; the updated line; the footer with all 7 tool links and `/tools`.
- The copy module has 4 to 6 FAQs, no em dash (U+2014), no spaced en dash, and no jargon in visible copy: a case-sensitive
  check finds no "AEO", no " LLM" and no "generative engine optimization" ("GEO" only as the brand name).
- Action: refuses cross-site POST (403), oversized body (413), honeypot (empty result, no fetch), bad input (400);
  over the limit (429); response headers include `Cache-Control: no-store` and `X-Robots-Tag: noindex`.

### 7.2 Cross-tool (integrator, `test/tools-cross.test.ts`)

- `siteLlmsTxt()` passes `checkLlms` with no problems and no tips.
- `siteRobotsTxt()` run through `checkBots` (T2): every bot in `TOOL_BOTS` is allowed on `/`, `/tools/...` and
  `/check/x`; the verdict is "All the bots that affect AI answers can read your pages".
- Footer, hub, sitemap, llms.txt and `home.html` all list the same 7 paths (from the registry).
- Every `related` slug resolves; every tool page links to the hub.
- `npx vitest run` (with `TEST_DATABASE_URL` set as in codebase-brief §6), `npm run typecheck`, `npm run lint`,
  `npm run build` all pass. Baseline before this work: 341 passed, 88 skipped.

### 7.3 No-JavaScript and crawler checks (integrator, before push)

Run the production build locally (`npm run build`, then `react-router-serve ./build/server/index.js` with the test
env and the local test database) and for each of the 8 pages:
```bash
curl -s http://localhost:3000/tools/ai-crawler-checker -A "Mozilla/5.0 (compatible; GPTBot/1.1)" > /tmp/p.html
grep -c '<h1' /tmp/p.html                       # 1
grep -o '<title>[^<]*' /tmp/p.html              # registry title
grep -o 'rel="canonical" href="[^"]*' /tmp/p.html   # https://usegeo.app/tools/ai-crawler-checker
grep -c 'application/ld+json' /tmp/p.html       # 1
grep -c 'The AI Crawler Checker is a free tool' /tmp/p.html   # 1
grep -c 'href="/tools/' /tmp/p.html             # at least 8
```
Also: `curl -I` shows `Cache-Control: public, max-age=300`; `/robots.txt`, `/sitemap.xml`, `/llms.txt` answer 200
with the right content type; `/tools/nope` answers 404 with `noindex`; HTML under 2 MB; a POST without JS (curl
`-d`) returns the full page with a result.

### 7.4 Phone and speed (integrator)

- At 360 px and 390 px wide: no sideways scroll; the form is visible without scrolling; code blocks scroll inside
  their card; tap targets at least 44 px; the CTA is visible right under the result.
- Targets: LCP under 2.5 s, INP under 200 ms, CLS under 0.1 (seo-2026 §5.1). The H1 text should be the LCP element
  (no large hero image). Result areas reserve their height.
- Keyboard: every control reachable, visible focus, results announced via `aria-live`.
- Screenshots of all 8 pages at 390 px for Ross.

### 7.5 After deploy (integrator, through Treg because this sandbox can't reach usegeo.app)

Fetch each live page with `crawl4ai.web.scrape` (`format: "html"`, US$0.00015 each) or Railway logs and confirm
the H1, title, canonical and one result block. Check `https://usegeo.app/robots.txt` and `/sitemap.xml`. Confirm
`www.usegeo.app/tools` and the railway.app host 301 to `https://usegeo.app/tools`, and that `/app` and
`/auth/login` on the railway.app host still work (Shopify admin). Run one live AI Overview search and confirm an
`ApiCost` row (via Railway logs or the DB).

## 8. Shared copy

### 8.1 Footer and nav labels

Footer heading "Free tools"; first link "All free tools"; then the 7 names. GEO column: "Home", "How it works",
"Pricing", "Privacy". Line: "GEO · Helps ChatGPT & co recommend your products". Pill in the band: "Free tools".
Breadcrumb: "Home", "Free tools", tool name.

### 8.2 Privacy page: new "Free tools" section (F adds to `privacy.tsx`)

"**Free tools.** Our free tools at usegeo.app/tools work without an account.
- Tools that run in your browser (the FAQ Schema Generator, the AI Bot Checker with pasted text, and pasted
  robots.txt, llms.txt or product data) don't send what you type to us. If JavaScript is off in your browser, the
  form is sent to our server once to build the result, and we don't keep it.
- When you enter a web address, our server fetches public files from that site (such as robots.txt, llms.txt or a
  product page) to check them. We don't keep the files.
- The AI Overview Checker sends your search phrase to our data provider, Treg, which passes it to a Google results
  service (Crawl4AI, or AnyAPI as a backup). We keep the result in memory for up to 24 hours so a repeat search is
  fast. If you add your website, we only use it to compare with the results.
- To stop abuse we count requests using a scrambled (hashed) version of your IP address, held in memory and
  cleared within a day. We record what each search cost us, without your IP address or your search."

The AI Visibility Checker is the free product check, already covered on the page.

## 9. Launch checklist (Ross, after the push)

1. Google Search Console: add a Domain property for `usegeo.app` (DNS TXT record). Submit
   `https://usegeo.app/sitemap.xml`. URL Inspection on `/tools` and each tool: check "Page is indexable", the
   Google-selected canonical is usegeo.app, then "Request indexing". Settings > Search generative AI: confirm
   "Include" (the default). <!-- seo-2026 §4.4 -->
2. Bing Webmaster Tools: import from Search Console, submit the sitemap, watch "AI Performance".
3. IndexNow (optional): create a key (8 to 128 letters, digits or dashes), commit it as `public/<key>.txt`
   containing the key, then after each deploy that changes tool pages, POST
   `{"host":"usegeo.app","key":"<key>","urlList":[...changed URLs]}` to `https://api.indexnow.org/indexnow`
   (200 or 202 = received). Bing and the other IndexNow engines share it; Google doesn't use it.
4. Set `GEO_TOOLS_USD_PER_DAY` on Railway only if the US$2 default needs changing. Set `GEO_ALERT_EMAIL` (still
   unset, codebase-brief §4.4).
5. Watch for 4 weeks: Search Console Generative AI performance report, Bing AI Performance, Railway logs for
   `?ref=tool-` hits on the home page and for `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Claude-SearchBot`
   requests to `/tools/*`.
6. Quarterly: re-check the bot list (T2), Shopify's llms.txt and robots.txt behaviour, Google's FAQ and AI features
   docs; change a tool's `updated` date only when its copy or logic really changes.
7. Off-site, once live (geo-2026 §3): honest pitches to "best free AI SEO tools" roundups that list competitors,
   one short screen recording per tool on YouTube, disclosed answers in r/shopify and the Shopify Community.

## 10. Things not to do (all builders)

- No near-duplicate pages per keyword or platform ("GPTBot checker", "llms.txt validator", "for Shopify" copies).
- No result URLs, no `?url=` GET runs, no `pushState`.
- No `aggregateRating`, `review`, `HowTo` markup; no claim that FAQ markup gets rich results; no claim that
  llms.txt or schema gets anyone recommended.
- No email gate, popup or second button. Email capture is not part of this build.
- No raw `err.message`, no `dangerouslySetInnerHTML` with fetched or pasted content, no unbounded regex on fetched
  pages.
- No edits to the files under review (2.1); no `public/robots.txt`; no new packages; no migration.
- No faked bot requests (0.9). No invented numbers, authors, reviews or dates. No em dashes.

## 11. Sources used in this spec (all read 11 Oct 2026 unless dated)

Live checks made for this spec (Treg MCP, about US$0.002 in total):
- `crawl4ai.google.serp.organic` for "best sunscreen for oily skin", "beard oil", "allbirds tree runners" (US):
  all three showed an AI Overview; sample in T1.
- `anyapi.google.serp.ai_overview` for "best sunscreen for oily skin": same overview, product names stripped,
  ends with "Share public link"; US$0.0015 charged.
- `litescrape.google.serp.ai_overview`: 402 "This API key has no calls remaining".
- Treg catalog entries for all three (prices, measured speed and success rates).
- Shopify `agents.md.liquid` and `llms.txt.liquid` template docs (via `crawl4ai.web.scrape`):
  https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid ,
  https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid

Research files (each lists its own primary sources with dates):
- `docs/tools/research/seo-2026.md` (Google Search Central docs, spam policies, structured data status, sitemaps,
  canonical, Core Web Vitals, Open Graph)
- `docs/tools/research/geo-2026.md` (assistant search providers, citation studies, llms.txt evidence, robots.txt
  for usegeo.app, measurement)
- `docs/tools/research/facts-2026.md` (bot table, Shopify robots.txt and llms.txt, product schema properties, FAQ
  timeline, AI detector evidence, AI Overview availability)
- `docs/tools/research/competitors.md` (page-1 teardowns and how each tool wins)
- `docs/tools/research/codebase-brief.md` (routes, helpers, limits, tests, files under review)
- `docs/geo-research.md` (crawler levels, app features)

UNVERIFIED items builders must not state as fact: Crawl4AI's "no AI Overview" response shape; whether Shopify's
`/products/<handle>.js` includes `barcode`; the old Shopify default robots.txt header comment; how Shopify treats
fake bot user agents; Google's handling of 5xx robots.txt (check its docs first); AI Overview personalisation;
the Shopify staff "community proposal" quote; whether OpenAI reads IndexNow.
