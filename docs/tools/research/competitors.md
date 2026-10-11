# Competitor teardown: the 7 free tool pages (11 Oct 2026)

What ranks for our 7 search terms, what each page does, where it is weak, and how our page beats it for a
Shopify store owner. Read with `seo-2026.md` (page rules) and `geo-2026.md` (AI search facts) in this folder;
this file does not repeat them.

**How this was gathered (11 Oct 2026):** pages opened with Treg `anyapi.web.scrape` (rendered HTML + markdown;
JSON-LD read from the rendered page), extra Google US results with `anyapi.google.serp.organic`, a few lookups
with web search. WebFetch and curl could not reach these sites from this container. Total Treg spend about
US$0.04. Word counts are the rendered page **including nav and footer** (so they run high; `seo-2026.md` has
main-content counts for a few). Competitor titles below show their em dashes as " - " (house rule).
"Not opened" means listed on page 1 but not inspected. **UNVERIFIED** marks anything not checked first-hand.

---

## 0. What the whole field gets wrong (our openings)

1. **Email gates dressed up as "free".** vidern (work email required), llmpulse (email, and submitting
   subscribes you to their newsletter), pixelmojo (one audit per email, 6-digit code), fudge.ai (email before
   scan), wellows (email field), arobis (fix plan behind a contact form), jahanzaib ("full report emailed").
   Kedra, usebund and freeseoapps are the only clean "no login, no email" tools we saw. **Ours: result on the
   page, no email, ever. Email only as an optional "send me this" after the result.**
2. **Out-of-date or wrong facts.** Kedra and SEOptimer still talk about FAQ rich results as if they show
   (gone since 7 May 2026); grigora says WebSite markup "unlocks the sitelinks search box"; redirection.io
   compares itself to "Google's structured data testing tool"; plugsky documents an llms.txt format that is
   not the spec; vidern says GPTBot builds ChatGPT's search index and never checks OAI-SearchBot;
   aioverviewchecker.com (#2 for "ai overview checker") still says AI Overviews are "in beta" and
   "Dominate the SERPs in 2024". **Ours: every claim dated and sourced, reviewed each quarter.**
3. **Overclaims and uncited numbers.** "100% accurate" (duplichecker AI detector), "AI assistants are strict
   parsers... invisible" (plugsky), "47% of Google searches" (seography), "87.4% of AI referral traffic"
   (jahanzaib), "Over 90% of stores" (fudge.ai). None cite a source on the page.
4. **Generic, not Shopify.** Only Kedra and fudge.ai speak to Shopify owners, and even Kedra's Shopify steps
   are one paragraph ("use robots.txt.liquid or an app"). Nobody gives copy-paste Liquid that keeps itself
   up to date.
5. **Sloppy SEO on ranking pages** (the SERPs are soft): jaseir.com ranks #3 for "faq schema generator" with
   no H1, a generic title and no meta description; temp-email.io (#1) has two H1s and no JSON-LD;
   llmpulse's H1 reads "AI Robots.txt Checker by" (logo image) and it has no meta description or canonical;
   aioverviewchecker.com ranks #2 with no tool at all (waitlist). A fast, honest, well-built page can win.
6. **Too many CTAs.** Agency pages stack 3 to 5 asks (email course, book a call, trial, newsletter).
   Owner rule for us: exactly one button under the result.

**What the good pages all do (copy this):** tool above the fold with a one-line promise and a trust line
("Free · No login · No email"), example buttons ("Try: allbirds.com"), a "what each X does" explainer, a
platform how-to, 4 to 8 FAQs that match the FAQPage JSON-LD, related-tools links, `WebApplication` /
`SoftwareApplication` JSON-LD with `price: 0`. Kedra adds a breadcrumb and a hub page (`CollectionPage`).

---

## 1. Kedra (direct app competitor): every free tool

Hub: https://kedra.io/tools/ (title "Free Shopify & AI SEO Tools", H1 the same, `CollectionPage` JSON-LD,
"No signup. Free forever."). Astro static site, so all text is server-rendered. 10 tools in 3 groups:

| Group | Tool | URL |
|---|---|---|
| AI visibility | AI Visibility Checker | https://kedra.io/tools/ai-visibility-checker |
| AI visibility | llms.txt Checker | https://kedra.io/tools/llms-txt-checker |
| AI visibility | GPTBot Checker (AI crawler checker) | https://kedra.io/tools/gptbot-checker |
| AI visibility | FAQ Schema Generator | https://kedra.io/tools/faq-schema-generator |
| AI visibility | Product Schema Checker (+ Fixer) | https://kedra.io/tools/product-schema-checker |
| Store & checkout | Order Limit Calculator | https://kedra.io/tools/order-limit-calculator |
| Store & checkout | Shopify Security Audit | https://kedra.io/tools/shopify-security-audit |
| Developer utilities | Regex Tester | https://kedra.io/tools/regex-tester |
| Developer utilities | API Response Checker | https://kedra.io/tools/api-response-checker |
| Developer utilities | JSON Formatter | https://kedra.io/tools/json-formatter |

- **Overlap with our 7:** 5 of 7 (visibility, llms.txt, crawler, FAQ schema, product schema). Kedra has **no
  AI Overview checker and no product-copy checker**: two pages where Kedra cannot compete today.
- **Template (every AI tool page):** breadcrumb, kicker "Free tool", H1, lede, the tool, trust line
  "Free · No login · No email · Results in seconds", 2 to 3 explainer H2s, a "How to ... on Shopify" H2,
  an app promo block ("Kedra AI Index · Free plan" + "Get Kedra AI Index - free"), FAQ H2 with 6 Q&As
  (FAQPage JSON-LD mirrors them), 3 related tools. Site-wide JSON-LD: Organization, WebSite (with a
  SearchAction), BreadcrumbList; per page `WebApplication` (price 0) or `SoftwareApplication`.
- **Internal links:** mega-menu lists all 10; footer lists only 4 tools + "All free tools"; each page links 3
  related tools. App Store links get UTM tags by surface (`utm_campaign=tools|footer|nav|blog`).
- **Their app (Kedra AI Index):** free plan; "paid plans from $25/month add tracking of the buyer questions AI
  answers and competitor tracking" (their FAQ). Pitches **"Revenue attribution: see which AI assistant referred
  each session and order"** and a live AI crawler log, plus replacing Shopify's generic llms.txt / agents.md.
  So "we show the money" is not unique on its own; our edge must be live answers per product + fixes pushed
  to Shopify + outreach, and showing it on the free tool pages, not just claiming it.
- **Kedra weak spots we can exploit:** FAQ page still says Google shows FAQ snippets "for only a few kinds of
  sites" (gone since 7 May 2026) and tells merchants to paste FAQ schema into `theme.liquid` for site-wide use
  (puts the same FAQ markup on every page, which no longer matches what each page shows) and to test in the
  Rich Results Test (FAQ support reportedly removed June 2026, secondary source, see `seo-2026.md`).
  Product schema page is thin and unfinished: 4 FAQs and an HTML comment "Short FAQ (full article + 8-question
  FAQ land in M6)"; its breadcrumb "Tools" link points at the tool itself. AI visibility checker is a
  readiness score from public signals only: it never asks an AI assistant anything. A testimonial ("Maya Patel,
  Wellness Loop") we cannot verify.

## 2. Other Shopify AI-visibility competitors with free tools

| Who | Free tool? | What it does / gate | Notes |
|---|---|---|---|
| **Shopify, Commerce Readiness** (commerce-readiness.shopify.io) | Yes, free, no login | "31 checks across five categories including AI discoverability, product schema, transaction readiness, trust signals, and operational maturity", impact/effort matrix | Reported by Shopifreaks (article image dated April 2026). Our scraper was blocked, so details are **UNVERIFIED** first-hand. Official and free: link to it honestly rather than pretend it does not exist; our pages must add what it lacks (live AI answers, Shopify fix snippets). |
| **fudge.ai** Shopify AI Readiness Checker (https://fudge.ai/tools/shopify-ai-readiness-checker) | Yes, **email required** before scan, reCAPTCHA | Score + fixes in ~60 s; checks robots/bot access, Shopify MCP/UCP, llms.txt, policies, GTIN, review data, alt text; Shopify only | Also a "Catalog Data Audit" tool. Unsourced "Over 90% of stores are missing at least one key component". CTA: Fudge app trial. |
| **40rty** (AgentIQ) | No free web tool found | App: AgentIQ benchmark, catalog health tracker, "agents catalog" simulation; from US$49/mo per App Store (another listing said $79) | From web search summaries of apps.shopify.com/fourty-ai and their help centre; not opened. |
| **Mento** ("AI Visibility ‑ ChatGPT Gemini") | No standalone free web tool found | App free plan: 5 tracked AI queries, 2 blogs, manual llms.txt; paid from $19/mo | From search summary of the App Store listing; not opened. |
| **StoreSEO** | No AI tool page found | SEO app; ranks for "shopify llms.txt" with a listicle naming itself best (storeseo.com, 11 May 2026) | Not opened. |
| **Verity Score** | Free app plan (25 products); developer earlier posted a free scanner on community.shopify.com | Preview, approve, push fixes, undo within 30 days; tracks AI visits/orders | From search summaries; not opened. Closest to our fix engine. |
| llms.txt apps on apps.shopify.com | Apps, not web tools | Comergent AEO (ranks #1 for "shopify llms.txt"), "AEO: AI SEO optimizer LLMs.txt", "FSEO: AEO LLMs.txt Generator" (free), "LLMS.txt Agent" (free to 100 items, then $7.95 / $14.95), MageComp "AI LLMs Txt Generator" | From SERP + search summaries. Since 28 May 2026 Shopify serves a default and lets themes override it, so these apps' core job is shrinking. |
| RankSight, FoundByAI, Mention Network | App free tiers / trials | AI visibility tracking | Search summaries only. |

---

## 3. AI Overview checker ("ai overview checker", 590 / 260)

**Google US page 1 (anyapi, 11 Oct 2026):** morningscore.io tracker, aioverviewchecker.com, aioverview.com,
freeseoapps.com, seoclarity.net, seography.io, wellows.com, aeotoollist.com (explainer), airanklab.com.
The brief's earlier list also had airanklab and aeotoollist. Only **one** of these is a free, no-signup,
per-search checker (freeseoapps), and it is Australia-only.

| Page | You type | Result and speed | Extras | Structure / JSON-LD | CTA, gate | Weak or confusing |
|---|---|---|---|---|---|---|
| **freeseoapps.com/google-ai-overview-checker/** | Website + one search phrase + optional AU suburb | Opens a new results page: overview text, source links, your-domain match, up to 20 organic results. Data reused for 24 h | Location autocomplete | H1 "Does Google AI cite your website?", 3 H2s, ~350 words, **no JSON-LD, no FAQ**; needs JavaScript (noscript notice) | Agency (APEX), no signup | **AU-only.** Thin. But honest copy: "A result without your domain only describes the sources returned for that search snapshot." |
| **wellows.com/tools/ai-overviews-tracker/** | Domain + email field | Generates 40 queries from your site; explicit vs implicit citations, position, sentiment, competitors | Feedback/rating widget, long guide | 19 H2s, ~4,950 words; JSON-LD only WebPage/WebSite/Organization (FAQ not marked up) | "Start Your 7 Day Free Trial"; email asked | Brand-level, not a per-search check. Long and salesy. |
| **aioverview.com** (homepage) | Brand/domain | "Brand analysis" across AIO, ChatGPT, Gemini, Claude, Perplexity; "2 free analyses per day" | Chat widget, contact form | H1 "Traditional SEO tools measure Google rankings. AIOverview measures AI visibility.", ~750 words; Org, WebSite (twice), Breadcrumb, SoftwareApplication, FAQPage(6) | Consultation form + call | Exact-match domain doing the ranking; not a per-search checker. |
| **seography.io** readiness checker | Paste page text (max 4,000 chars) + keyword | AI "readiness" estimate, not a real Google lookup | none | ~830 words, **no JSON-LD, no canonical** | "Lock in 50% off for life" | Uncited "AI Overviews now appear in approximately 47% of Google searches". |
| **morningscore.io** (#1) | Domain into a paid tracker | Daily AIO tracking in 167 countries | CSV, API | ~5,100 words; Article/WebPage/Breadcrumb etc. | 14-day trial, from $69/mo | Not a free tool. |
| **aioverviewchecker.com** (#2) | nothing | Waitlist | none | 2024-era copy | Waitlist | No tool at all. |
| seoclarity, airanklab, aeotoollist | | | | | | Enterprise / feature / explainer pages. Not opened. |

**Best competitor:** freeseoapps.com (the only real free per-search check), held back by AU-only and thin
content. wellows for depth, but it is a trial funnel.

**How we win**
1. **A real live check, one search, no email, answer on the same page in about 10 to 20 seconds** (Treg
   `anyapi.google.serp.ai_overview`, ~US$0.0015). Show: AI Overview shown yes/no, the overview text, every
   cited source in order with your domain highlighted, and "not shown" as a valid result. Server-render the
   explainer; stream the result in. Cache identical searches for 24 h and rate-limit per IP to cap cost.
2. **Shopping-first and honest about scope.** Placeholder and example buttons are shopping searches ("best
   beard oil for dry skin", "vegan protein powder for women"). Label clearly: "Google US results, one search,
   one moment in time. AI Overviews change between searches." Nobody on page 1 is honest about this for US.
3. **Turn citations into a to-do list.** Classify each cited page (retailer, roundup/review site, Reddit/forum,
   brand site, marketplace) with the classifier the app already uses, then say what to do: "This roundup is
   cited and names 3 brands. Getting onto it is the fastest way in." That is our outreach engine, shown free.
4. **Point to the free Google data they already have:** Search Console's "Generative AI performance" report
   (all sites since 31 Aug 2026, see `geo-2026.md`) shows their AI Overview impressions. Competitors sell
   trackers instead; telling the truth builds trust.
5. **Cross-link:** "Want ChatGPT, Gemini and Perplexity too? Run the AI visibility checker" (our /check engine)
   as the single button under the result.

**Secondary keywords to cover naturally:** google ai overview checker, ai overviews checker free, check if my
site is in ai overview, ai overview citation checker, ai overview tracker free, sge checker (older name),
"is my product in google ai overview". Do not claim AI Mode coverage (our endpoint does not return it).
Volumes not checked except the head term.

---

## 4. AI crawler checker ("ai crawler checker", 110 / 10; "ai crawler access checker" 90/20, "gptbot" 1,600/260, "oai-searchbot" 1,300/210)

**Page 1 (brief):** seomator (general crawl test), ghostwall, jahanzaib, vidern, charusolutions, apify actor,
cxventures, Chrome extension, lunimrank; for "ai crawler access checker": llmpulse, freeaisearchtools,
seojuice, depra, cxventures, tools.nikhil.pro, aeovisor. Opened 6 (plus Kedra's GPTBot checker).

| Page | You type | Result and speed | Extras | Structure / JSON-LD | CTA, gate | Weak or confusing |
|---|---|---|---|---|---|---|
| **kedra.io/tools/gptbot-checker** | Store URL | Per-bot allowed/blocked "and why", seconds | **Live request as each search bot** to catch CDN/firewall blocks (403/429), flagged as "edge block" | H1 "GPTBot & AI Crawler Checker"; H2s: what each robot does, robots.txt vs firewall trap, how to unblock on Shopify, app promo, FAQ; ~1,470 words; WebApplication + FAQPage(6) | App install, no email | Best in class. Weak: Shopify fix is one generic paragraph, no snippet; 9 bots only (no Applebot, Meta, Amazon); calls Anthropic's bot "Claude Search" (real token: Claude-SearchBot). |
| **jahanzaib.ai/tools/ai-crawler-check** | Any URL | Score 0 to 100 in ~10 s; HEAD request with 16 real bot user-agents | **3 groups: 5 search bots, 5 user fetchers, 6 training crawlers**; robots.txt + llms.txt; copy-paste configs | H1 "Can AI Search Engines Find Your Website?"; 9 H2s; ~1,500 words; SoftwareApplication, FAQPage(8), HowTo(3), Person | "Full report emailed"; email course; "Book a call" | Uncited stats (87.4%, 40%, 3x) in counters that show "0%" without JavaScript; generic, not ecommerce. |
| **vidern.com/tools/ai-crawler-checker** | Website + **work email (required)** | robots.txt + live response for 7 bots | Own "study" (41% of top 1,000 sites unreadable) | H1 "Is Your Website Blocked to ChatGPT?"; ~1,700 words; WebApplication, FAQPage(6) | Email gate; "Free GEO Audit", "Book a Strategy Call" | **Never checks OAI-SearchBot**; says GPTBot "builds ChatGPT's knowledge and search index" (OpenAI separates GPTBot = training, OAI-SearchBot = search; `app/lib/robots.ts` notes). |
| **ghostwall.co/tools/ai-crawler-checker** | Domain | Probes homepage with 15 bot user-agents + parses robots.txt | Links to "Block GPTBot" guides | H1 "Which AI bots are scraping your site?" plus a second H1 in the footer; FAQPage(4), Breadcrumb; ~240 words of main content | "Start Blocking Bots" (sells bot blocking) | Framed against AI bots; unsupported claims ("AI-generated answers cite your site less if your content is already inside the model"). |
| **llmpulse.ai/robots-txt-checker** | Domain + **email** | Report by email, "few seconds" | Line-by-line rule mapping, blocked paths, sitemap check | Broken H1 ("AI Robots.txt Checker by"), two "How it works" and two FAQ sections; HowTo(3), FAQPage(6); **no meta description or canonical**; ~5,400 words with nav | "By submitting, you're subscribing to the LLM Pulse newsletter" | Email + auto-subscribe. Its FAQ answer on which bots to allow is good. |
| **seojuice.com/tools/ai-crawler-inspector/** | URL | Metadata, headings, extracted text, indexing issues, robots check | none | H1 "AI Search Crawler Inspector"; SoftwareApplication **with aggregateRating 4.8 (75)**, FAQPage(5) | 14-day trial | Admits it "simulates how various AI crawlers might fetch"; generic. |

**Best competitor:** Kedra GPTBot checker (Shopify audience, search vs training split, live edge-block test,
no email). jahanzaib's 3-group model is the clearest explanation.

**How we win**
1. **Shopify-native fix, not a paragraph.** Detect Shopify (headers / `cdn.shopify.com`), say whether
   robots.txt is Shopify's default (which blocks no AI bot, per `app/lib/robots.ts`) or customised, and show
   the exact `robots.txt.liquid` lines to remove or add, with a copy button and where to click in Shopify admin
   (Online Store, Themes, Edit code). The app already has this copy (`robots.ts` line ~210).
2. **Three plain-English groups with a verdict each:** "Can recommend you" (OAI-SearchBot, PerplexityBot,
   Claude-SearchBot, Googlebot, Bingbot), "Fetch a page when a shopper asks" (ChatGPT-User, Claude-User,
   Perplexity-User), "Training only, blocking does not hide you from answers" (GPTBot, ClaudeBot,
   Google-Extended, plus Applebot-Extended, CCBot, Meta-ExternalAgent as info). Each bot links to its owner's
   official page with a "checked Oct 2026" date. Fixes vidern's mistake and Kedra's missing bots.
3. **Check a product page, not just the homepage.** Test `/`, one `/products/<handle>` and one
   `/collections/<handle>` (found from the sitemap). Stores care whether products can be read; every competitor
   we opened tests only the homepage or the root rules.
4. **Show the exact line** (line number + text) that blocks each bot, the RFC 9309 "most specific group wins"
   reasoning in one sentence, and the sitemap line.
5. **Optional live bot test, labelled honestly.** Send one request per search bot user-agent and show the
   status code, but say: "Firewalls often check a bot's real network address, so a test from our server can
   differ from what the real bot sees." **UNVERIFIED** how Shopify's own bot protection treats spoofed bot
   user-agents: test on 5 to 10 Shopify stores before shipping this part, and drop it if it gives false blocks.
6. **One-click next steps:** link to llms.txt checker and product schema checker in the result.

**Secondary keywords:** gptbot checker, is gptbot blocked, oai-searchbot (1,300/210), gptbot (1,600/260),
robots.txt ai checker, ai crawler access checker (90/20), check if chatgpt can crawl my site, shopify
robots.txt ai bots, robots.txt.liquid, claudebot, perplexitybot, "should I block gptbot". One page covers them
(no near-duplicate "gptbot checker" page, see scaled-content rule in `seo-2026.md`).

---

## 5. Product schema checker ("product schema checker", 90 / 10; "shopify schema markup" 110/30, "product schema generator" 260/30)

**Page 1 (brief):** aioseo (listicle), seoptimer, savit.in (not opened, URL not given), redirection.io,
vryse (listicle), grigora, HubSpot blog (listicle). Kedra's page and Shopify's official tool also compete.

| Page | You type | Result | Extras | Structure / JSON-LD | CTA, gate | Weak or confusing |
|---|---|---|---|---|---|---|
| **kedra.io/tools/product-schema-checker** | Product URL, or bare domain ("we'll find one") | What machines read: price, availability, GTIN, brand, rating; score shown in a sample card ("74/100") | **Corrected JSON-LD or Liquid**, "no data invented"; example buttons (allbirds, gymshark, deathwishcoffee) | H1 "Product Schema Checker + Fixer"; 1 H2 ("Good to know"); ~700 words incl. nav; SoftwareApplication, FAQPage(4) | App install, no email | Thin and unfinished (HTML comment: "full article + 8-question FAQ land in M6"); breadcrumb bug; suggests adding a separate JSON-LD block (can duplicate the theme's Product); uncited claims about Perplexity's merchant programme. |
| **seoptimer.com/schema-tester** | URL | Lists and validates any schema.org types | none | H1 "Schema.org Structured Data" (not even "product"); **no JSON-LD on its own page, no canonical**; ~900 words main | 14-day trial | Generic; mentions "FAQ expanders" as current rich results. Ranks on domain strength. |
| **redirection.io/tools/structured-data** | URL or pasted code | Strict schema.org + Google-requirement validation | none | ~815 words; Organization JSON-LD only | Product signup | Developer-only language; compares itself with "Google's structured data testing tool", which Google replaced with the Rich Results Test (date not re-checked). |
| **grigora.co/tools/schema-validator/** | Pasted JSON-LD or URL | 30+ types, required/recommended fields, "AI search readiness" grade, ~10 s | Copy-paste examples per type, common-errors list | 11 H2s, ~2,000 words; SoftwareApplication, FAQPage(12), HowTo(3), BreadcrumbList twice | Website builder trial | Says WebSite "unlocks the sitelinks search box" (Google retired it, date not re-checked); garbled step text ("See what ReviewReviewA single review about a prod produces"). |
| **Shopify Commerce Readiness** | Store URL | 31 checks incl. product schema | Impact/effort matrix | Not opened (blocked) | Free, official | See section 2. |

**Best competitor:** Kedra (Shopify-tuned, gives a fix), but the page is thin. Shopify's official tool is the
bigger threat for trust.

**How we win**
1. **A product card "what AI shopping assistants can read"**, field by field with a tick, cross or "not in
   your store yet": name, brand, price + currency, availability, image, description, GTIN/barcode, SKU/MPN,
   variants (ProductGroup / hasVariant), shipping details, return policy, reviews (only if real reviews are on
   the page). Plain English per field: "Barcode missing: shopping tools match products by barcode."
2. **Catch Shopify's real-world problems:** two or more Product blocks (theme + review app) that disagree,
   schema price different from the visible price, brand set to the store name instead of the vendor,
   out-of-date availability. Show both blocks side by side. Nobody on page 1 does this.
3. **Fix in Shopify admin first, code second.** Map each missing field to where it lives: barcode field on the
   variant, Vendor for brand, Settings for shipping and return policies, product metafields. Then give a Liquid
   snippet that reads Shopify objects (e.g. the variant barcode) so it stays correct, never typed-in values,
   and warn "replace, don't add, if your theme already outputs Product". This also covers "product schema
   generator" and "shopify schema markup" honestly on one page.
4. **Be honest about what schema does in 2026:** no ranking boost; it feeds product rich results and merchant
   listings in Google and makes facts unambiguous for AI tools (sources in `seo-2026.md`). Link Shopify's own
   free readiness tool as a second opinion.
5. **One-button handoff:** "See if ChatGPT recommends this product" runs our /check with the same URL
   already filled in.

**Secondary keywords:** shopify schema markup (110/30), product schema generator (260/30), shopify product
schema, product structured data test, json-ld product checker, shopify structured data checker, gtin schema
shopify, merchant listing structured data, rich results test alternative.

---

## 6. FAQ schema generator ("faq schema generator", 3,600 / 480)

**Page 1 (brief):** tools.temp-email.io, kedra.io (#2), jaseir.com, makkalbharatham, markdownme.com, bmig.in,
usebund.com, grandranker.com. Opened temp-email, Kedra, jaseir, usebund.

| Page | You type | Output | Extras | Structure / JSON-LD | CTA, gate | Weak or confusing |
|---|---|---|---|---|---|---|
| **temp-email.io** (#1) | Q + A rows | JSON-LD on "Generate" | Sample, Reset | **Two H1s, no JSON-LD**; 8 H2s, ~1,380 words | Temp mail tools | Generic; implies search engines will "display your FAQ content in a more structured format". |
| **kedra.io/tools/faq-schema-generator** (#2) | Q + A rows, live preview | JSON-LD or `<script>` tag, copy buttons; saved in your browser only | Shopify how-to (6 steps) | H1 "FAQ Schema Generator"; 7 H2s; ~1,455 words incl. nav; WebApplication, FAQPage(6) | App promo, no email | Outdated "few kinds of sites" claim; site-wide `theme.liquid` advice; Rich Results Test advice (see section 1). |
| **jaseir.com** (#3) | Q + A rows | Code + Copy/Test/Print/PDF | Part of an 80+ tool directory incl. "Shopify Tools" | **No H1, generic title, no meta description, no canonical**; JSON-LD template broken | Feedback/services form | Shows how soft this SERP is. |
| **usebund.com/tools/faq-schema-generator** | Q + A rows (prefilled sample visible without JS) | `<script>` tag; escapes quotes and `<` safely; skips empty rows and tells you | Worked examples (quotes, HTML, empty row) | H1 + 5 H2s; ~1,670 words; Org, WebSite, FAQPage(6), WebApplication | Bund AI chat product | **Best page.** First H2 "An honest note on rich results": FAQ result stopped 7 May 2026, checked 1 Oct 2026. Not Shopify-specific. |

**Best competitor:** usebund.com for honesty and correctness; Kedra for Shopify steps.

**How we win**
1. **Honest note first, dated and sourced** (FAQ rich results stopped 7 May 2026; docs removed 15 Jun 2026).
   Then the real reason to bother: shoppers and AI assistants read clear Q&A on the page; the markup is optional
   and must match the visible text word for word.
2. **Shopify output modes nobody offers:** (a) a `<script>` tag for one page; (b) a Liquid snippet that reads
   a product's FAQ from a metafield/metaobject so each product page gets its own markup that matches its own
   visible FAQ; (c) a copy-paste section that renders the visible FAQ and the markup together, so they can
   never drift apart. Explicitly warn against site-wide `theme.liquid`.
3. **Import instead of typing:** paste a page URL and we pull the visible questions and answers (details/
   summary, headings + paragraphs) into the rows. Also "starter questions for stores" (shipping time, returns,
   sizing, materials or ingredients) as clearly marked prompts with empty answers, never invented answers.
4. **Correctness checks shown inline:** duplicate questions, empty answers, very long answers, unsafe HTML,
   proper escaping (copy usebund's `<` handling), and a "matches the visible page?" checklist.
5. **Prefilled, server-rendered sample** so the page is useful without JavaScript and Google sees real output.

**Secondary keywords:** faq schema generator shopify, faq schema shopify, shopify faq schema metafield,
faqpage json-ld generator, faq structured data generator, faq schema markup generator, "does faq schema still
work", faq rich results 2026, faq schema for product pages.

---

## 7. llms.txt checker ("llms.txt checker", 880 / 110; "llms.txt validator" 720/90, "llms.txt generator" 4,400/480, "shopify llms.txt" 260/50)

**Page 1 (brief):** llmsvalidator.com (parked "Redirecting..." per `seo-2026.md`), imexpert.au, plugsky,
web-auditor.enfection.com, pixelmojo, turva.dev, ia-qa.com. Kedra's checker also competes. "shopify llms.txt"
page 1 (anyapi, 11 Oct 2026): Comergent AEO app, Kurt Elster LinkedIn post, MageComp blog, community.shopify.dev
(27 Mar 2026: "llms.txt is a community proposal, not an established standard"), "AEO: AI SEO optimizer LLMs.txt"
app, storeseo.com listicle, community.shopify.dev (2025), verityscore.io KB.

**The spec, for reference (llmstxt.org, "v2", read 11 Oct 2026):** H1 with the site name is the only required
part; then an optional blockquote summary; optional paragraphs; then H2 sections of "file lists", each item a
markdown link `[name](url)` optionally followed by `: notes`; an "Optional" H2 for skippable links. Files can
live at the root or any sub-path. **Shopify (changelog 28 May 2026):** every store serves a default `/agents.md`;
`/llms.txt` and `/llms-full.txt` show it unless the theme adds `templates/llms.txt.liquid`,
`templates/llms-full.txt.liquid` or `templates/agents.md.liquid` (fallback order: own template, then
agents.md template, then Shopify's default).

| Page | You type | Result | Extras | Structure / JSON-LD | CTA, gate | Weak or confusing |
|---|---|---|---|---|---|---|
| **kedra.io/tools/llms-txt-checker** | Store URL | Exists? valid? **"really yours or Shopify's generic default"**; bonus AI visibility score | Annotated example file | H1 "llms.txt Checker"; 4 H2s incl. "How to add or replace llms.txt on Shopify"; ~1,460 words; WebApplication, FAQPage(6) | App (replaces the default) | Honest ("its impact today is small"). No line-by-line spec check shown; no generator; no template names, just "publish your own file through your theme". |
| **imexpert.au/llms-txt-checker-validator/** | Generator form (domain, brand, about, sitemap, services) + fetch or paste | Size, headings, URLs, warnings; Raw / Rendered tabs | **Generator + validator on one page**, download | H1 "LLMs.txt Checker & Validator"; 7 H2s; ~1,480 words; WebPage+FAQPage, BlogPosting | Agency phone / consult | Overclaims ("Why it helps SEO & AI visibility"); its example is not in spec format (plain URLs, "## About"); page brand (MRS Digital) differs from the domain. |
| **plugsky.com/tools/llms-txt-validator** | URL or paste | Score /10 with pass/warn/fail | **"Download corrected version"** | H1 "llms.txt Validator - check and fix your file"; 7 H2s, common-mistakes H3s; ~1,880 words; WebApplication, FAQPage(5) | "Start Free" (enterprise AI platform) | **Documents the wrong format**: says entries are `- Title: URL: Description` and "#" lines are comments. A spec-correct file could be "fixed" into a wrong one. Claims a bad file makes you "invisible". |
| **pixelmojo.io/tools/llms-txt-validator** | Domain | 0 to 100 across 6 sections, line-level notes | Related: llms.txt generator, 17-bot crawl checker, robots analyzer | H1 "Is your llms.txt AI-ready?"; 7 H2s; ~1,680 words; WebApplication + 15 DefinedTerm | **One audit per email, 6-digit code** | Honest copy (Google ignores it; no engine documents use, checked Sept 2026) but scores "entity definitions" and "use policy", which it admits are not in the spec. |

**Best competitor:** Kedra (Shopify default detection, honest), imexpert for combining generator + validator.

**How we win**
1. **Validate against the real spec, line by line** (H1, blockquote, H2 file lists, `[name](url): notes`),
   with errors vs "nice to have" clearly split, plus HTTP checks: status, content type, size, absolute URLs,
   a sample of links that actually load, robots.txt not blocking it. Also check `/llms-full.txt` and
   `/agents.md`. Cite llmstxt.org and say which rules are ours.
2. **Shopify-exact answer:** "You have Shopify's default (it describes Shopify, not your products)" vs "custom
   file", and the exact template to add (`templates/llms.txt.liquid`) with where to click.
3. **Generator that never goes stale (targets "llms.txt generator", 4,400/mo):** output a Liquid template that
   loops over the store's collections and policy pages, so the file updates itself as the catalog changes,
   plus a plain static version for non-Shopify sites. One page covers checker, validator and generator
   (no near-duplicate pages, per `seo-2026.md`).
4. **Evidence box, honest and dated:** Ahrefs (June 2026) found 97% of llms.txt files got zero requests;
   Google says it has no effect on Search; mainly used by coding agents. "Cheap and optional: fix crawler access
   and product data first", linking to those two tools. Our own `/llms.txt` must pass our checker.
5. **No email, no code verification**, result on the page.

**Secondary keywords:** llms.txt validator (720/90), llms.txt generator (4,400/480), shopify llms.txt (260/50),
llms.txt generator shopify, llms.txt example, llms.txt format, agents.md shopify, llms-full.txt,
llms.txt.liquid, check llms.txt, "does chatgpt read llms.txt".

---

## 8. AI bot checker ("ai bot checker", 880 / 390)

**Page 1 (anyapi, 11 Oct 2026):** duplichecker AI content detector, aidetectorwriter.com, getsolved.ai,
YouTube (QuillBot test video), hixbypass, openl.io, humbot listicle, trinka, notegpt. The AI Overview for the
term cites gptzero, quillbot, zerogpt, cleverhumanizer, copyleaks (`seo-2026.md`). **100% AI-text detectors.**
"ai product description checker" page 1 (11 Oct 2026) has **no checker at all**, only description generators
and listicles: an open gap.

| Page | You type | Result | Gate | Weak or confusing |
|---|---|---|---|---|
| **duplichecker.com/ai-content-detector.php** (#1) | Paste text or upload a file | "Human Written %" vs "AI Written %", highlighted sentences | No signup | FAQ claims the detector is "100% accurate"; written for teachers and agencies; nothing about what makes copy good. |
| Others (getsolved, openl, trinka, notegpt, hixbypass) | Paste text | AI score, highlighted sentences | Mostly free tiers | Not opened; snippets show the same promise ("detect ChatGPT, GPT-5, Claude"). Several are "humanizer" funnels. |

**Best competitor:** none for our angle. For the head term, duplichecker wins on domain strength, not quality.

**How we win**
1. **Meet the intent honestly in the first screen:** H1 like "AI bot checker for product descriptions" and a
   line "No tool can prove who wrote text. This checks whether your copy reads like a bot wrote it, and what
   shoppers and AI assistants are missing." Never show a "% written by AI".
2. **Pattern check built for products:** highlight generic filler ("elevate your", "unleash", "game-changer",
   "whether you're... or...", "in today's fast-paced world"), empty superlatives with no proof, repeated
   phrases, and long dashes used as punctuation. Runs in the browser: instant, free to serve.
3. **"Facts AI shopping assistants look for" checklist:** who it is for, size/dimensions, materials or
   ingredients, how to use, care, what is included, shipping/returns, plus a count of concrete facts vs
   adjectives. Missing items become questions for the owner ("What size is it?"), never invented answers.
   This is our fix engine's input, shown free.
4. **Paste text or a product URL** (we pull the description), with a clearly labelled sample before/after.
5. **The one button:** "See if ChatGPT recommends this product" (runs /check with the URL).

**Secondary keywords:** ai detector for product descriptions, chatgpt product description checker, ai
generated product description checker, "does my product description sound like ai", ai product description
checker, ai copy checker shopify, generic copy checker. Volumes not checked; do not chase "ai detector" (no
match for our tool).

---

## 9. AI visibility checker ("ai visibility checker", 1,900 / 320)

**Page 1 (anyapi, 11 Oct 2026):** ahrefs.com/ai-visibility-checker, arobis.ai, amplitude.com/try-ai-visibility,
seoreviewtools.com, honeyb.ai, amivisibleonai.com, birdeye.com, a Reddit post, emarketed.com. Kedra's checker
and fudge.ai also target Shopify owners.

| Page | You type | Result and speed | Extras | Structure / JSON-LD | CTA, gate | Weak or confusing |
|---|---|---|---|---|---|---|
| **ahrefs.com/ai-visibility-checker** (#1) | Brand name | Instant, from a pre-collected database ("474M+" monthly prompts, their figure): total mentions, by platform (ChatGPT, Gemini, Perplexity, Copilot, AI Overviews), top 5 topics, top 5 cited domains and pages | Links to AI Mode and AI Overviews trackers | H1 "Free AI Visibility Checker"; 8 H2s; ~3,500 words; FAQPage(8), Breadcrumb | No signup; Brand Radar US$199/mo per platform, US$699/mo all | Brand-level only. **UNVERIFIED** but likely: small Shopify brands have few or no rows in a prompt database built from search demand. Not product-level, no fixes. |
| **arobis.ai/ai-visibility-checker** (#2) | Domain | ~25 s, 0 to 100 readiness from 6 weighted site signals; "derived from your own site, not from live prompts" | Per-engine estimate, shareable link, score badge, video | 13 H2s; ~3,700 words; WebApplication, VideoObject, FAQPage(19); **no meta description** | Fix plan "unlocked with a short contact form"; paid audit | It is a readiness estimate, not visibility. Study stat without method on page. |
| **honeyb.ai/tools/ai-visibility-checker** (#5) | Domain | One live engine free, ~15 s: does it know you, recommend you, who it names instead | Strategy and content agents | 13 H2s; ~4,900 words; SoftwareApplication (Offer "Free one-engine check"), FAQPage(14) | Full 8-engine report needs a 3-day trial | Closest to ours, but B2B (Notion example), one engine only free. |
| **kedra.io/tools/ai-visibility-checker** | Store URL | Readiness score from homepage, robots.txt, sitemap, structured data (5 categories) | Upsell lists revenue attribution | ~600 words main | App free plan, paid from $25/mo | Never asks an AI assistant anything. |
| fudge.ai, Shopify Commerce Readiness | Store URL | Readiness checks | | | Email (fudge) / none (Shopify) | Readiness, not answers. See section 2. |
| amplitude, seoreviewtools, amivisibleonai, birdeye, emarketed | | | | | | Not opened. Snippets: report funnels, 30 to 60 s scores, emarketed asks for email for the full list. |

**Best competitor:** Ahrefs (brand, speed, trust). For Shopify owners specifically, honeyb's live-engine idea
is the nearest to ours; Kedra is the nearest Shopify rival.

**How we win**
1. **Live answers, per product, across three assistants.** Paste a product link; we ask ChatGPT, Gemini and
   Perplexity real buyer questions about it (our /check engine, ~2 minutes) and show whether the product or
   brand is named, who is named instead, and which sites are cited. Not a readiness estimate (arobis, Kedra,
   fudge) and not a brand database lookup (Ahrefs).
2. **Shopper questions, not marketer prompts:** show the questions we asked in plain English
   ("best beard oil for dry skin") so the owner trusts the result; say answers change between runs.
3. **The "why" and the "what next" on the same screen:** competitors named, the roundup and retailer pages AI
   cites (our outreach targets), and the 2 to 3 store fixes that matter (crawler access, product data),
   each linking to the matching free tool.
4. **Show progress while it runs** (answers appear engine by engine) so 2 minutes feels alive; no email to see
   the result, optional PDF by email after.
5. **The money angle, shown not claimed:** the single button goes to install GEO ("see the sales AI sends
   you"); Kedra claims revenue attribution too, so show a labelled sample of the money block rather than
   a slogan.

**Secondary keywords:** ai visibility checker free, chatgpt visibility checker, ai search visibility checker,
"is my brand in chatgpt", "does chatgpt recommend my product", shopify ai visibility, ai brand visibility
checker, llm visibility checker (search term only; keep "LLM" out of on-page copy except where needed).

---

## 10. Build notes that apply to all 7 (short; details in `seo-2026.md`)

- **Order on the page (beats every competitor's layout):** H1 + one-line promise, the tool (works on load, phone
  first, no email), the result, exactly one button, then: what the result means, Shopify fix steps, 4 to 6 FAQs,
  "other free tools" row. Server-render everything except the result.
- **JSON-LD:** `WebApplication` (price 0, no ratings unless real), `BreadcrumbList`, site-wide `Organization`
  + `WebSite`; `FAQPage` optional and word-for-word identical to the visible FAQs. Do not add `HowTo` for rich
  results (retired). Do not copy SEOJuice's `aggregateRating`.
- **Tool hub `/tools` + footer on every page linking all 7 + /check.** Kedra's footer shows only 4 tools;
  ours lists all, plus a 3-tool "related" row chosen per page (crawler ↔ llms.txt ↔ product schema,
  AI Overview ↔ AI visibility, FAQ ↔ product schema ↔ bot copy).
- **Date every fact** ("checked October 2026") and keep a quarterly review list: bot names, Shopify
  llms.txt/agents.md behaviour, FAQ status, Google AI features.
- **Never let results create indexable pages** (shareable result URLs get `noindex`).

---

## Sources (all read or fetched 11 Oct 2026 unless dated)

Competitor tool pages (rendered via Treg anyapi.web.scrape):
- https://kedra.io/tools/ , /tools/gptbot-checker/ , /tools/llms-txt-checker/ , /tools/faq-schema-generator/ ,
  /tools/product-schema-checker/ , /tools/ai-visibility-checker/
- https://ghostwall.co/tools/ai-crawler-checker ; https://www.jahanzaib.ai/tools/ai-crawler-check ;
  https://vidern.com/tools/ai-crawler-checker ; https://llmpulse.ai/robots-txt-checker ;
  https://seojuice.com/tools/ai-crawler-inspector/
- https://freeseoapps.com/google-ai-overview-checker/ ; https://wellows.com/tools/ai-overviews-tracker/ ;
  https://aioverview.com/ ; https://seography.io/ai-tools/ai-overview-readiness-checker ;
  https://morningscore.io/ai-overviews-tracker/ ; https://aioverviewchecker.com/
- https://www.seoptimer.com/schema-tester ; https://redirection.io/tools/structured-data ;
  https://www.grigora.co/tools/schema-validator/
- https://tools.temp-email.io/faq-schema-generator ; https://jaseir.com/tools/faq-schema-generator/ ;
  https://usebund.com/tools/faq-schema-generator
- https://imexpert.au/llms-txt-checker-validator/ ; https://plugsky.com/tools/llms-txt-validator ;
  https://www.pixelmojo.io/tools/llms-txt-validator
- https://www.duplichecker.com/ai-content-detector.php
- https://ahrefs.com/ai-visibility-checker ; https://arobis.ai/ai-visibility-checker ;
  https://www.honeyb.ai/tools/ai-visibility-checker ; https://fudge.ai/tools/shopify-ai-readiness-checker

Google US organic results via Treg anyapi.google.serp.organic (11 Oct 2026): "ai visibility checker",
"ai bot checker", "ai overview checker", "shopify llms.txt", "ai product description checker",
"storeseo free tools checker". Other page-1 lists are from the task brief (11 Oct 2026).

Primary references:
- llmstxt.org, "The /llms.txt file, v2": https://llmstxt.org/
- Shopify changelog, "Customize /llms.txt, /llms-full.txt and /agents.md" (28 May 2026):
  https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd
- community.shopify.dev thread (27 Mar 2026, "llms.txt is a community proposal"), seen as a Google snippet:
  https://community.shopify.dev/t/adding-of-robot-txt-llms-txt-file-in-the-shopify-template/32717/5
- Shopifreaks on Shopify's Commerce Readiness tool (around April 2026):
  https://www.shopifreaks.com/shopify-launches-ai-agent-readiness-tool-that-scores-any-store-url-on-compliance-with-agentic-commerce-protocols/

Secondary (web search summaries, pages not opened, treat as UNVERIFIED): 40rty App Store listing
(https://apps.shopify.com/fourty-ai), Mento listing (https://apps.shopify.com/mento-boost-your-ai-presence),
Verity Score listing (https://apps.shopify.com/verity-score), FSEO / LLMS.txt Agent / Comergent listings,
storeseo.com listicle (11 May 2026), Kurt Elster LinkedIn post on Shopify's official llms.txt.
