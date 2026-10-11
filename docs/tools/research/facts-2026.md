# Fact pack for the free tools (verified 11 October 2026)

Hard facts for the 7 free tool pages on usegeo.app. Builders can hard-code these into tool logic and page
copy. Every fact has a source URL and the date it was checked. All "checked" dates are **11 Oct 2026**
unless another date is given.

How this was checked: the sandbox could not resolve most hosts with WebFetch, so pages were read with Treg's
`crawl4ai.web.scrape` and `anyapi.web.scrape` endpoints (about US$0.02 in total). Live Shopify files
(`/llms.txt`, `/robots.txt`, product JSON-LD) were fetched the same way on 11 Oct 2026.

Labels:
- **[Primary]** the company's own docs, changelog, help centre or staff post, read on the date shown.
- **[Study]** a dated research study; says what was measured and how.
- **[Secondary]** a write-up of someone else's statement or data. Check the original before quoting it publicly.
- **[Observed]** something we fetched ourselves today.
- **UNVERIFIED** could not be confirmed from a primary source. Do not hard-code into copy.
- **[Opinion]** our own reasoning, not a sourced fact.

Copy rule reminder: some quoted source text contains em dashes (for example Shopify's default
`# Agent Instructions — StoreName`). Quote them only as data. Never use an em dash in our own copy.

---

## 0. The 12 facts most likely to change what we build

1. **Google stopped showing FAQ rich results on 7 May 2026** and removed the FAQ docs on 15 June 2026.
   Before that (since Sept 2023) they only showed for "well-known, authoritative" government or health sites.
   [Primary] https://developers.google.com/search/updates (entries 8 May 2026, 15 Jun 2026, 14 Sep 2023)
2. **Every Shopify store now serves `/llms.txt`, `/llms-full.txt` and `/agents.md` by default** (changelog
   28 May 2026). The default file is Shopify's agent-instructions document, not a llmstxt.org-style link
   list. Merchants override it with theme templates. [Primary] https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd
3. **Shopify's 2026 default robots.txt blocks no AI bot** and now points agents to `/agents.md` and UCP in its
   comments. [Observed] https://theme-horizon-demo.myshopify.com/robots.txt
4. **ChatGPT already gets Shopify product data through Shopify Catalog.** OpenAI: "For merchants on Shopify,
   product data is already integrated into ChatGPT through Shopify Catalog ... No additional work is required
   from individual merchants." [Primary] https://help.openai.com/en/articles/11128490-shopping-in-chatgpt
5. **ChatGPT search partners with Microsoft (Bing) and Shopify as search providers** (OpenAI names their
   privacy policies under "Information shared with search providers"). So Bingbot matters for ChatGPT too.
   [Primary] https://help.openai.com/en/articles/9237897-chatgpt-search
6. **New AI crawlers since robots.ts was written:** Meta-WebIndexer (Meta AI search citations), Amzn-SearchBot
   and Amzn-User (Alexa), MistralAI-Index and MistralAI-Training (Mistral), Google-Agent (Google's
   user-triggered agent), Google-GeminiNotebook (was Google-NotebookLM). Details in section 1.
7. **Applebot obeys Googlebot rules when robots.txt doesn't name Applebot**, and Amzn-SearchBot obeys "other
   search bots" rules when not named. Our parser only falls back to `*`. See corrections in 1.4.
8. **Google has a second switch besides robots.txt:** Search Console > Settings > Search generative AI
   (worldwide since 31 Aug 2026, default "Include"). A site set to "Exclude" won't appear in AI Overviews or
   AI Mode even if robots.txt allows Googlebot. robots.txt can't show this. [Primary] https://support.google.com/webmasters/answer/16908024
9. **llmstxt.org published v2 of the spec in August 2026**: optional BOM, files allowed at any path, `.md` page
   versions in two URL forms, `rel="alternate"` / `rel="describedby"` link relations, and the "Optional"
   section lost its special meaning. `llms-full.txt` is not part of the llmstxt.org spec. [Primary] https://llmstxt.org/ and https://llmstxt.org/changes.html
10. **Google says llms.txt has no effect on Google Search**, positive or negative (15 Jun 2026). Chrome
    Lighthouse's llms.txt audit only fails on a server error; a 404 is "Not Applicable". [Primary] https://developers.google.com/search/updates and https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt
11. **AI Overviews rarely show for shopping searches**: 3.2% of "Shopping" category keywords in Ahrefs' study of
    146M desktop SERPs (Sept 2025 data). [Study] https://ahrefs.com/blog/ai-overview-triggers/
12. **AI text detectors can't prove who wrote short text.** OpenAI withdrew its classifier on 20 Jul 2023 for low
    accuracy and called classifiers "very unreliable on short texts (below 1,000 characters)". 2026 tests show
    good detectors rarely flag human writing on ~500-word passages but miss 10% to 18% of AI text that imitates
    a real author. [Primary] + [Study] (section 5)

---

## 1. AI crawlers and fetchers (for the AI Crawler Checker)

### 1.1 What the four kinds of bot do

- **Search / answer index bots** decide whether a page can be shown or cited in that company's AI answers.
  Blocking them hides you. Examples: OAI-SearchBot, PerplexityBot, Claude-SearchBot, Googlebot, Bingbot,
  Applebot, Meta-WebIndexer, Amzn-SearchBot, DuckAssistBot, MistralAI-Index.
- **Training bots** collect pages for model training. Blocking them does not remove you from that company's
  live answers (per each company's docs). Examples: GPTBot, ClaudeBot, Applebot-Extended (a control token,
  not a crawler), MistralAI-Training, CCBot, Amazonbot (training and "improve products").
- **User-triggered fetchers** open one page because a person asked. Several say robots.txt may not apply.
  Examples: ChatGPT-User, Perplexity-User, Claude-User (this one does honour robots.txt), Meta-ExternalFetcher,
  Amzn-User, MistralAI-User, Google-Agent.
- **Control tokens with no crawler of their own:** Google-Extended (uses normal Google crawlers) and
  Applebot-Extended (uses Applebot's crawl).

### 1.2 The full table

"Hides you from AI answers?" means: does a robots.txt block on this token stop that company from showing or
citing your pages in its AI answers, according to its own docs.

| Token (robots.txt) | Owner | Job | Hides you from that company's AI answers if blocked? | Respects robots.txt (per docs) | Official docs | Published IP list |
|---|---|---|---|---|---|---|
| `OAI-SearchBot` | OpenAI | Search index for ChatGPT search | **Yes.** "Sites that are opted out of OAI-SearchBot will not be shown in ChatGPT search answers, though can still appear as navigational links." Changes take "~24 hours". | Yes (opt-out via robots.txt) | https://developers.openai.com/api/docs/bots | https://openai.com/searchbot.json |
| `GPTBot` | OpenAI | Training | **No.** "Disallowing GPTBot indicates a site's content should not be used in training generative AI foundation models." | Yes | same | https://openai.com/gptbot.json |
| `ChatGPT-User` | OpenAI | Fetch on a user's request (incl. Custom GPTs, GPT Actions) | No. "ChatGPT-User is not used to determine whether content may appear in Search." | **May not.** "Because these actions are initiated by a user, robots.txt rules may not apply." | same | https://openai.com/chatgpt-user.json |
| `OAI-AdsBot` | OpenAI | Checks landing pages submitted as ChatGPT ads | No. "Only visits pages submitted as ads"; data "not used to train". | Not stated | same | https://openai.com/adsbot.json |
| `Claude-SearchBot` | Anthropic | Search index for Claude | **Yes (reduces).** Blocking "prevents our system from indexing your content for search optimization" and "may also reduce visibility in user search results". | Yes, all Anthropic bots honour robots.txt; Crawl-delay supported | https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler (dated 7 Apr 2026) | https://claude.com/crawling/bots.json |
| `Claude-User` | Anthropic | Fetch on a user's request | **Yes.** Blocking "prevents our system from retrieving your content in response to a user query." | **Yes** (unlike OpenAI and Perplexity user fetchers) | same | same |
| `ClaudeBot` | Anthropic | Training | No. Blocking means "future materials should be excluded from our AI model training datasets." | Yes | same | same |
| `PerplexityBot` | Perplexity | Search index for Perplexity | **Yes.** "designed to surface and link websites in search results on Perplexity. It is not used to crawl content for AI foundation models." | Yes (recommends allowing it and its IPs) | https://docs.perplexity.ai/guides/bots | https://www.perplexity.com/perplexitybot.json |
| `Perplexity-User` | Perplexity | Fetch on a user's request | No (not a crawler) | **Generally no.** "this fetcher generally ignores robots.txt rules." | same | https://www.perplexity.com/perplexity-user.json |
| `Googlebot` | Google | Google Search index; AI Overviews and AI Mode use the Search index | **Yes.** Googlebot rules affect "Google Search (including Discover and all Google Search features)". AI features need a page "indexed and eligible to be shown in Google Search with a snippet". | Yes, common crawlers "always obey robots.txt rules when crawling automatically" | https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers (updated 14 Jul 2026); https://developers.google.com/search/docs/appearance/ai-features | https://developers.google.com/static/crawling/ipranges/common-crawlers.json |
| `Google-Extended` | Google | Control token (no own user agent) for Gemini training **and** grounding in Gemini Apps and Vertex AI | **Gemini app: yes** (it controls "grounding ... in Gemini Apps"). **Google Search / AI Overviews: no.** "Google-Extended does not impact a site's inclusion in Google Search nor is it used as a ranking signal." | It is a robots.txt control | same | n/a (uses Google's crawlers) |
| `Storebot-Google` | Google | Google Shopping crawler | Affects "all surfaces of Google Shopping (for example, the Shopping tab in Google Search and Google Shopping)". Relevant to stores. | Yes (common crawler) | same | common-crawlers.json |
| `Google-CloudVertexBot` | Google | Crawls a site only when its owner builds a Vertex AI Agent | No. "It has no effect on Google Search or other products." Tokens: `Google-CloudVertexBot`, `Googlebot`. | Yes (common crawler) | same | common-crawlers.json |
| `Google-Agent` (user agent; not a robots.txt control) | Google | "used by agents hosted on Google infrastructure to navigate the web and perform actions upon user request" | n/a | **Generally no.** User-triggered fetchers "generally ignore robots.txt rules." | https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers (updated 19 Aug 2026) | https://developers.google.com/static/crawling/ipranges/user-triggered-agents.json |
| `Google-GeminiNotebook` (former `Google-NotebookLM`, "supported until August 2026") | Google | Fetches URLs a Gemini Notebook user added as sources | n/a | Generally no (user-triggered) | same | user-triggered-fetchers.json / user-triggered-fetchers-google.json |
| `Bingbot` | Microsoft | Bing index. Copilot answers come from it, and Microsoft is one of ChatGPT search's providers | **Yes for Copilot** ("Powered by Bing's search index, experiences like Microsoft Copilot ..."). Partly for ChatGPT (how much ChatGPT uses Bing is not published). | Yes (Bing says use robots.txt to control its crawlers) | https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0 ; https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers | Verify tool: https://www.bing.com/webmasters/verifybingbot . JSON `https://www.bing.com/toolbox/bingbot.json` is UNVERIFIED (not fetched) |
| `Applebot` | Apple | Search for Spotlight, Siri, Safari; also gives "up-to-date content when AI models are used to generate output", e.g. Siri and Search "broad world knowledge" answers with links | **Yes.** Allowing it "allows website content to appear in search results for Apple users". `nosnippet` opts a page out of the AI answers only. | Yes. **"If robots instructions don't mention Applebot but mention Googlebot, the Apple robot will follow Googlebot instructions."** Ignores crawl-delay. | https://support.apple.com/en-us/119829 (published 4 Sep 2026) | http://search.developer.apple.com/applebot.json |
| `Applebot-Extended` | Apple | Control token: training of Apple foundation models | No. "Applebot-Extended does not crawl webpages. Webpages that disallow Applebot-Extended can still be included in search results." | It is a robots.txt control | same | n/a |
| `Meta-WebIndexer` (UA `meta-webindexer/1.1`) | Meta | **New.** "navigates the web to improve Meta AI search result quality ... Allowing Meta-WebIndexer in your robots.txt file helps us cite and link to your content in Meta AI's responses." | **Yes (implied by Meta's wording)** | Yes (robots.txt is Meta's stated control; robots.txt cached up to 24 hours) | https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers.md | Not published on the page (UNVERIFIED) |
| `meta-externalagent` | Meta | "training foundation AI models or improving products by indexing content directly" | Mixed purpose. Not stated that blocking hides you from Meta AI. Treat as training-type. | Yes | same | same |
| `meta-externalfetcher` | Meta | Fetch on a user's request, incl. AI agents completing tasks | n/a | **May bypass** robots.txt | same | same |
| `meta-externalads` | Meta | Ads and business products | No | Yes | same | same |
| `facebookexternalhit` | Meta | Link previews when a URL is shared on Facebook, Instagram, Messenger | No | "might bypass robots.txt when performing security or integrity checks" | same | same |
| `Amzn-SearchBot` | Amazon | **New.** Search experiences "such as Alexa"; "does not crawl content for generative AI model training" | **Yes.** "By permitting Amzn-SearchBot access to your website, your content is eligible to appear in search experiences such as Alexa." **If not named, it follows the rules you gave other search bots.** | Yes (REP); no crawl-delay | https://developer.amazon.com/amazonbot | https://developer.amazon.com/amazonbot/searchbot-ip-addresses/ |
| `Amazonbot` | Amazon | "improve our products and services ... may be used to train Amazon AI models" | No for Alexa search (that is Amzn-SearchBot) | Yes (REP); reads robots.txt "or use a cached copy from the last 30 days"; changes "may take ~24 hours" | same | https://developer.amazon.com/amazonbot/ip-addresses/ |
| `Amzn-User` | Amazon | Live fetch for Alexa questions on a user's behalf; not training | n/a | "may not follow all robots.txt directives" | same | https://developer.amazon.com/amazonbot/live-ip-addresses/ |
| `DuckAssistBot` | DuckDuckGo | Real-time crawl for DuckDuckGo's AI-assisted answers; "not used in any way to train AI models" | **Yes for AI answers only.** Opting out "does not impact organic search rankings". Takes effect "after 72 hours". | Yes | https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot (undated) | https://duckduckgo.com/duckassistbot.json |
| `MistralAI-Index` | Mistral | **New.** "indexes content for Mistral search, which helps answer user questions in Vibe"; not used for training | Yes (implied) | Not explicitly stated (UNVERIFIED) | https://docs.mistral.ai/robots | Page lists "All published IP addresses" but the link was not captured (UNVERIFIED) |
| `MistralAI-User` | Mistral | Fetch on a user's request in Vibe; not automatic crawling, not training | n/a | Implied ("governs which sites these user requests can be made to") | same | same |
| `MistralAI-Training` | Mistral | **New.** Training datasets; "not used for search indexing or to answer live user queries" | No | "Webmasters can disallow this user agent" | same | same |
| `CCBot` | Common Crawl (non-profit) | Open web archive widely used to build AI training sets | No direct AI answer product | Yes; obeys Crawl-delay; no JavaScript | https://commoncrawl.org/faq (IPs "as of 2026-08-11") | https://index.commoncrawl.org/ccbot.json |
| `Bytespider` | ByteDance | Reported as training/data crawler | Unknown | **UNVERIFIED.** No primary ByteDance page found; third-party reports of non-compliance | none found | none found |
| xAI / Grok bots | xAI | Unknown | Unknown | **UNVERIFIED.** No official xAI crawler docs found; third-party directories disagree on token names | none found | none found |

Other notes:
- OpenAI: "If your site has allowed both bots, we may use the results from just one crawl for both use cases."
  OpenAI also asks sites to allow its published IP ranges at the host or CDN. [Primary, OpenAI bots page]
- OpenAI help: "To make a website eligible for inclusion, allow OAI-Searchbot to crawl the site and confirm that
  the website host or content delivery network allows traffic from OpenAI's published searchbot IP addresses."
  [Primary] https://help.openai.com/en/articles/9237897-chatgpt-search
- Perplexity docs give Cloudflare and AWS WAF allow-rule steps for its bots. [Primary, Perplexity bots page]
- Google: "Some crawlers have more than one user agent token; you need to match only one crawler token for a
  rule to apply." [Primary, common crawlers page]
- Deprecated Anthropic tokens `anthropic-ai` and `Claude-Web`: not mentioned on Anthropic's current page.
  Status UNVERIFIED. Don't list them as active.

### 1.3 Shopify robots.txt in 2026 [Observed]

- **New default (seen on Shopify's Horizon demo store, 11 Oct 2026):** starts with comments
  `# Shopify storefront. Public product, collection, page, blog, policy, cart, and localized HTML is crawlable.`
  and `# Agent instructions: https://<store>/agents.md`, UCP discovery and MCP endpoint lines, and a request that
  agents not complete checkout without human approval. Then one `User-agent: *` group (Allow `/`, Disallow
  `/admin`, `/cart/`, `/checkout`, `/checkouts/`, `/orders`, `/account`, filter and sort traps, `/services`,
  `/sf_*`, `/cart.js`, `/recommendations/products`) and one `User-agent: adsbot-google` group, plus `Sitemap:`.
  **No AI bot is named or blocked.** The old `/products/*-[a-f0-9]...-remote` lines are **not** in this new default.
  https://theme-horizon-demo.myshopify.com/robots.txt
- **Older or customised files are still common:** a large Shopify brand checked today still serves the older
  layout (with the `-remote` lines, `Nutch`, `AhrefsBot`, `MJ12bot`, `Pinterest` groups) and has added its own
  `User-agent: Amazonbot / Disallow: /` (plus `AmazonAdBot`, `AmazonProductDiscoverybot`). So real stores do
  block AI-related bots by editing `robots.txt.liquid`. (Store not named here: house rule, no store named without consent.)
- Merchants edit robots.txt through the theme template `robots.txt.liquid` (already in `ROBOTS_FIX`).

### 1.4 Comparison with `app/lib/robots.ts` `AI_BOTS`: corrections

What is right today: all 11 entries match the owners' docs (OAI-SearchBot, PerplexityBot, Claude-SearchBot,
Claude-User, Google-Extended, Bingbot, ChatGPT-User, Perplexity-User, GPTBot, ClaudeBot, Googlebot). The rule
"never say a training-only bot hides a store from answers" is correct.

Corrections and additions, in priority order:

1. **Fallback logic (real bug for two bots).** `rulesFor()` falls back only to `*`. Per Apple, Applebot follows
   the `Googlebot` group when no `Applebot` group exists. Per Amazon, Amzn-SearchBot follows the rules given to
   "other search bots" when not named (which bots count is not defined; treating `Googlebot`/`Bingbot` groups as
   that is an [Opinion]). Add an optional per-bot fallback chain, e.g. `Applebot -> Googlebot -> *`.
2. **Add `Applebot`** (level medium: Siri, Spotlight, Safari and Apple's AI answers) and **`Applebot-Extended`**
   (info: training only, "does not crawl webpages").
3. **Add `Meta-WebIndexer`** (level medium: Meta AI search citations, new) and **`meta-externalagent`** (info:
   training "or improving products by indexing content directly"; don't claim it hides you).
4. **Add `Amzn-SearchBot`** (medium: Alexa search) and **`Amazonbot`** (info: products and training). Note that
   blocking Amazonbot does not block Amzn-SearchBot.
5. **Add `DuckAssistBot`** (medium or info: DuckDuckGo AI answers only; organic results unaffected; 72 hours).
6. **Consider `Storebot-Google`** (medium for stores: all Google Shopping surfaces).
7. **Optional info-level tokens:** `CCBot`, `MistralAI-Index`, `MistralAI-User`, `MistralAI-Training`,
   `meta-externalfetcher`, `Amzn-User`, `OAI-AdsBot`. Don't add `Bytespider` or any xAI token as fact (UNVERIFIED).
8. **Copy tweaks to existing `what` lines:**
   - OAI-SearchBot: can add "OpenAI says changes take about 24 hours" and "blocked sites can still appear as
     navigational links".
   - Googlebot: add that Search Console's "Search generative AI" control (default Include) can also exclude a
     site from AI Overviews and AI Mode, which robots.txt can't show.
   - Google-Extended: fine as written. Optional: "It has no crawler of its own; it's a setting in robots.txt."
   - Bingbot: can add "ChatGPT search also uses Microsoft as a search provider". Consider raising to critical
     ([Opinion], since Copilot and part of ChatGPT depend on it).
9. **Outdated comment:** the header comment says Shopify's default has the `-remote` lines. The 2026 default
   doesn't (1.3). Not a logic bug.
10. `Google-Agent` and other user-triggered Google fetchers "generally ignore robots.txt": mention in copy only;
    a robots.txt check can't control them.

---

## 2. Google structured data for products (for the Product Schema Checker)

### 2.1 Two Google experiences [Primary]

- **Product snippet**: "a text result that includes additional product information such as ratings, review
  information, price, and availability." For product pages, review pages and shopping aggregators.
  https://developers.google.com/search/docs/appearance/structured-data/product-snippet (updated 8 Sep 2026)
- **Merchant listing**: for pages "where a shopper can purchase a product". Eligible for "the shopping knowledge
  panel, Google Images, popular product results, and product snippets", and can show "price, availability, and
  shipping and return information".
  https://developers.google.com/search/docs/appearance/structured-data/merchant-listing (updated 8 Sep 2026)
- Search Console has two reports: **Merchant listings** (pages where shoppers can buy) and **Product snippets**
  (other product pages). A store's product page belongs in merchant listings.

### 2.2 Required and recommended properties [Primary]

**Merchant listing (use this for Shopify product pages)**

| Type | Required | Recommended |
|---|---|---|
| `Product` | `name`, `image`, `offers` | `aggregateRating`, `audience`, `brand.name`, `category`, `color`, `description`, `gtin` / `gtin8` / `gtin12` / `gtin13` / `gtin14` / `isbn`, `hasAdultConsideration`, `hasCertification`, `inProductGroupWithID`, `isVariantOf`, `material`, `mpn`, `pattern`, `review`, `size`, `sku`, `subjectOf` |
| `Offer` | `price` (or `priceSpecification.price`), `priceCurrency` (or `priceSpecification.priceCurrency`) | `availability`, `hasMerchantReturnPolicy`, `itemCondition`, `priceValidUntil`, `shippingDetails`, `url`, `validFrom`, `validThrough` |
| `OfferShippingDetails` (optional; these are required only if you add it) | `deliveryTime`, `shippingDestination`, `shippingRate`, `shippingRate.currency`, `shippingRate.value` or `shippingRate.maxValue` | |
| `ShippingDeliveryTime` | | `handlingTime`, `transitTime` (each a `QuantitativeValue` needing `minValue`, `maxValue`, `unitCode`) |
| `DefinedRegion` | `addressCountry` | `addressRegion` or `postalCode` |
| `MerchantReturnPolicy` | `applicableCountry`, `returnPolicyCategory` | `merchantReturnDays`, `returnFees`, `returnMethod`, `returnShippingFeesAmount` |
| `PeopleAudience` | | `suggestedGender`, `suggestedMinAge`, `suggestedMaxAge` |
| `SizeSpecification` | | `name`, `sizeGroup`, `sizeSystem` |
| `Certification` | `issuedBy`, `name` | `certificationIdentification`, `certificationRating` |

Notes from the same page:
- `sku`: "Specify at most one value", no whitespace, ASCII recommended.
- "Product rich results only support pages that focus on a single product (or multiple variants of the same
  product)." Collection pages don't qualify.
- "When offering products for sale in multiple currencies, have a distinct URL per currency."
- "we recommend putting `Product` structured data in the initial HTML for best results." JavaScript-generated
  markup "can make Shopping crawls less frequent and less reliable". **Checker should read the raw HTML, not a
  rendered DOM, and say so.**
- Changes this year: `Product.category` accepts text or a Google category code (7 Jul 2026); sale price dates via
  `validFrom` / `validThrough` / `priceValidUntil` (7 Jul 2026); `hasAdultConsideration` added (20 May 2026).
  [Primary] https://developers.google.com/search/updates

**Product snippet (non-store pages)**: `Product.name` required, plus at least one of `review`,
`aggregateRating` or `offers`. `Offer`: `price` required; `availability`, `priceCurrency`, `priceValidUntil`
recommended. `AggregateOffer`: `lowPrice`, `priceCurrency` required. Pros and cons markup is only for
editorial review pages, "not merchant product pages or customer product reviews".

**Product variants** https://developers.google.com/search/docs/appearance/structured-data/product-variants (updated 8 Sep 2026)
- `ProductGroup` required: `name`. Recommended: `aggregateRating`, `brand`, `brand.name`, `description`,
  `hasAdultConsideration`, `hasVariant`, `productGroupID`, `review`, `url` (single-page sites), `variesBy`.
- Rules: each variant needs a unique ID (`sku` or `gtin`); each group needs a unique ID (`productGroupID`
  or `inProductGroupWithID`); also follow the merchant listing required properties for each variant; each
  variant must be pre-selectable by its own URL (query parameter).

**Ratings honesty**: Google added a review snippet guideline about "fake and undisclosed incentivized reviews"
(24 Jul 2026). [Primary] https://developers.google.com/search/updates. Never suggest adding ratings markup
without real reviews shown on the page.

### 2.3 Store-wide shipping and returns markup [Primary]

- **Organization-level return policy** supported since **11 Jun 2024**; **merchant-level shipping policy markup**
  (`hasShippingService` on the Organization) supported since **12 Nov 2025**; return policy docs moved to their
  own page on 10 Jun 2025. Search Console shipping and return settings exist since July 2024.
  https://developers.google.com/search/updates
- Put it on the home page or one "about" page; "You don't need to include it on every page". Use the
  `OnlineStore` subtype for ecommerce. No required properties for Organization.
  https://developers.google.com/search/docs/appearance/structured-data/organization (updated 8 Sep 2026)
- Precedence, strongest first: Merchant Center product feeds, Content API settings, Merchant Center or Search
  Console settings, **product-level markup**, **organization-level markup**. [Primary, merchant listing page]
- **Checker logic** [Opinion]: if a product page lacks `shippingDetails` / `hasMerchantReturnPolicy`, say "not on
  this page" rather than "missing", because the store may set them at Organization level or in Merchant Center.

### 2.4 What Shopify themes output by default

- **The `structured_data` Liquid filter**: "Product objects are output as a schema.org `Product` if they have no
  variants, and a `ProductGroup` if they have one or more variants." Doc example output: `@id`, `brand`
  (Brand name), `category`, `description`, `image`, `name`, `offers` (`availability`, `price`, `priceCurrency`,
  `url`), `url`. [Primary] https://shopify.dev/docs/api/liquid/filters/structured_data
- **Dawn** uses it: `sections/main-product.liquid` contains
  `<script type="application/ld+json">{{ product | structured_data }}</script>`. [Observed]
  https://raw.githubusercontent.com/Shopify/dawn/main/sections/main-product.liquid
- **Horizon (live demo, 11 Oct 2026)** outputs [Observed]:
  - `ProductGroup` with `@id`, `brand`, `category` ("Shirts"), `description`, `hasVariant` (24 variants),
    `name`, `productGroupID` (the Shopify product ID), `url`.
  - Each variant: `Product` with `@id`, `gtin` (from the barcode field), `image`, `name` ("Title - Ivory / XS"),
    `sku`, and `offers` (`Offer` with `availability`, `price`, `priceCurrency`, `url`).
  - A separate `Organization` block with only `name` and `url`.
  https://theme-horizon-demo.myshopify.com/products/test-alex-merino-wool-open-placket-polo-324
- **Not in the default output** (so a checker will usually flag them as "not found"): `variesBy`, per-variant
  `color` / `size` / `material`, `aggregateRating`, `review`, `shippingDetails`, `hasMerchantReturnPolicy`,
  `itemCondition`, `priceValidUntil`, `mpn`, `audience`. `gtin` only appears if the merchant filled in the
  barcode. Custom themes vary: one large store checked today showed only an `Organization` block in its HTML.
  [Observed]
- Review apps often inject `aggregateRating` with JavaScript; Google warns JS-generated markup is less reliable
  for Shopping. [Primary for the warning; app behaviour is UNVERIFIED in general]

### 2.5 How much structured data matters for AI answers

- Google: "Structured data isn't required for generative AI search, and there's no special schema.org markup you
  need to add. However, it's a good idea to continue using it ... for rich results." Also: "Making sure your
  structured data matches the visible text on the page." [Primary]
  https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (updated 10 Jul 2026);
  https://developers.google.com/search/docs/appearance/ai-features (updated 10 Dec 2025)
- Google also says Merchant Center feeds and Business Profiles "can help your products and services to be
  visible in both AI responses and other Google Search results". [Primary, AI optimization guide]
- OpenAI: ChatGPT shopping considers "Structured metadata from first-party and third-party providers (e.g.,
  price, product description)" and may consider "available options, price, reviews". Shopify stores feed in
  through Shopify Catalog. [Primary] https://help.openai.com/en/articles/11128490-shopping-in-chatgpt
- Microsoft (Bing): schema "can label your content as a product, review, FAQ, or event, turning plain text
  into structured data that machines can interpret with confidence." [Primary, Microsoft Advertising blog, 8 Oct 2025]
- Ahrefs controlled test (May 2026) found adding JSON-LD gave no measurable lift in AI citations. From
  `docs/tools/research/geo-2026.md`, https://ahrefs.com/blog/schema-ai-citations/ , not re-read for this file.
- **Copy line that is safe** [Opinion based on the above]: "Structured data helps Google and AI shopping tools
  read your price, stock and product facts correctly. It won't get you recommended on its own."

---

## 3. FAQPage (for the FAQ Schema Generator)

### 3.1 Google's policy timeline [Primary]

- Aug 2023: How-to rich results removed and FAQ rich results limited (blog
  https://developers.google.com/search/blog/2023/08/howto-faq-changes ). Docs updated **14 Sep 2023** "to state
  that the feature is only shown for well-known, authoritative government and health websites."
- **8 May 2026**: deprecation notice; "This feature will no longer appear in Google Search starting May 7, 2026."
- **15 Jun 2026**: FAQ documentation removed; "The FAQ rich result feature is no longer shown in Google Search
  results". The old URL now redirects to the changelog.
  All three: https://developers.google.com/search/updates
- So in Oct 2026 **no site gets FAQ rich results in Google**, including government and health sites.

### 3.2 Is the markup still valid and harmless?

- `FAQPage` is still a schema.org type: "A FAQPage is a WebPage presenting one or more 'Frequently asked
  questions' (see also QAPage)." [Primary] https://schema.org/FAQPage
- Google's general rules still apply to any markup: it must match visible content (Google AI features page:
  "Making sure your structured data matches the visible text on the page"). Spammy or hidden markup can get a
  structured data manual action, in which case "the structured data on the page will be ignored (although the
  page can still appear in Google Search results)." [Primary, troubleshooting text on Google's structured data pages]
- No Google statement found that FAQPage markup now harms a page. Treat as **harmless if it matches visible
  text, with no Google display benefit**. [Opinion from the above]
- **Bing**: Microsoft (8 Oct 2025) lists FAQ among schema types that help machines interpret content, and says
  Q&A pairs "can often be lifted word for word into AI-generated responses". Whether Bing shows FAQ rich results
  in 2026: UNVERIFIED. [Primary for the quote]
  https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers
- Microsoft also warns: "Don't hide important answers in tabs or expandable menus: AI systems may not render
  hidden content." (Google's old FAQ rules allowed answers behind an expandable section.) [Primary]

### 3.3 Exact properties (Google's last published version) [Primary]

From Google's FAQ doc as last published (page "Last updated 2025-12-10", archived 1 Mar 2026):
https://web.archive.org/web/20260301000000id_/https://developers.google.com/search/docs/appearance/structured-data/faqpage

| Type | Required |
|---|---|
| `FAQPage` | `mainEntity` (array of `Question`). "There must be one `FAQPage` type definition per page." |
| `Question` | `name` (full question text), `acceptedAnswer` |
| `Answer` | `text` (full answer text; Google's own example includes simple HTML such as `<p>`) |

Old content rules worth keeping in the generator:
- Only for pages where each question has a single answer written by the site (user-submitted answers = `QAPage`).
- "Don't use `FAQPage` for advertising purposes."
- "Make sure each `Question` includes the entire text of the question and make sure each `Answer` includes the
  entire text of the answer."
- "All `FAQ` content must be visible to the user on the source page."
- "If you have FAQ content that is repetitive on your site ... mark up only one instance of that FAQ for your
  entire site."

Minimal valid output:
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How long does shipping take?",
      "acceptedAnswer": { "@type": "Answer", "text": "Orders ship in 1 to 2 business days." }
    }
  ]
}
```
Wrap in `<script type="application/ld+json">`. [Opinion, engineering] Escape `</` inside strings (for example
output `<\/script>`) so pasted answers can't break the tag.

### 3.4 Adding FAQ JSON-LD on Shopify

- Theme code: add the script to a section or snippet in Online Store > Themes > Edit code (same path Shopify
  documents for other templates). [Primary for the editor path, e.g. the agents.md doc below]
- Theme app extension block: our app already ships an FAQ theme block (CLAUDE.md, build status). An app block
  can render Liquid, including JSON-LD, from product metafields. [Internal]
- Product metafields + Liquid: store Q&A in metafields and render both visible HTML and JSON-LD from the same
  data, so the two always match. [Opinion, best practice]
- Pasting a `<script>` into the product description editor: behaviour UNVERIFIED; don't recommend it.
- Evidence on FAQ sections and AI citations is weak and mixed (SE Ranking correlation, via geo-2026.md,
  Secondary). Copy should say FAQs help shoppers and AI tools read clear answers, not promise citations.

---

## 4. llms.txt (for the llms.txt Checker)

### 4.1 The llmstxt.org spec, v2 (August 2026) [Primary]

https://llmstxt.org/ and https://llmstxt.org/changes.html (v2 dated August 2026; v1 was September 2024)

- File named `llms.txt`, "at the root path `/llms.txt` of a website or at any subpath (e.g. `/docs/llms.txt`)".
  "A file covers the URLs under its path, and where more than one file applies, agents should use the most
  specific one."
- Sections, **in this order**:
  1. "An optional byte-order mark (BOM)"
  2. "An H1 with the name of the project or site. **This is the only required section**"
  3. "A blockquote with a short summary of the project, containing key information necessary for understanding
     the rest of the file"
  4. "Zero or more markdown sections (e.g. paragraphs, lists, etc) of any type except headings"
  5. "Zero or more markdown sections delimited by H2 headers, containing 'file lists' of URLs"
     - "Each 'file list' is a markdown list, containing a required markdown hyperlink `[name](url)`, then
       optionally a `:` and notes about the file."
- "Optional" H2: "used, by convention, for secondary information: links an agent can skip when a shorter
  context is needed." In v2 it "no longer carr[ies] mechanical semantics".
- `.md` versions of pages: "either with `.md` appended (`page.html.md`) or with the extension replaced by `.md`
  (`page.md`)". URLs without a file name use `index.html.md` or `index.md`.
- Discovery (new in v2): `rel="alternate" type="text/markdown"` for a page's markdown version and
  `rel="describedby"` for the llms.txt covering it, as `<link>` elements or an HTTP `Link:` header.
- v2 dropped the `llms_txt2ctx` context-expansion tool from the proposal.
- **`llms-full.txt` is not defined in the llmstxt.org spec.** It is a convention (Shopify serves it; who started it
  is UNVERIFIED). A checker should report it as "extra, not part of the standard".
- The spec says files are "most heavily" used "for software documentation, where coding agents follow them".

**Checker rules that follow from the spec** [derived]:
- Fail: no file (404) or the response is HTML, not markdown/text.
- Fail: first non-BOM, non-blank line is not an H1 (`# `).
- Warn: no blockquote (`> `) right after the H1 (recommended, not required).
- Warn: a heading other than H1/H2 appears before the first H2, or more than one H1.
- Warn: an H2 section has list items without a `[name](url)` link.
- Info: links not pointing at markdown (`.md`) versions.
- Info: `llms-full.txt` present or missing (neither is an error).

### 4.2 Who says they read it

- **Google Search**: "You don't need to create new machine readable files, AI text files, markup, or Markdown to
  appear in Google Search (including its generative AI capabilities), as Google Search itself doesn't use them."
  [Primary] https://developers.google.com/search/docs/fundamentals/ai-optimization-guide (updated 10 Jul 2026)
- **Google changelog, 15 Jun 2026**: llms.txt files "aren't needed for Google Search (and won't negatively or
  positively impact your visibility or rankings), it's fine if you want to maintain these files for other
  services or systems that use them." [Primary] https://developers.google.com/search/updates
- **Chrome Lighthouse** (experimental Agentic Browsing audit, page updated 5 May 2026): flags a page only "if a
  server error occurs when attempting to retrieve the `llms.txt` file. If the file is not provided by the server
  (resulting in a 404), the audit is marked as Not Applicable (N/A)". It does not grade the content.
  [Primary] https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt
- **John Mueller (Google)**: called llms.txt "not done for search" and a "temporary crutch, perhaps to save some
  tokens" for AI coding tools (LinkedIn, quoted by Ahrefs, Jun 2026). Earlier (2025, Bluesky) compared it to the
  keywords meta tag. [Secondary] https://ahrefs.com/blog/llmstxt-study/ ;
  https://www.searchenginejournal.com/google-says-llms-txt-comparable-to-keywords-meta-tag/544804/
- **Gary Illyes (Google)**: no primary statement found. UNVERIFIED.
- **OpenAI, Anthropic, Perplexity**: no public statement found that their answer or search products read
  llms.txt. UNVERIFIED (absence of evidence). All three publish llms.txt for their developer docs (OpenAI docs
  pages say "For the complete documentation index, see llms.txt"; Perplexity docs say "Fetch the complete
  documentation index at: /llms.txt"). [Observed, 11 Oct 2026]
- **Ahrefs server-log study** (137,210 domains, May 2026 traffic, published 15 Jun 2026) [Study]:
  - 28% of domains publish llms.txt (upper bound; technical sample).
  - 97% of those files got zero requests in May 2026.
  - 96% of requests that did happen came from bots.
  - Named AI bots made 19.5% of requests (GPTBot top, Claude-Code second). "AI retrieval bots barely register,
    with 1.1% of total requests". Slackbot fetched llms.txt more often than PerplexityBot.
  - "Zero requests came from AI bots for llms.txt files that don't exist."
  - Lighthouse made about 1 in 1,000 fetches.
  https://ahrefs.com/blog/llmstxt-study/

### 4.3 Shopify and llms.txt in 2026

**Official** [Primary]
- Changelog **28 May 2026** (effective 29 May): "Your store includes a default `agents.md` file accessible at
  `/agents.md`. The paths `/llms.txt` and `/llms-full.txt` also point to this content by default."
  https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd
- Lookup order: `/agents.md` -> `agents.md.liquid` -> Shopify default. `/llms.txt` -> `llms.txt.liquid` ->
  `agents.md.liquid` -> default. `/llms-full.txt` -> `llms-full.txt.liquid` -> `agents.md.liquid` -> default.
  https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid
- Where to edit: Online Store > Themes > ... > Edit code > Templates > New file (`agents.md.liquid`,
  `llms.txt.liquid` or `llms-full.txt.liquid`). Can't be a JSON template.
- `agents.md.liquid` renders with a "restricted Liquid context": the `agents` object (`store_name`, `store_url`,
  `ucp_discovery_url`, `mcp_endpoint_url`, `ucp_versions`, `currency`, `sitemap_url`); standard objects like
  `shop`, `collections`, `pages` "render blank". (The doc says "Only two objects are available" but lists only
  `agents`; the second is UNVERIFIED.) Shopify recommends keeping the managed default "for most stores".
- Served at the bare primary domain only, no locale or Markets subfolder version.
- Shopify's default "deliberately omits contact details because the file is broadly cached".

**Timeline from the Shopify developer forum** [Primary staff post + Secondary community posts]
https://community.shopify.dev/t/llms-txt-and-agents-md/34049 (read via /raw/34049)
- 8 May 2026: developers notice native `/llms.txt` and `/agents.md`; old app-proxy and URL-redirect setups stop working.
- 20 May 2026: `/llms.txt` and `/llms-full.txt` redirect to `/agents.md`. Shopify staff (Liam-Shopify): "The
  redirect from `/llms.txt` to `/agents.md` is expected. Shopify now uses `/agents.md` as the primary storefront
  discovery file for agentic and AI experiences". He points merchants who want to shape AI shopping data to
  "Shopify Catalog Mapping" (https://help.shopify.com/en/manual/promoting-marketing/seo/shopify-catalog/default-listing).
- 27 May 2026: community reports `llms.txt.liquid` / `llms-full.txt.liquid` templates work again; changelog posted 28 May.
- A community member (not staff) says apps would need the `write_themes` scope, which needs an exemption, to
  edit these templates. UNVERIFIED.
- The "community proposal" quote from a Shopify staff member (Mar 2026) could not be found. UNVERIFIED. It is
  superseded anyway by the May 2026 changes.

**Live survey of `/llms.txt` on Shopify stores** [Observed, 11 Oct 2026]

| Store | Result | First line |
|---|---|---|
| allbirds.com | 200, Shopify default (content read) | `# Agent Instructions — Allbirds` |
| kyliecosmetics.com | 200, Shopify default (content read) | `# Agent Instructions — Kylie Cosmetics` |
| deathwishcoffee.com | 200, Shopify default (content read) | `# Agent Instructions — Death Wish Coffee` |
| beardbrand.com | 200, Shopify default (content read) | `# Agent Instructions — Beardbrand` |
| ugmonk.com | Served a ~4.4 KB markdown file, size matching the default; content not read | (inferred default) |
| frankbody.com | Same, ~4.5 KB | (inferred default) |
| brooklinen.com | Same, ~4.4 KB | (inferred default) |
| gymshark.com | **404** (origin status 404) | none. Likely a headless storefront, where Shopify's theme routes don't apply (inference, UNVERIFIED) |

Status note: the scraping service reported content for the first four but no raw HTTP code; "200" is inferred
from a full markdown body being returned. Gymshark's 404 is the origin status reported by the scraper.

**What the Shopify default contains** (identical apart from store name, URLs and policy list):
- H1 `# Agent Instructions — {Store name}`, then a plain paragraph (no `>` blockquote).
- H2 sections: "For Personal Shopping Assistants and Agents Acting On Behalf of a User" (recommends installing
  `https://shop.app/SKILL.md`), "Commerce Protocol (UCP)" with discovery `GET /.well-known/ucp` and MCP endpoint
  `POST /api/ucp/mcp`, supported UCP versions (`2026-08-25`, `2026-04-08`, `2026-01-23`), "Read-Only Browsing"
  (`/collections/all`, `/products/{handle}`, `/products/{handle}.json`, `/collections/{handle}/products.json`,
  `/search?q=`), "Store Metadata" (sitemap; says "You're reading `/llms.txt`, which mirrors that content"), "Store
  Policies" (privacy, terms, refund, and shipping if set), "Platform" (Shopify links).
- Against llmstxt.org: **passes** the only hard rule (H1). **No blockquote summary.** H2 sections are mostly
  instructions, not `[name](url): notes` link lists. **No product, collection or guide links.**
- **Checker logic** [Opinion]: detect the default (H1 starts with `# Agent Instructions —` and mentions
  `shop.app/SKILL.md` / `/.well-known/ucp`) and say "This is Shopify's automatic file. It's fine to leave. It
  doesn't list your products or guides." Don't call it broken.

---

## 5. AI text detection and "does my product copy sound like a bot?" (for the AI Bot Checker)

### 5.1 Reliability evidence

- **OpenAI classifier** (launched 31 Jan 2023, withdrawn **20 Jul 2023**: "no longer available due to its low rate
  of accuracy"). It identified 26% of AI-written text and wrongly flagged human text 9% of the time; "very
  unreliable on short texts (below 1,000 characters)"; "Sometimes human-written text will be incorrectly but
  confidently labeled as AI-written"; "AI-written text can be edited to evade the classifier." [Primary]
  https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/
- **Liang et al., Stanford** (Patterns, 2023; arXiv v3 10 Jul 2023): 7 detectors tested in March 2023 on 91 TOEFL
  essays by non-native writers: average false positive rate **61.22%**; 89 of 91 essays flagged by at least one
  detector; near-perfect on US 8th-grade essays. Simple rewording prompts cut detection of AI essays from 100% to
  13%. Small sample; mostly GPT-2-based detectors. [Study] https://arxiv.org/abs/2304.02819
- **Epoch AI** (data dated 16 Jul 2026; detector versions pinned June 2026): Pangram, GPTZero, Originality.ai on
  ~500-word passages. Human text: Pangram 0/495 and GPTZero 0/495 flagged; Originality.ai 19/495 (3.8%). AI text
  from a basic prompt: almost all caught (at most 0.7% missed). AI text imitating a real author: 10.1%, 10.8% and
  17.9% missed; scientific writing worst (~26% missed). [Study]
  https://epoch.ai/data-insights/ai-detectors-false-negatives
- Other 2026 results seen only in summaries (University of Florida false positive range 0.05% to 68.6% across five
  detectors; Int. J. for Educational Integrity accuracy 0.61 and 0.69 for two tools): UNVERIFIED.
- **Takeaway for copy** [Opinion from the above]: detectors are better than in 2023 on long text, but no tool can
  prove who wrote a text, short text is unreliable, and product descriptions are usually short. Our checker
  should not output "X% AI". It should check for patterns that make copy vague and point out missing facts.

### 5.2 Google's stance on AI-written content [Primary]

- "using generative AI tools or other similar tools to generate many pages without adding value for users may
  violate Google's spam policy on scaled content abuse." Focus on "accuracy, quality, and relevance"; "It is
  critical to manually factcheck and review all AI-generated content". Updated **1 Oct 2026** with Search Quality
  Rater guideline references (sections 4.6.5 scaled content abuse, 4.6.6 low-effort content).
  https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- The underlying 2023 position (AI use itself is not against the rules; quality is what counts):
  https://developers.google.com/search/blog/2023/02/google-search-and-ai-content (linked from the page above; not re-read today).
- Google's AI optimization guide: "Don't just recycle what others on the internet have already said, or could
  easily be produced by a generative AI model." Values "non-commodity content". (updated 10 Jul 2026)
- **Merchant Center feeds** (not website copy): AI-generated titles and descriptions "must be provided using" the
  `structured_title` / `structured_description` attributes with `digital_source_type` =
  `trained_algorithmic_media`; AI images need IPTC `TrainedAlgorithmicMedia` metadata.
  https://support.google.com/merchants/answer/14743464

### 5.3 Evidence that specific, factual product copy helps in AI answers

Evidence (primary, platform guidance):
- **Microsoft Bing** (8 Oct 2025, Krishna Madhavan, Principal PM, Bing): "Avoid vague language. Terms like
  innovative or eco mean little without specifics. Instead, anchor claims in measurable facts." "A product page
  should say '42 dB dishwasher designed for open-concept kitchens' instead of just 'quiet dishwasher.'" Mistakes:
  "Unanchored claims: Saying something is 'next-gen' or 'cutting-edge' without context"; "Decorative symbols:
  Arrows (→), stars (★★★), or strings of punctuation (!!!)"; "Be cautious with em dashes"; "Overloaded
  sentences"; "long walls of text". https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers
- **OpenAI**: ChatGPT shopping uses "Structured metadata ... (e.g., price, product description)" and "may consider
  available options, price, reviews, and ease of use"; it "may generate simplified product titles and
  descriptions" from provider data. https://help.openai.com/en/articles/11128490-shopping-in-chatgpt
- **Google**: values unique, "non-commodity" content (AI optimization guide).

Evidence (study, lab):
- Princeton GEO paper (KDD 2024): adding statistics, quotations and citations raised visibility 30% to 40% in a
  simulated engine; keyword stuffing gave "little to no improvement". From geo-2026.md
  (https://arxiv.org/abs/2311.09735), not re-read for this file.

Opinion (ours, label as such if used):
- Patterns worth flagging in a product description: hype words with no fact attached ("innovative",
  "cutting-edge", "next-gen", "eco", "premium", "high-quality", "game-changer", "elevate", "unleash",
  "seamless"); no size, weight, volume or dimensions; no materials or ingredients; no "who it's for"; no use case;
  no care or usage instructions; decorative symbols; very long single paragraph. Only the first four hype words and
  the symbols come from Microsoft's guidance; the rest is our heuristic.
- Required honesty line: "No tool can prove who wrote a piece of text. This check looks for patterns that make
  copy vague, whoever wrote it."

---

## 6. Google AI Overviews and AI Mode (for the AI Overview Checker)

### 6.1 Where they show [Primary]

- **AI Overviews**: available to all users in the countries, territories and languages listed on Google's help
  page. Counted by hand on 11 Oct 2026: about **249 country/territory entries** and **98 languages** (English,
  Spanish, Hindi, Japanese, Arabic, etc.). The page has no date. https://support.google.com/websearch/answer/14901683
- AI Overviews appear "when our systems determine that generative AI can be especially helpful"; they "can and will
  make mistakes"; users can't turn them off but can use the "Web" filter. [same page]
- **AI Mode**: available in a similar long list of countries and languages (Portuguese listed as "Portuguese
  (Brazil)"). Gemini 3 Pro in AI Mode is English-only and in a smaller country list.
  https://support.google.com/websearch/answer/16011537
- **Our data source is US only**: Treg `anyapi.google.serp.ai_overview` (from the task brief). Copy must say
  "Results from Google in the United States."

### 6.2 How often for shopping searches [Study]

Ahrefs, 146,122,391 desktop SERPs, September 2025 data, published 10 Nov 2025:
https://ahrefs.com/blog/ai-overview-triggers/

| Group | AI Overview rate |
|---|---|
| All keywords | 20.5% |
| **"Shopping" category** | **3.2%** (555,271 of 17,343,482) |
| Commercial intent | 4.3% (computed: 1,657,560 / 38,117,465) |
| Transactional intent | 2.1% (computed: 366,400 / 17,806,400) |
| Question queries | 57.9% |
| Queries of 7+ words | 46.4% |
| Beauty & Fitness category | 18.4% |
| Home & Garden category | 18.4% |
| Local searches | 7.9% |

- Country of the sample is not stated in the excerpt (likely US; UNVERIFIED). 2026 rates: UNVERIFIED.
- Meaning for the tool [Opinion]: short shopping searches ("beard oil") usually show no AI Overview; long
  question-style searches ("what's the best beard oil for dry skin") are more likely to. "No AI Overview" is a
  normal, common result and should be explained, not shown as an error.

### 6.3 AI Mode vs AI Overviews [Primary]

- AI Overviews: a snapshot on the normal results page, "only shown when our systems determine that it is additive
  to classic Search, and as such, often don't trigger."
- AI Mode: a separate conversational mode (google.com/ai or the AI Mode tab) for "further exploration, reasoning,
  or complex comparisons", with follow-up questions. It uses "query fan-out", dividing a question into subtopics
  and searching each.
- "AI Mode and AI Overviews may use different models and techniques, so the set of responses and links they show
  will vary." https://developers.google.com/search/docs/appearance/ai-features (updated 10 Dec 2025)
- To be shown as a link in either, a page "must be indexed and eligible to be shown in Google Search with a snippet"
  and the site must be included via the Search Console "Search generative AI" control (default Include, worldwide
  since 31 Aug 2026, changes take effect in about 1 to 2 days). https://support.google.com/webmasters/answer/16908024
- Search Console also has a "Generative AI performance report" (named in Google's AI optimization guide).

### 6.4 Do results vary by person or place? [Primary]

- **AI Mode is personalised**: "Personal Intelligence in AI Mode references previous searches and activity saved in
  your Search Services History", for signed-in users 18+ with history and personalised recommendations on; it can
  also use connected Gmail, Calendar and Photos if the user opts in. https://support.google.com/websearch/answer/16011537
- AI Overviews: availability differs by country and language (6.1), they trigger only sometimes, and Google says
  the links shown vary between AI Mode and AI Overviews. No Google statement found on AI Overview personalisation
  for signed-in users: UNVERIFIED.
- ChatGPT, for comparison: uses approximate location from IP and may use saved memories when rewriting search
  queries. https://help.openai.com/en/articles/9237897-chatgpt-search
- **Honest copy line** [Opinion based on the above]: "AI Overviews change by location, device, time and who is
  searching. We check from the US, signed out, so your own Google may show something different."

---

## 7. Ready-to-use honest lines (all em dash free)

Each line is backed by the section shown. Use as written or shorten.

- (1) "Blocking GPTBot stops OpenAI training on your pages. It doesn't remove you from ChatGPT search. OAI-SearchBot controls that."
- (1) "Blocking ClaudeBot stops Anthropic training. Claude-SearchBot and Claude-User decide if Claude can find and read your pages."
- (1) "Google-Extended doesn't affect Google Search or AI Overviews. It does affect the Gemini app."
- (1) "Some assistants fetch a page when a person asks, and say robots.txt may not apply to those visits."
- (1) "Firewalls and Search Console settings can also hide your site from AI tools, and robots.txt can't show those."
- (2) "Structured data helps Google and AI shopping tools read your price, stock and product facts. It won't get you recommended on its own."
- (2) "Shopify themes add basic product data automatically. Shipping, returns and ratings usually need extra setup."
- (3) "Google stopped showing FAQ rich results on 7 May 2026. FAQ markup is still valid and can help other tools read your answers, as long as the same questions and answers are visible on the page."
- (4) "Google says llms.txt has no effect on Google Search. Most llms.txt files are never requested at all (Ahrefs, May 2026)."
- (4) "Shopify now creates an llms.txt for every store automatically. You can replace it in your theme if you want to."
- (5) "No tool can prove who wrote a piece of text. This check looks for vague patterns and missing facts, whoever wrote it."
- (6) "Google shows AI Overviews for only a small share of shopping searches. Longer question-style searches trigger them more often."
- (6) "We check Google in the United States, signed out. Your own results may differ."

---

## Sources (all read 11 Oct 2026 unless noted)

Crawlers
- OpenAI bots: https://developers.openai.com/api/docs/bots
- OpenAI ChatGPT search help: https://help.openai.com/en/articles/9237897-chatgpt-search
- OpenAI shopping help: https://help.openai.com/en/articles/11128490-shopping-in-chatgpt
- Anthropic crawlers (dated 7 Apr 2026): https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler
- Perplexity bots: https://docs.perplexity.ai/guides/bots
- Google common crawlers (updated 14 Jul 2026): https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers
- Google user-triggered fetchers (updated 19 Aug 2026): https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers
- Apple Applebot (published 4 Sep 2026): https://support.apple.com/en-us/119829
- Meta crawlers: https://developers.facebook.com/documentation/sharing/webmasters/web-crawlers.md
- Amazon bots: https://developer.amazon.com/amazonbot
- DuckAssistBot: https://duckduckgo.com/duckduckgo-help-pages/results/duckassistbot
- Mistral bots: https://docs.mistral.ai/robots
- Common Crawl FAQ: https://commoncrawl.org/faq
- Bing crawlers: https://www.bing.com/webmasters/help/which-crawlers-does-bing-use-8c184ec0
- Shopify 2026 default robots.txt (observed): https://theme-horizon-demo.myshopify.com/robots.txt

Structured data
- Google merchant listing (updated 8 Sep 2026): https://developers.google.com/search/docs/appearance/structured-data/merchant-listing
- Google product snippet (updated 8 Sep 2026): https://developers.google.com/search/docs/appearance/structured-data/product-snippet
- Google product variants (updated 8 Sep 2026): https://developers.google.com/search/docs/appearance/structured-data/product-variants
- Google organization (updated 8 Sep 2026): https://developers.google.com/search/docs/appearance/structured-data/organization
- Google Search Central changelog (updated 8 Oct 2026): https://developers.google.com/search/updates
- Google FAQ doc, archived 1 Mar 2026: https://web.archive.org/web/20260301000000id_/https://developers.google.com/search/docs/appearance/structured-data/faqpage
- schema.org FAQPage: https://schema.org/FAQPage
- Shopify structured_data filter: https://shopify.dev/docs/api/liquid/filters/structured_data
- Dawn main-product.liquid: https://raw.githubusercontent.com/Shopify/dawn/main/sections/main-product.liquid
- Horizon demo product page (observed): https://theme-horizon-demo.myshopify.com/products/test-alex-merino-wool-open-placket-polo-324
- Microsoft Advertising / Bing, Optimizing content for AI search answers (8 Oct 2025): https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers

llms.txt
- llmstxt.org (v2): https://llmstxt.org/ ; changes: https://llmstxt.org/changes.html
- Shopify changelog (28 May 2026): https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd
- Shopify agents.md.liquid docs: https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid
- Shopify developer forum thread: https://community.shopify.dev/t/llms-txt-and-agents-md/34049
- Google AI optimization guide (updated 10 Jul 2026): https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
- Chrome Lighthouse llms.txt audit (updated 5 May 2026): https://developer.chrome.com/docs/lighthouse/agentic-browsing/llms-txt
- Ahrefs llms.txt study (15 Jun 2026): https://ahrefs.com/blog/llmstxt-study/
- Search Engine Journal on Mueller (2025, Secondary): https://www.searchenginejournal.com/google-says-llms-txt-comparable-to-keywords-meta-tag/544804/
- Live files: https://www.allbirds.com/llms.txt , https://kyliecosmetics.com/llms.txt , https://www.deathwishcoffee.com/llms.txt , https://www.beardbrand.com/llms.txt , https://www.gymshark.com/llms.txt

AI text
- OpenAI classifier (withdrawn 20 Jul 2023): https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/
- Liang et al. 2023: https://arxiv.org/abs/2304.02819
- Epoch AI detector test (Jul 2026): https://epoch.ai/data-insights/ai-detectors-false-negatives
- Google, using generative AI content (updated 1 Oct 2026): https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- Google Merchant Center, AI-generated content: https://support.google.com/merchants/answer/14743464

AI Overviews and AI Mode
- AI Overviews help and availability: https://support.google.com/websearch/answer/14901683
- AI Mode help and availability: https://support.google.com/websearch/answer/16011537
- AI features and your website (updated 10 Dec 2025): https://developers.google.com/search/docs/appearance/ai-features
- Search Console Search generative AI control: https://support.google.com/webmasters/answer/16908024
- Ahrefs, what triggers AI Overviews (10 Nov 2025): https://ahrefs.com/blog/ai-overview-triggers/
