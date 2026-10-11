/* eslint-disable @typescript-eslint/no-explicit-any -- reads JSON-LD graphs and parsed section schemas */
// The FAQ Schema Generator (/tools/faq-schema-generator): the pure generator (cleaning, checks, JSON-LD with
// safe escaping, the Shopify section and its schema, the product metafield version), the copy rules, the
// page head and JSON-LD, the server-rendered page (works without JavaScript) and the action's guards.
// Nothing here fetches or spends: the tool runs in the browser, and the action only reads the posted rows.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type MetaDescriptor } from "react-router";
import {
  MAX_ROWS,
  buildFaq,
  checkRows,
  cleanRows,
  faqVerdict,
  liquidSafeJson,
  productFaqSection,
  rowsFromForm,
  scriptSafeJson,
  toJsonLd,
  toMetafieldJson,
  toScriptTag,
  toShopifySection,
  type FaqRow,
} from "../app/lib/tools/faq-schema";
import * as copy from "../app/lib/tools/copy/faq-schema-generator";
import { SAMPLE_ROWS } from "../app/lib/tools/samples/faq-sample";
import { TOOLS, toolBySlug } from "../app/lib/tools/registry";
import { toolJsonLd } from "../app/lib/tools/seo";
import { toolHeaders } from "../app/lib/tools/http";
import { CROSS_SITE_COPY } from "../app/lib/tools/guard.server";
import { HOUR_COPY, resetToolLimits } from "../app/lib/tools/limits.server";
import * as route from "../app/routes/tools.faq-schema-generator";
import * as layout from "../app/routes/tools";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const TOOL = toolBySlug("faq-schema-generator");
const decode = (h: string) =>
  h.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
const text = (h: string) => decode(h.replace(/<[^>]+>/g, ""));
const EM_DASH = /\u2014/;
const SPACED_EN_DASH = /\s\u2013\s/;

const TRICKY = "She said \"hi\" \\ back.\nNew line </script><script>alert(1)</script> {% endschema %} {{ shop.name }} 😀 café & 100% cotton";

/** The JSON inside a generated <script type="application/ld+json"> tag. */
const scriptBody = (tag: string) => tag.replace(/^<script type="application\/ld\+json">\n/, "").replace(/\n<\/script>$/, "");
/** The JSON between {% schema %} and {% endschema %} in a section file. */
const schemaOf = (liquid: string) => {
  const m = /\{% schema %\}\n([\s\S]*)\n\{% endschema %\}/.exec(liquid);
  if (!m) throw new Error("no schema tag");
  return m[1];
};

/**
 * Renders the FAQPage script of a generated section the way Liquid would, for the few tags it uses: the
 * for loop over the entries, the "filled in" if, the comma variable and the json filter (JSON.stringify,
 * like Shopify's). Enough to prove the comma logic gives valid JSON whatever rows are empty.
 */
function renderMarkup(liquid: string, entries: { q: string; a: string }[], qExpr: string, aExpr: string): unknown {
  const script = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(liquid)![1];
  const loop = /\{%- for (\w+) in [\w.]+ -%\}([\s\S]*?)\{%- endfor %\}/.exec(script)!;
  const body = loop[2].replace(/\{%- if [^%]+ -%\}/, "").replace(/\{%- endif -%\}/, "");
  let comma = "";
  let items = "";
  for (const e of entries) {
    if (!e.q.trim() || !e.a.trim()) continue;
    items += body
      .replace("{{ geo_qa_comma }}", comma)
      .replace(`{{ ${qExpr} | json }}`, JSON.stringify(e.q))
      .replace(`{{ ${aExpr} | json }}`, JSON.stringify(e.a))
      .replace("{%- assign geo_qa_comma = ',' -%}", "");
    comma = ",";
  }
  const json = script.replace(loop[0], items).replace("{%- assign geo_qa_comma = '' -%}", "");
  return JSON.parse(json);
}

/** Every {% if %}, {% for %} and {% comment %} has its end tag, in order. */
function tagsBalance(liquid: string) {
  const stack: string[] = [];
  for (const m of liquid.matchAll(/\{%-?\s*(\w+)/g)) {
    const tag = m[1];
    if (["if", "for", "unless", "comment", "schema", "stylesheet", "capture"].includes(tag)) stack.push(tag);
    else if (tag.startsWith("end")) {
      if (stack.pop() !== tag.slice(3)) return false;
    }
  }
  return stack.length === 0;
}

// ---------- cleaning and JSON-LD ----------

describe("cleanRows and toJsonLd", () => {
  it("builds one Question per complete row, with the exact text", () => {
    const ld = toJsonLd(SAMPLE_ROWS) as any;
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(3);
    ld.mainEntity.forEach((q: any, i: number) => {
      expect(q["@type"]).toBe("Question");
      expect(q.name).toBe(SAMPLE_ROWS[i].q);
      expect(q.acceptedAnswer).toEqual({ "@type": "Answer", text: SAMPLE_ROWS[i].a });
    });
  });

  it("skips half-filled and empty rows, tidies spaces, keeps line breaks, and stops at 20", () => {
    const rows: FaqRow[] = [
      { q: "  How   long?\n", a: "  Two\r\nmonths.  \n\n\n\nReally.  " },
      { q: "No answer?", a: "   " },
      { q: "", a: "No question." },
      { q: "", a: "" },
    ];
    expect(cleanRows(rows)).toEqual([{ q: "How long?", a: "Two\nmonths.\n\nReally." }]);
    const many = Array.from({ length: 25 }, (_, i) => ({ q: `Q${i}?`, a: `A${i}` }));
    expect(cleanRows(many)).toHaveLength(MAX_ROWS);
    expect(cleanRows([{ q: "x".repeat(400), a: "y".repeat(3000) }])[0]).toEqual({ q: "x".repeat(300), a: "y".repeat(2000) });
    // never half an emoji at the cut
    const emoji = cleanRows([{ q: `${"x".repeat(299)}😀`, a: "a" }])[0].q;
    expect(emoji).toBe("x".repeat(299));
  });

  it("has no code when nothing is complete", () => {
    expect(toScriptTag([{ q: "Only a question?", a: "" }])).toBe("");
    const out = buildFaq([{ q: "", a: "" }]);
    expect(out.verdict).toEqual({ tone: "neutral", count: 0, text: "Add at least one question and answer" });
    expect([out.scriptTag, out.section, out.metafieldJson]).toEqual(["", "", ""]);
  });
});

describe("escaping", () => {
  it("never lets a pasted </script> close the tag, and reads back as the same text", () => {
    const attack = "</script><script>alert(1)</script>";
    const tag = toScriptTag([{ q: "Is it <b>safe</b>?", a: attack }]);
    expect(tag.startsWith('<script type="application/ld+json">\n')).toBe(true);
    expect(tag.endsWith("\n</script>")).toBe(true);
    expect(tag.match(/<\/script/gi)).toHaveLength(1); // only the real closing tag
    expect(tag.match(/<script/gi)).toHaveLength(1);
    const body = scriptBody(tag);
    expect(body).not.toMatch(/[<>&]/);
    expect(body).toContain("\\u003c/script\\u003e");
    const parsed = JSON.parse(body);
    expect(parsed.mainEntity[0].acceptedAnswer.text).toBe(attack);
    expect(parsed.mainEntity[0].name).toBe("Is it <b>safe</b>?");
  });

  it("keeps quotes, backslashes, line breaks, emoji, accents and Liquid as text", () => {
    const tag = toScriptTag([{ q: "Tricky?", a: TRICKY }]);
    const body = scriptBody(tag);
    expect(body).toContain("\\n"); // line breaks stay as \n
    expect(body).toContain("😀 café"); // unicode left as is
    expect(JSON.parse(body).mainEntity[0].acceptedAnswer.text).toBe(TRICKY);
    expect(scriptSafeJson("a\u2028b\u2029c")).toBe('"a\\u2028b\\u2029c"');
  });
});

// ---------- Shopify ----------

describe("toShopifySection", () => {
  const rows: FaqRow[] = [...SAMPLE_ROWS, { q: "Tricky {{ x }} \"one\"?", a: TRICKY }];
  const file = toShopifySection(rows);
  const schema = JSON.parse(schemaOf(file));

  it("has a schema that parses, with the visitor's rows in the preset, word for word", () => {
    expect(schema.name).toBe("FAQ");
    expect(schema.max_blocks).toBe(20);
    expect(schema.settings).toEqual([{ type: "text", id: "heading", label: "Heading", default: "Questions and answers" }]);
    expect(schema.blocks[0].settings.map((s: any) => [s.id, s.type])).toEqual([
      ["question", "text"],
      ["answer", "textarea"],
    ]);
    expect(schema.presets).toHaveLength(1);
    expect(schema.presets[0].name).toBe("FAQ");
    expect(schema.presets[0].blocks.map((b: any) => [b.type, b.settings.question, b.settings.answer])).toEqual(
      cleanRows(rows).map((r) => ["question", r.q, r.a]),
    );
  });

  it("can't be ended early or run Liquid from the visitor's text", () => {
    expect(file.match(/\{% endschema %\}/g)).toHaveLength(1);
    const raw = schemaOf(file);
    expect(raw).not.toMatch(/\{\{|\{%|%\}|\}\}/);
    expect(raw).toContain("100% cotton"); // ordinary text stays as typed
    expect(raw).toContain("😀 café");
    expect(liquidSafeJson({ a: "{{{x}}} {%y%}" })).toBe('{\n  "a": "\\u007b\\u007b{x\\u007d\\u007d} \\u007b%y\\u0025}"\n}');
    expect(JSON.parse(liquidSafeJson({ a: "{{{x}}} {%y%}" })).a).toBe("{{{x}}} {%y%}");
  });

  it("shows the FAQ and adds the markup from the same block settings, answers always visible", () => {
    expect(file).toContain('<h3 class="geo-qa__question">{{ block.settings.question | escape }}</h3>');
    expect(file).toContain('<p class="geo-qa__answer">{{ block.settings.answer | escape | newline_to_br }}</p>');
    expect(file).toContain('"name": {{ block.settings.question | json }}');
    expect(file).toContain('"text": {{ block.settings.answer | json }}');
    expect(file).toContain("{{ block.shopify_attributes }}");
    expect(file).not.toMatch(/<details|<summary/);
    expect(tagsBalance(file)).toBe(true);
  });

  it("renders valid FAQPage JSON whichever blocks are empty", () => {
    const entries = [
      { q: "First?", a: "One." },
      { q: "", a: "" },
      { q: "Third?", a: "Line\nbreak \"quoted\"" },
      { q: "No answer?", a: "" },
    ];
    const ld = renderMarkup(file, entries, "block.settings.question", "block.settings.answer") as any;
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text])).toEqual([
      ["First?", "One."],
      ["Third?", "Line\nbreak \"quoted\""],
    ]);
    expect((renderMarkup(file, [{ q: "", a: "" }, { q: "Only?", a: "Yes." }], "block.settings.question", "block.settings.answer") as any).mainEntity).toHaveLength(1);
  });

  it("parses for every kind of tricky text", () => {
    for (const t of ['"', "\\", "\n\n", "😀👍🏽", "</script>", "{% endschema %}", "{{", "}}", "%}", "\u2028", "ünïcödé"]) {
      const parsed = JSON.parse(schemaOf(toShopifySection([{ q: `Q ${t}?`, a: `A ${t}` }])));
      expect(parsed.presets[0].blocks[0].settings).toEqual(cleanRows([{ q: `Q ${t}?`, a: `A ${t}` }]).map((r) => ({ question: r.q, answer: r.a }))[0]);
    }
  });
});

describe("the product metafield version", () => {
  it("gives a JSON value of q and a pairs", () => {
    expect(JSON.parse(toMetafieldJson([...SAMPLE_ROWS, { q: "Tricky?", a: TRICKY }]))).toEqual([...SAMPLE_ROWS, { q: "Tricky?", a: TRICKY }]);
  });

  it("has a section that reads custom.faq, shows answers and adds the markup from the same entries", () => {
    const file = productFaqSection();
    expect(file).toContain("{%- assign geo_qa_items = product.metafields.custom.faq.value -%}");
    expect(file).toContain('<h3 class="geo-qa__question">{{ item.q | escape }}</h3>');
    expect(file).toContain('<p class="geo-qa__answer">{{ item.a | escape | newline_to_br }}</p>');
    expect(file).not.toMatch(/<details|<summary/);
    expect(tagsBalance(file)).toBe(true);
    const schema = JSON.parse(schemaOf(file));
    expect(schema.name).toBe("Product FAQ");
    expect(schema.enabled_on).toEqual({ templates: ["product"] });
    expect(schema.presets).toEqual([{ name: "Product FAQ" }]);
    const ld = renderMarkup(file, [{ q: "A?", a: "B" }, { q: "C?", a: "" }, { q: "D?", a: "E </script>" }], "item.q", "item.a") as any;
    expect(ld.mainEntity.map((q: any) => q.name)).toEqual(["A?", "D?"]);
  });
});

// ---------- checks ----------

describe("checkRows", () => {
  it("has nothing to say about the example", () => {
    expect(checkRows(SAMPLE_ROWS)).toEqual([]);
    expect(faqVerdict(SAMPLE_ROWS)).toEqual({ tone: "good", count: 3, text: "3 questions ready" });
  });

  it("flags empty answers and questions by row number, and skips empty rows quietly", () => {
    const notes = checkRows([
      { q: "A?", a: "Yes." },
      { q: "", a: "" },
      { q: "No answer?", a: "" },
      { q: "", a: "Orphan answer." },
      { q: "Also none?", a: " " },
    ]);
    expect(notes).toContainEqual({ tone: "warn", text: "Questions 3 and 5 have no answer, so we left them out." });
    expect(notes).toContainEqual({ tone: "warn", text: "Answer 4 has no question, so we left it out." });
    expect(checkRows([{ q: "Lonely?", a: "" }, { q: "B?", a: "b" }, { q: "C?", a: "c" }])).toEqual([
      { tone: "warn", text: "Question 1 has no answer, so we left it out." },
    ]);
  });

  it("finds the same question asked twice, ignoring case and spaces", () => {
    const notes = checkRows([
      { q: "Is it vegan?", a: "Yes." },
      { q: "Other?", a: "No." },
      { q: "  is IT   vegan? ", a: "Still yes." },
    ]);
    expect(notes).toContainEqual({ tone: "warn", text: "Questions 1 and 3 are the same." });
  });

  it("flags advert words and HTML tags in answers", () => {
    const notes = checkRows([
      { q: "Price?", a: "Get 20% OFF with our discount code today." },
      { q: "Size?", a: "See the <b>chart</b>." },
      { q: "Deal?", a: "Buy  now, limited time only." },
    ]);
    expect(notes).toContainEqual({ tone: "warn", text: "Answers 1 and 3 read like an advert. Google's old FAQ rules said not to use FAQ markup for advertising." });
    expect(notes).toContainEqual({ tone: "info", text: "Answer 2 has HTML tags. We'll show tags as plain text. Write plain sentences." });
    expect(checkRows([{ q: "A?", a: "3 < 4 and 5 > 2" }, { q: "B?", a: "b" }])).toEqual([]);
  });

  it("gives tips for a single question and for missing question marks", () => {
    expect(checkRows([{ q: "Shipping times", a: "Two days." }])).toEqual([
      { tone: "tip", text: "Most product FAQs answer 4 to 6 questions." },
      { tone: "tip", text: "Question 1 doesn't end with a question mark. Write questions the way shoppers ask them." },
    ]);
    expect(faqVerdict([{ q: "One?", a: "Yes." }]).text).toBe("1 question ready");
  });

  it("orders warnings before notes and tips", () => {
    const tones = checkRows([
      { q: "Size", a: "<p>Fits all.</p>" },
      { q: "Size", a: "" },
    ]).map((n) => n.tone);
    expect(tones).toEqual(["warn", "warn", "info", "tip", "tip"]);
  });
});

// ---------- posted rows (no JavaScript) ----------

describe("rowsFromForm", () => {
  it("pairs repeated fields by position, drops empty rows and turns \\r\\n into \\n", () => {
    expect(rowsFromForm(["A?", "", "C?", ""], ["a\r\nb", "", "", ""])).toEqual({
      rows: [
        { q: "A?", a: "a\nb" },
        { q: "C?", a: "" },
      ],
      error: null,
    });
    expect(rowsFromForm(["A?"], [])).toEqual({ rows: [{ q: "A?", a: "" }], error: null });
  });

  it("counts a line break as one character, like the form's limit", () => {
    const a = "x\r\n".repeat(1000).slice(0, -2) + "y"; // 1,999 characters once \r\n is \n
    expect(rowsFromForm(["Q?"], [a]).error).toBeNull();
  });

  it("refuses more than 20 rows and text over the limits, cutting it down", () => {
    const qs = Array.from({ length: 21 }, (_, i) => `Q${i}?`);
    const many = rowsFromForm(qs, qs.map(() => "a"));
    expect(many.error).toBe("maxRows");
    expect(many.rows).toHaveLength(20);
    const long = rowsFromForm(["q".repeat(301)], ["a".repeat(2001)]);
    expect(long.error).toBe("tooLong");
    expect(long.rows).toEqual([{ q: "q".repeat(300), a: "a".repeat(2000) }]);
  });

  it("never reads more than 200 rows, however many fields arrive", () => {
    const blank = Array.from({ length: 50_000 }, () => "");
    blank[300] = "Far away?";
    expect(rowsFromForm(blank, blank)).toEqual({ rows: [], error: null });
  });
});

// ---------- copy ----------

describe("the copy module", () => {
  const src = read("app/lib/tools/copy/faq-schema-generator.ts");
  const generated = [toScriptTag(SAMPLE_ROWS), toShopifySection(SAMPLE_ROWS), productFaqSection(), toMetafieldJson(SAMPLE_ROWS)].join("\n");
  const visible = [
    copy.INTRO,
    copy.NOTE.text,
    copy.SAMPLE_LABEL,
    ...copy.WHAT_IT_CHECKS,
    ...copy.HOW_IT_WORKS.map((h) => h.text),
    ...copy.FAQS.flatMap((f) => [f.q, f.a]),
    copy.OUTPUTS.section.steps,
    copy.OUTPUTS.section.tip,
    ...copy.OUTPUTS.metafield.steps,
    copy.CTA.text,
    copy.CTA.note,
  ];

  it("has 4 to 6 FAQs, with answers that read as plain sentences", () => {
    expect(copy.FAQS.length).toBeGreaterThanOrEqual(4);
    expect(copy.FAQS.length).toBeLessThanOrEqual(6);
    for (const f of copy.FAQS) {
      expect(f.q.endsWith("?")).toBe(true);
      expect(f.a.length).toBeGreaterThan(80);
    }
  });

  it("has no em dash, no spaced en dash and no jargon, in the copy, the generator or its output", () => {
    for (const [name, s] of [
      ["copy", src],
      ["faq-schema.ts", read("app/lib/tools/faq-schema.ts")],
      ["faq-editor.tsx", read("app/components/tools/faq-editor.tsx")],
      ["route", read("app/routes/tools.faq-schema-generator.tsx")],
      ["generated code", generated],
    ]) {
      expect(EM_DASH.test(s), `${name} has an em dash`).toBe(false);
      expect(SPACED_EN_DASH.test(s), `${name} has a spaced en dash`).toBe(false);
    }
    const all = visible.join(" ");
    expect(all).not.toMatch(/AEO| LLM|generative engine optimization/);
    expect(all.replace(/\bGEO\b(?= (app|writes|is))|GEO's|by GEO/g, "")).not.toMatch(/\bGEO\b/);
  });

  it("never says FAQ markup gets rich results", () => {
    const sentences = visible.join(" ").split(/(?<=[.?!])\s+/).filter((s) => /rich result/i.test(s));
    expect(sentences.length).toBeGreaterThan(0);
    for (const s of sentences) expect(s, s).toMatch(/stopped|no longer|limited/);
  });

  it("starts with the exact definition and puts the honest note on the dated facts", () => {
    expect(copy.INTRO.startsWith("The FAQ Schema Generator is a free tool that")).toBe(true);
    expect(copy.NOTE.text).toContain("7 May 2026");
    expect(copy.NOTE.source.url).toBe("https://developers.google.com/search/updates");
    // starter questions never come with an invented answer
    expect(copy.STARTERS).toHaveLength(5);
  });
});

// ---------- the page head ----------

const callMeta = () => (route.meta as unknown as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });

describe("the page head", () => {
  const list = callMeta();
  const find = (k: string, v: string) => list.find((m) => (m as Record<string, unknown>)[k] === v) as Record<string, string> | undefined;

  it("has the registry title and description, one canonical, Open Graph and Twitter tags, no robots meta", () => {
    expect(list.filter((m) => "title" in m)).toEqual([{ title: "FAQ Schema Generator: Free JSON-LD for Shopify | GEO" }]);
    expect(TOOL.title.length).toBeLessThan(60);
    expect(find("name", "description")?.content).toBe(TOOL.description);
    expect(TOOL.description.length).toBeLessThan(155);
    const canonicals = list.filter((m) => (m as { rel?: string }).rel === "canonical") as { href: string }[];
    expect(canonicals.map((c) => c.href)).toEqual(["https://usegeo.app/tools/faq-schema-generator"]);
    expect(find("property", "og:url")?.content).toBe("https://usegeo.app/tools/faq-schema-generator");
    expect(find("property", "og:image")?.content).toBe("https://usegeo.app/og/faq-schema-generator.png");
    expect(find("property", "og:image:width")?.content).toBe("1200");
    expect(find("property", "og:image:height")?.content).toBe("630");
    expect(find("name", "twitter:card")?.content).toBe("summary_large_image");
    expect(find("name", "robots")).toBeUndefined();
  });

  it("has one JSON-LD graph with the app (free, no ratings), the page, breadcrumbs, the company and the same FAQs", () => {
    const ld = (list.find((m) => "script:ld+json" in m) as Record<string, unknown>)["script:ld+json"] as { "@graph": Record<string, any>[] };
    expect(ld).toEqual(toolJsonLd(TOOL, copy.FAQS));
    const json = JSON.stringify(ld);
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

// ---------- the page (server render, no JavaScript) ----------

function renderPage(actionData?: unknown) {
  const Stub = createRoutesStub([
    {
      id: "tools",
      path: "/tools",
      Component: layout.default as ComponentType,
      children: [{ id: "faq", path: "faq-schema-generator", Component: route.default as ComponentType, action: () => null }],
    },
  ]);
  return renderToStaticMarkup(
    createElement(Stub, {
      initialEntries: ["/tools/faq-schema-generator"],
      ...(actionData ? { hydrationData: { loaderData: {}, actionData: { faq: actionData } } } : {}),
    }),
  );
}

describe("the page (server render, no JavaScript)", () => {
  const out = renderPage();
  const plain = text(out);

  it("has one H1 with the search term, the intro, the honest note, the form and the trust line", () => {
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).toContain('<h1 class="ck-h1">FAQ Schema Generator</h1>');
    expect(plain).toContain(copy.INTRO);
    expect(plain.match(/The FAQ Schema Generator is a free tool/g)).toHaveLength(1);
    expect(plain).toContain(`Good to know: ${copy.NOTE.text}`);
    expect(out).toContain('href="https://developers.google.com/search/updates"');
    expect(out).toMatch(/<form method="post" class="tl-form tl-faq-form"/);
    expect(out).toContain('name="website"'); // the honeypot
    expect(plain).toContain("Free · No sign-up · Runs in your browser");
    // the honest note comes before the form, inside the band
    expect(out.indexOf("Good to know:")).toBeLessThan(out.indexOf("tl-faq-form"));
  });

  it("shows the labelled example rows plus 4 empty rows, and no JavaScript-only buttons", () => {
    expect(out).toMatch(/<span class="ck-chip is-grey">Example<\/span><span>Example questions for a made-up beard oil. Replace them with your own.<\/span>/);
    expect(out.match(/name="question"/g)).toHaveLength(7);
    expect(out.match(/name="answer"/g)).toHaveLength(7);
    for (const r of SAMPLE_ROWS) {
      expect(decode(out)).toContain(`value="${r.q}"`);
      expect(plain).toContain(r.a);
    }
    expect(plain).toContain("Question 7");
    expect(plain).toContain("Answer 7");
    expect(out).toContain('maxLength="300"');
    expect(out).toContain('maxLength="2000"');
    expect(plain).toContain(copy.FORM.moreRows);
    expect(plain).toContain("Make my code");
    expect(plain).not.toContain(copy.FORM.add);
    expect(plain).not.toContain(copy.STARTERS[0]);
    expect(plain).not.toContain(copy.FORM.remove);
  });

  it("shows the example's code: the verdict, all three outputs and the preview", () => {
    expect(plain).toContain("3 questions ready");
    expect(plain).toContain(copy.OUTPUTS_NOJS);
    expect(out).not.toContain('role="tablist"');
    for (const k of ["jsonLd", "section", "metafield"] as const) expect(plain).toContain(copy.OUTPUTS[k].title);
    expect(decode(out)).toContain(toScriptTag(SAMPLE_ROWS));
    expect(decode(out)).toContain(toShopifySection(SAMPLE_ROWS));
    expect(decode(out)).toContain(toMetafieldJson(SAMPLE_ROWS));
    expect(decode(out)).toContain(productFaqSection());
    expect(plain).toContain(copy.OUTPUTS.section.steps);
    for (const s of copy.OUTPUTS.metafield.steps) expect(plain).toContain(s);
    expect(plain).toContain("sections/geo-faq.liquid");
    expect(plain).toContain("sections/geo-product-faq.liquid");
    expect(plain).toContain("How the FAQ looks on your page");
    expect(out).toContain(`<dt>${SAMPLE_ROWS[0].q}</dt>`);
    // the code is text in the page, never live markup
    expect(out).not.toContain('<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "FAQPage"');
  });

  it("has exactly one button under the result, with the spec's words and link", () => {
    expect(out.match(/tl-cta"/g)).toHaveLength(1);
    expect(out).toMatch(/<a class="ck-btn ck-btn-dark tl-cta" href="\/\?ref=tool-faq-schema-generator#how">See how GEO writes FAQs that AI can quote/);
    expect(plain).toContain(copy.CTA.note);
    expect(out.indexOf('id="result"')).toBeLessThan(out.indexOf("tl-cta-card"));
    expect(out.indexOf("tl-faq-preview")).toBeLessThan(out.indexOf("tl-cta-card"));
    expect(out.indexOf("tl-cta-card")).toBeLessThan(out.indexOf('id="what-it-checks"'));
  });

  it("has what it checks, how it works, visible FAQs, more tools, the date and the footer", () => {
    expect(plain).toContain("What this tool checks");
    for (const item of copy.WHAT_IT_CHECKS) expect(plain).toContain(item);
    expect(plain).toContain("How this tool works");
    for (const item of copy.HOW_IT_WORKS) expect(plain).toContain(item.text);
    expect(plain).toContain("Maintained by GEO. Updated 11 October 2026.");
    for (const f of copy.FAQS) {
      expect(out).toContain(`<h3 class="ck-h3">${f.q.replace(/'/g, "&#x27;")}</h3>`);
      expect(plain).toContain(f.a);
    }
    // no folded or hidden content (the FAQ's own words "hidden in tabs" are fine: only tags are checked)
    expect(out).not.toMatch(/<details|<[^>]*\shidden[\s>=][^>]*>/);
    for (const s of TOOL.related) expect(out).toContain(`<a href="${toolBySlug(s).path}">${toolBySlug(s).name}</a>`);
    expect(plain).toContain("Updated 11 October 2026 · Made by GEO");
    expect(out).toContain('class="tl-foot"');
    expect(out).toContain('href="/tools"');
    for (const t of TOOLS) expect(out).toContain(`href="${t.path}"`);
  });

  it("shows posted rows (no JavaScript) in place of the example, with their code and 4 more empty rows", () => {
    const rows = [
      { q: "How long does shipping take?", a: "Two to four days." },
      { q: "What's your returns policy?", a: "30 days, unused." },
      { q: "Is it </b> safe?", a: "Yes {{ shop.name }}" },
    ];
    const page = renderPage({ ok: true, rows });
    const p = text(page);
    expect(p).not.toContain(copy.SAMPLE_LABEL);
    expect(page.match(/name="question"/g)).toHaveLength(7);
    expect(p).toContain("3 questions ready");
    expect(decode(page)).toContain(toScriptTag(rows));
    expect(decode(page)).toContain(toShopifySection(rows));
    expect(decode(page)).toContain(toMetafieldJson(rows));
    expect(page).not.toContain("</b>"); // visitors' text is text, never markup
    expect(page).toContain("Is it &lt;/b&gt; safe?");
  });

  it("shows an error next to the button and keeps the rows", () => {
    const page = text(renderPage({ ok: false, rows: [{ q: "Kept?", a: "Yes." }], error: copy.LIMIT_COPY.maxRows }));
    expect(page).toContain("Add up to 20 questions.");
    expect(page).toContain("1 question ready");
    expect(page).toContain("Most product FAQs answer 4 to 6 questions.");
    const empty = text(renderPage({ ok: false, rows: null, error: CROSS_SITE_COPY }));
    expect(empty).toContain(CROSS_SITE_COPY);
    expect(empty).toContain(copy.SAMPLE_LABEL); // nothing readable came: the example again
  });

  it("keeps the example label while any example text is left (its code is still in the result)", () => {
    const mixed = [{ q: "My own question?", a: "My own answer." }, ...SAMPLE_ROWS.slice(1)];
    expect(text(renderPage({ ok: true, rows: mixed }))).toContain(copy.SAMPLE_LABEL);
    const half = [{ q: SAMPLE_ROWS[0].q, a: "Changed answer." }];
    expect(text(renderPage({ ok: true, rows: half }))).toContain(copy.SAMPLE_LABEL);
    expect(text(renderPage({ ok: true, rows: [{ q: "Mine?", a: "Mine." }] }))).not.toContain(copy.SAMPLE_LABEL);
  });

  it("says when the form is full (20 rows) instead of promising more empty rows", () => {
    const rows = Array.from({ length: MAX_ROWS }, (_, i) => ({ q: `Question number ${i + 1}?`, a: `Answer ${i + 1}.` }));
    const page = renderPage({ ok: true, rows });
    expect(page.match(/name="question"/g)).toHaveLength(MAX_ROWS);
    expect(text(page)).toContain(copy.LIMIT_COPY.maxRows);
    expect(text(page)).not.toContain(copy.FORM.moreRows);
    // 17 rows: 3 empty rows, never past 20
    expect(renderPage({ ok: true, rows: rows.slice(0, 17) }).match(/name="question"/g)).toHaveLength(MAX_ROWS);
  });
});

// ---------- bounded work ----------

describe("bounded work on worst-case input", () => {
  // Inputs built to make a careless regex rescan: unclosed tags, long runs of spaces and backslashes,
  // Liquid delimiters and quotes, at the longest the fields allow, in all 20 rows.
  const nasty = (n: number, seed: string) => seed.repeat(Math.ceil(n / seed.length)).slice(0, n);
  const rows: FaqRow[] = Array.from({ length: MAX_ROWS }, (_, i) => ({
    q: nasty(300, ["<a ", "{{%", '\\"', " \t"][i % 4]),
    a: nasty(2_000, ["<a" + " ".repeat(50), "{%}}{{%", '\\\\"\\', "\n\n\n ", "<b x='", "% off "][i % 6]),
  }));

  it("builds every output for 20 full rows in well under a second", () => {
    const t = performance.now();
    const out = buildFaq(rows);
    const ms = performance.now() - t;
    expect(ms).toBeLessThan(500);
    expect(JSON.parse(scriptBody(out.scriptTag)).mainEntity).toHaveLength(cleanRows(rows).length);
    expect(JSON.parse(schemaOf(out.section)).presets[0].blocks).toHaveLength(cleanRows(rows).length);
    expect(JSON.parse(out.metafieldJson)).toHaveLength(cleanRows(rows).length);
  });

  it("reads a 1 MB post quickly, however the fields are packed", () => {
    const qs = Array.from({ length: 100_000 }, (_, i) => (i % 2 ? "<a ".repeat(3) : ""));
    const t = performance.now();
    const res = rowsFromForm(qs, qs);
    expect(performance.now() - t).toBeLessThan(500);
    expect(res.rows.length).toBeLessThanOrEqual(MAX_ROWS);
    const huge = rowsFromForm(["q".repeat(500_000)], ["a".repeat(500_000)]);
    expect(huge).toEqual({ rows: [{ q: "q".repeat(300), a: "a".repeat(2_000) }], error: "tooLong" });
  });

  it("escapes a 2 MB string for the section's settings block in linear time", () => {
    const big = nasty(2_000_000, '{%}"\\{{');
    const t = performance.now();
    const json = liquidSafeJson({ a: big });
    expect(performance.now() - t).toBeLessThan(2_000); // a regex that rescans would take minutes here
    expect(json).not.toMatch(/\{\{|\{%|%\}|\}\}/);
    expect(JSON.parse(json).a).toBe(big);
  });
});

// ---------- the action ----------

function post(body: string | URLSearchParams, headers: Record<string, string> = {}) {
  const request = new Request("https://usegeo.app/tools/faq-schema-generator", {
    method: "POST",
    body,
    headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": "203.0.113.20", ...headers },
  });
  return route.action({ request, params: {}, context: {} } as unknown as ActionFunctionArgs) as unknown as Promise<{
    data: { ok: boolean; rows: FaqRow[] | null; error?: string };
    init: ResponseInit | null;
  }>;
}
const form = (rows: [string, string][], extra: Record<string, string> = {}) => {
  const f = new URLSearchParams();
  for (const [q, a] of rows) {
    f.append("question", q);
    f.append("answer", a);
  }
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return f;
};
const headersOf = (r: { init: ResponseInit | null }) => new Headers(r.init?.headers);

describe("the action", () => {
  beforeEach(() => resetToolLimits());
  afterEach(() => resetToolLimits());

  it("reads 3 posted rows (plus the empty ones) and the page renders all three outputs", async () => {
    const res = await post(form([...SAMPLE_ROWS.map((r) => [r.q, r.a] as [string, string]), ["", ""], ["", ""]]));
    expect(res.init?.status ?? 200).toBe(200);
    expect(res.data).toEqual({ ok: true, rows: SAMPLE_ROWS });
    expect(headersOf(res).get("Cache-Control")).toBe("no-store");
    expect(headersOf(res).get("X-Robots-Tag")).toBe("noindex");
    const page = decode(renderPage(res.data));
    expect(page).toContain(toScriptTag(SAMPLE_ROWS));
    expect(page).toContain(toShopifySection(SAMPLE_ROWS));
    expect(page).toContain(toMetafieldJson(SAMPLE_ROWS));
  });

  it("refuses a post from another site (403) and a body that's too big (413)", async () => {
    const cross = await post(form([["A?", "B"]]), { "sec-fetch-site": "cross-site" });
    expect(cross.init?.status).toBe(403);
    expect(cross.data).toEqual({ ok: false, rows: null, error: CROSS_SITE_COPY });
    const evil = await post(form([["A?", "B"]]), { origin: "https://evil.example" });
    expect(evil.init?.status).toBe(403);
    const big = await post(`question=A&answer=${"a".repeat(1_100_000)}`);
    expect(big.init?.status).toBe(413);
    expect(big.data.error).toBe("That's too much to send at once. Try fewer or shorter answers.");
    expect(headersOf(big).get("Cache-Control")).toBe("no-store");
  });

  it("gives a filled-in honeypot the normal result (the example)", async () => {
    const res = await post(form([["A?", "B"]], { website: "spam.example" }));
    expect(res.init?.status ?? 200).toBe(200);
    expect(res.data).toEqual({ ok: true, rows: null });
  });

  it("refuses bad input (400): more than 20 rows, or text longer than the fields allow", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => [`Q${i}?`, `A${i}`] as [string, string]);
    const many = await post(form(rows));
    expect(many.init?.status).toBe(400);
    expect(many.data.error).toBe("Add up to 20 questions.");
    expect(many.data.rows).toHaveLength(20);
    const long = await post(form([["q".repeat(301), "a"]]));
    expect(long.init?.status).toBe(400);
    expect(long.data.error).toBe("Questions can be up to 300 characters, and answers up to 2,000.");
    expect(headersOf(long).get("X-Robots-Tag")).toBe("noindex");
  });

  it("allows 60 posts an hour per visitor (429 after that)", async () => {
    for (let i = 0; i < 60; i++) expect((await post(form([["A?", `B${i}`]]))).data.ok).toBe(true);
    const over = await post(form([["A?", "B"]]));
    expect(over.init?.status).toBe(429);
    expect(over.data.error).toBe(HOUR_COPY);
    expect(over.data.rows).toEqual([{ q: "A?", a: "B" }]);
    expect((await post(form([["A?", "B"]]), { "x-real-ip": "198.51.100.30" })).data.ok).toBe(true);
  });
});
