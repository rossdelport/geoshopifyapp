import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop, getUsage } from "../lib/shop.server";
import { activeScan, moneySummary, topCompetitors, visibilitySummary } from "../lib/dashboard.server";
import { enqueue } from "../lib/jobs.server";
import { startScan } from "../lib/scan.server";
import { canRunScan } from "../lib/limits";
import { ENGINE_LABELS, type Engine } from "../lib/plans";
import { AI_ENGINE_LABELS } from "../lib/attribution";
import { SCORE_EXPLAINER, scoreLabel } from "../lib/score";
import { FIX_TYPE_LABELS } from "../lib/fix-labels";
import { formatDate, formatMoney, formatNumber, formatPct, timeAgo } from "../lib/format";
import { Bar, EnginePill, ScoreRing, Sparkline, SplitBar, Steps } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, plan } = await requireShop(request);
  const scan = await activeScan(shop.id);
  const onboardingJob = await db.job.findFirst({
    where: { shopId: shop.id, type: "onboard" },
    orderBy: { createdAt: "desc" },
  });
  const base = {
    shopName: shop.name ?? shop.domain,
    plan: { id: plan.id, name: plan.name, engines: plan.engines, scanEveryDays: plan.scanEveryDays },
    onboarding: shop.onboarding,
    onboardingError: onboardingJob?.status === "failed" ? onboardingJob.error : null,
    scan: scan ? { done: scan.done, total: scan.total, engines: scan.engines as string[], kind: scan.kind } : null,
  };
  if (shop.onboarding !== "done") return { ...base, view: "setup" as const };

  const [money, visibility, competitors, fixes, usage, brand, lastScan] = await Promise.all([
    moneySummary(shop),
    visibilitySummary(shop.id),
    topCompetitors(shop.id, 5),
    db.fix.findMany({ where: { shopId: shop.id, status: "pending" }, take: 20 }),
    getUsage(shop.id),
    db.brandProfile.findUnique({ where: { shopId: shop.id }, select: { brandName: true } }),
    db.scan.findFirst({ where: { shopId: shop.id, status: { in: ["done", "failed"] } }, orderBy: { startedAt: "desc" } }),
  ]);
  const order = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  const nextFixes = fixes.sort((a, b) => (order[a.impact] ?? 3) - (order[b.impact] ?? 3)).slice(0, 3);
  const youShare = visibility.latest?.mentionRate ?? 0;

  return {
    ...base,
    view: "dashboard" as const,
    money,
    visibility,
    competitors,
    youShare,
    brandName: brand?.brandName ?? shop.name ?? "You",
    nextFixes: nextFixes.map((f) => ({ id: f.id, type: f.type, title: f.targetTitle, reason: f.reason, impact: f.impact })),
    pendingFixes: fixes.length,
    lastScanAt: shop.lastScanAt,
    lastScanFailed: lastScan?.status === "failed" ? lastScan.error : null,
    canScanNow: canRunScan(plan, usage, false).ok && plan.id !== "free",
    freeScanUsed: usage.freeScanUsed,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, plan } = await requireShop(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "start") {
    await db.shop.update({ where: { id: shop.id }, data: { onboarding: "profiling" } });
    await enqueue("onboard", {}, { shopId: shop.id, dedupeKey: `onboard:${shop.id}` });
    return { ok: true, message: "Setting things up…" };
  }
  if (intent === "rescan") {
    const usage = await getUsage(shop.id);
    const check = canRunScan(plan, usage, false);
    if (!check.ok || plan.id === "free") return { ok: false, message: check.reason ?? "Start a plan to run more scans." };
    const recent = await db.scan.findFirst({
      where: { shopId: shop.id, kind: "manual", startedAt: { gte: new Date(Date.now() - 20 * 3_600_000) } },
    });
    if (recent) return { ok: false, message: "You can run one extra check a day. Your scheduled scans keep running." };
    await startScan(shop.id, "manual");
    return { ok: true, message: "Checking the AI assistants now. This takes a few minutes." };
  }
  return { ok: false, message: "Unknown action" };
};

const SETUP_STEPS = [
  "Reading your products",
  "Writing the questions shoppers ask AI",
  "Asking the AI assistants (twice each)",
  "Working out your score",
];

export default function Dashboard() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const busy = data.onboarding !== "done" && data.onboarding !== "new";

  // Refresh while setup or a scan is running.
  useEffect(() => {
    if (!busy && !data.scan) return;
    const t = setInterval(() => revalidator.state === "idle" && revalidator.revalidate(), 4000);
    return () => clearInterval(t);
  }, [busy, data.scan, revalidator]);

  useEffect(() => {
    if (fetcher.data?.message) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);

  if (data.view === "setup") {
    if (data.onboarding === "new" && !fetcher.data) {
      return (
        <s-page heading="Get recommended by AI">
          <s-section>
            <div className="geo-welcome">
              <h1>Does ChatGPT recommend your store?</h1>
              <p>
                Shoppers now ask AI assistants what to buy. We&apos;ll ask them the questions your customers ask, show you who
                they recommend instead, and how to change that.
              </p>
              <div className="geo-engines">
                {(["chatgpt", "gemini", "perplexity", "aio", "claude"] as Engine[]).map((e) => (
                  <EnginePill key={e} engine={e} label={ENGINE_LABELS[e]} off={!data.plan.engines.includes(e)} />
                ))}
              </div>
              <p className="geo-small">Takes about 2 minutes. Nothing in your store changes without your OK.</p>
              <div style={{ marginTop: 18 }}>
                <s-button variant="primary" onClick={() => fetcher.submit({ intent: "start" }, { method: "post" })} {...(fetcher.state !== "idle" ? { loading: true } : {})}>
                  Start my free scan
                </s-button>
              </div>
            </div>
          </s-section>
          <s-section heading="What you'll get">
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(200px, 1fr))" gap="base">
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-heading>Your AI visibility score</s-heading>
                <s-paragraph>How often ChatGPT, Gemini and Perplexity recommend you, out of 100.</s-paragraph>
              </s-box>
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-heading>Who wins instead</s-heading>
                <s-paragraph>The brands AI picks over you, and the websites it trusts.</s-paragraph>
              </s-box>
              <s-box padding="base" background="subdued" borderRadius="base">
                <s-heading>Money from AI</s-heading>
                <s-paragraph>Sales from shoppers who came from AI in the last 60 days.</s-paragraph>
              </s-box>
            </s-grid>
          </s-section>
        </s-page>
      );
    }

    const stepIndex =
      data.onboarding === "profiling" || data.onboarding === "new"
        ? 0
        : data.onboarding === "questions"
          ? 1
          : !data.scan || data.scan.done < data.scan.total
            ? 2
            : 3;
    const pct = data.scan && data.scan.total ? data.scan.done / data.scan.total : 0;
    return (
      <s-page heading="Setting up">
        <s-section heading="Checking how AI sees your store">
          <s-stack direction="block" gap="base">
            <Steps steps={SETUP_STEPS} current={stepIndex} />
            {data.scan && (
              <div>
                <div className="geo-row" style={{ marginBottom: 6 }}>
                  <span className="geo-grow geo-muted">
                    {data.scan.done} of {data.scan.total} AI answers read
                  </span>
                  <span className="geo-muted geo-num">{formatPct(pct)}</span>
                </div>
                <Bar value={pct} />
              </div>
            )}
            <s-paragraph>
              <s-text color="subdued">
                While this runs we&apos;re also checking your last 60 days of orders for sales that came from AI. You can leave this
                page; we&apos;ll keep going.
              </s-text>
            </s-paragraph>
            {data.onboardingError && (
              <s-banner tone="critical" heading="Setup hit a problem">
                <s-paragraph>We&apos;ll retry automatically. Details: {data.onboardingError}</s-paragraph>
              </s-banner>
            )}
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  const { money, visibility, competitors } = data;
  const m = (n: number) => formatMoney(n, money.currency);
  const score = visibility.latest?.score ?? null;
  const label = score !== null ? scoreLabel(score, (visibility.latest?.mentionRate ?? 0) > 0) : null;
  const byEngine = (visibility.latest?.byEngine ?? {}) as Record<string, number>;
  const scanning = Boolean(data.scan);

  return (
    <s-page heading={`${data.shopName}`}>
      {data.plan.id === "free" && (
        <s-button slot="primary-action" variant="primary" href="/app/plans">
          Start tracking weekly
        </s-button>
      )}
      {data.plan.id !== "free" && (
        <s-button
          slot="primary-action"
          onClick={() => fetcher.submit({ intent: "rescan" }, { method: "post" })}
          {...(scanning || fetcher.state !== "idle" ? { loading: true } : {})}
          {...(!data.canScanNow ? { disabled: true } : {})}
        >
          Check AI now
        </s-button>
      )}

      {data.plan.id === "free" && data.freeScanUsed && (
        <s-banner tone="info" heading="That was your free scan">
          <s-paragraph>
            Start Core (7 days free) to track your questions every week, get fixes you can approve in one click, and see your AI
            sales grow.
          </s-paragraph>
        </s-banner>
      )}
      {data.lastScanFailed && (
        <s-banner tone="warning" heading="The last check couldn't finish">
          <s-paragraph>{data.lastScanFailed}</s-paragraph>
        </s-banner>
      )}

      {/* 1. Money from AI: always first. */}
      <s-section padding="none">
        <div className="geo-hero">
          <div className="geo-row">
            <div className="geo-grow">
              <div className="geo-hero__label">Money from AI · this month</div>
              <div className="geo-hero__value">{m(money.thisMonth.revenue)}</div>
              <div className="geo-hero__sub">
                {m(money.sinceJoining.revenue)} since you joined ({money.sinceJoining.days} days)
                {money.oursRevenue > 0 && <> · {m(money.oursRevenue)} from pages we built</>}
              </div>
            </div>
            {money.growthPct !== null && (
              <span className={`geo-chip ${money.growthPct >= 0 ? "geo-chip--up" : "geo-chip--down"}`}>
                {money.growthPct >= 0 ? "▲" : "▼"} {Math.abs(Math.round(money.growthPct))}% vs before
              </span>
            )}
          </div>
          <div className="geo-hero__grid">
            <div className="geo-hero__tile">
              <b>{formatNumber(money.thisMonth.orders)}</b>
              <span>orders from AI</span>
            </div>
            <div className="geo-hero__tile">
              <b>{money.hasPixel ? formatNumber(money.thisMonth.visits) : "–"}</b>
              <span>{money.hasPixel ? "visits from AI" : "visit tracking starting"}</span>
            </div>
            <div className="geo-hero__tile">
              <b>{formatPct(money.thisMonth.share, 1)}</b>
              <span>of your sales</span>
            </div>
          </div>
        </div>
      </s-section>

      <s-section heading="Where AI sales come from">
        {money.byEngine.length ? (
          <s-stack direction="block" gap="base">
            <SplitBar
              parts={money.byEngine.map((e) => ({
                key: e.engine,
                label: AI_ENGINE_LABELS[e.engine as keyof typeof AI_ENGINE_LABELS] ?? e.engine,
                value: e.revenue,
              }))}
            />
            {money.recentOrders.length > 0 && (
              <table className="geo-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>From</th>
                    <th>Why we think so</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {money.recentOrders.map((o, i) => (
                    <tr key={i}>
                      <td>
                        {o.orderName ?? "Order"} <span className="geo-small">· {formatDate(o.orderedAt)}</span>
                      </td>
                      <td>{AI_ENGINE_LABELS[o.engine as keyof typeof AI_ENGINE_LABELS] ?? o.engine}</td>
                      <td className="geo-small">{o.reason}</td>
                      <td className="geo-num" style={{ textAlign: "right" }}>
                        {m(o.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </s-stack>
        ) : (
          <s-paragraph>
            <s-text color="subdued">
              No AI sales found yet. That&apos;s normal at the start: as AI assistants begin recommending you, the orders show up
              here automatically.
            </s-text>
          </s-paragraph>
        )}
        <div className="geo-small" style={{ marginTop: 10 }}>
          We count an order as AI when the shopper arrived from an assistant like ChatGPT or Perplexity. Google AI Overviews
          can&apos;t be separated from normal Google, so they&apos;re not counted. We don&apos;t claim every AI sale is thanks to this
          app.
        </div>
      </s-section>

      <s-grid gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap="base">
        {/* 2. Visibility */}
        <s-section heading="How often AI recommends you">
          <div className="geo-row">
            <ScoreRing score={score} />
            <div className="geo-grow">
              {label && <s-badge tone={label.tone}>{label.label}</s-badge>}
              <div className="geo-muted" style={{ margin: "6px 0" }}>
                Named in {formatPct(data.youShare)} of answers
                {visibility.sinceStart !== null && (
                  <>
                    {" "}
                    · {visibility.sinceStart >= 0 ? "+" : ""}
                    {visibility.sinceStart} since you joined
                  </>
                )}
              </div>
              <Sparkline values={visibility.trend} />
            </div>
          </div>
          <div className="geo-engines" style={{ justifyContent: "flex-start" }}>
            {Object.entries(byEngine).map(([e, s]) => (
              <EnginePill key={e} engine={e} label={`${ENGINE_LABELS[e as Engine] ?? e} ${s}`} />
            ))}
          </div>
          <div className="geo-small">{SCORE_EXPLAINER}</div>
          <div className="geo-small" style={{ marginTop: 6 }}>
            {scanning
              ? `Checking now… ${data.scan!.done}/${data.scan!.total}`
              : `Last checked ${timeAgo(data.lastScanAt)}${data.plan.scanEveryDays ? ` · checks every ${data.plan.scanEveryDays === 1 ? "day" : "week"}` : ""}`}
          </div>
        </s-section>

        {/* 3. Do this next */}
        <s-section heading="Do this next">
          {data.nextFixes.length ? (
            <s-stack direction="block" gap="base">
              {data.nextFixes.map((f) => (
                <s-box key={f.id} padding="base" borderRadius="base" background="subdued">
                  <s-stack direction="block" gap="small-200">
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-text type="strong">{FIX_TYPE_LABELS[f.type] ?? f.type}</s-text>
                      {f.impact === "high" && <s-badge tone="success">Big win</s-badge>}
                    </s-stack>
                    <s-text color="subdued">{f.title}</s-text>
                    <s-paragraph>{f.reason}</s-paragraph>
                  </s-stack>
                </s-box>
              ))}
              <s-button href="/app/fixes" variant="primary">
                Review {data.pendingFixes} fix{data.pendingFixes === 1 ? "" : "es"}
              </s-button>
            </s-stack>
          ) : data.plan.id === "free" ? (
            <s-stack direction="block" gap="base">
              <s-paragraph>
                On a plan, we write ready-to-approve fixes here: clearer product pages, FAQs and buying guides that AI assistants
                can quote.
              </s-paragraph>
              <s-button href="/app/plans">See plans</s-button>
            </s-stack>
          ) : (
            <s-paragraph>
              <s-text color="subdued">Nothing waiting. New fixes appear after each scan.</s-text>
            </s-paragraph>
          )}
        </s-section>
      </s-grid>

      <s-grid gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap="base">
        <s-section heading="Who AI recommends instead">
          {competitors.length ? (
            <s-stack direction="block" gap="base">
              <div>
                <div className="geo-row" style={{ marginBottom: 4 }}>
                  <s-text type="strong">{data.brandName} (you)</s-text>
                  <span className="geo-grow" />
                  <span className="geo-muted geo-num">{formatPct(data.youShare)}</span>
                </div>
                <Bar value={data.youShare} tone="you" />
              </div>
              {competitors.map((c) => (
                <div key={c.brand}>
                  <div className="geo-row" style={{ marginBottom: 4 }}>
                    <span>{c.brand}</span>
                    <span className="geo-grow" />
                    <span className="geo-muted geo-num">{formatPct(c.share)}</span>
                  </div>
                  <Bar value={c.share} tone="them" />
                </div>
              ))}
              <s-link href="/app/competitors">See all competitors and sources</s-link>
            </s-stack>
          ) : (
            <s-paragraph>
              <s-text color="subdued">Competitors appear after your first scan.</s-text>
            </s-paragraph>
          )}
        </s-section>

        <s-section heading="Products bought via AI">
          {money.topProducts.length ? (
            <table className="geo-table">
              <tbody>
                {money.topProducts.map((p) => (
                  <tr key={p.title}>
                    <td>{p.title}</td>
                    <td className="geo-num" style={{ textAlign: "right" }}>
                      {p.qty} sold
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <s-paragraph>
              <s-text color="subdued">Your best sellers from AI will show here.</s-text>
            </s-paragraph>
          )}
        </s-section>
      </s-grid>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
