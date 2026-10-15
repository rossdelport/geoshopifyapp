/* eslint-disable @typescript-eslint/no-explicit-any -- reads meta descriptors and JSON-LD of many shapes */
// GEO's own blog. Pure parts: the schedule (first six half an hour apart, then Monday, Wednesday and Friday from 9am
// Sydney, one a day, a pause after a failed write), the topic list (comparisons first, each once), the knowledge pack
// and allowed sources, and `finishPost` (dashes tidied, sources only from the pack, real related links, refused when
// thin or when it says a brand uses GEO). Pages: /blog and /blog/<slug> rendered with createRoutesStub and a faked
// database: H1, cards, byline, sources, the AI note, JSON-LD, no em dash, and a 404 with noindex for unknown slugs.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type LoaderFunctionArgs } from "react-router";
import type { BlogState, PostDraft } from "../app/lib/blog.server";

const fakeDb = vi.hoisted(() => ({
  blogPost: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  job: { findFirst: vi.fn() },
}));
vi.mock("../app/db.server", () => ({ default: fakeDb }));
vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));

const blog = await import("../app/lib/blog.server");
const pages = await import("../app/lib/blog/pages");
const topics = await import("../app/lib/blog/topics");
const { STORIES } = await import("../app/lib/stories");
const { TOOLS } = await import("../app/lib/tools/registry");
const layout = await import("../app/routes/blog");
const hub = await import("../app/routes/blog._index");
const page = await import("../app/routes/blog.$slug");

const EM_DASH = /—/;
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");
const TECHCRUNCH = "https://techcrunch.com/2025/07/21/chatgpt-users-send-2-5-billion-prompts-a-day/";
const DAY = 86_400_000;

// A paragraph of n long sentences (about 40 words each), so a draft clears the 600-word floor.
const para = (n: number, seed = "Shoppers ask AI assistants what to buy") =>
  Array.from(
    { length: n },
    (_, i) =>
      `${seed} and the answer names a few brands, quotes a handful of pages, and changes a little from one run to the next, so a store checks it more than once and keeps a simple score over time (${i + 1}).`,
  ).join(" ");

function draft(over: Partial<PostDraft> = {}): PostDraft {
  return {
    title: "ChatGPT vs Google AI Overviews: where product questions get answered:",
    description:
      "How each assistant answers a buying question, what it quotes and which one to care about first. A second sentence that pushes this description well past the limit of one hundred and sixty characters so it has to be trimmed.",
    intro: [para(2), para(2)],
    sections: [1, 2, 3, 4].map((i) => ({ heading: `Section ${i}.`, paragraphs: [para(2), para(2)], bullets: i === 1 ? ["One — two", "Three"] : null })),
    takeaways: ["Check twice — answers vary.", "Keep a score."],
    faqs: [{ q: "Does it change?", a: "Yes, from run to run." }],
    sources: [
      { url: TECHCRUNCH, title: "TechCrunch" },
      { url: "https://made-up.example/post", title: "Made up" },
      { url: `${TECHCRUNCH}#x`, title: "The same page again" },
      { url: TECHCRUNCH.toUpperCase(), title: "Shouting" },
    ],
    related_stories: ["nope", STORIES[0].slug],
    related_tools: ["ai-visibility-checker", "not-a-tool"],
    ...over,
  };
}
const TOPIC = { key: "t", kind: "comparison" as const };

describe("the schedule", () => {
  const state = (over: Partial<BlogState> = {}): BlogState => ({ posts: 0, lastPublishedAt: null, lastFailedAt: null, ...over });
  const now = new Date("2026-10-15T04:00:00Z");

  it("writes the first six half an hour apart, at any hour", () => {
    expect(blog.blogDue(now, state())).toBe(true);
    expect(blog.blogDue(now, state({ posts: 2, lastPublishedAt: new Date(now.getTime() - 10 * 60_000) }))).toBe(false);
    expect(blog.blogDue(now, state({ posts: 2, lastPublishedAt: new Date(now.getTime() - 31 * 60_000) }))).toBe(true);
    expect(blog.blogDue(now, state({ posts: 5, lastPublishedAt: new Date(now.getTime() - DAY) }))).toBe(true);
  });

  it("then one on Monday, Wednesday and Friday from 9am Sydney time, never two in a day", () => {
    const monday930 = new Date("2026-10-18T22:30:00Z"); // Mon 19 Oct 2026, 09:30 in Sydney (UTC+11)
    expect(blog.sydneyClock(monday930)).toEqual({ day: "2026-10-19", weekday: 1, hour: 9 });
    const six = (last: string | null) => state({ posts: 6, lastPublishedAt: last ? new Date(last) : null });
    expect(blog.blogDue(monday930, six("2026-10-16T00:00:00Z"))).toBe(true);
    expect(blog.blogDue(new Date("2026-10-20T22:00:00Z"), six("2026-10-18T22:40:00Z"))).toBe(true); // Wed 09:00
    expect(blog.blogDue(new Date("2026-10-22T23:59:00Z"), six("2026-10-20T22:40:00Z"))).toBe(true); // Fri 10:59
    expect(blog.blogDue(new Date("2026-10-18T21:30:00Z"), six("2026-10-16T00:00:00Z"))).toBe(false); // Mon 08:30: too early
    expect(blog.blogDue(new Date("2026-10-19T23:00:00Z"), six("2026-10-16T00:00:00Z"))).toBe(false); // Tue
    expect(blog.blogDue(new Date("2026-10-18T23:30:00Z"), six("2026-10-18T22:05:00Z"))).toBe(false); // Mon 10:30, already one today
    expect(blog.blogDue(new Date("2026-10-24T23:00:00Z"), six(null))).toBe(false); // Sun
  });

  it("waits three hours after a failed write", () => {
    expect(blog.blogDue(now, state({ lastFailedAt: new Date(now.getTime() - 3_600_000) }))).toBe(false);
    expect(blog.blogDue(now, state({ lastFailedAt: new Date(now.getTime() - 4 * 3_600_000) }))).toBe(true);
  });

  it("explains itself on the admin page", () => {
    expect(blog.blogScheduleLine(state({ posts: 2 }))).toContain("2 of 6");
    expect(blog.blogScheduleLine(state({ posts: 9 }))).toContain("Monday, Wednesday and Friday");
  });
});

describe("the topics", () => {
  it("start with comparisons, are each written once, and run out cleanly", () => {
    expect(topics.BLOG_TOPICS.slice(0, 4).every((t) => t.kind === "comparison")).toBe(true);
    expect(new Set(topics.BLOG_TOPICS.map((t) => t.key)).size).toBe(topics.BLOG_TOPICS.length);
    expect(topics.nextTopic([])?.key).toBe("chatgpt-vs-google-ai-overviews-vs-perplexity");
    expect(topics.nextTopic(["chatgpt-vs-google-ai-overviews-vs-perplexity"])?.key).toBe("ai-search-vs-google-seo");
    expect(topics.nextTopic(topics.BLOG_TOPICS.map((t) => t.key))).toBeNull();
    for (const t of topics.BLOG_TOPICS) {
      expect(topics.BLOG_KINDS).toContain(t.kind);
      expect(`${t.title} ${t.brief}`).not.toMatch(EM_DASH);
    }
  });
});

describe("the knowledge pack", () => {
  it("holds the facts sheet, the research notes, the guide, every story and every tool", () => {
    const pack = blog.knowledgePack();
    expect(pack).toContain("Facts sheet");
    expect(pack).toContain(TECHCRUNCH);
    for (const s of STORIES) expect(pack).toContain(`Story slug: ${s.slug}`);
    for (const t of TOOLS) expect(pack).toContain(`tool slug: ${t.slug}`);
    expect(pack).toContain("none are GEO customers");
  });

  it("allows only outside pages as sources", () => {
    const allowed = blog.allowedSourceUrls();
    expect(allowed.get(TECHCRUNCH.replace(/\/$/, ""))).toBe(TECHCRUNCH);
    for (const s of STORIES) expect(allowed.get(s.source.url.replace(/\/$/, "").toLowerCase())).toBe(s.source.url);
    for (const u of allowed.keys()) expect(u).not.toContain("usegeo.app");
  });
});

describe("finishPost", () => {
  const allowed = blog.allowedSourceUrls();

  it("tidies the draft: no dashes, a short description, sources from the pack only, real related links", () => {
    const post = blog.finishPost(draft(), TOPIC, allowed);
    expect(post.title).toBe("ChatGPT vs Google AI Overviews: where product questions get answered");
    expect(post.description).toBe("How each assistant answers a buying question, what it quotes and which one to care about first.");
    expect(post.body.sections[0].heading).toBe("Section 1");
    expect(post.body.sections[0].bullets).toEqual(["One, two", "Three"]);
    expect(post.body.sections[1].bullets).toBeUndefined();
    expect(post.body.takeaways[0]).toBe("Check twice, answers vary.");
    expect(post.body.sources).toEqual([{ url: TECHCRUNCH, title: "TechCrunch" }]);
    expect(post.body.relatedStories).toHaveLength(3);
    expect(post.body.relatedStories[0]).toBe(STORIES[0].slug);
    expect(new Set(post.body.relatedStories).size).toBe(3);
    expect(post.body.relatedTools).toEqual(["ai-visibility-checker"]);
    expect(post.kind).toBe("comparison");
    expect(post.topicKey).toBe("t");
    expect(post.words).toBeGreaterThan(600);
    expect(JSON.stringify(post)).not.toMatch(EM_DASH);
  });

  it("refuses thin, short or over-long posts and bad titles", () => {
    expect(() => blog.finishPost(draft({ sections: draft().sections.slice(0, 2) }), TOPIC, allowed)).toThrow(blog.PostProblem);
    expect(() => blog.finishPost(draft({ sections: draft().sections.map((s) => ({ ...s, paragraphs: ["Short."] })) }), TOPIC, allowed)).toThrow(/words/);
    expect(() => blog.finishPost(draft({ title: "Short" }), TOPIC, allowed)).toThrow(/title/);
    expect(() => blog.finishPost(draft({ intro: [] }), TOPIC, allowed)).toThrow(/intro/);
  });

  it("refuses any line that makes a story's brand a GEO customer", () => {
    const brand = STORIES[0].brand;
    expect(blog.customerClaim(`${brand} got sales from ChatGPT. GEO shows you the same numbers for your store.`)).toBeNull();
    expect(blog.customerClaim("Stores on any plan see this on the dashboard.")).toBeNull();
    expect(blog.customerClaim(`${brand} uses GEO to track this.`)).toMatch(/uses GEO/);
    expect(blog.customerClaim(`With GEO, ${brand} doubled its sales.`)).toContain(brand);
    expect(blog.customerClaim("Thanks to GEO, the brand doubled its sales.")).toMatch(/Thanks to GEO/);
    expect(() => blog.finishPost(draft({ intro: [`${brand} uses GEO to track this.`, para(2)] }), TOPIC, allowed)).toThrow(/uses GEO/);
  });

  it("fits a description under 160 characters by whole sentences, or at a word", () => {
    expect(blog.fitDescription("Short and sweet.")).toBe("Short and sweet.");
    const long = `${"Many words in one very long sentence that never seems to end ".repeat(4).trim()}.`;
    const fitted = blog.fitDescription(long);
    expect(fitted.length).toBeLessThanOrEqual(160);
    expect(fitted).toMatch(/\.$/);
    expect(fitted).not.toMatch(/\s\.$/);
  });

  it("tops related stories up to three real ones", () => {
    expect(blog.pickStories([])).toHaveLength(3);
    expect(blog.pickStories(["x", "y"])).toHaveLength(3);
    expect(blog.pickStories([STORIES[2].slug])[0]).toBe(STORIES[2].slug);
  });
});

describe("the pure page helpers", () => {
  it("make slugs, reading times and JSON-LD", () => {
    expect(pages.slugify("ChatGPT vs Google AI Overviews: where shoppers' questions get answered?")).toBe("chatgpt-vs-google-ai-overviews-where-shoppers-questions-get-answered");
    expect(pages.slugify("!!!")).toBe("post");
    expect(pages.slugify("x".repeat(100)).length).toBeLessThanOrEqual(70);
    expect(pages.readMinutes(1100)).toBe(5);
    expect(pages.readMinutes(50)).toBe(1);
    expect(pages.isoDay(new Date("2026-10-15T22:00:00Z"))).toBe("2026-10-15");
    const post = blog.finishPost(draft(), TOPIC, blog.allowedSourceUrls());
    const ld = pages.postJsonLd({ ...post, slug: "a-post", publishedAt: "2026-10-15T00:00:00.000Z", updatedAt: "2026-10-15T00:00:00.000Z" });
    const types = (ld["@graph"] as any[]).map((n) => n["@type"]);
    expect(types).toEqual(["Organization", "BlogPosting", "BreadcrumbList", "FAQPage"]);
    const posting = (ld["@graph"] as any[])[1];
    expect(posting.url).toBe("https://usegeo.app/blog/a-post");
    expect(posting.datePublished).toBe("2026-10-15");
    expect(posting.citation).toHaveLength(1);
    const hubLd = pages.blogHubJsonLd([pages.toPostCard({ ...post, slug: "a-post", publishedAt: new Date("2026-10-15T00:00:00Z") })]);
    expect((hubLd["@graph"] as any[])[1].blogPost[0].url).toBe("https://usegeo.app/blog/a-post");
  });
});

describe("the pages", () => {
  const row = (slug: string, title: string, over: Record<string, unknown> = {}) => {
    const post = blog.finishPost(draft({ title }), { key: slug, kind: "comparison" }, blog.allowedSourceUrls());
    return { id: slug, slug, ...post, status: "published", publishedAt: new Date("2026-10-15T00:00:00Z"), createdAt: new Date("2026-10-15T00:00:00Z"), updatedAt: new Date("2026-10-15T00:00:00Z"), ...over };
  };
  const args = (slug: string) => ({ request: new Request(`https://usegeo.app/blog/${slug}`), params: { slug }, context: {} }) as unknown as LoaderFunctionArgs;
  const dataOf = async (p: Promise<unknown>) => (await p) as { data: any; init?: ResponseInit };

  beforeEach(() => {
    fakeDb.blogPost.findUnique.mockReset();
    fakeDb.blogPost.findMany.mockReset();
  });

  function render(path: string, loaderData: unknown, Component: ComponentType, id: string) {
    const Stub = createRoutesStub([
      { id: "blog", path: "/blog", Component: layout.default as ComponentType, children: [{ id, path: id === "hub" ? "" : ":slug", index: id === "hub", Component, loader: () => loaderData }] },
    ]);
    return renderToStaticMarkup(createElement(Stub, { initialEntries: [path], hydrationData: { loaderData: { blog: null, [id]: loaderData } } }));
  }

  it("the hub lists every published post as a card, newest first, with the Stories pill", async () => {
    fakeDb.blogPost.findMany.mockResolvedValue([row("first-post", "ChatGPT vs Google AI Overviews: where product questions get answered"), row("second-post", "AI search vs Google SEO: what changes for a Shopify store")]);
    const { data, init } = await dataOf(hub.loader());
    expect(fakeDb.blogPost.findMany.mock.calls[0][0].where).toEqual({ status: "published" });
    expect(new Headers(init?.headers).get("Cache-Control")).toBe("public, max-age=300");
    const html = render("/blog", data, hub.default as ComponentType, "hub");
    expect(html).toContain(`<h1 class="ck-h1">${pages.BLOG_HUB.h1}</h1>`);
    expect(html).toContain('href="/blog/first-post"');
    expect(html).toContain('href="/blog/second-post"');
    expect(html).toContain(">Comparison<");
    expect(html).toContain("15 October 2026");
    expect(html).toContain('href="/stories"');
    expect(html).not.toMatch(EM_DASH);
    const meta = hub.meta({ data } as any) as any[];
    expect(meta.find((m) => m.tagName === "link" && m.rel === "canonical")?.href).toBe("https://usegeo.app/blog");
  });

  it("an empty hub says the first articles are on their way", async () => {
    fakeDb.blogPost.findMany.mockResolvedValue([]);
    const { data } = await dataOf(hub.loader());
    expect(render("/blog", data, hub.default as ComponentType, "hub")).toContain("The first articles are being written");
  });

  it("a post shows the answer first, every section, takeaways, questions, sources, the AI note and links on", async () => {
    const post = row("first-post", "ChatGPT vs Google AI Overviews: where product questions get answered");
    fakeDb.blogPost.findUnique.mockResolvedValue(post);
    fakeDb.blogPost.findMany.mockResolvedValue([row("second-post", "AI search vs Google SEO: what changes for a Shopify store")]);
    const { data, init } = await dataOf(page.loader(args("first-post")));
    expect(init?.status).toBeUndefined();
    expect(data.stories).toHaveLength(3);
    expect(data.tools.map((t: any) => t.slug)).toEqual(["ai-visibility-checker"]);
    const html = render("/blog/first-post", data, page.default as ComponentType, "post");
    const plain = text(html);
    expect(html).toContain('<h1 class="ck-h1 st-h1" id="post-h1">ChatGPT vs Google AI Overviews: where product questions get answered</h1>');
    expect(plain).toContain("The GEO team · 15 October 2026 · ");
    expect(plain).toMatch(/\d+ minute read/);
    for (const s of post.body.sections) expect(html).toContain(`>${s.heading}</h2>`);
    expect(html).toContain("<li>One, two</li>");
    expect(plain).toContain("Key takeaways");
    expect(plain).toContain("Questions people ask");
    expect(html).toContain("<summary>Does it change?</summary>");
    expect(html).toContain(`<a href="${TECHCRUNCH}" target="_blank" rel="noopener noreferrer">TechCrunch`);
    expect(plain).toContain("Written by the GEO team with help from AI");
    expect(plain).toContain("Stories worth reading");
    expect(html).toContain(`href="/stories/${STORIES[0].slug}"`);
    expect(plain).toContain("Free tools that help");
    expect(html).toContain('href="/tools/ai-visibility-checker"');
    expect(plain).toContain("Read next");
    expect(html).toContain('href="/blog/second-post"');
    expect(html).toContain('class="ck-pill tl-pill" href="/blog">All posts</a>');
    expect(html).not.toMatch(EM_DASH);
    const meta = page.meta({ data } as any) as any[];
    expect(meta.find((m) => m.tagName === "link" && m.rel === "canonical")?.href).toBe("https://usegeo.app/blog/first-post");
    const ld = JSON.stringify(meta.find((m) => m["script:ld+json"])?.["script:ld+json"]);
    expect(ld).toContain('"BlogPosting"');
    expect(ld).toContain('"FAQPage"');
  });

  it("an unknown or hidden slug is a 404 with noindex that lists the posts", async () => {
    fakeDb.blogPost.findUnique.mockResolvedValue(null);
    fakeDb.blogPost.findMany.mockResolvedValue([row("first-post", "ChatGPT vs Google AI Overviews: where product questions get answered")]);
    const { data, init } = await dataOf(page.loader(args("nope")));
    expect(init?.status).toBe(404);
    expect(new Headers(init?.headers).get("X-Robots-Tag")).toBe("noindex");
    const html = render("/blog/nope", data, page.default as ComponentType, "post");
    expect(html).toContain("We couldn&#x27;t find that post.");
    expect(html).toContain('href="/blog/first-post"');
    const meta = page.meta({ data } as any) as any[];
    expect(meta.some((m) => m.name === "robots" && /noindex/.test(m.content))).toBe(true);

    fakeDb.blogPost.findUnique.mockResolvedValue(row("hidden-post", "ChatGPT vs Google AI Overviews: where product questions get answered", { status: "hidden" }));
    expect((await dataOf(page.loader(args("hidden-post")))).init?.status).toBe(404);
  });
});
