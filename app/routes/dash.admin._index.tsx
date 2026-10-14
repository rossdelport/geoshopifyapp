import type { LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { overview, requireAdmin } from "../lib/admin.server";
import { ICONS, Stat } from "../components/web";
import { shortDate, usd } from "../components/admin";
import { timeAgo } from "../lib/format";

// Admin overview: the numbers to glance at, and anything that needs looking at.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  return overview();
};

export default function AdminOverview() {
  const o = useLoaderData<typeof loader>();
  const attention = [
    o.failed ? { text: `${o.failed} background job${o.failed === 1 ? "" : "s"} failed in the last 24 hours`, to: "/dash/admin/system" } : null,
    o.flags ? { text: `${o.flags} Ask GEO question${o.flags === 1 ? "" : "s"} passed to you, still open`, to: "/dash/admin/support" } : null,
    ...o.stuck.map((s) => ({ text: `${s.store} has been stuck at "${s.stage}" since ${timeAgo(s.since)}`, to: "/dash/admin/users" })),
    ...o.overCap.map((s) => ({ text: `${s.store} hit its monthly cost cap (${usd(s.usd)})`, to: "/dash/admin/usage" })),
  ].filter((x): x is { text: string; to: string } => Boolean(x));
  return (
    <>
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
