import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { notifyFounder } from "../lib/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhooks can arrive more than once, and after the sessions are already gone.
  if (session) await db.session.deleteMany({ where: { shop } });

  const row = await db.shop.findUnique({ where: { domain: shop } });
  if (row) {
    // Shopify cancels the subscription on uninstall, but its webhook can't reach the founder (no admin
    // session, and the plan is already free by then), so a Done-for-you store leaving is reported here.
    // Compare and swap, so a repeated webhook reports it once.
    const leftDoneForYou =
      row.plan === "pro" && (await db.shop.updateMany({ where: { id: row.id, plan: "pro" }, data: { plan: "free" } })).count > 0;
    await db.shop.update({
      where: { id: row.id },
      // trialEndsAt stays, so reinstalling doesn't start a second free trial.
      data: { status: "uninstalled", uninstalledAt: new Date(), plan: "free", autopilot: false, pixelId: null },
    });
    // Stop background work for this shop, and close any scan it was running, so a reinstall starts afresh
    // (setup that hadn't finished starts again from the beginning).
    await db.job.updateMany({ where: { shopId: row.id, status: "queued" }, data: { status: "failed", error: "App uninstalled" } });
    await db.scan.updateMany({
      where: { shopId: row.id, status: { in: ["queued", "running"] } },
      data: { status: "failed", finishedAt: new Date(), error: "App uninstalled" },
    });
    await db.shop.updateMany({ where: { id: row.id, onboarding: { not: "done" } }, data: { onboarding: "new" } });
    if (leftDoneForYou) await notifyFounder(row, "pro", "free", { reason: "app uninstalled" });
  }
  return new Response();
};
