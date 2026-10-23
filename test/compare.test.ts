// The /compare pages: the content follows the site's copy rules, the links between pages work, and the page and
// hub render with their table, waitlist link, FAQ and sources.
import { describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { COMPARE_PAGES, compareBySlug, compareJsonLd, waitlistHref } from "../app/lib/compare/pages";
import * as page from "../app/routes/compare.$slug";
import * as hub from "../app/routes/compare._index";

const allText = (p: (typeof COMPARE_PAGES)[number]) =>
  [p.title, p.description, p.short, p.h1, ...p.intro, ...p.sections.flatMap((s) => [s.heading, ...(s.paragraphs ?? []), ...(s.bullets ?? []), ...(s.table ? [...s.table.head, ...s.table.rows.flat()] : [])]), ...p.faqs.flatMap((f) => [f.q, f.a])].join("\n");

describe("compare content", () => {
  it("has unique slugs, short titles and descriptions, a checked date, sources and FAQs", () => {
    expect(new Set(COMPARE_PAGES.map((p) => p.slug)).size).toBe(COMPARE_PAGES.length);
    for (const p of COMPARE_PAGES) {
      expect(p.title.length, p.slug).toBeLessThanOrEqual(60);
      expect(p.title.endsWith(" | GEO")).toBe(true);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(155);
      expect(p.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.sources.length).toBeGreaterThan(0);
      expect(p.faqs.length).toBeGreaterThan(0);
      for (const r of p.related) expect(compareBySlug(r), `${p.slug} -> ${r}`).toBeDefined();
      for (const s of p.sections) if (s.table) for (const row of s.table.rows) expect(row).toHaveLength(s.table.head.length);
    }
  });

  it("never uses em or en dashes", () => {
    for (const p of COMPARE_PAGES) expect(allText(p), p.slug).not.toMatch(/[–—]/);
  });

  it("puts the FAQ in the JSON-LD and tags the waitlist link with the page", () => {
    const p = COMPARE_PAGES[0];
    expect(JSON.stringify(compareJsonLd(p))).toContain('"FAQPage"');
    expect(waitlistHref(p.slug)).toBe(`/?utm_source=usegeo&utm_medium=compare&utm_campaign=${p.slug}#waitlist`);
  });
});

describe("compare pages render", () => {
  it("the hub lists every page", () => {
    const Stub = createRoutesStub([{ path: "/compare", Component: hub.default as ComponentType }]);
    const html = renderToStaticMarkup(createElement(Stub, { initialEntries: ["/compare"] }));
    for (const p of COMPARE_PAGES) expect(html).toContain(`/compare/${p.slug}`);
  });

  it("the loader 404s an unknown slug and returns a known page", () => {
    const known = page.loader({ params: { slug: COMPARE_PAGES[0].slug } } as never) as unknown as { data: { page: unknown } };
    expect(known.data.page).toBeTruthy();
    const unknown = page.loader({ params: { slug: "nope" } } as never) as unknown as { init: { status: number } };
    expect(unknown.init.status).toBe(404);
  });
});
