import { useEffect, useRef } from "react";
import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs } from "react-router";
import { Link, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { CopyButton, PageHead } from "../components/web";
import { requireClient } from "../lib/clients.server";
import { deleteClientReport, listClientReports, makeClientReport, sendClientReport } from "../lib/client-report.server";
import { KIND_LABEL, NOTE_MAX, type ReportKind, isReportKind, periodLabel, readReportNote } from "../lib/client-report";
import { HUB_TZ, dayOf } from "../lib/clients";
import { dayLabel } from "../lib/guide-calendar";
import { emailConfigured } from "../lib/email.server";
import { fromAnotherSite } from "../lib/public-form.server";
import { SITE } from "../lib/tools/site";
import styles from "../styles/client-report.css?url";

// A client's reports in the agency hub (Ross, 5 Nov 2026): /dash/clients/<store id>/reports. One tap makes a weekly or
// monthly report, a private link the client opens without logging in (/results/<token>), with an optional note from
// Ross at the top. Each report can be opened, its link copied, emailed to the client or deleted. The numbers are saved
// when it's made (lib/client-report.server.ts), so a report never changes after.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

/** "Thu 5 Nov, 9:41 am" on Ross's clock (Perth), made on the server so the page never changes when it loads. */
const when = (d: Date) => `${dayLabel(dayOf(d))}, ${d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: HUB_TZ })}`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, client } = await requireClient(request);
  const base = { shopId: shop.id, host: shop.primaryDomain || shop.domain, emailOn: emailConfigured() };
  if (!client) return { ...base, client: null, reports: [] };
  const rows = await listClientReports(shop.id);
  return {
    ...base,
    client: { email: client.email },
    reports: rows.map((r) => ({
      id: r.id,
      kind: (isReportKind(r.kind) ? r.kind : "week") as ReportKind,
      period: periodLabel(r.fromDay, r.toDay),
      token: r.token,
      made: when(r.createdAt),
      sent: r.sentAt ? { to: r.sentTo ?? "the client", at: when(r.sentAt) } : null,
    })),
  };
};

type ReportsResult =
  | { ok: true; intent: "make"; message: string; id: string }
  | { ok: true; intent: "send" | "delete"; message: string }
  | { ok: false; error: string };

export const action = async ({ request }: ActionFunctionArgs): Promise<ReportsResult> => {
  const { user, shop, client } = await requireClient(request);
  if (fromAnotherSite(request)) return { ok: false, error: "Please use the buttons on FirstPicked." };
  if (!client) return { ok: false, error: "Make them a client first." };
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  switch (String(form.get("intent") ?? "")) {
    case "make": {
      const kind = form.get("kind");
      if (!isReportKind(kind)) return { ok: false, error: "Please pick a weekly or monthly report." };
      const note = readReportNote(form.get("note"));
      if (!note.ok) return note;
      const made = await makeClientReport(shop.id, kind, user.email, new Date(), { note: note.note ?? undefined });
      return made.ok ? { ok: true, intent: "make", message: "Report made.", id: made.id } : made;
    }
    case "send": {
      const sent = await sendClientReport(shop.id, id, user.email);
      return sent.ok ? { ok: true, intent: "send", message: sent.message } : sent;
    }
    case "delete":
      return (await deleteClientReport(shop.id, id))
        ? { ok: true, intent: "delete", message: "Deleted. Its link no longer works." }
        : { ok: false, error: "That report is already gone." };
  }
  return { ok: false, error: "Unknown action." };
};

type Row = Awaited<ReturnType<typeof loader>>["reports"][number];

const linkOf = (token: string) => `${SITE}/results/${token}`;

export default function ClientReports() {
  const d = useLoaderData<typeof loader>();
  const make = useFetcher<typeof action>();
  const form = useRef<HTMLFormElement>(null);
  const busy = make.state !== "idle";
  const busyKind = busy ? String(make.formData?.get("kind") ?? "") : "";
  const res = make.state === "idle" ? make.data : undefined;
  // Made here, or with a "Make it" button elsewhere in the hub (which comes here with ?made=<id>).
  const [params] = useSearchParams();
  const madeId = (res && res.ok && res.intent === "make" ? res.id : null) ?? params.get("made");

  // A report was made: the note went into it, so the box empties for the next one.
  useEffect(() => {
    if (madeId) form.current?.reset();
  }, [madeId]);

  if (!d.client) {
    return (
      <>
        <PageHead title="Reports" />
        <section className="w-panel">
          <h2>Make them a client first</h2>
          <p>Reports are for clients. Add this store as a client, then make their first report here.</p>
          <div>
            <Link className="w-btn" to={`/dash/clients/new?store=${encodeURIComponent(d.host)}`}>
              Make them a client
            </Link>
          </div>
        </section>
      </>
    );
  }

  const base = `/dash/clients/${d.shopId}`;
  const made = madeId ? d.reports.find((r) => r.id === madeId) : undefined;
  const spin = (kind: string) => (busyKind === kind ? <span className="w-spin" aria-hidden="true" /> : null);
  return (
    <>
      <PageHead
        title="Reports"
        intro="A weekly or monthly report as a private link the client opens without logging in. Make one, then email it or copy the link."
        right={
          <>
            {/* Both buttons send the note form below (form="cr-make"), each with its own kind. */}
            <button form="cr-make" type="submit" name="kind" value="week" className="w-btn w-btn-sm" disabled={busy}>
              {spin("week")}
              Make weekly report
            </button>
            <button form="cr-make" type="submit" name="kind" value="month" className="w-btn w-btn-ghost w-btn-sm" disabled={busy}>
              {spin("month")}
              Make monthly report
            </button>
          </>
        }
      />
      {made ? <Made r={made} /> : null}
      <make.Form method="post" id="cr-make" ref={form} className="w-box w-box-pad cr-make">
        <input type="hidden" name="intent" value="make" />
        <label htmlFor="cr-note">
          Note from you <span className="w-note">(optional)</span>
        </label>
        <textarea id="cr-note" name="note" className="w-input" maxLength={NOTE_MAX} placeholder="A few words for the client, like what went well." />
        <p className="w-note">It goes at the top of the next report you make, as “A note from Ross”.</p>
        {res && !res.ok ? (
          <p className="w-err" role="alert">
            {res.error}
          </p>
        ) : null}
      </make.Form>
      <p className="w-note">
        {d.client.email ? (
          <>
            Reports are emailed to {d.client.email}. <Link to={`${base}/details`}>Change</Link>
          </>
        ) : (
          <>
            No email yet: <Link to={`${base}/details`}>add one on Details</Link>.
          </>
        )}
        {d.emailOn ? null : " Email isn’t set up yet, so copy the link and send it yourself."}
      </p>
      {d.reports.length ? (
        <div className="w-box w-table-wrap">
          <table className="w-table cr-list">
            <thead>
              <tr>
                <th>Report</th>
                <th>Covers</th>
                <th>Made</th>
                <th>Sent</th>
                <th>
                  <span className="h-sr">What you can do</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.reports.map((r) => (
                <ReportRow key={r.id} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="w-box">
          <p className="w-empty">No reports yet. Make their first one with the buttons at the top.</p>
        </div>
      )}
      <p className="w-note">Reports keep the numbers from the day you made them.</p>
    </>
  );
}

/** The report just made, with its link ready to send. */
function Made({ r }: { r: Row }) {
  const link = linkOf(r.token);
  return (
    <section className="w-panel cr-made" aria-live="polite">
      <h2>
        {KIND_LABEL[r.kind]} report made: {r.period}
      </h2>
      <p className="cr-made-link">{link}</p>
      <div className="cr-acts">
        <a className="w-btn w-btn-ghost w-btn-sm" href={`/results/${r.token}`} target="_blank" rel="noreferrer">
          Open
        </a>
        <CopyButton text={link} label="Copy link" />
        <SendButton id={r.id} sent={Boolean(r.sent)} />
      </div>
    </section>
  );
}

/** Email the report to the client's addresses; the answer shows beside the button. */
function SendButton({ id, sent }: { id: string; sent: boolean }) {
  const f = useFetcher<typeof action>();
  const busy = f.state !== "idle";
  const res = f.state === "idle" ? f.data : undefined;
  return (
    <f.Form method="post" className="h-act">
      <input type="hidden" name="intent" value="send" />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="w-btn w-btn-ghost w-btn-sm" disabled={busy}>
        {busy ? <span className="w-spin" aria-hidden="true" /> : null}
        {sent ? "Email again" : "Email it"}
      </button>
      {res ? (
        <span className={res.ok ? "h-act-ok" : "h-act-err"} role="status">
          {res.ok ? res.message : res.error}
        </span>
      ) : null}
    </f.Form>
  );
}

function ReportRow({ r }: { r: Row }) {
  const del = useFetcher<typeof action>();
  // Gone as soon as Delete is confirmed; it comes back with the reason if the delete fails.
  if (del.state !== "idle" || (del.data && del.data.ok)) return null;
  const link = linkOf(r.token);
  return (
    <tr>
      <td className="w-q">{KIND_LABEL[r.kind]}</td>
      <td className="num">{r.period}</td>
      <td className="num">{r.made}</td>
      <td>
        {r.sent ? (
          <>
            {r.sent.to}
            <div className="w-note">{r.sent.at}</div>
          </>
        ) : (
          <span className="w-note">Not sent</span>
        )}
      </td>
      <td>
        <div className="cr-acts">
          <a className="w-btn w-btn-ghost w-btn-sm" href={`/results/${r.token}`} target="_blank" rel="noreferrer">
            Open
          </a>
          <CopyButton text={link} label="Copy link" />
          <SendButton id={r.id} sent={Boolean(r.sent)} />
          <del.Form method="post" onSubmit={(e) => !window.confirm("Delete this report? Its link stops working.") && e.preventDefault()}>
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="id" value={r.id} />
            <button className="w-link-btn" type="submit">
              Delete
            </button>
          </del.Form>
          {del.data && !del.data.ok ? (
            <span className="h-act-err" role="status">
              {del.data.error}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
