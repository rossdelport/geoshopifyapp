import { useEffect, useRef } from "react";
import type { ActionFunctionArgs, HeadersFunction, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { createReports, deleteReport, listReports } from "../lib/store-report.server";
import { makerKeyOk } from "../lib/report-maker.server";
import { SITE } from "../lib/tools/site";
import { CopyButton } from "../components/web";
import webStyles from "../styles/web.css?url";
import styles from "../styles/report-maker.css?url";

// The phone report maker (Ross, 4 Nov 2026): one page, no sign-in. Type a store's address, and about 3 minutes
// later its report is ready to open and film, with Ross's script under it. It does what Admin > Reports does
// (same createReports, same 40-a-day cap), at a private link instead of behind a sign-in (lib/report-maker.server.ts).
// A wrong key is a plain 404, so the page can't be found by guessing.

type Report = Awaited<ReturnType<typeof listReports>>[number];

const SHOWN = 15;

const notFound = () => new Response("Not found", { status: 404 });

export const loader = async ({ params }: LoaderFunctionArgs) => {
  if (!makerKeyOk(params.key)) throw notFound();
  return { reports: await listReports(SHOWN) };
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  if (!makerKeyOk(params.key)) throw notFound();
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent !== "create" && intent !== "rerun") return null;
  try {
    const result = await createReports(String(form.get("stores") ?? ""), "phone link");
    // Run again: the new report takes the failed one's place in the list.
    if (intent === "rerun" && result.ok) await deleteReport(String(form.get("id") ?? ""));
    return result;
  } catch (err) {
    console.error("[report maker] couldn't start a report:", err);
    return { ok: false as const, error: "Something went wrong starting the report. Please try again." };
  }
};

// Never cached, never in search results, and the private link never goes out in a Referer header.
export const headers: HeadersFunction = () =>
  new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });

export const meta: MetaFunction = () => [{ title: "Report maker | GEO" }, { name: "robots", content: "noindex" }];

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: webStyles },
  { rel: "stylesheet", href: styles },
];

const running = (r: Report) => r.status !== "done" && r.status !== "failed";

// Perth time: Ross films from Perth.
const perth = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Perth" });

function Progress({ r }: { r: Report }) {
  const text =
    r.status === "reading" ? "Reading the store" : r.status === "asking" ? `Asking AI: ${r.done} of ${r.total}` : r.status === "writing" ? "Writing the plan" : "Waiting to start";
  // Rough share of the work: reading 5%, asking AI up to 85%, writing 92%.
  const share = r.status === "reading" ? 5 : r.status === "asking" ? 5 + Math.round((80 * r.done) / Math.max(1, r.total)) : r.status === "writing" ? 92 : 2;
  return (
    <>
      <span className="w-dot">{text}</span>
      <div className="rm-bar" aria-hidden="true">
        <i style={{ transform: `scaleX(${share / 100})` }} />
      </div>
    </>
  );
}

function Card({ r, first }: { r: Report; first: boolean }) {
  const again = useFetcher<typeof action>();
  const link = r.status === "done" && r.slug ? `${SITE}/report/${r.slug}` : null;
  const failed = again.data && !again.data.ok ? again.data.error : null;
  return (
    <li className="rm-card">
      <div className="rm-top">
        <div className="rm-name">
          <b>{r.brand || r.host}</b>
          <span>
            {r.brand ? `${r.host} · ` : ""}
            {perth(r.createdAt)}
          </span>
        </div>
        {r.status === "done" ? <span className="w-dot ok">Ready</span> : r.status === "failed" ? <span className="w-dot no">Failed</span> : null}
      </div>

      {running(r) ? <Progress r={r} /> : null}

      {r.status === "failed" ? (
        <again.Form method="post" className="rm-again">
          <p className="w-note">{r.error || "Please run it again."}</p>
          <input type="hidden" name="intent" value="rerun" />
          <input type="hidden" name="stores" value={r.host} />
          <input type="hidden" name="id" value={r.id} />
          <button className="w-btn w-btn-ghost" type="submit" disabled={again.state !== "idle"}>
            {again.state !== "idle" ? "Starting…" : "Run again"}
          </button>
          {failed ? <p className="w-err">{failed}</p> : null}
        </again.Form>
      ) : null}

      {link ? (
        <>
          {r.answers !== null ? (
            <p className="w-note">
              AI named them {r.named ?? 0} of {r.answers} times. {r.moves} {r.moves === 1 ? "move" : "moves"}.
            </p>
          ) : null}
          {r.tags.length ? (
            <div className="rm-tags">
              {r.tags.map((t) => (
                <span key={t} className="w-chip">
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <div className="rm-actions">
            <a className="w-btn" href={`/report/${r.slug}`} target="_blank" rel="noreferrer">
              Open report
            </a>
            <CopyButton text={link} label="Copy link" className="w-btn w-btn-ghost" />
          </div>
          {r.script.length || r.notes.length ? (
            <details className="rm-script" open={first}>
              <summary>Script</summary>
              {r.script.length ? (
                <ol>
                  {r.script.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              ) : null}
              {r.notes.length ? <p className="w-note">{r.notes.join(" ")}</p> : null}
              {r.script.length ? <CopyButton text={r.script.join("\n")} label="Copy script" /> : null}
            </details>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

export default function ReportMaker() {
  const { reports } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const make = useFetcher<typeof action>();
  const busy = make.state !== "idle";
  const result = make.data ?? null;
  const formRef = useRef<HTMLFormElement>(null);
  const working = reports.some(running);
  const firstDone = reports.find((r) => r.status === "done")?.id;

  // Fresh progress every 4 seconds while a report is being made, only while the page is on screen.
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => !document.hidden && revalidator.state === "idle" && revalidator.revalidate(), 4000);
    return () => clearInterval(t);
  }, [working, revalidator]);

  // Once a report has started, the box is cleared (it keeps anything that wasn't started).
  useEffect(() => {
    if (make.state !== "idle" || !make.data?.ok) return;
    const box = formRef.current?.elements.namedItem("stores");
    if (box instanceof HTMLInputElement) box.value = (make.data.left ?? []).join(" ");
  }, [make.state, make.data]);

  return (
    <main className="w rm">
      <header className="rm-head">
        <span className="rm-mark" aria-hidden="true">
          <i />
          <i />
        </span>
        <span>GEO</span>
        <em>Report maker</em>
      </header>

      <make.Form method="post" ref={formRef} className="rm-form">
        <input type="hidden" name="intent" value="create" />
        <label htmlFor="rm-store">Store website</label>
        <input
          id="rm-store"
          name="stores"
          className="w-input"
          type="text"
          inputMode="url"
          placeholder="bondiwash.com"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
        />
        <button className="w-btn" type="submit" disabled={busy}>
          {busy ? (
            <>
              <span className="w-spin" aria-hidden="true" /> Starting…
            </>
          ) : (
            "Make report"
          )}
        </button>
        <div aria-live="polite">
          {result && !result.ok ? <p className="w-err">{result.error}</p> : null}
          {result?.ok ? (
            <p className="w-note">
              Started. It takes about 3 minutes. You can leave this page open.
              {result.bad.length ? ` Not a store address: ${result.bad.slice(0, 3).join(", ")}.` : ""}
            </p>
          ) : null}
        </div>
        <p className="w-note">About US$0.30 a report. Keep this link private: anyone with it can make reports.</p>
      </make.Form>

      {reports.length ? (
        <ul className="rm-list">
          {reports.map((r) => (
            <Card key={r.id} r={r} first={r.id === firstDone} />
          ))}
        </ul>
      ) : (
        <p className="w-note rm-empty">No reports yet. Type a store&apos;s website above to make the first one.</p>
      )}
    </main>
  );
}
