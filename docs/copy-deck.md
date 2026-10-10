# Copy deck: home page and free product check (Oct 2026)

Written for the redesign in `docs/redesign-brief.md`. External facts come only from `docs/facts.md`.
Product facts come from `CLAUDE.md`. Sections 1 to 12 are the lean home page as built in
`design/overview/parts/*.html` (rewritten 10 Oct 2026: about 750 words, down from 5,716).

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
>    read it twice, rewrite it. Australian spelling: catalogue, optimised, labelled, colour, maths.
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
> 11. **Keep it lean.** The whole home page stays under 1,600 words. Headlines up to about 8 words,
>     supporting lines up to about 15. GEO "counts the orders it can trace back to AI", never "every order".

---

## 0. Read this first

### The big message (one paragraph)

Shoppers already ask AI what to buy: roughly 50 million questions a day on ChatGPT alone, by our 2025
estimate [source: F2-est]. Each answer recommends a few stores and links to them. That recommendation
isn't an ad, and it isn't for sale. AI picks stores from what it can read about their products and from
the sites that mention them. GEO shows whether your store is in those answers, writes fixes for you to
approve, and counts the orders it can trace back to AI. No ad spend.

### How the page tells it (let the reader connect the dots)

1. **The fact:** shoppers ask AI, and AI already sends stores orders (hero, Why now).
2. **How GEO makes money:** see who AI picks, fix it in one click, see the money (How it works).
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
| P | Plans, limits, setup time, how scans and attribution work, billing | CLAUDE.md §3, §6, §8, §10, §15 | not shown |
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
| Core, Pro | Plan names. "GEO Core" is fine in the slider line. |
| free product check | The check on the website (no install). Short form in tight spots: "free check". |
| free scan | The one-time scan inside Shopify after install. Never mix it up with the free product check. |
| AI assistants | ChatGPT, Gemini, Perplexity, Google AI Overviews (and Claude on Pro). |
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
| Outreach articles | **examplereviews.com.au**, **examplegiftguide.com.au**, **examplebeardblog.com.au**, **examplegrooming.com.au** | |

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

- **Title:** GEO · The free sales channel your store is missing
- **Meta description:** Shoppers ask ChatGPT, Gemini and Perplexity what to buy. GEO helps AI recommend
  your Shopify store, then counts the orders it can trace back to AI.
- **Logo aria-label (nav and footer):** GEO, back to top

---

## 2. Page outline (lean page, 10 Oct 2026)

Ross: "Remove like 70% of the words. It needs to be super easy to skim and see how it makes my users more
money." The page went from 5,716 visible words to about 750. **Budget: 1,600 words for the whole page.**
Headlines up to about 8 words, supporting lines up to about 15. Prefer numbers, pictures and white space
to sentences. Each section says one thing; don't repeat another section's job.

| # | Part | File | id | Job |
|---|---|---|---|---|
| 1 | Nav | `10-nav.html` | | 3 links + free check button |
| 2 | Hero | `11-hero.html` | `overview`, form `check` | Headline, one line, free check, 3 story cards |
| 3 | Engines strip | `12-engines.html` | | Which AI we check |
| 4 | Why now | `12w-why.html` | `why` | Three big numbers with sources |
| 5 | How it works | `20-how.html` | `how` | See it, fix it, see the money |
| 6 | See the money | `20m-money.html` | `money` | One dashboard mockup |
| 7 | What's it worth | `20w-worth.html` | `worth` | Two sliders and the sum |
| 8 | Pricing | `42-pricing.html` | `pricing` | Three cards, 4 bullets each |
| 9 | FAQ | `43-faq.html` | `faq` | Six questions in the chat |
| 10 | Closing CTA + footer | `45-cta-footer.html` | `contact` | Back to the free check |

Removed on 10 Oct 2026 (don't bring back without asking Ross): How AI decides (`12y-decide`), Meet GEO
(`13-meet`), stats band (`14-stats`), the six-screen app tour (`21-screens`), guardrails (`30-guardrails`,
now three chips in How it works), fix engine (`31-fixengine`), the old How it works (`32-how`), Proof
(`40-proof`), connections (`41-hub`) and guide pages (`44-guides`).

No eyebrow label chips above the section headings (they repeated the H2). Each message is said once:
the ~50M number only in Why now; "no cost per click" in hero card 3 (and FAQ 5 lists the clicks as free);
"the sales you can trace back to AI" only in the hero line (FAQ and the dashboard don't repeat it).

---

## 3. Nav (`10-nav.html`)

- Links: **How it works** (`#how`) · **Pricing** (`#pricing`) · **FAQ** (`#faq`).
- Button: **Check a product free** (`#check`). Under 400px: **Free check**.

---

## 4. Hero (`11-hero.html`, id `overview`)

- **Pill** (plain label, not a link): **AU & NZ** For Shopify stores
- **H1 (fixed):** The free sales channel `<br class="hero-br">` your store is missing
- **Line:** GEO helps ChatGPT & co recommend your products, then shows the sales you can trace back to AI.
- **Free check form** (`#check`, posts to `/check`): placeholder "Paste a product link, e.g.
  yourstore.com/products/..." (phones: "Paste your product link"), country (Australia, New Zealand, USA,
  UK, Canada), button **Check my product** (busy: "Starting your check…").
- **Under the form:** Free check. No sign-up. Results usually in a few minutes.
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

## 5. Engines strip (`12-engines.html`)

- **Title:** Checks the AI your shoppers ask, right inside Shopify
- **Logos:** ChatGPT, Gemini, Perplexity, Google AI Overviews, Claude (tag "GEO Pro", so it doesn't read as
  Anthropic's Claude Pro). Shopify is not in the row: it isn't an AI shoppers ask.

---

## 6. Why now (`12w-why.html`, id `why`)

- **H2:** AI is already sending stores orders

| Big number | Label | Source line (links) |
|---|---|---|
| ~50M | shopping questions a day on ChatGPT | Our 2025 estimate: 2.5B messages × 2.1% (OpenAI) [F1a, F2] |
| nearly 60× | more orders from AI, Q4 2025 vs all of 2024 | Triple Whale stores, Jan 2026 [F5a] |
| 60% | higher conversion from AI visitors | Adobe, US retail, July 2026 [F5c] |

---

## 7. How it works (`20-how.html`, id `how`)

- **H2:** How GEO helps you earn from AI

| Step | Image | Title | Line |
|---|---|---|---|
| 1 | `clay-magnifier.jpg` | See who AI picks instead | We ask ChatGPT, Gemini and Perplexity your buyers' questions every week. |
| 2 | `clay-shield.jpg` | Fix it in one click | GEO writes clearer product pages that AI can quote. |
| 3 | `clay-money.jpg` | See the money | Orders, revenue and clicks from AI, against your starting point. |

Safeguard chips, one centred row under the three cards (they replace the guardrails section):
**You approve every change** · **One-click undo** · **Never invents facts**.

---

## 8. See the money (`20m-money.html`, id `money`)

- **H2:** Your AI sales, in one screen (no lead line: the Sample data tag and the dashboard make the point)
- **Mockup** [SAMPLE], tag **Sample data**: Coolabah Grooming Co. · "Money from AI" · "Last 4 weeks" (a plain
  label, not a switch)
  - AI revenue **A$4,820** ▲ 38% · AI orders **61** ▲ 22% · AI clicks **1,940** ▲ 51% · "Change vs your starting point"
  - By source: ChatGPT A$2,640 · Perplexity A$880 · Gemini A$760 · Other A$540 · Total A$4,820
  - Visibility score **38**/100 ▲ 9 since joining · "How often AI names you"

---

## 9. What's it worth (`20w-worth.html`, id `worth`)

- **H2:** What are extra AI orders worth?
- **Sliders:** Average order value ($20 to $300, default $80) · Extra orders a month from AI (1 to 50, default 5)
- **Result:** **$400** a month · **$4,800** a year. The sum "5 orders × $80 = $400 a month, or $4,800 a
  year." is for screen readers only (the live region). The clay coins are hidden on phones.
- **Line:** GEO Core is US$49 a month. You decide what's realistic for your store.

---

## 10. Pricing (`42-pricing.html`, id `pricing`)

- **H2:** Simple pricing · **Line:** Billed in US dollars through Shopify. Cancel any time.
- Buttons link to `#pricing` in the design; the live build turns them into `/auth/login`. Only Core's
  button is filled; Free scan and Pro have outline buttons.

| | Free scan | Core (badge "Our pick") | Pro |
|---|---|---|---|
| Price | $0 one-time | US$49 a month · 7-day free trial | US$149 a month |
| Line | After install: see where you stand. | Track, fix and see the money. | Everything in Core, for bigger catalogues. |
| Button | Install and scan free | Start 7-day trial | Choose Pro |
| 1 | 10 buyer questions on 3 AI assistants | 25 buyer questions, tracked weekly | 100 buyer questions, scanned daily |
| 2 | Who AI recommends instead | ChatGPT, Gemini, Perplexity + Google | Adds Claude |
| 3 | AI sales from your last 60 days | 100 products, 30 fixes a month | 1,000 products, unlimited fixes |
| 4 | No fixes or ongoing tracking (dash, not tick) | Revenue dashboard and monthly report | Autopilot mode (opt-in) |

- The Free scan card says "After install" and "Install and scan free", so it can't be mixed up with the
  free product check (no install) in the hero and closing CTA.
- No line under the cards (the free clicks are already in hero card 3 and FAQ 5).
- Left off to keep 4 bullets: the visibility score (Free scan), the outreach finder (10 targets a month on
  Core, 40 on Pro). Both are still in the app and in CLAUDE.md §3.

---

## 11. FAQ (`43-faq.html`, id `faq`)

- **H2:** Questions store owners ask
- Chat header: GEO assistant · "Answers written by the GEO team". No greeting. The money question starts
  open; the other five wait as question buttons, all five on show at once. Answers stay at 25 words or fewer.

| Question | Answer |
|---|---|
| How do you know a sale came from AI? (starts open) | ChatGPT usually adds `utm_source=chatgpt.com` to its links. We spot other AI visits too. Google AI Overviews can't be cleanly separated. |
| How does AI decide which stores to recommend? | AI repeats facts from product pages and quotes sites it trusts. GEO helps with both. |
| Can I pay to appear in AI answers? | Not on ChatGPT. OpenAI says ads can't shape its answers. Google does sell ads inside AI Overviews in Australia and New Zealand. Sources: OpenAI and Google Ads Help [F6] |
| Will GEO change my store without asking? | No. Every change waits for your approval unless you turn on autopilot (Pro). Even then it skips risky changes, like product claims. |
| If GEO costs money, what's free? | The product check, the free scan and the clicks AI sends you. GEO Core is US$49 a month after a 7-day free trial. |
| How long does setup take? | About five minutes. Install from Shopify and tick the questions you care about. Your first scan runs in the background. |

---|---|
| How does AI decide which stores to recommend? | Nobody outside the AI companies knows the exact recipe. But the answers show their working: AI repeats facts from product pages and quotes sites it trusts, like roundups, retailers and forums. GEO helps with both. |
| Can I pay to appear in AI answers? | Not on ChatGPT. Its ads are labelled and sit below the answer, and OpenAI says advertisers can't shape it. Google does sell ads inside AI Overviews in Australia and New Zealand. GEO helps with the unpaid part. Sources: OpenAI and Google Ads Help [F6] |
| How do you know a sale came from AI? | ChatGPT links carry `utm_source=chatgpt.com`. We also spot visits from Perplexity, Gemini and other AI, plus AI sales channels. We count the orders we can trace. Google AI Overviews can't be cleanly separated, so we label them. |
| Will GEO change my store without asking? | No. By default every change waits for your approval, and undo is one click. Autopilot on Pro is opt-in, and it still skips risky changes like product claims. |
| If GEO costs money, what's free? | The product check on this page, the free scan after you install, and the clicks AI sends you: no cost per click. GEO Core is US$49 a month after a 7-day free trial. |
| How long does setup take? | About five minutes. Install from Shopify and tick the buyer questions you care about. Your first scan then runs in the background. No technical skills needed. |

---

## 12. Closing CTA and footer (`45-cta-footer.html`, id `contact`)

- **H2:** Is AI recommending your store?
- **Line:** Paste a product link and see who AI recommends. Free, no sign-up.
- **Button:** Check my product → `#check`
- **Footer:** logo · "Help AI recommend you, and see the sales." · links How it works, Pricing, FAQ,
  Privacy (`/privacy` on the live site) · "© 2026 GEO · Made for Shopify stores in Australia & New Zealand"

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
- Footer: **GEO · Get recommended by ChatGPT & co · Privacy**

### Start page (`/check`)

**Headline:**
> Does AI recommend your product?

Alternates:
- When shoppers ask AI, is your product in the answer?
- What does AI say when shoppers ask about your product?

**Lead:**
> Paste a product link. We ask ChatGPT, Gemini and Perplexity 3 questions a shopper might ask, twice
> each. Then we show who they recommend, which sites they trust, and what to fix first. [source: FC]

**Form:** same as the hero (Product link, Shopper country, **Check my product**, **Starting your
check…**). Note: **Free. No sign-up. We ask ChatGPT, Gemini and Perplexity 3 questions a real buyer
would ask, twice each.** [source: FC]

**Three cards:**
1. **Are you recommended?** · A score out of 100, and how often each AI names your brand.
2. **Who wins instead** · The brands AI picks for your buyers, and the websites it quotes.
3. **What to fix first** (was "Quick wins") · Plain-English next steps, based only on the AI answers
   and your product page.

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
- Steps: **Reading your product** → **Writing buyer questions** → **Asking ChatGPT, Gemini and
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
- Heading: **See this every week, with the fixes written for you** (alternate: **Track this every week and
  fix it in one click**, current)
- Text: **GEO Core checks up to 25 buyer questions every week, writes fixes for your product pages for you
  to approve, and shows the orders AI sends you.** [source: P]
- Button: **Install GEO: first scan free** (was "Install GEO free", which implies GEO itself is free)
- Link: **Check another product** (`/#check`)

**Honesty note**
> Answers change from run to run, so we ask twice. This quick check uses 3 questions. The app tracks up to
> 25 every week on Core, or 100 every day on Pro (asked twice on the weekly full scan). [source: FC, P]

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
  needs Core): **This connection has reached the free check limit for now (3 checks in 24 hours). Try again
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
| `clay-magnifier.jpg` | How it works step 1 (also the free check, running state) | Clay magnifying glass over a bottle of beard oil |
| `clay-shield.jpg` | How it works step 2 | Clay shield with a tick |
| `clay-money.jpg` | How it works step 3 | Clay chat bubble with shopping bags and gold coins spilling out |
| `clay-coins.jpg` | What's it worth (no frame, edges fade into the band; hidden on phones) | `""` |
| `clay-storefront.jpg` | Closing CTA card | `""` |

No longer used on the home page: `clay-answer.jpg`, `clay-support.jpg`, `guide-*.jpg` (they stay in
`design/overview/img/`; the build only copies used images to `public/home/img/`).

---

## 15. Final checks before shipping

- [ ] Whole page 1,600 words or fewer (`wordcount.py` over the parts).
- [ ] Headline reads exactly "The free sales channel your store is missing".
- [ ] No em dashes and no spaced en dashes in `design/overview/index.html` or `app/home/home.html`.
- [ ] Every `href="#..."` points at an id on the page.
- [ ] Every number shows a small source link (Why now, FAQ ads answer).
- [ ] 50 million is "our 2025 estimate". Triple Whale is "nearly 60×, Q4 2025 vs all of 2024", its own
      stores. Adobe is US retail.
- [ ] The dashboard mockup has "Sample data" and hero card 3 has "Example". Only fictional names.
- [ ] "Free" only describes the free product check, the free scan, the trial, or the AI clicks. GEO Core is
      US$49 a month after a 7-day trial.
- [ ] "Can't be bought" is said about ChatGPT only (Google sells ads inside AI Overviews in AU/NZ).
- [ ] No promises; GEO counts the orders it can trace back to AI.
- [ ] 390px wide: no sideways scroll. Reduced motion: the hero cards show their finished picture.
