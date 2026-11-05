// Reads the work log from the database: everything that happened for some clients between two days (Perth), newest
// first. The rules and wording are in lib/work-log.ts.

import db from "../db.server";
import { AI_ENGINE_LABELS } from "./attribution";
import { formatMoney } from "./format";
import { daysWindow } from "./clients";
import { type LogEntry, bunchByDay, checkText, newestFirst, redditFoundText, writersText } from "./work-log";

const KIND_NAME: Record<string, string> = { week: "weekly", month: "monthly" };

/** Everything that happened for these stores from `from` to `to` (both days included). */
export async function workLog(shopIds: string[], from: string, to: string): Promise<LogEntry[]> {
  if (!shopIds.length) return [];
  const at = daysWindow(from, to);
  const shopId = { in: shopIds };
  const [guides, live, scans, found, replied, writers, sales, made, sent, notes, joined] = await Promise.all([
    db.fix.findMany({
      where: { shopId, type: "guide_page", refreshOfId: null, createdAt: at },
      select: { id: true, shopId: true, targetTitle: true, createdAt: true, slot: { select: { id: true } } },
    }),
    db.guideSlot.findMany({
      where: { shopId, status: "published", publishedAt: at },
      select: { id: true, shopId: true, publishedAt: true, fix: { select: { targetTitle: true, resultUrl: true } } },
    }),
    db.scan.findMany({
      where: { shopId, status: { in: ["done", "failed"] }, finishedAt: at },
      select: { id: true, shopId: true, status: true, finishedAt: true, score: true, total: true, engines: true, runs: true, error: true },
    }),
    db.redditThread.findMany({ where: { shopId, createdAt: at }, select: { shopId: true, createdAt: true } }),
    db.redditThread.findMany({ where: { shopId, repliedAt: at }, select: { id: true, shopId: true, title: true, url: true, repliedAt: true } }),
    db.siteWriter.findMany({ where: { shopId, found: true, createdAt: at }, select: { shopId: true, domain: true, createdAt: true } }),
    db.aiOrder.findMany({
      where: { shopId, orderedAt: at },
      select: { id: true, shopId: true, orderName: true, engine: true, revenue: true, currency: true, orderedAt: true },
    }),
    db.clientReport.findMany({ where: { shopId, createdAt: at }, select: { id: true, shopId: true, kind: true, token: true, createdAt: true, createdBy: true } }),
    db.clientReport.findMany({ where: { shopId, sentAt: at }, select: { id: true, shopId: true, kind: true, token: true, sentAt: true, sentTo: true, createdBy: true } }),
    db.workNote.findMany({ where: { shopId, doneAt: at }, select: { id: true, shopId: true, kind: true, text: true, doneAt: true, createdBy: true } }),
    db.client.findMany({ where: { shopId, createdAt: at }, select: { shopId: true, createdAt: true } }),
  ]);

  const base = (id: string) => `/dash/clients/${id}`;
  const out: LogEntry[] = [];
  for (const g of guides) {
    out.push({
      id: `gw-${g.id}`,
      shopId: g.shopId,
      at: g.createdAt.toISOString(),
      kind: "guide-written",
      text: `Guide written: ${g.targetTitle}`,
      href: g.slot ? `${base(g.shopId)}/guides/${g.slot.id}` : `${base(g.shopId)}/guides`,
    });
  }
  for (const s of live) {
    out.push({
      id: `gl-${s.id}`,
      shopId: s.shopId,
      at: s.publishedAt!.toISOString(),
      kind: "guide-live",
      text: `Guide live on their store: ${s.fix?.targetTitle ?? "guide page"}`,
      href: s.fix?.resultUrl || `${base(s.shopId)}/guides/${s.id}`,
    });
  }
  for (const s of scans) {
    const ok = s.status === "done";
    out.push({
      id: `sc-${s.id}`,
      shopId: s.shopId,
      at: s.finishedAt!.toISOString(),
      kind: ok ? "check" : "check-failed",
      text: ok ? checkText(s) : s.error && !/no ai answers/i.test(s.error) ? `The AI check stopped: ${s.error}` : "The AI check couldn’t read any answers.",
      href: `${base(s.shopId)}/questions`,
    });
  }
  for (const g of bunchByDay(found.map((r) => ({ shopId: r.shopId, at: r.createdAt })))) {
    out.push({ id: `rf-${g.shopId}-${g.day}`, shopId: g.shopId, at: g.at, kind: "reddit-found", text: redditFoundText(g.rows.length), href: `${base(g.shopId)}/reddit`, count: g.rows.length });
  }
  for (const r of replied) {
    out.push({ id: `rr-${r.id}`, shopId: r.shopId, at: r.repliedAt!.toISOString(), kind: "reddit-replied", text: `Replied on Reddit: ${r.title}`, href: r.url });
  }
  for (const g of bunchByDay(writers.map((w) => ({ shopId: w.shopId, at: w.createdAt, domain: w.domain })))) {
    out.push({ id: `wr-${g.shopId}-${g.day}`, shopId: g.shopId, at: g.at, kind: "writer", text: writersText(g.rows.map((w) => w.domain)), href: `${base(g.shopId)}/sites`, count: g.rows.length });
  }
  for (const o of sales) {
    const from = AI_ENGINE_LABELS[o.engine as keyof typeof AI_ENGINE_LABELS] ?? "AI";
    out.push({
      id: `so-${o.id}`,
      shopId: o.shopId,
      at: o.orderedAt.toISOString(),
      kind: "sale",
      text: `${formatMoney(o.revenue, o.currency)} order${o.orderName ? ` ${o.orderName}` : ""} from ${from}`,
      href: `${base(o.shopId)}/stats`,
    });
  }
  for (const r of made) {
    out.push({ id: `rm-${r.id}`, shopId: r.shopId, at: r.createdAt.toISOString(), kind: "report", text: `Made the ${KIND_NAME[r.kind] ?? ""} report`.replace("  ", " "), href: `/results/${r.token}`, by: r.createdBy });
  }
  for (const r of sent) {
    out.push({
      id: `rs-${r.id}`,
      shopId: r.shopId,
      at: r.sentAt!.toISOString(),
      kind: "report-sent",
      text: `Emailed the ${KIND_NAME[r.kind] ?? ""} report to ${r.sentTo ?? "the client"}`.replace("  ", " "),
      href: `/results/${r.token}`,
      by: r.createdBy,
    });
  }
  for (const n of notes) {
    const kind = n.kind === "change" || n.kind === "call" || n.kind === "status" ? n.kind : "note";
    out.push({
      id: `wn-${n.id}`,
      shopId: n.shopId,
      at: n.doneAt.toISOString(),
      kind: kind === "status" ? "client" : kind,
      text: n.text,
      noteId: kind === "status" ? undefined : n.id,
      by: n.createdBy,
    });
  }
  for (const c of joined) {
    out.push({ id: `cl-${c.shopId}`, shopId: c.shopId, at: c.createdAt.toISOString(), kind: "client", text: "Became a client" });
  }
  return out.sort(newestFirst);
}
