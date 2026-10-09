// Numbers for the dashboard. Money first.

import type { Shop } from "@prisma/client";
import db from "../db.server";
import { startOfMonth } from "./limits";

const DAY = 86_400_000;

export interface MoneySummary {
  currency: string;
  thisMonth: { revenue: number; orders: number; visits: number; share: number | null };
  sinceJoining: { revenue: number; orders: number; days: number };
  baselinePer30: number;
  sinceJoiningPer30: number | null; // null when we've only been installed a few days
  growthPct: number | null;
  byEngine: { engine: string; revenue: number; orders: number }[];
  oursRevenue: number;
  topProducts: { title: string; qty: number }[];
  recentOrders: { orderName: string | null; engine: string; revenue: number; orderedAt: Date; reason: string }[];
  hasPixel: boolean;
}

export async function moneySummary(shop: Shop): Promise<MoneySummary> {
  const monthStart = startOfMonth();
  const installed = shop.installedAt;
  const baselineStart = new Date(installed.getTime() - 60 * DAY);
  const daysSince = Math.max(1, Math.round((Date.now() - installed.getTime()) / DAY));

  const [month, since, baseline, byEngine, ours, visits, storeMonth, allAi, recent] = await Promise.all([
    db.aiOrder.aggregate({ where: { shopId: shop.id, orderedAt: { gte: monthStart } }, _sum: { revenue: true }, _count: true }),
    db.aiOrder.aggregate({ where: { shopId: shop.id, orderedAt: { gte: installed } }, _sum: { revenue: true }, _count: true }),
    db.aiOrder.aggregate({ where: { shopId: shop.id, orderedAt: { gte: baselineStart, lt: installed } }, _sum: { revenue: true } }),
    db.aiOrder.groupBy({
      by: ["engine"],
      where: { shopId: shop.id, orderedAt: { gte: baselineStart } },
      _sum: { revenue: true },
      _count: true,
    }),
    db.aiOrder.aggregate({ where: { shopId: shop.id, ours: true }, _sum: { revenue: true } }),
    db.aiSession.count({ where: { shopId: shop.id, occurredAt: { gte: monthStart }, engine: { not: "ours" } } }),
    db.orderDay.aggregate({ where: { shopId: shop.id, date: { gte: monthStart } }, _sum: { revenue: true } }),
    db.aiOrder.findMany({ where: { shopId: shop.id, orderedAt: { gte: baselineStart } }, select: { products: true } }),
    db.aiOrder.findMany({ where: { shopId: shop.id }, orderBy: { orderedAt: "desc" }, take: 5 }),
  ]);

  const counts = new Map<string, number>();
  for (const o of allAi) {
    for (const p of (o.products as { title: string; qty: number }[]) ?? []) {
      counts.set(p.title, (counts.get(p.title) ?? 0) + (p.qty || 1));
    }
  }

  const baselinePer30 = ((baseline._sum.revenue ?? 0) / 60) * 30;
  const sinceRevenue = since._sum.revenue ?? 0;
  const sinceJoiningPer30 = daysSince >= 14 ? (sinceRevenue / daysSince) * 30 : null;
  const growthPct =
    sinceJoiningPer30 !== null && baselinePer30 > 0 ? ((sinceJoiningPer30 - baselinePer30) / baselinePer30) * 100 : null;
  const storeRevenue = storeMonth._sum.revenue ?? 0;

  return {
    currency: shop.currency,
    thisMonth: {
      revenue: month._sum.revenue ?? 0,
      orders: month._count,
      visits,
      share: storeRevenue > 0 ? (month._sum.revenue ?? 0) / storeRevenue : null,
    },
    sinceJoining: { revenue: sinceRevenue, orders: since._count, days: daysSince },
    baselinePer30,
    sinceJoiningPer30,
    growthPct,
    byEngine: byEngine
      .map((e) => ({ engine: e.engine, revenue: e._sum.revenue ?? 0, orders: e._count }))
      .sort((a, b) => b.revenue - a.revenue),
    oursRevenue: ours._sum.revenue ?? 0,
    topProducts: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, qty]) => ({ title, qty })),
    recentOrders: recent.map((o) => ({ orderName: o.orderName, engine: o.engine, revenue: o.revenue, orderedAt: o.orderedAt, reason: o.reason })),
    hasPixel: Boolean(shop.pixelId),
  };
}

export async function visibilitySummary(shopId: string) {
  const snapshots = await db.visibilitySnapshot.findMany({
    where: { shopId },
    orderBy: { date: "asc" },
    select: { score: true, date: true, byEngine: true, mentionRate: true },
  });
  const latest = snapshots.at(-1) ?? null;
  const first = snapshots[0] ?? null;
  const previous = snapshots.at(-2) ?? null;
  return {
    latest,
    change: latest && previous ? latest.score - previous.score : null,
    sinceStart: latest && first && snapshots.length > 1 ? latest.score - first.score : null,
    trend: snapshots.slice(-12).map((s) => s.score),
  };
}

export async function activeScan(shopId: string) {
  return db.scan.findFirst({
    where: { shopId, status: { in: ["queued", "running"] } },
    orderBy: { startedAt: "desc" },
  });
}

export async function topCompetitors(shopId: string, limit = 5) {
  const scan = await db.scan.findFirst({ where: { shopId, status: "done" }, orderBy: { startedAt: "desc" } });
  if (!scan) return [];
  const hidden = await db.competitor.findMany({ where: { shopId, hidden: true }, select: { name: true } });
  const rows = await db.mention.groupBy({
    by: ["brand"],
    where: { isMerchant: false, answer: { scanId: scan.id, status: "parsed" } },
    _count: true,
    orderBy: { _count: { brand: "desc" } },
    take: limit + hidden.length + 5,
  });
  const total = await db.aiAnswer.count({ where: { scanId: scan.id, status: "parsed" } });
  return rows
    .filter((r) => !hidden.some((h) => h.name.toLowerCase() === r.brand.toLowerCase()))
    .slice(0, limit)
    .map((r) => ({ brand: r.brand, count: r._count, share: total ? r._count / total : 0 }));
}
