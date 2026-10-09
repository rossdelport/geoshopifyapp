import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { requireShop } from "../lib/shop.server";
import { BILLING_PLAN_NAMES, PLANS, planFromBillingName, type PlanId } from "../lib/plans";
import { onPlanChanged } from "../lib/billing.server";
import { env } from "../lib/env.server";

const PAID = [BILLING_PLAN_NAMES.core, BILLING_PLAN_NAMES.pro];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, billing } = await requireShop(request);
  // Source of truth is Shopify: sync our copy whenever this page loads (e.g. after approving a charge).
  const check = await billing.check({ plans: PAID, isTest: env.billingTest });
  const active = check.appSubscriptions.find((s) => s.status === "ACTIVE");
  const planId = planFromBillingName(active?.name);
  if (planId !== shop.plan) await onPlanChanged(shop.id, planId);
  return {
    current: planId,
    trialDaysLeft: active && active.trialDays ? active.trialDays : null,
    plans: (["free", "core", "pro"] as PlanId[]).map((id) => {
      const p = PLANS[id];
      return { id, name: p.name, price: p.priceUsd, trialDays: p.trialDays, blurb: p.blurb, features: p.features };
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, billing, session } = await requireShop(request);
  const form = await request.formData();
  const planId = String(form.get("plan")) as PlanId;

  if (planId === "core" || planId === "pro") {
    const storeHandle = session.shop.replace(".myshopify.com", "");
    // Throws a redirect to Shopify's approval page.
    await billing.request({
      plan: BILLING_PLAN_NAMES[planId],
      isTest: env.billingTest,
      returnUrl: `https://admin.shopify.com/store/${storeHandle}/apps/${process.env.SHOPIFY_API_KEY}/app/plans`,
    });
  }
  if (planId === "free") {
    const check = await billing.check({ plans: PAID, isTest: env.billingTest });
    for (const sub of check.appSubscriptions) {
      await billing.cancel({ subscriptionId: sub.id, isTest: env.billingTest, prorate: true });
    }
    await onPlanChanged(shop.id, "free");
    return { ok: true, message: "Your plan is cancelled. You keep your results." };
  }
  return { ok: false, message: "Unknown plan" };
};

export default function Plans() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  useEffect(() => {
    if (fetcher.data?.message) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);
  const pending = fetcher.state !== "idle" ? String(fetcher.formData?.get("plan")) : null;

  return (
    <s-page heading="Plans">
      <s-link slot="breadcrumb-actions" href="/app/settings">
        Settings
      </s-link>
      <s-section>
        <s-paragraph>
          Prices in US dollars, billed through Shopify. Paid plans start with a 7-day free trial. Cancel any time.
        </s-paragraph>
      </s-section>
      <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
        {data.plans.map((p) => {
          const current = p.id === data.current;
          return (
            <s-section key={p.id}>
              <div className={`geo-plan${current ? " geo-plan--current" : ""}${p.id === "core" ? " geo-plan--best" : ""}`}>
                <s-stack direction="inline" gap="small-200" alignItems="center">
                  <s-heading>{p.name}</s-heading>
                  {current && <s-badge tone="success">Your plan</s-badge>}
                  {!current && p.id === "core" && <s-badge tone="info">Most popular</s-badge>}
                </s-stack>
                <div className="geo-plan__price">
                  {p.price ? `US$${p.price}` : "Free"}
                  {p.price ? <span> / month</span> : null}
                </div>
                <s-text color="subdued">{p.blurb}</s-text>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {current ? (
                  <s-button disabled>{data.trialDaysLeft ? `Trial: ${data.trialDaysLeft} days` : "Current plan"}</s-button>
                ) : p.id === "free" ? (
                  data.current !== "free" && (
                    <s-button tone="critical" variant="tertiary" onClick={() => fetcher.submit({ plan: "free" }, { method: "post" })} {...(pending === "free" ? { loading: true } : {})}>
                      Cancel my plan
                    </s-button>
                  )
                ) : (
                  <s-button variant="primary" onClick={() => fetcher.submit({ plan: p.id }, { method: "post" })} {...(pending === p.id ? { loading: true } : {})}>
                    {data.current === "free" ? `Start ${p.trialDays}-day free trial` : `Switch to ${p.name}`}
                  </s-button>
                )}
              </div>
            </s-section>
          );
        })}
      </s-grid>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
