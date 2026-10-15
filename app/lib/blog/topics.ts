// What GEO's own blog writes about (Ross, 2026-10-15: practise what we preach). Each topic is written once, in
// order, three a week; when the list runs out the writer proposes new ones that fit the kinds below. Pure.
// Rules for every topic: for Shopify store owners, about getting recommended by AI assistants and the search
// traffic around it, answerable from the knowledge pack (docs/facts.md, docs/geo-research.md, the stories, the
// Ask GEO guide). Never a comparison that names another company's product.

export const BLOG_KINDS = ["comparison", "how-to", "explainer", "checklist", "myths", "data"] as const;
export type BlogKind = (typeof BLOG_KINDS)[number];

export const BLOG_KIND_LABELS: Record<BlogKind, string> = {
  comparison: "Comparison",
  "how-to": "How to",
  explainer: "Explainer",
  checklist: "Checklist",
  myths: "Myths and facts",
  data: "By the numbers",
};

/** What each kind asks the writer for. */
export const BLOG_KIND_NOTES: Record<BlogKind, string> = {
  comparison:
    "A comparison of two or three approaches, channels, page types or AI assistants. One section per side, then a section on which to pick when. Honest about trade-offs; no winner declared without a reason.",
  "how-to": "A step-by-step how-to a store owner can follow this week, each step its own section with what to do and why it works.",
  explainer: "An explainer that answers the question in the title plainly, then the parts of the answer, each as a section a reader could quote on its own.",
  checklist: "A checklist: each section is one thing to check, how to check it (with the free tool where one exists) and what good looks like.",
  myths: "Myths and facts: each section states one common belief, says whether it holds up, and explains why, using only facts from the knowledge pack.",
  data: "A piece built around the numbers in the knowledge pack: what the figures say, what they don't, and what a store should do about it. Every number with its source.",
};

export interface BlogTopic {
  /** Stable key, saved on the post so a topic is never written twice. */
  key: string;
  kind: BlogKind;
  /** The working title; the writer may sharpen it. */
  title: string;
  /** What the piece should cover, for the writer. */
  brief: string;
}

export const BLOG_TOPICS: BlogTopic[] = [
  // First batch: comparisons first (Ross), then a spread of the other kinds.
  {
    key: "chatgpt-vs-google-ai-overviews-vs-perplexity",
    kind: "comparison",
    title: "ChatGPT vs Google AI Overviews vs Perplexity: where shoppers' product questions get answered",
    brief: "How each one answers a buying question, what it quotes (Reddit, roundups, retailers, brand pages), how a store shows up in each, and which to care about first.",
  },
  {
    key: "ai-search-vs-google-seo",
    kind: "comparison",
    title: "AI search vs Google SEO: what actually changes for a Shopify store",
    brief: "What stays the same (clear pages, real answers, being cited), what's different (answers not rankings, a few sources per answer, Reddit's weight), and how to track both: search visits and AI visits side by side.",
  },
  {
    key: "reddit-vs-guides-vs-outreach",
    kind: "comparison",
    title: "Reddit replies vs buying guides vs outreach: which gets a store named by AI first?",
    brief: "The three ways to get mentioned where AI reads: honest Reddit replies (as yourself), guide pages on your own site, and pitching the sites AI already quotes. Speed, effort, durability, and how to do all three honestly.",
  },
  {
    key: "product-faqs-vs-long-descriptions",
    kind: "comparison",
    title: "Product FAQs vs long descriptions: what AI assistants actually quote",
    brief: "Why self-contained question-and-answer blocks get lifted into answers, what a long description does well, and how to use both on a product page.",
  },
  {
    key: "how-to-check-if-chatgpt-recommends-your-store",
    kind: "how-to",
    title: "How to check whether ChatGPT recommends your store (in 15 minutes)",
    brief: "Write the buying questions your shoppers ask, ask each AI assistant twice, note who it names and which sites it quotes, and keep a simple score. Mention the free AI Visibility Checker.",
  },
  {
    key: "what-sites-does-ai-trust",
    kind: "explainer",
    title: "Which websites do AI assistants trust when they recommend products?",
    brief: "The kinds of pages that get quoted (roundups, retailers, Reddit, review sites, brand pages), why, and how a store finds the exact sites quoted for its own questions.",
  },
  {
    key: "ai-ready-product-page-checklist",
    kind: "checklist",
    title: "The AI-ready product page: a 10-point checklist",
    brief: "Who it's for, key attributes, sizes and materials, use cases, availability and shipping, FAQs, structured data, crawlable, fresh, honest. Point to the free tools where they help.",
  },
  {
    key: "ai-shopping-myths",
    kind: "myths",
    title: "Five myths about getting recommended by ChatGPT",
    brief: "Myths such as: you can pay for a mention; stuffing keywords works; one good answer means you've made it; AI answers never change; only big brands get named.",
  },
  {
    key: "how-many-people-ask-chatgpt-what-to-buy",
    kind: "data",
    title: "How many people ask ChatGPT what to buy? The numbers, with sources",
    brief: "Only the figures in the facts sheet: messages a day, the share about purchasable products, what that is as a count, and the honest caveats about US-only and messages versus people.",
  },
  {
    key: "how-to-write-a-reddit-reply-as-a-store-owner",
    kind: "how-to",
    title: "How to reply on Reddit as a store owner without getting banned",
    brief: "Say who you are, answer the question first, mention your product once if it fits, never pose as a customer, and why AI assistants quote Reddit so much.",
  },
  {
    key: "buying-guides-that-ai-quotes",
    kind: "how-to",
    title: "How to write a buying guide that AI assistants quote",
    brief: "Strict question-and-answer form, a short direct answer first, sections that stand alone, real product picks, no made-up facts, and refreshing it.",
  },
  {
    key: "why-ai-answers-change",
    kind: "explainer",
    title: "Why ChatGPT recommends your store one day and not the next",
    brief: "Answers vary from run to run; why we ask each question twice and report averages; what a trend means versus a single answer.",
  },
  {
    key: "track-ai-sales-shopify",
    kind: "how-to",
    title: "How to see which Shopify orders came from ChatGPT",
    brief: "utm_source=chatgpt.com on ChatGPT links, referrers from the other assistants, a custom pixel in Customer events, and honest limits (Google AI Overviews can't be separated from Google).",
  },
  {
    key: "ai-crawlers-checklist",
    kind: "checklist",
    title: "Is your Shopify store blocking the AI crawlers? A checklist",
    brief: "The bots that matter, what robots.txt does and doesn't do, the pages to test (a product, the home page, a guide), and the free AI Crawler Checker.",
  },
  {
    key: "pitching-sites-ai-quotes",
    kind: "how-to",
    title: "How to pitch the websites AI already quotes (without being spammy)",
    brief: "Find the roundup, read it, find the writer, write a short honest email about why your product fits their page, follow up once, never buy links.",
  },
  {
    key: "small-brand-vs-big-brand-in-ai-answers",
    kind: "explainer",
    title: "Can a small brand get named by ChatGPT next to the big ones?",
    brief: "What the stories show, what AI weighs (clear answers, mentions on trusted sites, Reddit), and where small brands have an edge (specific questions, use cases).",
  },
  {
    key: "ai-overviews-for-ecommerce",
    kind: "explainer",
    title: "What Google AI Overviews mean for a Shopify store",
    brief: "When overviews show for product questions, what they quote, how to check with the free AI Overview Checker, and why they can't be separated from normal Google traffic.",
  },
  {
    key: "faq-schema-vs-faq-text",
    kind: "comparison",
    title: "FAQ schema vs plain FAQ text: which helps with AI assistants?",
    brief: "What schema does for search engines, what the visible text does for AI assistants, and why you want both (with the free FAQ Schema Generator).",
  },
  {
    key: "llms-txt-explained",
    kind: "explainer",
    title: "What is llms.txt, and does your store need one?",
    brief: "The format, what it is for, the honest state of support, and how to check one with the free llms.txt Checker.",
  },
  {
    key: "first-30-days-ai-visibility",
    kind: "checklist",
    title: "Your first 30 days of AI visibility: a week-by-week plan",
    brief: "Week 1 questions and baseline, week 2 product pages, week 3 Reddit and one guide, week 4 outreach and tracking.",
  },
  {
    key: "ai-visibility-score-explained",
    kind: "explainer",
    title: "What an AI visibility score is, and what a good one looks like",
    brief: "Share of answers that name you across questions, assistants and runs, with a bonus for top three; why averages; what moves it.",
  },
  {
    key: "stories-what-brands-did",
    kind: "data",
    title: "What brands that got sales from AI actually did: the pattern across the stories",
    brief: "Only from the stories pages: the common moves (clear answers, mentions, Reddit, product data) and the honest caveats (not GEO customers, self-reported numbers).",
  },
  {
    key: "product-data-vs-blog-content",
    kind: "comparison",
    title: "Product data vs blog content: which matters more to AI shopping assistants?",
    brief: "Structured product facts get a product recommended; guides get a store quoted for a question. When to invest in each.",
  },
  {
    key: "mistakes-stores-make-with-ai-search",
    kind: "myths",
    title: "Seven mistakes Shopify stores make when they try to show up in ChatGPT",
    brief: "Fake reviews, astroturfed Reddit posts, buying links, keyword stuffing, invented claims, ignoring Reddit, never checking.",
  },
];

/** The next unwritten topic, or null when every seed topic has a post. */
export function nextTopic(usedKeys: Iterable<string>): BlogTopic | null {
  const used = new Set(usedKeys);
  return BLOG_TOPICS.find((t) => !used.has(t.key)) ?? null;
}
