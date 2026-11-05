// The agency hub's rules (app/lib/clients.ts): Ross's calendar, which month of the work a client is in, the client
// form, what needs Ross today, each client's dot, the hub's totals and the order of the brand cards.

import { describe, expect, it } from "vitest";
import {
  type Alert,
  type ClientCard,
  type ClientFacts,
  DEFAULT_FEE,
  addMonths,
  cleanEmails,
  cleanFee,
  cleanPhone,
  clientAlerts,
  clientMonth,
  dayOf,
  dayStartsAt,
  daysSince,
  daysWindow,
  formatFee,
  healthOf,
  hubDay,
  hubTotals,
  monthOneEnds,
  monthStartDay,
  noteTime,
  offerFee,
  planForStatus,
  readClientForm,
  readNoteForm,
  refundUntil,
  sortCards,
  startScore,
} from "../app/lib/clients";
import { OFFER } from "../app/lib/plans";

const form = (fields: Record<string, string>) => ({ get: (k: string) => fields[k] ?? null });

describe("Ross's calendar (Perth)", () => {
  it("puts an instant on its Perth day, 8 hours ahead of UTC", () => {
    expect(dayOf("2026-11-04T15:59:00Z")).toBe("2026-11-04");
    expect(dayOf("2026-11-04T16:00:00Z")).toBe("2026-11-05");
    expect(hubDay(new Date("2026-11-04T16:30:00Z"))).toBe("2026-11-05");
    expect(hubDay(new Date("2026-11-04T16:30:00Z"), 1)).toBe("2026-11-04");
  });

  it("starts a day at midnight Perth and covers whole days", () => {
    expect(dayStartsAt("2026-11-05").toISOString()).toBe("2026-11-04T16:00:00.000Z");
    const w = daysWindow("2026-11-01", "2026-11-05");
    expect(w.gte.toISOString()).toBe("2026-10-31T16:00:00.000Z");
    expect(w.lt.toISOString()).toBe("2026-11-05T16:00:00.000Z");
    expect(monthStartDay("2026-11-05")).toBe("2026-11-01");
  });

  it("adds months and keeps the date inside short months", () => {
    expect(addMonths("2026-11-05", 1)).toBe("2026-12-05");
    expect(addMonths("2026-12-05", 1)).toBe("2027-01-05");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("counts whole days between days", () => {
    expect(daysSince("2026-11-01", "2026-11-05")).toBe(4);
    expect(daysSince("2026-11-05", "2026-11-05")).toBe(0);
    expect(daysSince("2026-11-07", "2026-11-05")).toBe(-2);
  });
});

describe("months of the work", () => {
  it("is month 1 from the start day, month 2 from the same date a month later, 0 before it starts", () => {
    expect(clientMonth("2026-11-05", "2026-11-04")).toBe(0);
    expect(clientMonth("2026-11-05", "2026-11-05")).toBe(1);
    expect(clientMonth("2026-11-05", "2026-12-04")).toBe(1);
    expect(clientMonth("2026-11-05", "2026-12-05")).toBe(2);
    expect(clientMonth("2026-11-05", "2027-11-05")).toBe(13);
    expect(clientMonth("2026-01-31", "2026-02-27")).toBe(1);
    expect(clientMonth("2026-01-31", "2026-02-28")).toBe(2);
    expect(clientMonth("not a day", "2026-11-05")).toBe(0);
  });

  it("ends month 1 the day before the same date next month, refunds 14 days after that", () => {
    expect(monthOneEnds("2026-11-05")).toBe("2026-12-04");
    expect(refundUntil("2026-11-05")).toBe("2026-12-18");
  });

  it("runs the work on Done for you only while a client is active", () => {
    expect(planForStatus("active")).toBe("pro");
    expect(planForStatus("paused")).toBe("free");
    expect(planForStatus("ended")).toBe("free");
  });
});

describe("fees", () => {
  it("starts new clients on the website's price", () => {
    expect(offerFee("A$945 a month")).toBe(945);
    expect(offerFee("A$1,000 a month")).toBe(1000);
    expect(offerFee("free")).toBe(0);
    expect(DEFAULT_FEE).toBe(offerFee(OFFER.price));
    expect(DEFAULT_FEE).toBeGreaterThan(0);
  });

  it("shows fees in Australian dollars", () => {
    expect(formatFee(945)).toBe("A$945");
    expect(formatFee(2835)).toBe("A$2,835");
  });
});

describe("the client form", () => {
  it("tidies emails, phones and fees", () => {
    expect(cleanEmails(" Jo@Shop.com.au, sam@x.co ;jo@shop.com.au ")).toBe("jo@shop.com.au, sam@x.co");
    expect(cleanEmails("")).toBeNull();
    expect(cleanEmails("not an email")).toBe(false);
    expect(cleanEmails("a@b.co,c@d.co,e@f.co,g@h.co,i@j.co,k@l.co")).toBe(false);
    expect(cleanPhone(" 0400  369 865 ")).toBe("0400 369 865");
    expect(cleanPhone("+61 (8) 9000-1234")).toBe("+61 (8) 9000-1234");
    expect(cleanPhone("call me")).toBe(false);
    expect(cleanPhone("123")).toBe(false);
    expect(cleanPhone("")).toBeNull();
    expect(cleanFee("A$945")).toBe(945);
    expect(cleanFee("$1,000.00")).toBe(1000);
    expect(cleanFee("945.50")).toBe(946);
    expect(cleanFee("")).toBeNull();
    expect(cleanFee("lots")).toBe(false);
    expect(cleanFee("-5")).toBe(false);
  });

  it("fills in the website's price, today and Active when left empty", () => {
    const r = readClientForm(form({ name: "  Peace   Lily ", email: "jo@peacelily.com.au" }), "2026-11-05");
    expect(r).toEqual({
      ok: true,
      value: {
        name: "Peace Lily",
        contactName: null,
        email: "jo@peacelily.com.au",
        phone: null,
        feeAud: DEFAULT_FEE,
        startedOn: "2026-11-05",
        status: "active",
        notes: null,
      },
    });
  });

  it("keeps notes' line breaks and strips tags", () => {
    const r = readClientForm(form({ notes: "Line one\r\nLine <b>two</b>", feeAud: "800", startedOn: "2026-10-01", status: "paused" }), "2026-11-05");
    expect(r.ok && r.value).toMatchObject({ notes: "Line one\nLine btwo/b", feeAud: 800, startedOn: "2026-10-01", status: "paused" });
  });

  it("says what's wrong with each field", () => {
    const r = readClientForm(form({ email: "nope", phone: "abc", feeAud: "a lot", startedOn: "2020-01-01", status: "gone" }), "2026-11-05");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["email", "feeAud", "phone", "startedOn", "status"]);
  });
});

describe("work log entries", () => {
  it("takes a kind, some text and a day in the last year", () => {
    expect(readNoteForm(form({ kind: "change", text: " Fixed 5 product pages " }), "2026-11-05")).toEqual({ ok: true, kind: "change", text: "Fixed 5 product pages", day: "2026-11-05" });
    expect(readNoteForm(form({ kind: "call", text: "Monthly call", day: "2026-11-01" }), "2026-11-05")).toMatchObject({ ok: true, day: "2026-11-01" });
    expect(readNoteForm(form({ kind: "status", text: "x" }), "2026-11-05").ok).toBe(false);
    expect(readNoteForm(form({ kind: "note", text: "  " }), "2026-11-05").ok).toBe(false);
    expect(readNoteForm(form({ kind: "note", text: "x", day: "2026-11-06" }), "2026-11-05").ok).toBe(false);
    expect(readNoteForm(form({ kind: "note", text: "x".repeat(1001) }), "2026-11-05").ok).toBe(false);
  });

  it("times an entry now when it's today, else midday Perth that day", () => {
    const now = new Date("2026-11-05T03:00:00Z");
    expect(noteTime("2026-11-05", "2026-11-05", now)).toBe(now);
    expect(noteTime("2026-11-01", "2026-11-05", now).toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });
});

const NOW = new Date("2026-11-20T02:00:00Z"); // 10am Perth, Fri 20 Nov
const TODAY = "2026-11-20";
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const facts = (over: Partial<ClientFacts> = {}): ClientFacts => ({
  shopId: "s1",
  status: "active",
  onboarding: "done",
  setupFailed: false,
  setupSince: ago(24 * 20),
  tracking: true,
  startedOn: "2026-11-02",
  lastScanAt: ago(5),
  lastScanFailed: false,
  scanRunning: false,
  guidesToAdd: 0,
  firstToAdd: null,
  guidesNeedOk: 0,
  guidesFailed: 0,
  firstFailed: null,
  lastReportAt: ago(24 * 2),
  lastCallAt: ago(24 * 10),
  costCapHit: false,
  ...over,
});

const keys = (alerts: Alert[]) => alerts.map((a) => a.key);

describe("what needs Ross", () => {
  it("is nothing when all is well", () => {
    expect(clientAlerts(facts(), TODAY, NOW)).toEqual([]);
  });

  it("is nothing for paused, ended or non-clients: their work is stopped on purpose", () => {
    expect(clientAlerts(facts({ status: "paused", tracking: false, lastScanAt: null }), TODAY, NOW)).toEqual([]);
    expect(clientAlerts(facts({ status: "ended", guidesFailed: 2 }), TODAY, NOW)).toEqual([]);
    expect(clientAlerts(facts({ status: null, guidesFailed: 2 }), TODAY, NOW)).toEqual([]);
  });

  it("only talks about setup until setup is done", () => {
    expect(clientAlerts(facts({ onboarding: "scanning", setupFailed: true, tracking: false }), TODAY, NOW)).toEqual([
      { key: "setup", tone: "no", text: "Setup stopped partway", label: "Try again", intent: { name: "retry-setup" } },
    ]);
    expect(keys(clientAlerts(facts({ onboarding: "profiling", setupSince: ago(3), tracking: false }), TODAY, NOW))).toEqual(["setup"]);
    expect(clientAlerts(facts({ onboarding: "profiling", setupSince: ago(1), tracking: false }), TODAY, NOW)).toEqual([]);
    expect(clientAlerts(facts({ onboarding: "scanning", setupSince: ago(5), scanRunning: true }), TODAY, NOW)).toEqual([]);
  });

  it("puts broken things first, then things to do, then good to know", () => {
    const alerts = clientAlerts(
      facts({ startedOn: "2026-11-02", tracking: false, guidesToAdd: 2, firstToAdd: "g1", guidesFailed: 1, firstFailed: "g9", lastScanFailed: true }),
      "2026-11-28",
      new Date("2026-11-28T02:00:00Z"),
    );
    expect(alerts.map((a) => a.tone)).toEqual(["no", "no", "warn", "warn", "warn", "info"]);
    expect(keys(alerts)).toEqual(["guides-failed", "check", "guides-add", "tracking", "report", "month-one"]);
    expect(alerts[0].to).toBe("/dash/clients/s1/guides/g9");
    expect(alerts[2]).toMatchObject({ text: "2 guides are ready to add to their store", to: "/dash/clients/s1/guides/g1" });
  });

  it("asks for an AI check after 3 days without one, but not while one runs", () => {
    expect(clientAlerts(facts({ lastScanAt: ago(80) }), TODAY, NOW)[0]).toMatchObject({ key: "check", text: "No AI check for 3 days", intent: { name: "check-now" } });
    expect(clientAlerts(facts({ lastScanAt: null }), TODAY, NOW)[0]).toMatchObject({ text: "No AI check yet" });
    expect(clientAlerts(facts({ lastScanAt: ago(80), scanRunning: true }), TODAY, NOW)).toEqual([]);
    expect(clientAlerts(facts({ lastScanFailed: true, scanRunning: true }), TODAY, NOW)).toEqual([]);
  });

  it("says when a weekly report is due, from day 7 and a week after the last one", () => {
    expect(keys(clientAlerts(facts({ startedOn: "2026-11-17", lastReportAt: null }), TODAY, NOW))).toEqual([]);
    expect(keys(clientAlerts(facts({ startedOn: "2026-11-14", lastReportAt: null }), TODAY, NOW))).toEqual(["report"]);
    expect(keys(clientAlerts(facts({ lastReportAt: ago(24 * 6) }), TODAY, NOW))).toEqual([]);
    expect(clientAlerts(facts({ lastReportAt: ago(24 * 7) }), TODAY, NOW)[0]).toMatchObject({ key: "report", intent: { name: "report", kind: "week" } });
  });

  it("says when the monthly call is due", () => {
    expect(keys(clientAlerts(facts({ startedOn: "2026-10-20", lastCallAt: null }), TODAY, NOW))).toEqual(["call"]);
    expect(keys(clientAlerts(facts({ startedOn: "2026-10-20", lastCallAt: ago(24 * 29) }), TODAY, NOW))).toEqual([]);
    expect(keys(clientAlerts(facts({ startedOn: "2026-11-10", lastCallAt: null }), TODAY, NOW))).toEqual([]);
  });

  it("flags the end of the first month in its last week", () => {
    const end = clientAlerts(facts({ startedOn: "2026-10-26", lastCallAt: ago(1) }), TODAY, NOW);
    expect(end).toEqual([
      { key: "month-one", tone: "info", text: "First month ends Wed 25 Nov. A good time to show them the results.", label: "Reports", to: "/dash/clients/s1/reports" },
    ]);
    expect(clientAlerts(facts({ startedOn: "2026-10-21", lastCallAt: ago(1) }), TODAY, NOW)[0].text).toBe("First month ends today. A good time to show them the results.");
    expect(clientAlerts(facts({ startedOn: "2026-11-02" }), TODAY, NOW)).toEqual([]);
  });

  it("gives each client a dot", () => {
    expect(healthOf("active", [])).toBe("ok");
    expect(healthOf("active", [{ key: "a", tone: "info", text: "" }])).toBe("ok");
    expect(healthOf("active", [{ key: "a", tone: "warn", text: "" }])).toBe("warn");
    expect(healthOf("active", [{ key: "a", tone: "warn", text: "" }, { key: "b", tone: "no", text: "" }])).toBe("no");
    expect(healthOf("paused", [{ key: "b", tone: "no", text: "" }])).toBe("off");
    expect(healthOf(null, [])).toBe("off");
  });
});

const card = (over: Partial<ClientCard> = {}): ClientCard => ({
  shopId: "s",
  name: "Brand",
  host: "brand.com.au",
  country: "AU",
  currency: "AUD",
  status: "active",
  feeAud: 945,
  startedOn: "2026-11-01",
  month: 1,
  contactName: null,
  email: null,
  phone: null,
  onboarding: "done",
  tracking: true,
  score: 40,
  scoreStart: 30,
  trend: [30, 40],
  sales: { revenue: 100, orders: 1, visits: 10 },
  week: { guidesWritten: 1, guidesLive: 1, checks: 7, reddit: 3, changes: 0 },
  next: null,
  alerts: [],
  health: "ok",
  ...over,
});

describe("the hub's numbers and cards", () => {
  it("adds up active clients only, in their main currency", () => {
    const t = hubTotals([
      card({ shopId: "a", feeAud: 945, sales: { revenue: 300, orders: 3, visits: 9 }, alerts: [{ key: "x", tone: "warn", text: "" }, { key: "y", tone: "info", text: "" }] }),
      card({ shopId: "b", feeAud: 1000, sales: { revenue: 50, orders: 1, visits: 2 } }),
      card({ shopId: "c", status: "paused", feeAud: 945, sales: { revenue: 999, orders: 9, visits: 9 } }),
      card({ shopId: "d", status: "ended" }),
      card({ shopId: "e", currency: "NZD", sales: { revenue: 20, orders: 1, visits: 1 } }),
    ]);
    expect(t).toMatchObject({ active: 3, paused: 1, ended: 1, feesAud: 2890, guidesThisWeek: 3, liveThisWeek: 3, needsYou: 1 });
    expect(t.sales).toEqual({ currency: "AUD", revenue: 350, orders: 4, otherCurrencies: true });
    expect(hubTotals([]).sales).toEqual({ currency: "AUD", revenue: 0, orders: 0, otherCurrencies: false });
  });

  it("shows active clients first, the ones that need a look first, then the newest", () => {
    const order = sortCards([
      card({ shopId: "ended", status: "ended", health: "off" }),
      card({ shopId: "ok-old", health: "ok", startedOn: "2026-10-01" }),
      card({ shopId: "broken", health: "no" }),
      card({ shopId: "ok-new", health: "ok", startedOn: "2026-11-02" }),
      card({ shopId: "paused", status: "paused", health: "off" }),
      card({ shopId: "look", health: "warn" }),
    ]).map((c) => c.shopId);
    expect(order).toEqual(["broken", "look", "ok-new", "ok-old", "paused", "ended"]);
  });

  it("takes the score from when the work started", () => {
    const scores = [
      { score: 20.4, date: "2026-10-20T02:00:00Z" },
      { score: 25.6, date: "2026-11-01T02:00:00Z" },
      { score: 40, date: "2026-11-10T02:00:00Z" },
    ];
    expect(startScore(scores, "2026-11-05")).toBe(26);
    expect(startScore(scores, "2026-10-01")).toBe(20);
    expect(startScore([], "2026-11-05")).toBeNull();
  });
});
