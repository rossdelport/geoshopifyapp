// Copy for the AI Visibility Checker (/tools/ai-visibility-checker). Final text from docs/tools/spec.md T7;
// every fact keeps its source comment, and the FAQ array feeds both the visible FAQ and the FAQPage
// JSON-LD, word for word. The tool itself is the free product check: its form (CheckForm) posts to /check
// and the result is the report at /check/:id. This page shows a labelled sample report.
// House rules: plain English, no em dashes, no invented numbers. Pure and browser-safe.

import type { FaqSource, ToolFaqItem } from "../../../components/tool-ui";
import type { SourceType } from "../../sources";

// Primary sources (docs/tools/research/geo-2026.md 2.11, read 11 Oct 2026).
// Chen et al. 2025: AI search shows "a systematic and overwhelming bias towards Earned media (third-party,
// authoritative sources) over Brand-owned and Social content".
const CHEN_2025: FaqSource = { url: "https://arxiv.org/abs/2509.08919", label: "Chen et al. 2025 (study of AI search sources)" };
// Microsoft Bing, 8 Oct 2025 (docs/tools/research/facts-2026.md 5.3): "Avoid vague language ... anchor claims in
// measurable facts." Backs the "pages that state clear facts" half of FAQ 3 (Chen et al. cover the sites half).
const BING_2025: FaqSource = {
  url: "https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers",
  label: "Microsoft Bing on writing for AI answers (2025)",
};
const PRIVACY: FaqSource = { url: "/privacy", label: "GEO privacy policy" };

// Timing: the spec's draft said "about 2 minutes" (from a planning estimate in competitors.md 9, never measured).
// The check's own running page says "usually 3 to 6 min" (check-live.tsx) and docs/copy-deck.md says "a few
// minutes", so the intro says that. test/tools-visibility.test.ts fails if check-live.tsx stops saying 3 to 6.
// "shopper questions", not the spec draft's "real shopper questions": the check writes the 3 questions for the
// product (understandProduct in check.server.ts); they don't come from real searches.
export const INTRO =
  "The AI Visibility Checker is a free tool that asks ChatGPT, Gemini and Perplexity shopper questions about your product and shows whether they recommend it, which brands they name instead, and which websites they trust. It usually takes a few minutes.";

// ---------- the sample report (on load) ----------

/**
 * Above the on-load sample (a made-up store, docs/tools/spec.md 0.8 and T7). The grey "Example" chip in front
 * of it (SampleLabel) says "Example". When R5 is done this becomes "Real example: a check run on {date} for a
 * product from {store}."
 */
export const SAMPLE_LABEL = "Sample report for a made-up store. Your report uses live answers about your product.";

export const SAMPLE = {
  /** The result area's name for screen readers. */
  region: "Sample report",
  /** "Named in 8 of 18 answers" (both numbers from buildReport). */
  named: (named: number, total: number) => `Named in ${named} of ${total} answers`,
  /** The ring's words for screen readers. */
  ring: (brand: string, pct: number, named: number, total: number) => `AI named ${brand} in ${pct}% of answers (${named} of ${total})`,
  ringCaption: "of answers",
  /** "Growing · score 33/100" */
  scoreChip: (label: string, score: number) => `${label} · score ${score}/100`,
  /**
   * Why the ring (44%) and the score (41) differ, as the real report explains it (check-ui.tsx CheckReport).
   * The points are answerPoints in app/lib/score.ts: 1 in the top 3, 2/3 lower down, 1/3 for a link to the
   * brand's own site only; each assistant's average, then the average of the assistants.
   */
  meaningLead: "What this means:",
  meaning: (brand: string, score: number) =>
    `the ring is the share of answers that named ${brand}. The score (${score} out of 100) also counts where it was named: full points in an answer's top 3, two-thirds lower down, and one-third when an answer only links to its website, averaged across the assistants.`,
  byAssistant: "By assistant",
  engineNamed: (named: number, total: number) => `Named in ${named} of ${total}`,
  engineNotNamed: (total: number) => `Not named in ${total === 1 ? "its 1 answer" : `any of ${total} answers`}`,
  engineNoAnswer: "Didn't answer",
  brandsHeading: "Brands named instead",
  brandCount: (count: number, total: number) => `in ${count} of ${total} answers`,
  noBrands: "No other brands were named.",
  sitesHeading: "Sites the answers cite",
  siteCount: (count: number) => `${count} ${count === 1 ? "answer" : "answers"}`,
  ownSite: "Your site",
  noSites: "The answers didn't link to any websites.",
  questionsHeading: (n: number) => `The ${n} questions we asked`,
  questionsNote: "Each asked twice on every assistant.",
  // check-ui.tsx CheckReport shows each answer (the "See what the AI said" snippets) and the AiReadyCard.
  more: "Your report also shows what each assistant said, and how easy your product page is for AI to quote.",
} as const;

/** The type chips, with the labels the free check report uses (check-ui.tsx). */
export const SOURCE_TYPE_CHIPS: Record<SourceType, string> = {
  editorial: "Review site",
  retailer: "Retailer",
  ugc: "Forum or video",
  brand: "Brand site",
  marketplace: "Marketplace",
  other: "Other",
};

// ---------- sections under the button ----------

export const WHAT_IT_CHECKS = [
  "3 shopper questions written for your product, asked twice on each assistant",
  "Whether your brand is named, and how often",
  "The brands named instead of you",
  "The websites the answers cite",
  "How easy your product page is for AI to quote",
];

// Checked against check.server.ts and docs/free-check.md on 11 Oct 2026 (spec T7): readProduct reads the
// page and, for /products/<handle> links, Shopify's /products/<handle>.js; detectCountry works out where the
// store is (the spec's draft said "where the store sells"; the code finds the store's own country);
// understandProduct writes exactly 3 questions; CHECK_RUNS = 2 per assistant; parseAnswer records brands in
// order and cited sites; visibilityScore scores them; scoreAiReady checks who it's for, key facts near the top,
// an FAQ and product data; /check/:id sends noindex and reports are in no sitemap or list.
export const HOW_IT_WORKS = [
  "We read your product page, and Shopify's product data when the store runs on Shopify, work out where the store is, and write 3 questions a shopper there might ask.",
  "We ask ChatGPT, Gemini and Perplexity each question twice, because AI answers change from one run to the next. Two runs give a fairer picture than one.",
  "We record which brands each answer names, in what order, and which websites it cites, then score how often your brand is named.",
  "We also score how easy your page is for AI to quote: who it's for, key facts near the top, an FAQ and product data.",
  "Limits: 3 questions are a small sample, answers change over time, and assistants can answer differently for different people. Reports aren't listed publicly and search engines are told not to index them.",
];

export const FAQS: ToolFaqItem[] = [
  {
    q: "What is AI visibility?",
    a: "AI visibility is how often AI assistants like ChatGPT, Gemini and Perplexity name your brand or product when shoppers ask them what to buy. It's like ranking on Google, except there's no list of ten links: the assistant names a few brands and the sites it trusts.",
  },
  {
    q: "How is this different from other AI visibility checkers?",
    // source: docs/tools/research/competitors.md section 9 (a database lookup of past prompts; readiness scores
    // built from a site's own signals). No competitor is named on the page.
    a: "Many free checkers give a readiness score from your site's code, or look your brand up in a database of past prompts. This one asks the assistants live, with questions written for one product, and shows the actual answers, the brands named and the sites cited.",
  },
  {
    q: "Why does ChatGPT recommend my competitors instead?",
    // source: docs/tools/research/geo-2026.md 2.11 (Chen et al. 2025, earned media bias); docs/geo-research.md
    a: "AI assistants tend to name brands that trusted sites already mention, like review roundups, retailers and forums, and products whose pages state clear facts. Your report lists the sites each assistant cited, which are the places to get your product mentioned, and what to fix on your page.",
    sources: [CHEN_2025, BING_2025],
  },
  {
    q: "Do the results change each time?",
    // source: CHECK_RUNS = 2 (check-types.ts); the report shows both runs of every question.
    a: "Yes. AI answers vary between runs, so we ask every question twice and report both. Answers also change as assistants update and new pages appear, so check again after you make changes.",
  },
  {
    q: "Is it really free?",
    // source: createCheck limits (check.server.ts PER_IP_PER_DAY = 3 good checks per hashed IP in 24 h;
    // codebase-brief 3.6). test/tools-visibility.test.ts fails if that number changes: update this answer too.
    a: "Yes. There's no sign-up and no card. Each check costs us real money to run, so there's a limit of 3 checks per person per day.",
  },
  {
    q: "What does GEO do with my product link?",
    // source: check.$id.tsx sends noindex; RETENTION.publicCheckDays (30) is shown on /privacy.
    a: "We use it to run your check and show your report. Reports aren't listed publicly, search engines are told not to index them, and they're deleted after a set time. Our privacy policy has the details.",
    sources: [PRIVACY],
  },
];

/** The one button under the result (docs/tools/spec.md T7). */
export const CTA = { text: "See the sales AI sends you", href: "/?ref=tool-ai-visibility-checker#money" } as const;
