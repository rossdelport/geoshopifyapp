// Copy for the AI Bot Checker (/tools/ai-bot-checker). Final text from docs/tools/spec.md T6; every fact keeps
// its source comment, and the FAQ array feeds both the visible FAQ and the FAQPage JSON-LD, word for word.
// The checks live in copy-check.ts, which builds its sentences from the helpers here.
// House rules: plain English, no em dashes, no invented numbers. This tool is not an AI detector: no copy
// here may give a percentage, say a text was written by AI or by a person, or say anything was "detected".
// Pure and browser-safe.

import type { FaqSource, ToolFaqItem } from "../../../components/tool-ui";
import { plural } from "../format";

// Primary sources (docs/tools/research/facts-2026.md section 5, all read 11 Oct 2026).
const OPENAI_CLASSIFIER: FaqSource = {
  url: "https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/",
  label: "OpenAI: AI text classifier (withdrawn July 2023)",
};
const GOOGLE_GEN_AI: FaqSource = {
  url: "https://developers.google.com/search/docs/fundamentals/using-gen-ai-content",
  label: "Google Search Central: using generative AI content",
};
const MICROSOFT_AI_ANSWERS: FaqSource = {
  url: "https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers",
  label: "Microsoft Advertising blog, October 2025",
};
const EPOCH_DETECTORS: FaqSource = { url: "https://epoch.ai/data-insights/ai-detectors-false-negatives", label: "Epoch AI, July 2026" };
const STANFORD_DETECTORS: FaqSource = { url: "https://arxiv.org/abs/2304.02819", label: "Liang et al. (Stanford), 2023" };

export const INTRO =
  "The AI Bot Checker is a free tool that checks whether your product description reads like generic, bot-style copy: filler phrases, hype words and missing facts. It doesn't guess who wrote it, because no tool can prove that. It shows you what to fix.";

/** Directly under the form, always visible. <!-- source: facts §5.1, ready line §7 --> */
export const HONESTY = {
  lead: "Not an AI detector.",
  rest: "No tool can prove who wrote a piece of text. This check looks for vague patterns and missing facts, whoever wrote it.",
} as const;

// ---------- the forms ----------

export const FORM = {
  textLabel: "Paste a product description",
  submit: "Check my copy",
  // Shown once JavaScript runs: the check then happens in the browser (privacy page, "Free tools").
  // "Pasted here": what's typed in the link box below is sent, to read that page.
  live: "The result updates as you type, right in your browser. Text you paste here isn't sent to us.",
  urlLabel: "Or paste a product link",
  urlPlaceholder: "yourstore.com/products/...",
  urlSubmit: "Check link",
} as const;

/** Next to the grey "Example" chip while the made-up sample is in the box. */
export const SAMPLE_LABEL = "Example description (made up). Paste your own above to check it.";

/** The longest text we check (docs/tools/spec.md T6). */
export const MAX_TEXT = 20_000;

/** Errors for the link form. A marketplace link gets normalizeCheckUrl's own copy. */
export const URL_COPY = {
  noDescription: "We couldn't find a product description on that page. Paste the text instead.",
} as const;

// ---------- the result ----------

export type VerdictId = "specific" | "mixed" | "generic";

/** Never a percentage, never "written by AI". The thresholds are in HOW_IT_WORKS. */
export const VERDICT: Record<VerdictId, string> = {
  specific: "Specific and clear",
  mixed: "Some specifics, some filler",
  generic: "Sounds generic",
};

/** The chip beside the verdict. "Needs work", not "Needs facts": a text with facts can still sound generic (too much filler). */
export const VERDICT_CHIP: Record<VerdictId, string> = {
  specific: "Clear",
  mixed: "Could be clearer",
  generic: "Needs work",
};

/**
 * With no vague phrases at all, the headline says what's missing instead: "Some specifics, some filler" or
 * "Sounds generic" would name filler that isn't there (a 38-word Allbirds description with 0 vague phrases
 * and 2 facts got "Some specifics, some filler"). Same verdicts and thresholds, only the words change.
 */
export const VERDICT_NO_FILLER: Record<Exclude<VerdictId, "specific">, { label: string; chip: string }> = {
  mixed: { label: "Clear, but missing key facts", chip: "Add facts" },
  generic: { label: "Missing most key facts", chip: "Needs facts" },
};

/** The headline and chip for a verdict, worded from what was found. */
export function verdictWords(id: VerdictId, vague: number): { label: string; chip: string } {
  if (id !== "specific" && vague === 0) return VERDICT_NO_FILLER[id];
  return { label: VERDICT[id], chip: VERDICT_CHIP[id] };
}

/** The line under the verdict: "12 vague phrases, 0 of 7 key facts found." */
export const verdictLine = (vague: number, facts: number) => `${plural(vague, "vague phrase")}, ${facts} of 7 key facts found.`;

export const RESULT = {
  ready: "Your result is ready.",
  empty: "Paste a product description to check it.",
  /** A post without JavaScript that hit a limit: the error shows under the form. */
  blocked: "We couldn't check that just now.",
  notEnglish: "This check only reads English.",
  notEnglishMore: "We still counted the words and sentences below.",
  textHeading: "Your text, with vague phrases marked",
  textNone: "No vague phrases from our lists in your text.",
  phrasesHeading: "Phrases to rewrite",
  phrasesIntro: "From our own list of phrases common in generic product copy, plus hype words with no fact in the same sentence.",
  times: (n: number) => `${n} times`,
  kind: { filler: "Filler phrase", hype: "Hype word, no fact nearby" },
  kindMany: { filler: "Filler phrases", hype: "Hype words, no fact nearby" },
  factsHeading: "Facts shoppers and AI assistants look for",
  factsIntro: "Each missing fact is a question for you. Answer only with what's true for your product.",
  found: "Found",
  missing: "Missing",
  foundLine: (match: string) => `We found: “${match}”`,
  numbersHeading: "In numbers",
  numbers: {
    words: "Words",
    sentences: "Sentences",
    average: "Average sentence length",
    facts: "Key facts found",
    vague: "Vague phrases",
  },
  wordsValue: (n: number) => plural(n, "word"),
  factsValue: (n: number) => `${n} of 7`,
  tipsHeading: "Tips",
  rewriteHeading: "Example rewrite (made up)",
  rewriteNote: "The same made-up beard oil, rewritten with plain facts. A real rewrite should only use facts that are true for your product.",
  before: "Before",
  after: "After",
  /** Under the result after a product link was read. readProduct keeps the first 1,500 characters. */
  fromLink: (domain: string, clipped: boolean, summaryOnly: boolean) =>
    summaryOnly
      ? `We only found the short summary on ${domain}, not the full description. Paste the full text above for a better check.`
      : clipped
        ? `We checked the first 1,500 characters of the description on ${domain}.`
        : `We checked the description on ${domain}.`,
} as const;

/** Notes about what was checked, shown above the result. */
export const NOTES = {
  cut: "That's very long for a product description. We checked the first 20,000 characters.",
  html: "We took out the HTML tags and checked the text.",
} as const;

// ---------- the 7 facts ----------

export type FactId = "who" | "size" | "materials" | "use" | "care" | "included" | "origin";

/** In page order. A missing fact becomes the question, never an invented answer. */
export const FACTS: { id: FactId; label: string; question: string }[] = [
  { id: "who", label: "Who it's for", question: "Who is it for? For example: men with dry skin, beginners, sensitive skin." },
  { id: "size", label: "Size, amount or dimensions", question: "What size or amount is it?" },
  { id: "materials", label: "Materials or ingredients", question: "What is it made of, or what's in it?" },
  { id: "use", label: "How to use it", question: "How do you use it?" },
  { id: "care", label: "Care or storage", question: "How do you care for it or store it?" },
  { id: "included", label: "What's included", question: "What comes in the box?" },
  { id: "origin", label: "Where it's made or ships from", question: "Where is it made, and where do you ship?" },
];

// ---------- why and how, for each kind of phrase ----------

export type FillerGroup = "opener" | "audience" | "quality" | "push" | "filler";
export type HypeGroup = "quality" | "new" | "eco" | "praise" | "verb";

/** Filler phrases (our own list), by kind. */
export const FILLER_COPY: Record<FillerGroup, { why: string; how: string }> = {
  opener: {
    why: "A stock phrase that could describe almost any product.",
    how: "Say what it does in plain words, like what it's for and how it works.",
  },
  audience: {
    why: "It talks to everyone, so it tells no one who it's for.",
    how: "Name who it's for, like “for men with dry skin” or “for beginners”.",
  },
  quality: {
    why: "It sounds nice but names nothing a shopper can check.",
    how: "Name the actual ingredients or materials.",
  },
  push: {
    why: "A sales line that adds no facts.",
    how: "Cut it, or swap it for a fact shoppers ask about, like the size or how to use it.",
  },
  filler: {
    why: "A filler word that's common in generic copy.",
    how: "Say exactly what it does or what it has.",
  },
};

/** Hype words with no fact in the same sentence, by kind. */
export const HYPE_COPY: Record<HypeGroup, { why: string; how: string }> = {
  quality: {
    why: "Says nothing a shopper can check.",
    how: "Say what makes it better, like the material or where it's made.",
  },
  // Microsoft: "Saying something is 'next-gen' or 'cutting-edge' without context" is an unanchored claim.
  new: {
    why: "Says it's new or better without saying how.",
    how: "Name what's actually different, like an ingredient, a feature or a number.",
  },
  // Microsoft: "Terms like innovative or eco mean little without specifics."
  eco: {
    why: "“Eco” means little without specifics.",
    how: "Say what makes it better for the planet, like recycled materials or plastic-free packaging, but only if it's true.",
  },
  praise: {
    why: "Praise with no fact behind it.",
    how: "Show it with a fact instead, like a size, an ingredient or who it suits.",
  },
  verb: {
    why: "A big word that doesn't say what the product does.",
    how: "Say what it does in plain words.",
  },
};

// ---------- tips ----------

export const TIPS = {
  wall: "There's a block of more than 120 words with no line break. Break it into short paragraphs or a list.",
  longSentences: (n: number) =>
    `${n === 1 ? "1 sentence is" : `${n} sentences are`} over 35 words. Split long sentences so each one gives one fact.`,
  // <!-- source for symbols and dashes: Microsoft Advertising blog, 8 Oct 2025 -->
  symbols: (found: string) =>
    `Your text uses decorative symbols (${found}). Microsoft's Bing team advises against arrows, stars and strings like !!! in copy for AI answers. Use plain words.`,
  dashes: "Your text uses long dashes. Microsoft's Bing team advises being careful with them. A full stop or a comma usually reads more clearly.",
  repeat: (phrase: string, n: number) => `You use “${phrase}” ${n} times. Say it once and use the space for another fact.`,
  short: "Too short to give shoppers and AI assistants much to repeat.",
} as const;

export const ANNOUNCE = {
  link: (verdict: string) => `${RESULT.ready} ${verdict}.`,
} as const;

// ---------- the page ----------

export const WHAT_IT_CHECKS = [
  "Filler phrases that make copy sound generic",
  "Hype words with no fact to back them up",
  "7 facts shoppers and AI assistants ask about, and which are missing",
  "Long sentences, walls of text and decorative symbols",
];

export interface HowItem {
  text: string;
  source?: FaqSource;
}

export const HOW_IT_WORKS: HowItem[] = [
  {
    text: "The check runs in your browser. Pasted text isn't sent to us, unless JavaScript is off: then it's sent to our server once to build the result, and not kept. If you paste a product link, our server reads that page once.",
  },
  {
    text: "We look for three things: filler phrases common in generic product copy, hype words with no fact in the same sentence, and which of 7 key facts are missing.",
  },
  // <!-- source: Microsoft Advertising blog, 8 Oct 2025 (facts §5.3) -->
  {
    text: "The hype words innovative, eco, next-gen and cutting-edge, and the advice on decorative symbols and dashes, come from Microsoft Bing's guidance on writing for AI answers (October 2025). The rest of the lists are our own judgement.",
    source: MICROSOFT_AI_ANSWERS,
  },
  {
    text: "Verdict: 'Specific and clear' means at least 4 of the 7 facts and no more than 1 vague phrase per 100 words. 'Sounds generic' means 1 fact or fewer, or 4 or more vague phrases per 100 words. A text under 100 words counts as 100 words, so one vague phrase doesn't outweigh the facts in a short description. With no vague phrases at all, the headline says what's missing instead: 'Clear, but missing key facts' for 2 or 3 facts, 'Missing most key facts' for 1 or none.",
  },
  {
    text: "It's a pattern check in English. It can miss things and can flag a fair use of a word. It never says whether a person or an AI wrote the text.",
  },
];

export const FAQS: ToolFaqItem[] = [
  {
    q: "Can this tell if AI wrote my product description?",
    // <!-- source: https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/ (facts §5.1) -->
    a: "No, and no tool can prove it. OpenAI withdrew its own AI-text classifier in July 2023 because of its low accuracy, and said it was very unreliable on texts under 1,000 characters, which most product descriptions are. This checker looks at what matters to shoppers instead: vague phrases and missing facts.",
    sources: [OPENAI_CLASSIFIER],
  },
  {
    q: "Is it bad to use AI to write product descriptions?",
    // <!-- source: https://developers.google.com/search/docs/fundamentals/using-gen-ai-content (updated 1 Oct 2026) -->
    a: "Not by itself. Google says AI-written content is fine when it's accurate and useful, and that using AI to mass-produce pages without adding value can break its spam policies. Check every fact, add details only you know, and never let a tool invent ingredients, sizes or claims.",
    sources: [GOOGLE_GEN_AI],
  },
  {
    q: "Why do vague words hurt with AI shopping assistants?",
    // <!-- source: Microsoft Advertising blog, 8 Oct 2025 -->
    a: "AI assistants answer buying questions with facts they can repeat, like “for dry skin”, “30 ml” or “made with jojoba”. Microsoft's Bing team advises avoiding words like “innovative” or “eco” without specifics and anchoring claims in measurable facts: “42 dB dishwasher” instead of “quiet dishwasher”.",
    sources: [MICROSOFT_AI_ANSWERS],
  },
  {
    q: "What should a good product description include?",
    // <!-- our advice, consistent with ai-ready.ts "key facts near the top" -->
    a: "Who it's for, what it's made of, its size or amount, how to use and care for it, what's included, and where it's made or ships from. Put who it's for and the key facts in the first two sentences, then the brand story.",
  },
  {
    q: "Are AI detectors accurate?",
    // <!-- source: https://epoch.ai/data-insights/ai-detectors-false-negatives ; https://arxiv.org/abs/2304.02819 (facts §5.1) -->
    a: "They've improved on long texts but still make mistakes. In Epoch AI's July 2026 test on 500-word passages, leading detectors rarely flagged human writing but missed 10% to 18% of AI text written to imitate a real author. A 2023 Stanford study found detectors flagged essays by non-native English writers as AI-written 61% of the time on average. Short product copy is harder still.",
    sources: [EPOCH_DETECTORS, STANFORD_DETECTORS],
  },
];

/** The one button under the result. True: GEO's fix engine rewrites descriptions from catalog facts only, and the store approves (CLAUDE.md §11). */
export const CTA = {
  text: "See how GEO rewrites product pages with your facts",
  href: "/?ref=tool-ai-bot-checker#how",
} as const;
