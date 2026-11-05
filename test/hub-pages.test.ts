// The agency hub's own pages (app/lib/hub-pages.ts): the words on a brand card, the headline numbers, "Needs you",
// the Active / Paused / Ended tabs, and the daily log's day. No database.

import { describe, expect, it } from "vitest";
import type { Alert, ClientCard } from "../app/lib/clients";
import {
  cardAlert,
  needsYou,
  nextGuideLine,
  onlyTabChanged,
  pickDay,
  pickTab,
  salesCaption,
  salesLine,
  setupStep,
  spotsLine,
  termLine,
  weekLine,
} from "../app/lib/hub-pages";

const week = (w: Partial<ClientCard["week"]> = {}): ClientCard["week"] => ({ guidesWritten: 0, guidesLive: 0, checks: 0, reddit: 0, changes: 0, ...w });
const alert = (key: string, tone: Alert["tone"], text = key): Alert => ({ key, tone, text });

describe("a brand card", () => {
  it("says what happened this week, only the parts that did, singular for one", () => {
    expect(weekLine(week({ guidesWritten: 3, guidesLive: 1, checks: 7, reddit: 6, changes: 2 }))).toBe(
      "3 guides written · 1 live · 7 AI checks · 6 Reddit threads · 2 changes",
    );
    expect(weekLine(week({ guidesWritten: 1, checks: 1, reddit: 1, changes: 1 }))).toBe("1 guide written · 1 AI check · 1 Reddit thread · 1 change");
    expect(weekLine(week({ guidesLive: 2 }))).toBe("2 guides live"); // no "guides written" before it to lean on
    expect(weekLine(week())).toBe("Nothing yet this week");
    expect(weekLine(week(), "Nothing this week")).toBe("Nothing this week");
  });

  it("names the setup step a new client is on", () => {
    expect(setupStep("new")).toEqual({ step: 1, of: 3, label: "Reading their products" });
    expect(setupStep("profiling")).toEqual({ step: 1, of: 3, label: "Reading their products" });
    expect(setupStep("questions")).toEqual({ step: 2, of: 3, label: "Writing buying questions" });
    expect(setupStep("scanning")).toEqual({ step: 3, of: 3, label: "Checking what AI says" });
  });

  it("shows the month of the work and the fee, the start day before it starts, and no fee once ended", () => {
    const today = "2026-11-05";
    expect(termLine({ status: "active", month: 2, startedOn: "2026-09-20", feeAud: 945 }, today)).toBe("Month 2 · A$945 a month");
    expect(termLine({ status: "active", month: 0, startedOn: "2026-11-12", feeAud: 945 }, today)).toBe("Starts Thu 12 Nov · A$945 a month");
    expect(termLine({ status: "active", month: 0, startedOn: "2026-11-06", feeAud: 1200 }, today)).toBe("Starts tomorrow · A$1,200 a month");
    expect(termLine({ status: "paused", month: 3, startedOn: "2026-08-01", feeAud: 945 }, today)).toBe("Month 3 · A$945 a month");
    expect(termLine({ status: "ended", month: 5, startedOn: "2026-06-01", feeAud: 945 }, today)).toBe("Started Mon 1 Jun");
    expect(termLine({ status: "ended", month: 14, startedOn: "2025-09-01", feeAud: 945 }, today)).toBe("Started Mon 1 Sep 2025");
  });

  it("counts visits only when the tracking code is on", () => {
    expect(salesLine({ revenue: 1240, orders: 8, visits: 120 }, true)).toBe("8 orders · 120 visits this month");
    expect(salesLine({ revenue: 60, orders: 1, visits: 1 }, true)).toBe("1 order · 1 visit this month");
    expect(salesLine({ revenue: 60, orders: 1, visits: 0 }, false)).toBe("1 order this month");
  });

  it("names the next guide, and says nothing runs while paused or ended", () => {
    const next = { day: "2026-11-12", title: "Best beard oil for dry skin", id: "s1" };
    expect(nextGuideLine(next, "active", "2026-11-05")).toBe("Thu 12 Nov: Best beard oil for dry skin");
    expect(nextGuideLine({ ...next, day: "2026-11-05" }, "active", "2026-11-05")).toBe("Today: Best beard oil for dry skin");
    expect(nextGuideLine({ ...next, day: "2026-11-06" }, "active", "2026-11-05")).toBe("Tomorrow: Best beard oil for dry skin");
    expect(nextGuideLine(null, "active", "2026-11-05")).toBe("No guide planned");
    expect(nextGuideLine(next, "paused", "2026-11-05")).toBe("None while the work is paused");
    expect(nextGuideLine(next, "ended", "2026-11-05")).toBe("None, the work has ended");
  });

  it("shows the first real alert and how many more, leaving out the gentle tips", () => {
    expect(cardAlert([])).toBeNull();
    expect(cardAlert([alert("month-one", "info")])).toBeNull();
    expect(cardAlert([alert("check", "no"), alert("report", "warn"), alert("month-one", "info")])).toEqual({ first: alert("check", "no"), more: 1 });
  });
});

describe("the hub's headline numbers", () => {
  it("counts the spots left out of 5", () => {
    expect(spotsLine(3)).toBe("2 of 5 spots left");
    expect(spotsLine(0)).toBe("5 of 5 spots left");
    expect(spotsLine(5)).toBe("All 5 spots taken");
    expect(spotsLine(6)).toBe("1 more than your 5 spots");
  });

  it("says which stores the sales add up and who isn't counted yet", () => {
    expect(salesCaption({ orders: 4, currency: "AUD", otherCurrencies: false }, 0)).toBe("4 orders across your clients");
    expect(salesCaption({ orders: 1, currency: "AUD", otherCurrencies: true }, 0)).toBe("1 order across your clients (AUD stores only)");
    expect(salesCaption({ orders: 0, currency: "AUD", otherCurrencies: false }, 2)).toBe("0 orders across your clients · 2 without the tracking code yet");
  });
});

describe("Needs you", () => {
  const card = (shopId: string, status: ClientCard["status"], alerts: Alert[]) => ({ shopId, name: `Brand ${shopId}`, status, alerts });

  it("lists active clients' alerts worst first, keeping the cards' order within a tone", () => {
    const rows = needsYou([
      card("a", "active", [alert("report", "warn"), alert("month-one", "info")]),
      card("b", "active", [alert("setup", "no")]),
      card("c", "paused", [alert("check", "no")]), // paused: its work is stopped on purpose
      card("d", "active", [alert("tracking", "warn")]),
    ]);
    expect(rows.map((r) => `${r.shopId}:${r.key}`)).toEqual(["b:setup", "a:report", "d:tracking", "a:month-one"]);
    expect(rows[0]).toMatchObject({ client: "Brand b", tone: "no", text: "setup" });
  });

  it("is empty when nothing needs Ross", () => {
    expect(needsYou([card("a", "active", [])])).toEqual([]);
  });
});

describe("the tabs", () => {
  it("shows paused or ended clients only when there are some", () => {
    expect(pickTab(null, { paused: 1, ended: 1 })).toBe("active");
    expect(pickTab("paused", { paused: 2, ended: 0 })).toBe("paused");
    expect(pickTab("paused", { paused: 0, ended: 3 })).toBe("active");
    expect(pickTab("ended", { paused: 0, ended: 3 })).toBe("ended");
    expect(pickTab("everything", { paused: 2, ended: 2 })).toBe("active");
  });

  it("needs no reload when only the tab changed", () => {
    const u = (s: string) => new URL(s, "https://firstpicked.com.au");
    expect(onlyTabChanged(u("/dash"), u("/dash?show=paused"))).toBe(true);
    expect(onlyTabChanged(u("/dash?show=ended"), u("/dash"))).toBe(true);
    expect(onlyTabChanged(u("/dash"), u("/dash"))).toBe(false); // a refresh
    expect(onlyTabChanged(u("/dash?show=paused"), u("/dash/log?show=paused"))).toBe(false);
    expect(onlyTabChanged(u("/dash?x=1"), u("/dash?show=paused"))).toBe(false);
  });
});

describe("the daily log", () => {
  it("shows the day asked for, or today when it's missing, not a day or still to come", () => {
    expect(pickDay("2026-11-04", "2026-11-05")).toBe("2026-11-04");
    expect(pickDay("2026-11-05", "2026-11-05")).toBe("2026-11-05");
    expect(pickDay(null, "2026-11-05")).toBe("2026-11-05");
    expect(pickDay("2026-11-06", "2026-11-05")).toBe("2026-11-05");
    expect(pickDay("2026-02-30", "2026-11-05")).toBe("2026-11-05");
    expect(pickDay("yesterday", "2026-11-05")).toBe("2026-11-05");
  });
});
