// The AI Crawler Checker's on-load example: a made-up robots.txt (docs/tools/spec.md T2), labelled as
// made up on the page. It teaches both lessons at once: GPTBot is blocked (training only, ChatGPT search
// isn't affected) and PerplexityBot is blocked from product pages (that hides products from Perplexity's
// answers). Pure data, browser-safe.

import type { TestedPath } from "../crawler";

export const SAMPLE_ROBOTS = `# Example robots.txt (made up)
User-agent: *
Disallow: /cart
Disallow: /checkout

User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Disallow: /products/
`;

/**
 * The pages a pasted robots.txt is tested against: we don't know the store, so these are typical
 * Shopify addresses (/collections/all exists on every Shopify store; the product handle is made up).
 */
export const PASTE_PATHS: TestedPath[] = [
  { label: "your home page", path: "/" },
  { label: "a product page", path: "/products/example" },
  { label: "a collection page", path: "/collections/all" },
];
