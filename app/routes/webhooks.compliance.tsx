import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory privacy webhooks.
// We never store customer names, emails or addresses: AI orders keep only the order id,
// total and product titles, and AI visits keep a hashed anonymous browser id.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`[privacy] ${topic} for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Nothing personal stored about the customer; nothing to send.
      break;
    case "CUSTOMERS_REDACT": {
      // Remove the customer's orders from our AI order list to be safe.
      const ids = ((payload as { orders_to_redact?: number[] }).orders_to_redact ?? []).map(
        (id) => `gid://shopify/Order/${id}`,
      );
      if (ids.length) await db.aiOrder.deleteMany({ where: { shop: { domain: shop }, orderGid: { in: ids } } });
      break;
    }
    case "SHOP_REDACT":
      // 48 hours after uninstall: delete everything we have for this shop.
      await db.session.deleteMany({ where: { shop } });
      await db.shop.deleteMany({ where: { domain: shop } });
      break;
  }
  return new Response();
};
