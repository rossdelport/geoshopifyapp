# GEO ad concepts (final, 10 Oct 2026)

What this is: the ad direction for GEO, built on Ross's brief (a shopper asks AI what to buy, AI
recommends a few brands, the shopper clicks through and buys on the store) and his ad-costs insight,
rewritten so every line is true, provable and passes the platform rules. Two reviewers checked the first
draft; their fixes are applied and listed in "Review notes" at the end.

Read with: `docs/ads/evidence/` (real ChatGPT answers, saved raw), `docs/ads/ad-facts.md` (which ad-cost
numbers are true), `docs/ads/ad-rules.md` (Meta, Google, Shopify, OpenAI and ACCC rules, plus the go-live
checklist), `docs/ads/competitor-ads.md` (what others run), `docs/facts.md` (AI usage numbers) and
`docs/copy-deck.md` (site copy). If a number is not in the fact bank (2.0) or the evidence folder, it does
not go in an ad. This is not legal advice: before a big spend, have an Australian consumer lawyer read the
final ads and the landing page together.

"GEO" is a placeholder name. In ad copy we write "our app" until the real name is settled (4.0, gate 2).

**Short version for Ross**

- **Your angle, honestly:** "Every ad click has a price. A ChatGPT recommendation doesn't." Ad prices have
  mostly risen since late 2023 (Meta +12% per ad in Q2 2026; US Google Ads click US$2.32 in 2016, US$5.42
  in 2026). "Never come down" is false (Meta's prices fell 7 quarters running in 2022 to 2023) and "free
  money" breaks Meta's and Google's get-rich-quick rules.
- **The ads can't promise more sales yet.** No store has results, so round 1 sells the free check and
  shows how AI picks stores. Founding stores (4.7) give us real numbers for a money ad later.
- **Test first:** C5 gift question (real answers: 17 of 21 ChatGPT picks linked to the brand's own site),
  C2 "Ask twice, get two lists" (answers change, and your own ChatGPT knows you), C7 you on camera
  carrying the ad-cost line. Real answers and a real founder beat drawings for wary owners.
- **Never say:** "AI recommendations can't be bought" (Google sells ads in AI Overviews; say "in
  ChatGPT"), "AI links straight to stores", "every AI sale is tracked", or "start your free trial" before
  a normal store can install.
- **Before spending:** a real store installs and starts a trial, "email me my report" on the check, the
  Meta pixel with server events, and a real name and domain (4.0).

---

## 1. The big idea

> **Shoppers now ask AI what to buy. It names a few brands, often with links to where to buy them, and
> some shoppers click through and buy.**
> **Every ad click has a price, and since late 2023 that price has mostly gone up. The recommendation
> inside a ChatGPT answer has no cost per click: OpenAI says advertisers can't shape, rank or alter its
> answers.**
> **It's small today and growing fast. GEO shows whether your products are in those answers, helps you
> fix what AI can't read, and counts the AI orders it can trace.**

The line everything ladders up to: **Earned, not bought.** In ads it shows up as "no cost per click" or
"in ChatGPT, the answer isn't for sale". Always scoped to ChatGPT, never to "AI" in general (fact AI3).

Why we changed Ross's lines (one line each):

| Ross's line | What we say instead | Why |
|---|---|---|
| "Ad CPMs only go up and to the right and never come back down." | "Every ad click has a price. A ChatGPT recommendation doesn't." / "Ad prices go up and down. Since late 2023 they've mostly gone up." / "Check what a click cost you in 2023, and what it costs now." | False as stated: Meta's price per ad fell for 7 quarters in a row (Q1 2022 to Q3 2023), so "never" fails the ACCC's "true, accurate and based on reasonable grounds" test (`ad-facts.md` §1, `ad-rules.md` 5.2). There is no reliable public data on Australian ad prices (`ad-facts.md` §6b), so the owner's own numbers are the best proof. |
| "Ranking in AI answers is like free money." | "When ChatGPT recommends your product, there's no cost per click." | Meta bans "unrealistic financial reward for unclear or minimal effort", Google bans "unrealistic promises of large financial return", and GEO itself costs US$97 a month (`ad-rules.md` 1.1, 2.1, 5.3). |
| "Right now" (the window is open) | "It's small today and growing fast: ChatGPT was about 0.2% of store visits in one 2024 to 2025 study of 973 stores, and Shopify's president said in Feb 2026 that AI search orders were 15 times higher than in January 2025." | Dated and true (AI9, AI6). Saying "small" first is the trust advantage over StoreRank's "87%" and "5.1x" (`competitor-ads.md` §4). We never predict how long the window lasts. |

### 1.1 What real answers show (10 Oct 2026, raw files in `docs/ads/evidence/`)

- **Gift for a bearded man under $80, ships to Australia** (ChatGPT, Australia, 4 answers): 17 of 21
  picks linked to the brand's own website. Two gift sets came up in all four answers; at least 11 different
  brands were named in total. ChatGPT gave AUD prices, what's in each set and free-shipping thresholds, and
  linked to the stores' own product pages.
- **Best beard oil for dry skin in Australia** (2 answers): 3 brands, then 4. Only one brand was in both.
  4 of 7 picks linked to the brand's own site; the rest went to a specialist retailer, an Amazon Australia
  search and a Chemist Warehouse search. Sources were "best of" roundups, brand pages, a retailer and
  skin-care guides. The one brand named twice had its own "best beard oil in Australia 2026" guide
  cited in both answers.
- **Gift for a coffee lover under $50 in Australia** (2 answers): product types, big retailers and
  gift-guide blogs, not independent stores. **So the gift angle only works in categories we've checked.**
- **The `utm_source=chatgpt.com` tag** was on the links in 2 of these 8 answers (as captured).
- The planning test in CLAUDE.md §17 (beard oil, 4 brands, a roundup and three retailers) has no saved
  answer, date or URL list. Ads don't use it.

---

## 2. The concepts

### 2.0 Fact bank (every number an ad may use)

All sources were opened and read on 10 Oct 2026. ✓ = re-opened for this final pass. Say the date and
region in the ad or one tap away.

| ID | Fact (ad wording) | Period | Source |
|---|---|---|---|
| AC1 ✓ | Average Google Ads click in the US: US$2.32 (2016), US$5.42 (2026). Quote: "CPC is over twice what it was 10 years ago ($2.32 versus $5.42)". The 2026 report covers "13,474 US-based search advertising campaigns" (Google and Microsoft Ads) and gives "inflation and competition" as causes. The 2016 figure is from WordStream's first report on its own client accounts; that page has since been rewritten with newer data and now says "when the averages were $2.32 and $0.58". **Caption every use:** "WordStream benchmarks, US search campaigns. 2016 figure from its first report; samples and methods differ by year. Not adjusted for inflation." | 2016 and 2026 reports | [WordStream 2026](https://www.wordstream.com/blog/2026-google-ads-benchmarks) (updated 19 May 2026), [WordStream benchmarks page first published 2016](https://www.wordstream.com/blog/ws/2016/02/29/google-adwords-industry-benchmarks) |
| AC2 | A US Google Ads click for "Shopping, Collectibles & Gifts" went from US$2.61 to US$4.14 (about +59%, our calculation). US data: don't use it in AU-facing gift ads. | 2024 to 2026 reports | [WordStream 2024](https://www.wordstream.com/blog/2024-google-ads-benchmarks), [WordStream 2026](https://www.wordstream.com/blog/2026-google-ads-benchmarks) |
| AC3 | Meta's average price per ad was 12% higher than a year earlier. Quote: "Average price per ad increased by 12% year-over-year." Global blended average, not anyone's CPM. | Q2 2026 (released 29 Jul 2026) | [Meta Q2 2026 results](https://investor.atmeta.com/investor-news/press-release-details/2026/Meta-Reports-Second-Quarter-2026-Results/default.aspx) |
| AC4 | Meta's average price per ad has been higher than the year before for 11 quarters in a row (Q4 2023 to Q2 2026). It fell for 7 quarters in a row before that (Q1 2022 to Q3 2023). | Q1 2022 to Q2 2026 | Meta quarterly releases, all listed in `ad-facts.md` §1 |
| AC5 | Google charged 7% more per click in 2025 than in 2024. Its average cost per click has been higher than the year before in every period Alphabet has reported since Q3 2023 (+5% Q1 2026, +3% Q2 2026). | 2023 to Q2 2026 | [Alphabet 2025 10-K](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm), [Q2 2026 10-Q](https://www.sec.gov/Archives/edgar/data/1652044/000165204426000071/goog-20260630.htm) |
| AI1 | Quote word for word: "advertisers have no ability to shape, rank, or alter ChatGPT’s responses" and "Ads can appear below the end of a response." | read 10 Oct 2026 | [OpenAI Help: Ads in ChatGPT](https://help.openai.com/en/articles/20001047-ads-in-chatgpt) |
| AI2 | ChatGPT ads have launched in Australia and New Zealand: "This announcement follows Asia Pacific launches in Australia, New Zealand, Japan, South Korea and India". Same post: "Ads in ChatGPT are always clearly labeled and separate from ChatGPT’s answers". | 23 Sep 2026 | [OpenAI](https://openai.com/index/chatgpt-ads-expands-southeast-asia-taiwan/) |
| AI3 | Google can show ads "above, below or within AI Overviews", including in Australia and New Zealand. **So never say AI answers can't be bought in general.** | read 10 Oct 2026 | [Google Ads Help](https://support.google.com/google-ads/answer/16297775?hl=en) |
| AI4 | Roughly 50 million questions a day about things to buy, on ChatGPT alone (our estimate: 2.5 billion messages a day × 2.1%). Questions, not people. | 2025 | [TechCrunch](https://techcrunch.com/2025/07/21/chatgpt-users-send-2-5-billion-prompts-a-day/), [eMarketer](https://www.emarketer.com/content/chatgpt-minimal-influence-on-ecommerce-sales-for-now) |
| AI5 | 1.2 billion people use ChatGPT every week. | Sep 2026 | [OpenAI DevDay 2026 recap](https://openai.com/index/devday-2026-recap/) |
| AI6 | Shopify's president: orders from AI search are 15 times higher than in January 2025. | Feb 2026 | [CP24 / The Canadian Press](https://www.cp24.com/news/canada/2026/02/11/shopify-reports-us743m-q4-profit-revenue-up-31-per-cent-from-year-ago/) |
| AI7 | 77% of 1,009 US shoppers surveyed had used AI to help them shop in the last six months. | Apr 2026 | [Search Engine Land (Exploding Topics)](https://searchengineland.com/new-data-77-use-ai-to-shop-nearly-1-in-3-wont-let-it-spend-475614) |
| AI8 | AI visits to US retail sites convert 60% higher than other (all non-AI) visits. Never "better than ad clicks". | Jul 2026 data | [Digital Commerce 360 (Adobe)](https://www.digitalcommerce360.com/2026/08/19/adobe-ai-referral-traffic-data-july-2026/) |
| AI9 | ChatGPT brought about 0.2% of sessions across 973 online stores. It is ChatGPT only, and dated: say "in one 2024 to 2025 study", never "today". | Aug 2024 to Jul 2025 | [Search Engine Land](https://searchengineland.com/llms-google-referral-conversion-study-463747), [SSRN paper](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5585812) |
| AI10 ✓ | ChatGPT can personalise searches. Quotes: "When Memory is enabled, ChatGPT can remember relevant preferences and details from your chats" and, under "Can memory personalize web searches?": "Yes. When Memory is enabled, ChatGPT may use relevant details to formulate a more useful search query." Temporary chats can be set to "Unpersonalized". | read 10 Oct 2026 | [OpenAI Help: Memory](https://help.openai.com/en/articles/8590148-memory-faq) |
| AI11 ✓ | ChatGPT's tag is not guaranteed, and paid and organic traffic can't yet be split. Quotes: "just because a link is supplied as a source does not guarantee UTMs will always be included"; ChatGPT search results: UTMs "❌"; "treat any AI Assistant or AI-referral numbers in your reports as a blend of both organic and paid"; "treat any AI traffic number as a directional floor rather than a precise count." | updated 22 Jun 2026 | [Seer Interactive](https://www.seerinteractive.com/insights/are-ai-sites-like-chatgpt-sending-your-website-traffic) |
| AI12 ✓ | OpenAI is adding a visual ad format shown alongside images ChatGPT generates, "later this month in the U.S. only for now", "clearly labeled and won't influence the answers ChatGPT provides". So the ad formats around answers are changing: re-check C4's wording weekly. | 5 Oct 2026 | [TechCrunch](https://techcrunch.com/2026/10/05/openai-launches-visual-ads-that-appear-alongside-image-generation-results/) |
| AI13 ✓ | Shopify already has free reports: "Sessions by referrer" and a "Total sales by referrer" report (acquisition reports "do not show converted sales or the amount of orders", the sales report does). | read 10 Oct 2026 | [Shopify Help: Acquisition reports](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/acquisition-reports) |
| P1 | ChatGPT often adds `utm_source=chatgpt.com` to its links (on the links in 2 of our 8 saved answers). GEO looks for that tag and for visits from ChatGPT, Perplexity, Gemini, Copilot, Claude and other AI sites, so it counts the AI orders it can trace. | Oct 2026 | CLAUDE.md §10; `docs/ads/evidence/`; AI11 |
| P2 | Retired. The planning test in CLAUDE.md §17 has no saved answer. Use P5 and P6. | | |
| P3 | Free product check: paste a product link, GEO asks ChatGPT, Gemini and Perplexity 3 questions a real buyer would ask, twice each, **up to 18 answers** (failed calls still count toward the 18), and shows who they name, which sites they trust and **a preview of each answer** (about the first 700 characters, `app/lib/check-types.ts`). Free, no sign-up. Not from your own ChatGPT account. Does **not** cover Google AI Overviews. | spec | `docs/free-check.md` |
| P4 | Standard US$97 a month or US$873 a year (USD) after a 7-day free trial, billed through Shopify; cancel on the app's Plans page ("Cancel my plan") or by uninstalling. Done-for-you US$497 a month or US$4,473 a year. **Can't be advertised as available until gate 1 in 4.0 passes.** GST on app charges for AU stores: not confirmed (gate 9). | Oct 2026 | `app/lib/plans.ts` (same as CLAUDE.md §3); `app/routes/app.plans.tsx` |
| P5 | Gift question, 4 ChatGPT answers, Australia, 10 Oct 2026: 17 of 21 picks linked to the brand's own website; 2 picks in all four answers; at least 11 brands named in total; AUD prices, set contents and free-shipping thresholds quoted; links to the stores' own product pages. | 10 Oct 2026 | `docs/ads/evidence/` (gift-bearded-man runs 1 to 4) |
| P6 | Beard oil question, 2 ChatGPT answers, Australia, 10 Oct 2026: 3 brands, then 4; 1 in both; 4 of 7 picks linked to the brand's own site; sources were roundups, brand pages, a retailer and skin-care guides; the brand named twice had its own "best beard oil in Australia 2026" guide cited both times. | 10 Oct 2026 | `docs/ads/evidence/` (beard-oil runs 1 and 2) |
| P7 | Coffee gift question, 2 ChatGPT answers: product types, big retailers, gift-guide blogs. The gift angle doesn't fit every category. | 10 Oct 2026 | `docs/ads/evidence/` (gift-coffee runs 1 and 2) |

---

### 2.1 Rules every concept shares (so they aren't repeated eight times)

- **Price line, two stages. Pick the stage that is true on the day the ad runs.**
  - **Stage A (now, until gate 1 passes):** "The check is free. Our app is coming to the Shopify App
    Store at US$97/mo. Join the early list." No trial claim, because nobody can start a trial yet. The
    report's "Start your 7-day free trial" button becomes an early-list form for the same period.
  - **Stage B (after a non-dev store has installed and started the trial, and GST is confirmed):** "The
    check is free. Our app is US$97/mo (USD), billed through Shopify after a 7-day trial unless you
    cancel. Cancel in the app or by uninstalling." Add "plus GST" if Shopify adds it for AU stores.
  - Either way, the price goes in the primary text, not only in the link description, because Meta hides
    the description on many placements.
- **Audience in the first frame and the first three words.** "Shopify store owners:", "If you sell beard
  care in Australia:". Never open on gift wrap or a shopping scene a consumer would click.
- **Landing page:** the free product check, `/check`, with UTMs:
  `?utm_source=meta&utm_medium=paid_social&utm_campaign=c5_gift&utm_content=hook_a` (change per ad).
  `/check` shows a headline and one supporting line chosen by `utm_campaign`, so it repeats the ad's main
  line and price (Meta: "The products and services promoted in an ad must match those promoted on the
  landing page", `ad-rules.md` 1.6). Small dev task, gate 5.
- **Meta CTA button:** "Learn more".
- **Real answers, not drawings, as proof.** Show a real, dated, unedited ChatGPT answer as a quote card in
  our own design (no OpenAI logo, colours or layout), labelled "Real ChatGPT answer, asked in Australia,
  10 Oct 2026. AI-generated." Other brands' names blurred unless they give written permission. Only
  ChatGPT answers are shown as text; Gemini and Perplexity appear only as counts and blurred or swapped
  brand names (Perplexity's terms allow "personal, non-commercial use only", `ad-rules.md` 4.3).
  Drawings with sample stores are for end cards and explainers only, labelled "Illustration".
- **Our name on every image, at least as large as any AI brand name.** AI names in body-weight type.
  Every image that names ChatGPT, Gemini or Perplexity carries "Independent. Not affiliated with OpenAI,
  Google or Perplexity." (OpenAI: "Do not feature our Marks more prominently than your own company's name
  or marks"; Google: "Don't display any Google Brand Features as the most prominent element", `ad-rules.md`
  4.1, 4.2.) Same line in the landing page footer (`ad-rules.md` 4.4).
- **Format mix: at least half of round 1 is lo-fi.** Ross on a selfie camera, phone screen recordings of
  a real check, plain quote cards. Clay renders (site style: lilac `#EFECFD` to periwinkle `#BFC9FA`,
  cobalt `#4050B0`, navy `#0B0C2B` text, Geist headings, Inter body) are for end cards and the site, so
  round 1 tests format as well as message.
- **Any GEO screen** carries "Sample data, not a real store" in large type for the whole time it's on
  screen. Dollar amounts blurred or small and plainly modest.
- **Name the AI tools in plain text only:** "See if ChatGPT, Gemini and Perplexity recommend your
  products". Never "works with ChatGPT", "partner" or "official".
- **One dated "small today" line** in every concept that talks about AI as a sales channel (C1, C5, C7):
  "It's small today: ChatGPT was about 0.2% of store visits in one 2024 to 2025 study. And growing fast:
  Shopify's president said in Feb 2026 that AI search orders were 15 times higher than in January 2025."
- **Re-check before each ad keeps running:** AC3 and AC4 after Meta's Q3 2026 results (late October
  2026); AI1, AI2 and AI12 weekly while C4 runs; the evidence counts whenever a category ad goes live.

---

### C5. The gift question (round 1)

- **Angle:** the exact moment the product is about, shown from the store owner's side, with real
  answers. We asked ChatGPT in Australia for "a gift for a bearded man under $80" four times. Most picks
  linked straight to the brand's own website, two came up every time, the rest changed, and ChatGPT
  quoted each store's prices and set contents. The owner works out for themselves why product data
  matters.
- **Who it's for:** AU/NZ Shopify owners in giftable categories, **only categories checked twice first**.
  Checked and fits: beard care gifts (P5). Checked and doesn't fit: coffee gifts (P7). Not yet
  checked: candles, jewellery, homewares, kids, food gifts. Run two answers per category, save them in
  `docs/ads/evidence/`, and only then make that category's ad.
- **Hook (static, first words on the image):** "If you sell beard care in Australia: we asked ChatGPT for
  a gift idea, four times."
  **Hook (video, first 3 seconds):** type on screen "Sell beard care in Australia?" over the real quote
  card, store names blurred, with an empty outlined slot marked "your store?". No gift wrap in frame 1.
- **Headline (38):** What ChatGPT told us about beard gifts
- **Primary text:**
  - First line (114): Beard care brands: we asked ChatGPT for a gift for a bearded man under $80, four times, as a shopper in Australia.
  - Most picks linked straight to the brand's own website (17 of 21). Two gift sets came up every time. The rest changed from one answer to the next.
  - ChatGPT quoted each set's price, what's in the box and the free-shipping threshold, and linked to the store's own product page.
  - It's small today: ChatGPT was about 0.2% of store visits in one 2024 to 2025 study. And growing fast: Shopify's president said in Feb 2026 that AI search orders were 15 times higher than in January 2025.
  - See which stores AI names for your product. [Price line, stage A or B.]
- **Visual:** lo-fi first. 4:5 static: a plain white quote card on the lilac gradient with one real
  answer excerpt (two picks, names blurred, one highlighted line: price, contents, free shipping),
  labelled "Real ChatGPT answer, asked in Australia, 10 Oct 2026. AI-generated." Our wordmark bottom
  right, at least as large as "ChatGPT" anywhere on the image; "Independent. Not affiliated with OpenAI."
  along the bottom. 9:16 video, 10 to 12 seconds: the question, answer 1 as a quote card, answer 2 slides
  over it and the changed picks light up, end card "Two came up every time. The rest changed." then the
  price line. Carousel: (1) question, "Asked 4 times in Australia, 10 Oct 2026"; (2) answer 1; (3) answer
  2; (4) "17 of 21 picks linked to the brand's own website"; (5) end card.
- **Teaching line to keep (it sells the product fixes without a claim):** "ChatGPT quoted each set's
  price, what's in the box and the free-shipping threshold."
- **CTA and landing:** Learn more → `/check?utm_campaign=c5_gift`.
- **Facts used:** P5 (evidence files), AI9, AI6, P3, P4.
- **Policy notes:**
  - Blur the real brands unless they give written permission. Asking Milkman Grooming Co or Beards
    Australia for permission is worth a try: their real names would make the card stronger.
  - "When a shopper asks", never "Someone just asked..." (an event we didn't watch).
  - Say "the brand's own website", not "small stores" (we can't show size).
  - No Christmas timing promise ("be ready for Christmas"): we don't know how fast answers change.
  - Quoted answer text must carry no health claims (TGA, CLAUDE.md §11). The gift answers have none;
    check any new category's text before it goes on a card.
  - No US cost-per-click line in this concept: wrong country and platform for AU owners.

---

### C2. Ask twice. Get two lists. (round 1)

- **Angle:** asking ChatGPT yourself is a good start but misleading two ways. The answer changes from one
  ask to the next, and your own ChatGPT knows you. Our free check asks fresh, not from your account, up to
  18 times.
- **Who it's for:** Shopify owners who have heard about AI search but never checked. Broadest cold ad,
  cheapest to make.
- **Hook (video, first 3 seconds):** type "Shopify store owners: ask ChatGPT twice." then two real quote
  cards side by side (beard oil, 10 Oct 2026, names blurred), the one shared brand linked by a line.
  Type: "Ask twice. Get two lists."
- **Headline (33):** Ask ChatGPT twice. Get two lists.
- **Primary text:**
  - First line (103): Shopify store owners: ask ChatGPT what to buy in your category, twice. You may get two different lists.
  - We asked "best beard oil for dry skin in Australia" twice on 10 Oct 2026. It named 3 brands, then 4. Only one was in both.
  - Your own ChatGPT also knows you. OpenAI says Memory can use details from your chats to shape its web searches. Your shoppers' ChatGPT doesn't know you.
  - Our free check asks ChatGPT, Gemini and Perplexity 3 shopper questions about your product, twice each, not from your account. [Price line, stage A or B.]
- **Visual:** 9:16, 12 to 15 seconds. (1) Audience line. (2) Two real quote cards, names blurred. (3)
  Type: "Your ChatGPT knows you. Your shoppers' doesn't." (4) A real screen recording of the check running
  ("11 of 18 answers in") and the report (score ring, "Who AI recommends instead", "Sites AI trusts"),
  recorded per gate 8, rival names swapped for sample brands, "Sample data" on screen throughout. End
  card: wordmark, "Paste a product link · Free check", price line. 4:5 static: the two quote cards side by
  side under the headline.
- **CTA and landing:** Learn more → `/check?utm_campaign=c2_ask`. The CTA goes to the check, not "tonight".
- **Facts used:** P6 (evidence), AI10 ([OpenAI Memory](https://help.openai.com/en/articles/8590148-memory-faq)), P3, P4.
- **Policy notes:**
  - Era Search (AU agency) has run "Try this 10-second test ... Go open ChatGPT right now" for 172 days
    (`competitor-ads.md` §1). Don't copy its wording or its "Did you show up? Or did your competitor?"
    close. Ours is "ask twice" plus "your ChatGPT knows you".
  - Report Memory as OpenAI's words ("OpenAI says"), not as "ChatGPT shows you a fake answer".
  - "You may get two different lists", not "you will": answers can also repeat.
  - Covers ChatGPT, Gemini and Perplexity only. Don't mention Google AI Overviews here.
  - The beard oil answers include skin-condition language ("seborrhoeic dermatitis", "needs treatment").
    Quote only excerpts with brand names and no health or treatment wording (TGA, CLAUDE.md §11).

---

### C7. Founder to founder (round 1, paid from day 1)

- **Angle:** Ross on a selfie camera, plain and honest. It carries his ad-cost insight in its true form
  as one beat, then shows what he actually got when he asked ChatGPT. "No reviews yet, no promises" is the
  most believable message for an owner who has been burnt before (`competitor-ads.md` §4, "Honesty").
- **Who it's for:** AU/NZ founders who buy from people they trust.
- **Before filming (required):** Ross asks the question himself (gift or beard oil), twice, in a
  temporary chat set to "Unpersonalized" (AI10) or a logged-out browser, records the screen with the date
  visible, and saves the recording and both answers in `docs/ads/evidence/`. The script uses whatever he
  actually got; the counts below are placeholders.
- **Hook (first 3 seconds, Ross to camera):** "Every ad click has a price. When ChatGPT recommends a
  store, there isn't one."
- **Headline (38):** A sales channel with no cost per click
- **Primary text:**
  - First line (123): Every ad click has a price. When ChatGPT recommends a store, there's no cost per click. I'm Ross, and I built a free check.
  - I asked ChatGPT [the question] twice, as a shopper. It named [X] brands, then [Y]. [Z] were in both.
  - It's small today: ChatGPT was about 0.2% of store visits in one 2024 to 2025 study. And growing fast: Shopify says AI search orders were 15 times higher than in January 2025.
  - Our app is new: no reviews yet, and I won't promise you sales. I'll show you what AI says about your product.
  - The check is free. [Price line, stage A or B.]
- **Script beats (30 to 45 seconds, plus a 15-second cut):**
  1. "Every ad click has a price. When ChatGPT recommends a store, there isn't one."
  2. "ChatGPT does sell ads now, but OpenAI says advertisers can't shape, rank or alter its answers."
  3. "Ad prices go up and down. Check what a click cost you in 2023, and what it costs now." (Optional
     caption: "Average Google Ads click in the US: US$2.32 (2016), US$5.42 (2026)" with the AC1 caption.)
  4. "I asked ChatGPT [the question], twice. [What he actually got.] It linked to [the kinds of sites he
     actually saw]."
  5. "It's small today, and growing fast: Shopify says AI search orders were 15 times higher than in
     January 2025."
  6. "So I built a free check: paste a product link, and we ask ChatGPT, Gemini and Perplexity three
     shopper questions, twice each."
  7. "It's new, no reviews yet, and I won't promise sales. The check is free. The app is coming to the
     Shopify App Store at US$97 a month." (Stage B: the trial wording.)
  - Origin line only if it's true for Ross. Otherwise: "That's why the check asks every question twice
    and shows the sites AI trusts."
- **Visual:** 9:16 selfie, natural light, burned-in captions (Inter, navy on white boxes). B-roll: his
  answers as quote cards (not a raw ChatGPT screen recording; that stays as evidence), then a real check
  running. Lower third with our wordmark at least as large as any AI name; end card with "Independent. Not
  affiliated with OpenAI, Google or Perplexity."
- **CTA and landing:** Learn more → `/check?utm_campaign=c7_founder`.
- **Facts used:** Ross's own saved run, AI1, AI2, AI6, AC1 (optional caption), P3, P4.
- **Policy notes:**
  - Never "none of them paid for the spot". Brands can pay to appear in roundups AI cites (Linkby sells
    that, `competitor-ads.md` §1). Say "ChatGPT doesn't sell that spot: OpenAI says advertisers can't
    change what it recommends."
  - Ross speaks for himself: no testimonials, no "hundreds of stores use it", no "partnered with OpenAI".
  - Don't name the brands from his test in a paid ad.

---

### C1. No cost per click (a headline and a static, not its own ad set)

- **Angle:** price against no price. The contrast works whichever way prices moved this quarter, so we
  let the reader bring their own number. Run it as the line inside C7 and as one static in the round 1
  ad set, not as a separate concept with its own budget.
- **Hook (static, big type):** "Every ad click has a price. A ChatGPT recommendation doesn't."
  Line 2: "Average Google Ads click in the US: US$2.32 (2016), US$5.42 (2026)."
  Optional line 3: "Check what a click cost you in 2023, and what it costs now."
  Caption along the bottom: "WordStream benchmarks, US search campaigns. 2016 figure from its first
  report; samples and methods differ by year. Not adjusted for inflation."
- **Headline (38):** A sales channel with no cost per click
- **Primary text:**
  - First line (92): Every ad click has a price. When ChatGPT recommends your product, there's no cost per click.
  - In ChatGPT the answer itself isn't for sale: OpenAI says advertisers can't shape, rank or alter its answers.
  - Shoppers ask AI what to buy. It names a few brands, often with links to where to buy them. AI picks from what it can read about your products and the sites that mention them.
  - It's small today: ChatGPT was about 0.2% of store visits in one 2024 to 2025 study. And growing fast: Shopify's president said in Feb 2026 that AI search orders were 15 times higher than in January 2025.
  - See if ChatGPT, Gemini and Perplexity name your product. The check is free. [Price line, stage A or B.]
- **Visual (A, Meta):** 4:5 static, two plain cards. Left: "Ad click: has a price", with the WordStream
  line small. Right: a real ChatGPT quote card excerpt, "Recommendation: no cost per click". Our wordmark
  as large as "ChatGPT"; the independence line. No $0 bar (we don't chart the app as free).
- **Visual (B, LinkedIn, newsletters, organic and our site, not Meta):** the honest Meta chart. Bars for
  Meta's year-on-year change in average price per ad, Q1 2022 to Q2 2026 (`ad-facts.md` §1). Falls in
  light lilac `#BFC9FA`, rises in cobalt. Caption: "Meta's average price per ad, change on a year earlier.
  Falls in 2022 and 2023, rises in every quarter since Q4 2023, +12% in Q2 2026." Showing the falls makes
  it believable.
- **Facts used:** AC1, AI1, AI6, AI9, P3, P4. Visual B: AC3, AC4.
- **Policy notes:**
  - No "never", "always", "up and to the right", "higher than ever", "rising", "struggling" or "tired
    of". Every number keeps its year, region, platform and source.
  - The big type names "Google Ads" and "US" so Australians don't read it as their Facebook price.
  - No Meta chart on Meta (Meta can reject ads "contrary to our competitive position", `ad-rules.md` 1.7).
  - Not "your CPC" or "your CPM". No "lower your ad costs" or "replace your ads".

---

### C3. See the money (hold until order tracking works and paid clicks are split)

- **Angle:** what the app adds on top of Shopify's own reports. Shopify can already show chatgpt.com as a
  referrer (AI13). The app adds which questions and products the AI orders came from, every AI assistant
  in one number, and growth against your own baseline from before you joined.
- **Who it's for:** owners who judge every tool by revenue. Retargeting people who finished a check.
- **Pre-launch organic version (no install needed, post it now):** "Open Shopify, then Analytics, then
  Reports, then Total sales by referrer. Look for chatgpt.com." The owner's own data is the most
  believable proof there is. (Check the report exists on Basic plans before posting.)
- **Hook (video, first 3 seconds):** a link slides in and its tail lights up. Type: "This little tag
  helps you count AI sales." No `utm_source` text in the first 3 seconds.
- **Headline (39):** Count the orders AI links send your way
- **Primary text:**
  - First line (106): ChatGPT often adds a little tag to the links it gives. Our app looks for it, and for visits from AI sites.
  - Shopify's own reports can show chatgpt.com. The app adds which questions and products the orders came from, all AI assistants in one number, and your baseline from before you joined.
  - It counts the AI orders it can trace, so read it as a floor. Paid ChatGPT ad clicks are shown separately.
  - Shopify's president said in Feb 2026 that AI search orders were 15 times higher than in January 2025. [Price line, stage B only.]
- **Visual:** 9:16 screen recording of the "Money from AI" block: AI orders split by source, the baseline
  line, a question and product list. Dollar amounts blurred, or small and plainly modest. "Sample data,
  not a real store" in large type, on screen the whole time. No coin, no money imagery.
- **CTA and landing:** Learn more → the home page "See the money" section (`/#money` with UTMs).
- **Facts used:** P1, AI11 ([Seer](https://www.seerinteractive.com/insights/are-ai-sites-like-chatgpt-sending-your-website-traffic)), AI13 ([Shopify Help](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/acquisition-reports)), AI6, P4.
- **Before it runs (all three):**
  1. Order attribution works on a real store (protected customer data approval for
     `customerJourneySummary`, CLAUDE.md §18 item 4).
  2. Paid clicks are split out in the product. Today `classifyVisit` in `app/lib/attribution.ts` counts
     any chatgpt.com or openai.com referrer, or a chatgpt `utm_source`, as AI, and reads `utm_medium`
     without using it. ChatGPT ads are live in AU (AI2) and Seer says paid and organic can't yet be split
     cleanly (AI11). Flag landing URLs with `utm_medium` cpc, paid or ads, ad click IDs, or the merchant's
     own ad UTMs, and show them as "paid ChatGPT ads" outside AI revenue.
  3. Stage B pricing is live.
- **Policy notes:**
  - No comparison with other tools ("other tools count mentions" is false: AgentIQ, StoreRank, DeepLumen,
    Kedra and others track orders, `competitor-ads.md` §2). Never "only".
  - Say "counts the orders", never "gets you orders". Landing page keeps the honesty lines: Google's AI
    Overviews can't be cleanly separated from normal Google, and we never claim every AI sale was caused
    by the app (CLAUDE.md §10).
  - Real customer results only with written permission, real dates and baseline, and "results vary"
    (that is round 3, from the founding stores in 4.7).

---

### C4. In ChatGPT, the answer isn't for sale (round 2)

- **Angle:** lead with the answer, not with OpenAI's ad product. ChatGPT now sells ads in Australia, but
  OpenAI says the answer itself can't be shaped by advertisers. That makes the recommendation worth
  earning. The ads news is the second line, not the hook, so we don't send owners off to buy ChatGPT ads.
- **Hook (static):** "In ChatGPT, the answer isn't for sale."
- **Headline (39):** The part of ChatGPT that isn't for sale
- **Primary text:**
  - First line (116): In ChatGPT, the answer itself isn't for sale. OpenAI says advertisers can't shape, rank or alter what it recommends.
  - OpenAI's help page, word for word: "advertisers have no ability to shape, rank, or alter ChatGPT’s responses."
  - ChatGPT now shows ads in Australia. OpenAI says they are "always clearly labeled and separate from ChatGPT’s answers".
  - AI picks from what it can read about your products and the sites that mention them. See if ChatGPT, Gemini and Perplexity name yours. [Price line, stage A or B.]
- **Visual:** 4:5 static. A real ChatGPT quote card (names blurred) under "Recommendation: earned". Below,
  a separate duller tray labelled "Sponsored: ads go here", "Illustration". Our wordmark, the independence
  line. No ChatGPT colours or layout.
- **CTA and landing:** Learn more → `/check?utm_campaign=c4_earned`.
- **Facts used:** AI1, AI2, AI12, AI3 (checked against), P3, P4.
- **Policy notes:**
  - Always "in ChatGPT". Never "you can't pay to appear in AI answers": Google sells ads within AI
    Overviews in AU/NZ (AI3).
  - Use OpenAI's 23 Sep 2026 wording ("always clearly labeled and separate"), not "they sit below the
    answer": OpenAI announced a new visual ad format on 5 Oct 2026 (AI12) and promises more. Re-check both
    OpenAI pages weekly while C4 runs.
  - No Google search version, and no "chatgpt ads australia" keyword.

---

### C6. AI already has favourites in your aisle (round 2)

- **Angle:** AI is already recommending someone in your category. Here's what it named and what it leaned
  on, from a real test asked twice. The reader connects the dots about guide pages and sources.
- **Who it's for:** competitive categories (grooming first; other categories only after two saved runs).
- **Hook (carousel card 1 or first 3 seconds):** "Beard care brands: we asked ChatGPT twice for the best
  beard oil for dry skin in Australia."
- **Headline (36):** Who does AI recommend in your aisle?
- **Primary text:**
  - First line (106): We asked ChatGPT twice, as a shopper in Australia: best beard oil for dry skin? It named 3 brands, then 4.
  - Only one brand was in both answers. ChatGPT also cited that brand's own "best beard oil in Australia" guide, both times.
  - In these two answers, AI leaned on "best of" roundups, brands' own pages, a specialist retailer and skin-care guides.
  - See who AI names for your product, and which sites it trusts. [Price line, stage A or B.]
- **Visual:** 4:5 carousel. (1) The question, "Asked twice in Australia, 10 Oct 2026". (2) "Answer 1: 3
  brands" (blurred monogram discs). (3) "Answer 2: 4 brands. 1 in both." (4) "Sites it cited": icons for
  a roundup, a brand page, a shop front, a guide. (5) Different background, header "What our report looks
  like (made-up stores)", ranked bars with sample brands, "Sample data". (6) End card with wordmark and
  price line. Independence line on cards 1 and 6.
- **CTA and landing:** Learn more → `/check?utm_campaign=c6_aisle`.
- **Facts used:** P6 (evidence), P3, P4.
- **Policy notes:**
  - Real brands and sites are described, not named or shown, unless they give permission.
  - Any quoted excerpt leaves out the answers' skin-condition and treatment wording (TGA, CLAUDE.md §11).
  - "In these two answers", never "this is how AI picks" or "the reason they win".
  - If Beard Guru is ever mentioned, it is "a beard care store" (it sells its own beard oil and has a
    blog).
  - Never "Your competitor got recommended. You didn't." (crowded, and it assumes the viewer's situation).

---

### C8. Paste a product link (retargeting and Google search)

- **Angle:** the free check itself. No call to book, no form, no install. No competitor ad offers a
  product-level check (`competitor-ads.md` takeaway 3).
- **Who it's for:** warm audiences (site visitors, people who watched C2 or C7) and people searching on
  Google.
- **Hook (video, first 3 seconds):** a cursor pastes a product link into the real form and presses "Check
  my product". Type: "One link. Up to 18 AI answers."
- **Headline (39):** Paste a product link. See who AI picks.
- **Primary text:**
  - First line (116): Paste a product link. We ask ChatGPT, Gemini and Perplexity 3 shopper questions, twice each, and show who they name.
  - You also see which websites AI trusts for your kind of product, and a preview of each answer with the brands highlighted.
  - It takes a few minutes. No sign-up, no call. Leave your email and we'll send the report when it's ready.
  - The check is free. [Price line, stage A or B.]
- **Visual:** 9:16 real screen recording, sped up: paste, progress ("11 of 18 answers in"), the report.
  Expand only a ChatGPT answer, labelled "Real ChatGPT answer, asked in Australia, [date]. AI-generated."
  Gemini and Perplexity answer text blurred; counts and brand names only, rivals swapped for sample
  brands, "Sample data" on screen. Recorded per gate 8.
- **CTA and landing:** Learn more → `/check?utm_campaign=c8_check`.
- **Facts used:** P3 (`docs/free-check.md`, `app/lib/check-types.ts`), P4.
- **Policy notes:**
  - "Up to 18" and "a preview", because failed engine calls still count toward 18 and the report shows
    about the first 700 characters of each answer.
  - "Leave your email" only once gate 3 is built.
  - Show the real form, not a mock-up (Google bans "non-functional elements that resemble buttons, input
    fields", `ad-rules.md` 2.1).

---

## 3. Formats per channel

Practical for one person: make each concept in two sizes (4:5 and 9:16) and reuse it everywhere.

### Meta (Facebook and Instagram)

- **Feed:** 4:5 (1080 × 1350) static or carousel. Headline under 40 characters, first line of primary
  text under 125 characters, price line in the primary text.
- **Stories and Reels:** 9:16 (1080 × 1920) video, 8 to 15 seconds (C7: 30 to 45 seconds plus a 15-second
  cut). The audience line and hook in the first 3 seconds, captions burned in, key type in the middle of
  the frame (check the safe-zone preview in Ads Manager).
- **Round 1:** C5, C2, C7 (with C1 as one static). **Retargeting:** C8. **Round 2:** C4, C6. **Round 3:** C3
  with real store data.
- **Placements:** Advantage+ placements, both sizes uploaded so Meta doesn't crop.

### Shopify App Store search ads (after the listing is approved)

- Only published apps can advertise, ads are built from the listing and can't be customised, they link
  only to the listing, pricing is cost per click in a first-price auction, and the minimum budget is
  US$5 a day ([Shopify: About App Store ads](https://shopify.dev/docs/apps/launch/marketing/advertising),
  [Ads FAQ](https://shopify.dev/docs/apps/launch/marketing/advertising/faq)).
- **Keywords to bid on:** ai search, ai seo, chatgpt, chatgpt seo, ai visibility, ai traffic, ai
  attribution, perplexity, gemini, llms.txt, geo, aeo, llm seo, product faq, structured data, competitor
  tracking, utm tracking, attribution. (Jargon is fine as a bid keyword because merchants search it. It
  never goes in the copy.)
- **The listing is the ad:** no stats, no "best/first/only", no testimonials, screenshots with "Sample
  data" and no prices (`ad-rules.md` 3.2). Subtitle idea: "See if AI recommends your products and count
  the orders it sends."

### Google search (small, high-intent test)

- **Geography:** Australia and New Zealand. Phrase and exact match.
- **Keywords (owner intent only):** shopify chatgpt, chatgpt shopify, shopify chatgpt app, get recommended
  by chatgpt, how to get my products on chatgpt, chatgpt product recommendations for my store, shopify ai
  seo, shopify ai search, track chatgpt traffic shopify, chatgpt utm shopify. Dropped: "ai search
  optimisation", "ai visibility tool", "generative engine optimisation" (they draw marketers and agencies)
  and "chatgpt ads australia" (people shopping for ChatGPT ads).
- **Negatives:** login, download, free chatgpt, chatgpt plus, jobs, careers, course, essay, api, agency.
- **Competitor names:** allowed as keywords, but the headline leads with our own name and never reads as if
  we are them (`ad-rules.md` 2.2). Skip in round 1.
- **Responsive search ad (headlines max 30 characters, descriptions max 90):**
  - **Headline 1, pinned:** "[Name]: Free Product Check" (20 characters plus the name; the name can be
    up to 10 characters). Our name leads, so ChatGPT is never the most prominent mark.
  - **Headline 2, pinned:** stage A "App Coming: From US$97/mo" (25); stage B "7-Day Trial, Then US$97/mo"
    (26). Google: "Headlines or descriptions pinned to Headline position 1, Headline position 2, or
    Description position 1 will always show. Content pinned to Headline position 3 and Description
    position 2 are not guaranteed to show in every ad." ([Google Ads Help](https://support.google.com/google-ads/answer/7684791?hl=en), read 10 Oct 2026.)
  - **Unpinned headlines (no "free" in any of them):** "See If ChatGPT Recommends You" (29) · "Paste a
    Product Link" (20) · "For Shopify Stores in AU & NZ" (29) · "ChatGPT, Gemini & Perplexity" (28) ·
    "See Who AI Names in Answers" (27) · "Ask Twice. Get Two Lists." (25)
  - **Description 1, pinned (carries the price):** stage A "Our app is coming to the Shopify App Store at
    US$97/mo (USD). Join the early list." (82); stage B "US$97/mo (USD), billed by Shopify after a 7-day
    trial unless you cancel in the app." (83)
  - **Unpinned descriptions:** "Paste a product link. We ask ChatGPT, Gemini and Perplexity 3 shopper
    questions, twice." (87) · "See which stores AI names for your product and which sites it trusts. No
    sign-up." (81)

### LinkedIn

- **Organic first:** Ross posts twice a week (see Organic). Free, and reaches founders and ecommerce
  managers by name.
- **Paid later, only after a Meta winner:** LinkedIn clicks are usually dearer than Meta's (our judgement,
  no sourced figure). Document ad of the original study (4.8), C6 or C1 visual B. Targeting: AU and NZ;
  Founder, Co-founder, Owner, Managing Director, Ecommerce Manager, Head of Ecommerce; Retail, Apparel and
  Fashion, Personal Care Product Manufacturing, Food and Beverage, Consumer Goods; company size 1 to 200.

### Podcasts, newsletters and communities (AU/NZ ecommerce)

- **Add To Cart: Australia's eCommerce Show** (host Nathan Bush). Describes itself as "Australia's leading
  ecommerce and retail podcast" with "Over 600 conversations", and asks sponsors to email
  hello@addtocart.com.au ([episode page](https://www.buzzsprout.com/2521371/episodes/17537469-the-next-evolution-of-online-shopping-shopify-s-ai-powered-future-with-james-johnson-524), read 10 Oct 2026). No audience numbers or rates published. Pitch Ross as a guest first, with the original study (4.8) as the topic.
- **eCommerce Australia** (host Ryan Martin, founder of Remarkable Digital, which the show describes as
  "an eCommerce SEO and AIO agency"; [Apple Podcasts](https://podcasts.apple.com/au/podcast/id1580669040), read 10 Oct 2026). The host's agency sells AI search work: guest spot or referral partner, not a sponsorship.
- **Retail Community Group** (WhatsApp, run by Dean Salakas and Jethro Marks). Described as "4,000
  members, up to 90 chat groups" with a "pitch slap" rule (same Apple Podcasts page, 18 Aug 2026 episode).
  Join as Ross, answer AI search questions, share the study. Don't pitch.
- No audience sizes were found for any of these, so judge them by checks started with their UTM.

### Organic (the cheapest channel, and the one that builds trust)

- **Two founder posts a week:** one sourced fact and one question, never a pitch. Examples: "Every ad click
  has a price. When ChatGPT recommends a store, there's no cost per click. Which of those are you building
  on?" / "Open Shopify, then Analytics, then Reports, then Total sales by referrer. Is chatgpt.com there?"
  / "ChatGPT now has ads in Australia. OpenAI says they're always labelled and separate from the answer."
- **One short "live check" video a week:** run the check on a volunteer's product with their written OK
  to post. Expand only ChatGPT answers; blur Gemini and Perplexity answer text and rival brand names.
- **One category snapshot a month:** "What ChatGPT recommends for [category] in Australia": brands named
  per answer, how many repeat across two answers, kinds of sites cited, date asked. Counts and site types
  only. Save the raw answers in `docs/ads/evidence/`.
- **Reddit (r/shopify) and Facebook groups:** only as Ross, saying he built the app. No posts written to
  look like a customer (CLAUDE.md §11: no astroturf).

---

## 4. The first test plan

### 4.0 Go/no-go gates (fix these before spending a dollar)

1. **Install gate (hard).** A non-dev test store finishes install and starts the 7-day trial before any ad
   mentions the trial. Public apps need Shopify's approval ("Approval required: Yes",
   [Shopify: About app distribution](https://shopify.dev/docs/apps/launch/distribution)); `SHOPIFY_API_SECRET`
   isn't set on Railway, `npm run deploy` hasn't run and protected customer data isn't approved (CLAUDE.md
   §18). Advertising a service at a price we can't yet supply is misleading (ACL s18 and s29), and the
   ACCC's guide warns about advertised offers that are "not available in reasonable quantities and for a
   reasonable period" (bait advertising, ACL s35; `ad-rules.md` 5.10). Until this passes: stage A price
   line, and the report's trial button becomes an early-list form.
2. **Name and domain.** Settle the final name and a real domain before paid round 1, and check the name
   against the Shopify App Store and IP Australia (Shopify requires a "unique, recognizable name",
   requirement 4.1.2). "GEO" is also the industry jargon our copy avoids, and spend on a placeholder name
   and a `railway.app` address is lost when either changes. Until then, primary text says "our app".
3. **"Email me my report" and a copy-link button.** The check takes 3 to 6 minutes and the page only says
   "You can leave this page and come back to this link" (`app/components/check-ui.tsx`, line 396). Cold
   Meta traffic arrives in the Instagram or Facebook in-app browser, and closing it loses the link. Add an
   optional email field with a one-line privacy note, a copy-link button, and send the report link by
   Resend. The email list is the round 2 launch audience.
4. **Meta pixel plus Conversions API (must-have).** Fire `check_started` and `qualified_check` (Shopify
   store, AUD or NZD) from the server, optimise for `check_started`, update the privacy page. Optimising
   for landing page views finds cheap clickers, not store owners, and retargeting needs the pixel.
5. **UTMs on every check and a per-campaign headline.** Store utm_source, utm_medium, utm_campaign,
   utm_content and referrer host on `PublicCheck`; carry the check id through the install or early-list
   link; show a headline and one line on `/check` chosen by `utm_campaign`.
6. **Top up the Anthropic credit.** Without it the check falls back to text matching for brand names
   (CLAUDE.md §18), and the report is weaker exactly when strangers first see it.
7. **Raise the free-check caps for the test.** Defaults are 150 checks a day and a US$10 a day spend cap
   (`GEO_CHECKS_PER_DAY`, `GEO_CHECKS_USD_PER_DAY` in `app/lib/check.server.ts`). Past that, visitors see
   "We're very busy right now". Set both to expected daily checks plus half again.
8. **A real demo recording.** The sample store is made up, and the check rejects Shopify `/password`
   pages (`app/lib/check-read.ts`, line 477), so a password-protected dev store can't be demoed. Record a
   real store that has given written permission (swap rival names, "Sample data" on screen), or lift the
   dev store password for the recording and accept a low score as an honest "new store" demo.
9. **Confirm GST and cancel wording.** Ask Shopify Partner support whether GST is added to app charges for
   AU stores (and whether an ABN changes it). If yes, stage B says "plus GST". Cancel wording is "Cancel
   in the app or by uninstalling" (the Plans page has "Cancel my plan", `app/routes/app.plans.tsx`).
10. **Before C3 only:** paid ChatGPT ad clicks shown separately (C3, "Before it runs").
11. **Run the `ad-rules.md` go-live checklist** on every ad and the landing page.

### 4.1 Which three concepts first, and why

| Concept | Why it's in round 1 |
|---|---|
| **C5 The gift question** | The only angle in shopper language, nobody else in the category uses it, it's timely for gift season, and it now has real proof: 17 of 21 picks linked to the brand's own website, with prices and set contents quoted. Run it only in checked categories. |
| **C2 Ask twice. Get two lists.** | Broadest cold hook and cheapest to make. The self-test format has run 172 days in AU (Era Search), and our twist is proven (one beard oil brand in both answers). It also explains why the check beats asking ChatGPT yourself. |
| **C7 Founder to founder** | Ross's ad-cost insight in its true form, plus "no reviews yet, no promises". Lo-fi, believable, and the format most likely to stand out in a feed of pastel AI tool ads. C1 runs as one static inside the same ad set. |

Not in round 1: C3 (needs order tracking, paid click split and real stores), C4 and C6 (round 2), C8
(retargeting from day 3 once the pixel has an audience).

### 4.2 Campaign structure and audiences

- **One campaign, one ad set** (Australia and New Zealand, 25 to 60, Advantage+ audience with Shopify,
  Shopify Plus, Klaviyo, ecommerce and small business owners as suggestions), **optimised for
  `check_started`** via Conversions API.
- **Seven ads:** C5 hook A and B, C2 hook A and B, C7 full and 15-second cut, plus the C1 static. Hook A/B
  differ only in the first frame and first line.
- **Retargeting (A$5 a day, needs the pixel):** visited `/check` but didn't start → C8. Finished a check but
  didn't join the early list or install → C7.
- **Lookalikes (later, once there are a few hundred):** finished checks, then early-list sign-ups, then
  installs. Start at 1% in Australia. Using emails for audiences needs a line in the privacy policy first.
- **Google search:** AU and NZ, the owner-intent keywords in section 3.

### 4.3 Budget (modest, two weeks)

| Line | Per day | Days | Total |
|---|---|---|---|
| Meta round 1 ad set (7 ads) | A$90 | 14 | A$1,260 |
| Meta retargeting (C8, C7) | A$5 | 14 | A$70 |
| Google search (owner-intent keywords) | A$20 | 14 | A$280 |
| **Total** | | | **about A$1,610** |

- **Hard stop:** set an account spending limit of A$1,700 for the test.
- **What to expect (a reviewer's estimate, not data):** roughly A$15 to A$35 per qualified check from cold
  AU traffic, so about 35 to 85 qualified checks in total. Three separate A$30 ad sets would each sit in
  Meta's learning phase and might not reach 20 qualified checks; one pooled ad set avoids that.
- Plus the checks themselves: up to 18 answers at roughly US$0.003 each (CLAUDE.md §18), about US$0.05
  plus the Claude reading.

### 4.4 How to judge winners

**Round 1 (stage A): the free check is the conversion.**

- **Main measure: cost per qualified check**, by concept: spend ÷ finished checks for a real Shopify store
  selling in AUD or NZD (the check already reads platform and currency, `docs/free-check.md`).
- **Second: intent rate.** Share of finished checks that join the early list or leave an email.
- **Watch, don't judge on:** click-through rate and cost per landing page view.
- **Rules:** pause any ad that has spent A$100 with no check started. After about A$150 on each hook in a
  pair, cut the weaker one. After 14 days, the winning concept has the lowest cost per qualified check,
  at least 20 qualified checks, and an intent rate no worse than half the others'. With fewer than 20,
  extend a week. If Meta starves an ad (under A$50 by day 5), test it later on its own.

**Round 2 (stage B, after the listing is approved): the install and the paid plan are the conversion.**

- Cost per install, install to trial, trial to paid, cost per paying store.
- **Most you can pay per check** = target cost per paying store × check-to-install rate × install-to-trial
  rate × trial-to-paid rate. Example with made-up assumptions, not data: US$150 × 10% × 50% × 40% =
  **US$3.00 per check**. If the winner costs more per qualified check, fix the report and onboarding
  before adding budget.

### 4.5 What to measure inside GEO

| Step | Where | Needs building? |
|---|---|---|
| Check started, with UTMs and referrer | `PublicCheck` row | Yes (gate 5) |
| `check_started` and `qualified_check` sent to Meta | server events | Yes (gate 4) |
| Check finished, failed, minutes taken | `PublicCheck.status`, `createdAt`, `finishedAt` | No |
| Qualified check (Shopify store, AUD or NZD) | `PublicCheck.product` | A small query or flag |
| Email captured, report link sent, report viewed from email | new fields, Resend | Yes (gate 3) |
| Early-list sign-up or install click from the report | tracked redirect such as `/check/:id/install` | Yes |
| Cost per check (data and Claude) | `api_costs` rows with no shop | No |
| Install, linked back to the check and its UTMs | `shops` row plus a source field | Yes |
| Trial started, trial to paid, cancelled, uninstalled | `subscriptions`, webhooks | Check it's recorded |
| First AI order seen, days to get there; paid ChatGPT clicks kept apart | `ai_orders` | A small query; paid split (C3) |

The weekly report Ross reads: spend, qualified checks and cost per qualified check by concept, intent
rate, emails captured, installs, trials, paid stores, and one line on what changed.

### 4.6 Round 2 (once installs work)

Switch every price line to stage B. Test C4 and C6 against the round 1 winner, email the early list,
turn on Shopify App Store search ads at the US$5 a day minimum, and move Google budget to the keywords
that brought qualified checks.

### 4.7 Founding stores (the proof the money ad needs)

Ross asked for ads that show the app "can meaningfully increase their sales". That claim needs real
results, so build them on purpose:

- Invite 10 to 20 AU/NZ Shopify stores from the early list and the check (mix of categories).
- Record each store's baseline at install (the last 60 days of orders, as the app already does).
- Get written permission up front to publish their real numbers after 60 to 90 days, named or anonymous,
  whatever they show.
- Publish with the dates, the baseline, "results vary" and any incentive disclosed (for example free
  months), good or bad (`ad-rules.md` 5.6).
- That becomes round 3: C3 with real data, and customer quotes that are genuine and unedited.

### 4.8 Original study (pre-launch proof that can exist now)

- About 100 real Australian gift and "best X for Y" questions, asked twice each on ChatGPT, Gemini and
  Perplexity: about 600 answers at roughly US$0.003 each, plus Claude reading.
- Report how often brands' own websites were linked, how often marketplaces and big retailers were, how
  often answers repeated, and which kinds of sites were cited, with the date and method.
- Use it for a research-led ad, podcast pitches and LinkedIn posts (Peec's "232,000 citations" and
  Profound's "50,000 LLM responses" ads show the format works, `competitor-ads.md` §1). Gemini and
  Perplexity results appear as counts only.
- Once there is real volume, add a true counter ("X products checked since launch", counted from
  `PublicCheck`).

---

## 5. Words to use, words to avoid

| Use | Avoid | Why |
|---|---|---|
| no cost per click, no ad spend | free money, free traffic, free customers, GEO is free | Get-rich-quick rules (Meta, Google); ACCC "free" means absolutely free |
| in ChatGPT, the answer isn't for sale (OpenAI says advertisers can't shape, rank or alter it) | AI recommendations aren't for sale; you can't pay to appear in AI answers; none of them paid for the spot | Google sells ads within AI Overviews in AU/NZ; brands can pay to be in roundups AI cites |
| it names a few brands, often with links to where to buy them | it links straight to the stores | Often it links to roundups, retailers and marketplaces (P6, P7) |
| ChatGPT often adds a tag; the AI orders it can trace; read it as a floor | every AI sale tracked; the tag ChatGPT always adds | The tag was on 2 of our 8 answers; Seer: not guaranteed (AI11) |
| every ad click has a price; check what a click cost you in 2023 | ad costs never come down; CPMs only go up; up and to the right; rising ad costs | False on Meta's own numbers; no AU price data |
| Average Google Ads click in the US: US$2.32 (2016), US$5.42 (2026), with the WordStream caption | "2016: US$2.32 a click" with no platform or country | Australians on Facebook read it as their own price |
| it's small today and growing fast (dated) | AI is taking over shopping; huge untapped channel | AI9; honesty is our edge |
| see if, can help, shows | will get you, guaranteed, rank #1, more sales (as a promise), double your sales | Future claims need reasonable grounds; no store results yet |
| counts the orders AI links send, next to your baseline | other tools only count mentions; the only app that... | False comparison; competitors track orders too |
| real ChatGPT answer, asked in Australia, [date], AI-generated | an unlabelled drawing that looks like a real answer | ACCC overall impression |
| up to 18 answers; a preview of each answer | 18 answers; the actual answers | Failed calls count; the report shows a snippet |
| coming to the Shopify App Store, join the early list (stage A) | start your 7-day free trial (before gate 1) | Can't be supplied yet |
| our app (until the name is settled) | GEO, AEO, LLM, generative engine (in copy) | Placeholder name; jargon |
| "Shopify store owners:" or "If you sell beard care in Australia:" as the opener | gift ideas for him (as a hook) | Draws shoppers, not owners |
| independent; checks ChatGPT, Gemini and Perplexity | works with ChatGPT, partner, official, powered by ChatGPT | Not true; OpenAI and Google brand rules |
| catalogue, optimised, labelled, favourite, colour | catalog, optimized, labeled, favorite, color | Australian spelling (quotes keep their own spelling) |
| full stops, commas, colons, "and"; ranges with "to" | em dashes, spaced en dashes or spaced hyphens | House rule |

---

## Sources used in this file

Opened and read on 10 Oct 2026 (✓ re-opened in the final pass; the rest via the companion files, which
give exact quotes and dates).

- ✓ ChatGPT answers, Australia, 10 Oct 2026: `docs/ads/evidence/` (8 raw files with their Treg call ids)
- ✓ WordStream 2026 Google Ads benchmarks: https://www.wordstream.com/blog/2026-google-ads-benchmarks (updated 19 May 2026)
- ✓ WordStream benchmarks page first published 2016, now updated ("when the averages were $2.32 and $0.58"; "14,197 US-based WordStream client accounts"): https://www.wordstream.com/blog/ws/2016/02/29/google-adwords-industry-benchmarks
- ✓ Seer Interactive, AI traffic tracking (updated 22 Jun 2026): https://www.seerinteractive.com/insights/are-ai-sites-like-chatgpt-sending-your-website-traffic
- ✓ OpenAI Help, Memory: https://help.openai.com/en/articles/8590148-memory-faq
- ✓ TechCrunch, OpenAI visual ads (5 Oct 2026): https://techcrunch.com/2026/10/05/openai-launches-visual-ads-that-appear-alongside-image-generation-results/
- ✓ Shopify Help, Acquisition reports: https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/acquisition-reports
- ✓ Google Ads Help, About responsive search ads (pinning): https://support.google.com/google-ads/answer/7684791?hl=en
- ✓ ACCC Advertising and selling guide (bait advertising section): https://www.accc.gov.au/system/files/Advertising%20and%20selling%20guide%20-%20July%202021.pdf
- ✓ Beard Guru Australia home page: https://beardguru.com.au/
- ✓ Beards Australia gift pack page: https://beardsaustralia.com/product/beard-oil-and-grooming-kit-beards-australia-gift-pack
- WordStream 2024, Meta Q2 2026 results, OpenAI Help (Ads in ChatGPT), Shopify App Store ads and distribution pages, Add To Cart and eCommerce Australia pages: read for the first draft, links above
- Meta quarterly releases Q1 2022 to Q2 2026, Alphabet filings, Kaiser and Schulze: `docs/ads/ad-facts.md`
- OpenAI (ads in AU/NZ), Google Ads Help (ads in AI Overviews), TechCrunch, eMarketer, OpenAI DevDay, CP24, Search Engine Land, Digital Commerce 360: `docs/facts.md`
- Platform and ACCC rules: `docs/ads/ad-rules.md`. Competitor ads: `docs/ads/competitor-ads.md`.

---

## Review notes

Two reviews of the first draft (a compliance review, and an owner plus performance-marketer review). All
high and medium findings are applied. What changed, and what was skipped or adjusted:

**Applied**

- Trial offered before anyone can install: hard install gate (4.0 gate 1) and the stage A price line; the
  report's trial button becomes an early-list form. Trial wording (auto-billing, how to cancel) is stage B.
- "Isn't for sale" scoped to ChatGPT with OpenAI's words everywhere; "none paid for the spot" and "Named.
  Not paid for." removed.
- "Links straight to them" changed to "often with links to where to buy them"; C5 claims now rest on four
  saved answers.
- C1 hook names "Google Ads, US" with the WordStream caption; C1 folded into C7 and one static.
- C6 and C7 no longer rest on the undated planning test: beard oil re-run twice and saved; Beard Guru
  described as a store; C6 generalisation limited to "these two answers"; C7 filmed from Ross's own run.
- C3: "often adds" the tag; no comparison with other tools; what the app adds beyond Shopify's reports;
  paid ChatGPT clicks split as a precondition; blurred or modest sample figures, large "Sample data", no
  coin; `utm_source` out of the first 3 seconds; Shopify referrer report as a pre-launch organic hook.
- Trademark prominence: our wordmark on every image, AI names in body type, independence line on images.
- Google RSA: price pinned to headline 2 and description 1 only; "free" only in the pinned headline 1;
  owner-intent keywords only.
- C4 uses OpenAI's 23 Sep wording, quotes the help page exactly, weekly re-checks (new ad format, AI12),
  answer first and ads news second, round 2, keyword dropped.
- Perplexity and Gemini answer text blurred; only ChatGPT answers expanded.
- C8: "up to 18" and "a preview".
- "AI picks from what it can read about your products and the sites that mention them" used wherever that line appears (C1, C4).
- "Small today" line dated and added to C1, C5 and C7.
- C6 card 4 on a different background with "made-up stores".
- Name and domain made a gate; "our app" in primary text.
- C5 and C2 hooks name the audience in the first frame; no gift wrap in frame 1; real quote cards replace
  drawings; teaching line added.
- Funnel: email-me-my-report and copy-link (gate 3), pixel plus CAPI as a must-have (gate 4), one pooled
  ad set optimised for check started, hard spend stop, per-campaign landing headline (gate 5).
- Short version tells Ross the ads can't promise sales yet; founding stores plan (4.7); original study
  (4.8); at least half of round 1 lo-fi; real demo recording (gate 8).
- C2 rebuilt on "Ask twice. Get two lists." and Memory; CTA goes to the check.
- Fixed in companion files: `ad-facts.md` (2016 WordStream caveat; new section on ChatGPT's tag, paid and
  organic blending, and the new ad format), `ad-rules.md` (stage A/B price line, availability gate with the
  ACCC bait advertising quote, Google pinning rule, "straight to a few stores" fixed, image prominence
  rule), `competitor-ads.md` (takeaway 2 no longer says ad costs "only go one way"; "can't be bought"
  scoped to ChatGPT; "never say only" note on the money angle).

**Adjusted or skipped (and why)**

- Price wording: the two reviews disagreed (one kept "after a 7-day trial" in the coming-soon line, the
  other dropped the trial). Stage A drops the trial claim, because a trial that can't start is still a
  trial claim and would also need the auto-billing disclosure.
- The suggested "small today" line said "AI was about 0.2% of store visits". The study measured ChatGPT
  referrals only, so the copy says "ChatGPT".
- The reviewer's C5 line said both gift answers linked with `utm_source=chatgpt.com`. True for those two
  answers, but our two later answers had no tag, so ads don't claim it (2 of 8 answers).
- "Small Australian stores" became "the brand's own website": we can't show the stores' size.
- Beard oil was re-run on ChatGPT only (twice), not on Gemini and Perplexity: ads may only show ChatGPT
  answer text, and cross-engine counts belong in the original study (4.8).
- GST on app charges: not confirmed (no official Shopify page found). Left as gate 9 with "plus GST" ready.
- Dev work (email capture, pixel and CAPI, UTMs on checks, per-campaign headline, paid click split,
  early-list form) is specified as gates, not built: this pass could only edit `docs/ads/`.
- The ACCC bait advertising guidance is written around discounted prices. It is cited as a warning; the
  main legal risk named is ACL s18 and s29.
- One extra coffee run timed out and returned nothing, so the coffee finding rests on two answers
  (one from the reviewer, one from this pass).
