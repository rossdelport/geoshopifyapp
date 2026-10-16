// Monthly email report via Resend. Plain, friendly, money first.

import db from "../db.server";
import { sendEmail } from "./email.server";
import { visibilitySummary } from "./dashboard.server";
import { registerJob } from "./jobs.server";
import { AI_ENGINE_LABELS } from "./attribution";
import { formatMoney } from "./format";
import { startOfMonth } from "./limits";

/**
 * The month a report covers: the whole calendar month before `now` (UTC). The worker sends reports in the
 * first 3 days of a month, so "this month" would hold only a day or two of sales.
 */
export function reportPeriod(now = new Date()): { start: Date; end: Date; label: string } {
  const end = startOfMonth(now);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 1, 1));
  return { start, end, label: start.toLocaleString("en-US", { month: "long", timeZone: "UTC" }) };
}

/** AI sales, orders and visits in [start, end), and the sales by assistant. */
async function monthTotals(shopId: string, start: Date, end: Date) {
  const range = { gte: start, lt: end };
  const [orders, visits, byEngine] = await Promise.all([
    db.aiOrder.aggregate({ where: { shopId, orderedAt: range }, _sum: { revenue: true }, _count: true }),
    db.aiSession.count({ where: { shopId, occurredAt: range, engine: { not: "ours" } } }),
    db.aiOrder.groupBy({ by: ["engine"], where: { shopId, orderedAt: range }, _sum: { revenue: true }, _count: true }),
  ]);
  return {
    revenue: orders._sum.revenue ?? 0,
    orders: orders._count,
    visits,
    byEngine: byEngine
      .map((e) => ({ engine: e.engine, revenue: e._sum.revenue ?? 0, orders: e._count }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

export async function buildMonthlyReport(shopId: string, now = new Date()) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const period = reportPeriod(now);
  const month = await monthTotals(shopId, period.start, period.end);
  const vis = await visibilitySummary(shopId);
  const pending = await db.fix.count({ where: { shopId, status: "pending" } });
  const appUrl = `https://admin.shopify.com/store/${shop.domain.replace(".myshopify.com", "")}/apps/${process.env.SHOPIFY_API_KEY ?? ""}`;
  const m = (n: number) => formatMoney(n, shop.currency);
  const engines = month.byEngine
    .slice(0, 4)
    .map((e) => `<li>${AI_ENGINE_LABELS[e.engine as keyof typeof AI_ENGINE_LABELS] ?? e.engine}: ${m(e.revenue)} (${e.orders} orders)</li>`)
    .join("");

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f7;padding:24px;color:#202223">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px">
  <p style="margin:0;color:#6d7175;font-size:13px">Your AI search report · ${shop.name ?? shop.domain}</p>
  <h1 style="font-size:22px;margin:8px 0 20px">Money from AI in ${period.label}</h1>
  <table style="width:100%;border-collapse:collapse;text-align:center"><tr>
    <td style="padding:12px;background:#f1f8f5;border-radius:12px"><div style="font-size:24px;font-weight:700">${m(month.revenue)}</div><div style="color:#6d7175;font-size:12px">sales from AI</div></td>
    <td style="width:8px"></td>
    <td style="padding:12px;background:#f4f6f8;border-radius:12px"><div style="font-size:24px;font-weight:700">${month.orders}</div><div style="color:#6d7175;font-size:12px">orders</div></td>
    <td style="width:8px"></td>
    <td style="padding:12px;background:#f4f6f8;border-radius:12px"><div style="font-size:24px;font-weight:700">${month.visits}</div><div style="color:#6d7175;font-size:12px">visits from AI</div></td>
  </tr></table>
  ${engines ? `<p style="margin:20px 0 6px;font-weight:600">Where it came from</p><ul style="margin:0;padding-left:18px">${engines}</ul>` : ""}
  <p style="margin:20px 0 6px;font-weight:600">How often AI recommends you</p>
  <p style="margin:0">Visibility score: ${vis.latest ? `<b>${vis.latest.score}/100</b>` : "not measured yet"}${vis.sinceStart !== null ? ` (${vis.sinceStart >= 0 ? "+" : ""}${vis.sinceStart} since you joined)` : ""}</p>
  ${pending ? `<p style="margin:20px 0 0">You have <b>${pending} fix${pending === 1 ? "" : "es"}</b> ready to approve. Each one takes a click.</p>` : ""}
  <p style="margin:24px 0 0"><a href="${appUrl}" style="background:#202223;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Open the app</a></p>
  <p style="color:#8c9196;font-size:12px;margin-top:24px">AI sales are orders where the shopper arrived from an AI assistant like ChatGPT. Google AI Overviews can't be separated from normal Google traffic, so they aren't counted here.</p>
</div></body></html>`;
  return { html, subject: `${m(month.revenue)} from AI in ${period.label} · ${shop.name ?? "your store"}` };
}

registerJob("report.monthly", async (job) => {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: job.shopId! } });
  const to = (shop.reportEmails ?? shop.email ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length) {
    // Nobody to send to: still "done" for this month, or the scheduler would queue it again every minute.
    await db.shop.update({ where: { id: shop.id }, data: { lastReportAt: new Date() } });
    return;
  }
  const { html, subject } = await buildMonthlyReport(shop.id);
  // One send per store per month, even when Resend is slow and the job runs twice.
  await sendEmail(to, subject, html, shop.id, `report:${shop.id}:${new Date().toISOString().slice(0, 7)}`);
  await db.shop.update({ where: { id: shop.id }, data: { lastReportAt: new Date() } });
});
