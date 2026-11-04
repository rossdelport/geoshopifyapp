import { useEffect, useRef } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useFetchers, useLoaderData, useRevalidator } from "react-router";
import { requireAdmin } from "../lib/admin.server";
import { createReports, deleteReport, listReports } from "../lib/store-report.server";
import { makerLink } from "../lib/report-maker.server";
import { REPORTS_AT_ONCE } from "../lib/store-report";
import { SITE } from "../lib/tools/site";
import { CopyButton } from "../components/web";

// Admin reports (Ross, 3 Nov 2026): paste Shopify store addresses, and about 3 minutes later each store has its own
// page at usegeo.app/report/<slug> for Ross's teardown videos (lib/store-report.server.ts). The list shows how each
// one is going, the story tags for picking which store to film, and Ross's script. The script and notes live only
// here: the public page never shows them.

type Report = Awaited<ReturnType<typeof listReports>>[number];

// Perth time, like the giveaway page: Ross films from Perth.
const perth = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Perth",
  });

const running = (r: Report) => r.status !== "done" && r.status !== "failed";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  // The phone report maker's private link (no sign-in needed there), to copy onto Ross's phone.
  return { reports: await listReports(), phoneLink: makerLink() };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const admin = await requireAdmin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "create" || intent === "rerun") {
    try {
      const result = await createReports(String(form.get("stores") ?? ""), admin.email || null);
      // Run again: the new report takes the failed one's place in the list.
      if (intent === "rerun" && result.ok) await deleteReport(String(form.get("id") ?? ""));
      return result;
    } catch (err) {
      console.error("[admin reports] couldn't start reports:", err);
      return { ok: false as const, error: "Something went wrong starting the reports. Please try again." };
    }
  }
  if (intent === "delete") await deleteReport(String(form.get("id") ?? ""));
  return null;
};

/** "Asking AI: 9 of 24", "Ready", "Failed: ..." with a dot: green when ready, red when it failed, grey while it runs. */
function Status({ r }: { r: Report }) {
  const again = useFetcher<typeof action>();
  if (r.status === "done") {
    return (
      <>
        <span className="w-dot ok">Ready</span>
        {r.answers !== null ? (
          <div className="w-note">
            Named {r.named ?? 0} of {r.answers}, {r.moves} {r.moves === 1 ? "move" : "moves"}
          </div>
        ) : null}
      </>
    );
  }
  if (r.status === "failed") {
    const starting = again.state !== "idle";
    const failed = again.data && !again.data.ok ? again.data.error : null;
    return (
      <>
        <span className="w-dot no" style={{ whiteSpace: "normal" }}>
          Failed: {r.error || "Please run it again."}
        </span>
        {/* One tap to try the same store again (a new report replaces this one), instead of retyping it. */}
        <again.Form method="post" style={{ marginTop: 6 }}>
          <input type="hidden" name="intent" value="rerun" />
          <input type="hidden" name="stores" value={r.host} />
          <input type="hidden" name="id" value={r.id} />
          <button className="w-btn w-btn-ghost w-btn-sm" type="submit" disabled={starting}>
            {starting ? "Starting…" : "Run again"}
          </button>
        </again.Form>
        {failed ? <p className="w-err">{failed}</p> : null}
      </>
    );
  }
  const text =
    r.status === "reading" ? "Reading the store" : r.status === "asking" ? `Asking AI: ${r.done} of ${r.total}` : r.status === "writing" ? "Writing the plan" : "Waiting";
  return <span className="w-dot">{text}</span>;
}

/** One report: its row, and under it (once it's ready) the script to read out. */
function ReportRows({ r }: { r: Report }) {
  const del = useFetcher();
  const link = r.status === "done" && r.slug ? `${SITE}/report/${r.slug}` : null;
  const script = r.status === "done" && (r.script.length > 0 || r.notes.length > 0);
  // With a script row under it, the report's two rows read as one.
  const top = script ? { borderBottom: 0, paddingBottom: 6 } : undefined;
  // The store itself, to look at before filming. Under the brand once the report knows it.
  const store = (
    <a href={`https://${r.host}`} target="_blank" rel="noreferrer">
      {r.host}
    </a>
  );
  return (
    <>
      <tr>
        <td className="w-q" style={top}>
          {r.brand ? (
            <>
              {r.brand}
              <div className="w-note">{store}</div>
            </>
          ) : (
            store
          )}
        </td>
        <td style={top}>
          <Status r={r} />
        </td>
        <td style={top}>
          {r.tags.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {r.tags.map((t) => (
                <span key={t} className="w-chip">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
        </td>
        <td className="num" style={top}>
          {perth(r.createdAt)}
        </td>
        <td style={top}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            {link ? (
              <>
                <a className="w-btn w-btn-ghost w-btn-sm" href={`/report/${r.slug}`} target="_blank" rel="noreferrer">
                  Open
                </a>
                <CopyButton text={link} label="Copy link" />
              </>
            ) : null}
            <del.Form
              method="post"
              onSubmit={(e) => !window.confirm(link ? "Delete this report? Its link stops working." : "Delete this report?") && e.preventDefault()}
            >
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={r.id} />
              <button className="w-link-btn" type="submit">
                Delete
              </button>
            </del.Form>
          </div>
        </td>
      </tr>
      {script ? (
        <tr>
          <td colSpan={5} style={{ paddingTop: 0 }}>
            <details className="w-how" style={{ marginTop: 0 }}>
              <summary>Script</summary>
              {r.script.length ? (
                <ol style={{ display: "grid", gap: 6, maxWidth: 760, margin: "8px 0 0", paddingLeft: 22, color: "var(--ink-2)", lineHeight: 1.5 }}>
                  {r.script.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              ) : null}
              {r.notes.length ? (
                <p className="w-note" style={{ maxWidth: 760, marginTop: 10 }}>
                  {r.notes.join(" ")}
                </p>
              ) : null}
              {r.script.length ? (
                <div style={{ marginTop: 10 }}>
                  <CopyButton text={r.script.join("\n")} label="Copy script" />
                </div>
              ) : null}
            </details>
          </td>
        </tr>
      ) : null}
    </>
  );
}

// A long paste of junk shouldn't fill the screen: show the first few that weren't store addresses.
function badLine(bad: string[]): string {
  const shown = bad.slice(0, 8).map((b) => (b.length > 60 ? `${b.slice(0, 57)}...` : b));
  return `Not store addresses: ${shown.join(", ")}${bad.length > shown.length ? ` and ${bad.length - shown.length} more` : ""}.`;
}

export default function AdminReports() {
  const { reports, phoneLink } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const make = useFetcher<typeof action>();
  const busy = make.state !== "idle";
  const result = make.data ?? null;
  const formRef = useRef<HTMLFormElement>(null);
  // A report being deleted leaves the list straight away.
  const deleting = new Set(
    useFetchers()
      .filter((f) => f.formData?.get("intent") === "delete")
      .map((f) => String(f.formData?.get("id"))),
  );
  const shown = reports.filter((r) => !deleting.has(r.id));
  const working = reports.some(running);

  // Fresh progress every 4 seconds while a report is being made, only while this tab is on screen.
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => !document.hidden && revalidator.state === "idle" && revalidator.revalidate(), 4000);
    return () => clearInterval(t);
  }, [working, revalidator]);

  // Once the reports have started, the box keeps only what wasn't started (addresses past the first
  // REPORTS_AT_ONCE, and anything that wasn't an address, to fix): the started stores can't be sent twice.
  useEffect(() => {
    if (make.state !== "idle" || !make.data?.ok) return;
    const box = formRef.current?.elements.namedItem("stores");
    if (box instanceof HTMLTextAreaElement) box.value = (make.data.left ?? []).join("\n");
  }, [make.state, make.data]);

  return (
    <>
      <section className="w-sec">
        <div className="w-sec-head">
          <h2>Store reports</h2>
          <p>Paste Shopify store addresses. Each store gets its own report page for your videos. The script is only here.</p>
        </div>
        <div className="w-box" style={{ padding: 16 }}>
          <make.Form method="post" ref={formRef} className="w-form">
            <input type="hidden" name="intent" value="create" />
            <div className="w-field">
              <label htmlFor="report-stores">Store addresses, one per line</label>
              <textarea
                id="report-stores"
                name="stores"
                className="w-input"
                rows={4}
                placeholder="bondiwash.com"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                style={{ padding: "10px 14px", lineHeight: 1.5, resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <button className="w-btn w-btn-sm" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <span className="w-spin" aria-hidden="true" /> Starting…
                  </>
                ) : (
                  "Make reports"
                )}
              </button>
              <span className="w-note">About 3 minutes each, about US$0.30 each. Up to {REPORTS_AT_ONCE} at a time.</span>
            </div>
            <div aria-live="polite">
              {result && !result.ok ? <p className="w-err">{result.error}</p> : null}
              {result?.ok ? (
                <p className="w-note" style={{ color: "var(--ink-2)" }}>
                  Started {result.created} {result.created === 1 ? "report" : "reports"}.
                  {result.bad.length ? ` ${badLine(result.bad)}` : ""}
                  {result.capped ? ` Only the first ${REPORTS_AT_ONCE} were started: the rest are still in the box.` : ""}
                </p>
              ) : null}
            </div>
          </make.Form>
        </div>
        <div className="w-box" style={{ padding: 16, marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <div style={{ flex: "1 1 280px", minWidth: 0 }}>
            <b style={{ color: "var(--ink)" }}>On your phone, no sign-in</b>
            <p className="w-note" style={{ marginTop: 2 }}>
              A private page that makes one report at a time, with your script. Keep the link private: anyone with it can make reports.
            </p>
          </div>
          <CopyButton text={phoneLink} label="Copy phone link" />
          <a className="w-btn w-btn-ghost w-btn-sm" href={phoneLink} target="_blank" rel="noreferrer">
            Open
          </a>
        </div>
      </section>
      <section className="w-sec">
        <div className="w-sec-head">
          <h2>
            {shown.length} {shown.length === 1 ? "report" : "reports"}
          </h2>
          <p>Newest first. Tags help you pick which stores to film.</p>
        </div>
        <div className="w-box w-table-wrap">
          <table className="w-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Status</th>
                <th>Tags</th>
                <th>Made</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <ReportRows key={r.id} r={r} />
              ))}
            </tbody>
          </table>
          {!shown.length ? <p className="w-empty">No reports yet. Paste a store address above to make the first one.</p> : null}
        </div>
      </section>
    </>
  );
}
