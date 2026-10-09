// Live end-to-end check without Shopify: set GEO_SELFTEST=1 on the server and read the logs.
// Creates an internal test shop, runs a real (small) scan on every engine, then writes fixes
// and outreach drafts. Costs well under US$1. Remove GEO_SELFTEST afterwards.

import db from "../db.server";
import { registerJob, enqueue } from "./jobs.server";
import { startScan } from "./scan.server";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait until no queued/running jobs of these types remain for the shop (max 15 min). */
async function waitForJobs(shopId: string, types: string[]) {
  for (let i = 0; i < 180; i++) {
    const open = await db.job.count({ where: { shopId, type: { in: types }, status: { in: ["queued", "running"] } } });
    if (!open) return;
    await sleep(5000);
  }
}

export const SELFTEST_DOMAIN = "geo-selftest.myshopify.com";

registerJob("selftest", async () => {
  const log = (msg: string) => console.log(`[selftest] ${msg}`);
  await db.shop.deleteMany({ where: { domain: SELFTEST_DOMAIN } });
  const shop = await db.shop.create({
    data: {
      domain: SELFTEST_DOMAIN,
      name: "Jericho Australia",
      primaryDomain: "jerichoaustralia.com",
      country: "AU",
      plan: "core",
      onboarding: "scanning",
      status: "uninstalled", // keeps the scheduler away from it
      profile: {
        create: {
          brandName: "Jericho Australia",
          aliases: ["Jericho"],
          summary: "Australian men's grooming brand selling natural beard oils, beard balms and beard butters.",
          category: "men's grooming",
          audience: "men with beards",
          pricePoint: "mid",
        },
      },
      products: {
        create: [
          { gid: "gid://shopify/Product/9001", title: "Naked Beard Oil 50ml", handle: "naked-beard-oil-50-ml", productType: "", status: "ACTIVE", price: "35.00 AUD", description: "Unscented beard oil. Blend of almond, sunflower, grapeseed, avocado, hemp seed and shea oils. 50ml glass bottle." },
          { gid: "gid://shopify/Product/9002", title: "Beard Butter Naked 60ml", handle: "beard-butter-naked-60ml", productType: "Beard Balm", status: "ACTIVE", price: "29.00 AUD", description: "Unscented beard butter for softer beards." },
        ],
      },
      questions: {
        create: [
          { text: "best beard oil for dry skin in Australia", volume: 300 },
          { text: "unscented beard oil for sensitive skin", volume: 150 },
          { text: "best beard balm australia", volume: 400 },
        ],
      },
    },
  });

  const t0 = Date.now();
  const scan = await startScan(shop.id, "weekly");
  await waitForJobs(shop.id, ["scan.run"]);
  const done = await db.scan.findUniqueOrThrow({ where: { id: scan.id } });
  const answers = await db.aiAnswer.findMany({ where: { scanId: scan.id }, include: { mentions: true, citations: true } });
  log(`scan ${done.status} in ${Math.round((Date.now() - t0) / 1000)}s: ${done.done}/${done.total} answers, ${done.failed} failed, score ${done.score}, cost $${done.costUsd.toFixed(4)}`);
  for (const engine of ["chatgpt", "gemini", "perplexity", "aio"]) {
    const list = answers.filter((a) => a.engine === engine);
    const named = list.filter((a) => a.mentioned).length;
    const brands = [...new Set(list.flatMap((a) => a.mentions.map((m) => m.brand)))].slice(0, 6);
    const providers = [...new Set(list.map((a) => a.provider))];
    log(`  ${engine}: ${list.filter((a) => a.status === "parsed").length} parsed, ${list.filter((a) => a.status === "empty").length} empty, named in ${named}; via ${providers.join(",")}; brands: ${brands.join(" | ")}; sources: ${list.reduce((s, a) => s + a.citations.length, 0)}`);
    for (const a of list.filter((x) => x.error)) log(`    error: ${a.error?.slice(0, 200)}`);
  }
  const competitors = await db.competitor.findMany({ where: { shopId: shop.id } });
  log(`competitors: ${competitors.map((c) => c.name).join(", ")}`);

  // The scan queues fix writing and outreach on its own; wait for both.
  await waitForJobs(shop.id, ["fixes.generate", "outreach.find"]);
  const failedJobs = await db.job.findMany({ where: { shopId: shop.id, status: { not: "done" } } });
  for (const j of failedJobs) log(`job ${j.type} ${j.status}: ${j.error ?? ""}`);
  const fixRows = await db.fix.findMany({ where: { shopId: shop.id } });
  log(`fixes: ${fixRows.length} written`);
  for (const f of fixRows) log(`  ${f.type} on "${f.targetTitle}" (${f.impact}): ${f.reason} | missing: ${f.missingInfo ?? "-"} | after: ${JSON.stringify(f.after).slice(0, 300)}`);

  const targets = await db.outreachTarget.findMany({ where: { shopId: shop.id } });
  log(`outreach: ${targets.length} targets`);
  for (const t of targets) log(`  ${t.url} | email: ${t.email ?? "-"} | contact: ${t.contactUrl ?? "-"} | subject: ${t.subject ?? "-"}`);
  if (targets[0]?.pitch) log(`  sample pitch:\n${targets[0].pitch}`);

  const cost = await db.apiCost.groupBy({ by: ["provider"], where: { shopId: shop.id }, _sum: { usd: true } });
  log(`total cost: ${cost.map((c) => `${c.provider} $${(c._sum.usd ?? 0).toFixed(4)}`).join(", ")}`);
  log("DONE");
});

export async function maybeRunSelftest() {
  if (process.env.GEO_SELFTEST !== "1") return;
  await enqueue("selftest", {}, { dedupeKey: "selftest" });
}
