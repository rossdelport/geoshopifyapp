/* eslint-disable @typescript-eslint/no-explicit-any -- reads JSON-LD graphs of many shapes */
// Free tools, the shared foundation: the registry, page heads and JSON-LD, headers, the canonical host,
// the POST guard, limits and cache, guarded fetches, input and HTML helpers, the shared components, the
// footer (also on the home page and the free check pages), the hub and the 404 page.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type HeadersArgs, type LoaderFunctionArgs, type MetaDescriptor } from "react-router";

vi.mock("../app/lib/check.server", () => ({ safeFetch: vi.fn() }));

const { safeFetch } = await import("../app/lib/check.server");
const { HUB, TOOLS, TOOL_GROUPS, isToolSlug, toolBySlug } = await import("../app/lib/tools/registry");
const { SITE, abs } = await import("../app/lib/tools/site");
const { ORG_NODE, WEBSITE_NODE, hubJsonLd, pageMeta, stripBrand, toolJsonLd } = await import("../app/lib/tools/seo");
const { noStore, toolHeaders } = await import("../app/lib/tools/http");
const { formatUpdated, plural } = await import("../app/lib/tools/format");
const { SITE_INPUT_BAD, SITE_INPUT_EMPTY, normalizeSiteInput } = await import("../app/lib/tools/site-input");
const html = await import("../app/lib/tools/html");
const { publicHostRedirect, requestHost } = await import("../app/lib/tools/host.server");
const { allowedPost, honeypot, readToolForm, startToolPost, CROSS_SITE_COPY, TOO_BIG_COPY } = await import("../app/lib/tools/guard.server");
const limits = await import("../app/lib/tools/limits.server");
const { fetchSiteFile, outcomeMessage, OUTCOME_COPY, HTML_ACCEPT, looksLikeRedirectPage, movedNote, resolveSiteHome, twinHost, MOVED_COPY } = await import(
  "../app/lib/tools/fetch.server"
);
const ui = await import("../app/components/tool-ui");
const { SiteFooter } = await import("../app/components/site-footer");
const { CheckShell } = await import("../app/components/check-ui");
const toolsLayout = await import("../app/routes/tools");
const hub = await import("../app/routes/tools._index");
const notFound = await import("../app/routes/tools.$");
const home = await import("../app/routes/_index/route");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const EM_DASH = /\u2014/;
const SPACED_EN_DASH = /\s\u2013\s/;
const text = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'");

/** Render a component inside a router (hooks like useFetcher need one). */
function render(Component: ComponentType, path = "/") {
  const Stub = createRoutesStub([{ path, Component }]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: [path] }));
}
const callMeta = (m: unknown) => (m as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });
const metaOf = (list: MetaDescriptor[]) => ({
  title: list.find((m) => "title" in m) as { title: string } | undefined,
  canonicals: list.filter((m) => "tagName" in m && m.tagName === "link" && (m as { rel?: string }).rel === "canonical") as { href: string }[],
  prop: (p: string) => (list.find((m) => (m as { property?: string }).property === p) as { content?: string } | undefined)?.content,
  name: (n: string) => (list.find((m) => (m as { name?: string }).name === n) as { content?: string } | undefined)?.content,
  ld: (list.find((m) => "script:ld+json" in m) as Record<string, unknown> | undefined)?.["script:ld+json"] as Record<string, unknown> | undefined,
});

const FAQS = [
  { q: "What is a Google AI Overview?", a: "A short answer written by Google's AI, with links to the pages it used." },
  { q: "Can I keep my site out?", a: "Yes. Use the setting in Search Console. </script><b>not html</b>" },
];

// ---------- registry ----------

describe("tool registry", () => {
  it("has the 7 tools with unique, well-formed slugs and paths", () => {
    expect(TOOLS).toHaveLength(7);
    expect(new Set(TOOLS.map((t) => t.slug)).size).toBe(7);
    for (const t of TOOLS) {
      expect(t.slug).toMatch(/^[a-z0-9-]+$/);
      expect(t.path).toBe(`/tools/${t.slug}`);
      expect(toolBySlug(t.slug)).toBe(t);
      expect(isToolSlug(t.slug)).toBe(true);
    }
    expect(isToolSlug("nope")).toBe(false);
    expect(() => toolBySlug("nope" as never)).toThrow();
  });

  it("keeps titles, descriptions and short lines within their lengths, ending titles with the brand", () => {
    for (const t of TOOLS) {
      expect(t.title.length, t.title).toBeLessThan(60);
      expect(t.title.endsWith(" | GEO"), t.title).toBe(true);
      expect(t.description.length, t.description).toBeLessThan(155);
      expect(t.short.length, t.short).toBeLessThan(95);
      expect(t.timing.length).toBeGreaterThan(0);
      expect(t.h1.toLowerCase()).toContain(t.keyword.toLowerCase());
    }
    expect(HUB.title.length).toBeLessThan(60);
    expect(HUB.description.length).toBeLessThan(155);
  });

  it("links 3 other real tools from each tool", () => {
    for (const t of TOOLS) {
      expect(t.related).toHaveLength(3);
      expect(new Set(t.related).size).toBe(3);
      for (const r of t.related) {
        expect(isToolSlug(r)).toBe(true);
        expect(r).not.toBe(t.slug);
      }
    }
  });

  it("dates every tool with a real ISO date that isn't in the future, and the hub with the newest", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const t of TOOLS) {
      expect(t.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(formatUpdated(t.updated)).not.toBe(t.updated);
      expect(t.updated <= today).toBe(true);
    }
    expect(HUB.updated).toBe([...TOOLS.map((t) => t.updated)].sort().at(-1));
  });

  it("has a share image in public/ for every tool, the hub and the home page", () => {
    for (const img of [...TOOLS.map((t) => t.ogImage), HUB.ogImage, "/og/home.png"]) {
      expect(existsSync(join(ROOT, "public", img)), `public${img} is missing`).toBe(true);
      expect(readFileSync(join(ROOT, "public", img)).length).toBeLessThan(200_000);
    }
    for (const t of TOOLS) expect(t.ogImage).toBe(`/og/${t.slug}.png`);
  });

  it("puts every tool in exactly one hub group, matching its registry group", () => {
    const listed = TOOL_GROUPS.flatMap((g) => g.slugs);
    expect([...listed].sort()).toEqual(TOOLS.map((t) => t.slug).sort());
    for (const g of TOOL_GROUPS) for (const s of g.slugs) expect(toolBySlug(s).group).toBe(g.id);
  });
});

describe("house rules in the shared copy", () => {
  it("has no em dash and no spaced en dash in the registry, the shared components or the copy modules", () => {
    const copyDir = join(ROOT, "app/lib/tools/copy");
    const copyFiles = existsSync(copyDir) ? readdirSync(copyDir).filter((f) => f.endsWith(".ts")).map((f) => `app/lib/tools/copy/${f}`) : [];
    const files = [
      "app/lib/tools/registry.ts",
      "app/lib/tools/seo.ts",
      "app/lib/tools/site-files.ts",
      "app/lib/tools/site-input.ts",
      "app/lib/tools/fetch.server.ts",
      "app/lib/tools/limits.server.ts",
      "app/lib/tools/guard.server.ts",
      "app/components/tool-ui.tsx",
      "app/components/site-footer.tsx",
      "app/routes/tools.tsx",
      "app/routes/tools._index.tsx",
      "app/routes/tools.$.tsx",
      "app/routes/privacy.tsx",
      ...copyFiles,
    ];
    for (const f of files) {
      const src = read(f);
      expect(EM_DASH.test(src), `${f} has an em dash`).toBe(false);
      expect(SPACED_EN_DASH.test(src), `${f} has a spaced en dash`).toBe(false);
    }
    const strings = JSON.stringify([TOOLS, HUB, TOOL_GROUPS]);
    expect(EM_DASH.test(strings) || SPACED_EN_DASH.test(strings)).toBe(false);
  });

  it("uses no jargon in the registry copy", () => {
    const words = TOOLS.flatMap((t) => [t.name, t.h1, t.title, t.description, t.short]).join(" ") + HUB.intro + HUB.description;
    expect(words).not.toMatch(/\bAEO\b|\bLLMs?\b|generative engine optimi[sz]ation/);
    expect(words.replace(/\| GEO/g, "")).not.toMatch(/\bGEO\b/);
  });
});

// ---------- page heads ----------

describe("pageMeta and JSON-LD", () => {
  const tool = toolBySlug("ai-overview-checker");
  const list = pageMeta({ path: tool.path, title: tool.title, description: tool.description, image: tool.ogImage, imageAlt: tool.ogAlt, jsonLd: toolJsonLd(tool, FAQS) });
  const m = metaOf(list);

  it("gives a tool page its title, description, one absolute canonical and matching og:url", () => {
    expect(m.title?.title).toBe(tool.title);
    expect(m.name("description")).toBe(tool.description);
    expect(m.canonicals).toHaveLength(1);
    expect(m.canonicals[0].href).toBe(`https://usegeo.app${tool.path}`);
    expect(m.canonicals[0].href.startsWith(SITE)).toBe(true);
    expect(m.prop("og:url")).toBe(m.canonicals[0].href);
    expect(m.prop("og:type")).toBe("website");
    expect(m.prop("og:site_name")).toBe("GEO");
    expect(m.prop("og:title")).toBe(tool.title);
    expect(m.prop("og:image")).toBe(`https://usegeo.app/og/ai-overview-checker.png`);
    expect(m.prop("og:image:width")).toBe("1200");
    expect(m.prop("og:image:height")).toBe("630");
    expect(m.prop("og:image:alt")).toBe(tool.ogAlt);
    expect(m.name("twitter:card")).toBe("summary_large_image");
    expect(m.name("robots")).toBeUndefined();
    expect(JSON.stringify(list)).not.toMatch(/nosnippet|max-snippet/);
    // the order crawlers and tests rely on: title, description, canonical first; JSON-LD last
    expect(Object.keys(list[0])).toEqual(["title"]);
    expect((list[2] as { rel?: string }).rel).toBe("canonical");
    expect("script:ld+json" in list[list.length - 1]).toBe(true);
  });

  it("builds one @graph with the organisation, the app, the page, breadcrumbs and the FAQ, word for word", () => {
    const ld = JSON.parse(JSON.stringify(m.ld)) as { "@context": string; "@graph": Record<string, unknown>[] };
    expect(ld["@context"]).toBe("https://schema.org");
    const byType = (t: string) => ld["@graph"].find((n) => n["@type"] === t) as Record<string, any>;
    expect(byType("Organization")).toEqual(ORG_NODE);
    expect(byType("Organization")).not.toHaveProperty("sameAs");
    const app = byType("WebApplication");
    expect(app.name).toBe(tool.name);
    expect(app.offers).toEqual({ "@type": "Offer", price: "0", priceCurrency: "USD" });
    expect(app.isAccessibleForFree).toBe(true);
    const page = byType("WebPage");
    expect(page.dateModified).toBe(tool.updated);
    expect(page.name).toBe(stripBrand(tool.title));
    expect(page.name.endsWith("| GEO")).toBe(false);
    expect(page.isPartOf["@id"]).toBe("https://usegeo.app/#website");
    const crumbs = byType("BreadcrumbList").itemListElement;
    expect(crumbs.map((c: { name: string }) => c.name)).toEqual(["Home", "Free tools", tool.name]);
    expect(crumbs[0].item).toBe("https://usegeo.app/");
    expect(crumbs[1].item).toBe("https://usegeo.app/tools");
    expect(crumbs[2]).not.toHaveProperty("item");
    const faq = byType("FAQPage").mainEntity.map((q: any) => ({ q: q.name, a: q.acceptedAnswer.text }));
    expect(faq).toEqual(FAQS);
    const all = JSON.stringify(ld);
    expect(all).not.toMatch(/aggregateRating|"review"|"Review"|HowTo/);
  });

  it("keeps a tool page's JSON-LD under 8 KB with six long answers", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ q: `Question ${i}?`, a: "A plain answer of about eighty words. ".repeat(10) }));
    expect(JSON.stringify(toolJsonLd(tool, six)).length).toBeLessThan(8_000);
  });

  it("describes the hub as a collection of the 7 tools", () => {
    const ld = hubJsonLd() as { "@graph": Record<string, any>[] };
    const list = ld["@graph"].find((n) => n["@type"] === "ItemList")!;
    expect(list.itemListElement.map((i: { url: string }) => i.url)).toEqual(TOOLS.map((t) => abs(t.path)));
    const page = ld["@graph"].find((n) => n["@type"] === "CollectionPage")!;
    expect(page["@id"]).toBe("https://usegeo.app/tools");
    expect(page.dateModified).toBe(HUB.updated);
    const crumbs = ld["@graph"].find((n) => n["@type"] === "BreadcrumbList")!.itemListElement;
    expect(crumbs.map((c: { name: string }) => c.name)).toEqual(["Home", "Free tools"]);
    expect(JSON.stringify(ld)).not.toMatch(/aggregateRating|review/i);
  });

  it("marks a noindex page without a canonical (the 404 page) and defaults the image to the hub's", () => {
    const n = metaOf(pageMeta({ path: "/tools", title: "Not found | GEO", description: "x", noindex: true }));
    expect(n.name("robots")).toBe("noindex");
    expect(n.canonicals).toHaveLength(0);
    expect(n.prop("og:url")).toBeUndefined();
    expect(n.prop("og:image")).toBe("https://usegeo.app/og/tools.png");
    expect(n.prop("og:image:alt")).toBe(HUB.ogAlt);
  });

  it("makes absolute URLs on the canonical origin", () => {
    expect(abs("/")).toBe("https://usegeo.app/");
    expect(abs("/tools")).toBe("https://usegeo.app/tools");
  });
});

// ---------- headers ----------

describe("tool page headers", () => {
  const args = (h: Partial<Record<"actionHeaders" | "loaderHeaders" | "errorHeaders", Headers>>) =>
    ({ actionHeaders: new Headers(), loaderHeaders: new Headers(), parentHeaders: new Headers(), errorHeaders: undefined, ...h }) as unknown as HeadersArgs;
  const get = (h: HeadersInit) => new Headers(h);

  it("lets browsers keep a normal page for 5 minutes, with the security headers", () => {
    const h = get(toolHeaders(args({})));
    expect(h.get("Cache-Control")).toBe("public, max-age=300");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(h.get("X-Robots-Tag")).toBeNull();
  });

  it("never caches or indexes a POST result", () => {
    const h = get(toolHeaders(args({ actionHeaders: new Headers(noStore) })));
    expect(h.get("Cache-Control")).toBe("no-store");
    expect(h.get("X-Robots-Tag")).toBe("noindex");
    expect(h.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("keeps the 404 loader's own headers, and never caches an error page", () => {
    const h = get(toolHeaders(args({ loaderHeaders: new Headers({ "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" }) })));
    expect(h.get("Cache-Control")).toBe("public, max-age=60");
    expect(h.get("X-Robots-Tag")).toBe("noindex");
    expect(get(toolHeaders(args({ errorHeaders: new Headers() }))).get("Cache-Control")).toBe("no-store");
  });
});

// ---------- text helpers ----------

describe("formatUpdated and plural", () => {
  it("writes dates the way the pages show them", () => {
    expect(formatUpdated("2026-10-11")).toBe("11 October 2026");
    expect(formatUpdated("2026-01-01")).toBe("1 January 2026");
    expect(formatUpdated("2026-02-30")).toBe("2026-02-30");
    expect(formatUpdated("soon")).toBe("soon");
  });
  it("counts things in plain English", () => {
    expect(plural(1, "bot")).toBe("1 bot");
    expect(plural(0, "bot")).toBe("0 bots");
    expect(plural(3, "bot")).toBe("3 bots");
    expect(plural(2, "search", "searches")).toBe("2 searches");
    expect(plural(1200, "line")).toBe("1,200 lines");
  });
});

describe("normalizeSiteInput", () => {
  it("adds https, keeps the path and drops the query and #hash", () => {
    expect(normalizeSiteInput("YourStore.com")).toEqual({ ok: true, origin: "https://yourstore.com", host: "yourstore.com", path: "/" });
    expect(normalizeSiteInput("  shop.example.com/products/oil?utm_source=x#top ")).toEqual({
      ok: true,
      origin: "https://shop.example.com",
      host: "shop.example.com",
      path: "/products/oil",
    });
    expect(normalizeSiteInput("http://a.com:80/x")).toMatchObject({ ok: true, origin: "http://a.com", path: "/x" });
    expect(normalizeSiteInput("https://a.com:443")).toMatchObject({ ok: true, origin: "https://a.com" });
    // marketplaces are fine here (anyone may check any site's robots.txt)
    expect(normalizeSiteInput("amazon.com")).toMatchObject({ ok: true, host: "amazon.com" });
  });

  it("refuses empty, local, private, odd-port, login and over-long input", () => {
    expect(normalizeSiteInput("")).toEqual({ ok: false, error: SITE_INPUT_EMPTY });
    expect(normalizeSiteInput("   ")).toEqual({ ok: false, error: SITE_INPUT_EMPTY });
    for (const bad of ["localhost", "http://localhost:3000", "10.0.0.1", "http://192.168.1.1/", "[::1]", "http://a.com:8080", "user:pw@a.com", "https://user:pw@a.com/", "ftp://a.com", "nodot", "printer.local", "javascript:alert(1)", "a.com/" + "x".repeat(1_995)]) {
      expect(normalizeSiteInput(bad), bad).toEqual({ ok: false, error: SITE_INPUT_BAD });
    }
    expect("a.com/".concat("x".repeat(1_995)).length).toBe(2_001);
  });
});

describe("reading strangers' pages (bounded)", () => {
  const page = `<!doctype html><html><head>
    <title> Sandalwood &amp; Cedar Beard Oil </title>
    <meta content="Oil for dry beards" name="description">
    <meta property='og:site_name' content='Coolabah'>
    <script type="application/ld+json">{"@type":"Product","name":"Oil"}</script>
    <script>var x = "<script>";</script>
    <script type="application/ld+json">{"@type":"Organization"}</script>
  </head><body itemscope itemtype="https://schema.org/Product">
    <a href="/products/oil#reviews">Beard <b>oil</b></a>
    <a href="https://www.shop.example.com/collections/all">All</a>
    <a href="https://shop.example.com/products/oil">Again</a>
    <a href="#top">Top</a><a href="mailto:a@b.c">Mail</a><a href="tel:123">Call</a><a href="javascript:void(0)">JS</a>
    <a href="https://other.example.com/x">Elsewhere</a>
    <a\nhref="/pages/about"\n>About   us</a>
  </body></html>`;

  it("finds JSON-LD blocks, the title and meta tags", () => {
    expect(html.jsonLdBlocks(page)).toEqual(['{"@type":"Product","name":"Oil"}', '{"@type":"Organization"}']);
    expect(html.jsonLdBlocks(page, 1)).toHaveLength(1);
    expect(html.titleOf(page)).toBe("Sandalwood & Cedar Beard Oil");
    expect(html.titleOf("<html><titles>x</titles></html>")).toBeNull();
    expect(html.metaContent(page, "description")).toBe("Oil for dry beards");
    expect(html.metaContent(page, "OG:SITE_NAME")).toBe("Coolabah");
    expect(html.metaContent(page, "og:title")).toBeNull();
    expect(html.tagAttributes('<meta name="a" content=\'b "c"\' data-x=1 checked>')).toEqual({ name: "a", content: 'b "c"', "data-x": "1", checked: "" });
  });

  it("lists same-site links as absolute URLs, once each, without #fragments or mail and phone links", () => {
    expect(html.sameHostLinks(page, "https://shop.example.com/")).toEqual([
      { href: "https://shop.example.com/products/oil", text: "Beard oil" },
      { href: "https://www.shop.example.com/collections/all", text: "All" },
      { href: "https://shop.example.com/pages/about", text: "About us" },
    ]);
    expect(html.sameHostLinks(page, "not a url")).toEqual([]);
    expect(html.sameHostLinks(page, "https://shop.example.com/", 1)).toHaveLength(1);
  });

  it("tells web pages from text files, and spots microdata products", () => {
    expect(html.looksLikeHtml("﻿  <!DOCTYPE html><html>")).toBe(true);
    expect(html.looksLikeHtml("<html lang=en>")).toBe(true);
    expect(html.looksLikeHtml("# My store\n> About")).toBe(false);
    expect(html.looksLikeHtml("User-agent: *\nDisallow: /cart")).toBe(false);
    expect(html.hasMicrodataProduct(page)).toBe(true);
    expect(html.hasMicrodataProduct('<div itemtype="http://schema.org/ProductGroup">')).toBe(false);
    expect(html.hasMicrodataProduct('<div itemtype = "http://schema.org/Product">')).toBe(true);
    expect(html.hasMicrodataProduct("<div>no</div>")).toBe(false);
  });

  it("stays fast on a hostile 2 MB page", () => {
    const evil = "<a <meta <title <script itemtype ".repeat(70_000).slice(0, 2_000_000);
    const t = Date.now();
    html.jsonLdBlocks(evil);
    html.titleOf(evil);
    html.metaContent(evil, "description");
    html.sameHostLinks(evil, "https://a.com/");
    html.hasMicrodataProduct(evil);
    expect(Date.now() - t).toBeLessThan(3_000);
  });
});

// ---------- the canonical host ----------

describe("publicHostRedirect", () => {
  const env = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });
  afterEach(() => {
    process.env.NODE_ENV = env;
  });
  const req = (url: string, init: RequestInit & { host?: string } = {}) =>
    new Request(url, { ...init, headers: { ...(init.host ? { host: init.host } : {}), ...((init.headers as Record<string, string>) ?? {}) } });

  it("sends www and the Railway address to https://usegeo.app with the same path and query", () => {
    const www = publicHostRedirect(req("http://www.usegeo.app/tools/ai-crawler-checker?utm_source=chatgpt.com", { host: "www.usegeo.app" }));
    expect(www?.status).toBe(301);
    expect(www?.headers.get("location")).toBe("https://usegeo.app/tools/ai-crawler-checker?utm_source=chatgpt.com");
    const railway = publicHostRedirect(req("http://x.up.railway.app/", { host: "x.up.railway.app" }));
    expect(railway?.status).toBe(301);
    expect(railway?.headers.get("location")).toBe("https://usegeo.app/");
    expect(publicHostRedirect(req("https://www.usegeo.app/tools"))?.headers.get("location")).toBe("https://usegeo.app/tools");
    // Railway's proxy says which host the visitor asked for
    expect(publicHostRedirect(req("http://10.0.0.5:8080/privacy", { headers: { "x-forwarded-host": "www.usegeo.app" } }))?.status).toBe(301);
    for (const p of ["/check", "/tools", "/sitemap.xml", "/llms.txt", "/privacy"]) {
      expect(publicHostRedirect(req(`https://www.usegeo.app${p}`)), p).not.toBeNull();
    }
  });

  it("leaves usegeo.app, POSTs, the app, Shopify admin visits, report pages, robots.txt and non-production alone", () => {
    expect(publicHostRedirect(req("https://usegeo.app/tools", { host: "usegeo.app" }))).toBeNull();
    expect(publicHostRedirect(req("https://www.usegeo.app/tools", { method: "POST", body: "a=1" }))).toBeNull();
    for (const p of ["/app", "/app/fixes", "/auth/login", "/webhooks/app/uninstalled", "/api/pixel", "/healthz", "/check/abc123", "/robots.txt", "/tools/x.data"]) {
      expect(publicHostRedirect(req(`https://geo-shopify-app-production.up.railway.app${p}`)), p).toBeNull();
    }
    expect(publicHostRedirect(req("https://x.up.railway.app/?shop=a.myshopify.com"))).toBeNull();
    expect(publicHostRedirect(req("https://x.up.railway.app/?embedded=1&host=abc"))).toBeNull();
    process.env.NODE_ENV = "development";
    expect(publicHostRedirect(req("https://www.usegeo.app/tools"))).toBeNull();
  });

  it("reads the host from x-forwarded-host, then host, then the URL", () => {
    expect(requestHost(req("http://a/", { headers: { "x-forwarded-host": "WWW.usegeo.app:443, proxy" }, host: "b" }))).toBe("www.usegeo.app");
    expect(requestHost(req("http://a/", { host: "Usegeo.app:80" }))).toBe("usegeo.app");
    expect(requestHost(req("https://c.example/"))).toBe("c.example");
  });

  it("runs in the layout, home, /check and privacy loaders", async () => {
    const thrown = await Promise.resolve()
      .then(() => toolsLayout.loader({ request: req("https://www.usegeo.app/tools"), params: {}, context: {} } as unknown as LoaderFunctionArgs))
      .catch((r: Response) => r);
    expect((thrown as Response).status).toBe(301);
    const homeMoved = await Promise.resolve(home.loader({ request: req("https://www.usegeo.app/"), params: {}, context: {} } as unknown as LoaderFunctionArgs)).catch(
      (r: Response) => r,
    );
    expect((homeMoved as Response).status).toBe(301);
    // Shopify admin visits still go into the app first
    const shop = await Promise.resolve(home.loader({ request: req("https://www.usegeo.app/?shop=a.myshopify.com"), params: {}, context: {} } as unknown as LoaderFunctionArgs)).catch(
      (r: Response) => r,
    );
    expect((shop as Response).headers.get("location")).toBe("/app?shop=a.myshopify.com");
    expect(toolsLayout.loader({ request: req("https://usegeo.app/tools"), params: {}, context: {} } as unknown as LoaderFunctionArgs)).toBeNull();
  });
});

// ---------- the POST guard ----------

describe("allowedPost and the tool form", () => {
  const post = (headers: Record<string, string>, body: BodyInit = "url=a.com") =>
    new Request("http://usegeo.app/tools/ai-crawler-checker", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded", ...headers } });

  it("allows our own pages, www to apex, and requests with no Origin", () => {
    expect(allowedPost(post({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(allowedPost(post({ "sec-fetch-site": "same-site", origin: "https://www.usegeo.app" }))).toBe(true);
    expect(allowedPost(post({ origin: "https://www.usegeo.app", host: "usegeo.app" }))).toBe(true);
    expect(allowedPost(post({ origin: "https://usegeo.app", host: "www.usegeo.app" }))).toBe(true);
    expect(allowedPost(post({ origin: "https://geo-shopify-app-production.up.railway.app", host: "geo-shopify-app-production.up.railway.app" }))).toBe(true);
    expect(allowedPost(post({ origin: "http://localhost:4100", host: "localhost:4100" }))).toBe(true);
    expect(allowedPost(post({}))).toBe(true);
  });

  it("refuses other websites", () => {
    expect(allowedPost(post({ "sec-fetch-site": "cross-site", origin: "https://usegeo.app" }))).toBe(false);
    expect(allowedPost(post({ origin: "https://evil.example", host: "usegeo.app" }))).toBe(false);
    expect(allowedPost(post({ origin: "null", host: "usegeo.app" }))).toBe(false);
  });

  it("reads small forms, refuses big ones, and spots the honeypot", async () => {
    const form = await readToolForm(post({}, "url=a.com&website="), 8_192);
    expect(form?.get("url")).toBe("a.com");
    expect(honeypot(form!)).toBe(false);
    expect(honeypot(new URLSearchParams("website=spam"))).toBe(true);
    expect(await readToolForm(post({}, `text=${"x".repeat(9_000)}`), 8_192)).toBeNull();

    expect(await startToolPost(post({ "sec-fetch-site": "cross-site" }), 8_192)).toEqual({ ok: false, status: 403, error: CROSS_SITE_COPY });
    expect(await startToolPost(post({}, `text=${"x".repeat(9_000)}`), 8_192)).toEqual({ ok: false, status: 413, error: TOO_BIG_COPY });
    const ok = await startToolPost(post({ "x-real-ip": "203.0.113.9" }, "url=a.com&website=hi"), 8_192);
    expect(ok.ok && ok.trapped).toBe(true);
    expect(ok.ok && ok.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ok)).not.toContain("203.0.113.9");
  });
});

// ---------- limits and cache ----------

describe("limits and the cache", () => {
  beforeEach(() => {
    limits.resetToolLimits();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T08:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  const MIN = 60_000;

  it("refuses the 11th AI Overview search in an hour, then lets one through as the window slides", () => {
    for (let i = 0; i < 10; i++) {
      expect(limits.hit("aio", "ip1", limits.TOOL_LIMITS.aio)).toEqual({ ok: true });
      vi.advanceTimersByTime(MIN);
    }
    expect(limits.hit("aio", "ip1", limits.TOOL_LIMITS.aio)).toEqual({ ok: false, error: limits.HOUR_COPY });
    // someone else, and another tool, are counted apart
    expect(limits.hit("aio", "ip2", limits.TOOL_LIMITS.aio).ok).toBe(true);
    expect(limits.hit("crawler", "ip1", limits.TOOL_LIMITS.crawler).ok).toBe(true);
    vi.advanceTimersByTime(50 * MIN + 30_000); // only the first search is now over an hour old
    expect(limits.hit("aio", "ip1", limits.TOOL_LIMITS.aio).ok).toBe(true);
    expect(limits.hit("aio", "ip1", limits.TOOL_LIMITS.aio).ok).toBe(false);
  });

  it("refuses past the daily allowance until the oldest call is a day old", () => {
    const rule = { perHour: 10, perDay: 30 };
    for (let h = 0; h < 3; h++) {
      for (let i = 0; i < 10; i++) expect(limits.hit("aio", "ip1", rule).ok).toBe(true);
      vi.advanceTimersByTime(61 * MIN);
    }
    expect(limits.hit("aio", "ip1", rule)).toEqual({ ok: false, error: limits.DAY_COPY });
    vi.advanceTimersByTime(24 * 60 * MIN - 3 * 61 * MIN + MIN);
    expect(limits.hit("aio", "ip1", rule).ok).toBe(true);
  });

  it("caps everyone together per UTC day, and resets the next day", () => {
    expect(limits.globalDaily("t", 2)).toBe(true);
    expect(limits.globalDaily("t", 2)).toBe(true);
    expect(limits.globalDaily("t", 2)).toBe(false);
    vi.setSystemTime(new Date("2026-10-12T00:00:01Z"));
    expect(limits.globalDaily("t", 2)).toBe(true);
  });

  it("checks both limits without counting a refused visitor against the other", () => {
    const rule = { perHour: 1, perDay: 5, globalPerDay: 2 };
    expect(limits.takeToolSlot("x", "a", rule)).toEqual({ ok: true });
    expect(limits.takeToolSlot("x", "a", rule)).toEqual({ ok: false, error: limits.HOUR_COPY }); // not counted globally
    expect(limits.takeToolSlot("x", "b", rule)).toEqual({ ok: true });
    expect(limits.takeToolSlot("x", "c", rule)).toEqual({ ok: false, error: limits.BUSY_COPY });
    expect(limits.LIMIT_STATUS).toBe(429);
    expect(limits.TOOL_LIMITS.paste).not.toHaveProperty("globalPerDay");
  });

  it("expires cache entries and drops the oldest past the cap", () => {
    const cache = new limits.TtlCache<number>(2);
    cache.set("a", 1, 1_000);
    expect(cache.get("a")).toBe(1);
    vi.advanceTimersByTime(1_001);
    expect(cache.get("a")).toBeUndefined();
    cache.set("a", 1, 10_000);
    cache.set("b", 2, 10_000);
    cache.set("c", 3, 10_000);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.size).toBe(2);
    cache.set("b", 20, 10_000); // a re-set moves it to the back
    cache.set("d", 4, 10_000);
    expect(cache.get("c")).toBeUndefined();
    expect(cache.get("b")).toBe(20);
  });

  it("caps open tool fetches with TOOLS_MAX_OPEN", async () => {
    process.env.TOOLS_MAX_OPEN = "2";
    vi.useRealTimers();
    limits.toolFetchGate.resetStats();
    const waits: (() => void)[] = [];
    const runs = Array.from({ length: 5 }, () => limits.toolFetchGate.run(() => new Promise<void>((r) => waits.push(r))));
    await new Promise((r) => setTimeout(r, 5));
    expect(limits.toolFetchGate.stats().open).toBe(2);
    while (waits.length || limits.toolFetchGate.stats().open) {
      waits.shift()?.();
      await new Promise((r) => setTimeout(r, 1));
    }
    await Promise.all(runs);
    expect(limits.toolFetchGate.stats().mostOpen).toBe(2);
    delete process.env.TOOLS_MAX_OPEN;
  });
});

// ---------- guarded fetches ----------

describe("fetchSiteFile", () => {
  const mocked = vi.mocked(safeFetch);
  beforeEach(() => mocked.mockReset());

  it("reads a text file with the text defaults, and says when it is really a web page", async () => {
    mocked.mockResolvedValueOnce({ status: 200, url: "https://a.com/llms.txt", text: "# A\n> b" });
    expect(await fetchSiteFile("https://a.com/llms.txt")).toEqual({ kind: "ok", status: 200, url: "https://a.com/llms.txt", text: "# A\n> b", html: false });
    expect(mocked).toHaveBeenCalledWith("https://a.com/llms.txt", expect.stringContaining("text/plain"), { timeoutMs: 6_000, maxBytes: 512_000 });
    mocked.mockResolvedValueOnce({ status: 200, url: "https://a.com/llms.txt", text: "<!doctype html><html>" });
    expect(await fetchSiteFile("https://a.com/llms.txt")).toMatchObject({ kind: "ok", html: true });
  });

  it("uses 2 MB for web pages and lets a tool choose its own limits", async () => {
    mocked.mockResolvedValue({ status: 200, url: "https://a.com/", text: "<html>" });
    await fetchSiteFile("https://a.com/", { accept: HTML_ACCEPT });
    expect(mocked).toHaveBeenLastCalledWith("https://a.com/", HTML_ACCEPT, { timeoutMs: 6_000, maxBytes: 2_000_000 });
    await fetchSiteFile("https://a.com/", { maxBytes: 1_000_000, timeoutMs: 10_000 });
    expect(mocked).toHaveBeenLastCalledWith("https://a.com/", expect.any(String), { timeoutMs: 10_000, maxBytes: 1_000_000 });
  });

  it("sorts every other answer into plain outcomes, and never shows a thrown message", async () => {
    const cases: [number, string][] = [
      [404, "missing"],
      [410, "missing"],
      [401, "turned-away"],
      [403, "turned-away"],
      [429, "turned-away"],
      [500, "server-error"],
      [503, "server-error"],
      [302, "unreachable"],
    ];
    for (const [status, kind] of cases) {
      mocked.mockResolvedValueOnce({ status, url: "https://a.com/x", text: "" });
      expect((await fetchSiteFile("https://a.com/x")).kind, String(status)).toBe(kind);
    }
    mocked.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND secret-internal-host"));
    const gone = await fetchSiteFile("https://nope.example/x");
    expect(gone).toEqual({ kind: "unreachable" });
    expect(outcomeMessage(gone)).toBe(OUTCOME_COPY.unreachable);
    expect(outcomeMessage({ kind: "turned-away", status: 403 })).toContain("answered 403");
    expect(outcomeMessage({ kind: "server-error", status: 502 })).toBe("Your site answered with a server error (502). Try again in a few minutes.");
    expect(outcomeMessage({ kind: "missing", status: 404 })).toBeNull();
    expect(Object.values(OUTCOME_COPY).join(" ")).not.toMatch(/\u2014|\s\u2013\s/);
  });
});

describe("resolveSiteHome: where a site really lives", () => {
  type Outcome = Awaited<ReturnType<typeof fetchSiteFile>>;
  /** Real pages captured on 11 Oct 2026 (each file says where from). */
  const hosts = (name: string) => read(`test/fixtures/tools/hosts-${name}`);
  const page = (url: string, text: string): Outcome => ({ kind: "ok", status: 200, url, text, html: true });
  const HOME = "<!doctype html><html><head><title>Cedar &amp; Co</title></head><body><a href='/products/oil'>Oil</a> Beard oil made in small batches.</body></html>";
  /** A fake guarded fetch: each address's answer (after its redirects), and every address asked for. */
  function site(answers: Record<string, Outcome | Error>) {
    const calls: string[] = [];
    const fetch = async (url: string): Promise<Outcome> => {
      calls.push(url);
      const a = answers[url] ?? { kind: "missing", status: 404 };
      if (a instanceof Error) throw a;
      return a;
    };
    return { fetch, calls };
  }
  const typed = (host: string, scheme = "https") => ({ origin: `${scheme}://${host}`, host });

  it("spots a page that only sends visitors on, and never a real home page", () => {
    expect(looksLikeRedirectPage(hosts("gymshark-redirect-page.html"))).toBe(true);
    expect(looksLikeRedirectPage(hosts("gymshark-www-home.html"))).toBe(false);
    expect(looksLikeRedirectPage(hosts("allbirds-home.html"))).toBe(false);
    expect(looksLikeRedirectPage('<html><head><meta http-equiv="Refresh" content="0; url=https://www.a.example/"></head></html>')).toBe(true);
    expect(looksLikeRedirectPage("<html><head><title>Redirecting…</title></head><body></body></html>")).toBe(true);
    expect(looksLikeRedirectPage(HOME)).toBe(false);
    const long = `<html><body><p>${"Our redirecting guide explains everything about shoes. ".repeat(10)}</p></body></html>`;
    expect(looksLikeRedirectPage(long)).toBe(false);
    // A page made of nothing but "<" is read in one pass.
    const started = performance.now();
    looksLikeRedirectPage(`<body>${"<".repeat(1_000_000)}`);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("knows a host's www twin, and that a myshopify.com address has none", () => {
    expect(twinHost("gymshark.com")).toBe("www.gymshark.com");
    expect(twinHost("www.gymshark.com")).toBe("gymshark.com");
    expect(twinHost("brand.co.uk")).toBe("www.brand.co.uk");
    expect(twinHost("cedar.myshopify.com")).toBeNull();
    expect(twinHost("www.com")).toBeNull();
  });

  it("reads the typed address when it is the site: one read, no note", async () => {
    const s = site({ "https://cedar.example/": page("https://cedar.example/", HOME) });
    const where = await resolveSiteHome(typed("cedar.example"), s.fetch);
    expect(where).toMatchObject({ origin: "https://cedar.example", host: "cedar.example", moved: null });
    expect(where.home).toMatchObject({ kind: "ok", url: "https://cedar.example/" });
    expect(s.calls).toEqual(["https://cedar.example/"]);
    expect(movedNote("cedar.example", where)).toBeNull();
  });

  it("follows the site's own redirect to www, and says so in one line", async () => {
    const s = site({ "https://cedar.example/": page("https://www.cedar.example/", HOME) });
    const where = await resolveSiteHome(typed("cedar.example"), s.fetch);
    expect(where).toMatchObject({ origin: "https://www.cedar.example", host: "www.cedar.example", moved: { how: "redirect" } });
    expect(s.calls).toEqual(["https://cedar.example/"]);
    expect(movedNote("cedar.example", where)).toBe("cedar.example sends visitors to www.cedar.example, so we checked that address.");
  });

  it("skips gymshark.com's checkout domain and its Redirecting... page for the store at www (11 Oct 2026)", async () => {
    const s = site({
      "https://gymshark.com/": page("https://us.checkout.gymshark.com/", hosts("gymshark-redirect-page.html")),
      "https://www.gymshark.com/": page("https://www.gymshark.com/", hosts("gymshark-www-home.html")),
    });
    const where = await resolveSiteHome(typed("gymshark.com"), s.fetch);
    expect(where).toMatchObject({ origin: "https://www.gymshark.com", host: "www.gymshark.com", moved: { how: "twin", landed: "us.checkout.gymshark.com", redirectPage: true } });
    expect(where.home).toMatchObject({ kind: "ok", url: "https://www.gymshark.com/" });
    expect(s.calls).toEqual(["https://gymshark.com/", "https://www.gymshark.com/"]);
    expect(movedNote("gymshark.com", where)).toBe("gymshark.com goes to us.checkout.gymshark.com, so we checked www.gymshark.com, where your home page is.");
  });

  it("tries www when the typed host itself shows a redirect page", async () => {
    const stub = '<html><head><meta http-equiv="refresh" content="0;url=https://www.cedar.example/"></head><body>Redirecting...</body></html>';
    const s = site({ "https://cedar.example/": page("https://cedar.example/", stub), "https://www.cedar.example/": page("https://www.cedar.example/", HOME) });
    const where = await resolveSiteHome(typed("cedar.example"), s.fetch);
    expect(where.origin).toBe("https://www.cedar.example");
    expect(movedNote("cedar.example", where)).toBe("cedar.example shows a redirect page, so we checked www.cedar.example, where your home page is.");
  });

  it("stays where the typed address went when www doesn't answer with a real home page on the same site", async () => {
    const landed = page("https://checkout.cedar.example/", hosts("gymshark-redirect-page.html"));
    for (const www of [
      { kind: "missing", status: 404 } as Outcome,
      { kind: "unreachable" } as Outcome,
      new Error("This address points to a private network: 10.0.0.1"),
      page("https://checkout.cedar.example/", hosts("gymshark-redirect-page.html")), // back to the checkout domain
      page("https://www.cedar.example/", "<html><body>Redirecting...</body></html>"), // another redirect page
      page("https://other.example/", HOME), // another site
      { kind: "ok", status: 200, url: "https://www.cedar.example/", text: "plain text", html: false } as Outcome,
    ]) {
      const s = site({ "https://cedar.example/": landed, "https://www.cedar.example/": www });
      const where = await resolveSiteHome(typed("cedar.example"), s.fetch);
      expect(where.origin).toBe("https://checkout.cedar.example");
      expect(where.home).toBe(landed);
      expect(s.calls).toHaveLength(2);
      expect(movedNote("cedar.example", where)).toBe("cedar.example sends visitors to checkout.cedar.example, so we checked that address.");
    }
  });

  it("follows a myshopify.com address to the store's own domain without trying www", async () => {
    const s = site({ "https://cedar.myshopify.com/": page("https://cedar.example/", HOME) });
    const where = await resolveSiteHome(typed("cedar.myshopify.com"), s.fetch);
    expect(where).toMatchObject({ origin: "https://cedar.example", host: "cedar.example", moved: { how: "redirect" } });
    expect(s.calls).toEqual(["https://cedar.myshopify.com/"]);
  });

  it("keeps the typed address when its home page can't be read, and never throws", async () => {
    for (const answer of [{ kind: "missing", status: 404 } as Outcome, { kind: "turned-away", status: 403 } as Outcome, new Error("getaddrinfo ENOTFOUND")]) {
      const s = site({ "https://cedar.example/": answer });
      const where = await resolveSiteHome(typed("cedar.example"), s.fetch);
      expect(where.origin).toBe("https://cedar.example");
      expect(where.moved).toBeNull();
      expect(s.calls).toEqual(["https://cedar.example/"]);
    }
    const s = site({});
    expect((await resolveSiteHome(typed("cedar.example"), s.fetch)).home).toEqual({ kind: "missing", status: 404 });
  });

  it("asks for www with the scheme that was typed", async () => {
    const s = site({ "http://cedar.example/": page("http://checkout.cedar.example/", "<html><title>Redirecting</title></html>") });
    await resolveSiteHome(typed("cedar.example", "http"), s.fetch);
    expect(s.calls).toEqual(["http://cedar.example/", "http://www.cedar.example/"]);
  });

  it("words the note plainly, with no em dash", () => {
    const all = [MOVED_COPY.redirect("a.example", "www.a.example"), MOVED_COPY.otherHost("a.example", "b.a.example", "www.a.example"), MOVED_COPY.redirectPage("a.example", "www.a.example")];
    for (const line of all) expect(line).not.toMatch(/\u2014|\s\u2013\s/);
  });
});

// ---------- shared components ----------

describe("the tool page frame and its parts", () => {
  const tool = toolBySlug("ai-crawler-checker");
  const Page = () =>
    createElement(
      ui.ToolShell,
      {
        page: tool,
        hero: createElement(ui.ToolHero, { h1: tool.h1, intro: "The AI Crawler Checker is a free tool that reads robots.txt.", timing: tool.timing }),
        result: createElement("div", null, createElement(ui.SampleLabel, null, "A made-up robots.txt"), createElement(ui.ResultHeading, null, "2 bots are blocked")),
        cta: { text: "See how GEO gets you into AI answers", href: "/?ref=tool-ai-crawler-checker#how" },
        announce: "Your result is ready",
      },
      createElement(ui.WhatItChecks, { items: ["Which AI bots may read your pages"] }),
      createElement(ui.Explainer, { id: "what-is-gptbot", question: "What is GPTBot?" }, createElement("p", null, "OpenAI's training crawler.")),
      createElement(ui.HowItWorks, { items: ["We read your robots.txt."], updated: tool.updated }),
      createElement(ui.ToolFaq, { faqs: [{ q: "Should I block GPTBot?", a: "It only affects training.", sources: [{ url: "https://developers.openai.com/api/docs/bots" }] }] }),
      createElement(ui.RelatedTools, { slugs: tool.related }),
      createElement(ui.UpdatedLine, { date: tool.updated }),
    );
  const out = render(Page, tool.path);

  it("renders the band, breadcrumb, one H1, the result, one button, the sections and the footer in order", () => {
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).toContain(`<h1 class="ck-h1">${tool.h1}</h1>`);
    expect(out).toContain('<nav class="tl-crumbs" aria-label="Breadcrumb">');
    expect(out).toContain('<a href="/">Home</a>');
    expect(out).toContain('<a href="/tools">Free tools</a>');
    expect(out).toContain(`<span aria-current="page">${tool.name}</span>`);
    expect(out).toContain('<a class="ck-pill tl-pill" href="/tools">Free tools</a>');
    expect(out).toContain("Free · No sign-up · Results in seconds");
    expect(out.match(/class="ck-btn ck-btn-dark tl-cta"/g)).toHaveLength(1);
    expect(out).toContain('href="/?ref=tool-ai-crawler-checker#how"');
    expect(out.indexOf('class="tl-result"')).toBeLessThan(out.indexOf("tl-cta-card"));
    expect(out.indexOf("tl-cta-card")).toBeLessThan(out.indexOf("What this tool checks"));
    expect(out).toContain('<p class="ck-sr" aria-live="polite">Your result is ready</p>');
    expect(out).toContain('<span class="ck-chip is-grey">Example</span>');
    expect(out).toContain('tabindex="-1" data-tl-focus=""');
    expect(out).toContain('<h2 class="ck-h2" id="what-is-gptbot">What is GPTBot?</h2>');
    expect(text(out)).toContain("Maintained by GEO. Updated 11 October 2026.");
    expect(text(out)).toContain("Updated 11 October 2026 · Made by GEO");
    expect(out.indexOf("tl-foot")).toBeGreaterThan(out.indexOf("tl-updated"));
  });

  it("shows FAQs open, as H3s with their answers and sources", () => {
    expect(out).toContain('<h3 class="ck-h3">Should I block GPTBot?</h3><p>It only affects training.</p>');
    expect(out).toContain('Source: <span><a href="https://developers.openai.com/api/docs/bots" rel="noopener noreferrer" target="_blank">developers.openai.com</a>');
    expect(out).not.toMatch(/<details|\shidden[\s>=]/);
  });

  it("links 3 related tools and the hub", () => {
    for (const s of tool.related) expect(out).toContain(`<a href="${toolBySlug(s).path}">${toolBySlug(s).name}</a>`);
    expect(out).toContain('<a href="/tools">See all free tools</a>');
  });

  it("keeps code selectable without JavaScript and escapes it", () => {
    const box = render(() => createElement(ui.CopyBox, { label: "Lines to delete", code: '<script>alert("x")</script>\nUser-agent: GPTBot', filename: "robots.txt.liquid" }));
    expect(box).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(box).toContain('<pre class="tl-code" tabindex="0"');
    expect(box).not.toContain("<button"); // the Copy button appears once JavaScript runs
    expect(box).toContain("robots.txt.liquid");
  });

  it("gives forms visible labels, phone-friendly web address fields, a real submit button and the honeypot", () => {
    const form = render(() =>
      createElement(
        "form",
        { method: "post" },
        createElement(ui.TextField, { name: "url", label: "Your website", placeholder: "yourstore.com", url: true, required: true }),
        createElement(ui.TextArea, { name: "text", label: "Paste your robots.txt", code: true, defaultValue: "User-agent: *" }),
        createElement(ui.SubmitButton, null, "Check my site"),
        createElement(ui.HoneypotField),
      ),
    );
    expect(form).toMatch(/<label class="tl-label" for="[^"]+">Your website<\/label>/);
    expect(form).toContain('inputMode="url"');
    expect(form).toContain('autoCapitalize="off"');
    expect(form).toContain('autoCorrect="off"');
    expect(form).toContain('spellcheck="false"');
    expect(form).toContain('type="text"');
    expect(form).toContain('<button class="ck-btn ck-btn-dark tl-submit" type="submit">Check my site</button>');
    expect(form).toContain('<input type="text" name="website" tabindex="-1" autoComplete="off"/>');
    expect(form.match(/name="website"/g)).toHaveLength(1);
    expect(render(() => createElement(ui.SubmitButton, { busy: true }, "Check"))).toContain("Checking…");
  });

  it("colours status chips by tone, with purple kept out of them", () => {
    const chips = render(() => createElement("div", null, ...(["good", "warn", "bad", "info", "neutral"] as const).map((t) => createElement(ui.StatusChip, { key: t, tone: t }, t))));
    expect(chips).toContain('class="ck-chip is-green">good');
    expect(chips).toContain('class="ck-chip is-amber">warn');
    expect(chips).toContain('class="ck-chip is-red">bad');
    expect(chips).toContain('class="ck-chip tl-chip-info">info');
    expect(chips).toContain('class="ck-chip is-grey">neutral');
    expect(render(() => createElement(ui.ToolError, { message: "We couldn't reach that site." }))).toContain('role="alert"');
  });
});

describe("the site footer", () => {
  const footer = renderToStaticMarkup(createElement(SiteFooter));

  it("links the hub, all 7 tools in registry order, and the main pages, as plain links", () => {
    expect(footer).toContain('<nav class="tl-foot-tools" aria-label="Free tools">');
    expect(footer).toContain('<nav class="tl-foot-site" aria-label="GEO">');
    expect(footer).toContain('<a href="/tools">All free tools</a>');
    const positions = TOOLS.map((t) => footer.indexOf(`<a href="${t.path}">${t.name}</a>`));
    for (const p of positions) expect(p).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const [label, href] of [["Home", "/"], ["How it works", "/#how"], ["Pricing", "/#pricing"], ["Privacy", "/privacy"]]) {
      expect(footer).toContain(`<a href="${href}">${label}</a>`);
    }
    expect(footer).toContain("GEO · Helps ChatGPT &amp; co recommend your products");
    expect(footer).not.toMatch(/onClick|<button/);
  });

  it("is on the free check pages too", () => {
    const check = render(() => createElement(CheckShell, { hero: createElement("h1", null, "x") }));
    for (const t of TOOLS) expect(check).toContain(`<a href="${t.path}">${t.name}</a>`);
    expect(check).toContain('<a href="/privacy">Privacy</a>');
    expect(check).not.toContain('class="ck-foot"');
  });
});

describe("the home page links every tool", () => {
  const page = readFileSync(join(ROOT, "app/home/home.html"), "utf8");

  it("has the free tools block in the footer and a Free tools link in the nav, in step with the registry", () => {
    const start = page.indexOf('<nav class="foot-tools" aria-label="Free tools">');
    expect(start).toBeGreaterThan(-1);
    const block = page.slice(start, page.indexOf("</nav>", start));
    expect(block).toContain('<a href="/tools">All free tools</a>');
    for (const t of TOOLS) expect(block).toContain(`<a href="${t.path}">${t.name}</a>`);
    expect(block.match(/<a href=/g)).toHaveLength(TOOLS.length + 1);
    const nav = page.slice(page.indexOf('<ul class="nav-links">'), page.indexOf("</ul>", page.indexOf('<ul class="nav-links">')));
    expect(nav).toContain('<li><a href="/tools">Free tools</a></li>');
  });

  it("has one canonical, share tags and the same organisation as the tool pages", () => {
    expect(page.match(/rel="canonical"/g)).toHaveLength(1);
    expect(page).toContain('<link rel="canonical" href="https://usegeo.app/">');
    expect(page).toContain('<meta property="og:url" content="https://usegeo.app/">');
    expect(page).toContain('<meta property="og:image" content="https://usegeo.app/og/home.png">');
    expect(page).toContain('<meta property="og:title" content="GEO · Get your products recommended by AI">');
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image">');
    const json = /<script type="application\/ld\+json">([^<]*)<\/script>/.exec(page)?.[1];
    expect(json).toBeTruthy();
    const graph = (JSON.parse(json!) as { "@graph": unknown[] })["@graph"];
    expect(graph).toEqual([ORG_NODE, WEBSITE_NODE]);
  });
});

// ---------- the hub, the 404 page, the layout ----------

describe("the hub page", () => {
  const out = render(hub.default as ComponentType, "/tools");
  const m = metaOf(callMeta(hub.meta));

  it("has its own head: title, description, canonical /tools and the hub JSON-LD", () => {
    expect(m.title?.title).toBe("Free AI Search Tools for Shopify Stores | GEO");
    expect(m.name("description")).toBe(HUB.description);
    expect(m.canonicals.map((c) => c.href)).toEqual(["https://usegeo.app/tools"]);
    expect(m.prop("og:image")).toBe("https://usegeo.app/og/tools.png");
    expect(m.ld).toEqual(hubJsonLd());
    expect(m.name("robots")).toBeUndefined();
  });

  it("shows the H1, intro, the three groups with every tool, where to start, one button and the updated line", () => {
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).toContain(`<h1 class="ck-h1">${HUB.h1}</h1>`);
    expect(text(out)).toContain(HUB.intro);
    for (const g of TOOL_GROUPS) expect(out).toContain(`>${g.heading}</h2>`);
    for (const t of TOOLS) {
      expect(out).toContain(`<a href="${t.path}">${t.name}</a></h3>`);
      expect(text(out)).toContain(t.short);
    }
    expect(text(out)).toContain("Not sure? Start with the AI Visibility Checker to see if AI recommends your product today.");
    expect(out.match(/tl-cta"/g)).toHaveLength(1);
    expect(out).toMatch(/<a class="ck-btn ck-btn-dark tl-cta" href="\/\?ref=tools-hub#how">See how GEO works/);
    expect(out).toContain('<span aria-current="page">Free tools</span>');
    expect(text(out)).toContain("Updated 11 October 2026 · Made by GEO");
    expect(out).not.toContain("Free · No sign-up ·");
    expect(out).toContain('aria-label="Free tools"');
  });
});

describe("the 404 page under /tools", () => {
  it("answers 404 with noindex and links every tool", async () => {
    const res = (await notFound.loader()) as unknown as { init: ResponseInit | null };
    expect(res.init?.status).toBe(404);
    expect(new Headers(res.init?.headers).get("X-Robots-Tag")).toBe("noindex");
    const m = metaOf(callMeta(notFound.meta));
    expect(m.name("robots")).toBe("noindex");
    expect(m.canonicals).toHaveLength(0);
    const out = render(notFound.default as ComponentType, "/tools/nope");
    expect(out).toContain("We couldn&#x27;t find that tool.");
    for (const t of TOOLS) expect(out).toContain(`href="${t.path}"`);
    expect(out).not.toContain("tl-cta");
    expect(out).toContain('<a href="/tools">Free tools</a>'); // the breadcrumb leads back to the hub
  });
});

describe("the tools layout", () => {
  it("links the fonts, check.css and tools.css, and sets the shared headers", () => {
    const links = toolsLayout.links();
    expect(links.filter((l) => (l as { rel?: string }).rel === "stylesheet")).toHaveLength(3);
    expect(toolsLayout.headers).toBe(toolHeaders);
    expect(notFound.headers).toBe(toolHeaders);
    expect(hub.headers).toBe(toolHeaders);
  });

  it("shows errors in the site frame, with every tool linked and the footer", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const Stub = createRoutesStub([
      { id: "tools", path: "/tools", Component: toolsLayout.default as ComponentType, ErrorBoundary: toolsLayout.ErrorBoundary as ComponentType, loader: () => null },
    ]);
    const out = renderToStaticMarkup(createElement(Stub, { initialEntries: ["/tools"], hydrationData: { loaderData: {}, errors: { tools: new Error("boom") } } }));
    quiet.mockRestore();
    expect(out).toContain("Something went wrong. Please try again.");
    for (const t of TOOLS) expect(out).toContain(`href="${t.path}"`);
    expect(out).toContain('class="tl-foot"');
    expect(out).not.toContain("boom");
  });

  it("only sets a title for its error page", () => {
    expect(callMeta(toolsLayout.meta)).toEqual([]);
    const err = (toolsLayout.meta as unknown as (a: unknown) => MetaDescriptor[])({ error: new Error("x") });
    expect(err).toContainEqual({ name: "robots", content: "noindex" });
  });
});
