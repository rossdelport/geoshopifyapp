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
   GPTBot. Check robots.txt.
5. **Diversify.** Of the top 50 most-cited domains in Google AI Overviews, ChatGPT and Perplexity, only 7
   appeared on all three lists (their study). Google AI Overviews leans on YouTube, Reddit and Quora; ChatGPT
   on publishers and news outlets; Perplexity on niche and regional sites. Winning one assistant doesn't win
   the others: work each one's sources ("pages where competitors are mentioned and you're not").

Their own caveat: nobody knows the definitive recipe yet; it's still early and needs testing.

### How we can use it in the app (suggestions, Oct 2026)

| Factor | Suggestion | Effort | Impact |
|---|---|---|---|
| Crawlable | Free check and app read the store's robots.txt and flag if AI crawlers are blocked (OpenAI's GPTBot / OAI-SearchBot / ChatGPT-User, PerplexityBot, ClaudeBot, Google-Extended, Googlebot), with a plain fix | Small | High when it hits |
| Diversify | "Sites each AI trusts" split per assistant, and outreach targets grouped per assistant (Google: YouTube, Reddit, Quora; ChatGPT: publishers; Perplexity: niche blogs) | Small (data already collected) | High |
| Branded mentions | "Others only" outreach: cited pages that name rivals but not you, per assistant (we already find these); add honest outreach types: YouTube reviewers, publishers, Reddit threads to join as the brand (no fake posts) | Medium | High |
| Long-tail | Write more specific buyer questions (needs, ingredients, gifts, budgets) and track them; guide pages as topic clusters (one hub plus linked specific guides) | Medium | High (our Tallo test: specific questions win) |
| Structure | Product descriptions rewritten answer-first (who it's for and key facts in the first lines); AI-ready check adds "key facts near the top" | Small | Medium |
| Freshness | Guide pages and FAQs on a refresh cycle (every 60 to 90 days: update facts, show "Updated" date); outreach favours recently updated roundups | Medium | Medium to high |
