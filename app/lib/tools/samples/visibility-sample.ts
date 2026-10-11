// The on-load sample for the AI Visibility Checker (/tools/ai-visibility-checker): a finished free check
// for a MADE-UP store. "Kōwhai & Co", its lip balm, the rival brands, the questions and the cited sites are
// all invented. Copied from test/fixtures/check-sample.ts (app code never imports from test/) with one edit:
// in the fixture Perplexity failed on Q3 both times and came back empty once on Q2 (the fixture tests how a
// report copes with that). Here it answered every time, so each assistant has 3 questions x 2 runs = 6
// answers, as the form under the sample promises ("Each asked twice on every assistant"). A test keeps
// everything else equal to the fixture. The page labels it "Sample report for a made-up store" (copy/ai-visibility-checker.ts).
// Every number on the sample card comes from buildReport (check-report.ts), the same code real reports use.
// When Ross runs a real check on his own product (spec decision R5), freeze that check here with its date
// and change the label to "Real example: a check run on {date} for a product from {store}."
// Pure and browser-safe.

import { buildReport } from "../../check-report";
import type { CheckAnswer, CheckEngine, CheckProduct, CheckQuestion, CheckSource } from "../../check-types";

export const SAMPLE_PRODUCT: CheckProduct = {
  url: "https://kowhaiandco.co.nz/products/manuka-lip-balm",
  domain: "kowhaiandco.co.nz",
  title: "Mānuka Honey Lip Balm 15g",
  brand: "Kōwhai & Co",
  productType: "Lip Balm",
  category: "lip balm",
  description: "A small tin of lip balm.",
  price: "14.00",
  currency: "NZD",
  image: null,
  isShopify: true,
  shopDomain: "kowhai-and-co.myshopify.com",
  hasProductSchema: true,
  countryFrom: "store",
};

/** The brand's names as the check would know them (brand, then how AI may spell it). */
export const SAMPLE_MERCHANT_NAMES = ["Kōwhai & Co", "Kowhai and Co"];

export const SAMPLE_QUESTIONS: CheckQuestion[] = [
  { text: "What’s the best natural lip balm in New Zealand?", keyword: "best natural lip balm nz" },
  { text: "Which lip balm works for very dry, cracked lips?", keyword: "lip balm cracked lips" },
  { text: "Is mānuka honey lip balm worth buying in New Zealand?", keyword: "manuka honey lip balm" },
];

const src = (url: string, type: CheckSource["type"], isOwn = false): CheckSource => ({
  url,
  domain: new URL(url).hostname.replace(/^www\./, ""),
  title: null,
  type,
  isOwn,
});

// Made-up pages (the page shows their domains as plain text, never as links).
const ROUNDUP = "https://www.bestpicks.co.nz/beauty/best-lip-balm-nz";
const ROUNDUP_2 = "https://www.bestpicks.co.nz/beauty/manuka-skincare-guide";
const MAG = "https://glowjournal.co.nz/reviews/lip-balms-tested";
const FORUM = "https://www.reddit.com/r/newzealand/comments/abc/lip_balm/";
const SHOP = "https://www.farmers.co.nz/beauty/lip-care";
const RIVAL_BLOG = "https://tuibotanicals.co.nz/blogs/journal/best-lip-balm";
const OWN = "https://kowhaiandco.co.nz/products/manuka-lip-balm";

function answer(question: number, engine: CheckEngine, run: number, o: Partial<CheckAnswer>): CheckAnswer {
  return { question, engine, run, ok: true, empty: false, named: false, position: null, brands: [], sources: [], snippet: "", ...o };
}

// Q1: rivals win everywhere. Q2: named on ChatGPT only. Q3: named on every assistant (fourth on Perplexity,
// so the score, 41, differs from the ring, 44%). All 18 answers count: 6 per assistant.
export const SAMPLE_ANSWERS: CheckAnswer[] = [
  ...[1, 2].flatMap((run) => [
    answer(0, "chatgpt", run, { brands: ["Tūī Botanicals", "Café Lip Co", "Harbour & Fern"], sources: [src(ROUNDUP, "editorial"), src(SHOP, "retailer")] }),
    answer(0, "gemini", run, { brands: ["Tūī Botanicals", "Pōhutu Skin"], sources: [src(MAG, "editorial"), src(RIVAL_BLOG, "editorial")] }),
    answer(0, "perplexity", run, { brands: ["Café Lip Co", "Tūī Botanicals"], sources: [src(ROUNDUP, "editorial"), src(FORUM, "ugc")] }),
    answer(1, "chatgpt", run, {
      named: true,
      position: 2,
      brands: ["Café Lip Co", "Kōwhai & Co", "Tūī Botanicals"],
      sources: [src(ROUNDUP_2, "editorial"), src(OWN, "brand", true)],
    }),
    answer(1, "gemini", run, { brands: ["Harbour & Fern", "Café Lip Co"], sources: [src(MAG, "editorial")] }),
    answer(1, "perplexity", run, { brands: ["Café Lip Co"], sources: [src(FORUM, "ugc")] }),
    answer(2, "chatgpt", run, { named: true, position: 1, brands: ["Kōwhai & Co", "Tūī Botanicals"], sources: [src(OWN, "brand", true)] }),
    answer(2, "gemini", run, { named: true, position: 3, brands: ["Pōhutu Skin", "Café Lip Co", "Kōwhai & Co"], sources: [src(ROUNDUP, "editorial")] }),
    answer(2, "perplexity", run, {
      named: true,
      position: 4,
      brands: ["Café Lip Co", "Tūī Botanicals", "Pōhutu Skin", "Kōwhai & Co"],
      sources: [src(OWN, "brand", true)],
    }),
  ]),
];

/** The sample's report, built by the same code as every real report (the card shows only part of it). */
export const SAMPLE_REPORT = buildReport(SAMPLE_ANSWERS, SAMPLE_PRODUCT, SAMPLE_MERCHANT_NAMES, {
  descriptionSource: "shopify",
  pageRead: true,
});
