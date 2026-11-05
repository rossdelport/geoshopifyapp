// The agency hub's rules (Ross, 5 Nov 2026: "i want the dash to be the hub for me where i can see, add, delete update etc
// ... my clients"), with no database so they are easy to test (test/clients.test.ts): days on Ross's calendar, which
// month of the work a client is in, the client form, and what needs Ross today. lib/clients.server.ts does the database
// work; the pages are routes/dash._index.tsx (the hub, for admins) and routes/dash.clients.*.

import { OFFER } from "./plans";
import { addDays, dayLabel, isDay } from "./guide-calendar";

/** Ross's own calendar: Perth, UTC+8 all year (no daylight saving), so a day's start is a fixed offset. */
export const HUB_TZ = "Australia/Perth";
const PERTH_MS = 8 * 3_600_000;

export const CLIENT_STATUSES = ["active", "paused", "ended"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const STATUS_LABEL: Record<ClientStatus, string> = { active: "Active", paused: "Paused", ended: "Ended" };
export const isClientStatus = (s: unknown): s is ClientStatus => typeof s === "string" && (CLIENT_STATUSES as readonly string[]).includes(s);
/** The plan a status runs on: the work only runs while a client is active. */
export const planForStatus = (s: ClientStatus) => (s === "active" ? "pro" : "free");

/** "A$945 a month" -> 945: the website's price, the fee a new client starts on (it follows OFFER when the price changes). */
export function offerFee(price: string = OFFER.price): number {
  const n = Number(/\d[\d,]*(\.\d+)?/.exec(price)?.[0]?.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
export const DEFAULT_FEE = offerFee();

/** How many clients the offer takes at once (the home page: "5 spots"). */
export const CLIENT_SPOTS = 5;

/** "A$945", "A$2,835": fees are always Australian dollars. */
export const formatFee = (n: number) => `A$${Math.round(n).toLocaleString("en-US")}`;

// ---------- Days on Ross's calendar ----------

/** The day an instant falls on in Perth, "2026-11-05". */
export function dayOf(at: Date | string): string {
  return new Date(new Date(at).getTime() + PERTH_MS).toISOString().slice(0, 10);
}

/** Today in Perth, or the day `back` days before it. */
export function hubDay(now = new Date(), back = 0): string {
  const today = dayOf(now);
  return back ? addDays(today, -back) : today;
}

/** The instant a Perth day starts. */
export const dayStartsAt = (day: string) => new Date(`${day}T00:00:00+08:00`);

/** The instants covering the days `from` to `to` (both included), for a database range: { gte, lt }. */
export const daysWindow = (from: string, to: string) => ({ gte: dayStartsAt(from), lt: dayStartsAt(addDays(to, 1)) });

/** The first day of the Perth month `day` is in. */
export const monthStartDay = (day: string) => `${day.slice(0, 8)}01`;

/** The same date `n` months later, kept inside the month ("2026-01-31" plus one month is "2026-02-28"). */
export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return `${first.toISOString().slice(0, 8)}${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** Which month of the work `today` is in: 1 from the start day, 2 from the same date a month later, 0 before it starts. */
export function clientMonth(startedOn: string, today: string): number {
  if (!isDay(startedOn) || today < startedOn) return 0;
  const [ys, ms] = startedOn.split("-").map(Number);
  const [yt, mt] = today.split("-").map(Number);
  let n = (yt - ys) * 12 + (mt - ms);
  if (addMonths(startedOn, n) > today) n--;
  return n + 1;
}

/** The last day of month 1: the day before the same date next month. */
export const monthOneEnds = (startedOn: string) => addDays(addMonths(startedOn, 1), -1);

/** The last day a client can ask for the month 1 refund: 14 days after month 1 ends (the terms page). */
export const refundUntil = (startedOn: string) => addDays(monthOneEnds(startedOn), 14);

/** How long ago a day was, in whole days (0 for today). */
export const daysSince = (day: string, today: string) => Math.round((Date.parse(today) - Date.parse(day)) / 86_400_000);

// ---------- The client form ----------

export interface ClientInput {
  name: string | null; // the brand's name as Ross wants it shown (the store's own name when empty)
  contactName: string | null;
  email: string | null; // one address, or a few separated by commas
  phone: string | null;
  feeAud: number;
  startedOn: string;
  status: ClientStatus;
  notes: string | null;
}

export type ClientField = keyof ClientInput | "store";
export type ClientErrors = Partial<Record<ClientField, string>>;

const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;
const MAX_EMAILS = 5;

/** Up to 5 addresses, lowercased, "a@x.com, b@y.com"; null when empty; false when one isn't an email address. */
export function cleanEmails(raw: unknown): string | null | false {
  const list = String(raw ?? "")
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return null;
  if (list.length > MAX_EMAILS || list.some((e) => e.length > 200 || !EMAIL.test(e))) return false;
  return [...new Set(list)].join(", ");
}

/** A phone number as typed, tidied: digits, spaces, + ( ) and -. Null when empty; false when it doesn't look like one. */
export function cleanPhone(raw: unknown): string | null | false {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s.length > 30 || /[^\d\s+()-]/.test(s) || (s.match(/\d/g) ?? []).length < 6) return false;
  return s;
}

/** "945", "A$945", "$1,000.00" -> a whole number of dollars; null when empty; false when it isn't a fee. */
export function cleanFee(raw: unknown): number | null | false {
  const s = String(raw ?? "").replace(/^\s*(a\$|aud|\$)\s*/i, "").replace(/,/g, "").trim();
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return false;
  const n = Math.round(Number(s));
  return n <= 100_000 ? n : false;
}

/** One line of plain text: no tags, at most `max` characters. Null when empty. */
function cleanText(raw: unknown, max: number): string | null {
  const s = String(raw ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

/** Notes keep their line breaks. */
function cleanNotes(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/\r\n?/g, "\n").replace(/[<>]/g, "").trim();
  return s ? s.slice(0, 4000) : null;
}

type FormLike = { get(name: string): unknown };

/** The client form (Add a client, and a client's Details page), checked. `today` is the default start day. */
export function readClientForm(form: FormLike, today: string): { ok: true; value: ClientInput } | { ok: false; errors: ClientErrors } {
  const errors: ClientErrors = {};
  const email = cleanEmails(form.get("email"));
  if (email === false) errors.email = `Please enter an email address, or up to ${MAX_EMAILS} separated by commas.`;
  const phone = cleanPhone(form.get("phone"));
  if (phone === false) errors.phone = "Please enter a phone number, like 0400 123 456.";
  const fee = cleanFee(form.get("feeAud"));
  if (fee === false) errors.feeAud = "Please enter the monthly fee in dollars, like 945.";
  const startRaw = String(form.get("startedOn") ?? "").trim();
  const startedOn = startRaw || today;
  if (!isDay(startedOn) || Math.abs(daysSince(startedOn, today)) > 730) errors.startedOn = "Please pick the day the work started.";
  const statusRaw = String(form.get("status") ?? "").trim() || "active";
  if (!isClientStatus(statusRaw)) errors.status = "Please pick Active, Paused or Ended.";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: cleanText(form.get("name"), 80),
      contactName: cleanText(form.get("contactName"), 80),
      email: email || null,
      phone: phone || null,
      feeAud: typeof fee === "number" ? fee : DEFAULT_FEE,
      startedOn,
      status: statusRaw as ClientStatus,
      notes: cleanNotes(form.get("notes")),
    },
  };
}

// ---------- The work log's own entries ----------

export const NOTE_KINDS = ["change", "call", "note"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];
export const NOTE_LABEL: Record<NoteKind, string> = { change: "Change made", call: "Call", note: "Private note" };
/** What each kind means, for the form. */
export const NOTE_HINT: Record<NoteKind, string> = {
  change: "Something you changed for them, like product pages. Shows in their reports.",
  call: "A call with the client. Shows in their reports.",
  note: "Only you see it.",
};
export const isNoteKind = (s: unknown): s is NoteKind => typeof s === "string" && (NOTE_KINDS as readonly string[]).includes(s);

/** A new log entry from the form: its kind, text (1 to 1,000 characters) and day (today or up to a year back). */
export function readNoteForm(form: FormLike, today: string): { ok: true; kind: NoteKind; text: string; day: string } | { ok: false; error: string } {
  const kind = String(form.get("kind") ?? "note");
  const text = String(form.get("text") ?? "").replace(/\r\n?/g, "\n").replace(/[<>]/g, "").trim();
  const day = String(form.get("day") ?? "").trim() || today;
  if (!isNoteKind(kind)) return { ok: false, error: "Please pick what kind of entry this is." };
  if (!text) return { ok: false, error: "Please write what you did." };
  if (text.length > 1000) return { ok: false, error: "Please keep it under 1,000 characters." };
  if (!isDay(day) || day > today || daysSince(day, today) > 366) return { ok: false, error: "Please pick a day from the last year." };
  return { ok: true, kind, text, day };
}

/** When a log entry for `day` happened: now when it's today, else midday Perth that day. */
export const noteTime = (day: string, today: string, now = new Date()) => (day === today ? now : new Date(dayStartsAt(day).getTime() + 12 * 3_600_000));

// ---------- What needs Ross ----------

/** What the hub knows about a client when deciding what needs Ross (lib/hub.server.ts fills it in). */
export interface ClientFacts {
  shopId: string;
  status: ClientStatus | null; // null: the store isn't a client
  onboarding: string; // new | profiling | questions | scanning | done
  setupFailed: boolean; // setup stopped partway (its job gave up, or the first AI check has nothing running it)
  setupSince: string; // when setup started (ISO)
  tracking: boolean; // the tracking code has sent a visit
  startedOn: string | null;
  lastScanAt: string | null; // the last AI check that read answers (ISO)
  lastScanFailed: boolean; // the newest AI check failed
  scanRunning: boolean;
  guidesToAdd: number; // written and OK'd, their day has come, and the store has no Shopify connection: add by hand
  firstToAdd: string | null; // that guide day's id
  guidesNeedOk: number; // written, waiting for an OK (a check softened it, or autopilot is off)
  guidesFailed: number; // couldn't be written, and their day is still ahead
  firstFailed: string | null;
  lastReportAt: string | null; // the newest report made (ISO)
  lastCallAt: string | null; // the newest call in the work log (ISO)
  costCapHit: boolean; // AI checks paused: this month's cost cap was reached
}

export type AlertTone = "no" | "warn" | "info";

/** One thing that needs Ross: a link to open, or a button that posts `intent` to the client's page. */
export interface Alert {
  key: string;
  tone: AlertTone;
  text: string;
  label?: string;
  to?: string;
  intent?: { name: string; kind?: string };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const TONE_ORDER: Record<AlertTone, number> = { no: 0, warn: 1, info: 2 };

/**
 * What needs Ross for one client, worst first. Only active clients get alerts: a paused or ended client's work is
 * stopped on purpose, and a store that isn't a client is someone else's to run.
 */
export function clientAlerts(f: ClientFacts, today: string, now = new Date()): Alert[] {
  if (f.status !== "active") return [];
  const base = `/dash/clients/${f.shopId}`;
  const out: Alert[] = [];
  const hoursSince = (iso: string | null) => (iso ? (now.getTime() - Date.parse(iso)) / 3_600_000 : Infinity);

  if (f.onboarding !== "done") {
    if (f.setupFailed) out.push({ key: "setup", tone: "no", text: "Setup stopped partway", label: "Try again", intent: { name: "retry-setup" } });
    // A first AI check that is still working is fine, however long it takes (100 questions take a while).
    else if (!f.scanRunning && hoursSince(f.setupSince) > 2) out.push({ key: "setup", tone: "warn", text: "Setup is taking longer than usual", label: "Open", to: base });
    return out; // nothing else can be judged until the store is set up
  }

  if (f.guidesFailed) {
    out.push({
      key: "guides-failed",
      tone: "no",
      text: `${plural(f.guidesFailed, "guide", "guides")} couldn’t be written`,
      label: "Open",
      to: f.firstFailed ? `${base}/guides/${f.firstFailed}` : `${base}/guides`,
    });
  }
  if (f.lastScanFailed && !f.scanRunning) out.push({ key: "check", tone: "no", text: "The last AI check failed", label: "Check again", intent: { name: "check-now" } });
  else if (!f.scanRunning && hoursSince(f.lastScanAt) > 72) {
    const days = f.lastScanAt ? Math.floor(hoursSince(f.lastScanAt) / 24) : null;
    out.push({ key: "check", tone: "warn", text: days ? `No AI check for ${days} days` : "No AI check yet", label: "Check now", intent: { name: "check-now" } });
  }
  if (f.guidesToAdd) {
    out.push({
      key: "guides-add",
      tone: "warn",
      text: `${plural(f.guidesToAdd, "guide is", "guides are")} ready to add to their store`,
      label: "Add now",
      to: f.firstToAdd ? `${base}/guides/${f.firstToAdd}` : `${base}/guides`,
    });
  }
  if (f.guidesNeedOk) out.push({ key: "guides-ok", tone: "warn", text: `${plural(f.guidesNeedOk, "guide waits", "guides wait")} for your OK`, label: "Open", to: `${base}/guides` });
  if (!f.tracking) out.push({ key: "tracking", tone: "warn", text: "Tracking code isn’t sending yet, so sales from AI can’t be counted", label: "Tracking code", to: `${base}/tracking` });
  if (f.costCapHit) out.push({ key: "cost", tone: "warn", text: "Hit this month’s cost cap, so AI checks are paused", label: "Usage", to: "/dash/admin/usage" });

  if (f.startedOn) {
    const weekIn = daysSince(f.startedOn, today) >= 6;
    if (weekIn && hoursSince(f.lastReportAt) >= 24 * 7 - 12) {
      out.push({ key: "report", tone: "warn", text: "Weekly report due", label: "Make it", intent: { name: "report", kind: "week" } });
    }
    if (daysSince(f.startedOn, today) >= 25 && hoursSince(f.lastCallAt) >= 24 * 30) {
      out.push({ key: "call", tone: "warn", text: "Monthly call due", label: "Log a call", to: `${base}/log` });
    }
    const ends = monthOneEnds(f.startedOn);
    const left = daysSince(today, ends);
    if (left >= 0 && left <= 7) {
      out.push({ key: "month-one", tone: "info", text: `First month ends ${left === 0 ? "today" : dayLabel(ends)}. A good time to show them the results.`, label: "Reports", to: `${base}/reports` });
    }
  }
  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

export type Health = "ok" | "warn" | "no" | "off";

/** A client's dot: red when something broke, amber when something needs a look, green when all is well, grey when stopped. */
export function healthOf(status: ClientStatus | null, alerts: Alert[]): Health {
  if (status !== "active") return "off";
  if (alerts.some((a) => a.tone === "no")) return "no";
  if (alerts.some((a) => a.tone === "warn")) return "warn";
  return "ok";
}

export const HEALTH_LABEL: Record<Health, string> = { ok: "All good", warn: "Needs a look", no: "Something broke", off: "Not running" };

// ---------- The brand cards ----------

/** Everything a brand card on the hub shows (lib/hub.server.ts fills it in). */
export interface ClientCard {
  shopId: string;
  name: string;
  host: string;
  country: string;
  currency: string;
  status: ClientStatus;
  feeAud: number;
  startedOn: string;
  month: number; // month N of the work (0 before it starts)
  contactName: string | null;
  email: string | null;
  phone: string | null;
  onboarding: string;
  tracking: boolean;
  score: number | null; // the latest AI score (0 to 100)
  scoreStart: number | null; // the score when the work started
  trend: number[]; // the last 14 scores, oldest first
  sales: { revenue: number; orders: number; visits: number }; // from AI, this month (Perth)
  week: { guidesWritten: number; guidesLive: number; checks: number; reddit: number; changes: number }; // the last 7 days
  next: { day: string; title: string; id: string } | null; // the next guide on their calendar
  alerts: Alert[];
  health: Health;
}

/** The hub's headline numbers: active clients, monthly fees, sales from AI and work done this week. */
export function hubTotals(cards: ClientCard[]) {
  const active = cards.filter((c) => c.status === "active");
  const salesBy = new Map<string, { revenue: number; orders: number }>();
  for (const c of active) {
    const s = salesBy.get(c.currency) ?? { revenue: 0, orders: 0 };
    salesBy.set(c.currency, { revenue: s.revenue + c.sales.revenue, orders: s.orders + c.sales.orders });
  }
  const main = [...salesBy.entries()].sort((a, b) => b[1].revenue - a[1].revenue)[0];
  return {
    active: active.length,
    paused: cards.filter((c) => c.status === "paused").length,
    ended: cards.filter((c) => c.status === "ended").length,
    feesAud: active.reduce((sum, c) => sum + c.feeAud, 0),
    sales: main ? { currency: main[0], ...main[1], otherCurrencies: salesBy.size > 1 } : { currency: "AUD", revenue: 0, orders: 0, otherCurrencies: false },
    guidesThisWeek: active.reduce((sum, c) => sum + c.week.guidesWritten, 0),
    liveThisWeek: active.reduce((sum, c) => sum + c.week.guidesLive, 0),
    needsYou: active.reduce((sum, c) => sum + c.alerts.filter((a) => a.tone !== "info").length, 0),
  };
}

/** Clients in the order the hub shows them: active first, then the worst health, then the newest. */
export function sortCards(cards: ClientCard[]): ClientCard[] {
  const rank: Record<Health, number> = { no: 0, warn: 1, ok: 2, off: 3 };
  const statusRank: Record<ClientStatus, number> = { active: 0, paused: 1, ended: 2 };
  return [...cards].sort(
    (a, b) => statusRank[a.status] - statusRank[b.status] || rank[a.health] - rank[b.health] || b.startedOn.localeCompare(a.startedOn) || a.name.localeCompare(b.name),
  );
}

/** The score when the work started: the last one on or before the start day, else the first one after it. */
export function startScore(scores: { score: number; date: Date | string }[], startedOn: string): number | null {
  if (!scores.length) return null;
  const sorted = [...scores].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const before = sorted.filter((s) => dayOf(s.date) <= startedOn).at(-1);
  return Math.round((before ?? sorted[0]).score);
}
