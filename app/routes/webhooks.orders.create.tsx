import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { enqueue } from "../lib/jobs.server";

// New order: check it for AI a few minutes later, once Shopify has built the customer journey.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  const orderGid = (payload as { admin_graphql_api_id?: string }).admin_graphql_api_id;
  const row = await db.shop.findUnique({ where: { domain: shop }, select: { id: true, status: true } });
  // Shopify sends a webhook again whenever it isn't answered within 5 seconds: an order already queued or
  // counted is never counted twice.
  const seen = orderGid ? await db.job.findUnique({ where: { dedupeKey: `order:${orderGid}` }, select: { id: true } }) : null;
  if (row && orderGid && row.status === "installed" && !seen) {
    await enqueue(
      "orders.one",
      { orderGid },
      { shopId: row.id, dedupeKey: `order:${orderGid}`, runAfter: new Date(Date.now() + 3 * 60_000) },
    );
  }
  return new Response();
};
