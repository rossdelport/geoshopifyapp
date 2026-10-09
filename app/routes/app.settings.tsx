import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop, getUsage } from "../lib/shop.server";
import { enqueue } from "../lib/jobs.server";
import { ensurePixel } from "../lib/pixel.server";
import { limitLabel } from "../lib/plans";
import { formatNumber } from "../lib/format";
import { Bar } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, plan } = await requireShop(request);
  const [usage, profile, products] = await Promise.all([
    getUsage(shop.id),
    db.brandProfile.findUnique({ where: { shopId: shop.id } }),
    db.product.count({ where: { shopId: shop.id } }),
  ]);
  return {
    plan: {
      name: plan.name,
      id: plan.id,
      questions: plan.questions,
      fixes: plan.fixesPerMonth,
      fixesLabel: limitLabel(plan.fixesPerMonth),
      products: plan.products,
      outreach: plan.outreachPerMonth,
    },
    usage,
    reportEmails: shop.reportEmails ?? shop.email ?? "",
    country: shop.country,
    brandName: profile?.brandName ?? shop.name ?? "",
    aliases: ((profile?.aliases as string[]) ?? []).join(", "),
    summary: profile?.summary ?? "",
    pixel: Boolean(shop.pixelId),
    products,
    monthlyReport: plan.monthlyReport,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin } = await requireShop(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  try {
    if (intent === "save") {
      const emails = String(form.get("reportEmails") ?? "")
        .split(/[,\s]+/)
        .map((e) => e.trim())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e))
        .slice(0, 5)
        .join(", ");
      const country = String(form.get("country") ?? shop.country).toUpperCase().slice(0, 2);
      await db.shop.update({ where: { id: shop.id }, data: { reportEmails: emails || null, country } });
      const brandName = String(form.get("brandName") ?? "").trim();
      if (brandName) {
        const aliases = String(form.get("aliases") ?? "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
          .slice(0, 10);
        await db.brandProfile.updateMany({ where: { shopId: shop.id }, data: { brandName, aliases } });
      }
      return { ok: true, message: "Settings saved" };
    }
    if (intent === "pixel") {
      await ensurePixel(shop.id, shop.domain, admin);
      return { ok: true, message: "Visit tracking is connected" };
    }
    if (intent === "sync") {
      await enqueue("catalog.sync", {}, { shopId: shop.id, dedupeKey: `catalog:${shop.id}` });
      return { ok: true, message: "Refreshing your products in the background" };
    }
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  return { ok: false, message: "Unknown action" };
};

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = !Number.isFinite(limit);
  return (
    <div>
      <div className="geo-row" style={{ marginBottom: 4 }}>
        <span className="geo-grow">{label}</span>
        <span className="geo-muted geo-num">
          {formatNumber(used)} {unlimited ? "(unlimited)" : `of ${formatNumber(limit)}`}
        </span>
      </div>
      {!unlimited && limit > 0 && <Bar value={used / limit} />}
    </div>
  );
}

const COUNTRIES = [
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["IE", "Ireland"],
];

export default function Settings() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [form, setForm] = useState({
    reportEmails: data.reportEmails,
    country: data.country,
    brandName: data.brandName,
    aliases: data.aliases,
  });
  useEffect(() => {
    if (fetcher.data?.message) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);
  const set = (k: keyof typeof form) => (e: Event) => setForm({ ...form, [k]: (e.currentTarget as unknown as { value: string }).value });

  return (
    <s-page heading="Settings">
      <s-button slot="primary-action" variant="primary" onClick={() => fetcher.submit({ intent: "save", ...form }, { method: "post" })}>
        Save
      </s-button>

      <s-section heading={`Your plan: ${data.plan.name}`}>
        <s-stack direction="block" gap="base">
          <UsageRow label="Questions tracked" used={data.usage.activeQuestions} limit={data.plan.questions} />
          {data.plan.id !== "free" && (
            <>
              <UsageRow label="Fixes this month" used={data.usage.fixesThisMonth} limit={data.plan.fixes} />
              <UsageRow label="Products optimised" used={data.usage.optimisedProducts} limit={data.plan.products} />
              <UsageRow label="Outreach targets this month" used={data.usage.outreachThisMonth} limit={data.plan.outreach} />
            </>
          )}
          <s-button href="/app/plans">{data.plan.id === "free" ? "See plans" : "Change plan"}</s-button>
        </s-stack>
      </s-section>

      <s-section heading="Your brand">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            <s-text color="subdued">We look for these names in AI answers. Add other spellings people use.</s-text>
          </s-paragraph>
          <s-text-field label="Brand name" value={form.brandName} onInput={set("brandName")} onChange={set("brandName")} />
          <s-text-field label="Other names (comma separated)" value={form.aliases} onInput={set("aliases")} onChange={set("aliases")} />
          {data.summary && (
            <s-paragraph>
              <s-text color="subdued">How we describe you: {data.summary}</s-text>
            </s-paragraph>
          )}
          <s-select label="Where your customers are" value={form.country} onChange={set("country")} details="AI answers are checked from this country.">
            {COUNTRIES.map(([code, name]) => (
              <s-option key={code} value={code}>
                {name}
              </s-option>
            ))}
          </s-select>
        </s-stack>
      </s-section>

      {data.monthlyReport && (
        <s-section heading="Monthly email report">
          <s-text-field
            label="Send to"
            value={form.reportEmails}
            onInput={set("reportEmails")}
            onChange={set("reportEmails")}
            details="Up to 5 emails, separated by commas. Sent on the 1st of each month."
          />
        </s-section>
      )}

      <s-section heading="Connections">
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge tone={data.pixel ? "success" : "warning"}>{data.pixel ? "On" : "Off"}</s-badge>
            <s-text>Visit tracking (counts visits that come from AI)</s-text>
            {!data.pixel && <s-button onClick={() => fetcher.submit({ intent: "pixel" }, { method: "post" })}>Turn on</s-button>}
          </s-stack>
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-badge tone="success">{formatNumber(data.products)} products</s-badge>
            <s-text>Product catalog</s-text>
            <s-button variant="tertiary" onClick={() => fetcher.submit({ intent: "sync" }, { method: "post" })}>
              Refresh
            </s-button>
          </s-stack>
        </s-stack>
      </s-section>

      <s-section heading="How we keep this honest">
        <s-unordered-list>
          <s-list-item>Nothing in your store changes until you approve it, and every change can be undone.</s-list-item>
          <s-list-item>We never invent facts, reviews or awards, and we avoid health claims.</s-list-item>
          <s-list-item>AI sales are orders where the shopper arrived from an AI assistant. We don&apos;t claim all of them are thanks to us.</s-list-item>
          <s-list-item>Google AI Overviews can&apos;t be separated from normal Google traffic, so they aren&apos;t counted as AI sales.</s-list-item>
          <s-list-item>We don&apos;t store your customers&apos; names, emails or addresses.</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
