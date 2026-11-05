// Small shared pieces for the agency hub (Ross, 5 Nov 2026): a brand's mark, status and health dots, score changes, a
// tiny score line, the "Needs you" list, the work log list and a bar chart by day. Styles: app/styles/hub.css.

import { Link, useFetcher } from "react-router";
import { type Alert, type ClientStatus, type Health, HEALTH_LABEL, HUB_TZ, STATUS_LABEL } from "../lib/clients";
import { LOG_LABEL, LOG_TONE, type LogEntry, isExternal } from "../lib/work-log";
import { dayLabel } from "../lib/guide-calendar";

/** The answer of a client's buttons (the client frame's action, routes/dash.clients.$id.tsx). */
export type ClientActionResult = { ok: true; message: string } | { ok: false; error: string };

/** "AU" -> the Australian flag; else the brand's first letter. */
export const flagOf = (cc: string | null | undefined) =>
  cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : null;

/** A brand's square mark: its first letter on a soft grey square (big on cards, small in lists). */
export function BrandMark({ name, size = 36 }: { name: string; size?: number }) {
  const letter = (name.replace(/^(the|www\.)\s*/i, "").match(/[\p{L}\p{N}]/u)?.[0] ?? "?").toUpperCase();
  return (
    <span className="h-mark" style={{ width: size, height: size, fontSize: Math.round(size * 0.44), borderRadius: Math.round(size * 0.28) }} aria-hidden="true">
      {letter}
    </span>
  );
}

/** Active (green), paused or ended (grey). */
export function StatusChip({ status }: { status: ClientStatus }) {
  return <span className={`w-chip${status === "active" ? " ok" : ""}`}>{STATUS_LABEL[status]}</span>;
}

/** A client's dot and what it means: all good, needs a look, something broke, not running. */
export function HealthDot({ health, label = true }: { health: Health; label?: boolean }) {
  const tone = health === "ok" ? "ok" : health === "warn" ? "warn" : health === "no" ? "no" : "";
  return (
    <span className={`w-dot${tone ? ` ${tone}` : ""}`} title={HEALTH_LABEL[health]}>
      {label ? HEALTH_LABEL[health] : <span className="h-sr">{HEALTH_LABEL[health]}</span>}
    </span>
  );
}

/** A change in points: "+12" green, "-3" red, "No change" grey. */
export function Delta({ value, unit = "" }: { value: number | null; unit?: string }) {
  if (value === null) return null;
  const n = Math.round(value);
  if (!n) return <span className="h-delta">No change</span>;
  return (
    <span className={`h-delta ${n > 0 ? "up" : "down"}`}>
      {n > 0 ? "+" : "−"}
      {Math.abs(n)}
      {unit}
    </span>
  );
}

/** A small line of the last scores (0 to 100), the latest as a dot. Hidden from screen readers: the number says it. */
export function Sparkline({ values, width = 96, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const pad = 3;
  const lo = Math.max(0, Math.min(...values) - 5);
  const hi = Math.min(100, Math.max(...values) + 5);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [pad + (i * (width - pad * 2)) / (values.length - 1), pad + (1 - (v - lo) / span) * (height - pad * 2)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg className="h-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill="currentColor" />
    </svg>
  );
}

/** A button that runs one of a client's actions (Try again, Check now, Make the report...) without leaving the page. */
export function ClientActionButton({
  shopId,
  intent,
  label,
  extra,
  className = "w-btn w-btn-ghost w-btn-sm",
}: {
  shopId: string;
  intent: string;
  label: string;
  extra?: Record<string, string>;
  className?: string;
}) {
  const fetcher = useFetcher<ClientActionResult>();
  const busy = fetcher.state !== "idle";
  const res = fetcher.state === "idle" ? fetcher.data : undefined;
  return (
    <fetcher.Form method="post" action={`/dash/clients/${shopId}`} className="h-act">
      <input type="hidden" name="intent" value={intent} />
      {Object.entries(extra ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className={className} type="submit" disabled={busy}>
        {busy ? <span className="w-spin" aria-hidden="true" /> : null}
        {label}
      </button>
      {res ? (
        <span className={res.ok ? "h-act-ok" : "h-act-err"} role="status">
          {res.ok ? res.message : res.error}
        </span>
      ) : null}
    </fetcher.Form>
  );
}

/** One thing that needs Ross. `client` names the brand when the list mixes clients (the hub). */
export type AlertRow = Alert & { shopId: string; client?: string };

/** The "Needs you" list: worst first, each with its button. */
export function AlertList({ alerts, empty = "Nothing needs you right now." }: { alerts: AlertRow[]; empty?: string }) {
  if (!alerts.length) return <p className="h-alerts-empty">{empty}</p>;
  return (
    <ul className="h-alerts">
      {alerts.map((a) => (
        <li key={`${a.shopId}-${a.key}`} className={`h-alert ${a.tone}`}>
          <span className="h-alert-text">
            {a.client ? (
              <Link to={`/dash/clients/${a.shopId}`} className="h-alert-client">
                {a.client}
              </Link>
            ) : null}
            <span>{a.text}</span>
          </span>
          {a.intent ? (
            <ClientActionButton shopId={a.shopId} intent={a.intent.name} label={a.label ?? "Do it"} extra={a.intent.kind ? { kind: a.intent.kind } : undefined} />
          ) : a.to ? (
            <Link to={a.to} className="w-btn w-btn-ghost w-btn-sm" prefetch="intent">
              {a.label ?? "Open"}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** "9:41 am" on Ross's clock (Perth). */
export const hubTime = (iso: string) => new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", timeZone: HUB_TZ });

/** "Today", "Yesterday" or "Wed 4 Nov". */
export function dayHeading(day: string, today: string, yesterday: string) {
  return day === today ? "Today" : day === yesterday ? "Yesterday" : dayLabel(day, "long");
}

/** One work log entry: the time, what kind, what happened (with its link), and a delete button for Ross's own. */
export function LogItem({ e, client }: { e: LogEntry; client?: { name: string; shopId: string } }) {
  const fetcher = useFetcher<ClientActionResult>();
  const deleting = fetcher.state !== "idle";
  if (deleting || (fetcher.data && fetcher.data.ok)) return null;
  const tone = LOG_TONE[e.kind];
  const text = e.href ? (
    isExternal(e.href) ? (
      <a href={e.href} target="_blank" rel="noreferrer">
        {e.text}
      </a>
    ) : (
      <Link to={e.href} prefetch="intent">
        {e.text}
      </Link>
    )
  ) : (
    <span>{e.text}</span>
  );
  return (
    <li className="h-log-item">
      <time dateTime={e.at}>{hubTime(e.at)}</time>
      <span className={`w-pill${tone ? ` ${tone}` : ""}`}>{LOG_LABEL[e.kind]}</span>
      <span className="h-log-text">
        {client ? (
          <Link to={`/dash/clients/${client.shopId}`} className="h-log-client">
            {client.name}
          </Link>
        ) : null}
        {text}
      </span>
      {e.noteId ? (
        <fetcher.Form method="post" action={`/dash/clients/${e.shopId}`} className="h-log-del">
          <input type="hidden" name="intent" value="delete-note" />
          <input type="hidden" name="noteId" value={e.noteId} />
          <button type="submit" className="w-icon-btn" title="Delete this entry" aria-label="Delete this entry">
            ×
          </button>
        </fetcher.Form>
      ) : null}
    </li>
  );
}

/** The work log by day: "Today", "Yesterday", "Mon 2 Nov", newest first. `names` adds the brand to each entry. */
export function LogDays({
  days,
  today,
  yesterday,
  names,
  empty = "Nothing logged yet.",
}: {
  days: { day: string; entries: LogEntry[] }[];
  today: string;
  yesterday: string;
  names?: Record<string, string>;
  empty?: string;
}) {
  if (!days.length) return <p className="w-empty">{empty}</p>;
  return (
    <div className="h-log">
      {days.map((d) => (
        <section key={d.day} className="h-log-day">
          <h3>{dayHeading(d.day, today, yesterday)}</h3>
          <ul>
            {d.entries.map((e) => (
              <LogItem key={e.id} e={e} client={names ? { shopId: e.shopId, name: names[e.shopId] ?? "Client" } : undefined} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** One bar a day (or a week), with the biggest number at the top. `label` and `unit` describe it for screen readers. */
export function DayBars({
  days,
  label,
  unit,
  color = "#cdc4f7",
  height = 160,
  format = (n: number) => n.toLocaleString("en-US"),
}: {
  days: { day: string; value: number }[];
  label: string;
  unit: [string, string];
  color?: string;
  height?: number;
  format?: (n: number) => string;
}) {
  const max = Math.max(...days.map((d) => d.value), 0);
  const total = days.reduce((n, d) => n + d.value, 0);
  const word = (n: number) => (n === 1 ? unit[0] : unit[1]);
  return (
    <div
      className="w-chart"
      style={{ height }}
      role="img"
      aria-label={`${label}: ${format(total)} ${word(total)} in ${days.length} days, at most ${format(max)} in a day.`}
    >
      <span className="w-chart-max">{format(max)}</span>
      {days.map((d) => (
        <div key={d.day} className="w-col" title={`${dayLabel(d.day)}: ${format(d.value)} ${word(d.value)}`}>
          <div className="w-col-bar">
            <div className="w-col-stack" style={{ height: max ? `${(d.value / max) * 100}%` : 0 }}>
              {d.value ? <span style={{ flexGrow: 1, background: color }} /> : null}
            </div>
          </div>
          <span className="w-col-day">{Number(d.day.slice(8, 10))}</span>
        </div>
      ))}
    </div>
  );
}
