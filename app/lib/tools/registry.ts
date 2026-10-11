// The free tools at usegeo.app/tools: one list for the footer, the hub, "More free tools", the sitemap,
// llms.txt and the tests, so names and links never drift apart. Pure and browser-safe.
// Copy rules (docs/tools/spec.md 3.2): titles under 60 characters including " | GEO", descriptions
// under 155, `short` under 95. No em dashes. Change `updated` only when a tool or its copy really changes.

export type ToolSlug =
  | "ai-visibility-checker"
  | "ai-overview-checker"
  | "ai-crawler-checker"
  | "product-schema-checker"
  | "llms-txt-checker"
  | "faq-schema-generator"
  | "ai-bot-checker";

export type ToolGroup = "stand" | "read" | "improve";

export interface ToolEntry {
  slug: ToolSlug;
  path: `/tools/${ToolSlug}`;
  /** Exact tool name, the same in the H1 (unless `h1` says otherwise), footer, hub and JSON-LD. */
  name: string;
  h1: string;
  /** <title> and og:title. Under 60 characters including " | GEO". */
  title: string;
  /** Meta and og:description. Under 155 characters. */
  description: string;
  /** One line for hub cards, related tools and llms.txt notes. Under 95 characters. */
  short: string;
  /** The main search term (the H1 holds it). */
  keyword: string;
  group: ToolGroup;
  related: [ToolSlug, ToolSlug, ToolSlug];
  /** The trust line after "Free · No sign-up · ". */
  timing: string;
  /** ISO date the tool shipped; change ONLY when the tool or its copy really changes. */
  updated: string;
  ogImage: string;
  ogAlt: string;
}

/** The date the tools first deployed. */
const SHIPPED = "2026-10-11";

/** In footer and sitemap order. */
export const TOOLS: ToolEntry[] = [
  {
    slug: "ai-visibility-checker",
    path: "/tools/ai-visibility-checker",
    name: "AI Visibility Checker",
    h1: "AI Visibility Checker",
    title: "AI Visibility Checker: Does ChatGPT Recommend You? | GEO",
    description:
      "Free AI visibility checker for Shopify products. See if ChatGPT, Gemini and Perplexity recommend your product and who they pick instead. No sign-up.",
    short: "See if ChatGPT, Gemini and Perplexity recommend your product, and who they pick instead.",
    keyword: "ai visibility checker",
    group: "stand",
    related: ["ai-overview-checker", "ai-crawler-checker", "ai-bot-checker"],
    // The free check's running page says "usually 3 to 6 min" (check-live.tsx); the spec's "about 2 minutes" was never measured.
    timing: "Results in a few minutes",
    updated: SHIPPED,
    ogImage: "/og/ai-visibility-checker.png",
    ogAlt: "AI visibility checker result: how often ChatGPT, Gemini and Perplexity name a product",
  },
  {
    slug: "ai-overview-checker",
    path: "/tools/ai-overview-checker",
    name: "AI Overview Checker",
    h1: "AI Overview Checker",
    title: "AI Overview Checker: Is Your Site Cited by Google AI? | GEO",
    description:
      "Free AI Overview checker. Type a shopping search to see if Google shows an AI Overview, which sites it cites and if yours is one. No sign-up.",
    short: "See if Google shows an AI Overview for a search, which sites it cites and if yours is one.",
    keyword: "ai overview checker",
    group: "stand",
    related: ["ai-visibility-checker", "ai-crawler-checker", "product-schema-checker"],
    timing: "Usually under 15 seconds",
    updated: SHIPPED,
    ogImage: "/og/ai-overview-checker.png",
    ogAlt: "AI Overview checker result: an AI Overview with its cited sites",
  },
  {
    slug: "ai-crawler-checker",
    path: "/tools/ai-crawler-checker",
    name: "AI Crawler Checker",
    h1: "AI Crawler Checker",
    title: "AI Crawler Checker: Which AI Bots Can Read Your Site | GEO",
    description:
      "Free AI crawler checker. See which AI bots your robots.txt lets in, like OAI-SearchBot, GPTBot and PerplexityBot, with Shopify fixes. No sign-up.",
    short: "See which AI bots your robots.txt lets in, and which blocks really hide you from AI answers.",
    keyword: "ai crawler checker",
    group: "read",
    related: ["llms-txt-checker", "product-schema-checker", "ai-visibility-checker"],
    timing: "Results in seconds",
    updated: SHIPPED,
    ogImage: "/og/ai-crawler-checker.png",
    ogAlt: "AI crawler checker result: AI bots allowed and blocked",
  },
  {
    slug: "product-schema-checker",
    path: "/tools/product-schema-checker",
    name: "Product Schema Checker",
    h1: "Product Schema Checker",
    title: "Product Schema Checker: What Google and AI Can Read | GEO",
    description:
      "Free product schema checker for Shopify. Paste a product link to see which facts Google and AI shopping tools can read and what's missing. No sign-up.",
    short: "See which product facts Google and AI shopping tools can read from your product page.",
    keyword: "product schema checker",
    group: "read",
    related: ["faq-schema-generator", "ai-bot-checker", "ai-visibility-checker"],
    timing: "Results in seconds",
    updated: SHIPPED,
    ogImage: "/og/product-schema-checker.png",
    ogAlt: "Product schema checker result: product facts found and missing",
  },
  {
    slug: "llms-txt-checker",
    path: "/tools/llms-txt-checker",
    name: "llms.txt Checker",
    h1: "llms.txt Checker",
    title: "llms.txt Checker: Validate and Generate Your File | GEO",
    description:
      "Free llms.txt checker and generator. See if your site has an llms.txt, check it against the llmstxt.org format and copy a starter file. No sign-up.",
    short: "Check your llms.txt against the llmstxt.org format and copy a starter file.",
    keyword: "llms.txt checker",
    group: "read",
    related: ["ai-crawler-checker", "product-schema-checker", "ai-visibility-checker"],
    timing: "Results in seconds",
    updated: SHIPPED,
    ogImage: "/og/llms-txt-checker.png",
    ogAlt: "llms.txt checker result: line by line checks",
  },
  {
    slug: "faq-schema-generator",
    path: "/tools/faq-schema-generator",
    name: "FAQ Schema Generator",
    h1: "FAQ Schema Generator",
    title: "FAQ Schema Generator: Free JSON-LD for Shopify | GEO",
    description:
      "Free FAQ schema generator. Type questions and answers, then copy FAQPage JSON-LD or a ready Shopify section. Runs in your browser. No sign-up.",
    short: "Turn your questions and answers into FAQ markup and a ready Shopify section.",
    keyword: "faq schema generator",
    group: "improve",
    related: ["product-schema-checker", "ai-bot-checker", "ai-visibility-checker"],
    timing: "Runs in your browser",
    updated: SHIPPED,
    ogImage: "/og/faq-schema-generator.png",
    ogAlt: "FAQ schema generator: questions and answers with the generated code",
  },
  {
    slug: "ai-bot-checker",
    path: "/tools/ai-bot-checker",
    name: "AI Bot Checker",
    h1: "AI Bot Checker for product descriptions",
    title: "AI Bot Checker for Product Descriptions | GEO",
    description:
      "Does your product copy sound like a bot wrote it? Free checker for vague phrases, hype words and missing facts shoppers and AI need. No sign-up.",
    short: "Check if your product copy sounds generic, and which facts shoppers and AI are missing.",
    keyword: "ai bot checker",
    group: "improve",
    related: ["faq-schema-generator", "product-schema-checker", "ai-visibility-checker"],
    timing: "Runs in your browser",
    updated: SHIPPED,
    ogImage: "/og/ai-bot-checker.png",
    ogAlt: "AI bot checker result: vague phrases highlighted in a product description",
  },
];

const BY_SLUG = new Map(TOOLS.map((t) => [t.slug, t]));

export const isToolSlug = (s: string): s is ToolSlug => BY_SLUG.has(s as ToolSlug);

/** The registry entry for a slug. Throws for an unknown slug (a typo in code, never visitor input). */
export function toolBySlug(s: ToolSlug): ToolEntry {
  const t = BY_SLUG.get(s);
  if (!t) throw new Error(`Unknown tool: ${s}`);
  return t;
}

/** The newest `updated` date of all tools (ISO dates sort as text). */
const latest = TOOLS.reduce((max, t) => (t.updated > max ? t.updated : max), TOOLS[0].updated);

/** The hub page at /tools. */
export const HUB = {
  path: "/tools" as const,
  name: "Free tools",
  title: "Free AI Search Tools for Shopify Stores | GEO",
  description:
    "Seven free tools that show how AI search sees your Shopify store: AI Overviews, AI crawlers, product schema, FAQ schema, llms.txt and product copy.",
  h1: "Free AI search tools for Shopify stores",
  intro:
    "Seven free tools that show how Google's AI Overviews, ChatGPT, Gemini and Perplexity see your store, and what to fix. No sign-up, and every result shows right on the page.",
  updated: latest,
  ogImage: "/og/tools.png",
  ogAlt: "GEO free tools: checks for AI Overviews, AI crawlers, product schema, FAQ schema, llms.txt and product copy",
};

/** The hub's groups, in page order (docs/tools/spec.md section 6). Every tool appears in exactly one. */
export const TOOL_GROUPS: { id: ToolGroup; heading: string; slugs: ToolSlug[] }[] = [
  { id: "stand", heading: "See where you stand", slugs: ["ai-visibility-checker", "ai-overview-checker"] },
  { id: "read", heading: "Check that AI can read your store", slugs: ["ai-crawler-checker", "product-schema-checker", "llms-txt-checker"] },
  { id: "improve", heading: "Improve what AI reads", slugs: ["ai-bot-checker", "faq-schema-generator"] },
];
