# Redesign brief: money-first copy, clay look, lilac gradient (Oct 2026)

Ross's decisions (final):

1. **Message direction A: free customers from AI.** Shoppers ask AI assistants what to buy, tens of
   millions of times a day. An AI recommendation is not an ad: you can't buy it, you earn it. GEO gets
   your products into those answers and shows every dollar it brings in. No ad spend.
2. **Main headline:** "The free sales channel your store is missing".
3. **All photos become clay renders** (same soft 3D clay style as `design/overview/img/guide-*.jpg`).
4. **Add a "what's it worth to you" slider** (section spec below). It can be removed later.
5. **Tone: confident, informative, educational. Never salesy.** People don't want to be sold; they want
   to put the information together themselves. Show the facts, the mechanism and their own numbers,
   and let them connect the dots. Prefer "Here's how AI picks what to recommend" over "Buy GEO now".
   Questions and evidence over claims. Short sentences. Plain English. Australian spelling.
6. **New main colour: the lilac to periwinkle gradient** from the clay guide images.
7. **Never use em dashes (—)** anywhere in copy. Use a full stop, comma, colon or "and".

Honesty rules still apply (CLAUDE.md): no promised results, no fake reviews or user counts, every
number links to its source, sample data labelled, say "no ad spend" not "free" when talking about GEO
itself (GEO costs money; the AI recommendations are what's free).

## Palette (sampled from the clay images)

| Token | Value | Use |
|---|---|---|
| `--lilac-50` | `#EFECFD` | gradient top, soft section backgrounds |
| `--lilac-100` | `#E2E2FC` | gradient middle, card fills |
| `--peri-300` | `#BFC9FA` | gradient bottom |
| `--lilac-pedestal` | `#E1CCF7` | highlights, chips, pedestals |
| `--lilac-deep` | `#B5A8E0` | borders on lilac, subtle strokes |
| `--cobalt` | `#4050B0` | primary accent (numbers, links, active states) |
| `--cobalt-mid` | `#6878D8` | secondary accent, chart fills |
| `--cobalt-deep` | `#3840A0` | pressed/hover, small text on lilac (check contrast) |
| `--navy` | `#0B0C2B` | headings and body on light backgrounds (keep) |

Main gradient: `linear-gradient(180deg, #EFECFD 0%, #E2E2FC 50%, #BFC9FA 100%)`.
Use it for: the hero background (with the faint grid on top), the stats band, the pricing band, the
closing CTA card, and big feature cards. Text on it is navy (not white) and accents are cobalt.
Buttons stay dark navy (best contrast). The dark guardrails section becomes deep indigo
(`#1B1D4A` to `#15163C`) so it belongs to the same family. Check contrast (WCAG AA) for small text.

## Clay images (Treg, Gemini image, same art direction as guide-*.jpg)

Prompt template: "Soft 3D clay render, matte, rounded, pastel lavender and periwinkle palette with
cobalt blue and soft gold accents, studio lighting, gentle shadows, background a smooth vertical
gradient from #EFECFD at the top to #BFC9FA at the bottom, centred composition on a round lilac
pedestal, premium and calm. No text, no letters, no numbers, no logos, no watermarks."

| File | Use | Subject | Aspect |
|---|---|---|---|
| `clay-money.jpg` | "See the money" section (replaces team-laptop) | a chat bubble with small shopping bags and gold coins spilling out onto the pedestal | 4:5 |
| `clay-answer.jpg` | proof card 1 (replaces beard-oil photo) | a clay smartphone showing a chat with a little amber dropper bottle card and a gold star badge (no text on screen) | 4:5 |
| `clay-support.jpg` | FAQ help card (replaces support photo) | a friendly clay headset beside two chat bubbles (one with three dots) | 16:10 or 16:9 |
| `clay-shield.jpg` | guardrails section accent | a rounded clay shield with a soft check mark shape (not a letter) | 1:1 |
| `clay-coins.jpg` | pricing / slider section | a small stack of gold clay coins and a rising cobalt bar chart | 1:1 |
| `clay-magnifier.jpg` | free-check loading state | a clay magnifying glass over a small dropper bottle and a chat bubble | 1:1 |
| `clay-storefront.jpg` | connections / CTA | a tiny clay shop front with an awning, a chat bubble floating above with a gold star | 4:3 |
| `clay-bubble.png`, `clay-coin.png`, `clay-bag.png` | floating decorations around the hero dashboard | single small object each, on a PURE WHITE background (used with `mix-blend-mode: multiply` over lilac) | 1:1 |

Compress to JPEG/PNG under ~200 KB each (max 1200px). Check every image: no text or letters, no logos,
no warped shapes. The old photos (`team-laptop.jpg`, `beard-oil.jpg`, `support.jpg`,
`founder-phone.jpg`) are no longer used after the redesign.

## Copy plan (home page, section by section)

Keep the existing section order and layouts (they work); change the words and the colour. Every
section answers "what's in it for my store" and teaches something.

1. **Hero:** headline "The free sales channel your store is missing". Sub-line that teaches the
   mechanism in one or two sentences (shoppers ask AI what to buy; AI recommends a few stores; those
   visits cost nothing). The free product check form stays as the main action.
2. **Why now (the education block):** lead with the scale: about 2.5 billion ChatGPT messages a day,
   about 2% about products to buy, so roughly 50 million shopping questions a day on ChatGPT alone
   (verify the 2% figure first; see `docs/facts.md`). Then the growth (Triple Whale ~60x, Shopify 15x)
   and the behaviour (77% used AI to shop, 69% bought something they wouldn't have, 60% higher
   conversion). Frame as questions the reader answers themselves ("Which stores is AI recommending in
   your category?").
3. **How AI decides what to recommend:** a short explainer (product data it can read, answers to real
   questions, articles and roundups it trusts). This sets up the fixes without selling.
4. **See the money, not just mentions:** what GEO measures (orders, revenue, clicks from AI, against
   your baseline).
5. **What's it worth to you (new slider section):** see spec below.
6. **The app (six screens), Guardrails, Fix engine, How it works, Proof, Connections, Pricing, FAQ,
   Guides, CTA:** same structure, copy rewritten benefit-first and educational. Pricing framing:
   "If GEO brings you one extra order a month at your average order value, compare that with
   US$97." Let them do the maths (the slider helps). (Prices updated 10 Oct 2026: Standard US$97 a
   month, Done-for-you US$497; see `app/lib/plans.ts`.)

## "What's it worth to you" slider (new section, vanilla JS, no library)

- Two sliders with number read-outs: **Average order value** ($20 to $300, default $80, step $5) and
  **Extra orders a month from AI** (1 to 50, default 5).
- Output: monthly and yearly extra revenue, and the working shown in words so they connect the dots:
  "5 orders × $80 = $400 a month, or $4,800 a year."
- A neutral line beneath: "GEO Standard is US$97 a month. You decide what's realistic for your store."
  No promise of results. Use a plain "$" (no currency conversion).
- Accessible: real `<input type="range">` with labels, `aria-valuetext`, keyboard friendly, works at
  390px. In the design preview it works the same (pure client-side).

## Free-check page

Same palette and clay look: lilac gradient header area, `clay-magnifier.jpg` in the loading state, copy
in the same educational tone (explain what each number means). No em dashes.
