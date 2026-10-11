// Guarded fetches for the site tools (robots.txt, llms.txt, home and product pages). Strangers choose
// these addresses, so every fetch goes through safeFetch (check.server.ts): no private addresses,
// DNS rebinding guard, redirects checked hop by hop (4 at most), body capped, decoded as UTF-8.
// Our user agent stays "Mozilla/5.0 (compatible; GEO-check/1.0)": we never pretend to be a bot.
// A thrown error's message is never shown: every throw becomes "unreachable" with our own copy.

import { safeFetch } from "../check.server";
import { looksLikeHtml } from "./html";
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
