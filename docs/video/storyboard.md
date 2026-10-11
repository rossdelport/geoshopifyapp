# Member tour video: storyboard and on-screen copy

Replaces "Watch a free check" in the home page video section (`design/overview/parts/11v-video.*`). Written
11 October 2026 from `docs/video/research.md` (the source of truth for every timing line), `app/lib/plans.ts`,
the real app screens (`app/routes/app._index.tsx`, `app.fixes.tsx`, `app.outreach.tsx`, `app/lib/report.server.ts`)
and the page's look (`design/overview/base.css`, `parts/20m-money.*`, docs/copy-deck.md 14b).

What it is: a silent, looping tour of what a store gets after it joins, in the order a member lives it. Made-up store
**Coolabah Grooming Co.**, every number a sample, a small "Example" tag on every frame. It shows the member's
experience over time (day one, every month, every week, the money). It does not repeat the five method steps of
"How GEO works to get you recommended" (`parts/20-how.*`): no "Find where AI looks", no robots.txt scene, no
"Get named where AI looks" wording.

---

## 1. At a glance

| | |
|---|---|
| Length | **56.0 s**, 1,680 frames at 30 fps, silent, loops seamlessly |
| Compositions | `MemberTour` 1280x800 (desktop) and `MemberTourPhone` 390x640 rendered at `--scale=2` (780x1280) |
| Render | `./render.sh MemberTour MemberTourPhone member-tour 1325` (from `design/video`) |
| Scenes | 7: install, day one, fixes, every month, every week, the money and report, end card |
| Poster | frame **1325** (0:44.2) on both: the money scene, settled, before the email card arrives |
| Section heading | **What you get when you join** |

### Scene list

| # | Global frames | Time | Time chip | Caption (big line) | Done-for-you note |
|---|---|---|---|---|---|
| 1 | 0 to 194 | 0:00.0 to 0:06.5 (6.5 s) | Minutes after you install | We write the questions your shoppers ask AI | Done-for-you: 100 questions |
| 2 | 195 to 464 | 0:06.5 to 0:15.5 (9.0 s) | Day one | Where you stand, and who AI picks instead | Done-for-you also checks Claude |
| 3 | 465 to 704 | 0:15.5 to 0:23.5 (8.0 s) | From day one | Approve a fix. It's live on your store. | Done-for-you: we put fixes live for you |
| 4 | 705 to 959 | 0:23.5 to 0:32.0 (8.5 s) | Every month | New guide pages, and pitches ready to send | Done-for-you: we send them and follow up |
| 5 | 960 to 1184 | 0:32.0 to 0:39.5 (7.5 s) | Every week | We ask AI again and show what changed | Done-for-you: checked every day |
| 6a | 1185 to 1334 | 0:39.5 to 0:44.5 (5.0 s) | As orders come in | The money: sales, orders and clicks from AI | (none) |
| 6b | 1335 to 1484 | 0:44.5 to 0:49.5 (5.0 s) | Start of each month | Plus a report in your inbox each month | Done-for-you: plus a 30-minute call |
| 7 | 1485 to 1679 | 0:49.5 to 0:56.0 (6.5 s) | (none) | End card title: What to expect, and when | (none) |

Every caption is 9 words or fewer. The honest caveat is stated once, on the end card ("Weeks to months: AI answers
catch up. Nobody can promise when."). Scene 5 adds the other honest point, that scores move both ways.

### The honest timeline on the end card

| Stop | Big label | Line under it | Why it is safe |
|---|---|---|---|
| 1 | Day one | See where you stand | Certain: the starting point scan runs the day the plan starts (research 1.1 rows 6 to 8, 2.7) |
| 2 | The day you approve | Fixes go live on your store | Certain: pushed to Shopify in the same request (research 1.1 row 11, 2.7) |
| 3 | Weeks to months | AI answers catch up. Nobody can promise when. | Varies, and says so: research caption 6 "Weeks to months: AI catches up" and alternative "No one can promise when AI will name you"; Google SEO Starter Guide "a few hours ... several months", "wait a few weeks" (research 2.3) |

Then the button **Start 7-day free trial** (the exact wording of both pricing buttons in `parts/42-pricing.html`) and
the small line **Billed through Shopify. Cancel any time.** (from the pricing footnote).

---

## 2. The frame: what stays on screen

### Persistent pieces (every frame, both layouts)

- **Example tag**: the `ExampleTag` from `src/TestCard.tsx`, top right. Desktop: 22 px from top and right, font
  13 px. Phone: 14 px inset, font 12 px. It stays on the end card too, so any single frame (and both posters) is
  labelled. The page's frame bar keeps its own "Example" tag above the video.
- **Time chip**: a small grey pill top left that says when this happens ("Day one", "Every week"). Style like the
  page's grey chips: background `warm100`, inset 1 px `lineSoft`, text `ink2`, Inter 600. Desktop 16 px text, 30 px
  tall. Phone 15 px text (30 px at 2x), 28 px tall.
- **Done-for-you note**: when a scene has one, a second pill right after the time chip on the same row: white, inset
  1 px `lineSoft`, "Done-for-you" in Inter 650 navy, the rest Inter 500 `text2`. Same sizes as the chip. It tells
  the plan difference without a second caption.
- **Caption**: Geist 500, navy, left aligned. Desktop 40 px, line height 1.15, letter spacing -1.4 px, one line
  (all captions fit in about 860 px; if one wraps, drop to 38 px, never two lines on desktop). Phone 26 px
  (52 px at 2x), line height 1.2, letter spacing -0.8 px, up to 2 lines (3 lines at 24 px as a fallback).
- **App window** (scenes 1 to 6): one window that never leaves between scenes; only its main panel, its active tab
  and the Fixes badge change. Built like the page's sample app (`parts/20m-money.css`):
  - outer white frame, padding 10 px (phone 6 px), radius 22 px (phone 18 px), shadow
    `0 0 0 1px rgba(11,12,43,.05), SHADOW_LG`;
  - dark top bar `adminTop` (#1a1a1a), 40 px (phone 34 px): green monogram square **CG** (#7fdc9a, text #0b3d1d)
    and **Coolabah Grooming Co.** in #e3e3e3;
  - desktop sidebar 190 px, `adminNav` (#ebebeb): the GEO mark (two overlapping dots, `peri300` and `cobalt`) with
    **GEO**, then the real app's tabs with 16 px line icons: **Dashboard**, **Questions**, **Competitors**,
    **Fixes**, **Outreach**. The active tab is bold #1a1a1a with a white pill behind it. The Fixes tab carries a
    small navy badge when fixes are waiting;
  - phone: no sidebar; under the top bar a 40 px tab strip with the same five icons (18 px), the active one showing
    its label;
  - main area `adminMain` (#f1f1f1), padding 22 px (phone 12 px), white panels with radius 12 px and the page's
    panel shadow `0 1px 0 rgba(0,0,0,.07), inset 0 0 0 1px rgba(0,0,0,.04)`.
- **Pointer** (scenes 3 to 6 only): desktop, a navy arrow pointer with a 1.5 px white outline and a soft shadow;
  phone, a tap dot instead (a 22 px circle, navy at 18% with a white ring). Hidden in scenes 1 and 2: the app sets
  itself up and scans on its own; the member only steps in to approve and look. That mirrors the product ("you
  approve, AI does the work").

### Desktop layout (1280x800)

| Piece | Box |
|---|---|
| Example tag | top 22, right 22 |
| Chip row (time chip, Done-for-you note) | x 64, y 34, height 30 |
| Caption | x 64, y 76, width up to 936, one line |
| App window | x 64 to 1216 (1152 wide), y 142 to 766 (624 tall) |

The page shows the video at most 980 px wide (0.77 scale), so 40 px captions read at about 31 px and the 14 px
floor for app text reads at about 11 px. **Text floor: 14 px for anything the viewer should read** (labels, rows,
fine print), 13 px only for decoration. Key numbers 32 to 44 px Geist 600.

### Phone layout (390x640, rendered at 2x)

| Piece | Box |
|---|---|
| Example tag | top 14, right 14 |
| Chip row | x 18, y 16, height 28 (the Done-for-you note wraps under the time chip if both don't fit, then the caption moves down 34 px and the window shrinks) |
| Caption | x 18, y 56, width 354, up to 2 lines |
| App window | x 18 to 372 (354 wide), y 168 to 624 (456 tall) |

Phone text floor inside the window: 13 px (26 px in the file). Captions, chip and note all 15 px or more (30 px or
more in the file), as asked.

### Keep clear: the page's pause button

`11v-video.css` puts a 38 px pause button over the video's bottom right corner while it plays (22 px in on desktop,
14 px on phones). Keep the bottom right **100x80 px (desktop) and 60x56 px (phone)** of the video free of anything
the viewer must read. In practice: no numbers, pills or buttons in the window's bottom right corner.

### Colour (copy-deck 14b)

Neutral everywhere (white, `warm50`, `adminMain`, navy text, grey chips and pills). Purple only for the one focal
point per scene, and in the app only for data bars and lines, exactly like the page's sample app:

| Scene | The one purple thing |
|---|---|
| 1 | the progress bar fill |
| 2 | the score ring arc and the "You" bar (rival bars stay warm grey #a9a8a2, as on the page) |
| 3 | none in the app; the focal point is the navy Approve button turning green |
| 4 | the thin cobalt left edge of the opened pitch draft |
| 5 | the trend line and its area |
| 6 | none; source bars use the engine colours, as on the page |
| 7 | the end card's lilac gradient (`GRAD_MAIN`), the page's closing card colour |

Green (`greenInk` on `greenBg`) only for "Live", ticks and "named" marks. Amber (`#9a6411` on `#fdf3e2`) for
"Waiting". Engine dots: `chatgpt`, `gemini`, `perplexity`, `google` from `src/theme.ts`.

### Motion vocabulary (calm, never flashy)

- Entrances: opacity 0 to 1 with a 10 px rise, `spring({ damping: 200 })` (no bounce), 12 to 18 frames, items
  staggered 6 to 8 frames.
- Scene changes: the main panel and the caption cross fade over 12 frames centred on the boundary (out over
  frames b-6 to b+2 rising 8 px, in over b-2 to b+10 from 8 px below). The window, sidebar and tags never move.
- Counters: `interpolate` with `Easing.out(Easing.cubic)` over 36 to 45 frames, whole numbers, `en-US` commas, tabular
  figures.
- Bars: width from 0 with `Easing.out(Easing.cubic)` over 30 frames, staggered 5 frames.
- Spinners: a 14 px ring turning `frame * 12` degrees, replaced by a green tick that scales 0.6 to 1 over 8 frames.
- Pointer moves: keyframe track `[{ f, x, y }]` eased with `Easing.inOut(Easing.cubic)`, 20 to 40 frames a move.
  Click: pointer scales to 0.9 for 4 frames and a navy ring grows 0 to 22 px radius while fading from 0.3 to 0 over
  14 frames. Phone tap: the same ring around the tap dot.
- Tab change: the white pill behind the active tab slides to the new tab over 8 frames.
- No zooms, no shakes, no confetti, no random values. Everything from `useCurrentFrame()` (README rule).

---

## 3. Scene by scene

Frame numbers are **local to the scene** (f0 = the scene's first frame) unless marked global. Both layouts use the
same timings, so one cue list drives both.

### Scene 1. Minutes after you install (global 0 to 194, 6.5 s)

**Chip:** Minutes after you install · **Note:** Done-for-you: 100 questions
**Caption:** We write the questions your shoppers ask AI

On screen (Dashboard tab active, no badge yet): one white panel titled **Checking how AI sees your store** with the
app's four real setup steps (`app._index.tsx:96-99`), each a row with a status icon:

1. **Reading your products** · grey counter on the right: "0 products" counting to **48 products**
2. **Writing the questions shoppers ask AI**
3. **Asking the AI assistants (twice each)**
4. **Working out your score**

Under step 2, the questions appear as grey chips grouped under small topic labels (Inter 600, `text2`):

| Topic label | Question chips |
|---|---|
| Beard oil | best beard oil for dry skin · unscented beard oil for sensitive skin |
| Beard wash | gentle beard wash for sensitive skin |
| Beard balm | beard balm that isn't greasy |
| Gifts | beard care gift for dad |

Then a summary line: **50 questions in 6 topics · Edit them any time**

Under step 3, a progress bar (cobalt fill on #f0f0f4 track) with **0 of 400 AI answers read** and four engine pills
with colour dots: **ChatGPT · Gemini · Perplexity · Google AI Overviews**.

Motion:
- f0 to f7: hold. This is the loop's landing frame (the end card cross fades into exactly this picture).
- f8 to f36: step 1 spinner, counter 0 to 48. f36: tick.
- f40 to f100: step 2 spinner. Topic label and chips rise in at f48, f56, f64, f72, f80. f100: tick. f104: summary
  line fades in.
- f112 to f194: step 3 spinner; progress 0% to 35%, counter 0 to 140 of 400; each engine dot breathes (opacity
  0.55 to 1, sine, 30-frame period, phases offset by 7 frames). Step 4 stays grey.

Phone: the same panel full width. Steps at 14 px; chips at 13 px wrapping to 3 rows; only the first 4 chips (drop
"unscented beard oil for sensitive skin"); engine pills wrap to 2 rows.

Why it's true: research 1.1 rows 3 to 6 (catalogue read, 110 questions written, topics capped at 8, best 50 switched
on for Standard, editable on the Questions screen; no "tick your questions" step). "Minutes" is research caption 1.
400 = 50 questions x 4 AIs x 2 runs.

### Scene 2. Day one (global 195 to 464, 9.0 s)

**Chip:** Day one · **Note:** Done-for-you also checks Claude
**Caption:** Where you stand, and who AI picks instead

Motion and screens:
- f0 to f40: the setup panel finishes. Progress 140 to **400 of 400 AI answers read**, step 3 ticks at f40, step 4
  at f48.
- f50 to f64: the panel cross fades to the results. Panel title row: **Your starting point** with a grey note on the
  right **Saved, so you can see what changes**.
- Three white panels side by side (desktop):

**Panel A: How often AI names you**
- Score ring (cobalt arc on #f0f0f4, 120 px): counts 0 to **29** over f64 to f104, with "/100" beside it.
- f96 to f120: four engine pills fade in, staggered: **ChatGPT 34 · Gemini 31 · Perplexity 27 · Google AI Overviews 24**
  (they average 29).
- Line under: **A score out of 100 for how often AI names you.**

**Panel B: Who AI recommends instead** (real dashboard heading) · sub line **Share of answers that name each brand**

| Row | Share | Bar colour |
|---|---|---|
| Ridgeback Beard Co. | 64% | warm grey |
| Saltbush Beard Co. | 49% | warm grey |
| Banksia Beard Co. | 33% | warm grey |
| Coolabah Grooming Co. **You** (navy "You" chip, row on `warm50`) | 30% | cobalt |
| Wattlebird Grooming | 18% | warm grey |

Bars grow f80 to f130, 5 frames apart. At f200 the "You" row gets a soft 1 px navy ring for 30 frames (the focal
point), then settles.

**Panel C: Sites AI trusts** · sub line **Sites AI linked to in its answers**

| Site | Type chip | Right side |
|---|---|---|
| examplereviews.com | Review site | 41 answers |
| examplebeardblog.com | Review site | 27 answers |
| examplegrooming.com.au | Retailer | 19 answers |
| coolabahgrooming.com.au | Brand site | green pill **You're on it** |

Rows rise in f110 to f140, 6 frames apart.

- f230: the first fixes arrive: the **Fixes** tab gets a navy badge **3** with one soft pulse (scale 1 to 1.15 to 1
  over 12 frames). No pointer in this scene.

Phone: Panel A on top (ring 104 px, the engine pills in a 2x2 grid, short labels kept in full: "Google AI Overviews
24" wraps inside its pill if needed). Below it Panel B with the first four rows (drop Wattlebird). At f160 Panel B
cross fades to Panel C (first four rows, without the answer counts), so the phone shows both "who AI picks
instead" and "which sites it trusts" in turn.

Why it's true: research 1.1 rows 6 to 8 and 10, research caption 2 and 2b ("Day one: your starting point", "Who AI
picks instead", "And the sites it trusts"); Claude is Done-for-you only (`plans.ts`). Only made-up sites from the
sample data list, so no real site is tied to a sample brand (copy-deck sample data rules).

### Scene 3. Approve a fix (global 465 to 704, 8.0 s)

**Chip:** From day one · **Note:** Done-for-you: we put fixes live for you
**Caption:** Approve a fix. It's live on your store.

Screens (Fixes tab): panel title **Fixes** with a grey note **Only facts from your store**.

Card 1, open:
- icon tile, **Clearer product description** (bold) and **Gentle Beard Wash 200ml** (grey), amber pill **Waiting**
- two boxes side by side (stacked on phone), labelled in small caps:
  - **Before** (grey box): Our best seller. Smells amazing.
  - **After** (white box, thin green line): Soap-free beard wash for sensitive skin. Ships worldwide. 200ml.
- **Why:** AI can now tell who it's for. Only facts from your page.
- buttons: **Approve & publish** (navy gradient `GRAD_BTN`, white text) and **Edit** (white, grey line)

Card 2, closed: **Product FAQs** · Beard Balm 60g · amber **Waiting**
Card 3, closed: **Clearer product title** · Dry Skin Beard Oil 30ml · amber **Waiting**

Motion:
- f0 to f12: pointer fades in at x 980, y 600 (desktop).
- f6 to f26: pointer moves to the **Fixes** tab. f28: click. Tab pill slides; the main panel cross fades to Fixes
  (f30 to f42).
- f50 to f90: pointer moves to **Approve & publish**; hover from f86 (button 6% lighter).
- f96: click.
- f100 to f116: the button turns `greenInk` and reads **✓ Pushed to Shopify**; the pill changes **Waiting** to
  **Live** (green); the After box gets one soft green sweep (20 frames); the Before box fades to 50%.
- f112 to f124: a dark toast rises at the bottom centre of the main panel: **Live in your store** (the app's real
  message). It holds to f190, then fades.
- f118: the Fixes badge changes 3 to **2**.
- f124 to f136: an **Undo** button (white, grey line, undo icon) slides in beside the green button.
- f150 to f176: pointer moves onto **Undo**. f178: a small dark tooltip above it: **One click puts the old text back**.
  No click.
- f200 to f239: hold.

Phone: the open card fills the panel (Card 2 and 3 hidden). Before and After stacked, 13 px. Tap dot instead of the
pointer. Toast sits above the buttons, not in the bottom right corner.

Why it's true: research 1.1 row 11 ("Live in your store", undo puts the old values back), research caption 3 and 3b.
A description fix is used for the "live" moment because FAQ fixes only show once the theme block is added (research
section 4). "From day one" because the first fixes are written after the first full scan (research 1.1 row 10).

### Scene 4. Every month (global 705 to 959, 8.5 s)

**Chip:** Every month · **Note:** Done-for-you: we send them and follow up
**Caption:** New guide pages, and pitches ready to send

Screens (Outreach tab): panel title **This month**. Two panels side by side (desktop: 40% and 60%).

**Left: Guide pages** · grey note **2 this month**
- Card A: small label **New buying guide page**; title **Choosing a beard oil for dry skin**; meta **Links to 3 of
  your products**; green pill **Live**
- Card B: small label **New buying guide page**; title **Beard care for sensitive skin**; amber pill **Waiting**

**Right: Sites to pitch** · grey note **Up to 10 this month**

| Site | What it is | Status pill |
|---|---|---|
| examplereviews.com | Roundup · names Ridgeback, Saltbush | Ready to send |
| examplegiftguide.com.au | Gift guide · names Banksia | Ready to send |
| examplebeardblog.com | Article · names Ridgeback | Ready to send |

The opened draft (row 1 expands in place, rows 2 and 3 slide down):
- **To:** sam@examplereviews.com · small green text **Email found**
- **Subject:** A beard oil for your dry skin roundup
- Body (2 lines, then faded): Hi Sam, I read your roundup of beard oils for dry skin. Would our Dry Skin Beard Oil
  30ml be a fit? Happy to send a sample.
- buttons: **Open in my email** (navy) and **Copy email** (white) (the app's real labels)
- a thin cobalt left edge on the draft (this scene's purple focal point)

Motion:
- f4 to f24: pointer moves from Undo to the **Outreach** tab. f26: click. Panel cross fades (f28 to f40).
- f40, f48: guide cards A and B rise in. f56, f62, f68: pitch rows rise in.
- f90 to f118: pointer moves to row 1. f120: click. f122 to f140: row 1 opens into the draft.
- f140 to f254: hold. The pointer rests beside **Copy email**; no more clicks.

Phone: beat A (f28 to f110): Guide pages panel (both cards) above the three pitch rows (site and status only).
Beat B: f120 tap on row 1, and the draft slides up from the bottom of the window as a sheet over the lower 70%
(To, Subject, 2 body lines, both buttons side by side, 13 px).

Why it's true: research 1.1 rows 13 and 17, captions 5 and 5b; `plans.ts` 2 guide pages and 10 outreach targets a
month on Standard (Done-for-you: 8 and 40, our team sends and follows up). Only an article, a gift guide and a blog:
no forum row, no review site row, nothing posted for the store (house rule). Guide B shows "Waiting" because
Standard approves each guide.

### Scene 5. Every week (global 960 to 1184, 7.5 s)

**Chip:** Every week · **Note:** Done-for-you: checked every day
**Caption:** We ask AI again and show what changed

Screens (Questions tab): panel title **Does AI name you?** with a grey note **Asked every week**.

**Top panel, full width: How often AI names you**
- left: big **36** "/100", then **+7 since you joined** (green text)
- right: an example trend line, no dates and no week numbers on the axis. Seven points drawn: 29, 30, 29, 32, 33,
  35, 36 (gently uneven, with a dip). A dashed grey line at 29 labelled **Starting point**.
- status line under the chart: a small breathing dot and **Checking now… 0 of 400**
- note, fades in late: **Scores move up and down. Watch the trend.**

**Bottom panel: the questions** · header row: Question · ChatGPT · Gemini · Perplexity · AI Overviews (each with its
colour dot). Marks as on the page's sample app: a green circle with a tick for "named", an empty ring with a grey
dash for "not named".

| Question | ChatGPT | Gemini | Perplexity | AI Overviews |
|---|---|---|---|---|
| best beard oil for dry skin | named | named | not named | not named |
| beard balm that isn't greasy | not named | named | named, then **not named** | not named |
| gentle beard wash for sensitive skin | not named | not named, then **named** | not named | not named |
| beard care gift for dad | named | not named | not named | grey text **No overview** |

Motion:
- f4 to f22: pointer moves to the **Questions** tab. f24: click. Panel cross fades (f26 to f38).
- f38 to f70: the trend line draws left to right through the seven points (the area under it fades in with it).
- f72 to f130: "Checking now… 0 of 400" counts to 400 of 400.
- f132 to f150: the eighth point, **38**, extends the line and lands with one soft halo; the big number counts 36 to
  **38**; the green line now reads **+9 since you joined**.
- f136: the Gemini mark on "gentle beard wash for sensitive skin" pops to named (scale 0.6 to 1, green). f140: the
  Perplexity mark on "beard balm that isn't greasy" fades back to not named. Both cells get a soft warm grey ring for
  30 frames so the eye catches the change, up and down.
- f150: the Fixes badge changes 2 to **4** with one soft pulse (new fixes after every check).
- f160: the note **Scores move up and down. Watch the trend.** fades in.
- f170 to f224: hold.

Phone: the top panel (number, +7/+9 line and the trend, 330x90) and three question rows (drop "beard care gift for
dad"). The four AI columns use colour dots as headers, with a one-line legend under the rows: ChatGPT · Gemini ·
Perplexity · AI Overviews (12 px, wraps).

Why it's true: research 1.1 row 15 and caption 4 ("Every week: we ask AI again ... See what changed"; "checked every
day on Done-for-you", and Done-for-you's daily check is light, so the note doesn't say "full"); research 2.3 and
section 4 (answers change run to run, a score can dip, show an uneven line, no "Week 4" counters). One question gains
an AI and one loses one, so the scene never reads as "your score only goes up". The app has no "what changed" list,
so the change is shown in the real Questions marks and the trend, nothing invented. 29 to 38 matches the page's
sample app ("▲ 9 since joining", spark 29 to 38).

### Scene 6. The money and the monthly report (global 1185 to 1484, 10.0 s)

Beat A (f0 to f149): **Chip:** As orders come in · **Note:** none
**Caption:** The money: sales, orders and clicks from AI

Beat B (f150 to f299): **Chip:** Start of each month · **Note:** Done-for-you: plus a 30-minute call
**Caption:** Plus a report in your inbox each month

Screens (Dashboard tab): title **Money from AI** with a two-part switch **Last 4 weeks | Since joining** (first
active, never clicked).

**KPI panel (full width)**

| Label | Number | Counts over |
|---|---|---|
| AI revenue | $4,820 | f40 to f84 |
| AI orders | 61 | f44 to f84 |
| AI clicks | 1,940 | f48 to f88 |

- f92: a green chip beside the revenue: **▲ 38% vs before you joined**
- f98: a grey line under the three numbers: **Before you joined: $3,490 a month (from your last 60 days of orders)**

**Lower left: Where AI sales come from** (real app heading). Bars in engine colours, grow f70 to f110, 6 frames apart:
ChatGPT **$2,640** · Perplexity **$880** · Gemini **$760** · Other **$540** (they add up to $4,820, as on the page).

**Lower right: Products bought via AI** (real app heading): Dry Skin Beard Oil 30ml **23** · Gentle Beard Wash 200ml
**14** · Beard Balm 60g **9**

**Fine print along the bottom of the money panel** (f110, 14 px, `text2`): **Only orders we can trace to AI. Google AI
Overviews aren't counted.**

The poster is global frame **1325** (local f140): every number has landed, the chip and both honest lines are
showing, the caption is beat A, the email card hasn't arrived.

Beat B motion:
- f150 to f158: caption, chip and note cross fade to beat B.
- f160 to f184: the email card slides in from the right (x +40 px to 0, opacity 0 to 1, spring) and sits over the right
  45% of the main panel; the dashboard behind it takes a light white wash (25%).
- f184 to f299: hold. The pointer fades out from f270 to f290 (the end card has none).

**The email card** (white, radius 16 px, `SHADOW_LG`, an envelope icon top left):
- top line, grey: **Your AI search report · Coolabah Grooming Co.**
- heading: **Money from AI last month**
- three tiles: **$4,820** sales from AI · **61** orders · **1,940** clicks from AI
- **Visibility score: 38/100 (+9 since you joined)**
- **You have 4 fixes ready to approve. Each one takes a click.**
- dark button **Open the app**

Phone: beat A is a stack: AI revenue big (36 px) with the chip under it; AI orders and AI clicks side by side; the
"Before you joined" line; the four source bars; the fine print. Products bought via AI is dropped. Beat B: the email
card slides up from the bottom of the window and covers the lower 75% (tiles in a row of three at 13 px labels, the
score line and the button; the fixes line is dropped).

Why it's true: research 1.1 rows 18 and 19, captions 7, 7b and 8; dashboard and email headings, the "+9 since you
joined" format and the email lines are the app's own (`app._index.tsx`, `report.server.ts`). "vs before you joined"
is shown months in, never on day one (the app shows it only after 14 days, research section 5). "Before you joined"
comes from the 60-day backfill (research caption 2c). Sample numbers are the page's sample app's "Last 4 weeks"
numbers, so the whole page tells one example. "As orders come in" replaces "real time" (research section 4).

### Scene 7. End card (global 1485 to 1679, 6.5 s)

**Chip and caption:** none (they fade out over f0 to f10). The Example tag stays.

Screens:
- f0 to f20: the app window fades out while easing to 0.97 scale.
- f6 to f26: a lilac card (`GRAD_MAIN`, radius 28 px, the page's soft clay shadow) rises 16 px into place. Desktop:
  1040x600, centred. Phone: 354x548 from y 52.
- f14: title **What to expect, and when** (Geist 500, navy; desktop 44 px, phone 28 px).
- The three stops (section 1 table): desktop in a row joined by a thin navy line at 20% that draws from f30 to f70;
  phone in a column with a vertical line on the left. Each stop: a small navy dot with its number (1, 2, 3), the big
  label (Geist 500, 22 px desktop, 18 px phone) and the line under it (Inter, 16 px desktop, 15 px phone,
  `textLilac` #45466e for contrast on lilac). Stops rise in at f30, f44, f58.
  1. **Day one** · See where you stand
  2. **The day you approve** · Fixes go live on your store
  3. **Weeks to months** · AI answers catch up. Nobody can promise when.
- f84: the button **Start 7-day free trial** (`GRAD_BTN`, white Inter 600; desktop 18 px text, 52 px tall; phone
  16 px text, 48 px tall, full card width).
- f92: under it, small: **Billed through Shopify. Cancel any time.** (`textLilac`, 14 px).
- f92 to f176: hold, about 2.8 s to read.
- **f177 to f194 (global 1662 to 1679): the loop seam.** The end card fades out while scene 1's opening picture
  (window, setup panel with nothing ticked, scene 1's chip, note and caption) fades in on top, opacity f/18 so the
  last frame is at 17/18. Global frame 0 then completes it, and frames 0 to 7 hold, so the loop has no jump.

Why it's true: the three stops are research 2.7 and section 3 (certain, certain, varies, said once). No rankings, no
sales, no dates. The button wording matches the pricing cards.

---

## 4. Every string on screen

One list, for `src/tour/data.ts` (keep all copy and numbers in one file so the copy check is one grep). Sample store
and rivals from the copy-deck sample data list only.

- Persistent: Example · Coolabah Grooming Co. · CG · GEO · Dashboard · Questions · Competitors · Fixes · Outreach
- Chips: Minutes after you install · Day one · From day one · Every month · Every week · As orders come in · Start of
  each month
- Notes: Done-for-you: 100 questions · Done-for-you also checks Claude · Done-for-you: we put fixes live for you ·
  Done-for-you: we send them and follow up · Done-for-you: checked every day · Done-for-you: plus a 30-minute call
- Captions: We write the questions your shoppers ask AI · Where you stand, and who AI picks instead · Approve a fix.
  It's live on your store. · New guide pages, and pitches ready to send · We ask AI again and show what changed · The
  money: sales, orders and clicks from AI · Plus a report in your inbox each month
- Scene 1: Checking how AI sees your store · Reading your products · 48 products · Writing the questions shoppers ask
  AI · Asking the AI assistants (twice each) · Working out your score · Beard oil · Beard wash · Beard balm · Gifts ·
  best beard oil for dry skin · unscented beard oil for sensitive skin · gentle beard wash for sensitive skin · beard
  balm that isn't greasy · beard care gift for dad · 50 questions in 6 topics · Edit them any time · 0 of 400 AI
  answers read · ChatGPT · Gemini · Perplexity · Google AI Overviews
- Scene 2: Your starting point · Saved, so you can see what changes · How often AI names you · 29 · /100 · ChatGPT 34 ·
  Gemini 31 · Perplexity 27 · Google AI Overviews 24 · A score out of 100 for how often AI names you. · Who AI
  recommends instead · Share of answers that name each brand · Ridgeback Beard Co. 64% · Saltbush Beard Co. 49% ·
  Banksia Beard Co. 33% · Coolabah Grooming Co. You 30% · Wattlebird Grooming 18% · Sites AI trusts · Sites AI linked
  to in its answers · examplereviews.com · examplebeardblog.com · examplegrooming.com.au · coolabahgrooming.com.au ·
  Review site · Retailer · Brand site · 41 answers · 27 answers · 19 answers · You're on it · 3
- Scene 3: Fixes · Only facts from your store · Clearer product description · Gentle Beard Wash 200ml · Waiting ·
  Before · Our best seller. Smells amazing. · After · Soap-free beard wash for sensitive skin. Ships worldwide. 200ml.
  · Why: AI can now tell who it's for. Only facts from your page. · Approve & publish · Edit · Product FAQs · Beard
  Balm 60g · Clearer product title · Dry Skin Beard Oil 30ml · ✓ Pushed to Shopify · Live · Live in your store · Undo
  · One click puts the old text back · 2
- Scene 4: This month · Guide pages · 2 this month · New buying guide page · Choosing a beard oil for dry skin · Links
  to 3 of your products · Beard care for sensitive skin · Sites to pitch · Up to 10 this month · examplereviews.com ·
  Roundup · names Ridgeback, Saltbush · examplegiftguide.com.au · Gift guide · names Banksia · examplebeardblog.com ·
  Article · names Ridgeback · Ready to send · To: sam@examplereviews.com · Email found · Subject: A beard oil for your
  dry skin roundup · Hi Sam, I read your roundup of beard oils for dry skin. Would our Dry Skin Beard Oil 30ml be a
  fit? Happy to send a sample. · Open in my email · Copy email
- Scene 5: Does AI name you? · Asked every week · 36 · 38 · +7 since you joined · +9 since you joined · Starting
  point · Checking now… 400 of 400 · Scores move up and down. Watch the trend. · Question · AI Overviews · No overview
  · 4
- Scene 6: Money from AI · Last 4 weeks · Since joining · AI revenue · $4,820 · AI orders · 61 · AI clicks · 1,940 ·
  ▲ 38% vs before you joined · Before you joined: $3,490 a month (from your last 60 days of orders) · Where AI sales
  come from · $2,640 · $880 · $760 · Other · $540 · Products bought via AI · 23 · 14 · 9 · Only orders we can trace to
  AI. Google AI Overviews aren't counted. · Your AI search report · Coolabah Grooming Co. · Money from AI last month
  · sales from AI · orders · clicks from AI · Visibility score: 38/100 (+9 since you joined) · You have 4 fixes ready
  to approve. Each one takes a click. · Open the app
- Scene 7: What to expect, and when · Day one · See where you stand · The day you approve · Fixes go live on your
  store · Weeks to months · AI answers catch up. Nobody can promise when. · Start 7-day free trial · Billed through
  Shopify. Cancel any time.

Copy checks: no em dash and no spaced en dash anywhere (the "…" in "Checking now…" is the app's own ellipsis);
no method jargon; "GEO" only as the brand mark; "free" only in "Start 7-day free trial"; currency shown as "$" like
the page's sample app.

### Never on screen

- "Results in 30 days", "within 24 hours", "instantly in ChatGPT", "Live in ChatGPT", any date or day count for AI to
  name the store (research section 4).
- "Get recommended", "rank #1", "guaranteed", "more sales", "every AI sale", "thanks to GEO you made".
- A forum post, a review, a star rating or anything posted for the store. The forum row is left out on purpose.
- "Fully automatic" for Standard, "nothing changes without your OK" for Done-for-you, "daily full scans".
- "2 minutes" for the full starting point; "tick your questions".
- Real brands or real sites tied to the sample store; "Bondi Beard Co.".
- Week numbers or dates on the trend line.

---

## 5. The section on the page

| Piece | New copy |
|---|---|
| Heading (`#vid-title`, replaces "Watch a free check") | **What you get when you join** |
| Video `aria-label` | Example tour with a made-up store: GEO writes the questions shoppers ask AI, shows who AI picks instead, puts fixes live when you approve them, adds guide pages and pitches each month, checks AI every week and counts sales from AI; AI answers can take weeks or months to catch up. |
| Play / pause button labels (HTML and `11v-video.js`) | Play the example tour · Pause the example tour |
| Files in `design/overview/img/` | `member-tour.mp4`, `member-tour.webm`, `member-tour-phone.mp4`, `member-tour-phone.webm`, `member-tour-poster.jpg`, `member-tour-phone-poster.jpg` |
| Poster | frame 1325 for both layouts (`./render.sh MemberTour MemberTourPhone member-tour 1325`) |

Poster choice: the money scene, settled (all three numbers, the "vs before you joined" chip, the by-assistant bars,
the "only orders we can trace" line, the Example tag). It shows the product's first promise, the money, and it is
what visitors with reduced motion see instead of the video, so it has to carry the most meaning in one frame. When
the video starts, the browser swaps the poster for frame 0 (the setup screen): a clean cut, the same as the current
video's poster. If a seamless first frame matters more, use `--frame=0` instead (scene 1's landing picture, already
fully drawn with chip and caption).

When shipping (the builder's checklist, README "Putting a new video on the page"): update the four `<source>` paths,
`poster`, heading, `aria-label` and button label in `11v-video.html`; the poster swap and the two button labels in
`11v-video.js` (`member-tour-poster` to `member-tour-phone-poster`); the `extra` list in
`design/overview/assemble.mjs` (it names `free-check-phone-poster.jpg`); `test/home.test.ts` (also names
`free-check-phone-poster.jpg`); and copy-deck section 4b, which still describes the free check recording.

Expected weight: busier than the 50 s test card, so roughly 1.5 to 2.5 MB per desktop file and 2.5 to 3.5 MB per
phone file at the README's CRF settings. If the phone files are heavy, `H264_CRF=20` on the phone saves about 13%.

---

## 6. Build notes

- Suggested files: `src/tour/MemberTour.tsx` (takes `layout`), `src/tour/AppWindow.tsx` (persistent window: active
  tab, badge and pointer worked out from the global frame), `src/tour/Caption.tsx` (chip, note and caption with the
  cross fade), `src/tour/Pointer.tsx`, one file per scene in `src/tour/scenes/`, and `src/tour/data.ts` (every string
  and number in section 4). Register `MemberTour` (1280x800) and `MemberTourPhone` (390x640) in `src/Root.tsx`, both
  1,680 frames at 30 fps.
- Scenes as `<Sequence from={start} durationInFrames={length + 6}>` so the 12-frame cross fades overlap; the window
  sits outside the sequences so it never re-mounts.
- State that runs across scenes, from the global frame: active tab (Dashboard to 492, Fixes from 493, Outreach from
  731, Questions from 984, Dashboard from 1209), Fixes badge (none to 424, 3 from 425, 2 from 583, 4 from 1110),
  pointer visible from 465 to 1475.
- Draw drafts with `--image-format=jpeg`; ship with PNG frames (README).
- Check the loop: render frames 1679 and 0 as stills and compare; they should differ only by the last 1/18 of the
  cross fade.

## 7. Flags for the lead (outside this file; not changed)

1. **The monthly report email shows almost nothing.** It is sent in the first 3 days of a month
   (`app/lib/worker.server.ts:124-132`) but totals "this month" from the 1st (`app/lib/dashboard.server.ts`
   `moneySummary`, `monthStart`; used in `app/lib/report.server.ts`, subject "... from AI this month"). So the
   report covers 0 to 3 days. The video shows the intended report ("Money from AI last month"). Either change the
   report to use the previous calendar month, or change scene 6's email heading before shipping.
2. The FAQ answer "How long does setup take?" (`parts/43-faq.html`) says "tick your questions", but the code has no
   such step (research section 4). The video says "Edit them any time".
3. The "Before you joined" line (scene 6) relies on the 60-day order backfill, which needs Shopify's protected customer
   data approval for `customerJourneySummary` (CLAUDE.md section 18, blocked item 4). Keep it, but check the approval
   before the video ships (research caption 2c).
4. Labels: the app says "visits from AI"; the page's sample app and Ross's brief say "clicks". The video uses "AI
   clicks" and "clicks from AI" to match the page. The video's tabs use the real app's names (Dashboard,
   Competitors), not the page sample app's (Money, Rivals).
