# Copy deck: home page and free product check (Oct 2026)

Written for the redesign in `docs/redesign-brief.md`. External facts come only from `docs/facts.md`.
Product facts come from `CLAUDE.md`. Section order and layouts stay the same as
`design/overview/parts/*.html`, plus two new sections. Edited 10 Oct 2026 (senior edit pass).

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

---

## 0. Read this first

### The big message (one paragraph)

Shoppers already ask AI what to buy: roughly 50 million questions a day on ChatGPT alone, by our 2025
estimate [source: F2-est]. Each answer recommends a few stores and links to them. That recommendation
isn't an ad, and it isn't for sale. AI picks stores from what it can read about their products and from
the sites that mention them. GEO shows whether your store is in those answers, writes fixes for you to
approve, and counts the orders it can trace back to AI. No ad spend.

### How the page tells it (let the reader connect the dots)

1. **The fact:** shoppers ask AI, at huge scale (Why now).
2. **The mechanism:** how AI picks what to recommend (new section).
3. **The proof it's money:** AI visitors buy, and GEO counts the orders (See the money).
4. **Their own numbers:** the slider. We show the sum. They decide what's realistic.
5. **The tool:** screens, guardrails, fixes, setup, proof, price.

We never state the conclusion. We show the facts and their numbers, and ask the question. They answer
it.

Formatting note for the build: use curly apostrophes and quotes in the HTML. The deck uses straight ones
for easy editing.

### Source tags

Every number in this deck has a `[source: X]` tag. For the designer:

- **F tags** are external facts. They must show on the page as a visible source link (a small source
  line under the stat, or a superscript link) pointing at the URL below.
- **P, T and FC tags** are our own product facts. Don't show the tag. It's there so a checker can verify
  the line. T tags may link to the Proof section (`#proof`).
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
| T1 | Live test: ChatGPT, Australia, "best beard oil for dry skin in Australia" | Oct 2026 | CLAUDE.md §17, link to `#proof` |
| T2 | Self-test: 24 of 24 answers back | 9 Oct 2026 | CLAUDE.md §18, link to `#proof` |
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

---

## 1. Page meta (`assemble.mjs`)

- **Title:** GEO · The free sales channel your store is missing
- **Meta description:** Shoppers ask ChatGPT, Gemini and Perplexity what to buy. GEO shows whether AI
  recommends your Shopify store, writes the fixes, and counts the orders AI sends you.
- **Logo aria-label (nav and footer):** GEO, back to top (the current one has an em dash)

---

## 2. Nav (`10-nav.html`)

- Links: **How AI picks** (`#decide`) · **Screens** (`#screens`) · **How it works** (`#how`) ·
  **Pricing** (`#pricing`) · **FAQ** (`#faq`). (Drop "Overview": the logo already goes to the top.)
- Button: **Check a product free** (`#check`). Short version under 400px: **Free check**.

Designer: nav sits on the hero gradient. Links navy, active/hover cobalt `#4050B0`, button navy.

---

## 3. Hero (`11-hero.html`)

**Pill** (links to `#why`):
- Badge: **~50M**
- Long text: **shopping questions asked on ChatGPT every day (our 2025 estimate)** [source: F2-est]
- Short text (mobile): **shopping questions a day on ChatGPT** [source: F2-est]
- Alternate pill: badge **Nearly 60×**, text **AI orders at Triple Whale stores, Q4 2025 vs all of 2024**
  / short **AI orders, Q4 2025 vs 2024** [source: F5a]. (Was "~60×", which reads as "about" and can round
  up. The source says "nearly".)

**Headline (H1, Ross's choice, fixed):**
> The free sales channel your store is missing

Suggested line break on desktop: "The free sales channel / your store is missing".
Alternates (only for future tests):
- Shoppers ask AI what to buy. Is your store in the answer?
- AI recommends a few stores. Is yours one of them?

**Sub-line (lead):**
> Shoppers now ask ChatGPT, Gemini and Perplexity what to buy. Each answer names a few stores and links
> to them. Those stores don't pay for the click. AI picks them from what it can read about their
> products and the sites that mention them.

(Edit note: says who the clicks are free for and how stores get picked, without telling the reader
they're missing out. They connect "a free click, going to someone else" themselves.)

Alternates:
- Every day, shoppers ask AI assistants what to buy, and each answer recommends a handful of stores. The
  recommendation isn't for sale. It's earned from what AI can read about your products.
- Ask ChatGPT for the best product in your category. It names a few stores and links straight to them.
  None of them paid for that click.

**Free check form** (keep the form exactly as specified in `docs/free-check.md`):
- Field label (visually hidden): **Product link**
- Placeholder: **Paste a product link, e.g. yourstore.com/products/...**
- Country label (visually hidden): **Shopper country**. Options: Australia, New Zealand, USA, UK, Canada.
- Button: **Check my product**. While sending: **Starting your check…**
- Note under the form: **Free. No sign-up. We ask ChatGPT, Gemini and Perplexity 3 questions a real
  buyer would ask, twice each, and show you who they recommend.** [source: FC]
  (Was "3 real buyer questions": we write the questions, so "a real buyer would ask" is the honest
  wording.)
- Preview-only message (design preview, no server): **Live checks run on the GEO website.** Link:
  **Open it and paste your link there**
- Secondary link: **or first, see how AI picks what to recommend** (`#decide`)

**Hero dashboard mockup:** keep all sample data as is [SAMPLE] (A$4,820, 61 orders, 1,940 clicks, score
62, the three fixes). No label changes needed. Keep the "Sample data" tag.

Designer notes:
- Background: main gradient `linear-gradient(180deg, #EFECFD 0%, #E2E2FC 50%, #BFC9FA 100%)` with the faint
  grid on top. Headline and lead navy `#0B0C2B`. Pill badge cobalt on `#E1CCF7`.
- Floating clay decorations around the dashboard, small, `alt=""` and `aria-hidden="true"`,
  `mix-blend-mode: multiply`: `clay-bubble.png` above the top-left corner, `clay-coin.png` on the right
  edge next to the Money from AI block, `clay-bag.png` below the bottom-left corner. Hide two of the three
  under 600px so they don't crowd the form.

---

## 4. Engines strip (`12-engines.html`)

- Caption: **Checks the AI assistants your shoppers already use, from inside your Shopify admin**
- Alternate caption (with a number): **ChatGPT alone has 1.2 billion weekly users (Sep 2026). GEO checks
  it and the other big AI assistants, from inside your Shopify admin.** [source: F3a]
- Items unchanged: ChatGPT · Gemini · Perplexity · Google AI Overviews · Claude (Pro) · Shopify

---

## 5. Why now (`12w-why.html`): the education block

**Label pill:** Why now

**Headline:**
> Shoppers are already asking AI what to buy

Alternates:
- Roughly 50 million shopping questions a day. On ChatGPT alone. [source: F2-est] (needs "our 2025
  estimate" in the sub-line if used)
- The question "what should I buy?" has a new home

**Sub-line:**
> Here are the numbers, and where each one comes from. Then a question for your own store: when a
> shopper asks AI about your category, which stores does it name?

(Replaces the current lead, which ends "those sales go to someone else". That tells the reader the
conclusion. Ross wants them to reach it.)

### Lead card (wide, replaces the 60× card as the first and biggest card)

- Kicker: **On ChatGPT alone**
- Big number: **~50 million**
- Under it: **questions a day about things to buy (our 2025 estimate)** [source: F2-est]
- The working, as three chips joined by "×" and "=" (this is the point of the card: they see how we got
  there):
  1. **2.5 billion** messages a day [source: F1a]
  2. **× about 2%** about products or services to buy [source: F2]
  3. **= roughly 50 million** a day [source: F2-est]
- Footnote: **Our estimate from OpenAI's own figures: 2.5 billion messages a day (OpenAI, July 2025) ×
  2.1% about products or services to buy (OpenAI research, May 2024 to June 2025). These are messages,
  not people. One shopper can ask several.** Links: TechCrunch (F1a), eMarketer (F2), OpenAI paper (F1b).

Reach row inside the lead card (three mini stats, small type):
- **1.2 billion** people use ChatGPT every week (Sep 2026), up from 700 million in July 2025.
  [source: F3a, F1b]
- **Over 2.5 billion** people a month use Google's AI Overviews, the AI answer at the top of Google
  (May 2026). [source: F4a]
- **Over 1 billion** people a month use the Gemini app (Aug 2026). [source: F4c]

### Growth card (keeps the old 60× layout with the two bars)

- Kicker: **Orders from AI, Triple Whale stores**
- Big number: **nearly 60×** [source: F5a]
- Text: **In the last three months of 2025, stores using Triple Whale got over 424,000 orders straight from
  AI assistants. In all of 2024, it was just over 7,000.** [source: F5a]
- Bar 1: **All of 2024** · **12 months** · **just over 7,000** [source: F5a]
- Bar 2: **Oct to Dec 2025** · **3 months** · **424,000+** [source: F5a]
- Source line: **Triple Whale, orders referred by AI assistants across its own merchants. Announced
  Jan 2026 on PR Newswire.**
- Remove from the current card: the "50,000+ brands" line (not on the facts sheet), the bar label
  "~7,000" (use "just over 7,000") and "Oct[en dash]Dec 2025" (use "Oct to Dec 2025").

### Small stat cards (four)

1. **15×** · **more orders from AI search on Shopify than in January 2025.** [source: F5b]
   Source line: **Shopify president Harley Finkelstein, Feb 2026, via The Canadian Press**
2. **77%** · **of US shoppers surveyed had used AI to help them shop in the last six months. 43% use it
   every week.** [source: F5d]
   Source line: **Exploding Topics survey of 1,009 US consumers, Apr 2026, via Search Engine Land**
3. **68%** · **of those AI shoppers bought something they wouldn't have bought otherwise.** [source: F5d]
   Source line: **Same survey, Apr 2026, via Search Engine Land**
   (Edit note: the survey says 68.64%. We round down, never up, so 68%, not 69%. The old "68.5% use it
   for product research" line is cut: two near-identical numbers in one card read as a mistake.)
4. **60%** · **higher conversion rate for visits that come from AI. Those visits also bring in 53% more
   revenue each.** [source: F5c]
   Source line: **Adobe Analytics, US retail sites, July 2026, via Digital Commerce 360**

Optional fifth card (only if the grid needs it): **+1,219%** · **AI traffic to US retail sites since
October 2024.** [source: F5c] Source line: **Adobe Analytics, July 2026, via Digital Commerce 360**

### "Questions worth asking" strip (new, under the cards)

- Small heading: **Questions worth asking about your store**
- Three questions (in a row on desktop, stacked on mobile):
  1. **When a shopper asks AI for the best product in your category, which brands does it name?**
  2. **Which websites does it trust enough to quote?**
  3. **If AI visitors buy more often, what is one recommendation worth to your store?**
- Link: **Run a free check on one product** (`#check`)

**Honesty note (keep, rewritten):**
> Figures from OpenAI, Google, Triple Whale, Shopify, Adobe and Exploding Topics. The survey and
> conversion figures are US data. Triple Whale's figures cover its own merchants. None of these are GEO
> results. For most stores, AI is still a small share of visits, but it's growing fast.

Designer notes: white section. Lead card uses the main gradient (big feature card), numbers in cobalt
`#4050B0`, the three working chips on `#E1CCF7` with navy text. Other cards white with a `#B5A8E0`
hairline. Bars: 2024 bar `#BFC9FA`, Q4 2025 bar cobalt-mid `#6878D8`. No image in this section.

---

## 6. NEW: How AI decides what to recommend (new part, suggest `12y-decide.html`, id `decide`)

Sits between Why now and Meet GEO.

**Label pill:** How AI picks

**Headline:**
> How AI decides what to recommend

Alternates:
- What AI looks at before it names a store
- Why AI names some stores and not others

**Sub-line:**
> Nobody outside the AI companies knows the exact recipe. But AI answers show their working: they repeat
> details and cite their sources. Read enough of them, and three things keep coming up.

### Three cards

**1. What it can read about your product**
> AI repeats facts it can find: who the product is for, the size, the ingredients or materials, the
> price, where it ships. Shopping assistants also read the product details behind your page, like
> product type and size. If a detail isn't written down, AI can't repeat it.

Mini example inside the card (two lines, styled as a before/after, labelled **Example**):
- Hard for AI to use: **"Our best seller. Smells amazing."**
- Easy for AI to use: **"A light beard oil for dry skin. 30ml."**

**2. Whether you answer the question asked**
> Shoppers ask AI full questions, with details like "for dry skin", "under $80" or "ships to
> Australia". AI looks for pages that answer that exact question in plain words. Clear descriptions and
> FAQs do that job.

Mini example: three question chips: **for dry skin** · **under $80** · **ships to Australia**
(These are example phrases, not statistics.)

**3. Who else vouches for you**
> AI quotes sources it trusts: roundup articles, reviews, retailers and forums like Reddit. When we asked
> ChatGPT for the "best beard oil for dry skin in Australia", it named four brands. It cited a "best beard
> oil 2026" roundup, Chemist Warehouse, BIG W and Beard Guru. [source: T1]

Mini example: four domain chips **stuga.com.au** · **chemistwarehouse.com.au** · **bigw.com.au** ·
**beardguru.com.au**, caption **From our live test, Oct 2026** [source: T1]

### Strip under the cards: "What you can't buy"

- Heading: **What you can't buy: the recommendation itself**
  (Was "What it doesn't look at: your ad budget". Google sells ad slots inside AI Overviews in AU/NZ, so
  that heading went further than the facts.)
- Text:
> ChatGPT now shows ads on its Free and Go plans. They sit below the answer, they're labelled, and
> OpenAI says advertisers can't shape or rank the answer itself. Google can place ads above, below or
> within its AI Overviews in Australia and New Zealand. Ads can sit next to an answer. The
> recommendation inside the answer isn't for sale. [source: F6]

### Closing line

> That leaves three questions for your store. Can AI read what you sell? Do your pages answer what
> shoppers ask? Do the sites AI trusts mention you? GEO checks all three and helps with each.

(Was "So three questions decide whether your store gets named", which claims a recipe the sub-line says
nobody knows.)

Link: **See what GEO checks** (`#meet`)

Designer notes: soft background `#EFECFD`. Three white cards, 24px radius, each with a simple line icon in
cobalt (document, chat bubble with a question mark, star badge). The "can't buy" strip is a white card
with a cobalt left border. Optional small `clay-bubble.png` (multiply) beside the headline. No new photo
needed. Works as a 1-column stack at 390px.

---

## 7. Meet GEO (`13-meet.html`)

**Label pill:** Meet GEO

**Headline:**
> Where you stand, what to fix, and what it's worth

Alternates:
- Know where you stand. Fix the gaps. Count the sales.
- See who AI names. Fix what's missing. Count the orders.

**Sub-line (em dash removed):**
> GEO asks AI assistants the questions your buyers ask. It shows who gets recommended instead of you,
> writes fixes for you to approve, and counts the orders AI sends you. All inside Shopify.

**Card 1: How often each AI names you** (was "Visibility by AI assistant")
> See how often ChatGPT, Gemini, Perplexity and Google's AI Overviews name your store, scan after scan.

Mockup unchanged [SAMPLE]: "Named in answers", "Last 4 scans", Perplexity 64%.

**Tall card: Money from AI, live**
> The orders and revenue that came from ChatGPT & co, next to your baseline: your numbers from before
> you joined. Anything we can't be sure of is labelled.

Mockup unchanged [SAMPLE]: A$4,820, ChatGPT A$412 Thu 8 Oct, "Your baseline".

**Card 2: Who AI recommends instead**
> The brands named when you aren't, how often, and where you rank against them.

Mockup unchanged [SAMPLE]: "best beard oil for dry skin in Australia", The Groomed Man Co 7 of 8 ... A
Better 3 of 8.

Designer notes: section background white (or `#EFECFD` if Why now is white and Decide is lilac; alternate
so neighbours differ). Tall card gets the main gradient. Sample tags stay.

---

## 8. Stats band (`14-stats.html`, aria-label "GEO at a glance")

On the main gradient. Numbers cobalt, text navy.

1. **4** · **AI assistants checked on Core. Pro adds Claude.** [source: P]
2. **2×** · **Every question asked twice on each full scan. You see the average, not one lucky answer.**
   [source: P]
3. **1 click** · **to undo any change we make to your store.** [source: P]
4. **$0** · **for your first scan. No card needed.** [source: P] (Shopify bills apps on the store's
   Shopify invoice, so no card is entered.)

Alternate for 4: **$0 per click** · **for visits from AI answers. The recommendation isn't bought.**

---

## 9. See the money (`20-money.html`)

**Label pill (new):** Money from AI

**Headline:**
> See the money, not just mentions

Alternates:
- Mentions are nice. Orders pay the bills.
- Count the orders AI sends you

**Sub-line:**
> Being named by ChatGPT is a good sign. Orders are the proof. GEO checks every order and shows which
> ones started with an AI answer, so you can judge what AI is worth to your store.

**Tick list:**
- Orders, revenue and clicks from ChatGPT, Perplexity, Gemini and other AI assistants
- Revenue from the guide pages GEO builds, tracked with our own link tag
- Everything compared with your baseline: we look back over your last 60 days of orders when you
  install [source: P]

**Toast on the image:** **New order from ChatGPT** · `utm_source=chatgpt.com` (keep)

**Blue card: How we spot an AI sale** (em dash removed)
> ChatGPT adds `utm_source=chatgpt.com` to its links. We check every order for that tag, and for visits
> from Perplexity, Gemini, Copilot, Claude and other AI assistants.

**Chart card:** keep as is [SAMPLE]: "AI orders per week", "19 orders this week", "52% above your
baseline", "Before you joined 12.5 a week", "Since you joined 15 a week".

**Honesty line (new, small, under the chart or list):**
> Google's AI Overviews can't be cleanly separated from normal Google, so we show them separately and
> label them. We never claim every AI sale was caused by GEO.

Designer notes:
- Image: `clay-money.jpg` (4:5) replaces `team-laptop.jpg` in the same slot. Alt: **Clay illustration of
  a chat bubble with shopping bags and gold coins spilling out**. Toast stays overlapping its corner.
- Section background `#EFECFD`. Blue card becomes cobalt `#4050B0` with white text (check AA: white on
  `#4050B0` passes for body text).

---

## 10. NEW: What's it worth to you? (new part, suggest `20w-worth.html`, id `worth`)

Sits between See the money and the six screens. Vanilla JS, no library. Ross may remove it later.

**Label pill:** Do the maths

**Headline:**
> What's it worth to you?

Alternates:
- Your numbers, not ours
- Put your own numbers in

**Sub-line:**
> You know your store better than we do. Set your average order value and the number of extra orders a
> month you think is realistic. The sum is below.

**Slider 1**
- Label: **Average order value**
- Read-out: **$80** (updates live)
- Range: $20 to $300, step $5, default $80
- `aria-valuetext`: "$80" (format: "$" + number)
- Help text under it: **Not sure? Shopify shows it in Analytics.**

**Slider 2**
- Label: **Extra orders a month from AI**
- Read-out: **5**
- Range: 1 to 50, step 1, default 5
- `aria-valuetext`: "5 orders a month" (singular at 1: "1 order a month")

**Output**
- Big number: **$400 a month**
- Second number: **$4,800 a year**
- Working sentence (live region, `aria-live="polite"`, this is the line that lets them connect the dots):
  **5 orders × $80 = $400 a month, or $4,800 a year.**
  - Singular: **1 order × $80 = $80 a month, or $960 a year.**
  - Format numbers with commas: $12,000 not $12000. Plain "$", no currency conversion.
- Neutral line beneath: **GEO Core is US$49 a month. You decide what's realistic for your store.**
  [source: P]
- Small print: **This is a calculator, not a forecast. We can't promise extra orders. It uses a plain $
  so you can think in your own currency. GEO is billed in US dollars.**
- Link: **Run a free product check** (`#check`), with the line before it: **Your free check shows
  whether AI names you today.**

No-JS fallback: render the default sentence ("5 orders × $80 = $400 a month, or $4,800 a year.") in the
HTML so the section still makes sense without the script.

Designer notes:
- Main gradient band. Calculator in a white card (24px radius, soft shadow). Output numbers cobalt
  `#4050B0`, tabular numerals. Range track `#E2E2FC`, filled part cobalt, thumb navy with a white ring and
  a visible focus ring.
- Image: `clay-coins.jpg` (1:1) beside the card on desktop, above it (smaller, max 160px) on mobile.
  Alt `""` (decorative).
- Works at 390px: sliders full width, read-outs right-aligned on the label row.
- Real `<input type="range">` with `<label for>`, keyboard arrows change by one step.

---

## 11. The app: six screens (`21-screens.html`)

**Label pill:** The app

**Headline:**
> Six screens. One job each.

Alternates:
- Six simple screens. One question each.
- Every screen answers one question

**Sub-line:**
> Each screen answers a question store owners ask. Shown here with sample data.

**Tabs (unchanged):** Dashboard · Questions · Competitors & sources (short: Competitors) · Fixes ·
Outreach · Plans & settings (short: Settings)

**Captions ("What it's for:")**
- Dashboard: **the money AI sends you, compared with before you joined.**
- Questions: **each buyer question, who AI names, and the sites it trusts.**
- Competitors: **who wins, and which sites to get onto.**
- Fixes: **approve better product pages in one click, and undo any time.** (em dash removed)
- Outreach: **find the articles AI trusts and send the writer an honest pitch.** (em dash removed; the
  old one-word "Honestly." ending read as a wink)
- Settings: **your plan, limits and the few switches that matter.**

**Mockup data:** keep the numbers as they are [SAMPLE]. Only these labels change (they contain dashes):

| Screen | Current (dash shown as [em dash] or [en dash]) | New |
|---|---|---|
| Dashboard note | Google AI Overviews can't be split cleanly from normal Google [em dash] shown separately. | Google AI Overviews can't be split cleanly from normal Google, so we show them separately. |
| Dashboard, top products | Gift Set [en dash] The Essentials | The Essentials Gift Set |
| Questions, your row position | [en dash] (Bondi Beard Co., not named) | Leave the position cell empty; "not named" already says it |
| Questions, "Best spot" | Best spot [en dash] | Best spot: none |
| Competitors strip | 144 answers [em dash] 18 questions × 4 AI assistants × 2 runs each. | 144 answers: 18 questions × 4 AI assistants × 2 runs each. |
| Competitors, change list | You moved up to 4th [em dash] named in 30 answers, up from 24. | You moved up to 4th: named in 30 answers, up from 24. |
| Competitors, "You on it?" for reddit.com/r/beards and beardguru.com.au | [em dash] | n/a (keep the tooltip "Not something you can be listed on") |
| Fixes, after text and facts chips | 3[en dash]4 drops | 3 to 4 drops |
| Fixes, history | Beard Balm [en dash] Cedar; Gift Set [en dash] The Essentials | Cedar Beard Balm; The Essentials Gift Set |

Designer notes: white section. Active tab cobalt underline, tab text navy. Mockup frames unchanged.

---

## 12. Guardrails (`30-guardrails.html`)

**Label pill:** Built-in guardrails

**Headline:**
> Safe changes. Honest numbers.

Alternates:
- Your store, your call
- Safe changes. Honest results. (current)

**Sub-line:**
> GEO only changes your store when you say so. It never makes things up, and it labels anything it can't
> be sure of.

**Six cards:**
1. **You approve every change** · Nothing goes live until you click Approve. Autopilot is opt-in on Pro,
   and it still skips anything risky, like product claims.
2. **Never makes things up** · We only reword what's already in your catalogue. If a detail is missing,
   we ask you instead of guessing.
3. **No health claims** · Skin, hair and supplement products get a claims check first, in line with
   Australia's TGA rules.
4. **One-click undo** · We save the old version of everything we change, so one click puts it back.
5. **No fake reviews. Ever.** · No fake reviews and no fake Reddit posts. Outreach is an honest note that
   you send yourself.
6. **No surprise bills** · One flat monthly price, billed through Shopify. Scans, fixes and reports never
   add extra charges. [source: P]
   (Was "A cost cap per store". Our cost cap protects our margin, not the store owner. What they care
   about is a fixed bill. The app has no usage charges.)

Designer notes:
- Background deep indigo gradient `#1B1D4A` to `#15163C`. Headings white, body `#E2E2FC` (check AA on
  the darker stop). Card fills `rgba(226,226,252,0.06)` with a `#B5A8E0` hairline at low opacity.
- Image: `clay-shield.jpg` (1:1) in a rounded 24px tile beside the section head (desktop) or above it
  (mobile, max 140px). The image has its own lilac background, so frame it as a tile with a soft cobalt
  glow rather than cutting it out. Alt `""`.

---

## 13. Fix engine (`31-fixengine.html`)

**Label pill:** Fix engine

**Headline:**
> Fixes written for how AI reads your store

Alternates:
- Give AI the facts it's looking for
- Better product data, written for you

**Sub-line:**
> AI assistants read your product data, not your banners. GEO rewrites it so they can tell who each
> product is for, using only facts you already have. You approve each fix before it goes live.

**Three rows (tabs):**
1. **Product pages AI can understand** · Clear titles and descriptions: who it's for, size, scent and the
   ingredients you already list.
2. **Answers to real buyer questions** · FAQ blocks on your product pages, built from the questions
   shoppers ask AI.
3. **Guide pages for the questions you're missing** · "Best X for Y in Australia" pages that link to your
   products, with a tracking tag so you see the sales. (was "Guide pages that win roundups", which sounded
   like a promise)

**Panes:** keep all mockup data [SAMPLE]. Label changes:
- Metafields note: "Shopping assistants read these fields first." becomes **Shopping assistants read these
  fields.** ("first" is a claim we can't source.)
- Title field: "Sandalwood Beard Oil for Dry Skin [en dash] 30ml" becomes **Sandalwood Beard Oil for Dry
  Skin, 30ml** (in the input and on the storefront preview).
- "3[en dash]4 drops" becomes **3 to 4 drops** (diff and FAQ answer).
- History: "Beard Balm [en dash] Cedar" becomes **Cedar Beard Balm**. Guide pane: "Gift Set [en dash] The
  Essentials" becomes **The Essentials Gift Set**.
- Everything else unchanged ("Every detail comes from your catalogue", "Question for you: how long does a
  bottle last?", "Claims check passed", "Old version saved", "Adds FAQ data search engines read", "Every
  link carries utm_source=geo, so sales from this page show up on your dashboard.").

Designer notes:
- Pane 2 storefront image: replace `beard-oil.jpg` with `guide-beard-oil.jpg` (clay dropper bottle),
  cropped square on the bottle. Alt: **Clay beard oil bottle on a lilac stand**.
- `31-fixengine.css` `.fx-thumbs i` background also uses `beard-oil.jpg`: switch to `guide-beard-oil.jpg`.
- Active row: `#E1CCF7` fill, cobalt icon. Stage card on the main gradient.

---

## 14. How it works (`32-how.html`)

**Label pill:** How it works

**Headline:**
> Live in about five minutes. Mostly automatic. [source: P]

Alternates:
- Install, tick, approve
- Set up in about five minutes

**Sub-line:**
> Install GEO in Shopify and it does the setup. You pick the questions that matter, then approve the fixes
> you like.

**Three steps:**
1. **Install, and we set things up** · We read your products and homepage, then suggest the questions
   shoppers ask AI. You tick the ones that matter.
2. **Your first scan in a few minutes** · We ask every AI assistant every question twice and average the
   results, so one odd answer doesn't mislead you. [source: P]
3. **Approve fixes, track every AI order** · Approve the fixes you like. Then follow the clicks, orders
   and revenue AI sends you, against your baseline. (em dash removed; was "watch the money", which
   implies the money arrives)

**Mockups:** unchanged [SAMPLE] (214 products, Men's grooming · Australia, 7 of 8 answers in, A$1,240,
A$4,820, 12 fixes live).

**Timeline (five dots):**
1. **Install** · One click in Shopify
2. **Setup** · About 5 min [source: P]
3. **Baseline scan** · Where you stand today
4. **Weekly scans** · Daily on Pro [source: P]
5. **Monthly email report** · Money, wins and next steps

Designer notes: white section; step cards on `#EFECFD`; timeline dots cobalt, line `#B5A8E0`.

---

## 15. Proof (`40-proof.html`, id `proof`)

**Label pill:** Proof, not promises
**Second pill:** Real data from our own live tests · October 2026

**Headline:**
> What a real AI answer looks like

Alternates:
- We asked ChatGPT. Here's what it said.
- One real question, one real answer

**Sub-line (new):**
> While planning GEO, we asked ChatGPT a real buyer question as a shopper in Australia. Then we tested
> GEO itself against all four AI assistants.

**Card 1: the live ChatGPT answer** [source: T1]
- Image tag: **Asked in Australia**
- Quote: **"best beard oil for dry skin in Australia"**
- Body: **ChatGPT named The Groomed Man Co, A Better, Bold & Bare and Milkman. It cited stuga.com.au's
  "best beard oil 2026" roundup, Chemist Warehouse, BIG W and Beard Guru.**
- Takeaway (new, small, cobalt): **Notice what it cites: a roundup article and well-known retailers.
  Those are the sources AI leaned on for this question.**
- Domain chips: stuga.com.au · chemistwarehouse.com.au · bigw.com.au · beardguru.com.au
- Footer: **ChatGPT · Australia** · **Live test, October 2026**
- Stats: **4** Brands named · **4** Sites cited [source: T1]

**Card 2: GEO self-test** [source: T2]
- Header: **Self-test results** · **24 of 24 back**
- Sub: **3 questions · each asked twice per AI assistant**
- Grid labels unchanged (Q1, Q2, Q3; ChatGPT, Gemini, Perplexity, AI Overviews; "6 back · Google showed
  no overview for 3").
- Legend: **Each pair of ticks is run 1 and run 2 of the same question. Google doesn't show an AI Overview
  for every search.**
- Footer title: **GEO self-test · 9 Oct 2026**
- Body: **24 of 24 answers came back from ChatGPT, Gemini, Perplexity and Google AI Overviews. Every
  question was asked twice per assistant. Google showed no AI Overview for 3 of its 6 searches, which is
  normal.**
- Stats: **4 AI assistants** · The same ones Core checks for you; **24/24** · Answers returned
  [source: T2]
- Cut: the "~US$0.003 per answer" stat and "Each answer cost us about a third of a cent" line. Our data
  cost isn't a benefit to the store owner, and it invites a "why US$49 then?" comparison.

Designer notes: `clay-answer.jpg` (4:5) replaces `beard-oil.jpg` in card 1. Alt: **Clay illustration of
a phone showing a chat with a small dropper bottle card**. Section background `#EFECFD`. Ticks cobalt.
Card 2 now has two stats, matching card 1.

---

## 16. Connections (`41-hub.html`)

**Label pill:** Connections

**Headline:**
> Plugs into Shopify. Reads AI answers for you.

Alternates:
- One install. Everything connected.
- Shopify on one side, AI answers on the other

**Sub-line:**
> Install once in your Shopify admin. GEO reads your catalogue and orders, then asks the AI assistants your
> buyers already use.

**Button:** **See how it connects** (`#how`)

**Hub captions (unchanged):** Gemini · ChatGPT · Shopify · Click tracking · Orders · Perplexity · Google ·
Email reports · Claude (Pro) · Products

**Map aria-label (unchanged):** GEO in the middle, connected to Shopify, your orders and products, ChatGPT,
Gemini, Perplexity, Google, Claude, email reports and click tracking

Designer notes: GEO mark stays in the centre (no photo). Rings `#B5A8E0`, tiles white on `#EFECFD`.

---

## 17. Pricing (`42-pricing.html`, id `pricing`)

**Label pill:** Pricing

**Headline:**
> Simple plans. You do the maths.

Alternates:
- What's one extra order a month worth to you?
- Simple plans. Real money tracked. (current)

**Sub-line:**
> Here's a simple test. What's one extra order a month worth to you, at your average order value?
> Compare that with US$49. [source: P]

Link after it: **Try the calculator** (`#worth`)

**Toggle:** Monthly · Billed through Shopify

**Free scan**
- Name: **Free scan**
- Price: **$0** · one-time [source: P]
- Line: **See where you stand with AI today, before you pay anything.**
- Button: **Start free scan**
- List: 10 buyer questions, one-time scan · 3 AI assistants · Your visibility score: how often AI names
  you, out of 100 · Top competitors AI picks instead · AI sales from your last 60 days · Results in a few
  minutes · No card needed · No fixes or ongoing tracking [source: P]
  (Was "10 buyer questions, checked once", which clashes with "every question asked twice".)

**Core**
- Badge: **Our pick for most stores** (was "Best for most stores"; we have no customer data to back
  "best", so we own it as our opinion)
- Name: **Core**
- Price: **US$49** · /month · 7-day free trial [source: P]
- Line: **Weekly tracking, fixes you approve, and the money AI sends you.**
- Button: **Start 7-day trial**
- List: 25 buyer questions, scanned weekly · ChatGPT, Gemini and Perplexity · Google AI Overviews · 100
  products optimised · 30 AI fixes a month · Outreach finder, 10 targets a month · Revenue dashboard ·
  Monthly email report [source: P]

**Pro**
- Name: **Pro**
- Price: **US$149** · /month [source: P]
- Line: **More questions, daily checks and hands-off fixes for bigger catalogues.**
- Button: **Choose Pro** (was "Go Pro")
- List: Everything in Core · 100 buyer questions, scanned daily · Adds Claude to your checks · 1,000
  products optimised · Unlimited fixes · Autopilot mode (opt-in) · Outreach finder, 40 targets a month
  [source: P] (drop the repeated "Monthly email report": it's in "Everything in Core")

**Footnote:**
> Prices in US dollars. Shopify adds them to your normal bill. Cancel any time. The visits AI sends you
> cost nothing per click.

Designer notes: main gradient band. Core card navy with white text (current "featured" treatment), other
cards white. Buttons navy. Don't repeat `clay-coins.jpg` here (it's in the slider just above).

---

## 18. FAQ (`43-faq.html`, id `faq`)

**Label pill:** FAQs

**Headline:**
> Questions store owners ask

Alternates:
- Plain answers
- Got questions? (was the headline; says nothing)

**Sub-line:**
> Plain answers about how AI picks stores, how we count sales, and what changes in your store.

**Help card:** image `clay-support.jpg` (16:9) replaces `support.jpg`. Alt: **Clay headset beside two chat
bubbles**. Text: **Stuck on setup? We'll help you get your first scan running.** Link: **See the setup
steps** (`#how`)

**Questions and full answers** (order matters: the first four teach, the rest reassure):

1. **How does AI decide which stores to recommend?**
   Nobody outside the AI companies knows the exact recipe. But the answers show their working. AI repeats
   facts it can read on your product pages, picks pages that answer the exact question asked, and quotes
   sources it trusts, like roundup articles, retailers and forums. GEO tracks all three for the questions
   your buyers ask.

2. **Can I pay to appear in AI answers?**
   You can buy ads next to some answers, but not the recommendation itself. ChatGPT shows ads on its Free
   and Go plans. They sit below the answer, they're labelled, and OpenAI says advertisers can't shape or
   rank the answer. Google can place ads above, below or within its AI Overviews in Australia and New
   Zealand. The recommendation inside the answer isn't for sale. [source: F6]

3. **If GEO costs money, what's "free" about it?**
   The traffic. When AI names your store and a shopper clicks through, you don't pay for that click the
   way you would for an ad. GEO itself is a paid monthly plan. You can start with a $0 first scan, and
   Core has a 7-day free trial. [source: P]

4. **How do you know a sale came from AI?**
   ChatGPT adds `utm_source=chatgpt.com` to the links it shows. We also check where each visit came from
   (Perplexity, Gemini, Copilot, Claude and others), and we count sales from the pages we build for you
   with our own link tag. Google's AI Overviews can't be cleanly separated from normal Google, so we label
   them. We compare everything with your baseline, your numbers from before you joined, and we never
   claim every AI sale was caused by GEO.

5. **What is the visibility score?**
   A score out of 100 for how often AI names you. It's the share of AI answers that name you, across all
   your questions, every AI assistant and both runs, with a bonus when you're in the top 3. 0 means no AI
   named you. Higher means you're named more often, and nearer the top. [source: P]

6. **Will GEO change my store without asking?**
   No. Every change waits for your approval. Autopilot on Pro is opt-in, and it still skips anything risky,
   like product claims.

7. **Can I undo a change?**
   Yes. We keep the old version of everything we change, so undo is one click.

8. **Will it write health or skin claims?**
   No. Health, skin and supplement products get a claims check first, in line with Australia's TGA rules.
   We only reword facts already in your catalogue. If something is missing, we ask you.

9. **Which AI assistants do you check?**
   ChatGPT, Gemini, Perplexity and Google AI Overviews. Pro adds Claude. Each question is asked twice per
   assistant on every full scan, and we show the average. [source: P]

10. **How soon will I see results?**
    We can't promise a date, and we won't. AI assistants refresh what they know at different speeds, and
    getting into a roundup depends on its editor. That's why GEO tracks the same questions every week
    against your baseline, so you can see what's moving and what isn't.

11. **Is this the same as SEO?**
    They overlap. Good SEO helps, because many AI answers draw on the web. The difference is the question
    you ask. SEO asks where you rank on a page of links. GEO asks whether AI names you in its answer, and
    which sites it quotes when it does.

12. **Do I need to be technical?**
    No. Install from Shopify, tick the questions you care about, and approve fixes with one click. GEO
    writes the changes and pushes them to your store for you.

13. **What's in the free scan? And how is it different from the free product check?**
    The free product check on this page needs no install: one product, 3 questions, ChatGPT, Gemini and
    Perplexity, each asked twice. The free scan runs inside Shopify after you install: 10 buyer questions
    on 3 AI assistants, your visibility score (how often AI names you, out of 100), who AI recommends
    instead, and any AI sales from your last 60 days. Both cost $0. [source: FC, P]

14. **Does it work outside Australia?**
    GEO is built for stores in Australia and New Zealand first, and asks each question as a local shopper
    would. The free product check also works for shoppers in the US, UK and Canada. [source: FC]

15. **What do you do with my store's data?**
    We read your products and homepage to write fixes, and your orders to find sales from AI. Click
    tracking counts visits from AI answers, follows your store's consent settings and keeps no personal
    details. We never use one store's data for another store.

Designer notes: white section; open item `#EFECFD`; plus/minus icon cobalt. If 15 is too many for the
layout, keep 1 to 9 plus 10 and 13, and move the rest to a help page.

---

## 19. Guide pages (`44-guides.html`)

**Label pill:** Guide pages

**Headline:**
> Pages GEO can write for you

Alternates:
- Answer the questions shoppers ask AI
- Guide pages built from your own products

**Sub-line (new):**
> Guide pages answer the exact questions shoppers ask AI, using only your products and facts. You approve
> each one before it's published, and every link is tracked.

**Cards (unchanged text):** each with tag **Example** · **Guide page** and link **See example** (`#fixes`)
1. **Best beard oil for dry skin in Australia** (`guide-beard-oil.jpg`)
2. **Beard care for sensitive skin: what to look for** (`guide-sensitive.jpg`)
3. **Gift ideas for bearded men under $80** (`guide-gifts.jpg`)

Designer notes: these images are already clay. Card image area on the main gradient.

---

## 20. Closing CTA and footer (`45-cta-footer.html`)

**CTA card**

**Headline:**
> Is AI recommending your store?

Alternates:
- See where you stand with AI today (current)
- Find out what AI says about your products

**Sub-line:**
> Paste one product link. In a few minutes you'll see who AI recommends, which sites it trusts, and what
> to fix first. Free, no sign-up. [source: FC]

**Button:** **Check my product** (`#check`)

Designer notes: CTA card on the main gradient, navy text, navy button (replaces the light-on-dark style).
Image: `clay-storefront.jpg` (4:3) on the right on desktop, above the headline on mobile (max 220px).
Alt `""`.

**Footer**
- Logo aria-label: **GEO, back to top**
- Tagline (em dash removed): **Get recommended by ChatGPT & co, and see what it's worth to your store.**
  (Was "and see the sales it brings", which promises sales.)
  Alternate: **The free sales channel your store is missing, and the dashboard that counts it.**
- Columns unchanged: Product (Overview, Screens, How it works, Pricing) · Company (About, Soon; Privacy;
  Terms, Soon) · Support (Help centre, Contact, Setup guide). Add **How AI picks** (`#decide`) under
  Product.
- Bottom line: **© 2026 GEO · Made for Shopify stores in Australia & New Zealand** · **All rights
  reserved.**

---

## 21. Free product check page (`/check` and `/check/:id`)

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
> Paste a product link. We ask ChatGPT, Gemini and Perplexity 3 questions a real buyer would ask, twice
> each. Then we show who they recommend, which sites they trust, and what to fix first. [source: FC]

**Form:** same as the hero (Product link, Shopper country, **Check my product**, **Starting your
check…**). Note: **Free. No sign-up. We ask ChatGPT, Gemini and Perplexity 3 questions a real buyer
would ask, twice each.** [source: FC]

**Three cards:**
1. **Are you recommended?** · A score out of 100, and how often each AI names your brand.
2. **Who wins instead** · The brands AI picks for your buyers, and the websites it quotes.
3. **What to fix first** (was "Quick wins") · Plain-English next steps, based only on what the AI
   said.

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
- Note: **This takes a few minutes. You can leave this page and come back to this link.** Button:
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
- New "what this means" line under the ring: **The score is the share of answers that named {brand}, with
  extra credit for a top-3 spot. 0 means no AI named you. Higher means you're named more often, and nearer
  the top.**
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
> 25 every week on Core, or 100 every day on Pro. [source: FC, P]

### Failed, not found and limit messages

- Failed heading: **We couldn't finish this check** · default text: **Something went wrong on our side.
  Please try again.** (then the form)
- Report error: **We couldn't write this report. Please try again.**
- Not found (404): **We couldn't find that check** · **The link may be wrong, or the check is more than 30
  days old and was deleted. You can run a new one here.** [source: FC]
- Route error: **Something went wrong** · **Please try again in a minute, or start a new check.**
- Page unreadable: **We couldn't read that page. Please paste a public product page link.**
- Visitor limit (change: the current text promises "unlimited tracking", which no plan has; and the limit
  is a rolling 24 hours, not "today"): **You've run 3 free checks in the last 24 hours, which is the
  limit. Try again later, or install GEO to track your questions every week.** [source: FC]
- Busy: **We're very busy right now. Please try again in an hour.**
- Honeypot / unknown: **Something went wrong. Please try again.**
- Fallback buyer question in `app/lib/check-read.ts` contains an em dash ("is {category} worth it
  [em dash] which brand should I pick in {country}"). Use: **which {category} brand is worth it in
  {country}**

---

## 22. All current dashes to remove (checked 10 Oct 2026)

Em dashes, plus spaced en dashes that read as dashes. Unspaced ranges like "3[en dash]4" also become "3 to 4".

| File | Where | Fix |
|---|---|---|
| `10-nav.html` | logo aria-label | GEO, back to top |
| `12w-why.html` | bar label "Oct[en dash]Dec 2025" | Oct to Dec 2025 (section 5) |
| `13-meet.html` | lead | see section 7 |
| `20-money.html` | blue card | see section 9 |
| `21-screens.html` | dashboard note, "Gift Set [en dash] The Essentials", "[en dash]" position and "Best spot [en dash]", competitors strip, "You moved up" line, two "You on it?" cells, "3[en dash]4 drops", "Beard Balm [en dash] Cedar", Fixes and Outreach captions | see section 11 |
| `31-fixengine.html` | "for Dry Skin [en dash] 30ml" (input and storefront), "3[en dash]4 drops" (diff and FAQ), "Beard Balm [en dash] Cedar", "Gift Set [en dash] The Essentials" | see section 13 |
| `32-how.html` | step 3 | see section 14 |
| `45-cta-footer.html` | logo aria-label, footer tagline | see section 20 |
| `app/lib/check-read.ts` | fallback question | see section 21 |

---

## 23. Image map

| Image | Where | Replaces | Alt |
|---|---|---|---|
| `clay-bubble.png`, `clay-coin.png`, `clay-bag.png` | Hero, floating round the dashboard (multiply) | none | `""` |
| `clay-money.jpg` | See the money | `team-laptop.jpg` | Clay illustration of a chat bubble with shopping bags and gold coins spilling out |
| `clay-coins.jpg` | What's it worth slider | none | `""` |
| `clay-shield.jpg` | Guardrails tile | none | `""` |
| `guide-beard-oil.jpg` | Fix engine pane 2 product image and `.fx-thumbs` | `beard-oil.jpg` | Clay beard oil bottle on a lilac stand |
| `clay-answer.jpg` | Proof card 1 | `beard-oil.jpg` | Clay illustration of a phone showing a chat with a small dropper bottle card |
| `clay-support.jpg` | FAQ help card | `support.jpg` | Clay headset beside two chat bubbles |
| `clay-storefront.jpg` | Closing CTA card | none | `""` |
| `clay-magnifier.jpg` | Free check, running state | none | `""` |
| `guide-*.jpg` | Guide cards, fix engine pane 3 (unchanged) | none | unchanged |

`founder-phone.jpg`, `team-laptop.jpg`, `beard-oil.jpg` and `support.jpg` are no longer used.

---

## 24. Final checks before shipping

- [ ] Headline reads exactly "The free sales channel your store is missing".
- [ ] No em dashes anywhere (search the built page for the character), and no spaced en dashes or
      hyphens used as dashes.
- [ ] Every F-tagged number shows a visible source link to the URL in section 0.
- [ ] No number is rounded up (68%, not 69%; "nearly 60×", not "~60×").
- [ ] Every mockup with numbers has the "Sample data" tag.
- [ ] "Free" only describes the free product check, the free scan, the trial, or the AI traffic. GEO is
      "no ad spend".
- [ ] US data is labelled US (Adobe, Exploding Topics). Triple Whale is labelled "its own merchants".
- [ ] 50 million is labelled "our estimate", "2025", "on ChatGPT alone", and says questions, not people.
- [ ] Nothing says ChatGPT has no ads or that Google's AI answers can't carry ads.
- [ ] "Visibility score" and "baseline" are explained wherever they appear.
- [ ] Slider: labels, `aria-valuetext`, live region, keyboard, 390px, no-JS default sentence.
- [ ] Small text on lilac and on indigo passes WCAG AA.
