// The work log: what happened for each client, day by day (Ross, 5 Nov 2026: "see what was updated or created on the
// daily basis"). Most entries come from the work itself (guides, AI checks, Reddit threads, sales, reports); Ross adds
// his own (a change he made, a call, a private note). Pure helpers, tested in test/work-log.test.ts;
// lib/work-log.server.ts reads the database.

import { dayOf } from "./clients";

export type LogKind =
  | "client" // became a client, paused, started again, ended
  | "guide-written"
  | "guide-live"
  | "check" // an AI check read its answers
  | "check-failed"
  | "reddit-found"
  | "reddit-replied"
  | "writer" // found the writer of a page AI trusts
  | "sale" // an order that came from AI
  | "report" // Ross made a report for the client
  | "report-sent"
  | "change" // Ross's own entries from here down
  | "call"
  | "note";

export interface LogEntry {
  id: string;
  shopId: string;
  at: string; // ISO time
  kind: LogKind;
  text: string;
  /** A page in the app ("/dash/clients/<id>/guides/<day id>") or on the web ("https://..."). */
  href?: string;
  /** Ross's own entry (a change, call or note): it can be deleted. */
  noteId?: string;
  by?: string | null;
  /** How many things one entry stands for: Reddit threads and writers found come as one entry a client a day. */
  count?: number;
}

export const LOG_LABEL: Record<LogKind, string> = {
  client: "Client",
  "guide-written": "Guide written",
  "guide-live": "Guide live",
  check: "AI check",
  "check-failed": "AI check failed",
  "reddit-found": "Reddit",
  "reddit-replied": "Reddit reply",
  writer: "Writer found",
  sale: "Sale from AI",
  report: "Report",
  "report-sent": "Report sent",
  change: "Change made",
  call: "Call",
  note: "Private note",
};

/** Green for wins, red for things that broke, plain for the rest. */
export const LOG_TONE: Record<LogKind, "" | "ok" | "no"> = {
  client: "",
  "guide-written": "",
  "guide-live": "ok",
  check: "",
  "check-failed": "no",
  "reddit-found": "",
  "reddit-replied": "",
  writer: "",
  sale: "ok",
  report: "",
  "report-sent": "",
  change: "",
  call: "",
  note: "",
};

/** The work a client sees in their reports: no private notes, no failures, no admin chores. */
export const CLIENT_SEES: ReadonlySet<LogKind> = new Set<LogKind>(["guide-written", "guide-live", "check", "reddit-replied", "writer", "change", "call"]);

export const isExternal = (href: string) => /^https?:\/\//i.test(href);

/** Newest first. */
export const newestFirst = (a: LogEntry, b: LogEntry) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id);

/** Entries grouped by their day on Ross's calendar (Perth): newest day first, newest entry first within a day. */
export function byDay(entries: LogEntry[]): { day: string; entries: LogEntry[] }[] {
  const days = new Map<string, LogEntry[]>();
  for (const e of [...entries].sort(newestFirst)) {
    const day = dayOf(e.at);
    days.set(day, [...(days.get(day) ?? []), e]);
  }
  return [...days.entries()].map(([day, list]) => ({ day, entries: list }));
}

/** Entries grouped by client, in the order the clients are given (clients with nothing are left out). */
export function byClient<T extends { shopId: string }>(entries: LogEntry[], clients: T[]): { client: T; entries: LogEntry[] }[] {
  return clients
    .map((client) => ({ client, entries: entries.filter((e) => e.shopId === client.shopId).sort(newestFirst) }))
    .filter((g) => g.entries.length > 0);
}

/** How many of each kind, e.g. for "This week: 3 guides written, 7 AI checks" (a bunched entry counts what it holds). */
export function countKinds(entries: LogEntry[]): Partial<Record<LogKind, number>> {
  const out: Partial<Record<LogKind, number>> = {};
  for (const e of entries) out[e.kind] = (out[e.kind] ?? 0) + (e.count ?? 1);
  return out;
}

/** How each kind reads in a summary line, in the order the line names them (the hub's own status entries aren't work). */
const SUMMARY_WORDS: [LogKind, string, string][] = [
  ["guide-written", "guide written", "guides written"],
  ["guide-live", "guide live", "guides live"],
  ["check", "AI check", "AI checks"],
  ["check-failed", "AI check failed", "AI checks failed"],
  ["reddit-found", "Reddit thread found", "Reddit threads found"],
  ["reddit-replied", "Reddit reply", "Reddit replies"],
  ["writer", "writer found", "writers found"],
  ["change", "change made", "changes made"],
  ["call", "call", "calls"],
  ["sale", "sale from AI", "sales from AI"],
  ["report", "report made", "reports made"],
  ["report-sent", "report emailed", "reports emailed"],
  ["note", "private note", "private notes"],
];

/** ["12 guides written", "4 guides live", "30 AI checks", "2 calls"]: only the kinds that happened. */
export function logSummary(counts: Partial<Record<LogKind, number>>): string[] {
  return SUMMARY_WORDS.filter(([kind]) => (counts[kind] ?? 0) > 0).map(([kind, one, many]) => {
    const n = counts[kind] ?? 0;
    return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
  });
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Checked 100 buying questions on 4 AI assistants. Score 42." */
export function checkText(scan: { total: number; engines: unknown; runs: number; score: number | null }): string {
  const engines = Array.isArray(scan.engines) ? scan.engines.length : 0;
  const questions = engines && scan.runs ? Math.round(scan.total / (engines * scan.runs)) : 0;
  const what = questions && engines ? `Checked ${plural(questions, "buying question", "buying questions")} on ${plural(engines, "AI assistant", "AI assistants")}.` : "Checked what AI says.";
  return scan.score !== null ? `${what} Score ${Math.round(scan.score)}.` : what;
}

/** Reddit threads found on one day, as one entry: "Found 6 Reddit threads to reply to". */
export const redditFoundText = (n: number) => `Found ${plural(n, "Reddit thread", "Reddit threads")} to reply to, each with a reply drafted`;

/** Writers found on one day, as one entry. */
export const writersText = (domains: string[]) =>
  domains.length === 1 ? `Found the writer at ${domains[0]}` : `Found ${domains.length} writers at sites AI trusts: ${domains.slice(0, 3).join(", ")}${domains.length > 3 ? "…" : ""}`;

/** One entry per client per day for things that come in bunches (Reddit threads, writers). */
export function bunchByDay<T extends { shopId: string; at: Date | string }>(rows: T[]): { shopId: string; day: string; at: string; rows: T[] }[] {
  const groups = new Map<string, { shopId: string; day: string; at: string; rows: T[] }>();
  for (const r of rows) {
    const at = new Date(r.at).toISOString();
    const day = dayOf(at);
    const key = `${r.shopId}|${day}`;
    const g = groups.get(key) ?? { shopId: r.shopId, day, at, rows: [] };
    g.rows.push(r);
    if (at > g.at) g.at = at;
    groups.set(key, g);
  }
  return [...groups.values()];
}
