// Makes, finds and sends client reports (Ross, 5 Nov 2026). The numbers are read once, when Ross makes the report, and
// saved with it (ClientReport.data), so a report always shows what it showed on the day it was made. The rules and
// wording are in lib/client-report.ts; the client's page is routes/results.$token.tsx and Ross's is
// routes/dash.clients.$id.reports.tsx.

import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import db from "../db.server";
import { topCompetitors } from "./dashboard.server";
import { emailConfigured, replyAddress, sendEmailMessage } from "./email.server";
import { addDays, localDay } from "./guide-calendar";
import { questionRows } from "./question-stats.server";
import { SITE } from "./tools/site";
import { workLog } from "./work-log.server";
import { clientMonth, dayStartsAt, daysWindow, hubDay } from "./clients";
import {
  type ClientReportData,
  type ReportKind,
  assistantRows,
  engineScores,
  isReportToken,
  periodStartScore,
  previousPeriod,
  questionSummary,
  readReportData,
  readReportNote,
  reportEmail,
  reportPeriod,
  workFromLog,
  workStartScore,
} from "./client-report";

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

/** A day as the date OrderDay rows are saved under (UTC midnight). */
const utcDate = (day: string) => new Date(`${day}T00:00:00Z`);

/** The private link to a report. */
export const reportUrl = (token: string) => `${SITE}/results/${token}`;

/**
 * Make a report for a client: its numbers read now and saved with it, behind a private link. `opts.note` is Ross's
 * note for the top of the report.
 */
export async function makeClientReport(
  shopId: string,
  kind: ReportKind,
  by: string,
  now = new Date(),
  opts: { note?: string } = {},
): Promise<{ ok: true; id: string; token: string } | { ok: false; error: string }> {
  const note = readReportNote(opts.note);
  if (!note.ok) return note;
  const [shop, client] = await Promise.all([
    db.shop.findUnique({ where: { id: shopId }, select: { name: true, primaryDomain: true, domain: true, currency: true, country: true, pixelId: true } }),
    db.client.findUnique({ where: { shopId }, select: { startedOn: true, status: true } }),
  ]);
  if (!shop) return { ok: false, error: "That store isn’t on FirstPicked any more." };
  if (!client) return { ok: false, error: "Make them a client first." };

  try {
    const data = await collect(shopId, kind, now, shop, client, note.note);
    const token = randomBytes(18).toString("base64url");
    const row = await db.clientReport.create({
      data: { shopId, kind, fromDay: data.fromDay, toDay: data.toDay, token, data: data as unknown as Prisma.InputJsonValue, createdBy: by || null },
      select: { id: true },
    });
    return { ok: true, id: row.id, token };
  } catch (err) {
    console.error("[client-report] couldn't make a report:", err);
    return { ok: false, error: "Something went wrong making the report. Please try again." };
  }
}

/** Every number a report shows, read side by side. */
async function collect(
  shopId: string,
  kind: ReportKind,
  now: Date,
  shop: { name: string | null; primaryDomain: string | null; domain: string; currency: string; country: string; pixelId: string | null },
  client: { startedOn: string; status: string },
  note: string | null,
): Promise<ClientReportData> {
  const today = hubDay(now);
  const period = reportPeriod(kind, today);
  const before = previousPeriod(period);
  const at = daysWindow(period.from, period.to);
  const atBefore = daysWindow(before.from, before.to);
  // Scores from a while before the work started (or the period before, if earlier), for "since we started".
  const scoresFrom = dayStartsAt(addDays([client.startedOn, before.from].sort()[0], -45));
  const notOurs = { not: "ours" }; // visits from pages we built aren't visits from AI

  const [sales, salesBefore, visits, visitsBefore, salesBy, visitsBy, store, scores, questions, rivals, log, writers, upcoming] = await Promise.all([
    db.aiOrder.aggregate({ where: { shopId, orderedAt: at }, _sum: { revenue: true }, _count: true }),
    db.aiOrder.aggregate({ where: { shopId, orderedAt: atBefore }, _sum: { revenue: true }, _count: true }),
    db.aiSession.count({ where: { shopId, occurredAt: at, engine: notOurs } }),
    db.aiSession.count({ where: { shopId, occurredAt: atBefore, engine: notOurs } }),
    db.aiOrder.groupBy({ by: ["engine"], where: { shopId, orderedAt: at }, _sum: { revenue: true }, _count: true }),
    db.aiSession.groupBy({ by: ["engine"], where: { shopId, occurredAt: at, engine: notOurs }, _count: true }),
    // OrderDay rows are dated by UTC day, so the period's days are matched as dates (a few hours off Perth's).
    db.orderDay.aggregate({ where: { shopId, date: { gte: utcDate(period.from), lte: utcDate(period.to) } }, _sum: { revenue: true, orders: true } }),
    db.visibilitySnapshot.findMany({ where: { shopId, date: { gte: scoresFrom, lt: at.lt } }, select: { score: true, date: true, byEngine: true }, orderBy: { date: "asc" } }),
    questionRows(shopId, { activeOnly: true }),
    topCompetitors(shopId, 5),
    workLog([shopId], period.from, period.to),
    db.siteWriter.findMany({ where: { shopId, found: true, createdAt: at }, select: { domain: true }, orderBy: { createdAt: "asc" } }),
    // The next guides, from today on the store's own calendar (guide days are the store's days).
    client.status === "active"
      ? db.guideSlot.findMany({
          where: { shopId, status: { in: ["planned", "writing", "ready"] }, day: { gte: localDay(now, shop.country) } },
          orderBy: { day: "asc" },
          take: 4,
          select: { day: true, fix: { select: { targetTitle: true } }, question: { select: { text: true } } },
        })
      : Promise.resolve([]),
  ]);

  const tracking = Boolean(shop.pixelId);
  const aiRevenue = sales._sum.revenue ?? 0;
  const storeRevenue = store._sum.revenue ?? 0;
  const latest = scores.at(-1);
  return {
    v: 1,
    brand: shop.name || shop.primaryDomain || shop.domain,
    host: shop.primaryDomain || shop.domain,
    currency: shop.currency,
    kind,
    fromDay: period.from,
    toDay: period.to,
    madeAt: now.toISOString(),
    startedOn: client.startedOn,
    month: clientMonth(client.startedOn, period.to),
    note,
    tracking,
    sales: { revenue: aiRevenue, orders: sales._count, visits },
    salesBefore: { revenue: salesBefore._sum.revenue ?? 0, orders: salesBefore._count, visits: visitsBefore },
    store: tracking ? { revenue: storeRevenue, orders: store._sum.orders ?? 0 } : null,
    share: tracking && storeRevenue > 0 ? aiRevenue / storeRevenue : null,
    byAssistant: assistantRows(
      salesBy.map((r) => ({ engine: r.engine, revenue: r._sum.revenue ?? 0, orders: r._count })),
      visitsBy.map((r) => ({ engine: r.engine, visits: r._count })),
    ),
    score: {
      now: latest ? Math.round(latest.score) : null,
      periodStart: periodStartScore(scores, period.from),
      workStart: workStartScore(scores, client.startedOn),
      byAssistant: latest ? engineScores(latest.byEngine) : [],
    },
    questions: questionSummary(questions.questions, questions.scanned),
    rivals: rivals.map((r) => ({ brand: r.brand, share: r.share })),
    work: workFromLog(log, writers.map((w) => w.domain)),
    next: upcoming.map((s) => ({ day: s.day, title: s.fix?.targetTitle || s.question?.text || "A new buying guide" })),
  };
}

/** A report's data by its private link, or null when the link is wrong (or the report was deleted). */
export async function reportByToken(token: string): Promise<ClientReportData | null> {
  if (!isReportToken(token)) return null;
  const row = await db.clientReport.findUnique({ where: { token }, select: { data: true } });
  return row ? readReportData(row.data) : null;
}

/** A client's reports, newest first (without their numbers: the list doesn't show them). */
export function listClientReports(shopId: string) {
  return db.clientReport.findMany({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, kind: true, fromDay: true, toDay: true, token: true, sentAt: true, sentTo: true, createdAt: true },
  });
}

/** Delete a report: its link stops working. False when it was already gone. */
export async function deleteClientReport(shopId: string, id: string): Promise<boolean> {
  if (!id) return false;
  const gone = await db.clientReport.deleteMany({ where: { id, shopId } });
  return gone.count > 0;
}

/** The client's addresses from Client.email ("a@x.com, b@y.com"). */
const emailList = (raw: string | null) =>
  String(raw ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Email a report to the client's addresses (their Details page), replies going to Ross. One send per report and list
 * of addresses a day: a double tap, or a try again after a timeout, never sends it twice.
 */
export async function sendClientReport(shopId: string, reportId: string, by: string): Promise<Result<{ message: string }>> {
  const [report, client] = await Promise.all([
    reportId ? db.clientReport.findFirst({ where: { id: reportId, shopId }, select: { id: true, token: true, data: true, sentAt: true, sentTo: true } }) : null,
    db.client.findUnique({ where: { shopId }, select: { email: true, contactName: true } }),
  ]);
  if (!report) return { ok: false, error: "That report is gone. Please make a new one." };
  if (!client) return { ok: false, error: "Make them a client first." };
  const to = emailList(client.email);
  if (!to.length) return { ok: false, error: "Add their email on the Details page first." };
  if (!emailConfigured()) return { ok: false, error: "Email isn’t set up yet. Copy the link and send it yourself." };
  const data = readReportData(report.data);
  if (!data) return { ok: false, error: "This report can’t be read. Please make a new one." };

  const sentTo = to.join(", ");
  try {
    const sent = await sendEmailMessage({
      to,
      ...reportEmail(data, reportUrl(report.token), client.contactName),
      replyTo: replyAddress(),
      idempotencyKey: `client-report:${report.id}:${to.join(",").toLowerCase()}`,
      shopId,
    });
    // Resend already sent this one to these addresses today: nothing new went out.
    if (sent.duplicate && report.sentAt && report.sentTo === sentTo) return { ok: true, message: `It was already emailed to ${sentTo} today.` };
  } catch (err) {
    console.error(`[client-report] ${by} couldn't email report ${report.id}:`, err);
    return { ok: false, error: "The email couldn’t be sent. Please try again in a minute." };
  }
  await db.clientReport.update({ where: { id: report.id }, data: { sentAt: new Date(), sentTo } });
  return { ok: true, message: `Emailed to ${sentTo}.` };
}
