# Codebase brief: 7 free tool pages, /tools hub, robots.txt, sitemap.xml, footer links

Written 11 Oct 2026 from the code at commit `4d49e5f` (branch `claude/peaceful-cerf-xtpto5`), plus read-only
checks of the live Railway service. Everything below was read in the repo or in Railway; anything not checked
is marked UNVERIFIED. Sibling research: `seo-2026.md`, `geo-2026.md`, `facts-2026.md`, `competitors.md` (same folder).

---

## 0. The gotchas that will bite first

1. **Two hosts serve the site with no redirect.** Railway has custom domains `usegeo.app` AND `www.usegeo.app`;
   live HTTP logs show `GET /` on `www.usegeo.app` answering 200 (not 301). Every public page needs a
   `rel=canonical` to `https://usegeo.app/...`, and a www to apex 301 is worth adding (see 1.7).
2. **`/robots.txt` and `/sitemap.xml` are 404 today** on both hosts (Railway HTTP logs, 11 Oct: OAI-SearchBot,
   ClaudeBot and others got 404). No `public/robots.txt` exists, so a route file can serve them (1.2).
3. **`meta` does not merge.** React Router uses the deepest route's `meta` only (parent meta is dropped when a child
   exports `meta`). `links` from every matched route are all rendered. `headers` falls back to the parent's when a
   child has none (1.3, 1.4).
4. **Home page assets:** `node design/overview/assemble.mjs` deletes and re-creates `public/home/img/` and copies only
   images the home page uses plus a hard-coded `extra` list. Never put tool images in `public/home/img/`; use
   `public/tools/` (2.3).
5. **Railway ignores commits that only touch `design/**`, `docs/**` or root `*.md`** (`watchPatterns`). A footer edit in
   `design/overview/parts/` deploys only if you also commit the rebuilt `app/home/home.html` (2.4).
6. **`safeFetch` returns no response headers** and throws a private `CheckError`; never show `err.message` from it raw
   (3.1).
7. **`jsonLdBlocks()` in `check-read.ts` is not exported**, and the JSON-LD Product reader only keeps 8 fields (3.2).
8. **Free tool Treg costs share the free check's daily spend cap**: `platformSpend()` sums every `ApiCost` row with
   `shopId: null` (4.3).
9. **Tests must be `.ts`, not `.tsx`** (`vitest.config.ts` includes `test/**/*.test.ts`); render with
   `createElement`, as `test/check-pages.test.ts` does (6).
10. **`meta` and `links` run in the browser too**: never import `env.server.ts` (or anything `.server`) into code used by
    `meta`; use a constant `https://usegeo.app` for canonicals (1.3).
11. The site is **light theme only** (`color-scheme: light` in `design/overview/base.css`; no dark styles anywhere) (5).
12. One Railway replica, but deploys overlap during draining, and in-memory state resets on each deploy (7.3).

---

## 1. Routing

### 1.1 Conventions in this repo

- `app/routes.ts` is just `export default flatRoutes();` (`@react-router/fs-routes` 7.18.2, React Router 7.18.2).
- Dots in a file name are URL segments: `check._index.tsx` is `/check`, `check.$id.tsx` is `/check/:id`,
  `check.$id.email.tsx` is `/check/:id/email`, `app.tsx` is the layout for `/app/*`.
- Folder routes use `route.tsx`: `app/routes/_index/route.tsx` (`/`), `app/routes/auth.login/route.tsx`.
- A module with a `loader` and no default export is a **resource route** (returns a raw `Response`, skips
  `root.tsx` and `entry.server.tsx`). Examples: `healthz.tsx`, `check.$id.email.tsx`, and the home page itself
  (`_index/route.tsx` has no component; it returns `home.html` as a `Response`).
- A literal dot inside one segment is escaped with brackets: `robots[.]txt.ts` serves `/robots.txt`.

### 1.2 File names to create

| URL | File | Kind |
|---|---|---|
| `/tools` | `app/routes/tools._index.tsx` | page |
| `/tools/ai-overview-checker` | `app/routes/tools.ai-overview-checker.tsx` | page (+ action) |
| `/tools/ai-crawler-checker` | `app/routes/tools.ai-crawler-checker.tsx` | page (+ action) |
| `/tools/product-schema-checker` | `app/routes/tools.product-schema-checker.tsx` | page (+ action) |
| `/tools/faq-schema-generator` | `app/routes/tools.faq-schema-generator.tsx` | page (+ action) |
| `/tools/llms-txt-checker` | `app/routes/tools.llms-txt-checker.tsx` | page (+ action) |
| `/tools/ai-bot-checker` | `app/routes/tools.ai-bot-checker.tsx` | page (+ action) |
| `/tools/ai-visibility-checker` | `app/routes/tools.ai-visibility-checker.tsx` | page |
| `/robots.txt` | `app/routes/robots[.]txt.ts` | resource route |
| `/sitemap.xml` | `app/routes/sitemap[.]xml.ts` | resource route |
| (optional) `/llms.txt` | `app/routes/llms[.]txt.ts` | resource route |

Optional layout: `app/routes/tools.tsx` (with `<Outlet />`) becomes the parent of `/tools` and every
`/tools/*` page. Useful for one `links` export (fonts + stylesheet), one `headers` default and one
`ErrorBoundary`. Each child still needs its own `meta` (no merging, 1.3).

**Static files win over routes.** `react-router-serve` (node_modules/@react-router/serve/dist/cli.js) mounts, in
order: `build/client/assets` (immutable, 1 year), `build/client` (no max-age; it holds a copy of `public/`),
`public/` (max-age 1 hour), then React Router. A `public/robots.txt` or `public/sitemap.xml` would shadow the route
file. Today `public/` holds only `favicon.svg`, `favicon.ico`, `apple-touch-icon.png` and `home/img/`, so there is no
clash. Keep it that way (a test can assert `!existsSync("public/robots.txt")`).

Resource route shape (pattern from `healthz.tsx` and `_index/route.tsx`):

```ts
export const loader = () =>
  new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
```

Use `application/xml; charset=utf-8` for the sitemap. Unknown paths currently render React Router's built-in 404
page (root has no `ErrorBoundary`).

### 1.3 `meta` and `links` (how they are used today)

- `check._index.tsx`: `meta` returns `title` + `description`; `links` returns
  `[...CHECK_FONT_LINKS, { rel: "stylesheet", href: styles }]` with `import styles from "../styles/check.css?url"`.
- `check.$id.tsx`: `meta` reads loader data and adds `{ name: "robots", content: "noindex" }`; `links` adds
  `check.css` and `check-live.css`; it also exports `headers` (`private, no-store`, `Vary: Cookie`).
- `privacy.tsx`: `meta` is only `[{ title: "GEO privacy policy" }]` (no description, no canonical). It uses inline
  styles, no stylesheet.
- `tips.tsx`, `unsubscribe.tsx`: `title` + `noindex`, `links` = `EMAIL_PAGE_FONTS`.

What React Router 7.18.2 supports (read in `node_modules/react-router/dist/development/chunk-HHGH3NKS.js`):

- **Leaf wins:** a route that exports `meta` replaces its parents' meta; a route without `meta` inherits the
  nearest parent's. To merge, read `matches` inside `meta`.
- **Canonical in `meta`:** `{ tagName: "link", rel: "canonical", href: "https://usegeo.app/tools/ai-crawler-checker" }`
  (only `tagName` `link` or `meta` are allowed). It can also go in `links`.
- **Open Graph / Twitter:** `{ property: "og:title", content }`, `{ name: "twitter:card", content: "summary_large_image" }`.
- **JSON-LD:** `{ "script:ld+json": { "@context": "https://schema.org", "@type": "WebApplication", ... } }` renders a
  `<script type="application/ld+json">` with the JSON HTML-escaped by React Router.
- `meta` runs on the server AND in the browser (on client navigation), so it must not import server code.
  Put the origin in a browser-safe constant, e.g. `export const SITE = "https://usegeo.app"` in a new
  `app/lib/tools/site.ts`. (`env.appUrl` is `SHOPIFY_APP_URL`, server only; tests set it to `https://geo.test`.)

Suggested helper (new file, pure): `toolMeta({ path, title, description, image?, jsonLd? })` returning title,
description, canonical link, `og:type/og:url/og:title/og:description/og:image/og:site_name`, `twitter:card`, and
`script:ld+json` entries. Every page calls it; the result pages after a POST keep the same canonical.

### 1.4 `headers` and caching

`getDocumentHeadersImpl` (react-router `index-react-server.js` line ~2434): matches reduce from root to leaf; a route
with no `headers` export copies its parent's headers; a route with one replaces them (cookies are kept). It receives
`{ loaderHeaders, actionHeaders, parentHeaders, errorHeaders }`. Recommended for tool pages:

```ts
export const headers: HeadersFunction = ({ actionHeaders }) =>
  actionHeaders.has("Cache-Control") ? actionHeaders : { "Cache-Control": "public, max-age=300" };
```

and return `data(result, { headers: { "Cache-Control": "no-store" } })` from actions (POST results are per visitor).

### 1.5 `root.tsx`

- `<html lang="en">`, `charSet utf-8`, viewport `width=device-width,initial-scale=1`, favicons, then `<Meta />` and
  `<Links />`, `<Outlet />`, `<ScrollRestoration />`, `<Scripts />`.
- It also loads `https://cdn.shopify.com/static/fonts/inter/v4/styles.css` on EVERY page (for the embedded admin).
  Public pages therefore load Inter twice (Shopify CDN + Google Fonts via `CHECK_FONT_LINKS`). Leave root alone (the
  embedded app needs it); note it in any speed audit.
- No `ErrorBoundary` in root. Add one in `tools.tsx` (or per page) so `/tools/typo` and loader errors show the site
  frame, not the bare built-in page.
- `entry.server.tsx` waits for `onAllReady` when `isbot(user-agent)` is true, so crawlers get the full HTML.

### 1.6 Existing noindex handling

| Route | Indexable? | How |
|---|---|---|
| `/` (home.html) | yes | `<meta name="description">` only; **no canonical, no OG, no JSON-LD** |
| `/check` | yes | title + description |
| `/check/:id` (reports) | **no** | `meta` adds `robots: noindex` (good, keep). Also `Cache-Control: private, no-store` |
| `/tips`, `/unsubscribe` | no | `robots: noindex` |
| `/privacy` | yes | title only |
| `/auth/login` | yes (no meta at all) | linked from the pricing buttons (`/auth/login?plan=core&cycle=monthly`) |
| `/app/*` | requires Shopify auth (redirects) | none |

robots.txt advice: `Disallow: /app/`, `/auth/`, `/api/`, `/webhooks/`; do **not** disallow `/check/` (Google must
crawl the report pages to see their `noindex`). Add `Sitemap: https://usegeo.app/sitemap.xml`.
Sitemap: `/`, `/check`, `/tools`, the 7 tool pages, `/privacy`. Never `/check/:id`, `/auth/*`, `/app/*`, `/tips`,
`/unsubscribe`.

### 1.7 www, canonical and the form guard

- Live: `www.usegeo.app` serves the same pages as `usegeo.app` with 200s (Railway HTTP logs, 11 Oct 2026).
- The express adapter builds `request.url` from `req.protocol` with no `trust proxy`, so behind Railway's TLS proxy
  `request.url` is `http://<host>/...` (node_modules/@react-router/express/dist/index.js line 80).
- `fromAnotherSite()` (public-form.server.ts) accepts a POST only when `Origin` equals `new URL(request.url).origin`
  or `env.appUrl`. Since `request.url` is `http://...` and browsers send `Origin: https://...`, a same-site POST is
  accepted only if `Origin` equals `SHOPIFY_APP_URL`. A visitor on `www.usegeo.app` would likely get the 403
  "Please start your check from the GEO website." **UNVERIFIED** (the `SHOPIFY_APP_URL` value is hidden; logs show
  successful POSTs on `usegeo.app` and on the railway.app host). Fix options: 301 `www` to apex in the public loaders
  (a small `canonicalHost(request)` helper that throws `redirect("https://usegeo.app" + path, 301)` when the `Host`
  header starts with `www.`), or compare `new URL(origin).host` with the `Host` header in a tools-only guard.

---

## 2. The home page and the shared footer

### 2.1 How `/` is served

`app/routes/_index/route.tsx` imports `../../home/home.html?raw` and returns it with
`Content-Type: text/html; charset=utf-8` and `Cache-Control: public, max-age=300`. Visits with `?shop=` are
redirected to `/app?...`. `app/home/home.html` is generated; never hand-edit it.

### 2.2 How `home.html` is built

`design/overview/assemble.mjs` reads `design/overview/base.css` + `design/overview/parts/*` sorted by file name
(`05-shared`, `10-nav`, `11-hero`, `11v-video`, `12-engines`, `12w-why`, `20-how`, `20m-money`, `20w-worth`,
`42-pricing`, `43-faq`, `45-cta-footer`; `.css`, `.html`, `.js` each concatenated), writes the design preview
`design/overview/index.html`, then (full build only) writes `app/home/home.html` with:
`<!doctype html><html lang="en">`, the meta description, favicons, `window.GEO_LIVE=true`, the Google Fonts links,
and these string rewrites: `src="img/` and `poster="img/` become `/home/img/`; pricing buttons `href="#pricing"
data-plan="core|pro"` become `/auth/login?plan=..&amp;cycle=monthly`; other `href="#pricing"` buttons become
`/auth/login`; `href="https://usegeo.app/privacy" target="_blank" rel="noopener"` becomes `href="/privacy"`.
The page `<head>` template (canonical, OG, JSON-LD) lives in the `site` template string in `assemble.mjs`; add
`<link rel="canonical" href="https://usegeo.app/">` and OG tags there.

### 2.3 Assets

- `public/home/img/` is wiped (`fs.rmSync`) and refilled on every full build with the images the page references
  plus `extra = ['clay-magnifier.jpg', 'clay-bubble.png', 'clay-bag.png', 'clay-storefront.jpg',
  'free-check-phone-poster.jpg']` (the check pages use those). Sources are in `design/overview/img/`.
- Tool pages may reuse `/home/img/clay-bubble.png`, `/home/img/clay-bag.png`, `/home/img/clay-storefront.jpg`
  (already in `extra`). Any other image a tool page needs from that folder must be added to `extra`, or it vanishes on
  the next build. Simpler: put tool-only files (OG images etc.) in `public/tools/` (served at `/tools/...`, 1 hour
  cache, untouched by the build). Check the path does not collide with a route (`/tools/og/x.png` is fine).

### 2.4 Adding the footer and nav links

Footer: `design/overview/parts/45-cta-footer.html`, inside `.foot-main` there is
`<nav class="foot-links" aria-label="Footer">` with `#how`, `#pricing`, `#faq` and Privacy. It is a single wrapping
flex row (`.foot-links { display:flex; flex-wrap:wrap; gap: 8px 32px }`, phones under 760px stack `.foot-main` as a
column). Eleven links in that row would wrap badly: add a second block, e.g.
`<nav class="foot-tools" aria-label="Free tools"><p class="foot-tools-h">Free tools</p><a href="/tools">All free tools</a>
<a href="/tools/ai-visibility-checker">AI visibility checker</a> ...</nav>`, styled in `45-cta-footer.css` (a 2-column
grid on phones). Write root-relative hrefs (`/tools/...`): they work on the live page; they are dead only in the local
design preview, which is fine. The `href="#..."` test only checks in-page anchors.

Nav: `design/overview/parts/10-nav.html` `<ul class="nav-links">` (How it works, Pricing, FAQ). Add
`<li><a href="/tools">Free tools</a></li>`. `10-nav.js` only intercepts `a[href^="#"]`, so a normal link is safe. The
whole `.nav-links` list is hidden under 860px, so on phones the footer is the only tool entry point.

Rebuild and check:

```bash
node design/overview/assemble.mjs        # full build: writes design/overview/index.html, app/home/home.html, public/home/img/
npx vitest run test/home.test.ts         # must stay green
```

`test/home.test.ts` asserts, among others: the exact `<title>GEO · Get your products recommended by AI</title>`, no
"free" in the title, no em dash (U+2014) anywhere, no spaced en dash, every `href="#x"` has an `id="x"`, every
`/home/img/` file exists, the hero form `<form class="hero-check" id="check" method="post" action="/check">`, and
`href="#check"><span class="nav-cta-long">Check a product free</span>`. Add a test that the footer links all 7 tools
and `/tools`. Commit `app/home/home.html` (and `public/home/img/` if it changed) with the parts, or Railway won't
deploy (watchPatterns `["**","!/design/**","!/docs/**","!/*.md"]`).

### 2.5 The free check pages' frame (`CheckShell`)

`app/components/check-ui.tsx` `CheckShell({ hero, children, lead, announce })` renders:

```
div.ck > main.ck-page > div.ck-band (lilac gradient) > div.ck-band-grid + header.ck-top (logo link "/" + pill)
                                                     + div.ck-band-in {hero}
                      > div.ck-main {children}     > p.ck-sr[aria-live] {announce}
       > footer.ck-foot "GEO · Helps ChatGPT &amp; co recommend your products · Privacy"
```

The pill text is fixed ("Free product check", or the email button when `lead` is set) and the footer is hard-coded:
there are no props for either. Plan for a shared footer:

1. New `app/lib/tools/registry.ts` (pure, browser-safe): one array `TOOLS = [{ slug, path, name, short, keyword,
   updated }]`, used by the footer, the `/tools` hub, the sitemap and tests, so links never drift.
2. New `app/components/site-footer.tsx`: `<SiteFooter />` with the tool links (plain `<a href>`; works without JS).
3. New `app/components/tool-ui.tsx`: `ToolShell({ hero, children })`, a copy of the `CheckShell` frame that reuses the
   `.ck-*` classes, a "Free tools" pill linking to `/tools`, and `<SiteFooter />`.
4. Later, once the review of `check-ui.tsx` is done (section 8), swap the `ck-foot` line in `CheckShell` for
   `<SiteFooter />` (one import, one line) so `/check` and reports link the tools too.

The home page cannot import React components (it is static HTML), so its footer links are written by hand in
`45-cta-footer.html`; a test should compare them against `TOOLS`.

For the AI visibility checker, `<CheckForm />` (exported from `check-ui.tsx`, no props needed) is a plain
`<form method="post" action="/check">` with `url` and the `website` honeypot; it works without JS and redirects to
`/check/:id`. Errors (limit reached, bad link) render on `/check`, not on the tool page. That needs zero new server
code. If errors must stay on the tool page, give the tool route its own `action` that copies `check._index.tsx`'s
action (`fromAnotherSite`, `readSmallForm`, `createCheck`, `redirect`) and render a form that posts to itself
(`CheckForm` has no `action` prop).

---

## 3. Reusable server code for URLs strangers paste

### 3.1 `app/lib/check.server.ts` (the guarded fetch)

```ts
export async function publicAddresses(host: string): Promise<{ address: string; family: 4 | 6 }[]>
// c-ares Resolver (3 s, 1 try). Throws CheckError(CANT_READ) when there is no address or ANY address is private.
export const safeLookup: LookupFunction
// Same checks, used as the socket's lookup, so the connected address is a checked one (DNS rebinding guard).
export async function safeFetch(
  url: string,
  accept = "text/html,application/xhtml+xml",
  opts: { timeoutMs?: number; maxRedirects?: number; maxBytes?: number } = {},
): Promise<{ status: number; url: string; text: string }>
export async function readProduct(url: string, opts: { storeCountry?: boolean } = {}): Promise<ReadProduct>
export async function createCheck(input: { url: string; country?: string | null; ip: string | null; honeypot?: string | null }): Promise<CreateCheckResult>
// CreateCheckResult = { ok: true; id: string } | { ok: false; error: string }
```

`safeFetch` behaviour: every hop re-checks `fetchableUrl()` and `publicAddresses()`; redirects followed by hand,
max 4 (your value is capped at 4); `timeoutMs` default 10,000 **per hop**; body capped at `maxBytes` (default and max
2,000,000), silently truncated; always decoded as UTF-8; request headers
`user-agent: Mozilla/5.0 (compatible; GEO-check/1.0)`, `accept`, `accept-language: en`, gzip/deflate/br unzipped.
It resolves for any status (404 and 500 included). It throws for a bad or blocked URL, private or missing DNS,
network errors, timeouts (`AbortSignal.timeout`) and too many redirects. `CheckError` is not exported; treat every
throw as "couldn't read" and show your own copy (the message is safe only for the CANT_READ case). Response headers
are not returned (`RawResponse` has only `status`, `location`, `body`, `cancel`), so Content-Type and X-Robots-Tag
are unavailable: sniff the body instead (`/^\s*(<!doctype html|<html)/i`), or add an optional `headers` field to
`RawResponse` in `http-get.server.ts` (additive; that file is not in the commit under review).

`readProduct(url)`: in parallel fetches the page (`safeFetch`), Shopify's `/products/<handle>.js` when the path has
`/products/<handle>`, and with `storeCountry: true` `/meta.json` (4 s cap). Returns `ReadProduct` (a `CheckProduct`
minus `category`, plus `tags`, `ldCategory`, `descriptionSource` `"shopify"|"jsonld"|"meta"|null`, `pageRead`,
`looksLikeProduct`, `ldFacts { brand, price, availability } | null`, `aiSignals: AiPageSignals | null`,
`countrySignals`). Throws `CheckError(CANT_READ)` when nothing usable came back. Note `description` is cut to 1,500
characters.

Importing `check.server.ts` also imports `db.server`, the job queue and `registerJob("check.run")`; harmless in a
server route, but mock it in unit tests (`test/check-pages.test.ts` does `vi.mock("../app/lib/check.server", ...)`).

### 3.2 `app/lib/check-read.ts` (pure, tested, no network)

```ts
export function normalizeCheckUrl(input: string): { ok: true; url: string } | { ok: false; error: string }
// adds https:// if missing; <= 2,000 chars; http(s) only; port none/80/443; no user:pass; host needs a dot;
// no IP literal; no blocked names; keeps only product params (variant, id, p, pid, product, product_id, sku);
// drops #hash and trailing slash; REJECTS marketplaces and big retailers (NOT_YOUR_STORE copy).
export function cleanCheckUrl(url: string): string
export function isBlockedHostname(host: string): boolean   // localhost, *.local/.internal/.lan/.home/.corp/.intranet, private IP literals
export function fetchableUrl(u: URL): boolean              // http(s), no credentials, port ""/80/443, not blocked
export const isIpLiteral: (host: string) => boolean
export function isPrivateIp(ip: string): boolean           // v4 + v6 special ranges; unreadable = private
export function ipBucket(ip: string): string               // full IPv4 or the IPv6 /64
export function htmlToText(html: string, max = 20_000): string
export function decodeEntities(s: string): string
export function shopifyHandle(url: string): string | null
export function parseShopifyJs(json: any, pageUrl: string): ShopifyJsFacts | null
export function parseProductHtml(html: string, pageUrl: string): PageFacts
export function parseAiSignals(html: string, blocks?: string[]): AiPageSignals  // { faqSchema, faqHeading, questionHeadings, text }
export function mergeProduct(url: string, js: ShopifyJsFacts | null, page: PageFacts | null): ReadProduct | null
```

- `normalizeCheckUrl` is right for product links (schema checker, bot checker in URL mode). For whole-site tools
  (crawler, llms.txt) write a small `normalizeSiteInput()` with `fetchableUrl` + `isIpLiteral` + "host has a dot"
  that returns the origin, without the marketplace rule.
- `jsonLdBlocks(html: string): string[]` (line ~320) is **private**: linear-time `indexOf` scan, max 20 blocks.
  `findLdProduct` (follows `@graph` and `mainEntity`, depth 6) and `readLdProduct` are private too, and `LdProduct`
  keeps only `name, brand, description, price, currency, image, category, availability`. The product schema checker
  needs more (sku, gtin*, mpn, offers count, priceValidUntil, itemCondition, aggregateRating, review,
  shippingDetails, hasMerchantReturnPolicy, ProductGroup/hasVariant). Write it in a new pure module
  (`app/lib/tools/schema.ts`) with its own copy of the block scanner, or export `jsonLdBlocks` after the review.
- House rule from the file header: strangers' pages are up to 2 MB, so every regex must be bounded (no pattern that
  can rescan to the end of the page from many starts). Copy the `indexOf` style.

### 3.3 `app/lib/ai-ready.ts` (pure)

```ts
export function scoreAiReady(i: AiReadyInput): AiReady | null   // null when i.signals is null (page not read)
// AiReadyInput = { title, description, descriptionSource, tags, productType, price, ldFacts, signals }
// AiReady = { score: 0..100, checks: { id, label, pass, weight, reason, fix }[] }  (7 checks: audience, facts,
// top, description, faq, schema, origin; weights 15 x 6 + 10)
export const AUDIENCE: RegExp; export const SIZE: RegExp; export const MATERIAL: RegExp
export function looksEnglish(text: string): boolean
export function leadText(description: string): string          // first 2 sentences or 300 chars, max 450
export function keyFactsNearTop(description: string): { audience: boolean; facts: boolean; pass: boolean }
export const AI_READY_WEIGHTS; export function aiReadyNote(checks); export const AI_READY_NOTE
```

For the "AI bot checker" (product copy pattern check): in URL mode call `readProduct` then `scoreAiReady` exactly as
`check.server.ts` does (lines 651 to 660). In paste mode there are no `signals`, so `scoreAiReady` returns null: use
`AUDIENCE`, `SIZE`, `MATERIAL`, `keyFactsNearTop`, `looksEnglish` and `htmlToText` directly. The `FLUFF` word list is
private and has the `g` flag (use `.match`, never `.test` on a shared global regex); copy it or export it later.

### 3.4 `app/lib/robots.ts` (pure, browser-safe) and `robots.server.ts`

```ts
export const AI_BOTS: AiBot[]            // 11 bots: { token, name, owner, level: "critical"|"medium"|"info", what }
export function parseRobots(text: string): RobotsGroup[]          // RFC 9309; caps 20,000 lines, 1,000-char patterns
export function rulesFor(groups: RobotsGroup[], token: string): RobotsRule[]   // named groups merged, else "*"
export function patternMatches(pattern: string, path: string): boolean
export function isAllowed(groups: RobotsGroup[], token: string, path: string): boolean  // longest match, Allow wins ties
export function checkRobots(text: string, paths: CrawlerPath[]): { status: "ok" | "blocked"; bots: BotResult[] }
export function crawlerIssues(check): BotResult[]; export const turnedAway = (check) => boolean
export function botLine(b: BotResult): string; export function joinLabels(labels: string[]): string
export const ROBOTS_FIX: string; export const ROBOTS_LIMIT: string
// robots.server.ts
export const robotsFetch = (url: string) => safeFetch(url, "text/plain,*/*;q=0.5", { timeoutMs: 5_000, maxRedirects: 4, maxBytes: 512_000 })
```

- `checkCrawlers(shopId)` is shop-bound (reads and writes the DB): don't call it. Copy its status mapping: 2xx parse;
  401/403/429 "turned away" (never "all clear"); other 4xx "no robots.txt, everything allowed"; 5xx or throw
  "couldn't read".
- Importing `robots.server.ts` runs `registerJob("crawlers.check", ...)` and imports `db`; fine on the server.
- `facts-2026.md` 1.4 lists missing bots (Applebot, Applebot-Extended, Meta-WebIndexer, meta-externalagent,
  Amzn-SearchBot, Amazonbot, DuckAssistBot, Storebot-Google...) and the Applebot fallback to the Googlebot group.
  Do it in the tool module, not in `AI_BOTS` (which drives the in-app check and `test/robots.test.ts`): keep a tool
  list, and for a fallback chain pick the first token that has its own group
  (`groups.some(g => g.agents.includes(t.toLowerCase()))`) and pass that to `isAllowed`; with none, pass the bot's own
  token (it falls back to `*`).

### 3.5 `app/lib/public-form.server.ts` (guards)

```ts
export function clientIp(request: Request): string | null      // x-real-ip (Railway), else LAST x-forwarded-for entry
export function fromAnotherSite(request: Request): boolean     // sec-fetch-site cross-site, or Origin not ours (see 1.7)
export const MAX_FORM_BYTES = 8_192
export async function readSmallForm(request: Request, max = MAX_FORM_BYTES): Promise<URLSearchParams | null> // null = too big
export const PUBLIC_KEY: string                                 // CHECK_IP_SECRET, else random per process
export const hashIp: (ip: string | null) => string              // HMAC-SHA256 hex of ipBucket(ip || "unknown")
```

`check._index.tsx` has private copies of the first three (same rules); new code should import these. Pass a bigger
`max` for pasted text (FAQ generator, product copy), e.g. 32 KB, and still cap field lengths yourself.

### 3.6 Existing limits (free check only)

`createCheck` (DB, under `pg_advisory_xact_lock(hashtext('geo:public-check'))`): same link in the last 24 h reuses that
report; per hashed IP 3 good checks and 10 tries in 24 h; `GEO_CHECKS_PER_DAY` (default 150) checks for everyone;
`GEO_CHECKS_USD_PER_DAY` (default US$10) spend cap; honeypot field `website`. There is **no generic rate limiter** for
other routes. The AI visibility page that posts to `/check` gets all of this for free.

For the new tools: key limits by `hashIp(clientIp(request))` (never keep raw IPs), cap concurrent outbound work with
`gate(() => envLimit("TOOLS_MAX_OPEN", 8))` from `app/lib/gate.ts` (`gate(limit: () => number): { run<T>(fn): Promise<T>,
stats(), resetStats() }`), and use the honeypot + `fromAnotherSite` + `readSmallForm` trio on every POST. Use POST
(not `?url=` GET) for every tool that fetches a page or spends money, so crawlers and link spam can't trigger fetches.

### 3.7 Other helpers

- `app/lib/answers.ts`: `domainOf(url): string` (lowercase, strips `www.`), `cleanUrl(url)`,
  `normalizeAnswer(endpoint, raw): EngineAnswer`.
- `app/lib/plans.ts` (browser-safe): `PLANS.core.name` ("Standard"), `.priceUsd` (97), `.trialDays`, `.questions`;
  `ENGINE_LABELS`. Use these in CTA copy instead of typing prices.
- Install links: `/auth/login` (Shopify login/install; accepts `?shop=x.myshopify.com` and `?plan=core|pro&cycle=monthly|yearly`).
  The check report's button uses `installPath()` from `check-lead.server.ts`. There is no site analytics script.

---

## 4. Treg calls (`app/lib/treg.server.ts`)

### 4.1 Signatures

```ts
export async function tregCall<T = any>(endpointId: string, opts?: {
  method?: "GET" | "POST"; body?: unknown; query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number; shopId?: string | null;
}): Promise<T>
export class TregError extends Error { status: number; endpoint: string }
export async function askEngine(engine: Engine, prompt: string, country: string, shopId?: string): Promise<EngineAnswer>
// EngineAnswer = { text, sources: { url, title? }[], products, provider, empty? }  (text cut to 12,000 chars)
export const scanCountry = (country) => string   // known country code or "US"
export const tregGate   // max TREG_MAX_OPEN (default 40) open Treg calls per process
```

- HTTP: `POST|GET ${TREG_BASE_URL}/call/<endpointId>` with header `X-Treg-Token`. Method defaults to POST when a body is
  given.
- Timeout: `opts.timeoutMs`, default **100,000 ms**, counted from when the call leaves the gate. **No retries** inside
  `tregCall`; `askEngine` tries the main provider, then the backup, then throws `Error("a | b")`.
- Cost: uses the provider-reported cost (`json.cost`, `json.output.costUsd`, `json.costUsd`), else the `PRICES` table
  (`litescrape.google.serp.ai_overview` 0.00015, `anyapi.google.serp.ai_overview` 0.0018), then
  `recordCost(opts.shopId, "treg", endpointId, usd)`. Errors in cost logging are swallowed.

### 4.2 AI Overviews

`askEngine("aio", query, "US")` already exists and costs nothing extra to wire:
1. `litescrape.google.serp.ai_overview`, GET, query `{ q, gl: "us", hl: "en", google_domain: "google.com" }`
   (AU/NZ/GB/CA/IE get their own Google domain). Parsed by `fromLitescrapeAio`: `ai_overview.text_blocks` and
   `ai_overview.references[].link`; `ai_overview: null` means no AI Overview (`empty: true`).
2. Fallback `anyapi.google.serp.ai_overview`, POST `{ prompt }`. Parsed by `fromAnyApiAio`: needs
   `output.found` and `output.data.{answerMarkdown|answer, citations[{ index, title, url }]}` (the `index` is dropped).
   The fixture `test/fixtures/anyapi-aio.json` starts "AI Mode replied", so whether AnyAPI can return an AI Mode answer
   instead of an AI Overview is UNVERIFIED: label results honestly.

`askEngine` has no timeout parameter (100 s per provider). For a page that waits, write
`app/lib/tools/aio.server.ts` that calls `tregCall(endpoint, { ..., timeoutMs: 30_000, shopId: null })` per provider
and `normalizeAnswer(endpoint, raw)`. "Is my site cited": compare `domainOf(source.url)` with the visitor's domain
(equal, or ends with `.${domain}`). Fixtures for tests: `test/fixtures/litescrape-aio.json`,
`litescrape-aio-none.json`, `anyapi-aio.json`; `test/answers.test.ts` shows how they parse.

### 4.3 Cost logging without a shop

`ApiCost` (prisma/schema.prisma line 368): `{ id, shopId String?, provider, endpoint, usd Float, createdAt }`, index
`[shopId, createdAt]`. Pass `shopId: null` (or omit it) and the row is saved with no shop; no `Shop` update happens.
That is exactly how free checks log (`askEngine(..., undefined)`, and Claude via `askJson` with no `shopId`).

The free check's budget guard `platformSpend(since)` sums **all** `shopId: null` rows in the last 24 h against
`GEO_CHECKS_USD_PER_DAY` (default 10). Tool calls will eat into it. Free checks never call the AI Overview endpoints
(`CHECK_ENGINES = ["chatgpt","gemini","perplexity"]`), so a tools-only cap can be:
`db.apiCost.aggregate({ _sum: { usd: true }, where: { shopId: null, endpoint: { in: [AIO_LITESCRAPE, AIO_ANYAPI] }, createdAt: { gte: since } } })`
against a new env var (e.g. `GEO_TOOLS_USD_PER_DAY`), plus the shared cap (re-implement the 3-line sum in the tools
module; `platformSpend` and `overSpendCap` are not exported).

### 4.4 Env vars

Set on Railway today (names only): `ANTHROPIC_API_KEY, CHECK_IP_SECRET, DATABASE_URL, DIRECT_URL, GEO_EMAIL_FROM,
GEO_SELFTEST, NODE_ENV, PORT, RAILWAY_DEPLOYMENT_DRAINING_SECONDS, RESEND_API_KEY, SCOPES, SHOPIFY_API_KEY,
SHOPIFY_API_SECRET, SHOPIFY_APP_AUTOMATION_TOKEN, SHOPIFY_APP_URL, SHOPIFY_BILLING_TEST, TREG_API_KEY`.
Treg reads `TREG_API_KEY` (or `TREG_TOKEN`), `TREG_BASE_URL` (default `https://treg.to`), `TREG_MAX_OPEN` (default 40).
Free check caps: `GEO_CHECKS_PER_DAY`, `GEO_CHECKS_USD_PER_DAY` (unset = defaults). `GEO_ALERT_EMAIL` is NOT set, so
spend-cap alert emails go nowhere (only a console warning). Any new variable needs a safe default in code.

---

## 5. Styling

### 5.1 Tokens

`app/styles/check.css` defines its tokens on `.ck` (not `:root`), copied from `design/overview/base.css`:
navy `#0b0c2b` / `#15163c` / `#373868`; body text `#5c5d78`; `--text-lilac #45466e`; lilac `#efecfd`, `#e2e2fc`;
periwinkle `--peri-300 #bfc9fa`; `--lilac-pedestal #e1ccf7`; `--lilac-deep #b5a8e0`; `--lav-line #e4e0f8`; cobalt
`#4050b0` / `#6878d8` / `#3840a0`; `--line #eeeef4`; green `#3cc26a` / ink `#167a43` / bg `#e9f9ee`; amber `#f0b150` /
`#fdf3e2`; red `#ef5a5a` / `#fdecec`; engine colours; `--grad-main` (lilac to periwinkle), `--grad-btn` (navy button);
`--shadow-clay`, `--shadow-soft` (both lilac-tinted). Fonts: `--font-head` Geist, `--font-body` Inter.
Radii in use: cards 24px (20px on phones), band 32px (24px), header 16px, buttons 12px, chips 100px.
`base.css` also has the neutral set the colour pass introduced: `--warm-50 #f8f7f4`, `--warm-100 #f1f0ec`,
`--line-soft #e6e5e0`, `--ink-2 #3d3e52`, neutral `--shadow-soft`, `--ring-soft`. `check.css` does not have these.

Fonts: `CHECK_FONT_LINKS` (check-ui.tsx) = preconnects + Google Fonts `Geist:wght@400;500;600` and
`Inter:wght@400;500;600;700`, `display=swap`. Add the stylesheet after them in `links`.

Breakpoints used: 900px, 880px, 760px (home), 640px (check pages: h1 56px to 36px, band margin 8px, main padding
16px), plus reduced-motion rules (all animation off under `prefers-reduced-motion: reduce`).

### 5.2 The purple rule

`docs/copy-deck.md` section 14b (11 Oct 2026, Ross: "too much of the purple highlight colour"): purple (lilac,
periwinkle, cobalt) only for the main point: the hero band, the link form and its glow, the logo, the Standard card,
the closing call-to-action card, and one key element per section. Everything else neutral: white or `--warm-50`
sections, white cards with a thin `--line-soft` line and a soft neutral shadow, grey chips, navy links with an
underline, navy ticks. Focus rings stay cobalt. Task #31 (the check page colour pass) is still pending, so
`check.css` cards still use lilac lines and shadows: don't copy those for tool results.

### 5.3 Recommendation

- Reuse the frame classes from `check.css` (`ck`, `ck-band`, `ck-band-grid`, `ck-top`, `ck-logo`, `ck-mark`,
  `ck-word`, `ck-pill`, `ck-band-in`, `ck-main`, `ck-h1`, `ck-h2`, `ck-h3`, `ck-lead`, `ck-btn`, `ck-btn-dark`,
  `ck-form*`, `ck-sr`, `ck-chip.is-*`, `ck-cta*`) by loading `check.css` (about 42 KB raw) in the tools layout.
- Add one new `app/styles/tools.css` with a `tl-` prefix for everything tool-specific (result tables, bot rows,
  schema property lists, code blocks with a copy button, the FAQ editor, the hub grid, the site footer). Define the
  neutral tokens there on `.ck` or `.tl` (`--warm-50`, `--line-soft`, `--ink-2`, neutral shadow, `--ring-soft`) and use
  them for result cards. Purple only for the band, the input form and the single CTA card.
- Import with `import tools from "../styles/tools.css?url"` and `links: [...CHECK_FONT_LINKS, {rel:"stylesheet", href: checkCss}, {rel:"stylesheet", href: tools}]`
  (built CSS lands in `build/client/assets/*.css`, cached 1 year).
- Light theme only, like the rest of the site: set `color-scheme: light` on the tool wrapper, no dark-mode CSS.
- Phones: 16px side gutter like `.ck-main` at 640px; long URLs and code need `overflow-wrap: anywhere` and
  horizontally scrollable `pre` blocks inside the card, never page-wide scroll (home test spirit: no sideways scroll
  at 390px).

---

## 6. Tests

- Config: `vitest.config.ts`, separate from Vite: `include: ["test/**/*.test.ts"]`, `environment: "node"`. So test
  files are `test/<name>.test.ts` (flat folder, kebab-case, e.g. `test/tools-crawler.test.ts`). No `.tsx` tests: use
  `createElement` + `renderToStaticMarkup` (see `test/check-pages.test.ts`), or `createRoutesStub` from
  `react-router`.
- Route functions are called directly: `loader({ request: new Request("https://geo.test/"), params: {}, context: {} } as unknown as LoaderFunctionArgs)`
  (`test/home.test.ts`), `action({ request: new Request(url, { method: "POST", body: new URLSearchParams(fields), headers }) ... })`.
- Mocking patterns: `vi.mock("../app/lib/check.server", () => ({ createCheck: vi.fn(), ... }))`;
  `vi.mock("../app/lib/treg.server", ...)` (integration.test.ts); `vi.mock("../app/lib/cost.server", () => ({ recordCost: vi.fn(async () => {}) }))`;
  `httpGet` faked with a lookup-then-`fetch` stand-in, and `node:dns/promises` `Resolver` faked to test private and
  rebinding hosts (`test/check-integration.test.ts` lines ~90 to 120); `test/check-http.test.ts` runs `httpGet` against
  a real local `http.createServer` with a custom `lookup`.
- DB tests: `describe.skipIf(!url)(...)` with `const url = process.env.TEST_DATABASE_URL`; they set
  `process.env.DATABASE_URL = DIRECT_URL = url` before importing `../app/db.server`. Tests that need isolation set
  `?schema=<own_schema>` on the URL and run `npx prisma migrate deploy` in `beforeAll` (`test/check-lead.test.ts`,
  schema `geo_lead_test`). Local sandbox DB used by earlier agents: Postgres 16 on localhost, database `geotest`, user
  `geo_app` (local throwaway password `local`):
  `TEST_DATABASE_URL="postgresql://geo_app:local@localhost:5432/geotest?schema=geo" npx vitest run`.
- Pure tool logic (parsers, scorers, generators, registry) belongs in non-`.server` files so tests need no DB or mocks.
- Commands (package.json):

```bash
npx vitest run                     # = npm test; baseline 11 Oct: 24 files passed, 5 skipped (DB), 341 tests passed, 88 skipped
npm run typecheck                  # react-router typegen && tsc --noEmit (writes .react-router/, gitignored)
npm run lint                       # eslint --ignore-path .gitignore --cache --cache-location ./node_modules/.cache/eslint .
npm run build                      # react-router build (writes build/, gitignored)
node design/overview/assemble.mjs  # after any home page part change
```

Production builds run `npm ci --omit=dev` then `npm run build` (Dockerfile): a new build-time package must be in
`dependencies`. Prefer no new packages.

Tests worth adding: registry/footer/sitemap agree (every tool linked from `home.html`, `SiteFooter` and
`/sitemap.xml`); `robots.txt` content and `Content-Type`; each tool page's `meta` has title, description, one
canonical on `https://usegeo.app`; no em dash (U+2014) in tool copy; tool actions refuse cross-site posts, oversized bodies and the
honeypot; SSRF cases (private IP, `localhost`, redirect to `127.0.0.1`) through the tool fetch path; the AI Overview
action never calls Treg over the cap.

---

## 7. Server headers, caching and replicas

### 7.1 Headers today

- `entry.server.tsx` calls Shopify's `addDocumentResponseHeaders`. With `AppDistribution.AppStore` (embedded) it
  only sets `Content-Security-Policy: frame-ancestors https://<shop> https://admin.shopify.com ...` and a `Link`
  preload header **when the URL has `?shop=`**. Public pages get **no CSP, no HSTS, no X-Frame-Options, no
  X-Content-Type-Options, no Referrer-Policy** from the app. (Railway's edge headers: UNVERIFIED, the sandbox proxy
  blocks usegeo.app.) Adding security headers belongs in the tool routes' `headers` or resource responses; keep any
  CSP compatible with Google Fonts and the inline `window.GEO_LIVE` script on the home page.
- Express: compression on, `x-powered-by` off, no `trust proxy`.

### 7.2 Cache-Control patterns in use

| Where | Value |
|---|---|
| `/` (home.html) | `public, max-age=300` |
| `/check/:id` (+ `.data`) | `private, no-store`, `Vary: Cookie` |
| `/check/:id/email`, `/tips` action | `no-store` |
| `build/client/assets/*` | 1 year, immutable |
| other `build/client` files | max-age 0 |
| `public/*` | max-age 1 hour |
| every other page (`/check`, `/privacy`) | none set |

No CDN seems to sit in front: Railway HTTP logs show crawler source IPs (OpenAI 74.7.x, Anthropic 216.73.216.x)
reaching the service directly. So `public, max-age=300` only helps browsers. Use it for tool GET pages,
`public, max-age=3600` for robots.txt and sitemap.xml, `no-store` for POST results.

### 7.3 Replicas and process model

- No `railway.json`/`railway.toml`. Railway service `geo-shopify-app` (project Paperflower): builder RAILPACK in the
  settings, but the build log shows the repo `Dockerfile` steps (`[8/8] RUN npm run build`), so the Dockerfile is
  used: `node:22-alpine`, `npm ci --omit=dev`, `npm run build`, `CMD npm run docker-start` (= `prisma generate &&
  prisma migrate deploy && react-router-serve ./build/server/index.js`). Pre-deploy: `sh scripts/shopify-deploy.sh`.
  Health check `/healthz`. Region `asia-southeast1-eqsg3a`, **`numReplicas: 1`**.
- The job worker runs in the same process (`RUN_WORKER` not `"false"`), started from `entry.server.tsx`.
- `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` is set, so old and new processes overlap for a while on each deploy.
- Verdict: an in-memory rate limiter or result cache is acceptable (one replica), with two caveats: it resets on every
  deploy, and limits double during the overlap. Keep money-spending limits (the AI Overview tool) backed by the DB
  `ApiCost` sum (4.3), and in-memory per-IP limits on top. Existing code already accepts "per process" limits (see
  the comments in `gate.ts` and `check.server.ts`).
- A request that waits on Treg holds an HTTP connection; `streamTimeout` (5 s) in `entry.server.tsx` only applies to
  React streaming after loaders finish, so a 30 s action is fine. Show a pending state with `useNavigation()` when JS
  runs; without JS the browser simply waits.

---

## 8. Uncommitted work and files to avoid

`git status --short` at 11 Oct 2026 06:2x UTC shows only `?? docs/tools/` (the research docs in this folder). No app
file is modified, staged or untracked; no stash; one worktree. The work under review is therefore the last commit
`4d49e5f` ("Growth features: AI crawler check, long-tail topics, ..."), pushed and deployed (Railway deployment
`5d842fdf`, 05:41 UTC). Re-run `git status` before editing.

Files changed in `4d49e5f` (treat as frozen until the reviewer is done; prefer new files that import from them):

- `app/lib/robots.ts`, `app/lib/robots.server.ts` (new in that commit)
- `app/components/check-ui.tsx`
- `app/lib/check-read.ts`, `app/lib/check.server.ts`, `app/lib/ai-ready.ts`, `app/lib/check-types.ts`,
  `app/lib/check-plan.ts`, `app/lib/check-report.ts`, `app/lib/check-pdf.server.ts`, `app/lib/treg.server.ts`,
  `app/lib/sources.ts`, `app/lib/format.ts`, `app/lib/plans.ts`, `app/lib/cited-page.server.ts`, `app/lib/clusters.ts`,
  `app/lib/countries.ts`, `app/lib/guide.ts`, `app/lib/fixes.server.ts`, `app/lib/outreach.server.ts`, and others in
  `app/lib/` (ai.server, billing.server, install.server, onboarding.server, orders.server, shop.server, usage.server,
  worker.server)
- `app/routes/app.competitors.tsx`, `app.fixes.tsx`, `app.outreach.tsx`, `app.questions._index.tsx`, `app.settings.tsx`
- `prisma/schema.prisma`, `prisma/migrations/5_growth_signals/`
- tests: `ai-ready`, `check-country`, `check-lead`, `check-pages`, `check-plan`, `cited-page`, `clusters`,
  `growth-integration`, `integration`, `outreach-integration`, `outreach-sources`, `robots`, `worldwide-copy`,
  `fixtures/check-sample.ts`

Of the files named in the task: `robots.ts`, `check-ui.tsx`, `check-read.ts` and `check.server.ts` ARE in it;
`check.css` is NOT (last changed in earlier commits), nor are `http-get.server.ts`, `public-form.server.ts`,
`root.tsx`, `entry.server.tsx`, `check-live.css`, `design/overview/*` or `app/home/home.html`.

Safe-to-add plan (all new files, plus edits only where unavoidable):

- New: `app/lib/tools/{site.ts, registry.ts, meta.ts, limits.server.ts, fetch.server.ts, aio.server.ts, crawler.ts,
  schema.ts, faq.ts, llms.ts, copy-check.ts}`, `app/components/{tool-ui.tsx, site-footer.tsx}`,
  `app/styles/tools.css`, the route files in 1.2, `public/tools/` images, `test/tools-*.test.ts`.
- Edits: `design/overview/parts/45-cta-footer.{html,css}`, `10-nav.html`, `assemble.mjs` (canonical/OG in the head
  template), then the rebuilt `app/home/home.html`; `test/home.test.ts` (add footer assertions); `app/routes/privacy.tsx`
  (mention the free tools: what is sent to the data provider, hashed IP limits); later, one line in `CheckShell`.
- Avoid: `public/robots.txt`, `public/sitemap.xml` (shadow the routes), editing `AI_BOTS` in place, a Prisma migration
  unless a tool truly needs stored results (then add retention in `retention.server.ts` and the privacy page).
