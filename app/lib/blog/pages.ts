// The /blog pages' fixed words, paths, the shape of a post's body, and the JSON-LD. Pure and browser-safe (route
// `meta` runs in the browser too): no database, no env. The writer lives in lib/blog.server.ts.
// Copy rules: plain English, no em dashes, Australian spelling, and never a line that says a brand uses GEO.

import { abs } from "../tools/site";
import { HOME_CRUMB, ORG_NODE, PART_OF, breadcrumbs } from "../tools/seo";
import { BLOG_KIND_LABELS, type BlogKind } from "./topics";

export const BLOG_HUB = {
  name: "Blog",
  path: "/blog",
  /** Under 60 characters. */
  title: "Blog: getting your store recommended by AI | GEO",
  /** Under 155 characters. */
  description:
    "Plain-English articles for Shopify stores on getting recommended by ChatGPT, Gemini, Perplexity and Google AI Overviews, and on tracking the sales that follow.",
  h1: "How to get your products recommended by AI",
  intro:
    "Short, honest articles for Shopify store owners: how AI assistants pick what to recommend, what to change on your store, and how to see the money it brings in. New ones three times a week.",
  ogImage: "/og/home.png",
  ogAlt: "A small clay shop with a star in a speech bubble above it",
  /** The author on every post. */
  author: "The GEO team",
} as const;

export const postPath = (slug: string) => `${BLOG_HUB.path}/${slug}`;

/** A post's body, as the writer returns it and the page renders it. */
export interface BlogBody {
  /** The answer first: one or two paragraphs that answer the title directly. */
  intro: string[];
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
  takeaways: string[];
  faqs: { q: string; a: string }[];
  /** Pages from the knowledge pack whose facts the post uses. */
  sources: { url: string; title: string }[];
  /** Slugs of /stories pages and /tools pages worth reading next (checked against the real lists before saving). */
  relatedStories: string[];
  relatedTools: string[];
}

/** What a list card or a "Read next" row shows. */
export interface PostCard {
  slug: string;
  title: string;
  description: string;
  kind: BlogKind;
  publishedAt: string; // ISO
  minutes: number;
}

export const kindLabel = (kind: string) => BLOG_KIND_LABELS[kind as BlogKind] ?? "Article";

/** A post as the page and its JSON-LD see it (dates as ISO strings so it can travel to the browser). */
export interface PostView {
  slug: string;
  title: string;
  description: string;
  kind: string;
  words: number;
  publishedAt: string;
  updatedAt: string;
  body: BlogBody;
}

/** A card from a database row (or a PostView). */
export function toPostCard(p: { slug: string; title: string; description: string; kind: string; publishedAt: Date | string; words: number }): PostCard {
  return {
    slug: p.slug,
    title: p.title,
    description: p.description,
    kind: p.kind as BlogKind,
    publishedAt: typeof p.publishedAt === "string" ? p.publishedAt : p.publishedAt.toISOString(),
    minutes: readMinutes(p.words),
  };
}

/** A URL slug from a title: lowercase words joined by hyphens, at most 70 characters, never empty. */
export function slugify(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");
  return s || "post";
}

/** Every piece of text in a body, for word counts and checks. */
export function bodyText(b: BlogBody): string[] {
  return [
    ...b.intro,
    ...b.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
    ...b.takeaways,
    ...b.faqs.flatMap((f) => [f.q, f.a]),
  ];
}

export const wordCount = (b: BlogBody) => bodyText(b).join(" ").split(/\s+/).filter(Boolean).length;

/** Reading time at about 220 words a minute, at least 1. */
export const readMinutes = (words: number) => Math.max(1, Math.round(words / 220));

/** The ISO date part ("2026-10-15") of a date or ISO string, for datePublished and <time>. */
export const isoDay = (d: Date | string) => (typeof d === "string" ? d : d.toISOString()).slice(0, 10);

// ---------- JSON-LD ----------

const ORG_ID = ORG_NODE["@id"];

/** The hub: Organization, Blog (with its posts listed) and the breadcrumb. */
export function blogHubJsonLd(cards: PostCard[]): Record<string, unknown> {
  const url = abs(BLOG_HUB.path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG_NODE,
      {
        "@type": "Blog",
        "@id": `${url}#blog`,
        url,
        name: BLOG_HUB.name,
        description: BLOG_HUB.description,
        publisher: { "@id": ORG_ID },
        isPartOf: PART_OF,
        blogPost: cards.map((c) => ({ "@type": "BlogPosting", "@id": `${abs(postPath(c.slug))}#post`, headline: c.title, url: abs(postPath(c.slug)), datePublished: isoDay(c.publishedAt) })),
      },
      breadcrumbs(`${url}#breadcrumb`, [{ name: HOME_CRUMB, path: "/" }, { name: BLOG_HUB.name }]),
    ],
  };
}

/** One post: Organization, BlogPosting, the breadcrumb, and FAQPage when it has questions. */
export function postJsonLd(post: PostView): Record<string, unknown> {
  const url = abs(postPath(post.slug));
  const graph: Record<string, unknown>[] = [
    ORG_NODE,
    {
      "@type": "BlogPosting",
      "@id": `${url}#post`,
      url,
      mainEntityOfPage: url,
      headline: post.title,
      description: post.description,
      datePublished: isoDay(post.publishedAt),
      dateModified: isoDay(post.updatedAt),
      wordCount: post.words,
      inLanguage: "en",
      author: { "@id": ORG_ID },
      publisher: { "@id": ORG_ID },
      isPartOf: { "@type": "Blog", "@id": `${abs(BLOG_HUB.path)}#blog`, name: BLOG_HUB.name },
      ...(post.body.sources.length ? { citation: post.body.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })) } : {}),
    },
    breadcrumbs(`${url}#breadcrumb`, [{ name: HOME_CRUMB, path: "/" }, { name: BLOG_HUB.name, path: BLOG_HUB.path }, { name: post.title }]),
  ];
  if (post.body.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      mainEntity: post.body.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
