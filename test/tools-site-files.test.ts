// The site files for firstpicked.com.au (robots.txt, sitemap.xml, llms.txt) and their routes, plus the head and
// host changes on /check and /privacy that came with the free tools.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type LoaderFunctionArgs, type MetaDescriptor } from "react-router";
import { isAllowed, parseRobots } from "../app/lib/robots";
import { OFFER } from "../app/lib/plans";
import { HUB, TOOLS } from "../app/lib/tools/registry";
import { STORIES } from "../app/lib/stories";
import { STORIES_UPDATED } from "../app/lib/stories/pages";
import { COMPARE_HUB, COMPARE_PAGES } from "../app/lib/compare/pages";
import { HOME_LANGS_UPDATED, HOME_UPDATED, PRIVACY_UPDATED, TERMS_UPDATED } from "../app/lib/tools/site";
import { BLOG_LAUNCHED, siteLlmsTxt, siteRobotsTxt, sitemapPages, sitemapXml } from "../app/lib/tools/site-files";
import { loader as robotsLoader } from "../app/routes/robots[.]txt";
import { loader as sitemapLoader } from "../app/routes/sitemap[.]xml";
import { loader as llmsLoader } from "../app/routes/llms[.]txt";
import * as checkStart from "../app/routes/check._index";
import * as privacy from "../app/routes/privacy";
import * as terms from "../app/routes/terms";

// The sitemap route asks the database for the blog posts; here there are none.
vi.mock("../app/db.server", () => ({ default: { blogPost: { findMany: async () => [] } } }));

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = (url: string, init: RequestInit = {}) => ({ request: new Request(url, init), params: {}, context: {} }) as unknown as LoaderFunctionArgs;
const call = async (fn: (a: LoaderFunctionArgs) => unknown, url: string, init?: RequestInit) =>
  (await Promise.resolve()
    .then(() => fn(args(url, init)))
    .catch((r: Response) => r)) as Response;
const callMeta = (m: unknown) => (m as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });
const DASHES = /\u2014|\s\u2013\s/;

describe("robots.txt for firstpicked.com.au", () => {
  const body = siteRobotsTxt();
  const groups = parseRobots(body);
  const BOTS = ["Googlebot", "OAI-SearchBot", "GPTBot", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Bingbot"];

  it("lets every bot read every public page, report pages included (they carry noindex)", () => {
    for (const bot of BOTS) {
      for (const path of ["/", "/tools", "/tools/ai-crawler-checker", "/check", "/check/abc", "/apple-touch-icon.png", "/llms.txt", "/sitemap.xml", "/privacy", "/tips", "/unsubscribe", "/applesauce"]) {
        expect(isAllowed(groups, bot, path), `${bot} ${path}`).toBe(true);
      }
    }
  });

  it("keeps bots out of the app and the private paths", () => {
    for (const bot of BOTS) {
      for (const path of ["/app", "/app?shop=a.myshopify.com", "/app/fixes", "/auth/login", "/webhooks/x", "/api/pixel"]) {
        expect(isAllowed(groups, bot, path), `${bot} ${path}`).toBe(false);
      }
    }
  });

  it("names the sitemap, has only the * group, and no dashes in the comment", () => {
    expect(body).toContain("\nSitemap: https://firstpicked.com.au/sitemap.xml\n");
    expect(groups).toHaveLength(1);
    expect(groups[0].agents).toEqual(["*"]);
    expect(body.startsWith("# firstpicked.com.au: search engines and AI assistants are welcome on every public page.\nUser-agent: *\n")).toBe(true);
    expect(body).not.toMatch(/Disallow: \/app\n|Disallow: \/check/);
    expect(DASHES.test(body)).toBe(false);
  });

  it("is served as plain text on every host, never redirected, and answers HEAD", async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      for (const url of ["https://firstpicked.com.au/robots.txt", "https://www.firstpicked.com.au/robots.txt", "https://geo-shopify-app-production.up.railway.app/robots.txt"]) {
        const res = await call(robotsLoader, url);
        expect(res.status, url).toBe(200);
        expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
        expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
        expect(await res.text()).toBe(body);
      }
      expect((await call(robotsLoader, "https://firstpicked.com.au/robots.txt", { method: "HEAD" })).status).toBe(200);
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});

describe("sitemap.xml", () => {
  const xml = sitemapXml();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);

  it("is a well-formed sitemaps.org file", () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')).toBe(true);
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);
    // home and 5 languages, tools hub, 7 tools, stories hub, 15 stories, blog, compare hub and pages, privacy, terms
    expect(xml.match(/<url>/g)).toHaveLength(19 + STORIES.length + COMPARE_PAGES.length);
    expect(xml.match(/<\/url>/g)).toHaveLength(19 + STORIES.length + COMPARE_PAGES.length);
    expect(xml).not.toMatch(/priority|changefreq/);
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("lists exactly the home page (and its 5 languages), the hub, the 7 tools, the stories, the blog and the privacy page, with their dates", () => {
    expect(locs).toEqual([
      "https://firstpicked.com.au/",
      ...["de", "fr", "nl", "es", "it"].map((l) => `https://firstpicked.com.au/${l}`),
      "https://firstpicked.com.au/tools",
      ...TOOLS.map((t) => `https://firstpicked.com.au${t.path}`),
      "https://firstpicked.com.au/stories",
      ...STORIES.map((s) => `https://firstpicked.com.au/stories/${s.slug}`),
      "https://firstpicked.com.au/blog",
      "https://firstpicked.com.au/compare",
      ...COMPARE_PAGES.map((p) => `https://firstpicked.com.au/compare/${p.slug}`),
      "https://firstpicked.com.au/privacy",
      "https://firstpicked.com.au/terms",
    ]);
    expect(STORIES).toHaveLength(15);
    for (const l of locs) expect(l.startsWith("https://firstpicked.com.au/")).toBe(true);
    expect(lastmods).toEqual([
      HOME_UPDATED,
      ...Array(5).fill(HOME_LANGS_UPDATED),
      HUB.updated,
      ...TOOLS.map((t) => t.updated),
      STORIES_UPDATED,
      ...STORIES.map(() => STORIES_UPDATED),
      BLOG_LAUNCHED,
      COMPARE_HUB.updated,
      ...COMPARE_PAGES.map((p) => p.checked),
      PRIVACY_UPDATED,
      TERMS_UPDATED,
    ]);
    for (const d of lastmods) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sitemapPages().map((p) => p.path)).not.toContain("/check");
  });

  it("is served as XML, and www sends it to firstpicked.com.au", async () => {
    const res = await call(sitemapLoader, "https://firstpicked.com.au/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await res.text()).toBe(xml);
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const moved = await call(sitemapLoader, "https://www.firstpicked.com.au/sitemap.xml");
      expect(moved.status).toBe(301);
      expect(moved.headers.get("location")).toBe("https://firstpicked.com.au/sitemap.xml");
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});

describe("llms.txt for firstpicked.com.au", () => {
  const txt = siteLlmsTxt();
  const lines = txt.split("\n");

  it("follows the llmstxt.org shape: H1, a summary quote, detail, then H2 link lists", () => {
    expect(lines[0]).toBe("# GEO");
    expect(lines[2].startsWith("> GEO is a Shopify app that helps stores get their products recommended by AI assistants")).toBe(true);
    expect(txt.match(/^# /gm)).toHaveLength(1);
    expect(txt.match(/^## .*/gm)).toEqual(["## Free tools", "## About GEO"]);
    expect(txt).toContain("\n## Free tools\n\n");
    expect(txt).toContain("\n## About GEO\n\n");
    expect(txt.endsWith("\n")).toBe(true);
    expect(DASHES.test(txt)).toBe(false);
  });

  it("links every tool in registry order with its one line, and the main pages", () => {
    const toolLines = lines.filter((l) => l.startsWith("- [") && l.includes("/tools/"));
    expect(toolLines).toEqual(TOOLS.map((t) => `- [${t.name}](https://firstpicked.com.au${t.path}): ${t.short}`));
    expect(txt).toContain("- [Home](https://firstpicked.com.au/): what GEO does, how it works and pricing");
    expect(txt).toContain("- [All free tools](https://firstpicked.com.au/tools): the full list of free tools");
    expect(txt).toContain(
      "- [Stories](https://firstpicked.com.au/stories): other brands' sales and sign-ups from AI assistants, as their sources reported them (none are GEO customers)",
    );
    expect(txt).toContain("- [Privacy policy](https://firstpicked.com.au/privacy): what data GEO collects and why");
    expect(txt).toContain("- [Terms of service](https://firstpicked.com.au/terms): the rules for using GEO, the refund after month one and stopping any time");
  });

  it("takes the price from the offer in plans.ts, never typed in, and says new stores join through the waitlist", () => {
    expect(txt).toContain(`${OFFER.line} New stores start by booking a call with the founder at https://firstpicked.com.au/book.`);
    expect(txt).not.toMatch(/free trial/i);
  });

  it("is served as plain text", async () => {
    const res = await call(llmsLoader, "https://firstpicked.com.au/llms.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe(txt);
  });
});

describe("no static file hides the site file routes", () => {
  it("has no public/robots.txt, public/sitemap.xml or public/llms.txt", () => {
    for (const f of ["robots.txt", "sitemap.xml", "llms.txt"]) expect(existsSync(join(ROOT, "public", f)), `public/${f}`).toBe(false);
  });
});

describe("/check after the free tools", () => {
  it("points search engines at the AI Visibility Checker page and keeps its own title", () => {
    const meta = callMeta(checkStart.meta);
    const canonicals = meta.filter((m) => (m as { rel?: string }).rel === "canonical");
    expect(canonicals).toEqual([{ tagName: "link", rel: "canonical", href: "https://firstpicked.com.au/tools/ai-visibility-checker" }]);
    expect(meta[0]).toEqual({ title: "Free product check: does AI recommend your product? · GEO" });
  });

  it("sends www to firstpicked.com.au on GET, and stays put otherwise", async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const moved = await call(checkStart.loader, "https://www.firstpicked.com.au/check");
      expect(moved.status).toBe(301);
      expect(moved.headers.get("location")).toBe("https://firstpicked.com.au/check");
      expect(await call(checkStart.loader, "https://firstpicked.com.au/check")).toBeNull();
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});

describe("/privacy after the free tools", () => {
  const env = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  it("has a description, a canonical and share tags", () => {
    const meta = callMeta(privacy.meta);
    expect(meta[0]).toEqual({ title: "GEO privacy policy" });
    const desc = meta.find((m) => (m as { name?: string }).name === "description") as { content: string };
    expect(desc.content.length).toBeGreaterThan(40);
    expect(desc.content.length).toBeLessThan(155);
    expect(meta.filter((m) => (m as { rel?: string }).rel === "canonical")).toEqual([{ tagName: "link", rel: "canonical", href: "https://firstpicked.com.au/privacy" }]);
    expect(meta).toContainEqual({ property: "og:image", content: "https://firstpicked.com.au/og/home.png" });
  });

  it("explains the free tools, with the date it last changed", async () => {
    const data = await call(privacy.loader, "https://firstpicked.com.au/privacy");
    expect(data).toBeTruthy();
    const Stub = createRoutesStub([{ id: "privacy", path: "/privacy", Component: privacy.default as ComponentType, loader: () => data }]);
    const html = renderToStaticMarkup(createElement(Stub, { initialEntries: ["/privacy"], hydrationData: { loaderData: { privacy: data } } }));
    const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
    expect(html).toContain('<h2 style="font-size:20px;margin:36px 0 8px;color:#0b0c2b">Free tools</h2>');
    expect(text).toContain("Our free tools at firstpicked.com.au/tools work without an account.");
    expect(html).toContain('<a href="/tools">firstpicked.com.au/tools</a>');
    expect(text).toContain("don't send what you type to us");
    expect(text).toContain("We don't keep the files.");
    expect(text).toContain("The AI Overview Checker sends your search to our data provider, Treg.");
    expect(text).toContain("Crawl4AI, or AnyAPI as a backup");
    expect(text).toContain("We hold it in memory and clear it within a day.");
    expect(text).toContain("We record what each search cost us, without your IP address or your search.");
    expect(text).toContain("Last updated 3 November 2026");
    // the Meta pixel on the home page (Ross's ads, 13 Oct 2026), the giveaway page and the book-a-call page (3 Nov 2026)
    expect(text).toContain("Our home page, giveaway page and booking page use Meta's pixel");
    expect(text).toContain("If you join the waitlist, enter the giveaway or book a call, it tells Meta that someone did.");
    expect(text).toContain("It never sends your name, email address or phone number.");
    // booking a call puts the person's details in Ross's Google Calendar (firstpicked.com.au/book)
    expect(text).toContain("we add it to Ross's Google Calendar with your name, your email address and your store's website.");
    expect(text).toContain("Google: Google Calendar and Google Meet, for calls booked on our website.");
    // the giveaway entries (firstpicked.com.au/giveaway): what we keep, why, and for how long
    expect(text).toContain("If you enter our giveaway, we keep your store's website, your name, email address and phone number");
    expect(text).toContain("We delete it 24 months after you entered, or sooner if you ask.");
    expect(text).toContain("In Europe and the UK, the pixel only starts after you click OK on the cookie notice.");
    expect(DASHES.test(text)).toBe(false);
  });

  it("sends www to firstpicked.com.au", async () => {
    const moved = await call(privacy.loader, "https://www.firstpicked.com.au/privacy");
    expect(moved.status).toBe(301);
    expect(moved.headers.get("location")).toBe("https://firstpicked.com.au/privacy");
  });
});

describe("/terms (Ross, 3 Nov 2026: the same layout as the privacy page)", () => {
  const env = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  it("has a description, a canonical and share tags", () => {
    const meta = callMeta(terms.meta);
    expect(meta[0]).toEqual({ title: "GEO terms of service" });
    const desc = meta.find((m) => (m as { name?: string }).name === "description") as { content: string };
    expect(desc.content.length).toBeGreaterThan(40);
    expect(desc.content.length).toBeLessThan(155);
    expect(meta.filter((m) => (m as { rel?: string }).rel === "canonical")).toEqual([{ tagName: "link", rel: "canonical", href: "https://firstpicked.com.au/terms" }]);
    expect(meta).toContainEqual({ property: "og:image", content: "https://firstpicked.com.au/og/home.png" });
  });

  it("uses the privacy page's layout and makes the home page's promises", async () => {
    const data = await call(terms.loader, "https://firstpicked.com.au/terms");
    const Stub = createRoutesStub([{ id: "terms", path: "/terms", Component: terms.default as ComponentType, loader: () => data }]);
    const html = renderToStaticMarkup(createElement(Stub, { initialEntries: ["/terms"], hydrationData: { loaderData: { terms: data } } }));
    const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
    // the same page and heading styles as /privacy, and the same footer
    expect(html).toContain('<main style="max-width:720px;margin:0 auto;padding:48px 20px 80px;font-family:Inter, system-ui, sans-serif;color:#30313d;line-height:1.7">');
    expect(html).toContain('<h2 style="font-size:20px;margin:36px 0 8px;color:#0b0c2b">Full refund after month one</h2>');
    expect(html).toContain('<footer class="tl-foot">');
    expect(text).toContain("Last updated 3 November 2026");
    expect(text).toContain(`It costs ${OFFER.price}, including GST.`);
    expect(text).toContain("We'll refund that month in full, and you keep all the work we did.");
    expect(text).toContain("You can stop any time.");
    expect(text).toContain("we can't promise exact results");
    expect(text).toContain("We never pretend to be a customer, on Reddit or anywhere else.");
    expect(text).toContain("Nothing in these terms takes away your rights under the Australian Consumer Law.");
    expect(html).toContain('<a href="/privacy">privacy policy</a>');
    expect(html).toContain('<a href="sms:+61400369865">0400 369 865</a>');
    expect(DASHES.test(text)).toBe(false);
  });

  it("sends www to firstpicked.com.au", async () => {
    const moved = await call(terms.loader, "https://www.firstpicked.com.au/terms");
    expect(moved.status).toBe(301);
    expect(moved.headers.get("location")).toBe("https://firstpicked.com.au/terms");
  });
});
