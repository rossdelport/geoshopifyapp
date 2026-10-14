import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import db from "../db.server";
import { requireAdmin } from "../lib/admin.server";
import { timeAgo } from "../lib/format";

// Admin system: the background jobs (scans, Reddit, emails...): how many are waiting, running and failed, the
// latest failures with their error, and a button to try one again.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const [byStatus, failed] = await Promise.all([
    db.job.groupBy({ by: ["type", "status"], where: { updatedAt: { gte: weekAgo } }, _count: true }),
    db.job.findMany({ where: { status: "failed" }, orderBy: { updatedAt: "desc" }, take: 30, include: { shop: { select: { name: true, domain: true } } } }),
  ]);
  const types = [...new Set(byStatus.map((r) => r.type))].sort();
  const count = (type: string, status: string) => byStatus.find((r) => r.type === type && r.status === status)?._count ?? 0;
  return {
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

export default function AdminSystem() {
  const { rows, failed } = useLoaderData<typeof loader>();
  return (
    <>
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
