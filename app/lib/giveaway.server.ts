// The 3-month giveaway (app/lib/giveaway.ts has the dates and words). The form on firstpicked.com.au/giveaway posts here
// (routes/giveaway.tsx). One entry per store (GiveawayEntry, geo schema). A new entry emails GEO_ALERT_EMAIL
// (job "giveaway.notice") when email is set up. Ross sees every entry, downloads them and draws the winner in
// Admin > Giveaway.

import { randomInt } from "node:crypto";
import db from "../db.server";
import { env } from "./env.server";
import { enqueue, registerJob } from "./jobs.server";
import { emailConfigured, sendEmail } from "./email.server";
import { normalizeEmail } from "./check-lead.server";
import { hashIp } from "./public-form.server";
import { storeHost } from "./public-catalog.server";
import { GIVEAWAY_CONSENT_TEXT, GIVEAWAY_ERRORS, cleanPhone, isOpen } from "./giveaway";

const DAY = 86_400_000;
const MAX_PER_IP = 10; // entries per IP per 24 h
const MAX_PER_DAY = 3_000; // all entries per 24 h, so a bot can't fill the table

/** isNew: a store not in the draw yet. The page only tells Meta "Lead" for a new one. */
export type GiveawayResult = { ok: true; isNew?: boolean } | { ok: false; error: string; field?: "store" | "name" | "email" | "phone" };

export interface EntryInput {
  store: unknown;
  name: unknown;
  email: unknown;
  phone: unknown;
  honeypot?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
  utmContent?: unknown;
  utmTerm?: unknown;
  fbclid?: unknown;
  referrer?: unknown;
  ip: string | null;
}

/** Trimmed, spaces squeezed, no control characters or angle brackets; null when empty. */
function clean(raw: unknown, max: number): string | null {
  const s = String(raw ?? "")
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return s || null;
}

/** Just the site the visitor came from ("l.facebook.com"), never the full address. */
function refHost(raw: unknown): string | null {
  try {
    const u = new URL(String(raw ?? ""));
    return /^https?:$/.test(u.protocol) ? u.host.slice(0, 200) : null;
  } catch {
    return null;
  }
}

export async function enterGiveaway(input: EntryInput, now = new Date()): Promise<{ status: number; result: GiveawayResult }> {
  // A bot filled the hidden field: say yes and save nothing.
  if (String(input.honeypot ?? "").trim()) return { status: 200, result: { ok: true } };
  if (!isOpen(now))
    return {
      status: 403,
      result: { ok: false, error: GIVEAWAY_ERRORS.closed },
    };

  // "https://www.Store.com.au/products/x" and "store.com.au" are the same store.
  const store = storeHost(input.store)?.replace(/^www\./, "") ?? null;
  if (!store)
    return {
      status: 400,
      result: { ok: false, error: GIVEAWAY_ERRORS.store, field: "store" },
    };
  const name = clean(input.name, 80);
  if (!name)
    return {
      status: 400,
      result: { ok: false, error: GIVEAWAY_ERRORS.name, field: "name" },
    };
  const email = normalizeEmail(input.email);
  if (!email)
    return {
      status: 400,
      result: { ok: false, error: GIVEAWAY_ERRORS.email, field: "email" },
    };
  const phone = cleanPhone(input.phone);
  if (!phone)
    return {
      status: 400,
      result: { ok: false, error: GIVEAWAY_ERRORS.phone, field: "phone" },
    };

  const ipHash = hashIp(input.ip);
  const since = new Date(now.getTime() - DAY);
  const [fromIp, today, before] = await Promise.all([
    db.giveawayEntry.count({ where: { ipHash, createdAt: { gte: since } } }),
    db.giveawayEntry.count({ where: { createdAt: { gte: since } } }),
    db.giveawayEntry.findUnique({
      where: { store },
      select: { id: true, email: true },
    }),
  ]);

  // One entry per store. The same person entering again can fix their name or phone; anyone else is told they're
  // in (the store already is) without changing the first entry.
  if (before) {
    if (before.email === email)
      await db.giveawayEntry.update({
        where: { id: before.id },
        data: { name, phone },
      });
    return { status: 200, result: { ok: true, isNew: false } };
  }
  if (fromIp >= MAX_PER_IP) return { status: 429, result: { ok: false, error: GIVEAWAY_ERRORS.perIp } };
  if (today >= MAX_PER_DAY) return { status: 503, result: { ok: false, error: GIVEAWAY_ERRORS.busy } };

  let id: string;
  try {
    ({ id } = await db.giveawayEntry.create({
      data: {
        store,
        name,
        email,
        phone,
        utmSource: clean(input.utmSource, 200),
        utmMedium: clean(input.utmMedium, 200),
        utmCampaign: clean(input.utmCampaign, 200),
        utmContent: clean(input.utmContent, 200),
        utmTerm: clean(input.utmTerm, 200),
        fbclid: clean(input.fbclid, 500),
        referrer: refHost(input.referrer),
        consentText: GIVEAWAY_CONSENT_TEXT,
        ipHash,
      },
      select: { id: true },
    }));
  } catch (err) {
    // The same store sent twice at once: the other request saved it.
    if ((err as { code?: string }).code === "P2002") return { status: 200, result: { ok: true, isNew: false } };
    throw err;
  }

  if (env.alertEmail && emailConfigured()) await enqueue("giveaway.notice", { id });
  else console.log(`[giveaway] new entry ${id} (set GEO_ALERT_EMAIL to get an email for each one)`);
  return { status: 200, result: { ok: true, isNew: true } };
}

/**
 * The random draw (Admin > Giveaway), only once entries have closed: one entry picked fairly from those not drawn
 * yet, and marked with the time. The latest pick is the winner: pressing again picks a new winner from the rest
 * (when the last one can't be reached or doesn't meet the rules).
 */
export async function drawWinner(now = new Date()) {
  if (isOpen(now)) return null;
  const left = await db.giveawayEntry.findMany({
    where: { drawnAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!left.length) return null;
  return db.giveawayEntry.update({
    where: { id: left[randomInt(left.length)].id },
    data: { drawnAt: now },
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The email to GEO_ALERT_EMAIL for one entry (exported for tests). */
export function giveawayNoticeEmail(r: {
  store: string;
  name: string;
  email: string;
  phone: string;
  utmSource: string | null;
  utmCampaign: string | null;
  referrer: string | null;
}): { subject: string; html: string } {
  const lines = [
    `<b>Store:</b> <a href="https://${esc(r.store)}">${esc(r.store)}</a>`,
    `<b>Name:</b> ${esc(r.name)}`,
    `<b>Email:</b> ${esc(r.email)}`,
    `<b>Phone:</b> ${esc(r.phone)}`,
  ];
  if (r.utmSource || r.utmCampaign) lines.push(`<b>Ad:</b> ${esc([r.utmSource, r.utmCampaign].filter(Boolean).join(" / "))}`);
  if (r.referrer) lines.push(`<b>Came from:</b> ${esc(r.referrer)}`);
  return {
    subject: `New giveaway entry: ${r.store}`,
    html: `<p>${lines.join("<br>")}</p><p>Every entry is in Admin &gt; Giveaway, where you also draw the winner.</p>`,
  };
}

registerJob("giveaway.notice", async (job) => {
  const id = String((job.payload as { id?: string }).id ?? "");
  const row = await db.giveawayEntry.findUnique({ where: { id } });
  if (!row) return; // deleted since
  if (!env.alertEmail || !emailConfigured()) throw new Error("GEO_ALERT_EMAIL or email is not set up");
  const { subject, html } = giveawayNoticeEmail(row);
  await sendEmail([env.alertEmail], subject, html);
});
