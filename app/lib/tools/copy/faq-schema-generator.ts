// Copy for the FAQ Schema Generator (/tools/faq-schema-generator). Final text from docs/tools/spec.md T4;
// every fact keeps its source comment, and the FAQ array feeds both the visible FAQ and the FAQPage
// JSON-LD, word for word. The checks' words live here too; faq-schema.ts picks which ones to show.
// House rules: plain English, no em dashes, no invented numbers, and never a promise that FAQ markup
// gets rich results or gets a store into AI answers. Pure and browser-safe.

import type { FaqSource, ToolFaqItem } from "../../../components/tool-ui";

// Primary sources, all read 11 Oct 2026 (docs/tools/research/facts-2026.md section 3).
// Google's changelog: 14 Sep 2023 (FAQ results only for well-known government and health sites),
// 8 May 2026 ("This feature will no longer appear in Google Search starting May 7, 2026") and
// 15 Jun 2026 (FAQ documentation removed).
const GOOGLE_UPDATES: FaqSource = { url: "https://developers.google.com/search/updates", label: "Google Search Central" };
// "Making sure your structured data matches the visible text on the page" (updated 10 Dec 2025).
const GOOGLE_AI_FEATURES: FaqSource = { url: "https://developers.google.com/search/docs/appearance/ai-features", label: "Google: AI features and your website" };
// "there's no special schema.org markup you need to add" (updated 10 Jul 2026).
const GOOGLE_AI_GUIDE: FaqSource = { url: "https://developers.google.com/search/docs/fundamentals/ai-optimization-guide", label: "Google's AI optimization guide" };
// Microsoft Advertising blog, 8 Oct 2025: Q&A pairs "can often be lifted word for word into AI-generated
// responses"; "Don't hide important answers in tabs or expandable menus: AI systems may not render hidden content."
const MICROSOFT_AI_ANSWERS: FaqSource = {
  url: "https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers",
  label: "Microsoft Advertising",
};
// Google's FAQ doc as last published ("Last updated 2025-12-10"), archived 1 Mar 2026: "Don't use FAQPage for
// advertising purposes"; "mark up only one instance of that FAQ for your entire site".
const GOOGLE_FAQ_ARCHIVED: FaqSource = {
  url: "https://web.archive.org/web/20260301000000id_/https://developers.google.com/search/docs/appearance/structured-data/faqpage",
  label: "Google's FAQ rules (archived March 2026)",
};
// schema.org: "A FAQPage is a WebPage presenting one or more 'Frequently asked questions'".
const SCHEMA_ORG_FAQ: FaqSource = { url: "https://schema.org/FAQPage", label: "schema.org FAQPage" };
// Shopify Help Center, "Creating custom metafield definitions" (read 11 Oct 2026): open a product, then in
// the Metafields section click Add definition; Name, Namespace and key (made from the name, like custom.color),
// Select type. JSON is listed under Advanced in "Metafield content types and values".
const SHOPIFY_METAFIELDS: FaqSource = {
  url: "https://help.shopify.com/en/manual/custom-data/metafields/metafield-definitions/creating-custom-metafield-definitions",
  label: "Shopify Help Center",
};

export const INTRO =
  "The FAQ Schema Generator is a free tool that turns your questions and answers into FAQPage structured data (JSON-LD), plus a ready-to-paste Shopify section that shows the same FAQ on your page. It runs in your browser.";

/** Right under the intro, always visible. source: https://developers.google.com/search/updates (8 May and 15 Jun 2026 entries; facts 3.1) */
export const NOTE = {
  lead: "Good to know:",
  text: "Google stopped showing FAQ rich results on 7 May 2026. FAQ markup is still valid, and clear questions and answers on your page still help shoppers and AI tools. Only mark up questions that are visible on the page, word for word.",
  source: GOOGLE_UPDATES,
} as const;

// ---------- the form ----------

/** Above the on-load example (it is made up, and the page says so). */
export const SAMPLE_LABEL = "Example questions for a made-up beard oil. Replace them with your own.";

export const FORM = {
  question: (n: number) => `Question ${n}`,
  answer: (n: number) => `Answer ${n}`,
  remove: "Remove",
  moveUp: "Move up",
  add: "Add a question",
  startersLead: "Or add a common question:",
  submit: "Make my code",
  // Shown once JavaScript runs: everything then happens in the browser (privacy page, "Free tools").
  live: "The code below updates as you type, right in your browser.",
  // Without JavaScript the rows can't grow, so each post comes back with up to 4 more empty rows (20 at most).
  moreRows: "Need more questions? Make my code gives you 4 more empty rows.",
  // Counter under each field, like "120/300" (screen readers hear "120/300 characters").
  count: (n: number, max: number) => `${n}/${max}`,
} as const;

/** Starter questions: they add a row with the question filled in and the answer empty, never an invented answer. */
export const STARTERS = [
  "How long does shipping take?",
  "What's your returns policy?",
  "What size should I get?",
  "What is it made of?",
  "How do I use it?",
] as const;

export const LIMIT_COPY = {
  maxRows: "Add up to 20 questions.",
  tooBig: "That's too much to send at once. Try fewer or shorter answers.",
  tooLong: "Questions can be up to 300 characters, and answers up to 2,000.",
} as const;

/** Read out politely after a row changes. */
export const ANNOUNCE = {
  added: (n: number) => `Question ${n} added.`,
  removed: (n: number) => `Question ${n} removed.`,
  moved: (n: number) => `Moved to question ${n}.`,
} as const;

// ---------- the checks (shown inline above the code) ----------

/** "2", "2 and 5", "2, 4 and 5". */
export const numberList = (ns: number[]) => (ns.length < 2 ? ns.join("") : `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`);
const many = (ns: number[]) => ns.length > 1;

export const CHECKS = {
  noAnswer: (ns: number[]) =>
    many(ns) ? `Questions ${numberList(ns)} have no answer, so we left them out.` : `Question ${ns[0]} has no answer, so we left it out.`,
  noQuestion: (ns: number[]) =>
    many(ns) ? `Answers ${numberList(ns)} have no question, so we left them out.` : `Answer ${ns[0]} has no question, so we left it out.`,
  duplicate: (a: number, b: number) => `Questions ${a} and ${b} are the same.`,
  // source: Google FAQ doc archived 1 Mar 2026 (facts 3.3): "Don't use FAQPage for advertising purposes."
  advert: (ns: number[]) =>
    `${many(ns) ? `Answers ${numberList(ns)} read` : `Answer ${ns[0]} reads`} like an advert. Google's old FAQ rules said not to use FAQ markup for advertising.`,
  html: (ns: number[]) =>
    `${many(ns) ? `Answers ${numberList(ns)} have` : `Answer ${ns[0]} has`} HTML tags. We'll show tags as plain text. Write plain sentences.`,
  // our advice; matches the AI-ready check's fix line in app/lib/ai-ready.ts ("Add 4 to 6 short questions")
  fewQuestions: "Most product FAQs answer 4 to 6 questions.",
  questionMark: (ns: number[]) =>
    `${many(ns) ? `Questions ${numberList(ns)} don't` : `Question ${ns[0]} doesn't`} end with a question mark. Write questions the way shoppers ask them.`,
} as const;

/** Words that make an answer read like an advert (spec T4). Matched in lower case. */
export const ADVERT_WORDS = ["% off", "discount code", "buy now", "limited time", "sale ends"] as const;

/** The chip in front of each check. */
export const CHECK_CHIP = { warn: "Check this", info: "Good to know", tip: "Tip" } as const;

// ---------- the result ----------

export const RESULT = {
  ready: (label: string) => `${label} ready`,
  readyChip: "Ready",
  empty: "Add at least one question and answer",
  emptyChip: "Waiting",
  emptyHint: "Type a question and its answer above, and your code shows up here.",
  outputsLabel: "Your code",
  previewTitle: "How the FAQ looks on your page",
  done: "Your code is ready.",
} as const;

/** The three outputs (spec T4, "Output"). `tab` is the switcher's short label. */
export const OUTPUTS = {
  jsonLd: {
    id: "faq-out-jsonld",
    tab: "Any website",
    title: "JSON-LD for any website",
    lead: "Add this to the page that shows these questions and answers, word for word. Use it on one page only, not on every page of your site.",
    copyLabel: "JSON-LD script tag",
  },
  section: {
    id: "faq-out-section",
    tab: "Shopify section",
    title: "Shopify section (shows the FAQ and adds the markup)",
    // exact steps from the spec
    steps:
      "In Shopify admin, go to Online Store, then Themes. Next to your live theme, click the three dots and choose Edit code. In the Sections folder, add a new section called geo-faq and replace its contents with this code. Save. Then click Customize, open the page or product template you want, choose Add section, and pick FAQ.",
    after:
      "Your questions are already filled in. Change them later in Customize: the FAQ on the page and the markup change together.",
    // Google's old FAQ rules (archived 1 Mar 2026): mark up a repeated FAQ only once on the site.
    tip: "Store-wide questions, like shipping and returns, belong on one page, such as your FAQ or shipping page. A product template shows the same section on every product, so for questions about one product, use the product metafield version.",
    filename: "sections/geo-faq.liquid",
    copyLabel: "Section file",
  },
  metafield: {
    id: "faq-out-metafield",
    tab: "Each product",
    title: "A different FAQ on each product (product metafield)",
    lead: "Each product keeps its own questions in a product field, and one section shows them with the markup.",
    // source: SHOPIFY_METAFIELDS (Shopify Help Center, read 11 Oct 2026)
    steps: [
      "Create the field once. In Shopify admin, open any product. In the Metafields section, click Add definition. Name it FAQ, check that Namespace and key says custom.faq, click Select type and choose JSON (under Advanced), then save.",
      "Fill it in for each product. Open the product, click its FAQ field, paste that product's questions and answers in the format below, and save.",
      "Add the section once. In Edit code, add a new section called geo-product-faq, replace its contents with the code below and save. Then click Customize, open your product template, choose Add section, and pick Product FAQ. Products with an empty FAQ field show nothing.",
    ],
    stepsSource: SHOPIFY_METAFIELDS,
    valueLabel: "Value for this product's FAQ field (JSON)",
    sectionLabel: "Section file",
    filename: "sections/geo-product-faq.liquid",
  },
} as const;

/** The no-JS hint above the outputs ("all three are below"). */
export const OUTPUTS_NOJS = "Three ways to add it: pick the one that suits your site.";

// ---------- the page ----------

export const WHAT_IT_CHECKS = [
  "Builds FAQPage JSON-LD that follows schema.org",
  "Gives you a Shopify section that shows the FAQ and adds the markup from the same text",
  "Flags empty, repeated or advert-style answers",
  "Escapes your text so it can't break your page",
];

export interface HowItem {
  text: string;
  source?: FaqSource;
}

export const HOW_IT_WORKS: HowItem[] = [
  {
    text: "Everything runs in your browser. Your questions aren't sent to us, unless JavaScript is off in your browser: then the form is sent to our server once to build the code, and nothing is kept.",
  },
  {
    // sources: schema.org FAQPage; Google FAQ doc archived 1 Mar 2026 (facts 3.3)
    text: "The output follows schema.org's FAQPage type and the properties Google last documented: a FAQPage with a mainEntity list, each Question with a name and an acceptedAnswer, and each Answer with text.",
    source: SCHEMA_ORG_FAQ,
  },
  { text: "We escape quotes, line breaks and the characters that could break a script tag." },
  { text: "The Shopify section shows the FAQ and adds the markup from the same text, so they always match." },
  {
    // source: https://developers.google.com/search/updates (facts 3.1)
    text: "Google no longer shows FAQ rich results (since 7 May 2026), so we don't promise any change in how your page looks in Google.",
    source: GOOGLE_UPDATES,
  },
];

export const FAQS: ToolFaqItem[] = [
  {
    q: "Does FAQ schema still work in 2026?",
    // source: https://developers.google.com/search/updates (facts 3.1)
    a: "The markup is still valid, but Google no longer shows FAQ rich results. Google limited them to well-known government and health sites in 2023, stopped showing them on 7 May 2026, and removed the documentation in June 2026. Clear questions and answers on the page still help shoppers, and AI tools can read them.",
    sources: [GOOGLE_UPDATES],
  },
  {
    q: "Is FAQ schema bad for SEO now?",
    // source: facts 3.2 (Google AI features doc, structured data guidelines)
    a: "We found no statement from Google that FAQ markup harms a page. Google's general rule still applies: structured data must match what's visible on the page. Markup for questions people can't see, or the same FAQ copied onto every page, is what to avoid.",
    sources: [GOOGLE_AI_FEATURES],
  },
  {
    q: "Do AI assistants read FAQs?",
    // sources: Microsoft Advertising blog (8 Oct 2025); Google AI optimization guide (10 Jul 2026)
    a: "Microsoft's Bing team says question-and-answer pairs can often be lifted word for word into AI answers, and warns that answers hidden in tabs or expandable menus may not be read. So keep answers short, factual and visible. Google says its AI features need no special markup.",
    sources: [MICROSOFT_AI_ANSWERS, GOOGLE_AI_GUIDE],
  },
  {
    q: "How do I add FAQ schema to Shopify?",
    a: "The simplest way is the Shopify section above: add it as a new section file in Online Store, Themes, Edit code, then add the FAQ section to a product or page template in the theme editor. It shows the questions and adds the markup from the same text. For a different FAQ on each product, use the product metafield version.",
  },
  {
    q: "Should I put FAQ schema in theme.liquid?",
    // source: Google FAQ doc archived 1 Mar 2026 (facts 3.3)
    a: "No. theme.liquid loads on every page, so the same FAQ markup would appear on pages that don't show those questions. Google's old FAQ rules said to mark up a repeated FAQ only once on your site, and each page's markup should match what that page shows.",
    sources: [GOOGLE_FAQ_ARCHIVED],
  },
  {
    q: "What should my product FAQs answer?",
    // our advice
    a: "The questions shoppers ask before buying: size and fit, what it's made of, how to use it, who it suits, shipping times and returns. Answer with facts, not praise. If you don't know an answer, find out rather than guess.",
  },
];

/**
 * The one button under the result. True: the app writes product FAQs from the store's own product details,
 * the store approves them, and its theme block adds them with the markup (CLAUDE.md section 11).
 */
export const CTA = {
  text: "See how GEO writes FAQs that AI can quote",
  href: "/?ref=tool-faq-schema-generator#how",
  note: "The GEO app writes FAQs for your products from your own product details. You approve them, and it adds them to your store with the markup.",
} as const;
