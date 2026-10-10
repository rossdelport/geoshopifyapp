# Ad rules: what GEO's ads must follow (checked 10 Oct 2026)

Every page below was opened and read on 10 Oct 2026. Each rule has the source URL, the exact quote and
the page's date where it shows one. This is a working checklist, not legal advice. Before a big spend,
get an Australian consumer lawyer to read the final ads and landing page together.

Companion sheets: `docs/ads/ad-facts.md` (which ad-cost numbers are true) and `docs/facts.md` (AI usage
numbers). If a number is not on one of those sheets, it does not go in an ad.

---

## Before any ad goes live (checklist)

Tick every box. One "no" means the ad doesn't run.

**Claims and numbers**

- [ ] No "free money", "free traffic forever", "get rich", "passive income" or any wording that promises money for little effort.
- [ ] No "ad costs never come down" / "CPMs only go up" / "always up and to the right". Use a dated, sourced number instead ("Meta's average price per ad was 12% higher than a year earlier, Q2 2026").
- [ ] No promised results ("get 50 orders a month", "double your sales", "rank #1 in ChatGPT"). No "will". Use "can", "could", "see if".
- [ ] Every number has a source and a date on the ad or one tap away on the landing page. Say "US data" or "global" where it is, and name the platform ("Google Ads, US").
- [ ] Every claim about what an AI answer said traces to a raw answer saved in `docs/ads/evidence/` (prompt, country, time, call id), and the ad says the date and country.
- [ ] "Isn't for sale" is always about ChatGPT and attributed to OpenAI, never about AI answers in general (Google sells ads within AI Overviews).
- [ ] No "AI links straight to stores" or "every AI sale is tracked" (links often go to roundups and retailers; ChatGPT's tag is not always added).
- [ ] Any dashboard, chart or revenue figure in the creative is labelled "Sample data" (we have no real customer results yet).
- [ ] No before/after revenue charts unless they are one real customer's real numbers, with written permission, and labelled as not typical.
- [ ] No testimonials, reviews, star ratings, user counts or logos of "customers" until they are real, and then only genuine, unedited and with any incentive disclosed.
- [ ] No "the best", "the first", "the only", "#1" (also banned in our Shopify listing).

**Price and "free"**

- [ ] "Free" is only used for things that cost nothing: the free product check, or "no cost per click" for the AI recommendation itself. Never for GEO.
- [ ] If the ad says "free" anywhere, the price is clear in the same place, using the line that is true that day (`ad-concepts.md` 2.1). Stage A, until a normal store can install: "The check is free. Our app is coming to the Shopify App Store at US$97/mo. Join the early list." Stage B: "The check is free. Our app is US$97/mo (USD), billed through Shopify after a 7-day trial unless you cancel. Cancel in the app or by uninstalling."
- [ ] No ad mentions the trial until a non-dev store has installed the app and started one (section 5.10).
- [ ] Trial ads say how long the trial is and that billing starts automatically after it, plus how to cancel. Add "plus GST" if Shopify adds GST to app charges for AU stores (not yet confirmed).

**Wording and tone**

- [ ] No questions or statements that assume the viewer's situation, money or business is in trouble ("Are you losing sales?", "Your store is invisible", "Struggling with ad costs?"). "You" is fine without an attribute.
- [ ] No clickbait: no "the secret", "you won't believe", "click to find out", no withholding the point to get a click.
- [ ] No fake buttons, fake chat input boxes or fake system notifications in the image.
- [ ] Plain English, Australian spelling, no em dashes or spaced en dashes, no "GEO/AEO/LLM" jargon.

**Other brands**

- [ ] No ChatGPT, OpenAI, Gemini, Google, Perplexity, Meta, Facebook, Instagram or Shopify logos.
- [ ] Our own name or wordmark is on every image, at least as large as any AI brand name, and AI names are in body-weight type. Images that name ChatGPT, Gemini or Perplexity carry "Independent. Not affiliated with OpenAI, Google or Perplexity."
- [ ] Only ChatGPT answer text is shown. Gemini and Perplexity appear as counts and blurred or swapped brand names only.
- [ ] No screenshots of Google Search, AI Overviews, Gemini or Perplexity. A ChatGPT answer may only appear as a real, dated, unedited answer, shown as a quote card in our own design (OpenAI's logo, colours and UI removed), labelled as a real answer and AI-generated, with the word "ChatGPT" never larger than our own name (details in section 4).
- [ ] Brand names only in plain, accurate, descriptive text: "see if ChatGPT, Gemini and Perplexity recommend your products". Never "partner", "official", "works with", "approved by", "powered by ChatGPT".
- [ ] Real brands that appear inside an AI answer (competitors, retailers) are blurred or replaced with our sample brand, unless we have their permission.
- [ ] Trademark line on the landing page (see section 4.4).
- [ ] No comparison with named competitor apps unless it is accurate on the day, like for like, and re-checked for the life of the campaign. No implied comparison either ("other tools only count mentions" is false).
- [ ] Any "AI revenue" claim or screen keeps paid ChatGPT ad clicks separate from organic AI orders.

**Landing page**

- [ ] The landing page says the same thing as the ad (same offer, same price, same numbers, same sources).
- [ ] Someone checks comments on live ads daily and hides or answers any false claim (for example a commenter promising results).

---

## The angles Ross wants: verdicts and safe wording

| Ross's line | Verdict | Why (rule) | Say this instead |
|---|---|---|---|
| "Ranking in AI answers is like free money" | **Don't use. High rejection and legal risk.** | Meta bans "unrealistic financial reward for unclear or minimal effort" (1.1). Google bans "unrealistic promises of large financial return with minimal risk, effort or investment" (2.1). ACCC: "free" is read as absolutely free, and GEO costs US$97 a month (5.3). A promise of money is a claim about the future that needs reasonable grounds (5.5). | "When ChatGPT recommends your product, there's no cost per click." / "Ads have a price per click. An AI recommendation has to be earned." |
| "CPMs only go up and to the right. They never come back down." | **Don't use. False on the platforms' own numbers.** | Meta's price per ad fell for 7 quarters in a row in 2022 to 2023 (`ad-facts.md` section 1). A false claim breaks ACL s18 and s29 (5.1, 5.2). "Never" is a prediction with no reasonable grounds (5.5). Google bans "inaccurate claims" (2.1). Meta can reject ads "contrary to our competitive position" (1.7). | "Meta's average price per ad was 12% higher than a year earlier (Q2 2026, Meta's results)." / "Ad prices go up and down. Since late 2023 they've mostly gone up." Pair it, and let them connect the dots: "Meta: +12% per ad on last year. A ChatGPT recommendation: no cost per click." |
| "The free sales channel your store is missing" (site headline) | **OK on the site with the price nearby. Risky as a stand-alone ad headline.** | The AI recommendation has no cost per click, so "free" is defensible for the channel. But the overall impression must not be that GEO is free, and fine print can't fix a misleading headline (5.3, 5.4). Shopify listing rules keep pricing out of the intro text (3.3). | In ads: "A sales channel with no cost per click" plus the price line in the same frame (stage A until installs open: "Our app is coming to the Shopify App Store at US$97/mo"). |
| "Are you losing sales to stores ChatGPT recommends?" | **Don't use on Meta.** | Meta bans ads that "imply knowledge of personal or organizational financial information" and ads that "ask questions about personal attributes", including "vulnerable financial status" (1.4). | "When a shopper asks ChatGPT for a gift, which stores does it name? Check yours free." / "Have you checked what ChatGPT recommends in your category?" |
| "Get your products recommended by ChatGPT" | **OK if not a promise.** | A guaranteed outcome is an "improbable result ... as the likely outcome" (2.1) and a future claim (5.5). | "Help your products get recommended by ChatGPT & co." / "See what ChatGPT says about your products, and fix what it can't read." |
| "Free AI visibility check" | **OK.** | It is genuinely free. If an email is needed, say so. | "Free product check: paste a link, see if ChatGPT, Gemini and Perplexity recommend it." |

---

## 1. Meta (Facebook and Instagram) Advertising Standards

### 1.1 Prohibited Commercial Practices (covers get-rich-quick, deceptive pricing, subscriptions)

The old "Unacceptable Business Practices" URL now redirects here. Ads must follow the matching Community Standard.

- **Ad Standards page:** https://transparency.meta.com/policies/ad-standards/deceptive-content/prohibited-commercial-practices/ (no dated change-log entry shown)
  - "Ads Must Comply with the Community Standard on Prohibited Commercial Practices."
  - "Our terms and policies prohibit content and behavior that employ prohibited commercial practices" and gives as examples "deceptive pricing, unauthorized endorsements, and guaranteed investment returns".
- **Community Standard:** https://transparency.meta.com/policies/community-standards/prohibited-commercial-practices/ (no dated change-log entry shown)
  - Rationale: "This includes false job or government program offers, celebrity and brand bait, investment schemes (including guaranteed returns), debt relief and credit repair schemes, get-rich-quick and giveaway schemes, romance schemes, and charity schemes."
  - **"Prohibited Get Rich Quick Content ... Offers of opportunities of unrealistic financial reward for unclear or minimal effort."**
  - Investment content bans offers "claiming or referencing successful past performance or returns to create an expectation of similar future results" and offers "that claim quick returns (such as under 24 hours)".
  - Practices Meta acts on from user feedback include "Misleading or unreasonable pricing", "Product misrepresentation: promoting products or services that materially differ from what was advertised" and "Deceptive subscription practices: enrolling customers in recurring payment plans or subscription services without clear disclosure of terms."

**What it means for GEO:** "Free money" plus coin imagery plus "no effort" reads like a get-rich-quick offer to Meta's automated review, even though GEO is software. (That last point is our judgement, not Meta's wording.) The 7-day trial that turns into US$97 a month must be disclosed plainly.

### 1.2 "Unrealistic outcomes" (old page removed, idea still enforced)

- The old policy page https://transparency.meta.com/policies/ad-standards/deceptive-content/unrealistic-outcomes returned "This page isn't available" on 10 Oct 2026. It is no longer listed in the Ad Standards index.
- But Meta's ad quality help page still names it: https://www.facebook.com/business/help/1767120243598011 : "all ads and landing pages must abide by our Community Standards and Advertising Standards, including adult content, non-functional landing page, low quality or disruptive content, sensational content, commercial exploitation of crises and controversial events, and unrealistic outcomes."
- Income and health promises now sit under 1.1 (get rich quick) and Health and Wellness (1.5).

### 1.3 Low-quality ads: clickbait, sensational language, engagement bait

- **Source:** https://www.facebook.com/business/help/1767120243598011 (Best practices to improve ad quality and performance)
  - "**Withholding information:** Ads that withhold information in order to entice someone to click a link to understand the full context of something."
  - "**Sensationalized language:** Includes using exaggerated headlines or commanding a reaction from people to a degree that creates an unexpected experience when people click to a landing page."
  - "**Engagement bait:** When an ad uses spammy content that urges people to engage with it in an inauthentic way to get more likes, comments and shares."
  - "if we detect that an ad violates our low quality or disruptive content advertising policy, we'll reject it."
  - Landing page red flag: "Misleading experiences: this includes websites that misrepresent products".
- **Source:** https://www.facebook.com/business/help/423781975167984 (About ad quality): "Ads with a lower quality ranking tend to cost more" and "if you repeatedly post policy-violating or lower quality ads, our systems may start considering all ads from your Page, domain, ad account or other associated entities as lower quality."

**What it means for GEO:** "FREE MONEY 💰💰" and "The ChatGPT secret your competitors don't want you to know" are both low-quality patterns. They also cost more to run.

### 1.4 Personal attributes ("Are you losing sales?" style wording)

- **Source:** https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/ (latest dated change-log entry: 27 Jun 2024)
  - "ads must not contain content that asserts or implies personal attributes. This includes direct or indirect assertions or implications about a person's race, ethnicity, religion, beliefs, age, sexual orientation or practices, gender identity, disability, physical or mental health (including medical conditions), vulnerable financial status, voting status, membership in a trade union, criminal record, or name."
  - Ads can't "Imply knowledge of personal or organizational financial information of a user or user's family".
  - Ads can "Use 'you/your' language without a personal attribute."
  - "❌ Using the word "you/your/other" to reference a personal attribute"; "❌ Are you bankrupt? Check out our services."
  - "Instead, ads should focus on the benefits of the product or service being advertised."
- **Source:** https://www.facebook.com/business/help/2557868957763449 (About Meta's Privacy Violations and Personal Attributes advertising policy)
  - "we don't allow ads that ask questions about personal attributes. Note that you can use the words "you" or "your" as long as your ad doesn't mention any prohibited personal attributes".
  - Violating example: "Are you bankrupt? Our firm has solutions." because it "implies knowledge of an individual's financial status, and uses the word "you"."

| Don't (Meta) | Do (Meta) |
|---|---|
| "Are you losing sales to competitors on ChatGPT?" | "When shoppers ask ChatGPT what to buy, which stores does it name?" |
| "Your store is invisible to AI." | "Paste a product link and see if ChatGPT recommends it." |
| "Struggling with rising ad costs?" | "Meta's average price per ad was up 12% on last year (Q2 2026)." |
| "Your revenue is leaking to AI-recommended brands." | "AI names a few brands, often with links to where to buy them. See which ones." |
| "Tired of paying for every click?" | "An AI recommendation has no cost per click." |

### 1.5 Before-and-after

- **Source:** https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/ (latest dated change-log entry: 22 Jul 2026)
  - Meta's before-and-after rules are about bodies: ads for weight loss or cosmetics can't contain "statements of inferiority about physical appearance", and 18+ ads may show "General cosmetic products, procedures, surgeries depicting before and after transformation."
  - Ads can't "Employ clickbait tactics in a health, weight loss, or weight gain context, such as sensational language with exaggerated or extreme claims, or promises of specific outcomes within a set timeframe without disclaimers or qualifiers."

**What it means for GEO:** Meta has no specific rule on business "before/after" charts, but a "before GEO / after GEO" revenue chart is a results claim under Australian law (section 5.5 and 5.6). If we show a merchant's product inside an AI answer (for example a beard oil), the answer must not contain therapeutic claims (TGA rules, CLAUDE.md §11).

### 1.6 Relevance and landing page match

- **Source:** https://transparency.meta.com/policies/ad-standards/ ("Relevance")
  - "Ads must clearly represent the company, product, service, or brand that is being advertised."
  - "The products and services promoted in an ad must match those promoted on the landing page."
  - Advertisers must comply with "all local laws, regulations and, where applicable, self-regulatory advertising codes".

### 1.7 Other brands in Meta ads, and Meta's own discretion

- **Third-party IP:** https://transparency.meta.com/policies/ad-standards/intellectual-property-infringement/third-party-infringement/ (latest dated change-log entry: 27 Aug 2024): "Ads may not contain content that violates the intellectual property rights of any third party, including copyright, trademark or other legal rights." and "Ads may be rejected or removed after being reported to us by an intellectual property rights holder".
- **Meta's own brands:** https://transparency.meta.com/policies/community-standards/meta-intellectual-property/ : do not post content that "Uses Meta's copyrights or trademarks without Meta's prior written permission", "Represents any of Meta's brands in a way that makes it the most distinctive or prominent feature of the creative", "Implies, without Meta's prior written permission, an endorsement or partnership of any kind with any of Meta's brands", or depicts a Meta user interface inaccurately or modified.
- **Meta's discretion:** https://transparency.meta.com/policies/ad-standards/ ("Things you should know", point 7): "We reserve the right to reject, approve or remove any ad for any reason, in our sole discretion, including ads that negatively affect our relationship with our users or that promote content, services, or activities, contrary to our competitive position, interests, or advertising philosophy."
- **Branded content:** same page: "Ads promoting branded content must tag the featured third party product, brand or business partner using the branded content tool." (Applies if a creator or merchant posts for us in exchange for anything of value.)

**What it means for GEO:** An ad on Facebook saying "Facebook ads are a rip-off, use AI instead" invites rejection under point 7. Keep any Meta price number factual, sourced, small, with no Meta or Facebook logos, and never the main visual.

---

## 2. Google Ads (if we run search ads)

### 2.1 Misrepresentation policy

- **Source:** https://support.google.com/adspolicy/answer/6020955 (Misrepresentation)
  - "The Misrepresentation policy strives to ensure that ads are clear, honest, and provide information that users need to make informed decisions."
- **Unreliable claims:** https://support.google.com/adspolicy/answer/15936857
  - "Making inaccurate claims or claims that entice the user with an improbable result (even if this result is possible) as the likely outcome a user can expect is not allowed."
  - Under financial claims: "Making unrealistic promises of large financial return with minimal risk, effort or investment", example: "\"Get rich quick\" schemes; guaranteeing returns, or promising returns that are unrealistic or exaggerated".
  - Listed under the health claims heading but worded generally: "If you guarantee certain results, you're required to have a clear and easily accessible refund (money-back) policy. Testimonials that claim specific results must include a visible disclaimer stating that there is no guarantee of specific results and that the results can vary."
- **Clickbait:** https://support.google.com/adspolicy/answer/15936667
  - "Ads that use clickbait tactics or sensationalist text or imagery to drive traffic are not allowed."
  - Examples: "Ads that claim to reveal secrets, scandals or other sensationalist information" and "clickbait messaging such as ''Click here to find out", "You won't believe what happened"".
  - Also bans ads that use "negative life events such as death, accidents, illness, arrests or bankruptcy to induce fear, guilt or other strong negative emotions to pressure the viewer to take immediate action".
- **Dishonest pricing:** https://support.google.com/adspolicy/answer/15938375
  - "Failure to clearly and conspicuously disclose the payment model or full expense that a user will bear before and after purchase is not allowed."
  - Examples include "Omitting recurring costs and the billing interval", "Promoting apps as free when a user must pay to install the app" and "Promoting a free trial without clearly stating the trial period or that the user will be automatically charged at the end of the trial".
- **Misleading ad design:** https://support.google.com/adspolicy/answer/6020955 : not allowed are "Non-functional elements that resemble buttons, input fields, or multiple-choice options", "Designs that mimic system notifications or dialog boxes" and "Inconsistencies between the ad and the landing page/app." (Matters for display ads that copy a chat box.)
- **Unacceptable business practices (affiliation):** https://support.google.com/adspolicy/answer/15938071
  - You can't "Make it seem like you're affiliated with another brand, organization or government entity when you're not".
  - Best practice: "Avoid using another brand's name, logo, images, and colors in ways that can trick people." and "If you reference another brand but you're not an official or authorized partner, consider a disclaimer on your website and in your ads."
  - This is an "egregious" category: "your Google Ads accounts will be suspended upon detection and without prior warning".

### 2.2 Trademarks in Google ads (competitor names, ChatGPT, Shopify)

- **Source:** https://support.google.com/adspolicy/answer/6118 (Trademarks)
  - Google will not restrict "Using trademarks as keywords".
  - Google will restrict "Using trademarks in an ad from a direct competitor" and "Ads that use the trademark in a confusing, deceptive, or misleading way" (after the owner complains).
  - Google will not restrict "Ads that use the trademark descriptively in its ordinary meaning".
- **Australian court precedent** (ACCC Advertising and selling guide, July 2021, https://www.accc.gov.au/system/files/Advertising%20and%20selling%20guide%20-%20July%202021.pdf): an agency used a competitor magazine's name as a keyword, so "A Google search for the competitor magazine generated a sponsored link that listed the name of the competitor magazine with the website address of the classified ads business below it. The Federal Court found that the classified ads business made false or misleading claims and engaged in misleading or deceptive conduct."

| Don't (Google search ad) | Do (Google search ad) |
|---|---|
| Headline: "Kedra Alternative: AI Visibility" landing on our page, if it reads as if we are Kedra | Bid on the keyword if wanted, but headline with our own name: "GEO: see what ChatGPT recommends" |
| "Rank #1 in ChatGPT Guaranteed" | "Check If ChatGPT Recommends You" |
| "Free AI Visibility App" | "Free Product Check. Plans from US$97/mo" |
| "7-Day Free Trial" with no billing info | "US$97/mo (USD), billed by Shopify after a 7-day trial unless you cancel in the app." (only once a normal store can install) |
| "The Secret to AI Sales" | "How ChatGPT Picks What to Recommend" |

### 2.3 Responsive search ads: where the price must be pinned

- **Source:** https://support.google.com/google-ads/answer/7684791?hl=en (About responsive search ads, read 10 Oct 2026)
  - "Headlines or descriptions pinned to Headline position 1, Headline position 2, or Description position 1 will always show. Content pinned to Headline position 3 and Description position 2 are not guaranteed to show in every ad. If you have text that should appear in every ad, then you must pin it to either Headline position 1, Headline position 2, or Description position 1."

**What it means for GEO:** if "free" shows, the price must show with it. Pin "free" only in headline 1 (with our name), the price headline in headline 2, and the description that carries the price in description 1. Keep "free" out of every unpinned headline.

---

## 3. Shopify App Store listing and App Store ads

### 3.1 App Store ads are built from the listing

- **Source:** https://shopify.dev/docs/apps/launch/marketing/advertising/create-ads
  - "The appearance of your ad is based on information in the associated app listing, and can't be customized. To change the content of your ad, you need to edit your app listing directly. Any changes that you make to your app listing are subject to review."
- **Source:** https://shopify.dev/docs/apps/launch/marketing/advertising : "Only apps published in the Shopify App Store can advertise." and "Ads are always clearly marked with a badge to indicate that they aren't organic app listings."
- **Source:** https://shopify.dev/docs/apps/launch/marketing/advertising/faq : "Can my ads link to a page other than my app listing? No."

So the listing rules below are the App Store ad rules.

### 3.2 Facts only, no stats, no "best/first/only", no testimonials

- **Source:** https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
  - 1.1.4 "Your app and app listing should only include factual information. Apps that falsify data to deceive merchants or buyers, such as fake reviews or false purchase notifications, violate our Partner Program Agreement and our Acceptable Use Policy."
  - 4.3 "Your app store listing should be truthful and accurate."
  - 4.3.3 "Do not use any statistics or data in your app's listing content, overview of the app, and/or app introduction. This includes verifiable and unverifiable information. Focus on your app's benefits when rewriting your listing and avoid using terms like "the first", "the best", or "the only"."
  - 4.3.4 the same rule for images: "Don't use stats, data, or unsubstantiated claims such as guarantees in images."
  - 4.3.7 "Do not use reviews and testimonials in your app's listing and other undesignated app listing areas. Reviews will be added to your listing page based on merchant feedback."
  - App card subtitle: "Don't include any data or statistics. Share this information on your website and landing pages instead."
  - "Reviews that are fake and/or incentivized are strictly prohibited."
- **Source:** https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
  - App introduction: "Tie your unique offering to measurable business outcomes. Avoid keyword stuffing, data claims, and incomplete sentences."
  - Shopify's own "Do" example uses soft wording: "More customization options can help increase product sales."
  - App details: "Avoid excessive marketing language, keyword stuffing, and outcome guarantees."
  - Screenshots: "don't include pricing, reviews, or outcome guarantees."

**What it means for GEO:** None of the `ad-facts.md` or `facts.md` numbers can go in the listing, the subtitle or the screenshots (not even "60% higher conversion"). Dashboard screenshots with dollar figures should be labelled "Sample data" and should not read as a promise. Use "can help" wording.

### 3.3 Pricing and the trial

- 4.2.1 "Ensure your pricing information includes all pricing options such as, free trial time and charge details."
- 4.2.2 / 4.2.3 "Pricing information should only appear in the Pricing details section of your app listing."

### 3.4 Name and other brands

- 4.1.2 "Every app must have its own unique, recognizable name that leads with your distinctive brand identifier. Your app's name must not be identical or confusingly similar to another app, developer, brand, or Shopify product."
- Best practices, app name: "Don't lead with a generic descriptor, or with the name of a platform or business that you integrate with." and "Show compatibility without implying affiliation: You can reference a platform or business that your app integrates with, but your brand name must come first." App icon: avoid "Copying or impersonating other brands or logos".
- 4.4.3 "Do not use our trademarks in your app icon, banner, or screenshots. Our trademarks can only be used to communicate your app's compatibility with Shopify in accordance with our brand guidelines."
- **Shopify brand assets (for Meta and Google ads too):** https://www.shopify.com/brand-assets : "Use of our brand assets must be expressly authorized in writing." and "Your use must not mislead consumers as to our sponsorship of, affiliation with or endorsement of your company or your products or services."

**What it means for GEO:** No "ChatGPT" or "GPT" in the app name (OpenAI forbids it too, see 4.1). "GEO: AI Search Sales Tracker" style is fine; "ChatGPT Rank for Shopify" is not. In ads, write "for Shopify stores" in plain text; no Shopify bag logo.

---

## 4. Using ChatGPT, OpenAI, Gemini, Google and Perplexity names, logos and screenshots

### 4.1 OpenAI and ChatGPT

- **Brand guidelines:** https://openai.com/brand/ (no date shown)
  - "The "OpenAI" name, the OpenAI logo, the "ChatGPT" and "GPT" brands, and other OpenAI trademarks, are property of OpenAI."
  - Logos, Do: "Use the logo only when it directly relates to OpenAI services." Don't: "Use the logo without permission or outside OpenAI's terms." "Misrepresent your relationship with OpenAI, imply endorsement, or confuse users about sponsorship." "Use the logo more prominently than your own or in unrelated contexts." "Incorporate the logo into your own branding, trademark, or design a similar logo."
  - Permission requests: "including permission requests for the use of our logos ... please contact partnercomms@openai.com".
  - Usage terms: "Do not feature our Marks more prominently than your own company's name or marks." and "We may terminate permission to use our Marks at any time, and usage must stop promptly."
  - "We do not permit model names in app titles because there is concern that it confuses end users." and "we do not permit our GPT brand to be used in app, product, developer or company names".
  - Non-partnerships (expandable box on the page): "If you are not an official partner, please don't use "collaborated with," "worked with," or "partnered with," in any form." Don't: "Pawtopia is building with OpenAI".
  - Models box: "If your product closely resembles an OpenAI product (such as ChatGPT), please make a clear indication to users that your product is independently developed and not affiliated, endorsed, or sponsored by OpenAI."
  - Models box, wrong names to avoid: "Chat GPT, ChatGPT4, GPTChat".
- **Terms of Use (rest of world):** https://openai.com/policies/row-terms-of-use/ (Effective: 1 January 2026)
  - "you (a) retain your ownership rights in Input and (b) own the Output."
  - "You may only use our name and logo in accordance with our Brand Guidelines."
  - "You must evaluate Output for accuracy and appropriateness for your use case, including using human review as appropriate, before using or sharing Output from the Services."
  - "If Output references any third party products or services, it doesn't mean the third party endorses or is affiliated with OpenAI."
- **Sharing & publication policy:** https://openai.com/policies/sharing-publication-policy/ (Updated: 14 November 2022)
  - "Posting your own prompts or completions to social media is generally permissible". Conditions include: "Manually review each generation before sharing", "Attribute the content to your name or your company." and "Indicate that the content is AI-generated in a way no user could reasonably miss or misunderstand."

### 4.2 Google, Gemini and AI Overviews

"Gemini" and "AI Overviews" are on Google's trademarks list ("AI Overviews™ AI tool", "Gemini™ large language model & API"): https://partnermarketinghub.withgoogle.com/brands/google/trademarks-and-terms/google-trademarks-list/

- **How to talk about Google's brand:** https://partnermarketinghub.withgoogle.com/brands/google/branding-guidelines/how-to-talk-about-googles-brand/ (about.google brand pages now redirect here; no date shown)
  - "You can use the Google name in plain text without getting permission, if you're doing so for informational purposes (rather than as marketing or promotion)."
  - "Make sure you accurately represent how your product or service interacts with ours."
  - Do: "Use phrases like "Works with" or "Services we offer" to make it clear that Google is not offering the product or service." Do: "Use "for" to show that your product works with a Google product but is not affiliated with Google."
  - Don't: "Don't make statements implying certification, verification, approval, or endorsement from Google." "Don't use the Google name in slogans, promotions, or programs that don't come from Google."
- **Trademark guidelines:** https://partnermarketinghub.withgoogle.com/brands/google/trademarks-and-terms/trademark-guidelines-for-proper-usage/
  - "These guidelines use the term "Brand Feature" to refer to Google trademarks, logos, web pages, screenshots, or other distinctive features."
  - "Don't display any Google Brand Features as the most prominent element in your content." "Don't display Google Brand Features in any manner that implies a relationship with, affiliation with, sponsorship by, or endorsement by Google."
- **Terms for using Brand Features:** https://about.google/brand-resource-center/brand-terms (redirects to the Partner Marketing Hub "Terms and Conditions")
  - "If Google approves your request to use any Google trademarks, logos, web pages, screenshots, or other distinctive features ("Google Brand Features"), you agree to be bound by the following Terms and Conditions".
  - "Any use of the Google Brand Features must be accompanied by a notice that clearly indicates that the Google Brand Features are trademarks or distinctive brand features of Google LLC."
- **Google Search screenshots (covers AI Overviews, which sit inside Search):** https://about.google/brand-resource-center/products-and-services/search-guidelines/
  - "All uses of Google Search in advertisements must be approved by Google."
  - Print uses not permitted include "Advertisements" and "Business cards or other promotional materials".
  - Even with approval: "Don't show Google Search being used to look up information directly related to your brand, product, features, or slogan" and "Don't make Google Search the primary focus of your commercial or begin your commercial with a Google Search."
  - "Don't alter the way the interface looks, and don't manufacture, remove, or alter auto-suggest terms or search results."
  - "You must have appropriate third-party approval from relevant content owners if you show any content in promotional material."

**Note on "works with":** Google allows "works with" only where it is accurate. GEO does not plug into Gemini or Google Search; it reads their public answers. So "works with Gemini" would overstate the link. Use a plain description instead.

### 4.3 Perplexity

- I found **no public Perplexity brand or logo guidelines** (searched 10 Oct 2026). The rules come from its Terms of Service.
- **Terms of Service:** https://www.perplexity.ai/hub/legal/terms-of-service (Last updated: 23 January 2026)
  - "We hereby permit you to use the Services for your personal, non-commercial use only".
  - Without written permission you may not "download, modify, copy, distribute, transmit, display, perform, reproduce, duplicate, publish, license, create derivative works from, or offer for sale any information contained on, or obtained from or through, the Services" and may not "use, reproduce or remove any copyright, trademark, service mark, trade name, slogan, logo, image, or other proprietary notation displayed on or through the Services".
  - "You may not (i) publish any Output generated by the Services without clearly citing the Services, or (ii) misrepresent the source of any Output or the fact that it was generated by artificial intelligence."
  - "The Company's name, trademarks, logo and all related names, logos, product and service names, designs and slogans are trademarks of the Company".

### 4.4 Answers for GEO

| Question | Answer | Based on |
|---|---|---|
| Can we use the ChatGPT, OpenAI, Gemini, Google or Perplexity **logos** in ads or on the site? | **No**, not without written permission. Use the names in plain text. | OpenAI "Use the logo without permission" is a Don't; Google screenshots and logos are Brand Features that need approval; Perplexity bans using its logos; Meta and Google ad rules on third-party IP. |
| Can we show a **ChatGPT answer screenshot**? | **Only carefully, and better not in paid ads.** If used: a real, unedited answer to a real prompt; caption with prompt, country and date ("Real ChatGPT answer, asked in Australia, 9 Oct 2026"); OpenAI logo and UI chrome cropped or redrawn as plain text; never larger than our own brand; other brands in the answer blurred or replaced; "Not affiliated with OpenAI" on the landing page. Safer: show the answer as a quoted text card in our own design, labelled "Real answer" or "Illustration". | OpenAI Terms (user owns Output; name and logo only per brand guidelines), sharing policy (attribute, say it's AI), brand guidelines (no endorsement, not more prominent than us), ACCC (real brands shown must not imply they are customers). |
| Can we show an **AI Overview, Google Search or Gemini screenshot**? | **No, not in ads without Google's approval.** On the site, prefer a text quote or an illustration. | "All uses of Google Search in advertisements must be approved by Google"; screenshots are Google Brand Features that need approval. |
| Can we show a **Perplexity screenshot**? | **No.** Its terms are personal, non-commercial use, with no reproducing logos or content without written permission. | Perplexity ToS 5.1, 5.2. |
| Can we quote **Gemini or Perplexity answer text** in an ad? | **No.** Show counts ("named in 2 of 6 answers") and blurred or swapped brand names only. A ChatGPT answer can be shown as a quote card (see the ChatGPT screenshot row). | Perplexity ToS ("personal, non-commercial use only", no reproducing content). Gemini: screenshots are Google Brand Features that need approval, and we found no clear permission for quoting answer text in ads, so we don't. |
| Can we make a **mock-up** of an AI chat answer? | **Yes**, if it is clearly our own design (no ChatGPT, Gemini or Perplexity logos, colours or layout copied), labelled "Illustration", uses our sample brand, has no fake input box or buttons (Google display ads), and doesn't claim to be a real answer. | Google "Don't copy or imitate Google's trade dress"; Google Ads misleading ad design; ACCC overall impression. |
| Can we say **"works with ChatGPT"** or **"for ChatGPT"**? | **No.** GEO doesn't integrate with ChatGPT. Say what it does. | OpenAI non-partnership wording; Google "be accurate". |

**Allowed wording (plain text, accurate, descriptive):**

- "See if ChatGPT, Gemini and Perplexity recommend your products."
- "Tracks which stores ChatGPT & co recommend for the questions your shoppers ask."
- "Shows the orders and revenue it can trace to ChatGPT, Gemini and Perplexity links."
- "Checks Google's AI Overviews too." (True for Standard and Done-for-you scans; the free product check covers ChatGPT, Gemini and Perplexity only, so don't say it there.)
- "For Shopify stores."
- "GEO is independent and not affiliated with OpenAI, Google or Perplexity."

**Not allowed:**

- "Official ChatGPT partner", "Partnered with OpenAI", "Built with OpenAI", "Approved by Google", "Certified for Gemini".
- "Works with ChatGPT", "ChatGPT plugin for Shopify" (not true).
- "Get ranked by ChatGPT", "Rank #1 in Gemini" (implies control or a guarantee).
- App or campaign names with ChatGPT, GPT, Gemini or Google in them ("ChatGPT Rank", "GPT Sales").
- Misspelt names ("Chat GPT", "ChatGPT4").

**Trademark line for the landing page footer:**
"ChatGPT is a trademark of OpenAI. Gemini, Google and AI Overviews are trademarks of Google LLC. Perplexity is a trademark of Perplexity AI. Shopify is a trademark of Shopify Inc. GEO is independent and not affiliated with, endorsed or sponsored by any of them."

---

## 5. Australian Consumer Law (ACCC)

The ACL applies to ads aimed at businesses, not just consumers.

### 5.1 Misleading or deceptive conduct (ACL section 18)

- **Source:** ACCC Advertising and selling guide (July 2021, current guide), https://www.accc.gov.au/system/files/Advertising%20and%20selling%20guide%20-%20July%202021.pdf
  - "It is illegal for a business to engage in conduct that misleads or deceives or is likely to mislead or deceive consumers or other businesses. This law applies even if you did not intend to mislead or deceive anyone or no one has suffered any loss or damage as a result of your conduct."
  - "the most important question to ask is whether the overall impression created by your conduct is false or inaccurate."
  - "Businesses must remember that the consumers an advertising campaign targets may be very different to the audience that actually receives the message."

### 5.2 False claims, silence and puffery (ACL section 29)

- **Source:** https://www.accc.gov.au/business/advertising-and-promotions/false-or-misleading-claims (no date shown)
  - "Claims should be true, accurate and based on reasonable grounds." "A business must be able to prove any claim they advertise."
  - "It makes no difference whether a business intends to mislead or not."
  - Covers "claims about the value, benefits, qualities or performance of products and services" and applies to "advertising", "social media", "testimonials" and "websites or any other platform".
  - "In some circumstances, failure to disclose information can be misleading."
  - Puffery: "'Puffery' refers to wildly exaggerated and vague claims about a product or service that no one could treat seriously. For example, a restaurant claims they have the 'best steaks on earth'. These types of statements are generally not considered misleading."
  - Businesses shouldn't "guess the facts", "make promises they can't keep, or make predictions without solid evidence" or "impersonate or pretend to be a different business or brand".
  - Businesses should "check that the overall general impression is accurate", "back up claims with facts and evidence" and "note important limitations or exemptions".

**Is "free money" puffery?** Don't rely on it. Puffery is a claim "no one could treat seriously". "Ad costs never come down" and "AI sends you free customers" are specific, checkable claims about money, so they are judged as real claims.

### 5.3 "Free"

- **Guide (July 2021):** "Businesses should be particularly careful of the use of the word 'free'." "Consumers will usually think of 'free' as absolutely free" and "businesses may get into trouble with free offers if they do not reveal the complete truth, including any conditions that the consumer must comply with."
- **Web page:** misleading price claims include products "offered 'free' but on closer examination 'conditions apply'".

### 5.4 Fine print and disclaimers

- **Web page:** "Information in fine print and qualifications must not conflict with the overall message of the advertisement." Example: "An advertisement states that a product is 'free'. An extra payment is mentioned in the fine print. The advertisement is likely to be misleading."
- **Guide (July 2021):** "If an asterisk appears near the word 'free', for example, a business may be trying to trade on positive reactions to the selling point, while trying to keep within the law by putting the conditions in the fine print. This may not protect that business from breaching the ACL." and "The main selling point used for a product or service may make such a strong impression that no disclaimer can dispel it." Advertisers must not hide terms by "using text that is too small" or "flashing disclaimers on screen for only a moment".

### 5.5 Claims about the future and about results (what makes a results claim credible)

- **Web page:** "A business that makes a claim about future matters (including predictions or projections) must have reasonable grounds for making the claim at the time of making the claim. The business is responsible for showing that it had reasonable grounds to make the claim." and "Businesses need to make sure they adequately address the range of uncertainties and variables involved when making claims about the future."
- **Guide (July 2021):** "If it does not then the business can be guilty of misleading or deceptive conduct."

**A credible results claim for GEO, putting the above together:**

1. It is about what the product does today ("tracks orders that came from ChatGPT links"), not a forecast ("will grow your sales").
2. Any outcome is framed as possible, not likely or typical ("can help", "see if"), with the main variables named (category, catalogue, competition).
3. Any number is a published third-party figure with its source, date and region, not a GEO result.
4. A GEO customer result is only used when it is real, permitted, shown with its time period and baseline, and labelled "results vary, not typical" if it is better than usual.
5. The calculator / slider shows the reader's own inputs with "You decide what's realistic for your store", not a GEO prediction. (Our judgement: a low default, such as 1 extra order a month, is safer than 5.)
6. "Never", "always", "guaranteed", "every store" are gone.

### 5.6 Testimonials and reviews

- **Guide (July 2021):** "any review or testimonial should reflect the genuine views and opinions of the person that is represented to have made it. Businesses must not misrepresent consumer opinions to dishonestly promote themselves." Example: a business that "decides to create a few positive testimonials to post on its website and pretends they have been written by customers" is engaging in "misleading or deceptive conduct".
- **Guide, social media:** "a court found that a company accepted responsibility for fan posts and testimonials on its social media pages when it knew about them and decided not to remove them." and "Monitor your social media pages and remove any posts that are false, misleading or deceptive as soon as you become aware of them."
- **Web page:** https://www.accc.gov.au/business/advertising-and-promotions/online-reviews-for-product-and-services (no date shown)
  - "It's against the law for a business to create fake or misleading reviews or arrange for others to do so."
  - Reviews mislead if "written by family, employees, or people paid in some way by the business to write the review, without stating the personal connection or commercial relationship", "created by someone who hasn't actually used the product or service" or "edited or changed by someone else after being created".
  - Incentives "must be applied regardless of whether the reviewer leaves a positive or negative review" and "clearly disclosed so consumers know the review was incentivised."
  - Case: Service Seeking was ordered to pay "$600,000 in penalties" for reviews businesses drafted themselves.

### 5.7 Comparative advertising

- **Web page:** "Comparative advertising ... can be misleading if: the comparison is inaccurate, or it doesn't compare products fairly."
- **Guide (July 2021):** before comparing, ask "Is the comparison accurate?", "Are the products or services being compared reasonably similar?" and "Will the comparison be valid for the life of the promotion?". Also: "If a competitor is aware of a comparative campaign they may move quickly to change their product or service, and this could render your campaign misleading."

**What it means for GEO:** "Ads vs AI recommendations" is a comparison too. Compare like with like (an ad's price per click vs an AI recommendation's cost per click, which is nil), not "AI customers convert better than ad customers" (no source supports it; `ad-facts.md` 7b). Naming AgentIQ, Kedra or Mento needs a dated, sourced, like-for-like comparison that we re-check during the campaign.

### 5.8 Penalties

- **Source:** https://www.accc.gov.au/business/compliance-and-enforcement/fines-and-penalties (reflects 1 July 2026 values)
  - For false or misleading representations, the maximum for a corporation is the greater of "$100,000,000", 3 times the benefit, or "30% of the corporation's adjusted turnover during the breach turnover period". For individuals, "$2,500,000".
  - "The maximum penalties stated on this webpage are the amounts that apply to contravening conduct on or after 28 March 2026."
  - The ACCC can also issue infringement notices for "false or misleading representations".

### 5.9 Coming next: subscription traps and unfair practices (from 1 July 2027)

- **Source:** Assistant Treasurer media release, 2 July 2026, https://ministers.treasury.gov.au/ministers/andrew-leigh-2025/media-releases/unfair-trading-tricks-and-traps-be-banned
  - "Following passage of the Competition and Consumer Amendment (Unfair Trading Practices) Bill 2026 in Parliament today, unfair trading practices and subscription traps will be banned from 1 July 2027."
  - Targets "spending half a day trying to exit a subscription that took 30 seconds to sign up" and "being nudged and steered by online design features into decisions they wouldn't otherwise make".
  - "Consultation is already underway on extending protections to small businesses and franchisees".

**What it means for GEO:** Make the trial-to-paid step and cancelling as easy as signing up. Confirm exactly how a merchant cancels (plan page in the app, or uninstalling through Shopify) and say it in plain words on the pricing page and in any trial ad.

### 5.10 Advertising something you can't supply yet (bait advertising)

- **Guide (July 2021), "Bait advertising and special offers":** "Bait advertising can be a legitimate form of advertising. However, it is illegal to engage in this conduct where goods or services are advertised for sale at a discounted price, and they are not available in reasonable quantities and for a reasonable period at that price." (The ACCC's web pages on bait advertising returned "Page not found" on 10 Oct 2026; the guide is the source.)
- The guide frames bait advertising around discounted prices. The plainer risk for an app that can't be installed yet is a false or misleading representation about availability (ACL s18 and s29, sections 5.1 and 5.2).

**What it means for GEO:** until a non-dev store can install the app and start the trial (Shopify listing approved, `SHOPIFY_API_SECRET` set, `npm run deploy` run, protected customer data approved; CLAUDE.md §18), no ad offers the trial. Use "coming to the Shopify App Store, join the early list", and swap the report's trial button for an early-list form.

---

## Sources (all read 10 Oct 2026)

| Source | URL | Date on page |
|---|---|---|
| Meta Advertising Standards (intro, index, Relevance, Things you should know) | https://transparency.meta.com/policies/ad-standards/ | none shown |
| Meta Ad Standard: Prohibited Commercial Practices | https://transparency.meta.com/policies/ad-standards/deceptive-content/prohibited-commercial-practices/ | none shown |
| Meta Community Standard: Prohibited Commercial Practices | https://transparency.meta.com/policies/community-standards/prohibited-commercial-practices/ | none shown |
| Meta: Privacy Violations and Personal Attributes | https://transparency.meta.com/policies/ad-standards/objectionable-content/privacy-violations-personal-attributes/ | change log to 27 Jun 2024 |
| Meta Business Help: Personal Attributes policy | https://www.facebook.com/business/help/2557868957763449 | none shown |
| Meta: Health and Wellness | https://transparency.meta.com/policies/ad-standards/restricted-goods-services/health-wellness/ | change log to 22 Jul 2026 |
| Meta: Third-Party IP Infringement | https://transparency.meta.com/policies/ad-standards/intellectual-property-infringement/third-party-infringement/ | change log to 27 Aug 2024 |
| Meta: Using Meta IP and Licenses | https://transparency.meta.com/policies/community-standards/meta-intellectual-property/ | none shown |
| Meta: Spam (deceptive links, landing pages) | https://transparency.meta.com/policies/community-standards/spam/ | change log to 27 Jun 2024 |
| Meta Business Help: low-quality attributes | https://www.facebook.com/business/help/1767120243598011 | none shown |
| Meta Business Help: About ad quality | https://www.facebook.com/business/help/423781975167984 | none shown |
| Meta: old "Unrealistic outcomes" page | https://transparency.meta.com/policies/ad-standards/deceptive-content/unrealistic-outcomes | page removed |
| Google Ads: Misrepresentation | https://support.google.com/adspolicy/answer/6020955 | none shown |
| Google Ads: Unreliable claims | https://support.google.com/adspolicy/answer/15936857 | none shown |
| Google Ads: Clickbait ads | https://support.google.com/adspolicy/answer/15936667 | none shown |
| Google Ads: Dishonest pricing practices | https://support.google.com/adspolicy/answer/15938375 | none shown |
| Google Ads: Unacceptable business practices | https://support.google.com/adspolicy/answer/15938071 | none shown |
| Google Ads: Trademarks | https://support.google.com/adspolicy/answer/6118 | none shown |
| Shopify: About App Store ads | https://shopify.dev/docs/apps/launch/marketing/advertising | none shown |
| Shopify: Create ads (ads use the listing) | https://shopify.dev/docs/apps/launch/marketing/advertising/create-ads | none shown |
| Shopify: Ads FAQ | https://shopify.dev/docs/apps/launch/marketing/advertising/faq | none shown |
| Shopify: App Store requirements | https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements | none shown |
| Shopify: App Store best practices | https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices | none shown |
| Shopify: Brand assets and trademark guidelines | https://www.shopify.com/brand-assets | none shown |
| OpenAI: Brand guidelines | https://openai.com/brand/ | none shown |
| OpenAI: Terms of Use (rest of world) | https://openai.com/policies/row-terms-of-use/ | effective 1 Jan 2026 |
| OpenAI: Sharing & publication policy | https://openai.com/policies/sharing-publication-policy/ | updated 14 Nov 2022 |
| Google: How to talk about Google's brand | https://partnermarketinghub.withgoogle.com/brands/google/branding-guidelines/how-to-talk-about-googles-brand/ | none shown |
| Google: Trademark guidelines for proper usage | https://partnermarketinghub.withgoogle.com/brands/google/trademarks-and-terms/trademark-guidelines-for-proper-usage/ | none shown |
| Google: Terms for Brand Features | https://about.google/brand-resource-center/brand-terms | none shown |
| Google: Search screenshot guidelines | https://about.google/brand-resource-center/products-and-services/search-guidelines/ | none shown |
| Google: Trademarks list | https://partnermarketinghub.withgoogle.com/brands/google/trademarks-and-terms/google-trademarks-list/ | none shown |
| Perplexity: Terms of Service | https://www.perplexity.ai/hub/legal/terms-of-service | updated 23 Jan 2026 |
| ACCC: False or misleading claims (business) | https://www.accc.gov.au/business/advertising-and-promotions/false-or-misleading-claims | none shown |
| ACCC: Online reviews for products and services | https://www.accc.gov.au/business/advertising-and-promotions/online-reviews-for-product-and-services | none shown |
| ACCC: Advertising and selling guide (incl. bait advertising) | https://www.accc.gov.au/system/files/Advertising%20and%20selling%20guide%20-%20July%202021.pdf | July 2021 |
| ACCC: Fines and penalties | https://www.accc.gov.au/business/compliance-and-enforcement/fines-and-penalties | values from 1 Jul 2026 |
| Google Ads Help: About responsive search ads (pinning) | https://support.google.com/google-ads/answer/7684791?hl=en | none shown |
| Treasury: Unfair trading tricks and traps to be banned | https://ministers.treasury.gov.au/ministers/andrew-leigh-2025/media-releases/unfair-trading-tricks-and-traps-be-banned | 2 Jul 2026 |

Re-check before launch: Meta Q3 2026 results (late October 2026) for the price-per-ad line, and these policy
pages, which change without notice ("These policies are subject to change at any time without notice", Meta
Ad Standards).
