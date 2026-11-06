import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import db from "../db.server";
import { requireAdmin } from "../lib/admin.server";
import { SALES } from "../lib/booking";

// Admin > Calls (Ross, 6 Nov 2026: "please store that information too"): every call booked on firstpicked.com.au/book,
// newest first, with the person's answers to the two questions (they said yes to Shopify, so only sales a month shows)
// and the ad they came from. The same details are in Ross's Google Calendar and his "New call booked" email.

const perth = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Perth" });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const rows = await db.callBooking.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  const now = Date.now();
  return {
    rows: rows.map((r) => ({
      id: r.id,
      startsAt: r.startsAt.toISOString(),
      past: r.startsAt.getTime() < now,
      name: r.name,
      email: r.email,
      store: r.store,
      sales: SALES.find((s) => s.value === r.sales)?.label ?? r.sales,
      from: r.utmContent || r.utmCampaign || r.utmSource || r.referrer || "Direct",
      booked: r.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAdmin(request);
  const form = await request.formData();
  if (form.get("intent") === "delete") await db.callBooking.deleteMany({ where: { id: String(form.get("id") ?? "") } });
  return null;
};

export default function AdminCalls() {
  const { rows } = useLoaderData<typeof loader>();
  const coming = rows.filter((r) => !r.past).length;
  return (
    <section className="w-sec">
      <div className="w-sec-head">
        <h2>
          {rows.length} {rows.length === 1 ? "call" : "calls"} booked
        </h2>
        <p>
          {coming} still to come. Everyone booked on{" "}
          <a href="/book" target="_blank" rel="noreferrer">
            firstpicked.com.au/book
          </a>
          , with what they said their store sells a month. Times are Perth time.
        </p>
      </div>
      <div className="w-box w-table-wrap">
        <table className="w-table">
          <thead>
            <tr>
              <th>Call</th>
              <th>Name</th>
              <th>Email</th>
              <th>Store</th>
              <th>Sells a month</th>
              <th>Came from</th>
              <th>Booked</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="num">
                  {perth(r.startsAt)}
                  {r.past ? null : (
                    <div style={{ marginTop: 6 }}>
                      <span className="w-chip ok">Coming up</span>
                    </div>
                  )}
                </td>
                <td>{r.name}</td>
                <td>
                  <a href={`mailto:${r.email}`}>{r.email}</a>
                </td>
                <td className="w-q">
                  <a href={`https://${r.store.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer">
                    {r.store}
                  </a>
                </td>
                <td>{r.sales}</td>
                <td>{r.from}</td>
                <td className="num">{perth(r.booked)}</td>
                <td>
                  <Form method="post" onSubmit={(e) => !window.confirm(`Delete the call with ${r.name}? It stays in your Google Calendar.`) && e.preventDefault()}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="w-link-btn" type="submit" name="intent" value="delete">
                      Delete
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="w-empty">No calls booked yet. Calls booked from 6 November 2026 show here.</p> : null}
      </div>
    </section>
  );
}
