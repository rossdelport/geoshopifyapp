// Keep the shop's plan in sync and kick off the right work when it changes.

import db from "../db.server";
import { getPlan, type PlanId } from "./plans";
import { startScan } from "./scan.server";

export async function onPlanChanged(shopId: string, planId: PlanId) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  if (shop.plan === planId) return false;
  await db.shop.update({
    where: { id: shopId },
    data: { plan: planId, ...(planId !== "pro" ? { autopilot: false } : {}) },
  });

  const plan = getPlan(planId);
  // Fill the plan's question slots with the best unused questions (by search volume).
  const active = await db.question.count({ where: { shopId, active: true } });
  if (active < plan.questions) {
    const extra = await db.question.findMany({
      where: { shopId, active: false },
      orderBy: { volume: { sort: "desc", nulls: "last" } },
      take: plan.questions - active,
      select: { id: true },
    });
    await db.question.updateMany({ where: { id: { in: extra.map((q) => q.id) } }, data: { active: true } });
  } else if (active > plan.questions) {
    const keep = await db.question.findMany({
      where: { shopId, active: true },
      orderBy: { volume: { sort: "desc", nulls: "last" } },
      take: plan.questions,
      select: { id: true },
    });
    await db.question.updateMany({
      where: { shopId, active: true, id: { notIn: keep.map((q) => q.id) } },
      data: { active: false },
    });
  }

  // New paid plan: run a full scan now so fixes and outreach start straight away.
  if (planId !== "free" && shop.onboarding === "done") {
    await startScan(shopId, "baseline").catch((err) => console.error(`[billing] scan after upgrade failed: ${err.message}`));
  }
  return true;
}
