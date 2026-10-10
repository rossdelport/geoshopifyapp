// Plans, prices and Shopify Billing config (pricing decided by Ross on 2026-10-10).

import { describe, expect, it } from "vitest";
import { BillingInterval, BillingReplacementBehavior } from "@shopify/shopify-app-react-router/server";
import { BILLING_CONFIG } from "../app/lib/billing-config.server";
import {
  ALL_BILLING_PLAN_NAMES,
  BILLING_PLAN_NAMES,
  PLANS,
  billingPlanName,
  cycleFromBillingName,
  formatUsd,
  getPlan,
  everyDaysLabel,
  isBillingPlanName,
  myshopifyDomain,
  parsePlanChoice,
  pickActiveSubscription,
  planFromBillingName,
  planPrice,
  planRank,
  trialDaysForNewSubscription,
  trialDaysLeft,
  trialEnd,
  yearlyPerMonth,
} from "../app/lib/plans";

const DAY = 86_400_000;

describe("plans", () => {
  it("keeps the internal ids and shows the new names", () => {
    expect(PLANS.core.name).toBe("Standard");
    expect(PLANS.pro.name).toBe("Done-for-you");
    expect(PLANS.free.name).toBe("Free scan");
    expect(getPlan("core")).toBe(PLANS.core);
    expect(getPlan("pro")).toBe(PLANS.pro);
    expect(getPlan("nonsense")).toBe(PLANS.free);
    expect(getPlan(null)).toBe(PLANS.free);
  });

  it("has Standard's prices and limits", () => {
    expect(PLANS.core).toMatchObject({
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
    });
  });

  it("has Done-for-you's prices and limits", () => {
    expect(PLANS.pro).toMatchObject({
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
    });
  });

  it("keeps the free scan as it was", () => {
    expect(PLANS.free).toMatchObject({
      priceUsd: 0,
      trialDays: 0,
      questions: 10,
      engines: ["chatgpt", "gemini", "perplexity"],
      scanEveryDays: null,
      manualCheckEveryDays: null,
      products: 0,
      fixesPerMonth: 0,
      guidePagesPerMonth: 0,
      outreachPerMonth: 0,
      autopilot: false,
    });
  });

  it("prices yearly at 9 months (3 months free) and shows a rounded monthly figure", () => {
    for (const plan of [PLANS.core, PLANS.pro]) expect(plan.priceUsdYearly).toBe(plan.priceUsd * 9);
    expect(yearlyPerMonth(PLANS.core)).toBe(73);
    expect(yearlyPerMonth(PLANS.pro)).toBe(373);
    expect(planPrice(PLANS.core, "monthly")).toBe(97);
    expect(planPrice(PLANS.pro, "yearly")).toBe(4473);
    expect(formatUsd(4473)).toBe("US$4,473");
    expect(formatUsd(97)).toBe("US$97");
  });

  it("never promises an exact outreach count, and says when hand work starts", () => {
    expect(PLANS.core.features.join("\n")).toContain("Up to 10 outreach pitches a month");
    expect(PLANS.pro.features.join("\n")).toContain("Up to 40 pitches a month");
    expect(PLANS.pro.features).toContain("Hand outreach and your call start after the trial");
    for (const f of [...PLANS.core.features, ...PLANS.pro.features]) expect(f).not.toMatch(/^\d+ (outreach|pitches)/);
  });

  it("ranks plans and labels intervals", () => {
    expect(planRank("free")).toBeLessThan(planRank("core"));
    expect(planRank("core")).toBeLessThan(planRank("pro"));
    expect(everyDaysLabel(7)).toBe("every week");
    expect(everyDaysLabel(3)).toBe("every 3 days");
    expect(everyDaysLabel(1)).toBe("every day");
  });

  it("never uses an em dash or a spaced en dash in plan copy", () => {
    const copy = Object.values(PLANS).flatMap((p) => [p.name, p.blurb, ...p.features]).join("\n");
    expect(copy).not.toMatch(/\u2014| \u2013 /);
  });
});

describe("billing plan names", () => {
  it("has four stable names", () => {
    expect(BILLING_PLAN_NAMES).toEqual({
      core: { monthly: "GEO Standard", yearly: "GEO Standard yearly" },
      pro: { monthly: "GEO Done-for-you", yearly: "GEO Done-for-you yearly" },
    });
    expect(ALL_BILLING_PLAN_NAMES).toHaveLength(4);
    expect(billingPlanName("pro", "yearly")).toBe("GEO Done-for-you yearly");
  });

  it("maps every name, old and new, to a plan and a cycle", () => {
    expect(planFromBillingName("GEO Standard")).toBe("core");
    expect(planFromBillingName("GEO Standard yearly")).toBe("core");
    expect(planFromBillingName("GEO Done-for-you")).toBe("pro");
    expect(planFromBillingName("GEO Done-for-you yearly")).toBe("pro");
    // Names from before the new pricing (test subscriptions).
    expect(planFromBillingName("GEO Core")).toBe("core");
    expect(planFromBillingName("GEO Pro")).toBe("pro");
    expect(planFromBillingName("Something else")).toBe("free");
    expect(planFromBillingName("")).toBe("free");
    expect(planFromBillingName(null)).toBe("free");
    expect(planFromBillingName(undefined)).toBe("free");

    expect(cycleFromBillingName("GEO Standard")).toBe("monthly");
    expect(cycleFromBillingName("GEO Standard yearly")).toBe("yearly");
    expect(cycleFromBillingName("GEO Done-for-you yearly")).toBe("yearly");
    expect(cycleFromBillingName("GEO Core")).toBe("monthly");
    expect(cycleFromBillingName("Something else")).toBeNull();
    expect(cycleFromBillingName(null)).toBeNull();
  });

  it("only accepts the four current names from the plans page", () => {
    for (const name of ALL_BILLING_PLAN_NAMES) expect(isBillingPlanName(name)).toBe(true);
    expect(isBillingPlanName("GEO Core")).toBe(false);
    expect(isBillingPlanName("GEO Pro")).toBe(false);
    expect(isBillingPlanName(null)).toBe(false);
    expect(isBillingPlanName("free")).toBe(false);
  });
});

describe("Shopify billing config", () => {
  it("has exactly the four plans with the right amounts, intervals and trial", () => {
    expect(Object.keys(BILLING_CONFIG).sort()).toEqual([...ALL_BILLING_PLAN_NAMES].sort());
    const expected = {
      "GEO Standard": [97, BillingInterval.Every30Days],
      "GEO Standard yearly": [873, BillingInterval.Annual],
      "GEO Done-for-you": [497, BillingInterval.Every30Days],
      "GEO Done-for-you yearly": [4473, BillingInterval.Annual],
    } as const;
    for (const [name, [amount, interval]] of Object.entries(expected)) {
      const plan = BILLING_CONFIG[name as keyof typeof BILLING_CONFIG];
      expect(plan.trialDays).toBe(7);
      expect(plan.lineItems).toEqual([{ amount, currencyCode: "USD", interval }]);
    }
  });

  it("replaces the old subscription straight away, so a store never has two", () => {
    for (const plan of Object.values(BILLING_CONFIG)) {
      expect(plan.replacementBehavior).toBe(BillingReplacementBehavior.ApplyImmediately);
    }
  });
});

describe("subscriptions and trials", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  const sub = (name: string, createdAt: string, extra: Partial<{ status: string; trialDays: number }> = {}) => ({
    id: `gid://shopify/AppSubscription/${name}-${createdAt}`,
    name,
    status: "ACTIVE",
    trialDays: 7,
    createdAt,
    ...extra,
  });

  it("picks the newest active GEO subscription and flags any others", () => {
    const old = sub("GEO Standard", "2026-09-01T00:00:00Z");
    const fresh = sub("GEO Standard yearly", "2026-10-09T00:00:00Z");
    const cancelled = sub("GEO Done-for-you", "2026-10-10T00:00:00Z", { status: "CANCELLED" });
    const other = sub("Some other charge", "2026-10-10T01:00:00Z");
    const { active, extras } = pickActiveSubscription([old, cancelled, fresh, other]);
    expect(active).toBe(fresh);
    expect(extras).toEqual([old]);
    expect(pickActiveSubscription([])).toEqual({ active: null, extras: [] });
    expect(pickActiveSubscription([cancelled]).active).toBeNull();
  });

  it("counts trial days left", () => {
    expect(trialDaysLeft(sub("GEO Standard", "2026-10-10T11:00:00Z"), now)).toBe(7);
    expect(trialDaysLeft(sub("GEO Standard", new Date(now.getTime() - 2.5 * DAY).toISOString()), now)).toBe(5);
    expect(trialDaysLeft(sub("GEO Standard", "2026-09-01T00:00:00Z"), now)).toBe(0);
    expect(trialDaysLeft(sub("GEO Standard", "2026-10-10T11:00:00Z", { trialDays: 0 }), now)).toBe(0);
    expect(trialDaysLeft(null, now)).toBe(0);
  });

  it("gives a new store the full trial, and carries over the whole days left when switching", () => {
    expect(trialDaysForNewSubscription(PLANS.core, null, now)).toBe(7);
    expect(trialDaysForNewSubscription(PLANS.pro, undefined, now)).toBe(7);
    const midTrial = sub("GEO Standard", new Date(now.getTime() - 3 * DAY).toISOString());
    expect(trialDaysForNewSubscription(PLANS.core, midTrial, now)).toBe(4);
    expect(trialDaysForNewSubscription(PLANS.pro, midTrial, now)).toBe(4);
    // 4.5 days left: only the 4 whole days carry over (the countdown on screen still says 5).
    const halfDay = sub("GEO Standard", new Date(now.getTime() - 2.5 * DAY).toISOString());
    expect(trialDaysForNewSubscription(PLANS.core, halfDay, now)).toBe(4);
    expect(trialDaysLeft(halfDay, now)).toBe(5);
    // Already paying: switching plan or monthly/yearly doesn't start a new free week.
    expect(trialDaysForNewSubscription(PLANS.pro, sub("GEO Standard", "2026-08-01T00:00:00Z"), now)).toBe(0);
    expect(trialDaysForNewSubscription(PLANS.pro, sub("GEO Standard", "2026-08-01T00:00:00Z", { trialDays: 0 }), now)).toBe(0);
  });

  it("never stretches the trial when a store switches monthly and yearly every 23 hours", () => {
    const start = new Date("2026-10-01T00:00:00Z");
    let current = sub("GEO Standard", start.toISOString());
    let latestEnd = trialEnd(current)!.getTime();
    for (let i = 1; i <= 90; i++) {
      const at = new Date(start.getTime() + i * 23 * 3_600_000);
      const days = trialDaysForNewSubscription(PLANS.core, current, at);
      current = sub(i % 2 ? "GEO Standard yearly" : "GEO Standard", at.toISOString(), { trialDays: days });
      // While any trial is left it can only get shorter, never past the first 7 days.
      const end = trialEnd(current)?.getTime();
      if (end) {
        expect(end).toBeLessThanOrEqual(start.getTime() + 7 * DAY);
        expect(end).toBeLessThanOrEqual(latestEnd);
        latestEnd = end;
      }
      if (at.getTime() >= start.getTime() + 7 * DAY) expect(days).toBe(0);
    }
    expect(trialDaysLeft(current, new Date(start.getTime() + 90 * 23 * 3_600_000))).toBe(0);
  });

  it("gives each store one free trial, even after cancelling or reinstalling", () => {
    const trialEndsAt = new Date(now.getTime() + 2.5 * DAY);
    // Came back mid-trial with no subscription: only the whole days left.
    expect(trialDaysForNewSubscription(PLANS.core, null, now, trialEndsAt)).toBe(2);
    // Came back after the trial ended: no trial at all.
    expect(trialDaysForNewSubscription(PLANS.pro, null, now, new Date(now.getTime() - DAY))).toBe(0);
    // The saved end wins over a newer subscription's own (a switch can't move it).
    const fresh = sub("GEO Done-for-you", now.toISOString());
    expect(trialDaysForNewSubscription(PLANS.pro, fresh, now, trialEndsAt)).toBe(2);
    expect(trialDaysForNewSubscription(PLANS.pro, null, now, null)).toBe(7);
    expect(trialEnd(sub("GEO Standard", "2026-10-01T00:00:00Z"))?.toISOString()).toBe("2026-10-08T00:00:00.000Z");
    expect(trialEnd(sub("GEO Standard", "2026-10-01T00:00:00Z", { trialDays: 0 }))).toBeNull();
  });
});

describe("plan picked on the website", () => {
  it("accepts only plans we sell, monthly unless it says yearly", () => {
    expect(parsePlanChoice("pro", "yearly")).toEqual({ plan: "pro", cycle: "yearly" });
    expect(parsePlanChoice("core", "monthly")).toEqual({ plan: "core", cycle: "monthly" });
    expect(parsePlanChoice("core", "weekly")).toEqual({ plan: "core", cycle: "monthly" });
    expect(parsePlanChoice("core", null)).toEqual({ plan: "core", cycle: "monthly" });
    expect(parsePlanChoice("free", "monthly")).toBeNull();
    expect(parsePlanChoice("enterprise", "yearly")).toBeNull();
    expect(parsePlanChoice(null, null)).toBeNull();
  });

  it("reads the store's myshopify domain from the login form", () => {
    expect(myshopifyDomain("my-store")).toBe("my-store.myshopify.com");
    expect(myshopifyDomain(" My-Store.myshopify.com ")).toBe("my-store.myshopify.com");
    expect(myshopifyDomain("https://my-store.myshopify.com/admin")).toBe("my-store.myshopify.com");
    expect(myshopifyDomain("www.mystore.com.au")).toBeNull();
    expect(myshopifyDomain("")).toBeNull();
    expect(myshopifyDomain("bad store")).toBeNull();
    expect(myshopifyDomain(null)).toBeNull();
  });
});
