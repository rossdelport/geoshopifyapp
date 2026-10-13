# Home page video: what a member gets, and when results can show

Research for the new home page video (replaces "Watch a free check"). Written 11 October 2026.
Product facts are checked against the code on this date; outside facts were read on this date unless another
date is given. It feeds the video's scenes and captions; it is not copy for the page by itself.

Evidence labels (same as `docs/tools/research/geo-2026.md`):
- **[Code]** what the app really does, with the file and line.
- **[Primary]** the company's own docs or research, read directly.
- **[Study]** a dated data study (correlation unless it says otherwise).
- **[Secondary]** a write-up of someone else's data, or a vendor page. Check the original before quoting.
- **UNVERIFIED** could not be confirmed.

House rules apply to every caption: plain English, no em dashes or spaced en dashes, no "GEO/AEO/LLM" as a
method, every sample number tagged "Example", no promised rankings, sales or dates.

---

## 0. The honest story in six lines

1. **Minutes after install** GEO reads the products and writes the questions shoppers ask AI. [Code]
2. **Day one** shows where the store stands in ChatGPT, Gemini, Perplexity and Google AI Overviews, who AI
   names instead, which sites it trusts, and AI sales from the last 60 days. [Code]
3. **Fixes go live on the store the moment they are approved**, and undo takes one click. [Code]
4. **Every week** (daily on Done-for-you) GEO asks AI again and shows what changed. [Code]
5. **Every month** brings new guide pages, a list of sites to pitch with emails drafted (sent and followed up
   on Done-for-you), and an email report. [Code]
6. **AI answers catch up on their own schedule: weeks to months, never guaranteed.** Google says crawling takes
   "a few days to a few weeks" and some changes "could take several months"; nobody publishes a time for
   ChatGPT or Perplexity to start recommending a store. [Primary]

What is certain is everything on our side (the scans, the fixes going live, the reports, the counting). What
varies is when AI re-reads the pages, whether it then names the store, and whether other sites mention it.

---

## 1. The member journey, from the code

### 1.1 Step by step

| # | What the member sees | When and how long | Proof |
|---|---|---|---|
| 1 | **Install.** OAuth, the shop is saved, AI click tracking (Web Pixel) is switched on. | At install. Visits are counted from this moment on (no backfill for visits). | `app/lib/install.server.ts:51-55` (`onInstalled` calls `ensurePixel`); `extensions/ai-pixel/src/index.js` (one event per visit, referrer + landing URL, no personal data) |
| 2 | **Welcome screen:** "Does ChatGPT recommend your store?" and a "Start my free scan" button. | One click. The screen itself says "Takes about 2 minutes" (not measured; see 1.3). | `app/routes/app._index.tsx:120-141`, `:136`; action `intent === "start"` enqueues `onboard` (`:78-81`) |
| 3 | **Reading your products.** Up to 250 products (title, type, vendor, tags, description, SEO fields, price, image). | Automatic, first step of the `onboard` job. | `app/lib/onboard-job.server.ts:19`; `app/lib/onboarding.server.ts` `syncCatalog` |
| 4 | **Brand profile.** Claude reads the catalogue and the home page (title, meta description, headings) and writes what they sell, who for, price point, country. Only store data, no invented claims. | Automatic, same job. Falls back to a simple profile if Claude is down. | `onboarding.server.ts` `buildBrandProfile`, `readHomepage`; `onboard-job.server.ts:20` |
| 5 | **The questions shoppers ask AI.** 110 questions written once (`QUESTION_POOL`), each with a short Google keyword, a **topic** (at most 8 topics) and a "specific" flag (about 40% asked for, about 35% of tracked slots kept for them), then scored with search volume. The best are switched on: 10 on the free scan, 50 Standard, 100 Done-for-you. | Automatic, same job. The store can switch questions on or off, add, delete or rewrite them later on the Questions screen. There is **no "tick your questions" step before the first scan** in the code. | `onboarding.server.ts:235` (`QUESTION_POOL`), `:242-247`, `generateQuestions`; `app/lib/clusters.ts:7` (`MAX_CLUSTERS = 8`), `:9` (`LONG_TAIL_SHARE = 0.35`); `app/routes/app.questions._index.tsx:73-97` (toggle, add, delete, regenerate) |
| 6 | **The starting point scan.** Every tracked question asked on each AI, twice, answers read in parallel (10 at a time). Free scan: 10 questions x ChatGPT, Gemini, Perplexity x 2 = 60 answers. Standard: 50 x 4 AIs (adds Google AI Overviews) x 2 = 400. Done-for-you: 100 x 5 (adds Claude) x 2 = 1,000. A progress bar shows "X of Y AI answers read". | Starts straight after the questions. On a paid plan the full scan runs the day the plan starts (after the free scan when the store came from the website, see 1.2). | `onboard-job.server.ts:28`; `app/lib/scan.server.ts:14` (`CONCURRENCY = 10`), `startScan`; `app/lib/plans.ts` (`questions`, `engines`, `runsPerScan`); `app._index.tsx:163-186` (progress) |
| 7 | **Where you stand:** visibility score out of 100 (full points when named in the top 3, two thirds lower down, one third when only linked), score per AI, "Named in X% of answers". | When the scan finishes. Saved as the starting point (`baselineDate`). | `app/lib/score.ts` (`visibilityScore`, `SCORE_EXPLAINER`); `scan.server.ts:188` |
| 8 | **Who AI recommends instead** (brands named in place of the store, up to 15 saved) and **Where AI gets its answers** (cited sites, by type). Click a question to read the real AI answers. | Same moment. | `scan.server.ts:192-207`; `app/routes/app.competitors.tsx:182`, `:245`; `app/routes/app.questions.$id.tsx` |
| 9 | **AI sales so far:** the last 60 days of orders are checked for ones that came from AI, so there is a starting point on day one. | Runs alongside the first scan ("While this runs we're also checking your last 60 days of orders"). Needs Shopify's protected customer data approval for `customerJourneySummary`; without it only channel data is read (CLAUDE.md section 18, blocked item 4). | `onboard-job.server.ts:27`; `app/lib/orders.server.ts:86` (`days = 60`), `:74-83` (fallback); `app._index.tsx:188-191` |
| 10 | **First fixes** ready to approve: clearer descriptions and titles, product FAQs, product type, search title and description, and buying guide pages. Up to 6 written per round, at most 10 waiting. Never invented facts; a claims check softens health wording. | Written after every finished scan, so the first batch arrives on day one after the full scan. The store can ask for more at most every 3 hours. | `scan.server.ts:210`; `app/lib/fixes.server.ts:207-297` (`generateFixes`, `:220-221` caps); `app/lib/fix-labels.ts`; `app/routes/app.fixes.tsx:66` |
| 11 | **Approve: live on your store.** The change is pushed to Shopify in the same request; the app says "Live in your store" (guides: "Page published to your store"). **Undo** puts the old values back: "Undone. Your store is back how it was." | Seconds after the click. | `fixes.server.ts:703` (`applyFix`), `:723` (guides published straight away), `:887` (`revertFix`); `app.fixes.tsx:84-90` |
| 12 | **Done-for-you autopilot:** fixes go live for the store after an always-on claims check; any that need facts from the store, or wording the check softened, wait. The store can switch autopilot off and undo anything. | After every round of fixes. | `fixes.server.ts:969` (`clearForAutopilot`), `:987` (`fixes.autopilot`); `app/lib/billing.server.ts:67`; `app.fixes.tsx:117`, `:503` |
| 13 | **Guide pages each month:** Standard 2 (the store approves each), Done-for-you 8 (written and published for you, paced through the month). Each guide belongs to a topic: an overview first, then specific guides that link to it. Links to the store's products carry GEO's own tracking tag. | Allowance per calendar month (UTC). | `plans.ts` (`guidePagesPerMonth` 2 / 8); `app/lib/limits.ts` (`guidePageDue`); `fixes.server.ts:177-183` (`trackedProductUrl`); `app/lib/guide.ts:219-260` (hub and spoke links) |
| 14 | **Kept fresh:** live guides and product FAQs are looked at again after 90 days (Standard) or 60 (Done-for-you) and updated only when facts or questions changed; guides then show "Updated <Month Year>". | Checked daily by the worker; at most 1 refresh a day on Standard, 3 on Done-for-you. | `fixes.server.ts:1001-1014`; `app/lib/worker.server.ts:98`; `guide.ts:264-270` |
| 15 | **Every week, or every day:** a new scan, a new score on the trend line, new fixes and new outreach targets. Standard: full scan weekly. Done-for-you: a light scan daily (1 run, no Claude) and the full 2-run scan with Claude weekly. Plus one extra "Check AI now" (light) every 7 days on Standard, every 3 on Done-for-you. | Scheduled by the worker. Never past the monthly cost cap (Standard US$15, Done-for-you US$150). | `worker.server.ts:101-121`; `plans.ts` (`scanEveryDays`, `manualCheckEveryDays`, `scanSettings`, `costCapUsd`); `app/lib/limits.ts` (`canRunScan`, `canRunManualCheck`) |
| 16 | **Can AI read your store?** robots.txt is checked weekly for the bots ChatGPT, Google, Perplexity and the rest use, with a plain fix. GEO can't edit the theme, so the store makes the change. | Weekly (next day if the file couldn't be read). | `app/lib/robots.server.ts` (`CRAWLER_CHECK_DAYS = 7`); `worker.server.ts:96`; `app.fixes.tsx:293-303` |
| 17 | **Sites to pitch:** pages AI cites that name rivals but not the store. Articles and roundups get a drafted email (author email looked up for up to 3 a run); videos get a review request; forum threads get "join in as yourself" guidance, never a drafted post; directories and review sites get a listing to-do (claim the profile, never write reviews). Standard: up to 10 a month, the store sends them (copy or open in email). Done-for-you: up to 40 a month, **our team sends and follows up, starting after the trial**. | After each scan, up to 10 new targets a run, until the month's allowance is used. | `app/lib/outreach.server.ts:1-9`, `:40-41`; `scan.server.ts:211`; `plans.ts` (`outreachPerMonth`, "Hand outreach and your call start after the trial"); `app/routes/app.outreach.tsx:251-315`, `:482-483` |
| 18 | **The money:** "Money from AI" is always first: AI sales this month and since joining, AI orders, AI visits, share of all sales, split by assistant, recent AI orders with "why we think so", sales from pages we built. New orders are checked as they come in (orders/create webhook). | From day one (60-day backfill). **"% vs before" appears only after 14 days**: it compares sales per 30 days since joining with the 60 days before install. | `app/lib/dashboard.server.ts:23-80` (`:26` baseline = 60 days before install, `:55` 14-day rule); `orders.server.ts:134`; `app/lib/attribution.ts` (referrer list, ChatGPT's `utm_source`); `app._index.tsx:228-327` |
| 19 | **Monthly email report:** AI sales, orders and visits, where they came from, the visibility score and change since joining, fixes waiting. Done-for-you adds a 30-minute call (after the trial). | Sent in the first 3 days of each month, to stores installed before that month began. So the first one lands at the start of the next calendar month (1 to about 31 days after joining). | `app/lib/report.server.ts`; `worker.server.ts:124-132`; `plans.ts` (`monthlyReport`, Done-for-you features) |

### 1.2 The real first-day path for someone who signs up on the website

1. Clicks "Start 7-day free trial" on usegeo.app, which goes to `/auth/login?plan=..&cycle=..`; the choice is saved by
   shop domain (`PlanIntent`). (CLAUDE.md section 18; `app/lib/plan-intent.server.ts`)
2. Installs, lands on the welcome screen, clicks "Start my free scan": products, profile, questions, the free scan
   (60 answers) and the 60-day order check run.
3. When the free scan is done, a banner says "You picked Standard on our website" with "Start 7-day free trial".
   (`app._index.tsx:211-223`)
4. Starting the trial switches on 50 (or 100) questions and runs the full scan straight away (400 or 1,000
   answers), then fixes and outreach targets follow; Done-for-you also starts autopilot.
   (`billing.server.ts:71-118`, `startUpgradeScan` at `:122`)

So "day one" is honest for: the starting point, competitors, cited sites, AI sales from the last 60 days and the
first fixes. Hand outreach and the call on Done-for-you start after the 7-day trial.

### 1.3 How long things take (what the code and docs say, and what they don't)

- **Onboarding target:** "target < 5 min, mostly automatic" (CLAUDE.md section 6). The site FAQ says "About five
  minutes" (`docs/copy-deck.md` section 11). The welcome screen says "Takes about 2 minutes"
  (`app._index.tsx:136`); CLAUDE.md section 15 asks for the free scan result "within about 2 minutes".
- **No measured duration is stored anywhere.** The free product check on the website (18 answers) tells
  visitors "usually 3 to 6 min" (`docs/free-check.md`). Answers are read 10 at a time (`scan.server.ts:14`) and an
  AI answer can take 30 to 80 seconds (CLAUDE.md section 8), so the 400-answer Standard scan very likely takes
  longer than the free scan: a rough estimate from those numbers is tens of minutes, not 2 minutes (UNVERIFIED,
  not measured). The video should say "day one", not "2 minutes", for the full starting point.
- **Fixes:** live within seconds of approval (synchronous Shopify call in the approve action).
- **Recurring:** weekly or daily scans, daily refresh check, weekly robots.txt check, monthly report (first 3 days of
  the month), monthly allowances reset on the 1st (UTC).

### 1.4 Plan differences the video must not blur

| | Standard (US$49/mo) | Done-for-you (US$349/mo) |
|---|---|---|
| Who does the work | You approve each fix and guide | Fixes and guides go live for you (ones needing your input wait); switch off or undo any time |
| Questions, how often | 50, checked every week | 100, checked every day (light daily, full weekly) |
| AIs | ChatGPT, Gemini, Perplexity, Google AI Overviews | the same plus Claude |
| Guide pages a month | 2, you approve | 8, written and published for you |
| Outreach a month | up to 10, drafted, you send | up to 40, sent and followed up by our team, after the trial |
| Extras | monthly email report | monthly report and a 30-minute call, after the trial |

Source: `app/lib/plans.ts` (`PLANS.core`, `PLANS.pro`), `docs/copy-deck.md` section 10.

---

## 2. How fast can AI answers reflect changes to a store? (research, October 2026)

Short answer: **nobody publishes a time for an AI assistant to start recommending a store after its pages change.**
The platforms publish times only for small technical things (robots.txt rules, a Search Console switch). For
re-reading pages they say "days to weeks", and for seeing an effect "hours to several months". Being re-read is
also not the same as being recommended.

### 2.1 Access rules: about a day (the only firm numbers)

These cover robots.txt and similar switches only. They do not mean a store will be shown or recommended.

| Platform | What it says | Source |
|---|---|---|
| OpenAI (ChatGPT search) | "For search results, please note it can take ~24 hours from a site's robots.txt update for our systems to adjust." | [Primary] https://developers.openai.com/api/docs/bots (read 11 Oct 2026) |
| Perplexity | "Each setting works independently, and it may take up to 24 hours for our systems to reflect changes." | [Primary] https://docs.perplexity.ai/guides/bots (read 11 Oct 2026) |
| Google AI Overviews and AI Mode | The Search Console "Search generative AI" control: changes take effect in about 1 to 2 days (worldwide since 31 Aug 2026). | [Primary] https://support.google.com/webmasters/answer/16908024, via `docs/tools/research/facts-2026.md` section 6.3 |
| DuckDuckGo (DuckAssist) | Opt-out takes effect "after 72 hours". | [Primary] via `facts-2026.md` section 1 |
| Amazon (Amazonbot) | robots.txt changes "may take ~24 hours". | [Primary] via `facts-2026.md` section 1 |

Use in the video: only if a scene shows the weekly "Can AI read your store?" check. Safe line: "Fixed a block? AI
companies say it can take about a day to notice." Never "AI will see your store tomorrow".

### 2.2 Re-reading pages: days to weeks, on each AI's own schedule

- **Google (AI Overviews, AI Mode and the Gemini app use Google's index):** "Crawling can take anywhere from a few
  days to a few weeks." "Requesting a crawl does not guarantee that inclusion in search results will happen instantly
  or even at all. Our systems prioritize the fast inclusion of high quality, useful content." [Primary] Ask Google to
  recrawl your URLs, last updated 10 Dec 2025,
  https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- **Google, on AI features:** "To be eligible to be shown as a supporting link in AI Overviews or AI Mode, a page must
  be indexed and eligible to be shown in Google Search with a snippet." "There are no additional requirements to appear
  in AI Overviews or AI Mode." "Indexing and serving isn't guaranteed." [Primary] AI features and your website, last
  updated 10 Dec 2025, https://developers.google.com/search/docs/appearance/ai-features
- **Bing (Microsoft Copilot answers from Bing's index; Microsoft is also one of ChatGPT search's providers):** the
  IndexNow FAQ says crawler discovery "can be slow, taking days or even weeks", and "Submitting a URL does not
  guarantee immediate indexing." [Primary] https://www.indexnow.org/faq (read 11 Oct 2026). Bing (Feb 2026): IndexNow
  "helps ensure that AI systems reference the most current version of a page when generating answers." [Primary]
  https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
  - GEO does **not** send IndexNow pings for store pages today (no `indexnow` anywhere in `app/`), and Shopify's
    help pages don't mention IndexNow. So for Bing and Copilot, new pages wait for normal crawling.
- **Perplexity:** its index tracks "over 200 billion unique URLs", but "the internet's scale is far too vast to index
  every single URL on a frequent and recurring basis". An ML model decides whether and when to re-index each URL,
  based on "the importance and likely update frequency of the specific URL", and keeps "documents from authoritative
  domains" hot. [Primary] Perplexity Research, Architecting and Evaluating an AI-First Search API, 25 Sep 2025,
  https://research.perplexity.ai/articles/architecting-and-evaluating-an-ai-first-search-api
  - Reading for a small store: a new or rarely updated page on a small site is unlikely to be first in line.
    That is our inference, not Perplexity's words.
- **ChatGPT search:** OpenAI publishes no re-crawl schedule for OAI-SearchBot (checked the bots page and the help
  article "Searching the web with ChatGPT" on 11 Oct 2026). ChatGPT "may search the web automatically when your
  question would benefit from current information", partners with other search providers (it names Microsoft and
  Shopify), and "Placement is not guaranteed." [Primary] https://help.openai.com/en/articles/9237897-chatgpt-search
  (The old publishers FAQ, help article 12627856, now redirects to an unrelated page.)
- **Shopify stores specifically:**
  - New pages (our guides) go into the store's sitemap automatically: "Sitemap files are automatically updated when
    you add a new webpage". Shopify also says: "The process of crawling and indexing your site can take time, and
    Google doesn't guarantee how long it will take." [Primary]
    https://help.shopify.com/en/manual/promoting-marketing/seo/find-site-map (read 11 Oct 2026)
  - Product data reaches AI channels through Shopify Catalog, listed "with their title, description, options,
    images, price, availability", and "Shopify Catalog continuously updates your product data, ensuring that there's
    accurate inventory and pricing across every AI channel." [Primary]
    https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/products
  - OpenAI: "For merchants on Shopify, product data is already integrated into ChatGPT through Shopify Catalog" and
    "When merchants update their pricing or shipping terms, there may be some delay before it is reflected." [Primary]
    https://help.openai.com/en/articles/11128490-shopping-in-chatgpt (updated about 3 Oct 2026)
  - **No source gives a time for an edited title or description to show up in ChatGPT's product results.** Shopify's
    "continuously" is stated for price and stock. Don't claim product fixes reach ChatGPT "instantly".

### 2.3 Being re-read is not being recommended: effects take weeks to months

- **Google's own answer to "How long until I see impact?":** "Every change you make will take some time to be
  reflected on Google's end. Some changes might take effect in a few hours, others could take several months. In
  general, you likely want to wait a few weeks to assess whether your work had beneficial effects in Google Search
  results. Keep in mind that not all changes you make to your website will result in noticeable impact." [Primary]
  SEO Starter Guide, last updated 10 Dec 2025, https://developers.google.com/search/docs/fundamentals/seo-starter-guide
  - This is the best primary source for the video's "weeks to months" line, and Google says SEO basics are what
    AI Overviews and AI Mode rely on (AI features page above; AI optimization guide, updated 10 Jul 2026).
  - Note: the often-quoted Google line "four months to a year" is **not** on Google's current "Do you need an SEO?"
    page (last updated 5 Jun 2026; it came from a 2017 Google video). Don't quote it.
- **AI answers change from one run to the next.** SparkToro and Gumshoe ran 2,961 prompts (Nov to Dec 2025) on
  ChatGPT, Claude and Google's AI: under a 1 in 100 chance of the same brand list twice, closer to 1 in 1,000 for the
  same order; they suggest tracking how often a brand appears across many runs. [Secondary, vendor-partnered]
  https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242
  - That is why GEO asks every question twice and shows a trend (CLAUDE.md section 8). It also means **a score can
    dip from one week to the next even when nothing is wrong.**
- **Cited pages are usually established pages.** Ahrefs (17 million citations across 7 AI platforms): the average
  page cited by AI assistants was 1,064 days old (about 2.9 years) vs 1,432 days for Google results; AI prefers
  fresher pages than Google does, but new pages still compete with years-old ones. [Study]
  https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/
- **Freshness does matter once a page is known.** Seer Interactive (log files): nearly 65% of AI bot hits went to
  content published in the past year; about 50% of Perplexity's citations were from 2025 alone. [Study, correlation]
  https://www.seerinteractive.com/insights/study-ai-brand-visibility-and-content-recency . SE Ranking: pages updated
  in the last 3 months averaged 6.0 ChatGPT citations vs 3.6 for older ones [Secondary, via `geo-2026.md` 2.6]. This
  backs the 60 to 90 day refresh cycle, not a timeline.

### 2.4 Answers from memory change only when a new model ships (months)

- When ChatGPT doesn't search, it answers from what its model learned in training. OpenAI says it searches
  "automatically when your question would benefit from current information" (help article above), so not always.
- Example of the gap: GPT-5.6 was released 9 Jul 2026 with a knowledge cutoff of 16 Feb 2026, about five months
  earlier. [Secondary] Box developer docs model card,
  https://developer.box.com/guides/box-ai/ai-models/openai-gpt-5-6-sol-model-card (OpenAI's own model page not
  checked). So anything a store changes today reaches "memory" answers only with a later model, months away, and
  only if the model's makers use it.

### 2.5 Mentions on other sites: the slowest part, set by publishers

- AI search leans on third-party ("earned") sources over brand sites (Chen et al., 10 Sep 2025,
  https://arxiv.org/abs/2509.08919); branded web mentions correlated strongly with AI visibility (Ahrefs 75K brands).
  [Study, correlation; both in `geo-2026.md` 2.11]
- The timing depends on people outside our control: a writer has to reply, agree, and edit their page; then each AI
  has to re-read that page (section 2.2). No source gives a typical time, and many pitches get no reply. Say
  "takes time", never a number.
- Google: "seeking inauthentic 'mentions' across the web isn't as helpful as it might seem." [Primary] AI optimization
  guide, updated 10 Jul 2026, https://developers.google.com/search/docs/fundamentals/ai-optimization-guide . This is
  why GEO's outreach is honest pitches only, and the video must never show posting on Reddit or writing reviews.

### 2.6 Timelines found online that we should NOT use

Vendor and agency blogs give precise windows ("Perplexity 2 to 7 days, ChatGPT 7 to 21 days, AI Overviews 14 to 45
days", "ChatGPT recommendations take 3 to 6 months", "AI Overviews 1 to 3 months"). They contradict each other,
cite their own client work or no data, and none is a controlled test. [Secondary, rejected] Examples seen in search
on 11 Oct 2026: authoritytech.io, goshdigital.co, developios.com. Same for "GPTBot revisits every 2.4 days" (an
unnamed April 2026 log study).

### 2.7 What this means for "when will I see results?"

| What | When | How sure |
|---|---|---|
| Starting point: score, rivals, cited sites, AI sales from the last 60 days | Day one | Certain (our code) |
| Fixes and guides live on the store | The moment they are approved (or applied by autopilot) | Certain (our code) |
| A new check and a point on the trend line | Every week (daily on Done-for-you) | Certain that it runs; the score can go down as well as up |
| AI companies notice robots.txt fixes | About a day | Their own docs; access only |
| AI re-reads changed or new pages | Days to weeks, per AI, not guaranteed | Their own docs (Google, IndexNow); Perplexity and OpenAI publish no number |
| AI answers start naming the store more often | Weeks to months, if at all | Google's "few hours to several months, wait a few weeks"; nobody promises it |
| Other sites mention the store | Depends on publishers; often longer, often never | No reliable source; out of our hands |
| "Change vs before" on the money block | After 14 days of data | Certain (our code); a fair read needs months |
| First monthly report | Start of the next calendar month | Certain (our code) |

---

## 3. Timeline captions the video can show

Short captions (big line) with an optional small line. Each has its proof. "Certain" means our product does it on a
schedule; "Varies" means it depends on AI companies or other sites and must be worded as such.

| # | Scene | Big caption | Small line | Certain or varies | Proof |
|---|---|---|---|---|---|
| 1 | Install | **Minutes after you install** | GEO reads your products and writes the questions shoppers ask AI. | Certain (automatic; minutes, not timed exactly) | `onboard-job.server.ts:14-28`; `onboarding.server.ts` `generateQuestions`; welcome screen `app._index.tsx:136` |
| 1b | Install (optional detail) | **Grouped into topics** | Questions people really ask, from "best beard oil" to "beard oil under $40". | Certain | `clusters.ts:7`, `onboarding.server.ts:242-247`. Use the house sample store's topics; the "$40" question is from the How it works section, so pick another if repeating it is a worry |
| 2 | Day one | **Day one: your starting point** | How often ChatGPT, Gemini, Perplexity and Google AI Overviews name you. | Certain | `scan.server.ts` `startScan`, `finishScan`; `score.ts` |
| 2b | Day one | **Who AI picks instead** | And the sites it trusts. | Certain | `scan.server.ts:192-207`; `app.competitors.tsx:182`, `:245` |
| 2c | Day one | **Your AI sales so far** | We check your last 60 days of orders. | Certain once Shopify approves order journey data (launch blocker) | `orders.server.ts:86`; CLAUDE.md section 18 item 4 |
| 3 | Fixes | **Approve. It's live on your store.** | Undo any time, in one click. | Certain (seconds) | `fixes.server.ts:703`, `:887`; `app.fixes.tsx:84-90` |
| 3b | Fixes (Done-for-you tag) | **Done-for-you: we put fixes live** | Ones that need your input wait for you. | Certain | `fixes.server.ts:969-1000`; `plans.ts` Done-for-you features |
| 4 | Weekly | **Every week: we ask AI again** | Daily on Done-for-you. See what changed. | Certain that it runs; the result varies | `worker.server.ts:101-121`; `plans.ts` `scanEveryDays` |
| 5 | Monthly | **Every month: new guide pages** | Written for you. Checked again every 60 to 90 days. | Certain (allowance); live on approval (Standard) or for you (Done-for-you) | `plans.ts` `guidePagesPerMonth`; `fixes.server.ts:1013` |
| 5b | Monthly | **Sites to pitch, emails drafted** | Done-for-you: we send them and follow up. | Certain that targets and drafts appear; replies vary | `outreach.server.ts`; `plans.ts` `outreachPerMonth`; hand outreach after the trial |
| 6 | Catch-up | **Weeks to months: AI catches up** | AI re-reads your pages on its own schedule, and new mentions take time. | **Varies** (say so) | Google recrawl page ("a few days to a few weeks"); SEO Starter Guide ("a few hours ... several months", "wait a few weeks"); IndexNow FAQ ("days or even weeks"); Perplexity research (not every URL often); OpenAI ("Placement is not guaranteed") |
| 7 | Money | **The money: sales, orders and clicks from AI** | Against your starting point. | Certain that we count; amounts vary | `dashboard.server.ts`; `attribution.ts` |
| 7b | Money (fine print) | **Only sales we can trace to AI** | Google AI Overviews can't be split from normal Google. | Certain (honesty rule) | `app._index.tsx:322-326`; `README.md` honesty rules |
| 8 | Report | **A report in your inbox each month** | Done-for-you: plus a 30-minute call. | Certain (first days of each month) | `report.server.ts`; `worker.server.ts:124-132` |

Alternatives for scene 6 (pick one; all safe):
- "AI updates on its own schedule. Usually weeks, sometimes months."
- "Your store changes today. AI answers take longer to catch up."
- "No one can promise when AI will name you. We show you every week."

Order note: scene 6 sits best **between the weekly check and the money**, so the viewer sees why the weekly check
exists before the money block, and the money block then reads as "what we count", not "what you will earn".

Persistent tag: a small "Example" tag on every frame (as in the current video), store "Coolabah Grooming Co.", rivals
Ridgeback, Saltbush and Banksia (sample data list in `docs/copy-deck.md` and `parts/20m-money.*`). If a scene shows
dates or weeks on a trend line, label them "Example" too and avoid "Week 4" style counters that read like a
promised pace.

---

## 4. Wording to avoid (and what to say instead)

| Avoid | Why | Say instead |
|---|---|---|
| "Results in 30 days", "See results in 2 weeks", any date or number of days for AI to recommend you | No platform publishes one; Google says "a few hours ... several months" | "Weeks to months, on AI's own schedule" |
| "Live in ChatGPT", "AI sees your fix today", "instantly visible to AI" | Live on the store is certain; AI re-reading is days to weeks, not guaranteed | "Live on your store" |
| "Within 24 hours" (about AI picking up changes) | The ~24 hours (OpenAI, Perplexity) is for robots.txt rules only | "AI companies say a block fix can take about a day to notice" (only in a crawler scene) |
| "Watch your score climb every week", an always-rising chart | AI answers vary run to run; scores can dip | "See what changed each week"; show a gently uneven example line |
| "Get recommended by ChatGPT", "AI will recommend you", "rank #1", "top of ChatGPT", "guaranteed" | Promise; Google and OpenAI both say placement isn't guaranteed | "Helps AI recommend you", "how often AI names you" |
| "More sales", "grow AI revenue by X%", "pays for itself", "10x" | Promised results (copy rule 10) | "See the sales you can trace back to AI" |
| "Every AI sale", "all your AI revenue" | We only count what we can trace; AI Overviews not counted | "Sales we can trace back to AI" |
| "Thanks to GEO you made $X" | Never claim AI revenue was caused by the app (CLAUDE.md section 10) | "Since you joined" next to "before you joined" |
| "We get you featured in roundups / on Reddit / in reviews" | Publishers decide; we never post or write reviews | "We find sites to pitch and draft the email" (Done-for-you: "we send and follow up") |
| Showing GEO posting on Reddit, writing reviews or ratings | House rule | Show a forum row as "You join in" at most |
| "Fully automatic", "set and forget" (for Standard) | Standard needs approval | "You approve, it goes live" |
| "Nothing changes without your OK" (for Done-for-you) | Done-for-you applies fixes for the store | "Ones that need your input wait. Undo any time" |
| "Daily full scans", "Claude" on Standard | Done-for-you daily scans are light; Claude is Done-for-you only | "Checked every day on Done-for-you" |
| "Google AI Mode" or "all of Google's AI" in the scan scene | The scan checks Google AI Overviews (and Gemini), not AI Mode (`treg.server.ts:167-173`) | "Google AI Overviews" |
| "Your full report in 2 minutes" | The 2 minutes is the welcome screen's unmeasured line for the free scan; the paid scan is much bigger | "Day one" |
| "Tick your questions, then we scan" | No such step before the first scan in the code; questions are picked automatically and can be edited later | "Edit your questions any time" |
| "Hand outreach and your call from day one" (Done-for-you) | They start after the trial (`plans.ts`) | Leave timing out, or "after your trial" |
| "We fix your robots.txt", "we unblock you" | GEO shows the fix; the store edits the theme | "We check each week that AI can read your store" |
| "FAQs appear on your product page the moment you approve" | FAQ fixes save to a metafield; they show once the store adds the "AI-ready FAQs" block to the theme (`app.fixes.tsx:526-532`) | Show a description fix for the "live" moment, or show the one-time "Add to my theme" step |
| "Real-time" tracking | Orders are processed by a webhook job and visits by a pixel; close to live but not promised | "As orders come in" |
| "AI sales in the last 60 days" without the caveat, if the video ships before Shopify approves order journey data | Without it only channel data is read (`orders.server.ts:74-83`) | Keep the line, but check the approval status before launch |

---

## 5. Other things the video should get right (found in the code)

1. **"Since you joined" for the score compares with the very first scan.** `visibilitySummary` uses the first
   snapshot (`dashboard.server.ts`, `sinceStart`), which for most members is the free scan (10 questions, 3 AIs), not
   the 50-question 4-AI scan. Fine for an example frame; just don't make a precise "+X since joining" the hero of the
   video.
2. **The "% vs before" chip on money appears only after 14 days** (`dashboard.server.ts:55`). A day-one money scene
   should show "AI sales from the last 60 days" and "since you joined: 1 day", not a growth chip.
3. **Visits from AI start counting at install** (pixel); the 60-day backfill covers orders only.
4. **Google AI Overviews rarely appear for shopping searches** (3.2% of Shopping keywords, Ahrefs, Sept 2025 data,
   `facts-2026.md` 0.11), so an honest sample would show some questions with no AI Overview.
5. **The How it works section already shows the method** (`parts/20-how.*`: find where AI looks, let AI read your
   store, product pages, guides kept fresh, get named). The video should show the member's experience over time
   (day one, every week, every month, the money), not repeat those five steps.

---

## Sources

Read 11 October 2026 unless a date is given. Fetched through Treg's `anyapi.web.scrape` (about US$0.02 in total)
because the sandbox can't resolve these hosts directly.

Primary
- OpenAI, Overview of OpenAI crawlers (OAI-SearchBot, "~24 hours"): https://developers.openai.com/api/docs/bots
- OpenAI Help, Searching the web with ChatGPT ("Placement is not guaranteed"): https://help.openai.com/en/articles/9237897-chatgpt-search
- OpenAI Help, Shopping in ChatGPT (Shopify Catalog; "some delay"), updated about 3 Oct 2026: https://help.openai.com/en/articles/11128490-shopping-in-chatgpt
- Perplexity, Perplexity Crawlers ("up to 24 hours"): https://docs.perplexity.ai/guides/bots
- Perplexity Research, Architecting and Evaluating an AI-First Search API (25 Sep 2025): https://research.perplexity.ai/articles/architecting-and-evaluating-an-ai-first-search-api
- Google, Ask Google to recrawl your URLs (last updated 10 Dec 2025): https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- Google, SEO Starter Guide, "How long until I see impact in search results?" (last updated 10 Dec 2025): https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- Google, AI features and your website (last updated 10 Dec 2025): https://developers.google.com/search/docs/appearance/ai-features
- Google, Optimizing for generative AI features (last updated 10 Jul 2026): https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Google, Do you need an SEO? (last updated 5 Jun 2026; no "four months to a year" line): https://developers.google.com/search/docs/fundamentals/do-i-need-seo
- Google Search Console, Search generative AI control (1 to 2 days): https://support.google.com/webmasters/answer/16908024 (via `facts-2026.md`)
- IndexNow FAQ ("days or even weeks"): https://www.indexnow.org/faq
- Bing Webmaster Blog, AI Performance public preview (Feb 2026): https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview
- Shopify Help, Finding and submitting your sitemap: https://help.shopify.com/en/manual/promoting-marketing/seo/find-site-map
- Shopify Help, Shopify Catalog and product discovery for agentic storefronts: https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts/products
- Shopify Help, Shopify agentic storefronts: https://help.shopify.com/en/manual/online-sales-channels/agentic-storefronts

Studies
- Ahrefs, AI assistants prefer to cite fresher content (17M citations): https://ahrefs.com/blog/do-ai-assistants-prefer-to-cite-fresh-content/
- Seer Interactive, AI brand visibility and content recency: https://www.seerinteractive.com/insights/study-ai-brand-visibility-and-content-recency
- Chen et al., Generative Engine Optimization: How to Dominate AI Search (10 Sep 2025): https://arxiv.org/abs/2509.08919

Secondary
- Search Engine Journal on SparkToro and Gumshoe, AI recommendations change with nearly every query (Jan 2026): https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/566242
- Box developer docs, OpenAI GPT-5.6 Sol model card (release 9 Jul 2026, cutoff 16 Feb 2026): https://developer.box.com/guides/box-ai/ai-models/openai-gpt-5-6-sol-model-card

In this repo
- `CLAUDE.md` sections 3, 6, 8, 10, 11, 15, 18; `app/lib/plans.ts`; `docs/copy-deck.md` sections 4b, 7, 10, 11, 14b;
  `docs/tools/research/geo-2026.md`; `docs/tools/research/facts-2026.md`; `docs/geo-research.md`; `docs/free-check.md`.
