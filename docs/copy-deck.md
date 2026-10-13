# Copy deck: home page and free product check (Oct 2026)

Written for the redesign in `docs/redesign-brief.md`. External facts come only from `docs/facts.md`.
Product facts come from `CLAUDE.md`. Sections 1 to 12 are the lean home page as built in
`design/overview/parts/*.html` (rewritten 10 Oct 2026: about 750 words, down from 5,716; copy pass the same day for the
"recommended in AI answers" message, now about 920 words with the clickable sample app; the two-plan pricing with
the Monthly / Yearly switch, the same day, keeps it under 1,000). 11 Oct 2026: Ross's four approved changes (the
"Like SEO" line, the slogan, small app screens in How it works, the free check video) and a colour pass; the
budget is now **1,050 words** (the page is at 1,048).

> ### Copy rules (every writer, every line)
>
> 1. **The headline is fixed:** "The free sales channel your store is missing". Don't reword it.
> 2. **Never use a dash as punctuation.** No em dashes (the long dash). No spaced en dashes or spaced
>    hyphens standing in for one. Use a full stop, comma, colon or "and". Ranges use "to": "$20 to $300".
> 3. **Teach, don't sell.** Show the fact, how it works and the reader's own numbers, then ask the
>    question. Let them reach the conclusion. Never "you're losing sales". No hype words, no
>    exclamation marks.
> 4. **Money first.** Every section answers "what does this mean for my store's sales?"
> 5. **Plain English, short sentences.** Aim for under 20 words. If a non-technical store owner has to
>    read it twice, rewrite it. Spelling: in the app, emails and reports, spell for the store's country
   (STYLE_RULE in the code; US spelling when we don't know it). On the website, US spelling.
> 6. **No jargon.** GEO is our name, never a method. No LLM, AEO or "generative engine". Say "AI
>    assistants", "AI answers" or "ChatGPT & co". Explain "visibility score" and "baseline" when you use
>    them (see the names table below).
> 7. **Every number has a `[source]` tag** and matches `docs/facts.md`. **Never round up.** Round down,
>    or say "about", "roughly", "nearly" or "over". Say whose data it is (US survey, Triple Whale's own
>    merchants). The 50 million is "our estimate", "2025", "on ChatGPT alone", and counts questions,
>    not people.
> 8. **"Free" means $0 or no cost per click.** Free: the AI recommendations and the clicks they send,
>    the free product check, the free scan, the 7-day trial. GEO itself is never free: say "no ad
>    spend".
> 9. **Ads:** never say AI answers have no ads or that you can't pay to appear in Google's AI answers.
>    Say "the recommendation inside the answer isn't for sale".
> 10. **No promises.** Use "can", "helps", "if". Never "will get you", "more sales" or a date. Never say
>     AI growth was caused by GEO. Sample numbers sit in frames tagged "Sample data".
> 11. **Keep it lean.** The whole home page stays under 1,000 words. Headlines up to about 8 words,
>     supporting lines up to about 15. GEO "counts the orders it can trace back to AI", never "every order".

---

## Wording: "buying questions" (13 Oct 2026)

Ross: say **buying questions**, not "prompts", "buyer questions", "shopper questions" or "shopping questions", on the
website, the free check, the free tools, the video and the ads. It reads better to store owners. (The in-app screen is
still called "Questions".)

## Waitlist mode (12 Oct 2026, Ross: "start to run Meta ads to get sign ups")

The website no longer offers the 7-day free trial or an install. Every sign-up button opens one popup,
`46-waitlist.*`, which saves name + email to `geo.WaitlistSignup` through `POST /waitlist`
(`app/lib/waitlist.server.ts`).

- **Hero:** the link box is now one big button: "Get early access for your store" + **Join the waitlist**. No line under it
  (Ross removed "Free to join. We’ll reach out shortly." on 13 Oct 2026).
- **Nav:** **Join the waitlist** (phones: **Join waitlist**). **Closing CTA:** "Join the waitlist and be first to get GEO
  for your store. Free to join." + **Join the waitlist**.
- **Pricing:** both cards' buttons say **Join the waitlist** (the card's plan and the Monthly / Yearly choice are saved
  with the signup). Foot line: "Join the waitlist today. We’ll reach out shortly."
- **FAQ "what's free":** "Joining the waitlist, our free tools and the first scan of your store."
- **Popup:** heading **Join the waitlist** only (Ross: no line under it), Name, Email, **Join the waitlist**, small line
  "We’ll only use this to contact you about GEO." (saved with each signup). Done screen: tick, **You’re on the
  waitlist!**, "Thanks, {first name}. We’ll reach out shortly.", **Done**, confetti from the top of the screen (not with
  reduced motion).
- **Where they came from:** utm_* tags, fbclid and the referring site are saved with each signup, and a Meta pixel
  "Lead" event fires on success once the Meta pixel is on the page (not added yet).
- `/waitlist` and any address ending in `#waitlist` (or the old `#check`) open the popup.
- The free check page, its report email and PDF, and llms.txt point to the waitlist too ("Join the GEO waitlist").
  The app's own Shopify billing (trial included) is unchanged.

## 0. Read this first

### The one thing a skimmer must get

GEO helps get **your products and brand recommended** when shoppers ask ChatGPT, Gemini, Perplexity
and Google's AI what to buy, and counts the sales it can trace back to AI. Every section heading carries part of
this. Vary the verb (recommend, name, pick, suggest) so it never reads like a slogan. Always "helps" or
"can": never "guarantees", "will rank" or "#1".

### The big message (one paragraph)

Shoppers already ask AI what to buy: roughly 50 million questions a day on ChatGPT alone, by our 2025
estimate [source: F2-est]. Each answer recommends a few stores and links to them. That recommendation
isn't an ad, and it isn't for sale. AI picks stores from what it can read about their products and from
the sites that mention them. GEO shows whether your store is in those answers, writes fixes for you to
approve, and counts the orders it can trace back to AI. No ad spend.

### How the page tells it (let the reader connect the dots)

1. **The fact:** shoppers ask AI, and AI already sends stores orders (hero, Why now).
2. **How GEO gets you picked:** the method, on your store and across the web (How it works).
3. **The proof it's money:** the dashboard with AI revenue, orders and clicks (See the money).
4. **Their own numbers:** the slider. We show the sum. They decide what's realistic.
5. **The price, the questions, the free check:** Pricing, FAQ, closing CTA.

We never state the conclusion. We show the facts and their numbers, and ask the question. They answer
it.

Formatting note for the build: use curly apostrophes and quotes in the HTML. The deck uses straight ones
for easy editing.

### Source tags

Every number in this deck has a `[source: X]` tag. For the designer:

- **F tags** are external facts. They must show on the page as a visible source link (a small source
  line under the stat, or a superscript link) pointing at the URL below.
- **P, T and FC tags** are our own product facts. Don't show the tag. It's there so a checker can verify
  the line. (T tags were for the Proof section, which is no longer on the home page.)
- **[SAMPLE]** marks sample data inside a mockup. The mockup frame needs the "Sample data" tag.

| Tag | What | Date | Link to |
|---|---|---|---|
| F1a | ChatGPT gets about 2.5 billion messages a day | Jul 2025 | https://techcrunch.com/2025/07/21/chatgpt-users-send-2-5-billion-prompts-a-day/ |
| F1b | 18 billion messages a week, 700 million weekly users | Jul 2025 (paper Sep 2025) | https://cdn.openai.com/pdf/a253471f-8260-40c6-a2cc-aa93fe9f142e/economic-research-chatgpt-usage-paper.pdf |
| F2 | 2.1% of ChatGPT messages are about products or services to buy (say "about 2%") | May 2024 to Jun 2025 | https://www.emarketer.com/content/chatgpt-minimal-influence-on-ecommerce-sales-for-now (and the OpenAI paper above) |
| F2-est | Our estimate: 2.5 billion × 2.1% = roughly 50 million a day | 2025 | Footnote with both links above (F1a + F2) |
| F3a | 1.2 billion ChatGPT weekly users | Sep 2026 | https://openai.com/index/devday-2026-recap/ |
| F3b | 900 million ChatGPT weekly users | Feb 2026 | https://openai.com/index/scaling-ai-for-everyone/ |
| F4a | Google AI Overviews: over 2.5 billion monthly users | May 2026 | https://blog.google/innovation-and-ai/sundar-pichai-io-2026/ |
| F4b | Google AI Mode: over 1 billion monthly users; "billions of clicks to websites every week" | Jul 2026 | https://blog.google/company-news/inside-google/message-ceo/alphabet-earnings-q2-2026/ |
| F4c | Gemini app: over 1 billion monthly users | Aug 2026 | https://blog.google/innovation-and-ai/products/gemini-app/one-billion-monthly-users/ |
| F5a | Triple Whale merchants: 424,000+ AI-referred orders in Q4 2025 vs just over 7,000 in all of 2024 ("nearly 60x") | Jan 2026 | https://www.prnewswire.com/news-releases/triple-whale-acquires-anteater-to-expand-ai-powered-commerce-intelligence-302664733.html |
| F5b | Shopify: orders from AI search 15 times higher than in January 2025 | Feb 2026 | https://www.cp24.com/news/canada/2026/02/11/shopify-reports-us743m-q4-profit-revenue-up-31-per-cent-from-year-ago/ |
| F5c | Adobe, US retail: AI visits convert 60% higher, 53% more revenue per visit; AI traffic +1,219% since Oct 2024 | Jul 2026 data | https://www.digitalcommerce360.com/2026/08/19/adobe-ai-referral-traffic-data-july-2026/ |
| F5d | Exploding Topics, 1,009 US consumers: 77.6% used AI to shop in 6 months (say 77%), 43.21% weekly (say 43%); 68.64% of AI shoppers bought something they otherwise wouldn't have (say 68%, rounded down) | Apr 2026 | https://searchengineland.com/new-data-77-use-ai-to-shop-nearly-1-in-3-wont-let-it-spend-475614 |
| F6 | ChatGPT ads (Free and Go plans, below the answer, labelled, live in AU/NZ; advertisers can't shape the answer). Google ads can show within AI Overviews in AU/NZ | 2026 | https://help.openai.com/en/articles/20001047-ads-in-chatgpt, https://openai.com/index/chatgpt-ads-expands-southeast-asia-taiwan/, https://support.google.com/google-ads/answer/16297775?hl=en |
| P | Plans, prices, limits, setup time, how scans and attribution work, billing | `app/lib/plans.ts` (Standard and Done-for-you, Oct 2026; same as CLAUDE.md §3), CLAUDE.md §6, §8, §10, §15 | not shown |
| T1 | Live test: ChatGPT, Australia, "best beard oil for dry skin in Australia" | Oct 2026 | CLAUDE.md §17 (not on the home page) |
| T2 | Self-test: 24 of 24 answers back | 9 Oct 2026 | CLAUDE.md §18 (not on the home page) |
| FC | Free product check: 3 questions × 3 AI assistants × 2 runs = 18 answers, 3 new checks per visitor per 24 hours, kept 30 days | spec | `docs/free-check.md` |

### Words we use and avoid

| Say | Don't say |
|---|---|
| AI assistants, AI answers, ChatGPT & co | LLMs, AEO, GEO (as a method), generative engines |
| recommended, named, in the answer | ranked #1 (unless it's a real position in a mockup) |
| no ad spend (about GEO) | free (about GEO itself) |
| the recommendation inside the answer isn't for sale | AI has no ads, you can't pay to appear |
| questions, messages | shoppers, people (for the 50 million) |
| helps, can, if | guarantees, will, more sales (as a promise) |
| store owners, your store | merchants, brands (in headings) |
| 3 to 4, $20 to $300 | 3[en dash]4, $20[en dash]$300 |
| catalogue, optimised, labelled | catalog, optimized, labeled |

### Names (use these exact names everywhere)

| Name | First use on a page or screen |
|---|---|
| GEO | Our product. Never a method. |
| Standard, Done-for-you | Plan names (the app's internal ids stay `core` and `pro`). "GEO Standard" is fine in the slider line. The one-time Free scan is only inside the app, after install; the website shows the two paid plans. |
| free product check | The check on the website (no install). Short form in tight spots: "free check". |
| free scan | The one-time scan inside Shopify after install. Never mix it up with the free product check. |
| AI assistants | ChatGPT, Gemini, Perplexity, Google AI Overviews (and Claude on Done-for-you). |
| Google AI Overviews | First use: "Google's AI Overviews, the AI answer at the top of Google". |
| visibility score | Always explained: "a score out of 100 for how often AI names you". |
| baseline | Always explained: "your numbers from before you joined". |
| fixes, guide pages, outreach | As in the app. |

### Sample data names (all fictional, checked 10 Oct 2026)

Mockups tagged "Sample data" use made-up businesses only. The home page no longer shows any real brand
or competitor names (the Proof section is gone).

| In mockups | Use | Monogram |
|---|---|---|
| Sample store | **Coolabah Grooming Co.** | CG (single letter: C) |
| Store domain and email | **coolabahgrooming.com.au**, **owner@coolabahgrooming.com.au** | |
| Rival 1 (named most) | **Ridgeback Beard Co.** | RB (R) |
| Rival 2 | **Saltbush Beard Co.** | SB (S) |
| Rival 3 | **Banksia Beard Co.** | BA (B) |
| Rival 4 | **Wattlebird Grooming** | WG (W) |
| Outreach articles | **examplereviews.com**, **examplegiftguide.com.au**, **examplebeardblog.com**, **examplegrooming.com.au** | |

Order when an answer lists all four: Ridgeback Beard Co., Wattlebird Grooming, Banksia Beard Co. and
Saltbush Beard Co. Rankings by share of answers: Ridgeback, Saltbush, Banksia, you (4th), Wattlebird.

Real sites ChatGPT really cited in the live test (stuga.com.au, chemistwarehouse.com.au, bigw.com.au,
beardguru.com.au, reddit.com/r/beards) may appear in mockups as cited sites or "Sites AI trusts". Never
show a real site naming a sample brand or saying anything specific: no outreach target on a real site,
and no citation numbers that tie a sample brand to a real site.

Never use "Bondi Beard Co." (ChatGPT now names a real brand with that name) or the real brands from the
live test (The Groomed Man Co, A Better, Bold & Bare, Milkman) in sample data.

---

## 1. Page meta (`assemble.mjs`)

- **Title:** GEO · Get your products recommended by AI (not the headline: next to "GEO" in a tab or search result, "free sales channel" would read as GEO being free)
- **Meta description:** Shoppers ask ChatGPT, Gemini and Perplexity what to buy. GEO helps your Shopify
  products get recommended in those AI answers, then counts the orders it can trace back to AI.
- **Logo aria-label (nav and footer):** GEO, back to top

---

## 2. Page outline (lean page, 10 Oct 2026)

Ross: "Remove like 70% of the words. It needs to be super easy to skim and see how it makes my users more
money." The page went from 5,716 visible words to about 750. **Budget: 1,000 words for the whole page.**
Headlines up to about 8 words, supporting lines up to about 15. Prefer numbers, pictures and white space
to sentences. Each section says one thing; don't repeat another section's job.

| # | Part | File | id | Job |
|---|---|---|---|---|
| 1 | Nav | `10-nav.html` | | 3 links + free check button |
| 2 | Hero | `11-hero.html` | `overview`, form `check` | Headline, "Like SEO" line, free check, slogan, 3 story cards |
| 2b | Watch a free check | `11v-video.html` | `watch` | 47-second recording of a real check (made-up store) |
| 3 | Engines strip | `12-engines.html` | | Which AI we check |
| 4 | Why now | `12w-why.html` | `why` | Three big numbers with sources |
| 5 | How it works | `20-how.html` | `how` | GEO's method in five steps: find where AI looks, let AI read your store, product pages AI can quote, guide pages kept fresh, get named where AI looks |
| 6 | See the sales | `20m-money.html` | `money` | Clickable sample app: Money, Questions, Fixes, Rivals |
| 7 | What's it worth | `20w-worth.html` | `worth` | Two sliders and the sum |
| 8 | Pricing | `42-pricing.html` | `pricing` | Monthly / Yearly switch, two cards, 6 bullets each |
| 9 | FAQ | `43-faq.html` | `faq` | Six questions in the chat, "What does GEO actually do?" first |
| 10 | Closing CTA + footer | `45-cta-footer.html` | `contact` | Back to the free check |

Removed on 10 Oct 2026 (don't bring back without asking Ross): How AI decides (`12y-decide`), Meet GEO
(`13-meet`), stats band (`14-stats`), the six-screen app tour (`21-screens`), guardrails (`30-guardrails`,
now three chips in How it works), fix engine (`31-fixengine`), the old How it works (`32-how`), Proof
(`40-proof`), connections (`41-hub`) and guide pages (`44-guides`).

No eyebrow label chips above the section headings (they repeated the H2). Each message is said once:
the ~50M number only in Why now; "no cost per click" in hero card 3 (and FAQ 5 lists the clicks as free);
"counts the orders it can trace back to AI" in the meta description; FAQ 2 explains how we trace them.

---

## 3. Nav (`10-nav.html`)

- Links: **How it works** (`#how`) · **Pricing** (`#pricing`) · **FAQ** (`#faq`).
- Button: **Check a product free** (`#check`). Under 400px: **Free check**.

---

## 4. Hero (`11-hero.html`, id `overview`)

- **Pill** (plain label, not a link): **Worldwide** For Shopify stores
- **H1 (fixed):** The free sales channel `<br class="hero-br">` your store is missing
- **Line:** **Like SEO, but for ChatGPT's answers.** (the comparison line, its own line in navy) GEO helps AI
  recommend your products, then shows the sales you can trace back to AI. (Was: "GEO helps your products get
  recommended in ChatGPT, Gemini and Perplexity answers, then shows the sales you can trace back to AI." "Built for
  Shopify" is left out because the pill right above already says "For Shopify stores".) (Honesty rule: every line about sales keeps "can trace", never "the sales
  AI sends".)
- **Free check form** (`#check`, posts to `/check`): placeholder "Paste your product link" in the page (it
  fits phones, also without JavaScript); wider screens swap in "Paste a product link, e.g.
  yourstore.com/products/...". Button **Check my product** (busy: "Starting your check…"). No country
  picker: the check works out where the store is. A soft light travels slowly round the link box.
- **Under the form:** See if AI recommends your product. Free, no sign-up. ("usually a few minutes" went to make room
  for the video; the check page says how long it takes.)
- **Slogan** (over the three cards, their title; also the footer line): **Shoppers ask. AI recommends. You get the
  sale.** Its three beats are the three cards. Use it in these two places only.
- **Cards:**

| Card | Title | Line |
|---|---|---|
| 1 | Shoppers ask AI | They ask ChatGPT & co what to buy. |
| 2 | AI picks a few brands | GEO helps make yours one of them. |
| 3 (tag "Example") | You get the sale | No cost per click. |

Card 3 rows: Named by ChatGPT · Top 3 / Click from chatgpt.com · $0 / New order $34 · Tracked.
Card lines stay at 8 words or fewer. On phones (760px and below) the cards sit in one sideways row
(swipe, the next card peeking in), so the engines strip starts within about one screen.

---

## 4b. How GEO can increase your sales (`11v-video.html`, id `watch`)

- **H2 (small):** How GEO can increase your sales (was "What you get when you join" until 13 Oct 2026)
- Since 13 Oct 2026 a silent, looping 45 s **explainer** in the feel of a product launch film Ross shared: one to
  five words at a time, dark and pastel scenes taking turns, one simple picture per idea. Every scene and line is
  in `docs/video/explainer.md` (code `design/video/src/explainer/`). The story: Shoppers don’t just Google
  anymore. They ask (a chat window) AI. AI then picks a few brands. Is yours one of them? Introducing GEO (Get recommended by AI).
  We ask the top AIs / buying questions about your product · We see who AI picks · We rewrite your product pages (Approve, Live on your store) · We
  write buying guides · We ask the sites AI trusts / to list your brand (a pitch flies to each example site, "Pitch sent", one
  adds the store as "NEW", "3 pitches sent") · You see the sales from AI ($4,280, 37 orders,
  612 clicks) · Shoppers ask. AI recommends. You get the sale. · Unlock the free sales channel usegeo.app · logo. Made-up store
  and sample numbers, with "Example" tags. The old member tour (`storyboard.md`) is retired.
- **aria-label:** Short explainer, with a made-up store and sample numbers: shoppers don’t just Google anymore,
  they ask AI, and AI then picks a few brands. Every week GEO asks the top AIs buying questions about your product
  and sees who they pick.
  It rewrites your product pages when you approve, writes buying guides, asks the sites AI trusts to list your
  brand and shows you the sales from AI. AI answers can take weeks or months to catch up.
- **Button labels:** Play the video · Pause the video
- Files in `design/overview/img/`: `explainer.mp4` / `.webm` (1280×800) and `explainer-poster.jpg` (frame 1112,
  the money scene). Desktop only: the section is hidden on phones.
- Loads only near the screen, plays muted and looped, pauses off screen; one small pause button. Reduced motion:
  never starts by itself (poster and a big play button). No JavaScript: the browser's own controls.

---

## 5. Engines strip (`12-engines.html`)

Changed 13 Oct 2026 (Ross's reference video: flag coins going round a tilted ring). The logos are now 3D coins
going round a ring, the front one biggest, one turn every 18 seconds. Pauses off screen; with reduced motion the
coins stay still, ChatGPT in front. Logos from lobe-icons (MIT). Ross asked for Copilot and Meta AI too (same
day): GEO doesn't check their answers, but counts the sales they send, so the line under the ring says so.

- **Coins:** ChatGPT (black), Gemini (white), Claude (orange), Copilot (white), Perplexity (teal), Google (white),
  Meta AI (Meta blue, Meta's logo). Shopify is not in the ring: it isn't an AI shoppers ask.
- **Title:** The AI your shoppers ask
- **Line under it:** We check ChatGPT, Gemini, Perplexity and Google AI Overviews every week, plus Claude on
  Done-for-you. Sales from Copilot and Meta AI count too.

---

## 6. Why now (`12w-why.html`, id `why`)

- **H2:** AI sales are exploding (white text on a purple band)

| Big number | Label | Source line (links) |
|---|---|---|
| ~50M | buying questions a day on ChatGPT | Our 2025 estimate: 2.5B messages × 2.1% (OpenAI) [F1a, F2] |
| nearly 60× | more orders from AI, Q4 2025 vs all of 2024 | Triple Whale stores, Jan 2026 [F5a] |
| 60% | higher conversion from AI visitors | Adobe, US retail, July 2026 [F5c] |

---

## 7. How it works (`20-how.html`, id `how`)

Rewritten 11 Oct 2026. Ross: the old three cards (see it, fix it, see the money) repeated the hero cards and the
sample app, so this section now shows **GEO's method**: the steps GEO really takes, checked against the code, in the
order it works. Two kinds of work, each shown once as a band label: changes **On your store** (steps 2 to 4) and
getting named **Across the web** (step 5). It must not repeat the hero cards, the money numbers or the sample app's tabs.

- **H2:** How GEO works to get you recommended ("works to" on purpose: a method, not a promise. Alternative:
  "What GEO does to get you recommended". Not "How GEO gets you recommended", which reads as a promise.)
- **Intro line (12 Oct 2026):** We do the work. You click approve, or on Done-for-you we do that too.

Clarity pass, 12 Oct 2026 (Ross: make every step we do for them clear). Each step now has a fuller line saying exactly
what we do, and a grey **Your part:** line saying what the store does and what Done-for-you takes over. Step 3 lists the
exact changes. A sixth step, **Check again every week**, closes the loop (the optional sixth step below, now built). The
old 220-word cap is lifted for this pass: clarity over brevity, at about 330 visible words.

Word cut, 12 Oct 2026 (Ross: simpler words, half as many). 316 visible words (screens left out) down to 153. Each step
is now a title, one short line and a **You:** line (the store's part on Standard; the intro line covers Done-for-you).
Step 3's list is gone (the line names titles, descriptions and FAQs). The table below is the current copy.

Same day, Ross: the grey **You:** boxes looked ugly, so they are gone. Each step is a title and one line; the intro line
says who does what. The **You:** column below is kept as notes only (not shown).

Layout (built 11 Oct 2026): a numbered timeline (`ol`), navy numbers on one grey rail. Each step: title, one line and
one small screen tagged **Example** (made-up store and sites from the sample data list; `role="img"` with the
description below). Steps 2 to 4 sit in one outlined band whose label **On your store** sits on its top edge; step 5
in a band labelled **Across the web**. So the "Tag" column below shows once per band, not on every step. Wide screens
(1280px and up): heading and safeguard chips on the left (they stay in view while scrolling), steps on the right
with the words left of each screen. Tablets: heading centred above, chips under the steps. Phones: the screen
under the words, the rail on the left.

| # | Tag | Title | Line | You: | Mini screen (exact labels) | Screen description (aria-label) |
|---|---|---|---|---|---|---|
| 1 | | Find where AI looks | We ask AI your buyers' questions and see who it picks. | pick the questions. | A question chip **beard oil under $40**; under it three source chips, each with an AI's colour dot: **examplereviews.com**, **examplebeardblog.com**, **reddit.com** | Example: for "beard oil under $40", each AI uses different sites, such as examplereviews.com, examplebeardblog.com and reddit.com. |
| 2 | On your store | Let AI read your store | We check AI isn't blocked from your store. | a quick fix, if needed. (The app has no theme access, so the store makes this fix on every plan.) | Three rows: **ChatGPT** (tick), **Google** (tick), **Perplexity** with an amber pill **Blocked** | Example: ChatGPT and Google may read your pages; Perplexity is blocked, so GEO shows how to fix it. |
| 3 | On your store | Rewrite your product pages | Clear titles, descriptions and FAQs that AI can quote. | click approve. | A product page: chip **Type: Beard Oil**, first line highlighted **For dry beards. 30ml.**, grey lines, then **FAQ** with three closed questions | Example: a product page that opens with who it's for and its size, with a product type and FAQs. |
| 4 | On your store | Write buying guides | Guides like "Best beard oil for dry skin", kept up to date. (Reviewed every 60 to 90 days, updated when needed.) | click approve. | A guide page with the stamp **Updated October 2026** (the app's own wording), linked to two smaller guide pages | Example: a buying guide marked "Updated October 2026", linked to two more specific guides. |
| 5 | Across the web | Get you on sites AI trusts | We find sites AI uses that skip you, and write pitches. | send them. | Four rows, icon, kind and next step: **Roundup** · **Pitch drafted**; **YouTube** · **Review request**; **Reddit** · **You join in**; **Directory** · **Add listing** | Example: pages AI cites that skip you, each with an honest next step: a pitch, a review request, a thread you join yourself, a listing. |
| 6 | | Check again every week | We check again, show your AI sales, and fix what's left. | nothing. | Three rows: **Asked AI again** (tick), **New fixes ready** · **3**, **Next check** · **Monday** | Example: this week's check is done, 3 new fixes are ready, and the next check is on Monday. |

Safeguard chips (under the heading on wide screens, under the steps on tablets and phones): **One-click undo** ·
**Only your store's facts** · **No fake reviews or posts**. (Review 11 Oct: "You stay in control" cut as vague; the
undo chip carries it and the FAQ answer "Will GEO change my store without asking?" explains approval. Never "You
approve every change": Done-for-you applies fixes for the store.)

Optional sixth step, only if the layout wants a 3 × 2 grid: **Repeat
every week** · "We ask again weekly, daily on Done-for-you, and work on what's still missing." · mini screen **Next
check: Monday**. About 20 more words.

Words: 164 visible words by `wordcount.py` after the review (172 as first built; the old section had 116; each band
label shows once instead of a tag on every step), so the page grows by 48; Ross asked for the method to be explained.
Never more than 220 for this section.

Colour (14b): the one purple focal point is the highlighted opening line in step 3. Step numbers and ticks navy,
"Blocked" the existing amber pill, the "Updated" line the green status pill, band labels, tags and chips grey.

Honesty notes for this section (checked in the code, 11 Oct 2026):
- GEO checks robots.txt weekly and shows the fix; it can't edit the theme, and firewall blocks don't show in
  robots.txt. Never say "we unblock you".
- A guide is reviewed after 90 days (Standard) or 60 (Done-for-you) and only updated when its facts or questions
  changed. Never say every guide is updated every 60 days. Product FAQs are refreshed too, but only guides show an
  "Updated" date.
- Reddit and forum threads: the store joins in as itself. GEO never writes or posts for the store, never writes
  reviews (review sites: claim the free profile). Done-for-you's team sends pitches and review requests, adds listings
  and follows up, starting after the trial; threads stay with the store.
- No rankings, sales or timing promised. The FAQ answer "Will GEO change my store without asking?" covers approval.

## 8. See the sales (`20m-money.html`, id `money`)

- **H2:** See the sales you can trace back to AI · hint chip **Try the app** (shown only when the app works,
  i.e. with JavaScript)
- **Clickable sample app** [SAMPLE], tag **Sample data**, store Coolabah Grooming Co. Four tabs:
  - **Money** ("Money from AI", switch "Last 4 weeks / Since joining"): AI revenue A$4,820 / A$17,350,
    AI orders 61 / 224, AI clicks 1,940 / 7,310, "▲ Change vs your starting point" (not on phones); By
    source bars; Visibility score 38/100, "How often AI names you".
  - **Questions** (panel title **Does AI name you?**, "Asked every week", first column header "Pick a
    question"): three buying questions with a named / not named mark per AI. A row shows its first AI's
    answer; each mark shows that AI's answer (9 short sample answers) with "You're #1/#2/#3" or "Not
    named". The beard wash question has **See GEO's fix**.
  - **Fixes** (badge 2): before/after product description, "Why: AI can now tell who it's for. Only
    facts from your page." **Approve** turns into "Pushed to Shopify" with Undo and "GEO asks AI again on
    Monday."; the badge drops to 1 and the beard wash question in Questions gets "Fix live. Re-checked
    Monday". Undo puts it all back. Under it, the next fix waiting: FAQ block · Beard Balm 60g · Waiting.
  - **Rivals** ("How often AI names each brand"): Ridgeback, Saltbush, you, Banksia.

---

## 9. What's it worth (`20w-worth.html`, id `worth`)

- **H2:** What are extra AI orders worth?
- **Sliders:** Average order value ($20 to $300, default $80) · Extra orders a month from AI (1 to 50, default 2,
  kept low so the default never reads as a promised return next to the price)
- **Result:** **$160** a month in sales · **$1,920** a year. The sum "2 orders × $80 = $160 a month, or $1,920 a
  year." is for screen readers only (the live region). The clay coins are hidden on phones.
- **Line:** GEO Standard is US$49 a month. You decide what's realistic for your store. [source: P]

---

## 10. Pricing (`42-pricing.html`, id `pricing`)

Prices decided by Ross, Oct 2026 [source: P]. Two paid plans only: no cheaper starter plan, and no Free scan card
(the free product check is the website's way in; the one-time Free scan still exists inside the app as a safety
net for stores that install without starting a trial).

- **H2:** Simple pricing
- **Switch:** Monthly | Yearly, with a small "3 months free" badge inside the Yearly button. Two real buttons with
  `aria-pressed` in a frosted pill; `42-pricing.js` swaps each card's price, period and the small line under it
  (both texts live in `data-m` and `data-y`), and a hidden live region says "Yearly prices shown". Without
  JavaScript the switch stays hidden and the cards show monthly prices with the yearly price as a small line.
- Buttons link to `#pricing` in the design; the live build turns them into `/auth/login`. Only Standard's button is
  filled; Done-for-you has an outline button.

| | Standard (indigo card, badge "For most stores", edge light on hover) | Done-for-you (white card) |
|---|---|---|
| Monthly | **US$49** a month · small line: Or US$441 a year. | **US$349** a month · small line: Or US$3,141 a year. |
| Yearly (switch) | **US$441** a year · small line: About US$37 a month. 3 months free. | **US$3,141** a year · small line: About US$262 a month. 3 months free. |
| Line | You approve, AI does the work. | AI and our team do it for you. |
| Button | Start 7-day free trial (live: `/auth/login?plan=core&cycle=monthly`, cycle follows the switch) | Start 7-day free trial (`plan=pro`) |
| 1 | 50 buying questions, scanned weekly | 100 buying questions, scanned daily |
| 2 | ChatGPT, Gemini, Perplexity, Google AI Overviews | Also checks Claude |
| 3 | Unlimited fixes, one-click approve | Fixes applied for you, undo any time |
| 4 | 500 products, 2 guide pages a month | 2,000 products, 8 guide pages a month |
| 5 | Up to 10 pitches a month, drafted | Up to 40 pitches a month, sent and followed up |
| 6 | Monthly email report | Monthly report and a 30-minute call |

- **Under the cards:** Not sure yet? **Run a free product check first.** (link to `#check`) · Billed in US dollars
  through Shopify. Cancel any time.
- Yearly is exactly 9 times the monthly price (12 months for the price of 9), so "3 months free" is true. "About
  US$37" and "about US$262" are 441 ÷ 12 = 36.75 and 3,141 ÷ 12 = 261.75, rounded to the dollar.
- Honesty: no struck-through or "was" prices (Australian Consumer Law: only a price we really charged can be
  struck through), no "10x value", no savings claim beyond "3 months free", no promised results. The trial is
  Shopify's built-in 7-day free trial on both plans. GEO itself is never called free.
- Done-for-you's daily scan is the light one (1 run, no Claude); the full 2-run scan with Claude runs weekly. Its
  fixes are applied for the store, but risky claim types still wait for approval, and the store can switch this
  off and undo any change. A person (Ross or a VA) handles directory and roundup outreach where needed.
- Left off the cards to keep them short: the visibility score, the revenue dashboard (both plans have it) and the
  person behind Done-for-you outreach. All are in the app and in `app/lib/plans.ts`.

---

## 11. FAQ (`43-faq.html`, id `faq`)

- **H2:** Questions store owners ask
- Chat header: GEO assistant · "Answers written by the GEO team". No greeting. "What does GEO actually
  do?" starts open; the other five wait as question buttons, all five on show at once. Answers stay at
  about 25 words or fewer.

| Question | Answer |
|---|---|
| What does GEO actually do? (starts open) | It helps ChatGPT, Gemini and Perplexity recommend your products. It checks their answers, writes fixes and counts the sales it can trace back to them. |
| How do you know a sale came from AI? | ChatGPT usually adds `utm_source=chatgpt.com` to its links. We spot other AI visits too. Google AI Overviews can't be cleanly separated. |
| Can I pay to appear in AI answers? | Not on ChatGPT. OpenAI says ads can't shape its answers. Google sells ads in AI Overviews in many countries. GEO helps you earn the unpaid ones. Sources: OpenAI and Google Ads Help [F6] |
| Will GEO change my store without asking? | Not on Standard: you approve every change. Done-for-you makes them for you, except risky ones like product claims. Undo takes one click. |
| If GEO costs money, what's free? | The product check, the free scan after install, the 7-day free trial and AI's clicks. After that, Standard is US$49 a month. |
| How long does setup take? | About five minutes. Install from Shopify, tick your buying questions and the first scan starts. |

Dropped in the copy pass: "How does AI decide which stores to recommend?" (it overlapped with the new
first question; How it works step 2 now carries "so AI can pick you").

---

## 11c. Cookie notice (`47-cookies.html`, live page only)

Added 13 Oct 2026 with GEO's own Meta pixel (pixel-head.js, in the live page's head) for Ross's Meta ads. A small
card bottom left (full width on phones) until the visitor picks; the choice is kept in the browser.

- **Text (most of the world):** We use cookies to see which of our ads work. [Privacy]
- **Text (Europe and the UK, guessed from the time zone; the pixel waits for OK):** Can we use cookies to see which
  of our ads work? [Privacy]
- **Buttons:** No thanks · OK
- "Privacy" goes to `/privacy#cookies`, the section "Ads and cookies on our home page". Joining the waitlist sends
  Meta a "Lead" event, never the name or email.

---

## 12. Closing CTA and footer (`45-cta-footer.html`, id `contact`)

- **H2:** Is AI recommending your products?
- **Line:** Paste a product link to see if AI picks you. Free, no sign-up.
- **Button:** Check my product → `#check`
- **Footer:** logo · "Shoppers ask. AI recommends. You get the sale." (the slogan) · links How it works, Pricing, FAQ,
  Privacy (`/privacy` on the live site) · "© 2026 GEO · Made for Shopify stores worldwide"

---

## 13. Free product check page (`/check` and `/check/:id`)

Same palette and clay look as the home page: lilac gradient header area, navy text, cobalt accents
(replace the old blue `#3355ff` with cobalt `#4050B0`), navy buttons. Copy explains what each number means.
Strings live in `app/routes/check._index.tsx`, `app/routes/check.$id.tsx`, `app/components/check-ui.tsx`
and `app/lib/check-report.ts` / `check.server.ts` (owned by the app team; this is the copy to use).

### Meta

- `/check` title: **Free product check: does AI recommend your product? · GEO**
- `/check` description: **Paste a product link and see whether ChatGPT, Gemini and Perplexity recommend
  it, who they pick instead, and which sites they trust. Free, no sign-up.**
- `/check/:id` title: **Free product check: {product title} · GEO**
- `/check/:id` description (fallback): **Does AI recommend this product? A free check across ChatGPT,
  Gemini and Perplexity.**

### Header and footer

- Logo **GEO** (links to `/`), pill **Free product check**
- Footer: **GEO · Helps ChatGPT & co recommend your products · Privacy**

### Start page (`/check`)

**Headline:**
> Does AI recommend your product?

Alternates:
- When shoppers ask AI, is your product in the answer?
- What does AI say when shoppers ask about your product?

**Lead:**
> Shoppers ask ChatGPT, Gemini and Perplexity what to buy. Paste a product link to see if they
> recommend yours, and who they pick instead.

**Form:** same as the hero (Product link, **Check my product**, **Starting your check…**; no country
picker). Note: **Free. No sign-up. We ask ChatGPT, Gemini and Perplexity 3 questions, twice each, as a
shopper where your store is.**
[source: FC]

**Three cards:**
1. **Are you recommended?** · A score out of 100, and how often each AI names your brand.
2. **Who wins instead** · The brands AI picks for your buyers, and the websites it quotes.
3. **What to fix first** (was "Quick wins") · Plain-English steps to help AI recommend you, based only
   on its answers and your page.

**Explainer (new, small, under the cards):**
> Why we ask twice: AI answers change from one run to the next. Two runs give a fairer picture than one
> lucky, or unlucky, answer.

### Report page: product card

- Shows image, title, brand, price, domain.
- Line: **Checked as a shopper in {country} on ChatGPT, Gemini and Perplexity · 3 questions, each asked
  twice** [source: FC]

### Report page: running

- Before the product is read: **Reading your product…**
- Title: **Checking your product**
- Steps: **Reading your product** → **Writing buying questions** → **Asking ChatGPT, Gemini and
  Perplexity** → **Writing your report**
- Progress: **{done} of {total} answers in** (aria-label: **AI answers in**)
- **The questions we're asking** (list of the 3 questions once known)
- Note: **A check usually takes a few minutes. You can leave this page and come back to this link.**
  (No minute range until real check times are measured.) Button:
  **Refresh**
- New "while you wait" box (educational):
  - Heading: **What's happening now**
  - Text: **Each AI assistant gets the same 3 questions, twice. For every answer we note which brands it
    names, in what order, and which websites it links to. Those links show where AI gets its opinions.**

Designer notes: `clay-magnifier.jpg` (1:1) beside the steps on desktop, above them on mobile (max 160px).
Alt `""`. Progress bar fill cobalt on `#E2E2FC`.

### Report page: done

- Score ring: **{score}/100** with label chip. Labels from `scoreLabel`: Strong (60+), Growing (30 to 59),
  Weak (10 to 29), Invisible (under 10). Suggested kinder label for under 10: **Not named yet**
  (it's shared with the app, so change both or neither).
- Heading: **AI named {brand} in {n} of {m} answers**
- Summary line under it (generated, keep the current logic).
- New "what this means" line under the ring: **Full points when AI names you in its top 3, two-thirds when it
  names you lower down, one-third when it only links to your website, averaged across each AI assistant. 0
  means no AI named or linked to you.**
- Per AI assistant row: **Named in {x} of {total}** · when empty: **Didn't answer**
- No answers at all: **The AI assistants didn't answer this time** · **This happens now and then. Please
  run the check again in a few minutes.**

**Who AI recommends instead**
- Sub: **Share of answers that named each brand. These are the names your buyers hear first.**
- Your row label: **You**
- Empty: **AI didn't name any other brands for these questions.**

**Sites AI trusts for this**
- Sub: **Websites the AI linked to in its answers. Being mentioned on sites like these is one of the main
  ways brands get recommended.**
- Type chips (unchanged): Review site · Retailer · Forum or video · Brand site · Marketplace
- Own site chip: **You're on it**
- Empty: **The AI answers didn't link to any websites.**

**What we asked**
- Per question: engine cells **Named in {n} of {2}** · **No answer**
- Expandable: **See what the AI said** · badge when not named: **Doesn't name you** · when named: **#{position}**

**What to fix first** (heading; was "Quick wins")

Tip copy (in `buildTips`, keep the variables and the rules, no dashes):
- Not named anywhere: **AI doesn't mention {brand} yet** · None of the {n} answers named {brand}. AI
  assistants mostly recommend brands that review sites, retailers and forums already talk about, and whose
  product pages spell out clear facts.
- Missing on some AI assistants: **{list} {doesn't/don't} mention you yet** · You were named on some AI
  assistants but not on {list}. Each one reads different sites. The more places mention you, the more of
  them can find you.
- Short description: **Write a fuller product description** · Your description is only {n} characters.
  Say who it's for, what it's made of, the size and how to use it, so AI has facts to repeat.
- No description: **Add a product description** · We couldn't find a description on this page. AI
  assistants need facts to repeat: who it's for, what it's made of, the size and how to use it.
- No product data: **Add product data AI can read** · We didn't find structured product data (name, brand,
  price) on the page we read. Shopping assistants read this behind-the-scenes data.
- Editorial sites: **Get featured on {domains}** · AI cited {these review and roundup sites / this review
  site} {n} {time/times} in these answers. Getting your product into articles like these is one of the
  main ways brands get named.
- Rivals: **See why AI picks {rivals}** · {These brands / This brand} came up most. Compare their product
  pages with yours: AI often repeats the details they give, like who it's for, sizes and materials.
- Extra 1: **Keep an eye on it every week** · AI answers change often. Tracking the same questions every
  week shows whether you're gaining or slipping, and what to fix next.
- Extra 2: **Check more of the questions shoppers ask** · This quick check used 3 questions. Shoppers ask
  AI many more, and you may be missing from some of them.

**CTA card**
- Heading: **Help AI recommend you, every week**
- Text: **GEO Standard checks up to 50 buying questions every week, writes fixes that help AI recommend your
  products (you approve each one), and counts the orders it can trace back to AI.** [source: P]
- Price line: **Your first scan is free. Standard is US$49 a month after a 7-day free trial.** [source: P]
  (Plan name, price, questions and trial come from `app/lib/plans.ts`, so they follow any change there.)
- Button: **Install GEO: first scan free** (was "Install GEO free", which implies GEO itself is free)
- Link: **Check another product** (`/#check`)

**Honesty note**
> Answers change from run to run, so we ask twice. This quick check uses 3 questions. The app tracks up to
> 50 every week on Standard, or 100 every day on Done-for-you (asked twice on the weekly full scan). [source: FC, P]

### Failed, not found and limit messages

- Failed heading: **We couldn't finish this check** · default text: **Something went wrong on our side.
  Please try again.** (then the form)
- Report error: **We couldn't write this report. Please try again.**
- Not found (404): **We couldn't find that check** · **The link may be wrong, or the check is more than 30
  days old and was deleted. You can run a new one here.** [source: FC]
- Route error: **Something went wrong** · **Please try again in a minute, or start a new check.**
- Page unreadable: **We couldn't read that page. Please paste a public product page link.**
- Visitor limit (change: the current text promises "unlimited tracking", which no plan has; and the limit
  is a rolling 24 hours, not "today"; it counts per connection, failed tries included, and weekly tracking
  needs Standard): **This connection has reached the free check limit for now (3 checks in 24 hours). Try again
  tomorrow, or install GEO for a free scan of 10 questions.** [source: FC]
- Busy (both caps are rolling 24 hours, so no time promise): **We're very busy right now. Please try again
  later.**
- Honeypot / unknown: **Something went wrong. Please try again.**
- Fallback buyer question in `app/lib/check-read.ts` contains an em dash ("is {category} worth it
  [em dash] which brand should I pick in {country}"). Use: **which {category} brand is worth it in
  {country}**

---

## 14. Image map (home page)

| Image | Where | Alt |
|---|---|---|
| `clay-bubble.png`, `clay-bag.png` | Hero, floating beside the cards; `clay-bubble.png` also by the FAQ chat | `""` |
| `clay-coin.png` | Hero card 3, "New order" row | `""` |
| `clay-magnifier.jpg` | Not on the home page any more; the free check pages still use it (copied by `assemble.mjs`) | |
| `explainer-poster.jpg` | How GEO can increase your sales (poster of the video) | the video has an aria-label |
| `clay-coins.jpg` | What's it worth (no frame, edges fade into the band; hidden on phones) | `""` |
| `clay-storefront.jpg` | Closing CTA card | `""` |

No longer used on the home page: `clay-answer.jpg`, `clay-support.jpg`, `guide-*.jpg` (they stay in
`design/overview/img/`; the build only copies used images to `public/home/img/`).

---

## 14b. Colour (11 Oct 2026, Ross: "too much of the purple highlight colour")

Purple (lilac, periwinkle, cobalt) is a highlight for the main point only. Kept purple: the hero band (the brand
moment), the link form and its glow, the logo, the Standard card and its badge, the closing call-to-action card, and
one key element per section (Why now: the middle number "nearly 60×"; How it works: the highlighted opening line in
step 3; the sample app: its data bars and line only; What's it worth: the result box with $160; FAQ: the asked
question as a light cobalt bubble). Everything else is neutral: sections on white or the very light warm grey
`--warm-50`, white cards with a thin light grey line (`--line-soft`) and a soft neutral shadow, grey chips and tags,
navy links with an underline, navy step numbers and ticks. Focus rings stay cobalt.

## 15. Final checks before shipping

- [ ] Whole page 1,050 words or fewer (`wordcount.py` over the parts).
- [ ] Headline reads exactly "The free sales channel your store is missing".
- [ ] No em dashes and no spaced en dashes in `design/overview/index.html` or `app/home/home.html`.
- [ ] Every `href="#..."` points at an id on the page.
- [ ] Every number shows a small source link (Why now, FAQ ads answer).
- [ ] 50 million is "our 2025 estimate". Triple Whale is "nearly 60×, Q4 2025 vs all of 2024", its own
      stores. Adobe is US retail.
- [ ] The dashboard mockup has "Sample data"; hero card 3, the How it works screens and the video have "Example".
      Only fictional names.
- [ ] "Free" only describes the free product check, the free scan, the trial, or the AI clicks. GEO Standard is
      US$49 a month (or US$441 a year) after a 7-day free trial; Done-for-you is US$349 a month (or US$3,141 a year).
- [ ] No struck-through or "was" prices, no "10x", no savings claim beyond "3 months free".
- [ ] "Can't be bought" is said about ChatGPT only (Google sells ads inside AI Overviews in AU/NZ).
- [ ] No promises; GEO counts the orders it can trace back to AI.
- [ ] 390px wide: no sideways scroll. Reduced motion: the hero cards show their finished picture.
