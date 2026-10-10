# Ad evidence: real ChatGPT answers (asked 10 Oct 2026)

Why this folder exists: the ACCC says "A business must be able to prove any claim they advertise"
(`docs/ads/ad-rules.md` 5.2). Any ad line about what ChatGPT said must trace to a raw answer saved here,
with its prompt, country, time and call id. If a count is not in this folder, it does not go in an ad.

How the answers were collected: Treg gateway, endpoint `cloro.ai-search.chatgpt.scrape` (the live ChatGPT
web interface, country `AU`), body `{"prompt": ..., "country": "AU", "include": {"markdown": true,
"shopping": true}}`. Not anyone's personal ChatGPT account. Each file holds the unedited response. Text is
stored with JSON unicode escapes (a backslash, a u and four hex digits), so the answer is exact while the folder stays free of
literal dashes. Times are when the answer came back (UTC; add 11 hours for Sydney time). About US$0.0036
per answer.

## Files

| File | Prompt | Received (UTC) | Run by |
|---|---|---|---|
| `2026-10-10_chatgpt-AU_gift-bearded-man_run1_51be5042.json` | gift for a bearded man under $80, ships to Australia | 06:51 | reviewer |
| `2026-10-10_chatgpt-AU_gift-bearded-man_run2_c748eb21.json` | same | 06:52 | reviewer |
| `2026-10-10_chatgpt-AU_gift-bearded-man_run3_89d220e2.json` | same | 07:01 | finalise pass |
| `2026-10-10_chatgpt-AU_gift-bearded-man_run4_b4a7c6d6.json` | same | 07:01 | finalise pass |
| `2026-10-10_chatgpt-AU_beard-oil_run1_6e287299.json` | best beard oil for dry skin in Australia | 06:59 | finalise pass |
| `2026-10-10_chatgpt-AU_beard-oil_run2_8e12892b.json` | same | 07:00 | finalise pass |
| `2026-10-10_chatgpt-AU_gift-coffee_run1_99c4924d.json` | gift for a coffee lover under $50 in Australia | 06:53 | reviewer |
| `2026-10-10_chatgpt-AU_gift-coffee_run2_e63df113.json` | same | 07:04 | finalise pass |

## What the answers show (counted by hand from the files)

**Gift for a bearded man under $80 (4 answers)**

| Run | Picks | Linked to the maker's own website | Other links |
|---|---|---|---|
| 1 | 6 | 4 (Milkman x2, Beards Australia, Lily & Luna) | 2 to The Beard Club (retailer) |
| 2 | 6 | 5 (Beard & Blade own kit, Beards Australia, The Groomed Man Co., Milkman, Washpool) | 1 to David Jones home page |
| 3 | 4 | 3 (Milkman, Beards Australia, Cowboy Grooming Co) | 1 to Shaver Shop (retailer) |
| 4 | 5 | 5 (Beards Australia, Washpool, Milkman, Lily & Luna, Bel Scents Co) | none |
| **Total** | **21** | **17 of 21** | 4 |

- Two picks were in all four answers: Milkman Grooming Co's Beard Styling Box and the Beards Australia
  gift pack. At least 11 different brands were named across the four answers (run 2's "Beard Survival Kit" is
  headed Beard & Blade but described as from Gentlemen's Hardware, so 11 or 12). Runs 1 and 2 shared 2 picks; runs 3
  and 4 shared the same 2.
- Every answer gave AUD prices and what's in each set, and all four mentioned a free-shipping threshold
  for at least one store (run 1: "It ships from Australia, with dispatch advertised for the next business
  day. Shipping is free on orders over $79."). The Beards Australia product page lists the same contents ChatGPT gave (three
  15ml oils, boar brush, scissors, comb; read 10 Oct 2026).
- `utm_source=chatgpt.com` was on the links in runs 1 and 2, and on none of the links in runs 3 and 4 (as
  captured by the scraper).

**Best beard oil for dry skin in Australia (2 answers)**

- Run 1 named 3 brands (Stuga, Percy Nobleman, Bold & Bare). Run 2 named 4 (Professor Fuzzworthy's,
  Stuga, Alpine Beards, Bulldog). Only Stuga was in both.
- 4 of the 7 picks linked to the brand's own site. The rest went to a specialist retailer (Beard & Blade),
  an Amazon Australia search and a Chemist Warehouse search.
- Sites shown as sources: run 1, a dermatology body's tips page, two beard-care guide sites, brand pages
  and a specialist retailer; run 2, three "best beard oil in Australia" roundups (one of them on Stuga's
  own website) and a brand page. Stuga's own "best beard oil in Australia 2026" guide was cited in both
  runs (a footnote source in run 1, a main source in run 2).
- Beard Guru appears only as a footnote source (a blog post on beard products for sensitive skin).
  beardguru.com.au is a Shopify store that sells its own Beard Guru beard oil (30ml) and has a blog
  (read 10 Oct 2026). Describe it as "a beard care store".
- No UTM tags on either run's links.
- This does not match the planning test in CLAUDE.md §17 (different brands and sources). That test has no
  saved answer, date or URL list, so ads don't use it.

**Gift for a coffee lover under $50 (2 answers)**

- Both answers named product types (AeroPress-style maker, specialty beans, pour-over set, grinder or
  moka pot, cups) rather than stores. Run 1 cited four gift-guide sites and listed three products sold by
  Amazon AU, Kitchen Warehouse and Kmart, with "View product" links that go back into ChatGPT search.
  Run 2 cited a coffee site's buyer's guide (arigacoffeeau.com.au) and linked one product at Bunnings.
  No UTM tags.
- So the gift concept does not work for every category. Check each category twice before an ad uses it.

## Rules for using this folder

- Quote counts with the date and country: "Asked ChatGPT in Australia, 10 Oct 2026".
- Show real answers only as quote cards in our own design, labelled "Real ChatGPT answer, asked in
  Australia, 10 Oct 2026. AI-generated.", with other brands' names blurred unless they give written
  permission (`ad-rules.md` 4.4).
- Answers change. Re-run before any ad that quotes a category goes live, save the new files here, and
  update the counts.
