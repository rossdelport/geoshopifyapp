// Reads a client's store stats from the database (Ross, 5 Nov 2026: "store stats" in the agency hub): visits, orders
// and sales from AI next to the whole store's, day by day, and the AI score. All the reads go at once; the sums are in
// lib/store-stats.ts.

import type { Shop } from "@prisma/client";
import db from "../db.server";
import { dayStartsAt, dayOf, daysWindow, hubDay } from "./clients";
import {
  type DayValue,
  type StatSpan,
  dailyScores,
  engineRows,
  engineScores,
  fillDays,
  fullyTracked,
  roundMoney,
  shopperSources,
  statWindow,
  sumValues,
  topProducts,
  utcDay,
} from "./store-stats";

/** A UTC day as the database's date ("2026-11-05" -> midnight UTC), for the rows saved by UTC day. */
const utcDate = (day: string) => new Date(`${day}T00:00:00Z`);

export async function storeStats(shop: Pick<Shop, "id" | "currency" | "pixelId">, days: StatSpan, now = new Date()) {
  const w = statWindow(hubDay(now), days);
  const shopId = shop.id;
  const both = { gte: utcDate(w.prevFrom), lte: utcDate(w.to) }; // the days shown and the days before, by UTC day
  const notOurs = { not: "ours" }; // visits through our own guide pages aren't visits from AI

  const [traffic, orderDays, aiOrders, aiBefore, aiVisits, visitsBefore, snaps, lastBefore, firstTraffic] = await Promise.all([
    db.trafficDay.findMany({ where: { shopId, date: both }, select: { date: true, sessions: true, searchSessions: true } }),
    db.orderDay.findMany({ where: { shopId, date: both }, select: { date: true, orders: true, revenue: true, searchOrders: true, searchRevenue: true } }),
    db.aiOrder.findMany({ where: { shopId, orderedAt: daysWindow(w.from, w.to) }, select: { engine: true, revenue: true, products: true, orderedAt: true } }),
    db.aiOrder.aggregate({ where: { shopId, orderedAt: daysWindow(w.prevFrom, w.prevTo) }, _sum: { revenue: true }, _count: true }),
    db.aiSession.findMany({ where: { shopId, engine: notOurs, occurredAt: daysWindow(w.from, w.to) }, select: { engine: true, occurredAt: true } }),
    db.aiSession.count({ where: { shopId, engine: notOurs, occurredAt: daysWindow(w.prevFrom, w.prevTo) } }),
    db.visibilitySnapshot.findMany({ where: { shopId, date: daysWindow(w.from, w.to) }, orderBy: { date: "asc" }, select: { date: true, score: true, byEngine: true } }),
    db.visibilitySnapshot.findFirst({ where: { shopId, date: { lt: dayStartsAt(w.from) } }, orderBy: { date: "desc" }, select: { score: true, byEngine: true } }),
    db.trafficDay.findFirst({ where: { shopId }, orderBy: { date: "asc" }, select: { date: true } }),
  ]);

  // The daily totals, split into the days shown and the days before.
  const shown = <T extends { date: Date }>(rows: T[]) => rows.filter((r) => utcDay(r.date) >= w.from);
  const earlier = <T extends { date: Date }>(rows: T[]) => rows.filter((r) => utcDay(r.date) < w.from);
  const sum = <T>(rows: T[], pick: (r: T) => number) => roundMoney(rows.reduce((n, r) => n + pick(r), 0));

  const charts = {
    aiSales: fillDays(w.from, w.to, aiOrders.map((o): DayValue => ({ day: dayOf(o.orderedAt), value: o.revenue }))),
    aiVisits: fillDays(w.from, w.to, aiVisits.map((v): DayValue => ({ day: dayOf(v.occurredAt), value: 1 }))),
    allVisits: fillDays(w.from, w.to, shown(traffic).map((t): DayValue => ({ day: utcDay(t.date), value: t.sessions }))),
  };

  const current = {
    aiRevenue: sumValues(charts.aiSales),
    aiOrders: aiOrders.length,
    aiVisits: aiVisits.length,
    allRevenue: sum(shown(orderDays), (o) => o.revenue),
    allOrders: sum(shown(orderDays), (o) => o.orders),
    allVisits: sumValues(charts.allVisits),
  };
  const before = {
    aiRevenue: roundMoney(aiBefore._sum.revenue ?? 0),
    aiOrders: aiBefore._count,
    aiVisits: visitsBefore,
    allRevenue: sum(earlier(orderDays), (o) => o.revenue),
    allOrders: sum(earlier(orderDays), (o) => o.orders),
    allVisits: sum(earlier(traffic), (t) => t.sessions),
  };

  const sources = shopperSources({
    all: { visits: current.allVisits, orders: current.allOrders, revenue: current.allRevenue },
    ai: { visits: current.aiVisits, orders: current.aiOrders, revenue: current.aiRevenue },
    search: {
      visits: sum(shown(traffic), (t) => t.searchSessions),
      orders: sum(shown(orderDays), (o) => o.searchOrders),
      revenue: sum(shown(orderDays), (o) => o.searchRevenue),
    },
  });

  // The AI score: the last check of each day, the latest one, and where it stood when these days began (the last check
  // before them, else the first one in them; with a single check there is nothing to compare).
  const latest = snaps.at(-1) ?? null;
  const start = lastBefore ?? (snaps.length > 1 ? snaps[0] : null);
  const trackingSince = firstTraffic ? utcDay(firstTraffic.date) : null;

  return {
    window: w,
    currency: shop.currency,
    tracking: Boolean(shop.pixelId),
    trackingSince,
    comparable: fullyTracked(trackingSince, w.prevFrom),
    totals: current,
    before,
    charts,
    sources,
    engines: engineRows(aiOrders, aiVisits),
    products: topProducts(aiOrders.map((o) => o.products)),
    score: {
      days: dailyScores(snaps, w.from, w.to),
      latest: latest ? { score: Math.round(latest.score), day: dayOf(latest.date) } : null,
      start: start ? Math.round(start.score) : null,
      engines: latest ? engineScores(latest.byEngine, start?.byEngine) : [],
    },
  };
}

export type StoreStats = Awaited<ReturnType<typeof storeStats>>;
