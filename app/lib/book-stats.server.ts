// Saving and counting visits to firstpicked.com.au/book and calls booked there, by ad (the chart on the admin Overview).
// The rules (ad names, per day, per ad) are in book-stats.ts. No names, emails or IP addresses are kept.

import { createHash } from "node:crypto";
import db from "../db.server";
import { clientIp, hashIp } from "./public-form.server";
import { daysBetween, sydneyDay } from "./admin.server";
import { summarise, type AdTags, type BookStats } from "./book-stats";
import { SALES } from "./booking";

const DAY = 86_400_000;

/** A scrambled id for this person (their IP and browser, hashed with a secret key), only to count them once a day. */
export function visitorId(request: Request): string {
  const browser = (request.headers.get("user-agent") ?? "").slice(0, 300);
  return createHash("sha256").update(`${hashIp(clientIp(request))}|${browser}`).digest("hex").slice(0, 32);
}

/** The book page was on someone's screen. Saved once per person per day (Sydney days, like the rest of the admin area). */
export async function saveBookView(tags: AdTags, visitor: string, now = new Date()): Promise<boolean> {
  const last = await db.bookEvent.findFirst({
    where: { kind: "view", visitor, createdAt: { gte: new Date(now.getTime() - DAY) } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && sydneyDay(0, last.createdAt) === sydneyDay(0, now)) return false;
  await db.bookEvent.create({ data: { kind: "view", visitor, ...tags, createdAt: now } });
  return true;
}

/**
 * Someone answered the two questions above the times (Ross, 6 Nov 2026). One row a person a day (Sydney days): if
 * they change their answers, the row is changed, so each person counts once, under their last answers. "No" to
 * Shopify keeps no sales answer (the drop-down hides). Nothing is saved without an answer.
 */
export async function saveAnswers(tags: AdTags, visitor: string, raw: { shopify: unknown; sales: unknown }, now = new Date()): Promise<boolean> {
  const shopify = raw.shopify === "yes" || raw.shopify === "no" ? raw.shopify : null;
  const sales = shopify !== "no" && SALES.some((s) => s.value === raw.sales) ? String(raw.sales) : null;
  if (!shopify && !sales) return false;
  const last = await db.bookEvent.findFirst({
    where: { kind: "answered", visitor, createdAt: { gte: new Date(now.getTime() - DAY) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  if (last && sydneyDay(0, last.createdAt) === sydneyDay(0, now)) await db.bookEvent.update({ where: { id: last.id }, data: { shopify, sales } });
  else await db.bookEvent.create({ data: { kind: "answered", visitor, ...tags, shopify, sales, createdAt: now } });
  return true;
}

/** A call was booked: which ad it came from and how much the store sells a month (they said yes to Shopify). */
export async function saveBooking(tags: AdTags, sales: string, now = new Date()): Promise<void> {
  await db.bookEvent.create({ data: { kind: "booked", ...tags, shopify: "yes", sales, createdAt: now } });
}

/** The chart's numbers for these Sydney days (YYYY-MM-DD, from and to included). */
export async function bookStats(from: string, to: string): Promise<BookStats> {
  // A day either side (in UTC) covers every Sydney day asked for; summarise leaves out the rest.
  const rows = await db.bookEvent.findMany({
    where: { createdAt: { gte: new Date(Date.parse(from) - DAY), lt: new Date(Date.parse(to) + 2 * DAY) } },
    select: { kind: true, utmSource: true, utmCampaign: true, utmContent: true, fbclid: true, referrer: true, shopify: true, sales: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 200_000,
  });
  return summarise(
    rows.map((r) => ({ ...r, day: sydneyDay(0, r.createdAt) })),
    daysBetween(from, to),
  );
}
