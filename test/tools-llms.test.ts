/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON-LD graph */
// The llms.txt Checker (/tools/llms-txt-checker): the line-by-line checks against the llmstxt.org format,
// Shopify's automatic file, the starter file and its Shopify template, the site check (files and home page
// faked through fetch.server), the page (head, JSON-LD, copy, one button) and the action's guards.
// Fixtures: test/fixtures/tools/llms-*.txt. llms-shopify-default.txt was observed on Shopify's own Horizon
// demo store (https://theme-horizon-demo.myshopify.com/llms.txt, 11 Oct 2026); every other fixture and the
// home page below are made up, and say so in their text.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type MetaDescriptor } from "react-router";
import type { FetchOutcome } from "../app/lib/tools/fetch.server";

vi.mock("../app/lib/tools/fetch.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/tools/fetch.server")>()),
  fetchSiteFile: vi.fn(),
}));

const { fetchSiteFile, OUTCOME_COPY } = await import("../app/lib/tools/fetch.server");
const llms = await import("../app/lib/tools/llms");
const { buildStarter, checkLlms, isShopifyDefault, linksIn, llmsReport, llmsVerdict, readHome, starterLinks, toShopifyTemplate, MAX_MAIN_PAGES } = llms;
const { checkLlmsSite, clearLlmsCache } = await import("../app/lib/tools/llms.server");
const copy = await import("../app/lib/tools/copy/llms-txt-checker");
const { siteLlmsTxt } = await import("../app/lib/tools/site-files");
const { toolBySlug, TOOLS } = await import("../app/lib/tools/registry");
const { toolJsonLd } = await import("../app/lib/tools/seo");
const { SITE_INPUT_BAD, SITE_INPUT_EMPTY } = await import("../app/lib/tools/site-input");
const { CROSS_SITE_COPY, TOO_BIG_COPY } = await import("../app/lib/tools/guard.server");
const { HOUR_COPY, resetToolLimits } = await import("../app/lib/tools/limits.server");
const { toolHeaders } = await import("../app/lib/tools/http");
const route = await import("../app/routes/tools.llms-txt-checker");
const layout = await import("../app/routes/tools");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const fixture = (name: string) => read(`test/fixtures/tools/llms-${name}.txt`);
const TOOL = toolBySlug("llms-txt-checker");
const text = (h: string) =>
  h
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
const ids = (t: string) => checkLlms(t).map((c) => c.id);
const byTone = (t: string, tone: string) => checkLlms(t).filter((c) => c.tone === tone);

// ---------- the checks ----------

describe("checkLlms on our own llms.txt", () => {
  it("passes with zero problems and zero tips, and lists what passed", () => {
    const report = llmsReport(siteLlmsTxt());
    expect(report.problems).toBe(0);
    expect(report.tips).toBe(0);
    expect(report.checks.filter((c) => c.tone !== "info")).toEqual([]);
    expect(report.checks.map((c) => c.id)).toEqual(["md-links"]);
    expect(report.passed).toEqual([
      copy.PASSED_COPY.title,
      copy.PASSED_COPY.oneTitle,
      copy.PASSED_COPY.summary,
      copy.PASSED_COPY.noEarlyHeadings,
      copy.PASSED_COPY.links,
      copy.PASSED_COPY.fullLinks,
      copy.PASSED_COPY.sections,
    ]);
    expect(llmsVerdict(report)).toEqual({ tone: "good", headline: "Your llms.txt follows the format" });
  });
});

describe("Shopify's automatic file", () => {
  const file = fixture("shopify-default");

  it("is detected by its first line and its links for shopping agents, and has no problems", () => {
    expect(file.startsWith("# Agent Instructions")).toBe(true);
    expect(isShopifyDefault(file)).toBe(true);
    const report = llmsReport(file);
    expect(report.shopify).toBe(true);
    expect(report.problems).toBe(0);
    expect(report.tips).toBe(0);
    expect(report.checks.map((c) => c.id)).toEqual(["shopify-default"]);
    expect(report.passed).toEqual([copy.PASSED_COPY.title]);
    expect(llmsVerdict(report)).toEqual({ tone: "neutral", headline: "This is Shopify's automatic llms.txt" });
  });

  it("needs both the title and Shopify's links", () => {
    expect(isShopifyDefault("# Agent Instructions for my bot\n\n> Hi\n")).toBe(false);
    expect(isShopifyDefault("# My Store\n\nSee https://shop.app/SKILL.md\n")).toBe(false);
    expect(isShopifyDefault("﻿\n\n# Agent Instructions: Cedar\n\nGET /.well-known/ucp\n")).toBe(true);
  });
});

describe("the line-by-line checks (made-up fixtures)", () => {
  it("flags a ### heading before the first ## section", () => {
    const checks = byTone(fixture("heading-early"), "problem");
    expect(checks).toEqual([
      {
        id: "heading-early",
        tone: "problem",
        text: "Line 5 is a heading before the first ## section. Only plain text can go there.",
        line: 5,
        excerpt: "### About us",
      },
    ]);
  });

  it("flags list items without a [name](url) link, with their lines", () => {
    const checks = byTone(fixture("no-link"), "problem");
    expect(checks.map((c) => [c.id, c.line, c.excerpt])).toEqual([
      ["list-link", 8, "- Shipping: we ship worldwide"],
      ["list-link", 9, "- https://made-up-store.example/pages/contact"],
    ]);
    expect(checks[0].text).toBe("Line 8 is a list item without a link. Use `- [Page name](https://...): short note`.");
    expect(llmsVerdict(llmsReport(fixture("no-link"))).headline).toBe("Your llms.txt has 2 problems");
  });

  it("flags two title lines once, naming both lines", () => {
    const checks = byTone(fixture("two-h1"), "problem");
    expect(checks.map((c) => c.id)).toEqual(["h1-many"]);
    expect(checks[0].text).toBe("There's more than one # title line (lines 1 and 5). Keep one.");
    expect(llmsVerdict(llmsReport(fixture("two-h1"))).headline).toBe("Your llms.txt has 1 problem");
  });

  it("gives short (relative) links our tip, not a problem", () => {
    const report = llmsReport(fixture("relative"));
    expect(report.problems).toBe(0);
    expect(report.checks.filter((c) => c.tone === "tip").map((c) => [c.id, c.line, c.ourTip])).toEqual([
      ["link-relative", 7, true],
      ["link-relative", 8, true],
    ]);
    expect(report.checks[0].text).toBe("Line 7 uses a short link. Full addresses (https://...) work everywhere.");
    expect(llmsVerdict(report).tone).toBe("good");
    expect(report.passed).not.toContain(copy.PASSED_COPY.fullLinks);
  });

  it("notes an Optional section, and says nothing about .md links when there are some", () => {
    const checks = checkLlms(fixture("optional"));
    expect(checks.map((c) => [c.id, c.tone, c.line])).toEqual([["optional", "info", 9]]);
    expect(checks[0].text).toBe("Since version 2 of the format, an Optional section is just a normal section.");
  });

  it("accepts a byte-order mark and Windows line endings", () => {
    const file = fixture("bom-crlf");
    expect(file.charCodeAt(0)).toBe(0xfeff);
    expect(file).toContain("\r\n");
    const report = llmsReport(file);
    expect(report.problems).toBe(0);
    expect(report.tips).toBe(0);
    expect(report.passed).toContain(copy.PASSED_COPY.title);
    expect(report.passed).toContain(copy.PASSED_COPY.summary);
  });

  it("calls an HTML page a web page, not a text file, and checks nothing else", () => {
    expect(checkLlms(fixture("html-404"))).toEqual([{ id: "html", tone: "problem", text: copy.CHECK_COPY.html }]);
  });

  it("covers the other rules: no title, empty, no summary, empty section, long file", () => {
    expect(checkLlms("")).toEqual([{ id: "empty", tone: "problem", text: "The file is empty." }]);
    expect(checkLlms("﻿  \r\n\n")[0].id).toBe("empty");
    const noTitle = checkLlms("Cedar & Co\n\n## Pages\n\n- [About](https://a.example/about)\n");
    expect(noTitle[0]).toMatchObject({ id: "h1", tone: "problem", line: 1, excerpt: "Cedar & Co" });
    expect(noTitle[0].text).toBe("The file must start with a title line, like `# Your Store`. It's the only required part.");
    expect(ids("#\n\n> x\n")).toContain("h1"); // an empty title isn't a title
    expect(ids("# Cedar\n\n## Pages\n\n- [About](https://a.example/about)\n")).toEqual(["summary", "md-links"]);
    expect(ids("# Cedar\n\n> Oils\n\n## Pages\n\nJust words.\n")).toEqual(["section-empty"]);
    expect(checkLlms("# Cedar\n\n> Oils\n\n## Pages\n")[0].text).toBe("The ## Pages section has no links.");
    const long = `# Cedar\n\n> Oils\n\n## Pages\n\n${"- [About](https://a.example/about): notes\n".repeat(5_000)}`;
    expect(ids(long)).toEqual(["size", "md-links"]);
    expect(checkLlms(long)[0].text).toBe("Your file is very long. The format is meant to be a short summary with links.");
  });

  it("allows lists, notes and links before the first ## section, and headings below ## sections", () => {
    const file = "# Cedar\n> Oils\n\nWe sell oils. See [our story](https://a.example/story).\n\n- small batches\n\n## Pages\n\n- [About](https://a.example/about): who we are\n\n### More\n\n- [Contact](https://a.example/contact)\n";
    const report = llmsReport(file);
    expect(report.problems).toBe(0);
    expect(report.tips).toBe(0);
  });

  it("ignores headings, lists and links inside code blocks", () => {
    const file = "# Cedar\n\n> Oils\n\n```\n### not a heading\n- not a list item\n```\n\n## Pages\n\n- [About](https://a.example/about)\n";
    expect(llmsReport(file).problems).toBe(0);
  });

  it("lists the first 10 lines of a kind, then says how many more, and counts them all", () => {
    const file = `# Cedar\n\n> Oils\n\n## Pages\n\n${"- no link here\n".repeat(25)}`;
    const report = llmsReport(file);
    expect(report.problems).toBe(25);
    const listed = report.checks.filter((c) => c.id === "list-link");
    expect(listed).toHaveLength(11);
    expect(listed[10]).toEqual({ id: "list-link", tone: "problem", text: "And 15 more lines like this." });
    expect(llmsVerdict(report).headline).toBe("Your llms.txt has 25 problems");
  });

  it("lists problems first, then tips, then info", () => {
    const file = "# Cedar\n\n### Early\n\n## Pages\n\n- [About](/about)\n- no link\n\n## Optional\n\n- [Press](https://a.example/press)\n";
    const tones = checkLlms(file).map((c) => c.tone);
    expect(tones).toEqual([...tones].sort((a, b) => ["problem", "tip", "info"].indexOf(a) - ["problem", "tip", "info"].indexOf(b)));
    expect(ids(file)).toEqual(["heading-early", "list-link", "summary", "link-relative", "md-links", "optional"]);
  });

  it("cuts excerpts to 120 characters", () => {
    const line = `- ${"x".repeat(300)}`;
    const check = checkLlms(`# Cedar\n\n> Oils\n\n## Pages\n\n${line}\n`).find((c) => c.id === "list-link")!;
    expect(check.excerpt!.length).toBeLessThanOrEqual(120);
    expect(check.excerpt!.endsWith("…")).toBe(true);
    // an emoji right at the cut is left out whole, never split into half a character
    const emoji = checkLlms(`# Cedar\n\n> Oils\n\n## Pages\n\n- ${"x".repeat(116)}🙂🙂🙂\n`).find((c) => c.id === "list-link")!;
    expect(emoji.excerpt).toBe(`- ${"x".repeat(116)}…`);
  });

  it("stays fast on hostile files (linear scanning)", () => {
    const started = Date.now();
    for (const body of ["[".repeat(200_000), "](".repeat(100_000), `- ${"[a](".repeat(50_000)}`, `${"# x\n".repeat(50_000)}`, `${"x".repeat(4_100)}\n`.repeat(48)]) {
      checkLlms(`# T\n\n## S\n\n${body}`);
    }
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  // Review fixes (11 Oct 2026).
  it("doesn't call a divider line (- - -, * * *) a list item without a link", () => {
    const file = "# Cedar\n\n> Oils\n\n## Pages\n\n- [About](https://a.example/about)\n\n- - -\n\n* * *\n\n___\n";
    expect(llmsReport(file).problems).toBe(0);
    expect(ids("# Cedar\n\n> Oils\n\n## Pages\n\n- - x\n")).toContain("list-link"); // a real item that starts with "-"
  });

  it("calls a page that opens with a comment or an XML line a web page", () => {
    for (const page of ["<!-- served by a proxy -->\n<!DOCTYPE html><html><body>Not found</body></html>", "<?xml version='1.0'?>\n<html><head></head></html>"]) {
      expect(llms.isWebPage(page)).toBe(true);
      expect(checkLlms(page)).toEqual([{ id: "html", tone: "problem", text: copy.CHECK_COPY.html }]);
    }
    // a real llms.txt may open with a comment
    expect(llms.isWebPage("<!-- notes -->\n# Cedar\n\n> Oils\n")).toBe(false);
    expect(ids("<!-- notes -->\n# Cedar\n\n> Oils\n")).toContain("h1");
  });

  it("reads closing #s off headings, and names an empty or odd ## heading plainly", () => {
    expect(checkLlms("# Cedar\n\n> Oils\n\n## Pages ##\n")[0].text).toBe("The ## Pages section has no links.");
    expect(checkLlms("# Cedar\n\n> Oils\n\n## C# notes\n")[0].text).toBe("The ## C# notes section has no links.");
    expect(checkLlms("# Cedar\n\n> Oils\n\n##\n")[0].text).toBe("This ## section has no links.");
    // backticks in the file's own heading never turn the sentence into code; long names are cut
    expect(checkLlms("# Cedar\n\n> Oils\n\n## `Docs`\n")[0].text).toBe("The ## Docs section has no links.");
    expect(checkLlms(`# Cedar\n\n> Oils\n\n## ${"n".repeat(200)}\n`)[0].text.length).toBeLessThan(120);
  });

  it("stays fast on headings full of spaces (no regex backtracking)", () => {
    const body = `## ${" ".repeat(296)}x\n`.repeat(1_700); // about 512 KB, the most we fetch
    const started = Date.now();
    checkLlms(`# T\n\n${body}`);
    expect(Date.now() - started).toBeLessThan(500);
  });
});

describe("linksIn", () => {
  it("finds [name](url) links, with titles and angle brackets", () => {
    expect(linksIn('- [A](https://a.example/a "Title"): x and [B](<https://a.example/b>)')).toEqual([
      { name: "A", url: "https://a.example/a" },
      { name: "B", url: "https://a.example/b" },
    ]);
    expect(linksIn("- a bare https://a.example link")).toEqual([]);
    expect(linksIn("- [](https://a.example)")).toEqual([]);
    expect(linksIn("[a] (b)")).toEqual([]);
  });
});

// ---------- the starter file ----------

const HOME_URL = "https://cedar.example/";
// A made-up Shopify home page.
const HOME = `<!doctype html><html><head>
<title>Cedar &amp; Co | Beard oil made in small batches</title>
<meta property="og:site_name" content="Cedar &amp; Co">
<meta name="description" content="Beard oils and balms made in small batches.
A made-up store for tests.">
<link href="//cdn.shopify.com/s/files/theme.css" rel="stylesheet">
</head><body>
<a href="#main">Skip to content</a>
<a href="/">Home</a>
<a href="/cart">Cart</a>
<a href="/account/login">Log in</a>
<a href="/search">Search</a>
<a href="/collections/beard-oil">Beard oil</a>
<a href="/collections/beard-oil/">Beard oil again</a>
<a href="https://www.cedar.example/collections/balms">Balms</a>
<a href="/products/cedar-oil"><img src="/cdn/shop/files/oil.jpg" alt=""></a>
<a href="/pages/about-us">About [us]</a>
<a href="/pages/contact">Contact</a>
<a href="/blogs/journal">Journal</a>
<a href="/policies/shipping-policy">Shipping</a>
<a href="/policies/refund-policy">Refunds</a>
<a href="/policies/terms-of-service">Terms</a>
<a href="/collections/beard-oil?sort_by=price">Sorted</a>
<a href="/products/cedar-oil?variant=123">Cedar oil, 50 ml</a>
<a href="/customer_authentication/login?return_to=%2F">Sign in</a>
<a href="mailto:hi@cedar.example">Email us</a>
<a href="/cdn/shop/files/size-chart.pdf">Size chart</a>
<a href="https://other.example/collections/x">Another site</a>
</body></html>`;

const STARTER = `# Cedar & Co

> Beard oils and balms made in small batches. A made-up store for tests.

## Main pages

- [Beard oil](https://cedar.example/collections/beard-oil)
- [Balms](https://cedar.example/collections/balms)
- [About us](https://cedar.example/pages/about-us)
- [Contact](https://cedar.example/pages/contact)
- [Journal](https://cedar.example/blogs/journal)
- [Cedar oil](https://cedar.example/products/cedar-oil)

## Policies

- [Shipping policy](https://cedar.example/policies/shipping-policy)
- [Refund policy](https://cedar.example/policies/refund-policy)
`;

describe("the starter file", () => {
  it("reads the home page: site name, description and same-site links on one address", () => {
    const home = readHome(HOME, HOME_URL, "cedar.example");
    expect(home.title).toBe("Cedar & Co");
    expect(home.description).toBe("Beard oils and balms made in small batches. A made-up store for tests.");
    expect(home.links.every((l) => l.href.startsWith("https://cedar.example/"))).toBe(true);
  });

  it("falls back to the <title> cut at its separator, then the host", () => {
    expect(readHome("<title>Cedar Oils | Home</title>", HOME_URL, "cedar.example").title).toBe("Cedar Oils");
    expect(readHome("<title>Cedar Oils - Home</title>", HOME_URL, "cedar.example").title).toBe("Cedar Oils");
    expect(readHome("<title>Cedar Oils \u2013 Home</title>", HOME_URL, "cedar.example").title).toBe("Cedar Oils");
    expect(readHome("<p>no title</p>", HOME_URL, "cedar.example").title).toBe("cedar.example");
  });

  it("picks collections and pages first, skips the cart, account, sign-in, search, files and the home page, and de-duplicates (query strings dropped)", () => {
    expect(buildStarter(readHome(HOME, HOME_URL, "cedar.example"))).toBe(STARTER);
  });

  it("passes its own checks", () => {
    const report = llmsReport(STARTER);
    expect(report.problems).toBe(0);
    expect(report.tips).toBe(0);
  });

  it("caps the main pages at 15, so one long menu can't push out the pages", () => {
    const links = [
      ...Array.from({ length: 30 }, (_, i) => ({ href: `https://cedar.example/collections/c${i}`, text: `Collection ${i}` })),
      ...Array.from({ length: 5 }, (_, i) => ({ href: `https://cedar.example/products/p${i}`, text: `Product ${i}` })),
      { href: "https://cedar.example/pages/about", text: "About" },
      { href: "https://cedar.example/pages/faq", text: "FAQ" },
      { href: "https://cedar.example/blogs/news", text: "News" },
    ];
    const { main } = starterLinks(links);
    expect(main).toHaveLength(MAX_MAIN_PAGES);
    expect(main.map((l) => l.text)).toContain("About");
    expect(main.map((l) => l.text)).toContain("FAQ");
    expect(main.map((l) => l.text)).toContain("News");
    expect(new Set(main.map((l) => l.href)).size).toBe(MAX_MAIN_PAGES);
    expect(main.some((l) => l.href.includes("/products/"))).toBe(false);
  });

  it("names a link with no words from its address, and keeps brackets out of names", () => {
    const { main } = starterLinks([
      { href: "https://cedar.example/collections/beard-oil", text: "" },
      { href: "https://cedar.example/pages/x", text: "Our [best] oils" },
      { href: "https://cedar.example/pages/a(b)", text: "Odd" },
    ]);
    expect(main.map((l) => l.text)).toEqual(["Beard oil", "Our best oils", "Odd"]);
    expect(buildStarter({ title: "C", description: null, links: [{ href: "https://cedar.example/pages/a(b)", text: "Odd" }] })).toContain(
      "- [Odd](https://cedar.example/pages/a%28b%29)",
    );
  });

  it("always builds a file that passes its own checks: odd link words, brackets in addresses, a title of #s", () => {
    const starter = buildStarter({
      title: "##",
      description: null,
      links: [
        { href: "https://cedar.example/pages/%5D", text: "" },
        { href: "https://cedar.example/pages/a]b", text: "[]" },
      ],
    });
    expect(starter).toBe("# Your Store\n\n## Main pages\n\n- [Page](https://cedar.example/pages/%5D)\n- [Ab](https://cedar.example/pages/a%5Db)\n");
    expect(llmsReport(starter).problems).toBe(0);
    expect(llmsReport(toShopifyTemplate(starter)).problems).toBe(0);
  });

  it("skips the home page's language versions (/fr, /en-ca)", () => {
    const { main } = starterLinks([
      { href: "https://cedar.example/fr", text: "Français" },
      { href: "https://cedar.example/en-ca/", text: "Canada" },
      { href: "https://cedar.example/fr/collections/huiles", text: "Huiles" },
      { href: "https://cedar.example/pages/faq", text: "FAQ" },
    ]);
    expect(main.map((l) => l.text)).toEqual(["Huiles", "FAQ"]);
  });

  it("leaves out the summary and sections it has nothing for", () => {
    expect(buildStarter({ title: "Cedar", description: null, links: [] })).toBe("# Cedar\n");
  });
});

describe("the Shopify template", () => {
  const liquid = toShopifyTemplate(STARTER);

  it("uses only the agents object, with the store name, address and sitemap, and keeps the links typed in", () => {
    expect(liquid.startsWith("# {{ agents.store_name }}\n\n> Beard oils")).toBe(true);
    expect(liquid).toContain("\n\nStore: {{ agents.store_url }}\n\nSitemap: {{ agents.sitemap_url }}\n\n## Main pages\n");
    expect(liquid).toContain("- [Balms](https://cedar.example/collections/balms)");
    const tags = liquid.match(/\{\{[^}]*\}\}|\{%[^%]*%\}/g) ?? [];
    expect(tags).toEqual(["{{ agents.store_name }}", "{{ agents.store_url }}", "{{ agents.sitemap_url }}"]);
    const words = liquid.replace(/https:\/\/\S+/g, "");
    expect(words).not.toMatch(/shop\.|collections|linklists|\{%/);
  });

  it("still passes the checks (the title line is the store name)", () => {
    const report = llmsReport(liquid);
    expect(report.problems).toBe(0);
    expect(report.tips).toBe(0);
  });

  it("keeps typed-in text from running as Liquid, and adds a title when there is none", () => {
    expect(toShopifyTemplate("# A\n\n- [{{ shop.name }}](https://a.example/{% x %})\n")).toContain("- [{ { shop.name }}](https://a.example/{ % x %})");
    const untitled = toShopifyTemplate("## Pages\n\n- [A](https://a.example/a)\n");
    expect(untitled.startsWith("# {{ agents.store_name }}\n\nStore: {{ agents.store_url }}\n\nSitemap: {{ agents.sitemap_url }}\n\n## Pages")).toBe(true);
  });
});

// ---------- the site check ----------

const fetchMock = vi.mocked(fetchSiteFile);
type Part = "llms" | "full" | "agents" | "home";
const ok = (url: string, body: string, html = false): FetchOutcome => ({ kind: "ok", status: 200, url, text: body, html });
const MISSING: FetchOutcome = { kind: "missing", status: 404 };

function fakeSite(parts: Partial<Record<Part, FetchOutcome | Error>>) {
  fetchMock.mockImplementation(async (url: string) => {
    const path = new URL(url).pathname;
    const part: Part = path === "/llms.txt" ? "llms" : path === "/llms-full.txt" ? "full" : path === "/agents.md" ? "agents" : "home";
    const answer = parts[part] ?? MISSING;
    if (answer instanceof Error) throw answer;
    return answer;
  });
}
const cedar = { origin: "https://cedar.example", host: "cedar.example" };

describe("checkLlmsSite", () => {
  beforeEach(() => {
    clearLlmsCache();
    fetchMock.mockReset();
  });

  it("reads the three files and the home page from the site's main address", async () => {
    fakeSite({ llms: ok("https://cedar.example/llms.txt", STARTER), home: ok(HOME_URL, HOME, true) });
    const out = await checkLlmsSite(cedar);
    expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual([
      "https://cedar.example/",
      "https://cedar.example/agents.md",
      "https://cedar.example/llms-full.txt",
      "https://cedar.example/llms.txt",
    ]);
    expect(fetchMock).toHaveBeenCalledWith("https://cedar.example/", expect.objectContaining({ maxBytes: 1_000_000, timeoutMs: 6_000 }));
    expect(fetchMock).toHaveBeenCalledWith("https://cedar.example/llms.txt", { timeoutMs: 6_000 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.site.files).toEqual({ llms: "found", full: "missing", agents: "missing" });
    expect(llmsVerdict(out.site.report).headline).toBe("Your llms.txt follows the format");
    expect(out.site.report.checks.filter((c) => c.tone === "info").map((c) => c.text)).toEqual([
      copy.CHECK_COPY.mdLinks,
      "No /llms-full.txt. That's fine: it isn't part of the format.",
      "No /agents.md.",
    ]);
    expect(out.site.starter).toBe(STARTER);
    expect(out.site.shopify).toBe(true);
    expect(out.site.starterNote).toBeNull();
  });

  it("gives the 'optional' verdict for a 404, and still builds a starter file", async () => {
    fakeSite({ home: ok(HOME_URL, HOME, true) });
    const out = await checkLlmsSite(cedar);
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.report.found).toBe(false);
    expect(llmsVerdict(out.site.report)).toEqual({ tone: "neutral", headline: "No llms.txt found. That's fine: it's optional." });
    expect(out.site.files.llms).toBe("missing");
    expect(out.site.starter).toBe(STARTER);
  });

  it("calls a web page at /llms.txt 'web page instead'", async () => {
    fakeSite({ llms: ok("https://cedar.example/llms.txt", fixture("html-404"), true), full: ok("https://cedar.example/", HOME, true) });
    const out = await checkLlmsSite(cedar);
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.files).toEqual({ llms: "html", full: "html", agents: "missing" });
    expect(out.site.report.checks[0]).toEqual({ id: "html", tone: "problem", text: copy.CHECK_COPY.html });
    expect(llmsVerdict(out.site.report).headline).toBe("Your llms.txt has 1 problem");
    expect(out.site.starterNote).toBe("no-home");
    expect(out.site.starter).toBeNull();
  });

  it("spots Shopify's automatic file on all three addresses, and notes a redirect to /agents.md", async () => {
    const file = fixture("shopify-default");
    fakeSite({
      llms: ok("https://cedar.example/agents.md", file),
      full: ok("https://cedar.example/llms-full.txt", file),
      agents: ok("https://cedar.example/agents.md", file),
      home: ok(HOME_URL, "<!doctype html><title>Cedar</title>", true),
    });
    const out = await checkLlmsSite(cedar);
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.report.shopify).toBe(true);
    expect(out.site.shopify).toBe(true);
    expect(llmsVerdict(out.site.report).headline).toBe("This is Shopify's automatic llms.txt");
    expect(out.site.report.checks.map((c) => c.text)).toEqual([
      copy.CHECK_COPY.shopify,
      "Your /llms.txt redirects to /agents.md.",
      "Found /llms-full.txt. It isn't part of the llmstxt.org format, so we don't check it.",
      "Found /agents.md.",
    ]);
    expect(out.site.starter).toBe("# Cedar\n");
    expect(out.site.starterNote).toBe("no-links");
  });

  it("calls a page that opens with a comment 'web page instead', even when the fetch didn't spot it", async () => {
    const page = "<!-- cache -->\n<!doctype html><html><body>Home</body></html>";
    fakeSite({ llms: ok("https://cedar.example/llms.txt", page), agents: ok("https://cedar.example/agents.md", page) });
    const out = await checkLlmsSite(cedar);
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.files).toEqual({ llms: "html", full: "missing", agents: "html" });
    expect(out.site.report.checks[0].id).toBe("html");
  });

  it("doesn't call a move to www a redirect", async () => {
    fakeSite({ llms: ok("https://www.cedar.example/llms.txt", STARTER) });
    const out = await checkLlmsSite(cedar);
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.report.checks.some((c) => c.id === "redirect")).toBe(false);
  });

  it("answers with the shared copy when /llms.txt can't be read, and never shows an error's own words", async () => {
    fakeSite({ llms: { kind: "turned-away", status: 403 } });
    expect(await checkLlmsSite(cedar)).toEqual({ ok: false, error: OUTCOME_COPY["turned-away"].replace("{status}", "403") });
    clearLlmsCache();
    fakeSite({ llms: { kind: "server-error", status: 503 } });
    expect(await checkLlmsSite(cedar)).toEqual({ ok: false, error: "Your site answered with a server error (503). Try again in a few minutes." });
    clearLlmsCache();
    fakeSite({ llms: new Error("getaddrinfo ENOTFOUND cedar.example") });
    expect(await checkLlmsSite(cedar)).toEqual({ ok: false, error: OUTCOME_COPY.unreachable });
  });

  it("says 'Couldn't check' for the other files when they can't be read", async () => {
    fakeSite({ llms: ok("https://cedar.example/llms.txt", STARTER), full: { kind: "turned-away", status: 429 }, agents: { kind: "unreachable" } });
    const out = await checkLlmsSite(cedar);
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.files).toEqual({ llms: "found", full: "unchecked", agents: "unchecked" });
    expect(out.site.report.checks.some((c) => c.id === "full" || c.id === "agents")).toBe(false);
  });

  it("answers a double submit from its one-minute cache", async () => {
    fakeSite({});
    await checkLlmsSite(cedar);
    await checkLlmsSite(cedar);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

// ---------- the action ----------

function post(fields: Record<string, string>, headers: Record<string, string> = {}, body?: string) {
  const request = new Request("https://usegeo.app/tools/llms-txt-checker", {
    method: "POST",
    body: body ?? new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": "203.0.113.9", ...headers },
  });
  return route.action({ request, params: {}, context: {} } as unknown as ActionFunctionArgs) as unknown as Promise<{
    data: { ok: boolean; error?: string; intent: string; site?: any; text?: string | null; url?: string };
    init: ResponseInit | null;
  }>;
}
const headersOf = (r: { init: ResponseInit | null }) => new Headers(r.init?.headers);

describe("the action", () => {
  beforeEach(() => {
    clearLlmsCache();
    resetToolLimits();
    fetchMock.mockReset();
  });
  afterEach(() => resetToolLimits());

  it("checks a site, with no-store and noindex headers", async () => {
    fakeSite({ llms: ok("https://cedar.example/llms.txt", STARTER), home: ok(HOME_URL, HOME, true) });
    const res = await post({ intent: "fetch", url: "Cedar.Example/pages/about?utm=1" });
    expect(res.init?.status ?? 200).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.site.llmsUrl).toBe("https://cedar.example/llms.txt");
    expect(headersOf(res).get("Cache-Control")).toBe("no-store");
    expect(headersOf(res).get("X-Robots-Tag")).toBe("noindex");
  });

  it("gives a 404 the 'optional' verdict and HTML 'web page instead'", async () => {
    fakeSite({});
    const missing = await post({ intent: "fetch", url: "cedar.example" });
    expect(llmsVerdict(missing.data.site.report).headline).toBe(copy.VERDICT_COPY.missing);
    clearLlmsCache();
    fakeSite({ llms: ok("https://cedar.example/llms.txt", fixture("html-404"), true) });
    const html = await post({ intent: "fetch", url: "cedar.example" });
    expect(html.data.site.files.llms).toBe("html");
    expect(copy.RESULT.file[html.data.site.files.llms as "html"]).toBe("Web page instead");
  });

  it("refuses a post from another site (403) and a body that's too big (413)", async () => {
    const cross = await post({ intent: "fetch", url: "cedar.example" }, { "sec-fetch-site": "cross-site" });
    expect(cross.init?.status).toBe(403);
    expect(cross.data.error).toBe(CROSS_SITE_COPY);
    const evil = await post({ intent: "fetch", url: "cedar.example" }, { origin: "https://evil.example" });
    expect(evil.init?.status).toBe(403);
    const big = await post({}, {}, `intent=paste&text=${"a".repeat(1_100_000)}`);
    expect(big.init?.status).toBe(413);
    expect(big.data.error).toBe(TOO_BIG_COPY);
    // only a pasted file gets that big, so the error shows by the paste box (with the example back in it)
    expect(big.data).toEqual({ ok: false, intent: "paste", text: null, error: TOO_BIG_COPY });
    expect(text(renderPage(big.data))).toContain("The llms.txt on this site, usegeo.app");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives a filled-in honeypot the normal empty result, with no fetch", async () => {
    const res = await post({ intent: "fetch", url: "cedar.example", website: "spam.example" });
    expect(res.data).toEqual({ ok: true, intent: "fetch", url: "cedar.example", site: null });
    const paste = await post({ intent: "paste", text: "# A", website: "x" });
    expect(paste.data).toEqual({ ok: true, intent: "paste", text: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses bad input (400): empty, an IP address, localhost, a port, a very long paste", async () => {
    for (const [url, error] of [
      ["", SITE_INPUT_EMPTY],
      ["10.0.0.1", SITE_INPUT_BAD],
      ["http://localhost/llms.txt", SITE_INPUT_BAD],
      ["cedar.example:8080", SITE_INPUT_BAD],
    ] as const) {
      const res = await post({ intent: "fetch", url });
      expect(res.init?.status, url).toBe(400);
      expect(res.data.error).toBe(error);
    }
    const long = await post({ intent: "paste", text: "a".repeat(200_001) });
    expect(long.init?.status).toBe(400);
    expect(long.data.error).toBe("That's a very long file. Paste up to 200,000 characters.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives the shared copy (502) when the site can't be reached", async () => {
    fakeSite({ llms: new Error("getaddrinfo ENOTFOUND") });
    const res = await post({ intent: "fetch", url: "nowhere.example" });
    expect(res.init?.status).toBe(502);
    expect(res.data.error).toBe(OUTCOME_COPY.unreachable);
    expect(JSON.stringify(res.data)).not.toContain("ENOTFOUND");
  });

  it("limits site checks to 20 an hour per visitor (429)", async () => {
    fakeSite({});
    for (let i = 0; i < 20; i++) expect((await post({ intent: "fetch", url: `shop${i}.example` })).data.ok).toBe(true);
    const over = await post({ intent: "fetch", url: "shop99.example" });
    expect(over.init?.status).toBe(429);
    expect(over.data.error).toBe(HOUR_COPY);
    // Another visitor still gets through.
    expect((await post({ intent: "fetch", url: "shop99.example" }, { "x-real-ip": "198.51.100.7" })).data.ok).toBe(true);
  });

  it("answers a no-JavaScript paste with the text, so the page can show its result", async () => {
    const res = await post({ intent: "paste", text: "# Cedar\n\n## Pages\n\n- no link" });
    expect(res.data).toEqual({ ok: true, intent: "paste", text: "# Cedar\n\n## Pages\n\n- no link" });
    expect(headersOf(res).get("X-Robots-Tag")).toBe("noindex");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------- the page ----------

const callMeta = () => (route.meta as unknown as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });

describe("the page head", () => {
  const list = callMeta();
  const find = (k: string, v: string) => list.find((m) => (m as Record<string, unknown>)[k] === v) as Record<string, string> | undefined;

  it("has the registry title and description, one canonical, Open Graph and Twitter tags, no robots meta", () => {
    expect(list.filter((m) => "title" in m)).toEqual([{ title: "llms.txt Checker: Validate and Generate Your File | GEO" }]);
    expect(TOOL.title.length).toBeLessThan(60);
    expect(find("name", "description")?.content).toBe(TOOL.description);
    expect(TOOL.description.length).toBeLessThan(155);
    const canonicals = list.filter((m) => (m as { rel?: string }).rel === "canonical") as { href: string }[];
    expect(canonicals.map((c) => c.href)).toEqual(["https://usegeo.app/tools/llms-txt-checker"]);
    expect(find("property", "og:url")?.content).toBe("https://usegeo.app/tools/llms-txt-checker");
    expect(find("property", "og:image")?.content).toBe("https://usegeo.app/og/llms-txt-checker.png");
    expect(find("property", "og:image:width")?.content).toBe("1200");
    expect(find("property", "og:image:height")?.content).toBe("630");
    expect(find("name", "twitter:card")?.content).toBe("summary_large_image");
    expect(find("name", "robots")).toBeUndefined();
  });

  it("has one JSON-LD graph with the app (free, no ratings), the page, breadcrumbs, the company and the same FAQs", () => {
    const ld = (list.find((m) => "script:ld+json" in m) as Record<string, unknown>)["script:ld+json"] as { "@graph": Record<string, any>[] };
    expect(ld).toEqual(toolJsonLd(TOOL, copy.FAQS));
    const json = JSON.stringify(ld);
    expect(JSON.parse(json)).toBeTruthy();
    expect(json.length).toBeLessThan(8_000);
    expect(json).not.toMatch(/aggregateRating|"review"/);
    const byType = (t: string) => ld["@graph"].find((n) => n["@type"] === t)!;
    expect(byType("WebApplication").offers.price).toBe("0");
    expect(byType("WebPage").dateModified).toBe(TOOL.updated);
    expect(byType("BreadcrumbList").itemListElement).toHaveLength(3);
    expect(byType("Organization").name).toBe("GEO");
    expect(byType("FAQPage").mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text])).toEqual(copy.FAQS.map((f) => [f.q, f.a]));
  });

  it("links its own stylesheet and uses the shared headers", () => {
    expect(route.links()).toHaveLength(1);
    expect(route.headers).toBe(toolHeaders);
  });
});

function renderPage(actionData?: unknown) {
  const Stub = createRoutesStub([
    {
      id: "tools",
      path: "/tools",
      Component: layout.default as ComponentType,
      children: [{ id: "llms", path: "llms-txt-checker", Component: route.default as ComponentType, action: () => null }],
    },
  ]);
  return renderToStaticMarkup(
    createElement(Stub, {
      initialEntries: ["/tools/llms-txt-checker"],
      ...(actionData ? { hydrationData: { loaderData: {}, actionData: { llms: actionData } } } : {}),
    }),
  );
}

describe("the page (server render, no JavaScript)", () => {
  const out = renderPage();
  const plain = text(out);

  it("has one H1 with the search term, the intro, the form and the trust line", () => {
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).toContain('<h1 class="ck-h1">llms.txt Checker</h1>');
    expect(plain).toContain(copy.INTRO);
    expect(plain.match(/The llms.txt Checker is a free tool/g)).toHaveLength(1);
    expect(out).toMatch(/<form[^>]*method="post"[^>]*class="tl-form"/);
    expect(out).toContain('name="url"');
    expect(out).toContain('inputMode="url"');
    expect(out).toContain('name="website"'); // the honeypot
    expect(plain).toContain("Check llms.txt");
    expect(plain).toContain("Free · No sign-up · Results in seconds");
  });

  it("shows this site's own llms.txt as the labelled example, with all checks passing", () => {
    expect(out).toMatch(/<span class="ck-chip is-grey">Example<\/span><span>The llms.txt on this site, usegeo.app. Edit it to test your own.<\/span>/);
    expect(plain).toContain("> GEO is a Shopify app that helps stores");
    expect(out).toContain('name="text"');
    expect(out).toContain('value="paste"');
    expect(plain).toContain("Or paste an llms.txt to check it");
    expect(plain).toContain("Your llms.txt follows the format");
    for (const p of Object.values(copy.PASSED_COPY)) expect(plain).toContain(p);
    expect(plain).not.toContain(copy.TONE_LABEL.problem);
    expect(plain).toContain(copy.GENERATOR.paste);
  });

  it("has the evidence box, then exactly one button under the result, with the spec's words and link", () => {
    expect(plain).toContain("Before you spend time on it");
    expect(plain).toContain(copy.EVIDENCE.text);
    expect(out).toContain('<a href="/tools/ai-crawler-checker">AI Crawler Checker</a> · <a href="/tools/product-schema-checker">Product Schema Checker</a>');
    expect(out.match(/tl-cta"/g)).toHaveLength(1);
    expect(out).toMatch(/<a class="ck-btn ck-btn-dark tl-cta" href="\/\?ref=tool-llms-txt-checker#how">See what actually gets AI to recommend you/);
    expect(out.indexOf('id="result"')).toBeLessThan(out.indexOf("Before you spend time on it"));
    expect(out.indexOf("Before you spend time on it")).toBeLessThan(out.indexOf("tl-cta-card"));
    expect(out.indexOf("tl-cta-card")).toBeLessThan(out.indexOf('id="what-it-checks"'));
  });

  it("has what it checks, how it works, visible FAQs, more tools, the date and the footer", () => {
    expect(plain).toContain("What this tool checks");
    for (const item of copy.WHAT_IT_CHECKS) expect(plain).toContain(item);
    expect(plain).toContain("How this tool works");
    for (const item of copy.HOW_IT_WORKS) expect(plain).toContain(item);
    expect(out).toContain('href="https://llmstxt.org/"');
    for (const f of copy.FAQS) {
      expect(out).toContain(`<h3 class="ck-h3">${f.q.replace(/'/g, "&#x27;")}</h3>`);
      expect(plain).toContain(f.a);
    }
    expect(out).not.toMatch(/<details|\shidden[\s>=]/);
    for (const s of TOOL.related) expect(out).toContain(`<a href="${toolBySlug(s).path}">${toolBySlug(s).name}</a>`);
    expect(plain).toContain("Updated 11 October 2026 · Made by GEO");
    expect(out).toContain('class="tl-foot"');
    expect(out).toContain('href="/tools"');
    for (const t of TOOLS) expect(out).toContain(`href="${t.path}"`);
  });

  it("shows a no-JavaScript paste result in place of the example", () => {
    const page = text(renderPage({ ok: true, intent: "paste", text: "# Cedar\n\n## Pages\n\n- no link here" }));
    expect(page).not.toContain("The llms.txt on this site, usegeo.app");
    expect(page).toContain("Your llms.txt has 1 problem");
    expect(page).toContain("Line 5 is a list item without a link.");
    expect(page).toContain("- no link here");
    expect(page).toContain("Add a one-line summary starting with > under the title.");
  });

  it("shows a site result: verdict, files, checks, the Shopify box and the starter file with its Shopify version", async () => {
    clearLlmsCache();
    const file = fixture("shopify-default");
    fakeSite({ llms: ok("https://cedar.example/llms.txt", file), agents: ok("https://cedar.example/agents.md", file), home: ok(HOME_URL, HOME, true) });
    const res = await checkLlmsSite(cedar);
    const html = renderPage({ ok: true, intent: "fetch", url: "cedar.example", site: res.ok ? res.site : null });
    const page = text(html);
    expect(page).toContain("This is Shopify's automatic llms.txt");
    expect(page).toContain("We checked https://cedar.example/llms.txt");
    expect(page).toContain("Files on your site");
    expect(page).toMatch(/\/llms\.txt\s*Found/);
    expect(page).toMatch(/\/llms-full\.txt\s*Not found/);
    expect(page).toContain(copy.SHOPIFY_BOX.text);
    expect(page).toContain("A starter llms.txt for cedar.example");
    expect(page).toContain("- [Beard oil](https://cedar.example/collections/beard-oil)");
    expect(page).toContain("Shopify version");
    expect(page).toContain("templates/llms.txt.liquid");
    expect(page).toContain("# {{ agents.store_name }}");
    expect(page).toContain(copy.GENERATOR.shopifyNote);
    expect(page).toContain(copy.GENERATOR.shopifySteps);
    expect(page).not.toContain("The llms.txt on this site, usegeo.app");
    expect(page).toContain("Paste an llms.txt");
    expect(page).toContain("Before you spend time on it");
    expect(html.match(/tl-cta"/g)).toHaveLength(1);
    // The fetched file's own words are never shown as page markup.
    expect(html).not.toContain("<script>");
  });

  it("shows errors next to the form, and a site without Shopify gets the plain instructions", () => {
    const bad = renderPage({ ok: false, intent: "fetch", url: "not a site", error: SITE_INPUT_BAD });
    expect(bad).toContain('role="alert"');
    expect(text(bad)).toContain(SITE_INPUT_BAD);
    expect(bad).toContain('value="not a site"');

    const site = {
      host: "plain.example",
      llmsUrl: "https://plain.example/llms.txt",
      files: { llms: "missing", full: "missing", agents: "missing" },
      report: { found: false, shopify: false, checks: [], passed: [], problems: 0, tips: 0 },
      shopify: false,
      starter: "# Plain\n",
      starterNote: "no-links",
    };
    const page = text(renderPage({ ok: true, intent: "fetch", url: "plain.example", site }));
    expect(page).toContain("No llms.txt found. That's fine: it's optional.");
    expect(page).toContain(copy.GENERATOR.noLinks);
    expect(page).toContain("Save it as llms.txt in the top folder of your site, so it opens at https://plain.example/llms.txt.");
    expect(page).not.toContain("Shopify version");
  });

  it("escapes a fetched file's text in excerpts", () => {
    const html = renderPage({ ok: true, intent: "paste", text: '# A\n\n## B\n\n- <script>alert("x")</script>' });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ---------- copy rules ----------

describe("copy rules", () => {
  const files = [
    "app/lib/tools/copy/llms-txt-checker.ts",
    "app/lib/tools/llms.ts",
    "app/lib/tools/llms.server.ts",
    "app/components/tools/llms-result.tsx",
    "app/routes/tools.llms-txt-checker.tsx",
    "app/styles/tool-llms.css",
  ];

  it("has 4 to 6 FAQs", () => {
    expect(copy.FAQS.length).toBeGreaterThanOrEqual(4);
    expect(copy.FAQS.length).toBeLessThanOrEqual(6);
  });

  it("has no em dash, no spaced en dash and no jargon", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/\u2014/);
      expect(src, f).not.toMatch(/\s\u2013\s/);
      // case-sensitive: "llms.txt" is the file's name, " LLM" the jargon
      expect(src, f).not.toMatch(/\bAEO\b| LLMs?\b|[Gg]enerative engine optimi[sz]ation/);
    }
    const shown = text(renderPage());
    expect(shown).not.toMatch(/\u2014|\s\u2013\s/);
    expect(shown).not.toMatch(/\bAEO\b| LLM|generative engine optimization/);
    expect(shown.match(/\bGEO\b/g)?.length).toBeGreaterThan(0);
  });

  it("never says llms.txt gets anyone into AI answers, or that FAQ markup gets rich results", () => {
    const all = JSON.stringify(copy);
    expect(all).not.toMatch(/rich result/i);
    expect(all).not.toMatch(/guarantee/i);
    expect(all).not.toMatch(/(get|gets|help|helps) (you )?(ranked|recommended|cited)/i);
  });
});
