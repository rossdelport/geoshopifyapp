// Orders -> AI revenue. Backfills the last 60 days on install, then checks every new order.

import db from "../db.server";
import { env } from "./env.server";
import { classifyOrder, type OrderSignals } from "./attribution";
import { gql, ShopifyGqlError, type AdminClient } from "./shopify-gql.server";
import { registerJob } from "./jobs.server";
import { adminFor } from "./onboard-job.server";

const VISIT = `landingPage referrerUrl source sourceType utmParameters { source medium campaign }`;
const ORDER_FIELDS = (withJourney: boolean) => `
  id name createdAt sourceName
  totalPriceSet { shopMoney { amount currencyCode } }
  channelInformation { channelDefinition { handle channelName subChannelName } app { title } }
  ${withJourney ? `customerJourneySummary { firstVisit { ${VISIT} } lastVisit { ${VISIT} } }` : ""}
  lineItems(first: 10) { nodes { title quantity } }`;

const ordersQuery = (withJourney: boolean) => `#graphql
  query Orders($cursor: String, $query: String) {
    orders(first: 100, after: $cursor, query: $query, sortKey: CREATED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes { ${ORDER_FIELDS(withJourney)} }
    }
  }`;
const orderQuery = (withJourney: boolean) => `#graphql
  query Order($id: ID!) { order(id: $id) { ${ORDER_FIELDS(withJourney)} } }`;

type OrderNode = any;

function toSignals(o: OrderNode): OrderSignals {
  const visit = (v: any) =>
    v ? { landingPage: v.landingPage, referrerUrl: v.referrerUrl, source: v.source, utmSource: v.utmParameters?.source } : null;
  return {
    firstVisit: visit(o.customerJourneySummary?.firstVisit),
    lastVisit: visit(o.customerJourneySummary?.lastVisit),
    sourceName: o.sourceName,
    channelName: o.channelInformation?.channelDefinition?.channelName,
    channelHandle: o.channelInformation?.channelDefinition?.handle,
    appTitle: o.channelInformation?.app?.title,
  };
}

const dayOf = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);

/** Save an order if it came from AI. Returns true if it did. */
async function saveIfAi(shopId: string, o: OrderNode): Promise<boolean> {
  const result = classifyOrder(toSignals(o), env.utmSource);
  if (!result) return false;
  const money = o.totalPriceSet?.shopMoney;
  const data = {
    engine: result.engine,
    ours: result.ours,
    reason: result.reason,
    revenue: Number(money?.amount ?? 0),
    currency: money?.currencyCode ?? "AUD",
    orderName: o.name,
    products: (o.lineItems?.nodes ?? []).map((l: any) => ({ title: l.title, qty: l.quantity })),
    orderedAt: new Date(o.createdAt),
  };
  await db.aiOrder.upsert({
    where: { shopId_orderGid: { shopId, orderGid: o.id } },
    create: { shopId, orderGid: o.id, ...data },
    update: data,
  });
  return true;
}

/** Fetch with customer journey; if the app isn't approved for that data yet, fetch without it. */
async function fetchWithFallback<T>(admin: AdminClient, build: (j: boolean) => string, vars: Record<string, unknown>): Promise<T> {
  try {
    return await gql<T>(admin, build(true), vars);
  } catch (err) {
    if (err instanceof ShopifyGqlError && /customerJourney|access|denied|protected/i.test(err.message)) {
      console.warn(`[orders] customer journey not available, using channel data only: ${err.message.slice(0, 200)}`);
      return gql<T>(admin, build(false), vars);
    }
    throw err;
  }
}

export async function backfillOrders(shopId: string, admin: AdminClient, days = 60) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const totals = new Map<string, { orders: number; revenue: number }>();
  let cursor: string | null = null;
  let aiCount = 0;
  do {
    const data: any = await fetchWithFallback(admin, ordersQuery, { cursor, query: `created_at:>=${since}` });
    for (const o of data.orders.nodes) {
      const key = o.createdAt.slice(0, 10);
      const t = totals.get(key) ?? { orders: 0, revenue: 0 };
      t.orders++;
      t.revenue += Number(o.totalPriceSet?.shopMoney?.amount ?? 0);
      totals.set(key, t);
      if (await saveIfAi(shopId, o)) aiCount++;
    }
    cursor = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor : null;
  } while (cursor);

  for (const [day, t] of totals) {
    await db.orderDay.upsert({
      where: { shopId_date: { shopId, date: dayOf(day) } },
      create: { shopId, date: dayOf(day), orders: t.orders, revenue: t.revenue },
      update: { orders: t.orders, revenue: t.revenue },
    });
  }
  return { days: totals.size, aiOrders: aiCount };
}

export async function processOrder(shopId: string, admin: AdminClient, orderGid: string) {
  const data: any = await fetchWithFallback(admin, orderQuery, { id: orderGid });
  const o = data.order;
  if (!o) return;
  await saveIfAi(shopId, o);
  const date = dayOf(o.createdAt);
  const amount = Number(o.totalPriceSet?.shopMoney?.amount ?? 0);
  await db.orderDay.upsert({
    where: { shopId_date: { shopId, date } },
    create: { shopId, date, orders: 1, revenue: amount },
    update: { orders: { increment: 1 }, revenue: { increment: amount } },
  });
}

registerJob("orders.backfill", async (job) => {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: job.shopId! } });
  const result = await backfillOrders(shop.id, await adminFor(shop.domain));
  console.log(`[orders] backfill ${shop.domain}: ${result.days} days, ${result.aiOrders} AI orders`);
});

registerJob("orders.one", async (job) => {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: job.shopId! } });
  const { orderGid } = job.payload as { orderGid: string };
  await processOrder(shop.id, await adminFor(shop.domain), orderGid);
});
