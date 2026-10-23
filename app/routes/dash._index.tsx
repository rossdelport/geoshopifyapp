import { useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData, useNavigation, useRevalidator } from "react-router";
import db from "../db.server";
import { requireWebShop } from "../lib/web-auth.server";
import { activeScan, latestVisibility, moneyThisMonth, topCompetitors } from "../lib/dashboard.server";
import { enqueue } from "../lib/jobs.server";
import { questionRows } from "../lib/question-stats.server";
import { scanHasWorker } from "../lib/scan.server";
import { SCORE_EXPLAINER, scoreLabel } from "../lib/score";
import { ENGINE_LABELS, type Engine, getPlan } from "../lib/plans";
import { formatMoney, formatPct, timeAgo } from "../lib/format";
import { ICONS, PageHead, Stat } from "../components/web";

// usegeo.app/dash: the web app's home. While setting up: the steps and the scan's progress. Then, sales from AI
// first (Ross's #1 rule), the visibility score, who AI names instead, and the questions where the store is missing.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const storeName = shop.name || shop.primaryDomain || shop.domain;

  if (shop.onboarding !== "done") {
    const [scan, job] = await Promise.all([
      activeScan(shop.id),
      db.job.findFirst({ where: { shopId: shop.id, type: "onboard" }, orderBy: { createdAt: "desc" }, select: { status: true } }),
    ]);
    // The first scan's job gave up (or vanished in a restart) with the scan still open: nothing would ever finish it.
    const stuck = shop.onboarding === "scanning" && job?.status === "done" && (!scan || !(await scanHasWorker(scan.id)));
    const plan = getPlan(shop.plan);
    return {
      storeName,
      onboarding: shop.onboarding,
      setupFailed: job?.status === "failed" || stuck,
      scan: scan ? { done: scan.done, total: scan.total } : null,
      scanLabel: `Asking ${listNames(plan.engines.map(engineName))} (${plan.runsPerScan === 1 ? "once each" : "twice each"})`,
      view: "setup" as const,
    };
  }

  // Everything at once: one round trip after the sign-in check (two for the question and brand counts).
  const [scan, money, visibility, competitors, rows, brand] = await Promise.all([
    activeScan(shop.id),
    moneyThisMonth(shop),
    latestVisibility(shop.id),
    topCompetitors(shop.id, 6),
    questionRows(shop.id, { activeOnly: true }),
    db.brandProfile.findUnique({ where: { shopId: shop.id }, select: { brandName: true } }),
  ]);
  return {
    storeName,
    onboarding: shop.onboarding,
    setupFailed: false,
    scan: scan ? { done: scan.done, total: scan.total } : null,
    view: "dashboard" as const,
    money,
    visibility,
    competitors,
    youShare: visibility.latest?.mentionRate ?? 0,
    brandName: brand?.brandName ?? storeName,
    missing: rows.questions.filter((q) => q.rate === 0).slice(0, 5),
    tracked: rows.questions.length,
    lastScanAt: shop.lastScanAt,
  };
};

/** "Try again" on a setup that stopped: the stuck scan's job, or the whole setup, goes back in the queue. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  if (String((await request.formData()).get("intent")) !== "retry" || shop.onboarding === "done") return null;
  const scan = await activeScan(shop.id);
  const [type, payload, dedupeKey] = scan ? (["scan.run", { scanId: scan.id }, `scan-run:${scan.id}`] as const) : (["onboard", {}, `onboard:${shop.id}`] as const);
  const again = await db.job.updateMany({
    where: { dedupeKey, status: { in: ["failed", "done"] } },
    data: { status: "queued", attempts: 0, error: null, lockedAt: null, runAfter: new Date() },
  });
  if (!again.count) await enqueue(type, payload, { shopId: shop.id, dedupeKey });
  return null;
};

const STEPS: { key: string; label: string }[] = [
  { key: "profiling", label: "Reading your products" },
  { key: "questions", label: "Writing the buying questions shoppers ask AI" },
  { key: "scanning", label: "Asking the AI assistants" }, // replaced by the plan's own list (scanLabel)
];

const engineName = (e: string) => ENGINE_LABELS[e as Engine] ?? (e === "ours" ? "Pages we built" : "Other AI");
/** "ChatGPT, Gemini and Perplexity". */
const listNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "");

export default function DashHome() {
  const data = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const nav = useNavigation();
  const working = data.view === "setup" || Boolean(data.scan);

  // Refresh every few seconds while setup or a scan is running.
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => !document.hidden && revalidator.state === "idle" && revalidator.revalidate(), 4000);
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
                {s.key === "scanning" ? data.scanLabel : s.label}
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
            <div className="w-err" role="alert" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <span>Setup stopped partway. Try again, and if it keeps stopping, email ross@usegeo.app.</span>
              <Form method="post">
                <button className="w-btn w-btn-sm" type="submit" name="intent" value="retry" disabled={nav.state !== "idle"}>
                  Try again
                </button>
              </Form>
            </div>
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
    <Link to="/dash/tracking" prefetch="intent">
      Add the tracking code to see this
    </Link>
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
          <h2 id="money-h">Sales from AI this month</h2>
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

      {tracking ? (
        <section className="w-sec" aria-labelledby="sources-h">
          <div className="w-sec-head">
            <h2 id="sources-h">Where your shoppers came from this month</h2>
            <p>AI assistants next to search engines (SEO) and everyone else. Google AI Overviews count as Google search here, since Google sends both the same way.</p>
          </div>
          <div className="w-box w-table-wrap">
            <table className="w-table">
              <thead>
                <tr>
                  <th>Came from</th>
                  <th>Visits</th>
                  <th>Orders</th>
                  <th>Sales</th>
                  <th>Share of sales</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["AI assistants", "ChatGPT, Gemini, Perplexity and co", money.sources.ai],
                    ["Search engines", "Google, Bing and co", money.sources.search],
                    ["Everything else", "Direct, social, email, ads", money.sources.other],
                  ] as const
                ).map(([name, note, row]) => (
                  <tr key={name}>
                    <td>
                      <span className="w-q">{name}</span>
                      <span className="w-note w-block">{note}</span>
                    </td>
                    <td className="num">{row.visits}</td>
                    <td className="num">{row.orders}</td>
                    <td className="num">{formatMoney(row.revenue, money.currency)}</td>
                    <td className="num">{money.sources.all.revenue > 0 ? formatPct(row.revenue / money.sources.all.revenue) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

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
                    <td className="w-q">{o.orderName ?? "Order"}</td>
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
              Your biggest openings.{" "}
              <Link to="/dash/questions" prefetch="intent">
                See all buying questions
              </Link>
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
