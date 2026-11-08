// The /compare pages and the service pages (like /seo-agency-perth): the content follows the site's copy rules, the
// links between pages work, every service page has its own route, and the pages render with their table, the Get
// started link to /book, the FAQ and the sources.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { bookHref } from "../app/components/page-article";
import { COMPARE_PAGES, compareJsonLd, type ComparePage } from "../app/lib/compare/pages";
import { LANDING_PAGES, landingJsonLd, relatedLinks, relatedTargets, type LandingPage } from "../app/lib/landing/pages";
import { LANDING_SLUGS } from "../app/lib/landing/paths";
import { OFFER } from "../app/lib/plans";
import * as page from "../app/routes/compare.$slug";
import * as hub from "../app/routes/compare._index";
import * as landing from "../app/landing/route";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const allText = (p: ComparePage | LandingPage) =>
  [p.title, p.description, p.short, p.h1, ...p.intro, ...p.sections.flatMap((s) => [s.heading, ...(s.paragraphs ?? []), ...(s.bullets ?? []), ...(s.table ? [...s.table.head, ...s.table.rows.flat()] : [])]), ...p.faqs.flatMap((f) => [f.q, f.a])].join("\n");

const ALL: (ComparePage | LandingPage)[] = [...COMPARE_PAGES, ...LANDING_PAGES];

describe("compare and service page content", () => {
  it("has unique slugs, short titles and descriptions, a checked date, sources and FAQs", () => {
    expect(new Set(COMPARE_PAGES.map((p) => p.slug)).size).toBe(COMPARE_PAGES.length);
    expect(new Set(LANDING_PAGES.map((p) => p.slug)).size).toBe(LANDING_PAGES.length);
    const targets = relatedTargets();
    for (const p of ALL) {
      expect(p.title.length, p.slug).toBeLessThanOrEqual(60);
      expect(p.title.endsWith(" | FirstPicked")).toBe(true);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(155);
      expect(p.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (p.published) expect(p.published <= p.checked).toBe(true);
      expect(p.sources.length).toBeGreaterThan(0);
      expect(p.faqs.length).toBeGreaterThan(0);
      for (const r of p.related) expect(targets, `${p.slug} -> ${r}`).toContain(r);
      expect(relatedLinks(p.related)).toHaveLength(p.related.length);
      for (const s of p.sections) if (s.table) for (const row of s.table.rows) expect(row).toHaveLength(s.table.head.length);
    }
  });

  it("never uses em or en dashes", () => {
    for (const p of ALL) expect(allText(p), p.slug).not.toMatch(/[–—]/);
  });

  it("never promises emails to websites (Ross, 4 Nov 2026: no outreach for clients)", () => {
    for (const p of ALL) expect(allText(p), p.slug).not.toMatch(/\b40 (emails|pitches)\b|emails to websites|pitches to/i);
  });

  it("states FirstPicked's price as the offer in plans.ts", () => {
    for (const p of ALL) {
      const ours = allText(p).match(/A\$9\d\d a month/g) ?? [];
      for (const m of ours) expect(m, p.slug).toBe(OFFER.price);
    }
    for (const p of LANDING_PAGES) expect(allText(p)).toContain(OFFER.price);
  });

  it("puts the FAQ in the JSON-LD, and tags the Get started link with the page", () => {
    const p = COMPARE_PAGES[0];
    expect(JSON.stringify(compareJsonLd(p))).toContain('"FAQPage"');
    expect(bookHref("compare", p.slug)).toBe(`/book?utm_source=firstpicked&utm_medium=compare&utm_campaign=${p.slug}`);
    const l = LANDING_PAGES[0];
    const graph = JSON.stringify(landingJsonLd(l));
    expect(graph).toContain('"FAQPage"');
    expect(graph).toContain('"Service"');
    expect(graph).toContain(`"https://firstpicked.com.au/${l.slug}"`);
  });
});

describe("service page routes", () => {
  it("gives every service page its own route, and nothing else", () => {
    expect([...LANDING_SLUGS].sort()).toEqual(LANDING_PAGES.map((p) => p.slug).sort());
    expect(readFileSync(join(ROOT, "app/routes.ts"), "utf8")).toContain('const LANDING_FILE = "landing/route.tsx"');
    // A flat route file with the same address would clash with the service page.
    for (const s of LANDING_SLUGS) expect(() => readFileSync(join(ROOT, `app/routes/${s}.tsx`))).toThrow();
  });

  it("the loader returns the page for its address and 404s anything else", () => {
    const req = (url: string) => ({ request: new Request(url), params: {}, context: {} }) as never;
    const got = landing.loader(req("https://firstpicked.com.au/seo-agency-perth/")) as { page: LandingPage };
    expect(got.page.slug).toBe("seo-agency-perth");
    let thrown: unknown;
    try {
      landing.loader(req("https://firstpicked.com.au/nope"));
    } catch (e) {
      thrown = e;
    }
    expect((thrown as { init: { status: number } }).init.status).toBe(404);
  });

  it("renders the Perth page with its table, the Get started link, the FAQ and the related pages", () => {
    const loaderData = landing.loader({ request: new Request("https://firstpicked.com.au/seo-agency-perth"), params: {}, context: {} } as never);
    const Stub = createRoutesStub([{ id: "perth", path: "/seo-agency-perth", Component: landing.default as ComponentType, loader: () => loaderData }]);
    const html = renderToStaticMarkup(createElement(Stub, { initialEntries: ["/seo-agency-perth"], hydrationData: { loaderData: { perth: loaderData } } }));
    expect(html).toContain("A Perth SEO agency for Shopify brands.");
    expect(html).toContain('href="/book?utm_source=firstpicked&amp;utm_medium=landing&amp;utm_campaign=seo-agency-perth"');
    expect(html).toContain("Get started");
    expect(html).toContain('class="cp-table"');
    expect(html).toContain("Questions people ask");
    expect(html).toContain('href="/compare/best-seo-agencies-perth"');
  });
});

describe("compare pages render", () => {
  it("the hub lists every page", () => {
    const Stub = createRoutesStub([{ path: "/compare", Component: hub.default as ComponentType }]);
    const html = renderToStaticMarkup(createElement(Stub, { initialEntries: ["/compare"] }));
    for (const p of COMPARE_PAGES) expect(html).toContain(`/compare/${p.slug}`);
  });

  it("the loader 404s an unknown slug and returns a known page with its related pages", () => {
    const known = page.loader({ params: { slug: "best-seo-agencies-perth" } } as never) as unknown as { data: { page: unknown; related: { href: string }[] } };
    expect(known.data.page).toBeTruthy();
    expect(known.data.related.map((r) => r.href)).toContain("/seo-agency-perth");
    const unknown = page.loader({ params: { slug: "nope" } } as never) as unknown as { init: { status: number } };
    expect(unknown.init.status).toBe(404);
  });
});
