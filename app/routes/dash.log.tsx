import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { useEffect, useRef, useState } from "react";
import { Form, Link, useFetcher, useLoaderData } from "react-router";
import { PageHead } from "../components/web";
import { BrandMark, type ClientActionResult, LogItem, dayHeading } from "../components/hub";
import { requireHubAdmin } from "../lib/clients.server";
import { clientMenu } from "../lib/hub.server";
import { workLog } from "../lib/work-log.server";
import { byClient, countKinds, logSummary } from "../lib/work-log";
import { CLIENT_STATUSES, NOTE_HINT, NOTE_KINDS, NOTE_LABEL, type NoteKind, STATUS_LABEL, hubDay } from "../lib/clients";
import { addDays, dayLabel } from "../lib/guide-calendar";
import { pickDay } from "../lib/hub-pages";
import styles from "../styles/hub-pages.css?url";

// firstpicked.com.au/dash/log: the agency hub's daily log (Ross, 5 Nov 2026: "see what was updated or created on the
// daily basis"). One day at a time (Perth), every client's entries under their name: guides written and live, AI
// checks, Reddit threads, sales from AI, reports, and what Ross logged himself, which he can add here too.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // The client list is read while the sign-in is checked (it's only sent back to an admin), to save a round trip.
  const [, clients] = await Promise.all([requireHubAdmin(request), clientMenu()]);
  const today = hubDay();
  const day = pickDay(new URL(request.url).searchParams.get("day"), today);
  const entries = await workLog(clients.map((c) => c.shopId), day, day);
  return { today, yesterday: addDays(today, -1), day, clients, groups: byClient(entries, clients), summary: logSummary(countKinds(entries)).join(" · ") };
};

type Client = { shopId: string; name: string; status: string };

/** "Log what you did": a change, a call or a private note for one client, on the day on screen. */
function NoteForm({ clients, day, today }: { clients: Client[]; day: string; today: string }) {
  const fetcher = useFetcher<ClientActionResult>();
  const [shopId, setShopId] = useState(clients[0].shopId); // active clients come first
  const [kind, setKind] = useState<NoteKind>("change");
  const text = useRef<HTMLTextAreaElement>(null);
  const busy = fetcher.state !== "idle";
  const res = fetcher.state === "idle" ? fetcher.data : undefined;

  // Saved: empty the box for the next one (the client and kind stay, for logging a few in a row).
  useEffect(() => {
    if (res?.ok && text.current) text.current.value = "";
  }, [res]);

  return (
    <fetcher.Form method="post" action={`/dash/clients/${shopId}`}>
      <div>
        <h2>Log what you did</h2>
        <p className="w-note">{day === today ? "It goes on today’s log." : `It goes on the log for ${dayLabel(day)}.`}</p>
      </div>
      <input type="hidden" name="intent" value="add-note" />
      <input type="hidden" name="day" value={day} />
      <div className="w-field">
        <label htmlFor="log-client">Client</label>
        <select className="w-input" id="log-client" value={shopId} onChange={(e) => setShopId(e.target.value)}>
          {CLIENT_STATUSES.map((s) => {
            const list = clients.filter((c) => c.status === s);
            return list.length ? (
              <optgroup key={s} label={STATUS_LABEL[s]}>
                {list.map((c) => (
                  <option key={c.shopId} value={c.shopId}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </div>
      <fieldset>
        <legend className="hp-legend">What kind</legend>
        <div className="hp-kinds">
          {NOTE_KINDS.map((k) => (
            <label key={k} className="hp-kind">
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
              {NOTE_LABEL[k]}
            </label>
          ))}
        </div>
        <p className="w-note hp-kind-hint">{NOTE_HINT[kind]}</p>
      </fieldset>
      <div className="w-field">
        <label htmlFor="log-text">What you did</label>
        <textarea ref={text} className="w-input hp-textarea" id="log-text" name="text" required maxLength={1000} rows={3} />
      </div>
      <div className="hp-btns">
        <button className="w-btn" type="submit" disabled={busy}>
          {busy ? <span className="w-spin" aria-hidden="true" /> : null}
          Add to the log
        </button>
      </div>
      {res ? (
        <p className={res.ok ? "hp-ok" : "w-err-text"} role="status">
          {res.ok ? res.message : res.error}
        </p>
      ) : null}
    </fetcher.Form>
  );
}

export default function DailyLog() {
  const { today, yesterday, day, clients, groups, summary } = useLoaderData<typeof loader>();
  const heading = dayHeading(day, today, yesterday);
  const long = dayLabel(day, "long");
  const next = addDays(day, 1);
  const list = groups.length ? (
    <div className="h-log">
      {groups.map(({ client, entries }) => (
        <section key={client.shopId} className="h-log-day">
          <h3>
            <Link to={`/dash/clients/${client.shopId}/log`} className="hp-log-client" prefetch="intent">
              <BrandMark name={client.name} size={20} />
              {client.name}
            </Link>
          </h3>
          <ul>
            {entries.map((e) => (
              <LogItem key={e.id} e={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  ) : (
    <div className="w-box">
      <p className="w-empty">
        Nothing logged on this day.
        {clients.length ? null : (
          <>
            {" "}
            <Link to="/dash/clients/new" prefetch="intent">
              Add your first client
            </Link>
          </>
        )}
      </p>
    </div>
  );

  return (
    <>
      <PageHead
        title="Daily log"
        right={
          <>
            <Link to={`/dash/log?day=${addDays(day, -1)}`} className="w-btn w-btn-ghost w-btn-sm" prefetch="intent">
              ‹ Previous day
            </Link>
            {day < today ? (
              <Link to={next === today ? "/dash/log" : `/dash/log?day=${next}`} className="w-btn w-btn-ghost w-btn-sm" prefetch="intent">
                Next day ›
              </Link>
            ) : null}
            <Form method="get" className="hp-day-form" key={day}>
              <label className="h-sr" htmlFor="log-day">
                Pick a day
              </label>
              <input className="w-input hp-date" type="date" id="log-day" name="day" defaultValue={day} max={today} required />
              <button className="w-btn w-btn-ghost w-btn-sm" type="submit">
                Go
              </button>
            </Form>
            {day !== today ? (
              <Link to="/dash/log" className="w-btn w-btn-ghost w-btn-sm" prefetch="intent">
                Today
              </Link>
            ) : null}
          </>
        }
      />

      <div>
        <div className="hp-day-head">
          <h2>{heading}</h2>
          {heading !== long ? <span>{long}</span> : null}
        </div>
        {summary ? <p className="hp-sum">{summary}</p> : null}
      </div>

      {clients.length ? (
        <div className="hp-log">
          {list}
          <aside className="w-box hp-log-side" aria-label="Log what you did">
            <NoteForm clients={clients} day={day} today={today} />
          </aside>
        </div>
      ) : (
        list
      )}
    </>
  );
}
