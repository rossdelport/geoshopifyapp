// The guide calendar's rules, with no database (tested in test/guide-calendar.test.ts): which days of a month get a
// guide page, what "today" is on the store's own calendar, which buying question a day gets, which products a guide
// should feature, and what each day on the calendar says. A guide is written two days before its day and goes live on
// the day; lib/guide-calendar.server.ts does the work.

export const WRITE_DAYS_AHEAD = 2;
export const PUBLISH_FROM_HOUR = 8; // the store's local time: pages go live in the morning, not in the middle of the night
export const EARLIEST_DAY = 3; // a guide for the 1st would be written in the previous month and count against that month

/** The time zone a store's days run on, from its country (the public catalog gives no time zone): its biggest city. */
export const COUNTRY_TZ: Record<string, string> = {
  AU: "Australia/Sydney",
  NZ: "Pacific/Auckland",
  US: "America/New_York",
  CA: "America/Toronto",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  NL: "Europe/Amsterdam",
  BE: "Europe/Brussels",
  ES: "Europe/Madrid",
  IT: "Europe/Rome",
  PT: "Europe/Lisbon",
  CH: "Europe/Zurich",
  AT: "Europe/Vienna",
  SE: "Europe/Stockholm",
  DK: "Europe/Copenhagen",
  NO: "Europe/Oslo",
  FI: "Europe/Helsinki",
  PL: "Europe/Warsaw",
  SG: "Asia/Singapore",
  HK: "Asia/Hong_Kong",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  IN: "Asia/Kolkata",
  AE: "Asia/Dubai",
  IL: "Asia/Jerusalem",
  ZA: "Africa/Johannesburg",
  MX: "America/Mexico_City",
  BR: "America/Sao_Paulo",
  AR: "America/Argentina/Buenos_Aires",
  PH: "Asia/Manila",
  MY: "Asia/Kuala_Lumpur",
};

export const zoneFor = (country?: string | null) => COUNTRY_TZ[(country ?? "").toUpperCase()] ?? "UTC";

/** "2026-10-20": today on the store's calendar. */
export function localDay(now: Date, country?: string | null): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: zoneFor(country), year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** The hour (0 to 23) on the store's clock. */
export function localHour(now: Date, country?: string | null): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: zoneFor(country), hour: "2-digit", hourCycle: "h23" }).format(now));
  } catch {
    return now.getUTCHours();
  }
}

/** The zone's offset from UTC, in minutes, at that instant (Sydney in summer: 660). */
function zoneOffsetMinutes(at: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Math.round((Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute")) - at.getTime()) / 60_000);
}

/**
 * Midnight on the 1st of the store's current month, on its own clock, as an instant: the month's allowance is
 * counted from here (a Sydney store's November starts on 31 October 13:00 UTC).
 */
export function localMonthStart(now: Date, country?: string | null): Date {
  const guess = new Date(`${monthOf(localDay(now, country))}-01T00:00:00Z`);
  try {
    return new Date(guess.getTime() - zoneOffsetMinutes(guess, zoneFor(country)) * 60_000);
  } catch {
    return guess;
  }
}

const fromDay = (day: string) => new Date(`${day}T00:00:00Z`);
const toDay = (d: Date) => d.toISOString().slice(0, 10);

export const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromDay(s).getTime()) && toDay(fromDay(s)) === s;
export const isMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function addDays(day: string, n: number): string {
  const d = fromDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

/** The day a guide is written: two days before it goes live. */
export const writeDay = (day: string) => addDays(day, -WRITE_DAYS_AHEAD);

export const monthOf = (day: string) => day.slice(0, 7);

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

/** How many months `a` is after `b` (negative when before). */
export function monthsApart(a: string, b: string): number {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (ya - yb) * 12 + (ma - mb);
}

/**
 * The days of a month that get a guide: `count` days spread evenly through the month (4 a month is about one a
 * week, 12 is three a week), never before the 3rd.
 */
export function slotDaysForMonth(month: string, count: number): string[] {
  const dim = daysInMonth(month);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = Math.min(dim, Math.max(EARLIEST_DAY, Math.round(((i + 0.5) * dim) / count)));
    const day = `${month}-${String(d).padStart(2, "0")}`;
    if (!out.includes(day)) out.push(day);
  }
  return out;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** The month as Monday-first weeks; null cells pad the first and last week. */
export function calendarWeeks(month: string): (string | null)[][] {
  const dim = daysInMonth(month);
  const lead = (fromDay(`${month}-01`).getUTCDay() + 6) % 7; // Monday = 0
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: dim }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Spelled out by hand, not by the locale engine: browsers and Node disagree on the commas ("Tue 20 Oct" against
// "Tue, 20 Oct"), and a label that differs between the server and the browser breaks the page's first render.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "October 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1] ?? month} ${y}`;
}

/** "Tue 20 Oct", or "Tuesday 20 October" when long. */
export function dayLabel(day: string, style: "short" | "long" = "short"): string {
  const d = fromDay(day);
  const weekday = DAYS[d.getUTCDay()];
  const month = MONTHS[d.getUTCMonth()];
  return style === "long" ? `${weekday} ${d.getUTCDate()} ${month}` : `${weekday.slice(0, 3)} ${d.getUTCDate()} ${month.slice(0, 3)}`;
}

// ---------- What a day on the calendar says ----------

export type SlotState = "planned" | "writing" | "needs-ok" | "scheduled" | "add" | "live" | "failed" | "skipped";

/**
 * What a day is at: planned (not written yet), writing, needs the store's OK, scheduled (OK'd, waiting for its day
 * or for the Shopify connection to publish it), add (its day has come and the store has no Shopify connection, so it
 * adds the page itself), live, couldn't be written, or skipped by the store.
 */
export function slotState(slot: { status: string; approvedAt: Date | string | null }, day: string, today: string, connected: boolean): SlotState {
  switch (slot.status) {
    case "published":
      return "live";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    case "writing":
      return "writing";
    case "ready":
      if (!slot.approvedAt) return "needs-ok";
      return day <= today && !connected ? "add" : "scheduled";
    default:
      return "planned";
  }
}

export const STATE_LABEL: Record<SlotState, string> = {
  planned: "Planned",
  writing: "Writing",
  "needs-ok": "Needs your OK",
  scheduled: "Scheduled",
  add: "Add to your store",
  live: "Live",
  failed: "Couldn’t write",
  skipped: "Skipped",
};

export const STATE_TONE: Record<SlotState, "" | "ok" | "warn" | "no"> = {
  planned: "",
  writing: "",
  "needs-ok": "warn",
  scheduled: "",
  add: "warn",
  live: "ok",
  failed: "no",
  skipped: "",
};

// ---------- Which question, which products ----------

export interface PickableQuestion {
  id: string;
  text: string;
  volume: number | null;
  cluster: string | null;
  rate: number | null; // how often AI names the store (null: not asked yet)
}

const group = (q: PickableQuestion) => (q.rate === 0 ? 0 : q.rate === null || q.rate < 0.5 ? 1 : 2);

/**
 * The buying questions for the next guide days: the ones AI never names the store for first, then the ones it names
 * under half the time (and ones not asked yet), then the rest; bigger searches first within a group; and two days in
 * a row never share a topic when another topic is available. `used` are questions that already have a day or a guide.
 */
export function pickQuestions(questions: PickableQuestion[], used: Set<string>, count: number, lastCluster: string | null = null): PickableQuestion[] {
  const pool = questions
    .filter((q) => !used.has(q.id))
    .sort((a, b) => group(a) - group(b) || (b.volume ?? -1) - (a.volume ?? -1) || a.text.localeCompare(b.text));
  const out: PickableQuestion[] = [];
  let prev = lastCluster;
  while (out.length < count && pool.length) {
    let i = pool.findIndex((q) => !prev || !q.cluster || q.cluster !== prev);
    if (i < 0) i = 0;
    const [q] = pool.splice(i, 1);
    out.push(q);
    prev = q.cluster;
  }
  return out;
}

const STOP = new Set([
  "the", "and", "for", "with", "what", "which", "how", "are", "is", "in", "of", "to", "a", "an", "my", "me", "i", "do", "does", "can", "should", "on", "vs",
  "or", "best", "good", "top", "near", "buy", "online", "that", "this", "from", "your", "you", "there", "any", "most", "under", "over", "around", "when",
  "where", "who", "why", "it", "its", "be", "get", "have", "has", "than", "more", "less", "some",
]);

/** The words of a question worth matching products on (no stop words, 3 letters or more), singular-ish. */
export function questionWords(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/[\s-]+/)
        .filter((w) => w.length >= 3 && !STOP.has(w))
        .map((w) => w.replace(/(ies|es|s)$/, "") || w),
    ),
  ];
}

/**
 * The store's products most relevant to a question: how many of its words appear in the title (counts double), the
 * type, the tags and the start of the description. Ties keep the catalog's order.
 */
export function rankProductsForQuestion<T extends { title: string; productType?: string | null; tags?: unknown; description?: string | null }>(products: T[], question: string): T[] {
  const words = questionWords(question);
  const score = (p: T) => {
    const title = p.title.toLowerCase();
    const rest = `${p.productType ?? ""} ${Array.isArray(p.tags) ? p.tags.join(" ") : ""} ${(p.description ?? "").slice(0, 600)}`.toLowerCase();
    let s = 0;
    for (const w of words) {
      if (title.includes(w)) s += 2;
      else if (rest.includes(w)) s += 1;
    }
    return s;
  };
  return products
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
}

/** A page address on the store's own site (https, its domain), or null. */
export function ownPageUrl(url: string | null | undefined, shop: { domain: string; primaryDomain: string | null }): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const own = [shop.domain, shop.primaryDomain].filter((d): d is string => Boolean(d)).map((d) => d.toLowerCase().replace(/^www\./, ""));
    return own.includes(host) ? u.toString() : null;
  } catch {
    return null;
  }
}
