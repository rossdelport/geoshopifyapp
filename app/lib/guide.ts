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

/**
 * The kinds of guide page, rotated so a store's guides aren't the same shape twice in a row (Ross, 2026-10-15:
 * not just "top 10" lists). Every kind keeps the strict question-and-answer form; the kind sets the angle.
 */
export const GUIDE_KINDS = ["how-to-choose", "comparison", "use-case", "buying-advice", "deep-dive"] as const;
export type GuideKind = (typeof GUIDE_KINDS)[number];

export const GUIDE_KIND_LABELS: Record<GuideKind, string> = {
  "how-to-choose": "How to choose",
  comparison: "Comparison",
  "use-case": "Use case",
  "buying-advice": "Buying advice",
  "deep-dive": "One question, in depth",
};

/** What each kind asks the writer for (goes into the prompt). */
export const GUIDE_KIND_NOTES: Record<GuideKind, string> = {
  "how-to-choose": "An overview: answer the broad question and how to choose, so a shopper new to this can decide.",
  comparison:
    "A comparison: the two or three options a shopper weighs for this question (types, materials, sizes, price bands, or the store's products against the kind of alternative shoppers consider). Say honestly who each option suits and the trade-offs. Only facts from the product data. Never name or judge another brand.",
  "use-case":
    "A use-case page: build it around one situation or person (for example a first-timer, a gift, travel, a climate, a sensitive skin type, a small space) and what works for them and why.",
  "buying-advice":
    "Buying advice: build it around the mistakes people make and what to check before buying (fit, sizing, materials, care, how long it lasts, returns), with the store's products only where they genuinely fit.",
  "deep-dive": "One specific question answered in depth, with the related questions that follow from it, each answered fully.",
};

/** The kind for a store's next guide: hubs are overviews; the rest rotate by how many guides the store has had. */
export function nextGuideKind(guidesSoFar: number, role: "single" | "hub" | "spoke"): GuideKind {
  if (role === "hub") return "how-to-choose";
  return GUIDE_KINDS[Math.max(0, guidesSoFar) % GUIDE_KINDS.length];
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
    .replace(/&mdash;|&#8212;|&#x2014;/gi, "\u2014")
    .replace(/&ndash;|&#8211;|&#x2013;/gi, "\u2013")
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

// ---------- Topic clusters: links between a hub guide and its specific guides ----------
// Worked out when a guide goes live (never when it's drafted), and only to guides that are live now,
// so no link ever points at a page that doesn't exist. Plain links with no UTM: a shopper moving
// between our guides keeps the AI source they arrived from. The links live in one block we own
// (<div class="geo-related">), rebuilt from the list of live guides each time, so the rest of the page
// (including the store's own edits) is never touched.

export const RELATED_CLASS = "geo-related";
const RELATED_BLOCK = /\n?<div class="geo-related">[\s\S]{0,20000}?<\/div>/i;

export interface GuideLink {
  title: string;
  url: string;
}

/** The hub's "More guides on this topic" list, or a specific guide's link back to its hub. Empty when there's nothing to link. */
export function relatedBlock(kind: "hub" | "spoke", links: GuideLink[]): string {
  const safe = links.filter((l) => linkKey(l.url)).slice(0, 20);
  if (!safe.length) return "";
  if (kind === "spoke") {
    const hub = safe[0];
    return `<div class="${RELATED_CLASS}"><p><em>Part of our guide:</em> <a href="${esc(hub.url)}">${esc(clean(hub.title))}</a></p></div>`;
  }
  return `<div class="${RELATED_CLASS}"><h2>More guides on this topic</h2><ul>${safe
    .map((l) => `<li><a href="${esc(l.url)}">${esc(clean(l.title))}</a></li>`)
    .join("")}</ul></div>`;
}

/** The page without our links block. */
export function stripRelated(html: string): string {
  return html.replace(RELATED_BLOCK, "");
}

/** Put our links block in (replacing the old one), or take it out when `block` is empty. */
export function setRelatedBlock(html: string, block: string): string {
  const without = stripRelated(html).replace(/\s+$/, "");
  return block ? `${without}\n${block}` : without;
}

/** The hub URLs a page links to in our block (for tests and checks). */
export function relatedLinks(html: string): string[] {
  const block = RELATED_BLOCK.exec(html)?.[0] ?? "";
  return [...block.matchAll(/href="([^"<>]{1,500})"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

// ---------- Freshness: the "Updated <Month Year>" line ----------

export const UPDATED_CLASS = "geo-updated";
const UPDATED_LINE = /<p class="geo-updated">[^<]{0,80}(?:<em>[^<]{0,80}<\/em>)?[^<]{0,20}<\/p>\n?/i;

/** "Updated October 2026" in UTC. */
export function updatedText(date: Date): string {
  return `Updated ${date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}`;
}

/** The page without its "Updated" line. */
export function stripUpdatedLine(html: string): string {
  return html.replace(UPDATED_LINE, "");
}

/** Put the "Updated <Month Year>" line at the top of the page (replacing an old one). */
export function setUpdatedLine(html: string, date: Date): string {
  return `<p class="${UPDATED_CLASS}"><em>${updatedText(date)}</em></p>\n${stripUpdatedLine(html)}`;
}

/** The month a page says it was updated ("October 2026"), or null. */
export function updatedLineOf(html: string): string | null {
  return /<p class="geo-updated">\s*(?:<em>)?\s*Updated ([A-Za-z]+ \d{4})/i.exec(html)?.[1] ?? null;
}

/**
 * The words of a guide that count as its content: without our links block, the "Updated" line and the
 * HTML. Two versions with the same content text are the same guide (a refresh never just bumps the date).
 */
export function guideContentText(html: string): string {
  return unescape(stripUpdatedLine(stripRelated(html)).slice(0, MAX_BODY)).toLowerCase();
}

/** The products a guide's "Products that fit" list links to, by handle (from /products/<handle> links). */
export function guideProductHandles(html: string): string[] {
  const out: string[] = [];
  // Each href is read once (a bounded run of non-quote characters), then the handle is picked out of it:
  // no nested repeats, so a long or unclosed link can't make this slow.
  for (const m of html.slice(0, MAX_BODY).matchAll(/href="([^"<>]{1,800})"/gi)) {
    const h = /\/products\/([a-z0-9][a-z0-9-]{0,200})/i.exec(m[1])?.[1]?.toLowerCase();
    if (h && !out.includes(h)) out.push(h);
  }
  return out;
}
