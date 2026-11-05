// The sums behind a client's pages in the agency hub (Ross, 5 Nov 2026): Store stats (/dash/clients/<id>/stats). No database here, so they are easy to test (test/store-stats.test.ts);
// lib/store-stats.server.ts reads the rows.
//
// Two kinds of days: single orders, visits and AI checks are moments in time, put on Ross's calendar (Perth). The
// tracking code's daily totals (TrafficDay, OrderDay) are saved by UTC day, so they keep their own dates.

import { AI_ENGINE_LABELS } from "./attribution";
import { ENGINE_LABELS } from "./plans";
import { addDays } from "./guide-calendar";
import { dayOf } from "./clients";

// ---------- The days a page shows ----------

export const STAT_SPANS = [7, 30, 90] as const;
export type StatSpan = (typeof STAT_SPANS)[number];

/** `?days=7` -> 7. Anything that isn't one of the choices gives the default. */
export function readSpan(raw: unknown, fallback: StatSpan = 30): StatSpan {
  const n = Number(raw);
  return (STAT_SPANS as readonly number[]).includes(n) ? (n as StatSpan) : fallback;
}

/** The last `days` days ending `today`, and the same number of days just before them (to compare with). */
export interface StatWindow {
  days: number;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
}

export function statWindow(today: string, days: number): StatWindow {
  const from = addDays(today, -(days - 1));
  return { days, from, to: today, prevFrom: addDays(from, -days), prevTo: addDays(from, -1) };
}

/** Every day from `from` to `to`, both included (at most a year and a bit, so a bad date can't loop for ever). */
export function dayList(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The date of a row saved by UTC day ("2026-11-05"). */
export const utcDay = (at: Date | string) => new Date(at).toISOString().slice(0, 10);

export type DayValue = { day: string; value: number };

/** One value for every day of the window: days with no rows get 0, rows on the same day add up, others are left out. */
export function fillDays(from: string, to: string, rows: DayValue[]): DayValue[] {
  const sums = new Map<string, number>();
  for (const r of rows) sums.set(r.day, (sums.get(r.day) ?? 0) + r.value);
  return dayList(from, to).map((day) => ({ day, value: roundMoney(sums.get(day) ?? 0) }));
}

export const sumValues = (days: DayValue[]) => roundMoney(days.reduce((n, d) => n + d.value, 0));

/** Money to the cent, so adding up many orders doesn't print 0.30000000000000004. */
export const roundMoney = (n: number) => Math.round(n * 100) / 100;

/** The change from `before` to `now` in whole percent. Null when there was nothing before (no % of nothing). */
export function pctChange(now: number, before: number): number | null {
  if (!(before > 0)) return null;
  return Math.round(((now - before) / before) * 100);
}

/** A part of a whole (0 to 1), or null when the whole is nothing. */
export const shareOf = (part: number, whole: number): number | null => (whole > 0 ? part / whole : null);

/**
 * True when the tracking code was already counting for the whole of the days before, so comparing with them is fair.
 * Before that, "none before" would only mean "not tracked yet".
 */
export const fullyTracked = (trackingSince: string | null, prevFrom: string) => trackingSince !== null && trackingSince <= prevFrom;

// ---------- Where shoppers came from ----------

export type SourceRow = { visits: number; orders: number; revenue: number };

/**
 * AI assistants, search engines and everything else. `all` is every visit and order the tracking code counted; the
 * rest is what's left after AI and search (never below 0, since the daily totals and the single AI orders are dated a
 * little differently).
 */
export function shopperSources(t: { all: SourceRow; ai: SourceRow; search: SourceRow }) {
  const left = (k: keyof SourceRow) => Math.max(0, t.all[k] - t.ai[k] - t.search[k]);
  const other = { visits: left("visits"), orders: left("orders"), revenue: roundMoney(left("revenue")) };
  return { ai: t.ai, search: t.search, other, all: t.all };
}

// ---------- AI assistants and products ----------

export type EngineRow = { engine: string; label: string; orders: number; revenue: number; visits: number | null };

export const engineLabel = (engine: string) => AI_ENGINE_LABELS[engine as keyof typeof AI_ENGINE_LABELS] ?? "Other AI";

/**
 * Orders, sales and visits by AI assistant, the most sales first. Orders through our own guide pages ("ours") have
 * no visits: those visits aren't counted as visits from AI.
 */
export function engineRows(orders: { engine: string; revenue: number }[], visits: { engine: string }[]): EngineRow[] {
  const rows = new Map<string, EngineRow>();
  const row = (engine: string) => {
    const r = rows.get(engine) ?? { engine, label: engineLabel(engine), orders: 0, revenue: 0, visits: engine === "ours" ? null : 0 };
    rows.set(engine, r);
    return r;
  };
  for (const o of orders) {
    const r = row(o.engine);
    r.orders += 1;
    r.revenue = roundMoney(r.revenue + o.revenue);
  }
  for (const v of visits) {
    if (v.engine === "ours") continue;
    const r = row(v.engine);
    r.visits = (r.visits ?? 0) + 1;
  }
  return [...rows.values()].sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || (b.visits ?? 0) - (a.visits ?? 0) || a.label.localeCompare(b.label));
}

/** The products bought most in orders from AI (each order's [{title, qty}]), most first. */
export function topProducts(lists: unknown[], limit = 5): { title: string; qty: number }[] {
  const counts = new Map<string, number>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      const title = typeof p?.title === "string" ? p.title.trim() : "";
      if (!title) continue;
      const qty = Number(p?.qty);
      counts.set(title, (counts.get(title) ?? 0) + (Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1));
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([title, qty]) => ({ title, qty }));
}

// ---------- The AI score ----------

/** The last score of each day (Perth) in the window; null on days with no AI check. */
export function dailyScores(snaps: { date: Date | string; score: number }[], from: string, to: string): { day: string; score: number | null }[] {
  const last = new Map<string, { at: number; score: number }>();
  for (const s of snaps) {
    const at = new Date(s.date).getTime();
    const day = dayOf(s.date);
    const seen = last.get(day);
    if (!seen || at >= seen.at) last.set(day, { at, score: Math.round(s.score) });
  }
  return dayList(from, to).map((day) => ({ day, score: last.get(day)?.score ?? null }));
}

const ENGINE_ORDER = Object.keys(ENGINE_LABELS);

/**
 * Each AI assistant's latest score (a snapshot's { chatgpt: 40, gemini: 12 }), with its change since `start` (the
 * score at the start of the days shown) when that check asked the same assistant. In the usual order: ChatGPT first.
 */
export function engineScores(latest: unknown, start: unknown): { engine: string; label: string; score: number; change: number | null }[] {
  const now = scoreMap(latest);
  const before = scoreMap(start);
  return Object.keys(now)
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((engine) => ({
      engine,
      label: ENGINE_LABELS[engine as keyof typeof ENGINE_LABELS] ?? engineLabel(engine),
      score: now[engine],
      change: engine in before ? now[engine] - before[engine] : null,
    }));
}

const rank = (engine: string) => (ENGINE_ORDER.includes(engine) ? ENGINE_ORDER.indexOf(engine) : ENGINE_ORDER.length);

function scoreMap(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v);
  return out;
}
