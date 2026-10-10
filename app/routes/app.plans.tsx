import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop } from "../lib/shop.server";
import {
  BILLING_PLAN_NAMES,
  PAID_PLAN_IDS,
  PLANS,
  cycleFromBillingName,
  formatUsd,
  isBillingPlanName,
  parsePlanChoice,
  pickActiveSubscription,
  planFromBillingName,
  trialDaysForNewSubscription,
  trialDaysLeft,
  yearlyPerMonth,
  type BillingCycle,
  type PaidPlanId,
} from "../lib/plans";
import { onPlanChanged, recordTrialStart, syncPlanFromSubscriptions } from "../lib/billing.server";
import { clearPlanIntent, planIntentFor } from "../lib/plan-intent.server";
import { env } from "../lib/env.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, billing } = await requireShop(request);
  // Source of truth is Shopify: sync our copy whenever this page loads (e.g. after approving a charge).
  const check = await billing.check({ isTest: env.billingTest });
  const { active, extras } = pickActiveSubscription(check.appSubscriptions);
  // Approving a new plan replaces the old subscription, so there should never be two. If there are, keep the newest.
  for (const sub of extras) {
    await billing
      .cancel({ subscriptionId: sub.id, isTest: env.billingTest, prorate: true })
      .catch((err: Error) => console.error(`[billing] could not cancel extra subscription ${sub.id}: ${err.message}`));
  }
  const planId = planFromBillingName(active?.name);
  // Also saves when the store's one free trial ends, the first time a trial subscription is live.
  await syncPlanFromSubscriptions(shop.id, active ? [active] : []);
  const trialEndsAt = (await db.shop.findUniqueOrThrow({ where: { id: shop.id }, select: { trialEndsAt: true } })).trialEndsAt;
  if (planId !== "free") await clearPlanIntent(shop.domain);
  // A plan picked on our website (/app/plans?plan=pro&cycle=yearly from the dashboard, or saved at login).
  const url = new URL(request.url);
  const picked =
    planId === "free" ? (parsePlanChoice(url.searchParams.get("plan"), url.searchParams.get("cycle")) ?? (await planIntentFor(shop.domain))) : null;
  const free = PLANS.free;
  return {
    current: planId,
    currentCycle: cycleFromBillingName(active?.name),
    picked,
    trialDaysLeft: trialDaysLeft(active),
    // Free trial days a new subscription would get now: the full trial for a store that never had one.
    trialOffered: trialDaysForNewSubscription(PLANS.core, active, new Date(), trialEndsAt),
    free: { name: free.name, features: free.features },
    plans: PAID_PLAN_IDS.map((id) => {
      const p = PLANS[id];
      return {
        id,
        name: p.name,
        monthly: p.priceUsd,
        yearly: p.priceUsdYearly,
        yearlyPerMonth: yearlyPerMonth(p),
        trialDays: p.trialDays,
        blurb: p.blurb,
        features: p.features,
        billingNames: BILLING_PLAN_NAMES[id],
      };
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, billing, session } = await requireShop(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "subscribe") {
    const billingPlan = form.get("billingPlan");
    if (!isBillingPlanName(billingPlan)) return { ok: false, message: "Unknown plan" };
    const check = await billing.check({ isTest: env.billingTest });
    const { active } = pickActiveSubscription(check.appSubscriptions);
    if (active?.name === billingPlan) return { ok: true, message: "You're already on this plan." };
    const plan = PLANS[planFromBillingName(billingPlan) as PaidPlanId];
    const storeHandle = session.shop.replace(".myshopify.com", "");
    await recordTrialStart(shop.id, active);
    const { trialEndsAt } = await db.shop.findUniqueOrThrow({ where: { id: shop.id }, select: { trialEndsAt: true } });
    await clearPlanIntent(shop.domain);
    // Throws a redirect to Shopify's approval page. Approving it replaces any current subscription.
    await billing.request({
      plan: billingPlan,
      isTest: env.billingTest,
      // One free trial per store: a switch, or a new plan after cancelling or reinstalling, only gets the
      // whole days left of it (none once it has ended), so the free week never restarts.
      trialDays: trialDaysForNewSubscription(plan, active, new Date(), trialEndsAt),
      returnUrl: `https://admin.shopify.com/store/${storeHandle}/apps/${process.env.SHOPIFY_API_KEY}/app/plans`,
    });
  }
  if (intent === "cancel") {
    const check = await billing.check({ isTest: env.billingTest });
    for (const sub of check.appSubscriptions) {
      await billing.cancel({ subscriptionId: sub.id, isTest: env.billingTest, prorate: true });
    }
    await onPlanChanged(shop.id, "free");
    return { ok: true, message: "Your plan is cancelled. You keep your results." };
  }
  return { ok: false, message: "Unknown plan" };
};

type PlanCard = Awaited<ReturnType<typeof loader>>["plans"][number];

function Price({ p, cycle }: { p: PlanCard; cycle: BillingCycle }) {
  return (
    <div>
      <div className="geo-plan__price">
        {formatUsd(cycle === "yearly" ? p.yearly : p.monthly)}
        <span> {cycle === "yearly" ? "a year" : "a month"}</span>
      </div>
      <s-text color="subdued">
        {cycle === "yearly" ? `About ${formatUsd(p.yearlyPerMonth)} a month. 3 months free.` : "Billed monthly."}
      </s-text>
    </div>
  );
}

export default function Plans() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [cycle, setCycle] = useState<BillingCycle>(data.picked?.cycle ?? data.currentCycle ?? "monthly");
  useEffect(() => {
    if (fetcher.data?.message) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);
  const busy = fetcher.state !== "idle";
  const pending = busy ? String(fetcher.formData?.get("billingPlan") ?? fetcher.formData?.get("intent")) : null;
  const subscribed = data.current !== "free";

  return (
    <s-page heading="Plans">
      <s-link slot="breadcrumb-actions" href="/app/settings">
        Settings
      </s-link>

      {!subscribed && (
        <s-section heading={`What you have now: ${data.free.name}`}>
          <s-unordered-list>
            {data.free.features.map((f) => (
              <s-list-item key={f}>{f}</s-list-item>
            ))}
          </s-unordered-list>
        </s-section>
      )}
      {subscribed && data.trialDaysLeft > 0 && (
        <s-banner tone="info" heading={`Free trial: ${data.trialDaysLeft} ${data.trialDaysLeft === 1 ? "day" : "days"} left`}>
          <s-paragraph>Your first charge comes when the trial ends. Cancel before then and you pay nothing.</s-paragraph>
        </s-banner>
      )}

      <s-section>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Prices in US dollars, billed through Shopify.
            {!subscribed &&
              (data.trialOffered > 0
                ? ` Both plans start with a ${data.trialOffered}-day free trial.`
                : " You've had your free trial, so billing starts when you approve a plan.")}{" "}
            Cancel any time.
          </s-paragraph>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-button variant={cycle === "monthly" ? "primary" : "secondary"} onClick={() => setCycle("monthly")}>
              Monthly
            </s-button>
            <s-button variant={cycle === "yearly" ? "primary" : "secondary"} onClick={() => setCycle("yearly")}>
              Yearly: 3 months free
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
        {data.plans.map((p) => {
          const billingPlan = p.billingNames[cycle];
          const onThisPlan = data.current === p.id;
          const current = onThisPlan && data.currentCycle === cycle;
          const picked = !subscribed && data.picked?.plan === p.id;
          const label = !subscribed
            ? data.trialOffered > 0
              ? `Start ${data.trialOffered}-day free trial`
              : `Start ${p.name}`
            : onThisPlan
              ? `Switch to ${cycle}`
              : `Switch to ${p.name}`;
          return (
            <s-section key={p.id}>
              <div className={`geo-plan${current ? " geo-plan--current" : ""}${p.id === "core" ? " geo-plan--best" : ""}`}>
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-heading>{p.name}</s-heading>
                  {onThisPlan && <s-badge tone="success">Your plan</s-badge>}
                  {picked && <s-badge tone="success">You picked this</s-badge>}
                  {!onThisPlan && !picked && p.id === "core" && <s-badge tone="info">Our pick</s-badge>}
                </s-stack>
                <Price p={p} cycle={cycle} />
                <s-text>{p.blurb}</s-text>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {current ? (
                  <s-button disabled>
                    {data.trialDaysLeft > 0 ? `Trial: ${data.trialDaysLeft} ${data.trialDaysLeft === 1 ? "day" : "days"} left` : "Current plan"}
                  </s-button>
                ) : (
                  <s-button
                    variant="primary"
                    onClick={() => fetcher.submit({ intent: "subscribe", billingPlan }, { method: "post" })}
                    {...(pending === billingPlan ? { loading: true } : {})}
                    {...(busy && pending !== billingPlan ? { disabled: true } : {})}
                  >
                    {label}
                  </s-button>
                )}
              </div>
            </s-section>
          );
        })}
      </s-grid>

      <s-section>
        <s-paragraph>
          <s-text color="subdued">
            Switching plans, or between monthly and yearly, replaces your current plan straight away. What&apos;s left of your
            free trial carries over, and Shopify adjusts the charge for any time left on your old plan.
          </s-text>
        </s-paragraph>
      </s-section>

      {subscribed && (
        <s-section heading="Cancel">
          <s-stack direction="block" gap="base">
            <s-paragraph>You keep your results, but new scans and fixes stop.</s-paragraph>
            <s-button
              tone="critical"
              variant="tertiary"
              onClick={() => fetcher.submit({ intent: "cancel" }, { method: "post" })}
              {...(pending === "cancel" ? { loading: true } : {})}
            >
              Cancel my plan
            </s-button>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
