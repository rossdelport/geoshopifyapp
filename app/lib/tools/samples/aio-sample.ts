// The AI Overview Checker's on-load example: a real Google search, captured through Treg
// (crawl4ai.google.serp.organic, q "best sunscreen for oily skin", country us, language en) on
// 11 October 2026 at about 07:38 UTC. The raw response is test/fixtures/tools/crawl4ai-serp-aio.json and
// test/tools-aio.test.ts checks that this sample is what parseCrawl4ai makes of it, with two edits:
// - the overview text is trimmed to its first sentence on purpose (the rest is product cards with prices
//   and ratings run together); the trimmed text is exact;
// - the Walmart and Target links have their tracking parameters removed.
// Google's answer changes over time; the page labels this as an example with its date.
// Pure data, browser-safe. The server also seeds its 24-hour cache with it (no paid call for this search).

import type { AioResult } from "../aio";

export const AIO_SAMPLE: AioResult = {
  query: "best sunscreen for oily skin",
  checkedAt: "2026-10-11",
  country: "US",
  provider: "crawl4ai",
  shown: true,
  textCut: true,
  text: "The best sunscreens for oily and acne-prone skin are lightweight, oil-free, non-comedogenic formulas that provide a shine-free or matte finish.",
  sources: [
    {
      url: "https://www.walmart.com/ip/Eucerin-Sun-Clear-Skin-Oil-Control-Face-Sunscreen-Lotion-SPF-50-2-5-fl-oz-Bottle/900570371",
      title: "Walmart",
      domain: "walmart.com",
      type: "retailer",
    },
    {
      url: "https://www.target.com/p/eucerin-face-oil-control-sunscreen-lotion-spf-50-2-5-fl-oz/-/A-83695787",
      title: "Target",
      domain: "target.com",
      type: "retailer",
    },
    {
      url: "https://www.allure.com/gallery/best-sunscreen-for-oily-skin",
      title: "These Are the Best Sunscreens for Oily Skin Types, Full Stop | Allure",
      domain: "allure.com",
      type: "editorial",
    },
    {
      url: "https://www.osvidermatology.com/press/17-best-sunscreens-for-oily-skin-that-dont-feel-greasy-tested-and-reviewed-for-2023",
      title: "17 Best Sunscreens for Oily Skin that Don't Feel Greasy (Tested and Reviewed for 2023)",
      domain: "osvidermatology.com",
      type: "editorial",
    },
    {
      url: "https://charlottaeve.com/2018/05/09/best-sunscreens-for-oily-skin/",
      title: "Best sunscreens for oily skin",
      domain: "charlottaeve.com",
      type: "editorial",
    },
  ],
  organic: [
    { position: 1, domain: "realskindiaries.com", url: "https://realskindiaries.com/best-sunscreen-for-oily-skin-sunscreen-options/", title: "Testing 4 Sunscreen Products. What Worked And What Didn't." },
    { position: 2, domain: "reddit.com", url: "https://www.reddit.com/r/BeautyItemsReview/comments/1ttkpaj/whats_the_best_sunscreen_for_oily_skin_that/", title: "What's the best sunscreen for oily skin that doesn't make you look greasy ..." },
    { position: 3, domain: "reddit.com", url: "https://www.reddit.com/r/SkincareAddiction/comments/1ey9wd3/need_the_best_sunscreen_for_oily_skin/", title: "Need the best sunscreen for oily skin, recommendations please! [Product ..." },
    { position: 4, domain: "charlottaeve.com", url: "https://charlottaeve.com/2018/05/09/best-sunscreens-for-oily-skin/", title: "Best sunscreens for oily skin" },
    { position: 5, domain: "ulta.com", url: "https://www.ulta.com/shop/body-care/suncare/sunscreen?skin+type=oily", title: "Oily Sunscreen - 214 Products" },
    { position: 6, domain: "reddit.com", url: "https://www.reddit.com/r/30PlusSkinCare/comments/ujduf1/best_face_sunscreen_for_oily_skin/", title: "Best face sunscreen for oily skin :) : r/30PlusSkinCare" },
    { position: 7, domain: "surfacesunscreen.com", url: "https://surfacesunscreen.com/blogs/news/best-sunscreen-for-oily-skin", title: "The Best Sunscreen for Oily Skin: What to Look For" },
    { position: 8, domain: "stream2sea.com", url: "https://stream2sea.com/collections/best-sunscreen-for-oily-skin-dermatologist-recommended", title: "Dermatologist Recommended Sunscreen for Oily Skin" },
    { position: 9, domain: "stream2sea.com", url: "https://stream2sea.com/collections/best-sunscreen-for-oily-skin", title: "Best Sunscreen for Oily Skin" },
    { position: 10, domain: "nouvobody.com", url: "https://nouvobody.com/blogs/blog-skin-and-hair-tips/discover-the-best-sunscreens-for-oily-skin-recommended-by-dermatologists", title: "Discover the Best Sunscreens for Oily Skin, Recommended ..." },
  ],
  peopleAlsoAsk: ["Is mineral sunscreen better?", "Does sunscreen prevent tanning?", "Should I use sunscreen every day?", "Can sunscreen clog pores?"],
};
