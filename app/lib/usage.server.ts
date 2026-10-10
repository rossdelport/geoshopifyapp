// How much of the plan a shop has used this month.

import db from "../db.server";
import { startOfMonth, type Usage } from "./limits";
import { costThisMonth } from "./cost.server";

export async function getUsageFor(shopId: string): Promise<Usage> {
  const monthStart = startOfMonth();
  const [shop, activeQuestions, fixesThisMonth, guidePagesThisMonth, optimised, outreachThisMonth, cost] = await Promise.all([
    db.shop.findUnique({ where: { id: shopId }, select: { freeScanUsedAt: true } }),
    db.question.count({ where: { shopId, active: true } }),
    db.fix.count({ where: { shopId, createdAt: { gte: monthStart } } }),
    countGuidePagesThisMonth(shopId, monthStart),
    db.product.count({ where: { shopId, optimisedAt: { not: null } } }),
    db.outreachTarget.count({ where: { shopId, createdAt: { gte: monthStart } } }),
    costThisMonth(shopId),
  ]);
  return {
    activeQuestions,
    fixesThisMonth,
    guidePagesThisMonth,
    optimisedProducts: optimised,
    outreachThisMonth,
    freeScanUsed: Boolean(shop?.freeScanUsedAt),
    costThisMonth: cost,
  };
}

/**
 * Guide pages written since the 1st (UTC), whatever the store did with them, except ones we couldn't
 * publish (our Shopify error): those don't use up the month's allowance.
 */
export function countGuidePagesThisMonth(shopId: string, monthStart = startOfMonth()): Promise<number> {
  return db.fix.count({
    where: {
      shopId,
      type: "guide_page",
      createdAt: { gte: monthStart },
      NOT: [{ status: "failed" }, { status: "pending", error: { not: null } }],
    },
  });
}
