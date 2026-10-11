// Limits and a small cache for the free tools, kept in memory. Railway runs one replica, so that is
// enough for free page fetches. Two caveats (codebase-brief §7.3): the counts reset on every deploy,
// and they briefly double while the old and new processes overlap. Anything that spends money (the
// AI Overview checker) also checks a spend cap in the database. Keys are scrambled IPs, never raw IPs.

import { envLimit, gate, type Gate } from "../gate";

export const HOUR_COPY = "You've run a lot of checks. Please try again in an hour.";
export const DAY_COPY = "You've reached today's free checks. Please try again tomorrow.";
export const BUSY_COPY = "Our free checks are busy today. Please try again tomorrow.";
/** The HTTP status for every limit answer. */
export const LIMIT_STATUS = 429;

export interface LimitRule {
  perHour: number;
  perDay: number;
  /** For everyone together, per UTC day, in this process. Leave out for no global cap. */
  globalPerDay?: number;
}

/** docs/tools/spec.md 3.9. AI Overview: only live searches count (cached answers are free). */
export const TOOL_LIMITS = {
  aio: { perHour: 10, perDay: 30, globalPerDay: 1_000 },
  crawler: { perHour: 20, perDay: 100, globalPerDay: 5_000 },
  schema: { perHour: 20, perDay: 100, globalPerDay: 5_000 },
  llms: { perHour: 20, perDay: 100, globalPerDay: 5_000 },
  copy: { perHour: 20, perDay: 100, globalPerDay: 5_000 },
  /** Any paste-mode POST (the no-JS fallback of the tools that run in the browser). */
  paste: { perHour: 60, perDay: 300 },
} satisfies Record<string, LimitRule>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MAX_KEYS = 50_000;
const SWEEP_EVERY = 60 * 1000;

/** tool:ipHash -> times of the accepted calls in the last 24 hours, oldest first. Map order = last used. */
const windows = new Map<string, number[]>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_EVERY) return;
  lastSweep = now;
  for (const [key, times] of windows) {
    const kept = times.filter((t) => now - t < DAY);
    if (kept.length) windows.set(key, kept);
    else windows.delete(key);
  }
}

/** The calls this visitor made to this tool in the last hour and day (after dropping older ones). */
function recent(key: string, now: number): { times: number[]; hour: number } {
  const times = (windows.get(key) ?? []).filter((t) => now - t < DAY);
  return { times, hour: times.filter((t) => now - t < HOUR).length };
}

function remember(key: string, times: number[]) {
  windows.delete(key); // re-insert, so the map's first key is the one used longest ago
  windows.set(key, times);
  while (windows.size > MAX_KEYS) windows.delete(windows.keys().next().value as string);
}

/**
 * Count one call by this visitor to this tool, when it is within the hourly and daily allowance.
 * Sliding windows: the hour and the day are the 60 minutes and 24 hours before now. Refused calls don't count.
 */
export function hit(tool: string, ipHash: string, rule: { perHour: number; perDay: number }): { ok: true } | { ok: false; error: string } {
  const now = Date.now();
  sweep(now);
  const key = `${tool}:${ipHash}`;
  const { times, hour } = recent(key, now);
  if (hour >= rule.perHour) {
    remember(key, times);
    return { ok: false, error: HOUR_COPY };
  }
  if (times.length >= rule.perDay) {
    remember(key, times);
    return { ok: false, error: DAY_COPY };
  }
  times.push(now);
  remember(key, times);
  return { ok: true };
}

const daily = new Map<string, { day: string; count: number }>();
const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

function dailyCount(tool: string, now: number): { day: string; count: number } {
  const day = utcDay(now);
  const entry = daily.get(tool);
  if (entry && entry.day === day) return entry;
  const fresh = { day, count: 0 };
  daily.set(tool, fresh);
  return fresh;
}

/** True while this tool is under today's (UTC) cap for everyone; counts the call when it is. */
export function globalDaily(tool: string, max: number): boolean {
  const entry = dailyCount(tool, Date.now());
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

/**
 * Both limits in one step, in the right order: the global cap is checked first and counted last, so a
 * visitor refused by one limit is never counted by the other.
 */
export function takeToolSlot(tool: string, ipHash: string, rule: LimitRule): { ok: true } | { ok: false; error: string } {
  if (rule.globalPerDay !== undefined && dailyCount(tool, Date.now()).count >= rule.globalPerDay) return { ok: false, error: BUSY_COPY };
  const mine = hit(tool, ipHash, rule);
  if (!mine.ok) return mine;
  if (rule.globalPerDay !== undefined) globalDaily(tool, rule.globalPerDay);
  return { ok: true };
}

/** Forget every count (tests only). */
export function resetToolLimits() {
  windows.clear();
  daily.clear();
  lastSweep = 0;
}

/** A small in-memory cache: entries expire after their own time to live, and the oldest go past `max`. */
export class TtlCache<V> {
  private readonly items = new Map<string, { value: V; expires: number }>();
  constructor(private readonly max: number) {}

  get(k: string): V | undefined {
    const item = this.items.get(k);
    if (!item) return undefined;
    if (Date.now() >= item.expires) {
      this.items.delete(k);
      return undefined;
    }
    return item.value;
  }

  set(k: string, v: V, ttlMs: number): void {
    this.items.delete(k); // re-insert, so the map's first key is the oldest
    this.items.set(k, { value: v, expires: Date.now() + ttlMs });
    while (this.items.size > Math.max(1, this.max)) this.items.delete(this.items.keys().next().value as string);
  }

  delete(k: string): void {
    this.items.delete(k);
  }

  clear(): void {
    this.items.clear();
  }

  get size(): number {
    return this.items.size;
  }
}

/** At most TOOLS_MAX_OPEN (default 8) tool fetches open at once in this process; the rest wait their turn. */
export const toolFetchGate: Gate = gate(() => envLimit("TOOLS_MAX_OPEN", 8));
