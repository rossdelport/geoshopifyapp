import { useEffect, useRef } from "react";
import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { requireClient } from "../lib/clients.server";
import { workLog } from "../lib/work-log.server";
import { byDay, countKinds, logSummary } from "../lib/work-log";
import { NOTE_HINT, NOTE_KINDS, NOTE_LABEL, hubDay } from "../lib/clients";
import { STAT_SPANS, readSpan } from "../lib/store-stats";
import { PageHead, Tabs } from "../components/web";
import { type ClientActionResult, LogDays } from "../components/hub";
import styles from "../styles/client-pages.css?url";

// One client's work log in the agency hub (Ross, 5 Nov 2026: "see what was updated or created on the daily basis"):
// everything done for them, day by day, newest first. Most of it comes from the work itself (guides, AI checks,
// Reddit threads, sales, reports); Ross adds his own here: a change he made, a call, or a private note.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireClient(request);
  const days = readSpan(new URL(request.url).searchParams.get("days"));
  const now = new Date();
  const today = hubDay(now);
  const entries = await workLog([shop.id], hubDay(now, days - 1), today);
  return {
    shopId: shop.id,
    days,
    today,
    yesterday: hubDay(now, 1),
    summary: logSummary(countKinds(entries)),
    log: byDay(entries),
  };
};

/** Ross's own entry: what kind, what happened, and the day (today unless he picks an earlier one). */
function AddEntry({ shopId, today }: { shopId: string; today: string }) {
  const fetcher = useFetcher<ClientActionResult>();
  const form = useRef<HTMLFormElement>(null);
  const busy = fetcher.state !== "idle";
  const done = fetcher.state === "idle" ? fetcher.data : undefined;

  // Saved: empty the form for the next one.
  useEffect(() => {
    if (done?.ok) form.current?.reset();
  }, [done]);

  return (
    <section className="w-sec" aria-labelledby="add-h">
      <div className="w-sec-head">
        <h2 id="add-h">Add to the work log</h2>
        <p>Log what you did by hand, like fixing product pages or a call with them.</p>
      </div>
      <fetcher.Form ref={form} method="post" action={`/dash/clients/${shopId}`} className="w-box w-box-pad cp-add">
        <input type="hidden" name="intent" value="add-note" />
        <fieldset className="cp-choice">
          <legend>What kind</legend>
          <div className="cp-options">
            {NOTE_KINDS.map((k, i) => (
              <label key={k} className="cp-option">
                <input type="radio" name="kind" value={k} defaultChecked={i === 0} />
                <b>{NOTE_LABEL[k]}</b>
                <span className="w-note">{NOTE_HINT[k]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="w-field">
          <label htmlFor="cp-note-text">What happened</label>
          <textarea id="cp-note-text" name="text" className="w-input cp-textarea" required maxLength={1000} placeholder="Fixed 5 product pages: clearer sizes and who each one is for." />
        </div>
        <div className="cp-row">
          <div className="w-field">
            <label htmlFor="cp-note-day">Day</label>
            <input id="cp-note-day" type="date" name="day" className="w-input" defaultValue={today} max={today} required />
          </div>
          <button type="submit" className="w-btn" disabled={busy}>
            {busy ? <span className="w-spin" aria-hidden="true" /> : null}
            Add to the log
          </button>
          {done?.ok ? (
            <span className="cp-msg-ok" role="status">
              {done.message}
            </span>
          ) : null}
        </div>
        {done && !done.ok ? (
          <p className="w-err" role="alert">
            {done.error}
          </p>
        ) : null}
      </fetcher.Form>
    </section>
  );
}

export default function ClientLog() {
  const { shopId, days, today, yesterday, summary, log } = useLoaderData<typeof loader>();
  return (
    <>
      <PageHead
        title="Work log"
        right={<Tabs label="Days to show" items={STAT_SPANS.map((n) => ({ to: `?days=${n}`, label: `${n} days`, active: n === days }))} />}
      />

      <AddEntry shopId={shopId} today={today} />

      <section className="w-sec" aria-labelledby="log-h">
        <div className="w-sec-head">
          <h2 id="log-h">Day by day</h2>
          <p className="cp-summary">{summary.length ? `In the last ${days} days: ${summary.join(" · ")}` : `Nothing in the last ${days} days yet.`}</p>
        </div>
        {log.length ? (
          <LogDays days={log} today={today} yesterday={yesterday} />
        ) : (
          <div className="w-box">
            <p className="w-empty">Nothing logged in the last {days} days.</p>
          </div>
        )}
      </section>
    </>
  );
}
