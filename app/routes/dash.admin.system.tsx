import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import db from "../db.server";
import { requireAdmin } from "../lib/admin.server";
import { calendarStatus, CALENDAR_REDIRECT, googleReady } from "../lib/booking.server";
import { timeAgo } from "../lib/format";

// Admin system: the background jobs (scans, Reddit, emails...): how many are waiting, running and failed, the
// latest failures with their error, and a button to try one again. At the top: Ross's Google Calendar for the
// book-a-call page (usegeo.app/book), with the button that connects it (route dash.admin_.calendar.tsx).

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [calendar, byStatus, failed] = await Promise.all([
    calendarStatus(),
    db.job.groupBy({ by: ["type", "status"], where: { updatedAt: { gte: weekAgo } }, _count: true }),
    db.job.findMany({ where: { status: "failed" }, orderBy: { updatedAt: "desc" }, take: 30, include: { shop: { select: { name: true, domain: true } } } }),
  ]);
  const types = [...new Set(byStatus.map((r) => r.type))].sort();
  const count = (type: string, status: string) => byStatus.find((r) => r.type === type && r.status === status)?._count ?? 0;
  return {
    calendar: calendar ? { email: calendar.email, at: calendar.updatedAt.toISOString() } : null,
    googleReady: googleReady(),
    redirectUri: CALENDAR_REDIRECT,
    calendarResult: new URL(request.url).searchParams.get("calendar"),
    rows: types.map((t) => ({ type: t, queued: count(t, "queued"), running: count(t, "running"), done: count(t, "done"), failed: count(t, "failed") })),
    failed: failed.map((j) => ({
      id: j.id,
      type: j.type,
      store: j.shop ? j.shop.name || j.shop.domain : "",
      error: (j.error ?? "").slice(0, 300),
      attempts: j.attempts,
      at: j.updatedAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAdmin(request);
  const id = String((await request.formData()).get("id") ?? "");
  await db.job.updateMany({ where: { id, status: "failed" }, data: { status: "queued", attempts: 0, error: null, lockedAt: null, runAfter: new Date() } });
  return null;
};

const CALENDAR_RESULTS: Record<string, string> = {
  connected: "Done. Your calendar is connected.",
  denied: "Google sign-in was cancelled, so nothing changed.",
  failed: "That didn't work. Please try connecting again.",
  setup: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Railway first.",
};

export default function AdminSystem() {
  const { calendar, googleReady, redirectUri, calendarResult, rows, failed } = useLoaderData<typeof loader>();
  return (
    <>
      <section className="w-sec" id="calendar">
        <div className="w-sec-head">
          <h2>Booking calendar</h2>
          <p>
            Your Google Calendar for <a href="/book">usegeo.app/book</a>. It shows people your free times and adds each booked call with a Google
            Meet link.
          </p>
        </div>
        <div className="w-box" style={{ padding: 16, display: "grid", gap: 10 }}>
          {calendarResult ? <p className="w-note">{CALENDAR_RESULTS[calendarResult] ?? ""}</p> : null}
          {calendar ? (
            <p>
              <span className="w-dot ok">Connected{calendar.email ? ` to ${calendar.email}` : ""}</span> <span className="w-note">since {timeAgo(calendar.at)}</span>
            </p>
          ) : (
            <p>
              <span className="w-dot no">Not connected</span> <span className="w-note">The booking page asks people to text you until it is.</span>
            </p>
          )}
          {googleReady ? (
            <p>
              <a className="w-btn w-btn-sm" href="/dash/admin/calendar">
                {calendar ? "Connect again" : "Connect Google Calendar"}
              </a>
            </p>
          ) : (
            <p className="w-note">
              First add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Railway, from a Google Cloud OAuth client whose redirect address is {redirectUri}
            </p>
          )}
        </div>
      </section>
      <section className="w-sec">
        <div className="w-sec-head">
          <h2>Background jobs, last 7 days</h2>
          <p>Scans, Reddit searches, emails and the rest. Failed ones are tried up to 4 times before they stop.</p>
        </div>
        <div className="w-box w-table-wrap">
          <table className="w-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Waiting</th>
                <th>Running</th>
                <th>Done</th>
                <th>Failed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.type}>
                  <td className="w-q">{r.type}</td>
                  <td className="num">{r.queued}</td>
                  <td className="num">{r.running}</td>
                  <td className="num">{r.done}</td>
                  <td className="num">{r.failed ? <span className="w-dot no">{r.failed}</span> : 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="w-empty">No jobs in the last 7 days.</p> : null}
        </div>
      </section>
      <section className="w-sec">
        <div className="w-sec-head">
          <h2>Latest failures</h2>
        </div>
        <div className="w-box w-table-wrap">
          <table className="w-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Job</th>
                <th>Store</th>
                <th>Error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {failed.map((j) => (
                <tr key={j.id}>
                  <td className="num">{timeAgo(j.at)}</td>
                  <td className="w-q">{j.type}</td>
                  <td>{j.store}</td>
                  <td className="w-err-text">{j.error || "No error saved"}</td>
                  <td>
                    <Form method="post">
                      <input type="hidden" name="id" value={j.id} />
                      <button className="w-btn w-btn-ghost w-btn-sm" type="submit">
                        Try again
                      </button>
                    </Form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!failed.length ? <p className="w-empty">No failed jobs.</p> : null}
        </div>
      </section>
    </>
  );
}
