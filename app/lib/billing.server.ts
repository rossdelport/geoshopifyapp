// Keep the shop's plan in sync and kick off the right work when it changes.

import db from "../db.server";
import {
  cycleFromBillingName,
  getPlan,
  pickActiveSubscription,
  planFromBillingName,
  planRank,
  trialEnd,
  type PlanId,
  type SubscriptionLike,
} from "./plans";
import { startScan } from "./scan.server";
import { emailConfigured, sendEmail } from "./email.server";
import { env } from "./env.server";
import { enqueue, registerJob } from "./jobs.server";
import { canRunScan } from "./limits";
import { getUsageFor } from "./usage.server";
import { gql, type AdminClient } from "./shopify-gql.server";

const ACTIVE_SUBSCRIPTIONS = `#graphql
  query ActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions { id name status test trialDays createdAt }
    }
  }`;

/** The store's live subscriptions to this app, straight from Shopify (test ones only in test billing mode). */
export async function activeSubscriptions(admin: AdminClient): Promise<SubscriptionLike[]> {
  const data = await gql<{ currentAppInstallation: { activeSubscriptions: SubscriptionLike[] } | null }>(admin, ACTIVE_SUBSCRIPTIONS);
  return (data.currentAppInstallation?.activeSubscriptions ?? []).filter((s) => env.billingTest || !s.test);
}

/**
 * A store gets one free trial. Save when it ends the first time a subscription with a trial is live, so a
 * later subscription (after cancelling, reinstalling or switching) never starts a new one. Never moved.
 */
export async function recordTrialStart(shopId: string, sub: SubscriptionLike | null | undefined) {
  const ends = trialEnd(sub);
  if (!ends) return;
  await db.shop.updateMany({ where: { id: shopId, trialEndsAt: null }, data: { trialEndsAt: ends } });
}

/** Set the shop's plan from whichever subscription Shopify says is live now (free if none). */
export async function syncPlanFromSubscriptions(shopId: string, subs: SubscriptionLike[]) {
  const { active } = pickActiveSubscription(subs);
  await recordTrialStart(shopId, active);
  return onPlanChanged(shopId, planFromBillingName(active?.name), { billingName: active?.name, trialEndsAt: trialEnd(active) });
}

const DAY = 86_400_000;

export async function onPlanChanged(
  shopId: string,
  planId: PlanId,
  opts: { billingName?: string | null; trialEndsAt?: Date | null } = {},
) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  if (shop.plan === planId) return false;
  const plan = getPlan(planId);
  // Compare and swap: the plans page and the billing webhook can report the same change at once,
  // and only one of them should run the follow-up work below.
  const claimed = await db.shop.updateMany({
    where: { id: shopId, plan: shop.plan },
    // Done-for-you applies fixes for the store unless it has switched that off; other plans never do.
    data: { plan: planId, autopilot: plan.autopilot && !shop.autopilotOptOut },
  });
  if (!claimed.count) return false;

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

  // Done-for-you has human parts (outreach by hand, the monthly call): tell the founder.
  if (planId === "pro" || shop.plan === "pro") {
    await notifyFounder(shop, shop.plan as PlanId, planId, {
      billingName: opts.billingName ?? null,
      trialEndsAt: opts.trialEndsAt ?? shop.trialEndsAt,
    });
  }

  // Upgrades only: run a full scan now (Claude too on Done-for-you) so fixes and outreach start straight
  // away. Never on a downgrade, never over the month's cost cap, and at most once a day, so switching
  // back and forth can't run up full scans.
  const scanNow = planRank(planId) > planRank(shop.plan as PlanId) && shop.onboarding === "done";
  const total = await db.question.count({ where: { shopId } });
  if (total > 0 && total < plan.questions) {
    // Fewer questions written than the plan tracks: write more (keeping every existing one), and that
    // job starts the upgrade scan once they're in.
    await enqueue("questions.topup", { scan: scanNow }, { shopId, dedupeKey: `questions-topup:${shopId}` });
  } else if (scanNow) {
    await startUpgradeScan(shopId);
  }

  if (plan.autopilot && !shop.autopilotOptOut && shop.onboarding === "done") {
    await enqueue("fixes.autopilot", {}, { shopId, dedupeKey: `autopilot:${shopId}` });
  }
  return true;
}

/** The full scan after an upgrade, inside the cost cap and at most once a day. */
export async function startUpgradeScan(shopId: string) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const plan = getPlan(shop.plan);
  if (plan.id === "free" || !canRunScan(plan, await getUsageFor(shopId), true).ok) return null;
  const recent = await db.scan.findFirst({
    where: { shopId, kind: "baseline", startedAt: { gte: new Date(Date.now() - DAY) } },
  });
  if (recent) return null;
  return startScan(shopId, "baseline").catch((err) => {
    console.error(`[billing] scan after upgrade failed: ${err.message}`);
    return null;
  });
}

// ---------- Telling the founder about Done-for-you stores ----------

interface FounderNotice {
  store: string;
  email: string | null;
  country: string;
  from: PlanId;
  to: PlanId;
  billingName: string | null;
  trialEndsAt: string | null; // ISO
  reason: string | null; // e.g. "app uninstalled"
}

/**
 * A store started or left Done-for-you. The founder or a VA does the hand outreach and the monthly call,
 * so this must never go missing: it is queued as a job (retried, and kept in the jobs table as a record),
 * which emails GEO_ALERT_EMAIL. If email isn't set up the job fails loudly instead of skipping.
 */
export async function notifyFounder(
  shop: { id: string; domain: string; name: string | null; email: string | null; country: string },
  from: PlanId,
  to: PlanId,
  opts: { billingName?: string | null; trialEndsAt?: Date | null; reason?: string } = {},
) {
  const notice: FounderNotice = {
    store: shop.name ? `${shop.name} (${shop.domain})` : shop.domain,
    email: shop.email,
    country: shop.country,
    from,
    to,
    billingName: opts.billingName ?? null,
    trialEndsAt: opts.trialEndsAt ? opts.trialEndsAt.toISOString() : null,
    reason: opts.reason ?? null,
  };
  if (!env.alertEmail || !emailConfigured()) {
    console.error(
      `[billing] NOBODY TOLD: ${notice.store} moved from ${getPlan(from).name} to ${getPlan(to).name}. Set GEO_ALERT_EMAIL, RESEND_API_KEY and GEO_EMAIL_FROM. The founder.notice job will keep this as a failed job.`,
    );
  }
  await enqueue("founder.notice", notice as unknown as Record<string, string>, { shopId: shop.id });
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const longDate = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** The founder email for a notice (exported for tests). */
export function founderEmail(n: FounderNotice, now = new Date()): { subject: string; html: string } {
  const starting = n.to === "pro";
  const cycle = cycleFromBillingName(n.billingName);
  const trialEnds = n.trialEndsAt ? new Date(n.trialEndsAt) : null;
  const inTrial = Boolean(trialEnds && trialEnds.getTime() > now.getTime());
  const lines = [
    `<b>Store:</b> ${esc(n.store)}`,
    `<b>Contact email:</b> ${esc(n.email ?? "not known")}`,
    `<b>Country:</b> ${esc(n.country)}`,
    `<b>Plan:</b> ${esc(getPlan(n.from).name)} to ${esc(getPlan(n.to).name)}${starting && cycle ? `, billed ${cycle}` : ""}${n.reason ? ` (${esc(n.reason)})` : ""}`,
  ];
  if (starting) lines.push(`<b>Free trial:</b> ${inTrial ? `ends ${esc(longDate(trialEnds!))}` : "none left, so they are paying now"}`);
  const next = !starting
    ? "<p>Next: stop any outreach you are sending for them and cancel their monthly call.</p>"
    : inTrial
      ? `<p>Next: wait for the first charge. Start the directory and roundup outreach (up to 40 pitches a month) and book their 30-minute call after the trial ends on ${esc(longDate(trialEnds!))}. If they cancel before then, there is nothing to do.</p>`
      : "<p>Next: book their 30-minute call and start the directory and roundup outreach (up to 40 pitches a month).</p>";
  const subject = starting ? `New Done-for-you store: ${n.store}` : `Store left Done-for-you: ${n.store}`;
  return { subject, html: `<p>${lines.join("<br>")}</p>${next}` };
}

registerJob("founder.notice", async (job) => {
  const notice = job.payload as unknown as FounderNotice;
  if (!env.alertEmail || !emailConfigured()) {
    throw new Error(`Nobody was told about ${notice.store} (${notice.from} to ${notice.to}): GEO_ALERT_EMAIL or email is not set up`);
  }
  const { subject, html } = founderEmail(notice);
  await sendEmail([env.alertEmail], subject, html);
});
