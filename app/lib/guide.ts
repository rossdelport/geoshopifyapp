// Guide pages in strict question-and-answer form, built from Claude's structured draft. Pure (tested).
// The page title is the shopper's question (themes show it as the page's H1). The body: a short direct
// answer, 4 to 6 sections whose H2 headings are buyer questions with self-contained answers, "Products
// that fit" linking the store's own products (with our UTM), and a "Sources" line only when there are
// real ones. Every link is built here from known store URLs: Claude never writes a link itself.

import type { FaqItem } from "./fix-labels";

export interface GuideDraft {
  question: string; // the H1: the shopper's question
  shortAnswer: string; // 2 to 3 sentences that make sense on their own
  sections: { question: string; answer: string }[]; // 4 to 6
  picks: { productIndex: number; why: string }[]; // from the product list given to Claude
  sources: string[]; // URLs Claude says it used; only allowlisted ones survive
}

export interface GuideProductLink {
  title: string;
  url: string; // the tracked link (our UTM)
}

export const MIN_SECTIONS = 4;
export const MAX_SECTIONS = 6;
export const MAX_PICKS = 4;
const MAX_SOURCES = 5;

// Answers must stand alone: AI assistants quote one section at a time.
const BACK_REFERENCE =
  /\b(?:as (?:mentioned|noted|discussed|said|explained|described|covered|shown|listed)(?: (?:above|earlier|before|previously))?|see (?:above|below)|(?:mentioned|noted) (?:above|earlier)|the (?:above|previous|next|following) (?:section|question|point)|in the (?:previous|last|next) section)\b/i;

/** No em dashes or spaced en dashes in anything we publish (house style). "30-50 ml" ranges keep a hyphen. */
export function tidyDashes(s: string): string {
  return s
    .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1 to $2")
    .replace(/\s+[\u2013\u2014]\s+|\s*\u2014\s*/g, ", ")
    .replace(/,\s*,/g, ",");
}

const clean = (s: string) => tidyDashes(String(s ?? "").replace(/\s+/g, " ").trim());

/** Split into sentences (". ", "! ", "? " followed by a capital or digit). */
export function sentences(s: string): string[] {
  return clean(s)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘(])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const asQuestion = (s: string) => {
  const q = clean(s).replace(/[.!:;,\s]+$/, "");
  return q && !q.endsWith("?") ? `${q}?` : q;
};

/**
 * Tidy a draft into the strict shape: questions end with "?", the short answer keeps its first 3
 * sentences, at most 6 sections, picks only for products that exist (no repeats, max 4). Dashes go.
 */
export function tidyGuide(d: GuideDraft, productCount: number): GuideDraft {
  const seen = new Set<number>();
  return {
    question: asQuestion(d.question),
    shortAnswer: sentences(d.shortAnswer).slice(0, 3).join(" "),
    sections: d.sections
      .map((s) => ({ question: asQuestion(s.question), answer: clean(s.answer) }))
      .filter((s) => s.question.length > 1 && s.answer)
      .slice(0, MAX_SECTIONS),
    picks: d.picks
      .filter((p) => Number.isInteger(p.productIndex) && p.productIndex >= 0 && p.productIndex < productCount)
      .filter((p) => !seen.has(p.productIndex) && Boolean(seen.add(p.productIndex)))
      .map((p) => ({ productIndex: p.productIndex, why: clean(p.why) }))
      .slice(0, MAX_PICKS),
    sources: d.sources,
  };
}

/**
 * What's wrong with a (tidied) draft. `blocking` problems mean we don't use it at all; `notes` go to
 * the store with the fix ("please check").
 */
export function guideProblems(d: GuideDraft): { blocking: string[]; notes: string[] } {
  const blocking: string[] = [];
  const notes: string[] = [];
  if (d.question.length < 8) blocking.push("The guide has no shopper question as its title.");
  const n = sentences(d.shortAnswer).length;
  if (!n) blocking.push("The guide has no short answer at the top.");
  else if (n < 2) notes.push("The short answer at the top is only one sentence. You may want to add a second.");
  if (d.sections.length < MIN_SECTIONS) blocking.push(`The guide has ${d.sections.length} question sections; it needs at least ${MIN_SECTIONS}.`);
  if (!d.picks.length) blocking.push("The guide doesn't feature any of the store's products.");
  const leaning = [d.shortAnswer, ...d.sections.map((s) => s.answer)].filter((t) => BACK_REFERENCE.test(t)).length;
  if (leaning) notes.push("Some answers point to other parts of the page (like “as mentioned above”). Each answer should make sense on its own.");
  return { blocking, notes };
}

// ---------- Links: only store URLs we actually know ----------

/** "https://WWW.Shop.com/products/x/?utm=1#y" -> "shop.com/products/x". Null for anything that isn't a web link. */
export function linkKey(url: string): string | null {
  try {
    const u = new URL(String(url ?? "").trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.username || u.password) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
    const path = decodeURIComponent(u.pathname).replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return null;
  }
}

/** The allowlist: the store's own pages we know about (catalog products, policy pages, pages we fetched). */
export function buildAllowlist(urls: { url: string; label: string }[]): Map<string, { url: string; label: string }> {
  const out = new Map<string, { url: string; label: string }>();
  for (const u of urls) {
    const key = linkKey(u.url);
    if (key && !out.has(key)) out.set(key, { url: new URL(u.url).toString().split("#")[0], label: clean(u.label) || key });
  }
  return out;
}

/**
 * Only links on the allowlist survive, in the model's order, once each (max 5). The URL we publish is
 * our own copy of the known URL, never the model's text, so nothing it made up can slip through.
 */
export function filterSourceLinks(urls: string[], allow: Map<string, { url: string; label: string }>): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const key = linkKey(raw);
    const hit = key ? allow.get(key) : undefined;
    if (!hit || seen.has(key!)) continue;
    seen.add(key!);
    out.push(hit);
    if (out.length >= MAX_SOURCES) break;
  }
  return out;
}

// ---------- HTML ----------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The page body. Every piece of text is escaped; links come only from `products` and `sources`. */
export function buildGuideHtml(d: GuideDraft, products: GuideProductLink[], sources: { url: string; label: string }[]): string {
  const parts = [`<p><strong>Short answer:</strong> ${esc(d.shortAnswer)}</p>`];
  for (const s of d.sections) parts.push(`<h2>${esc(s.question)}</h2>`, `<p>${esc(s.answer)}</p>`);
  const picks = d.picks.map((p) => ({ product: products[p.productIndex], why: p.why })).filter((p) => p.product);
  if (picks.length) {
    parts.push(
      "<h2>Products that fit</h2>",
      `<ul>${picks
        .map((p) => `<li><a href="${esc(p.product.url)}">${esc(p.product.title)}</a>${p.why ? `: ${esc(p.why)}` : ""}</li>`)
        .join("")}</ul>`,
    );
  }
  if (sources.length) {
    parts.push(`<p><em>Sources:</em> ${sources.map((s) => `<a href="${esc(s.url)}">${esc(s.label)}</a>`).join(", ")}</p>`);
  }
  return parts.join("\n");
}

const unescape = (s: string) =>
  s
    .replace(/<[^>]{0,500}>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const MAX_BODY = 100_000;

/**
 * The question and answer pairs in a guide's HTML, for FAQPage data: the title with the short answer,
 * then every H2 that ends with "?" with the paragraph right after it. Read from the HTML that goes
 * live, so edits and softened wording are always what the data says. Max 10 pairs.
 */
export function faqFromGuideHtml(title: string, html: string): FaqItem[] {
  const body = html.slice(0, MAX_BODY);
  const out: FaqItem[] = [];
  const short = /<p>\s*<strong>\s*Short answer:\s*<\/strong>([\s\S]{1,3000}?)<\/p>/i.exec(body)?.[1];
  const q0 = unescape(title);
  if (q0.endsWith("?") && short && unescape(short)) out.push({ q: q0, a: unescape(short) });
  for (const m of body.matchAll(/<h2[^>]{0,200}>([^<]{1,300})<\/h2>\s{0,20}<p[^>]{0,200}>([\s\S]{1,4000}?)<\/p>/gi)) {
    const q = unescape(m[1]);
    const a = unescape(m[2]);
    if (q.endsWith("?") && a) out.push({ q, a });
    if (out.length >= 10) break;
  }
  return out;
}

/** The text the claims check reads, in a form we can map back (Q:/A: blocks, like product FAQs). */
export function guideClaimsText(d: GuideDraft): string {
  return [
    { q: d.question, a: d.shortAnswer },
    ...d.sections.map((s) => ({ q: s.question, a: s.answer })),
    ...d.picks.map((p, i) => ({ q: `Pick ${i + 1}`, a: p.why || "(no note)" })),
  ]
    .map((x) => `Q: ${x.q}\nA: ${x.a}`)
    .join("\n\n");
}

/** Put the claims check's softened text back into the draft. Null when the shape no longer matches. */
export function applyClaimsText(d: GuideDraft, items: FaqItem[] | null): GuideDraft | null {
  if (!items || items.length !== 1 + d.sections.length + d.picks.length) return null;
  const [head, ...rest] = items;
  return {
    ...d,
    question: asQuestion(head.q),
    shortAnswer: clean(head.a),
    sections: rest.slice(0, d.sections.length).map((x) => ({ question: asQuestion(x.q), answer: clean(x.a) })),
    picks: d.picks.map((p, i) => ({ ...p, why: clean(rest[d.sections.length + i].a).replace(/^\(no note\)$/, "") })),
  };
}
