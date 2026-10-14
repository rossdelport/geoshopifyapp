import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import db from "../db.server";
import { requireWebShop } from "../lib/web-auth.server";
import { activeScan, moneySummary, topCompetitors, visibilitySummary } from "../lib/dashboard.server";
import { questionRows } from "../lib/question-stats.server";
import { SCORE_EXPLAINER, scoreLabel } from "../lib/score";
import { ENGINE_LABELS, type Engine } from "../lib/plans";
import { formatMoney, formatPct, timeAgo } from "../lib/format";
import { ICONS, PageHead, Stat } from "../components/web";

// usegeo.app/dash: the web app's home. While setting up: the steps and the scan's progress. Then, money from AI
// first (Ross's #1 rule), the visibility score, who AI names instead, and the questions where the store is missing.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const scan = await activeScan(shop.id);
  const job = await db.job.findFirst({ where: { shopId: shop.id, type: "onboard" }, orderBy: { createdAt: "desc" } });
  const base = {
    storeName: shop.name || shop.primaryDomain || shop.domain,
    onboarding: shop.onboarding,
    setupFailed: shop.onboarding !== "done" && job?.status === "failed",
    scan: scan ? { done: scan.done, total: scan.total } : null,
  };
  if (shop.onboarding !== "done") return { ...base, view: "setup" as const };

  const [money, visibility, competitors, rows, brand] = await Promise.all([
    moneySummary(shop),
    visibilitySummary(shop.id),
    topCompetitors(shop.id, 6),
    questionRows(shop.id),
    db.brandProfile.findUnique({ where: { shopId: shop.id }, select: { brandName: true } }),
  ]);
  const missing = rows.questions.filter((q) => q.active && q.rate === 0).slice(0, 5);
  return {
    ...base,
    view: "dashboard" as const,
    money,
    visibility,
    competitors,
    youShare: visibility.latest?.mentionRate ?? 0,
    brandName: brand?.brandName ?? base.storeName,
    missing,
    tracked: rows.questions.filter((q) => q.active).length,
    lastScanAt: shop.lastScanAt,
  };
};

const STEPS: { key: string; label: string }[] = [
  { key: "profiling", label: "Reading your products" },
  { key: "questions", label: "Writing the buying questions shoppers ask AI" },
  { key: "scanning", label: "Asking ChatGPT, Gemini, Perplexity and Google (twice each)" },
];

const engineName = (e: string) => ENGINE_LABELS[e as Engine] ?? (e === "ours" ? "Pages we built" : "Other AI");

export default function DashHome() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const working = data.view === "setup" || Boolean(data.scan);

  // Refresh every few seconds while setup or a scan is running.
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => revalidator.state === "idle" && revalidator.revalidate(), 4000);
    return () => clearInterval(t);
  }, [working, revalidator]);

  if (data.view === "setup") {
    const at = Math.max(0, STEPS.findIndex((s) => s.key === data.onboarding));
    const pct = data.scan && data.scan.total ? Math.round((data.scan.done / data.scan.total) * 100) : 0;
    return (
      <>
        <PageHead title={`Setting up ${data.storeName}`} intro="This takes a few minutes. You can leave this page and come back." />
        <section className="w-panel" aria-live="polite">
          <ol className="w-steps">
            {STEPS.map((s, i) => (
              <li key={s.key} className={i < at ? "done" : i === at && !data.setupFailed ? "now" : undefined}>
                {s.label}
              </li>
            ))}
          </ol>
          {data.onboarding === "scanning" && data.scan ? (
            <>
              <div className="w-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="AI answers read">
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="w-note">
                {data.scan.done} of {data.scan.total} AI answers read
              </p>
            </>
          ) : null}
          {data.setupFailed ? (
            <p className="w-err" role="alert">
              Setup stopped partway. We’ve been told and will get it going again. Please email ross@usegeo.app if it doesn’t move within a day.
            </p>
          ) : null}
        </section>
      </>
    );
  }

  const { money, visibility } = data;
  const tracking = money.hasPixel || money.thisMonth.orders > 0;
  const score = visibility.latest?.score ?? 0;
  const label = scoreLabel(score, data.youShare > 0);
  const maxShare = Math.max(data.youShare, ...data.competitors.map((c) => c.share), 0.01);
  const notYet = (
    <a href="/dash/tracking">Add the tracking code to see this</a>
  );
  return (
    <>
      <PageHead
        title={data.storeName}
        right={
          <>
            {data.scan ? <span className="w-chip live">Checking with AI now</span> : null}
            <span className="w-chip">Last checked {data.lastScanAt ? timeAgo(data.lastScanAt) : "not yet"}</span>
          </>
        }
      />

      <section className="w-sec" aria-labelledby="money-h">
        <div className="w-sec-head">
          <h2 id="money-h">Money from AI this month</h2>
          <p>Orders and clicks from people who came from ChatGPT and the other AI assistants.</p>
        </div>
        <div className="w-stats">
          <Stat
            hero
            label="AI revenue"
            icon={ICONS.money}
            value={tracking ? formatMoney(money.thisMonth.revenue, money.currency) : "–"}
            caption={tracking ? (money.thisMonth.share !== null ? `${formatPct(money.thisMonth.share)} of your store’s sales` : "Sales from AI this month") : notYet}
          />
          <Stat
            label="AI orders"
            icon={ICONS.bag}
            value={tracking ? money.thisMonth.orders : "–"}
            caption={tracking ? "Orders from shoppers AI sent you" : notYet}
          />
          <Stat
            label="AI clicks"
            icon={ICONS.click}
            value={tracking ? money.thisMonth.visits : "–"}
            caption={tracking ? "Visits from links in AI answers" : notYet}
          />
          <Stat
            label="Visibility score"
            icon={ICONS.gauge}
            value={
              <>
                {Math.round(score)}
                <small> / 100</small>
              </>
            }
            caption={
              <>
                <span className={`w-dot ${label.tone === "success" ? "ok" : label.tone === "critical" ? "no" : "warn"}`}>{label.label}</span>
                <details className="w-how">
                  <summary>How it works</summary>
                  {SCORE_EXPLAINER}
                </details>
              </>
            }
          />
        </div>
      </section>

      {money.recentOrders.length ? (
        <section className="w-sec" aria-labelledby="orders-h">
          <div className="w-sec-head">
            <h2 id="orders-h">Latest orders from AI</h2>
          </div>
          <div className="w-box w-table-wrap">
            <table className="w-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Came from</th>
                  <th>Amount</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {money.recentOrders.map((o) => (
                  <tr key={o.orderName + String(o.orderedAt)}>
                    <td className="w-q">{o.orderName}</td>
                    <td>{engineName(o.engine)}</td>
                    <td className="num">{formatMoney(o.revenue, money.currency)}</td>
                    <td className="num">{timeAgo(o.orderedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="w-two">
        <section className="w-sec" aria-labelledby="who-h">
          <div className="w-sec-head">
            <h2 id="who-h">Who AI names</h2>
            <p>Share of AI answers that name each brand, from {data.tracked} buying questions.</p>
          </div>
          <div className="w-box">
            <ul className="w-rank">
              <li className="you">
                <b>{data.brandName} (you)</b>
                <span>{formatPct(data.youShare)}</span>
                <span className="bar">
                  <span style={{ width: `${(data.youShare / maxShare) * 100}%` }} />
                </span>
              </li>
              {data.competitors.map((c) => (
                <li key={c.brand}>
                  <span>{c.brand}</span>
                  <span>{formatPct(c.share)}</span>
                  <span className="bar">
                    <span style={{ width: `${(c.share / maxShare) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="w-sec" aria-labelledby="miss-h">
          <div className="w-sec-head">
            <h2 id="miss-h">Questions where AI doesn’t name you</h2>
            <p>
              Your biggest openings. <a href="/dash/questions">See all buying questions</a>
            </p>
          </div>
          <div className="w-box w-table-wrap">
            {data.missing.length ? (
              <table className="w-table">
                <thead>
                  <tr>
                    <th>Buying question</th>
                    <th>AI names instead</th>
                  </tr>
                </thead>
                <tbody>
                  {data.missing.map((q) => (
                    <tr key={q.id}>
                      <td className="w-q">{q.text}</td>
                      <td>{q.winners.join(", ") || "No brand named"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="w-empty">AI names you at least once for every question you track. Nice.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
