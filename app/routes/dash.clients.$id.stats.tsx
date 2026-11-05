import type { ReactNode } from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { requireClient } from "../lib/clients.server";
import { storeStats } from "../lib/store-stats.server";
import { type DayValue, STAT_SPANS, pctChange, readSpan, shareOf } from "../lib/store-stats";
import { dayLabel } from "../lib/guide-calendar";
import { formatMoney, formatPct } from "../lib/format";
import { ICONS, PageHead, Stat, Tabs } from "../components/web";
import { DayBars, Delta } from "../components/hub";
import styles from "../styles/client-pages.css?url";

// One client's store stats in the agency hub (Ross, 5 Nov 2026): how their store is doing, day by day. Sales, orders
// and visits from AI beside the whole store's, against the same number of days before; the AI score; where shoppers
// came from; each AI assistant; and what people bought after asking AI. The numbers come from the tracking code on
// their store and the AI checks (lib/store-stats.server.ts).

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireClient(request);
  const days = readSpan(new URL(request.url).searchParams.get("days"));
  return { shopId: shop.id, ...(await storeStats(shop, days)) };
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const count = (n: number) => n.toLocaleString("en-US");

/** The line under a number: how it compares with the days before, or why it can't be compared yet. */
function Change({ now, before, days, fair, since, format }: { now: number; before: number; days: number; fair: boolean; since: string | null; format: (n: number) => string }) {
  if (!fair) return <>{since ? `Tracking started ${dayLabel(since)}, so there’s nothing to compare yet.` : "Nothing to compare yet."}</>;
  const pct = pctChange(now, before);
  if (pct === null) return <>{now > 0 ? `None in the ${days} days before.` : `None in the ${days} days before either.`}</>;
  return (
    <>
      <Delta value={pct} unit="%" /> from {format(before)} in the {days} days before.
    </>
  );
}

/** One chart: a bar a day on its own scale, with the total for the days shown. */
function Chart({ title, total, days, span, unit, color, format }: { title: string; total: string; days: DayValue[]; span: number; unit: [string, string]; color: string; format?: (n: number) => string }) {
  return (
    <section className="w-box w-box-pad cp-chart" data-span={span}>
      <div className="cp-chart-head">
        <h3>{title}</h3>
        <span>{total}</span>
      </div>
      <DayBars days={days} label={title} unit={unit} color={color} height={160} format={format} />
    </section>
  );
}

/** The AI score on a 0 to 100 scale: a dot for each day with a check, joined by a line. */
function ScoreChart({ days }: { days: { day: string; score: number | null }[] }) {
  const n = days.length;
  const x = (i: number) => (n > 1 ? (i / (n - 1)) * 100 : 50);
  const pts = days.flatMap((d, i) => (d.score === null ? [] : [{ x: x(i), y: 100 - d.score, day: d.day, score: d.score }]));
  if (!pts.length) return <p className="w-empty">No AI check in these days.</p>;
  const first = pts[0];
  const last = pts[pts.length - 1];
  return (
    <div
      className="cp-plot-wrap"
      role="img"
      aria-label={`AI score out of 100, ${plural(pts.length, "check", "checks")}: ${first.score} on ${dayLabel(first.day)}, ${last.score} on ${dayLabel(last.day)}.`}
    >
      <div className="cp-axis" aria-hidden="true">
        <span style={{ top: "0%" }}>100</span>
        <span style={{ top: "50%" }}>50</span>
        <span style={{ top: "100%" }}>0</span>
      </div>
      <div className="cp-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line className="grid" x1="0" y1="0" x2="100" y2="0" vectorEffect="non-scaling-stroke" />
          <line className="grid" x1="0" y1="50" x2="100" y2="50" vectorEffect="non-scaling-stroke" />
          {pts.length > 1 ? (
            <polyline
              points={pts.map((p) => `${p.x.toFixed(2)},${p.y}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
        {pts.map((p) => (
          <span key={p.day} className={`cp-dot${p === last ? " last" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} title={`${dayLabel(p.day)}: ${p.score}`} />
        ))}
      </div>
      <div className="cp-plot-days" aria-hidden="true">
        <span>{dayLabel(days[0].day)}</span>
        <span>{dayLabel(days[n - 1].day)}</span>
      </div>
    </div>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="w-sec" aria-labelledby={id}>
      <div className="w-sec-head">
        <h2 id={id}>{title}</h2>
        {intro ? <p>{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function ClientStats() {
  const s = useLoaderData<typeof loader>();
  const base = `/dash/clients/${s.shopId}`;
  const w = s.window;
  const money = (n: number) => formatMoney(n, s.currency);
  const { totals: now, before } = s;
  const change = (pick: keyof typeof now, format: (n: number) => string = count) => (
    <Change now={now[pick]} before={before[pick]} days={w.days} fair={s.comparable} since={s.trackingSince} format={format} />
  );
  const topQty = Math.max(...s.products.map((p) => p.qty), 1);

  return (
    <>
      <PageHead
        title="Store stats"
        intro={`${dayLabel(w.from)} to ${dayLabel(w.to)}, compared with the ${w.days} days before.`}
        right={<Tabs label="Days to show" items={STAT_SPANS.map((n) => ({ to: `?days=${n}`, label: `${n} days`, active: n === w.days }))} />}
      />

      {s.tracking ? (
        <>
          <div className="w-stats">
            <Stat hero label="Sales from AI" icon={ICONS.money} value={money(now.aiRevenue)} caption={change("aiRevenue", money)} />
            <Stat label="Orders from AI" icon={ICONS.bag} value={count(now.aiOrders)} caption={change("aiOrders")} />
            <Stat label="Visits from AI" icon={ICONS.click} value={count(now.aiVisits)} caption={change("aiVisits")} />
            <Stat label="All sales" icon={ICONS.money} value={money(now.allRevenue)} caption={change("allRevenue", money)} />
          </div>

          <Chart title="Sales from AI" total={money(now.aiRevenue)} days={s.charts.aiSales} span={w.days} unit={["in sales", "in sales"]} color="var(--green)" format={money} />
          <div className="w-two">
            <Chart title="Visits from AI" total={plural(now.aiVisits, "visit", "visits")} days={s.charts.aiVisits} span={w.days} unit={["visit", "visits"]} color="var(--ink-3)" />
            <Chart title="All visits" total={plural(now.allVisits, "visit", "visits")} days={s.charts.allVisits} span={w.days} unit={["visit", "visits"]} color="var(--faint)" />
          </div>
        </>
      ) : (
        <section className="w-panel">
          <p>The tracking code isn’t sending yet, so we can’t count their visits and sales.</p>
          <Link to={`${base}/tracking`} className="w-btn w-btn-sm cp-cta" prefetch="intent">
            Open the tracking code
          </Link>
        </section>
      )}

      <Section
        id="score-h"
        title="AI score"
        intro={
          s.score.latest ? (
            <>
              {s.score.latest.score} out of 100 on {dayLabel(s.score.latest.day)}
              {s.score.start !== null ? (
                <>
                  , <Delta value={s.score.latest.score - s.score.start} /> over these days
                </>
              ) : null}
              . It shows how often AI names them when shoppers ask.
            </>
          ) : (
            "It shows how often AI names them when shoppers ask."
          )
        }
      >
        <div className="w-box w-box-pad cp-score">
          <ScoreChart days={s.score.days} />
          <div>
            <h3 className="w-chart-title">Latest score on each AI assistant</h3>
            {s.score.engines.length ? (
              <ul className="w-rank">
                {s.score.engines.map((e) => (
                  <li key={e.engine}>
                    <span>{e.label}</span>
                    <span>
                      {e.score} {e.change !== null ? <Delta value={e.change} /> : null}
                    </span>
                    <span className="bar">
                      <span style={{ width: `${Math.max(0, Math.min(100, e.score))}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="w-note">No AI check in these days.</p>
            )}
          </div>
        </div>
      </Section>

      {s.tracking ? (
        <>
          <Section id="from-h" title="Where shoppers came from" intro="AI assistants next to search engines and everything else, in these days.">
            <div className="w-box w-table-wrap">
              <table className="w-table cp-table">
                <thead>
                  <tr>
                    <th>Came from</th>
                    <th className="num">Visits</th>
                    <th className="num">Orders</th>
                    <th className="num">Sales</th>
                    <th className="num">Share of sales</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["AI assistants", "ChatGPT, Gemini, Perplexity and co", s.sources.ai],
                      ["Search engines", "Google, Bing and co", s.sources.search],
                      ["Everything else", "Direct, social, email, ads", s.sources.other],
                    ] as const
                  ).map(([name, note, row]) => (
                    <tr key={name}>
                      <td>
                        <span className="w-q">{name}</span>
                        <span className="w-note w-block">{note}</span>
                      </td>
                      <td className="num">{count(row.visits)}</td>
                      <td className="num">{count(row.orders)}</td>
                      <td className="num">{money(row.revenue)}</td>
                      <td className="num">{formatPct(shareOf(row.revenue, s.sources.all.revenue))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="w-two">
            <Section id="engines-h" title="Sales from each AI assistant">
              <div className="w-box w-table-wrap">
                {s.engines.length ? (
                  <table className="w-table cp-table">
                    <thead>
                      <tr>
                        <th>Assistant</th>
                        <th className="num">Visits</th>
                        <th className="num">Orders</th>
                        <th className="num">Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.engines.map((e) => (
                        <tr key={e.engine}>
                          <td className="w-q">{e.label}</td>
                          <td className="num">{e.visits === null ? "–" : count(e.visits)}</td>
                          <td className="num">{count(e.orders)}</td>
                          <td className="num">{money(e.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="w-empty">No visits or orders from AI in these days.</p>
                )}
              </div>
            </Section>

            <Section id="bought-h" title="Products bought after asking AI">
              <div className="w-box">
                {s.products.length ? (
                  <ul className="w-rank">
                    {s.products.map((p) => (
                      <li key={p.title}>
                        <span>{p.title}</span>
                        <span className="cp-bought">{count(p.qty)} bought</span>
                        <span className="bar">
                          <span style={{ width: `${(p.qty / topQty) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="w-empty">No orders from AI in these days.</p>
                )}
              </div>
            </Section>
          </div>
        </>
      ) : null}

      <p className="w-note">
        Sales from AI are orders where the shopper came to their store from an AI assistant, like ChatGPT. We don’t say all of it came from our work: some of
        these shoppers might have found them anyway. Google AI Overviews count as Google search, because Google sends both the same way. All visits and all sales
        are counted in days that start at 8 am Perth time.
      </p>
    </>
  );
}
