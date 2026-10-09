# CLAUDE.md — AI Visibility app for Shopify (working name: TBD)

Handoff from planning chat. Read this fully before writing code. Build in the phase order at the bottom. Ask Ross before changing scope, pricing or plan limits.

---

## 1. What we're building (one paragraph)

A self-serve Shopify app that gets ecommerce brands **recommended by AI shopping assistants** (ChatGPT, Gemini, Perplexity, Google AI Overviews). It tracks real buyer questions ("best beard oil for dry skin australia"), shows who AI recommends instead of the brand and which sites it cites, auto-generates fixes (product data, FAQs, guide pages) the merchant approves with one click, finds outreach targets (roundups/blogs that cite competitors), and — most importantly — **shows the money**: clicks, orders and revenue that came from AI.

**The #1 rule of the product:** merchants only care if it's making them money. The **AI revenue / orders / clicks** block is always the top of the dashboard.

## 2. Who it's for

- Shopify DTC brands, starting with **AU/NZ** (English, AUD), any size. Sweet spot: brands with real catalogs (beauty, grooming, skincare, supplements, apparel, home).
- Merchant is non-technical. Copy must be plain English, short, no jargon (no "GEO", "AEO", "LLM" in UI — say "AI search", "ChatGPT & co").

## 3. Pricing & plan limits (enforce in code)

Billing **must** use Shopify Billing API (`appSubscriptionCreate`), USD.

| Plan | Price | Limits |
|---|---|---|
| Free scan | $0 | One-time scan: 10 questions × 3 engines, visibility score, top competitors, AI revenue so far (last 60 days of orders). No fixes, no ongoing tracking. |
| Core | **US$49/mo**, 7-day trial | 25 questions · ChatGPT + Gemini + Perplexity + AI Overviews · weekly scans · 100 products optimised · 30 AI fixes/mo · outreach finder (10 targets/mo) · revenue dashboard · monthly email report |
| Pro | US$149/mo | 100 questions · daily scans · + Claude · 1,000 products · unlimited fixes · autopilot mode · 40 outreach targets/mo |

**Unit-cost budget:** Core must run under **US$8/store/month** all-in (data + AI writing + email). Track cost per shop in the DB and alert if exceeded.

## 4. Stack

- **App:** Shopify app scaffolded with `npm init @shopify/app@latest` (React Router template), embedded in Shopify admin, Polaris UI.
- **DB:** Supabase Postgres (via Prisma — swap the template's SQLite session storage to Postgres).
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
4. **Weekly (or daily on Pro):** scan → score → generate fixes → find outreach targets → update dashboard.
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
6. **Settings** — plan & billing, questions, competitors, autopilot toggle (Pro), email report recipients.

## 8. Treg (data gateway)

Treg exposes many providers behind one API with server-side keys. **Confirm the HTTP endpoint + auth method with Ross** (he has a Treg account; currently used via MCP/CLI). Wrap all calls in `lib/treg.ts` — one typed function per job, with retries, timeouts (AI scrapers can take 30–80s), cost logging per call, and fallback to the alternate provider.

Endpoint IDs (verified in planning, prices approx. Oct 2026):

| Job | Primary endpoint | Fallback | ~US$/call |
|---|---|---|---|
| ChatGPT answer (live web UI, sources, shopping cards) | `cloro.ai-search.chatgpt.scrape` — body `{prompt, country:"AU", include:{markdown:true, shopping:true}}` | `dataforseo.x.ai-optimization-chat-gpt-llm-scraper-live-advanced` (array body, `keyword`, `location_code`) | 0.004 |
| Gemini answer + sources | `cloro.ai-search.gemini.scrape` | `dataforseo.x.ai-optimization-gemini-llm-scraper-live-advanced` | 0.002–0.004 |
| Perplexity answer + sources | `dataforseo.x.ai-optimization-perplexity-llm-responses-live` | `cloro.ai-search.perplexity.answer` | 0.003–0.006 |
| Google AI Overview | `anyapi.google.serp.ai_overview` | `litescrape.google.serp.ai_overview` | 0.0002–0.002 |
| Claude answer (Pro only, API model not consumer app) | `dataforseo.x.ai-optimization-claude-llm-responses-live` | — | 0.025 |
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
- Approval required by default. Autopilot is opt-in (Pro) and still skips risky types (claims).
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

1. **Shell** — scaffold app, Postgres session storage, install/uninstall, GDPR webhooks, Polaris layout with nav, Shopify Billing (Free scan / Core / Pro) with trial. ✅ when it installs on the dev store and plans can be selected.
2. **Onboarding + first scan** — catalog pull, brand profile, question generation + volume, Treg wrapper, scan job (2 runs × engines), parsing, visibility score, Questions + Competitors screens. ✅ when the dev store shows a real baseline from live AI answers.
3. **Money tracking** — 60-day order backfill + attribution, `orders/create` webhook, Web Pixel, dashboard money block with baseline/growth. ✅ when a test order with `utm_source=chatgpt.com` shows up as AI revenue.
4. **Fix engine** — generation, guardrails, approval queue, push to Shopify, undo. ✅ when an approved fix updates a product and can be reverted.
5. **Outreach v1** — target finding, emails, pitch drafts. ✅ when targets + drafts appear for a real niche.
6. **Polish** — weekly cron, monthly Resend report, cost caps & alerts, post-purchase survey, Pro autopilot, App Store listing assets, "Built for Shopify" checklist.

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
5. AU/NZ only at launch, or global English?

## 17. Context

- Dev account just created. Use a **development store** (not the trial store) for testing; seed it with a realistic grooming/skincare catalog.
- Live test from planning: ChatGPT (AU) for "best beard oil for dry skin in Australia" named The Groomed Man Co, A Better, Bold & Bare, Milkman, and cited stuga.com.au's "best beard oil 2026" roundup, Chemist Warehouse, BIG W, Beard Guru. ChatGPT links include `?utm_source=chatgpt.com` — that's what attribution relies on.
- Main competitors on the App Store: AgentIQ by 40rty (catalog/agent listing optimisation, $49–799), Kedra (tracking + fixes, free plan, ~47 reviews), Mento ($29–99). Our edge: **money dashboard first + fixes that push to Shopify + outreach**, all in one.
