/* eslint-disable @typescript-eslint/no-explicit-any -- reads raw provider JSON and JSON-LD graphs */
// AI Overview Checker (/tools/ai-overview-checker): reading both providers (real responses captured
// through Treg on 11 Oct 2026, in test/fixtures/tools/), matching a visitor's website, the on-load sample,
// the page head and JSON-LD, the server-rendered page, and the action with Treg, costs and the database
// mocked (no network, no paid calls).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type MetaDescriptor } from "react-router";

vi.mock("../app/lib/treg.server", () => ({ tregCall: vi.fn() }));
vi.mock("../app/lib/cost.server", () => ({ recordCost: vi.fn(async () => {}) }));
vi.mock("../app/db.server", () => ({ default: { apiCost: { aggregate: vi.fn(async () => ({ _sum: { usd: 0 } })) } } }));

const { tregCall } = await import("../app/lib/treg.server");
const { recordCost } = await import("../app/lib/cost.server");
const db = (await import("../app/db.server")).default as any;
const aio = await import("../app/lib/tools/aio");
const server = await import("../app/lib/tools/aio.server");
const copy = await import("../app/lib/tools/copy/ai-overview-checker");
const { AIO_SAMPLE } = await import("../app/lib/tools/samples/aio-sample");
const { guessSourceType } = await import("../app/lib/sources");
const { toolBySlug, TOOLS, HUB } = await import("../app/lib/tools/registry");
const { HOUR_COPY, resetToolLimits } = await import("../app/lib/tools/limits.server");
const { CROSS_SITE_COPY, TOO_BIG_COPY } = await import("../app/lib/tools/guard.server");
const { SITE_INPUT_BAD } = await import("../app/lib/tools/site-input");
const { toolHeaders } = await import("../app/lib/tools/http");
const route = await import("../app/routes/tools.ai-overview-checker");
const layout = await import("../app/routes/tools");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const fixture = (name: string) => JSON.parse(read(`test/fixtures/${name}`));
const AIO_RAW = fixture("tools/crawl4ai-serp-aio.json");
const NONE_RAW = fixture("tools/crawl4ai-serp-none.json");
const ANYAPI_RAW = fixture("tools/anyapi-aio-beard-oil.json");
const ANYAPI_AI_MODE = fixture("anyapi-aio.json");

const tool = toolBySlug("ai-overview-checker");
const EM_DASH = /\u2014/;
const SPACED_EN_DASH = /\s\u2013\s/;
const mockedTreg = vi.mocked(tregCall);
const mockedCost = vi.mocked(recordCost);
const text = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
const htmlText = (s: string) => s.replace(/&/g, "&amp;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");

beforeEach(() => {
  resetToolLimits();
  server.resetAio();
  mockedTreg.mockReset();
  mockedCost.mockClear();
  db.apiCost.aggregate.mockReset();
  db.apiCost.aggregate.mockResolvedValue({ _sum: { usd: 0 } });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GEO_TOOLS_USD_PER_DAY;
});

// ---------- reading the providers ----------

describe("parseCrawl4ai", () => {
  it("reads the real results page captured for 'best sunscreen for oily skin'", () => {
    const r = aio.parseCrawl4ai(AIO_RAW, "best sunscreen for oily skin", "2026-10-11")!;
    expect(r.shown).toBe(true);
    expect(r.provider).toBe("crawl4ai");
    expect(r.textCut).toBe(true);
    expect(r.sources).toHaveLength(5);
    expect(r.organic).toHaveLength(10);
    expect(r.peopleAlsoAsk).toHaveLength(4);
    expect(r.text.length).toBeLessThanOrEqual(aio.CUT_TEXT_MAX);
    expect(r.text.endsWith("…")).toBe(true);
    expect(r.text).not.toContain("Show more");
    expect(r.organic.map((o) => o.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r.organic[1].domain).toBe("reddit.com"); // www. dropped
    // the trailing site name after a spaced em dash is dropped from titles
    expect(r.sources[3].title).toBe("17 Best Sunscreens for Oily Skin that Don't Feel Greasy (Tested and Reviewed for 2023)");
    for (const s of r.sources) expect(s.type).toBe(guessSourceType(s.url, s.domain));
  });

  it("matches the on-load sample, apart from the two documented edits", () => {
    const r = aio.parseCrawl4ai(AIO_RAW, AIO_SAMPLE.query, AIO_SAMPLE.checkedAt)!;
    const noQuery = (u: string) => u.split("?")[0];
    expect({ ...AIO_SAMPLE, text: "", sources: [] }).toEqual({ ...r, text: "", sources: [] });
    // edit 1: the text is the first sentence of what Google showed, word for word
    expect(r.text.startsWith(AIO_SAMPLE.text)).toBe(true);
    expect(AIO_SAMPLE.text.endsWith(".")).toBe(true);
    expect(AIO_SAMPLE.text.split(". ")).toHaveLength(1);
    // edit 2: Walmart and Target lose their tracking parameters; everything else is exact
    expect(AIO_SAMPLE.sources.map((s) => ({ ...s, url: noQuery(s.url) }))).toEqual(r.sources.map((s) => ({ ...s, url: noQuery(s.url) })));
    expect(AIO_SAMPLE.sources.filter((s, i) => s.url !== r.sources[i].url).map((s) => s.domain)).toEqual(["walmart.com", "target.com"]);
  });

  it("reads a real page with no AI Overview (the field is left out)", () => {
    const r = aio.parseCrawl4ai(NONE_RAW, "youtube", "2026-10-11")!;
    expect(r).toMatchObject({ shown: false, text: "", textCut: false, sources: [], peopleAlsoAsk: [] });
    expect(r.organic).toHaveLength(10);
  });

  it("treats a null, empty or unlisted overview as no overview, without crashing (made-up variants)", () => {
    const results = [{ position: 1, url: "https://a.example/", title: "A" }];
    const base = { blocks: ["organic"], results };
    expect(aio.parseCrawl4ai({ ...base, ai_overview: null }, "q", "d")?.shown).toBe(false);
    expect(aio.parseCrawl4ai({ blocks: ["ai_overview"], ai_overview: null, results }, "q", "d")?.shown).toBe(false);
    expect(aio.parseCrawl4ai({ blocks: ["ai_overview"], ai_overview: { text: "   ", sources: [] }, results }, "q", "d")?.shown).toBe(false);
    expect(aio.parseCrawl4ai({ blocks: ["ai_overview"], ai_overview: { text: "Show more" }, results }, "q", "d")?.shown).toBe(false);
    expect(aio.parseCrawl4ai({ blocks: ["organic"], ai_overview: { text: "Not listed in blocks" }, results }, "q", "d")?.shown).toBe(false);
    expect(aio.parseCrawl4ai({ blocks: ["ai_overview"], ai_overview: "junk", results, people_also_ask: 7 }, "q", "d")?.shown).toBe(false);
  });

  it("says a page with no overview and no normal results isn't usable, unless Google matched nothing (made-up variants)", () => {
    // Treg catalog: empty results carry empty_reason, "rescue_no_results" when Crawl4AI couldn't get the page
    expect(aio.parseCrawl4ai({ blocks: [], results: [], empty_reason: "rescue_no_results" }, "q", "d")).toBeNull();
    expect(aio.parseCrawl4ai({ blocks: ["organic"], results: [], pages: { asked: 1, got: 0, missing: [1] } }, "q", "d")).toBeNull();
    expect(aio.parseCrawl4ai({ blocks: ["ai_overview"], ai_overview: null, results: "junk" }, "q", "d")).toBeNull();
    expect(aio.parseCrawl4ai({ blocks: [], results: [], empty_reason: "google_no_results" }, "q", "d")).toMatchObject({ shown: false, organic: [] });
    // an overview with no normal results is still a real answer
    expect(aio.parseCrawl4ai({ blocks: ["ai_overview"], ai_overview: { text: "An answer." }, results: [] }, "q", "d")?.shown).toBe(true);
  });

  it("says it isn't a results page when there's no blocks list (then the backup provider is asked)", () => {
    expect(aio.parseCrawl4ai({}, "q", "d")).toBeNull();
    expect(aio.parseCrawl4ai(null, "q", "d")).toBeNull();
    expect(aio.parseCrawl4ai("<html>", "q", "d")).toBeNull();
    expect(aio.parseCrawl4ai({ error: "busy" }, "q", "d")).toBeNull();
  });

  it("keeps only http(s) links, so a link out can never run script", () => {
    const r = aio.parseCrawl4ai(
      {
        blocks: ["ai_overview"],
        ai_overview: {
          text: "An answer.",
          sources: [{ url: "javascript:alert(1)", title: "x" }, { url: "data:text/html,hi" }, { url: "not a url" }, { url: "https://ok.example/a", title: "" }],
        },
        results: [
          { url: "javascript:alert(1)", position: 1 },
          { url: "https://b.example/", position: "2" },
          { url: "https://c.example/", position: 0 },
          { url: "https://d.example/", position: 1e308 },
          { url: "https://e.example/", position: 1.5 },
        ],
      },
      "q",
      "d",
    )!;
    expect(r.sources).toEqual([{ url: "https://ok.example/a", title: "ok.example", domain: "ok.example", type: null }]);
    expect(r.organic.map((o) => o.domain)).toEqual(["b.example"]);
  });

  it("keeps every cited link, even two from the same site", () => {
    const r = aio.parseCrawl4ai({ blocks: ["ai_overview"], ai_overview: { text: "A.", sources: [{ url: "https://a.com/1" }, { url: "https://www.a.com/2" }] } }, "q", "d")!;
    expect(r.sources.map((s) => s.domain)).toEqual(["a.com", "a.com"]);
    expect(aio.matchDomain(r, "a.com").cited).toEqual([1, 2]);
  });
});

describe("parseAnyApi", () => {
  it("counts an answer starting 'AI Mode replied' as not shown", () => {
    const r = aio.parseAnyApi(ANYAPI_AI_MODE, "q", "2026-10-11")!;
    expect(r).toMatchObject({ shown: false, aiMode: true, text: "", sources: [], provider: "anyapi" });
  });

  it("spots AI Mode in the Markdown answer too (made-up variant)", () => {
    const raw = { output: { found: true, data: { answerMarkdown: "\\### AI Mode replied: Photosynthesis is ...", citations: [] } } };
    expect(aio.parseAnyApi(raw, "q", "d")?.aiMode).toBe(true);
  });

  it("reads the real backup answer captured for 'beard oil for dry skin' as plain text", () => {
    const r = aio.parseAnyApi(ANYAPI_RAW, "beard oil for dry skin", "2026-10-11")!;
    expect(r.shown).toBe(true);
    expect(r.aiMode).toBeUndefined();
    expect(r.text.startsWith("Beard oil is designed to treat dry, itchy skin")).toBe(true);
    expect(r.text).not.toContain("Share public link");
    expect(r.text).not.toContain("**");
    expect(r.text.length).toBeLessThanOrEqual(aio.FULL_TEXT_MAX);
    expect(r.textCut).toBe(true);
    expect(r.sources.map((s) => s.domain)).toEqual(["badassbeardcare.com", "gq.com", "livebearded.com", "youtube.com", "reddit.com"]);
    expect(r.organic).toEqual([]);
    expect(r.peopleAlsoAsk).toEqual([]);
  });

  it("drops a trailing 'Share public link' from a short answer, and keeps it whole", () => {
    const raw = { output: { found: true, data: { answer: "Short answer.\n\nShare public link", citations: [] } } };
    expect(aio.parseAnyApi(raw, "q", "d")).toMatchObject({ shown: true, text: "Short answer.", textCut: false });
    const md = { output: { found: true, data: { answerMarkdown: "## Pick **one**\n\n- [Allure](https://allure.com/x) says so\n\n### Share public link" } } };
    expect(aio.parseAnyApi(md, "q", "d")?.text).toBe("Pick one\n\nAllure says so");
  });

  it("reads found:false as no overview, and a response without output as not an answer", () => {
    expect(aio.parseAnyApi({ output: { found: false } }, "q", "d")).toMatchObject({ shown: false, text: "" });
    expect(aio.parseAnyApi({ output: { found: false } }, "q", "d")?.aiMode).toBeUndefined();
    expect(aio.parseAnyApi({ error: "x" }, "q", "d")).toBeNull();
    expect(aio.parseAnyApi(null, "q", "d")).toBeNull();
  });
});

// ---------- the search, the website, the lines ----------

describe("normalizeQuery and checkQuery", () => {
  it("normalises case, spaces and trailing punctuation for the cache key", () => {
    expect(aio.normalizeQuery("  Best   Beard Oil?? ")).toBe("best beard oil");
    expect(aio.normalizeQuery("beard oil!.")).toBe("beard oil");
    expect(aio.normalizeQuery("Café latte")).toBe(aio.normalizeQuery("Café latte"));
  });

  it("accepts 2 to 200 characters, tidies spaces and keeps case", () => {
    expect(aio.checkQuery("  Beard \n oil\t ")).toEqual({ ok: true, query: "Beard oil" });
    expect(aio.checkQuery("")).toEqual({ ok: false, error: copy.QUERY_SHORT });
    expect(aio.checkQuery("a")).toEqual({ ok: false, error: copy.QUERY_SHORT });
    expect(aio.checkQuery(undefined)).toEqual({ ok: false, error: copy.QUERY_SHORT });
    expect(aio.checkQuery("x".repeat(200))).toMatchObject({ ok: true });
    expect(aio.checkQuery("x".repeat(201))).toEqual({ ok: false, error: copy.QUERY_LONG });
    expect(aio.checkQuery("x".repeat(100_000))).toEqual({ ok: false, error: copy.QUERY_LONG });
    expect(aio.checkQuery("https://yourstore.com/products/a")).toMatchObject({ ok: true }); // a link is a valid search
  });

  it("refuses a search with no letter or number, so junk never costs a paid search", () => {
    expect(aio.checkQuery("??")).toEqual({ ok: false, error: copy.QUERY_SHORT });
    expect(aio.checkQuery("...  !!")).toEqual({ ok: false, error: copy.QUERY_SHORT });
    expect(aio.checkQuery("\u200b\u200b\u200b")).toEqual({ ok: false, error: copy.QUERY_SHORT });
    expect(aio.checkQuery("beard\u200b oil")).toEqual({ ok: true, query: "beard oil" });
    expect(aio.checkQuery("crème de jour")).toEqual({ ok: true, query: "crème de jour" });
    expect(aio.checkQuery("美容液")).toMatchObject({ ok: true });
    expect(aio.checkQuery("4k")).toMatchObject({ ok: true });
  });

  it("drops a trailing site name after a spaced long or mid dash from page titles, and nothing shorter", () => {
    expect(aio.cleanTitle("Best Beard Oils of 2026 \u2014 Beard Guru")).toBe("Best Beard Oils of 2026");
    expect(aio.cleanTitle("Best Beard Oils of 2026 \u2013 Beard Guru")).toBe("Best Beard Oils of 2026");
    expect(aio.cleanTitle("Short \u2014 Site")).toBe("Short \u2014 Site");
    expect(aio.cleanTitle("x".repeat(500))).toHaveLength(200);
  });
});

describe("matchDomain", () => {
  it("counts www and subdomains as the same site, and not look-alikes", () => {
    expect(aio.sameSite("www.allure.com", "allure.com")).toBe(true);
    expect(aio.sameSite("shop.allure.com", "allure.com")).toBe(true);
    expect(aio.sameSite("allure.com", "shop.allure.com")).toBe(true);
    expect(aio.sameSite("notallure.com", "allure.com")).toBe(false);
    expect(aio.sameSite("allure.com.evil.example", "allure.com")).toBe(false);
    expect(aio.sameSite("allure.com", "")).toBe(false);
    expect(aio.sameSite("com", "com")).toBe(false);
  });

  it("finds where a site is cited and where it ranks", () => {
    expect(aio.matchDomain(AIO_SAMPLE, "www.allure.com")).toEqual({ host: "allure.com", cited: [3], rank: null });
    expect(aio.matchDomain(AIO_SAMPLE, "charlottaeve.com")).toEqual({ host: "charlottaeve.com", cited: [5], rank: 4 });
    expect(aio.matchDomain(AIO_SAMPLE, "reddit.com")).toEqual({ host: "reddit.com", cited: [], rank: 2 });
    expect(aio.matchDomain(AIO_SAMPLE, "notallure.com")).toEqual({ host: "notallure.com", cited: [], rank: null });
  });

  it("writes the 'Your site' line for every case", () => {
    const line = (r: any, host: string) => aio.yourSiteLine(r, aio.matchDomain(r, host));
    expect(line(AIO_SAMPLE, "allure.com")).toBe("Your site is cited: source 3 of 5.");
    expect(line(AIO_SAMPLE, "realskindiaries.com")).toBe("Your site isn't cited, but it ranks #1 in the normal results below.");
    expect(line(AIO_SAMPLE, "yourstore.com")).toBe("Your site isn't cited and isn't in the top 10 normal results.");
    const none = aio.parseCrawl4ai(NONE_RAW, "youtube", "d")!;
    expect(line(none, "youtube.com")).toBe("No AI Overview here. Your site ranks #1 in the normal results.");
    expect(line(none, "yourstore.com")).toBe("No AI Overview here. Your site isn't in the top 10 normal results.");
    const backup = aio.parseAnyApi(ANYAPI_RAW, "q", "d")!;
    expect(line(backup, "gq.com")).toBe("Your site is cited: source 2 of 5.");
    expect(line(backup, "yourstore.com")).toBe("Your site isn't cited in this overview.");
    expect(line(aio.parseAnyApi({ output: { found: false } }, "q", "d"), "yourstore.com")).toBeNull();
  });

  it("tags cited sites that also rank, and normal results that are cited", () => {
    expect(aio.bestRank(AIO_SAMPLE, "charlottaeve.com")).toBe(4);
    expect(aio.bestRank(AIO_SAMPLE, "allure.com")).toBeNull();
    expect(aio.isCited(AIO_SAMPLE, "charlottaeve.com")).toBe(true);
    expect(aio.isCited(AIO_SAMPLE, "reddit.com")).toBe(false);
  });
});

describe("meaningLines", () => {
  it("picks lines from the cited types, then the tracking tip, with no numbers", () => {
    expect(aio.meaningLines(AIO_SAMPLE)).toEqual([copy.MEANING.editorial, copy.MEANING.retailer, copy.MEANING.track]);
    expect(aio.meaningLines(aio.parseAnyApi(ANYAPI_RAW, "q", "d")!)).toEqual([copy.MEANING.editorial, copy.MEANING.ugc, copy.MEANING.track]);
    expect(aio.meaningLines(aio.parseCrawl4ai(NONE_RAW, "q", "d")!)).toEqual([copy.MEANING.track]);
    for (const line of Object.values(copy.MEANING)) expect(line).not.toMatch(/\d/);
  });

  it("never shows more than four lines", () => {
    const types = ["editorial", "retailer", "ugc", "brand"] as const;
    const r = { ...AIO_SAMPLE, sources: types.map((type) => ({ url: `https://${type}.example/`, title: type, domain: `${type}.example`, type })) };
    expect(aio.meaningLines(r)).toHaveLength(4);
  });
});

// ---------- copy ----------

describe("copy module", () => {
  const files = [
    "app/lib/tools/copy/ai-overview-checker.ts",
    "app/lib/tools/samples/aio-sample.ts",
    "app/components/tools/aio-result.tsx",
    "app/routes/tools.ai-overview-checker.tsx",
  ];

  it("has 4 to 6 FAQs, each with a source", () => {
    expect(copy.FAQS.length).toBeGreaterThanOrEqual(4);
    expect(copy.FAQS.length).toBeLessThanOrEqual(6);
    for (const f of copy.FAQS) expect(f.sources?.length).toBeGreaterThan(0);
  });

  it("has no em dash or spaced en dash, in the copy or the sample", () => {
    for (const f of files) {
      expect(read(f), f).not.toMatch(EM_DASH);
      expect(read(f), f).not.toMatch(SPACED_EN_DASH);
    }
    expect(JSON.stringify(AIO_SAMPLE)).not.toMatch(EM_DASH);
    expect(JSON.stringify(AIO_SAMPLE)).not.toMatch(SPACED_EN_DASH);
  });

  it("uses no jargon in visible copy", () => {
    const all = JSON.stringify(copy);
    expect(all).not.toContain("AEO");
    expect(all).not.toContain(" LLM");
    expect(all).not.toMatch(/generative engine optimization/i);
    expect(all).not.toMatch(/\bGEO\b(?! gets you)/); // GEO only as the brand, in the button
    expect(all).not.toMatch(/rich result/i);
  });

  it("uses the spec's exact intro, button and example searches", () => {
    expect(copy.INTRO.startsWith("The AI Overview Checker is a free tool that")).toBe(true);
    expect(copy.CTA).toEqual({ text: "See how GEO gets you into AI answers", href: "/?ref=tool-ai-overview-checker#how" });
    expect(copy.EXAMPLES[0]).toBe(AIO_SAMPLE.query);
    expect(copy.WHAT_IT_CHECKS.length).toBeGreaterThanOrEqual(3);
    expect(copy.WHAT_IT_CHECKS.length).toBeLessThanOrEqual(5);
  });
});

// ---------- head and JSON-LD ----------

const metaList = () => (route.meta as unknown as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });

describe("meta", () => {
  it("sets the registry title and description, one canonical and the share tags", () => {
    const list = metaList();
    const titles = list.filter((m) => "title" in m) as { title: string }[];
    expect(titles).toEqual([{ title: tool.title }]);
    expect(tool.title.length).toBeLessThan(60);
    const prop = (p: string) => (list.find((m) => (m as any).property === p) as any)?.content;
    const name = (n: string) => (list.find((m) => (m as any).name === n) as any)?.content;
    expect(name("description")).toBe(tool.description);
    expect(tool.description.length).toBeLessThan(155);
    const canonicals = list.filter((m) => (m as any).tagName === "link" && (m as any).rel === "canonical") as any[];
    expect(canonicals.map((c) => c.href)).toEqual(["https://usegeo.app/tools/ai-overview-checker"]);
    expect(prop("og:url")).toBe("https://usegeo.app/tools/ai-overview-checker");
    expect(prop("og:image")).toBe("https://usegeo.app/og/ai-overview-checker.png");
    expect(prop("og:image:width")).toBe("1200");
    expect(prop("og:image:height")).toBe("630");
    expect(name("twitter:card")).toBe("summary_large_image");
    expect(list.some((m) => (m as any).name === "robots")).toBe(false);
    expect(JSON.stringify(list)).not.toMatch(/nosnippet|max-snippet/);
  });

  it("has one JSON-LD graph with the tool, page, breadcrumb, company and the page's FAQ word for word", () => {
    const ld = (metaList().find((m) => "script:ld+json" in m) as any)["script:ld+json"];
    const json = JSON.stringify(ld);
    expect(json.length).toBeLessThan(8_192);
    expect(json).not.toMatch(/aggregateRating|"review"/);
    const graph = JSON.parse(json)["@graph"] as any[];
    const of = (t: string) => graph.find((n) => n["@type"] === t);
    expect(of("WebApplication")).toMatchObject({ name: "AI Overview Checker", offers: { price: "0", priceCurrency: "USD" }, isAccessibleForFree: true });
    expect(of("WebPage").dateModified).toBe(tool.updated);
    expect(of("BreadcrumbList").itemListElement).toHaveLength(3);
    expect(of("Organization").name).toBe("GEO");
    expect(of("FAQPage").mainEntity.map((q: any) => ({ q: q.name, a: q.acceptedAnswer.text }))).toEqual(copy.FAQS.map((f) => ({ q: f.q, a: f.a })));
  });
});

// ---------- the page ----------

function renderPage(actionData?: unknown) {
  const Stub = createRoutesStub([
    {
      id: "tools",
      path: "/tools",
      Component: layout.default as ComponentType,
      children: [{ id: "aio", path: "ai-overview-checker", Component: route.default as ComponentType, action: () => null }],
    },
  ]);
  return renderToStaticMarkup(
    createElement(Stub, {
      initialEntries: ["/tools/ai-overview-checker"],
      hydrationData: { loaderData: {}, ...(actionData ? { actionData: { aio: actionData } } : {}) },
    }),
  );
}

describe("the page (server-rendered, no JavaScript)", () => {
  it("has the H1, the intro, the form and the labelled sample", () => {
    const out = renderPage();
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).toMatch(/<h1 class="ck-h1">AI Overview Checker<\/h1>/);
    expect(out).toContain(htmlText(copy.INTRO));
    expect(out).toContain("Free · No sign-up · Usually under 15 seconds");
    // a real POST form with the spam trap, a required search box and example buttons that skip the check
    expect(out).toMatch(/<form[^>]*method="post"/);
    expect(out).toContain('name="website"');
    expect(out.match(/name="website"/g)).toHaveLength(1);
    expect(out).toMatch(/<input[^>]*name="q"[^>]*required/);
    expect(out).toMatch(/<input[^>]*name="domain"[^>]*inputMode="url"/);
    expect(out.match(/name="example"/g)).toHaveLength(3);
    expect(out.match(/formnovalidate=""/gi)).toHaveLength(3);
    expect(out).toContain(">Check Google</button>");
    // the sample, with its label and date
    expect(text(out)).toContain("Example result: “best sunscreen for oily skin”, Google US, checked 11 October 2026");
    expect(text(out)).toContain("Google showed an AI Overview for this search");
    expect(out).toContain("Start of the overview");
    expect(out).toContain("Sites the overview cites");
    expect(out).toContain(htmlText(AIO_SAMPLE.text));
    expect(text(out)).toContain("As Google shows it before “Show more”.");
    expect(out).toContain("Normal results (top 10)");
    expect(out).toContain("People also ask");
    expect(out).toContain('href="/tools/faq-schema-generator"');
    expect(out).toContain('rel="nofollow noopener noreferrer"');
    expect(out).toContain(htmlText(copy.SMALL_PRINT));
    expect(out).not.toContain("Your site:");
  });

  it("has exactly one button under the result, with the spec's words and link", () => {
    const out = renderPage();
    const ctas = out.match(/<a class="ck-btn ck-btn-dark tl-cta"[^>]*>/g) ?? [];
    expect(ctas).toHaveLength(1);
    expect(ctas[0]).toContain('href="/?ref=tool-ai-overview-checker#how"');
    expect(out).toContain("See how GEO gets you into AI answers");
    expect(out.indexOf("tl-cta")).toBeGreaterThan(out.indexOf("Sites the overview cites"));
    expect(out.indexOf("tl-cta")).toBeLessThan(out.indexOf("What this tool checks"));
  });

  it("shows what it checks, how it works, every FAQ visibly, related tools, the updated line and the footer", () => {
    const out = renderPage();
    expect(out).toContain("What this tool checks");
    for (const item of copy.WHAT_IT_CHECKS) expect(out).toContain(htmlText(item));
    expect(out).toContain("How this tool works");
    for (const f of copy.FAQS) {
      expect(out).toContain(`<h3 class="ck-h3">${htmlText(f.q)}</h3>`);
      expect(out).toContain(`<p>${htmlText(f.a)}</p>`);
    }
    expect(out).not.toMatch(/<details|\shidden[\s=>]/);
    const related = out.slice(out.indexOf('id="more-tools"'));
    for (const s of tool.related) expect(related).toContain(`href="${toolBySlug(s).path}"`);
    expect(text(out)).toContain("Updated 11 October 2026 · Made by GEO");
    const foot = out.slice(out.indexOf('class="tl-foot"'));
    for (const t of TOOLS) expect(foot).toContain(`href="${t.path}"`);
    expect(foot).toContain(`href="${HUB.path}"`);
  });

  it("shows a visitor's own result after a no-JavaScript POST, with their site and inputs", () => {
    const result = { ...AIO_SAMPLE, checkedAt: "2026-10-12T09:00:00.000Z" };
    const out = renderPage({ ok: true, result, match: aio.matchDomain(result, "allure.com"), domainError: null, query: result.query, domain: "allure.com" });
    expect(text(out)).toContain("Your search: “best sunscreen for oily skin”, Google US, checked 12 October 2026");
    expect(text(out)).not.toContain("Example result");
    expect(text(out)).toContain("Your site is cited: source 3 of 5.");
    expect(out).toMatch(/<input[^>]*name="domain"[^>]*value="allure.com"/);
    expect(out.match(/tl-cta"/g)).toHaveLength(1);
  });

  it("shows a friendly error above the sample when the search fails", () => {
    const out = renderPage({ ok: false, error: copy.FAIL_COPY, query: "beard oil", domain: "" });
    expect(out).toContain('role="alert"');
    expect(out).toContain(htmlText(copy.FAIL_COPY));
    expect(text(out)).toContain("Example result");
    expect(out).toMatch(/<input[^>]*name="q"[^>]*value="beard oil"/);
    // after a JavaScript run, focus goes to the first focus target in the result: the error, not the example's heading
    const result = out.slice(out.indexOf('class="tl-result"'));
    const firstTarget = result.match(/<[^>]*data-tl-focus[^>]*>/)?.[0] ?? "";
    expect(firstTarget).toContain('class="tl-aio-error"');
    expect(firstTarget).toContain('tabindex="-1"');
    expect(result.indexOf("tl-aio-error")).toBeLessThan(result.indexOf("Example result"));
  });

  it("says when the website couldn't be read, and still shows the search", () => {
    const out = renderPage({ ok: true, result: AIO_SAMPLE, match: null, domainError: SITE_INPUT_BAD, query: AIO_SAMPLE.query, domain: "not a site" });
    expect(out).toContain(htmlText(SITE_INPUT_BAD));
    expect(out).toContain("Sites the overview cites");
  });

  it("shows no overview plainly, with the normal results", () => {
    const none = aio.parseCrawl4ai(NONE_RAW, "youtube", "2026-10-11")!;
    const out = renderPage({ ok: true, result: none, match: aio.matchDomain(none, "youtube.com"), domainError: null, query: "youtube", domain: "youtube.com" });
    expect(out).toContain("No AI Overview for this search");
    expect(out).not.toContain("Sites the overview cites");
    expect(text(out)).toContain("No AI Overview here. Your site ranks #1 in the normal results.");
    expect(out).toContain("Normal results (top 10)");
  });

  it("says when an overview links no sites, and when the backup got an AI Mode answer", () => {
    const bare = aio.parseCrawl4ai({ blocks: ["ai_overview"], ai_overview: { text: "An answer." } }, "q", "2026-10-11")!;
    expect(text(renderPage({ ok: true, result: bare, match: null, domainError: null, query: "q", domain: "" }))).toContain(copy.OVERVIEW.noSources);
    const mode = aio.parseAnyApi(ANYAPI_AI_MODE, "q", "2026-10-11")!;
    expect(text(renderPage({ ok: true, result: mode, match: null, domainError: null, query: "q", domain: "" }))).toContain(copy.VERDICT.aiMode);
  });
});

// ---------- the action ----------

const IP = "203.0.113.7";
function post(fields: Record<string, string>, headers: Record<string, string> = {}, body?: string) {
  return new Request("https://usegeo.app/tools/ai-overview-checker", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "sec-fetch-site": "same-origin", "x-real-ip": IP, ...headers },
    body: body ?? new URLSearchParams(fields).toString(),
  });
}
async function act(fields: Record<string, string>, headers: Record<string, string> = {}, body?: string) {
  const out = (await route.action({ request: post(fields, headers, body), params: {}, context: {} } as any)) as any;
  return { status: (out.init?.status ?? 200) as number, headers: new Headers(out.init?.headers), body: out.data as any };
}
const crawlOk = (q: string) => ({ ...AIO_RAW, search: { ...AIO_RAW.search, q } });
const endpoints = () => mockedTreg.mock.calls.map((c) => c[0]);

describe("the action", () => {
  it("answers the example search from the cache, with no paid call and no limit used", async () => {
    for (let i = 0; i < 15; i++) {
      const res = await act({ q: "", example: "best sunscreen for oily skin" });
      expect(res.status).toBe(200);
      expect(res.body.result).toEqual(AIO_SAMPLE);
    }
    expect(mockedTreg).not.toHaveBeenCalled();
    expect(db.apiCost.aggregate).not.toHaveBeenCalled();
  });

  it("searches Crawl4AI in the US, records its price once, and caches the answer for repeats", async () => {
    mockedTreg.mockResolvedValueOnce(crawlOk("beard oil"));
    const res = await act({ q: "Beard oil", domain: "https://www.charlottaeve.com/x" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(mockedTreg).toHaveBeenCalledTimes(1);
    expect(mockedTreg).toHaveBeenCalledWith("crawl4ai.google.serp.organic", {
      method: "GET",
      query: { q: "Beard oil", country: "us", language: "en" },
      timeoutMs: 20_000,
      shopId: null,
    });
    expect(mockedCost).toHaveBeenCalledTimes(1);
    expect(mockedCost).toHaveBeenCalledWith(null, "treg", "crawl4ai.google.serp.organic", 0.00015);
    expect(res.body).toMatchObject({ ok: true, query: "Beard oil", domain: "https://www.charlottaeve.com/x", domainError: null });
    expect(res.body.result.provider).toBe("crawl4ai");
    expect(Math.abs(Date.parse(res.body.result.checkedAt) - Date.now())).toBeLessThan(60_000);
    expect(res.body.match).toEqual({ host: "charlottaeve.com", cited: [5], rank: 4 });

    const again = await act({ q: "  beard OIL? " });
    expect(again.body.result).toEqual({ ...res.body.result, query: "beard OIL?" });
    expect(mockedTreg).toHaveBeenCalledTimes(1);
    expect(mockedCost).toHaveBeenCalledTimes(1);
  });

  it("dates a result by when Google showed it, when Crawl4AI answers from its own recent copy", async () => {
    mockedTreg.mockResolvedValueOnce({ ...crawlOk("beard oil"), age_s: 7_200, cached: true });
    const res = await act({ q: "beard oil" });
    expect(Date.now() - Date.parse(res.body.result.checkedAt)).toBeGreaterThanOrEqual(7_200_000 - 5_000);
    expect(Date.now() - Date.parse(res.body.result.checkedAt)).toBeLessThan(7_200_000 + 60_000);
  });

  it("checks the database spend cap over the last 24 hours, for these two endpoints and no shop", async () => {
    mockedTreg.mockResolvedValueOnce(crawlOk("q"));
    await act({ q: "vegan protein powder for women" });
    const where = db.apiCost.aggregate.mock.calls[0][0].where;
    expect(where.shopId).toBeNull();
    expect(where.endpoint).toEqual({ in: ["crawl4ai.google.serp.organic", "anyapi.google.serp.ai_overview"] });
    expect(Date.now() - where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 5_000);
  });

  it("falls back to AnyAPI when Crawl4AI fails, and when it answers without a results page", async () => {
    mockedTreg.mockRejectedValueOnce(new Error("HTTP 503: busy")).mockResolvedValueOnce(ANYAPI_RAW);
    const res = await act({ q: "beard oil for dry skin" });
    expect(res.status).toBe(200);
    expect(endpoints()).toEqual(["crawl4ai.google.serp.organic", "anyapi.google.serp.ai_overview"]);
    expect(mockedTreg.mock.calls[1][1]).toEqual({ body: { prompt: "beard oil for dry skin" }, timeoutMs: 30_000, shopId: null });
    expect(res.body.result.provider).toBe("anyapi");
    expect(mockedCost).not.toHaveBeenCalled(); // tregCall logs AnyAPI's own charge
    expect(JSON.stringify(res.body)).not.toContain("busy");

    mockedTreg.mockReset();
    mockedTreg.mockResolvedValueOnce({ error: "no blocks" }).mockResolvedValueOnce(ANYAPI_AI_MODE);
    const next = await act({ q: "how does photosynthesis work" });
    expect(endpoints()).toEqual(["crawl4ai.google.serp.organic", "anyapi.google.serp.ai_overview"]);
    expect(next.body.result).toMatchObject({ shown: false, aiMode: true });
  });

  it("asks AnyAPI when Crawl4AI couldn't get the page, instead of keeping a false 'No AI Overview' for a day", async () => {
    mockedTreg.mockResolvedValueOnce({ blocks: [], results: [], empty_reason: "rescue_no_results", search: { q: "beard oil" } }).mockResolvedValueOnce(ANYAPI_RAW);
    const res = await act({ q: "beard oil for dry skin" });
    expect(res.status).toBe(200);
    expect(endpoints()).toEqual(["crawl4ai.google.serp.organic", "anyapi.google.serp.ai_overview"]);
    expect(res.body.result).toMatchObject({ provider: "anyapi", shown: true });
    // Crawl4AI answered, so its price still counts toward the spend cap
    expect(mockedCost).toHaveBeenCalledTimes(1);
    expect(mockedCost).toHaveBeenCalledWith(null, "treg", "crawl4ai.google.serp.organic", 0.00015);
  });

  it("shows a cached answer with the visitor's own words", async () => {
    mockedTreg.mockResolvedValueOnce(crawlOk("beard oil"));
    await act({ q: "beard oil" });
    const again = await act({ q: "Beard Oil?" });
    expect(again.body.result.query).toBe("Beard Oil?");
    expect(again.body.result.sources).toEqual(aio.parseCrawl4ai(AIO_RAW, "x", "d")!.sources);
    expect(mockedTreg).toHaveBeenCalledTimes(1);
    expect((await act({ q: "beard oil" })).body.result.query).toBe("beard oil"); // the cached copy keeps its own words
  });

  it("keeps a result for 24 hours from when Google showed it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      mockedTreg.mockResolvedValueOnce({ ...crawlOk("beard oil"), age_s: 20 * 3_600, cached: true });
      await act({ q: "beard oil" });
      vi.setSystemTime(Date.now() + 3 * 3_600_000); // 23 hours after Google showed it: still kept
      await act({ q: "beard oil" });
      expect(mockedTreg).toHaveBeenCalledTimes(1);
      vi.setSystemTime(Date.now() + 2 * 3_600_000); // 25 hours: searched again
      mockedTreg.mockResolvedValueOnce(crawlOk("beard oil"));
      await act({ q: "beard oil" });
      expect(mockedTreg).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("gives friendly 502 copy when both providers fail, and doesn't cache the failure", async () => {
    mockedTreg.mockRejectedValue(new Error("TREG_API_KEY is not set"));
    const res = await act({ q: "beard oil" });
    expect(res.status).toBe(502);
    expect(res.body).toEqual({ ok: false, error: copy.FAIL_COPY, query: "beard oil", domain: "" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(mockedCost).not.toHaveBeenCalled();
    await act({ q: "beard oil" });
    expect(mockedTreg).toHaveBeenCalledTimes(4); // tried again, not served from the cache
  });

  it("refuses the 11th live search in an hour (429), while cached searches still work", async () => {
    mockedTreg.mockImplementation(async (_e, opts: any) => crawlOk(opts.query.q));
    for (let i = 1; i <= 10; i++) expect((await act({ q: `beard oil ${i}` })).status).toBe(200);
    const res = await act({ q: "beard oil 11" });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe(HOUR_COPY);
    expect(mockedTreg).toHaveBeenCalledTimes(10);
    expect((await act({ q: "beard oil 3" })).status).toBe(200); // cached
    expect((await act({ q: "beard oil 12" }, { "x-real-ip": "198.51.100.9" })).status).toBe(200); // another visitor
  });

  it("makes no Treg call when today's spend is at the cap, and reads the cap from GEO_TOOLS_USD_PER_DAY", async () => {
    db.apiCost.aggregate.mockResolvedValue({ _sum: { usd: 2 } });
    const res = await act({ q: "beard oil" });
    expect(res.status).toBe(429);
    expect(res.body.error).toBe(copy.SPEND_COPY);
    expect(mockedTreg).not.toHaveBeenCalled();

    process.env.GEO_TOOLS_USD_PER_DAY = "5";
    mockedTreg.mockResolvedValueOnce(crawlOk("beard oil"));
    expect((await act({ q: "beard oil" })).status).toBe(200);

    process.env.GEO_TOOLS_USD_PER_DAY = "0"; // 0 turns live searches off
    db.apiCost.aggregate.mockResolvedValue({ _sum: { usd: null } });
    expect((await act({ q: "another search" })).body.error).toBe(copy.SPEND_COPY);
  });

  it("refuses when the spend can't be checked, without calling Treg", async () => {
    db.apiCost.aggregate.mockRejectedValue(new Error("db down"));
    const res = await act({ q: "beard oil" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe(copy.FAIL_COPY);
    expect(mockedTreg).not.toHaveBeenCalled();
  });

  it("shares one paid call between two visitors asking the same thing at once", async () => {
    let finish: (v: unknown) => void = () => {};
    mockedTreg.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    const a = act({ q: "beard oil" });
    const b = act({ q: "Beard oil" }, { "x-real-ip": "198.51.100.9" });
    await vi.waitFor(() => expect(mockedTreg).toHaveBeenCalledTimes(1));
    finish(crawlOk("beard oil"));
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);
    expect(mockedTreg).toHaveBeenCalledTimes(1);
    expect(mockedCost).toHaveBeenCalledTimes(1);
  });

  it("stops waiting after a minute with friendly copy, and keeps the late answer for the next try", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      let finish: (v: unknown) => void = () => {};
      mockedTreg.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
      const waiting = act({ q: "beard oil" });
      await vi.waitFor(() => expect(mockedTreg).toHaveBeenCalledTimes(1));
      await vi.advanceTimersByTimeAsync(server.WAIT_MS);
      const res = await waiting;
      expect(res.status).toBe(502);
      expect(res.body.error).toBe(copy.FAIL_COPY);
      finish(crawlOk("beard oil")); // Treg answers late
      await vi.advanceTimersByTimeAsync(0);
      const next = await act({ q: "beard oil" });
      expect(next.status).toBe(200);
      expect(next.body.result.shown).toBe(true);
      expect(mockedTreg).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("refuses other websites (403) and oversized bodies (413)", async () => {
    const cross = await act({ q: "beard oil" }, { "sec-fetch-site": "cross-site" });
    expect(cross.status).toBe(403);
    expect(cross.body.error).toBe(CROSS_SITE_COPY);
    expect(cross.headers.get("X-Robots-Tag")).toBe("noindex");
    const evil = await act({ q: "beard oil" }, { "sec-fetch-site": "", origin: "https://evil.example" });
    expect(evil.status).toBe(403);
    const big = await act({}, {}, `q=${"x".repeat(9_000)}`);
    expect(big.status).toBe(413);
    expect(big.body.error).toBe(TOO_BIG_COPY);
    expect(mockedTreg).not.toHaveBeenCalled();
  });

  it("gives a filled spam trap the normal empty result, with no search", async () => {
    const res = await act({ q: "beard oil", website: "https://spam.example" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, result: null, query: "beard oil", domain: "" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(mockedTreg).not.toHaveBeenCalled();
  });

  it("refuses an empty, junk or too-long search (400) before any limit or call", async () => {
    const empty = await act({ q: " " });
    expect(empty.status).toBe(400);
    expect(empty.body.error).toBe(copy.QUERY_SHORT);
    expect((await act({ q: "?!" })).status).toBe(400);
    const long = await act({ q: "x".repeat(201) });
    expect(long.status).toBe(400);
    expect(long.body.error).toBe(copy.QUERY_LONG);
    expect(long.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(mockedTreg).not.toHaveBeenCalled();
    expect(db.apiCost.aggregate).not.toHaveBeenCalled();
  });

  it("uses the example button's search over the typed one", async () => {
    mockedTreg.mockResolvedValueOnce(crawlOk("vegan protein powder for women"));
    const res = await act({ q: "something typed", example: "vegan protein powder for women" });
    expect(mockedTreg.mock.calls[0][1]).toMatchObject({ query: { q: "vegan protein powder for women" } });
    expect(res.body.query).toBe("vegan protein powder for women");
  });

  it("still searches when the website can't be read, and skips the 'Your site' line", async () => {
    mockedTreg.mockResolvedValueOnce(crawlOk("beard oil"));
    const res = await act({ q: "beard oil", domain: "localhost" });
    expect(res.status).toBe(200);
    expect(res.body.domainError).toBe(SITE_INPUT_BAD);
    expect(res.body.match).toBeNull();
    expect(res.body.result.shown).toBe(true);
  });

  it("sends no-store and noindex through the route's headers function", () => {
    expect(route.headers).toBe(toolHeaders);
    const h = toolHeaders({ actionHeaders: new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }) } as any) as Headers;
    expect(h.get("Cache-Control")).toBe("no-store");
    expect(h.get("X-Robots-Tag")).toBe("noindex");
  });
});
