// The FAQ Schema Generator (docs/tools/spec.md T4): questions and answers in, three kinds of code out.
// 1. FAQPage JSON-LD in a <script> tag, for any website.
// 2. A Shopify section file whose preset already holds the questions; the visible FAQ and the markup render
//    from the same block settings, so they can't drift apart.
// 3. A product metafield value (JSON) plus a section that reads it, for a different FAQ on each product.
// Pure and browser-safe: the page runs it live as people type, and the server runs the same code for the
// on-load example and for posts without JavaScript. Every input is short (20 rows of at most 300 + 2,000
// characters), and no regex here can rescan text from many starts.
//
// Escaping: the JSON-LD tag replaces <, > and & with \u003c, \u003e and \u0026, so a pasted </script> can't
// close the tag (JSON.parse reads the escapes back as the same characters). The section's {% schema %} JSON
// escapes Liquid's delimiters inside strings, so typed {% endschema %} or {{ x }} stays plain text. Inside
// the section, answers reach the page through Liquid's escape filter (visible text) and json filter (markup);
// Shopify's json filter escapes quotes and slashes (its docs show "\/"), so "</script>" can't close a tag either.

import { ADVERT_WORDS, CHECKS, RESULT } from "./copy/faq-schema-generator";
import { plural } from "./format";

export interface FaqRow {
  q: string;
  a: string;
}

export const MAX_ROWS = 20;
export const MAX_QUESTION = 300;
export const MAX_ANSWER = 2_000;
/** Empty rows added under the questions when JavaScript is off (it can't add rows then). */
export const SPARE_ROWS = 4;
/** A post never makes us read more rows than this, however many fields it sends. */
export const MAX_POSTED_ROWS = 200;

export type FaqNoteTone = "warn" | "info" | "tip";
export interface FaqNote {
  tone: FaqNoteTone;
  text: string;
}

// ---------- cleaning ----------

/** Cut to `max` UTF-16 units without leaving half an emoji at the end. */
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const out = s.slice(0, max);
  const last = out.charCodeAt(out.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? out.slice(0, -1) : out;
}

/** One line, single spaces (a question is a one-line field). */
export const cleanQuestion = (q: string) => clip(q.replace(/\s+/g, " ").trim(), MAX_QUESTION);

/** Line breaks kept (as \n), spaces at line ends dropped, at most one empty line in a row. */
export const cleanAnswer = (a: string) =>
  clip(
    a
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
    MAX_ANSWER,
  );

const isBlank = (r: FaqRow) => !r.q.trim() && !r.a.trim();

/** The rows that go into the code: both parts filled in, cleaned, in order, at most 20. */
export function cleanRows(rows: FaqRow[]): FaqRow[] {
  const out: FaqRow[] = [];
  for (const r of rows) {
    const q = cleanQuestion(r.q);
    const a = cleanAnswer(r.a);
    if (q && a) out.push({ q, a });
    if (out.length === MAX_ROWS) break;
  }
  return out;
}

// ---------- checks ----------

/** Two questions are the same when they match ignoring case and spaces. */
export const questionKey = (q: string) => q.toLowerCase().replace(/\s+/g, " ").trim();
// A tag like <p>, </b> or <a href="...">. [^<>]* stops at the next < or >, so the scans never overlap.
const HTML_TAG = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/i;
const isAdvert = (a: string) => {
  const lower = a.toLowerCase().replace(/\s+/g, " ");
  return ADVERT_WORDS.some((w) => lower.includes(w));
};

/**
 * The notes shown above the code, most important first. Numbers are the rows' places in the form (1 = the
 * first row), so they match the "Question 3" labels. Rows with nothing in them are skipped quietly.
 */
export function checkRows(rows: FaqRow[]): FaqNote[] {
  const noAnswer: number[] = [];
  const noQuestion: number[] = [];
  const adverts: number[] = [];
  const html: number[] = [];
  const noMark: number[] = [];
  const duplicates: [number, number][] = [];
  const firstSeen = new Map<string, number>();
  let complete = 0;

  rows.slice(0, MAX_ROWS).forEach((r, i) => {
    const n = i + 1;
    const q = cleanQuestion(r.q);
    const a = cleanAnswer(r.a);
    if (!q && !a) return;
    if (q && !a) noAnswer.push(n);
    if (!q && a) noQuestion.push(n);
    if (q) {
      const key = questionKey(q);
      const first = firstSeen.get(key);
      if (first !== undefined) duplicates.push([first, n]);
      else firstSeen.set(key, n);
      if (!q.endsWith("?")) noMark.push(n);
    }
    if (q && a) {
      complete++;
      if (isAdvert(a)) adverts.push(n);
      if (HTML_TAG.test(a)) html.push(n);
    }
  });

  const notes: FaqNote[] = [];
  if (noAnswer.length) notes.push({ tone: "warn", text: CHECKS.noAnswer(noAnswer) });
  if (noQuestion.length) notes.push({ tone: "warn", text: CHECKS.noQuestion(noQuestion) });
  for (const [a, b] of duplicates) notes.push({ tone: "warn", text: CHECKS.duplicate(a, b) });
  if (adverts.length) notes.push({ tone: "warn", text: CHECKS.advert(adverts) });
  if (html.length) notes.push({ tone: "info", text: CHECKS.html(html) });
  if (complete === 1) notes.push({ tone: "tip", text: CHECKS.fewQuestions });
  if (noMark.length) notes.push({ tone: "tip", text: CHECKS.questionMark(noMark) });
  return notes;
}

/** The one-line verdict at the top of the result. */
export function faqVerdict(rows: FaqRow[]): { tone: "good" | "neutral"; count: number; text: string } {
  const count = cleanRows(rows).length;
  return count ? { tone: "good", count, text: RESULT.ready(plural(count, "question")) } : { tone: "neutral", count, text: RESULT.empty };
}

// ---------- JSON-LD ----------

const hex = (c: string) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;

/**
 * JSON that is safe inside <script type="application/ld+json">: <, > and & can't appear outside strings in
 * JSON, so replacing them everywhere only touches text (U+2028 and U+2029 too, for old script parsers).
 */
export const scriptSafeJson = (value: unknown, space = 2) => JSON.stringify(value, null, space).replace(/[<>&\u2028\u2029]/g, hex);

/** FAQPage, as schema.org defines it and Google last documented it: mainEntity, Question name, acceptedAnswer text. */
export function toJsonLd(rows: FaqRow[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: cleanRows(rows).map((r) => ({
      "@type": "Question",
      name: r.q,
      acceptedAnswer: { "@type": "Answer", text: r.a },
    })),
  };
}

/** The whole tag to paste into a page, or "" when no row is complete. */
export function toScriptTag(rows: FaqRow[]): string {
  if (!cleanRows(rows).length) return "";
  return `<script type="application/ld+json">\n${scriptSafeJson(toJsonLd(rows))}\n</script>`;
}

// ---------- Shopify ----------

// A JSON string literal as JSON.stringify writes it. The two branches can't both match one character, so
// each character is read once.
const JSON_STRING = /"(?:[^"\\]|\\.)*"/g;

// The first character of each Liquid delimiter: "{{", "{%", "%}" and "}}".
const LIQUID_DELIMITER = /\{(?=[{%])|%(?=\})|\}(?=\})/g;

/**
 * JSON for a {% schema %} tag: inside strings, every "{{", "{%", "%}" and "}}" gets its first character
 * written as a \u escape, so text like {% endschema %} can't end the tag early and {{ }} can't look like
 * Liquid. Other text ("100% cotton") stays as typed. JSON parsers read the escapes back as the same text.
 */
export const liquidSafeJson = (value: unknown, space = 2) =>
  JSON.stringify(value, null, space).replace(JSON_STRING, (s) => s.replace(LIQUID_DELIMITER, hex));

const HEADING_DEFAULT = "Questions and answers";

const STYLES = `{% stylesheet %}
  .geo-qa { max-width: 72rem; margin: 0 auto; padding: 2rem 1.5rem; }
  .geo-qa__item { padding: 1rem 0; border-top: 1px solid rgba(0, 0, 0, 0.1); }
  .geo-qa__question { margin: 0 0 0.5rem; }
  .geo-qa__answer { margin: 0; }
{% endstylesheet %}`;

/**
 * The visible FAQ and the FAQPage markup, both from the same entries: `each` loops over `list` (the section's
 * blocks, or one product's metafield entries) and `q` and `a` read the question and answer from it.
 */
function faqLiquid(each: string, list: string, q: string, a: string, opts: { shopifyAttributes: boolean }): string {
  const loop = `${each} in ${list}`;
  const filled = `${q} != blank and ${a} != blank`;
  return `{%- assign geo_qa_count = 0 -%}
{%- for ${loop} -%}
  {%- if ${filled} -%}
    {%- assign geo_qa_count = geo_qa_count | plus: 1 -%}
  {%- endif -%}
{%- endfor -%}

{%- if geo_qa_count > 0 -%}
  <div class="geo-qa">
    {%- if section.settings.heading != blank -%}
      <h2 class="geo-qa__heading">{{ section.settings.heading | escape }}</h2>
    {%- endif -%}
    {%- for ${loop} -%}
      {%- if ${filled} -%}
        <div class="geo-qa__item"${opts.shopifyAttributes ? ` {{ ${each}.shopify_attributes }}` : ""}>
          <h3 class="geo-qa__question">{{ ${q} | escape }}</h3>
          <p class="geo-qa__answer">{{ ${a} | escape | newline_to_br }}</p>
        </div>
      {%- endif -%}
    {%- endfor -%}
  </div>

  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {%- assign geo_qa_comma = '' -%}
        {%- for ${loop} -%}
          {%- if ${filled} -%}
            {{ geo_qa_comma }}
            {
              "@type": "Question",
              "name": {{ ${q} | json }},
              "acceptedAnswer": {
                "@type": "Answer",
                "text": {{ ${a} | json }}
              }
            }
            {%- assign geo_qa_comma = ',' -%}
          {%- endif -%}
        {%- endfor %}
      ]
    }
  </script>
{%- endif -%}`;
}

/**
 * sections/geo-faq.liquid: a section whose preset blocks already hold the visitor's questions, so after
 * adding the file the owner adds "FAQ" in the theme editor and the questions are there. Max 20 blocks.
 */
export function toShopifySection(rows: FaqRow[]): string {
  const schema = {
    name: "FAQ",
    tag: "section",
    class: "geo-qa-section",
    max_blocks: MAX_ROWS,
    disabled_on: { groups: ["header", "footer"] },
    settings: [{ type: "text", id: "heading", label: "Heading", default: HEADING_DEFAULT }],
    blocks: [
      {
        type: "question",
        name: "Question",
        settings: [
          { type: "text", id: "question", label: "Question" },
          { type: "textarea", id: "answer", label: "Answer" },
        ],
      },
    ],
    presets: [
      {
        name: "FAQ",
        blocks: cleanRows(rows).map((r) => ({ type: "question", settings: { question: r.q, answer: r.a } })),
      },
    ],
  };
  return `{%- comment -%}
  FAQ section made with GEO's free FAQ Schema Generator: https://usegeo.app/tools/faq-schema-generator
  Shows your questions and answers on the page and adds FAQPage structured data (JSON-LD) built from
  the same text, so the two always match. Change the questions in the theme editor (Customize).
{%- endcomment -%}
${faqLiquid("block", "section.blocks", "block.settings.question", "block.settings.answer", { shopifyAttributes: true })}

${STYLES}

{% schema %}
${liquidSafeJson(schema)}
{% endschema %}
`;
}

/** The value to paste into one product's FAQ field (a JSON metafield, custom.faq): [{"q": "...", "a": "..."}]. */
export function toMetafieldJson(rows: FaqRow[]): string {
  return JSON.stringify(
    cleanRows(rows).map(({ q, a }) => ({ q, a })),
    null,
    2,
  );
}

/**
 * sections/geo-product-faq.liquid: reads product.metafields.custom.faq and shows that product's FAQ, with the
 * markup from the same entries. Like the app's own extensions/geo-faq/blocks/product-faq.liquid, but the
 * answers stay visible (never inside <details>). The same file for every visitor.
 */
export function productFaqSection(): string {
  const schema = {
    name: "Product FAQ",
    tag: "section",
    class: "geo-qa-section",
    enabled_on: { templates: ["product"] },
    settings: [{ type: "text", id: "heading", label: "Heading", default: HEADING_DEFAULT }],
    presets: [{ name: "Product FAQ" }],
  };
  return `{%- comment -%}
  Product FAQ section made with GEO's free FAQ Schema Generator: https://usegeo.app/tools/faq-schema-generator
  Reads each product's FAQ from the product metafield custom.faq (type JSON), written like this:
  [{"q": "Your question?", "a": "Your answer."}]
  Shows the questions and answers and adds FAQPage structured data from the same text.
  Products with an empty FAQ field show nothing.
{%- endcomment -%}
{%- assign geo_qa_items = product.metafields.custom.faq.value -%}
${faqLiquid("item", "geo_qa_items", "item.q", "item.a", { shopifyAttributes: false })}

${STYLES}

{% schema %}
${JSON.stringify(schema, null, 2)}
{% endschema %}
`;
}

// ---------- the whole result ----------

export interface FaqOutput {
  rows: FaqRow[];
  notes: FaqNote[];
  verdict: ReturnType<typeof faqVerdict>;
  scriptTag: string;
  section: string;
  metafieldJson: string;
  productSection: string;
}

/** Everything the result shows, from the rows as typed. */
export function buildFaq(rows: FaqRow[]): FaqOutput {
  const ready = cleanRows(rows);
  return {
    rows: ready,
    notes: checkRows(rows),
    verdict: faqVerdict(rows),
    scriptTag: ready.length ? toScriptTag(ready) : "",
    section: ready.length ? toShopifySection(ready) : "",
    metafieldJson: ready.length ? toMetafieldJson(ready) : "",
    productSection: productFaqSection(),
  };
}

// ---------- posts without JavaScript ----------

export type RowsError = "maxRows" | "tooLong";

/**
 * The rows a form sent (repeated question and answer fields, paired by position). Empty rows are dropped;
 * half-filled ones stay, so the page can show them again with a note. More than 20 rows, or text longer than
 * the fields allow (only possible by getting round the form), comes back cut down, with the reason.
 */
export function rowsFromForm(questions: string[], answers: string[]): { rows: FaqRow[]; error: RowsError | null } {
  const n = Math.min(Math.max(questions.length, answers.length), MAX_POSTED_ROWS);
  let tooLong = false;
  const rows: FaqRow[] = [];
  for (let i = 0; i < n; i++) {
    // Browsers send line breaks as \r\n; count them as one character, like the form's limit does.
    const q = String(questions[i] ?? "").replace(/\r\n?/g, "\n");
    const a = String(answers[i] ?? "").replace(/\r\n?/g, "\n");
    if (q.length > MAX_QUESTION || a.length > MAX_ANSWER) tooLong = true;
    const row = { q: clip(q, MAX_QUESTION), a: clip(a, MAX_ANSWER) };
    if (!isBlank(row)) rows.push(row);
  }
  if (rows.length > MAX_ROWS) return { rows: rows.slice(0, MAX_ROWS), error: "maxRows" };
  return { rows, error: tooLong ? "tooLong" : null };
}
