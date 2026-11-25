import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import db from "../db.server";
import { requireAdmin } from "../lib/admin.server";
import { adName } from "../lib/book-stats";
import { SPOTS } from "../lib/heatmap";
import { rerunCheck } from "../lib/heatmap.server";

// Admin > Map checks (Ross, 25 Nov 2026: "i will then call anyone that uses it, so please save to a database"): everyone
// who used the free Google Maps check at rankwithross.com.au/visibility, newest first, with their phone number, the
// business Google found, the result and the ad they came from. Ross gets the same in an email per person.

const perth = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Perth" });

/** What happened, in a few words. */
function resultOf(r: { status: string; top3: number | null; found: number | null; error: string | null }): string {
  if (r.status === "done") return `Top 3 in ${r.top3 ?? 0} of ${SPOTS} spots. In the top 20 in ${r.found ?? 0}.`;
  if (r.status === "failed") return r.error ?? "The map failed.";
  if (r.status === "capped") return "Waiting for you: the day's limit was reached.";
  if (r.status === "nomatch") return "Not found on Google Maps.";
  if (r.status === "queued" || r.status === "running") return "Running now.";
  return "Did not pick their business.";
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const rows = await db.heatmapCheck.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return {
    rows: rows.map((r) => ({
      id: r.id,
      when: r.createdAt.toISOString(),
      name: r.firstName,
      phone: r.phone,
      business: r.business ?? r.query,
      address: r.business ? (r.address ?? "No street address on Google") : "What they typed",
      keyword: r.keyword,
      status: r.status,
      result: resultOf(r),
      hasMap: Boolean(r.business) && ["queued", "running", "done", "failed"].includes(r.status),
      canRun: Boolean(r.cid) && ["failed", "capped"].includes(r.status),
      from: adName(r),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAdmin(request);
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (form.get("intent") === "delete") await db.heatmapCheck.deleteMany({ where: { id } });
  if (form.get("intent") === "run") await rerunCheck(id);
  return null;
};

export default function AdminMaps() {
  const { rows } = useLoaderData<typeof loader>();
  const done = rows.filter((r) => r.status === "done").length;
  return (
    <section className="w-sec">
      <div className="w-sec-head">
        <h2>
          {rows.length} {rows.length === 1 ? "person" : "people"} used the map check
        </h2>
        <p>
          {done} got a map. Everyone who used{" "}
          <a href="/visibility" target="_blank" rel="noreferrer">
            rankwithross.com.au/visibility
          </a>
          , newest first. They agreed you can call or text them about their result. Times are Perth time.
        </p>
      </div>
      <div className="w-box w-table-wrap">
        <table className="w-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Business</th>
              <th>Search word</th>
              <th>Result</th>
              <th>Came from</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="num">{perth(r.when)}</td>
                <td>{r.name}</td>
                <td className="num">
                  <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a>
                </td>
                <td className="w-q">
                  {r.business}
                  <div style={{ color: "var(--muted, #6b6f76)", fontSize: 13 }}>{r.address}</div>
                </td>
                <td>{r.keyword || "Picked when the map runs"}</td>
                <td>
                  {r.result}
                  {r.hasMap ? (
                    <div style={{ marginTop: 6 }}>
                      <a href={`/visibility?r=${r.id}`} target="_blank" rel="noreferrer">
                        Open their map
                      </a>
                    </div>
                  ) : null}
                </td>
                <td>{r.from}</td>
                <td>
                  <Form method="post" onSubmit={(e) => (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "delete" && !window.confirm(`Delete ${r.name}'s map check?`) && e.preventDefault()}>
                    <input type="hidden" name="id" value={r.id} />
                    {r.canRun ? (
                      <button className="w-link-btn" type="submit" name="intent" value="run" style={{ marginRight: 12 }}>
                        Run it
                      </button>
                    ) : null}
                    <button className="w-link-btn" type="submit" name="intent" value="delete">
                      Delete
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="w-empty">Nobody has used the map check yet.</p> : null}
      </div>
    </section>
  );
}
