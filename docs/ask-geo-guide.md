# Ask GEO: what the assistant knows

This file is the knowledge behind "Ask GEO", the help chat inside the GEO web app (usegeo.app/dash/ask). It is
written from this repository: what the app does today, the plans, and the GEO research notes
(docs/geo-research.md). Keep it true: when a feature ships or changes, update this file in the same commit.
Everything here may be said to customers. Internal plans, costs, suppliers and other customers never belong here.

---

## About GEO

GEO helps Shopify stores get recommended by AI assistants: ChatGPT, Gemini, Perplexity, Google AI Overviews
(and Claude on Done for you). Shoppers now ask AI things like "best beard oil for dry skin in Australia" and buy
what it names. GEO shows which brands AI recommends for the questions shoppers ask about the store's kind of
product, why, and what to do about it, and it shows the clicks, orders and money that come from AI.

- Website: usegeo.app. Support email: ross@usegeo.app. Ross is GEO's founder.
- GEO's blog is at usegeo.app/blog: plain-English articles on getting recommended by AI, three new ones a week
  (Monday, Wednesday and Friday). Free, no sign-in.
- GEO works for Shopify stores only, worldwide, in English.
- GEO reads only what anyone can see on the store (its public product pages). Nothing in the store's Shopify
  admin changes. GEO can't edit the store for them yet.
- Sign-in is by email link only: type your email at usegeo.app/login, open the link we email (it works once,
  for 30 minutes), and tap Continue. You stay signed in for 30 days. There are no passwords.

## Getting started

1. Sign in at usegeo.app/login.
2. Type your store's address (for example yourstore.com). It must be a Shopify store. We check it in a few
   seconds.
3. Setup runs by itself and takes a few minutes. You can leave the page and come back:
   - reading your products,
   - writing the buying questions shoppers ask AI about products like yours,
   - asking ChatGPT, Gemini, Perplexity and Google each question, twice each (answers vary from run to run, so
     we always use more than one).
4. Your dashboard appears with your results.
5. Add the tracking code (Tracking code tab) so the dashboard can show money from AI.

One email account has one store. A store already on GEO under another email can't be added again; email
ross@usegeo.app if that's your store.

## The tabs in the app

### Dashboard
- **Money from AI this month:** AI revenue, AI orders and AI clicks. These need the tracking code. Until it's
  added the cards show "Add the tracking code to see this".
- **Where your shoppers came from this month:** a table with three rows, AI assistants, search engines (Google,
  Bing and co, which is SEO traffic) and everything else (direct, social, email, ads), each with visits, orders,
  sales and share of sales. It also needs the tracking code. Google AI Overviews count as Google search here,
  because Google sends both kinds of visit the same way.
- **Visibility score (0 to 100):** how often AI recommends you. We ask every question twice on each AI. You get
  full points when the AI names you in its top 3, two-thirds when it names you lower down, and one-third when it
  only links to your website. Under 20 is weak, and most new stores start low. It moves as AI answers change, so
  watch the trend, not one week.
- **Latest orders from AI:** each order, which AI sent the shopper, the amount and when.
- **Who AI names:** the share of AI answers that name each brand, you first.
- **Questions where AI doesn't name you:** your biggest openings, with the brands AI names instead.

### Buying questions
Every question we ask AI for your store, how many people search it a month (when known), how often AI names you
(and your best position), and who AI names instead. "Not asked yet" means it's waiting for the next check.

### Sites AI trusts
The websites AI reads most when it answers your buying questions, counted over every check since you joined. For
each site: how many AI answers used it, which assistants, how often those answers named you, the rivals named
there, and its most-used page.
- **Find the writer** looks up the person who wrote that page: name, role, company, email and LinkedIn. A
  lookup counts against your monthly allowance even when nobody is found.
- **Write a pitch** drafts a short, honest email from you to that writer about your product, for that page. Copy
  it or open it in your email app. On Done for you our team sends it and follows up.
- Forums and Reddit: join the conversation as yourself (see Reddit threads). Directories and review sites: get
  listed or claim your free profile, never write reviews yourself. Shops and marketplaces: ask them to stock you.

### Reddit threads
The point is visibility, not quick sales: AI assistants (Google AI Overviews, ChatGPT, Perplexity) quote Reddit often, so honest, helpful replies that name the brand make it more likely AI names the store too.
Reddit posts where people ask about products like yours, found once a week (the first look runs right after
setup). Left: every thread (All, To reply, Replied). Right: the post and a reply we wrote for you.
- The reply is written as you, the owner, and always says who you are, for example "(I run Brand, so I'm
  biased.)". Keep that line: Reddit asks for it, and people trust an honest reply more.
- Edit the reply if you like, tap **Copy and open thread**, paste it into the thread on Reddit and post it
  yourself. GEO never posts for you.
- **Mark as replied** keeps track. **Not relevant** removes a thread.
- Tips: reply to a few good threads a week rather than many; check the subreddit's rules on self-promotion first;
  answer the question properly before naming your product; never pretend to be a customer and never ask friends
  to post fake recommendations.

### Guide calendar

A month view of the guide pages GEO writes for your website: one guide per day slot, each answering one buying
question AI doesn't name you for (the ones it never names you for come first, then bigger searches first). Each
day shows the question, how many people search it a month, the kind of guide and where it is at. Click a day to
read the whole page as it will look. The Done for you plan gets 12 a month (three a week).
"Autofill calendar" plans the rest of this month and next; the calendar also fills itself every day.

How a day goes:
- Planned: the question is chosen; the guide is written two days before its day.
- Needs your OK: it is written; read it and press Approve. On Done for you, guides are OK'd when written,
  unless our claims check softened something or the guide needs a fact from you: those wait for your OK. Email
  ross@usegeo.app if you'd rather OK every guide yourself.
- Scheduled: OK'd, waiting for its day.
- Add to your store: on its day, stores without a Shopify connection get two-minute steps: copy the title, copy
  the content, paste them into Shopify's "Add page" screen (Online Store, Pages, Add page; use the <> button to
  paste the content as HTML; Visibility: Visible), then press "I've added it".
- Live: the page is up, with a link to it.
- Couldn't write: the draft didn't pass our checks; it is tried again later, or press "Try again".
- Skip this one: drops the day and its question. A guide that was already written is set aside and still counts
  toward the month's allowance. A day skipped before it was written gets a replacement day with another question
  when the month has room.

What a guide is: a buying guide in strict question-and-answer form (a short answer, four to six answered
questions, "Products that fit" linking your own products with tracking, sources only from your own pages). We
never invent facts, and health-type stores get a claims check before the page is shown.

How pages get onto your site: today by copy and paste as above. One-click publishing through a Shopify
connection is coming; don't promise a date.

### Tracking code
A small code you paste into Shopify so GEO can count visits and orders that came from AI. It takes 2 minutes:
1. In Shopify admin, open Settings, then Customer events.
2. Click **Add custom pixel** and name it GEO.
3. Delete the example code Shopify shows, then paste your GEO code (Copy code button).
4. Click **Save**, then **Connect**.
The tab shows "Working" once the first visit arrives. It sends no names, emails or addresses, and it follows the
store's cookie settings. To remove it, delete the GEO pixel in Settings, then Customer events.

### Ask GEO
This chat. It answers questions about GEO and about getting recommended by AI. Chats aren't saved: each visit
starts fresh. If it can't help, it passes the question to the GEO team, who reply by email.

## How AI money is counted (and its limits)

- An order counts as "from AI" when the shopper arrived from an AI assistant (chatgpt.com, perplexity.ai,
  gemini.google.com, copilot, claude.ai and others) or a link tagged by ChatGPT (utm_source=chatgpt.com).
- It's always an undercount. Some AI apps pass no referrer, and a shopper who sees you in ChatGPT and then Googles
  your name shows up as Google. Google AI Overviews can't be separated from normal Google search, so they aren't
  counted as AI.
- GEO never claims all AI money was caused by GEO.

## Plan and price

GEO has one plan, Done for you, for Australian ecommerce brands. We're taking on 5 brands; join the waitlist on
usegeo.app and we'll be in touch. Until then new accounts start on the free plan; email ross@usegeo.app for
early access.

- **Free:** one check of 10 buying questions on ChatGPT, Gemini and Perplexity, your visibility score and top
  competitors, and one look for Reddit threads.
- **Done for you:** A$1,000 a month (Australian dollars). No lock-in contract, cancel any time. Not happy after
  the first month? Full refund, and you keep all the work. Our team and AI do the work; you see the sales.
  - 100 buying questions, checked every day, on ChatGPT, Gemini, Perplexity and Google AI Overviews, plus
    Claude every week.
  - 12 guide pages a month (three a week) on the Guide calendar, written and OK'd for you (email ross@usegeo.app
    if you'd rather OK each one yourself).
  - Sites AI trusts: up to 20 writers looked up a month and up to 40 pitches a month, sent and followed up by
    our team (including directories and roundups).
  - Reddit threads: new threads every week, each with a reply written for you.
  - Money from AI dashboard and a 30-minute call with our team.
- Allowances reset on the 1st of each month.

Coming soon (not in the app yet, don't promise dates): paying for a plan in the app, product fixes you can copy
and paste (better descriptions and FAQs), one-click publishing of guide pages through a Shopify connection, a
score trend over time, and the monthly email report. Never say a coming-soon feature is available.

## Privacy and data

- GEO reads the store's public product pages and asks AI assistants questions about products like the store's.
- The tracking code sends visits that came from AI and order totals and products, never names, emails or
  addresses.
- One store's data is never shown to or used for another store.
- To delete an account or store, email ross@usegeo.app (the assistant flags it to the team).
- Ask GEO chats aren't saved.

## What GEO never does

Fake reviews, fake Reddit posts, posing as a customer, link swaps or link networks, buying links, or making up
facts about products (ingredients, awards, certifications, stats). Health, skin and supplement products: no
medical or therapeutic claims.

---

## How to get recommended by AI: best practices

These come from GEO's research (Ahrefs' studies of 75,000 brands and millions of AI answers, Hostinger, and our
own checks). Nobody knows the full recipe yet; these are the strongest signals so far.

### How AI picks what to recommend
- SEO gets you ranked, GEO gets you quoted. Normal SEO is still the foundation: most pages AI cites already rank
  well on Google.
- AI splits one question into many smaller searches ("fan-out") and builds its answer from several sources. A
  brand needs to be relevant across a whole topic, not one keyword.
- Three things raise the chance of being named: **consensus** (many credible places say the same thing about
  you), **freshness** (AI favours recently updated pages) and **authority**.
- Each assistant leans on different sources. Google AI Overviews lean on YouTube, Reddit and Quora; ChatGPT on
  publishers and news; Perplexity on niche and regional sites. Winning one doesn't win the others.

### Get mentioned on other sites (the biggest lever)
- Being mentioned by credible sites (branded mentions) is linked to AI visibility more strongly than backlinks.
- Start with the pages AI already cites for your buying questions (Sites AI trusts), especially roundups and
  "best X" lists that name your rivals but not you. Pitch the writer honestly: why your product fits their page.
- Reddit, Quora and forums: answer real questions as yourself and say who you are.
- YouTube: the most cited site in Google's AI Overviews. Aim for reviews by real creators and evergreen videos
  people search for (keyword in the title and description, chapters).
- Directories and review sites in your niche: get listed and collect genuine reviews from real customers.

### Make your own site easy for AI to use
- Answer first: put who the product is for and its key facts in the first lines of each product description.
- Each section should make sense on its own (AI quotes chunks), with one idea per section.
- Name things exactly: the product name, materials or ingredients, sizes, who it suits. Avoid vague lines like
  "this product helps".
- Question-and-answer layouts work well: a question as the heading, a clear answer below (product FAQs).
- Lists, "best X for Y", comparisons and reviews are the formats AI cites most. Length doesn't matter much.
- Keep pages fresh: update facts, prices and availability, and refresh important pages every 2 to 3 months.

### Let AI read your store
- Check that robots.txt doesn't block the bots that matter: Googlebot (Google, AI Overviews), OAI-SearchBot
  (ChatGPT search) and PerplexityBot (Perplexity). GPTBot and ClaudeBot are for training only; blocking them
  doesn't hide a store from ChatGPT or Claude answers.
- Firewall or CDN settings (for example Cloudflare's AI bot blocking) can block AI bots too, and don't show in
  robots.txt.

### Target the right questions
- Long, specific questions ("unscented beard oil for sensitive skin") are easier to win than broad ones ("beard
  oil"), and AI answers show up more on them.
- "Best", "top", "versus", "review" and "alternative" questions are where shoppers decide.

### Measure it
- Watch AI clicks, orders and revenue (tracking code), your visibility score trend, and which questions you start
  winning.
- Add a "How did you hear about us?" question at checkout: shoppers who saw you in ChatGPT and then Googled you
  only show up there.
- Give it time: AI answers change week to week, and new mentions take weeks to months to show up.
