import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import db from "../db.server";
import { requireAdmin } from "../lib/admin.server";
import { drawWinner } from "../lib/giveaway.server";
import { GIVEAWAY, RUNNER_UP_OFFER, isOpen } from "../lib/giveaway";

const o = RUNNER_UP_OFFER;
const runnerUpNote = `The page promises everyone who doesn’t win ${o.percentOff}% off their first ${o.months} months (${o.monthly} a month) if they start by ${o.startBy}, and an email with that offer after the draw. Their emails are in the download.`;

// Admin giveaway (firstpicked.com.au/giveaway, Nov 2026): every entry, numbered in the order they came in, where they came
// from, a download for following up, and the random draw once entries close.

const perth = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Perth",
  });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  const rows = await db.giveawayEntry.findMany({
    orderBy: { createdAt: "asc" },
  });
  return {
    open: isOpen(),
    closesAt: GIVEAWAY.closesAt.toISOString(),
    drawAt: GIVEAWAY.drawAt.toISOString(),
    rows: rows
      .map((r, i) => ({
        n: i + 1,
        id: r.id,
        store: r.store,
        name: r.name,
        email: r.email,
        phone: r.phone,
        sales: r.sales,
        from: [r.utmSource, r.utmCampaign, r.utmContent].filter(Boolean).join(" · ") || r.referrer || "Direct",
        entered: r.createdAt.toISOString(),
        drawnAt: r.drawnAt?.toISOString() ?? null,
      }))
      .reverse(),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "draw") await drawWinner();
  if (intent === "delete")
    await db.giveawayEntry.deleteMany({
      where: { id: String(form.get("id") ?? "") },
    });
  return null;
};

export default function AdminGiveaway() {
  const { rows, open, closesAt, drawAt } = useLoaderData<typeof loader>();
  const busy = useNavigation().state !== "idle";
  // The latest pick is the winner: a new draw replaces a winner who didn’t reply.
  const drawn = rows.filter((r) => r.drawnAt).sort((a, b) => b.drawnAt!.localeCompare(a.drawnAt!));
  const left = rows.length - drawn.length;
  return (
    <>
      <section className="w-sec">
        <div className="w-sec-head">
          <h2>
            {rows.length} {rows.length === 1 ? "entry" : "entries"} in the giveaway
          </h2>
          <p>
            {open ? `Entries close ${perth(closesAt)}, Perth time.` : "Entries are closed."} The draw is {perth(drawAt)}, Perth time.{" "}
            <a href="/giveaway" target="_blank" rel="noreferrer">
              Open the page
            </a>
          </p>
          <p>{runnerUpNote}</p>
        </div>
        <div
          className="w-box"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            padding: 16,
          }}
        >
          <Form
            method="post"
            onSubmit={(e) =>
              !window.confirm(
                drawn.length
                  ? `Draw again? This picks a new winner from the ${left} entries not drawn yet.`
                  : `Draw the winner now, at random from ${left} entries?`,
              ) && e.preventDefault()
            }
          >
            <button className="w-btn w-btn-sm" type="submit" name="intent" value="draw" disabled={open || !left || busy}>
              {drawn.length ? "Draw again" : "Draw the winner"}
            </button>
          </Form>
          <a className="w-btn w-btn-ghost w-btn-sm" href="/dash/admin/giveaway-csv" download>
            Download all (CSV)
          </a>
          <span className="w-note">
            {open
              ? "The draw button works once entries close. It picks one entry at random and keeps a record of the time."
              : drawn.length
                ? `Winner: ${drawn[0].store} (#${drawn[0].n}), drawn ${perth(drawn[0].drawnAt!)}.${
                    drawn.length > 1
                      ? ` Drawn before: ${drawn
                          .slice(1)
                          .map((d) => `${d.store} (#${d.n})`)
                          .join(", ")}.`
                      : ""
                  }`
                : "Picks one entry at random and keeps a record of the time. If the winner doesn’t reply, press it again."}
          </span>
        </div>
      </section>
      <section className="w-sec">
        <div className="w-box w-table-wrap">
          <table className="w-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Store</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Sells a month</th>
                <th>Came from</th>
                <th>Entered</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="num">{r.n}</td>
                  <td className="w-q">
                    <a href={`https://${r.store}`} target="_blank" rel="noreferrer">
                      {r.store}
                    </a>
                    {r.drawnAt ? (
                      <>
                        {" "}
                        <span className={`w-chip ${r.id === drawn[0]?.id ? "ok" : ""}`}>
                          {r.id === drawn[0]?.id ? "Winner" : "Drawn before"}
                        </span>
                      </>
                    ) : null}
                  </td>
                  <td>{r.name}</td>
                  <td>{r.email}</td>
                  <td>{r.phone ? <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a> : "Not given"}</td>
                  <td>{r.sales ?? "Not asked"}</td>
                  <td>{r.from}</td>
                  <td className="num">{perth(r.entered)}</td>
                  <td>
                    <Form method="post" onSubmit={(e) => !window.confirm(`Delete the entry for ${r.store}?`) && e.preventDefault()}>
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
          {!rows.length ? <p className="w-empty">No entries yet.</p> : null}
        </div>
      </section>
    </>
  );
}
