/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON-LD graph */
// The AI Visibility Checker (/tools/ai-visibility-checker): the search landing page for the free product
// check. Its form is the free check's own (a plain post to /check, honeypot included), the sample report is
// for a made-up store and every number on it comes from buildReport, the page head and JSON-LD follow the
// shared rules, and the copy keeps to the house rules and to what the check really does.
// No action and no network here: the form posts to /check, whose action has its own tests.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type MetaDescriptor } from "react-router";
import { buildReport } from "../app/lib/check-report";
import { CHECK_ENGINES, CHECK_RUNS, type CheckReport } from "../app/lib/check-types";
import { ENGINE_LABELS } from "../app/lib/plans";
import { sampleAnswers, sampleProduct, sampleQuestions } from "./fixtures/check-sample";
import * as copy from "../app/lib/tools/copy/ai-visibility-checker";
import { SAMPLE_ANSWERS, SAMPLE_MERCHANT_NAMES, SAMPLE_PRODUCT, SAMPLE_QUESTIONS, SAMPLE_REPORT } from "../app/lib/tools/samples/visibility-sample";
import { VisibilitySample } from "../app/components/tools/visibility-sample";
import { TOOLS, toolBySlug } from "../app/lib/tools/registry";
import { toolJsonLd } from "../app/lib/tools/seo";
import { toolHeaders } from "../app/lib/tools/http";
import * as route from "../app/routes/tools.ai-visibility-checker";
import * as layout from "../app/routes/tools";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const TOOL = toolBySlug("ai-visibility-checker");
const decode = (h: string) =>
  h.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
const text = (h: string) => decode(h.replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ");
const EM_DASH = /\u2014/;
const SPACED_EN_DASH = /\s\u2013\s/;

/** The report the real check would write for the fixture's answers, built here independently of the page's sample module. */
const EXPECTED: CheckReport = buildReport(sampleAnswers, sampleProduct, ["Kōwhai & Co", "Kowhai and Co"], {
  descriptionSource: "shopify",
  pageRead: true,
});

function renderPage() {
  const Stub = createRoutesStub([
    {
      id: "tools",
      path: "/tools",
      Component: layout.default as ComponentType,
      children: [{ id: "visibility", path: "ai-visibility-checker", Component: route.default as ComponentType }],
    },
  ]);
  return renderToStaticMarkup(createElement(Stub, { initialEntries: ["/tools/ai-visibility-checker"] }));
}

const renderCard = (report: CheckReport) =>
  renderToStaticMarkup(createElement(VisibilitySample, { report, product: SAMPLE_PRODUCT, questions: SAMPLE_QUESTIONS }));

// ---------- the sample data ----------

describe("the sample report", () => {
  it("is the made-up check from the test fixture, copied (app code never imports from test/)", () => {
    expect(SAMPLE_PRODUCT).toEqual(sampleProduct);
    expect(SAMPLE_QUESTIONS).toEqual(sampleQuestions);
    expect(SAMPLE_ANSWERS).toEqual(sampleAnswers);
    expect(SAMPLE_MERCHANT_NAMES).toEqual(["Kōwhai & Co", "Kowhai and Co"]);
  });

  it("is what buildReport writes for those answers", () => {
    // Everything but the tips (they are emailed, never shown on a page).
    const noTips = (r: CheckReport) => ({ ...r, tips: [] });
    expect(noTips(SAMPLE_REPORT)).toEqual(noTips(EXPECTED));
    // The numbers the card shows, written out once so a change in the scoring is noticed here.
    expect([SAMPLE_REPORT.namedCount, SAMPLE_REPORT.answerCount, SAMPLE_REPORT.score, SAMPLE_REPORT.label]).toEqual([6, 15, 33, "Growing"]);
    expect(SAMPLE_REPORT.competitors.slice(0, 3).map((c) => [c.name, c.count])).toEqual([
      ["Café Lip Co", 11],
      ["Tūī Botanicals", 10],
      ["Harbour & Fern", 4],
    ]);
    expect(SAMPLE_REPORT.sources.slice(0, 3).map((s) => [s.domain, s.count, s.isOwn])).toEqual([
      ["bestpicks.co.nz", 8, false],
      ["glowjournal.co.nz", 4, false],
      ["kowhaiandco.co.nz", 4, true],
    ]);
  });
});

// ---------- the sample card ----------

describe("the sample card", () => {
  const out = renderCard(SAMPLE_REPORT);
  const plain = text(out);

  it("is labelled as a sample for a made-up store", () => {
    expect(copy.SAMPLE_LABEL).toContain("made-up");
    expect(out).toContain(`<span class="ck-chip is-grey">Example</span><span>${copy.SAMPLE_LABEL}</span>`);
  });

  it("shows the product line, the ring and the heading with buildReport's numbers", () => {
    expect(plain).toContain("Kōwhai & Co");
    expect(plain).toContain("Mānuka Honey Lip Balm 15g");
    expect(plain).toContain("$14.00 NZD");
    const pct = Math.round((EXPECTED.namedCount / EXPECTED.answerCount) * 100);
    expect(pct).toBe(40);
    expect(out).toContain(`aria-label="AI named Kōwhai &amp; Co in ${pct}% of answers (${EXPECTED.namedCount} of ${EXPECTED.answerCount})"`);
    expect(out).toContain(`data-n="${pct}"`);
    expect(out).toContain(`>Named in ${EXPECTED.namedCount} of ${EXPECTED.answerCount} answers</h2>`);
    expect(plain).toContain(`${EXPECTED.label} · score ${EXPECTED.score}/100`);
    expect(plain).toContain(EXPECTED.summary);
  });

  it("has a row per assistant, named or not, from byEngine", () => {
    expect(EXPECTED.byEngine.perplexity.named).toBe(0);
    for (const e of CHECK_ENGINES) {
      const s = EXPECTED.byEngine[e];
      expect(plain).toContain(ENGINE_LABELS[e]);
      expect(plain).toContain(s.named ? `Named in ${s.named} of ${s.total}` : `Not named in any of ${s.total} answers`);
    }
    expect(out).toContain('aria-label="By assistant"');
  });

  it("lists the top 3 brands named instead and the top 3 cited sites, with counts and type chips", () => {
    for (const c of EXPECTED.competitors.slice(0, 3)) expect(plain).toContain(`${c.name} in ${c.count} of ${EXPECTED.answerCount} answers`);
    for (const c of EXPECTED.competitors.slice(3)) expect(plain).not.toContain(c.name);
    const [roundup, mag, own] = EXPECTED.sources;
    expect(plain).toContain(`${roundup.domain} Review site ${roundup.count} answers`);
    expect(plain).toContain(`${mag.domain} Review site ${mag.count} answers`);
    expect(plain).toContain(`${own.domain} Your site ${own.count} answers`);
    for (const s of EXPECTED.sources.slice(3)) expect(plain).not.toContain(s.domain);
  });

  it("shows the 3 questions asked, and never links the made-up sites", () => {
    expect(plain).toContain("The 3 questions we asked");
    for (const q of sampleQuestions) expect(plain).toContain(`“${q.text}”`);
    expect(out).not.toContain("<a ");
    expect(plain).toContain(copy.SAMPLE.more);
  });

  it("says what the ring and the score mean, with buildReport's score, as the real report does", () => {
    expect(EXPECTED.score).not.toBe(Math.round((EXPECTED.namedCount / EXPECTED.answerCount) * 100)); // 33 vs 40: they differ
    expect(plain).toContain(
      `What this means: the ring is the share of answers that named Kōwhai & Co. The score (${EXPECTED.score} out of 100) also counts where it was named`,
    );
    // The points it describes are the scoring code's own (1 in the top 3, 2/3 lower down, 1/3 for a link only).
    const score = read("app/lib/score.ts");
    expect(score).toContain("return a.position !== null && a.position <= 3 ? 1 : 2 / 3;");
    expect(score).toContain("if (a.cited) return 1 / 3;");
    // The ring's and the chip's numbers come before the note that explains them.
    expect(out.indexOf("score 33/100")).toBeLessThan(out.indexOf("What this means:"));
  });

  it("copes with a check where no assistant answered, or none named the brand", () => {
    const none = buildReport([], SAMPLE_PRODUCT, SAMPLE_MERCHANT_NAMES);
    const page = text(renderCard(none));
    expect(page).toContain("Named in 0 of 0 answers");
    expect(page.match(/Didn't answer/g)).toHaveLength(3);
    expect(page).toContain(copy.SAMPLE.noBrands);
    expect(page).toContain(copy.SAMPLE.noSites);
    expect(page).not.toContain("What this means"); // no score to explain

    const unnamed = buildReport(
      SAMPLE_ANSWERS.map((a) => ({ ...a, named: false, position: null, brands: a.brands.filter((b) => !b.startsWith("Kōwhai")) })),
      SAMPLE_PRODUCT,
      SAMPLE_MERCHANT_NAMES,
    );
    expect(unnamed.label).toBe("Not named yet");
    const html = renderCard(unnamed);
    expect(html).toContain("ck-score-ring is-grey");
    expect(text(html)).toContain("Named in 0 of 15 answers");
    expect(text(html)).toContain("Not named in any of 6 answers");
  });
});

// ---------- the page head ----------

const callMeta = () => (route.meta as unknown as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });

describe("the page head", () => {
  const list = callMeta();
  const find = (k: string, v: string) => list.find((m) => (m as Record<string, unknown>)[k] === v) as Record<string, string> | undefined;

  it("has the registry title and description, one canonical, Open Graph and Twitter tags, no robots meta", () => {
    expect(list.filter((m) => "title" in m)).toEqual([{ title: "AI Visibility Checker: Does ChatGPT Recommend You? | GEO" }]);
    expect(TOOL.title.length).toBeLessThan(60);
    expect(find("name", "description")?.content).toBe(TOOL.description);
    expect(TOOL.description).toBe(
      "Free AI visibility checker for Shopify products. See if ChatGPT, Gemini and Perplexity recommend your product and who they pick instead. No sign-up.",
    );
    expect(TOOL.description.length).toBeLessThan(155);
    const canonicals = list.filter((m) => (m as { rel?: string }).rel === "canonical") as { href: string }[];
    expect(canonicals.map((c) => c.href)).toEqual(["https://usegeo.app/tools/ai-visibility-checker"]);
    expect(find("property", "og:url")?.content).toBe("https://usegeo.app/tools/ai-visibility-checker");
    expect(find("property", "og:image")?.content).toBe("https://usegeo.app/og/ai-visibility-checker.png");
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
    expect(byType("WebApplication").name).toBe("AI Visibility Checker");
    expect(byType("WebApplication").offers.price).toBe("0");
    expect(byType("WebPage").dateModified).toBe(TOOL.updated);
    expect(byType("BreadcrumbList").itemListElement).toHaveLength(3);
    expect(byType("Organization").name).toBe("GEO");
    expect(byType("FAQPage").mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text])).toEqual(copy.FAQS.map((f) => [f.q, f.a]));
  });

  it("links its own stylesheet, uses the shared headers, and has no action or loader of its own", () => {
    expect(route.links()).toHaveLength(1);
    expect(route.headers).toBe(toolHeaders);
    expect("action" in route).toBe(false);
    expect("loader" in route).toBe(false);
  });
});

// ---------- the page ----------

describe("the page (server render, no JavaScript)", () => {
  const out = renderPage();
  const plain = text(out);

  it("has one H1 with the search term and the answer-first intro", () => {
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).toContain('<h1 class="ck-h1">AI Visibility Checker</h1>');
    expect(TOOL.h1.toLowerCase()).toContain(TOOL.keyword);
    expect(plain).toContain(copy.INTRO);
    expect(plain.match(/The AI Visibility Checker is a free tool/g)).toHaveLength(1);
  });

  it("has the free check's form in the band: a plain post to /check with the link field and the honeypot", () => {
    expect(out.match(/<form[\s>]/g)).toHaveLength(1);
    expect(out).toMatch(/<form class="ck-form" method="post" action="\/check">/);
    expect(out).toMatch(/<input type="text" name="url"[^>]*required/);
    expect(out).toContain('inputMode="url"');
    expect(out).toMatch(/<input type="text" name="website" tabindex="-1" autoComplete="off"\/>/);
    expect(plain).toContain("Check my product");
    expect(plain).toContain("Free. No sign-up. We ask ChatGPT, Gemini and Perplexity 3 questions, twice each");
    // The form sits in the band, above the result.
    expect(out.indexOf("<form")).toBeLessThan(out.indexOf('class="ck-main"'));
  });

  it("shows the labelled sample report as the result", () => {
    expect(out).toContain('<section class="tl-result" id="result" aria-label="Sample report">');
    expect(plain).toContain(copy.SAMPLE_LABEL);
    expect(plain).toContain(`Named in ${EXPECTED.namedCount} of ${EXPECTED.answerCount} answers`);
    expect(plain).toContain("Café Lip Co");
    expect(plain).toContain("The 3 questions we asked");
  });

  it("has exactly one button under the result, with the spec's words and link", () => {
    expect(out.match(/tl-cta"/g)).toHaveLength(1);
    expect(out).toMatch(/<a class="ck-btn ck-btn-dark tl-cta" href="\/\?ref=tool-ai-visibility-checker#money">See the sales AI sends you/);
    expect(out.indexOf('id="result"')).toBeLessThan(out.indexOf("tl-cta-card"));
    expect(out.indexOf("tl-cta-card")).toBeLessThan(out.indexOf('id="what-it-checks"'));
    // The only other button-styled element is the form's own submit button, in the band.
    expect(out.match(/class="ck-btn /g)).toHaveLength(2);
  });

  it("has what it checks, how it works, visible FAQs, more tools, the date and the footer, in that order", () => {
    for (const item of copy.WHAT_IT_CHECKS) expect(plain).toContain(item);
    for (const item of copy.HOW_IT_WORKS) expect(plain).toContain(item);
    expect(decode(out.replace(/<[^>]+>/g, ""))).toContain("Maintained by GEO. Updated 11 October 2026.");
    for (const f of copy.FAQS) {
      expect(out).toContain(`<h3 class="ck-h3">${f.q.replace(/'/g, "&#x27;")}</h3>`);
      expect(plain).toContain(f.a);
    }
    expect(out).not.toMatch(/<details|\shidden[\s>=]/);
    expect(out).toContain('href="https://arxiv.org/abs/2509.08919"');
    // FAQ 3's "pages that state clear facts" has its own source, from the fact pack (facts-2026.md 5.3).
    const bing = "https://about.ads.microsoft.com/en/blog/post/october-2025/optimizing-your-content-for-inclusion-in-ai-search-answers";
    expect(out).toContain(`href="${bing}"`);
    expect(read("docs/tools/research/facts-2026.md")).toContain(bing);
    expect(copy.FAQS[2].sources?.map((x) => x.url)).toEqual(["https://arxiv.org/abs/2509.08919", bing]);
    expect(out).toContain('href="/privacy"');
    expect(TOOL.related).toHaveLength(3);
    for (const s of TOOL.related) expect(out).toContain(`<a href="${toolBySlug(s).path}">${toolBySlug(s).name}</a>`);
    expect(plain).toContain("Updated 11 October 2026 · Made by GEO");
    expect(out).toContain('class="tl-foot"');
    expect(out).toContain('href="/tools"');
    for (const t of TOOLS) expect(out).toContain(`href="${t.path}"`);
    const order = ['id="what-it-checks"', 'id="how-it-works"', 'id="faq"', 'id="more-tools"', 'class="tl-updated"', 'class="tl-foot"'].map((s) => out.indexOf(s));
    expect(order.every((n) => n > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows the breadcrumb Home > Free tools > AI Visibility Checker", () => {
    expect(out).toMatch(/<nav class="tl-crumbs" aria-label="Breadcrumb">.*<a href="\/">Home<\/a>.*<a href="\/tools">Free tools<\/a>.*<span aria-current="page">AI Visibility Checker<\/span>/);
  });
});

// ---------- copy rules and facts ----------

describe("copy rules", () => {
  const files = [
    "app/lib/tools/copy/ai-visibility-checker.ts",
    "app/lib/tools/samples/visibility-sample.ts",
    "app/components/tools/visibility-sample.tsx",
    "app/routes/tools.ai-visibility-checker.tsx",
    "app/styles/tool-visibility.css",
  ];

  it("has 4 to 6 FAQs", () => {
    expect(copy.FAQS.length).toBeGreaterThanOrEqual(4);
    expect(copy.FAQS.length).toBeLessThanOrEqual(6);
  });

  it("has no em dash, no spaced en dash and no jargon", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(EM_DASH);
      expect(src, f).not.toMatch(SPACED_EN_DASH);
      expect(src, f).not.toMatch(/AEO| LLM|generative engine optimization/i);
    }
    const shown = text(renderPage());
    expect(shown).not.toMatch(EM_DASH);
    expect(shown).not.toMatch(SPACED_EN_DASH);
    expect(shown).not.toMatch(/\bAEO\b| LLM|generative engine optimization/);
    expect(shown.match(/\bGEO\b/g)?.length).toBeGreaterThan(0);
  });

  it("never claims a fix gets anyone recommended, or rich results", () => {
    const all = JSON.stringify(copy);
    expect(all).not.toMatch(/rich result/i);
    expect(all).not.toMatch(/guarantee/i);
  });

  it("promises no more speed than the check's own running page", () => {
    // The running page says "usually 3 to 6 min"; the intro must not promise less (it once said "about 2 minutes").
    expect(read("app/components/check-live.tsx")).toContain("usually 3 to 6 min");
    expect(copy.INTRO).toMatch(/It usually takes a few minutes\.$/);
    // The questions are written for the product (understandProduct), not taken from real searches.
    expect(copy.INTRO).not.toMatch(/real (shopper|buyer) questions/i);
    const shown = text(renderPage());
    expect(shown).not.toMatch(/\b(?:1|2|one|two) minutes?\b|seconds/i);
  });

  it("states only what the free check really does (update the copy if the check changes)", () => {
    // "3 checks per person per day" (FAQ) and the limit in createCheck.
    expect(read("app/lib/check.server.ts")).toMatch(/const PER_IP_PER_DAY = 3;/);
    expect(copy.FAQS.find((f) => f.q === "Is it really free?")?.a).toContain("a limit of 3 checks per person per day");
    // "asked twice", "each question twice", "report both"
    expect(CHECK_RUNS).toBe(2);
    expect([...CHECK_ENGINES]).toEqual(["chatgpt", "gemini", "perplexity"]);
    // Reports are not indexed: the report page sends noindex.
    expect(read("app/routes/check.$id.tsx")).toContain('{ name: "robots", content: "noindex" }');
    // /check points its canonical here (spec decision R1).
    expect(read("app/routes/check._index.tsx")).toContain('abs("/tools/ai-visibility-checker")');
  });
});
