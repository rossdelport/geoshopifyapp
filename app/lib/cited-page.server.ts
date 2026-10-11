// Reads a page an AI assistant cited, to see whether it already names the store, when it was last
// updated, and who to contact. Free: a plain page read, never a paid call. Uses the free check's
// guarded fetch (public addresses only, redirects checked hop by hop, 2 MB and time caps).
// Reads are capped per store per week by plan (plans.ts pageReadsPerWeek), each read is logged in
// ApiCost at US$0 (provider "web", endpoint "page.read"), and a page is read again only after PAGE_CACHE_DAYS.
//
// Every parser here runs on HTML from any site an AI cites, so each pattern is bounded (no unbounded
// quantifier that can rescan the page) and tags are found with indexOf where a regex would backtrack.

import db from "../db.server";
import { safeFetch } from "./check.server";
import { decodeEntities, htmlToText } from "./check-read";
import { brandKey, sameBrand } from "./match";
import { domainOf } from "./answers";
import { getPlan } from "./plans";
import { pool } from "./pool";
import type { OutreachKind } from "./sources";

export const PAGE_CACHE_DAYS = 14;
const DAY = 86_400_000;
export const PAGE_READ_ENDPOINT = "page.read";

/** Status of a page AI uses that already names the store: not a target, and not counted as one. */
export const NAMED_STATUS = "named";

export interface MerchantNames {
  brandNames: string[]; // brand name, shop name, aliases
  domains: string[]; // primary domain and myshopify domain
  /** Ordinary words from the store's own catalogue and questions ("beard", "oil"): never proof of the brand alone. */
  genericWords?: string[];
}

export interface PageCheck {
  ok: boolean; // we could read the page
  title: string | null; // the page's own title, for targets whose citation had none
  mentionsMerchant: boolean | null; // null when we couldn't read it
  modifiedAt: Date | null; // the page's own updated (or published) date
  isModified: boolean; // modifiedAt is an "updated" date (false: only a published date was found)
  authorName: string | null; // article author or video creator
  email: string | null; // a contact email shown on the page
  contactUrl: string | null; // a contact page, or the creator's channel
}

export type PageFetcher = (url: string) => Promise<{ status: number; url: string; text: string }>;

/** The guarded fetch from the free check: public addresses only, redirects checked, 8 s and 2 MB caps. */
export const guardedFetch: PageFetcher = (url) => safeFetch(url, "text/html,application/xhtml+xml", { timeoutMs: 8_000, maxRedirects: 3 });

// ---------- Pure helpers (tested) ----------

const SUFFIX = /[\s,]+(co\.?|company|pty\.?\s*ltd\.?|ltd\.?|limited|inc\.?|llc|gmbh|plc)$/i;
// Words that don't make a name more specific: "The Beard Co." is one real word ("Beard").
const CORP_WORDS = new Set(["the", "co", "company", "pty", "ltd", "limited", "inc", "llc", "gmbh", "plc", "and"]);

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** The words that make a name specific: "The Beard Co." -> ["beard"]; "StubbleBros" -> ["stubble", "bros"]. */
export function coreWords(name: string): string[] {
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9À-ɏ']+/)
    .filter((w) => w && !CORP_WORDS.has(w));
}

/**
 * The ways a page might write the brand: "The Groomed Man Co." also as "Groomed Man Co" and "Groomed Man".
 * A shorter form is kept only while it still has two or more words: "The Beard Co." never becomes plain
 * "Beard", which any beard oil roundup would contain.
 */
export function brandVariants(names: string[]): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const t = s.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim();
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  };
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const noThe = name.replace(/^the\s+/i, "");
    const noSuffix = noThe.replace(SUFFIX, "");
    for (const v of [name, noThe, noSuffix]) {
      if (v !== name && wordCount(v.replace(/[.\s]+$/, "")) < 2) continue;
      add(v);
      if (v.includes("&")) add(v.replace(/\s*&\s*/g, " and "));
      if (/\band\b/i.test(v)) add(v.replace(/\s+and\s+/gi, " & "));
    }
  }
  return out;
}

/** The domain as a whole host name in the page ("stubblebros.com", never "notstubblebros.com"). */
function hasDomain(lowerHtml: string, domain: string): boolean {
  const edge = (c: number) => c === -1 || !(isWordChar(c) || c === 45); // not a letter, digit or hyphen
  let i = 0;
  for (;;) {
    const at = lowerHtml.indexOf(domain, i);
    if (at === -1) return false;
    const before = at === 0 ? -1 : lowerHtml.charCodeAt(at - 1);
    const after = at + domain.length >= lowerHtml.length ? -1 : lowerHtml.charCodeAt(at + domain.length);
    if (edge(before) && edge(after)) return true;
    i = at + 1;
  }
}

const MAX_TEXT = 2_000_000;
const MAX_TAGS = 400;

/**
 * Up to `max` tags named `name` (e.g. "meta"), each at most `len` characters, between `from` and `to`.
 * Linear time: from each "<name" it walks forward only to the next "<" or ">", and carries on from there.
 */
export function findTags(html: string, name: string, max = MAX_TAGS, len = 1_000, from = 0, to = html.length): string[] {
  const out: string[] = [];
  const s = from === 0 && to >= html.length ? html : html.slice(from, to);
  const lower = s.toLowerCase();
  const open = `<${name}`;
  let i = 0;
  while (out.length < max) {
    const at = lower.indexOf(open, i);
    if (at === -1) break;
    const next = lower.charCodeAt(at + open.length);
    // "<meta" followed by a letter, digit or hyphen is another tag ("<metadata"): skip it.
    if ((next >= 97 && next <= 122) || (next >= 48 && next <= 57) || next === 45) {
      i = at + open.length;
      continue;
    }
    let j = at + 1;
    const stop = Math.min(s.length, at + len + 1);
    while (j < stop) {
      const c = s.charCodeAt(j);
      if (c === 60 || c === 62) break; // "<" or ">"
      j++;
    }
    if (j < stop && s.charCodeAt(j) === 62) {
      out.push(s.slice(at, j + 1));
      i = j + 1;
    } else {
      i = j; // ran into another tag, or far too long: not a real tag
    }
  }
  return out;
}

/** The value of one attribute in a tag string ("content", "name"...), or null. */
export function attr(tag: string, key: string): string | null {
  const m = new RegExp(`\\b${key}\\s*=\\s*(?:"([^"]{0,2000})"|'([^']{0,2000})'|([^\\s"'<>]{1,500}))`, "i").exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

/** The words a reader sees, plus the title, description and (for videos) the description text. */
export function pageText(html: string): string {
  const meta = findTags(html, "meta", MAX_TAGS, 3_000)
    .map((tag) => {
      const key = (attr(tag, "name") ?? attr(tag, "property") ?? "").toLowerCase();
      return /^(description|og:description|og:title|twitter:title|twitter:description)$/.test(key) ? attr(tag, "content") ?? "" : "";
    })
    .filter(Boolean)
    .map(decodeEntities);
  // YouTube keeps the full video description in a script; read just that string.
  const ytDescription = /"shortDescription"\s*:\s*"((?:[^"\\]|\\.){0,8000})"/.exec(html)?.[1];
  let yt = "";
  if (ytDescription) {
    try {
      yt = JSON.parse(`"${ytDescription}"`) as string;
    } catch {
      yt = ytDescription;
    }
  }
  return [htmlToText(html, MAX_TEXT), ...meta, yt].join(" \n ");
}

const isWordChar = (c: number) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);

/**
 * Is `word` in `text` as a whole word (not next to a letter or digit)? indexOf, so linear on big pages
 * (same meaning as match.ts textNamesBrand on lowercased text, and textNamesShortBrand in exact case).
 */
export function hasWholeWord(text: string, word: string): boolean {
  if (!word) return false;
  let i = 0;
  for (;;) {
    const at = text.indexOf(word, i);
    if (at === -1) return false;
    const before = at === 0 ? -1 : text.charCodeAt(at - 1);
    const after = at + word.length >= text.length ? -1 : text.charCodeAt(at + word.length);
    if ((before === -1 || !isWordChar(before)) && (after === -1 || !isWordChar(after))) return true;
    i = at + 1;
  }
}

/** Any name, ignoring case (names of 3+ characters). */
const textNamesAnyCase = (lowerText: string, names: string[]) => names.some((n) => n.trim().length >= 3 && hasWholeWord(lowerText, n.trim().toLowerCase()));
/** Any name in its exact case, or all capitals ("MILKMAN"). */
const textNamesExact = (text: string, names: string[]) => names.some((n) => n.trim().length >= 2 && (hasWholeWord(text, n.trim()) || hasWholeWord(text, n.trim().toUpperCase())));

/**
 * Does the page name the store? Its brand name (whole words, in any of its usual forms), a long brand
 * name written as one word ("StubbleBros"), or a link to the store's website. A name with only one
 * real word ("Milkman", "The Ordinary", "Beard Co") must appear in its own capitals, and never counts
 * when that word is an ordinary word from the store's own catalogue or questions.
 */
export function pageNamesMerchant(html: string, m: MerchantNames): boolean {
  const text = pageText(html);
  const generic = new Set((m.genericWords ?? []).map((w) => w.toLowerCase()));
  const variants = brandVariants(m.brandNames);
  const originals = new Set(m.brandNames.map((n) => n.replace(/\s+/g, " ").replace(/[.\s]+$/, "").trim().toLowerCase()));
  const specific = variants.filter((n) => coreWords(n).length >= 2);
  // One real word: its own capitals only. If that word is ordinary for this store ("Beard" for a beard
  // oil shop), only the full name as the store writes it counts ("The Beard Co"), never a shorter form.
  const single = variants.filter((n) => {
    const core = coreWords(n);
    if (core.length !== 1) return false;
    return !generic.has(core[0]) || (originals.has(n.toLowerCase()) && wordCount(n) >= 2);
  });
  const lowerText = text.toLowerCase();
  if (textNamesAnyCase(lowerText, specific.filter((n) => n.length >= 4))) return true;
  if (textNamesExact(text, specific.filter((n) => n.length === 3))) return true;
  if (textNamesExact(text, single)) return true;
  // "StubbleBros" for "Stubble Bros": only for names of two or more real words, and long ones.
  const keys = [...new Set(m.brandNames.filter((n) => coreWords(n).length >= 2).map(brandKey))].filter((k) => k.length >= 9);
  if (keys.length) {
    const compact = lowerText.replace(/[^a-z0-9]/g, "");
    if (keys.some((k) => compact.includes(k))) return true;
  }
  const lower = html.toLowerCase();
  return m.domains
    .map((d) => d.toLowerCase().replace(/^www\./, "").trim())
    .filter((d) => d.includes("."))
    .some((d) => hasDomain(lower, d));
}

const MODIFIED_KEYS = ["article:modified_time", "og:updated_time", "datemodified", "last-modified", "modified", "dc.date.modified", "dcterms.modified"];
const PUBLISHED_KEYS = [
  "article:published_time", "og:published_time", "datepublished", "uploaddate", "pubdate", "publish-date", "publishdate",
  "parsely-pub-date", "sailthru.date", "dc.date", "dc.date.issued", "dcterms.created", "date",
];

function metaDates(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const tag of findTags(html, "meta", MAX_TAGS, 2_000)) {
    const key = (attr(tag, "property") ?? attr(tag, "name") ?? attr(tag, "itemprop") ?? attr(tag, "http-equiv"))?.toLowerCase();
    const value = attr(tag, "content");
    if (key && /^[a-z:._-]{1,60}$/.test(key) && value && value.length >= 4 && value.length <= 60 && !out.has(key)) out.set(key, value.trim());
  }
  return out;
}

const LD_MAX_BLOCK = 200_000;
const LD_MAX_BLOCKS = 20;

/** The JSON-LD blocks, found with indexOf (each at most 200 KB, at most 20 of them). */
export function ldBlocks(html: string): string[] {
  const out: string[] = [];
  const lower = html.toLowerCase();
  let i = 0;
  let tries = 0;
  while (out.length < LD_MAX_BLOCKS && tries++ < 200) {
    const at = lower.indexOf("application/ld+json", i);
    if (at === -1) break;
    const start = lower.lastIndexOf("<script", at);
    const tagEnd = lower.indexOf(">", at);
    i = at + 19;
    if (start === -1 || at - start > 300 || tagEnd === -1 || tagEnd - at > 100) continue;
    const close = lower.indexOf("</script", tagEnd);
    if (close === -1) break; // never closed: nothing after it can be a whole block either
    if (close - tagEnd <= LD_MAX_BLOCK) out.push(html.slice(tagEnd + 1, close));
    i = close + 8;
  }
  return out;
}

function validDate(raw: string | null | undefined, now: Date): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  if (!Number.isFinite(t)) return null;
  // Real pages only: not before the web got busy, and not more than two days in the future (time zones).
  return t >= Date.UTC(2000, 0, 1) && t <= now.getTime() + 2 * DAY ? new Date(t) : null;
}

function firstJsonDate(blocks: string[], key: string, now: Date): Date | null {
  const re = new RegExp(`"${key}"\\s*:\\s*"([^"]{8,40})"`, "g");
  for (const b of blocks) {
    let n = 0;
    for (const m of b.matchAll(re)) {
      const d = validDate(m[1], now);
      if (d) return d;
      if (++n > 50) break;
    }
  }
  return null;
}

/**
 * The page's own date and whether it is an "updated" date: when it was last updated if it says, else
 * when it was published. Reads meta tags (article:modified_time and friends), JSON-LD (dateModified,
 * datePublished, uploadDate), then <time>.
 */
export function parsePageDateInfo(html: string, now = new Date()): { date: Date; modified: boolean } | null {
  const head = html.slice(0, 600_000);
  const meta = metaDates(head);
  const blocks = ldBlocks(html);
  for (const k of MODIFIED_KEYS) {
    const d = validDate(meta.get(k), now);
    if (d) return { date: d, modified: true };
  }
  const ldModified = firstJsonDate(blocks, "dateModified", now);
  if (ldModified) return { date: ldModified, modified: true };
  for (const k of PUBLISHED_KEYS) {
    const d = validDate(meta.get(k), now);
    if (d) return { date: d, modified: false };
  }
  const ldPublished = firstJsonDate(blocks, "datePublished", now) ?? firstJsonDate(blocks, "uploadDate", now);
  if (ldPublished) return { date: ldPublished, modified: false };
  // Microdata JSON outside JSON-LD (YouTube keeps "publishDate" in a script).
  const anyModified = firstJsonDate([head], "dateModified", now);
  if (anyModified) return { date: anyModified, modified: true };
  const anyPublished = firstJsonDate([head], "datePublished", now) ?? firstJsonDate([head], "publishDate", now);
  if (anyPublished) return { date: anyPublished, modified: false };
  const times = findTags(head, "time", 30, 400);
  const pick = (tag: string) => validDate(attr(tag, "datetime"), now);
  const updated = times.find((tag) => /updat|modif/i.test(tag) && pick(tag));
  if (updated) return { date: pick(updated)!, modified: true };
  for (const tag of times) {
    const d = pick(tag);
    if (d) return { date: d, modified: false };
  }
  return null;
}

/** The page's own date (updated, else published), or null. */
export function parsePageDate(html: string, now = new Date()): Date | null {
  return parsePageDateInfo(html, now)?.date ?? null;
}

const HEAD_MAX = 300_000;

/** The page's title: og:title, else <title>, without a trailing "- YouTube" style site name for videos. */
export function pageTitle(html: string): string | null {
  const head = html.slice(0, HEAD_MAX);
  const ogTag = findTags(head, "meta", MAX_TAGS, 2_000).find((tag) => (attr(tag, "property") ?? attr(tag, "name"))?.toLowerCase() === "og:title");
  const og = ogTag ? attr(ogTag, "content") : null;
  const raw = (og && og.length >= 2 ? og.slice(0, 300) : null) ?? /<title\b[^<>]{0,300}>([^<]{2,300})<\/title>/i.exec(head)?.[1] ?? null;
  if (!raw) return null;
  const t = decodeEntities(raw).replace(/\s+/g, " ").replace(/\s+-\s+YouTube$/i, "").trim();
  return t.length >= 2 ? t.slice(0, 200) : null;
}

const IS_EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,}$/i;
const JUNK_EMAIL = /example|sentry|wixpress|noreply|no-reply|@2x|\.png|\.jpg|\.webp|\.svg/i;
const CONTACT_WORDS = /contact|write-for-us|advertis|work-with-us|become-a-supplier|sell-with-us|suppliers?/i;

const webUrl = (href: string, base: string): string | null => {
  try {
    const u = new URL(decodeEntities(href), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
};

/** The creator's channel link and name, from the itemprop="author" block of a video page. */
function videoAuthor(head: string): { url: string | null; name: string | null } {
  const lower = head.toLowerCase();
  let i = 0;
  for (let n = 0; n < 20; n++) {
    const at = lower.indexOf("itemprop", i);
    if (at === -1) break;
    i = at + 8;
    if (!/^\s*=\s*["']author["']/.test(lower.slice(at + 8, at + 30))) continue;
    let url: string | null = null;
    let name: string | null = null;
    for (const tag of findTags(head, "link", 10, 600, at, Math.min(head.length, at + 1_500))) {
      const prop = attr(tag, "itemprop")?.toLowerCase();
      if (prop === "url" && !url) url = attr(tag, "href");
      if (prop === "name" && !name) name = attr(tag, "content");
    }
    if (url || name) return { url, name: name && name.length >= 2 && name.length <= 80 ? name : null };
  }
  return { url: null, name: null };
}

/** Who wrote the page and how to reach them, from the page itself (free). */
export function contactFromHtml(html: string, url: string, kind?: OutreachKind): Pick<PageCheck, "authorName" | "email" | "contactUrl"> {
  const head = html.slice(0, HEAD_MAX);
  if (kind === "video") {
    const fromBlock = videoAuthor(head);
    const channel = fromBlock.url ?? /"ownerProfileUrl"\s*:\s*"([^"]{1,300})"/.exec(head)?.[1] ?? null;
    const name = fromBlock.name ?? /"ownerChannelName"\s*:\s*"([^"]{2,80})"/.exec(head)?.[1] ?? null;
    const channelUrl = channel ? webUrl(channel.replace(/\\u0026/g, "&"), url) : null;
    return {
      authorName: name ? decodeEntities(name).trim() : null,
      email: null, // creators list business emails behind a sign-in; the message goes through their channel
      contactUrl: channelUrl ? `${channelUrl.replace(/\/+$/, "")}/about` : null,
    };
  }
  const authorTag = findTags(head, "meta", MAX_TAGS, 1_000).find((tag) => attr(tag, "name")?.toLowerCase() === "author");
  const metaAuthor = authorTag ? attr(authorTag, "content") : null;
  const author =
    (metaAuthor && metaAuthor.length >= 3 && metaAuthor.length <= 60 ? metaAuthor : null) ??
    /"author"\s*:\s*(?:\[\s*)?\{[^{}]{0,800}"name"\s*:\s*"([^"]{3,60})"/i.exec(head)?.[1] ??
    null;
  const site = domainOf(url);
  const siteRoot = site.split(".").slice(-2).join(".");
  const mailtos: string[] = [];
  for (const m of head.matchAll(/mailto:([^"'?<>\s]{3,256})/gi)) {
    let e = m[1];
    try {
      e = decodeURIComponent(e);
    } catch {
      // keep it as written
    }
    if (IS_EMAIL.test(e) && !JUNK_EMAIL.test(e)) mailtos.push(e);
    if (mailtos.length >= 50) break;
  }
  const email = mailtos.find((e) => e.toLowerCase().endsWith(siteRoot)) ?? mailtos[0] ?? null;
  let contactHref: string | undefined;
  let n = 0;
  for (const m of head.matchAll(/href=["']([^"'<>\s]{1,400})["']/gi)) {
    if (CONTACT_WORDS.test(m[1])) {
      contactHref = m[1];
      break;
    }
    if (++n > 3_000) break;
  }
  return {
    authorName: author ? decodeEntities(author).trim() : null,
    email,
    contactUrl: contactHref ? webUrl(contactHref, url) : null,
  };
}

/** Read one cited page. Never throws: a page we can't read comes back with ok = false. */
export async function readCitedPage(url: string, m: MerchantNames, fetchPage: PageFetcher = guardedFetch, kind?: OutreachKind, now = new Date()): Promise<PageCheck> {
  const none: PageCheck = { ok: false, title: null, mentionsMerchant: null, modifiedAt: null, isModified: false, authorName: null, email: null, contactUrl: null };
  try {
    const res = await fetchPage(url);
    if (res.status < 200 || res.status >= 300 || !res.text || res.text.startsWith("%PDF")) return none;
    const date = parsePageDateInfo(res.text, now);
    return {
      ok: true,
      title: pageTitle(res.text),
      mentionsMerchant: pageNamesMerchant(res.text, m),
      modifiedAt: date?.date ?? null,
      isModified: date?.modified ?? false,
      ...contactFromHtml(res.text, res.url || url, kind),
    };
  } catch {
    return none; // blocked, slow, private address or not a web page
  }
}

// ---------- With the database ----------

const GENERIC_STOP = new Set(["the", "and", "for", "with", "best", "in", "of", "a", "an", "to", "my", "your"]);

/** The store's names and websites, for spotting it on a page, and the ordinary words of its catalogue. */
export async function merchantNames(shopId: string): Promise<MerchantNames> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, include: { profile: true } });
  const aliases = (shop.profile?.aliases as string[] | undefined) ?? [];
  const brandNames = [shop.profile?.brandName, shop.name, ...aliases].filter(
    (n, i, all): n is string => typeof n === "string" && n.trim().length > 0 && all.findIndex((x) => typeof x === "string" && sameBrand(x, n)) === i,
  );
  const [products, questions] = await Promise.all([
    db.product.findMany({ where: { shopId }, select: { title: true, productType: true }, take: 250 }),
    db.question.findMany({ where: { shopId }, select: { keyword: true }, take: 200 }),
  ]);
  const generic = new Set<string>();
  for (const s of [shop.profile?.category, ...products.flatMap((p) => [p.title, p.productType]), ...questions.map((q) => q.keyword)]) {
    for (const w of (s ?? "").toLowerCase().split(/[^a-z0-9À-ɏ']+/)) if (w.length >= 2 && !GENERIC_STOP.has(w)) generic.add(w);
  }
  // The brand's own words are not "ordinary" just because product titles repeat the brand.
  const own = new Set(brandNames.flatMap(coreWords));
  return {
    brandNames: brandNames.length ? brandNames : [shop.domain.split(".")[0]],
    domains: [shop.primaryDomain, shop.domain].filter((d): d is string => Boolean(d)),
    genericWords: [...generic].filter((w) => !own.has(w) || isCatalogueWord(w, products)),
  };
}

/** A brand word that is also what the store sells ("Oil" for a store called "Oil Co"): still ordinary. */
function isCatalogueWord(word: string, products: { productType: string | null }[]): boolean {
  return products.some((p) => (p.productType ?? "").toLowerCase().split(/\s+/).includes(word));
}

/** Page reads per week for a plan (free page reads, but polite and bounded). */
export function pageReadsPerWeek(planId: string): number {
  return getPlan(planId).pageReadsPerWeek;
}

/** Page reads this store has left this week (every read is logged in ApiCost at US$0). */
export async function pageChecksLeft(shopId: string, now = new Date(), perWeek?: number): Promise<number> {
  const cap = perWeek ?? pageReadsPerWeek((await db.shop.findUnique({ where: { id: shopId }, select: { plan: true } }))?.plan ?? "free");
  const used = await db.apiCost.count({ where: { shopId, provider: "web", endpoint: PAGE_READ_ENDPOINT, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } });
  return Math.max(0, cap - used);
}

/** Log page reads (US$0 each) so the weekly cap counts every read, whether or not it became a target. */
export async function logPageReads(shopId: string, n: number, now = new Date()) {
  if (n <= 0) return;
  await db.apiCost.createMany({ data: Array.from({ length: n }, () => ({ shopId, provider: "web", endpoint: PAGE_READ_ENDPOINT, usd: 0, createdAt: now })) });
}

export interface RecheckResult {
  read: number; // pages read
  reopened: string[]; // targets kept aside as "named" whose page no longer names the store (back to "new")
}

/**
 * Re-read the store's targets whose page check is missing or older than PAGE_CACHE_DAYS, most-cited
 * first, within `maxReads` (and the weekly cap): keeps the page date right and spots pages that now
 * name the store. A page that now names the store moves an unsent target aside ("named"); a sent one
 * stays, and the screen offers "Mark as done". A page kept aside that no longer names the store goes
 * back to "new" (returned in `reopened`, so a message can be written for it).
 */
export async function checkCitedPages(
  shopId: string,
  opts: { fetchPage?: PageFetcher; now?: Date; names?: MerchantNames; maxReads?: number } = {},
): Promise<RecheckResult> {
  const now = opts.now ?? new Date();
  const left = Math.min(await pageChecksLeft(shopId, now), opts.maxReads ?? Infinity);
  if (left <= 0) return { read: 0, reopened: [] };
  const due = await db.outreachTarget.findMany({
    where: {
      shopId,
      status: { in: ["new", "drafted", "sent", "replied", NAMED_STATUS] },
      OR: [{ pageCheckedAt: null }, { pageCheckedAt: { lt: new Date(now.getTime() - PAGE_CACHE_DAYS * DAY) } }],
    },
    orderBy: [{ timesCited: "desc" }, { createdAt: "asc" }],
    take: left,
  });
  if (!due.length) return { read: 0, reopened: [] };
  const names = opts.names ?? (await merchantNames(shopId));
  await logPageReads(shopId, due.length, now);
  const reopened: string[] = [];
  await pool(due, 4, async (t) => {
    const page = await readCitedPage(t.url, names, opts.fetchPage, t.kind as OutreachKind, now);
    const thread = t.kind === "forum" || t.kind === "qa";
    let status = t.status;
    if (page.ok && page.mentionsMerchant && (t.status === "new" || t.status === "drafted")) status = NAMED_STATUS;
    if (page.ok && page.mentionsMerchant === false && t.status === NAMED_STATUS) {
      status = "new";
      reopened.push(t.id);
    }
    await db.outreachTarget.update({
      where: { id: t.id },
      data: {
        pageCheckedAt: now,
        ...(status !== t.status ? { status } : {}),
        ...(page.ok ? { mentionsMerchant: page.mentionsMerchant } : {}),
        ...(page.modifiedAt ? { pageModifiedAt: page.modifiedAt } : {}),
        ...(!t.title && page.title ? { title: page.title } : {}),
        // Threads: never people's names or emails (we don't message thread users). Videos: no emails.
        ...(!thread && !t.authorName && page.authorName ? { authorName: page.authorName } : {}),
        ...(!thread && t.kind !== "video" && !t.email && page.email ? { email: page.email } : {}),
        ...(!thread && !t.contactUrl && page.contactUrl ? { contactUrl: page.contactUrl } : {}),
      },
    });
  });
  return { read: due.length, reopened };
}
