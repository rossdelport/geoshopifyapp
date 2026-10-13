# Screenshots, feature image and icon

## Shopify's rules for every image

- 1600 x 900 px (16:9), PNG or JPEG. Upload 3 to 6. Each one must show a different screen or state.
- Real app screens only. No browser frame, no desktop background, no Shopify logos.
- No prices (so never the Plans page), no reviews, no promised results. Add alt text to each.
- No personal data: blur author names and email addresses on the Outreach shot.

## How to take them

1. Use a development store with a realistic grooming or skincare catalogue (about 20 products with descriptions).
2. Install the app, run the free scan, then start Standard (dev stores get a test charge, so it's free). Wait for the
   bigger scan to finish, then click **Write more fixes** on the Fixes page.
3. For the money shot, place 3 or 4 test orders after opening the storefront with `?utm_source=chatgpt.com` (and one
   with `?utm_source=perplexity`) on the address. Each shows up on the Dashboard about 3 minutes later. This needs
   the protected customer data step in `checklist.md` done first.
4. Open the app in the Shopify admin on a wide screen, screenshot it, then crop to the app's own area: cut off
   Shopify's top bar and left menu (they carry Shopify logos). Place the crop on a plain white or very light lilac
   (`#F4F4FE`) 1600 x 900 canvas if it isn't 16:9.
5. Shots with money figures get a small grey "Example store" tag in a corner (owner rule: sample numbers are labelled).
6. AI answers name real brands and sites. Prefer crops where they aren't the focus, and blur any real person's name or
   email.

## Shot list (in upload order)

| # | Screen (route) | State to show | Caption |
|---|---|---|---|
| 1 | Dashboard (`/app`), top half | Standard plan. "Money from AI · this month" with a figure, the three tiles (orders from AI, visits from AI, share of your sales), and "Where AI sales come from" with the split bar and the order table showing "Why we think so". No banners. | See the AI orders and revenue you can trace, and why each one counts |
| 2 | Questions (`/app/questions`) | Topic buttons, about 8 rows visible with "You're named" bars, "best #2" marks, "AI picks instead" names and the Track switches. | Track the questions shoppers ask AI, and who gets named |
| 3 | One question (`/app/questions/<id>`) | Two assistant sections: one run with a green "You're #2" badge and the numbered brand pills, one with a red "Not named" badge. Open "sources the AI used" on one run. | Read the real AI answers, run by run, with their sources |
| 4 | Competitors & sources (`/app/competitors`) | "Who AI recommends" bars with "You" at the top, then "Where AI gets its answers" with the site-type boxes, one assistant selected. | See who AI recommends instead and which sites it trusts |
| 5 | Fixes (`/app/fixes`), "Waiting for you" tab | One "Clearer product description" card with a "Big win" badge, the Now / After columns, and the "Approve & publish", "Edit" and "Skip" buttons. | Approve clearer product pages in one click, undo any time |
| 6 | Outreach (`/app/outreach`) | One "Articles and roundups to pitch" card with the drafted email, "Open in my email", "Copy email" and the status menu. Blur the "Send to" address and the author name. | Find pages AI quotes that skip you, with a pitch ready |

Spare shot if one fails: the Fixes "Live" tab showing a published fix with "View in store" and "Undo".

## Feature image (1600 x 900)

- One focal point: a clean crop of the "Money from AI" card (shot 1, scaled up), sitting on a solid lilac
  (`#E2E2FC`) background, with the two-circle logo small in one corner.
- Optional short line, navy, never a promise and never the subtitle: "See what AI says about your store".
- No prices, no Shopify logos, no stats, contrast at least 4.5:1. Alt text: "The Money from AI card in the app,
  showing orders and revenue from AI assistants".
- A 2 to 3 minute promotional video can replace it later (screen recording at most a quarter of it).

## Icon (1200 x 1200)

- The GEO logo: two overlapping circles, lilac (`#9FAAF2`) top left and cobalt (`#4050B0`) bottom right, as in
  `public/favicon.svg`.
- Ready-made files are already in this folder: `icon-1200-lilac.png` (light lilac background, matches the favicon
  colours; use this one) and `icon-1200-navy.png` (dark version, spare).
- Shopify's rules: square, PNG or JPEG, padding round the mark (corners are rounded for you), no text, no
  screenshots, no Shopify marks. Both files follow them.
