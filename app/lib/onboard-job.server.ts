// The "set me up" job: catalog -> brand profile -> questions -> first scan + order backfill.

import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { enqueue, registerJob } from "./jobs.server";
import { buildBrandProfile, generateQuestions, syncCatalog } from "./onboarding.server";
import { startScan } from "./scan.server";
import { syncPublicCatalog } from "./public-catalog.server";

export async function adminFor(shopDomain: string) {
  const { admin } = await unauthenticated.admin(shopDomain);
  return admin;
}

registerJob("onboard", async (job) => {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: job.shopId! } });
  // Web app stores have no Shopify connection: their public catalog, and no orders to read.
  const web = shop.source === "web";

  await db.shop.update({ where: { id: shop.id }, data: { onboarding: "profiling" } });
  if (web) await syncPublicCatalog(shop.id, 250);
  else await syncCatalog(shop.id, await adminFor(shop.domain), 250);
  await buildBrandProfile(shop.id);

  await db.shop.update({ where: { id: shop.id }, data: { onboarding: "questions" } });
  const hasQuestions = await db.question.count({ where: { shopId: shop.id, active: true } });
  if (!hasQuestions) await generateQuestions(shop.id);

  await db.shop.update({ where: { id: shop.id }, data: { onboarding: "scanning" } });
  if (!web) await enqueue("orders.backfill", {}, { shopId: shop.id, dedupeKey: `backfill:${shop.id}` });
  await startScan(shop.id, shop.plan === "free" ? "free" : "baseline");
});

registerJob("catalog.sync", async (job) => {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: job.shopId! } });
  if (shop.source === "web") await syncPublicCatalog(shop.id, 1000);
  else await syncCatalog(shop.id, await adminFor(shop.domain), 1000);
});
