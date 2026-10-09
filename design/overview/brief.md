# GEO overview page — build brief

One long, very high-fidelity marketing + product-overview page for **GEO** (Shopify app that gets stores
recommended by ChatGPT & co and shows the money it brings in). It must **look and feel exactly like
https://qarin.framer.website/** (same layout rhythm, type, colours, radii, shadows, card styles, section
order) but with GEO's own content and screens. Reference screenshots of Qarin: `design/overview/ref/ref-00.png`
… `ref-08.png` (1440 wide, top to bottom; some Qarin images failed to load in those shots — imagine real
imagery there). Qarin's original copy: `design/overview/ref/qarin-copy.md`.

The page doubles as a **UI/UX overview**: every app screen appears as a crisp, realistic HTML/CSS mockup
(no screenshots), and the merchant journey is shown step by step.

## Hard rules

- **Honesty.** No fake testimonials, reviews, star ratings, "trusted by N users", customer logos, awards or
  made-up stats. Numbers inside UI mockups are sample data and the mockup frame says "Sample data". Real
  facts you MAY use (all true):
  - Checks ChatGPT, Gemini, Perplexity and Google AI Overviews (Claude on Pro).
  - Every question is asked 2× per engine per scan; we report averages.
  - Live test (Oct 2026): ChatGPT, Australia, "best beard oil for dry skin in Australia" named
    The Groomed Man Co, A Better, Bold & Bare and Milkman, and cited stuga.com.au's "best beard oil 2026"
    roundup, Chemist Warehouse, BIG W and Beard Guru. ChatGPT links carry `?utm_source=chatgpt.com`.
  - Live self-test (9 Oct 2026): 24 of 24 answers came back from 4 engines, about US$0.003 per answer.
  - Plans: Free scan $0 (one-time: 10 questions × 3 engines, visibility score, top competitors, AI revenue
    so far from the last 60 days). Core US$49/mo, 7-day free trial (25 questions, ChatGPT + Gemini +
    Perplexity + AI Overviews, weekly scans, 100 products optimised, 30 AI fixes/mo, outreach finder
    10 targets/mo, revenue dashboard, monthly email report). Pro US$149/mo (100 questions, daily scans,
    + Claude, 1,000 products, unlimited fixes, autopilot, 40 outreach targets/mo). Billed through Shopify.
  - Guardrails: approval required by default; never invents facts (ingredients, awards, reviews, stats);
    no therapeutic/medical claims on health, skin and supplement products (AU TGA rules) — a claims check
    runs before a fix is shown; never writes fake reviews or fake Reddit posts; outreach is honest pitches
    the merchant sends; every change stores the old value → one-click undo; cost per store is tracked.
  - Attribution sources: our own UTM links ("from pages we built"), `utm_source=chatgpt.com`, referrers
    chatgpt.com / perplexity.ai / gemini.google.com / copilot.microsoft.com / claude.ai etc., Shopify AI
    sales channels, later a post-purchase "How did you find us?" survey. Google AI Overviews can't be
    cleanly split from normal Google — we label that. We show a baseline and "growth since joining" and
    never claim all AI revenue was caused by the app.
- **Plain English.** Never say GEO/AEO/LLM as jargon in copy (the product name "GEO" is fine). Say "AI
  search", "ChatGPT & co", "AI shopping assistants". Short sentences.
- Sample brand for mockups: **"Bondi Beard Co."** (fictional, men's grooming, Australia, AUD). Sample
  competitors are the real ones from the live test above. Sample products: "Sandalwood Beard Oil 30ml"
  (A$34), "Daily Beard Wash 200ml" (A$26), "Beard Balm – Cedar" (A$29), "Sensitive Skin Beard Oil" (A$36),
  "Gift Set – The Essentials" (A$79).

## Artifact contract (the page is published as a claude.ai Artifact)

- No `<!doctype>`, `<html>`, `<head>`, `<body>`. The final file starts with `<title>GEO Overview</title>`,
  then the Google Fonts `<link>`, then `<style>`.
- Fonts only from Google Fonts: Geist (500, 600) for headings, Inter (400, 500, 600) for body.
  Fallback stacks are in base.css.
- No external images or scripts. Images are local files under `img/` (relative paths, e.g.
  `img/team-laptop.jpg`). Icons are inline SVG (stroke style, 1.5–2px, like Qarin's).
- Single light theme (Qarin is light). Every colour comes from the tokens in `base.css`; the page sets its
  own background. No dark-mode blocks needed.
- Must work at **390px** wide: 16px side gutter, no horizontal page scroll, grids stack to one column,
  big mockups scale down (wrap wide mockups in a container with `overflow:hidden` and let them shrink, or
  give them a mobile layout). No `min-width` wider than the screen.
- JS only inline, small, vanilla (tabs, FAQ accordion, pricing toggle, marquee is CSS). No `alert()`.
- `text-wrap: balance` on headings; `font-variant-numeric: tabular-nums` on numbers.

## Visual system (from Qarin, measured)

Tokens and primitives are in `design/overview/base.css` — use them, don't redefine them. Summary:
- Headings: Geist 500, navy `#0b0c2b`, very tight tracking. h1 64px / -3.5px / 1.1; h2 48px / -2px /
  1.15 (34px on mobile); h3 28px / -1px; card titles 22–24px / -0.5px.
- Body: Inter 16px / 1.7, grey `#66677d`. Small labels 13–14px.
- Primary blue `#3355ff`, lighter `#5c77ff`, gradient `#3355ff → #8599ff` (top→bottom) for the stats band,
  pricing section and blue stat card.
- Lavender surfaces `#f2f2ff` / `#ebeeff`, lavender border `#e8e6fa`, icon chip `#e1e2fc`.
- Section backgrounds alternate white `#ffffff` and `#fafafa`. Dark section `#18191b` with radius 32px.
- Buttons: dark navy gradient `linear-gradient(#373868, #15163c)`, white text, radius 10px, inset
  highlight; secondary = white with `#e8e8e8` border.
- Section label pill ("Meet Qarin"): small lavender icon chip + white label chip, 13px text.
- Cards radius 16px (big frames 24px), soft shadow `0 20px 25px -5px rgba(0,0,0,.05)`, 1px borders.
- Container max-width 1296px (72px side padding on desktop, 16px on mobile). Sections ~120px vertical.

## Section map (Qarin section → GEO content). Keep Qarin's order and layouts.

1. **Nav** (floating rounded bar, `#fafafa`): GEO logo mark (two overlapping rounded shapes in blue/lavender
   like Qarin's mark, plus wordmark "GEO"), links: Overview, Screens, How it works, Pricing, FAQ; right:
   dark button "Get your free scan". Mobile: links hide, button stays.
2. **Hero**: pill "New · Now checks Google AI Overviews →". h1 "Get your store recommended by ChatGPT & co".
   Sub: "GEO shows where AI shopping assistants recommend you, fixes your product pages in one click, and
   shows the sales AI sends your way." Buttons: dark "Get your free scan", white "See every screen".
   Below: the big **Dashboard mockup** (Shopify-admin-style embedded app frame: thin admin top bar, left
   app nav: Dashboard, Questions, Competitors, Fixes, Outreach, Settings) inside a white rounded 24px frame
   with big soft shadow, over a faint square-grid background that fades out. Dashboard content: "Money from
   AI · This month" block first (AI revenue A$4,820 ▲ vs baseline, AI orders 61, AI clicks 1,940), source
   split bar (ChatGPT / Perplexity / Gemini / Other), visibility score ring 62/100 with sparkline, "Do this
   next" 3 fixes. Small "Sample data" tag on the frame.
3. **Engines marquee** (instead of "Trusted by"): line "Checks the answers shoppers actually see in" then a
   slow CSS marquee of engine/platform name chips with simple monogram icons: ChatGPT, Gemini, Perplexity,
   Google AI Overviews, Claude (Pro), Shopify. Fade edges.
4. **Meet GEO** (bg `#fafafa`): label "Meet GEO", h2 "Everything you need to get picked by AI", sub. 2×2-ish
   grid exactly like Qarin: left column two short wide cards, right column one tall card. Lavender gradient
   cards with mini UIs:
   - "Visibility by engine" — mini stacked bar chart (ChatGPT, Gemini, Perplexity, AI Overviews, Claude).
   - "Who AI recommends instead" — mini list of brand rows with position badges (The Groomed Man Co #1,
     Milkman #2, Bold & Bare #3, You #4) and a status chip.
   - Tall card "Money from AI, live" — "AI revenue" number + area line chart, a chip "ChatGPT ▲".
5. **Stats band** (blue gradient, rounded 24px, 4 columns, dashed dividers, white text). Real facts only:
   "4" AI assistants checked every scan · "2×" each question is asked twice per engine, we show the average ·
   "1-click" undo on every change we make · "$0" for your first scan.
6. **"See the money, not just mentions"** (Qarin "Visibility into every sales action"): left h2 + text +
   checklist with dividers (✓ Spot orders that came from ChatGPT, Perplexity and Gemini ✓ See revenue from
   the guide pages GEO builds ✓ Compare against your own baseline from before you joined). Right: photo
   `img/team-laptop.jpg` (rounded 16px) + overlapping blue gradient stat card "How we spot an AI sale"
   ("ChatGPT adds utm_source=chatgpt.com to its links — we read it on every order.") + overlapping white
   chart card (AI orders per week bars).
7. **Every screen** (Qarin "AI-Powered growth stack" with tab buttons): label "The app", h2 "Six simple
   screens. One job each.", sub. Tab buttons (icon + text) for: Dashboard · Questions · Competitors &
   sources · Fixes · Outreach · Plans & settings. Below: a big rounded frame showing the selected screen
   mockup (each a faithful, data-rich HTML mockup in the embedded-admin frame). Under the frame, a one-line
   "What this screen is for" caption. Default tab: Questions. Screens:
   - Questions: table of tracked questions (text, monthly searches, named? ✓/✗ per engine dots, best
     position, top competitor); one row expanded showing the actual ChatGPT answer with brand names
     highlighted and cited sources chips (stuga.com.au, chemistwarehouse.com.au, bigw.com.au,
     beardguru.com.au).
   - Competitors & sources: "Who wins most" ranked bars; "Sites AI trusts" list with type chips (Roundup,
     Retailer, Reddit, Brand) and "You're on it?" yes/no.
   - Fixes: queue list (left) + selected fix with Before/After diff preview of a product description, reason,
     "Claims check passed" badge, buttons Approve / Edit / Skip, and "Undo" in a history row.
   - Outreach: target table (article, site, who it names, author, email found?) + drafted pitch panel with
     subject + short honest email + "Copy pitch" / "Open in email" buttons, "Sent? Mark as sent".
   - Plans & settings: three plan cards mini + toggles (Autopilot — Pro, Monthly report recipients, questions
     count usage meter "18 of 25 questions").
   - Dashboard: (reuse the hero mockup at smaller size or a variant).
8. **Guardrails** (dark `#18191b` rounded 32px section, Qarin "Core features"): label "Built-in guardrails",
   h2 "Safe changes, honest results", sub. 3×2 cards with big white stroke icons: You approve every change ·
   Never makes things up · No health claims (AU TGA rules) · One-click undo · No fake reviews, ever · Cost
   cap per store. Each with 2-line description.
9. **Fix engine** (Qarin "Power Pack"): label "Fix engine", split heading "Fixes written for how AI reads
   your store" + right paragraph. Below: bordered box: left list of 3 features with icon column (Product
   pages AI can understand · Answers to real buyer questions (FAQ blocks) · Guide pages that win roundups);
   the first item is active (blue top/bottom border like Qarin). Right: big mockup of a product page
   before/after (Shopify product editor-ish) or an FAQ block preview.
10. **How it works** (Qarin 3 cards with mini UIs + title/text below): label "How it works", h2 "Live in five
    minutes. Mostly automatic.". Cards: (1) "Install and we set up" — mini list: Read your catalog ✓ ·
    Write your brand profile ✓ · Suggest 30 buyer questions ✓ · Pick your top 25 (button). (2) "First scan in
    about 2 minutes" — answer card: question, engine pills, progress "18 / 20 answers", a highlighted answer
    snippet. (3) "Approve fixes, watch revenue" — statistics card with smooth line + tooltip "A$1,240" and two
    mini stats. Below the cards, a slim 5-step UX timeline: Install → 5-min setup → Baseline scan → Weekly
    scans (daily on Pro) → Monthly email report.
11. **Real answers** (replaces Qarin's Trustpilot + testimonials, same card layout: image left, quote middle,
    stats right): label "Proof, not promises", h2 "What a real AI answer looks like". Card 1: image
    `img/beard-oil.jpg`; "quote" = the question in quotes; below it "ChatGPT · Australia · live test, Oct 2026";
    right stats: "4 brands named" · "4 sites cited". Card 2: image `img/founder-phone.jpg`; quote: "24 of 24
    answers came back from 4 AI assistants in our live test." ; meta "GEO self-test · 9 Oct 2026"; stats
    "~US$0.003 per answer" · "2 runs per engine".
12. **Connections hub** (Qarin integrations): label "Connections", h2 "Plugs into Shopify. Reads the AI
    answers for you.", sub, dark button "See what we connect to". Hub: centre GEO tile (blue, concentric
    lavender rounded rings) with tiles around it: Shopify, ChatGPT, Gemini, Perplexity, Google, Claude,
    Email reports, Web pixel. Tiles are white rounded squares with monogram/simple icons + tiny caption.
13. **Pricing** (full-width blue gradient rounded section): label "Pricing", h2 "Simple plans. Real money
    tracked.", segmented pill "Monthly · Billed through Shopify" (Monthly active; second segment "7-day free
    trial on Core" is informational). Cards: Free scan (white) · Core US$49/mo (dark `#18191b`, "Most
    popular" blue badge) · Pro US$149/mo (white). Feature lists with check chips, buttons "Start free scan" /
    "Start 7-day trial" / "Go Pro". Fine print: "Prices in USD. Shopify adds them to your normal bill."
14. **FAQ**: left: label "FAQs", h2 "Got questions?", text, then dark rounded card with `img/support.jpg`
    (fills card, dark gradient at bottom) + text "Stuck on setup? We'll help you get your first scan
    running." + "Contact us ↗". Right: accordion cards (first open): How do you know a sale came from AI? ·
    Will GEO change my store without asking? · Which AI assistants do you check? · Can I undo a change? ·
    Does it write health or skin claims? · What's in the free scan?
15. **Guides** (Qarin blog): label "Guide pages", h2 "Pages GEO can write for you", three cards with
    images `img/guide-beard-oil.jpg`, `img/guide-sensitive.jpg`, `img/guide-gifts.jpg`; meta "Example ·
    Guide page"; titles "Best beard oil for dry skin in Australia", "Beard care for sensitive skin: what to
    look for", "Gift ideas for bearded men under $80"; link "See example →".
16. **CTA + footer**: big light rounded section (hero-grid bg) with h2 "See where you stand with AI today",
    sub, white button "Get your free scan". Footer inside the same rounded light block: logo + one line,
    columns Product (Overview, Screens, Pricing, Changelog), Company (About, Privacy, Terms), Support
    (Help, Contact, Setup guide). Bottom line: "© 2026 GEO · Made for Shopify stores in Australia & NZ".

## Images (generated with Treg → Gemini image, saved in `design/overview/img/`)

| File | Use | Aspect |
|---|---|---|
| `team-laptop.jpg` | §6 photo (exists) | 4:5 |
| `founder-phone.jpg` | §11 card 2 | 4:5 |
| `beard-oil.jpg` | §11 card 1 | 4:5 |
| `support.jpg` | §14 dark card | 16:10 |
| `guide-beard-oil.jpg` / `guide-sensitive.jpg` / `guide-gifts.jpg` | §15 | 4:3 |

Builders reference these paths even before they exist.

## File layout

- `design/overview/base.css` — tokens + primitives (given).
- `design/overview/parts/NN-name.html` + `parts/NN-name.css` — one per builder chunk. CSS class names in a
  part are prefixed with the part's short prefix (e.g. `.hero-…`, `.scr-…`) to avoid clashes.
- `design/overview/index.html` — assembled final page (title + fonts link + one `<style>` containing
  base.css + all part CSS + the parts' HTML in order + one small `<script>`).
