import type { LoaderFunctionArgs } from "react-router";
import { Form, Link, useLoaderData } from "react-router";
import { dayRange, requireAdmin, sydneyDay, usage } from "../lib/admin.server";
import { ICONS, Stat } from "../components/web";
import { usd } from "../components/admin";

// Admin usage: what Treg (data) and Claude (AI) cost, per day, for the days picked. Sydney days.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const { from, to } = dayRange(new URL(request.url));
  const today = sydneyDay();
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthEnd = new Date(Date.parse(monthStart) - 86_400_000).toISOString().slice(0, 10);
  return {
    from,
    to,
    presets: [
      { label: "Today", from: today, to: today },
      { label: "7 days", from: sydneyDay(6), to: today },
      { label: "30 days", from: sydneyDay(29), to: today },
      { label: "This month", from: monthStart, to: today },
      { label: "Last month", from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd },
    ],
    ...(await usage(from, to)),
  };
};

const SERIES = [
  { key: "treg", label: "Treg (data)", color: "#e0913a" },
  { key: "anthropic", label: "Claude (AI)", color: "#3f3f46" },
  { key: "other", label: "Other (email)", color: "#c4c4cc" },
] as const;

const dayLabel = (d: string, long = false) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", ...(long ? { weekday: "short" } : {}), timeZone: "UTC" });

export default function AdminUsage() {
  const u = useLoaderData<typeof loader>();
  const max = Math.max(...u.days.map((d) => d.total), 0.0001);
  const avg = u.days.length ? u.totals.total / u.days.length : 0;
  return (
    <>
      <div className="w-row w-range">
        <div className="w-range-presets">
          {u.presets.map((p) => (
            <Link key={p.label} to={`?from=${p.from}&to=${p.to}`} className={`w-btn w-btn-ghost w-btn-sm${p.from === u.from && p.to === u.to ? " w-on" : ""}`} preventScrollReset>
              {p.label}
            </Link>
          ))}
        </div>
        <Form method="get" className="w-range-form">
          <label>
            From <input className="w-input" type="date" name="from" defaultValue={u.from} key={`f${u.from}`} />
          </label>
          <label>
            To <input className="w-input" type="date" name="to" defaultValue={u.to} key={`t${u.to}`} />
          </label>
          <button className="w-btn w-btn-sm" type="submit">
            Show
          </button>
        </Form>
      </div>

      <div className="w-stats">
        <Stat hero label="Total spend" icon={ICONS.money} value={usd(u.totals.total)} caption={`${dayLabel(u.from)} to ${dayLabel(u.to)} · about ${usd(avg)} a day`} />
        <Stat label="Treg (data)" icon={ICONS.gauge} value={usd(u.totals.treg)} caption="AI answers, Reddit, keywords, writer lookups" />
        <Stat label="Claude (AI)" icon={ICONS.spark} value={usd(u.totals.anthropic)} caption="Reading answers, writing questions, replies, pitches, Ask GEO" />
        <Stat label="Calls" icon={ICONS.click} value={u.totals.calls.toLocaleString("en-US")} caption="Paid requests to Treg, Claude and email" />
      </div>

      <section className="w-sec" aria-labelledby="chart-h">
        <div className="w-sec-head">
          <h2 id="chart-h">Spend per day</h2>
          <p>US dollars, Sydney days. Hover a day for the split.</p>
        </div>
        <div className="w-box w-box-pad">
          <div className="w-legend">
            {SERIES.map((s) => (
              <span key={s.key}>
                <i style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
          <div className="w-chart" role="img" aria-label={`Daily spend, highest ${usd(max)}. The table below has every day.`}>
            <span className="w-chart-max">{usd(max)}</span>
            {u.days.map((d) => (
              <div key={d.day} className="w-col" title={`${dayLabel(d.day, true)}: ${usd(d.total)} (Treg ${usd(d.treg)}, Claude ${usd(d.anthropic)}${d.other ? `, other ${usd(d.other)}` : ""})`}>
                <div className="w-col-bar">
                  <div className="w-col-stack" style={{ height: `${(d.total / max) * 100}%` }}>
                    {SERIES.map((s) =>
                      d[s.key] > 0 ? <span key={s.key} style={{ flexGrow: d[s.key], background: s.color }} /> : null,
                    )}
                  </div>
                </div>
                {u.days.length <= 31 ? <span className="w-col-day">{new Date(`${d.day}T00:00:00Z`).getUTCDate()}</span> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-two">
        <section className="w-sec">
          <div className="w-sec-head">
            <h2>By store</h2>
            <p>The 15 that cost the most in these days.</p>
          </div>
          <div className="w-box w-table-wrap">
            <table className="w-table">
              <tbody>
                {u.byShop.length ? (
                  u.byShop.map((s) => (
                    <tr key={s.name}>
                      <td className="w-q">{s.name}</td>
                      <td className="num">{usd(s.usd)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>No spend in these days.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="w-sec">
          <div className="w-sec-head">
            <h2>By job</h2>
            <p>What the money was spent on.</p>
          </div>
          <div className="w-box w-table-wrap">
            <table className="w-table">
              <tbody>
                {u.byUse.map((x) => (
                  <tr key={`${x.provider}${x.use}`}>
                    <td className="w-q">{x.use}</td>
                    <td>{x.provider === "anthropic" ? "Claude" : x.provider === "treg" ? "Treg" : "Other"}</td>
                    <td className="num">{x.calls.toLocaleString("en-US")} calls</td>
                    <td className="num">{usd(x.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="w-sec">
        <div className="w-sec-head">
          <h2>Day by day</h2>
        </div>
        <div className="w-box w-table-wrap">
          <table className="w-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Treg</th>
                <th>Claude</th>
                <th>Other</th>
                <th>Total</th>
                <th>Calls</th>
              </tr>
            </thead>
            <tbody>
              {[...u.days].reverse().map((d) => (
                <tr key={d.day}>
                  <td className="w-q">{dayLabel(d.day, true)}</td>
                  <td className="num">{usd(d.treg)}</td>
                  <td className="num">{usd(d.anthropic)}</td>
                  <td className="num">{usd(d.other)}</td>
                  <td className="num">
                    <b>{usd(d.total)}</b>
                  </td>
                  <td className="num">{d.calls.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
