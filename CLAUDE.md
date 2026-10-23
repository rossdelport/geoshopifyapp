@AGENTS.md

# CLAUDE.md — AI Visibility app for Shopify (working name: TBD)

Handoff from planning chat. Read this fully before writing code. Build in the phase order at the bottom. Ask Ross before changing scope, pricing or plan limits.

## Mandatory current direction (Ross, 2026-10-14): web app first, Shopify app paused

**GEO is now a web app.** People sign up and use it on usegeo.app, not through the Shopify App Store. This overrides the "Shopify app" framing in the sections below wherever they clash.

- **Pause Shopify app work:** App Store listing, review, "Built for Shopify", Partner dashboard tasks and protected customer data requests. Don't delete the Shopify code. It keeps working and can come back as a **connection inside the web app** (push fixes to the store, read orders for AI revenue).
- **Decided with Ross (2026-10-14):** **Shopify stores only**; billing by **Stripe** (replaces Shopify Billing for the web app; same plans and prices, 7-day trial); login by **email link only** (no passwords, no Google).
- **How a web app reaches Shopify stores (checked in Shopify's docs, 2026-10-14):** connecting to many stores by OAuth needs a *public* app, and public apps need Shopify's approval (App Store review, even with limited visibility). Merchants can no longer make admin custom apps. So:
  - **Works with no approval (build first):** sign up, type the store's address, read its **public catalog** (`/products.json`, open on every Shopify store), scans, Sites AI trusts, Reddit, guides, pitches. Fixes are **copy and paste** (a copy button per field and a link to that product in their Shopify admin). AI clicks, orders and revenue come from a **custom pixel** the store pastes into Shopify admin → Settings → Customer events (page_viewed referrer + checkout_completed total), sent to our endpoint.
  - **Needs approval (later):** one-click "Connect Shopify" that pushes fixes and reads orders. Whether to keep App Store review going quietly for this is Ross's call.
- **Build order (Ross, 2026-10-14):**
  1. **The moat: "Sites AI trusts".** The sites AI cites most across all of a store's scans (lifetime), with authors enriched (Standard 4 a month, about 1 a week; Done-for-you 20 a month; Ross 2026-10-15, was 10 / 50) and a pitch drafted for each. On Done-for-you we send the pitches. Pitch limits stay **10 / 40** a month.
  2. **Reddit thread finder.** It finds threads where buyers ask about the store's kind of product. AI drafts a reply; the store owner copies it, opens the thread and posts it themselves. Every draft says who they are, e.g. "(I'm the founder of X, so I'm biased)". **Never write a reply that poses as a happy customer** (RankPill's drafts do this; it's astroturfing and against Reddit's rules). Built 2026-10-15: `/dash/reddit` (threads left, post and editable reply right, "Copy and open thread", mark replied, not relevant), `lib/reddit.server.ts` (`reddit.find` job: searches from the top buying questions, AI or word-match filter, up to 20 new threads a week with a reply each; the free plan gets one look of 10). Every reply is checked to say who's writing.
  3. **Guide calendar.** A month view, like RankPill's dashboard: one guide per slot, each with its buyer question and monthly searches, status (queued / writing / published) and an "autofill calendar" button. **Built 2026-10-16:** `/dash/guides` (month grid, phone list, Autofill), `/dash/guides/:slot` (the page as it will look, Approve / Skip / Try again, "I've added it"), `lib/guide-calendar.ts` (rules) and `lib/guide-calendar.server.ts` (`GuideSlot` table, migration 16). Web stores only. Days spread evenly (4 a month: 4th, 12th, 19th, 27th; 12 a month: three a week), never before the 3rd; the guide is written 2 days before its day (`guide.write`, through the fix engine's `writeGuide`, so the strict Q&A form, claims check and link allowlist apply) and goes live on the day from 8am store time: `guide.publish` through the Shopify connection when the store has one (`Session` row), otherwise the page shows copy-and-paste steps and the store presses "I've added it" (the Fix becomes applied with the page URL). Standard OKs each guide; Done-for-you guides are OK'd when written unless `autopilotOptOut`. Questions: AI-lost first, then volume, never the same topic two days running, never one question twice. A skipped day is deleted (its guide rejected) and re-planned. **Publishing routes for web stores (Ross to decide):** (a) restart Shopify's app review so "Connect Shopify" can publish one-click; (b) GEO-hosted guides on a subdomain of the store (one DNS record) needing no approval; until then copy and paste. **Ownership rule (review finding, 2026-10-16):** anyone can add a store to the web app by its address with no proof they own it, so a Shopify token that merely matches the domain may be the real owner's. The calendar publishes through Shopify only when `Shop.shopifyConnectedAt` is set, and nothing sets it yet: the future "Connect Shopify" flow must set it only after an OAuth started from the signed-in web session completes for that store, and the app-install upsert must never merge a stranger's web row with the owner's install.
  4. **Link opportunities.** Real pages worth a mention, never link swaps or link networks.
- **"Ask GEO" chat assistant (Ross's idea).** It answers how-to questions, which cuts support emails. It can also **do things in the app** when asked (add a buying question, run a scan, approve a fix, draft a pitch), but always shows what it will do and waits for the person to tap Confirm. Built 2026-10-15 (answers only, no actions yet): `/dash/ask`, `lib/ask.server.ts`. It answers solely from `docs/ask-geo-guide.md` (keep that file true when features change) plus the person's store facts, neutral tone, chats not saved (Ross's call), and passes bugs, billing, data requests, complaints and "talk to a person" to Ross: a `SupportFlag` row (summary only) and an email to `GEO_ALERT_EMAIL` with the chat, reply-to the customer. 40 questions an hour per person.
- **Web app look (Ross, 2026-10-15):** white base, near-black text, neutral greys, and one purple (`--accent` #5b47e0) only for things to act on (buttons, links, focus). Green, amber and red only for good / needs a look / bad. No lilac gradients or purple tints. Small, quick motion (transitions.dev scale): a loading bar, a skeleton of the next page after 140 ms, sliding tabs, instant Reddit thread switch, Copied ticks; all off with reduced motion. All in `app/styles/web.css` and `app/components/web.tsx`.
- **Web app speed (2026-10-15):** in production the server talks to the database through the session pooler (`DIRECT_URL`, at most 6 connections): 75 ms a query from Railway, against 365 ms through the transaction pooler with `pgbouncer=true` (`DB_USE_TRANSACTION_POOLER=true` switches back). Keep queries side by side (`Promise.all`), never one after another without need; the start-up log line `[speed]` shows the round trip.
- **Admin area (Ross, 2026-10-15):** `/dash/admin`, only for `GEO_ADMIN_EMAILS` (default Ross's Gmail; everyone else gets Not found). Tabs: Overview (spend, accounts, stores, waitlist, things that need a look), Usage (Treg and Claude spend per Sydney day, any date range, by store and by job), Users (plan, AI score, 5 setup steps, spend), Waitlist (with delete), Support (Ask GEO flags), System (background jobs, failures, try again). `lib/admin.server.ts`.
- **GEO blog (Ross, 2026-10-15: "practise what we preach"):** `/blog`, written by the `blog.write` job in `lib/blog.server.ts` from the topics in `lib/blog/topics.ts` (comparisons first; when the list runs out Claude proposes the next topic). Each post is written, then fact-checked by a second Claude pass against the knowledge pack only (docs/facts.md with its source links, docs/geo-research.md, the stories, the Ask GEO guide), then tidied (`finishPost`: no dashes, sources only from the pack, refused if thin or if it says a brand uses GEO) and published. Timing: the first six half an hour apart, then Monday, Wednesday and Friday from 9am Sydney, one a day. Ross gets an email per post (`GEO_ALERT_EMAIL`); Admin > Blog hides a post or writes one now. Pages: `routes/blog*.tsx`, `styles/blog.css`, pure helpers in `lib/blog/pages.ts`; in the sitemap and llms.txt. Every post says it was written with AI help and checked against the sources.
- **Guide pages for stores (2026-10-15):** 4 a month on Standard, 12 on Done-for-you (was 2 / 8), rotating through how-to-choose, comparison, use-case, buying-advice and deep-dive kinds (`GUIDE_KINDS`, `nextGuideKind` in `lib/guide.ts`; hubs are always how-to-choose). Ross chose about one a week / three a week over daily (Google's scaled-content rules).
- **Search traffic beside AI (2026-10-15):** the pixel and order code also classify visits and orders from search engines (`classifySearchVisit`, `classifySearchOrder` in `lib/attribution.ts`; `TrafficDay.searchSessions`, `OrderDay.searchOrders/searchRevenue`). The dashboard shows "Where your shoppers came from this month": AI assistants, search engines, everything else, with visits, orders, sales and share. Google AI Overviews count as Google search (can't be separated).
- **Bug hunt fixes (2026-10-16):** a store can only be added from its own address (Shopify's copy of the store's meta.json must name that address, `claimMatches`); the tracking code's orders are counted once (`PixelOrder`), need a real order id, carry a visit timestamp (visits older than 30 days don't explain an order, and the saved visits are cleared after an order), and /api/pixel allows 120 events a minute per address; a scan that read no answers writes no score and gives a free scan back; the weekly scan is timed from `Shop.lastScheduledScanAt` (a manual check never postpones it); a job that gave up is left alone for 6 hours (`ifFailedWaitMs`); a failing job record can't crash the server; Reddit drafts must name the brand in their disclosure and are dropped when they talk like a customer (`posesAsCustomer`); a Reddit run whose searches all failed doesn't count as a look; the fix and outreach jobs don't run for web stores; sign-in links are capped at 300 an hour overall; the Sites page reserves a writer lookup before paying for it and keys pitches by the cleaned URL; the web dashboard detects a stuck first scan and offers Try again.
- **New home page preview (Ross, 2026-10-19): usegeo.app/newhomepage.** A redesign in the style of a reference video Ross sent (bento cards with small looping CSS pictures on soft purple panels, glass chips, glossy tiles, big grey headings with the key words in near-black). Purple is #6c5cf2, a step lighter than #5b47e0. One file, `app/home/new-home.html` (all CSS and JS inline, no images except the story logos), served by `app/routes/newhomepage.tsx`, which fills in the story cards from stories.json (with small WebP copies of the PNG logos in `app/home/logos/`; redo them if a story logo changes) and the font URL. The font is Inter with its Display cut (`app/fonts/inter-geo.woff2`, Latin plus ₦, weights 400 to 700, about 40 KB, imported `?url` so it gets a 1-year cache). It only animates transform and opacity, pauses pictures off screen, and has a pause button for the moving pictures. The FAQ is a chat with the "GEO assistant" like the live page's (first answer open, the other questions as chips, typing dots, find in page still opens answers), restyled to match. noindex and not in the sitemap while it is a preview. It only claims what the web app does today (no monthly report or growth arrows); product page fixes are shown without a "Coming soon" badge (Ross, 2026-10-20). The numbers in "Why now" roll in like a counter, as on "/". Every button opens the same waitlist popup as "/". It has no Meta pixel or cookie notice: add both (pixel-head.js and 47-cookies) if it replaces "/".
- **Pricing direction (Ross, 2026-10-23, was US$1,000 on 2026-10-20): an agency-style offer for Australian ecommerce brands. One plan, A$1,000 a month, done for you, 5 spots, full refund if not happy after the first month (handled by hand; the work stays theirs), no lock-in contract.** Shown on the live home page "/" (all six languages) and /newhomepage with the Done-for-you (`pro`) features; the waitlist button sends plan `pro`. This overrides the "worldwide, never say AU/NZ" rule for the pricing copy. llms.txt, the free check (page, email and PDF) and the Ask GEO guide say the same (Ross, 2026-10-23: "update the price everywhere"), from `OFFER` in `app/lib/plans.ts`. The plan limits and the paused Shopify billing in `PLANS` still hold the old Standard and Done-for-you until billing is rebuilt (Stripe isn't built yet). The sample dashboard on /newhomepage says "Sales from AI" (Ross: the word ecommerce brands use).
- **Comparison pages (Ross, 2026-10-23): /compare.** Honest buying pages for people choosing an agency, tool or GEO, aimed at Australian brands. Naming other companies is OK (Ross) as long as every page says where they win and their prices carry a checked date: re-check monthly and move `checked`. Content in `app/lib/compare/pages.ts`, routes `compare*.tsx`, styles `compare.css`; in the sitemap and llms.txt. Written by hand, not by the blog job (whose never-name-a-company rule stays). Plan of 8 pages: https://claude.ai/artifact/2oLYCWTdiN9hmsuvst6xb5 (first 3 built).
- **Settings ideas from RankPill that Ross likes:** a settings menu with sections; "Offerings" (the products to promote, as cards); image style choices for guides (photo, 3D, illustration, clay, custom); and **Integrations** for publishing guides (Shopify, WordPress, Wix, Webflow, Framer, webhooks).
- **RankPill** (rankpill.com) is the closest web-app reference: Dashboard (article calendar), Articles, Backlinks (a credit-based link swap network between customers, which is a Google "link scheme"; we don't copy it), Reddit Visibility, Settings and Ask RankPill. Our edge stays: we show the money, and we target the exact sites AI cites for the store's buying questions.

---

## 1. What we're building (one paragraph)

A self-serve Shopify app that gets ecommerce brands **recommended by AI shopping assistants** (ChatGPT, Gemini, Perplexity, Google AI Overviews). It tracks real buyer questions ("best beard oil for dry skin australia"), shows who AI recommends instead of the brand and which sites it cites, auto-generates fixes (product data, FAQs, guide pages) the merchant approves with one click, finds outreach targets (roundups/blogs that cite competitors), and — most importantly — **shows the money**: clicks, orders and revenue that came from AI.

**The #1 rule of the product:** merchants only care if it's making them money. The **AI revenue / orders / clicks** block is always the top of the dashboard.

## 2. Who it's for

- Shopify DTC brands **worldwide** (English-language stores; Ross decided 2026-10-11, was AU/NZ first), any size. Never say "for AU/NZ" in user-facing copy. Sweet spot: brands with real catalogs (beauty, grooming, skincare, supplements, apparel, home).
- Merchant is non-technical. Copy must be plain English, short, no jargon (no "GEO", "AEO", "LLM" in UI; say "AI search", "ChatGPT & co").
- **Never use em dashes (—) in any copy** (site, app UI, emails, reports). Use a full stop, comma, colon or "and" instead. Ross's rule.

## 3. Pricing & plan limits (enforce in code)

Billing **must** use Shopify Billing API (`appSubscriptionCreate`), USD.

| Plan (internal id) | Price (USD) | Limits |
|---|---|---|
| Free scan (`free`) | $0 | In-app safety net for stores that install without starting a trial (not shown on the website). One-time scan: 10 questions × 3 engines, visibility score, top competitors, AI revenue so far (last 60 days of orders). No fixes, no ongoing tracking. |
| Standard (`core`) | **US$49/mo**, or **US$441/yr** (3 months free, shown as about US$37 a month), 7-day free trial | You click approve, AI does the rest. 50 questions scanned weekly (2 runs) · ChatGPT + Gemini + Perplexity + AI Overviews · unlimited one-click fixes · 500 products optimised · 4 guide pages/mo (merchant approves; Ross 2026-10-15, was 2) · 10 outreach targets/mo with drafted pitches · revenue dashboard · monthly email report |
| Done-for-you (`pro`) | **US$349/mo**, or **US$3,141/yr** (about US$262 a month), 7-day free trial | AI does it; Ross or a VA handles directory and roundup outreach by hand. 100 questions scanned daily (light daily scan: 1 run, no Claude; full 2-run scan with Claude weekly) · + Claude · fixes applied for you (autopilot on, still skips risky claim types; the store can switch it off and undo any change) · 2,000 products optimised · 12 guide pages/mo written and published for you (Ross 2026-10-15, was 8) · 40 pitches/mo sent and followed up for you (incl. directories and roundups) · monthly report + 30-minute call |

No cheaper starter plan. The website's free product check is the entry point; the website shows only the two paid plans. Shopify's built-in trial only (no paid trial). Internal ids stay `core` and `pro` so stored data keeps working. Billing plan names: "GEO Standard", "GEO Standard yearly", "GEO Done-for-you", "GEO Done-for-you yearly" (old test names "GEO Core" / "GEO Pro" still map). All limits live in `app/lib/plans.ts`.

**Unit-cost budget:** Standard must run under about **US$15/store/month** in data and AI costs; Done-for-you under about **US$150/store/month** (plus human time). Track cost per shop in the DB and alert if exceeded.

## 4. Stack

- **App:** Shopify app scaffolded with `npm init @shopify/app@latest` (React Router template), embedded in Shopify admin, Polaris UI.
- **DB:** Supabase Postgres via Prisma. Lives in the existing **OneInbox** Supabase project (to avoid a paid extra project) but ONLY in the `geo` schema, using the `geo_app` login, which cannot see or change anything else. Never create or change anything outside the `geo` schema. Connection settings: `.env.example`.
- **Hosting:** Vercel (or Fly/Render if long-running jobs need it). Jobs must be resumable and idempotent.
- **Scheduled jobs:** Vercel Cron or Supabase `pg_cron` → hits internal job endpoints → work goes into a `jobs` table queue and is processed in small batches.
- **External data:** **Treg** (single API gateway for all AI-answer scraping, keyword data, Reddit, email finding). See §8.
- **AI writing:** Claude API (Anthropic SDK). Use a fast model for classification/extraction, a stronger model for merchant-facing copy.
- **Email:** Resend (reports, notifications).
- **Shopify docs:** use the Shopify Dev MCP (`@shopify/dev-mcp`) to validate every GraphQL query/mutation before using it.

## 5. Shopify setup

**Access scopes (start with these, trim if unused):**
`read_products, write_products, read_orders, write_content, write_pixels, read_customer_events`

- `write_products` → titles, descriptions, metafields, SEO fields, product FAQs (metafields).
- `write_content` → create Online Store pages/blog posts ("best X for Y" guides).
- `write_pixels` + `read_customer_events` → Web Pixel extension for AI click tracking.
- Orders: we need `customerJourneySummary` (first/last visit source, referrer, landing page, UTM). **Check Protected Customer Data requirements** for this field and request access in the Partner dashboard early — it can block launch.

**Required webhooks:** `app/uninstalled`, `orders/create`, `app_subscriptions/update`, and the mandatory GDPR webhooks (`customers/data_request`, `customers/redact`, `shop/redact`).

**App extensions:** 1) Web Pixel (AI click tracking). 2) Later: post-purchase/thank-you "How did you find us?" survey (Checkout UI extension).

## 6. Merchant flow

1. **Install** → OAuth → land on onboarding.
2. **Onboarding (target < 5 min, mostly automatic):**
   - Pull shop info + catalog (title, type, vendor, tags, description, price, images, metafields).
   - Claude reads catalog + homepage → writes a short **brand profile** (what they sell, who for, price point, country).
   - Claude proposes **30 buyer questions** (natural-language, how people actually ask AI, include country e.g. "in Australia"). Score each with keyword volume (Treg). Merchant ticks the ones to track (default top 25).
   - Auto-detect **competitors** from the first scan (brands named in answers); merchant can edit.
3. **Baseline scan** runs immediately → "Here's where you stand today". Store as baseline (needed for "growth since joining").
4. **Weekly (or daily on Done-for-you):** scan → score → generate fixes → find outreach targets → update dashboard.
5. **Monthly:** email report via Resend.

## 7. Screens (Polaris, embedded)

1. **Dashboard** (home)
   - **Top block — Money from AI (this month / since joining):** AI revenue, AI orders, AI clicks, % change vs baseline. Split by source (ChatGPT / Gemini / Perplexity / Other). Top products bought via AI. "Revenue from pages we built".
   - Visibility score (0–100) + trend line.
   - "Do this next" — top 3 fixes waiting for approval.
2. **Questions** — each tracked question: are you named? position? which competitors? which engines? cited sources. Click → see the actual AI answers.
3. **Competitors & Sources** — who wins most often; which sites AI cites (roundups, retailers, Reddit, blogs) and whether you're on them.
4. **Fixes** — queue of suggested changes with before/after preview. Approve / edit / reject. Approve = push to Shopify. Log every change with one-click undo (store previous values).
5. **Outreach** — list of targets (article URL, site, who's named, author, email if found), AI-drafted pitch, status. v1: copy pitch / open mailto. v2: send from merchant's connected Gmail with follow-ups.
6. **Settings**: plan & billing, questions, competitors, autopilot toggle (Done-for-you), email report recipients.

## 8. Treg (data gateway)

Treg exposes many providers behind one API with server-side keys. **Confirm the HTTP endpoint + auth method with Ross** (he has a Treg account; currently used via MCP/CLI). Wrap all calls in `lib/treg.ts` — one typed function per job, with retries, timeouts (AI scrapers can take 30–80s), cost logging per call, and fallback to the alternate provider.

Endpoint IDs (verified in planning, prices approx. Oct 2026):

| Job | Primary endpoint | Fallback | ~US$/call |
|---|---|---|---|
| ChatGPT answer (live web UI, sources, shopping cards) | `cloro.ai-search.chatgpt.scrape` — body `{prompt, country:"AU", include:{markdown:true, shopping:true}}` | `dataforseo.x.ai-optimization-chat-gpt-llm-scraper-live-advanced` (array body, `keyword`, `location_code`) | 0.004 |
| Gemini answer + sources | `cloro.ai-search.gemini.scrape` | `dataforseo.x.ai-optimization-gemini-llm-scraper-live-advanced` | 0.002–0.004 |
| Perplexity answer + sources | `dataforseo.x.ai-optimization-perplexity-llm-responses-live` | `cloro.ai-search.perplexity.answer` | 0.003–0.006 |
| Google AI Overview | `anyapi.google.serp.ai_overview` | `litescrape.google.serp.ai_overview` | 0.0002–0.002 |
| Claude answer (Done-for-you only, API model not consumer app) | `dataforseo.x.ai-optimization-claude-llm-responses-live` | none | 0.025 |
| Keyword volume | `dataforseo.google.keywords.volume` | — | ~0.09 per batch of up to 1,000 |
| Keyword/question ideas | `dataforseo.google.keywords.ideas` | — | small |
| Reddit search in a subreddit | `scrapecreators.x.v1-reddit-subreddit-search` | — | ~0.002 |
| Reddit post comments | `anyapi.reddit.post_comments` (body `{url}`) | `brightdata.x.reddit-comments` | ~0.0015 |
| Article author email | `tomba.people.email.find.author` | `treg.people.email.find` (routed) | ~0.005–0.009 |

DataForSEO location code for Australia: `2036` (verify). Language `en`.

**Scan rules:** run each question **2× per engine per scan** and store both (answers vary run to run). Report averages, never single runs.

## 9. Parsing AI answers

For each answer store raw markdown + sources. Then extract (Claude, cheap model, JSON output):
- brands mentioned (ordered), products mentioned, whether merchant's brand/products appear + position,
- cited URLs/domains + type (retailer, editorial/roundup, Reddit/UGC, brand site, marketplace),
- shopping cards / inline products if present.

Match merchant brand via brand name + domain + product titles (fuzzy). Store competitor brands normalised.

**Visibility score (0–100):** weighted share of (question × engine × run) where merchant is mentioned, with a bonus for top-3 position. Keep formula in one function; document it in the UI tooltip.

## 10. AI revenue attribution (the most important feature)

**Sources of truth, in priority order:**
1. Orders with our own UTM (`utm_source=<appname>`) on links we create (guide pages, outreach placements) → "from pages we built" (100% ours).
2. Orders whose `customerJourneySummary` (first or last visit) has:
   - `utm_source=chatgpt.com` (ChatGPT adds this to links), or
   - referrer domain in: `chatgpt.com, chat.openai.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, bing.com/chat, claude.ai, meta.ai, you.com` (keep list in config).
3. Orders from Shopify **Agentic Storefronts** / AI sales channels (check order `channelInformation` / source fields) → tag by agent.
4. Post-purchase survey answer = "ChatGPT / AI assistant" (phase 6).

**Clicks:** Web Pixel extension sends `page_viewed` events with `document.referrer` + landing URL params to our endpoint; store only sessions where source is AI (plus counts of total sessions for context). Respect consent APIs; no PII.

**Honesty rules (show in UI):** Google AI Overviews / AI Mode can't be cleanly separated from normal Google — label it. Always show **baseline** (first 30 days or backfilled 60 days of orders at install) and **growth since joining**, not just totals. Never claim all AI revenue was caused by the app.

Backfill last 60 days of orders on install so the free scan can already show "AI revenue so far".

## 11. Fix engine

Inputs: catalog, brand profile, winning answers, cited sources, competitor products.
Outputs (one row per suggestion, with `type`, `target`, `before`, `after`, `reason`, `expected impact`):
- Product title / description rewrites (clear "who it's for", key attributes, sizes, ingredients/materials, use cases, AU availability).
- Product FAQ blocks (metafield + theme app block or description section).
- Product metafields / taxonomy / product type cleanup (agents read structured catalog data — this is the highest-leverage fix).
- SEO title/meta.
- New Online Store pages: "Best X for Y in Australia" guides, comparisons — with our UTM on internal product links.
- llms.txt / structured data checks (low priority; label as hygiene).

**Guardrails (non-negotiable):**
- Approval required by default (Standard). Done-for-you turns autopilot on (the store can switch it off), and autopilot still skips risky types (claims).
- Never invent facts (ingredients, certifications, awards, reviews, stats). Only rephrase what's in the catalog/site; flag missing info as a question for the merchant.
- Health/skin/supplement products: no therapeutic or medical claims (AU TGA rules) — run a claims check prompt before showing a fix.
- Never generate fake reviews, fake Reddit posts or astroturf content. Outreach must be honest pitches from the merchant.
- Store previous values for every change; one-click undo.

## 12. Outreach engine

- From cited sources across scans, find editorial/roundup pages that name competitors but not the merchant.
- Get author email (Treg), draft a short personal pitch (Claude) referencing the article and why the product fits; include our UTM link.
- v1: merchant copies/sends. v2: connect merchant's Gmail (OAuth) and send + 2 follow-ups; replies stay in their inbox.
- Respect plan limits; dedupe targets across shops in the same niche? **No** — never reuse one merchant's targets/data for another.

## 13. Data model (starting point — refine)

`shops` (domain, plan, status, installed_at, baseline_date, cost_this_month) · `subscriptions` · `brand_profiles` · `products_cache` · `questions` (text, volume, active) · `competitors` · `scans` (shop, started_at, status, cost) · `ai_answers` (scan, question, engine, run_no, markdown, raw_json, cost) · `mentions` (answer, brand, product, position, is_merchant) · `citations` (answer, url, domain, type) · `visibility_snapshots` (shop, date, score, by_engine json) · `fixes` (type, target_gid, before, after, reason, status, applied_at, reverted_at) · `outreach_targets` · `outreach_messages` · `ai_sessions` (from pixel) · `ai_orders` (order_gid, source, engine, revenue, currency, attribution_reason) · `jobs` (type, shop, payload, status, attempts, run_after) · `api_costs` (shop, provider, endpoint, usd).

Multi-tenant: every row scoped by `shop_id`; enable Supabase RLS or enforce in the data layer.

## 14. Build phases (do in order; each phase ends shippable)

1. **Shell**: scaffold app, Postgres session storage, install/uninstall, GDPR webhooks, Polaris layout with nav, Shopify Billing (Free scan / Standard / Done-for-you) with trial. ✅ when it installs on the dev store and plans can be selected.
2. **Onboarding + first scan** — catalog pull, brand profile, question generation + volume, Treg wrapper, scan job (2 runs × engines), parsing, visibility score, Questions + Competitors screens. ✅ when the dev store shows a real baseline from live AI answers.
3. **Money tracking** — 60-day order backfill + attribution, `orders/create` webhook, Web Pixel, dashboard money block with baseline/growth. ✅ when a test order with `utm_source=chatgpt.com` shows up as AI revenue.
4. **Fix engine** — generation, guardrails, approval queue, push to Shopify, undo. ✅ when an approved fix updates a product and can be reverted.
5. **Outreach v1** — target finding, emails, pitch drafts. ✅ when targets + drafts appear for a real niche.
6. **Polish**: weekly cron, monthly Resend report, cost caps & alerts, post-purchase survey, Done-for-you autopilot, App Store listing assets, "Built for Shopify" checklist.

## 15. Quality bar

- Plain-English UI copy. Every number has a one-line "what this means".
- Fast first value: free scan result visible within ~2 minutes (show progress; scans are slow — run engines in parallel).
- All long jobs async with progress states; nothing blocks the UI.
- Log Treg + Claude cost per shop; never exceed plan budget silently.
- Tests for: attribution classifier, visibility score, plan-limit enforcement, fix apply/undo.

## 16. Open questions for Ross

1. App name + brand.
2. Treg HTTP API endpoint/auth (vs CLI/MCP only).
3. Hosting choice for long jobs (Vercel cron + queue vs a worker on Fly/Render).
4. Outreach v1: copy/mailto only, or Gmail sending from day one?
5. ~~AU/NZ only at launch, or global English?~~ Decided 2026-10-11: worldwide.

## 17. Context

- Dev account just created. Use a **development store** (not the trial store) for testing; seed it with a realistic grooming/skincare catalog.
- Live test from planning: ChatGPT (AU) for "best beard oil for dry skin in Australia" named The Groomed Man Co, A Better, Bold & Bare, Milkman, and cited stuga.com.au's "best beard oil 2026" roundup, Chemist Warehouse, BIG W, Beard Guru. ChatGPT links include `?utm_source=chatgpt.com` — that's what attribution relies on.
- **Research notes:** `docs/geo-research.md` keeps the main teachings from GEO videos and articles Ross shares (Hostinger, Ahrefs), plus how we apply them. Read it before building growth features.
- Main competitors on the App Store: AgentIQ by 40rty (catalog/agent listing optimisation, $49–799), Kedra (tracking + fixes, free plan, ~47 reviews), Mento ($29–99). Our edge: **money dashboard first + fixes that push to Shopify + outreach**, all in one.

## 18. Build status (updated by Claude, 2026-10-09)

All 6 phases are built in code. See README.md for the map of files.

**Live:** Railway service `geo-shopify-app` in the **Paperflower** Railway project (Singapore),
https://geo-shopify-app-production.up.railway.app, auto-deploys from branch `claude/peaceful-cerf-xtpto5`.
Keys are Railway references to the Paperflower `api` service (`${{api.TREG_API_KEY}}`, etc.).
DB = Supabase OneInbox project, `geo` schema, login `geo_app` (password only in Railway + Ross's password manager).

**Verified live (self-test, 2026-10-09):** Treg answers from ChatGPT (cloro), Gemini (cloro),
Perplexity (DataForSEO) and Google AI Overviews (litescrape) all work from Railway; 24/24 answers,
~US$0.003 per answer; job queue, scoring, competitors and outreach target finding work against Supabase.

**Blocked / waiting on Ross:**
1. Anthropic key borrowed from Paperflower has no credit ("credit balance is too low"). Claude parts
   (brand profile, questions, answer reading, fixes, claims check, pitches) fall back or retry until topped up.
2. `SHOPIFY_API_SECRET` not set on Railway (logins/webhooks disabled until it is).
3. `shopify.app.toml` now points at the Railway URL, but Shopify only learns it when Ross runs
   `npm run deploy` (pushes app URL, webhooks, the web pixel and the FAQ theme block). Needs a Partner login.
4. Protected customer data access (Partner dashboard) for orders + `customerJourneySummary`.

**Decisions made while building (change if needed):** Railway (not Vercel) because jobs are long-running;
Done-for-you (`pro`) "daily" scans are light (1 run, no Claude) with a full scan weekly, to keep costs under the price;
outreach v1 = copy / open in email; monthly reports send from Paperflower's Resend sender until GEO has its own domain.

**Pricing changed again 2026-10-13 by Ross:** Standard is now US$49/mo (US$441/yr) and Done-for-you US$349/mo (US$3,141/yr), still 3 months free on yearly and a 7-day free trial. Ross's reasoning: Standard costs about US$5 a store a month to run and Done-for-you about US$35. Limits and cost caps are unchanged. Older notes below still say US$97 / US$497.

**Pricing changed 2026-10-10 by Ross:** Core US$49 and Pro US$149 are replaced by Standard (`core`, US$97/mo or US$873/yr) and Done-for-you (`pro`, US$497/mo or US$4,473/yr), both with a 7-day free trial; see §3 and `app/lib/plans.ts`. Built: four Shopify billing plans (monthly + yearly, replace the old subscription immediately), Monthly / Yearly switch on the Plans page, monthly guide page allowance (2 / 8), outreach up to 10 / 40, cost caps US$15 / US$150 (every scan a paid store starts checks the cap, including "check AI now" and the scan after an upgrade), 110 questions written at onboarding so upgrades reach 50 / 100 (a `questions.topup` job writes more for older stores). One free trial per store: `Shop.trialEndsAt` is saved when it starts, and any later subscription (switch, cancel and come back, reinstall) only gets the whole days left. Done-for-you turns autopilot on unless the store switched it off (`autopilotOptOut`, see §11). Autopilot applies every fix type after an always-on claims check; anything the check softened or that needs facts from the store waits for the store. A store starting or leaving Done-for-you (including by uninstalling) queues a `founder.notice` job that emails `GEO_ALERT_EMAIL` with the trial end date; hand outreach and the call start after the first charge. If email isn't set up the job fails and stays in the jobs table. Website pricing buttons go to `/auth/login?plan=..&cycle=..`; the choice is saved by shop domain (`PlanIntent`) and offered on the dashboard after the free scan.

**Launch checklist (Railway variables):** `SHOPIFY_BILLING_TEST=false` (otherwise every subscription is a test charge and nobody is billed; the server logs a warning at start-up). Safe to set before App Store review: Shopify development stores (`Shop.devStore`, from `shop.plan.partnerDevelopment`, asked on every plans page load by `testChargesFor`) always get test charges, so reviewers and the owner's dev store use the app free while real stores pay. `GEO_ALERT_EMAIL` set to Ross's or the VA's inbox (set to Ross's Gmail on 2026-10-13 at his request; it gets an email for every new waitlist signup, every new or returning store (`install.notice`, not re-logins) and every Done-for-you start or stop), `RESEND_API_KEY` and `GEO_EMAIL_FROM`.

**Meta pixel (13 Oct 2026):** GEO's own Meta pixel (28710910728563304) is on the live home page only (`design/overview/pixel-head.js`, added to the head by `assemble.mjs`), for Ross's waitlist ads. PageView on load, Lead when someone joins the waitlist (no name or email sent). Europe and the UK (by browser time zone) wait for OK on the cookie notice (`parts/47-cookies.*`); elsewhere it runs unless the visitor says No thanks. Explained on `/privacy#cookies`.

**For Ross to decide:** yearly plans replace immediately (a yearly to monthly switch or a downgrade ends the year straight away, with Shopify crediting unused time). Shopify's `STANDARD` replacement would keep the year until it ends; say if you want that.
