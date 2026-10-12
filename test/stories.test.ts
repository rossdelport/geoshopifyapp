/* eslint-disable @typescript-eslint/no-explicit-any -- reads meta descriptors and JSON-LD of many shapes */
// The stories: /stories (the hub) and /stories/<slug> (one page per story), rendered on the server with
// createRoutesStub (no JavaScript, no network). Every story page shows its H1, intro, the link to the original and
// the note that the brand is not a GEO customer; the head has one canonical and Article JSON-LD based on the source;
// "Read next" shows the story's three related stories; the Shopify badge only shows for stores on Shopify; no page
// has an em dash; an unknown slug is a 404 with noindex.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type LoaderFunctionArgs, type MetaDescriptor } from "react-router";
import { STORIES, storyBySlug, type Story } from "../app/lib/stories";
import { STORIES_HUB, STORIES_UPDATED, notCustomerNote, publisherPossessive, splitLesson, type StoryCardData } from "../app/lib/stories/pages";
import { ORG_NODE } from "../app/lib/tools/seo";
import * as layout from "../app/routes/stories";
import * as hub from "../app/routes/stories._index";
import * as page from "../app/routes/stories.$slug";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EM_DASH = /—/;
const SPACED_EN_DASH = /\s–\s/;
const decode = (h: string) =>
  h.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
const text = (h: string) => decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

type PageData = { story: Story | null; related: StoryCardData[]; all: StoryCardData[] };
const args = (slug: string, url = `https://usegeo.app/stories/${slug}`) =>
  ({ request: new Request(url), params: { slug }, context: {} }) as unknown as LoaderFunctionArgs;
/** The page loader's answer: { data, init } (React Router's data() helper). */
const load = (slug: string) => page.loader(args(slug)) as unknown as { data: PageData; init?: ResponseInit };

function renderStory(slug: string) {
  const { data } = load(slug);
  const Stub = createRoutesStub([
    {
      id: "stories",
      path: "/stories",
      Component: layout.default as ComponentType,
      children: [{ id: "story", path: ":slug", Component: page.default as ComponentType, loader: () => data }],
    },
  ]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [`/stories/${slug}`], hydrationData: { loaderData: { stories: null, story: data } } }));
}

function renderHub() {
  const data = hub.loader();
  const Stub = createRoutesStub([
    {
      id: "stories",
      path: "/stories",
      Component: layout.default as ComponentType,
      children: [{ id: "hub", index: true, Component: hub.default as ComponentType, loader: () => data }],
    },
  ]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ["/stories"], hydrationData: { loaderData: { stories: null, hub: data } } }));
}

const metaOf = (fn: unknown, data: unknown): MetaDescriptor[] => (fn as (a: unknown) => MetaDescriptor[])({ data, params: {}, location: {}, matches: [], error: undefined });
const find = (m: MetaDescriptor[], key: string, value: string) => m.find((d: any) => d[key] === value) as any;
const jsonLdOf = (m: MetaDescriptor[]) => {
  const ld = m.filter((d: any) => "script:ld+json" in d);
  expect(ld).toHaveLength(1);
  // what React Router writes into the page, read back
  return JSON.parse(JSON.stringify((ld[0] as any)["script:ld+json"])) as { "@context": string; "@graph": any[] };
};
/** The part of a page between two markers. */
const between = (html: string, from: string, to: string) => {
  const a = html.indexOf(from);
  expect(a, from).toBeGreaterThan(-1);
  const b = html.indexOf(to, a);
  return html.slice(a, b < 0 ? undefined : b);
};
const cardHrefs = (html: string) => [...html.matchAll(/<a class="story-card[^"]*" href="([^"]+)"/g)].map((m) => m[1]);

const PAGES = STORIES.map((s) => ({ story: s, html: renderStory(s.slug) }));
const HUB_HTML = renderHub();

describe("the stories content", () => {
  it("has 15 stories with unique slugs, three related stories each, and logos that ship", () => {
    expect(STORIES).toHaveLength(15);
    expect(new Set(STORIES.map((s) => s.slug)).size).toBe(15);
    for (const s of STORIES) {
      expect(s.related, s.slug).toHaveLength(3);
      for (const r of s.related) {
        expect(storyBySlug(r), `${s.slug} -> ${r}`).toBeTruthy();
        expect(r).not.toBe(s.slug);
      }
      expect(existsSync(join(ROOT, "design/overview/img", s.logo)), s.logo).toBe(true);
      expect(s.title.length, s.slug).toBeLessThan(60);
      expect(s.description.length, s.slug).toBeLessThan(155);
    }
    expect(STORIES.filter((s) => s.onShopify).map((s) => s.slug)).toHaveLength(6);
  });

  it("says whose reporting each story is, in plain English", () => {
    expect(publisherPossessive("Modern Retail")).toBe("Modern Retail's");
    expect(publisherPossessive("Volume Nine (agency)")).toBe("Volume Nine's");
    expect(publisherPossessive("The SEO Works (agency)")).toBe("The SEO Works'");
    expect(publisherPossessive("Ahrefs blog")).toBe("the Ahrefs blog's");
    expect(notCustomerNote(storyBySlug("viv-chatgpt-sales")!)).toBe(
      "Viv is not a GEO customer. This page is our summary of Modern Retail's reporting. The figures and quotes are theirs.",
    );
    expect(notCustomerNote(storyBySlug("levenger-chatgpt-sales")!)).toBe(
      "Levenger is not a GEO customer. This page is our summary of Volume Nine's reporting. The figures are theirs.",
    );
    expect(notCustomerNote(storyBySlug("joe-and-bella-chatgpt-customers")!)).toContain("The quotes are theirs.");
    expect(splitLesson("Go into detail. Viv explains manufacturing.")).toEqual(["Go into detail.", "Viv explains manufacturing."]);
  });
});

describe("each story page (server-rendered, no JavaScript)", () => {
  it.each(PAGES.map((p) => [p.story.slug, p] as const))("%s: H1, intro, the story, the source link and the note", (_slug, { story, html }) => {
    const words = text(html);
    expect([...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]).trim())).toEqual([story.h1]);
    expect(words).toContain(story.intro);
    // the intro comes right after the H1 (answer first), in the band
    expect(html.indexOf("st-intro")).toBeGreaterThan(html.indexOf("<h1"));
    expect(html.indexOf("st-intro")).toBeLessThan(html.indexOf("st-main"));
    for (const n of story.keyNumbers) expect(words).toContain(`${n.value} ${n.label}`);
    for (const sec of story.sections) {
      expect(words).toContain(sec.heading);
      for (const p of sec.paragraphs) expect(words).toContain(p);
    }
    for (const q of story.quotes) {
      expect(words).toContain(`“${q.text}”`);
      expect(words).toContain(q.who);
    }
    expect(words).toContain("What other stores can take from this");
    for (const l of story.lessons) expect(words).toContain(l);
    if (story.caveat) expect(words).toContain(story.caveat);

    // The source box at the bottom: the original article in a new tab, its details, and the note beside it.
    const source = between(html, '<section class="st-source" id="source"', "</section>");
    expect(source).toContain(`href="${story.source.url}" target="_blank" rel="noopener noreferrer"`);
    expect(text(source)).toContain("Read the original article");
    expect(text(source)).toContain(`“${story.source.title}”`);
    expect(text(source)).toContain(story.source.publisher);
    // the author, unless it only repeats the publisher ("The Drum, Editorial")
    const author = story.source.author;
    if (author && !author.startsWith(story.source.publisher)) expect(text(source)).toContain(author);
    if (author?.startsWith(story.source.publisher)) expect(text(source)).not.toContain(author);
    if (story.source.dateNote) expect(text(source)).toContain(story.source.dateNote);
    for (const m of story.moreSources ?? []) expect(source).toContain(`href="${m.url}" target="_blank" rel="noopener noreferrer"`);
    expect(text(source)).toContain(notCustomerNote(story));
    expect(text(source)).toContain(`${story.brand} is not a GEO customer.`);
    // after the story, before "Read next"
    expect(html.indexOf('id="source"')).toBeGreaterThan(html.indexOf('id="lessons"'));
    expect(html.indexOf('id="source"')).toBeLessThan(html.indexOf('id="read-next"'));

    // the breadcrumb, the way back to every story and the site footer
    expect(html).toContain('<nav class="tl-crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/stories">Stories</a></li>');
    expect(html).toContain(`<span aria-current="page">${story.brand.replace(/&/g, "&amp;")}</span>`);
    expect(html).toContain('<a href="/stories">See all stories</a>');
    expect(html).toContain('class="tl-foot"');
    expect(html).toContain('<a href="/stories">Stories</a>');
  });

  it.each(PAGES.map((p) => [p.story.slug, p] as const))("%s: Read next shows exactly its 3 related stories", (_slug, { story, html }) => {
    const next = between(html, '<section class="st-next"', "</section>");
    expect(cardHrefs(next)).toEqual(story.related.map((r) => `/stories/${r}`));
    // nothing else on the page is a story card
    expect(cardHrefs(html)).toEqual(story.related.map((r) => `/stories/${r}`));
  });

  it.each(PAGES.map((p) => [p.story.slug, p] as const))("%s: the Shopify badge only for stores on Shopify", (_slug, { story, html }) => {
    const hero = between(html, '<header class="st-hero">', "</header>");
    expect(hero.includes('class="st-shopify"')).toBe(story.onShopify);
    expect(html.match(/class="st-shopify"/g)?.length ?? 0).toBe(story.onShopify ? 1 : 0);
    // the cards under "Read next" carry the bag only for their own Shopify stores
    const cards = between(html, '<section class="st-next"', "</section>").split("<li>").slice(1);
    cards.forEach((card, i) => expect(card.includes("logos/shopify.svg")).toBe(storyBySlug(story.related[i])!.onShopify));
  });

  it.each(PAGES.map((p) => [p.story.slug, p] as const))("%s: no em dash, no spaced en dash, and never a hint the brand uses GEO", (_slug, { story, html }) => {
    const words = text(html);
    expect(words).not.toMatch(EM_DASH);
    expect(words).not.toMatch(SPACED_EN_DASH);
    // "GEO customer" only ever as "not a GEO customer"
    expect(words.match(/GEO customer/g)).toHaveLength(1);
    expect(words).toContain(`${story.brand} is not a GEO customer`);
    expect(words).not.toMatch(/\b(with|using|used|uses|thanks to) GEO\b/i);
    // the one quiet line about GEO's free check is about the reader's products
    expect(html).toContain(
      '<p class="st-try">Want to see if ChatGPT recommends your products? <a href="/tools/ai-visibility-checker">Try our free AI Visibility Checker</a>.</p>',
    );
  });
});

describe("each story page's head", () => {
  it.each(STORIES.map((s) => [s.slug, s] as const))("%s: title, description, one canonical, share tags and Article JSON-LD", (slug, story) => {
    const m = metaOf(page.meta, load(slug).data);
    expect(m[0]).toEqual({ title: story.title });
    expect(find(m, "name", "description").content).toBe(story.description);
    const url = `https://usegeo.app/stories/${slug}`;
    expect(m.filter((d: any) => d.rel === "canonical")).toEqual([{ tagName: "link", rel: "canonical", href: url }]);
    expect(find(m, "property", "og:url").content).toBe(url);
    expect(find(m, "property", "og:image").content).toBe("https://usegeo.app/og/home.png");
    expect(m.some((d: any) => d.name === "robots")).toBe(false);

    const ld = jsonLdOf(m);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@graph"].map((n) => n["@type"])).toEqual(["Organization", "Article", "BreadcrumbList"]);
    expect(ld["@graph"][0]).toEqual(ORG_NODE);
    const article = ld["@graph"][1];
    expect(article.headline).toBe(story.h1);
    expect(article.description).toBe(story.description);
    expect(article.url).toBe(url);
    expect(article.datePublished).toBe(STORIES_UPDATED);
    expect(article.dateModified).toBe("2026-10-12");
    expect(article.author).toEqual({ "@id": ORG_NODE["@id"] });
    expect(article.publisher).toEqual({ "@id": ORG_NODE["@id"] });
    expect(article.about).toEqual({ "@type": "Organization", name: story.brand });
    expect(article.isBasedOn).toMatchObject({ "@type": "CreativeWork", url: story.source.url, name: story.source.title });
    expect(article.isBasedOn.publisher.name.length).toBeGreaterThan(2);
    expect(article.citation.map((c: any) => c.url)).toEqual([story.source.url, ...(story.moreSources ?? []).map((x) => x.url)]);
    expect(article.image).toBe("https://usegeo.app/og/home.png");
    const crumbs = ld["@graph"][2].itemListElement.map((c: any) => [c.name, c.item]);
    expect(crumbs).toEqual([
      ["Home", "https://usegeo.app/"],
      ["Stories", "https://usegeo.app/stories"],
      [story.brand, undefined],
    ]);
  });
});

describe("the hub at /stories", () => {
  it("lists all 15 stories as cards, stores first, with one H1 and the footer", () => {
    expect([...HUB_HTML.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]).trim())).toEqual([STORIES_HUB.h1]);
    const main = HUB_HTML.slice(0, HUB_HTML.indexOf('<footer class="tl-foot"'));
    const order = [...STORIES.filter((s) => s.ecommerce), ...STORIES.filter((s) => !s.ecommerce)];
    expect(cardHrefs(main)).toEqual(order.map((s) => `/stories/${s.slug}`));
    expect(main.match(/logos\/shopify\.svg/g)).toHaveLength(6 + 1); // six cards and the key
    expect(text(HUB_HTML)).toContain("None of these brands are GEO customers.");
    expect(text(HUB_HTML)).not.toMatch(EM_DASH);
    expect(text(HUB_HTML)).not.toMatch(SPACED_EN_DASH);
    expect(HUB_HTML).toContain('<span aria-current="page">Stories</span>');
    expect(HUB_HTML).toContain('class="tl-foot"');
  });

  it("has its head: canonical, CollectionPage, ItemList of every story and BreadcrumbList", () => {
    const m = metaOf(hub.meta, hub.loader());
    expect(m[0]).toEqual({ title: STORIES_HUB.title });
    expect(STORIES_HUB.title.length).toBeLessThan(60);
    expect(STORIES_HUB.description.length).toBeLessThan(155);
    expect(m.filter((d: any) => d.rel === "canonical")).toEqual([{ tagName: "link", rel: "canonical", href: "https://usegeo.app/stories" }]);
    const ld = jsonLdOf(m);
    expect(ld["@graph"].map((n) => n["@type"])).toEqual(["Organization", "CollectionPage", "ItemList", "BreadcrumbList"]);
    const list = ld["@graph"][2];
    expect(list.numberOfItems).toBe(15);
    expect(list.itemListElement.map((i: any) => i.url)).toEqual(STORIES.map((s) => `https://usegeo.app/stories/${s.slug}`));
  });
});

describe("an unknown story", () => {
  it("is a real 404 with noindex, no canonical, and lists every story", () => {
    const res = load("nope");
    expect(res.init?.status).toBe(404);
    expect(new Headers(res.init?.headers).get("X-Robots-Tag")).toBe("noindex");
    expect(res.data.story).toBeNull();
    const m = metaOf(page.meta, res.data);
    expect(m).toContainEqual({ name: "robots", content: "noindex" });
    expect(m.some((d: any) => d.rel === "canonical")).toBe(false);
    const html = renderStory("nope");
    expect(text(html)).toContain("We couldn't find that story.");
    expect(cardHrefs(html)).toEqual(STORIES.map((s) => `/stories/${s.slug}`));
    // the shared headers keep the loader's short cache and add the security headers
    const h = page.headers({ loaderHeaders: new Headers(res.init?.headers), actionHeaders: new Headers(), errorHeaders: undefined, parentHeaders: new Headers() } as any) as Headers;
    expect(h.get("Cache-Control")).toBe("public, max-age=60");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("the canonical host", () => {
  const env = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  it("sends www and the Railway address to usegeo.app for the hub and every story", async () => {
    for (const path of ["/stories", "/stories/viv-chatgpt-sales"]) {
      const moved = (await Promise.resolve()
        .then(() => layout.loader({ request: new Request(`https://www.usegeo.app${path}`), params: {}, context: {} } as unknown as LoaderFunctionArgs))
        .catch((r: Response) => r)) as Response;
      expect(moved.status, path).toBe(301);
      expect(moved.headers.get("location")).toBe(`https://usegeo.app${path}`);
    }
    expect(layout.loader({ request: new Request("https://usegeo.app/stories"), params: {}, context: {} } as unknown as LoaderFunctionArgs)).toBeNull();
  });
});

describe("the home page's stories section", () => {
  it("has no em dash or spaced en dash, and its cards match the story pages' cards", () => {
    const home = readFileSync(join(ROOT, "app/home/home.html"), "utf8");
    const sec = between(home, '<section class="stories"', '<section class="vid-sec"');
    expect(sec).not.toMatch(EM_DASH);
    expect(sec).not.toMatch(SPACED_EN_DASH);
    // the same card markup as the React StoryCard (Viv's card on Joe & Bella's page, under "Read next")
    const homeCard = sec.split("<li>")[1].split("</li>")[0];
    const reactCard = between(renderStory("joe-and-bella-chatgpt-customers"), '<section class="st-next"', "</section>").split("<li>")[1].split("</li>")[0];
    // React closes <path></path> and self-closes <img/>; the home page writes <path/> and <img>
    const normal = (h: string) => h.replace(/\s*\/>/g, ">").replace(/><\/path>/g, ">");
    expect(normal(homeCard)).toBe(normal(reactCard));
  });
});
