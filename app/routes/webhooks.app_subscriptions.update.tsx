import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { planFromBillingName } from "../lib/plans";
import { activeSubscriptions, onPlanChanged, syncPlanFromSubscriptions } from "../lib/billing.server";

// Plan changed (approved, cancelled, expired, frozen): keep our copy of the plan in sync.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, admin } = await authenticate.webhook(request);
  const sub = (payload as { app_subscription?: { name?: string; status?: string } }).app_subscription;
  const row = await db.shop.findUnique({ where: { domain: shop } });
  if (!row) return new Response();

  if (admin) {
    // Ask Shopify what is live now. Switching plan or monthly/yearly cancels the old subscription, and
    // its CANCELLED webhook can arrive after the new one's ACTIVE webhook (both can be the same plan),
    // so the payload alone can't say whether the store still has a plan.
    let live;
    try {
      live = await activeSubscriptions(admin);
    } catch (err) {
      // Never guess from the payload here: that could drop a paying store to free. A 500 makes Shopify retry.
      console.error(`[billing] could not read subscriptions for ${shop}, asking Shopify to retry: ${(err as Error).message}`);
      return new Response("Could not read subscriptions", { status: 500 });
    }
    await syncPlanFromSubscriptions(row.id, live);
  } else if (sub?.name) {
    // No admin access (no offline session, e.g. uninstalled). Take a newly active plan from the payload,
    // but only drop a plan when the shop is uninstalled: a CANCELLED webhook can be the old half of a switch.
    // The plans page re-syncs from Shopify on its next load.
    const status = (sub.status ?? "").toUpperCase();
    if (status === "ACTIVE" && row.status === "installed") {
      await onPlanChanged(row.id, planFromBillingName(sub.name), { billingName: sub.name });
    } else if (status !== "ACTIVE" && row.status === "uninstalled" && row.plan !== "free") {
      await onPlanChanged(row.id, "free");
    }
  }
  return new Response();
};
