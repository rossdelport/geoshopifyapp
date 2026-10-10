// Shopify Billing plans: Standard and Done-for-you, each monthly or yearly. Prices come from plans.ts.
// Yearly is 9x the monthly price (3 months free). Every plan starts with Shopify's 7-day free trial.
// APPLY_IMMEDIATELY: approving a new plan (or switching monthly/yearly) cancels the old subscription
// straight away, so a store never has two. Shopify credits any unused time on the old one.

import { BillingInterval, BillingReplacementBehavior } from "@shopify/shopify-app-react-router/server";
import { BILLING_PLAN_NAMES, PLANS, type PaidPlanId } from "./plans";

function subscription(plan: PaidPlanId, interval: BillingInterval.Every30Days | BillingInterval.Annual) {
  const p = PLANS[plan];
  return {
    trialDays: p.trialDays,
    replacementBehavior: BillingReplacementBehavior.ApplyImmediately,
    lineItems: [
      {
        amount: interval === BillingInterval.Annual ? p.priceUsdYearly : p.priceUsd,
        currencyCode: "USD",
        interval,
      },
    ],
  };
}

export const BILLING_CONFIG = {
  [BILLING_PLAN_NAMES.core.monthly]: subscription("core", BillingInterval.Every30Days),
  [BILLING_PLAN_NAMES.core.yearly]: subscription("core", BillingInterval.Annual),
  [BILLING_PLAN_NAMES.pro.monthly]: subscription("pro", BillingInterval.Every30Days),
  [BILLING_PLAN_NAMES.pro.yearly]: subscription("pro", BillingInterval.Annual),
};
