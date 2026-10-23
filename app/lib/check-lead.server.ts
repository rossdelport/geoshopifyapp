// Free product check: email capture and the emailed report. See docs/free-check.md.
// A visitor leaves their email (POST /check/:id/email). We save them as a Subscriber (with the words they
// agreed to) and queue one ReportEmail. The "check.email" job sends it once the check is done: a short
// email with the full report and action plan as a PDF. Asking for a report is not a newsletter sign-up:
// tips need the unticked box AND a click on "Yes, keep sending me tips" in that email (confirmTips).
// The page never gets the action plan; it only learns this browser's lead status (signed cookie).

import { createHmac, randomBytes } from "node:crypto";
import { createCookie } from "react-router";
import type { Job } from "@prisma/client";
import db from "../db.server";
import { env, isProd } from "./env.server";
import { MAX_ATTEMPTS, enqueue, registerJob } from "./jobs.server";
import { emailConfigured, replyAddress, sendEmailMessage, senderIdentity } from "./email.server";
import { BAD_EMAIL_ERROR, REPORT_CONSENT_TEXT, TIPS_CONSENT_TEXT } from "./check-consent";
import { suppressionHash } from "./retention.server";
import { buildActionPlan, type ActionPlan } from "./check-plan";
import { buildCheckPdf, noDashes, reportFileName } from "./check-pdf.server";
import { PUBLIC_KEY, hashIp } from "./public-form.server";
import { OFFER } from "./plans";
import {
  isCheckCountry,
  type CheckAnswer,
  type CheckEmailResult,
  type CheckLeadState,
  type CheckProduct,
  type CheckQuestion,
  type CheckReport,
} from "./check-types";

/** A check still not finished after this never will (check.server.ts uses the same). */
export const CHECK_STALE_MS = 30 * 60_000;

const DAY = 86_400_000;
// One check id is shared by everyone who pastes the same link that day (check.server.ts), so this cap is
// generous and its message doesn't say others asked; the per-IP, per-address and daily caps do the work.
const MAX_EMAILS_PER_CHECK = 10; // different addresses
const MAX_PER_IP = 5; // submissions per IP per 24 h
const MAX_PER_ADDRESS = 3; // report emails per address per 24 h
const DEFAULT_PER_DAY = 100; // all report emails per 24 h (GEO_REPORT_EMAILS_PER_DAY), until real volume is known
const SENDING_STALE_MS = 10 * 60_000; // a claim ("sending") older than this: its worker stopped

const LOCK = "geo:check-email";
const JOB = "check.email";

export const LEAD_ERRORS = {
  generic: "Something went wrong. Please try again.",
  email: BAD_EMAIL_ERROR,
  missing: "We couldn’t find that check. Please run a new one.",
  failed: "This check didn’t finish, so there’s no report to send. Please run it again.",
  perCheck: "We can’t send this report right now. Please try again later.",
  perIp: "You’ve asked for a lot of reports today. Please try again tomorrow.",
  perAddress: "We’ve sent a lot of reports to this address today. Please try again tomorrow.",
  busy: "We’re very busy right now. Please try again later today.",
  crossSite: "Please use the form on the GEO website.",
  tooBig: "That was too much to send. Please enter just your email address.",
  // Email isn't set up on the server: say so, and save nothing (never promise an email we can't send).
  paused: "Emailed reports are paused right now. Please try again later.",
};

// Settings the email form needs in production; without them it is paused or breaks quietly.
if (isProd) {
  if (!env.checkIpSecret) {
    console.warn("[check] WARNING: CHECK_IP_SECRET is not set. Free check limits and the report-sent cookie reset on every deploy and differ between replicas.");
  }
  if (!emailConfigured() || !env.appUrl) {
    console.warn("[check] WARNING: RESEND_API_KEY, GEO_EMAIL_FROM or SHOPIFY_APP_URL is not set. The free check's email form is paused (it says so and saves nothing).");
  }
  if (!senderIdentity().complete) {
    console.warn("[check] WARNING: GEO_LEGAL_NAME and GEO_POSTAL_ADDRESS (and GEO_ABN) are not set. Report emails must name the business and a postal address (Spam Act, CAN-SPAM, CASL).");
  }
}

/** A number from the environment; unset or unreadable means the default, and 0 means 0 (emails off). */
function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw?.trim() ? Number(raw) : fallback;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// ---------- Email addresses ----------

/** Lowercased and trimmed, or null when it doesn't look like an email address. */
export function normalizeEmail(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s || s.length > 254) return null;
  const at = s.lastIndexOf("@");
  if (at < 1 || at > 64) return null;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(s)) return null;
  if (s.startsWith(".") || s.slice(0, at).endsWith(".") || s.includes("..")) return null;
  if (!/\.[a-z]{2,}$/.test(s)) return null;
  return s;
}

/** "ross@gmail.com" -> "ro***@gmail.com". Only ever shown to the browser that typed it. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  return `${local.slice(0, local.length > 2 ? 2 : 1)}***${email.slice(at)}`;
}

// ---------- This browser's emails (signed cookie) ----------

// Signed (not readable or changeable by the browser's scripts), so getCheckView only tells a browser about
// emails it sent itself. Someone opening a shared report link never sees the sender's address.
const leadCookie = createCookie("geo_check_leads", {
  httpOnly: true,
  sameSite: "lax",
  secure: isProd,
  path: "/check",
  maxAge: 30 * 86_400,
  secrets: [createHmac("sha256", PUBLIC_KEY).update("geo:check-lead-cookie").digest("hex")],
});
const MAX_COOKIE_CHECKS = 10;

type LeadMap = Record<string, string>; // checkId -> email

async function readLeadCookie(request: Request): Promise<LeadMap> {
  try {
    const value = await leadCookie.parse(request.headers.get("cookie"));
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return {};
  }
}

async function leadCookieWith(request: Request | undefined, checkId: string, email: string): Promise<string> {
  const map = request ? await readLeadCookie(request) : {};
  delete map[checkId];
  map[checkId] = email;
  const kept = Object.entries(map).slice(-MAX_COOKIE_CHECKS);
  return leadCookie.serialize(Object.fromEntries(kept));
}

const NO_LEAD: CheckLeadState = { status: "none", maskedEmail: null };

/** This browser's email status for a check (none without a request or our cookie). */
export async function leadStateFor(request: Request | undefined, checkId: string): Promise<CheckLeadState> {
  if (!request) return NO_LEAD;
  const email = (await readLeadCookie(request))[checkId];
  if (!email) return NO_LEAD;
  const rows = await db.reportEmail.findMany({ where: { checkId, email }, orderBy: { createdAt: "desc" }, select: { status: true }, take: 20 });
  if (rows.some((r) => r.status === "sent")) return { status: "sent", maskedEmail: maskEmail(email) };
  if (rows[0]?.status === "pending" || rows[0]?.status === "sending") return { status: "pending", maskedEmail: maskEmail(email) };
  return NO_LEAD; // failed or skipped: the page offers the form again
}

// ---------- Saving an email ----------

export interface SubmitInput {
  checkId: string;
  email: unknown;
  honeypot?: unknown;
  /** The optional tips box ("1" when ticked). */
  tips?: unknown;
  ip: string | null;
  request?: Request; // for this browser's cookie
}

export interface SubmitOutput {
  result: CheckEmailResult;
  status: number;
  setCookie?: string;
}

const fail = (error: string, status: number): SubmitOutput => ({ result: { ok: false, error }, status });

const isFinished = (c: { status: string; createdAt: Date }) => c.status === "done";
const isDead = (c: { status: string; createdAt: Date }) =>
  c.status === "failed" || (c.status !== "done" && Date.now() - c.createdAt.getTime() > CHECK_STALE_MS);

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** On the tips list: ticked the box, then confirmed from their inbox, and not unsubscribed since. */
export const tipsListWhere = { tipsConfirmedAt: { not: null }, unsubscribedAt: null } as const;
const onTipsList = (s: { tipsConfirmedAt: Date | null; unsubscribedAt: Date | null }) => Boolean(s.tipsConfirmedAt && !s.unsubscribedAt);

/**
 * Save (or refresh) the address with the words it agreed to. A form post never takes anyone off the
 * unsubscribed list: only confirmTips (a click from their own inbox) can. A ticked tips box is recorded
 * with its words and waits for that click.
 */
async function saveSubscriber(tx: Tx, email: string, checkId: string, tips: boolean, now: Date) {
  const tipsData = tips ? { tipsConsentText: TIPS_CONSENT_TEXT, tipsConsentAt: now, tipsCheckId: checkId, tipsConfirmedAt: null } : {};
  const sub = await tx.subscriber.findUnique({ where: { email } });
  if (!sub) {
    // An address that opted out before (and was deleted since) stays opted out until it confirms again.
    const suppressed = await tx.emailSuppression.findUnique({ where: { emailHash: suppressionHash(email) } });
    await tx.subscriber.create({
      data: {
        email,
        source: "free-check",
        consentText: REPORT_CONSENT_TEXT,
        consentAt: now,
        consentCheckId: checkId,
        lastActiveAt: now,
        unsubscribedAt: suppressed?.createdAt ?? null,
        unsubscribeToken: randomBytes(24).toString("base64url"),
        ...tipsData,
      },
    });
    return;
  }
  // Already on the tips list: keep the consent they confirmed.
  await tx.subscriber.update({ where: { id: sub.id }, data: { lastActiveAt: now, ...(onTipsList(sub) ? {} : tipsData) } });
}

export async function submitCheckEmail(input: SubmitInput): Promise<SubmitOutput> {
  if (String(input.honeypot ?? "").trim()) return fail(LEAD_ERRORS.generic, 400);
  if (!emailConfigured() || !env.appUrl) return fail(LEAD_ERRORS.paused, 503);
  const email = normalizeEmail(input.email);
  if (!email) return fail(LEAD_ERRORS.email, 400);
  const tips = String(input.tips ?? "").trim() === "1";
  const since = new Date(Date.now() - DAY);
  const ipHash = hashIp(input.ip);

  // Limits are counted and the rows written under one lock, so posts sent at the same moment can't all
  // see "room left".
  const out = await db.$transaction(
    async (tx): Promise<{ ok: false; error: string; status: number } | { ok: true; rowId: string }> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK}))`;
      const check = await tx.publicCheck.findUnique({ where: { id: input.checkId }, select: { id: true, status: true, createdAt: true } });
      if (!check) return { ok: false, error: LEAD_ERRORS.missing, status: 404 };
      if (isDead(check)) return { ok: false, error: LEAD_ERRORS.failed, status: 400 };

      // The same address asking again for a report that hasn't gone yet: no new email (a newly ticked
      // tips box is still recorded).
      const waiting = await tx.reportEmail.findFirst({
        where: { checkId: check.id, email, status: { in: ["pending", "sending"] } },
        select: { id: true },
      });
      if (!waiting) {
        const others = await tx.reportEmail.findMany({ where: { checkId: check.id, email: { not: email } }, distinct: ["email"], select: { email: true } });
        if (others.length >= MAX_EMAILS_PER_CHECK) return { ok: false, error: LEAD_ERRORS.perCheck, status: 429 };
        if ((await tx.reportEmail.count({ where: { ipHash, createdAt: { gte: since } } })) >= MAX_PER_IP) {
          return { ok: false, error: LEAD_ERRORS.perIp, status: 429 };
        }
        if ((await tx.reportEmail.count({ where: { email, createdAt: { gte: since } } })) >= MAX_PER_ADDRESS) {
          return { ok: false, error: LEAD_ERRORS.perAddress, status: 429 };
        }
        if ((await tx.reportEmail.count({ where: { createdAt: { gte: since } } })) >= envNumber("GEO_REPORT_EMAILS_PER_DAY", DEFAULT_PER_DAY)) {
          return { ok: false, error: LEAD_ERRORS.busy, status: 429 };
        }
      }

      await saveSubscriber(tx, email, check.id, tips, new Date());
      const rowId = waiting?.id ?? (await tx.reportEmail.create({ data: { email, checkId: check.id, status: "pending", ipHash } })).id;
      return { ok: true, rowId };
    },
    { maxWait: 10_000, timeout: 15_000 },
  );
  if (!out.ok) return fail(out.error, out.status);

  // Done already: send now. Still running: runCheck queues it when the check finishes. Read again after
  // saving, in case the check finished in between (the job's key stops a second send either way).
  const check = await db.publicCheck.findUnique({ where: { id: input.checkId }, select: { status: true, createdAt: true } });
  if (check && isFinished(check)) await queueReportEmail(out.rowId);

  return {
    result: { ok: true, lead: { status: "pending", maskedEmail: maskEmail(email) } },
    status: 200,
    setCookie: await leadCookieWith(input.request, input.checkId, email),
  };
}

// ---------- Queueing (called by check.server.ts when a check ends) ----------

async function queueReportEmail(rowId: string) {
  await enqueue(JOB, { id: rowId }, { dedupeKey: `check-email:${rowId}` });
}

/** The check finished: queue every report email waiting for it. */
export async function queueReportEmails(checkId: string) {
  const rows = await db.reportEmail.findMany({ where: { checkId, status: "pending" }, select: { id: true } });
  for (const r of rows) await queueReportEmail(r.id);
}

/**
 * Safety net, run every minute by the worker: a report email still pending 5 minutes after it was saved
 * (the server stopped between saving it and queueing it, or the check ended while it was being saved)
 * is queued now if its check is done, or skipped if its check didn't finish. A claim ("sending") whose
 * worker stopped more than 10 minutes ago goes back to pending first (a resend reuses Resend's
 * idempotency key, so an email that did go out isn't sent twice). An email that already has a job
 * waiting is left alone (enqueue's key). Returns how many it queued.
 */
export async function queueStrandedReportEmails(now = new Date()): Promise<number> {
  await db.reportEmail.updateMany({
    where: { status: "sending", lockedAt: { lt: new Date(now.getTime() - SENDING_STALE_MS) } },
    data: { status: "pending", lockedAt: null },
  });
  const rows = await db.reportEmail.findMany({
    where: { status: "pending", createdAt: { lt: new Date(now.getTime() - 5 * 60_000), gte: new Date(now.getTime() - 2 * DAY) } },
    select: { id: true, checkId: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  if (!rows.length) return 0;
  const checks = await db.publicCheck.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.checkId))] } },
    select: { id: true, status: true, createdAt: true },
  });
  const byId = new Map(checks.map((c) => [c.id, c]));
  let queued = 0;
  for (const r of rows) {
    const c = byId.get(r.checkId);
    if (!c) await skip(r.id, "The check was deleted");
    else if (isDead(c)) await skip(r.id, "The check didn’t finish");
    else if (isFinished(c)) {
      await queueReportEmail(r.id);
      queued++;
    }
  }
  return queued;
}

/** The check failed: nothing to send. */
export async function skipReportEmails(checkId: string) {
  await db.reportEmail.updateMany({ where: { checkId, status: "pending" }, data: { status: "skipped", error: "The check didn’t finish" } });
}

// ---------- The email ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Text from the visitor's page (title, brand, domain, brands the AI named) as it goes into an email: no
 * control or text-direction characters (no header tricks, no reversed text), no em dashes, and no live
 * links: a zero-width space after each dot, "@" and "//" stops mail apps turning "evil.example" into a link.
 */
export function emailSafe(raw: string, max = 160): string {
  // eslint-disable-next-line no-control-regex -- removing control characters is the point
  const plain = noDashes(String(raw ?? "").replace(/[\u0000-\u001f\u007f-\u009f‎‏‪-‮⁦-⁩]/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return plain.replace(/(\.|@|\/\/)(?=\S)/g, "$1​");
}

/** Where "Join the GEO waitlist" goes: the home page, which opens the waitlist popup. */
export const JOIN_PATH = "/#waitlist";

function appUrl(): string {
  if (!env.appUrl) throw new Error("SHOPIFY_APP_URL is not set, so the report email can't link back to GEO");
  return env.appUrl;
}

/** The fixed subject: nothing from the visitor's page, so nobody can put their words in our subject line. */
export const REPORT_SUBJECT = "Your free AI visibility report";

/** "ask": ticked the tips box, not confirmed yet. "on": on the tips list. "off": the report only. */
export type TipsState = "ask" | "on" | "off";

export function tipsStateOf(s: { tipsConsentAt: Date | null; tipsConfirmedAt: Date | null; unsubscribedAt: Date | null }): TipsState {
  if (onTipsList(s)) return "on";
  if (!s.tipsConsentAt) return "off";
  return s.unsubscribedAt && s.unsubscribedAt >= s.tipsConsentAt ? "off" : "ask";
}

export interface ReportEmailInput {
  product: CheckProduct;
  report: CheckReport;
  plan: ActionPlan;
  joinUrl: string; // absolute
  checkUrl: string; // absolute
  unsubscribeUrl: string; // absolute
  confirmTipsUrl: string; // absolute: "Yes, keep sending me tips" (shown only when tips is "ask")
  tips: TipsState;
  sender: string; // senderIdentity().line
  replyTo: string;
}

/** Subject, HTML and plain text of the report email (the PDF is attached separately). */
export function reportEmailContent(i: ReportEmailInput): { subject: string; html: string; text: string } {
  const { product, report, plan } = i;
  const title = emailSafe(product.title, 120);
  const brand = emailSafe(product.brand, 80);
  const domain = emailSafe(product.domain, 80);
  const top = report.competitors[0];
  const named = `AI named ${brand} in ${report.namedCount} of ${report.answerCount} answers.`;
  const rival = top ? `It recommended ${emailSafe(top.name, 80)} most often, in ${top.count} ${top.count === 1 ? "answer" : "answers"}.` : "";
  const steps = plan.steps.filter((s) => s.kind !== "geo").slice(0, 3).map((s) => emailSafe(s.title, 120));
  const price = `${OFFER.line} Join the waitlist and we’ll reach out shortly.`;
  const cta = "Join the GEO waitlist";
  const why = "You’re getting this because you asked for this report on the GEO website.";
  const tipsLine =
    i.tips === "on"
      ? "You’re on our list for occasional tips on getting recommended by AI."
      : i.tips === "ask"
        ? "You also asked for occasional tips on getting recommended by AI. We’ll only send them if you confirm."
        : "We won’t email you again unless you ask.";
  const confirmLabel = "Yes, keep sending me tips";
  const sender = noDashes(i.sender);

  const subject = REPORT_SUBJECT;
  const link = "color:#4050b0;";
  const p = (s: string, style = "") => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#30313d;${style}">${s}</p>`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#efecfd;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(named)} Your full report and action plan are attached.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efecfd;padding:28px 12px;font-family:Inter,Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 6px 16px;font-size:20px;font-weight:700;color:#0b0c2b;letter-spacing:-0.01em;">
<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#9faaf2;vertical-align:middle;"></span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#4050b0;margin-left:-4px;margin-right:8px;vertical-align:middle;"></span>GEO
</td></tr>
<tr><td style="background:#ffffff;border-radius:18px;padding:28px 26px;border:1px solid #e4e0f8;">
<p style="margin:0 0 6px;font-size:13px;color:#4050b0;font-weight:600;">Your free product check</p>
<h1 style="margin:0 0 4px;font-size:22px;line-height:1.3;color:#0b0c2b;">${esc(title)}</h1>
<p style="margin:0 0 20px;font-size:14px;color:#5c5d78;">${esc(brand)} · ${esc(domain)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>
<td style="background:#efecfd;border-radius:14px;padding:14px 18px;text-align:center;">
<div style="font-size:30px;font-weight:700;color:#0b0c2b;line-height:1;">${report.score}</div>
<div style="font-size:12px;color:#5c5d78;margin-top:4px;">out of 100</div></td>
<td style="padding-left:16px;font-size:15px;color:#0b0c2b;font-weight:600;">${esc(report.label)}</td>
</tr></table>
${p(esc(named) + (rival ? ` ${esc(rival)}` : ""))}
${p(steps.length ? "Your full report and action plan are attached as a PDF. Start with these:" : "Your full report and action plan are attached as a PDF.")}
${steps.length ? `<ol style="margin:0 0 20px;padding-left:22px;font-size:15px;line-height:1.6;color:#0b0c2b;">${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 10px;"><tr><td style="background:#4050b0;border-radius:999px;">
<a href="${esc(i.joinUrl)}" style="display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(cta)}</a>
</td></tr></table>
${p(esc(price), "font-size:13px;color:#5c5d78;")}
${p(`<a href="${esc(i.checkUrl)}" style="${link}">See your report online</a> (for 30 days).`, "font-size:13px;margin:0;")}
</td></tr>
${
  i.tips === "ask"
    ? `<tr><td style="padding:16px 8px 0;font-size:13px;line-height:1.6;color:#30313d;">${esc(tipsLine)} <a href="${esc(i.confirmTipsUrl)}" style="${link}font-weight:600;">${esc(confirmLabel)}</a>. If you don’t click it, this is the only email we send.</td></tr>`
    : ""
}
<tr><td style="padding:18px 8px 0;font-size:12px;line-height:1.6;color:#5c5d78;">
${esc(why)}${i.tips === "ask" ? "" : ` ${esc(tipsLine)}`} <a href="${esc(i.unsubscribeUrl)}" style="${link}">Unsubscribe</a>.<br>
${esc(sender)} Questions? Reply to this email or write to <a href="mailto:${esc(i.replyTo)}" style="${link}">${esc(i.replyTo)}</a>.
</td></tr>
</table>
</td></tr></table>
</body></html>`;

  const text = [
    `Your free product check: ${title}`,
    `${brand} · ${domain}`,
    "",
    `Score: ${report.score} out of 100 (${report.label})`,
    named,
    ...(rival ? [rival] : []),
    "",
    steps.length ? "Your full report and action plan are attached as a PDF. Start with these:" : "Your full report and action plan are attached as a PDF.",
    ...steps.map((s, n) => `${n + 1}. ${s}`),
    "",
    `${cta}: ${i.joinUrl}`,
    price,
    `See your report online (for 30 days): ${i.checkUrl}`,
    ...(i.tips === "ask" ? ["", tipsLine, `${confirmLabel}: ${i.confirmTipsUrl}`, "If you don’t click it, this is the only email we send."] : []),
    "",
    "--",
    i.tips === "ask" ? why : `${why} ${tipsLine}`,
    `Unsubscribe: ${i.unsubscribeUrl}`,
    `${sender} Questions? Reply to this email or write to ${i.replyTo}.`,
  ].join("\n");
  return { subject, html, text };
}

type SendOutcome = "sent" | "skipped" | "waiting" | "none";

async function skip(id: string, reason: string): Promise<SendOutcome> {
  await db.reportEmail.update({ where: { id }, data: { status: "skipped", error: reason, lockedAt: null } });
  return "skipped";
}

/**
 * Send one report email. Idempotent: only a pending row is sent, and it is claimed first ("sending"), so
 * two workers can't both send it. The PDF's bytes are the same on every try, so Resend's idempotency key
 * stops a second copy if we crash between sending and saving "sent"; when Resend says it already took
 * that key (409), the row counts as sent. Throws (so the job retries, up to 4 tries in all) when sending
 * fails or email isn't set up; the row goes back to pending, or to failed after the last try.
 */
export async function sendReportEmail(id: string, attempt = 1): Promise<SendOutcome> {
  const row = await db.reportEmail.findUnique({ where: { id } });
  if (!row || row.status !== "pending") return "none"; // sent, skipped, failed, or being sent right now
  const check = await db.publicCheck.findUnique({ where: { id: row.checkId } });
  if (!check) return skip(id, "The check was deleted");
  if (isDead(check)) return skip(id, "The check didn’t finish");
  if (!isFinished(check)) return "waiting"; // runCheck queues it again when the check is done
  const sub = await db.subscriber.findUnique({ where: { email: row.email } });
  // Unsubscribed after asking: don't send. A report asked for after unsubscribing still goes (once).
  if (!sub) return skip(id, "No subscriber");
  if (sub.unsubscribedAt && sub.unsubscribedAt > row.createdAt) return skip(id, "Unsubscribed");

  const claim = await db.reportEmail.updateMany({ where: { id, status: "pending" }, data: { status: "sending", lockedAt: new Date() } });
  if (!claim.count) return "none";

  try {
    if (!emailConfigured()) throw new Error("Email is not set up (RESEND_API_KEY / GEO_EMAIL_FROM), so the report email was not sent");
    const base = appUrl();
    const product = check.product as unknown as CheckProduct | null;
    const report = check.report as unknown as CheckReport | null;
    if (!product || !report) return await skip(id, "The check has no report");
    const questions = (check.questions as unknown as CheckQuestion[]) ?? [];
    const answers = (check.answers as unknown as CheckAnswer[]) ?? [];
    const joinUrl = `${base}${JOIN_PATH}`;
    const checkUrl = `${base}/check/${check.id}`;
    const plan = buildActionPlan({ product, questions, answers, report, joinUrl });
    const pdf = await buildCheckPdf({
      product,
      country: isCheckCountry(check.country) ? check.country : null,
      createdAt: check.createdAt,
      finishedAt: check.finishedAt,
      questions,
      answers,
      report,
      plan,
      joinUrl,
      checkUrl,
    });
    const token = encodeURIComponent(sub.unsubscribeToken);
    const unsubscribeUrl = `${base}/unsubscribe?t=${token}`;
    const replyTo = replyAddress();
    const content = reportEmailContent({
      product,
      report,
      plan,
      joinUrl,
      checkUrl,
      unsubscribeUrl,
      confirmTipsUrl: `${base}/tips?t=${token}`,
      tips: tipsStateOf(sub),
      sender: senderIdentity().line,
      replyTo,
    });
    await sendEmailMessage({
      to: [row.email],
      ...content,
      replyTo,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      attachments: [{ filename: reportFileName(product.brand), content: pdf }],
      idempotencyKey: `geo-report-email/${row.id}`,
    });
  } catch (err) {
    const message = (err as Error).message.slice(0, 1000);
    await db.reportEmail
      .update({ where: { id }, data: { attempts: { increment: 1 }, error: message, lockedAt: null, status: attempt >= MAX_ATTEMPTS ? "failed" : "pending" } })
      .catch(() => {});
    throw err;
  }
  // A 409 "already sent with this key" lands here too: the email went out on an earlier try.
  await db.reportEmail.update({ where: { id }, data: { status: "sent", sentAt: new Date(), lockedAt: null, attempts: { increment: 1 }, error: null } });
  return "sent";
}

export async function runReportEmailJob(job: Pick<Job, "payload" | "attempts">) {
  const { id } = (job.payload ?? {}) as { id?: string };
  if (!id) return;
  await sendReportEmail(id, job.attempts);
}

// Retried by the queue (4 tries in all). If email isn't set up, the job fails and stays in the jobs
// table (like founder.notice), and the row is marked failed.
registerJob(JOB, runReportEmailJob);

// ---------- Unsubscribe and tips (links in every report email; the token is the same for both) ----------

const tokenOk = (token: string) => Boolean(token) && token.length <= 100;

/** The subscriber for an unsubscribe link (masked email only), or null when the link is wrong. */
export async function findUnsubscribe(token: string): Promise<{ maskedEmail: string; unsubscribed: boolean } | null> {
  if (!tokenOk(token)) return null;
  const sub = await db.subscriber.findUnique({ where: { unsubscribeToken: token }, select: { email: true, unsubscribedAt: true } });
  return sub ? { maskedEmail: maskEmail(sub.email), unsubscribed: Boolean(sub.unsubscribedAt) } : null;
}

/** Unsubscribe by the link's token (also off the tips list). True when the token was ours (already unsubscribed counts). */
export async function unsubscribe(token: string): Promise<boolean> {
  if (!tokenOk(token)) return false;
  const sub = await db.subscriber.findUnique({ where: { unsubscribeToken: token }, select: { id: true, unsubscribedAt: true } });
  if (!sub) return false;
  if (!sub.unsubscribedAt) await db.subscriber.update({ where: { id: sub.id }, data: { unsubscribedAt: new Date(), tipsConfirmedAt: null } });
  return true;
}

/** The "keep sending me tips" link: the masked address and where it stands, or null when the link is wrong. */
export async function findTips(token: string): Promise<{ maskedEmail: string; state: TipsState } | null> {
  if (!tokenOk(token)) return null;
  const sub = await db.subscriber.findUnique({ where: { unsubscribeToken: token } });
  return sub ? { maskedEmail: maskEmail(sub.email), state: tipsStateOf(sub) } : null;
}

/**
 * "Yes, keep sending me tips", clicked in the report email (a POST from the confirm page, so a mail
 * scanner opening the link changes nothing). Only works for someone who ticked the box, and the tick is
 * newer than any unsubscribe: then they're on the list again. Returns their state after the click.
 */
export async function confirmTips(token: string): Promise<TipsState | null> {
  if (!tokenOk(token)) return null;
  const sub = await db.subscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!sub) return null;
  const state = tipsStateOf(sub);
  if (state !== "ask") return state;
  const now = new Date();
  await db.subscriber.update({ where: { id: sub.id }, data: { tipsConfirmedAt: now, unsubscribedAt: null, lastActiveAt: now } });
  await db.emailSuppression.deleteMany({ where: { emailHash: suppressionHash(sub.email) } });
  return "on";
}
