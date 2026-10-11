// Copy for the AI Crawler Checker (/tools/ai-crawler-checker). Final text from docs/tools/spec.md T2;
// every fact keeps its source comment, and the FAQ array feeds both the visible FAQ and the FAQPage
// JSON-LD, word for word. The bot table, the verdict and the notes live in crawler.ts with the logic.
// House rules: plain English, no em dashes, no invented numbers. Pure and browser-safe.

import type { FaqSource, ToolFaqItem } from "../../../components/tool-ui";
import { TOOL_BOTS } from "../crawler";

// Primary sources, all read 11 Oct 2026 (docs/tools/research/facts-2026.md 1.2 and 1.3).
const OPENAI_BOTS: FaqSource = { url: "https://developers.openai.com/api/docs/bots", label: "OpenAI's crawler page" };
const OPENAI_SEARCH_HELP: FaqSource = { url: "https://help.openai.com/en/articles/9237897-chatgpt-search", label: "OpenAI Help: ChatGPT search" };
const ANTHROPIC_BOTS: FaqSource = {
  url: "https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler",
  label: "Anthropic's crawler page",
};
const GOOGLE_CRAWLERS: FaqSource = { url: "https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers", label: "Google's crawler page" };
const GOOGLE_ROBOTS_SPEC: FaqSource = { url: "https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt", label: "Google's robots.txt rules" };
const GOOGLE_AI_SWITCH: FaqSource = { url: "https://support.google.com/webmasters/answer/16908024", label: "Search Console Help" };
// Google-Agent: user-triggered fetchers "generally ignore robots.txt rules" (facts-2026.md 1.2, page updated 19 Aug 2026).
const GOOGLE_USER_FETCHERS: FaqSource = {
  url: "https://developers.google.com/crawling/docs/crawlers-fetchers/google-user-triggered-fetchers",
  label: "Google's user-triggered fetchers",
};
const PERPLEXITY_BOTS: FaqSource = { url: "https://docs.perplexity.ai/guides/bots", label: "Perplexity's crawler page" };
const APPLE_BOT: FaqSource = { url: "https://support.apple.com/en-us/119829", label: "Apple's crawler page" };
const RFC_9309: FaqSource = { url: "https://www.rfc-editor.org/rfc/rfc9309.html", label: "RFC 9309" };
// Shopify Help Center, "Editing robots.txt.liquid": the default file, the editing steps, and "If you want to
// use the default robots.txt file again, then you can delete your custom robots.txt.liquid file."
const SHOPIFY_ROBOTS_HELP: FaqSource = { url: "https://help.shopify.com/en/manual/promoting-marketing/seo/editing-robots-txt", label: "Shopify Help Center" };
// Shopify dev docs: "Find the theme that you want to edit, and then click ... > Edit code"; the template
// lives in the Templates folder and replaces Shopify's generated robots.txt.
const SHOPIFY_ROBOTS_DEV: FaqSource = { url: "https://shopify.dev/docs/storefronts/themes/architecture/templates/robots-txt-liquid", label: "Shopify's robots.txt.liquid docs" };
// Observed on Shopify's Horizon demo store, 11 Oct 2026 (test/fixtures/tools/robots-shopify-new.txt).
const SHOPIFY_DEMO_ROBOTS: FaqSource = { url: "https://theme-horizon-demo.myshopify.com/robots.txt", label: "Shopify's demo store robots.txt" };

export const INTRO =
  "The AI Crawler Checker is a free tool that reads your site's robots.txt and shows which AI bots, like OpenAI's OAI-SearchBot and GPTBot, may read your pages, which blocks actually hide you from AI answers, and how to fix them on Shopify.";

// ---------- the forms ----------

export const FORM = {
  urlLabel: "Your website or any page on it",
  urlPlaceholder: "yourstore.com",
  submit: "Check my site",
  pasteLabel: "Test a robots.txt before you publish it",
  pasteSubmit: "Test this robots.txt",
  // Shown once JavaScript runs: the check then happens in the browser (privacy page, "Free tools").
  pasteLive: "The result updates as you type, right in your browser.",
  backToPaste: "Test a robots.txt before you publish it",
  backToPasteLead: "Want to try changes first?",
} as const;

/**
 * Above the on-load sample (it is made up, and the page says so). The spec's words are "Example: a made-up
 * robots.txt..."; the grey "Example" chip in front of it (SampleLabel) says "Example", so the text starts after it.
 */
export const SAMPLE_LABEL = "A made-up robots.txt that blocks two bots. Edit it to test your own rules.";
/** On the sample's result card too, so the verdict is never mistaken for a real site's. */
export const SAMPLE_RESULT_LABEL = "The result for the made-up robots.txt above.";

/** The longest robots.txt people can paste. */
export const MAX_PASTE = 100_000;
export const PASTE_TOO_LONG = "That's a very long file. Paste up to 100,000 characters.";

// ---------- the result ----------

export const RESULT = {
  pagesTested: "Pages we tested",
  pagesPasted: "Pages we test your rules on",
  allowed: "Allowed",
  blocked: "Blocked",
  blockedSome: (n: number, of: number) => `Blocked on ${n} of ${of} pages`,
  mayIgnore: "May not follow robots.txt",
  sitemaps: "Sitemaps in your file",
  ready: "Your result is ready.",
} as const;

/** "Blocked on a product page." / "Allowed on your home page and a collection page." */
export const pagesLine = (allowed: boolean, labels: string) => `${allowed ? "Allowed" : "Blocked"} on ${labels}.`;
/** No Applebot rules, so Apple follows your Googlebot rules. */
export const fallbackLine = (token: string, owner: string, from: string) => `No ${token} rules, so ${owner} follows your ${from} rules.`;

/** What we found at /robots.txt when it wasn't a normal file. */
export const SITE_COPY = {
  noFile: "You have no robots.txt file, so every bot is allowed.",
  htmlFile: "You have no robots.txt file (your site shows a web page at that address), so every bot is allowed.",
  couldNotRead: "We couldn't read your robots.txt",
  turnedAway: (status: number) =>
    `Your site turned our check away (it answered ${status}). AI bots may be turned away too: check your firewall or bot settings. We couldn't read your robots.txt.`,
  serverError: (status: number) => `Your site answered with a server error (${status}). Try again in a few minutes.`,
  // Google's robots.txt rules, "Handling of errors and HTTP status codes", 5xx row (read 11 Oct 2026):
  // "For the first 12 hours, Google stops crawling the site but keeps trying to fetch the robots.txt file.
  // If Google can't fetch a new version, for the next 30 days Google will use the last good version."
  serverErrorGoogle: "While your robots.txt shows a server error, Google stops crawling your site for the first 12 hours, then uses the last copy it could read.",
  noProductLinks: "We couldn't find product links on your home page, so we tested your home page.",
  noProductLinksEntered: "We couldn't find product links on your home page, so we tested your home page and the page you entered.",
} as const;

/** The "Fix it on Shopify" box (docs/tools/spec.md T2, result layout 4). */
export const FIX = {
  title: "Fix it on Shopify",
  steps:
    "In Shopify admin, go to Online Store, then Themes. Next to your live theme, click the three dots and choose Edit code. In the Templates folder, open robots.txt.liquid. Delete the lines shown below, save, then run this check again.",
  linesLabel: "Lines to delete",
  trainingNote: "Lines that block training bots aren't listed. Blocking those is your choice.",
  noLiquid:
    "No robots.txt.liquid file? Then your store uses Shopify's standard file, and the block comes from somewhere else: an app, a developer, or a service in front of your store such as Cloudflare. Ask them to remove it.",
  // Verified 11 Oct 2026 against the Shopify Help Center (SHOPIFY_ROBOTS_HELP).
  restore: "Want Shopify's standard rules back? Delete robots.txt.liquid (copy it somewhere first).",
  restoreSource: SHOPIFY_ROBOTS_HELP,
  // A site that isn't on Shopify: no Shopify steps.
  otherTitle: "How to fix it",
  otherSteps: "Delete the lines shown below from your robots.txt, then run this check again.",
  // A Shopify store with nothing to fix.
  cleanTitle: "Your robots.txt on Shopify",
  cleanSteps:
    "Nothing to fix here. If you ever need to change it: in Shopify admin, go to Online Store, then Themes. Next to your live theme, click the three dots and choose Edit code. In the Templates folder, open robots.txt.liquid. If there's no robots.txt.liquid, your store uses Shopify's standard file.",
} as const;

/** The "What robots.txt can't show" box, always shown. */
export const LIMITS = {
  title: "What robots.txt can't show",
  // Sources: Google Search Console Help 16908024 (Search generative AI setting); Google's user-triggered
  // fetchers "generally ignore robots.txt rules" (facts-2026.md 1.2, Google-Agent).
  text: "A firewall or bot protection, such as Cloudflare's setting that blocks AI bots, can turn bots away before they read robots.txt. Google also has a switch in Search Console (Settings, then Search generative AI) that can keep a site out of AI Overviews. And some assistants fetch a page when a person asks and say robots.txt may not apply to those visits, including Google-Agent.",
  sources: [GOOGLE_AI_SWITCH, GOOGLE_USER_FETCHERS],
} as const;

// ---------- the page ----------

/** One line for each thing the tool looks at. The bot count comes from the list itself (25 today). */
export const WHAT_IT_CHECKS = [
  "Your live robots.txt, read the way the robots.txt standard (RFC 9309) says bots read it",
  `${TOOL_BOTS.length} bots from OpenAI, Google, Anthropic, Perplexity, Microsoft, Apple, Meta, Amazon, DuckDuckGo, Mistral and Common Crawl`,
  "Your home page, a product page and a collection page",
  "The exact line that blocks each bot, and how to remove it on Shopify",
];

export interface ExplainerCopy {
  id: string;
  question: string;
  paragraphs: string[];
  sources: FaqSource[];
}

export const EXPLAINERS: ExplainerCopy[] = [
  {
    id: "what-is-gptbot",
    question: "What is GPTBot?",
    // source: https://developers.openai.com/api/docs/bots (facts-2026.md 1.2)
    paragraphs: [
      "GPTBot is OpenAI's crawler that collects pages to train its AI models. Blocking it in robots.txt tells OpenAI not to use your pages for training. It doesn't change whether ChatGPT search can show your pages: that's OAI-SearchBot. OpenAI publishes GPTBot's addresses at openai.com/gptbot.json, so a firewall can tell the real bot from fakes.",
    ],
    sources: [OPENAI_BOTS],
  },
  {
    id: "what-is-oai-searchbot",
    question: "What is OAI-SearchBot?",
    // sources: OpenAI bots page; https://help.openai.com/en/articles/9237897-chatgpt-search
    paragraphs: [
      "OAI-SearchBot is OpenAI's search crawler. It decides whether your pages can appear in ChatGPT search answers. OpenAI says robots.txt changes take about 24 hours to apply, and asks sites to allow its published addresses (openai.com/searchbot.json) at their firewall or CDN. For a store that wants ChatGPT to recommend it, this is the OpenAI bot that matters most.",
    ],
    sources: [OPENAI_BOTS, OPENAI_SEARCH_HELP],
  },
];

/** The "Every bot we check" table, rendered from TOOL_BOTS. */
export const BOT_TABLE = {
  id: "every-bot",
  heading: "Every bot we check",
  caption: (checked: string) => `From each company's own crawler pages, checked ${checked}`,
  columns: ["Bot", "Company", "What it does"] as const,
};

export interface HowItem {
  text: string;
  source?: FaqSource;
}

/** "How this tool works". `{checked}` is the date the bot list was checked. Backticks mark code. */
export const howItWorks = (checked: string): HowItem[] => [
  // Google reads the first 500 KiB: Google's robots.txt rules, "File format" (read 11 Oct 2026).
  {
    text: "We fetch /robots.txt from your site's main address, following up to 4 redirects, and read up to 512 KB of it. Google reads the first 500 KB.",
    source: GOOGLE_ROBOTS_SPEC,
  },
  {
    text: "We read it the way the robots.txt standard (RFC 9309) describes: a group that names a bot replaces the general `*` group for that bot, and the longest matching rule wins. Allow wins a tie.",
    source: RFC_9309,
  },
  { text: "Apple says Applebot follows your Googlebot rules when your file doesn't name Applebot, so we do the same.", source: APPLE_BOT },
  { text: "We test your home page, one product page and one collection page we find on your home page, plus the page you entered." },
  { text: "We don't visit your site pretending to be each bot, so firewall or CDN blocks don't show here." },
  { text: "If your site answers 401, 403 or 429, we say it turned us away, and never call that all clear. If there's no robots.txt (404), every bot is allowed." },
  { text: `The bot list comes from each company's own crawler pages, checked ${checked}. We review it every 3 months.` },
];

export const FAQS: ToolFaqItem[] = [
  {
    q: "Does blocking GPTBot hide my store from ChatGPT?",
    // source: https://developers.openai.com/api/docs/bots
    a: "No. GPTBot only collects pages to train OpenAI's models. Whether your pages can appear in ChatGPT search is decided by a different bot, OAI-SearchBot. OpenAI says sites that block OAI-SearchBot won't be shown in ChatGPT search answers, though they can still appear as plain navigational links.",
    sources: [OPENAI_BOTS],
  },
  {
    q: "Should I block AI training bots?",
    // source: facts-2026.md 1.2 (OpenAI bots, Anthropic article, Google common crawlers)
    a: "It's your choice. Blocking training bots like GPTBot or ClaudeBot stops those companies using your pages to train future models, and their docs say it doesn't remove you from their live answers. Google-Extended is different: it also controls whether the Gemini app can use your pages to ground its answers. If you want AI assistants to know your products, leaving them open is the simpler choice.",
    sources: [OPENAI_BOTS, ANTHROPIC_BOTS, GOOGLE_CRAWLERS],
  },
  {
    q: "What does Shopify's robots.txt block by default?",
    // source: observed https://theme-horizon-demo.myshopify.com/robots.txt on 11 Oct 2026 (facts-2026.md 1.3);
    // the Shopify Help Center lists the same default rules.
    a: "Shopify's standard robots.txt blocks no AI bot. It keeps all bots out of pages like the cart, checkout and customer accounts, and lets them read products, collections, pages and blogs. Blocks usually come from edits to the robots.txt.liquid file, an app, or a service in front of the store.",
    sources: [SHOPIFY_ROBOTS_HELP, SHOPIFY_DEMO_ROBOTS],
  },
  {
    q: "How do I edit robots.txt on Shopify?",
    // sources: Shopify Help Center "Editing robots.txt.liquid"; Shopify dev docs (click ... > Edit code; Templates folder)
    a: "In Shopify admin, go to Online Store, then Themes. Next to your live theme, click the three dots and choose Edit code. In the Templates folder, open robots.txt.liquid, delete the lines that block the bot, save, and run this check again. If there's no robots.txt.liquid, your store uses Shopify's standard file.",
    sources: [SHOPIFY_ROBOTS_HELP, SHOPIFY_ROBOTS_DEV],
  },
  {
    q: "My robots.txt allows every bot. Can AI still be blocked?",
    // sources: https://support.google.com/webmasters/answer/16908024 ; OpenAI help 9237897 ; Perplexity bots page
    a: "Yes. A firewall or bot protection, such as Cloudflare's setting that blocks AI bots, can turn bots away before they read robots.txt, and that doesn't show here. Google also has a separate switch in Search Console, called Search generative AI, that can keep a site out of AI Overviews. OpenAI and Perplexity ask sites to allow their published IP addresses at the firewall.",
    sources: [GOOGLE_AI_SWITCH, OPENAI_SEARCH_HELP, PERPLEXITY_BOTS],
  },
  {
    q: "Do AI bots follow robots.txt?",
    // source: facts-2026.md 1.2
    a: "The crawlers that build search indexes say they do, including OAI-SearchBot, PerplexityBot, Claude-SearchBot, Googlebot and Applebot. Some fetchers that open a page because a person asked say robots.txt may not apply to them, such as ChatGPT-User and Perplexity-User. Anthropic says its Claude-User fetcher does follow robots.txt.",
    sources: [OPENAI_BOTS, PERPLEXITY_BOTS, ANTHROPIC_BOTS],
  },
];

/** The one button under the result. True: the app reads each store's robots.txt weekly (robots.server.ts). */
export const CTA = { text: "Let GEO check this for you every week", href: "/?ref=tool-ai-crawler-checker#how" };
