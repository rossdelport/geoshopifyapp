# App Store listing (paste into the Partner Dashboard)

Every limit below is from shopify.dev unless it says "form counter". The Partner Dashboard form shows a live counter
for every field: trust it over this page. Counts include spaces.

Rules this copy follows: no numbers about results, no data claims, no guarantees, no "first", "best", "only" or "#1",
no reviews, prices only in the pricing section, "Shopify" never in the name, no em dashes, no "AEO" or "LLM", and
"GEO" only as our name. The copy never names the app, so it works with whichever name you pick.

---

## 1. App name (30 characters max, must be unique)

Shopify's rules: lead with a distinctive brand, not a generic word; not identical or confusingly similar to another
app; and the name must match, or be close to, the `name` in `shopify.app.toml` (now `GEO`).

What I found (web search of apps.shopify.com, 13 Oct 2026; the form itself does the final check when you type the name):
at least ten apps in this category already use "GEO" as a word: GEO Rocket, geo agent, GEOde, Geoffy, geOracle,
MagicGeo, Grounded GEO, Glu: GEO for AI Answers, AI Visibility & LLMs for GEO, AIVisible: GEO/AEO for ChatGPT. So
"GEO" on its own now reads as the generic name for this kind of app. No app or brand called "UseGEO" turned up.

| # | Name | Chars | What I found |
|---|---|---|---|
| 1 | **UseGEO: Get Recommended by AI** | 29 | No "UseGEO" app found. Matches usegeo.app. Nearest wording: "Shoptank: Be Recommended by AI", a different brand, so not confusing. |
| 2 | UseGEO: AI Search Visibility | 28 | Brand is free, but the second half is word for word "Cited: AI Search Visibility". |
| 3 | UseGEO: AI Sales & Visibility | 29 | Brand is free. Close to "Vanto: AI Visibility & Revenue" and "AI Sales Tracker & Attribution". |
| 4 | GEO: Get Recommended by AI | 26 | No exact match, but it leads with "GEO", which reviewers may see as generic or as too close to GEO Rocket, geo agent and the rest. |
| 5 | GEO: AI Search & Sales | 22 | Same "GEO" risk as option 4. |

**Recommended: "UseGEO: Get Recommended by AI".** It is the only brand here nobody else uses, it matches the domain,
and it says the benefit in plain words. If you pick it, change `name = "GEO"` to `name = "UseGEO"` in
`shopify.app.toml` and run `npm run deploy`, so the admin menu and the listing match (Shopify rule 4.1.1; the admin menu
cuts names after 20 characters). Billing plan names ("GEO Standard" and the rest) stay as they are: stored
subscriptions use them.

## 2. App icon

See `screenshots.md` (icon note). 1200 x 1200 px, PNG or JPEG, no text.

## 3. App card subtitle (form counter; kept to 62 or under)

> Help AI assistants recommend your products and track AI sales

(61 characters.) Spare: "See if ChatGPT and other AI assistants recommend your products" (62).

## 4. App introduction (100 characters max)

> Help ChatGPT and other AI assistants recommend your products, and see the AI sales you can trace.

(97 characters.)

## 5. App details (500 characters max)

> We ask ChatGPT, Gemini, Perplexity and Google AI Overviews your shoppers' questions and show if you are named, who is named instead and which sites they quote. We write clearer product descriptions, titles, FAQs and buying guide pages using only facts from your store. On Standard you approve each change; Done-for-you applies them for you. Every change can be undone. We find pages AI quotes that skip you and draft honest pitches. You see the AI clicks, orders and revenue we can trace.

(488 characters.)

## 6. Feature list (80 characters max each)

Use them in this order. If the form takes fewer, drop from the bottom.

1. See the clicks, orders and revenue you can trace back to AI assistants (70)
2. Track buyer questions on ChatGPT, Gemini, Perplexity and Google AI Overviews (76)
3. See which brands AI recommends instead of you, and which sites it quotes (72)
4. Product fixes written from your own facts. Approve in one click, undo any time (78)
5. Buying guide pages for your store, published when you approve them (66)
6. Find roundups and blogs AI quotes that skip you, with a drafted pitch (69)
7. Show approved product FAQs on your product pages with a theme block (67)
8. Weekly check that your robots.txt lets AI assistants read your pages (68)

## 7. Pricing (the only place prices go)

Billing method: **Recurring charge**. The app bills through the Shopify Billing API (`appSubscriptionCreate`), so these
plans are what the listing shows; the app's own Plans page does the charging. No additional charges. Prices in USD.

Plan features match `app/lib/plans.ts`. Three lines were shortened or split to stay short, and "optimised" is spelt
"optimized" (the website uses US spelling).

**Free scan** · Free
- One scan of 10 buyer questions
- ChatGPT, Gemini and Perplexity
- Your visibility score and top competitors
- AI sales from the last 60 days

**Standard** · US$49 a month, or US$441 a year · 7-day free trial
- 50 buyer questions, checked every week
- ChatGPT, Gemini, Perplexity and Google AI Overviews
- Unlimited fixes, approved in one click
- 500 products optimized
- 2 guide pages a month, you approve
- Up to 10 outreach pitches a month, drafted
- AI sales dashboard and monthly email report

**Done-for-you** · US$349 a month, or US$3,141 a year · 7-day free trial
- 100 buyer questions, checked every day
- Everything in Standard, plus Claude
- Fixes applied for you. Ones needing your input wait. Switch off or undo
- 2,000 products optimized
- 8 guide pages a month, written and published for you
- Up to 40 pitches a month sent and followed up for you
- Includes directories and roundups
- Monthly report and a 30-minute call
- Hand outreach and your call start after the trial

Enter both a monthly and a yearly price for Standard and Done-for-you ("monthly with a yearly option"). Don't add
"3 months free" or any savings text: the listing shows the yearly price itself.

## 8. Categories and tags

- **Primary:** Store design > Site optimization > **SEO** (the fixes: product copy, search titles, FAQs, guide pages).
- **Secondary:** Store management > Operations > **Analytics** (AI visits, AI orders, AI revenue, visibility score).
- Structured features (up to 25 per category): tick only what the app really does, such as product descriptions,
  meta titles and descriptions, FAQ structured data and the robots.txt check. Nothing about images, speed or redirects.

## 9. Search terms (up to 5, whole words, one idea each)

1. AI search
2. ChatGPT
3. AI visibility
4. AI SEO
5. AI attribution

## 10. Integrations (optional, up to 6)

Leave empty. The app reads AI answers through a data provider; it doesn't connect to anyone's ChatGPT, Gemini or
Perplexity account, so listing them as integrations could read as a partnership.

## 11. Support, links and other fields

- **Support email:** [SUPPORT EMAIL]
- **Privacy policy URL:** https://usegeo.app/privacy
- **Developer website:** https://usegeo.app
- **Language:** English
- **Install requirements:** Online Store sales channel (guide pages, the FAQ theme block and visit tracking need it).
  No country limits: stores in countries AI can't be asked from are checked as a shopper in the US.
- **Demo store URL:** optional. Skip unless you set up a public demo store.

## 12. FAQ

The listing has no FAQ text field, only an optional FAQ link. If you add an FAQ page to usegeo.app, these answers
match the app (taken from `docs/copy-deck.md` and the code):

- **What does it do?** It checks whether ChatGPT, Gemini, Perplexity and Google AI Overviews recommend your products,
  writes fixes, and counts the sales it can trace back to AI.
- **How do you know a sale came from AI?** The shopper arrived from an AI assistant (for example chatgpt.com or
  perplexity.ai), or the link was tagged `utm_source=chatgpt.com`. Google AI Overviews can't be separated from
  normal Google, so they aren't counted.
- **Will it change my store without asking?** Not on Standard: you approve every change. Done-for-you makes changes
  for you, except ones that need facts from you or risky claims. Undo takes one click.
- **Does it write reviews or forum posts?** No. It never writes reviews or posts as anyone. Pitches are honest emails
  from you.
- **Do you store my customers' details?** No names, emails, phone numbers or addresses. See the privacy policy.
