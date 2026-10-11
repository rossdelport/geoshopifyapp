// One helper for every public page's <head>: title, description, one canonical on https://usegeo.app,
// Open Graph and Twitter tags, and one JSON-LD @graph. Pure and browser-safe: React Router runs `meta`
// on the server and in the browser, so nothing here may read env or request.url.
// No `nosnippet` or `max-snippet` ever (AI Overviews and assistants quote snippets), and no
// aggregateRating or review markup (we have no real ratings; docs/tools/spec.md 3.3).

import type { MetaDescriptor } from "react-router";
import { BRAND, BRAND_ALT, SITE, abs } from "./site";
import { HUB, TOOLS, type ToolEntry } from "./registry";

export interface PageSeo {
  /** Site path, like "/tools/ai-crawler-checker". The canonical and og:url come from it. */
  path: string;
  title: string;
  description: string;
  /** Site path of the 1200 x 630 share image. Default "/og/tools.png". */
  image?: string;
  imageAlt?: string;
  /** The 404 page only; never on tool pages. Leaves out the canonical and og:url. */
  noindex?: boolean;
  /** One @graph object. */
  jsonLd?: Record<string, unknown>;
}

export interface Faq {
  q: string;
  a: string;
}

const DEFAULT_IMAGE = HUB.ogImage;

/** The <head> tags of a public page, in a fixed order (tests and crawlers read them). */
export function pageMeta(p: PageSeo): MetaDescriptor[] {
  const url = abs(p.path);
  const image = p.image ?? DEFAULT_IMAGE;
  const imageAlt = p.imageAlt ?? (p.image ? stripBrand(p.title) : HUB.ogAlt);
  const out: MetaDescriptor[] = [{ title: p.title }, { name: "description", content: p.description }];
  // A noindex page (the 404 page) has no canonical address: a canonical there would send mixed signals.
  if (p.noindex) out.push({ name: "robots", content: "noindex" });
  else out.push({ tagName: "link", rel: "canonical", href: url });
  out.push(
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: BRAND },
    { property: "og:title", content: p.title },
    { property: "og:description", content: p.description },
    ...(p.noindex ? [] : [{ property: "og:url", content: url }]),
    { property: "og:image", content: abs(image) },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: imageAlt },
    { name: "twitter:card", content: "summary_large_image" },
  );
  if (p.jsonLd) out.push({ "script:ld+json": p.jsonLd });
  return out;
}

/** "AI Overview Checker: Is Your Site Cited by Google AI? | GEO" -> the part before " | GEO". */
export const stripBrand = (title: string) => title.replace(/\s*\|\s*GEO$/, "");

// ---------- JSON-LD nodes ----------

const HOME = abs("/");
const ORG_ID = `${SITE}/#org`;
const WEBSITE_ID = `${SITE}/#website`;

/** The company. The home page (design/overview/assemble.mjs) writes the same node; a test keeps them equal. */
export const ORG_NODE = {
  "@type": "Organization",
  "@id": ORG_ID,
  name: BRAND,
  alternateName: BRAND_ALT,
  url: HOME,
  logo: abs("/apple-touch-icon.png"),
} as const;

/** The website, as the home page describes it (with its publisher). */
export const WEBSITE_NODE = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: BRAND,
  alternateName: BRAND_ALT,
  url: HOME,
  publisher: { "@id": ORG_ID },
} as const;

/** What a page says it belongs to (short form of WEBSITE_NODE). */
const PART_OF = { "@type": "WebSite", "@id": WEBSITE_ID, url: HOME, name: BRAND };

type Crumb = { name: string; path?: string };

function breadcrumbs(id: string, crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.path ? { item: abs(c.path) } : {}),
    })),
  };
}

/** The visible breadcrumb and the BreadcrumbList use the same names: Home > Free tools > {tool}. */
export const HOME_CRUMB = "Home";

/** One @graph for a tool page: Organization, WebApplication, WebPage, BreadcrumbList and FAQPage. */
export function toolJsonLd(t: ToolEntry, faqs: Faq[]): Record<string, unknown> {
  const url = abs(t.path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG_NODE,
      {
        "@type": "WebApplication",
        "@id": `${url}#app`,
        name: t.name,
        url,
        description: t.description,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: stripBrand(t.title),
        dateModified: t.updated,
        primaryImageOfPage: abs(t.ogImage),
        mainEntity: { "@id": `${url}#app` },
        breadcrumb: { "@id": `${url}#crumbs` },
        isPartOf: PART_OF,
      },
      breadcrumbs(`${url}#crumbs`, [
        { name: HOME_CRUMB, path: "/" },
        { name: HUB.name, path: HUB.path },
        { name: t.name },
      ]),
      // Built from the same array the page renders, so the words match the visible FAQ exactly.
      // Harmless when it matches visible text; Google shows no FAQ rich results since 7 May 2026.
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };
}

/** One @graph for the hub: Organization, CollectionPage, ItemList of the tools and BreadcrumbList. */
export function hubJsonLd(): Record<string, unknown> {
  const url = abs(HUB.path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG_NODE,
      {
        "@type": "CollectionPage",
        "@id": url,
        url,
        name: stripBrand(HUB.title),
        description: HUB.description,
        dateModified: HUB.updated,
        primaryImageOfPage: abs(HUB.ogImage),
        mainEntity: { "@id": `${url}#tools` },
        breadcrumb: { "@id": `${url}#crumbs` },
        isPartOf: PART_OF,
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#tools`,
        numberOfItems: TOOLS.length,
        itemListElement: TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, url: abs(t.path) })),
      },
      breadcrumbs(`${url}#crumbs`, [{ name: HOME_CRUMB, path: "/" }, { name: HUB.name }]),
    ],
  };
}
