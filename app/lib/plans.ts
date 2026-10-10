// Plans, prices and limits. Shared by server and UI. Change limits here only.
// Internal ids stay "core" and "pro" so stored data keeps working; they show as Standard and Done-for-you.

export type PlanId = "free" | "core" | "pro";
export type PaidPlanId = Exclude<PlanId, "free">;
export type BillingCycle = "monthly" | "yearly";
export type Engine = "chatgpt" | "gemini" | "perplexity" | "aio" | "claude";

export const ENGINE_LABELS: Record<Engine, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  aio: "Google AI Overviews",
  claude: "Claude",
};

export interface Plan {
  id: PlanId;
  name: string;
  priceUsd: number; // per month, billed monthly
  priceUsdYearly: number; // per year, billed yearly (3 months free = 9x monthly)
  trialDays: number;
  questions: number;
  engines: Engine[];
  scanEveryDays: number | null; // null = one-time scan only
  runsPerScan: number;
  manualCheckEveryDays: number | null; // an extra "check AI now" (a light scan) at most this often; null = none
  products: number;
  fixesPerMonth: number; // Infinity = unlimited
  guidePagesPerMonth: number;
  outreachPerMonth: number;
  autopilot: boolean; // fixes applied for the store (on by default, the store can switch it off; held: claims, missing facts)
  doneForYou: boolean; // a person handles outreach and the monthly call
  monthlyReport: boolean;
  costCapUsd: number; // stop scheduled work above this monthly data + AI cost
  blurb: string;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free scan",
    priceUsd: 0,
    priceUsdYearly: 0,
    trialDays: 0,
    questions: 10,
    engines: ["chatgpt", "gemini", "perplexity"],
    scanEveryDays: null,
    runsPerScan: 2,
    manualCheckEveryDays: null,
    products: 0,
    fixesPerMonth: 0,
    guidePagesPerMonth: 0,
    outreachPerMonth: 0,
    autopilot: false,
    doneForYou: false,
    monthlyReport: false,
    costCapUsd: 1,
    blurb: "See where you stand today.",
    features: [
      "One scan of 10 buyer questions",
      "ChatGPT, Gemini and Perplexity",
      "Your visibility score and top competitors",
      "AI sales from the last 60 days",
    ],
  },
  core: {
    id: "core",
    name: "Standard",
    priceUsd: 97,
    priceUsdYearly: 873,
    trialDays: 7,
    questions: 50,
    engines: ["chatgpt", "gemini", "perplexity", "aio"],
    scanEveryDays: 7,
    runsPerScan: 2,
    manualCheckEveryDays: 7,
    products: 500,
    fixesPerMonth: Infinity,
    guidePagesPerMonth: 2,
    outreachPerMonth: 10,
    autopilot: false,
    doneForYou: false,
    monthlyReport: true,
    costCapUsd: 15,
    blurb: "You click approve, AI does the rest.",
    features: [
      "50 buyer questions, checked every week",
      "ChatGPT, Gemini, Perplexity and Google AI Overviews",
      "Unlimited fixes, approved in one click",
      "500 products optimised",
      "2 guide pages a month, you approve",
      "Up to 10 outreach pitches a month, drafted",
      "AI sales dashboard and monthly email report",
    ],
  },
  pro: {
    id: "pro",
    name: "Done-for-you",
    priceUsd: 497,
    priceUsdYearly: 4473,
    trialDays: 7,
    questions: 100,
    engines: ["chatgpt", "gemini", "perplexity", "aio", "claude"],
    scanEveryDays: 1,
    runsPerScan: 2,
    manualCheckEveryDays: 3,
    products: 2000,
    fixesPerMonth: Infinity,
    guidePagesPerMonth: 8,
    outreachPerMonth: 40,
    autopilot: true,
    doneForYou: true,
    monthlyReport: true,
    costCapUsd: 150,
    blurb: "AI does the work, and we handle outreach by hand.",
    features: [
      "100 buyer questions, checked every day",
      "Everything in Standard, plus Claude",
      "Fixes applied for you. Ones that need your input wait. Switch off or undo any time",
      "2,000 products optimised",
      "8 guide pages a month, written and published for you",
      "Up to 40 pitches a month sent and followed up for you, including directories and roundups",
      "Monthly report and a 30-minute call",
      "Hand outreach and your call start after the trial",
    ],
  },
};

export const PAID_PLAN_IDS: PaidPlanId[] = ["core", "pro"];

// Shopify Billing plan names (the billing config keys). Shopify shows these to the store, and stored
// subscriptions carry them, so never rename one: add a new name and map the old one below instead.
export const BILLING_PLAN_NAMES = {
  core: { monthly: "GEO Standard", yearly: "GEO Standard yearly" },
  pro: { monthly: "GEO Done-for-you", yearly: "GEO Done-for-you yearly" },
} as const;

export type BillingPlanName = (typeof BILLING_PLAN_NAMES)[PaidPlanId][BillingCycle];

// Names used before the October 2026 pricing (only test subscriptions exist under them).
const LEGACY_BILLING_PLAN_NAMES: Record<string, PaidPlanId> = { "GEO Core": "core", "GEO Pro": "pro" };

export const ALL_BILLING_PLAN_NAMES: BillingPlanName[] = PAID_PLAN_IDS.flatMap((id) => [
  BILLING_PLAN_NAMES[id].monthly,
  BILLING_PLAN_NAMES[id].yearly,
]);

export function billingPlanName(plan: PaidPlanId, cycle: BillingCycle): BillingPlanName {
  return BILLING_PLAN_NAMES[plan][cycle];
}

export function isBillingPlanName(name: unknown): name is BillingPlanName {
  return typeof name === "string" && (ALL_BILLING_PLAN_NAMES as string[]).includes(name);
}

export function planFromBillingName(name: string | null | undefined): PlanId {
  if (!name) return "free";
  for (const id of PAID_PLAN_IDS) {
    if (name === BILLING_PLAN_NAMES[id].monthly || name === BILLING_PLAN_NAMES[id].yearly) return id;
  }
  return LEGACY_BILLING_PLAN_NAMES[name] ?? "free";
}

export function cycleFromBillingName(name: string | null | undefined): BillingCycle | null {
  if (!name || planFromBillingName(name) === "free") return null;
  return PAID_PLAN_IDS.some((id) => BILLING_PLAN_NAMES[id].yearly === name) ? "yearly" : "monthly";
}

/** The price for one billing period: a month, or a year when billed yearly. */
export function planPrice(plan: Plan, cycle: BillingCycle): number {
  return cycle === "yearly" ? plan.priceUsdYearly : plan.priceUsd;
}

/** A yearly price as a rounded monthly figure, shown as "about US$73 a month". */
export function yearlyPerMonth(plan: Plan): number {
  return Math.round(plan.priceUsdYearly / 12);
}

export function formatUsd(n: number): string {
  return `US$${n.toLocaleString("en-AU")}`;
}

export interface SubscriptionLike {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  trialDays: number;
  test?: boolean;
}

/**
 * Of a store's subscriptions, the one that sets its plan (newest active) and any other active ones,
 * which should not exist (Shopify replaces the old one) and are cancelled if they ever do.
 */
export function pickActiveSubscription<T extends SubscriptionLike>(subs: T[]): { active: T | null; extras: T[] } {
  const active = subs
    .filter((s) => s.status === "ACTIVE" && planFromBillingName(s.name) !== "free")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return { active: active[0] ?? null, extras: active.slice(1) };
}

const DAY_MS = 86_400_000;

/** When a subscription's free trial ends (null if it had none). */
export function trialEnd(sub: Pick<SubscriptionLike, "createdAt" | "trialDays"> | null | undefined): Date | null {
  if (!sub?.trialDays) return null;
  const ends = Date.parse(sub.createdAt) + sub.trialDays * DAY_MS;
  return Number.isFinite(ends) ? new Date(ends) : null;
}

/** Free trial days a subscription has left, rounded up (0 once the trial is over). For the on-screen countdown only. */
export function trialDaysLeft(sub: Pick<SubscriptionLike, "createdAt" | "trialDays"> | null | undefined, now = new Date()): number {
  const ends = trialEnd(sub);
  return ends ? Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / DAY_MS)) : 0;
}

/**
 * Trial days for a new subscription. A store gets one free trial: once it has started (trialEndsAt, saved
 * the first time a trial subscription goes live), any new subscription, whether a switch, or after cancelling
 * or reinstalling, only gets the whole days left of it. Rounded down, so switching back and forth can never
 * add a day. Without a saved date, a switch carries over the whole days left on the current subscription.
 */
export function trialDaysForNewSubscription(
  plan: Plan,
  current: Pick<SubscriptionLike, "createdAt" | "trialDays"> | null | undefined,
  now = new Date(),
  trialEndsAt?: Date | null,
): number {
  const ends = trialEndsAt ?? (current ? trialEnd(current) ?? now : null);
  if (!ends) return plan.trialDays;
  return Math.min(plan.trialDays, Math.max(0, Math.floor((ends.getTime() - now.getTime()) / DAY_MS)));
}

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"];
}

/**
 * Light scans (1 run, no Claude) keep costs inside the plan's budget: Done-for-you's daily check and every
 * "check AI now". The weekly scan, the first scan and the scan after an upgrade use 2 runs (+ Claude on
 * Done-for-you), and the reports average them.
 */
export function scanSettings(
  plan: Plan,
  kind: string,
): { engines: Engine[]; runs: number } {
  if (kind === "manual" || (plan.id === "pro" && kind === "daily")) {
    return { engines: plan.engines.filter((e) => e !== "claude"), runs: 1 };
  }
  return { engines: plan.engines, runs: plan.runsPerScan };
}

/** "every week" / "every 3 days", for limits shown in the app. */
export function everyDaysLabel(days: number): string {
  return days === 1 ? "every day" : days === 7 ? "every week" : `every ${days} days`;
}

/** Plan rank, so a plan change can tell an upgrade from a downgrade. */
export function planRank(id: PlanId): number {
  return PLANS[id] ? (["free", "core", "pro"] as PlanId[]).indexOf(id) : 0;
}

export function limitLabel(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-AU") : "Unlimited";
}

export interface PlanChoice {
  plan: PaidPlanId;
  cycle: BillingCycle;
}

/** A plan picked on the website (?plan=pro&cycle=yearly), or null if it isn't one we sell. */
export function parsePlanChoice(plan: unknown, cycle: unknown): PlanChoice | null {
  if (typeof plan !== "string" || !(PAID_PLAN_IDS as string[]).includes(plan)) return null;
  return { plan: plan as PaidPlanId, cycle: cycle === "yearly" ? "yearly" : "monthly" };
}

/** "my-store", "my-store.myshopify.com" or "https://my-store.myshopify.com/admin" to "my-store.myshopify.com". */
export function myshopifyDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const host = raw.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0];
  const domain = host.includes(".") ? host : `${host}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : null;
}
