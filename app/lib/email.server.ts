// Send an email through Resend (monthly reports, operator alerts, free check reports).

import { env } from "./env.server";
import { recordCost } from "./cost.server";

export const emailConfigured = () => Boolean(env.resendKey && env.emailFrom);

export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | null;
  /** Extra headers, e.g. List-Unsubscribe. */
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
  /** Resend keeps this for 24 hours: the same key never sends a second email (safe retries). */
  idempotencyKey?: string;
  shopId?: string | null;
}

/** "GEO <hello@geo.example>" -> "hello@geo.example". */
export function addressOf(from: string): string {
  return from.match(/<([^>]+)>/)?.[1]?.trim() ?? from.trim();
}

/**
 * Who sends our emails, as the Spam Act (and CAN-SPAM, CASL) asks: the business's legal name, ABN and a
 * postal address (a PO box is fine), from GEO_LEGAL_NAME, GEO_ABN and GEO_POSTAL_ADDRESS. GEO is a
 * working name, so without them the footer can only say "Sent by GEO" (check-lead.server.ts warns at
 * start-up in production). The privacy page shows the same.
 */
export function senderIdentity(): { legalName: string; abn: string; postal: string; complete: boolean; line: string } {
  const legalName = (process.env.GEO_LEGAL_NAME || "").trim();
  const abn = (process.env.GEO_ABN || "").trim();
  const postal = (process.env.GEO_POSTAL_ADDRESS || "").trim();
  const line = legalName
    ? `Sent by ${legalName}${abn ? ` (ABN ${abn})` : ""}, trading as GEO${postal ? `, ${postal}` : ""}.`
    : "Sent by GEO.";
  return { legalName, abn, postal, complete: Boolean(legalName && postal), line };
}

/** Where replies go: GEO_REPLY_TO, else SUPPORT_EMAIL, else the sender's own address. */
export function replyAddress(): string {
  return (process.env.GEO_REPLY_TO || process.env.SUPPORT_EMAIL || addressOf(env.emailFrom)).trim();
}

export interface SendResult {
  /**
   * Resend already accepted an email with this idempotency key (and answered 409 invalid_idempotent_request
   * to this copy): the email went out on an earlier try, so the caller can count it as sent.
   */
  duplicate: boolean;
}

export async function sendEmailMessage(msg: EmailMessage): Promise<SendResult> {
  if (!emailConfigured()) throw new Error("Email is not set up (RESEND_API_KEY / GEO_EMAIL_FROM)");
  const body: Record<string, unknown> = { from: env.emailFrom, to: msg.to, subject: msg.subject, html: msg.html };
  if (msg.text) body.text = msg.text;
  if (msg.replyTo) body.reply_to = msg.replyTo;
  if (msg.headers && Object.keys(msg.headers).length) body.headers = msg.headers;
  if (msg.attachments?.length) {
    body.attachments = msg.attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") }));
  }
  const headers: Record<string, string> = { Authorization: `Bearer ${env.resendKey}`, "content-type": "application/json" };
  if (msg.idempotencyKey) headers["Idempotency-Key"] = msg.idempotencyKey.slice(0, 256);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(msg.attachments?.length ? 30_000 : 10_000),
  });
  if (!res.ok) {
    const raw = (await res.text().catch(() => "")).slice(0, 300);
    if (res.status === 409 && msg.idempotencyKey) {
      const name = errorName(raw);
      if (name === "invalid_idempotent_request") return { duplicate: true };
      if (name === "concurrent_idempotent_requests") throw new Error("Resend 409: the same email is being sent right now; trying again later");
    }
    throw new Error(`Resend ${res.status}: ${raw}`);
  }
  await recordCost(msg.shopId, "resend", "email", 0.0004).catch(() => {});
  return { duplicate: false };
}

/** Resend's error body is {"statusCode":409,"name":"...","message":"..."}. */
function errorName(raw: string): string | null {
  try {
    const name = (JSON.parse(raw) as { name?: unknown }).name;
    return typeof name === "string" ? name : null;
  } catch {
    return null;
  }
}

export async function sendEmail(to: string[], subject: string, html: string, shopId?: string, idempotencyKey?: string) {
  await sendEmailMessage({ to, subject, html, shopId, ...(idempotencyKey ? { idempotencyKey } : {}) });
}
