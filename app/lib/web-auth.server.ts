// GEO web app sign-in: email link only (Ross, 2026-10-14). /login sends a link; the link signs the browser in
// with a signed cookie that holds the account id for 30 days. Only a hash of each link's token is stored, and a
// link works once, for 30 minutes.

import { createHash, createHmac, randomBytes } from "node:crypto";
import { createCookieSessionStorage, redirect } from "react-router";
import db from "../db.server";
import { isProd } from "./env.server";
import { SITE } from "./tools/site";
import { emailConfigured, sendEmailMessage } from "./email.server";
import { normalizeEmail } from "./check-lead.server";

const LINK_MINUTES = 30;
const MAX_LINKS_PER_HOUR = 5; // per email address
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
  if (!emailConfigured()) return { ok: false, error: LOGIN_ERRORS.noEmail };

  const token = randomBytes(32).toString("base64url");
  await db.loginLink.create({
    data: { tokenHash: hash(token), email, next: safeNext(next), expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000) },
  });
  const url = `${SITE}/login/${token}`;
  await sendEmailMessage({ to: [email], ...loginEmail(url) });
  return { ok: true, email };
}

/** The sign-in email (exported for tests). */
export function loginEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: "Your GEO sign-in link",
    html:
      `<p>Click the button to sign in to GEO. The link works once, for ${LINK_MINUTES} minutes.</p>` +
      `<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#15163c;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Sign in to GEO</a></p>` +
      `<p style="color:#5c5d78">If you didn’t ask for this, you can ignore this email.</p>`,
    text: `Sign in to GEO: ${url}\n\nThe link works once, for ${LINK_MINUTES} minutes. If you didn't ask for this, ignore this email.`,
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

/** The signed-in account and its store; no store yet goes to /start. */
export async function requireWebShop(request: Request) {
  const user = await requireUser(request);
  const shop = await db.shop.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  if (!shop) throw redirect("/start");
  return { user, shop };
}

export async function signOutCookie(request: Request): Promise<string> {
  return storage.destroySession(await storage.getSession(request.headers.get("cookie")));
}
