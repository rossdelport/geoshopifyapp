import { useEffect } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import db from "../db.server";
import { requireWebShop } from "../lib/web-auth.server";
import { activeScan, moneySummary, topCompetitors, visibilitySummary } from "../lib/dashboard.server";
import { questionRows } from "../lib/question-stats.server";
import { SCORE_EXPLAINER, scoreLabel } from "../lib/score";
import { formatMoney, formatPct, timeAgo } from "../lib/format";

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
        <div className="w-head">
          <div>
            <h1>Setting up {data.storeName}</h1>
            <p>This takes a few minutes. You can leave this page and come back.</p>
          </div>
        </div>
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
  const score = visibility.latest?.score ?? 0;
  const label = scoreLabel(score, data.youShare > 0);
  const maxShare = Math.max(data.youShare, ...data.competitors.map((c) => c.share), 0.01);
  return (
    <>
      <div className="w-head">
        <div>
          <h1>{data.storeName}</h1>
          <p>Last checked with AI {data.lastScanAt ? timeAgo(data.lastScanAt) : "not yet"}.</p>
        </div>
      </div>

      <section className="w-panel w-money" aria-labelledby="money-h">
        <h2 id="money-h">Money from AI this month</h2>
        {money.hasPixel || money.thisMonth.orders > 0 ? (
          <div className="w-grid">
            <div>
              <div className="w-label">AI revenue</div>
              <div className="w-big">{formatMoney(money.thisMonth.revenue, money.currency)}</div>
            </div>
            <div>
              <div className="w-label">AI orders</div>
              <div className="w-big">{money.thisMonth.orders}</div>
            </div>
            <div>
              <div className="w-label">AI clicks</div>
              <div className="w-big">{money.thisMonth.visits}</div>
            </div>
          </div>
        ) : (
          <>
            <p>See the clicks, orders and money that come from ChatGPT and the other AI assistants. It’s one copy and paste in Shopify.</p>
            <a className="w-btn" href="/dash/tracking" style={{ justifySelf: "start" }}>
              Add the tracking code
            </a>
          </>
        )}
      </section>

      <div className="w-grid">
        <section className="w-panel" aria-labelledby="score-h">
          <h2 id="score-h">Visibility score</h2>
          <div className="w-big">
            {Math.round(score)}
            <span className="w-note" style={{ fontSize: 15 }}>
              {" "}
              / 100
            </span>
          </div>
          <span className={`w-pill ${label.tone === "success" ? "ok" : label.tone === "critical" ? "no" : "warn"}`} style={{ justifySelf: "start" }}>
            {label.label}
          </span>
          <p className="w-note">{SCORE_EXPLAINER}</p>
        </section>

        <section className="w-panel" aria-labelledby="who-h">
          <h2 id="who-h">Who AI names</h2>
          <p className="w-note">Share of AI answers that name each brand, from {data.tracked} buying questions.</p>
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
        </section>
      </div>

      <section className="w-panel" aria-labelledby="miss-h">
        <h2 id="miss-h">Questions where AI doesn’t name you</h2>
        {data.missing.length ? (
          <div className="w-table-wrap">
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
          </div>
        ) : (
          <p>AI names you at least once for every question you track. Nice.</p>
        )}
        <a href="/dash/questions">See all buying questions</a>
      </section>
    </>
  );
}
