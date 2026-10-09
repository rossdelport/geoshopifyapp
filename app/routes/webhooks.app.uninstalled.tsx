import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhooks can arrive more than once, and after the sessions are already gone.
  if (session) await db.session.deleteMany({ where: { shop } });

  const row = await db.shop.findUnique({ where: { domain: shop } });
  if (row) {
    await db.shop.update({
      where: { id: row.id },
      data: { status: "uninstalled", uninstalledAt: new Date(), plan: "free", pixelId: null },
    });
    // Stop background work for this shop.
    await db.job.updateMany({ where: { shopId: row.id, status: "queued" }, data: { status: "failed", error: "App uninstalled" } });
  }
  return new Response();
};
