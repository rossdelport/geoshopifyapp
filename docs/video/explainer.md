# Home page video: the explainer (since 13 Oct 2026)

Replaces the member tour (`storyboard.md`) in "What you get when you join". Ross: the tour put too much on screen
and didn't simply say how GEO helps and what it does in the background. He shared a product launch film from a
similar company and asked for the same feel with GEO's own story.

**The feel we copied:** one to five words on screen at a time; dark navy scenes and soft pastel scenes taking
turns, cut on the beat; words that streak in or rise out of a blur; one simple picture per idea (a glowing search
bar, chat bubbles dropping in, AI logos orbiting, a dashboard tilting into place); a "Join" line and the logo to
finish. Silent, 1280x800, 30 fps, about 44 s, looped on the page. Code: `design/video/src/explainer/`.

Made-up store (Coolabah Grooming Co.), rivals (Ridgeback, Saltbush, Banksia), example sites (The Groom Guide,
Beard Weekly, Present Picks) and sample numbers only. Every scene with them has the "Example" tag.

Same day, Ross: "speed it up a little, it feels a bit slow to read" and "make it more clear that we contact
websites to get your brand listed". So every scene plays 1.25 times faster (`SPEED` in `kit.tsx`; the frames
below are design frames, each scene lasts frames / 1.25), and the outreach scene now shows the pitches going out
and the store being added to a list.

| # | Scene | Background | On screen | Design frames |
|---|---|---|---|---|
| 1 | Shoppers | dark | "Shoppers" streaks in | 42 |
| 2 | DontJust | light | "don’t just" | 30 |
| 3 | SearchBar | dark | glowing search bar types "Google it" | 62 |
| 4 | Anymore | dark | "anymore." | 34 |
| 5 | TheyAsk | light | chat bubbles drop in, then "They" "ask" | 92 |
| 6 | BigAI | dark | a big chrome "AI" over outlined "AI" tiles | 50 |
| 7 | AIPicks | light | "AI picks a few brands." over a ChatGPT answer naming 3 rivals | 110 |
| 8 | IsYours | dark | "Is yours one of them?" | 62 |
| 9 | Introducing | dark | "Introducing" streaks in | 38 |
| 10 | LogoReveal | dark to lilac | a lilac circle opens, the GEO logo comes together, "Get recommended by AI" | 84 |
| 11 | EveryWeek | light | "Every week," shrinks up, "we ask AI" drops in | 80 |
| 12 | Orbit | dark | ChatGPT, Gemini, Perplexity, Google and Claude orbit; shoppers' questions change in the middle | 142 |
| 13 | WhoPicks | dark | "We see who AI picks." Dotted streams flow into Ridgeback, Saltbush, Banksia and a faint "You" | 96 |
| 14 | Rewrite | light | "We rewrite your product pages": old title struck out, new one typed, an FAQ added, Approve clicked, "Live on your store" | 130 |
| 15 | Guides | light | "We write buying guides": a guide page rises into place | 90 |
| 16 | Sites | dark | "We ask the sites AI trusts / to list your brand.": three example sites with a "Best beard oils" list, a pitch flies to each ("Pitch sent"), Beard Weekly adds the store ("NEW"), "3 pitches sent" | 132 |
| 17 | Money | light | "You see the sales from AI.": $4,280, 37 orders, 612 clicks, split by ChatGPT, Perplexity, Gemini | 120 |
| 18 | Slogan | dark | "Shoppers ask. / AI recommends. / You get the sale." | 96 |
| 19 | Join | dark | "Join the waitlist  usegeo.app" | 80 |
| 20 | EndCard | lilac | GEO logo, "Get recommended by AI", then fades to scene 1's first frame for the loop | 90 |

Honest wording: "we rewrite" shows the Approve click (Standard asks first; Done-for-you does it for you); "we ask
the sites AI trusts to list your brand" (Standard writes each pitch for the store to send; Done-for-you sends and
follows up), and only one of the three sites adds the store, because a pitch asks and can't promise; "the sales from AI", not "every
sale" (Google's AI Overviews can't be separated from normal Google). The page's `aria-label` adds that AI answers
can take weeks or months to catch up.

Render (from `design/video`):

```sh
npx remotion render Explainer out/explainer.mp4  --codec=h264 --crf=22 --muted
npx remotion render Explainer out/explainer.webm --codec=vp9  --crf=36 --muted
npx remotion still  Explainer out/explainer-poster.jpg --frame=1101 --jpeg-quality=90   # the money scene (EXPLAINER_POSTER)
```

Then copy the three files to `design/overview/img/` and run `node design/overview/assemble.mjs`. Desktop only:
the page hides the video section on phones (Ross, 12 Oct 2026), so there is no phone version.
