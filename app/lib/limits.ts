// Plan limit checks. Pure functions (tested); the callers count usage from the database.

import type { Plan } from "./plans";

export interface Usage {
  activeQuestions: number;
  fixesThisMonth: number;
  guidePagesThisMonth: number; // guide pages written this calendar month (any status except failed to publish)
  optimisedProducts: number;
  outreachThisMonth: number;
  freeScanUsed: boolean;
  costThisMonth: number;
}

export function remainingFixes(plan: Plan, usage: Usage): number {
  return Math.max(0, plan.fixesPerMonth - usage.fixesThisMonth);
}

/** Guide pages count when we write them, so a skipped guide still uses the month's allowance (it cost AI time). */
export function remainingGuidePages(plan: Plan, usage: Usage): number {
  return Math.max(0, plan.guidePagesPerMonth - usage.guidePagesThisMonth);
}

export function remainingOutreach(plan: Plan, usage: Usage): number {
  return Math.max(0, plan.outreachPerMonth - usage.outreachThisMonth);
}

export function canTrackMoreQuestions(plan: Plan, usage: Usage): boolean {
  return usage.activeQuestions < plan.questions;
}

/** A product counts once, the first time we change it. Already-optimised products stay editable. */
export function canOptimiseProduct(plan: Plan, usage: Usage, alreadyOptimised: boolean): boolean {
  return alreadyOptimised || usage.optimisedProducts < plan.products;
}

/**
 * Whether a scan may start. Every scan a paid store starts (scheduled, "check AI now", after an upgrade)
 * enforces the monthly cost cap; only the one-time free scan at onboarding skips it.
 */
export function canRunScan(plan: Plan, usage: Usage, enforceCap: boolean): { ok: boolean; reason?: string } {
  if (plan.id === "free" && usage.freeScanUsed) {
    return { ok: false, reason: "Your free scan is used. Start a plan to keep tracking." };
  }
  if (enforceCap && usage.costThisMonth >= plan.costCapUsd) {
    return { ok: false, reason: "This month's data budget is used up. Scans start again next month." };
  }
  return { ok: true };
}

/** "Check AI now": a light scan, at most once per plan.manualCheckEveryDays, inside the cost cap. */
export function canRunManualCheck(
  plan: Plan,
  usage: Usage,
  lastManualAt: Date | null | undefined,
  now = new Date(),
): { ok: boolean; reason?: string } {
  if (!plan.manualCheckEveryDays) return { ok: false, reason: "Start a plan to run more scans." };
  const cap = canRunScan(plan, usage, true);
  if (!cap.ok) return cap;
  // An hour of slack, so "once a week" doesn't mean waiting until the exact minute.
  const gap = plan.manualCheckEveryDays * 86_400_000 - 3_600_000;
  if (lastManualAt && now.getTime() - lastManualAt.getTime() < gap) {
    const every = plan.manualCheckEveryDays === 7 ? "a week" : `every ${plan.manualCheckEveryDays} days`;
    return { ok: false, reason: `You can run one extra check ${every}. Your scheduled scans keep running.` };
  }
  return { ok: true };
}

/**
 * Done-for-you promises its monthly guide pages, so once the month's pace is behind (fewer written than
 * the share of the month gone), the next round of fixes asks for exactly one guide.
 */
export function guidePageDue(plan: Plan, usage: Usage, now = new Date()): boolean {
  if (!plan.doneForYou || remainingGuidePages(plan, usage) <= 0) return false;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return usage.guidePagesThisMonth < Math.ceil((now.getUTCDate() / daysInMonth) * plan.guidePagesPerMonth);
}

export const startOfMonth = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
