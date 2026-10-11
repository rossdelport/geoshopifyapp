// A fictional finished free check (made-up NZ store, made-up rivals and sites), for the action plan,
// PDF and email tests. Names with macrons, accents and curly quotes on purpose.

import { buildReport } from "../../app/lib/check-report";
import type { AiReady, CheckAnswer, CheckEngine, CheckProduct, CheckQuestion, CheckSource } from "../../app/lib/check-types";

export const sampleProduct: CheckProduct = {
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

export const sampleQuestions: CheckQuestion[] = [
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

// Q1: rivals win everywhere. Q2: named on ChatGPT only. Q3: named on every engine that answered
// (Perplexity failed on Q3 both times).
export const sampleAnswers: CheckAnswer[] = [
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
    answer(1, "perplexity", run, run === 1 ? { empty: true } : { brands: ["Café Lip Co"], sources: [src(FORUM, "ugc")] }),
    answer(2, "chatgpt", run, { named: true, position: 1, brands: ["Kōwhai & Co", "Tūī Botanicals"], sources: [src(OWN, "brand", true)] }),
    answer(2, "gemini", run, { named: true, position: 3, brands: ["Pōhutu Skin", "Café Lip Co", "Kōwhai & Co"], sources: [src(ROUNDUP, "editorial")] }),
    answer(2, "perplexity", run, { ok: false }),
  ]),
];

export const sampleAiReady: AiReady = {
  score: 45,
  checks: [
    {
      id: "audience",
      label: "Says who it’s for",
      pass: false,
      weight: 20,
      reason: "We couldn’t find who it’s for (like “for dry skin” or “ideal for beginners”).",
      fix: "Add one plain line on who it suits, such as “For men with dry skin” or “Ideal for everyday use”.",
    },
    { id: "facts", label: "Key facts are there", pass: true, weight: 20, reason: "We found the size and the price.", fix: "State the size." },
    {
      id: "description",
      label: "Description is specific",
      pass: false,
      weight: 20,
      reason: "The description is only 24 characters.",
      fix: "Write at least a short paragraph of plain facts: what it is, who it’s for, what’s in it and how to use it.",
    },
    {
      id: "faq",
      label: "Has questions and answers",
      pass: false,
      weight: 15,
      reason: "We didn’t find an FAQ or questions and answers on the page.",
      fix: "Add 4 to 6 short questions shoppers ask (size, use, shipping, who it suits) with plain answers.",
    },
    { id: "schema", label: "Product data AI can read", pass: true, weight: 15, reason: "The page’s product data includes the brand, price and stock status.", fix: "Use a theme." },
    {
      id: "origin",
      label: "Says where it ships or is made",
      pass: true,
      weight: 10,
      reason: "The page mentions where it ships or where it’s made.",
      fix: "Add a line like “Made in Melbourne”.",
    },
  ],
};

export const sampleReport = buildReport(sampleAnswers, sampleProduct, ["Kōwhai & Co", "Kowhai and Co"], {
  descriptionSource: "shopify",
  pageRead: true,
  aiReady: sampleAiReady,
});
