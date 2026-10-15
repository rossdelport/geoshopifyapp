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
  const month = monthKey();
  // The log row and the shop's running total in one round trip. The total update is one statement, so calls that
  // land at the same time can't overwrite each other; a new month starts the total again.
  await Promise.all([
    db.apiCost.create({ data: { shopId: shopId ?? null, provider, endpoint, usd } }),
    shopId
      ? db.$executeRaw`
          UPDATE "Shop"
          SET "costThisMonth" = CASE WHEN "costMonth" = ${month} THEN "costThisMonth" + ${usd}::float8 ELSE ${usd}::float8 END,
              "costAlertedAt" = CASE WHEN "costMonth" = ${month} THEN "costAlertedAt" ELSE NULL END,
              "costMonth" = ${month}
          WHERE id = ${shopId}`
      : null,
  ]);
}

export async function costThisMonth(shopId: string): Promise<number> {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { costMonth: true, costThisMonth: true },
  });
  if (!shop || shop.costMonth !== monthKey()) return 0;
  return shop.costThisMonth;
}
