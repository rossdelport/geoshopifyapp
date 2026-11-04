// The book-a-call page's link to Ross's Google Calendar (firstpicked.com.au/book, Ross 3 Nov 2026).
// Ross connects his calendar once in Admin > System (route dash.admin_.calendar.tsx). After that the page shows his
// free times (Google's free/busy) and a booked call is added to his calendar with a Google Meet link; Google emails
// the invite to the person who booked. Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (a Google Cloud OAuth client).

import { randomUUID } from "node:crypto";
import db from "../db.server";
import { env } from "./env.server";
import { emailConfigured, sendEmail } from "./email.server";
import { normalizeEmail } from "./check-lead.server";
import { hashIp } from "./public-form.server";
import { SITE } from "./tools/site";
import { BOOK_ERRORS, CALL, openSlots, rossTime, type Busy } from "./booking";

const ROW = "booking"; // the one CalendarLink row
export const CALENDAR_REDIRECT = `${SITE}/dash/admin/calendar`;
const SCOPES = "openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy";
const TIMEOUT = 10_000;

export const googleReady = () => Boolean(env.googleClientId && env.googleClientSecret);

/** Google's sign-in page, asking Ross to let GEO see his free times and add calls to his calendar. */
export function consentUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: CALENDAR_REDIRECT,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // a refresh token, so it keeps working
    prompt: "consent", // always hand out a new refresh token
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenCall(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: env.googleClientId, client_secret: env.googleClientSecret, ...body }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; error?: string };
  if (!res.ok || !json.access_token) throw new Error(`Google token: ${res.status} ${json.error ?? ""}`.trim());
  return json;
}

/** Ross came back from Google's sign-in: keep the refresh token and the address it belongs to. */
export async function connectCalendar(code: string): Promise<string> {
  const t = await tokenCall({ code, grant_type: "authorization_code", redirect_uri: CALENDAR_REDIRECT });
  if (!t.refresh_token) throw new Error("Google sent no refresh token");
  // The id token came straight from Google over https, so its email can be read without checking the signature.
  let email = "";
  try {
    email = String(JSON.parse(Buffer.from(String(t.id_token).split(".")[1], "base64url").toString()).email ?? "");
  } catch {
    /* no email: still connected */
  }
  await db.calendarLink.upsert({ where: { id: ROW }, update: { email, refreshToken: t.refresh_token }, create: { id: ROW, email, refreshToken: t.refresh_token } });
  cached = null;
  return email;
}

export const calendarStatus = () => db.calendarLink.findUnique({ where: { id: ROW }, select: { email: true, updatedAt: true } });

let cached: { refresh: string; token: string; until: number } | null = null;

/** A fresh access token for Ross's calendar, or null when it isn't connected. */
async function accessToken(): Promise<string | null> {
  if (!googleReady()) return null;
  const link = await db.calendarLink.findUnique({ where: { id: ROW } });
  if (!link) return null;
  if (cached && cached.refresh === link.refreshToken && cached.until > Date.now() + 60_000) return cached.token;
  const t = await tokenCall({ refresh_token: link.refreshToken, grant_type: "refresh_token" });
  cached = { refresh: link.refreshToken, token: t.access_token!, until: Date.now() + (t.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function google<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Google Calendar ${path.split("?")[0]}: ${res.status} ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return (await res.json()) as T;
}

/** Ross's busy times over the booking window. */
async function busyTimes(token: string, now: Date): Promise<Busy[]> {
  const out = await google<{ calendars?: { primary?: { busy?: { start: string; end: string }[] } } }>(token, "freeBusy", {
    timeMin: now.toISOString(),
    timeMax: new Date(now.getTime() + (CALL.daysAhead + 1) * 86_400_000).toISOString(),
    items: [{ id: "primary" }],
  });
  return (out.calendars?.primary?.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
}

/** The free times to show on the page, or null when booking online isn't set up (the page then says text Ross). */
export async function freeSlots(now = new Date()): Promise<string[] | null> {
  try {
    const token = await accessToken();
    return token ? openSlots(now, await busyTimes(token, now)) : null;
  } catch (err) {
    console.error("[book] could not read Ross's calendar", err);
    return null;
  }
}

/** Trimmed, spaces squeezed, no control characters or angle brackets. */
const clean = (raw: unknown, max: number) =>
  String(raw ?? "")
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// Bookings per scrambled IP in the last day, kept in memory (a deploy starts again; Google's free/busy stops two
// people taking the same time).
const recent = new Map<string, number[]>();
const MAX_PER_IP = 3;

export type BookResult = { ok: true; start: string; email: string } | { ok: false; error: string; slots?: string[] };

export interface BookInput {
  start: unknown;
  name: unknown;
  email: unknown;
  store: unknown;
  honeypot?: unknown;
  from?: Record<string, unknown>; // the ad's utm_* tags, for Ross's email
  ip: string | null;
}

export async function bookCall(input: BookInput, now = new Date()): Promise<{ status: number; result: BookResult }> {
  const fail = (status: number, error: string, slots?: string[]) => ({ status, result: { ok: false as const, error, ...(slots ? { slots } : {}) } });
  const name = clean(input.name, 80);
  const email = normalizeEmail(input.email);
  const store = clean(input.store, 200);
  const start = String(input.start ?? "");
  if (!name) return fail(400, BOOK_ERRORS.name);
  if (!email) return fail(400, BOOK_ERRORS.email);
  if (!/\w\.\w/.test(store)) return fail(400, BOOK_ERRORS.store);
  // A bot filled the hidden field: say yes and book nothing.
  if (String(input.honeypot ?? "").trim()) return { status: 200, result: { ok: true, start, email } };

  const ip = hashIp(input.ip);
  const dayAgo = now.getTime() - 86_400_000;
  const mine = (recent.get(ip) ?? []).filter((t) => t > dayAgo);
  if (mine.length >= MAX_PER_IP) return fail(429, BOOK_ERRORS.tooMany);

  const token = await accessToken();
  if (!token) return fail(503, BOOK_ERRORS.closed);
  const slots = openSlots(now, await busyTimes(token, now));
  if (!slots.includes(start)) return fail(409, BOOK_ERRORS.taken, slots);

  const end = new Date(Date.parse(start) + CALL.minutes * 60_000).toISOString();
  await google(token, "calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
    summary: `GEO call: Ross and ${name}`,
    description: `Booked at ${SITE}/book\n\nName: ${name}\nEmail: ${email}\nStore: ${store}`,
    start: { dateTime: start },
    end: { dateTime: end },
    attendees: [{ email, displayName: name }],
    conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } } },
  });
  recent.set(ip, [...mine, now.getTime()]);

  // Tell Ross (Google doesn't email you about events added to your own calendar).
  if (env.alertEmail && emailConfigured()) {
    const ad = Object.entries(input.from ?? {})
      .map(([k, v]) => [k, clean(v, 200)])
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
    const lines = [`<b>When:</b> ${rossTime(start)} (your time)`, `<b>Name:</b> ${esc(name)}`, `<b>Email:</b> ${esc(email)}`, `<b>Store:</b> ${esc(store)}`];
    if (ad) lines.push(`<b>Came from:</b> ${esc(ad)}`);
    await sendEmail([env.alertEmail], `New call booked: ${name}, ${rossTime(start)}`, `<p>Someone booked a call on firstpicked.com.au/book. It's in your Google Calendar with a Meet link.</p><p>${lines.join("<br>")}</p>`).catch((err) =>
      console.error("[book] booked, but the email to Ross failed", err),
    );
  }
  return { status: 200, result: { ok: true, start, email } };
}
