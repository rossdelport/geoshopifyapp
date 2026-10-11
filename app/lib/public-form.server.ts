// Shared guards for the public forms (the free check and its email form): no login, so these keep
// other websites and bots from using them. Used by routes/check.$id.email.tsx; routes/check._index.tsx
// has its own copies of the first three (same rules).

import { createHmac, randomBytes } from "node:crypto";
import { env } from "./env.server";
import { ipBucket } from "./check-read";

/**
 * The visitor's IP, only used (hashed) to limit free checks and report emails. Railway sets x-real-ip
 * to the client's address. Fallback: the last x-forwarded-for entry, the one our proxy added (visitors
 * can fake the first).
 */
export function clientIp(request: Request): string | null {
  const real = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  return real || forwarded || null;
}

/**
 * Posts from other websites are refused: a page elsewhere could auto-submit our forms from its
 * visitors' browsers (each with a new IP) and use up everyone's allowance.
 */
export function fromAnotherSite(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false; // old browsers and tools; the per-visitor limits still apply
  const ours = [request.url, env.appUrl].map((u) => {
    try {
      return new URL(u).origin;
    } catch {
      return null;
    }
  });
  return !ours.includes(origin);
}

export const MAX_FORM_BYTES = 8_192; // our forms have 2 or 3 short fields

/** The posted form, or null when the body is too big to be our form. Never buffers more than the cap. */
export async function readSmallForm(request: Request, max = MAX_FORM_BYTES): Promise<URLSearchParams | null> {
  if (Number(request.headers.get("content-length") ?? 0) > max) return null;
  if (!request.body) return new URLSearchParams();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new URLSearchParams(new TextDecoder().decode(Buffer.concat(chunks)));
}

// HMAC with a secret key: without the key, the stored hashes can't be turned back into IP addresses
// by trying every address. With no CHECK_IP_SECRET, a random key per process (limits reset on each deploy).
export const PUBLIC_KEY = env.checkIpSecret || randomBytes(32).toString("hex");

/** The visitor's IP (IPv6 by /64), scrambled. Visitors with no address share one value. */
export const hashIp = (ip: string | null) => createHmac("sha256", PUBLIC_KEY).update(ipBucket(ip || "unknown")).digest("hex");
