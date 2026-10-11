# Free tools: launch note

Written 11 October 2026, after the build and the checks. The build spec is `docs/tools/spec.md`.

## What shipped

Seven free tools, a hub page that lists them, and the site files that help search engines and AI assistants find
them. Every page works without sign-up, shows its result on the page, works with JavaScript off, and has exactly
one button under the result, which goes to the GEO home page. Every tool page links to the hub and to three other
tools. The same footer (all seven tools, the hub, Home, How it works, Pricing, Privacy) is on every tool page, the
hub, the free check pages and the privacy page, and the home page footer lists all seven tools and the hub too.

| Page | Title | Meta description |
|---|---|---|
| https://usegeo.app/tools | Free AI Search Tools for Shopify Stores \| GEO | Seven free tools that show how AI search sees your Shopify store: AI Overviews, AI crawlers, product schema, FAQ schema, llms.txt and product copy. |
| https://usegeo.app/tools/ai-visibility-checker | AI Visibility Checker: Does ChatGPT Recommend You? \| GEO | Free AI visibility checker for Shopify products. See if ChatGPT, Gemini and Perplexity recommend your product and who they pick instead. No sign-up. |
| https://usegeo.app/tools/ai-overview-checker | AI Overview Checker: Is Your Site Cited by Google AI? \| GEO | Free AI Overview checker. Type a shopping search to see if Google shows an AI Overview, which sites it cites and if yours is one. No sign-up. |
| https://usegeo.app/tools/ai-crawler-checker | AI Crawler Checker: Which AI Bots Can Read Your Site \| GEO | Free AI crawler checker. See which AI bots your robots.txt lets in, like OAI-SearchBot, GPTBot and PerplexityBot, with Shopify fixes. No sign-up. |
| https://usegeo.app/tools/product-schema-checker | Product Schema Checker: What Google and AI Can Read \| GEO | Free product schema checker for Shopify. Paste a product link to see which facts Google and AI shopping tools can read and what's missing. No sign-up. |
| https://usegeo.app/tools/llms-txt-checker | llms.txt Checker: Validate and Generate Your File \| GEO | Free llms.txt checker and generator. See if your site has an llms.txt, check it against the llmstxt.org format and copy a starter file. No sign-up. |
| https://usegeo.app/tools/faq-schema-generator | FAQ Schema Generator: Free JSON-LD for Shopify \| GEO | Free FAQ schema generator. Type questions and answers, then copy FAQPage JSON-LD or a ready Shopify section. Runs in your browser. No sign-up. |
| https://usegeo.app/tools/ai-bot-checker | AI Bot Checker for Product Descriptions \| GEO | Does your product copy sound like a bot wrote it? Free checker for vague phrases, hype words and missing facts shoppers and AI need. No sign-up. |

Also changed:
- **Home page:** "Free tools" in the top menu, and a "Free tools" block in the footer. The page now has a canonical
  link, share image tags and Organization and WebSite structured data.
- **/check** (the free product check) works exactly as before, but tells Google that the AI Visibility Checker page
  is the one to list (decision R1 below). It is left out of the sitemap.
- **Privacy page:** a "Free tools" section, share tags and the site footer.
- **https://usegeo.app/robots.txt:** every public page is open to all search engines and AI bots. Only the app
  and private paths are closed (`/app`, `/auth/`, `/api/`, `/webhooks/`). Report pages are not blocked, so Google
  can see that they say "don't list me".
- **https://usegeo.app/sitemap.xml:** the home page, the hub, the seven tools and the privacy page, each with the
  date it last changed.
- **https://usegeo.app/llms.txt:** a short summary of GEO, the plans and a link to each tool. It passes our own
  llms.txt Checker with no problems.
- **One address for the site:** visits to www.usegeo.app or the Railway address are sent to https://usegeo.app
  (a permanent redirect). The Shopify app, logins, webhooks and robots.txt are never redirected.
- **Share images** for every page in `public/og/`.

## Your steps after the push

1. **Google Search Console**
   - Add usegeo.app as a "Domain" property. Google gives you a TXT record to add where you bought the domain.
   - Under Sitemaps, submit `https://usegeo.app/sitemap.xml`.
   - Paste each new page's address into URL Inspection (the hub and the seven tools). Check it says the page can be
     indexed and that the canonical Google picked is on usegeo.app, then click "Request indexing".
   - Settings, then **Search generative AI**: make sure it says "Include" (the default). "Exclude" would take the
     site out of Google's AI Overviews and AI Mode.
   - Over the next 4 weeks, watch the **Generative AI performance** report (how often the pages show in AI
     Overviews and AI Mode) and the Page indexing report.
2. **Bing Webmaster Tools:** sign in, import the site from Search Console, submit the same sitemap, and watch
   **AI Performance**, which shows when Copilot and Bing's AI answers cite the pages.
3. **IndexNow (optional, tells Bing and similar search engines about changed pages straight away):**
   - Pick a key: 8 to 128 letters, numbers or dashes.
   - Add a file `public/<key>.txt` that holds only the key (ask Claude to do it).
   - After each deploy that changes tool pages, send the changed addresses to `https://api.indexnow.org/indexnow`
     as `{"host":"usegeo.app","key":"<key>","urlList":[...]}`. An answer of 200 or 202 means it was received.
   - Google doesn't use IndexNow, so Search Console still matters most.
4. **Railway settings:**
   - `GEO_TOOLS_USD_PER_DAY` caps what the AI Overview Checker's live Google searches can spend in a day. It
     defaults to US$2. Set it only to change that; 0 turns live searches off.
   - `GEO_ALERT_EMAIL` is still not set, so nobody hears about Done-for-you stores.
5. **Watch for 4 weeks:** Railway logs for home page visits with `?ref=tool-` (people who clicked a tool's button)
   and for AI bots (OAI-SearchBot, ChatGPT-User, PerplexityBot, Claude-SearchBot) reading `/tools/` pages.
6. **Every 3 months:** re-check the AI Crawler Checker's bot list, how Shopify handles llms.txt and robots.txt, and
   Google's FAQ and AI features docs. Change a tool's "updated" date only when its words or checks really change.
7. **Getting the word out:** honest pitches to "best free AI SEO tools" round-ups that list other tools, one short
   screen recording per tool on YouTube, and answers in r/shopify and the Shopify Community that say you made the
   tools.

## Checks to run once it's live

Claude can do these through Treg, because this build machine can't reach usegeo.app:
- Load each page and confirm the title, H1, canonical and one result block. Load robots.txt and sitemap.xml.
- Confirm `www.usegeo.app/tools` and the Railway address redirect to `https://usegeo.app/tools`, and that `/app`
  and `/auth/login` on the Railway address still work for the Shopify admin.
- Run one live search on the AI Overview Checker and confirm a cost row of US$0.00015 for Crawl4AI.
- Run one real website check on the AI Crawler Checker, Product Schema Checker, llms.txt Checker and AI Bot
  Checker (link mode). The build machine can't reach outside sites, so these were only tested with stand-in sites.

## Decisions (the build went ahead on these defaults)

| # | Question | What the build does now | To change it |
|---|---|---|---|
| R1 | `/check` or the AI Visibility Checker page: which one should Google list? | The tool page. `/check` still works (the home page form posts to it) and points Google to the tool page. | Or send every visit to `/check` straight to the tool page with a redirect. |
| R2 | Where does the one button under each result go? | A section of the home page, with the tool's name in the link (`/?ref=tool-<slug>#how` or `#money`). | Point it at the free check or the Shopify install page instead. |
| R3 | How do AI assistants tell GEO the company from "GEO" the topic? | Titles end in "\| GEO"; the structured data names the company "GEO", also known as "GEO for Shopify". No social profiles listed until real ones exist. | Add profile links once they exist. |
| R4 | A named person as the maker? | "Made by GEO", linking to the home page. No About page yet. | Add your name and an About page. |
| R5 | A real example on the AI Visibility Checker page | A sample report for a made-up store, labelled as made up. | Run one free check on your own product; Claude then freezes it into the page as "Real example". |
| R6 | Top up Litescrape? | Not needed for the tools. The app's own AI Overview scans fall back to AnyAPI while Litescrape is out of calls. | Top it up to use the cheaper provider again. |
| R7 | Google's spam policy mentions automated access to Google Search without permission. The AI Overview Checker reads Google through a data provider, like many SEO tools. We found no case of a site being penalised for this. | Built, with results kept 24 hours, per-visitor limits and a daily spend cap. | Set `GEO_TOOLS_USD_PER_DAY=0` to switch live searches off. |
| R8 | A CDN for visitors far from the Singapore server? | No CDN. If you add Cloudflare later, turn off its "block AI bots" setting, which is on by default for new sites. | Add one later. |
| R9 | Search Console, Bing Webmaster Tools and IndexNow | Your steps above. | |

Smaller choices made during the build, for you to confirm:
- **AI Bot Checker:** a description under 100 words is scored as if it had 100 words, so one vague phrase in a short
  but factual description doesn't make it "Sounds generic". The page says so. To undo it, ask Claude to remove the
  100-word minimum.
- **AI Visibility Checker:** the hub says "Results in a few minutes", not the planned "about 2 minutes", because the
  check's own progress page says it usually takes 3 to 6 minutes.
- **FAQ Schema Generator:** in the Shopify theme editor, each question block shows as "Question" rather than its
  text. Renaming one setting in the generated section would show the text; say if you want that.
- **The app's own FAQ block** (`extensions/geo-faq/blocks/product-faq.liquid`) folds answers away, while the FAQ
  tool page says (citing Microsoft) that AI may not read folded-away answers. Showing them open is worth
  considering.
- **AI Overview Checker costs:** Crawl4AI's real charge per page can range from half to 4 times the US$0.00015 we
  record, and the US$2 daily cap also counts the free product check's backup Google calls. Live searches stop at
  1,000 a day, so even at 4 times the price, Crawl4AI would cost about US$0.60 a day.
