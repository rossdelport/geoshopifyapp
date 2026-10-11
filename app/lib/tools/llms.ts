// llms.txt Checker logic (docs/tools/spec.md T5): check a file line by line against the llmstxt.org format
// (version 2, August 2026), spot Shopify's automatic file, and build a starter file from a home page, plain
// and as a Shopify templates/llms.txt.liquid. Pure and browser-safe: the page runs it live as people type,
// and the server runs the same code on fetched files and no-JavaScript posts.
// Strangers' files can be big (512 KB fetched, 200,000 characters pasted), so the scan is linear: lines are
// cut to 4,000 characters, every regex is anchored and short, and links are found with indexOf.
//
// The format (facts-2026.md 4.1): an optional byte-order mark; an H1 with the site's name (the only required
// part); an optional "> " summary; any text except headings; then "## " sections whose lists hold
// "[name](url)" links, optionally followed by ": notes". Since version 2 an "## Optional" section is just a
// normal section. llms-full.txt is not part of the format.

import { CHECK_COPY, GENERATOR, PASSED_COPY, VERDICT_COPY } from "./copy/llms-txt-checker";
import { looksLikeHtml, metaContent, sameHostLinks, titleOf } from "./html";

export type CheckId =
  | "missing"
  | "html"
  | "empty"
  | "h1"
  | "h1-many"
  | "heading-early"
  | "list-link"
  | "summary"
  | "link-relative"
  | "section-empty"
  | "size"
  | "shopify-default"
  | "redirect"
  | "md-links"
  | "optional"
  | "full"
  | "agents";

/** "problem": breaks the format. "tip": recommended, or our own advice (`ourTip`). "info": good to know. */
export type CheckTone = "problem" | "tip" | "info";

export interface Check {
  id: CheckId;
  tone: CheckTone;
  text: string;
  /** 1-based line number in the file. */
  line?: number;
  /** That line, trimmed and cut to 120 characters. Strangers' text: always shown escaped. */
  excerpt?: string;
  /** Our advice, not part of the format. */
  ourTip?: boolean;
}

export interface LlmsReport {
  /** False when the site has no llms.txt (a 404). */
  found: boolean;
  /** Shopify's automatic file. */
  shopify: boolean;
  /** Problems first, then tips, then info. Per-line checks list the first 10 lines, then "And n more". */
  checks: Check[];
  /** What passed, in plain words. */
  passed: string[];
  /** Every problem line, including the ones not listed. */
  problems: number;
  tips: number;
}

const MAX_LINE = 4_000;
/** Per-line checks of one kind listed before "And n more lines like this". */
const SHOWN_PER_CHECK = 10;
const EXCERPT = 120;
/** A file over this many bytes gets the "very long" tip. */
export const BIG_FILE_BYTES = 200_000;

/** The order checks are listed in: problems, tips, info, then by kind, then by line. */
const ORDER: CheckId[] = [
  "html",
  "empty",
  "h1",
  "h1-many",
  "heading-early",
  "list-link",
  "summary",
  "link-relative",
  "section-empty",
  "size",
  "missing",
  "shopify-default",
  "redirect",
  "md-links",
  "optional",
  "full",
  "agents",
];
const TONE_RANK: Record<CheckTone, number> = { problem: 0, tip: 1, info: 2 };

/** Checks in display order (stable: lines of one kind keep their order). */
export function sortChecks(checks: Check[]): Check[] {
  return [...checks].sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}

const HEADING = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const QUOTE = /^ {0,3}>/;
/** A top-level list item ("- ", "* ", "+ ", "1. "). Items indented by 2 or more spaces belong to the one above. */
const LIST_ITEM = /^ ?(?:[-*+]|\d{1,9}[.)])(?:[ \t]|$)/;
/** A divider line ("- - -", "* * *"): Markdown draws a line, it isn't a list item. One fixed character, so no backtracking. */
const DIVIDER = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
const SCHEME = /^[a-z][a-z0-9+.-]{0,30}:/i;

const stripBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);

/**
 * True when a "text file" is really a web page: it starts like one (looksLikeHtml), or opens with a comment
 * or an XML line and has an <html>, <head> or <body> tag near the top (some sites answer every address with
 * a page like that). Reads at most the first 2,000 characters.
 */
export function isWebPage(text: string): boolean {
  if (looksLikeHtml(text)) return true;
  const head = text.slice(0, 2_000);
  return /^\s*<[!?]/.test(head) && /<(?:!doctype html|html|head|body)[\s>]/i.test(head);
}

/** The first `n` characters, never cutting an emoji (or any two-part character) in half. */
function headOf(s: string, n: number): string {
  const code = s.charCodeAt(n - 1);
  return s.slice(0, code >= 0xd800 && code <= 0xdbff ? n - 1 : n);
}

/** A line as shown next to a check: trimmed, at most 120 characters. */
export function excerptOf(line: string): string {
  const t = line.trim();
  return t.length > EXCERPT ? `${headOf(t, EXCERPT - 1).trimEnd()}…` : t;
}

/** "## Main pages ##" -> "Main pages". A loop, not a regex: a line of spaces can't make it slow. */
function headingText(line: string, level: number): string {
  const s = line.trim().slice(level, level + 300).trim();
  let end = s.length;
  while (end > 0 && s[end - 1] === "#") end--;
  // a closing run of #s counts only after a space (or when the heading is nothing but #s)
  const closed = end < s.length && (end === 0 || s[end - 1] === " " || s[end - 1] === "\t");
  return (closed ? s.slice(0, end) : s).trim();
}

/**
 * The "[name](url)" links in one line, found with indexOf (linear: each search starts where the last ended).
 * Names up to 500 characters, addresses up to 2,000; `(url "title")` keeps just the address.
 */
export function linksIn(line: string, max = 50): { name: string; url: string }[] {
  const out: { name: string; url: string }[] = [];
  let from = 0;
  let close = -1;
  while (out.length < max) {
    const mid = line.indexOf("](", from);
    if (mid === -1) break;
    // the name: after the nearest "[" in the 500 characters before "](" (never before the last link), with
    // no other "]" in between. Searching a slice keeps the look-back short.
    const lo = Math.max(from, mid - 501);
    const back = line.slice(lo, mid).lastIndexOf("[");
    const open = back === -1 ? -1 : lo + back;
    if (open === -1 || open + 1 >= mid || line.indexOf("]", open + 1) !== mid) {
      from = mid + 2;
      continue;
    }
    if (close < mid + 2) {
      close = line.indexOf(")", mid + 2);
      if (close === -1) break;
    }
    if (close - mid <= 2_002) {
      let url = line.slice(mid + 2, close).trim();
      const space = url.search(/\s/);
      if (space !== -1) url = url.slice(0, space);
      if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1);
      if (url) out.push({ name: line.slice(open + 1, mid), url });
    }
    from = close + 1;
  }
  return out;
}

/** A link without a scheme (https:, mailto:): "/page", "page.md", "//host/page", "#top". */
export const isShortLink = (url: string) => !SCHEME.test(url);
/** A link to a plain-text version of a page ("page.md", "page.html.md"). */
const isMdLink = (url: string) => (url.split(/[?#]/, 1)[0] ?? "").toLowerCase().endsWith(".md");

/** The first line that isn't blank (after a byte-order mark), without reading the whole file. */
function firstContentLine(body: string): string {
  for (let i = 0; i < body.length; ) {
    const end = body.indexOf("\n", i);
    const line = body.slice(i, end === -1 ? Math.min(body.length, i + MAX_LINE) : Math.min(end, i + MAX_LINE));
    if (line.trim()) return line;
    if (end === -1) break;
    i = end + 1;
  }
  return "";
}

/**
 * Shopify's automatic file (facts-2026.md 4.3): the first line starts "# Agent Instructions" and the file
 * links Shopify's shopping-agent files (shop.app/SKILL.md or /.well-known/ucp).
 */
export function isShopifyDefault(text: string): boolean {
  const body = stripBom(text ?? "");
  if (!/^ {0,3}#[ \t]+agent instructions\b/i.test(firstContentLine(body).slice(0, 200))) return false;
  const head = body.slice(0, 600_000);
  return head.includes("shop.app/SKILL.md") || head.includes("/.well-known/ucp");
}

/** UTF-8 size of the text. */
const byteLength = (text: string) => new TextEncoder().encode(text).length;

/** Keeps every check's count, but lists only the first lines of each kind. */
class Found {
  readonly checks: Check[] = [];
  private readonly counts = new Map<CheckId, number>();
  private readonly hidden = new Map<CheckId, { tone: CheckTone; ourTip?: boolean; n: number }>();

  add(check: Check) {
    const seen = this.counts.get(check.id) ?? 0;
    this.counts.set(check.id, seen + 1);
    if (seen < SHOWN_PER_CHECK) this.checks.push(check);
    else {
      const h = this.hidden.get(check.id) ?? { tone: check.tone, ourTip: check.ourTip, n: 0 };
      h.n++;
      this.hidden.set(check.id, h);
    }
  }

  has(id: CheckId) {
    return (this.counts.get(id) ?? 0) > 0;
  }

  report(found: { shopify: boolean; passed: string[] }): LlmsReport {
    const listed = [...this.checks];
    for (const [id, h] of this.hidden) listed.push({ id, tone: h.tone, text: CHECK_COPY.more(h.n), ...(h.ourTip ? { ourTip: true } : {}) });
    let problems = 0;
    let tips = 0;
    for (const c of this.checks) if (c.tone === "problem") problems++;
    else if (c.tone === "tip") tips++;
    for (const h of this.hidden.values()) if (h.tone === "problem") problems += h.n;
    else if (h.tone === "tip") tips += h.n;
    return { found: true, shopify: found.shopify, checks: sortChecks(listed), passed: found.passed, problems, tips };
  }
}

/** Check a file against the llmstxt.org format: the full report, with what passed. */
export function llmsReport(text: string): LlmsReport {
  const body = stripBom(text ?? "");
  const out = new Found();
  if (isWebPage(body)) {
    out.add({ id: "html", tone: "problem", text: CHECK_COPY.html });
    return out.report({ shopify: false, passed: [] });
  }
  if (!body.trim()) {
    out.add({ id: "empty", tone: "problem", text: CHECK_COPY.empty });
    return out.report({ shopify: false, passed: [] });
  }
  const big = body.length > BIG_FILE_BYTES / 4 && byteLength(body) > BIG_FILE_BYTES;
  const sizeTip = () => {
    if (big) out.add({ id: "size", tone: "tip", text: CHECK_COPY.size });
  };

  if (isShopifyDefault(body)) {
    // Shopify writes this file for shopping agents, not as a list of links: it passes the only hard rule
    // (the title line) and is expected to have no summary, so it isn't held to the rest of the format.
    out.add({ id: "shopify-default", tone: "info", text: CHECK_COPY.shopify });
    sizeTip();
    return out.report({ shopify: true, passed: [PASSED_COPY.title] });
  }

  const lines = body.split(/\r\n|\r|\n/);
  let fence: string | null = null;
  let first: { n: number; line: string } | null = null;
  let titled = false;
  let summary: "none" | "wait" | "yes" | "no" = "none";
  const h1s: { n: number; line: string }[] = [];
  let seenH2 = false;
  let section: { name: string; n: number; line: string; items: number } | null = null;
  let sections = 0;
  let listItems = 0;
  let links = 0;
  let mdLinks = 0;
  let optional: { n: number; line: string } | null = null;

  const closeSection = () => {
    if (section && section.items === 0) {
      out.add({ id: "section-empty", tone: "tip", text: CHECK_COPY.sectionEmpty(section.name), line: section.n, excerpt: excerptOf(section.line) });
    }
    section = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const line = lines[i].length > MAX_LINE ? lines[i].slice(0, MAX_LINE) : lines[i];
    if (fence) {
      // inside a code block nothing counts as a heading, list or link, until the matching fence
      const f = FENCE.exec(line);
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      continue;
    }
    if (!line.trim()) continue;
    const isFirst = first === null;
    if (isFirst) first = { n, line };
    if (summary === "wait") summary = QUOTE.test(line) ? "yes" : "no";
    const f = FENCE.exec(line);
    if (f) {
      fence = f[1];
      continue;
    }

    const h = HEADING.exec(line);
    if (h) {
      const level = h[1].length;
      if (level === 1) {
        h1s.push({ n, line });
        if (isFirst && headingText(line, 1)) {
          titled = true;
          summary = "wait";
        }
      } else if (level === 2) {
        closeSection();
        const name = headingText(line, 2);
        section = { name, n, line, items: 0 };
        sections++;
        seenH2 = true;
        if (/^optional$/i.test(name) && !optional) optional = { n, line };
      } else if (!seenH2) {
        out.add({ id: "heading-early", tone: "problem", text: CHECK_COPY.headingEarly(n), line: n, excerpt: excerptOf(line) });
      }
      continue;
    }

    const found = linksIn(line);
    links += found.length;
    for (const l of found) if (isMdLink(l.url)) mdLinks++;
    if (found.some((l) => isShortLink(l.url))) {
      out.add({ id: "link-relative", tone: "tip", ourTip: true, text: CHECK_COPY.linkRelative(n), line: n, excerpt: excerptOf(line) });
    }
    if (section && LIST_ITEM.test(line) && !DIVIDER.test(line)) {
      section.items++;
      listItems++;
      if (!found.length) out.add({ id: "list-link", tone: "problem", text: CHECK_COPY.listLink(n), line: n, excerpt: excerptOf(line) });
    }
  }
  closeSection();

  if (!titled && first) out.add({ id: "h1", tone: "problem", text: CHECK_COPY.h1, line: first.n, excerpt: excerptOf(first.line) });
  if (h1s.length > 1) {
    out.add({ id: "h1-many", tone: "problem", text: CHECK_COPY.h1Many(h1s[0].n, h1s[1].n), line: h1s[1].n, excerpt: excerptOf(h1s[1].line) });
  }
  if (titled && summary !== "yes" && first) {
    out.add({ id: "summary", tone: "tip", text: CHECK_COPY.summary, line: first.n, excerpt: excerptOf(first.line) });
  }
  sizeTip();
  if (links > 0 && mdLinks === 0) out.add({ id: "md-links", tone: "info", text: CHECK_COPY.mdLinks });
  if (optional) out.add({ id: "optional", tone: "info", text: CHECK_COPY.optional, line: optional.n, excerpt: excerptOf(optional.line) });

  const passed: string[] = [];
  if (titled) passed.push(PASSED_COPY.title);
  if (titled && h1s.length === 1) passed.push(PASSED_COPY.oneTitle);
  if (summary === "yes") passed.push(PASSED_COPY.summary);
  if (titled && !out.has("heading-early")) passed.push(PASSED_COPY.noEarlyHeadings);
  if (listItems > 0 && !out.has("list-link")) passed.push(PASSED_COPY.links);
  if (links > 0 && !out.has("link-relative")) passed.push(PASSED_COPY.fullLinks);
  if (sections > 0 && !out.has("section-empty")) passed.push(PASSED_COPY.sections);
  return out.report({ shopify: false, passed });
}

/** Every check for a file, problems first (docs/tools/spec.md T5). */
export const checkLlms = (text: string): Check[] => llmsReport(text).checks;

/** The report for a site with no llms.txt. */
export function missingReport(): LlmsReport {
  return { found: false, shopify: false, checks: [], passed: [], problems: 0, tips: 0 };
}

/** The report with more checks added (the server's notes about the other files), re-sorted and re-counted. */
export function withChecks(report: LlmsReport, extra: Check[]): LlmsReport {
  const checks = sortChecks([...report.checks, ...extra]);
  const count = (tone: CheckTone) => extra.filter((c) => c.tone === tone).length;
  return { ...report, checks, problems: report.problems + count("problem"), tips: report.tips + count("tip") };
}

/** What we found at each address: a file, nothing (404), a web page instead, or no answer we could use. */
export type FileState = "found" | "missing" | "html" | "unchecked";

export interface LlmsSite {
  host: string;
  /** The address we checked, like "https://yourstore.com/llms.txt". */
  llmsUrl: string;
  files: { llms: FileState; full: FileState; agents: FileState };
  /** The checks on /llms.txt, with notes about the other two files. */
  report: LlmsReport;
  /** Shopify's files on the home page, or Shopify's automatic llms.txt or agents.md. */
  shopify: boolean;
  /** The starter file, or null when the home page couldn't be read. */
  starter: string | null;
  starterNote: "no-home" | "no-links" | null;
}

export type VerdictTone = "good" | "warn" | "neutral";

/** The one-line verdict above the detail. */
export function llmsVerdict(report: LlmsReport): { tone: VerdictTone; headline: string } {
  if (!report.found) return { tone: "neutral", headline: VERDICT_COPY.missing };
  if (report.shopify) return { tone: "neutral", headline: VERDICT_COPY.shopify };
  if (report.problems === 0) return { tone: "good", headline: VERDICT_COPY.good };
  return { tone: "warn", headline: VERDICT_COPY.problems(report.problems) };
}

// ---------- the starter file ----------

export interface HomeLink {
  href: string;
  text: string;
}

/** What the starter file is built from: the home page's name, description and links. */
export interface HomeFacts {
  title: string;
  description: string | null;
  links: HomeLink[];
}

/** Title separators, as in "Home | Cedar & Co" (and the en and em dashes Shopify themes use). */
const TITLE_SEPARATORS = [" | ", " - ", " \u2013 ", " \u2014 "];

/** The part of a page title before its first separator. */
export function cutTitle(title: string | null): string | null {
  if (!title) return null;
  let at = title.length;
  for (const sep of TITLE_SEPARATORS) {
    const i = title.indexOf(sep);
    if (i > 0 && i < at) at = i;
  }
  return title.slice(0, at).trim() || null;
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function cap(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = headOf(s, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * Read a home page for the starter file. Title: og:site_name, else <title> cut at the first " | " or " - ",
 * else the host. Description: the meta description. Links: same-site links, all on the home page's address.
 */
export function readHome(html: string, pageUrl: string, host: string): HomeFacts {
  const title = metaContent(html, "og:site_name") ?? cutTitle(titleOf(html)) ?? host;
  const description = metaContent(html, "description");
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return { title: oneLine(title), description, links: [] };
  }
  const links = sameHostLinks(html, pageUrl, 300).map((l) => {
    try {
      const u = new URL(l.href);
      return { href: `${origin}${u.pathname}${u.search}`, text: l.text };
    } catch {
      return l;
    }
  });
  return { title: cap(oneLine(title), 120), description: description ? cap(oneLine(description), 500) : null, links };
}

/** Shopify's storefront files on a page (its CDN or storefront script). */
export const homeIsShopify = (html: string) => {
  const head = html.slice(0, 2_000_000);
  return head.includes("cdn.shopify.com") || head.includes("Shopify.shop");
};

type LinkKind = "collection" | "page" | "blog" | "other";
const KIND_ORDER: LinkKind[] = ["collection", "page", "blog", "other"];
/** How many of each kind the first pass takes (the rest fill up from page order after). */
const FIRST_PASS: Record<LinkKind, number> = { collection: 8, page: 15, blog: 3, other: 0 };
export const MAX_MAIN_PAGES = 15;

const LOCALE = "(?:[a-z]{2}(?:-[a-z0-9]{2,4})?/)?";
const COLLECTION_PATH = new RegExp(`^/${LOCALE}collections/[^/]`, "i");
const PAGE_PATH = new RegExp(`^/${LOCALE}pages/[^/]`, "i");
const BLOG_PATH = new RegExp(`^/${LOCALE}blogs/[^/]`, "i");
const POLICY_PATH = new RegExp(`^/${LOCALE}policies/([a-z-]{1,40})/?$`, "i");
const ABOUT_OR_CONTACT = /(?:^|[/_-])(?:about|contact)(?:[/_.-]|$)/i;
/** Addresses that aren't pages worth listing: the cart, accounts, search, sign-in, checkout. */
const SKIP_SEGMENTS = new Set([
  "cart",
  "account",
  "accounts",
  "customer",
  "customers",
  "customer_authentication",
  "search",
  "login",
  "logout",
  "register",
  "signin",
  "sign-in",
  "checkout",
  "checkouts",
  "password",
  "wishlist",
  "policies",
]);
const FILE_EXT = /\.(?:jpe?g|png|gif|webp|avif|svg|ico|pdf|zip|css|js|json|xml|txt|mp4|webm|woff2?)$/i;
/** A language or country version of the home page ("/fr", "/en-ca"): the same store, not a page to list. */
const LOCALE_HOME = /^\/[a-z]{2}(?:-[a-z0-9]{2,4})?\/?$/i;
const POLICIES = ["shipping-policy", "refund-policy", "privacy-policy"] as const;
type PolicyHandle = (typeof POLICIES)[number];

function kindOf(path: string): LinkKind {
  if (COLLECTION_PATH.test(path)) return "collection";
  if (PAGE_PATH.test(path) || ABOUT_OR_CONTACT.test(path)) return "page";
  if (BLOG_PATH.test(path)) return "blog";
  return "other";
}

/** "/collections/beard-oil" -> "Beard oil" (for links with no words, like an image link). */
function nameFromPath(path: string): string {
  const last = path.split("/").filter(Boolean).pop() ?? "";
  let word = last;
  try {
    word = decodeURIComponent(last);
  } catch {
    // keep it encoded
  }
  word = word.replace(/[-_]+/g, " ").trim();
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : path;
}

/** Words for "[name](url)": no square brackets, one line, at most 80 characters. */
const cleanName = (s: string) => cap(oneLine(s.replace(/[[\]]/g, "")), 80);

/** A link's words: its own text, else a name from its address, else "Page". */
function linkName(text: string, path: string): string {
  return cleanName(text) || cleanName(nameFromPath(path)) || "Page";
}

/** "(", ")", "[" and "]" in an address could end a Markdown link early; escaped, they mean the same address. */
const mdUrl = (href: string) => href.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\[/g, "%5B").replace(/\]/g, "%5D");

/**
 * The links for the starter file: up to 15 main pages (collections, pages, blog posts, about and contact
 * first; never the cart, account, search, sign-in, checkout, files, or the home page itself and its language
 * versions like /fr; no duplicates; no query strings), and the shipping, refund and privacy policies when the
 * home page links them.
 */
export function starterLinks(links: HomeLink[]): { main: HomeLink[]; policies: HomeLink[] } {
  const seen = new Set<string>();
  const candidates: { link: HomeLink; kind: LinkKind; i: number }[] = [];
  const policies = new Map<PolicyHandle, HomeLink>();
  for (const l of links) {
    let u: URL;
    try {
      u = new URL(l.href);
    } catch {
      continue;
    }
    // The address without its query: "?variant=..." on product links, "?sort_by=..." on collections.
    const path = u.pathname;
    if (path.length > 300 || path === "/" || LOCALE_HOME.test(path) || FILE_EXT.test(path) || path.includes("/cdn/")) continue;
    const key = path.replace(/\/+$/, "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const policy = POLICY_PATH.exec(path)?.[1]?.toLowerCase();
    if (policy) {
      if ((POLICIES as readonly string[]).includes(policy) && !policies.has(policy as PolicyHandle)) {
        policies.set(policy as PolicyHandle, { href: `${u.origin}${path}`, text: GENERATOR.policyNames[policy as PolicyHandle] });
      }
      continue;
    }
    const segments = key.split("/").filter(Boolean);
    if (segments.some((s) => SKIP_SEGMENTS.has(s))) continue;
    candidates.push({ link: { href: `${u.origin}${path}`, text: linkName(l.text, path) }, kind: kindOf(path), i: candidates.length });
  }

  // First pass in page order, with a cap per kind so one long menu can't fill the list; then fill up.
  const taken = new Set<number>();
  const perKind: Record<LinkKind, number> = { collection: 0, page: 0, blog: 0, other: 0 };
  for (const c of candidates) {
    if (taken.size >= MAX_MAIN_PAGES) break;
    if (perKind[c.kind] < FIRST_PASS[c.kind]) {
      taken.add(c.i);
      perKind[c.kind]++;
    }
  }
  for (const c of candidates) {
    if (taken.size >= MAX_MAIN_PAGES) break;
    taken.add(c.i);
  }
  const main = candidates
    .filter((c) => taken.has(c.i))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.i - b.i)
    .map((c) => c.link);
  return { main, policies: POLICIES.flatMap((p) => (policies.has(p) ? [policies.get(p)!] : [])) };
}

/** A starter llms.txt in the llmstxt.org format: the title, the summary, then Main pages and Policies. */
export function buildStarter(home: HomeFacts): string {
  // A title of nothing but #s would read as an empty heading.
  const title = oneLine(home.title);
  const out = [`# ${/[^#\s]/.test(title) ? title : "Your Store"}`, ""];
  if (home.description) out.push(`> ${oneLine(home.description)}`, "");
  const { main, policies } = starterLinks(home.links);
  const list = (items: HomeLink[]) => items.map((l) => `- [${l.text}](${mdUrl(l.href)})`);
  if (main.length) out.push(`## ${GENERATOR.mainPages}`, "", ...list(main), "");
  if (policies.length) out.push(`## ${GENERATOR.policies}`, "", ...list(policies), "");
  return out.join("\n");
}

/** Liquid would run "{{" and "{%" in typed-in text; a space keeps them plain text. */
const plainLiquid = (line: string) => line.replace(/\{\{/g, "{ {").replace(/\{%/g, "{ %");

/**
 * The starter as a Shopify templates/llms.txt.liquid. That template only gets the `request` and `agents`
 * objects (no `shop`, `collections` or menus: docs/tools/spec.md 0.3), so the title becomes
 * {{ agents.store_name }}, the store address and sitemap come from `agents`, and the links stay typed in.
 */
export function toShopifyTemplate(starter: string): string {
  const lines = starter.replace(/\r\n?/g, "\n").split("\n").map(plainLiquid);
  const title = lines.findIndex((l) => /^ {0,3}#(?:[ \t]|$)/.test(l));
  const titleLine = "# {{ agents.store_name }}";
  let at: number;
  if (title === -1) {
    lines.unshift(titleLine, "");
    at = 1;
  } else {
    lines[title] = titleLine;
    at = title + 1;
    // after a > summary, if there is one
    let j = at;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j < lines.length && QUOTE.test(lines[j])) {
      while (j < lines.length && QUOTE.test(lines[j])) j++;
      at = j;
    }
  }
  lines.splice(at, 0, "", "Store: {{ agents.store_url }}", "", "Sitemap: {{ agents.sitemap_url }}", "");
  // one blank line between blocks, and one newline at the end
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}
