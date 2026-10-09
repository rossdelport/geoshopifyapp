import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { planFromBillingName } from "../lib/plans";
import { onPlanChanged } from "../lib/billing.server";

// Plan changed (approved, cancelled, expired, frozen): keep our copy of the plan in sync.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  const sub = (payload as { app_subscription?: { name?: string; status?: string } }).app_subscription;
  const row = await db.shop.findUnique({ where: { domain: shop } });
  if (row && sub?.name) {
    const plan = planFromBillingName(sub.name);
    const status = (sub.status ?? "").toUpperCase();
    if (status === "ACTIVE") await onPlanChanged(row.id, plan);
    else if (["CANCELLED", "EXPIRED", "DECLINED", "FROZEN"].includes(status) && row.plan === plan) {
      await onPlanChanged(row.id, "free");
    }
  }
  return new Response();
};
