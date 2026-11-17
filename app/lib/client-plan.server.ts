// Each client's plan in the agency hub (Ross, 17 Nov 2026): the checklist with Ross's ticks, and what runs for the
// client today, next and later, read from the real schedule. The rules and words are in lib/client-plan.ts; the
// pop-up on the hub and the client's Checklist page are routes/dash.clients.$id.checklist.tsx.

import type { Client, Shop } from "@prisma/client";
import db from "../db.server";
import { getPlan } from "./plans";
import { activeScan } from "./dashboard.server";
import { scanHasWorker } from "./scan.server";
import { questionRows } from "./question-stats.server";
import { shopifyConnected } from "./guide-calendar.server";
import { addDays, localDay } from "./guide-calendar";
import { isLocal } from "./business";
import { type ClientStatus, clientMonth, daysWindow, hubDay, isClientStatus } from "./clients";
import { type AutoFacts, type FlowFacts, type GuideFact, checklistFor, checklistView, crawlersOk, isTickable, planFlow } from "./client-plan";

const DAY = 86_400_000;

/** Everything the pop-up shows for one client. */
export async function clientPlan(shop: Shop, client: Client | null, now = new Date()) {
  const local = isLocal(shop);
  const plan = getPlan(shop.plan);
  const today = hubDay(now);
  const storeToday = localDay(now, shop.country);
  const base = `/dash/clients/${shop.id}`;
  const setup = shop.onboarding !== "done";

  const [ticks, checksToday, lastDeep, running, onboard, slots, rows, reports, live, replied, connected] = await Promise.all([
    db.checklistTick.findMany({ where: { shopId: shop.id }, select: { key: true, doneAt: true } }),
    db.scan.findMany({ where: { shopId: shop.id, status: "done", finishedAt: daysWindow(today, today) }, select: { kind: true, finishedAt: true, score: true }, orderBy: { finishedAt: "asc" } }),
    db.scan.findFirst({ where: { shopId: shop.id, kind: { in: ["weekly", "baseline"] }, status: "done" }, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
    activeScan(shop.id).then(async (s) => (s && (await scanHasWorker(s.id)) ? s : null)),
    setup ? db.job.findFirst({ where: { shopId: shop.id, type: "onboard" }, orderBy: { createdAt: "desc" }, select: { status: true } }) : null,
    db.guideSlot.findMany({
      where: { shopId: shop.id, status: { not: "skipped" }, day: { gte: addDays(storeToday, -14), lte: addDays(storeToday, 45) } },
      orderBy: { day: "asc" },
      select: {
        id: true,
        day: true,
        status: true,
        approvedAt: true,
        publishedAt: true,
        question: { select: { id: true, text: true, volume: true } },
        fix: { select: { targetTitle: true, createdAt: true } },
      },
    }),
    setup ? null : questionRows(shop.id),
    db.clientReport.findMany({ where: { shopId: shop.id }, select: { kind: true, createdAt: true, sentAt: true }, orderBy: { createdAt: "desc" }, take: 60 }),
    db.guideSlot.count({ where: { shopId: shop.id, status: "published" } }),
    local ? 0 : db.redditThread.count({ where: { shopId: shop.id, repliedAt: { not: null } } }),
    shopifyConnected(shop),
  ]);

  const status: ClientStatus = client && isClientStatus(client.status) ? client.status : "active";
  const startedOn = client?.startedOn ?? today;
  const auto: AutoFacts = {
    setup: shop.onboarding === "scanning" || shop.onboarding === "done",
    "first-check": Boolean(shop.lastScanAt),
    contact: Boolean(client?.email),
    tracking: Boolean(shop.pixelId),
    crawlers: crawlersOk(shop.crawlers),
    "guide-live": live > 0,
    "report-sent": reports.some((r) => r.sentAt),
    reddit: replied > 0,
    "month-report": reports.some((r) => r.kind === "month" && r.sentAt),
  };

  // The next scheduled AI check, timed like the worker (lib/worker.server.ts): from the last scheduled one.
  const every = plan.scanEveryDays;
  const last = shop.lastScheduledScanAt ?? shop.lastScanAt;
  const nextCheck = every ? (last ? new Date(Math.max(last.getTime() + every * DAY - 3_600_000, now.getTime())) : now) : null;
  // Done for you: the daily check is the light one, and one a week is the full one (7 days after the last full one).
  const fullDue = (at: Date) => plan.id !== "pro" || !lastDeep || at.getTime() - lastDeep.startedAt.getTime() >= 7 * DAY;
  let nextFullAt: Date | null = null;
  if (nextCheck && every && !fullDue(nextCheck)) {
    nextFullAt = nextCheck;
    for (let i = 0; i < 8 && !fullDue(nextFullAt); i++) nextFullAt = new Date(nextFullAt.getTime() + every * DAY);
  }
  const reddit = !local && plan.id !== "free" ? (shop.redditCheckedAt ? new Date(Math.max(shop.redditCheckedAt.getTime() + 7 * DAY - 3_600_000, now.getTime())) : now) : null;
  const rates = new Map((rows?.questions ?? []).map((q) => [q.id, q.rate]));

  const guides: GuideFact[] = slots.map((s) => ({
    id: s.id,
    day: s.day,
    status: s.status,
    approvedAt: s.approvedAt?.toISOString() ?? null,
    writtenAt: s.fix?.createdAt.toISOString() ?? null,
    publishedAt: s.publishedAt?.toISOString() ?? null,
    title: s.fix?.targetTitle ?? s.question?.text ?? "Guide page",
    volume: s.question?.volume ?? null,
    rate: s.question ? rates.get(s.question.id) ?? null : null,
  }));

  const facts: FlowFacts = {
    now: now.toISOString(),
    base,
    status,
    running: plan.id !== "free",
    local,
    onboarding: shop.onboarding,
    setupFailed: setup && (onboard?.status === "failed" || (shop.onboarding === "scanning" && onboard?.status === "done" && !running)),
    startedOn,
    storeToday,
    connected,
    scan: running ? { kind: running.kind, done: running.done, total: running.total } : null,
    checksToday: checksToday.map((c) => ({ kind: c.kind, at: (c.finishedAt ?? now).toISOString(), score: c.score })),
    nextCheckAt: nextCheck?.toISOString() ?? null,
    nextFull: nextCheck ? fullDue(nextCheck) : false,
    nextFullAt: nextFullAt?.toISOString() ?? null,
    costCapHit: shop.costMonth === now.toISOString().slice(0, 7) && shop.costThisMonth >= plan.costCapUsd,
    redditNextAt: reddit?.toISOString() ?? null,
    guides,
    lastReportAt: reports[0]?.createdAt.toISOString() ?? null,
  };

  return {
    shopId: shop.id,
    name: shop.name || shop.primaryDomain || shop.domain,
    host: shop.primaryDomain || shop.domain,
    local,
    area: shop.area,
    client: Boolean(client),
    status,
    today,
    month: clientMonth(startedOn, today),
    checklist: checklistView(checklistFor(local), ticks, auto, startedOn, today, base),
    flow: planFlow(facts),
    // While setup or an AI check runs, the pop-up looks again now and then.
    busy: setup || Boolean(running) || guides.some((g) => g.status === "writing"),
  };
}

export type ClientPlan = Awaited<ReturnType<typeof clientPlan>>;

/** Tick a line on a client's checklist, or untick it. Lines that tick themselves can't be ticked by hand. */
export async function setTick(shop: Pick<Shop, "id" | "kind">, key: unknown, done: boolean, by: string): Promise<boolean> {
  if (!isTickable(key, isLocal(shop))) return false;
  const k = key as string;
  if (done) await db.checklistTick.upsert({ where: { shopId_key: { shopId: shop.id, key: k } }, create: { shopId: shop.id, key: k, doneBy: by }, update: {} });
  else await db.checklistTick.deleteMany({ where: { shopId: shop.id, key: k } });
  return true;
}
