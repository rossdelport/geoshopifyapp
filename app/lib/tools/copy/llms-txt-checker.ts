// Copy for the llms.txt Checker (/tools/llms-txt-checker). Final text from docs/tools/spec.md T5; every
// fact keeps its source comment, and the FAQ array feeds both the visible FAQ and the FAQPage JSON-LD,
// word for word. The checks themselves live in llms.ts, which reads its words from here.
// House rules: plain English, no em dashes, no invented numbers. Pure and browser-safe.
// Text in `backticks` shows as code on the page (copy strings only, never strangers' text).

import type { FaqSource, ToolFaqItem } from "../../../components/tool-ui";
import { plural } from "../format";

// Primary sources, all read 11 Oct 2026 (docs/tools/research/facts-2026.md section 4).
// llmstxt.org, "The /llms.txt file", version 2 (August 2026).
const LLMSTXT: FaqSource = { url: "https://llmstxt.org/", label: "llmstxt.org" };
// Google Search Central changelog, 15 Jun 2026: llms.txt files "aren't needed for Google Search (and won't
// negatively or positively impact your visibility or rankings)".
const GOOGLE_UPDATES: FaqSource = { url: "https://developers.google.com/search/updates", label: "Google Search Central" };
// Ahrefs server-log study: 137,210 domains, May 2026 traffic, published 15 Jun 2026. 97% of llms.txt files
// got zero requests.
const AHREFS: FaqSource = { url: "https://ahrefs.com/blog/llmstxt-study/", label: "Ahrefs" };
// Shopify changelog, 28 May 2026: "Your store includes a default agents.md file accessible at /agents.md. The
// paths /llms.txt and /llms-full.txt also point to this content by default."
const SHOPIFY_CHANGELOG: FaqSource = { url: "https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd", label: "Shopify changelog" };
// Shopify, llms.txt.liquid: "this template renders with a restricted Liquid context: only the request object
// and the agents object are available". Shopify recommends keeping the managed default for most stores.
const SHOPIFY_TEMPLATE: FaqSource = {
  url: "https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid",
  label: "Shopify's llms.txt.liquid docs",
};
// The big AI crawlers say they follow robots.txt (facts-2026.md 1.2).
const OPENAI_BOTS: FaqSource = { url: "https://developers.openai.com/api/docs/bots", label: "OpenAI's crawler page" };
const PERPLEXITY_BOTS: FaqSource = { url: "https://docs.perplexity.ai/guides/bots", label: "Perplexity's crawler page" };

export const INTRO =
  "The llms.txt Checker is a free tool that fetches your site's /llms.txt, checks it line by line against the llmstxt.org format, and builds a starter file you can copy. It also tells you when a store is using Shopify's automatic file.";

// ---------- the forms ----------

export const FORM = {
  urlLabel: "Your website",
  urlPlaceholder: "yourstore.com",
  submit: "Check llms.txt",
  pasteLabel: "Or paste an llms.txt to check it",
  pasteSubmit: "Check this llms.txt",
  // Shown once JavaScript runs: the check then happens in the browser (privacy page, "Free tools").
  pasteLive: "The result updates as you type, right in your browser.",
  backToPasteLead: "Want to check a file before you publish it?",
  backToPaste: "Paste an llms.txt",
} as const;

/**
 * Above the on-load example. The spec's words are "Example: the llms.txt on this site, usegeo.app"; the grey
 * "Example" chip in front of it (SampleLabel) says "Example", so the text starts after it.
 */
export const SAMPLE_LABEL = "The llms.txt on this site, usegeo.app. Edit it to test your own.";

/** The longest llms.txt people can paste. */
export const MAX_PASTE = 200_000;
export const PASTE_TOO_LONG = "That's a very long file. Paste up to 200,000 characters.";

// ---------- the checks (llmstxt.org v2, facts-2026.md 4.1; "our tip" = our advice, not the format) ----------

export const CHECK_COPY = {
  missing: "No llms.txt found. That's fine: it's optional.",
  html: "We got a web page, not a text file. Your site may be showing a page at /llms.txt instead of a file.",
  empty: "The file is empty.",
  h1: "The file must start with a title line, like `# Your Store`. It's the only required part.",
  h1Many: (a: number, b: number) => `There's more than one # title line (lines ${a} and ${b}). Keep one.`,
  summary: "Add a one-line summary starting with `>` under the title.",
  headingEarly: (n: number) => `Line ${n} is a heading before the first ## section. Only plain text can go there.`,
  listLink: (n: number) => `Line ${n} is a list item without a link. Use \`- [Page name](https://...): short note\`.`,
  linkRelative: (n: number) => `Line ${n} uses a short link. Full addresses (https://...) work everywhere.`,
  // `name` is the file's own heading: backticks are taken out (they would turn the rest of the line into
  // code) and a long name is cut. A heading with no words gets "This ## section".
  sectionEmpty: (name: string) => {
    const n = name.replace(/`/g, "").trim();
    if (!n) return "This ## section has no links.";
    return `The ## ${n.length > 80 ? `${n.slice(0, 79).trimEnd()}…` : n} section has no links.`;
  },
  mdLinks: "Your links point to web pages. The format also lets you link to plain-text (.md) versions.",
  optional: "Since version 2 of the format, an Optional section is just a normal section.",
  shopify: "We don't check Shopify's automatic file line by line: Shopify writes it for shopping agents, not as a list of links.",
  fullFound: "Found /llms-full.txt. It isn't part of the llmstxt.org format, so we don't check it.",
  fullMissing: "No /llms-full.txt. That's fine: it isn't part of the format.",
  agentsFound: "Found /agents.md.",
  agentsMissing: "No /agents.md.",
  size: "Your file is very long. The format is meant to be a short summary with links.",
  redirect: (to: string) => `Your /llms.txt redirects to ${to}.`,
  more: (n: number) => `And ${plural(n, "more line")} like this.`,
} as const;

/** The words on each check's chip. */
export const TONE_LABEL = { problem: "Problem", tip: "Tip", ourTip: "Our tip", info: "Info" } as const;

/** What passed, listed under the checks so a clean file shows its passing checks. */
export const PASSED_COPY = {
  heading: "Passed",
  title: "Starts with a # title line",
  oneTitle: "Has one title line",
  summary: "Has a > summary under the title",
  noEarlyHeadings: "No headings before the first ## section",
  links: "Every list item has a link",
  fullLinks: "Every link is a full address",
  sections: "No empty ## sections",
} as const;

// ---------- the result ----------

export const VERDICT_COPY = {
  good: "Your llms.txt follows the format",
  problems: (n: number) => `Your llms.txt has ${plural(n, "problem")}`,
  missing: "No llms.txt found. That's fine: it's optional.",
  shopify: "This is Shopify's automatic llms.txt",
} as const;

export const RESULT = {
  ready: "Your result is ready.",
  checked: "We checked",
  filesHeading: "Files on your site",
  checksHeading: "Line by line",
  noChecks: "Nothing to fix.",
  file: { found: "Found", missing: "Not found", html: "Web page instead", unchecked: "Couldn't check" },
} as const;

/** The box shown when a store serves Shopify's automatic file (facts-2026.md 4.3). */
export const SHOPIFY_BOX = {
  title: "Shopify's automatic file",
  text: "This is Shopify's automatic file. It's fine to leave. It tells AI shopping agents how to browse and buy from your store, but it doesn't list your products, collections or guides. Shopify recommends keeping it for most stores. To replace it, see the starter file below.",
  sources: [SHOPIFY_CHANGELOG, SHOPIFY_TEMPLATE],
} as const;

/** The starter file ("generator"). */
export const GENERATOR = {
  title: (host: string) => `A starter llms.txt for ${host}`,
  titlePaste: "A starter llms.txt for your site",
  paste: "Check a site above to build a starter file.",
  lead: "Built from your home page. Check it before you publish.",
  // Shown once JavaScript runs.
  live: "Edit it here and the checks below update as you type.",
  editLabel: "Edit your starter file",
  checksHeading: "Checks on this file",
  copyLabel: "Your llms.txt",
  noHome: "We couldn't read your home page, so we couldn't build a starter file.",
  noLinks: "We found no links on your home page, so add your main pages by hand.",
  // Where to put it on a site that isn't on Shopify (llmstxt.org: "at the root path /llms.txt of a website").
  otherSite: (origin: string) => `Save it as llms.txt in the top folder of your site, so it opens at ${origin}/llms.txt.`,
  shopifyTitle: "Shopify version",
  shopifyCopyLabel: "Shopify template",
  shopifyFile: "templates/llms.txt.liquid",
  // source: https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid (read 11 Oct 2026);
  // lookup order https://shopify.dev/docs/storefronts/themes/architecture/templates/agents-md-liquid
  shopifyNote:
    "Shopify only lets this template use a few store values, like the store name, address and sitemap, so the links are typed in. Run this generator again when you add important pages.",
  shopifySteps:
    "In Shopify admin, go to Online Store, then Themes. Next to your live theme, click the three dots and choose Edit code. In the Templates folder, add a new template file named llms.txt.liquid, paste this and save. It changes only /llms.txt. /agents.md and /llms-full.txt keep Shopify's automatic file.",
  shopifySources: [SHOPIFY_TEMPLATE],
  // Section names and policy link names in the starter file itself.
  mainPages: "Main pages",
  policies: "Policies",
  policyNames: { "shipping-policy": "Shipping policy", "refund-policy": "Refund policy", "privacy-policy": "Privacy policy" },
} as const;

/**
 * The evidence box, right under the result and before the button.
 * source: https://developers.google.com/search/updates (15 Jun 2026); https://ahrefs.com/blog/llmstxt-study/ ;
 * facts-2026.md 4.2 (no statement from OpenAI, Anthropic or Perplexity found)
 */
export const EVIDENCE = {
  title: "Before you spend time on it",
  text: "Google says llms.txt has no effect on Google Search, good or bad. In Ahrefs' study of 137,210 sites (May 2026 traffic), 97% of llms.txt files got no requests at all. No major AI assistant has said it reads llms.txt for its answers. It's cheap to have, but fix crawler access and product data first.",
  linksLead: "Free tools for those:",
  sources: [GOOGLE_UPDATES, AHREFS],
} as const;

// ---------- the page ----------

export const CTA = {
  text: "See what actually gets AI to recommend you",
  href: "/?ref=tool-llms-txt-checker#how",
};

export const WHAT_IT_CHECKS = [
  "Whether /llms.txt exists and is a text file, not a web page",
  "Every line against the llmstxt.org format (version 2)",
  "Whether it's Shopify's automatic file",
  "/llms-full.txt and /agents.md",
  "Builds a starter llms.txt from your home page",
];

export const HOW_IT_WORKS = [
  "We find your home page first (yourstore.com often sends visitors to www.yourstore.com), then fetch /llms.txt, /llms-full.txt and /agents.md from that address, following up to 4 redirects, up to 512 KB each, and read the home page for the starter file.",
  "We check /llms.txt against version 2 of the llmstxt.org proposal (August 2026): a title line first, then an optional > summary, optional notes, then ## sections that list links as - [name](url): notes. Checks marked 'our tip' are our own advice.",
  "/llms-full.txt isn't part of the llmstxt.org format, so we only say whether it's there.",
  "We spot Shopify's automatic file by its first line (# Agent Instructions) and its links for shopping agents.",
  "The starter file uses only what's on your home page. Check it before you publish.",
];

/** The source after the second "How this tool works" line. */
export const HOW_IT_WORKS_SOURCE = LLMSTXT;

export const FAQS: ToolFaqItem[] = [
  {
    q: "What is llms.txt?",
    a: "llms.txt is a plain text file at yourdomain.com/llms.txt that gives AI tools a short summary of a site and a list of its most useful links, written in Markdown. It's a proposal from llmstxt.org, not an official web standard, and the proposal itself says it's used most for software documentation that coding agents read.",
    // source: https://llmstxt.org/ (v2, Aug 2026)
    sources: [LLMSTXT],
  },
  {
    q: "Do ChatGPT and Google read llms.txt?",
    a: "Google says Google Search doesn't use it, and that it won't help or hurt your rankings. We found no statement from OpenAI, Anthropic or Perplexity that their assistants read it for answers. In Ahrefs' server-log study of May 2026 traffic, 97% of llms.txt files got no requests at all.",
    // source: https://developers.google.com/search/updates (15 Jun 2026); https://ahrefs.com/blog/llmstxt-study/
    sources: [GOOGLE_UPDATES, AHREFS],
  },
  {
    q: "Does my Shopify store have an llms.txt?",
    a: "Most likely. Since 28 May 2026, Shopify serves /llms.txt, /llms-full.txt and /agents.md for every store. By default all three show the same automatic file, which tells AI shopping agents how to browse and buy from the store but doesn't list your products or guides. Stores with a custom (headless) storefront may not have it.",
    // source: https://shopify.dev/changelog/customize-llmstxt-llms-fulltxt-and-agentsmd ; headless note is an
    // inference from one observed store (facts-2026.md 4.3)
    sources: [SHOPIFY_CHANGELOG],
  },
  {
    q: "How do I change llms.txt on Shopify?",
    a: "In Shopify admin, go to Online Store, then Themes, then Edit code on your live theme. In the Templates folder, add a new template file named llms.txt.liquid and paste your file. It only changes /llms.txt. Shopify recommends keeping its automatic file for most stores, and only a few store values, like the store name and sitemap address, work inside this template.",
    // source: https://shopify.dev/docs/storefronts/themes/architecture/templates/llms-txt-liquid
    sources: [SHOPIFY_TEMPLATE],
  },
  {
    q: "What's the difference between llms.txt and llms-full.txt?",
    a: "llms.txt is the short file from the llmstxt.org proposal: a title, a summary and lists of links. llms-full.txt isn't part of that proposal; it's a common habit of putting a site's full text in one file. On Shopify, both show the automatic file unless you add your own template.",
    // source: llmstxt.org (llms-full.txt is not in the format); Shopify changelog 28 May 2026
    sources: [LLMSTXT, SHOPIFY_CHANGELOG],
  },
  {
    q: "Is llms.txt the same as robots.txt?",
    a: "No. robots.txt tells bots which pages they may crawl, and the big AI crawlers say they follow it. llms.txt only suggests what to read and doesn't allow or block anything. If you want AI assistants to find your products, robots.txt matters far more.",
    // source: facts-2026.md 1.2 (each company's crawler page), 4.1 (llmstxt.org)
    sources: [OPENAI_BOTS, PERPLEXITY_BOTS, LLMSTXT],
  },
];
