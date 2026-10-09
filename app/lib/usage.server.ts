// How much of the plan a shop has used this month.

import db from "../db.server";
import { startOfMonth, type Usage } from "./limits";
import { costThisMonth } from "./cost.server";

export async function getUsageFor(shopId: string): Promise<Usage> {
  const monthStart = startOfMonth();
  const [shop, activeQuestions, fixesThisMonth, optimised, outreachThisMonth, cost] = await Promise.all([
    db.shop.findUnique({ where: { id: shopId }, select: { freeScanUsedAt: true } }),
    db.question.count({ where: { shopId, active: true } }),
    db.fix.count({ where: { shopId, createdAt: { gte: monthStart } } }),
    db.product.count({ where: { shopId, optimisedAt: { not: null } } }),
    db.outreachTarget.count({ where: { shopId, createdAt: { gte: monthStart } } }),
    costThisMonth(shopId),
  ]);
  return {
    activeQuestions,
    fixesThisMonth,
    optimisedProducts: optimised,
    outreachThisMonth,
    freeScanUsed: Boolean(shop?.freeScanUsedAt),
    costThisMonth: cost,
  };
}
