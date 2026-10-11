// Reading pages that strangers choose (product pages, home pages), for the site tools. Pure and
// browser-safe. Pages can be up to 2 MB, so, like check-read.ts, everything here walks the page with
// indexOf (linear time), and every regex runs on a slice of at most 2,000 characters: no pattern may
// rescan to the end of the page from many starting points, which could freeze the whole server.

import { decodeEntities } from "../check-read";

const MAX_PAGE = 2_000_000;
const SLICE = 2_000;

const clip = (s: string, max: number) => (s.length > max ? s.slice(0, max) : s);
const squash = (s: string) => decodeEntities(s).replace(/\s+/g, " ").trim();

/** The contents of each <script type="application/ld+json"> block (at most `max`), found with indexOf. */
export function jsonLdBlocks(html: string, max = 20): string[] {
  const src = clip(html, MAX_PAGE);
  const lower = src.toLowerCase();
  const out: string[] = [];
  for (let i = 0; out.length < max; ) {
    const start = lower.indexOf("<script", i);
    const open = start === -1 ? -1 : lower.indexOf(">", start);
    const close = open === -1 ? -1 : lower.indexOf("</script", open);
    if (close === -1) break;
    if (/type\s{0,5}=\s{0,5}["']?application\/ld\+json/.test(lower.slice(start, Math.min(open, start + 500)))) {
      out.push(src.slice(open + 1, close));
    }
    i = close + 8;
  }
  return out;
}

/** The page's <title> text, decoded and on one line, or null. */
export function titleOf(html: string): string | null {
  const src = clip(html, MAX_PAGE);
  const lower = src.toLowerCase();
  for (let i = 0; ; ) {
    const start = lower.indexOf("<title", i);
    if (start === -1) return null;
    const next = lower.charAt(start + 6);
    // "<titles>" or "<title-x>" is another tag
    if (next !== ">" && !/\s/.test(next)) {
      i = start + 6;
      continue;
    }
    const open = lower.indexOf(">", start);
    if (open === -1) return null;
    const close = lower.indexOf("</title", open);
    if (close === -1) return null;
    const text = squash(src.slice(open + 1, Math.min(close, open + 1 + SLICE)));
    return text || null;
  }
}

/**
 * Attributes of one tag ("<meta name=x content='y'>"), read with a small loop, not a regex.
 * Names are lowercased; values are decoded. The first of a repeated name wins.
 */
export function tagAttributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const s = clip(tag, 8_000);
  const isSpace = (c: string) => c === " " || c === "\n" || c === "\t" || c === "\r" || c === "\f";
  let i = s.startsWith("<") ? 1 : 0;
  while (i < s.length && !isSpace(s[i]) && s[i] !== ">" && s[i] !== "/") i++; // the tag name
  while (i < s.length) {
    while (i < s.length && (isSpace(s[i]) || s[i] === "/")) i++;
    if (i >= s.length || s[i] === ">") break;
    let name = "";
    while (i < s.length && !isSpace(s[i]) && s[i] !== "=" && s[i] !== ">" && s[i] !== "/") name += s[i++];
    while (i < s.length && isSpace(s[i])) i++;
    let value = "";
    if (s[i] === "=") {
      i++;
      while (i < s.length && isSpace(s[i])) i++;
      const q = s[i];
      if (q === '"' || q === "'") {
        const end = s.indexOf(q, i + 1);
        value = s.slice(i + 1, end === -1 ? s.length : end);
        i = end === -1 ? s.length : end + 1;
      } else {
        const from = i;
        while (i < s.length && !isSpace(s[i]) && s[i] !== ">") i++;
        value = s.slice(from, i);
      }
    }
    const key = name.toLowerCase();
    if (key && !(key in out)) out[key] = decodeEntities(value);
  }
  return out;
}

/** Each opening tag `<name ...>` (at most `max`, each cut to 8,000 characters), found with indexOf. */
function tagsNamed(html: string, name: string, max: number): { tag: string; end: number }[] {
  const src = clip(html, MAX_PAGE);
  const lower = src.toLowerCase();
  const open = `<${name}`;
  const out: { tag: string; end: number }[] = [];
  for (let i = 0; out.length < max; ) {
    const start = lower.indexOf(open, i);
    if (start === -1) break;
    const next = lower.charAt(start + open.length);
    if (next !== ">" && next !== "/" && !/\s/.test(next)) {
      i = start + open.length;
      continue;
    }
    const gt = lower.indexOf(">", start);
    if (gt === -1) break;
    out.push({ tag: src.slice(start, Math.min(gt + 1, start + 8_000)), end: gt + 1 });
    i = gt + 1;
  }
  return out;
}

const MAX_META_TAGS = 300; // real pages have well under 100

/**
 * The content of a <meta> tag found by its name or property ("description", "og:site_name",
 * "og:title"), case-insensitive, decoded and on one line. Null when missing or empty.
 */
export function metaContent(html: string, nameOrProperty: string): string | null {
  const want = nameOrProperty.toLowerCase();
  for (const { tag } of tagsNamed(html, "meta", MAX_META_TAGS)) {
    const a = tagAttributes(tag);
    const key = (a.name || a.property || a.itemprop || "").toLowerCase();
    if (key === want) {
      const content = squash(a.content ?? "");
      return content || null;
    }
  }
  return null;
}

const MAX_LINK_TAGS = 5_000;
const LINK_TEXT = 200;

const strip = (s: string) => {
  // Tags out of a short slice of link text, by indexOf.
  let out = "";
  for (let i = 0; i < s.length; ) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      out += s.slice(i);
      break;
    }
    out += `${s.slice(i, lt)} `;
    const gt = s.indexOf(">", lt);
    i = gt === -1 ? s.length : gt + 1;
  }
  return out;
};

const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

/**
 * Links on the page to the same site (www. or not), as absolute URLs without a #fragment, in page order and
 * de-duplicated. Skips "#" links, mailto:, tel:, javascript: and anything that isn't http(s).
 */
export function sameHostLinks(html: string, pageUrl: string, max = 300): { href: string; text: string }[] {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }
  const host = bareHost(base.hostname);
  const src = clip(html, MAX_PAGE);
  const lower = src.toLowerCase();
  const seen = new Set<string>();
  const out: { href: string; text: string }[] = [];
  for (const { tag, end } of tagsNamed(src, "a", MAX_LINK_TAGS)) {
    if (out.length >= max) break;
    const raw = (tagAttributes(tag).href ?? "").trim();
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript|data|sms):/i.test(raw.slice(0, 20))) continue;
    let u: URL;
    try {
      u = new URL(raw, base);
    } catch {
      continue;
    }
    if ((u.protocol !== "http:" && u.protocol !== "https:") || bareHost(u.hostname) !== host) continue;
    u.hash = "";
    const href = u.toString();
    if (seen.has(href)) continue;
    seen.add(href);
    // Look for the closing tag only within the slice we keep, so a page full of unclosed links is never rescanned to its end.
    const close = lower.slice(end, end + SLICE).indexOf("</a");
    const inner = src.slice(end, end + (close === -1 ? SLICE : close));
    const text = squash(strip(inner));
    out.push({ href, text: text.length > LINK_TEXT ? `${text.slice(0, LINK_TEXT).trim()}…` : text });
  }
  return out;
}

/** True when a "text file" is really a web page (a site answering every address with its home page). */
export const looksLikeHtml = (text: string): boolean => /^\s*(<!doctype html|<html|<head|<body)/i.test(text.slice(0, 500));

/** True when the page marks up a product with microdata (itemtype="https://schema.org/Product"). */
export function hasMicrodataProduct(html: string): boolean {
  const lower = clip(html, MAX_PAGE).toLowerCase();
  for (let i = 0, n = 0; n < 2_000; n++) {
    const at = lower.indexOf("itemtype", i);
    if (at === -1) return false;
    if (/^itemtype\s{0,5}=\s{0,5}["']?\s{0,5}https?:\/\/schema\.org\/product(?![a-z])/.test(lower.slice(at, at + 120))) return true;
    i = at + 8;
  }
  return false;
}
