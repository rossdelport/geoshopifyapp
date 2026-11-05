// The words and small rules on the agency hub's own pages (Ross, 5 Nov 2026): the brand cards and headline numbers on
// /dash, adding a client, and the daily log (its summary line is logSummary in lib/work-log.ts). No database, so they are easy to test (test/hub-pages.test.ts).

import { type Alert, type AlertTone, type ClientCard, type ClientStatus, CLIENT_SPOTS, formatFee } from "./clients";
import { addDays, dayLabel, isDay } from "./guide-calendar";

export const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// ---------- The brand cards ----------

/** "3 guides written · 1 live · 7 AI checks · 6 Reddit threads · 2 changes": only what happened, in that order. */
export function weekLine(week: ClientCard["week"], empty = "Nothing yet this week"): string {
  const parts = [
    week.guidesWritten ? plural(week.guidesWritten, "guide written", "guides written") : "",
    // "1 live" reads well after "guides written"; on its own it needs the word guide.
    week.guidesLive ? (week.guidesWritten ? `${week.guidesLive} live` : plural(week.guidesLive, "guide live", "guides live")) : "",
    week.checks ? plural(week.checks, "AI check", "AI checks") : "",
    week.reddit ? plural(week.reddit, "Reddit thread", "Reddit threads") : "",
    week.changes ? plural(week.changes, "change", "changes") : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : empty;
}

const SETUP_STEPS = ["Reading their products", "Writing buying questions", "Checking what AI says"];

/** Where a new client's setup is: step 1 to 3 and what it's doing. */
export function setupStep(onboarding: string): { step: number; of: number; label: string } {
  const at = onboarding === "scanning" ? 2 : onboarding === "questions" ? 1 : 0; // new and profiling: reading products
  return { step: at + 1, of: SETUP_STEPS.length, label: SETUP_STEPS[at] };
}

/** "Thu 12 Nov", with the year when it isn't this year's. */
const dayWithYear = (day: string, today: string) => `${dayLabel(day)}${day.slice(0, 4) !== today.slice(0, 4) ? ` ${day.slice(0, 4)}` : ""}`;

/** The muted line under a brand's name: "Month 2 · A$945 a month", "Starts Thu 12 Nov · A$945 a month", "Started Mon 12 Oct". */
export function termLine(card: Pick<ClientCard, "status" | "month" | "startedOn" | "feeAud">, today: string): string {
  if (card.status === "ended") return `Started ${dayWithYear(card.startedOn, today)}`; // no fee: they don't pay any more
  const when = card.month > 0 ? `Month ${card.month}` : `Starts ${card.startedOn === addDays(today, 1) ? "tomorrow" : dayWithYear(card.startedOn, today)}`;
  return `${when} · ${formatFee(card.feeAud)} a month`;
}

/** "8 orders · 120 visits this month". Visits come from the tracking code, so without it only orders are counted. */
export function salesLine(sales: ClientCard["sales"], tracking: boolean): string {
  const orders = plural(sales.orders, "order", "orders");
  return tracking ? `${orders} · ${plural(sales.visits, "visit", "visits")} this month` : `${orders} this month`;
}

/** "Thu 12 Nov: Best beard oil for dry skin", "Today: ...". Nothing runs for a paused or ended client, so it says so. */
export function nextGuideLine(next: ClientCard["next"], status: ClientStatus, today: string): string {
  if (status === "paused") return "None while the work is paused";
  if (status === "ended") return "None, the work has ended";
  if (!next) return "No guide planned";
  const when = next.day === today ? "Today" : next.day === addDays(today, 1) ? "Tomorrow" : dayLabel(next.day);
  return `${when}: ${next.title}`;
}

/** The first thing on a card that needs Ross (not the gentle tips), and how many more there are. */
export function cardAlert(alerts: Alert[]): { first: Alert; more: number } | null {
  const real = alerts.filter((a) => a.tone !== "info");
  return real.length ? { first: real[0], more: real.length - 1 } : null;
}

// ---------- The hub's headline numbers ----------

/** "2 of 5 spots left", "All 5 spots taken", "1 more than your 5 spots". */
export function spotsLine(active: number, spots = CLIENT_SPOTS): string {
  const left = spots - active;
  if (left > 0) return `${left} of ${spots} ${spots === 1 ? "spot" : "spots"} left`;
  if (left === 0) return `All ${spots} spots taken`;
  return `${-left} more than your ${spots} spots`;
}

/**
 * Under "Sales from AI this month": the orders, which stores the money adds up (when clients sell in different
 * currencies, only the biggest one's are added together), and how many clients aren't counted yet.
 */
export function salesCaption(sales: { orders: number; currency: string; otherCurrencies: boolean }, notTracking: number): string {
  const base = `${plural(sales.orders, "order", "orders")} across your clients${sales.otherCurrencies ? ` (${sales.currency} stores only)` : ""}`;
  return notTracking ? `${base} · ${notTracking} without the tracking code yet` : base;
}

/** One line of "Needs you": an alert with the client it belongs to. */
export type HubAlert = Alert & { shopId: string; client: string };

const TONE_ORDER: Record<AlertTone, number> = { no: 0, warn: 1, info: 2 };

/** Everything that needs Ross across his active clients, worst first (cards keep their order within a tone). */
export function needsYou(cards: Pick<ClientCard, "shopId" | "name" | "status" | "alerts">[]): HubAlert[] {
  return cards
    .filter((c) => c.status === "active")
    .flatMap((c) => c.alerts.map((a) => ({ ...a, shopId: c.shopId, client: c.name })))
    .sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

export type HubTab = ClientStatus;

/** Which clients the hub shows (?show=paused or ?show=ended), back to active when there are none of those. */
export function pickTab(raw: string | null, counts: { paused: number; ended: number }): HubTab {
  if (raw === "paused" && counts.paused > 0) return "paused";
  if (raw === "ended" && counts.ended > 0) return "ended";
  return "active";
}

/** True when moving between the hub's tabs only (the cards are all on the page already, so nothing to reload). */
export function onlyTabChanged(from: URL, to: URL): boolean {
  if (from.pathname !== to.pathname) return false;
  const rest = (u: URL) => {
    const p = new URLSearchParams(u.search);
    p.delete("show");
    p.sort();
    return p.toString();
  };
  return rest(from) === rest(to) && from.searchParams.get("show") !== to.searchParams.get("show");
}

// ---------- The daily log ----------

/** The day the log shows: ?day=2026-11-04, or today when it's missing, not a real day, or still to come. */
export function pickDay(raw: string | null, today: string): string {
  return raw && isDay(raw) && raw <= today ? raw : today;
}
