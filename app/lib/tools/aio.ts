/* eslint-disable @typescript-eslint/no-explicit-any -- reads raw third-party JSON of many shapes */
// The AI Overview Checker's pure parts: check and normalise the search, read the two providers'
// answers into one shape, compare a visitor's website with what Google cited and ranked, and pick the
// "What this means for you" lines. Used by the server (aio.server.ts), the page and the tests.
// Pure and browser-safe: no server imports. Provider text is shown as plain text, never as HTML.
//
// Providers (docs/tools/spec.md 0.1 and T1), both through Treg:
// - Crawl4AI `crawl4ai.google.serp.organic`: the real Google results page as JSON. `blocks` lists what
//   Google showed ("ai_overview" when there was one), `ai_overview.{text, sources[{title,url}]}` (the
//   text shown before "Show more"), `results[]` (normal results with `position`) and `people_also_ask`.
//   With no overview, `ai_overview` is left out (seen live on 11 Oct 2026, test/fixtures/tools/crawl4ai-serp-none.json).
//   Empty `results` come with `empty_reason` (Treg catalog, read 11 Oct 2026): "google_no_results" when
//   Google matched nothing, "rescue_no_results" when Crawl4AI couldn't get the page.
// - AnyAPI `anyapi.google.serp.ai_overview` (backup): `output.found` and
//   `output.data.{answer, answerMarkdown, citations[{title,url}]}`; no normal results.

import { domainOf } from "../answers";
import { guessSourceType, type SourceType } from "../sources";
import { MEANING, QUERY_LONG, QUERY_SHORT, YOUR_SITE } from "./copy/ai-overview-checker";

export const QUERY_MIN = 2;
export const QUERY_MAX = 200;
/** Crawl4AI's text is the part shown before "Show more"; we show at most this much of it. */
export const CUT_TEXT_MAX = 700;
/** AnyAPI returns the whole overview; we show at most this much. */
export const FULL_TEXT_MAX = 1_200;
const MAX_SOURCES = 30;
const MAX_ORGANIC = 10;
/** A normal-result place above this is junk (one Google page holds 10, Crawl4AI goes to 100). */
const MAX_POSITION = 100;
const MAX_PAA = 4;
const MAX_TITLE = 200;

export type AioProvider = "crawl4ai" | "anyapi";

export interface AioSource {
  url: string;
  title: string;
  domain: string;
  type: SourceType | null;
}

export interface AioOrganic {
  position: number;
  url: string;
  domain: string;
  title: string;
}

export interface AioResult {
  query: string;
  /** ISO date or date-time of the search. */
  checkedAt: string;
  country: "US";
  provider: AioProvider;
  shown: boolean;
  /** "" when not shown. */
  text: string;
  /** True when Google's "Show more" cut it (Crawl4AI). */
  textCut: boolean;
  sources: AioSource[];
  /** [] from AnyAPI. */
  organic: AioOrganic[];
  /** [] from AnyAPI. */
  peopleAlsoAsk: string[];
  /** True when the backup provider got an AI Mode answer instead of an AI Overview (shown is then false). */
  aiMode?: boolean;
}

// ---------- the search ----------

export type QueryCheck = { ok: true; query: string } | { ok: false; error: string };

// eslint-disable-next-line no-control-regex -- tabs, line breaks and other control characters become spaces
const CONTROL = /[\u0000-\u001f\u007f]/g;
/** Zero-width and other invisible format characters, dropped. */
const INVISIBLE = /[\u00ad\u200b-\u200f\u2060-\u2064\ufeff]/g;
const HAS_WORD = /[\p{L}\p{N}]/u;

/** The search as we send it: spaces tidied, case kept, 2 to 200 characters, at least one letter or number. */
export function checkQuery(input: unknown): QueryCheck {
  const raw = typeof input === "string" ? input : "";
  // Anything far too long is refused before any regex runs over it.
  if (raw.length > QUERY_MAX * 4) return { ok: false, error: QUERY_LONG };
  const q = raw.normalize("NFC").replace(CONTROL, " ").replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
  const length = Array.from(q).length;
  // "??" or a row of dots would still cost a paid search, for nothing.
  if (length < QUERY_MIN || !HAS_WORD.test(q)) return { ok: false, error: QUERY_SHORT };
  if (length > QUERY_MAX) return { ok: false, error: QUERY_LONG };
  return { ok: true, query: q };
}

/** The cache key: lowercase, spaces collapsed, trailing ? ! . dropped, NFC. "Beard oil?" and "beard  oil" share one. */
export function normalizeQuery(q: string): string {
  return q
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?!.]+$/, "")
    .trim();
}

// ---------- reading the providers ----------

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** An absolute http(s) address, or null (so a link out can never be javascript: or anything else). */
function webUrl(v: unknown): string | null {
  const s = str(v).trim();
  if (!s || s.length > 2_000) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A long dash or a mid dash with a space each side, as sites put before their name in page titles. */
const TITLE_DASHES = [" \u2014 ", " \u2013 "];

/**
 * A page title, tidied: spaces collapsed, a trailing site name after a spaced long or mid dash dropped
 * ("17 Best Sunscreens ... {dash} OSVI Dermatology" -> "17 Best Sunscreens ..."), at most 200 characters.
 */
export function cleanTitle(v: unknown): string {
  let t = str(v).slice(0, 1_000).replace(/\s+/g, " ").trim();
  const cut = Math.max(...TITLE_DASHES.map((d) => t.lastIndexOf(d)));
  if (cut >= 10) t = t.slice(0, cut).trim();
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1).trimEnd()}…` : t;
}

/** Text cut to `max` characters at a word break, with "…" when cut. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(space > max * 0.6 ? head.slice(0, space) : head).replace(/[\s,;:]+$/, "")}…`;
}

function toSources(list: unknown): AioSource[] {
  if (!Array.isArray(list)) return [];
  const out: AioSource[] = [];
  for (const item of list.slice(0, MAX_SOURCES)) {
    const url = webUrl(item?.url);
    if (!url) continue;
    const domain = domainOf(url);
    if (!domain) continue;
    out.push({ url, title: cleanTitle(item?.title) || domain, domain, type: guessSourceType(url, domain) });
  }
  return out;
}

function toOrganic(list: unknown): AioOrganic[] {
  if (!Array.isArray(list)) return [];
  const out: AioOrganic[] = [];
  for (const item of list.slice(0, 50)) {
    const url = webUrl(item?.url);
    const position = Number(item?.position);
    if (!url || !Number.isInteger(position) || position < 1 || position > MAX_POSITION) continue;
    const domain = domainOf(url);
    if (!domain) continue;
    out.push({ position, url, domain, title: cleanTitle(item?.title) || domain });
    if (out.length >= MAX_ORGANIC) break;
  }
  return out;
}

function toQuestions(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((q) => str(q).slice(0, 300).replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_PAA);
}

/** Crawl4AI's overview text ends with Google's "Show more" button label; drop it. */
const dropShowMore = (text: string) => text.replace(/\s*Show more\s*$/i, "").trim();

// Google's shopping cards inside an overview reach us as run-together text after the product's name: the
// price (and the old price), the shop, "& more" when several shops sell it, then the star rating and the
// number of ratings. Seen on 11 Oct 2026 (test/fixtures/tools/crawl4ai-serp-aio.json and
// small-crawl4ai-serp-flat-feet.json): "Brooks Adrenaline GTS 25 $124.95$155 Zappos.com& more 4.7 (2.1K)
// Widely considered ..." and "ASICS GT-2000 15 $160.00 ASICS 5.0 (2) A lightweight ...". The card's prices,
// shop and rating are dropped and the name ends with a full stop: "Brooks Adrenaline GTS 25. Widely
// considered ...". A price in Google's own sentences ("Price: ~$12.76 to $19.59 (2.5 fl oz)") has no "& more"
// glued to a shop name and no rating, so it stays. Every part is bounded (a shop name is at most 41 characters).
const CARD_PRICE = "(?:US|AU|A|CA|C|NZ)?[$\u00a3\u20ac]\\s?\\d{1,7}(?:,\\d{3}){0,3}(?:\\.\\d{1,2})?";
const CARD_RATING = "\\d(?:\\.\\d)?\\s?\\(\\d[\\d.,]{0,6}[KkMm]?\\)";
const CARD_SHOP = "[^\\s$\u00a3\u20ac&()][^$\u00a3\u20ac&()]{0,40}?";
const CARD = new RegExp(
  `\\s?${CARD_PRICE}(?:\\s?${CARD_PRICE})?(?:\\s?${CARD_SHOP}(?<!\\s)&\\s?more(?:\\s${CARD_RATING})?|\\s?(?:${CARD_SHOP}\\s)?${CARD_RATING})(?=\\s|$)`,
  "g",
);

/** The overview text with Google's shopping-card prices, shops and ratings taken out (see CARD). */
export function tidyOverviewText(text: string): string {
  return text
    .replace(CARD, ".")
    .replace(/([.!?:;,])\./g, "$1") // a name that already ended a sentence
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A Crawl4AI results page, or null when it isn't a usable one (the caller then asks the backup provider):
 * no `blocks` list, or neither an overview nor any normal result unless Google really matched nothing
 * (`empty_reason: "google_no_results"`). Otherwise a page Crawl4AI couldn't fetch would read as "No AI
 * Overview" and be kept for a day. A missing, null or empty `ai_overview` all mean "no AI Overview".
 */
export function parseCrawl4ai(raw: any, query: string, checkedAt: string): AioResult | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.blocks)) return null;
  const overview = raw.ai_overview && typeof raw.ai_overview === "object" ? raw.ai_overview : null;
  const text = tidyOverviewText(dropShowMore(str(overview?.text).slice(0, 20_000).replace(/\s+/g, " ").trim()));
  const shown = raw.blocks.includes("ai_overview") && text !== "";
  const organic = toOrganic(raw.results);
  if (!shown && !organic.length && raw.empty_reason !== "google_no_results") return null;
  return {
    query,
    checkedAt,
    country: "US",
    provider: "crawl4ai",
    shown,
    text: shown ? clip(text, CUT_TEXT_MAX) : "",
    // Crawl4AI always returns the text shown before "Show more", so it is always the start of the overview.
    textCut: shown,
    sources: shown ? toSources(overview?.sources) : [],
    organic,
    peopleAlsoAsk: toQuestions(raw.people_also_ask),
  };
}

/** Markdown to plain text, for the rare AnyAPI answer with no plain `answer`. */
function plainFromMarkdown(md: string): string {
  return md
    .replace(/\\([*#[\]()_`>-])/g, "$1")
    .replace(/\[([^\]\n]{0,300})\]\([^)\s]{0,2000}\)/g, "$1")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]*/gm, "")
    .replace(/^[ \t]{0,3}[-*][ \t]+/gm, "")
    .replace(/\*\*|__|`/g, "");
}

const AI_MODE = /^(?:#+\s*)?AI Mode replied/i;

/**
 * An AnyAPI answer, or null when the response isn't one (no `output`). `found: false` is a real answer:
 * Google showed no AI Overview. An answer that starts "AI Mode replied" is Google's AI Mode, not an AI
 * Overview, so it counts as not shown. A trailing "Share public link" line is dropped.
 */
export function parseAnyApi(raw: any, query: string, checkedAt: string): AioResult | null {
  const output = raw && typeof raw === "object" ? raw.output : null;
  if (!output || typeof output !== "object") return null;
  const base: AioResult = { query, checkedAt, country: "US", provider: "anyapi", shown: false, text: "", textCut: false, sources: [], organic: [], peopleAlsoAsk: [] };
  const data = output.data;
  if (!output.found || !data || typeof data !== "object") return base;
  const plain = str(data.answer).slice(0, 40_000);
  const markdown = str(data.answerMarkdown).slice(0, 40_000);
  if (AI_MODE.test(plain.trim()) || AI_MODE.test(plainFromMarkdown(markdown).trim())) return { ...base, aiMode: true };
  const lines = (plain.trim() ? plain : plainFromMarkdown(markdown))
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim());
  while (lines.length && (!lines[lines.length - 1] || /^share public link$/i.test(lines[lines.length - 1]))) lines.pop();
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return base;
  return { ...base, shown: true, text: clip(text, FULL_TEXT_MAX), textCut: text.length > FULL_TEXT_MAX, sources: toSources(data.citations) };
}

// ---------- the visitor's website ----------

const bare = (host: string) => host.trim().toLowerCase().replace(/\.$/, "").replace(/^www\./, "");

/**
 * Same website? Subdomains count both ways: shop.yourstore.com and www.yourstore.com count as
 * yourstore.com, and notyourstore.com doesn't.
 */
export function sameSite(domain: string, host: string): boolean {
  const a = bare(domain);
  const b = bare(host);
  if (!a || !b || !a.includes(".") || !b.includes(".")) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

export interface AioMatch {
  /** The visitor's website, without www. */
  host: string;
  /** Where it is cited: 1-based numbers in the overview's source list. */
  cited: number[];
  /** Its best place in the normal results, or null when it isn't in the top 10 (or there were none). */
  rank: number | null;
}

/** Compare the visitor's website with every cited link and every normal result. */
export function matchDomain(result: AioResult, host: string): AioMatch {
  const cited = result.sources.flatMap((s, i) => (sameSite(s.domain, host) ? [i + 1] : []));
  return { host: bare(host), cited, rank: bestRank(result, host) };
}

/** The best normal-results place of a website, or null. */
export function bestRank(result: AioResult, domain: string): number | null {
  const places = result.organic.filter((o) => sameSite(o.domain, domain)).map((o) => o.position);
  return places.length ? Math.min(...places) : null;
}

/** True when a normal result's website is also cited in the overview. */
export const isCited = (result: AioResult, domain: string) => result.sources.some((s) => sameSite(s.domain, domain));

/**
 * One page's address for comparing a cited link with a normal result: the host without www and the path
 * without a trailing slash. The query and #fragment are left out: cited links carry tracking (Walmart's
 * "?wmlspartner=...") and Google's text highlights ("#:~:text=...") that the ranked link doesn't.
 */
export function pageKey(url: string): string | null {
  try {
    const u = new URL(url);
    return `${bare(u.hostname)}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

const samePage = (a: string, b: string) => {
  const key = pageKey(a);
  return key !== null && key === pageKey(b);
};

/**
 * Where a cited page also ranks: that exact page's place in the normal results (`samePage`), or else the
 * best place of another page from its website. Two cited pages from one site then don't both claim the
 * place only one of them holds.
 */
export function sourceRank(result: AioResult, source: Pick<AioSource, "url" | "domain">): { rank: number; samePage: boolean } | null {
  const exact = result.organic.filter((o) => samePage(o.url, source.url)).map((o) => o.position);
  if (exact.length) return { rank: Math.min(...exact), samePage: true };
  const rank = bestRank(result, source.domain);
  return rank ? { rank, samePage: false } : null;
}

/** Is a normal result cited in the overview: "page" (that exact page), "site" (only another page from its website), or null. */
export function citedAs(result: AioResult, organic: Pick<AioOrganic, "url" | "domain">): "page" | "site" | null {
  if (result.sources.some((s) => samePage(s.url, organic.url))) return "page";
  return isCited(result, organic.domain) ? "site" : null;
}

/** The "Your site" line for a result (docs/tools/spec.md T1, result layout 2). */
export function yourSiteLine(result: AioResult, match: AioMatch): string | null {
  if (!result.shown) {
    if (!result.organic.length) return null; // nothing to compare with (the backup provider gives no ranks)
    return match.rank ? YOUR_SITE.noneRanks(match.rank) : YOUR_SITE.noneNotRanked;
  }
  if (match.cited.length) return YOUR_SITE.cited(match.cited[0], result.sources.length);
  if (!result.organic.length) return YOUR_SITE.notCitedNoRanks;
  return match.rank ? YOUR_SITE.ranksNotCited(match.rank) : YOUR_SITE.notCitedNotRanked;
}

// ---------- what it means ----------

/** "What this means for you": a line per kind of cited site, in a fixed order, then the tracking tip. */
export function meaningLines(result: AioResult): string[] {
  const types = new Set(result.sources.map((s) => s.type));
  const lines: string[] = [];
  if (types.has("editorial")) lines.push(MEANING.editorial);
  if (types.has("retailer")) lines.push(MEANING.retailer);
  if (types.has("ugc")) lines.push(MEANING.ugc);
  if (types.has("brand")) lines.push(MEANING.brand);
  return [...lines.slice(0, 3), MEANING.track];
}
