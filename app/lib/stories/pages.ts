// The /stories pages' fixed words and their <head>: the hub's copy, the little a card needs, the source line,
// the "not a GEO customer" note and the JSON-LD. Pure and browser-safe (route `meta` runs in the browser too).
// It never imports stories.json: the routes' loaders read the stories and pass them in, so each page carries only
// its own story in the HTML, not all fifteen in its JavaScript.
// Copy rules: plain English, no em dashes, and never a word that suggests these brands use GEO.

import type { Story, StorySource } from "./index";
import { abs } from "../tools/site";
import { HOME_CRUMB, ORG_NODE, PART_OF, breadcrumbs, stripBrand } from "../tools/seo";

/** The day the stories went live: every story page's datePublished and dateModified, and their sitemap date. */
export const STORIES_UPDATED = "2026-10-12";

export const STORIES_HUB = {
  name: "Stories",
  path: "/stories",
  /** Under 60 characters. */
  title: "Stories: brands getting sales from AI | GEO",
  /** Under 155 characters. */
  description:
    "Online stores and software companies that got sales or sign-ups from ChatGPT and other AI assistants, each story linked to the original report.",
  h1: "Brands already getting customers from AI",
  intro:
    "Online stores and software companies on what happened when ChatGPT and other AI assistants began sending them customers. Each story is our short summary of a press article or case study, with a link to the original.",
  /** The share image (the same clay shop as the home page). */
  ogImage: "/og/home.png",
  ogAlt: "A small clay shop with a star in a speech bubble above it",
} as const;

export const storyPath = (slug: string) => `${STORIES_HUB.path}/${slug}`;

/** A logo path from stories.json ("logos/viv.png") as served: design/overview/assemble.mjs copies them to /home/img/. */
export const logoSrc = (logo: string) => `/home/img/${logo}`;
export const SHOPIFY_BAG_SRC = logoSrc("logos/shopify.svg");

/** What a story card shows (the home page's moving row, the hub and "Read next"). */
export type StoryCardData = Pick<Story, "slug" | "brand" | "cardHeadline" | "onShopify" | "logo" | "logoShape" | "ecommerce">;

export const toCard = ({ slug, brand, cardHeadline, onShopify, logo, logoShape, ecommerce }: Story): StoryCardData => ({
  slug,
  brand,
  cardHeadline,
  onShopify,
  logo,
  logoShape,
  ecommerce,
});

/** "Volume Nine (agency)" -> "Volume Nine" (the note in brackets is for the source line only). */
export const publisherName = (publisher: string) => publisher.replace(/\s*\([^)]*\)\s*$/, "");

/** "Modern Retail" -> "Modern Retail's", "Ahrefs blog" -> "the Ahrefs blog's", "The SEO Works" -> "The SEO Works'". */
export function publisherPossessive(publisher: string): string {
  const name = publisherName(publisher);
  const owner = /\sblog$/i.test(name) ? `the ${name}` : name;
  return owner.endsWith("s") ? `${owner}'` : `${owner}'s`;
}

/** The plain note next to the source link: whose story this is, and that it isn't ours. */
export function notCustomerNote(s: Story): string {
  const figures = s.keyNumbers.length > 0;
  const quotes = s.quotes.length > 0;
  const theirs = figures && quotes ? "The figures and quotes are theirs." : figures ? "The figures are theirs." : quotes ? "The quotes are theirs." : "The facts are theirs.";
  return `${s.brand} is not a GEO customer. This page is our summary of ${publisherPossessive(s.source.publisher)} reporting. ${theirs}`;
}

/** "Lesson. The rest." -> ["Lesson.", "The rest."], so the page can set the lesson itself in bold. */
export function splitLesson(lesson: string): [string, string] {
  const at = lesson.indexOf(". ");
  return at < 0 ? [lesson, ""] : [lesson.slice(0, at + 1), lesson.slice(at + 2)];
}

// ---------- JSON-LD ----------

const ORG_ID = ORG_NODE["@id"];

/** A source as a CreativeWork: its title, address, publisher and date (when the page shows one). */
const creativeWork = (src: StorySource) => ({
  "@type": "CreativeWork",
  name: src.title,
  url: src.url,
  publisher: { "@type": "Organization", name: publisherName(src.publisher) },
  ...(src.date ? { datePublished: src.date } : {}),
});

/** One @graph for a story page: Organization, Article (based on the source) and BreadcrumbList. */
export function storyJsonLd(s: Story): Record<string, unknown> {
  const url = abs(storyPath(s.slug));
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG_NODE,
      {
        "@type": "Article",
        "@id": `${url}#article`,
        url,
        mainEntityOfPage: url,
        headline: s.h1,
        description: s.description,
        datePublished: STORIES_UPDATED,
        dateModified: STORIES_UPDATED,
        inLanguage: "en",
        image: abs(STORIES_HUB.ogImage),
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        about: { "@type": "Organization", name: s.brand },
        isBasedOn: creativeWork(s.source),
        citation: [s.source, ...(s.moreSources ?? [])].map(creativeWork),
        isPartOf: PART_OF,
      },
      breadcrumbs(`${url}#crumbs`, [
        { name: HOME_CRUMB, path: "/" },
        { name: STORIES_HUB.name, path: STORIES_HUB.path },
        { name: s.brand },
      ]),
    ],
  };
}

/** One @graph for the hub: Organization, CollectionPage, ItemList of the stories and BreadcrumbList. */
export function storiesHubJsonLd(cards: StoryCardData[]): Record<string, unknown> {
  const url = abs(STORIES_HUB.path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG_NODE,
      {
        "@type": "CollectionPage",
        "@id": url,
        url,
        name: stripBrand(STORIES_HUB.title),
        description: STORIES_HUB.description,
        dateModified: STORIES_UPDATED,
        primaryImageOfPage: abs(STORIES_HUB.ogImage),
        mainEntity: { "@id": `${url}#stories` },
        breadcrumb: { "@id": `${url}#crumbs` },
        isPartOf: PART_OF,
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#stories`,
        numberOfItems: cards.length,
        itemListElement: cards.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: `${c.brand}: ${c.cardHeadline}`,
          url: abs(storyPath(c.slug)),
        })),
      },
      breadcrumbs(`${url}#crumbs`, [{ name: HOME_CRUMB, path: "/" }, { name: STORIES_HUB.name }]),
    ],
  };
}
