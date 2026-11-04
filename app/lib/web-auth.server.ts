// FirstPicked web app sign-in: email link only (Ross, 2026-10-14). /login sends a link; the link signs the browser in
// with a signed cookie that holds the account id for 30 days. Only a hash of each link's token is stored, and a
// link works once, for 30 minutes.

import { createHash, createHmac, randomBytes } from "node:crypto";
import { createCookieSessionStorage, redirect } from "react-router";
import type { Shop, User } from "@prisma/client";
import db from "../db.server";
import { isProd } from "./env.server";
import { SITE } from "./tools/site";
import { emailConfigured, sendEmailMessage } from "./email.server";
import { normalizeEmail } from "./check-lead.server";

const LINK_MINUTES = 30;
const MAX_LINKS_PER_HOUR = 5;
const MAX_LINKS_PER_HOUR_ALL = 300; // per email address
const SESSION_DAYS = 30;

function sessionSecret(): string {
  if (process.env.WEB_SESSION_SECRET) return process.env.WEB_SESSION_SECRET;
  if (isProd) console.warn("[web-auth] WEB_SESSION_SECRET is not set: using a key made from the database address.");
  return createHmac("sha256", process.env.DATABASE_URL || "geo-dev").update("geo:web-session").digest("hex");
}

const storage = createCookieSessionStorage<{ userId: string }>({
  cookie: {
    name: "geo_session",
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
    secrets: [sessionSecret()],
  },
});

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Only paths inside the web app, so a link can never send someone to another site. */
export function safeNext(raw: unknown): string {
  const s = String(raw ?? "");
  return /^\/(dash|start)(\/[\w\-/]*)?$/.test(s) ? s : "/dash";
}

export const LOGIN_ERRORS = {
  email: "Please enter a valid email address.",
  tooMany: "We’ve sent a few links already. Please check your inbox (and spam), or try again in an hour.",
  noEmail: "We can’t send emails right now. Please try again later.",
};

/** Make a sign-in link and email it. */
export async function sendLoginLink(rawEmail: unknown, next?: unknown): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const email = normalizeEmail(rawEmail);
  if (!email) return { ok: false, error: LOGIN_ERRORS.email };
  const hourAgo = new Date(Date.now() - 3_600_000);
  if ((await db.loginLink.count({ where: { email, createdAt: { gte: hourAgo } } })) >= MAX_LINKS_PER_HOUR) {
    return { ok: false, error: LOGIN_ERRORS.tooMany };
  }
  // Across everyone: a script feeding the form a list of addresses can't turn FirstPicked into a spam sender.
  if ((await db.loginLink.count({ where: { createdAt: { gte: hourAgo } } })) >= MAX_LINKS_PER_HOUR_ALL) {
    return { ok: false, error: LOGIN_ERRORS.tooMany };
  }
  if (!emailConfigured()) return { ok: false, error: LOGIN_ERRORS.noEmail };

  const token = randomBytes(32).toString("base64url");
  await db.loginLink.create({
    data: { tokenHash: hash(token), email, next: safeNext(next), expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000) },
  });
  const url = `${SITE}/login/${token}`;
  await sendEmailMessage({ to: [email], ...loginEmail(url) });
  return { ok: true, email };
}

/** The home page's purple (white text on it passes 4.7:1) and its logo's two circles. */
const PURPLE = "#6c5cf2";
const LILAC = "#cdc6fc";

/** The sign-in email (exported for tests): the logo, a white card and one purple button, in tables so every inbox shows it. */
export function loginEmail(url: string): { subject: string; html: string; text: string } {
  const font = "font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;";
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f3f9;">
<div style="display:none;max-height:0;overflow:hidden;">Your sign-in link works once, for ${LINK_MINUTES} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f9;padding:36px 14px;${font}">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td align="center" style="padding:0 0 20px;font-size:21px;font-weight:700;letter-spacing:-0.02em;color:#0e0e13;">
<span style="display:inline-block;width:15px;height:15px;border-radius:50%;background:${LILAC};vertical-align:middle;"></span><span style="display:inline-block;width:15px;height:15px;border-radius:50%;background:${PURPLE};margin-left:-6px;margin-right:9px;vertical-align:middle;"></span>FirstPicked
</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e9e7f3;border-radius:20px;padding:36px 32px;text-align:center;">
<h1 style="margin:0 0 10px;font-size:23px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:#0e0e13;">Sign in to FirstPicked</h1>
<p style="margin:0 0 26px;font-size:15px;line-height:1.6;color:#53565f;">Press the button to sign in. The link works once, for ${LINK_MINUTES} minutes.</p>
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 26px;"><tr>
<td bgcolor="${PURPLE}" style="background:${PURPLE};border-radius:12px;">
<a href="${url}" style="display:inline-block;padding:14px 30px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Sign in to FirstPicked</a>
</td></tr></table>
<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#6e717a;">Button not working? Copy this link into your browser:</p>
<p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${url}" style="color:${PURPLE};text-decoration:none;">${url}</a></p>
</td></tr>
<tr><td align="center" style="padding:20px 12px 0;font-size:12px;line-height:1.6;color:#6e717a;">
If you didn’t ask for this, you can ignore this email.<br>
<a href="${SITE}" style="color:#6e717a;text-decoration:underline;">firstpicked.com.au</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  return {
    subject: "Your FirstPicked sign-in link",
    html,
    text: `Sign in to FirstPicked: ${url}\n\nThe link works once, for ${LINK_MINUTES} minutes. If you didn't ask for this, ignore this email.\n\nFirstPicked, firstpicked.com.au`,
  };
}

/** True when a link can still sign in (not used, not old). Doesn't use it: email scanners open links too. */
export async function loginLinkUsable(token: string): Promise<boolean> {
  if (!/^[\w-]{20,100}$/.test(token)) return false;
  const link = await db.loginLink.findUnique({ where: { tokenHash: hash(token) } });
  return Boolean(link && !link.usedAt && link.expiresAt >= new Date());
}

/** Use a link: returns the cookie header and where to go, or null when the link is wrong, used or old. */
export async function redeemLoginLink(token: string): Promise<{ setCookie: string; next: string } | null> {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const link = await db.loginLink.findUnique({ where: { tokenHash: hash(token) } });
  if (!link || link.usedAt || link.expiresAt < new Date()) return null;
  // Mark it used first (only if nobody else just did), so a link can't sign in twice.
  const marked = await db.loginLink.updateMany({ where: { id: link.id, usedAt: null }, data: { usedAt: new Date() } });
  if (marked.count !== 1) return null;
  const user = await db.user.upsert({
    where: { email: link.email },
    create: { email: link.email, lastLoginAt: new Date() },
    update: { lastLoginAt: new Date() },
  });
  const session = await storage.getSession();
  session.set("userId", user.id);
  return { setCookie: await storage.commitSession(session), next: link.next || "/dash" };
}

export async function currentUser(request: Request) {
  const session = await storage.getSession(request.headers.get("cookie"));
  const id = session.get("userId");
  return id ? db.user.findUnique({ where: { id } }) : null;
}

/** The signed-in account, or a redirect to /login (coming back here afterwards). */
export async function requireUser(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    const path = new URL(request.url).pathname;
    throw redirect(`/login?next=${encodeURIComponent(safeNext(path))}`);
  }
  return user;
}

// The dashboard frame and the page inside it both ask at the same moment (each with its own copy of the request), so
// lookups still on their way are shared by the browser's sign-in cookie. Each is forgotten as soon as it's done, so
// nothing is ever served stale.
const inFlight = new Map<string, Promise<{ user: User; shop: Shop }>>();

/** The signed-in account and its store; no store yet goes to /start. */
export function requireWebShop(request: Request): Promise<{ user: User; shop: Shop }> {
  const cookie = request.headers.get("cookie");
  if (!cookie || (request.method !== "GET" && request.method !== "HEAD")) return loadWebShop(request); // forms always read fresh
  let found = inFlight.get(cookie);
  if (!found) {
    found = loadWebShop(request);
    inFlight.set(cookie, found);
    const forget = () => inFlight.delete(cookie);
    found.then(forget, forget);
  }
  return found;
}

async function loadWebShop(request: Request) {
  const session = await storage.getSession(request.headers.get("cookie"));
  const id = session.get("userId");
  // The account and its store in one round trip (both only need the id in the cookie).
  const [user, shop] = id
    ? await Promise.all([db.user.findUnique({ where: { id } }), db.shop.findFirst({ where: { userId: id }, orderBy: { createdAt: "asc" } })])
    : [null, null];
  if (!user) {
    const path = new URL(request.url).pathname;
    throw redirect(`/login?next=${encodeURIComponent(safeNext(path))}`);
  }
  if (!shop) throw redirect("/start");
  return { user, shop };
}

export async function signOutCookie(request: Request): Promise<string> {
  return storage.destroySession(await storage.getSession(request.headers.get("cookie")));
}
