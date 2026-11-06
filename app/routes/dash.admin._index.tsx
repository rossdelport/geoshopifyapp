import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { overview, requireAdmin, sydneyDay } from "../lib/admin.server";
import { bookStats } from "../lib/book-stats.server";
import { bookedRate, type BookDay } from "../lib/book-stats";
import { ICONS, Stat } from "../components/web";
import { shortDate, usd } from "../components/admin";
import { timeAgo } from "../lib/format";

// Admin overview: first, people who opened the booking page from the ads and the calls they booked (Ross, 4 Nov
// 2026: "so i can wake up in the morning and see"), and what they answered to the two questions above the times
// (6 Nov 2026); then the numbers to glance at, and anything that needs a look.

const SPANS = [7, 14, 30];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const asked = Number(new URL(request.url).searchParams.get("days"));
  const span = SPANS.includes(asked) ? asked : 14;
  const today = sydneyDay();
  const [o, book] = await Promise.all([overview(), bookStats(sydneyDay(span - 1), today)]);
  return { ...o, book, span, today, yesterday: sydneyDay(1) };
};

const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** One bar a day, on its own scale (people and calls booked are two charts, never two scales on one). */
function DayBars({ days, pick, color, label, unit, height }: { days: BookDay[]; pick: "people" | "booked"; color: string; label: string; unit: [string, string]; height: number }) {
  const max = Math.max(...days.map((d) => d[pick]), 1);
  const total = days.reduce((n, d) => n + d[pick], 0);
  return (
    <div className="w-chart" style={{ height }} role="img" aria-label={`${label}: ${plural(total, ...unit)} in ${days.length} days, at most ${max} in a day. The table below has every day.`}>
      <span className="w-chart-max">{max}</span>
      {days.map((d) => (
        <div key={d.day} className="w-col" title={`${dayLabel(d.day)}: ${plural(d[pick], ...unit)}`}>
          <div className="w-col-bar">
            <div className="w-col-stack" style={{ height: `${(d[pick] / max) * 100}%` }}>
              {d[pick] ? <span style={{ flexGrow: 1, background: color }} /> : null}
            </div>
          </div>
          <span className="w-col-day">{new Date(`${d.day}T00:00:00Z`).getUTCDate()}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminOverview() {
  const o = useLoaderData<typeof loader>();
  const { book } = o;
  const day = (d: string) => book.days.find((x) => x.day === d) ?? { day: d, people: 0, booked: 0 };
  const [today, yesterday] = [day(o.today), day(o.yesterday)];
  const attention = [
    o.failed ? { text: `${o.failed} background job${o.failed === 1 ? "" : "s"} failed in the last 24 hours`, to: "/dash/admin/system" } : null,
    o.flags ? { text: `${o.flags} Ask FirstPicked question${o.flags === 1 ? "" : "s"} passed to you, still open`, to: "/dash/admin/support" } : null,
    ...o.stuck.map((s) => ({ text: `${s.store} has been stuck at "${s.stage}" since ${timeAgo(s.since)}`, to: "/dash/admin/users" })),
    ...o.overCap.map((s) => ({ text: `${s.store} hit its monthly cost cap (${usd(s.usd)})`, to: "/dash/admin/usage" })),
  ].filter((x): x is { text: string; to: string } => Boolean(x));
  return (
    <>
      <section className="w-sec" aria-labelledby="book-h">
        <div className="w-row w-range">
          <div className="w-sec-head">
            <h2 id="book-h">Your booking page</h2>
            <p>People who opened firstpicked.com.au/book, and the calls they booked. Each person counts once a day.</p>
          </div>
          <div className="w-range-presets">
            {SPANS.map((n) => (
              <Link key={n} to={`?days=${n}`} className={`w-btn w-btn-ghost w-btn-sm${n === o.span ? " w-on" : ""}`} preventScrollReset>
                {n} days
              </Link>
            ))}
          </div>
        </div>
        <div className="w-stats">
          <Stat hero label="Today so far" icon={ICONS.click} value={plural(today.people, "person", "people")} caption={plural(today.booked, "call booked", "calls booked")} />
          <Stat label="Yesterday" icon={ICONS.click} value={plural(yesterday.people, "person", "people")} caption={plural(yesterday.booked, "call booked", "calls booked")} />
          <Stat
            label={`Last ${o.span} days`}
            icon={ICONS.calendar}
            value={plural(book.totals.people, "person", "people")}
            caption={`${plural(book.totals.booked, "call booked", "calls booked")}${book.totals.people ? ` · ${bookedRate(book.totals.people, book.totals.booked)} booked` : ""}`}
          />
        </div>
        <div className="w-two">
          <div className="w-box w-box-pad">
            <h3 className="w-chart-title">People who opened the page</h3>
            <DayBars days={book.days} pick="people" color="var(--ink-3)" label="People who opened the booking page" unit={["person", "people"]} height={180} />
          </div>
          <div className="w-box w-box-pad">
            <h3 className="w-chart-title">Calls booked</h3>
            <DayBars days={book.days} pick="booked" color="var(--green)" label="Calls booked" unit={["call", "calls"]} height={180} />
          </div>
        </div>
        <div className="w-box w-table-wrap">
          <table className="w-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>People</th>
                <th>Calls booked</th>
                <th>Booked</th>
              </tr>
            </thead>
            <tbody>
              {book.ads.length ? (
                book.ads.slice(0, 20).map((a) => (
                  <tr key={a.name}>
                    <td className="w-q">{a.name}</td>
                    <td className="num">{a.people.toLocaleString("en-US")}</td>
                    <td className="num">{a.booked.toLocaleString("en-US")}</td>
                    <td className="num">{bookedRate(a.people, a.booked)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>Nobody has opened the booking page in these days yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Ross (6 Nov 2026): the two questions above the times, and what people answered, even if they didn't book. */}
        <div className="w-box w-table-wrap">
          <table className="w-table">
            <thead>
              <tr>
                <th>What they answered</th>
                <th>People</th>
                <th>Calls booked</th>
              </tr>
            </thead>
            <tbody>
              {book.answers.map((a) => (
                <tr key={a.label}>
                  <td className="w-q">{a.label}</td>
                  <td className="num">{a.people.toLocaleString("en-US")}</td>
                  <td className="num">{a.booked.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="w-note">
          Times only show for a Shopify brand selling A$5,000 or more a month. Each person counts once a day, under their
          last answers. <Link to="/dash/admin/calls">See every call booked</Link>
        </p>
        <details className="w-note">
          <summary>Day by day</summary>
          <div className="w-box w-table-wrap" style={{ marginTop: 8 }}>
            <table className="w-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>People</th>
                  <th>Calls booked</th>
                </tr>
              </thead>
              <tbody>
                {[...book.days].reverse().map((d) => (
                  <tr key={d.day}>
                    <td className="w-q">{dayLabel(d.day)}</td>
                    <td className="num">{d.people.toLocaleString("en-US")}</td>
                    <td className="num">{d.booked.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <p className="w-note">
          To see each ad on its own line, add this to the ad&apos;s URL parameters in Meta:{" "}
          <code style={{ wordBreak: "break-all" }}>utm_source=facebook&amp;utm_medium=paid&amp;utm_campaign={"{{campaign.name}}"}&amp;utm_content={"{{ad.name}}"}</code>. Counting starts the day this
          chart goes live, so earlier days show 0. Days are Sydney days.
        </p>
      </section>

      <div className="w-stats">
        <Stat hero label="Spend this month" icon={ICONS.money} value={usd(o.spendMonth.total)} caption={`Treg ${usd(o.spendMonth.treg)} · Claude ${usd(o.spendMonth.anthropic)} · today ${usd(o.spendToday.total)}`} />
        <Stat label="Accounts" icon={ICONS.user} value={o.users} caption={`${o.newUsers} new in the last 7 days`} />
        <Stat label="Stores" icon={ICONS.home} value={o.shops} caption={`${o.ready} set up · ${o.paid} on a paid plan`} />
        <Stat label="Waitlist" icon={ICONS.mail} value={o.waitlist} caption={`${o.newWaitlist} new in the last 7 days`} />
      </div>

      <section className="w-sec">
        <div className="w-sec-head">
          <h2>Needs a look</h2>
          <p>Failed jobs, questions passed to you, stores stuck in setup and stores over their cost cap.</p>
        </div>
        <div className="w-box">
          {attention.length ? (
            <ul className="w-list">
              {attention.map((a) => (
                <li key={a.text}>
                  <span className="w-dot warn">{a.text}</span>
                  <Link to={a.to}>Open</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="w-empty">All clear. Nothing needs you right now.</p>
          )}
        </div>
      </section>

      <section className="w-sec">
        <div className="w-sec-head">
          <h2>Stores by plan</h2>
        </div>
        <div className="w-box">
          <ul className="w-list">
            {o.plans.length ? (
              o.plans.map((p) => (
                <li key={p.plan}>
                  <span>{p.plan}</span>
                  <b>{p.count}</b>
                </li>
              ))
            ) : (
              <li>No stores yet</li>
            )}
          </ul>
        </div>
        <p className="w-note">Updated {shortDate(new Date().toISOString())}. Days and months are in Sydney time.</p>
      </section>
    </>
  );
}
