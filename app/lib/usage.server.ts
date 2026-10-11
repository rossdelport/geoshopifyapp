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
    // Pages that already name the store (status "named") are kept aside, not outreach: same count as outreachUsedThisMonth().
    db.outreachTarget.count({ where: { shopId, createdAt: { gte: monthStart }, NOT: { status: "named" } } }),
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
 * publish (our Shopify error): those don't use up the month's allowance. Refreshes of guides already
 * live (the freshness cycle) are updates, not new pages, so they don't count either.
 */
export function countGuidePagesThisMonth(shopId: string, monthStart = startOfMonth()): Promise<number> {
  return db.fix.count({
    where: {
      shopId,
      type: "guide_page",
      refreshOfId: null,
      createdAt: { gte: monthStart },
      NOT: [{ status: "failed" }, { status: "pending", error: { not: null } }],
    },
  });
}
