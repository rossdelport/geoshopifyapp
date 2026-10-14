import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData } from "react-router";
import db from "../db.server";
import { requireAdmin } from "../lib/admin.server";
import { shortDate } from "../components/admin";

// Admin support: questions Ask GEO passed to the team (a summary each; the email has the chat).

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const flags = await db.supportFlag.findMany({ orderBy: [{ status: "desc" }, { createdAt: "desc" }], take: 300, include: { shop: { select: { name: true, primaryDomain: true, domain: true } } } });
  return {
    flags: flags.map((f) => ({
      id: f.id,
      email: f.email,
      store: f.shop ? f.shop.name || f.shop.primaryDomain || f.shop.domain : "",
      reason: f.reason,
      summary: f.summary,
      status: f.status,
      at: f.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAdmin(request);
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const status = form.get("status") === "done" ? "done" : "open";
  await db.supportFlag.updateMany({ where: { id }, data: { status } });
  return null;
};

export default function AdminSupport() {
  const { flags } = useLoaderData<typeof loader>();
  return (
    <section className="w-sec">
      <div className="w-sec-head">
        <h2>Passed to you by Ask GEO</h2>
        <p>Each one was also emailed to you with the chat. Reply to that email to answer them.</p>
      </div>
      <div className="w-box w-table-wrap">
        <table className="w-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Why</th>
              <th>What they need</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((f) => (
              <tr key={f.id}>
                <td className="num">{shortDate(f.at)}</td>
                <td>
                  <span className="w-q">{f.email}</span>
                  {f.store ? <span className="w-note w-block">{f.store}</span> : null}
                </td>
                <td>{f.reason}</td>
                <td>{f.summary}</td>
                <td>
                  <Form method="post">
                    <input type="hidden" name="id" value={f.id} />
                    <button className={`w-btn w-btn-ghost w-btn-sm${f.status === "done" ? " w-rd-done" : ""}`} type="submit" name="status" value={f.status === "done" ? "open" : "done"}>
                      {f.status === "done" ? "✓ Done" : "Mark done"}
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!flags.length ? <p className="w-empty">Nothing passed to you yet.</p> : null}
      </div>
    </section>
  );
}
