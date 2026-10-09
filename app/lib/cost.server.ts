import db from "../db.server";

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

/** Log what an outside call cost, and add it to the shop's monthly total. */
export async function recordCost(
  shopId: string | null | undefined,
  provider: string,
  endpoint: string,
  usd: number,
) {
  if (!usd) return;
  await db.apiCost.create({ data: { shopId: shopId ?? null, provider, endpoint, usd } });
  if (!shopId) return;
  const month = monthKey();
  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { costMonth: true } });
  if (!shop) return;
  if (shop.costMonth !== month) {
    await db.shop.update({
      where: { id: shopId },
      data: { costMonth: month, costThisMonth: usd, costAlertedAt: null },
    });
  } else {
    await db.shop.update({ where: { id: shopId }, data: { costThisMonth: { increment: usd } } });
  }
}

export async function costThisMonth(shopId: string): Promise<number> {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { costMonth: true, costThisMonth: true },
  });
  if (!shop || shop.costMonth !== monthKey()) return 0;
  return shop.costThisMonth;
}
