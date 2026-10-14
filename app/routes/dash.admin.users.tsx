import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { SETUP_STEPS, requireAdmin, usersTable } from "../lib/admin.server";
import { shortDate, usd } from "../components/admin";

// Admin users: every account and store, its plan, AI score, how far through setup, and this month's spend.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  return { rows: await usersTable(), steps: SETUP_STEPS };
};

export default function AdminUsers() {
  const { rows, steps } = useLoaderData<typeof loader>();
  const [q, setQ] = useState("");
  const shown = rows.filter((r) => !q || `${r.email} ${r.store} ${r.host} ${r.plan}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <section className="w-sec">
      <div className="w-row">
        <div className="w-sec-head">
          <h2>{rows.length} accounts and stores</h2>
          <p>Setup counts {steps.length} steps: {steps.join(", ").toLowerCase()}.</p>
        </div>
        <input className="w-input w-search" type="search" placeholder="Search email, store or plan" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </div>
      <div className="w-box w-table-wrap">
        <table className="w-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Store</th>
              <th>Plan</th>
              <th>AI score</th>
              <th>Setup</th>
              <th>Joined</th>
              <th>Last sign-in</th>
              <th>Spend this month</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const done = r.steps.filter(Boolean).length;
              return (
                <tr key={r.key}>
                  <td className="w-q">{r.email}</td>
                  <td>
                    {r.store}
                    {r.host && r.host !== r.store ? <span className="w-note w-block">{r.host}</span> : null}
                  </td>
                  <td>{r.plan}</td>
                  <td className="num">{r.score === null ? "–" : r.score}</td>
                  <td>
                    <span className="w-setup" title={steps.map((s, i) => `${r.steps[i] ? "✓" : "○"} ${s}`).join("\n")}>
                      {r.steps.map((ok, i) => (
                        <i key={i} className={ok ? "on" : undefined} />
                      ))}
                      <span>
                        {done} of {steps.length}
                      </span>
                    </span>
                    {r.setupStage !== "done" && r.setupStage !== "none" ? <span className="w-note w-block">Setting up: {r.setupStage}</span> : null}
                  </td>
                  <td className="num">{shortDate(r.joined)}</td>
                  <td className="num">{shortDate(r.lastLogin)}</td>
                  <td className="num">{usd(r.spend)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!shown.length ? <p className="w-empty">No one matches that.</p> : null}
      </div>
    </section>
  );
}
