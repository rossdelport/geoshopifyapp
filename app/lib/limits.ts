// Plan limit checks. Pure functions (tested); the callers count usage from the database.

import type { Plan } from "./plans";

export interface Usage {
  activeQuestions: number;
  fixesThisMonth: number;
  optimisedProducts: number;
  outreachThisMonth: number;
  freeScanUsed: boolean;
  costThisMonth: number;
}

export function remainingFixes(plan: Plan, usage: Usage): number {
  return Math.max(0, plan.fixesPerMonth - usage.fixesThisMonth);
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

export function canRunScan(plan: Plan, usage: Usage, scheduled: boolean): { ok: boolean; reason?: string } {
  if (plan.id === "free" && usage.freeScanUsed) {
    return { ok: false, reason: "Your free scan is used. Start a plan to keep tracking." };
  }
  if (scheduled && usage.costThisMonth >= plan.costCapUsd) {
    return { ok: false, reason: "Monthly data budget reached; scans resume next month." };
  }
  return { ok: true };
}

export const startOfMonth = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
