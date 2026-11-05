// The agency hub's numbers (Ross, 5 Nov 2026): a card for each client with their AI score, sales from AI this month,
// the work done this week, the next guide and what needs Ross. All clients are read together, a few grouped queries
// at once, so the hub stays quick with many clients. The rules (alerts, health, totals) are in lib/clients.ts.

import db from "../db.server";
import { getPlan } from "./plans";
import { addDays, localDay } from "./guide-calendar";
import {
  type ClientCard,
  type ClientFacts,
  type ClientStatus,
  clientAlerts,
  clientMonth,
  dayStartsAt,
  healthOf,
  hubDay,
  isClientStatus,
  monthStartDay,
  sortCards,
  startScore,
} from "./clients";

const DAY = 86_400_000;

/** The brand cards: every client, or one (`shopId`). Sorted active first, then what needs a look first. */
export async function clientCards(opts: { shopId?: string } = {}, now = new Date()): Promise<ClientCard[]> {
  const clients = await db.client.findMany({
    where: opts.shopId ? { shopId: opts.shopId } : {},
    include: {
      shop: {
        select: {
          name: true,
          primaryDomain: true,
          domain: true,
          country: true,
          currency: true,
          onboarding: true,
          pixelId: true,
          plan: true,
          createdAt: true,
          costMonth: true,
          costThisMonth: true,
          shopifyConnectedAt: true,
        },
      },
    },
  });
  if (!clients.length) return [];

  const ids = clients.map((c) => c.shopId);
  const shopId = { in: ids };
  const today = hubDay(now);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const monthStart = dayStartsAt(monthStartDay(today));
  const firstStart = clients.map((c) => c.startedOn).sort()[0];
  const scoresFrom = dayStartsAt(addDays(firstStart < today ? firstStart : today, -45));

  const [snaps, sales, visits, written, live, checks, reddit, changes, onboardJobs, latestScans, slots, upcoming, reports, calls] = await Promise.all([
    db.visibilitySnapshot.findMany({ where: { shopId, date: { gte: scoresFrom } }, select: { shopId: true, score: true, date: true }, orderBy: { date: "asc" } }),
    db.aiOrder.groupBy({ by: ["shopId"], where: { shopId, orderedAt: { gte: monthStart } }, _sum: { revenue: true }, _count: true }),
    db.aiSession.groupBy({ by: ["shopId"], where: { shopId, occurredAt: { gte: monthStart }, engine: { not: "ours" } }, _count: true }),
    db.fix.groupBy({ by: ["shopId"], where: { shopId, type: "guide_page", refreshOfId: null, createdAt: { gte: weekAgo } }, _count: true }),
    db.guideSlot.groupBy({ by: ["shopId"], where: { shopId, status: "published", publishedAt: { gte: weekAgo } }, _count: true }),
    db.scan.groupBy({ by: ["shopId"], where: { shopId, status: "done", finishedAt: { gte: weekAgo } }, _count: true }),
    db.redditThread.groupBy({ by: ["shopId"], where: { shopId, createdAt: { gte: weekAgo } }, _count: true }),
    db.workNote.groupBy({ by: ["shopId"], where: { shopId, kind: "change", doneAt: { gte: weekAgo } }, _count: true }),
    db.job.findMany({ where: { shopId, type: "onboard" }, orderBy: { createdAt: "desc" }, select: { shopId: true, status: true, createdAt: true } }),
    db.$queryRaw<{ id: string; shopId: string; status: string; finishedAt: Date | null }[]>`
      SELECT DISTINCT ON ("shopId") id, "shopId", status, "finishedAt" FROM "Scan" WHERE "shopId" = ANY(${ids}) ORDER BY "shopId", "startedAt" DESC`,
    db.guideSlot.findMany({ where: { shopId, status: { in: ["ready", "failed"] } }, select: { id: true, shopId: true, day: true, status: true, approvedAt: true }, orderBy: { day: "asc" } }),
    db.guideSlot.findMany({
      where: { shopId, status: { in: ["planned", "writing", "ready"] }, day: { gte: addDays(today, -1) } },
      select: { id: true, shopId: true, day: true, question: { select: { text: true } }, fix: { select: { targetTitle: true } } },
      orderBy: { day: "asc" },
    }),
    db.clientReport.groupBy({ by: ["shopId"], where: { shopId }, _max: { createdAt: true } }),
    db.workNote.groupBy({ by: ["shopId"], where: { shopId, kind: "call" }, _max: { doneAt: true } }),
  ]);

  // A check that's queued or running only finishes if its job is still waiting or working.
  const open = latestScans.filter((s) => s.status === "queued" || s.status === "running");
  const runJobs = open.length
    ? await db.job.findMany({ where: { dedupeKey: { in: open.map((s) => `scan-run:${s.id}`) } }, select: { dedupeKey: true, status: true } })
    : [];
  const working = new Set(runJobs.filter((j) => j.status === "queued" || j.status === "running").map((j) => j.dedupeKey));

  const count = (rows: { shopId: string; _count: number }[]) => new Map(rows.map((r) => [r.shopId, r._count]));
  const [writtenBy, liveBy, checksBy, redditBy, changesBy, visitsBy] = [written, live, checks, reddit, changes, visits].map(count);
  const salesBy = new Map(sales.map((s) => [s.shopId, { revenue: s._sum.revenue ?? 0, orders: s._count }]));
  const reportBy = new Map(reports.map((r) => [r.shopId, r._max.createdAt]));
  const callBy = new Map(calls.map((r) => [r.shopId, r._max.doneAt]));
  const scanBy = new Map(latestScans.map((s) => [s.shopId, s]));
  const monthKey = now.toISOString().slice(0, 7); // the cost cap's month (UTC, like lib/cost.server.ts)

  const cards = clients.map((c): ClientCard => {
    const shop = c.shop;
    const status: ClientStatus = isClientStatus(c.status) ? c.status : "active";
    const storeToday = localDay(now, shop.country);
    const scores = snaps.filter((s) => s.shopId === c.shopId);
    const onboard = onboardJobs.find((j) => j.shopId === c.shopId);
    const scan = scanBy.get(c.shopId);
    const scanOpen = scan && (scan.status === "queued" || scan.status === "running");
    const scanRunning = Boolean(scanOpen && working.has(`scan-run:${scan!.id}`));
    const mySlots = slots.filter((s) => s.shopId === c.shopId);
    const connected = Boolean(shop.shopifyConnectedAt);
    const toAdd = mySlots.filter((s) => s.status === "ready" && s.approvedAt && s.day <= storeToday && !connected);
    const failed = mySlots.filter((s) => s.status === "failed" && s.day >= storeToday);
    const next = upcoming.find((s) => s.shopId === c.shopId && s.day >= storeToday);
    const lastDone = scores.at(-1);

    const facts: ClientFacts = {
      shopId: c.shopId,
      status,
      onboarding: shop.onboarding,
      setupFailed: onboard?.status === "failed" || (shop.onboarding === "scanning" && onboard?.status === "done" && !scanRunning),
      setupSince: (onboard?.createdAt ?? shop.createdAt).toISOString(),
      tracking: Boolean(shop.pixelId),
      startedOn: c.startedOn,
      lastScanAt: lastDone ? lastDone.date.toISOString() : null,
      lastScanFailed: scan?.status === "failed",
      scanRunning,
      guidesToAdd: toAdd.length,
      firstToAdd: toAdd[0]?.id ?? null,
      guidesNeedOk: mySlots.filter((s) => s.status === "ready" && !s.approvedAt).length,
      guidesFailed: failed.length,
      firstFailed: failed[0]?.id ?? null,
      lastReportAt: reportBy.get(c.shopId)?.toISOString() ?? null,
      lastCallAt: callBy.get(c.shopId)?.toISOString() ?? null,
      costCapHit: shop.costMonth === monthKey && shop.costThisMonth >= getPlan(shop.plan).costCapUsd,
    };
    const alerts = clientAlerts(facts, today, now);
    return {
      shopId: c.shopId,
      name: shop.name || shop.primaryDomain || shop.domain,
      host: shop.primaryDomain || shop.domain,
      country: shop.country,
      currency: shop.currency,
      status,
      feeAud: c.feeAud,
      startedOn: c.startedOn,
      month: clientMonth(c.startedOn, today),
      contactName: c.contactName,
      email: c.email,
      phone: c.phone,
      onboarding: shop.onboarding,
      tracking: facts.tracking,
      score: lastDone ? Math.round(lastDone.score) : null,
      scoreStart: startScore(scores, c.startedOn),
      trend: scores.slice(-14).map((s) => Math.round(s.score)),
      sales: { ...(salesBy.get(c.shopId) ?? { revenue: 0, orders: 0 }), visits: visitsBy.get(c.shopId) ?? 0 },
      week: {
        guidesWritten: writtenBy.get(c.shopId) ?? 0,
        guidesLive: liveBy.get(c.shopId) ?? 0,
        checks: checksBy.get(c.shopId) ?? 0,
        reddit: redditBy.get(c.shopId) ?? 0,
        changes: changesBy.get(c.shopId) ?? 0,
      },
      next: next ? { id: next.id, day: next.day, title: next.fix?.targetTitle ?? next.question?.text ?? "Guide page" } : null,
      alerts,
      health: healthOf(status, alerts),
    };
  });
  return sortCards(cards);
}

/** One client's card, or null when the store isn't a client. */
export async function clientCard(shopId: string, now = new Date()): Promise<ClientCard | null> {
  return (await clientCards({ shopId }, now))[0] ?? null;
}

/** The clients for the menu: name and status, active first, then by name. */
export async function clientMenu() {
  const rows = await db.client.findMany({ select: { shopId: true, status: true, shop: { select: { name: true, primaryDomain: true, domain: true } } } });
  const rank: Record<string, number> = { active: 0, paused: 1, ended: 2 };
  return rows
    .map((r) => ({ shopId: r.shopId, status: r.status, name: r.shop.name || r.shop.primaryDomain || r.shop.domain }))
    .sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || a.name.localeCompare(b.name));
}
