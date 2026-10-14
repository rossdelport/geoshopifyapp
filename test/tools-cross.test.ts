/* eslint-disable @typescript-eslint/no-explicit-any -- reads meta descriptors and route modules of many shapes */
// The free tools as one set (docs/tools/spec.md 7.2): every registry tool has its route, every page has one
// canonical, one H1 with its search term, exactly one button and the full footer; the footer, hub, sitemap,
// llms.txt and the static home page list the same seven pages; our own robots.txt and llms.txt pass our own
// checkers; titles and descriptions are unique across the public pages; and no copy module has an em dash.
// Pages are rendered on the server with createRoutesStub (no JavaScript, no network, no paid calls).

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type MetaDescriptor } from "react-router";
import { HUB, TOOLS, TOOL_GROUPS, isToolSlug, type ToolEntry } from "../app/lib/tools/registry";
import { HOME_LANGS, SITE, abs } from "../app/lib/tools/site";
import { siteLlmsTxt, siteRobotsTxt, sitemapPages, sitemapXml } from "../app/lib/tools/site-files";
import { toolHeaders } from "../app/lib/tools/http";
import { llmsReport } from "../app/lib/tools/llms";
import { TOOL_BOTS, VERDICT_COPY, checkBots, verdict } from "../app/lib/tools/crawler";
import { SiteFooter } from "../app/components/site-footer";
import { STORIES } from "../app/lib/stories";
import * as layout from "../app/routes/tools";
import * as hub from "../app/routes/tools._index";
import * as privacy from "../app/routes/privacy";
import * as checkIndex from "../app/routes/check._index";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const EM_DASH = /\u2014/;
const SPACED_EN_DASH = /\s\u2013\s/;
const decode = (h: string) =>
  h.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
const text = (h: string) => decode(h.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

/** Every tool's route module, loaded by its file name (the registry is the list). */
const ROUTES = new Map<string, any>(
  await Promise.all(TOOLS.map(async (t) => [t.slug, await import(`../app/routes/tools.${t.slug}.tsx`)] as const)),
);

const metaOf = (mod: any): MetaDescriptor[] => mod.meta({} as any) as MetaDescriptor[];
const titleOf = (m: MetaDescriptor[]) => (m.find((d: any) => "title" in d) as any)?.title as string;
const descriptionOf = (m: MetaDescriptor[]) => (m.find((d: any) => d.name === "description") as any)?.content as string;
const canonicals = (m: MetaDescriptor[]) => m.filter((d: any) => d.tagName === "link" && d.rel === "canonical").map((d: any) => d.href as string);

function renderTool(t: ToolEntry) {
  const Stub = createRoutesStub([
    {
      id: "tools",
      path: "/tools",
      Component: layout.default as ComponentType,
      children: [{ id: t.slug, path: t.slug, Component: ROUTES.get(t.slug).default as ComponentType, action: () => null }],
    },
  ]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [t.path], hydrationData: { loaderData: {} } }));
}

function renderHub() {
  const Stub = createRoutesStub([
    { id: "tools", path: "/tools", Component: layout.default as ComponentType, children: [{ id: "hub", index: true, Component: hub.default as ComponentType }] },
  ]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ["/tools"], hydrationData: { loaderData: {} } }));
}

const PAGES = TOOLS.map((t) => ({ tool: t, html: renderTool(t) }));
const HUB_HTML = renderHub();
const SEVEN = TOOLS.map((t) => t.path);
const toolHrefs = (html: string) => [...new Set([...html.matchAll(/href="(\/tools\/[a-z0-9-]+)"/g)].map((m) => m[1]))];
/** The site footer's part of a page. */
const footerOf = (html: string) => html.slice(html.indexOf('<footer class="tl-foot"'));

describe("every registry tool has its page", () => {
  it.each(TOOLS.map((t) => [t.slug, t] as const))("%s: a route file with a default export, meta and the shared headers", (slug, t) => {
    expect(existsSync(join(ROOT, `app/routes/tools.${slug}.tsx`))).toBe(true);
    const mod = ROUTES.get(slug);
    expect(typeof mod.default).toBe("function");
    expect(typeof mod.meta).toBe("function");
    // A child route without `headers` would copy the layout's and lose its own action's no-store headers.
    expect(mod.headers).toBe(toolHeaders);
    expect(t.path).toBe(`/tools/${slug}`);
  });

  it("has no tool page outside the registry", () => {
    const files = readdirSync(join(ROOT, "app/routes")).filter((f) => /^tools\.[a-z0-9-]+\.tsx$/.test(f) && f !== "tools._index.tsx");
    expect(files.map((f) => f.slice(6, -4)).sort()).toEqual(TOOLS.map((t) => t.slug).sort());
  });

  it("resolves every related slug to another tool, and puts every tool in exactly one hub group", () => {
    for (const t of TOOLS) {
      expect(t.related).toHaveLength(3);
      for (const r of t.related) {
        expect(isToolSlug(r)).toBe(true);
        expect(r).not.toBe(t.slug);
      }
    }
    expect(TOOL_GROUPS.flatMap((g) => g.slugs).sort()).toEqual(TOOLS.map((t) => t.slug).sort());
  });
});

describe("each tool page's head", () => {
  it.each(TOOLS.map((t) => [t.slug, t] as const))("%s: registry title and description, exactly one absolute canonical, no robots meta", (slug, t) => {
    const m = metaOf(ROUTES.get(slug));
    expect(titleOf(m)).toBe(t.title);
    expect(descriptionOf(m)).toBe(t.description);
    expect(canonicals(m)).toEqual([`${SITE}${t.path}`]);
    expect(m.find((d: any) => d.property === "og:url")).toMatchObject({ content: `${SITE}${t.path}` });
    expect(m.some((d: any) => d.name === "robots")).toBe(false);
    expect(m.filter((d: any) => "script:ld+json" in d)).toHaveLength(1);
  });

  it("gives every public page its own title and description", () => {
    const home = read("app/home/home.html");
    const heads = [
      { path: "/", title: home.match(/<title>([^<]*)<\/title>/)?.[1], description: home.match(/<meta name="description" content="([^"]*)"/)?.[1] },
      { path: "/tools", title: titleOf(metaOf(hub)), description: descriptionOf(metaOf(hub)) },
      { path: "/privacy", title: titleOf(metaOf(privacy)), description: descriptionOf(metaOf(privacy)) },
      ...TOOLS.map((t) => ({ path: t.path, title: titleOf(metaOf(ROUTES.get(t.slug))), description: descriptionOf(metaOf(ROUTES.get(t.slug))) })),
    ];
    for (const h of heads) {
      expect(h.title, h.path).toBeTruthy();
      expect(h.description, h.path).toBeTruthy();
    }
    expect(new Set(heads.map((h) => h.title)).size).toBe(heads.length);
    expect(new Set(heads.map((h) => h.description)).size).toBe(heads.length);
  });

  it("points /check's canonical at the AI Visibility Checker (one indexable page for that search)", () => {
    expect(canonicals(metaOf(checkIndex))).toEqual([`${SITE}/tools/ai-visibility-checker`]);
  });
});

describe("each tool page (server-rendered, no JavaScript)", () => {
  it.each(PAGES.map((p) => [p.tool.slug, p] as const))("%s: one H1 with its search term, one button, the hub link and the full footer", (_slug, { tool, html }) => {
    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]).trim());
    expect(h1s).toEqual([tool.h1]);
    expect(tool.h1.toLowerCase()).toContain(tool.keyword.toLowerCase());
    // The intro answers first: "The {Tool} is a free tool that ..."
    expect(text(html)).toContain(`The ${tool.name} is a free tool`);

    expect(html.match(/class="ck-btn ck-btn-dark tl-cta"/g)).toHaveLength(1);
    expect(html.indexOf('class="tl-result"')).toBeGreaterThan(-1);
    expect(html.indexOf('class="tl-result"')).toBeLessThan(html.indexOf("tl-cta-card"));
    // Nothing else styled as the big button below the result.
    expect(html.slice(html.indexOf("tl-cta-card") + 20).match(/ck-btn-dark/g) ?? []).toHaveLength(1);

    // Back to the hub: the pill, the breadcrumb and "See all free tools".
    expect(html).toContain('<a class="ck-pill tl-pill" href="/tools">Free tools</a>');
    expect(html).toContain('<a href="/tools">See all free tools</a>');
    for (const r of tool.related) expect(html).toContain(`href="/tools/${r}"`);

    const foot = footerOf(html);
    expect(foot).toContain('href="/tools"');
    expect(toolHrefs(foot)).toEqual(SEVEN);
  });

  it.each(PAGES.map((p) => [p.tool.slug, p] as const))("%s: FAQs and every section visible, no jargon, no em dash in the page", (_slug, { html }) => {
    expect(html).toContain("Questions people ask");
    expect(html).toContain("How this tool works");
    // FAQ answers are always visible, never folded away (a code sample in a result may fold, the FAQs may not).
    const faq = html.slice(html.indexOf('class="tl-sec tl-faq"'));
    const tags = faq.slice(0, faq.indexOf("</section>")).match(/<[^>]+>/g) ?? [];
    expect(tags.filter((t) => /^<details|\shidden[\s>=]/.test(t))).toEqual([]);
    const words = text(html);
    expect(words).not.toMatch(EM_DASH);
    expect(words).not.toMatch(SPACED_EN_DASH);
    expect(words).not.toMatch(/\bAEO\b/);
    expect(words).not.toMatch(/ LLM/);
    expect(words.toLowerCase()).not.toContain("generative engine optimization");
    // "GEO" only as the brand name, never as the topic.
    expect(words).not.toMatch(/\bGEO (tool|tools|checker|score|audit|strategy)\b/);
  });

  it("the privacy page ends with the same footer", () => {
    const loaderData = { contact: null, owner: null, inactiveYears: 2, visitIdDays: 30, uninstalledDays: 30, publicCheckDays: 30, checkIpHours: 24, reportEmailDays: 30, unsubscribedDays: 30 };
    const Stub = createRoutesStub([{ id: "privacy", path: "/privacy", Component: privacy.default as ComponentType, loader: () => loaderData }]);
    const html = renderToStaticMarkup(createElement(Stub, { initialEntries: ["/privacy"], hydrationData: { loaderData: { privacy: loaderData } } }));
    expect(html).toContain("GEO privacy policy");
    expect(toolHrefs(footerOf(html))).toEqual(SEVEN);
    expect(footerOf(html)).toContain('href="/tools"');
  });

  it("the hub: one H1, every tool in its group, one button, the footer", () => {
    expect([...HUB_HTML.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]).trim())).toEqual([HUB.h1]);
    const main = HUB_HTML.slice(0, HUB_HTML.indexOf('<footer class="tl-foot"'));
    expect(toolHrefs(main).sort()).toEqual([...SEVEN].sort());
    expect(HUB_HTML.match(/class="ck-btn ck-btn-dark tl-cta"/g)).toHaveLength(1);
    expect(toolHrefs(footerOf(HUB_HTML))).toEqual(SEVEN);
    expect(text(HUB_HTML)).not.toMatch(EM_DASH);
  });
});

describe("one list of seven pages everywhere", () => {
  it("footer, hub, sitemap, llms.txt and the static home page all list the same seven tool pages", () => {
    const footer = renderToStaticMarkup(createElement(SiteFooter));
    expect(toolHrefs(footer)).toEqual(SEVEN);
    expect(footer).toContain('href="/tools"');

    const sitemapLocs = [...sitemapXml().matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(sitemapLocs.filter((l) => l.startsWith(`${SITE}/tools/`))).toEqual(SEVEN.map(abs));

    const llmsLinks = [...siteLlmsTxt().matchAll(/\]\((https:\/\/usegeo\.app\/tools\/[a-z0-9-]+)\)/g)].map((m) => m[1]);
    expect(llmsLinks).toEqual(SEVEN.map(abs));

    const home = read("app/home/home.html");
    const homeTools = [...new Set([...home.matchAll(/href="(\/tools\/[a-z0-9-]+)"/g)].map((m) => m[1]))];
    expect(homeTools.sort()).toEqual([...SEVEN].sort());
    expect(home).toContain('href="/tools"');
  });

  it("the sitemap lists exactly the public pages (the tools, the stories and the rest), each with its date", () => {
    const xml = sitemapXml();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([abs("/"), ...HOME_LANGS.map((l) => abs(`/${l}`)), abs("/tools"), ...SEVEN.map(abs), abs("/stories"), ...STORIES.map((s) => abs(`/stories/${s.slug}`)), abs("/privacy")]);
    expect(locs).not.toContain(abs("/check"));
    const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
    expect(lastmods).toEqual(sitemapPages().map((p) => p.updated));
    for (const d of lastmods) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Date.parse(d)).toBeLessThanOrEqual(Date.now());
    }
    expect(xml).not.toMatch(/priority|changefreq/);
  });
});

describe("our own site files pass our own checkers", () => {
  it("usegeo.app's llms.txt passes the llms.txt Checker with no problems and no tips", () => {
    const report = llmsReport(siteLlmsTxt());
    expect(report.found).toBe(true);
    expect(report.problems).toBe(0);
    expect(report.tips).toBe(0);
    expect(report.checks.filter((c) => c.tone !== "info")).toEqual([]);
  });

  it("usegeo.app's robots.txt lets every bot the AI Crawler Checker knows read the public pages", () => {
    const paths = [
      { label: "the home page", path: "/" },
      ...TOOLS.map((t) => ({ label: t.name, path: t.path })),
      { label: "a report page", path: "/check/x" },
    ];
    const report = checkBots(siteRobotsTxt(), paths);
    expect(report.tooComplex).toBeUndefined();
    expect(report.bots.map((b) => b.token)).toEqual(TOOL_BOTS.map((b) => b.token));
    for (const bot of report.bots) {
      expect(bot.blocked, bot.token).toBe(false);
      expect(bot.pages.every((p) => p.allowed)).toBe(true);
    }
    expect(verdict(report).headline).toBe(VERDICT_COPY.allClear);
    expect(verdict(report).headline).toBe("All the bots that affect AI answers can read your pages");
  });
});

describe("copy rules in every copy module", () => {
  const COPY_DIR = "app/lib/tools/copy";
  const modules = readdirSync(join(ROOT, COPY_DIR)).filter((f) => f.endsWith(".ts"));

  it("has one copy module per tool", () => {
    expect(modules.map((f) => f.slice(0, -3)).sort()).toEqual(TOOLS.map((t) => t.slug).sort());
  });

  it.each(modules.map((f) => [f] as const))("%s: no em dash and no spaced en dash", (file) => {
    const src = read(`${COPY_DIR}/${file}`);
    expect(src).not.toMatch(EM_DASH);
    expect(src).not.toMatch(SPACED_EN_DASH);
  });

  it("the registry, the shared parts and the site files have no em dash either", () => {
    for (const p of ["app/lib/tools/registry.ts", "app/components/tool-ui.tsx", "app/components/site-footer.tsx", "docs/tools/launch.md"]) {
      const src = read(p);
      expect(src, p).not.toMatch(EM_DASH);
      expect(src, p).not.toMatch(SPACED_EN_DASH);
    }
    for (const body of [siteRobotsTxt(), sitemapXml(), siteLlmsTxt()]) {
      expect(body).not.toMatch(EM_DASH);
      expect(body).not.toMatch(SPACED_EN_DASH);
    }
  });
});
