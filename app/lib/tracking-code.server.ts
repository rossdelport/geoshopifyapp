// The GEO tracking code for web app stores: a Shopify "custom pixel" the store pastes into Shopify admin ->
// Settings -> Customer events. It sends the first page of each visit (where the shopper came from) and each order
// (total, products, and the shopper's first and latest visit), never names, emails or addresses. Each store's code
// carries its own key, so only that store's code can send its orders.

import { randomBytes } from "node:crypto";
import db from "../db.server";
import { env } from "./env.server";
import { classifyOrder, type Visit } from "./attribution";
import { SITE } from "./tools/site";

/** The store's tracking key, made the first time it's asked for. */
export async function trackKeyFor(shopId: string): Promise<string> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, select: { trackKey: true } });
  if (shop.trackKey) return shop.trackKey;
  const key = `geo_${randomBytes(18).toString("base64url")}`;
  await db.shop.updateMany({ where: { id: shopId, trackKey: null }, data: { trackKey: key } });
  return (await db.shop.findUniqueOrThrow({ where: { id: shopId }, select: { trackKey: true } })).trackKey!;
}

/** The code to paste into Shopify. Plain JavaScript: Shopify runs it in its own sandbox. */
export function trackingCode(key: string): string {
  return `// GEO tracking code: counts visits from AI assistants (ChatGPT and co) and the orders they lead to.
// It sends no names, emails or addresses. Made for your store only: please don't share it.
const GEO = { key: "${key}", endpoint: "${SITE}/api/pixel" };

function geoSend(body) {
  fetch(GEO.endpoint, {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "text/plain" },
    body: JSON.stringify(Object.assign({ k: GEO.key }, body)),
  }).catch(function () {});
}

async function geoRead(name) {
  try { return JSON.parse((await browser.localStorage.getItem(name)) || "null"); } catch (e) { return null; }
}

analytics.subscribe("page_viewed", async function (event) {
  try {
    if (await browser.sessionStorage.getItem("geo_visit")) return;
    await browser.sessionStorage.setItem("geo_visit", "1");
    var doc = event.context.document;
    var visit = JSON.stringify({ ref: doc.referrer || "", url: doc.location.href });
    if (!(await browser.localStorage.getItem("geo_first"))) await browser.localStorage.setItem("geo_first", visit);
    await browser.localStorage.setItem("geo_last", visit);
    geoSend({ ref: doc.referrer || "", url: doc.location.href, cid: event.clientId });
  } catch (e) {}
});

analytics.subscribe("checkout_completed", async function (event) {
  try {
    var c = event.data.checkout;
    geoSend({
      type: "order",
      order: String((c.order && c.order.id) || c.token || ""),
      total: Number(c.totalPrice && c.totalPrice.amount) || 0,
      currency: (c.totalPrice && c.totalPrice.currencyCode) || c.currencyCode || "",
      items: (c.lineItems || []).slice(0, 20).map(function (l) {
        return { title: String(l.title || "").slice(0, 120), qty: Number(l.quantity) || 1 };
      }),
      first: await geoRead("geo_first"),
      last: await geoRead("geo_last"),
    });
  } catch (e) {}
});
`;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the body comes from shoppers' browsers, any shape */
const visitOf = (v: any): Visit | null =>
  v && typeof v === "object" ? { referrerUrl: String(v.ref ?? "").slice(0, 1000), landingPage: String(v.url ?? "").slice(0, 1000) } : null;

/** One order from a store's tracking code: counted in the day's sales, and saved as an AI order when it came from AI. */
export async function recordPixelOrder(shopId: string, body: any): Promise<"ai" | "other" | "ignored"> {
  const orderId = String(body.order ?? "").replace(/[^\w:/.-]/g, "").slice(0, 120);
  const total = Number(body.total);
  if (!orderId || !Number.isFinite(total) || total < 0 || total > 1_000_000) return "ignored";
  const currency = /^[A-Z]{3}$/.test(String(body.currency)) ? String(body.currency) : null;
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, select: { currency: true } });
  const orderGid = orderId.startsWith("gid://") ? orderId : `gid://shopify/Order/${orderId}`;
  const now = new Date();
  const date = new Date(now.toISOString().slice(0, 10));

  const ai = classifyOrder({ firstVisit: visitOf(body.first), lastVisit: visitOf(body.last) }, env.utmSource);
  if (ai) {
    const items = (Array.isArray(body.items) ? body.items : [])
      .slice(0, 20)
      .map((i: any) => ({ title: String(i?.title ?? "").slice(0, 120), qty: Math.max(1, Math.min(999, Number(i?.qty) || 1)) }))
      .filter((i: { title: string }) => i.title);
    try {
      await db.aiOrder.create({
        data: {
          shopId,
          orderGid,
          engine: ai.engine,
          ours: ai.ours,
          reason: ai.reason,
          revenue: total,
          currency: currency ?? shop.currency,
          products: items,
          orderedAt: now,
        },
      });
    } catch {
      return "ignored"; // the same order sent twice (a reloaded thank-you page)
    }
  }
  await db.orderDay.upsert({
    where: { shopId_date: { shopId, date } },
    create: { shopId, date, orders: 1, revenue: total },
    update: { orders: { increment: 1 }, revenue: { increment: total } },
  });
  return ai ? "ai" : "other";
}
/* eslint-enable @typescript-eslint/no-explicit-any */
