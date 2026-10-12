// How long we keep data. The privacy page (/privacy) shows the same numbers.

import { createHash } from "node:crypto";
import db from "../db.server";

export const RETENTION = {
  /** The hashed browser id on an AI visit is only for de-duplication; we drop it after this. */
  visitIdDays: 90,
  /** Safety net: Shopify's shop/redact webhook normally deletes everything 48 hours after uninstall. */
  uninstalledDays: 30,
  /** Free product checks from the public home page (link, what we read, AI answers). */
  publicCheckDays: 30,
  /** The hashed IP on a free check (and on a report email) only enforces the daily limits, so it goes after a day. */
  checkIpHours: 24,
  /** Each emailed copy of a free check's report (address, check, sent or not), for the sending limits. */
  reportEmailDays: 90,
  /** Someone who unsubscribed from the free check emails: their address goes this long after (counted from their last request). */
  unsubscribedDays: 30,
  /** An address with no report request or email click for this long is deleted too. */
  inactiveSubscriberMonths: 24,
  /** Waitlist signups (name, email, where they came from): deleted this long after they first joined. */
  waitlistMonths: 24,
};

/**
 * The suppression list's code for an address: sha256 with a fixed prefix, no secret on purpose, so the list
 * survives key changes and a new deploy still recognises every address that opted out. It holds no address.
 */
export const suppressionHash = (email: string) => createHash("sha256").update(`geo:suppress:${email.trim().toLowerCase()}`).digest("hex");

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
  const reportEmails = await db.reportEmail.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - RETENTION.reportEmailDays * DAY) } },
  });
  const reportEmailIps = await db.reportEmail.updateMany({
    where: { ipHash: { not: null }, createdAt: { lt: new Date(now.getTime() - RETENTION.checkIpHours * 3_600_000) } },
    data: { ipHash: null },
  });
  // Subscribers are kept until 30 days after they unsubscribe (counted from their last request, so a
  // report someone asked for after unsubscribing still goes out), or 24 months after their last request
  // or click. Their report email records go with them. Addresses that opted out are kept only as a hash
  // (EmailSuppression), so nothing can email them tips again by mistake.
  const stale = await db.subscriber.findMany({
    where: {
      OR: [
        { unsubscribedAt: { lt: new Date(now.getTime() - RETENTION.unsubscribedDays * DAY) }, lastActiveAt: { lt: new Date(now.getTime() - RETENTION.unsubscribedDays * DAY) } },
        { lastActiveAt: { lt: new Date(now.getTime() - RETENTION.inactiveSubscriberMonths * 30.44 * DAY) } },
      ],
    },
    select: { id: true, email: true, unsubscribedAt: true },
    take: 1000,
  });
  if (stale.length) {
    const optedOut = stale.filter((x) => x.unsubscribedAt).map((x) => ({ emailHash: suppressionHash(x.email) }));
    if (optedOut.length) await db.emailSuppression.createMany({ data: optedOut, skipDuplicates: true });
    await db.reportEmail.deleteMany({ where: { email: { in: stale.map((x) => x.email) } } });
    await db.subscriber.deleteMany({ where: { id: { in: stale.map((x) => x.id) } } });
  }
  const subscribers = { count: stale.length };
  // Waitlist: the hashed IP only enforces the daily limit, so it goes after a day; the signup 24 months after it
  // was made (createdAt: clearing the IP moves updatedAt).
  await db.waitlistSignup.updateMany({
    where: { ipHash: { not: null }, updatedAt: { lt: new Date(now.getTime() - RETENTION.checkIpHours * 3_600_000) } },
    data: { ipHash: null },
  });
  const waitlist = await db.waitlistSignup.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - RETENTION.waitlistMonths * 30.44 * DAY) } },
  });
  if (visits.count || shops.count || checks.count || reportEmails.count || subscribers.count) {
    console.log(
      `[retention] cleared ${visits.count} old visit ids, deleted ${shops.count} uninstalled shops, ${checks.count} free checks, ${reportEmails.count} report emails and ${subscribers.count} unsubscribed or inactive addresses`,
    );
  }
  return {
    visitIds: visits.count,
    shops: shops.count,
    publicChecks: checks.count,
    checkIps: checkIps.count,
    reportEmails: reportEmails.count,
    reportEmailIps: reportEmailIps.count,
    subscribers: subscribers.count,
    waitlist: waitlist.count,
  };
}
