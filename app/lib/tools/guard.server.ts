// Guards for every free tool POST (no login, so these keep other websites and bots from using the tools).
// Order in each action (docs/tools/spec.md 4.2): allowedPost (else 403), readToolForm (else 413), the
// honeypot (a tripped one gets the normal empty result, never an error), the tool's own input checks,
// limits (limits.server.ts), then the work. `startToolPost` runs the first two and returns the IP hash.

import { env } from "../env.server";
import { clientIp, hashIp, readSmallForm } from "../public-form.server";
import { SITE_HOST } from "./site";
import { requestHost } from "./host.server";

/** Form size caps for readToolForm. Each tool still caps its own text length. */
export const URL_FORM_BYTES = 8_192;
/** The longest paste is 300,000 characters of JSON-LD or HTML, and URL encoding can more than double it. */
export const PASTE_FORM_BYTES = 1_048_576;

export const CROSS_SITE_COPY = "Please run the check from usegeo.app.";
export const TOO_BIG_COPY = "That was too much to send in one go. Please send less.";

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True for a POST from our own pages. Browsers say where a form came from (sec-fetch-site, Origin).
 * Compares hosts, not full origins: behind Railway's proxy request.url is http://, while browsers send
 * Origin: https://, so public-form.server.ts's fromAnotherSite would refuse www visitors.
 */
export function allowedPost(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  if (site === "same-origin" || site === "same-site" || site === "none") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true; // old browsers and tools; the per-visitor limits still apply
  const from = hostOf(origin);
  if (!from) return false; // "null" (a sandboxed frame) and junk
  const ours = new Set([requestHost(request), SITE_HOST, `www.${SITE_HOST}`, hostOf(env.appUrl)].filter(Boolean));
  // requestHost drops the port; a local dev origin keeps it
  return ours.has(from) || ours.has(from.replace(/:\d+$/, ""));
}

/** The posted form, or null when the body is bigger than `maxBytes`. Never buffers more than the cap. */
export function readToolForm(request: Request, maxBytes: number): Promise<URLSearchParams | null> {
  return readSmallForm(request, maxBytes);
}

/** The spam trap: a visually hidden `website` field that people never see or fill. */
export const honeypot = (form: URLSearchParams) => String(form.get("website") ?? "") !== "";

/** The visitor's IP, scrambled (HMAC), as the key for per-visitor limits. Raw IPs are never kept. */
export const visitorKey = (request: Request) => hashIp(clientIp(request));

export type ToolPostStart =
  | { ok: true; form: URLSearchParams; ipHash: string; trapped: boolean }
  | { ok: false; status: 403 | 413; error: string };

/**
 * The first steps of every tool action: refuse other websites (403) and oversized bodies (413), read the
 * form, and say whether the honeypot was filled (`trapped`: answer with the normal empty result).
 */
export async function startToolPost(request: Request, maxBytes: number): Promise<ToolPostStart> {
  if (!allowedPost(request)) return { ok: false, status: 403, error: CROSS_SITE_COPY };
  const form = await readToolForm(request, maxBytes);
  if (!form) return { ok: false, status: 413, error: TOO_BIG_COPY };
  return { ok: true, form, ipHash: visitorKey(request), trapped: honeypot(form) };
}
