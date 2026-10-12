// Website waitlist: the home page's "Join the waitlist" popup posts name + email to /waitlist
// (routes/waitlist.tsx). One row per address in WaitlistSignup (geo schema). A new address emails
// GEO_ALERT_EMAIL (job "waitlist.notice") when email is set up, so someone can reach out.

import db from "../db.server";
import { env } from "./env.server";
import { enqueue, registerJob } from "./jobs.server";
import { emailConfigured, sendEmail } from "./email.server";
import { normalizeEmail } from "./check-lead.server";
import { hashIp } from "./public-form.server";
import { BAD_EMAIL_ERROR } from "./check-consent";

/** The words under the form, saved with each signup. design/overview/parts/46-waitlist.html shows the same. */
export const WAITLIST_CONSENT_TEXT = "We’ll only use this to contact you about GEO.";

export const WAITLIST_ERRORS = {
  generic: "Something went wrong. Please try again.",
  name: "Please enter your name.",
  email: BAD_EMAIL_ERROR,
  perIp: "You’ve joined a lot today. Please try again tomorrow.",
  busy: "We’re very busy right now. Please try again later today.",
  crossSite: "Please use the form on the GEO website.",
  tooBig: "That was too much to send. Please enter just your name and email.",
};

const DAY = 86_400_000;
const MAX_PER_IP = 10; // joins per IP per 24 h
const MAX_PER_DAY = 2_000; // all joins per 24 h, so a bot can't fill the table
const SOURCES = ["hero", "nav", "pricing", "footer", "link"] as const;

export type WaitlistResult = { ok: true } | { ok: false; error: string };

export interface JoinInput {
  name: unknown;
  email: unknown;
  honeypot?: unknown;
  source?: unknown;
  plan?: unknown;
  cycle?: unknown;
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

export async function joinWaitlist(input: JoinInput): Promise<{ status: number; result: WaitlistResult }> {
  // A bot filled the hidden field: say yes and save nothing.
  if (String(input.honeypot ?? "").trim()) return { status: 200, result: { ok: true } };

  const name = clean(input.name, 80);
  if (!name) return { status: 400, result: { ok: false, error: WAITLIST_ERRORS.name } };
  const email = normalizeEmail(input.email);
  if (!email) return { status: 400, result: { ok: false, error: WAITLIST_ERRORS.email } };

  const source = (SOURCES as readonly string[]).includes(String(input.source)) ? String(input.source) : "link";
  const plan = input.plan === "core" || input.plan === "pro" ? input.plan : null;
  const cycle = plan && (input.cycle === "monthly" || input.cycle === "yearly") ? input.cycle : null;
  const ipHash = hashIp(input.ip);
  const since = new Date(Date.now() - DAY);

  if ((await db.waitlistSignup.count({ where: { ipHash, updatedAt: { gte: since } } })) >= MAX_PER_IP) {
    return { status: 429, result: { ok: false, error: WAITLIST_ERRORS.perIp } };
  }
  if ((await db.waitlistSignup.count({ where: { updatedAt: { gte: since } } })) >= MAX_PER_DAY) {
    return { status: 503, result: { ok: false, error: WAITLIST_ERRORS.busy } };
  }

  // Joining again keeps where they first came from and only updates the name.
  const before = await db.waitlistSignup.findUnique({ where: { email }, select: { id: true } });
  const row = await db.waitlistSignup.upsert({
    where: { email },
    update: { name, ipHash, joins: { increment: 1 } },
    create: {
      email,
      name,
      source,
      plan,
      cycle,
      utmSource: clean(input.utmSource, 200),
      utmMedium: clean(input.utmMedium, 200),
      utmCampaign: clean(input.utmCampaign, 200),
      utmContent: clean(input.utmContent, 200),
      utmTerm: clean(input.utmTerm, 200),
      fbclid: clean(input.fbclid, 500),
      referrer: refHost(input.referrer),
      consentText: WAITLIST_CONSENT_TEXT,
      ipHash,
    },
  });

  if (!before) {
    if (env.alertEmail && emailConfigured()) await enqueue("waitlist.notice", { id: row.id });
    else console.log(`[waitlist] new signup ${row.id} (set GEO_ALERT_EMAIL to get an email for each one)`);
  }
  return { status: 200, result: { ok: true } };
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The email to GEO_ALERT_EMAIL for one signup (exported for tests). */
export function waitlistNoticeEmail(r: {
  name: string;
  email: string;
  source: string;
  plan: string | null;
  cycle: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  referrer: string | null;
}): { subject: string; html: string } {
  const lines = [
    `<b>Name:</b> ${esc(r.name)}`,
    `<b>Email:</b> ${esc(r.email)}`,
    `<b>Joined from:</b> ${esc(r.source)}${r.plan ? ` (${esc(r.plan === "pro" ? "Done-for-you" : "Standard")}${r.cycle ? `, ${esc(r.cycle)}` : ""})` : ""}`,
  ];
  if (r.utmSource || r.utmCampaign) lines.push(`<b>Ad:</b> ${esc([r.utmSource, r.utmCampaign].filter(Boolean).join(" / "))}`);
  if (r.referrer) lines.push(`<b>Came from:</b> ${esc(r.referrer)}`);
  return { subject: `New waitlist signup: ${r.name}`, html: `<p>${lines.join("<br>")}</p><p>They were told: we’ll reach out shortly.</p>` };
}

registerJob("waitlist.notice", async (job) => {
  const id = String((job.payload as { id?: string }).id ?? "");
  const row = await db.waitlistSignup.findUnique({ where: { id } });
  if (!row) return; // deleted since
  if (!env.alertEmail || !emailConfigured()) throw new Error("GEO_ALERT_EMAIL or email is not set up");
  const { subject, html } = waitlistNoticeEmail(row);
  await sendEmail([env.alertEmail], subject, html);
});
