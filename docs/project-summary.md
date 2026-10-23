# GEO project summary (as of 23 Oct 2026)

A short overview Ross wrote for pasting into other chats. Saved here as it was written (only the Firstindex web address corrected), so it may go out of date:
CLAUDE.md is the source of truth.

**Context:** GEO (usegeo.app), owner Ross Delport, Perth, Australia.

**What GEO is:** a web app (the Shopify App Store version is paused) that helps Shopify stores get recommended by
ChatGPT, Gemini, Perplexity, Google AI Overviews and Claude.

- It checks the buying questions shoppers ask AI, and shows who AI recommends instead and which sites it cites
  ("Sites AI trusts").
- It writes product page fixes, buying guides (on a calendar) and honest Reddit replies (always saying who's writing,
  never posing as a customer).
- It drafts pitches to the sites AI cites, and shows the sales that came from AI, using a tracking code the store
  pastes into Shopify.
- Repo: rossdelport/geoshopifyapp. The live site deploys from branch `claude/peaceful-cerf-xtpto5` on Railway.
- House rules: plain English, no em dashes, no fake reviews or astroturfing, no buying links or link swaps, and every
  claim must be true.

## Current offer (changed 23 Oct 2026, now live on the home page in all 6 languages)

- An agency-style "Done for you" plan: A$1,000 a month, only 5 spots, for Australian ecommerce brands.
- Full refund if not happy after the first month (handled by hand, and the client keeps the work). No lock-in contract.
- The old Standard (US$49) and Done-for-you (US$349) plans are removed from the website. The app's own plans page,
  billing, the free check and llms.txt still show the old plans.
- Not decided yet: whether to say "plus GST" or "incl. GST".

## Done in that chat

- Checked the repo: all tests pass.
- Searched Meta's Ad Library for SaaS and AI-visibility ads. Winning patterns: a free check or audit, a short
  question, a big number, "this instead of that".
- Added a new image ad, "Shoppers ask ChatGPT", to the GEO - Waitlist campaign, Meta ad account 496098580259344.
  It's paused. (The image shows the Shopify logo, which breaks GEO's own ad rules, but Ross approved it.)
- Campaign results at that point: about A$39 spent and 23 clicks. Best ad: image IMG_6979 (12 clicks). IMG_6977 had
  spent A$10 with 0 clicks, so pause it if it stays at zero.
- Saved the "write for buyers who are choosing, not learning" playbook, with GEO recommendations, in
  `docs/geo-research.md` (section 5).

## Competitor and inspiration: Josh Pigford's FirstIndex (firstindex.com)

- An AI SEO/AEO agency, about US$474k a year after 3 weeks, built on his big following on X.
- His offer: US$1,000 a month for 5 software companies, with a full refund after month 1, run by an AI agent working
  on each client's website code every day.
- He doesn't serve ecommerce. Store owners in his replies were turned away, and that's GEO's opening.
- The full interview, with a summary, is in `docs/firstindex-interview.md`.

## Ideas agreed or recommended, not built yet

1. Connect usegeo.app to Google Search Console and Bing. Count GEO's own website visits (AI, search, other) and add a
   "sign-ups by ad" table in the admin area.
2. Run GEO on itself: 30 to 50 buying questions about GEO's own market, checked monthly.
3. Honest comparison pages: GEO vs Kedra, AgentIQ, Mento, FirstIndex and SEO agencies, saying where the other option
   wins.
4. Choose blog topics from real keyword data (DataForSEO through Treg) instead of picking them by hand.
5. "Almost on page one" feature for stores: find pages ranking 4 to 15, put the search phrase near the top, add links
   from the homepage, re-check after 3 weeks.
6. Add "brand searches a month" to the free check.
7. A "What we told X stores to change" image built from real free check data (needs 50 to 100 checks first).
8. Post a "5 Shopify stores, 1-on-1" offer on X, in Josh's style.
9. An honest version of the "Get ChatGPT to do this for your product" ad, without copying ChatGPT's screen.
10. A free check that counts how many clicks each page is from the homepage.

**Skipped on purpose:** buying backlinks (against Google's rules), and making hundreds of near-copy pages at once.
