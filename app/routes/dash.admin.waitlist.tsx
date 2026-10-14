import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import db from "../db.server";
import { requireAdmin } from "../lib/admin.server";
import { shortDate } from "../components/admin";

// Admin waitlist: everyone who joined from the website, where they came from, and a delete button (for tests).

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const rows = await db.waitlistSignup.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return {
    rows: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      from: [r.utmSource, r.utmContent].filter(Boolean).join(" · ") || r.referrer || "Direct",
      button: r.source,
      lang: r.lang ?? "en",
      joined: r.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAdmin(request);
  const form = await request.formData();
  if (form.get("intent") === "delete") await db.waitlistSignup.deleteMany({ where: { id: String(form.get("id") ?? "") } });
  return null;
};

export default function AdminWaitlist() {
  const { rows } = useLoaderData<typeof loader>();
  return (
    <section className="w-sec">
      <div className="w-sec-head">
        <h2>{rows.length} on the waitlist</h2>
        <p>Newest first. “Came from” is the ad or link they used.</p>
      </div>
      <div className="w-box w-table-wrap">
        <table className="w-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Came from</th>
              <th>Button</th>
              <th>Page</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="w-q">{r.name}</td>
                <td>{r.email}</td>
                <td>{r.from}</td>
                <td>{r.button}</td>
                <td>{r.lang.toUpperCase()}</td>
                <td className="num">{shortDate(r.joined)}</td>
                <td>
                  <Form method="post" onSubmit={(e) => !window.confirm(`Delete ${r.email} from the waitlist?`) && e.preventDefault()}>
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
        {!rows.length ? <p className="w-empty">No one yet.</p> : null}
      </div>
    </section>
  );
}
