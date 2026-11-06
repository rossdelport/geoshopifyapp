// firstpicked.com.au/book: people pick a time for a call with Ross, and it goes straight into Ross's Google Calendar
// (Ross, 3 Nov 2026: every home page button says "Get started" and opens this page). Pure helpers, used by the page
// and by booking.server.ts.

/** When people can book. Times are Ross's own (Perth, the time zone of his Google Calendar). */
export const CALL = {
  timeZone: "Australia/Perth",
  weekdays: [1, 2, 3, 4, 5], // Monday to Friday (0 is Sunday)
  firstStart: 9 * 60, // 9:00 am, in minutes after midnight
  lastEnd: 17 * 60, // the last call ends by 5:00 pm
  minutes: 15, // how long a call is (Ross, 3 Nov 2026: "15 minute FREE introduction call")
  every: 30, // a call can start every half hour, so there is a gap between calls
  daysAhead: 14, // the furthest ahead someone can book
  noticeHours: 4, // the soonest someone can book, from now
};

export type Busy = { start: number; end: number };

/** Minutes the time zone is ahead of UTC at this moment (+480 for Perth). */
function zoneOffset(ms: number, timeZone: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, Number(x.value)]),
  );
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/** The moment it is `minutes` after midnight on this day (y, m, d) in the time zone. */
function atZoneTime(y: number, m: number, d: number, minutes: number, timeZone: string): number {
  const guess = Date.UTC(y, m - 1, d) + minutes * 60_000;
  const first = guess - zoneOffset(guess, timeZone) * 60_000;
  return guess - zoneOffset(first, timeZone) * 60_000; // checked again, for days the clocks change
}

/** Every free start time (ISO, UTC) from `notice` hours after now to `daysAhead` days out, skipping busy times. */
export function openSlots(now: Date, busy: Busy[], call = CALL): string[] {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: call.timeZone, year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(now)
    .reduce<Record<string, number>>((o, x) => (x.type === "literal" ? o : { ...o, [x.type]: Number(x.value) }), {});
  const soonest = now.getTime() + call.noticeHours * 3_600_000;
  const latest = now.getTime() + call.daysAhead * 86_400_000;
  const out: string[] = [];
  for (let i = 0; i <= call.daysAhead; i++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    if (!call.weekdays.includes(day.getUTCDay())) continue;
    for (let t = call.firstStart; t + call.minutes <= call.lastEnd; t += call.every) {
      const start = atZoneTime(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), t, call.timeZone);
      const end = start + call.minutes * 60_000;
      if (start < soonest || start > latest) continue;
      if (busy.some((b) => start < b.end && end > b.start)) continue;
      out.push(new Date(start).toISOString());
    }
  }
  return out;
}

/** "Tuesday 4 November, 10:30 am" in Ross's time zone, for his email. */
export function rossTime(iso: string, call = CALL): string {
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-AU", { timeZone: call.timeZone, weekday: "long", day: "numeric", month: "long" }).format(d);
  const time = new Intl.DateTimeFormat("en-AU", { timeZone: call.timeZone, hour: "numeric", minute: "2-digit" }).format(d);
  return `${day}, ${time}`;
}

/**
 * The two questions above the times (Ross, 6 Nov 2026): "do you have a shopify brand?" (yes or no) and how much the
 * store sells a month. Only a Shopify brand selling A$5,000 or more a month sees the times; anyone else gets a kind
 * note instead. The page builds its drop-down from this list, and the answers go into Ross's calendar and email.
 */
export const SALES = [
  { value: "under-5k", label: "Under A$5,000", fit: false },
  { value: "5k-20k", label: "A$5,000 to A$20,000", fit: true },
  { value: "20k-50k", label: "A$20,000 to A$50,000", fit: true },
  { value: "50k-100k", label: "A$50,000 to A$100,000", fit: true },
  { value: "over-100k", label: "Over A$100,000", fit: true },
];

/** What they sell a month, in words for Ross ("A$20,000 to A$50,000"), when the answers are a fit; else null. */
export function fitSales(shopify: unknown, sales: unknown): string | null {
  const pick = SALES.find((s) => s.value === sales);
  return shopify === "yes" && pick?.fit ? pick.label : null;
}

export const BOOK_ERRORS = {
  generic: "Something went wrong. Please try again, or text Ross on 0400 369 865.",
  name: "Please enter your name.",
  email: "Please enter a real email address, like you@yourstore.com.",
  store: "Please enter your store’s website, like yourstore.com.au.",
  questions: "Please answer the two questions above the times. If you can’t see them, reload the page.",
  taken: "Sorry, that time was just taken. Please pick another one.",
  tooMany: "You’ve booked a lot today. Please text Ross on 0400 369 865.",
  crossSite: "Please use the form on the FirstPicked website.",
  closed: "Online booking isn’t open right now. Please text Ross on 0400 369 865.",
};
