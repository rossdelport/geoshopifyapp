// The admin area (usegeo.app/dash/admin), for Ross only (Ross, 2026-10-15). Who can open it: GEO_ADMIN_EMAILS
// (comma separated), else Ross's email. Everyone else gets "Not found", so the pages don't show they exist.
// Days are Sydney days (Ross is in Australia).

import { Prisma } from "@prisma/client";
import db from "../db.server";
import { requireUser } from "./web-auth.server";
import { getPlan } from "./plans";

export const ADMIN_TZ = "Australia/Sydney";

export function adminEmails(): string[] {
  return (process.env.GEO_ADMIN_EMAILS || "rossdelport1998@gmail.com")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const isAdmin = (email: string | null | undefined) => Boolean(email) && adminEmails().includes(email!.toLowerCase());

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (!isAdmin(user.email)) throw new Response("Not found", { status: 404 });
  return user;
}

/** Today in Sydney as YYYY-MM-DD, or a day `offset` days before it. */
export function sydneyDay(offset = 0, now = new Date()): string {
  const d = new Date(now.getTime() - offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ADMIN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** The days asked for (?from=&to=), defaulting to the last 14 days; at most a year, from never after to. */
export function dayRange(url: URL, now = new Date()): { from: string; to: string } {
  let from = url.searchParams.get("from");
  let to = url.searchParams.get("to");
  if (!isDay(to)) to = sydneyDay(0, now);
  if (!isDay(from)) from = sydneyDay(13, now);
  if (from > to) [from, to] = [to, from];
  if (Date.parse(to) - Date.parse(from) > 366 * 86_400_000) from = new Date(Date.parse(to) - 366 * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}

/** Every day from `from` to `to`, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

const localDay = Prisma.sql`(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ADMIN_TZ})::date`;

export type Provider = "treg" | "anthropic" | "other";
const providerOf = (p: string): Provider => (p === "treg" || p === "anthropic" ? p : "other");

/** Spend per day and provider, with totals, the stores and the jobs that cost the most. */
export async function usage(from: string, to: string) {
  const range = Prisma.sql`${localDay} BETWEEN ${from}::date AND ${to}::date`;
  const [byDay, byShop, byUse] = await Promise.all([
    db.$queryRaw<{ day: string; provider: string; usd: number; calls: number }[]>`
      SELECT to_char(${localDay}, 'YYYY-MM-DD') AS day, provider, SUM(usd)::float AS usd, COUNT(*)::int AS calls
      FROM "ApiCost" WHERE ${range} GROUP BY 1, 2 ORDER BY 1`,
    db.$queryRaw<{ shopId: string | null; usd: number }[]>`
      SELECT "shopId", SUM(usd)::float AS usd FROM "ApiCost" WHERE ${range} GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    db.$queryRaw<{ provider: string; use: string; usd: number; calls: number }[]>`
      SELECT provider, split_part(endpoint, ':', 1) AS use, SUM(usd)::float AS usd, COUNT(*)::int AS calls
      FROM "ApiCost" WHERE ${range} GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 15`,
  ]);
  const days = daysBetween(from, to).map((day) => {
    const row = { day, treg: 0, anthropic: 0, other: 0, calls: 0 };
    for (const r of byDay.filter((x) => x.day === day)) {
      row[providerOf(r.provider)] += r.usd;
      row.calls += r.calls;
    }
    return { ...row, total: row.treg + row.anthropic + row.other };
  });
  const shops = await db.shop.findMany({
    where: { id: { in: byShop.map((s) => s.shopId).filter((x): x is string => Boolean(x)) } },
    select: { id: true, name: true, primaryDomain: true, domain: true },
  });
  const sum = (k: "treg" | "anthropic" | "other" | "total") => days.reduce((a, d) => a + d[k], 0);
  return {
    days,
    totals: { treg: sum("treg"), anthropic: sum("anthropic"), other: sum("other"), total: sum("total"), calls: days.reduce((a, d) => a + d.calls, 0) },
    byShop: byShop.map((s) => {
      const shop = shops.find((x) => x.id === s.shopId);
      return { name: shop ? shop.name || shop.primaryDomain || shop.domain : s.shopId ? "Deleted store" : "Website (free checks, waitlist)", usd: s.usd };
    }),
    byUse: byUse.map((u) => ({ provider: providerOf(u.provider), use: u.use, usd: u.usd, calls: u.calls })),
  };
}

export const SETUP_STEPS = ["Store added", "First AI check done", "Tracking code working", "Found a writer or wrote a pitch", "Replied on Reddit"];

/** Every account and store: plan, AI score, how far through setup, and spend this month. */
export async function usersTable() {
  const monthStart = new Date(`${sydneyDay().slice(0, 8)}01T00:00:00Z`);
  const [users, shops, snaps, writers, pitches, replies, spend] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" } }),
    db.shop.findMany({ orderBy: { createdAt: "desc" } }),
    db.$queryRaw<{ shopId: string; score: number }[]>`
      SELECT DISTINCT ON ("shopId") "shopId", score FROM "VisibilitySnapshot" ORDER BY "shopId", date DESC`,
    db.siteWriter.groupBy({ by: ["shopId"], _count: true }),
    db.outreachTarget.groupBy({ by: ["shopId"], where: { pitch: { not: null } }, _count: true }),
    db.redditThread.groupBy({ by: ["shopId"], where: { status: "replied" }, _count: true }),
    db.apiCost.groupBy({ by: ["shopId"], where: { createdAt: { gte: monthStart } }, _sum: { usd: true } }),
  ]);
  const rows = shops.map((s) => {
    const user = users.find((u) => u.id === s.userId);
    const steps = [
      true,
      s.onboarding === "done",
      Boolean(s.pixelId),
      Boolean(writers.find((w) => w.shopId === s.id) || pitches.find((p) => p.shopId === s.id)),
      Boolean(replies.find((r) => r.shopId === s.id)),
    ];
    const snap = snaps.find((x) => x.shopId === s.id);
    return {
      key: s.id,
      email: user?.email ?? s.email ?? "(installed from Shopify)",
      store: s.name || s.primaryDomain || s.domain,
      host: s.primaryDomain || s.domain,
      source: s.source,
      plan: getPlan(s.plan).name,
      score: snap ? Math.round(snap.score) : null,
      steps,
      setupStage: s.onboarding,
      joined: (user?.createdAt ?? s.createdAt).toISOString(),
      lastLogin: user?.lastLoginAt?.toISOString() ?? null,
      spend: spend.find((x) => x.shopId === s.id)?._sum.usd ?? 0,
    };
  });
  for (const u of users.filter((u) => !shops.some((s) => s.userId === u.id))) {
    rows.push({
      key: u.id,
      email: u.email,
      store: "No store yet",
      host: "",
      source: "web",
      plan: "None",
      score: null,
      steps: [false, false, false, false, false],
      setupStage: "none",
      joined: u.createdAt.toISOString(),
      lastLogin: u.lastLoginAt?.toISOString() ?? null,
      spend: 0,
    });
  }
  return rows.sort((a, b) => b.joined.localeCompare(a.joined));
}

/** The headline numbers and what needs looking at. */
export async function overview(now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const today = sydneyDay(0, now);
  const monthFrom = `${today.slice(0, 8)}01`;
  const [users, newUsers, shops, ready, byPlan, waitlist, newWaitlist, failed, flags, stuck, month, day, overCap] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    db.shop.count({ where: { status: "installed" } }),
    db.shop.count({ where: { status: "installed", onboarding: "done" } }),
    db.shop.groupBy({ by: ["plan"], where: { status: "installed" }, _count: true }),
    db.waitlistSignup.count(),
    db.waitlistSignup.count({ where: { createdAt: { gte: weekAgo } } }),
    db.job.count({ where: { status: "failed", updatedAt: { gte: dayAgo } } }),
    db.supportFlag.count({ where: { status: "open" } }),
    db.shop.findMany({
      where: { status: "installed", onboarding: { not: "done" }, createdAt: { lt: new Date(now.getTime() - 3_600_000) } },
      select: { name: true, primaryDomain: true, domain: true, onboarding: true, createdAt: true },
      take: 10,
    }),
    usage(monthFrom, today),
    usage(today, today),
    db.shop.findMany({ where: { costAlertedAt: { gte: new Date(`${monthFrom}T00:00:00Z`) } }, select: { name: true, domain: true, costThisMonth: true }, take: 10 }),
  ]);
  const paid = byPlan.filter((p) => p.plan !== "free").reduce((a, p) => a + p._count, 0);
  return {
    users,
    newUsers,
    shops,
    ready,
    paid,
    plans: byPlan.map((p) => ({ plan: getPlan(p.plan).name, count: p._count })),
    waitlist,
    newWaitlist,
    failed,
    flags,
    spendMonth: month.totals,
    spendToday: day.totals,
    stuck: stuck.map((s) => ({ store: s.name || s.primaryDomain || s.domain, stage: s.onboarding, since: s.createdAt.toISOString() })),
    overCap: overCap.map((s) => ({ store: s.name || s.domain, usd: s.costThisMonth })),
  };
}
