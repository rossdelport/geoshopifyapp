// Copy for the AI Overview Checker (/tools/ai-overview-checker). Final text from docs/tools/spec.md T1;
// every fact keeps its source comment, and the FAQ array feeds both the visible FAQ and the FAQPage
// JSON-LD, word for word. House rules: plain English, no em dashes, no invented numbers.
// Pure and browser-safe.

import type { ToolFaqItem } from "../../../components/tool-ui";
import type { SourceType } from "../../sources";

export const INTRO =
  "The AI Overview Checker is a free tool that searches Google for you and shows whether Google answered with an AI Overview, which websites it cited, and whether your site is one of them. Results come from Google in the United States.";

// ---------- the form ----------

export const FORM = {
  queryLabel: "What would a shopper type into Google?",
  queryPlaceholder: "best beard oil for dry skin",
  domainLabel: "Your website (optional)",
  domainPlaceholder: "yourstore.com",
  submit: "Check Google",
  busy: "Checking…",
  examplesLabel: "Or try:",
} as const;

/** Example searches under the form. The first is the on-load sample, which the server answers from its cache (aio.server.ts). */
export const EXAMPLES = ["best sunscreen for oily skin", "beard oil for dry skin", "vegan protein powder for women"] as const;

// ---------- errors (docs/tools/spec.md T1, edge cases) ----------

export const QUERY_SHORT = "Type a search, like best beard oil for dry skin.";
export const QUERY_LONG = "Please keep the search under 200 characters.";
export const FAIL_COPY = "Google's results didn't come through this time. Please try again in a minute.";
export const SPEND_COPY = "Our free Google checks are busy today. Please try again tomorrow.";

// ---------- the result ----------

/** "Example result: “best sunscreen for oily skin”, Google US, checked 11 October 2026" */
export const sampleLabel = (query: string, checked: string) => `Example result: “${query}”, Google US, checked ${checked}`;
/** Above a visitor's own result. */
export const liveLabel = (query: string, checked: string) => `Your search: “${query}”, Google US, checked ${checked}`;

export const VERDICT = {
  shown: "Google showed an AI Overview for this search",
  shownChip: "AI Overview",
  none: "No AI Overview for this search",
  noneChip: "None shown",
  line: "Google doesn't show one for every search, and it can change from one search to the next.",
  aiMode: "Google offered an AI Mode answer for this search, not an AI Overview.",
} as const;

/** The "Your site" line, one of these (docs/tools/spec.md T1, result layout 2). */
export const YOUR_SITE = {
  label: "Your site",
  cited: (n: number, total: number) => `Your site is cited: source ${n} of ${total}.`,
  ranksNotCited: (k: number) => `Your site isn't cited, but it ranks #${k} in the normal results below.`,
  notCitedNotRanked: "Your site isn't cited and isn't in the top 10 normal results.",
  // The backup provider gives no normal results, so the rank is unknown.
  notCitedNoRanks: "Your site isn't cited in this overview.",
  noneRanks: (k: number) => `No AI Overview here. Your site ranks #${k} in the normal results.`,
  noneNotRanked: "No AI Overview here. Your site isn't in the top 10 normal results.",
} as const;

export const OVERVIEW = {
  headingStart: "Start of the overview",
  heading: "The overview",
  cutNote: "As Google shows it before “Show more”.",
  noSources: "Google didn't link any sites in this overview.",
} as const;

export const SOURCES_HEADING = "Sites the overview cites";
/** The cited page itself is in the normal results. */
export const ALSO_RANKS = (k: number) => `Also ranks #${k}`;
/** Only another page from the same website is (two cited pages from one site used to both say "Also ranks"). */
export const SITE_RANKS = (k: number) => `Another page from this site ranks #${k}`;
export const NEW_TAB = "(opens in a new tab)";

/** The type chips, with the labels the free check pages use (check-ui.tsx). Unknown types show "Other". */
export const SOURCE_TYPE_CHIPS: Record<SourceType, string> = {
  editorial: "Review site",
  retailer: "Retailer",
  ugc: "Forum or video",
  brand: "Brand site",
  marketplace: "Marketplace",
  other: "Other",
};

export const MEANING_HEADING = "What this means for you";
/** Picked by rule from the cited types; no numbers (docs/tools/spec.md T1, result layout 5). */
export const MEANING = {
  editorial: "Review and roundup pages are cited here. Getting your product onto one of them is the most direct way into this answer.",
  retailer: "Big retailers are cited. If you sell through them, complete product details there help.",
  ugc: "Forum and video pages are cited. Helpful answers in those threads, where you say who you are, can help.",
  brand: "Brand and shop pages are cited directly. Product pages with clear facts near the top give yours the same chance.",
  // Search Console's Generative AI performance report, for all sites since 31 Aug 2026 (geo-2026 §2, seo-2026 §4.4).
  track: "Track this over time for free in Google Search Console's Generative AI performance report.",
} as const;
/** Linked after MEANING.track. */
export const TRACK_SOURCE = { url: "https://support.google.com/webmasters/answer/16984139", label: "Google's guide" };

/** Worded from the real count: Google's first page sometimes holds fewer than 10 normal results. */
export const ORGANIC_HEADING = (n: number) => (n >= 10 ? "Normal results (top 10)" : "Normal results on the first page");
/** This exact page is cited in the overview. */
export const CITED_MARK = "cited";
/** Only another page from the same website is cited. */
export const CITED_SITE_MARK = "another page cited";
export const PAA_HEADING = "People also ask";
export const PAA_LINK = "Answer questions like these with the FAQ Schema Generator";

export const SMALL_PRINT =
  "One search, one moment. AI Overviews change between searches and can differ by country and device. We search Google in the United States, signed out, in English.";

export const ANNOUNCE = {
  busy: "Searching Google…",
  ready: "Your result is ready.",
} as const;

// ---------- the one button ----------

export const CTA = { text: "See how GEO gets you into AI answers", href: "/?ref=tool-ai-overview-checker#how" } as const;

// ---------- sections under the button ----------

export const WHAT_IT_CHECKS = [
  "Whether Google showed an AI Overview for your search",
  "Every site the overview links to, in order",
  "Whether your site is cited, and where it ranks in the normal results",
  "What kind of sites Google trusts for this search",
  "Questions people also ask",
];

export const HOW_IT_WORKS = [
  "We send your search to Google in the United States through a search data provider and read the results page as it loads for a signed-out visitor. If that doesn't answer, we ask a second provider for the AI Overview.",
  "We show the overview as Google displays it before you press “Show more”, every site it links to, and the normal results on the first page (up to 10). Prices and star ratings from Google's shopping cards are left out of the overview text.",
  "If you add your website, we compare it with every cited link and every normal result. Subdomains count, so shop.yourstore.com counts as yourstore.com.",
  "We sort cited pages into types (review site, retailer, forum or video, brand site, marketplace) from the web address. It's a quick guess, not a judgement.",
  "We keep each result for 24 hours, so the same search within a day shows the same answer.",
  // AI Mode vs AI Overviews: https://developers.google.com/search/docs/appearance/ai-features
  "Limits: one search at one moment, from the US, in English. This tool doesn't check AI Mode, which Google says can show different answers and links.",
];

/** Exact text (docs/tools/spec.md T1). `q` and `a` also feed the FAQPage JSON-LD; `sources` show on the page only. */
export const FAQS: ToolFaqItem[] = [
  {
    q: "What is a Google AI Overview?",
    a: "An AI Overview is a short answer written by Google's AI that appears above the normal results for some searches, with links to the pages it used. Google says it shows one when its systems decide generative AI can be especially helpful, so many searches don't get one.",
    // source: https://support.google.com/websearch/answer/14901683 (facts §6.1, §6.3)
    sources: [{ url: "https://support.google.com/websearch/answer/14901683", label: "Google Search Help" }],
  },
  {
    q: "Why didn't my search show an AI Overview?",
    a: "Google only shows an AI Overview when it decides one will help, and the answer can change from one search to the next. Try the search the way a shopper would ask it, as a full question. In Ahrefs' study of 146 million desktop searches (September 2025 data), 57.9% of question searches showed an AI Overview, compared with 20.5% of all searches.",
    // source: https://ahrefs.com/blog/ai-overview-triggers/ (facts §6.2); published 10 Nov 2025
    sources: [{ url: "https://ahrefs.com/blog/ai-overview-triggers/", label: "Ahrefs, 10 November 2025" }],
  },
  {
    q: "How do I get my store cited in AI Overviews?",
    a: "AI Overviews draw on Google's normal search index, so your page has to be indexed and allowed to show a snippet. Then make sure Googlebot can read your product pages, put clear facts near the top of each page, and work on getting your products onto the review and roundup pages AI Overviews already cite. The cited sites in your result are your list of pages to approach.",
    // source: https://developers.google.com/search/docs/appearance/ai-features ; https://developers.google.com/search/docs/fundamentals/ai-optimization-guide
    sources: [
      { url: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google: AI features and your website" },
      { url: "https://developers.google.com/search/docs/fundamentals/ai-optimization-guide", label: "Google: AI optimization guide" },
    ],
  },
  {
    q: "Can I keep my site out of AI Overviews?",
    a: "Yes. In Google Search Console, go to Settings, then Search generative AI, and choose Exclude. That keeps your site out of AI Overviews and AI Mode, and changes take about 1 to 2 days. Blocking Google-Extended in robots.txt doesn't do this: it affects the Gemini app, not Google Search.",
    // source: https://support.google.com/webmasters/answer/16908024 ; Google-Extended: https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers (facts §1.2, §6.3)
    sources: [
      { url: "https://support.google.com/webmasters/answer/16908024", label: "Search Console Help" },
      { url: "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers", label: "Google's crawlers" },
    ],
  },
  {
    q: "Why is my result different from what I see on Google?",
    a: "AI Overviews change between searches and can differ by country and device, and Google personalises AI Mode for signed-in users. We search from the United States, signed out, so your own Google may show something different. Treat each result as one snapshot.",
    // source: https://support.google.com/websearch/answer/16011537 (AI Mode personalisation, facts §6.4). AI Overview personalisation is UNVERIFIED, so it is not claimed.
    sources: [{ url: "https://support.google.com/websearch/answer/16011537", label: "Google Search Help: AI Mode" }],
  },
  {
    q: "Is AI Mode the same as AI Overviews?",
    a: "No. AI Mode is a separate, chat-style way to search Google. Google says AI Mode and AI Overviews may use different models and techniques, so the answers and links can differ. This tool checks AI Overviews only.",
    // source: https://developers.google.com/search/docs/appearance/ai-features
    sources: [{ url: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google: AI features and your website" }],
  },
];
