# GEO research notes (what the experts say, and what it means for the app)

Ross shares videos and articles here so every future build uses them. Summaries are in our own words.
Numbers marked "their study" come from the named company's own research: check the original before
quoting any of them on the site or in ads (honesty rules, CLAUDE.md).

---

## 1. Hostinger video: "What is GEO?" (shared 10 Oct 2026)

- SEO gets you ranked, GEO gets you quoted. You still need SEO; GEO sits on top of it.
- The AI assistants mostly draw on the same pool of web information (they lean on search engines underneath).
- AI picks content that is clear, credible, useful and trustworthy, not keyword-stuffed.
- Differences from SEO: the target is the AI answer, not the results page; what matters is structure,
  authority and citations; traffic is more "seen" than "clicked"; each section of a page should make sense
  on its own so AI can quote just that part.
- Question-and-answer structure (question as heading, clear answer below) works well.
- Their stats to verify before reuse: "60% of Google searches end without a click"; "Perplexity has 15 million
  monthly users" (out of date).

What we did with it (Oct 2026): AI-ready score in the free check; guide pages in strict Q&A form with
self-contained sections; guides cite only the store's real pages. llms.txt skipped (Shopify serves it; editing
needs write_themes).

## 2. Ahrefs video: "5 factors for ranking in AI search" (shared 11 Oct 2026)

Ahrefs says it studied 75,000 brands and 25 million AI Overviews (their study). The five factors:

1. **Branded mentions.** AI learns which brands go with which topics from how often credible sites mention
   them. In their data, brand mentions correlated with Google AI Overview visibility more strongly than
   backlinks or domain rating. Get mentioned on highly linked pages for Google AI Overviews, and on high
   traffic pages for ChatGPT and Perplexity. Find the pages AI cites in your niche, then: join the Reddit
   threads it pulls from, approach YouTubers for reviews, pitch publishers.
2. **Long-tail queries.** Assistants split one prompt into many smaller, specific sub-questions, fetch sources
   for each and combine them. Ranking for niche, specific questions makes it more likely you're included.
   AI Overviews show up more on longer, niche queries (their study). Do: content that answers complex,
   specific questions, and topic clusters that cover a subject in depth.
3. **Structure.** Google's AI reads the page's semantic HTML top to bottom, and assistants split pages into
   chunks and keep the most useful ones. Put key points early, keep each section on one takeaway, make each
   section make sense on its own while flowing to the next. Not choppy one-liners.
4. **Freshness.** In their study of 17 million citations across 7 AI platforms, AI-cited content was 25.7%
   fresher than content in normal Google results, and ChatGPT and Perplexity tend to list newer citations
   first. Assistants look things up (retrieval) when a topic is new or changing, so recency matters. Keep a
   refresh cycle: update facts, stats and quotes, remove stale parts, re-date when the update is meaningful.
   (HubSpot example: a refreshed article got a spike in AI mentions.)
   Also: make sure AI bots can crawl you. In their study of 140 million sites, about 5.9% blocked OpenAI's
   GPTBot. Check robots.txt. Which bot does what (each company's own crawler page, checked October 2026):
   - **Googlebot** controls Google Search, including AI Overviews and AI Mode. A block is critical.
   - **OAI-SearchBot** decides whether a site shows in ChatGPT search. Critical.
   - **PerplexityBot** decides whether a site shows in Perplexity's answers. Critical.
   - **Claude-SearchBot** and **Claude-User** both affect whether Claude can find and quote a site. Medium.
   - **Google-Extended** covers Gemini training and grounding, not Google Search or AI Overviews. Medium.
   - **GPTBot** and **ClaudeBot** are for training only. Blocking them does not hide a store from ChatGPT
     or Claude answers: never say it does.
   - **ChatGPT-User** and **Perplexity-User** fetch a page when a person asks; both say robots.txt may not
     apply to them.
   Firewall or CDN bot blocking (for example Cloudflare's AI bot setting) can't be seen in robots.txt.
5. **Diversify.** Of the top 50 most-cited domains in Google AI Overviews, ChatGPT and Perplexity, only 7
   appeared on all three lists (their study). Google AI Overviews leans on YouTube, Reddit and Quora; ChatGPT
   on publishers and news outlets; Perplexity on niche and regional sites. Winning one assistant doesn't win
   the others: work each one's sources ("pages where competitors are mentioned and you're not").

Their own caveat: nobody knows the definitive recipe yet; it's still early and needs testing.

### How we can use it in the app (suggestions, Oct 2026)

| Factor | Suggestion | Effort | Impact |
|---|---|---|---|
| Crawlable | The app reads the store's robots.txt weekly (lib/robots.ts, RFC 9309) and flags AI bots blocked from product pages: Googlebot, OAI-SearchBot and PerplexityBot are critical; Claude-SearchBot, Claude-User, Google-Extended and Bingbot medium; GPTBot and ClaudeBot information only (training). Plain fix: edit robots.txt.liquid | Small | High when it hits |
| Diversify | "Sites each AI trusts" split per assistant, and outreach targets grouped per assistant (Google: YouTube, Reddit, Quora; ChatGPT: publishers; Perplexity: niche blogs) | Small (data already collected) | High |
| Branded mentions | "Others only" outreach: cited pages that name rivals but not you, per assistant (we already find these); add honest outreach types: YouTube reviewers, publishers, Reddit threads to join as the brand (no fake posts) | Medium | High |
| Long-tail | Write more specific buyer questions (needs, ingredients, gifts, budgets) and track them; guide pages as topic clusters (one hub plus linked specific guides) | Medium | High (our Tallo test: specific questions win) |
| Structure | Product descriptions rewritten answer-first (who it's for and key facts in the first lines); AI-ready check adds "key facts near the top" | Small | Medium |
| Freshness | Guide pages and FAQs on a refresh cycle (every 60 to 90 days: update facts, show "Updated" date); outreach favours recently updated roundups | Medium | Medium to high |

## 3. Ahrefs video: "Learn 80% of AEO in 19 Minutes" (shared 12 Oct 2026)

A condensed version of Ahrefs' full AEO course. Five pieces: how AI search works, where you stand, what to
target, how to get cited, and how to measure. Summary in our own words; numbers are "their study" (Ahrefs'
own research) or "reported" (no source given in the video) and must be checked before reuse.

1. **How AI search works: query fan-out.** One prompt is split into many smaller searches that run at once,
   and the answer is put together from several sources. Reported: ChatGPT's deep research ran 420 searches
   for one prompt about buying a red phone case. So a brand needs to be relevant across a whole topic, not
   one keyword. Three things raise the chance of being cited (their study):
   - **Consensus:** the more places say the same thing about a brand, the more AI believes and repeats it.
   - **Freshness:** AI-cited content is 25.7% fresher than what ranks in normal Google results.
   - **Authority:** 76% of AI Overview citations come from pages already in Google's top 10. Normal SEO is
     the foundation.
2. **Where you stand: brand gap analysis.** Three gaps to note:
   - **Missed citations:** answers that mention the brand but don't link its site.
   - **Competitor gap:** prompts where a rival is mentioned and you're not.
   - **Topic gap:** topics AI connects with someone else's brand instead of yours.
3. **What to target: keyword and prompt research.** Start from seed keywords plus modifiers (they suggest
   asking an AI assistant for 10 one-to-two-word seeds and 5+ modifiers for your site type, revenue model
   and audience). Then an "AI filter": if Google's AI Overview fully answers a query, nobody needs to click,
   so aim to be named inside the answer instead of chasing the click. Their figures: AI Overviews show on
   about 21% of keywords but about 58% of question queries, and 99.9% of keywords that trigger them are
   informational. Mention opportunities: prompts with best, top, versus, review, alternative where rivals
   are named and you're not.
4. **How to get cited: content, mentions, YouTube, technical.**
   - **Content on your own site (their study):** length doesn't matter (174,000 pages cited in AI Overviews:
     near-zero correlation with word count; over half under 1,000 words). Freshness matters (89.7% of
     ChatGPT's top-cited pages were updated in 2025; 76% within the last 30 days). Format matters (43.8% of
     pages ChatGPT cites are lists, best X, top X, comparisons and reviews).
   - **How to write:** bottom line up front (answer first in every section); atomic sections (each makes
     sense alone, because AI cuts pages into chunks); entity-rich (name the exact product, brand and
     attribute instead of "this product helps"); simple, declarative sentences (one idea each; if it takes
     two reads, rewrite it).
   - **Mentions on other sites:** in their study of 75,000 brands, branded web mentions had the strongest
     link to AI Overview visibility, stronger than backlinks or domain rating. Three tiers: (1) editorial
     pages, review sites and listicles (hardest, most valuable); (2) community answers on Reddit, Quora and
     forums (contribute real answers, don't game it); (3) your own channels (YouTube, podcast, LinkedIn).
   - **YouTube:** the most cited domain in Google's AI Overviews; YouTube mentions had a 0.737 correlation
     with ChatGPT visibility, the strongest factor they found (their study). Reported: GPT-4 was trained on
     over a million hours of YouTube transcripts. Aim for evergreen "search hits" (videos people search for
     month after month) over viral spikes: keyword in the title and the first lines of the description,
     chapters, and say the keyword out loud in the video.
   - **Technical:** about 5.9% of 140 million sites block GPTBot (their study), often by accident through old
     templates. Cloudflare's setting that writes AI bot rules into robots.txt is on by default. Check
     robots.txt for GPTBot, OAI-SearchBot, ClaudeBot and Google-Extended. (Our nuance, section 2: GPTBot and
     ClaudeBot are training only; OAI-SearchBot is the one that decides ChatGPT search.)
5. **How to measure.** Three signals together:
   - **AI referral traffic** (always an undercount: some ChatGPT links pass no referrer).
   - **AI bot activity** on your pages (a citation bot that keeps reading a page suggests it's being used
     as a source; needs server or CDN logs).
   - **Self-reported attribution:** a "How did you hear about us?" question at sign-up or after checkout,
     because a shopper who sees a brand in ChatGPT and then Googles it shows up as organic. Their own
     numbers: AI search was 0.5% of Ahrefs' visits but 12.1% of sign-ups, a 23 times higher conversion rate
     than organic search.

Their suggested order: run the robots.txt check first; set up measurement and the "how did you hear about
us" question from day one; then fix your biggest gap (topic gap: refresh pages that lost rankings because
they went stale; competitor gap: get into listicles, reviews and Reddit threads; format gap: get on YouTube,
your own videos or creators). Their "why now" figures (reported, check before reuse): AI traffic grew 9.7
times in a year; ChatGPT grew 85% since January and sends more traffic than Reddit or LinkedIn.

Ahrefs' chart "ChatGPT, AI Mode & AI Overviews compared: factors that correlate with AI mentions" (about 75,000
brands; Ahrefs Brand Radar and Site Explorer; shared by Ross 12 Oct 2026). Correlation with how often a brand is
mentioned in AI answers:

| Factor | ChatGPT | AI Mode | AI Overviews |
|---|---|---|---|
| YouTube mentions | 0.735 | 0.736 | 0.740 |
| YouTube mention impressions | 0.721 | 0.712 | 0.719 |
| Branded web mentions | 0.656 | 0.709 | 0.664 |
| Branded anchors | 0.511 | 0.628 | (cut off in the screenshot) |

Read with care: these are correlations, not proof that one causes the other (big, well-known brands score high
on all of them). "YouTube mentions" means the brand being named in YouTube videos, mostly by other people, which
is the same "consensus" signal as web mentions; a brand's own new channel with few views is a much weaker
version of it.

### What this means for GEO (suggestions, Oct 2026)

Already built (section 2 table): long-tail questions grouped into topics (fan-out), crawler check, answer-first
descriptions, guide pages kept fresh, "others only" outreach per assistant. New ideas from this video:

| Idea | What it would do | Data we have | Effort | Impact |
|---|---|---|---|---|
| Mentioned but not cited | List answers that name the store but link to other sites, and which page AI should have linked | Mentions and citations per answer, already saved | Small | Medium to high |
| Topic gap view | Per topic (question cluster), which brand AI connects with it, with the store's share | Clusters and mentions, already saved | Small to medium | High |
| "How did you hear about us?" survey | Thank-you page question (Checkout UI extension), counted in the money dashboard as "said AI" | CLAUDE.md section 10 item 4 already plans it | Medium | High (catches AI sales analytics misses) |
| Guide format | Guides lean on list, best-for and comparison layouts, since those are cited most | Guide writer prompt | Small | Medium |
| Writing rules | Add "entity-rich, one idea per sentence, each section stands alone" to the description and guide prompts | Prompts in fixes.server.ts | Small | Medium |
| YouTube ideas | For topics where AI cites YouTube, suggest evergreen video topics and creators to approach (honest outreach only) | Citations per engine, outreach "video" kind | Medium | Medium to high |
| AI bot activity | Not possible on Shopify: stores don't get server logs. Skip, or explain in the app why we can't show it | None | n/a | n/a |

---

## 4. Post: "Railway hacked AI SEO" (shared 15 Oct 2026)

A social post about Railway (app hosting). Its numbers are the post's own (unchecked): about US$20M to about
US$100M a year in one year; Claude Code picks Railway for 82% of Python apps; 6,653 how-to pages; 127 framework
guides; 312 weekly changelog pages; a go-to-market team of 7. Don't quote them on the site or in ads.

What Railway did, in short:
- Treats being recommended by AI as a growth channel with its own team.
- One page per question people ask ("how do I set up n8n?", "how do I deploy Django?"), each ending with the
  product doing the job.
- A comparison page against every competitor, each with a "switch to us" guide. AI quotes comparisons a lot.
- Help pages easy for AI to read: one file listing every page with a summary (llms.txt) and a plain-text version
  of every page.
- Lives inside the AI tools: plugins in ChatGPT and Claude Code, a no-signup "make it live" path for agents.
- Fresh pages every week (a changelog every Friday since 2021) to stay in front of Google and the models.
- Its gap: front-end apps, where Claude Code picks Vercel every time. Winning one kind of question doesn't win them all.

### What this means for GEO

For GEO's own growth (being the answer when someone asks "how do I get ChatGPT to recommend my Shopify store?"):

| Idea | What it would do | Effort | Impact |
|---|---|---|---|
| Who AI recommends, by product type | Public pages like "Who ChatGPT recommends for beard oil in Australia", from our own scans, refreshed weekly. Real data nobody else has, which AI loves to cite. Only aggregated public answers, never a customer's private data | Medium | High |
| Comparison pages | GEO vs AgentIQ, Kedra, Mento, RankPill and others, honest and checked, each with a "switching" section | Small to medium | High |
| How-to pages per question | "How to get ChatGPT to recommend your skincare store", one per niche, each ending with the free check | Medium | Medium to high |
| Weekly "What's new" page | A short changelog every Friday | Small | Medium (freshness) |
| Help pages in plain text | Extend llms.txt with a summary per page and a plain-text version of each help page | Small | Medium |
| GEO inside ChatGPT | A ChatGPT app that runs the free check in the chat | Large | High, later |

For merchants (this is the same playbook GEO sells): guide pages per buying question (the guide calendar),
comparison guides against the rivals AI names, an llms.txt for the store, and fresh content on a schedule.
It backs the guide calendar as the next build, with comparison pages as one guide type.

## 5. Post: "Write for people who are choosing, not learning" (shared 18 Oct 2026)

A founder got about half his signups from ChatGPT after publishing pages around buying questions. The playbook:

1. List the questions people ask right before they spend: "[competitor] alternative", "[tool] vs [tool]",
   "best [category] for [use case]", "[category] for [buyer]", "[tool] pricing", "is [tool] worth it".
2. Run them through ChatGPT in a clean session and save every cited source: query, URL, page type, brands named,
   and whether yours appears. After 30 to 50 queries the same sites and formats repeat.
3. Sort by buying intent. "What is CRM software?" is learning; "best CRM for a 10-person agency" is choosing.
   Write for the chooser first.
4. Build the missing buying pages on your own site: alternatives, comparisons, use cases, pricing, integrations,
   pages per type of buyer. One page answers one buying decision very well.
5. No fake comparisons where you win every row. Show prices, screenshots, real limits, who each option suits and
   where the competitor genuinely wins. The page should help even if the reader never buys from you.
6. Add something other pages lack: original data, a calculator, real screenshots, a decision table, a benchmark,
   customer examples, a demo. Another 1,500-word AI article gives AI no reason to cite you.
7. Put prices, differences, features, limits and answers in plain page text, with clear headings, crawlable
   pages, internal links and structured data that matches what visitors see.
8. Let ChatGPT in: check robots.txt and CDN rules and don't block OAI-SearchBot (OpenAI asks sites to allow it).
9. Watch other sites too. If ChatGPT keeps citing a third-party "best tools" page, comparison, Reddit thread or
   guide for a valuable question, find out why you're missing and whether you honestly belong there.
10. Follow the money: ChatGPT links carry utm_source=chatgpt.com, so record landing page, signup, qualified user
    and paying customer. "Cited 400 times" means nothing if nobody buys.
11. When a page brings customers, grow around the same intent ("X alternative" to "free X alternative" to
    "X vs Y" to "best [category] for [use case]"), not random traffic articles.
12. Rerun the important questions every month: which brands and URLs appeared or disappeared, which new sources
    are cited. Then update the buying pages.

There is no secret GEO markup.

### What this means for GEO

This is GEO's own product, run on GEO itself. Steps 2, 9, 10 and 12 are what scans, Sites AI trusts and the
money dashboard already do for stores.

| Idea | What it would do | Effort | Impact |
|---|---|---|---|
| Run GEO on usegeo.app | Add GEO as a store-like account with 30 to 50 buying questions ("best app to get my Shopify store recommended by ChatGPT", "Kedra alternative", "AgentIQ vs Kedra", "is an AI visibility app worth it"), scanned monthly. Shows which sites ChatGPT cites and whether GEO is named | Small | High |
| Buying pages on usegeo.app | Honest comparison and alternative pages (GEO vs Kedra, AgentIQ, Mento, FirstIndex, an SEO agency), "for skincare stores" style buyer pages and a clear pricing page. Each says where the other option wins. Must pass `docs/ads/ad-rules.md` (accurate on the day, re-checked) | Medium | High |
| Something only GEO has | Aggregated data from our scans ("which sites ChatGPT cites for beauty products in Australia") and the free check as a built-in tool on each page | Medium | High |
| Follow signups to money | The waitlist already saves utm source and referrer. Add the same for sign-ups and paid customers, and an admin table: source and landing page to signup to paying | Small | High |
| Let ChatGPT in | Check usegeo.app's robots.txt and Railway/CDN rules allow OAI-SearchBot, GPTBot, PerplexityBot and ClaudeBot | Small | Medium |
| Pitch the cited pages | Use Sites AI trusts on GEO's own questions and pitch the roundups and threads ChatGPT already cites | Small | Medium to high |

For stores, the same thinking backs the guide calendar: choose buying questions over learning questions,
comparison guides with honest limits, and something original on every page.
