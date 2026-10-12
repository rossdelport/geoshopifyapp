// The site files for usegeo.app (robots.txt, sitemap.xml, llms.txt) and their routes, plus the head and
// host changes on /check and /privacy that came with the free tools.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type LoaderFunctionArgs, type MetaDescriptor } from "react-router";
import { isAllowed, parseRobots } from "../app/lib/robots";
import { PLANS } from "../app/lib/plans";
import { HUB, TOOLS } from "../app/lib/tools/registry";
import { STORIES } from "../app/lib/stories";
import { STORIES_UPDATED } from "../app/lib/stories/pages";
import { HOME_UPDATED, PRIVACY_UPDATED } from "../app/lib/tools/site";
import { siteLlmsTxt, siteRobotsTxt, sitemapPages, sitemapXml } from "../app/lib/tools/site-files";
import { loader as robotsLoader } from "../app/routes/robots[.]txt";
import { loader as sitemapLoader } from "../app/routes/sitemap[.]xml";
import { loader as llmsLoader } from "../app/routes/llms[.]txt";
import * as checkStart from "../app/routes/check._index";
import * as privacy from "../app/routes/privacy";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const args = (url: string, init: RequestInit = {}) => ({ request: new Request(url, init), params: {}, context: {} }) as unknown as LoaderFunctionArgs;
const call = async (fn: (a: LoaderFunctionArgs) => unknown, url: string, init?: RequestInit) =>
  (await Promise.resolve()
    .then(() => fn(args(url, init)))
    .catch((r: Response) => r)) as Response;
const callMeta = (m: unknown) => (m as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });
const DASHES = /\u2014|\s\u2013\s/;

describe("robots.txt for usegeo.app", () => {
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
    expect(body).toContain("\nSitemap: https://usegeo.app/sitemap.xml\n");
    expect(groups).toHaveLength(1);
    expect(groups[0].agents).toEqual(["*"]);
    expect(body.startsWith("# usegeo.app: search engines and AI assistants are welcome on every public page.\nUser-agent: *\n")).toBe(true);
    expect(body).not.toMatch(/Disallow: \/app\n|Disallow: \/check/);
    expect(DASHES.test(body)).toBe(false);
  });

  it("is served as plain text on every host, never redirected, and answers HEAD", async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      for (const url of ["https://usegeo.app/robots.txt", "https://www.usegeo.app/robots.txt", "https://geo-shopify-app-production.up.railway.app/robots.txt"]) {
        const res = await call(robotsLoader, url);
        expect(res.status, url).toBe(200);
        expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
        expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
        expect(await res.text()).toBe(body);
      }
      expect((await call(robotsLoader, "https://usegeo.app/robots.txt", { method: "HEAD" })).status).toBe(200);
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
    // home, tools hub, 7 tools, stories hub, 15 stories, privacy
    expect(xml.match(/<url>/g)).toHaveLength(11 + STORIES.length);
    expect(xml.match(/<\/url>/g)).toHaveLength(11 + STORIES.length);
    expect(xml).not.toMatch(/priority|changefreq/);
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it("lists exactly the home page, the hub, the 7 tools, the stories and the privacy page, with their dates", () => {
    expect(locs).toEqual([
      "https://usegeo.app/",
      "https://usegeo.app/tools",
      ...TOOLS.map((t) => `https://usegeo.app${t.path}`),
      "https://usegeo.app/stories",
      ...STORIES.map((s) => `https://usegeo.app/stories/${s.slug}`),
      "https://usegeo.app/privacy",
    ]);
    expect(STORIES).toHaveLength(15);
    for (const l of locs) expect(l.startsWith("https://usegeo.app/")).toBe(true);
    expect(lastmods).toEqual([
      HOME_UPDATED,
      HUB.updated,
      ...TOOLS.map((t) => t.updated),
      STORIES_UPDATED,
      ...STORIES.map(() => STORIES_UPDATED),
      PRIVACY_UPDATED,
    ]);
    for (const d of lastmods) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(sitemapPages().map((p) => p.path)).not.toContain("/check");
  });

  it("is served as XML, and www sends it to usegeo.app", async () => {
    const res = await call(sitemapLoader, "https://usegeo.app/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await res.text()).toBe(xml);
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const moved = await call(sitemapLoader, "https://www.usegeo.app/sitemap.xml");
      expect(moved.status).toBe(301);
      expect(moved.headers.get("location")).toBe("https://usegeo.app/sitemap.xml");
    } finally {
      process.env.NODE_ENV = env;
    }
  });
});

describe("llms.txt for usegeo.app", () => {
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
    expect(toolLines).toEqual(TOOLS.map((t) => `- [${t.name}](https://usegeo.app${t.path}): ${t.short}`));
    expect(txt).toContain("- [Home](https://usegeo.app/): what GEO does, how it works and pricing");
    expect(txt).toContain("- [All free tools](https://usegeo.app/tools): the full list of free tools");
    expect(txt).toContain(
      "- [Stories](https://usegeo.app/stories): other brands' sales and sign-ups from AI assistants, as their sources reported them (none are GEO customers)",
    );
    expect(txt).toContain("- [Privacy policy](https://usegeo.app/privacy): what data GEO collects and why");
  });

  it("takes the prices and trial from the plans, never typed in", () => {
    expect(txt).toContain(
      `GEO has two plans: ${PLANS.core.name} at US$${PLANS.core.priceUsd} a month and ${PLANS.pro.name} at US$${PLANS.pro.priceUsd} a month, both with a ${PLANS.core.trialDays}-day free trial.`,
    );
    expect(PLANS.pro.trialDays).toBe(PLANS.core.trialDays);
  });

  it("is served as plain text", async () => {
    const res = await call(llmsLoader, "https://usegeo.app/llms.txt");
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
    expect(canonicals).toEqual([{ tagName: "link", rel: "canonical", href: "https://usegeo.app/tools/ai-visibility-checker" }]);
    expect(meta[0]).toEqual({ title: "Free product check: does AI recommend your product? · GEO" });
  });

  it("sends www to usegeo.app on GET, and stays put otherwise", async () => {
    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const moved = await call(checkStart.loader, "https://www.usegeo.app/check");
      expect(moved.status).toBe(301);
      expect(moved.headers.get("location")).toBe("https://usegeo.app/check");
      expect(await call(checkStart.loader, "https://usegeo.app/check")).toBeNull();
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
    expect(meta.filter((m) => (m as { rel?: string }).rel === "canonical")).toEqual([{ tagName: "link", rel: "canonical", href: "https://usegeo.app/privacy" }]);
    expect(meta).toContainEqual({ property: "og:image", content: "https://usegeo.app/og/home.png" });
  });

  it("explains the free tools, with the date it last changed", async () => {
    const data = await call(privacy.loader, "https://usegeo.app/privacy");
    expect(data).toBeTruthy();
    const Stub = createRoutesStub([{ id: "privacy", path: "/privacy", Component: privacy.default as ComponentType, loader: () => data }]);
    const html = renderToStaticMarkup(createElement(Stub, { initialEntries: ["/privacy"], hydrationData: { loaderData: { privacy: data } } }));
    const text = html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
    expect(html).toContain('<h2 style="font-size:20px;margin:36px 0 8px;color:#0b0c2b">Free tools</h2>');
    expect(text).toContain("Our free tools at usegeo.app/tools work without an account.");
    expect(html).toContain('<a href="/tools">usegeo.app/tools</a>');
    expect(text).toContain("don't send what you type to us");
    expect(text).toContain("We don't keep the files.");
    expect(text).toContain("The AI Overview Checker sends your search phrase to our data provider, Treg");
    expect(text).toContain("Crawl4AI, or AnyAPI as a backup");
    expect(text).toContain("held in memory and cleared within a day");
    expect(text).toContain("We record what each search cost us, without your IP address or your search.");
    expect(text).toContain("Last updated 11 October 2026");
    expect(DASHES.test(text)).toBe(false);
  });

  it("sends www to usegeo.app", async () => {
    const moved = await call(privacy.loader, "https://www.usegeo.app/privacy");
    expect(moved.status).toBe(301);
    expect(moved.headers.get("location")).toBe("https://usegeo.app/privacy");
  });
});
