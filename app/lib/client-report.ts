// Reports for Ross's clients (Ross, 5 Nov 2026): a weekly or monthly report as a private link the client opens without
// logging in (firstpicked.com.au/results/<token>), and the email that sends it. The price card promises "Weekly reports"
// and a "Monthly call about updates and future plans", so these are what the client sees of the work.
// Pure rules here, tested in test/client-report.test.ts. lib/client-report.server.ts reads the numbers, saves them with
// the report and sends the email; routes/results.$token.tsx shows a report; routes/dash.clients.$id.reports.tsx makes them.

import { addMonths, dayOf, startScore } from "./clients";
import { addDays } from "./guide-calendar";
import { formatMoney } from "./format";
import { ENGINE_LABELS } from "./plans";
import { AI_ENGINE_LABELS } from "./attribution";
import { CLIENT_SEES, type LogEntry, type LogKind, isExternal } from "./work-log";

export type ReportKind = "week" | "month";
export const isReportKind = (s: unknown): s is ReportKind => s === "week" || s === "month";
export const KIND_LABEL: Record<ReportKind, string> = { week: "Weekly", month: "Monthly" };

// ---------- The days a report covers ----------

export interface Period {
  from: string; // the first day, "2026-10-30" (Perth)
  to: string; // the last day
}

/**
 * The days a report covers, on Ross's calendar (Perth). A weekly report: the 7 days up to and including today. A
 * monthly one: from the day after the same date last month, up to today (5 Nov covers 6 Oct to 5 Nov).
 */
export function reportPeriod(kind: ReportKind, today: string): Period {
  return { from: kind === "week" ? addDays(today, -6) : addDays(addMonths(today, -1), 1), to: today };
}

/** How many days a period has, both ends counted. */
export const periodDays = (p: Period) => Math.round((Date.parse(p.to) - Date.parse(p.from)) / 86_400_000) + 1;

/** The days just before a period, as many of them: "up on the week before" compares with these. */
export function previousPeriod(p: Period): Period {
  const to = addDays(p.from, -1);
  return { from: addDays(to, 1 - periodDays(p)), to };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "30 Oct", or "30 Oct 2026" with the year. Spelled out by hand so the server and the browser always agree. */
export function shortDay(day: string, withYear = false): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1] ?? ""}${withYear ? ` ${y}` : ""}`;
}

/** "30 Oct to 5 Nov"; with years when it crosses one ("29 Dec 2026 to 4 Jan 2027"). */
export function periodLabel(from: string, to: string): string {
  const years = from.slice(0, 4) !== to.slice(0, 4);
  return `${shortDay(from, years)} to ${shortDay(to, years)}`;
}

/** "Weekly report, 30 Oct to 5 Nov". */
export const reportTitle = (d: Pick<ClientReportData, "kind" | "fromDay" | "toDay">) => `${KIND_LABEL[d.kind]} report, ${periodLabel(d.fromDay, d.toDay)}`;

/** "this week" or "this month". */
export const thisPeriod = (kind: ReportKind) => (kind === "week" ? "this week" : "this month");

/** "the week before" or "the month before". */
export const periodBefore = (kind: ReportKind) => (kind === "week" ? "the week before" : "the month before");

// ---------- What a report holds ----------

export interface Money {
  revenue: number;
  orders: number;
  visits: number;
}

export interface ReportWork {
  guidesWritten: string[]; // titles
  guidesLive: { title: string; url: string | null }[]; // url: the page on their store
  changes: { day: string; text: string }[]; // Ross's "Change made" entries
  calls: { day: string; text: string }[];
  checks: number; // AI checks that read their answers
  reddit: { title: string; url: string | null }[]; // Reddit threads replied to
  writers: string[]; // sites AI trusts whose writer we found
}

/**
 * Everything a report shows, saved as ClientReport.data when it's made, so it keeps showing the numbers of that day.
 * `v` says which shape this is: a later change makes v 2 and keeps reading v 1 as it was.
 */
export interface ClientReportData {
  v: 1;
  brand: string;
  host: string;
  currency: string;
  kind: ReportKind;
  fromDay: string;
  toDay: string;
  madeAt: string; // ISO
  startedOn: string; // the day the work started
  month: number; // month N of the work on the report's last day (0 before it starts)
  note: string | null; // Ross's note for the top of the report
  tracking: boolean; // the tracking code is on, so sales from AI can be counted
  sales: Money; // from AI, in the period
  salesBefore: Money; // from AI, in the period before (same length)
  store: { revenue: number; orders: number } | null; // all the store's sales in the period (null without tracking)
  share: number | null; // AI's share of the store's sales (0 to 1)
  byAssistant: ({ name: string } & Money)[];
  score: {
    now: number | null; // the latest AI score (0 to 100)
    periodStart: number | null; // as the period started
    workStart: number | null; // when the work started
    byAssistant: { name: string; score: number }[]; // the latest score per AI assistant
  };
  questions: {
    tracked: number; // buying questions we track
    checked: number; // of them, in the latest AI check
    named: number | null; // of those, how many AI named the store in (null: no check yet)
    top: { text: string; searches: number | null; named: boolean | null }[]; // the 5 with the most searches
  };
  rivals: { brand: string; share: number }[]; // who AI names most instead (share of answers, 0 to 1)
  work: ReportWork;
  next: { day: string; title: string }[]; // the next guides on their calendar (their own days)
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

/** A saved report's data, or null when it isn't a report this code can show. Missing lists read as empty. */
export function readReportData(json: unknown): ClientReportData | null {
  if (!isObj(json) || json.v !== 1 || !isReportKind(json.kind)) return null;
  if (typeof json.brand !== "string" || typeof json.fromDay !== "string" || typeof json.toDay !== "string") return null;
  const d = json as unknown as ClientReportData;
  const work = isObj(json.work) ? (json.work as Partial<ReportWork>) : {};
  const score = isObj(json.score) ? (json.score as Partial<ClientReportData["score"]>) : {};
  const questions = isObj(json.questions) ? (json.questions as Partial<ClientReportData["questions"]>) : {};
  const money = (m: unknown): Money => (isObj(m) ? { revenue: Number(m.revenue) || 0, orders: Number(m.orders) || 0, visits: Number(m.visits) || 0 } : { revenue: 0, orders: 0, visits: 0 });
  return {
    ...d,
    sales: money(json.sales),
    salesBefore: money(json.salesBefore),
    byAssistant: arr(json.byAssistant),
    score: { now: score.now ?? null, periodStart: score.periodStart ?? null, workStart: score.workStart ?? null, byAssistant: arr(score.byAssistant) },
    questions: { tracked: questions.tracked ?? 0, checked: questions.checked ?? 0, named: questions.named ?? null, top: arr(questions.top) },
    rivals: arr(json.rivals),
    work: {
      guidesWritten: arr(work.guidesWritten),
      guidesLive: arr(work.guidesLive),
      changes: arr(work.changes),
      calls: arr(work.calls),
      checks: Number(work.checks) || 0,
      reddit: arr(work.reddit),
      writers: arr(work.writers),
    },
    next: arr(json.next),
  };
}

/** The private link's key: 18 random bytes as URL-safe base64 (24 characters). Checked before any database read. */
export const isReportToken = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(s);

// ---------- Filling it in (lib/client-report.server.ts reads the rows) ----------

export const NOTE_MAX = 1000;

/** Ross's note as typed: line breaks kept, no tags, null when empty. */
export function readReportNote(raw: unknown): { ok: true; note: string | null } | { ok: false; error: string } {
  const s = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[<>]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (s.length > NOTE_MAX) return { ok: false, error: "Please keep the note under 1,000 characters." };
  return { ok: true, note: s || null };
}

// The log's wording for these kinds starts with what happened ("Guide written: ..."); the report has its own headings.
const PREFIX: Partial<Record<LogKind, RegExp>> = {
  "guide-written": /^Guide written:\s*/,
  "guide-live": /^Guide live on their store:\s*/,
  "reddit-replied": /^Replied on Reddit:\s*/,
};

/**
 * The work a client sees, from the work log (lib/work-log.server.ts): only CLIENT_SEES kinds, so Ross's private notes,
 * failures and admin chores never reach a report. Oldest first, like a diary. Only links to the web are kept: the
 * hub's own pages need a login. `writers` are the sites whose writer was found (read on their own, so every site is
 * named, not just the first three the log's line names).
 */
export function workFromLog(entries: LogEntry[], writers: string[] = []): ReportWork {
  const seen = entries.filter((e) => CLIENT_SEES.has(e.kind)).sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const of = (kind: LogKind) => seen.filter((e) => e.kind === kind);
  const title = (e: LogEntry, fallback: string) => e.text.replace(PREFIX[e.kind] ?? /^/, "").trim() || fallback;
  const link = (e: LogEntry) => (e.href && isExternal(e.href) ? e.href : null);
  const said = (e: LogEntry) => ({ day: dayOf(e.at), text: e.text.trim() });
  return {
    guidesWritten: of("guide-written").map((e) => title(e, "A buying guide")),
    guidesLive: of("guide-live").map((e) => ({ title: title(e, "A buying guide"), url: link(e) })),
    changes: of("change").map(said).filter((c) => c.text),
    calls: of("call").map(said).filter((c) => c.text),
    checks: of("check").length,
    reddit: of("reddit-replied").map((e) => ({ title: title(e, "A Reddit thread"), url: link(e) })),
    writers: [...new Set(writers.map((w) => w.trim().toLowerCase()).filter(Boolean))],
  };
}

/** True when the period has any work to show. */
export const hasWork = (w: ReportWork) =>
  Boolean(w.guidesWritten.length || w.guidesLive.length || w.changes.length || w.calls.length || w.checks || w.reddit.length || w.writers.length);

type Scored = { score: number; date: Date | string };

/**
 * The score as the period started: the last one before its first day. With none before it, the first one inside it,
 * but only when a later one follows (one check alone has nothing to compare with).
 */
export function periodStartScore(scores: Scored[], from: string): number | null {
  const sorted = [...scores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const before = sorted.filter((s) => dayOf(s.date) < from).at(-1);
  if (before) return Math.round(before.score);
  const inside = sorted.filter((s) => dayOf(s.date) >= from);
  return inside.length >= 2 ? Math.round(inside[0].score) : null;
}

/** The score when the work started (startScore), when there are at least two checks to compare. */
export const workStartScore = (scores: Scored[], startedOn: string) => (scores.length >= 2 ? startScore(scores, startedOn) : null);

/** The latest score per AI assistant ({ chatgpt: 40, gemini: 12 }), in the order the app lists them. */
export function engineScores(byEngine: unknown): { name: string; score: number }[] {
  if (!isObj(byEngine)) return [];
  return (Object.keys(ENGINE_LABELS) as (keyof typeof ENGINE_LABELS)[])
    .filter((k) => typeof byEngine[k] === "number" && Number.isFinite(byEngine[k]))
    .map((k) => ({ name: ENGINE_LABELS[k], score: Math.round(Math.max(0, Math.min(100, byEngine[k] as number))) }));
}

/** Sales and visits per AI assistant, the biggest first. */
export function assistantRows(
  orders: { engine: string; revenue: number; orders: number }[],
  visits: { engine: string; visits: number }[],
): ({ name: string } & Money)[] {
  const rows = new Map<string, Money>();
  const row = (engine: string) => rows.get(engine) ?? { revenue: 0, orders: 0, visits: 0 };
  for (const o of orders) {
    const r = row(o.engine);
    rows.set(o.engine, { ...r, revenue: r.revenue + o.revenue, orders: r.orders + o.orders });
  }
  for (const v of visits) {
    const r = row(v.engine);
    rows.set(v.engine, { ...r, visits: r.visits + v.visits });
  }
  return [...rows.entries()]
    .map(([engine, m]) => ({ name: AI_ENGINE_LABELS[engine as keyof typeof AI_ENGINE_LABELS] ?? "Other AI", ...m }))
    .filter((r) => r.revenue > 0 || r.orders > 0 || r.visits > 0)
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || b.visits - a.visits || a.name.localeCompare(b.name));
}

/**
 * The buying questions part: how many are tracked, how many the latest AI check asked, how many of those named the
 * store, and the 5 with the most searches (from those the check asked, when it asked any).
 */
export function questionSummary(
  rows: { text: string; volume: number | null; active: boolean; rate: number | null }[],
  scanned: boolean,
): ClientReportData["questions"] {
  const active = rows.filter((r) => r.active);
  const checked = active.filter((r) => r.rate !== null);
  const pool = checked.length ? checked : active;
  const top = [...pool]
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1))
    .slice(0, 5)
    .map((r) => ({ text: r.text, searches: r.volume, named: r.rate === null ? null : r.rate > 0 }));
  return { tracked: active.length, checked: checked.length, named: scanned ? checked.filter((r) => (r.rate ?? 0) > 0).length : null, top };
}

// ---------- Words for numbers ----------

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

/** "1 order", "7 orders". */
export const plural = (n: number, one: string, many: string) => `${fmt(n)} ${Math.round(n) === 1 ? one : many}`;

export type Tone = "up" | "down" | "same";

/** How sales changed on the period before: "Up 25% from $1,000 the week before" (green), down (red), the same (grey). */
export function moneyChange(now: number, before: number, currency: string, kind: ReportKind): { tone: Tone; text: string } {
  const prev = periodBefore(kind);
  const n = Math.round(now * 100);
  const b = Math.round(before * 100);
  if (n === b) return { tone: "same", text: `The same as ${prev}` };
  if (b <= 0) return { tone: "up", text: `Up from ${formatMoney(0, currency)} ${prev}` };
  const pct = Math.abs(Math.round(((n - b) / b) * 100));
  return { tone: n > b ? "up" : "down", text: `${n > b ? "Up" : "Down"} ${pct ? `${fmt(pct)}%` : "less than 1%"} from ${formatMoney(before, currency)} ${prev}` };
}

/** A change in AI score points: "Up 6 points this week", "Down 1 point since we started", "No change this week". */
export function pointsChange(now: number | null, then: number | null, when: string): { tone: Tone; text: string } | null {
  if (now === null || then === null) return null;
  const n = Math.round(now) - Math.round(then);
  if (!n) return { tone: "same", text: `No change ${when}` };
  return { tone: n > 0 ? "up" : "down", text: `${n > 0 ? "Up" : "Down"} ${plural(Math.abs(n), "point", "points")} ${when}` };
}

/** AI's share of the store's sales: "4%", "less than 1%", or null when there is nothing to share. */
export function shareText(share: number | null): string | null {
  if (share === null || !Number.isFinite(share) || share <= 0) return null;
  return share < 0.01 ? "less than 1%" : `${Math.round(share * 100)}%`;
}

/** "Sarah" from "Sarah Jones"; null when there is no name. */
export function firstName(contactName: string | null | undefined): string | null {
  const first = String(contactName ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.slice(0, 40) : null;
}

/** The two or three numbers at the top of the email: sales from AI, the AI score, guides written. */
export function headlines(d: ClientReportData): { label: string; value: string; sub: string }[] {
  const out: { label: string; value: string; sub: string }[] = [];
  out.push(
    d.tracking
      ? { label: "Sales from AI", value: formatMoney(d.sales.revenue, d.currency), sub: plural(d.sales.orders, "order", "orders") }
      : { label: "Sales from AI", value: "Not counted yet", sub: "The tracking code isn’t on your store yet" },
  );
  if (d.score.now !== null) {
    const change = pointsChange(d.score.now, d.score.periodStart, thisPeriod(d.kind));
    out.push({ label: "Your AI score", value: `${d.score.now} out of 100`, sub: change?.text ?? "" });
  }
  if (d.work.guidesWritten.length) out.push({ label: "Guides written", value: fmt(d.work.guidesWritten.length), sub: thisPeriod(d.kind) });
  return out;
}

// ---------- The email ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The home page's purple (white text on it passes 4.7:1) and the logo's light circle, as in the sign-in email. */
const PURPLE = "#6c5cf2";
const LILAC = "#cdc6fc";

/**
 * The email that sends a report: a hello, the period, two or three numbers, one purple button to the report and
 * "Questions? Just reply to this email." In tables, like the sign-in email (lib/web-auth.server.ts), so every inbox
 * shows it the same. Every bit of text from the store or Ross is escaped.
 */
export function reportEmail(d: ClientReportData, url: string, contactName: string | null): { subject: string; html: string; text: string } {
  const kind = KIND_LABEL[d.kind].toLowerCase();
  const name = firstName(contactName);
  const period = periodLabel(d.fromDay, d.toDay);
  const hello = name ? `Hi ${name},` : "Hi there,";
  const intro = `Here is your ${kind} report for ${d.brand}, ${period}.`;
  const nums = headlines(d);
  const font = "font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;";
  const rows = nums
    .map(
      (n, i) => `<tr>
<td style="padding:14px 16px;${i ? "border-top:1px solid #ececef;" : ""}text-align:left;font-size:14px;line-height:1.4;color:#53565f;">${esc(n.label)}</td>
<td style="padding:14px 16px;${i ? "border-top:1px solid #ececef;" : ""}text-align:right;font-size:16px;line-height:1.35;font-weight:700;color:#0e0e13;">${esc(n.value)}${n.sub ? `<br><span style="font-size:12.5px;font-weight:400;color:#6e717a;">${esc(n.sub)}</span>` : ""}</td>
</tr>`,
    )
    .join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;">${esc(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:36px 14px;${font}">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td align="center" style="padding:0 0 20px;font-size:21px;font-weight:700;letter-spacing:-0.02em;color:#0e0e13;">
<span style="display:inline-block;width:15px;height:15px;border-radius:50%;background:${LILAC};vertical-align:middle;"></span><span style="display:inline-block;width:15px;height:15px;border-radius:50%;background:${PURPLE};margin-left:-6px;margin-right:9px;vertical-align:middle;"></span>FirstPicked
</td></tr>
<tr><td style="background:#ffffff;border:1px solid #e8e8ec;border-radius:20px;padding:32px 28px;">
<p style="margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#6e717a;">${esc(KIND_LABEL[d.kind])} report</p>
<h1 style="margin:0 0 14px;font-size:23px;line-height:1.3;font-weight:700;letter-spacing:-0.01em;color:#0e0e13;">${esc(d.brand)}</h1>
<p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#53565f;">${esc(hello)}</p>
<p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#53565f;">${esc(intro)}</p>
${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 26px;border:1px solid #ececef;border-radius:14px;border-collapse:separate;">\n${rows}\n</table>` : ""}
<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 24px;"><tr>
<td bgcolor="${PURPLE}" style="background:${PURPLE};border-radius:12px;">
<a href="${esc(url)}" style="display:inline-block;padding:14px 30px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">Open your report</a>
</td></tr></table>
<p style="margin:0;font-size:15px;line-height:1.6;color:#53565f;text-align:center;">Questions? Just reply to this email.</p>
</td></tr>
<tr><td align="center" style="padding:20px 12px 0;font-size:12px;line-height:1.6;color:#6e717a;">
Made by FirstPicked for ${esc(d.brand)}.<br>
Button not working? Copy this link: <a href="${esc(url)}" style="color:#6e717a;word-break:break-all;">${esc(url)}</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  const lines = nums.map((n) => `${n.label}: ${n.value}${n.sub ? ` (${n.sub})` : ""}`);
  const text = [hello, "", intro, "", ...lines, ...(lines.length ? [""] : []), `Open your report: ${url}`, "", "Questions? Just reply to this email.", "", `Made by FirstPicked for ${d.brand}.`].join("\n");
  return { subject: `Your ${kind} report: ${d.brand}`, html, text };
}
