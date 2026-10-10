// How long we keep data. The privacy page (/privacy) shows the same numbers.

import db from "../db.server";

export const RETENTION = {
  /** The hashed browser id on an AI visit is only for de-duplication; we drop it after this. */
  visitIdDays: 90,
  /** Safety net: Shopify's shop/redact webhook normally deletes everything 48 hours after uninstall. */
  uninstalledDays: 30,
  /** Free product checks from the public home page (link, what we read, AI answers). */
  publicCheckDays: 30,
  /** The hashed IP on a free check only enforces the daily limit, so it goes after a day. */
  checkIpHours: 24,
};

const DAY = 86_400_000;

export async function purgeOldData(now = new Date()) {
  const visits = await db.aiSession.updateMany({
    where: { clientKey: { not: null }, occurredAt: { lt: new Date(now.getTime() - RETENTION.visitIdDays * DAY) } },
    data: { clientKey: null },
  });
  const shops = await db.shop.deleteMany({
    where: { status: "uninstalled", uninstalledAt: { lt: new Date(now.getTime() - RETENTION.uninstalledDays * DAY) } },
  });
  const checks = await db.publicCheck.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - RETENTION.publicCheckDays * DAY) } },
  });
  const checkIps = await db.publicCheck.updateMany({
    where: { ipHash: { not: null }, createdAt: { lt: new Date(now.getTime() - RETENTION.checkIpHours * 3_600_000) } },
    data: { ipHash: null },
  });
  if (visits.count || shops.count || checks.count) {
    console.log(
      `[retention] cleared ${visits.count} old visit ids, deleted ${shops.count} uninstalled shops and ${checks.count} free checks`,
    );
  }
  return { visitIds: visits.count, shops: shops.count, publicChecks: checks.count, checkIps: checkIps.count };
}
