// Free product check: the shapes shared by the server (check.server.ts) and the pages (routes/check.*).
// A visitor pastes a product link, we ask ChatGPT, Gemini and Perplexity real buyer questions,
// and show whether they recommend the product. No install, no sign-up.

import type { SourceType } from "./sources";

export const CHECK_ENGINES = ["chatgpt", "gemini", "perplexity"] as const;
export type CheckEngine = (typeof CHECK_ENGINES)[number];
export const CHECK_QUESTIONS = 3;
export const CHECK_RUNS = 2; // every question twice per engine: answers vary run to run

export const CHECK_COUNTRIES = {
  AU: "Australia",
  NZ: "New Zealand",
  US: "the US",
  GB: "the UK",
  CA: "Canada",
} as const;
export type CheckCountry = keyof typeof CHECK_COUNTRIES;

export type CheckStatus = "queued" | "reading" | "asking" | "writing" | "done" | "failed";

export interface CheckProduct {
  url: string; // cleaned product URL
  domain: string; // e.g. coolabahgrooming.com.au
  title: string;
  brand: string; // the brand name shoppers know
  productType: string | null;
  category: string; // short plain category, e.g. "beard oil"
  description: string; // plain text, max ~1,500 chars
  price: string | null; // e.g. "34.00"
  currency: string | null; // e.g. "AUD"
  image: string | null; // absolute https URL
  isShopify: boolean;
  shopDomain: string | null; // xxx.myshopify.com when the page shows it
  hasProductSchema: boolean; // page has JSON-LD Product data
}

export interface CheckQuestion {
  text: string; // how a shopper would ask an AI assistant
  keyword: string; // the same need as a short search
}

export interface CheckSource {
  url: string;
  domain: string;
  title: string | null;
  type: SourceType;
  isOwn: boolean; // the product's own website
}

export interface CheckAnswer {
  question: number; // index into questions
  engine: CheckEngine;
  run: number; // 1 or 2
  ok: boolean; // false when the engine failed after its backup provider
  empty: boolean; // the engine gave no answer
  named: boolean; // the answer names the product or its brand
  position: number | null; // rank among the brands named (1 = first)
  brands: string[]; // brands named, in order (max 8)
  sources: CheckSource[]; // max 8
  snippet: string; // first ~700 characters of the answer, plain text
}

export interface CheckReport {
  score: number; // 0-100, same formula as the app (score.ts)
  label: string; // Not named yet | Rarely named | Weak | Growing | Strong
  namedCount: number; // ok answers that name the product
  answerCount: number; // answers that came back
  byEngine: Record<CheckEngine, { named: number; total: number; score: number }>;
  competitors: { name: string; count: number; share: number }[]; // top 6; share = count / answerCount
  sources: { domain: string; type: SourceType; count: number; isOwn: boolean; exampleUrl: string }[]; // top 8
  tips: { title: string; body: string }[]; // 2-4 quick wins, based only on what we saw
  summary: string; // one or two plain sentences
}

export interface CheckView {
  id: string;
  status: CheckStatus;
  step: string; // plain-English progress line
  country: CheckCountry;
  createdAt: string; // ISO date
  product: CheckProduct | null;
  questions: CheckQuestion[];
  total: number; // answers planned
  done: number; // answers finished (ok or failed)
  answers: CheckAnswer[]; // filled when done
  report: CheckReport | null;
  error: string | null; // plain English, safe to show
  installUrl: string; // /auth/login?shop=... when we know the store, else /auth/login
}

export type CreateCheckResult = { ok: true; id: string } | { ok: false; error: string };

export const isCheckCountry = (c: string): c is CheckCountry => c in CHECK_COUNTRIES;
