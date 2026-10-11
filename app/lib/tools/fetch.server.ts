// Guarded fetches for the site tools (robots.txt, llms.txt, home and product pages). Strangers choose
// these addresses, so every fetch goes through safeFetch (check.server.ts): no private addresses,
// DNS rebinding guard, redirects checked hop by hop (4 at most), body capped, decoded as UTF-8.
// Our user agent stays "Mozilla/5.0 (compatible; GEO-check/1.0)": we never pretend to be a bot.
// A thrown error's message is never shown: every throw becomes "unreachable" with our own copy.

import { safeFetch } from "../check.server";
import { looksLikeHtml, titleOf } from "./html";
import { toolFetchGate } from "./limits.server";

export type FetchOutcome =
  | { kind: "ok"; status: number; url: string; text: string; html: boolean }
  /** 404, 410 and other 4xx except the ones below. */
  | { kind: "missing"; status: number }
  /** 401, 403, 429: a firewall or bot protection said no. */
  | { kind: "turned-away"; status: number }
  /** 5xx */
  | { kind: "server-error"; status: number }
  /** Bad address, private IP, DNS, timeout, too many redirects, or an answer we can't use. */
  | { kind: "unreachable" };

export const TEXT_FILE_BYTES = 512_000;
export const HTML_PAGE_BYTES = 2_000_000;
const TEXT_ACCEPT = "text/plain,text/markdown;q=0.9,*/*;q=0.5";

/** The plain words for each outcome that isn't a file. `{status}` is the HTTP status code. */
export const OUTCOME_COPY = {
  unreachable: "We couldn't reach that site. Check the address, or try again in a minute.",
  "turned-away":
    "Your site turned our check away (a firewall or bot protection answered {status}). AI bots may be turned away too, so check your firewall or bot settings.",
  "server-error": "Your site answered with a server error ({status}). Try again in a few minutes.",
} as const;

/** The copy for an outcome, with its status filled in. Null for "ok" and "missing" (each tool words those). */
export function outcomeMessage(o: FetchOutcome): string | null {
  if (o.kind === "unreachable") return OUTCOME_COPY.unreachable;
  if (o.kind === "turned-away" || o.kind === "server-error") return OUTCOME_COPY[o.kind].replace("{status}", String(o.status));
  return null;
}

/** An HTTP status as an outcome kind. */
export function outcomeKind(status: number): FetchOutcome["kind"] {
  if (status >= 200 && status < 300) return "ok";
  if (status === 401 || status === 403 || status === 429) return "turned-away";
  if (status >= 400 && status < 500) return "missing";
  if (status >= 500 && status < 600) return "server-error";
  return "unreachable"; // a redirect without a Location, or anything else we can't read
}

/**
 * GET a public file or page. Defaults: 6 s per hop; 512 KB, or 2 MB when `accept` asks for HTML.
 * Waits for a free slot in toolFetchGate (TOOLS_MAX_OPEN, default 8). Never throws.
 */
export async function fetchSiteFile(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number; accept?: string } = {},
): Promise<FetchOutcome> {
  const accept = opts.accept ?? TEXT_ACCEPT;
  const maxBytes = opts.maxBytes ?? (/html/i.test(accept) ? HTML_PAGE_BYTES : TEXT_FILE_BYTES);
  try {
    const res = await toolFetchGate.run(() => safeFetch(url, accept, { timeoutMs: opts.timeoutMs ?? 6_000, maxBytes }));
    const kind = outcomeKind(res.status);
    if (kind === "ok") return { kind, status: res.status, url: res.url, text: res.text, html: looksLikeHtml(res.text) };
    if (kind === "unreachable") return { kind };
    return { kind, status: res.status };
  } catch {
    return { kind: "unreachable" };
  }
}

/** Accept header for web pages (home and product pages): pass as `accept` to get the 2 MB default. */
export const HTML_ACCEPT = "text/html,application/xhtml+xml";

// ---------- where a site really lives ----------

/** "www.Shop.com" -> "shop.com". */
const bareHost = (h: string) => h.toLowerCase().replace(/^www\./, "");

/** The same site: one host, or the other with or without "www.". */
export const sameSite = (a: string, b: string) => bareHost(a) === bareHost(b);

/**
 * The host with "www." added, or taken off when it has it. Null for a myshopify.com address: those move to
 * the store's own domain, and "www.x.myshopify.com" is never the store.
 */
export function twinHost(host: string): string | null {
  const h = host.toLowerCase();
  if (h.endsWith(".myshopify.com")) return null;
  if (h.startsWith("www.")) return h.slice(4).includes(".") ? h.slice(4) : null;
  return `www.${h}`;
}

const REDIRECT_SCAN = 200_000;
const BODY_SCAN = 20_000;

/** The words a visitor sees in a slice of a page: no tags, scripts, styles or comments. Linear (indexOf). */
function visibleWords(s: string): string {
  const lower = s.toLowerCase();
  let out = "";
  for (let i = 0; i < s.length; ) {
    const lt = s.indexOf("<", i);
    if (lt === -1) {
      out += s.slice(i);
      break;
    }
    out += `${s.slice(i, lt)} `;
    let from = lt;
    for (const [open, close] of [
      ["<script", "</script"],
      ["<style", "</style"],
      ["<!--", "-->"],
    ]) {
      if (lower.startsWith(open, lt)) {
        const end = lower.indexOf(close, lt + open.length);
        from = end === -1 ? s.length : end;
        break;
      }
    }
    const gt = s.indexOf(">", from);
    i = gt === -1 ? s.length : gt + 1;
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * True for a page that only sends visitors on: a meta refresh, a "Redirecting..." title, or a body whose only
 * words are about redirecting (like the page a Shopify checkout domain shows while its script sends people to
 * the real store). Reads at most the first 200,000 characters, with indexOf and short anchored patterns.
 */
export function looksLikeRedirectPage(html: string): boolean {
  const src = html.slice(0, REDIRECT_SCAN);
  const lower = src.toLowerCase();
  for (let i = 0, n = 0; n < 50; n++) {
    const at = lower.indexOf("http-equiv", i);
    if (at === -1) break;
    if (/^http-equiv\s{0,5}=\s{0,5}["']?\s{0,5}refresh/.test(lower.slice(at, at + 60))) return true;
    i = at + 10;
  }
  if (/^redirect(?:ing)?\b/i.test(titleOf(src) ?? "")) return true;
  const body = lower.indexOf("<body");
  if (body === -1) return false;
  const words = visibleWords(src.slice(body, body + BODY_SCAN));
  return words.length <= 200 && /\bredirecting\b/i.test(words);
}

/** How we got from the typed address to the one we read. */
export type SiteMove =
  /** The typed address sent us there itself, like yourstore.com to www.yourstore.com. */
  | { how: "redirect" }
  /** It went to `landed` (another host, or a redirect page), so we read its www (or non-www) twin instead. */
  | { how: "twin"; landed: string; redirectPage: boolean };

export interface SiteHome {
  /** Where every file is read from, like "https://www.yourstore.com". */
  origin: string;
  host: string;
  /** The home page as read there; when the typed address gave no page, its answer (404, unreachable). */
  home: FetchOutcome;
  /** Null when we read the host that was typed. */
  moved: SiteMove | null;
}

const urlOf = (s: string): URL | null => {
  try {
    return new URL(s);
  } catch {
    return null;
  }
};

const isHtmlPage = (o: Extract<FetchOutcome, { kind: "ok" }>) => o.html || /<html[\s>]/i.test(o.text.slice(0, 2_000));

/**
 * Where a site really lives, so robots.txt, llms.txt and the home page are all read from the store itself.
 * Typing "gymshark.com" lands on us.checkout.gymshark.com, a Shopify store used only for checkout whose
 * "Redirecting..." page sends people on to www.gymshark.com with a script; reading files there checks the
 * wrong site. So, reading the typed home page (the guarded fetch follows up to 4 redirects, each checked):
 * - it lands on the typed host or its www twin, and isn't a redirect page: that's the site;
 * - else (another host, or a redirect page) it reads the twin once (https://www.<typed host>/, or the host
 *   without www) and uses it when it answers with a real home page on the same site;
 * - else it stays where the typed address sent us (a myshopify.com address moving to the store's own domain).
 * At most two home page reads, both through `page` (the guarded fetch, passed in). Never throws.
 */
export async function resolveSiteHome(input: { origin: string; host: string }, page: (url: string) => Promise<FetchOutcome>): Promise<SiteHome> {
  const read = (url: string) => page(url).catch((): FetchOutcome => ({ kind: "unreachable" }));
  const first = await read(`${input.origin}/`);
  const landed = first.kind === "ok" ? urlOf(first.url) : null;
  if (first.kind !== "ok" || !landed) return { origin: input.origin, host: input.host, home: first, moved: null };
  const redirectPage = looksLikeRedirectPage(first.text);
  const there: SiteHome = { origin: landed.origin, host: landed.hostname, home: first, moved: landed.hostname === input.host ? null : { how: "redirect" } };
  if (sameSite(landed.hostname, input.host) && !redirectPage) return there;

  const twin = twinHost(input.host);
  if (!twin) return there;
  const second = await read(`${input.origin.startsWith("http:") ? "http:" : "https:"}//${twin}/`);
  const at = second.kind === "ok" ? urlOf(second.url) : null;
  if (second.kind === "ok" && at && sameSite(at.hostname, input.host) && isHtmlPage(second) && !looksLikeRedirectPage(second.text)) {
    return { origin: at.origin, host: at.hostname, home: second, moved: at.hostname === input.host ? null : { how: "twin", landed: landed.hostname, redirectPage } };
  }
  return there;
}

/** The one plain line under the result when we read another address than the one typed. */
export const MOVED_COPY = {
  redirect: (typed: string, read: string) => `${typed} sends visitors to ${read}, so we checked that address.`,
  otherHost: (typed: string, landed: string, read: string) => `${typed} goes to ${landed}, so we checked ${read}, where your home page is.`,
  redirectPage: (typed: string, read: string) => `${typed} shows a redirect page, so we checked ${read}, where your home page is.`,
} as const;

/** That line for a resolved site, or null when we read the host that was typed. */
export function movedNote(typedHost: string, where: SiteHome): string | null {
  const m = where.moved;
  if (!m || where.host === typedHost) return null;
  if (m.how === "redirect") return MOVED_COPY.redirect(typedHost, where.host);
  if (m.landed !== typedHost) return MOVED_COPY.otherHost(typedHost, m.landed, where.host);
  return MOVED_COPY.redirectPage(typedHost, where.host);
}
