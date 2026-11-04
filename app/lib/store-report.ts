// Store reports for Ross's teardown videos (Ross, 3 Nov 2026). Ross types a Shopify store's address in
// Admin > Reports; about 3 minutes later the store has its own page at firstpicked.com.au/report/<slug>: what shoppers
// search, who ChatGPT, Gemini and Perplexity pick today, the sites AI trusts, the first 3 moves, every other move
// in full, and a month 1, 2, 3 plan of steps the store could follow itself. He screen-records it on his phone with himself green-screened on top, tags the brand
// and DMs them the link. Everything on the page comes from real data, and every number in a move must be one of
// the numbers we found (numbersOk). The page has no button: Ross does the ask out loud (Ross, 3 Nov 2026).
//
// This file is pure (tested in test/store-report.test.ts): no database, no network, no Claude.
// The job that fills a report is app/lib/store-report.server.ts; the page is app/routes/report.$slug.tsx;
// the admin page is app/routes/dash.admin.reports.tsx.

import type { CheckAnswer, CheckEngine } from "./check-types";
import { brandKey, sameBrand, textNamesBrand } from "./match";
import { isRivalDomain, noOutreach, outreachKind, type SourceType } from "./sources";

export const REPORT_ENGINES: CheckEngine[] = ["chatgpt", "gemini", "perplexity"];
export const REPORT_QUESTIONS = 4; // buying questions asked
export const REPORT_RUNS = 2; // each question twice per AI: answers vary run to run
export const REPORT_TOTAL = REPORT_QUESTIONS * REPORT_ENGINES.length * REPORT_RUNS; // 24 answers
export const REPORTS_PER_DAY = 40; // a backstop: about US$0.30 each
export const REPORTS_AT_ONCE = 10; // addresses per paste
export const EASY_DIFFICULTY = 30; // Serpstat difficulty (0 to 100) under this counts as "easy"
export const SHOWN_MOVES = 3; // "Your next 3 moves"; the rest show in full under "N more moves"
export const MAX_SEARCH_WORDS = 8;

/** Where a search word goes (the OpenSEO video's "Put it" column). */
export const PLACES = ["Product page", "Collection page", "Home page", "New guide", "Comparison guide", "FAQ"] as const;
export type Place = (typeof PLACES)[number];
/** Where a move happens: a place on the store, or off it. */
export const MOVE_PLACES = [...PLACES, "Sites AI trusts", "Reddit"] as const;
export type MovePlace = (typeof MOVE_PLACES)[number];

export type ReportStatus = "queued" | "reading" | "asking" | "writing" | "done" | "failed";

/** One search word with its Google numbers (Serpstat through Treg). */
export interface KeywordStat {
  keyword: string; // lowercased
  volume: number; // Google searches a month in the store's country
  difficulty: number | null; // 0 to 100; null when the provider gave none (DataForSEO backup)
  geo: string[]; // place names Serpstat found in the words, lowercased, e.g. ["australia"]
}

export interface SearchWord {
  keyword: string;
  volume: number;
  difficulty: number | null;
  place: Place;
}

export interface ReportStore {
  host: string; // the address the store lives at, e.g. bondiwash.com
  name: string; // the shop's name from Shopify's meta.json
  brand: string; // the brand name shoppers know
  sells: string; // one short plain sentence: what they sell and who for ("" when unknown)
  category: string; // 1 to 4 plain words, e.g. "natural dish soap"
  country: string; // ISO code the AIs were asked from (a country we check, else "US")
  countryName: string; // e.g. "Australia", "the US"
  products: number; // products read from the public catalog
  productsCapped: boolean; // true when there may be more (we read one page of 250)
  names: string[]; // the brand's names, for matching ("You" in the lists)
}

export interface RivalCount {
  name: string;
  count: number; // answers that named it
}

export interface SiteCount {
  domain: string;
  count: number; // answers that used it
  url: string; // its most-used page
  title: string | null;
  type?: SourceType | null; // its most-used page's kind (reports made before 4 Nov 2026 have none)
}

/** One real AI answer's pick list, for "Who AI picks now". */
export interface PickList {
  question: string;
  engine: CheckEngine;
  brands: string[]; // in the answer's order (max 8), the store's own name included when named
  named: boolean;
  // The store's real place in the answer (1 = first). When it came after the 8th, askOne keeps it in the last
  // row of `brands`, so this can be bigger than brands.length: the page then shows a gap before that row.
  position: number | null;
}

export interface Move {
  place: MovePlace;
  text: string; // one or two short sentences, with the number behind it
}

/** One step of the month plan: what to do, then how, with this store's own words and numbers. */
export interface MonthStep {
  title: string;
  how: string;
  list?: string[]; // things to copy, e.g. the buying questions to ask AI again
}

export interface MonthPlan {
  month: 1 | 2 | 3;
  title: string;
  steps: MonthStep[];
}

/** Everything the page shows. Saved as StoreReport.data. */
export interface StoreReportData {
  store: ReportStore;
  checkedAt: string; // ISO time the report finished
  questions: string[]; // the buying questions asked
  answers: number; // AI answers that came back
  named: number; // of those, how many named the store
  rivals: RivalCount[]; // most named first (max 8), the store left out
  rivalCount: number; // different brands named, the store left out
  sites: SiteCount[]; // most used first (max 5): only sites a store can get onto (no brands' own sites, see summarizeAnswers)
  siteCount: number; // different sites used, the store's own left out
  searchWords: SearchWord[]; // max 8, most searched first
  searches: number; // the searchWords' volumes added up
  picks: PickList | null;
  moves: Move[]; // most important first: SHOWN_MOVES on top, the rest under "N more moves"
  months: MonthPlan[];
  script: string[]; // Ross's 35-second script, one line per beat (admin only, never on the page)
  tags: string[]; // story tags for picking which stores to film, e.g. "Not named once"
  notes: string[]; // things Ross should know about this report (admin only), e.g. a backup was used
}

/** The data the month plan, script, moves and tags are built from. */
export type ReportFacts = Omit<StoreReportData, "moves" | "months" | "script" | "tags" | "notes">;

// Numbers in copy are written the way the page shows them: 1,900.
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

// Accents off ("Café" -> "cafe"), as brandKey does in match.ts.
const plainLetters = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

const SLUG_MAX = 40;

/** A short web-safe name for the page address, e.g. "Bondi Wash" -> "bondi-wash"; "-2", "-3" when taken. */
export function reportSlug(name: string, taken: (slug: string) => boolean): string {
  let base = plainLetters(String(name ?? "").toLowerCase())
    .replace(/&/g, " and ")
    .replace(/['\u2018\u2019`]/g, "") // "Nature's Way" -> "natures-way", not "nature-s-way"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length > SLUG_MAX) {
    const cut = base.slice(0, SLUG_MAX);
    const dash = cut.lastIndexOf("-");
    // Cut between words when we can, so the address doesn't end in half a word.
    base = (base[SLUG_MAX] === "-" ? cut : dash > 0 ? cut.slice(0, dash) : cut).replace(/-+$/, "");
  }
  if (!base) base = "store";
  if (!taken(base)) return base;
  for (let n = 2; n <= 50; n++) if (!taken(`${base}-${n}`)) return `${base}-${n}`;
  // A very common name: keep counting in base 36 so the address stays short. Bounded so it can never loop
  // forever; the database's unique index is the final guard.
  const LAST = 51 + 5000;
  for (let n = 51; n < LAST; n++) if (!taken(`${base}-${n.toString(36)}`)) return `${base}-${n.toString(36)}`;
  return `${base}-${LAST.toString(36)}`;
}

// Serpstat names its Google databases by country; the UK is "g_uk", not "g_gb".
const SERPSTAT_SE: Record<string, string> = {
  US: "g_us", GB: "g_uk", UK: "g_uk", AU: "g_au", CA: "g_ca", NZ: "g_nz", IE: "g_ie", DE: "g_de", FR: "g_fr",
  ES: "g_es", IT: "g_it", NL: "g_nl", BE: "g_be", AT: "g_at", CH: "g_ch", DK: "g_dk", SE: "g_se", NO: "g_no",
  FI: "g_fi", PL: "g_pl", PT: "g_pt", BR: "g_br", MX: "g_mx", IN: "g_in", SG: "g_sg", MY: "g_my", PH: "g_ph",
  ZA: "g_za", AE: "g_ae", HK: "g_hk", JP: "g_jp",
};

/** Serpstat's search engine code for a country, e.g. "AU" -> "g_au", "GB" -> "g_uk"; unknown -> "g_us". */
export function serpstatSe(country: string): string {
  return SERPSTAT_SE[String(country ?? "").trim().toUpperCase()] ?? "g_us";
}

const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const validHost = (h: string) => HOST_RE.test(h) && /\.[a-z]{2,}$/.test(h);

// The same cleaning as storeHost in public-catalog.server.ts (copied: this file stays pure), plus "www." off:
// Shopify's meta.json lookup follows redirects, so "www.store.com" and "store.com" are one store.
function hostOf(raw: string): string | null {
  const s = raw.trim().toLowerCase().slice(0, 300);
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`);
    if (u.username || u.password) return null; // an email address, not a store
    const host = u.hostname.replace(/\.$/, "");
    const bare = host.replace(/^www\./, "");
    return validHost(bare) ? bare : validHost(host) ? host : null;
  } catch {
    return null;
  }
}

/**
 * Store addresses from what Ross pasted (one per line, or split by commas or spaces): cleaned hosts, max
 * REPORTS_AT_ONCE, the other addresses past that (`more`, max 200), and the bits that weren't addresses.
 */
export function parseHosts(input: string): { hosts: string[]; bad: string[]; more: string[] } {
  const hosts: string[] = [];
  const bad: string[] = [];
  for (const raw of String(input ?? "").split(/[\s,;]+/)) {
    // Brackets and quotes around a pasted address, and list markers like "1." or "-", aren't part of it.
    const piece = raw.replace(/^[("'<[]+|[)"'>\]]+$/g, "").trim();
    if (!piece || /^(\d+[.)]?|[-*\u2022])$/.test(piece)) continue;
    const host = hostOf(piece);
    if (host) {
      if (!hosts.includes(host)) hosts.push(host);
    } else if (!bad.includes(piece.slice(0, 80)) && bad.length < 20) {
      bad.push(piece.slice(0, 80));
    }
  }
  return { hosts: hosts.slice(0, REPORTS_AT_ONCE), bad, more: hosts.slice(REPORTS_AT_ONCE, REPORTS_AT_ONCE + 200) };
}

const DIY_RE = /\b(diy|recipe|recipes|homemade|how to make|make your own)\b/;

// How each country can appear in a search (Serpstat's place names, lowercased). Countries we say with "the"
// ("the US") are also searched without it, or by another name.
const COUNTRY_WORDS: Record<string, string[]> = {
  "the us": ["us", "usa", "united states", "united states of america", "america"],
  "the uk": ["uk", "united kingdom", "great britain", "britain", "england"],
  "the uae": ["uae", "united arab emirates"],
  "the netherlands": ["netherlands", "holland"],
};

const keyOf = (keyword: string) => String(keyword ?? "").toLowerCase().trim().replace(/\s+/g, " ");
const byVolumeThenWord = (a: { keyword: string; volume: number }, b: { keyword: string; volume: number }) =>
  b.volume - a.volume || (a.keyword < b.keyword ? -1 : a.keyword > b.keyword ? 1 : 0);

/** Search words worth showing: real searches (10+ a month), no DIY or recipe searches, none about another country, no repeats; most searched first. */
export function cleanCandidates(stats: KeywordStat[], countryName: string): KeywordStat[] {
  const home = String(countryName ?? "").trim().toLowerCase();
  const ours = new Set([home, home.replace(/^the /, ""), ...(COUNTRY_WORDS[home] ?? [])]);
  const best = new Map<string, KeywordStat>();
  for (const s of stats ?? []) {
    const keyword = keyOf(s?.keyword ?? "");
    const volume = Number(s?.volume);
    if (!keyword || !Number.isFinite(volume) || volume < 10) continue;
    if (DIY_RE.test(keyword)) continue;
    if (keyword.length > 80 || keyword.split(" ").length > 8) continue;
    const geo = (Array.isArray(s.geo) ? s.geo : []).map((g) => String(g).trim().toLowerCase()).filter(Boolean);
    // A search that names a place outside the store's country ("dish soap usa" for an Aussie store) isn't theirs.
    if (geo.length && !geo.some((g) => ours.has(g))) continue;
    const difficulty = typeof s.difficulty === "number" && Number.isFinite(s.difficulty) ? s.difficulty : null;
    const had = best.get(keyword);
    if (!had || volume > had.volume) best.set(keyword, { keyword, volume: Math.round(volume), difficulty, geo });
  }
  return [...best.values()].sort(byVolumeThenWord);
}

/**
 * Search words without brand names: Serpstat's most searched ideas are often brand searches ("dawn dish soap",
 * or the store's own name), and a report must never tell a store to aim a page at another brand's name. A name
 * that the category itself contains (a store called "Candles" that sells candles) isn't used, or every word would go.
 */
export function dropBrandSearches(candidates: KeywordStat[], brandNames: string[], category: string): KeywordStat[] {
  const cat = keyOf(category);
  const names = [...new Set((brandNames ?? []).map((n) => String(n ?? "").trim()).filter(Boolean))].filter(
    (n) => !(cat && textNamesBrand(cat, [n])),
  );
  return (candidates ?? []).filter((c) => !textNamesBrand(c.keyword, names));
}

/** A sensible "Put it" place for a search word when Claude didn't pick one. */
export function guessPlace(keyword: string): Place {
  const k = keyOf(keyword);
  if (/\b(vs|versus|or|compare|comparison|alternative)\b/.test(k)) return "Comparison guide";
  if (/^(best|top|how|what|which|why|is|are|can|should)\b/.test(k) || ` ${k} `.includes(" for ")) return "New guide";
  if (/\b(gift|set|bundle|kit|collection|range)\b/.test(k)) return "Collection page";
  return "Product page";
}

const placeOf = (place: unknown): Place | undefined => {
  const p = String(place ?? "").trim().toLowerCase();
  return PLACES.find((x) => x.toLowerCase() === p);
};

/**
 * The search words table: Claude's picks (only words in `candidates`, with a known place), or, without picks,
 * the most searched candidates. Numbers always come from `candidates`, never from Claude. Most searched first.
 */
export function pickSearchWords(candidates: KeywordStat[], chosen: { keyword: string; place: string }[] | null, max = MAX_SEARCH_WORDS): SearchWord[] {
  const byKey = new Map<string, KeywordStat>();
  for (const c of candidates ?? []) {
    const k = keyOf(c.keyword);
    const had = byKey.get(k);
    if (k && (!had || c.volume > had.volume)) byKey.set(k, c);
  }
  const limit = Math.max(0, Math.floor(max));
  const out: SearchWord[] = [];
  const add = (keyword: string, place: Place) => {
    const c = byKey.get(keyword)!;
    out.push({ keyword, volume: c.volume, difficulty: c.difficulty, place });
  };
  for (const pick of chosen ?? []) {
    if (out.length >= limit) break;
    const k = keyOf(pick?.keyword ?? "");
    if (!byKey.has(k) || out.some((w) => w.keyword === k)) continue; // a word we have no numbers for, or a repeat
    add(k, placeOf(pick.place) ?? guessPlace(k));
  }
  if (out.length < 3) {
    const rest = [...byKey.entries()]
      .filter(([k]) => !out.some((w) => w.keyword === k))
      .sort(([ka, a], [kb, b]) => byVolumeThenWord({ keyword: ka, volume: a.volume }, { keyword: kb, volume: b.volume }));
    for (const [k] of rest) {
      if (out.length >= limit) break;
      add(k, guessPlace(k));
    }
  }
  return out.sort((a, b) => b.volume - a.volume);
}

/** The questions to ask the AIs: the most searched first (by their keyword's volume), keeping the given order on ties. */
export function topQuestions<T extends { keyword: string }>(questions: T[], volumes: Map<string, number>, n = REPORT_QUESTIONS): T[] {
  const volumeOf = (q: T) => volumes.get(keyOf(q.keyword)) ?? -1;
  // Array.prototype.sort is stable, so ties keep Claude's order.
  return [...questions].sort((a, b) => volumeOf(b) - volumeOf(a)).slice(0, Math.max(0, n));
}

const sameName = (a: string, b: string) => sameBrand(a, b) || keyOf(a) === keyOf(b);

// The main word of a site's address: "shop.bondiwash.com.au" -> "bondiwash".
function domainStem(domain: string): string {
  const labels = domain.replace(/^www\./, "").split(".");
  if (labels.length > 1) labels.pop();
  if (labels.length > 1 && ["com", "co", "net", "org", "gov", "edu", "ac"].includes(labels[labels.length - 1])) labels.pop();
  return labels[labels.length - 1] ?? "";
}

// One page however it was linked: with or without "www.", a trailing "/" or a "#part" (the first link seen is shown).
function pageKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return url;
  }
}

/**
 * Counts from the AI answers: who was named instead of the store, and which sites were used (each once per answer).
 * `siteCount` counts every site but the store's own. The `sites` list only has sites a store can get onto, like
 * the in-app outreach (outreach.server.ts): no brand's own pages (a rival's shop), no social profiles, no rival
 * brand's site or blog, and no Wikipedia, search engines, government or universities. Reddit, video sites and
 * shops stay: AI trusts them, and the page and moves say what to do there.
 */
export function summarizeAnswers(
  answers: CheckAnswer[],
  merchantNames: string[],
): Pick<StoreReportData, "answers" | "named" | "rivals" | "rivalCount" | "sites" | "siteCount"> {
  const used = (answers ?? []).filter((a) => a.ok && !a.empty);
  const names = (merchantNames ?? []).map((n) => String(n ?? "").trim()).filter(Boolean);
  const isMerchant = (brand: string) => names.some((m) => sameName(brand, m));
  // The store's own site under another address (bondiwash.com.au for bondiwash.com) isn't a site to get onto.
  const nameKeys = new Set(names.map(brandKey).filter((k) => k.length >= 4));
  const isOwnSite = (domain: string) => nameKeys.has(brandKey(domainStem(domain)));

  const rivals: RivalCount[] = [];
  type Page = { url: string; count: number; title: string | null; type: SourceType | null };
  const sites = new Map<string, { count: number; pages: Map<string, Page> }>();
  const allSites = new Set<string>();
  for (const a of used) {
    const counted = new Set<RivalCount>();
    for (const raw of a.brands ?? []) {
      const brand = String(raw ?? "").trim();
      if (!brand || isMerchant(brand)) continue;
      // Spellings of one brand ("The Groomed Man Co." and "Groomed Man Co") count as one; the first spelling stays.
      let rival = rivals.find((r) => sameName(r.name, brand));
      if (!rival) rivals.push((rival = { name: brand, count: 0 }));
      if (!counted.has(rival)) {
        counted.add(rival);
        rival.count++;
      }
    }
    const domainsHere = new Set<string>();
    const urlsHere = new Set<string>();
    for (const s of a.sources ?? []) {
      const domain = String(s.domain ?? "").trim().toLowerCase().replace(/^www\./, "");
      if (!domain || s.isOwn || isOwnSite(domain)) continue;
      allSites.add(domain);
      if (s.type === "brand") continue; // a brand's own page: the store can't get onto it
      let site = sites.get(domain);
      if (!site) sites.set(domain, (site = { count: 0, pages: new Map() }));
      if (!domainsHere.has(domain)) {
        domainsHere.add(domain);
        site.count++;
      }
      const url = String(s.url ?? "").trim();
      const key = pageKey(url);
      if (!key || urlsHere.has(key)) continue;
      urlsHere.add(key);
      // Page titles are the sites' own words: "Best soaps \u2013 Site" loses its dash (house style).
      const title = noDashes(String(s.title ?? "")) || null;
      const page = site.pages.get(key);
      if (page) {
        page.count++;
        page.title ??= title;
        page.type ??= s.type ?? null;
      } else site.pages.set(key, { url, count: 1, title, type: s.type ?? null });
    }
  }

  // A rival brand's own site or blog (koalaeco.com.au when AI named Koala Eco). Long keys only, like outreach.
  const rivalKeys = new Set(rivals.map((r) => brandKey(r.name)).filter((k) => k.length >= 6));
  const canGetOnto = (s: SiteCount) => {
    if (noOutreach(s.domain)) return false;
    const kind = outreachKind(s.url, s.domain, s.type);
    // A shop is never a rival's own site: AI naming a brand doesn't make the shop that sells it theirs.
    return kind !== "other" && (kind === "retailer" || !isRivalDomain(s.domain, rivalKeys));
  };
  // Map and sort keep the order things were first seen, so ties go to the first seen.
  const siteList: SiteCount[] = [...sites.entries()]
    .map(([domain, s]) => {
      let top: Page = { url: "", count: 0, title: null, type: null };
      for (const p of s.pages.values()) if (p.count > top.count) top = p;
      return { domain, count: s.count, url: top.url || `https://${domain}/`, title: top.title, type: top.type };
    })
    .filter(canGetOnto)
    .sort((a, b) => b.count - a.count);
  return {
    answers: used.length,
    named: used.filter((a) => a.named).length,
    rivals: [...rivals]
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map((r) => ({ name: noDashes(r.name) || r.name, count: r.count })),
    rivalCount: rivals.length,
    sites: siteList.slice(0, 5),
    siteCount: allSites.size,
  };
}

/**
 * Sites to email or "get onto" in the moves and month 1: articles and roundups only (what Done for you pitches),
 * never Reddit (the Reddit move covers it), a video site's address, a shop or a review platform.
 */
export function articleSites(sites: SiteCount[]): SiteCount[] {
  return (sites ?? []).filter((s) => outreachKind(s.url, s.domain, s.type) === "article");
}

const ENGINE_ORDER: CheckEngine[] = ["chatgpt", "gemini", "perplexity"];
const engineRank = (e: CheckEngine) => (ENGINE_ORDER.indexOf(e) === -1 ? ENGINE_ORDER.length : ENGINE_ORDER.indexOf(e));

/** One real answer to show as "Who AI picks now": the top question first, ChatGPT first, needing 2+ brands. */
export function pickList(answers: CheckAnswer[], questions: string[]): PickList | null {
  for (let q = 0; q < (questions ?? []).length; q++) {
    const best = (answers ?? [])
      .filter((a) => a.question === q && a.ok && !a.empty && (a.brands ?? []).length >= 2)
      .sort((a, b) => engineRank(a.engine) - engineRank(b.engine) || a.run - b.run)[0];
    if (!best) continue;
    const brands = best.brands.slice(0, 8).map((b) => noDashes(b) || b);
    // The real place, even past the 8th: askOne then keeps the store in the last row (the page shows a gap).
    return { question: questions[q], engine: best.engine, brands, named: best.named, position: best.position };
  }
  return null;
}

// "1,900" is one number; "100,200" in a list of numbers is two (a thousands comma is followed by 3 digits).
const NUMBER_RE = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

// "1,900" -> "1900", "007" -> "7", "4.50" -> "4.5": the same number always reads the same.
function normNumber(token: string): string {
  const [int, dec = ""] = token.replace(/,/g, "").split(".");
  const i = int.replace(/^0+(?=\d)/, "");
  const d = dec.replace(/0+$/, "");
  return d ? `${i}.${d}` : i;
}

const numbersIn = (text: string) => (String(text ?? "").match(NUMBER_RE) ?? []).map(normNumber);

function addNumbers(text: string, out: Set<string>) {
  for (const n of numbersIn(text)) {
    out.add(n);
    // A decimal also counts as its whole part and rounded ("23.7" -> "23" and "24").
    if (n.includes(".")) {
      out.add(n.split(".")[0]);
      out.add(String(Math.round(Number(n))));
    }
  }
}

function collectNumbers(value: unknown, out: Set<string>, depth: number): void {
  if (value === null || value === undefined || depth > 30) return;
  if (typeof value === "number") return Number.isFinite(value) ? addNumbers(String(value), out) : undefined;
  if (typeof value === "string" || typeof value === "bigint") return addNumbers(String(value), out);
  if (typeof value !== "object") return;
  // Walk the values instead of reading JSON text: in JSON, [100,200] would read as the number 100,200.
  const json = (value as { toJSON?: () => unknown }).toJSON;
  if (typeof json === "function") return collectNumbers(json.call(value), out, depth + 1);
  if (value instanceof Map) {
    for (const [k, v] of value) {
      collectNumbers(k, out, depth + 1);
      collectNumbers(v, out, depth + 1);
    }
    return;
  }
  if (value instanceof Set || Array.isArray(value)) {
    for (const v of value) collectNumbers(v, out, depth + 1);
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    addNumbers(k, out);
    collectNumbers(v, out, depth + 1);
  }
}

/** Every number written anywhere in these values (commas dropped: "1,900" -> "1900"). */
export function knownNumbers(...values: unknown[]): Set<string> {
  const out = new Set<string>();
  for (const v of values) collectNumbers(v, out, 0);
  return out;
}

// Month and step numbers ("Month 1", "step 2") can always be written.
const ALWAYS_OK = new Set(["1", "2", "3"]);

/** True when every number in the text is a known one. (Loose: for tests of built copy. Moves use movesNumbersOk.) */
export function numbersOk(text: string, known: Set<string>): boolean {
  return numbersIn(text).every((n) => ALWAYS_OK.has(n) || known.has(n));
}

/** What a move may quote numbers from, each number tied to what it is about. Built from the data Claude saw. */
export interface MoveFacts {
  answers: number; // AI answers that came back
  named: number; // of those, how many named the store
  rivalCount: number;
  siteCount: number;
  products: number;
  questions: string[]; // the buying questions asked
  position: number | null; // the store's place in the one real answer shown
  keywords: { keyword: string; volume: number; difficulty: number | null }[]; // the candidate list
  rivals: RivalCount[];
  sites: { domain: string; count: number }[];
  brands: string[]; // other brand names with no count (the pick list)
}

// A count written in words can't be checked ("in nine answers"), nor can a share or a multiple.
const NUMBER_WORDS =
  /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundreds?|thousands?|millions?|dozens?|half|twice|thrice)\b|%|\bper ?cent\b|\b\d+x\b/i;
// "one" is everyday English ("add one FAQ"), so it only counts as a number next to what's counted.
const ONE_COUNT = /\bone\b(?:\s+\S+){0,3}?\s+(answers?|searches|times|sites?|brands?|shoppers|people)\b/i;
// What follows a number that makes it a count: "9 answers", "9 of 24 answers", "1,900 Google searches".
const COUNT_AFTER = /^\s*(?:of\s+[\d,]+\s+)?(?:\S+\s+){0,2}?(answers?|searches|searched|times|sites|brands|people|shoppers)\b/i;
const DOMAIN_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi;
const QUOTED_RE = /["“]([^"“”]+)["”]/g;

/**
 * True when every number in a move is a real one for what the move names. A quoted search word may only carry
 * its own searches and difficulty (and "of 100"), a site or brand only its own count, and any of them "of N"
 * answers. A move naming none of these may use the report's totals. 1, 2 and 3 are fine as steps or months,
 * never as a count of answers or searches that isn't real. Number words, % and "3x" are never allowed.
 */
export function movesNumbersOk(text: string, f: MoveFacts): boolean {
  const t = String(text ?? "");
  if (NUMBER_WORDS.test(t) || ONE_COUNT.test(t)) return false;
  const keywordsByKey = new Map((f.keywords ?? []).map((k) => [keyOf(k.keyword), k]));
  const questionKeys = new Set((f.questions ?? []).map((q) => keyOf(q).replace(/[?.!]+$/, "")));

  // What the move names.
  const quoted = [...t.matchAll(QUOTED_RE)].map((m) => ({ raw: m[0], key: keyOf(m[1]).replace(/[?.!]+$/, "") }));
  const keywords = quoted.map((q) => keywordsByKey.get(q.key)).filter((k): k is MoveFacts["keywords"][number] => Boolean(k));
  // A quoted search word or question is a name, not a claim: its own digits ("serum 2026") aren't checked.
  let body = t;
  for (const q of quoted) if (keywordsByKey.has(q.key) || questionKeys.has(q.key)) body = body.replace(q.raw, " ");
  const domains = [...body.matchAll(DOMAIN_RE)].map((m) => m[0].toLowerCase().replace(/^www\./, ""));
  const sites = (f.sites ?? []).filter((s) => domains.includes(s.domain.toLowerCase()));
  const rivals = (f.rivals ?? []).filter((r) => textNamesBrand(body, [r.name]));
  const namesSomething =
    quoted.length > 0 || domains.length > 0 || rivals.length > 0 || (f.brands ?? []).some((b) => textNamesBrand(body, [b]));

  const allowed = new Set<string>();
  const add = (n: number | null | undefined) => {
    if (typeof n === "number" && Number.isFinite(n)) allowed.add(normNumber(String(Math.round(n))));
  };
  if (namesSomething) {
    for (const k of keywords) {
      add(k.volume);
      add(k.difficulty);
      if (k.difficulty !== null) add(100); // "difficulty 18 of 100"
    }
    for (const s of sites) add(s.count);
    for (const r of rivals) add(r.count);
    add(f.answers);
  } else {
    for (const n of [f.answers, f.named, f.rivalCount, f.siteCount, f.products, (f.questions ?? []).length, f.position]) add(n);
  }

  // A site's address isn't a number either ("top5.com.au").
  const words = body.replace(DOMAIN_RE, " ");
  for (const m of words.matchAll(NUMBER_RE)) {
    const n = normNumber(m[0]);
    if (allowed.has(n)) continue;
    if (ALWAYS_OK.has(n) && !COUNT_AFTER.test(words.slice((m.index ?? 0) + m[0].length))) continue;
    return false;
  }
  return true;
}

/** House style: no em dashes or spaced en dashes; ranges use "to". */
export function noDashes(text: string): string {
  return String(text ?? "")
    .replace(/(\d)\s*–\s*(?=\d)/g, "$1 to ") // an en dash between numbers is a range: "10 to 20"
    .replace(/(\d)[—―](?=\d)/g, "$1 to ") // so is an em dash with no spaces
    .replace(/[ \t]*[—―][ \t]*/g, ", ") // any other em dash becomes a comma: "soap, great"
    .replace(/[ \t]+–[ \t]*|[ \t]*–[ \t]+/g, ", ") // a spaced en dash too; one with no spaces between words stays
    .replace(/[ \t]+--[ \t]+/g, ", ")
    .replace(/ {2,}/g, " ")
    .replace(/[ \t]+,/g, ",")
    .replace(/,(\s*,)+/g, ",")
    .replace(/,\s*([.!?;:)])/g, "$1")
    .replace(/^\s*,\s*/, "")
    .replace(/\s*,\s*$/, "")
    .trim();
}

// Words that would make a move untrue or against our rules (CLAUDE.md §11: no promises, no fake reviews,
// no posing as a customer, no bought, paid, sponsored or swapped links or spots).
const BANNED_RE =
  /\b(guarantee|guarantees|guaranteed|promise|promises|promised|fake reviews?|pretend|pretending|as a customer|pos(e|ing) as|buy links?|buying links?|paid links?|link swaps?|link exchanges?|sponsor|sponsors|sponsored|sponsorships?|pay(s|ing)? (for|to|them|him|her|a|an|the)|paid (posts?|spots?|placements?|features?|reviews?|mentions?|listings?|articles?)|affiliates?)\b/i;

// A Reddit move must say the store is the one writing (the in-app Reddit drafts do the same, reddit.server.ts).
const MENTIONS_REDDIT = /\breddit\b|(^|\s)\/?r\/[a-z0-9_]+/i;
const SAYS_WHO = /\b(say(s|ing)?\s+(who|you(?:'|’)?re|you are|it(?:'|’)?s you)|who you are|who(?:'|’)s writing|founder|owner|disclos(e|es|ed|ing))\b/i;

/** Claude's moves, kept only when true and tidy: a known place, short plain text, only real numbers, no repeats. */
export function cleanMoves(raw: { place: string; text: string }[], facts: MoveFacts, max = 15): Move[] {
  const out: Move[] = [];
  const seen = new Set<string>();
  for (const r of raw ?? []) {
    if (out.length >= max) break;
    const place = MOVE_PLACES.find((p) => p.toLowerCase() === String(r?.place ?? "").trim().toLowerCase());
    if (!place) continue;
    let text = noDashes(String(r?.text ?? "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim());
    // The page shows the place in bold already, so "FAQ: add ..." loses its "FAQ:".
    if (text.toLowerCase().startsWith(`${place.toLowerCase()}:`)) {
      text = text.slice(place.length + 1).trim();
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }
    if (text.length < 12 || text.length > 240) continue;
    if (/http/i.test(text) || BANNED_RE.test(text) || !movesNumbersOk(text, facts)) continue;
    if ((place === "Reddit" || MENTIONS_REDDIT.test(text)) && !SAYS_WHO.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ place, text });
  }
  return out;
}

const answersWord = (n: number) => (n === 1 ? "answer" : "answers");

/** Moves built only from the data (when Claude can't write them, or wrote too few). */
export function fallbackMoves(f: ReportFacts): Move[] {
  const category = f.store.category.trim() || "products";
  const words: Move[] = f.searchWords.map((w) => ({
    place: w.place,
    text: `Aim it at "${w.keyword}". About ${fmt(w.volume)} Google searches a month${w.difficulty !== null ? `, difficulty ${Math.round(w.difficulty)} of 100` : ""}.`,
  }));
  const sites: Move[] = articleSites(f.sites).slice(0, 3).map((s) => ({
    place: "Sites AI trusts",
    text: `Get your ${category} onto ${s.domain}. AI used it in ${fmt(s.count)} of ${fmt(f.answers)} answers.`,
  }));
  const rivals: Move[] = f.rivals.slice(0, 2).map((r) => ({
    place: "Comparison guide",
    text: `Write an honest guide on how your ${category} compares with ${r.name}. AI named ${r.name} in ${fmt(r.count)} ${answersWord(r.count)}.`,
  }));
  const faqs: Move[] = f.questions.slice(0, 2).map((q) => ({ place: "FAQ", text: `Answer "${q}" in plain words on your product page.` }));
  const reddit: Move = { place: "Reddit", text: `Reply honestly where shoppers ask about ${category}, and always say you're from ${f.store.brand}.` };

  // Lead with a product page word (or the top word), then a new guide, then the top site; the rest take turns
  // by kind so the "more moves" list shows a mix of places.
  const productAt = f.searchWords.findIndex((w) => w.place === "Product page");
  const first = productAt >= 0 ? productAt : 0;
  const guideAt = f.searchWords.findIndex((w, i) => i !== first && w.place === "New guide");
  const lead = [words[first], guideAt >= 0 ? words[guideAt] : undefined, sites[0]];
  const groups = [words.filter((_, i) => i !== first && i !== guideAt), sites.slice(1), rivals, faqs, [reddit]];
  const rest: Move[] = [];
  for (let i = 0; groups.some((g) => i < g.length); i++) for (const g of groups) if (i < g.length) rest.push(g[i]);

  const out: Move[] = [];
  const seen = new Set<string>();
  for (const m of [...lead, ...rest]) {
    if (!m) continue;
    const text = noDashes(m.text);
    if (seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push({ place: m.place, text });
  }
  return out;
}

/**
 * Month 1, 2, 3: the steps the store could follow itself, with its own search words, sites and rivals (Ross,
 * 4 Nov 2026: "actionable steps that the brand could actually follow and not how we work"). The steps come from
 * docs/geo-research.md. They say what to check, never that something is broken: we didn't look at the store's
 * pages or its robots.txt.
 */
export function buildMonths(f: ReportFacts): MonthPlan[] {
  const { host, brand, products, productsCapped } = f.store;
  const kind = f.store.category.trim(); // "natural dish soap", or "" when we couldn't tell
  const category = kind || "products";
  const words = f.searchWords ?? [];
  const questions = f.questions ?? [];
  const searches = (w: SearchWord) => `About ${fmt(w.volume)} ${w.volume === 1 ? "search" : "searches"} a month.`;
  const firstOn = (...places: Place[]) => words.find((w) => places.includes(w.place));

  // Month 1: their own store.
  const productWord = firstOn("Product page");
  const pageWord = firstOn("Collection page", "Home page");
  const wordLines = [
    productWord ? `Put "${productWord.keyword}" in the title and first line of the product page it fits. ${searches(productWord)}` : "",
    pageWord ? `Do the same with "${pageWord.keyword}" on your ${pageWord.place === "Home page" ? "home page" : "collection page"}. ${searches(pageWord)}` : "",
  ].filter(Boolean);
  const faq = questions.find((q) => !/\bbest\b/i.test(q)) ?? questions[0];
  const count = products > 0 ? ` of your ${fmt(products)}${productsCapped ? "+" : ""} ${products === 1 && !productsCapped ? "product" : "products"}` : "";
  const month1: MonthStep[] = [
    {
      title: "Check AI can read your store",
      how: `Open ${host}/robots.txt. Make sure it doesn't block Googlebot, OAI-SearchBot or PerplexityBot. Google, ChatGPT and Perplexity use them to read your pages. If one is blocked, remove that rule.`,
    },
    {
      title: "Put the key facts first on every product page",
      how: `Start each page with one plain line: what it is, who it's for, and the main facts like size and what it's made of. Do your best sellers first, then the rest${count}.`,
    },
    ...(wordLines.length ? [{ title: "Use the words shoppers search", how: wordLines.join(" ") }] : []),
    {
      title: "Add a short FAQ to your product pages",
      how: faq
        ? `Answer the questions shoppers ask AI, like "${faq}" Put each question in bold, with a short, clear answer under it.`
        : "Answer the questions shoppers ask before they buy. Put each question in bold, with a short, clear answer under it.",
    },
    {
      title: "Fill in every product's details in Shopify",
      how: "Set the category, product type, tags and each size or colour. AI shopping tools can read these facts, so leave none blank.",
    },
  ];

  // Month 2: buying guides on their own store.
  const guideWords = words.filter((w) => w.place === "New guide" || w.place === "Comparison guide");
  const guide = guideWords.find((w) => w.place === "New guide") ?? guideWords[0];
  const [rival] = f.rivals ?? [];
  const versus = rival ? undefined : guideWords.find((w) => w.place === "Comparison guide" && w !== guide);
  const next = guideWords.filter((w) => w !== guide && w !== versus).slice(0, 3).map((w) => `"${w.keyword}"`);
  const month2: MonthStep[] = [
    {
      title: "Write your first buying guide",
      how: `${guide ? `Make it about "${guide.keyword}". ${searches(guide)} ` : "Pick the question shoppers ask most before they buy. "}Answer the question in the first lines. Then compare real options and say who each one suits.`,
    },
    {
      title: "Write an honest comparison",
      how: `${
        rival
          ? `Compare your ${category} with ${rival.name}. AI named ${rival.name} in ${fmt(rival.count)} ${answersWord(rival.count)}.`
          : versus
            ? `Aim it at "${versus.keyword}". ${searches(versus)}`
            : `Compare your ${category} with the brands shoppers weigh you against.`
      } Be fair, and say where the other side does better too.`,
    },
    {
      title: "Add a new guide every week",
      how: `Each one answers one buying question.${next.length ? ` Next up: ${joinAnd(next)}.` : ""}`,
    },
    {
      title: "Link your guides and products",
      how: "Each guide links to the products it talks about, and each product page links back. It helps shoppers and Google find both.",
    },
    {
      title: "Add something only you have",
      how: `Real photos of your ${category} in use, a size chart or a simple table of your range. A page that says what every other page says gives AI no reason to quote you.`,
    },
  ];

  // Month 3: other sites, then check what changed.
  const [site1, site2] = articleSites(f.sites ?? []);
  const reddit = (f.sites ?? []).find((s) => s.domain.toLowerCase() === "reddit.com");
  const month3: MonthStep[] = [
    {
      title: "Email the sites AI trusts",
      how: `${
        site1
          ? `Start with ${site1.domain}${site2 ? ` and ${site2.domain}` : ""}. Find the writer's name,`
          : `Search Google for ${kind ? `"best ${kind}"` : "the best of what you sell"} and find the lists that name other brands but not you. Find the writer's name,`
      } say who you are, and ask if your ${category} fits their list. Offer to send a sample.`,
    },
    {
      title: "Follow up once",
      how: "No reply after a week? Send one short, friendly follow up. Never pay for a spot on a list.",
    },
    {
      title: "Join the chats on Reddit",
      how: `${reddit ? `AI used reddit.com in ${fmt(reddit.count)} of ${fmt(f.answers)} answers. ` : ""}Search Reddit for ${kind ? `"${kind}"` : "what you sell"} and help with real questions. Always say you're from ${brand}, and never pretend to be a customer.`,
    },
    {
      title: "Ask AI again",
      how: "Ask ChatGPT, Gemini and Perplexity the same questions we asked. Write down who they name and which sites they use, then compare with this report.",
      ...(questions.length ? { list: questions } : {}),
    },
    {
      title: "Look for visits from AI",
      how: "In Shopify Analytics, see where your visits came from. Look for chatgpt.com, perplexity.ai and gemini.google.com.",
    },
    {
      title: "Keep it going every month",
      how: "Write a new guide each week and update old ones every 2 to 3 months. Ask AI your questions again each month, and email any new sites it starts to use.",
    },
  ];

  const plans: MonthPlan[] = [
    { month: 1, title: "Fix your own store", steps: month1 },
    { month: 2, title: "Write buying guides", steps: month2 },
    { month: 3, title: "Get named on other sites", steps: month3 },
  ];
  return plans.map((m) => ({
    ...m,
    steps: m.steps.map((s) => ({ ...s, title: noDashes(s.title), how: noDashes(s.how), ...(s.list ? { list: s.list.map(noDashes) } : {}) })),
  }));
}

// "a", "a and b", "a, b and c".
const joinAnd = (items: string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

// First words that are names and keep their capital letter in the middle of a sentence.
const KEEP_CAPS = new Set([
  "i", "australia", "australian", "aussie", "kiwi", "american", "british", "english", "irish", "scottish", "welsh", "canadian",
  "european", "french", "italian", "german", "japanese", "korean", "chinese", "indian", "thai", "mexican", "spanish",
  "greek", "nordic", "scandinavian", "swedish", "danish", "dutch", "swiss", "christmas", "easter", "google", "chatgpt",
  "gemini", "perplexity", "reddit", "shopify", "amazon", "instagram", "tiktok", "facebook", "youtube", "etsy", "ebay",
]);

// "Natural dish soap" -> "natural dish soap", for the middle of a sentence. Names, short forms ("FAQ"), words
// like "iPhone" and quotes keep their first letter.
function lowerFirst(text: string, names: string[] = []): string {
  if (!text || /^["'\u201c\u2018(]/.test(text)) return text;
  const first = text.split(/[\s,.:;!?'\u2019-]/)[0]; // "Australian-made" -> "Australian"
  if (first.length > 1 && /[A-Z]/.test(first) && first === first.toUpperCase()) return text;
  if (/[A-Z]/.test(first.slice(1))) return text;
  if (KEEP_CAPS.has(first.toLowerCase()) || /^New (Zealand|York|South Wales)\b/.test(text)) return text;
  if (names.some((n) => n && /^[A-Z]/.test(n) && text.startsWith(n) && !/[A-Za-z0-9]/.test(text.charAt(n.length)))) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// "They sell natural dish soap. " from the store's one-line description, however Claude started it.
function sellsLine(sells: string, brand: string): string {
  let s = sells.replace(/\s+/g, " ").trim().replace(/[.!\s]+$/, "");
  if (!s) return "";
  const verb = s.match(/^(sells|makes|offers|creates|designs|crafts|brews|bakes)\b/i);
  if (/^(we|they)('re|\u2019re| are)\b/i.test(s)) s = s.replace(/^(we|they)/i, "They");
  else if (/^we\b/i.test(s)) s = s.replace(/^we/i, "They");
  else if (/^our\b/i.test(s)) s = s.replace(/^our/i, "Their");
  else if (/^they\b/i.test(s)) s = `They${s.slice(4)}`;
  else if (verb) s = `They ${verb[1].toLowerCase().slice(0, -1)}${s.slice(verb[1].length)}`;
  else if (!(brand && s.toLowerCase().startsWith(brand.toLowerCase()))) s = `They sell ${lowerFirst(s)}`;
  return `${s}. `;
}

// The first sentence of a move, ignoring full stops inside quotes, web addresses and "e.g.".
function firstSentence(text: string): string {
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    else if (c === "\u201c") quoted = true;
    else if (c === "\u201d") quoted = false;
    else if (!quoted && /[.!?]/.test(c) && (i + 1 === text.length || /\s/.test(text[i + 1])) && !/\b(e\.g|i\.e|etc|vs)$/i.test(text.slice(0, i))) {
      return text.slice(0, i + 1);
    }
  }
  return text;
}

// How Ross says a move out loud: the fallback 'Aim it at "x"' needs its place to make sense on its own.
function spokenMove(m: Move, names: string[]): string {
  let s = firstSentence(m.text).trim().replace(/[.!]+$/, "");
  const aim = s.match(/^Aim it at (.+)$/);
  if (aim) {
    const target = aim[1];
    if (m.place === "New guide" || m.place === "Comparison guide") s = `write ${m.place === "New guide" ? "a new guide" : "a comparison guide"} for ${target}`;
    else if (m.place === "FAQ") s = `answer ${target} in your FAQ`;
    else if (m.place === "Collection page") s = `aim a collection page at ${target}`;
    else if (m.place === "Home page") s = `aim your home page at ${target}`;
    else s = `aim your product page at ${target}`;
  }
  return lowerFirst(s, names);
}

/** Ross's script, about 35 seconds, filled in with this store's numbers. */
export function buildScript(f: ReportFacts, moves: Move[]): string[] {
  const { brand, country, sells } = f.store;
  const who = country === "AU" ? "Aussie" : country === "NZ" ? "Kiwi" : "Shopify";
  const lines: string[] = [];
  lines.push(`Episode ___ of helping ${who} brands get picked by AI. Today it's ${brand}.`);
  lines.push(`${sellsLine(sells ?? "", brand)}I asked ChatGPT, Gemini and Perplexity ${fmt(f.questions.length)} questions their buyers ask, twice each.`);

  if (f.answers === 0) lines.push("No AI answers came back this time.");
  else {
    const times = f.named === 1 ? "time" : "times";
    const [r1, r2] = f.rivals;
    // The rivals leave the store out: when it was named as often as the top rival, they weren't picked "the most".
    const picked = !r1
      ? ""
      : f.named < r1.count
        ? r2
          ? ` AI picked ${r1.name} and ${r2.name} the most.`
          : ` AI picked ${r1.name} the most.`
        : r2
          ? ` The other brands AI picked most were ${r1.name} and ${r2.name}.`
          : ` The other brand AI picked most was ${r1.name}.`;
    lines.push(`${brand} came up ${fmt(f.named)} ${times} out of ${fmt(f.answers)}.${picked}`);
  }

  const easyWords = f.searchWords.filter((w) => w.difficulty !== null && w.difficulty <= EASY_DIFFICULTY);
  const mostSearched = (list: SearchWord[]) => [...list].sort((a, b) => b.volume - a.volume)[0];
  const best = mostSearched(easyWords) ?? mostSearched(f.searchWords);
  if (best) {
    const easy = best.difficulty !== null && best.difficulty <= EASY_DIFFICULTY;
    lines.push(`"${best.keyword}" gets ${fmt(best.volume)} Google searches a month${easy ? ", and it's easy to rank for" : ""}.`);
  }

  const names = [brand, f.store.name, ...f.rivals.map((r) => r.name)];
  const said = moves.slice(0, SHOWN_MOVES).map((m) => spokenMove(m, names));
  if (said.length) {
    const end = (s: string) => (/[.!?]["\u201d]?$/.test(s) ? s : `${s}.`);
    lines.push(`Here's what I'd do. ${said.map((s, i) => end(`${i === 0 ? "First" : "Then"}, ${s}`)).join(" ")}`);
  }

  const more = moreCount(moves);
  if (more === 1) lines.push("And there's 1 more move on the list.");
  else if (more > 1) lines.push(`And there are ${fmt(more)} more moves on the list.`);

  lines.push("Then there's a month by month plan, step by step, so you can do it all yourself.");
  lines.push("If you're a Shopify brand and want this done for your store, comment your store and I'll send you your report.");
  return lines.map(noDashes);
}

/** Tags that help Ross pick which reports make the best videos. */
export function storyTags(f: ReportFacts): string[] {
  if (f.answers === 0) return ["No AI answers"];
  const tags: string[] = [];
  if (f.named === 0) tags.push("Not named once");
  else if (f.named / f.answers < 0.34) tags.push("Rarely picked");
  else tags.push("Already picked");
  if (f.searchWords.some((w) => w.volume >= 100 && w.difficulty !== null && w.difficulty <= 20)) tags.push("Easy search word");
  if (f.searches >= 1000) tags.push("Big search demand");
  if (f.answers < 12) tags.push("Few answers");
  return tags;
}

/** How many moves come after the first 3 ("N more moves"). */
export function moreCount(moves: Move[]): number {
  return Math.max(0, (moves ?? []).length - SHOWN_MOVES);
}
