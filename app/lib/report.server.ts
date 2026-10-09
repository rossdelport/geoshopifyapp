// Monthly email report via Resend. Plain, friendly, money first.

import db from "../db.server";
import { env } from "./env.server";
import { recordCost } from "./cost.server";
import { moneySummary, visibilitySummary } from "./dashboard.server";
import { registerJob } from "./jobs.server";
import { AI_ENGINE_LABELS } from "./attribution";
import { formatMoney } from "./format";

export async function sendEmail(to: string[], subject: string, html: string, shopId?: string) {
  if (!env.resendKey || !env.emailFrom) throw new Error("Email is not set up (RESEND_API_KEY / GEO_EMAIL_FROM)");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  await recordCost(shopId, "resend", "email", 0.0004).catch(() => {});
}

export async function buildMonthlyReport(shopId: string) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const money = await moneySummary(shop);
  const vis = await visibilitySummary(shopId);
  const pending = await db.fix.count({ where: { shopId, status: "pending" } });
  const appUrl = `https://admin.shopify.com/store/${shop.domain.replace(".myshopify.com", "")}/apps/${process.env.SHOPIFY_API_KEY ?? ""}`;
  const m = (n: number) => formatMoney(n, money.currency);
  const engines = money.byEngine
    .slice(0, 4)
    .map((e) => `<li>${AI_ENGINE_LABELS[e.engine as keyof typeof AI_ENGINE_LABELS] ?? e.engine}: ${m(e.revenue)} (${e.orders} orders)</li>`)
    .join("");

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f7;padding:24px;color:#202223">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:28px">
  <p style="margin:0;color:#6d7175;font-size:13px">Your AI search report · ${shop.name ?? shop.domain}</p>
  <h1 style="font-size:22px;margin:8px 0 20px">Money from AI this month</h1>
  <table style="width:100%;border-collapse:collapse;text-align:center"><tr>
    <td style="padding:12px;background:#f1f8f5;border-radius:12px"><div style="font-size:24px;font-weight:700">${m(money.thisMonth.revenue)}</div><div style="color:#6d7175;font-size:12px">sales from AI</div></td>
    <td style="width:8px"></td>
    <td style="padding:12px;background:#f4f6f8;border-radius:12px"><div style="font-size:24px;font-weight:700">${money.thisMonth.orders}</div><div style="color:#6d7175;font-size:12px">orders</div></td>
    <td style="width:8px"></td>
    <td style="padding:12px;background:#f4f6f8;border-radius:12px"><div style="font-size:24px;font-weight:700">${money.thisMonth.visits}</div><div style="color:#6d7175;font-size:12px">visits from AI</div></td>
  </tr></table>
  ${engines ? `<p style="margin:20px 0 6px;font-weight:600">Where it came from</p><ul style="margin:0;padding-left:18px">${engines}</ul>` : ""}
  <p style="margin:20px 0 6px;font-weight:600">How often AI recommends you</p>
  <p style="margin:0">Visibility score: <b>${vis.latest?.score ?? "–"}/100</b>${vis.sinceStart !== null ? ` (${vis.sinceStart >= 0 ? "+" : ""}${vis.sinceStart} since you joined)` : ""}</p>
  ${pending ? `<p style="margin:20px 0 0">You have <b>${pending} fix${pending === 1 ? "" : "es"}</b> ready to approve. Each one takes a click.</p>` : ""}
  <p style="margin:24px 0 0"><a href="${appUrl}" style="background:#202223;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">Open the app</a></p>
  <p style="color:#8c9196;font-size:12px;margin-top:24px">AI sales are orders where the shopper arrived from an AI assistant like ChatGPT. Google AI Overviews can't be separated from normal Google traffic, so they aren't counted here.</p>
</div></body></html>`;
  return { html, subject: `${m(money.thisMonth.revenue)} from AI this month · ${shop.name ?? "your store"}` };
}

registerJob("report.monthly", async (job) => {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: job.shopId! } });
  const to = (shop.reportEmails ?? shop.email ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!to.length) return;
  const { html, subject } = await buildMonthlyReport(shop.id);
  await sendEmail(to, subject, html, shop.id);
  await db.shop.update({ where: { id: shop.id }, data: { lastReportAt: new Date() } });
});
