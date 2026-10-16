// The guide calendar's rules (app/lib/guide-calendar.ts): which days get a guide, the store's own day and hour,
// which question and products a day gets, what each day says, and which page addresses count as the store's own.

import { describe, expect, it } from "vitest";
import {
  addDays,
  calendarWeeks,
  daysInMonth,
  isDay,
  isMonth,
  localDay,
  localHour,
  localMonthStart,
  monthLabel,
  monthsApart,
  dayLabel,
  ownPageUrl,
  pickQuestions,
  questionWords,
  rankProductsForQuestion,
  shiftMonth,
  slotDaysForMonth,
  slotState,
  writeDay,
  type PickableQuestion,
} from "../app/lib/guide-calendar";

describe("days and months", () => {
  it("spreads 4 guides a month about a week apart and 12 about three a week, never before the 3rd", () => {
    expect(slotDaysForMonth("2026-10", 4)).toEqual(["2026-10-04", "2026-10-12", "2026-10-19", "2026-10-27"]);
    const twelve = slotDaysForMonth("2026-11", 12);
    expect(twelve).toHaveLength(12);
    expect(new Set(twelve).size).toBe(12);
    expect(twelve[0]).toBe("2026-11-03");
    expect(twelve.at(-1)).toBe("2026-11-29");
    const feb = slotDaysForMonth("2027-02", 12);
    expect(feb).toHaveLength(12);
    expect(feb.every((d) => d >= "2027-02-03" && d <= "2027-02-28")).toBe(true);
    expect(slotDaysForMonth("2026-10", 0)).toEqual([]);
  });

  it("adds days across month and year ends, and writes two days before", () => {
    expect(addDays("2026-10-30", 2)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(writeDay("2026-10-12")).toBe("2026-10-10");
    expect(daysInMonth("2028-02")).toBe(29);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthsApart("2027-01", "2026-10")).toBe(3);
    expect(monthsApart("2026-08", "2026-10")).toBe(-2);
  });

  it("checks day and month strings", () => {
    expect(isDay("2026-10-20")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("20-10-2026")).toBe(false);
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("2026-1")).toBe(false);
  });

  it("knows the store's own day and hour from its country", () => {
    const late = new Date("2026-10-15T20:00:00Z");
    expect(localDay(late, "AU")).toBe("2026-10-16"); // 7am next day in Sydney
    expect(localDay(late, "US")).toBe("2026-10-15");
    expect(localDay(late, null)).toBe("2026-10-15");
    expect(localDay(late, "ZZ")).toBe("2026-10-15"); // unknown country: UTC
    expect(localHour(new Date("2026-10-15T22:30:00Z"), "AU")).toBe(9); // Sydney summer time, UTC+11
    expect(localHour(new Date("2026-10-15T22:30:00Z"), "GB")).toBe(23);
  });

  it("counts the month from midnight on the 1st on the store's own clock", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(localMonthStart(now, "AU").toISOString()).toBe("2026-10-31T13:00:00.000Z"); // Sydney, UTC+11 in summer
    expect(localMonthStart(now, "US").toISOString()).toBe("2026-11-01T04:00:00.000Z"); // New York, UTC-4 on 1 November
    expect(localMonthStart(now, null).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    // Just after midnight on the 1st in Sydney it is still October in UTC, but the store's November has begun.
    expect(localMonthStart(new Date("2026-10-31T13:30:00Z"), "AU").toISOString()).toBe("2026-10-31T13:00:00.000Z");
  });

  it("lays a month out in Monday-first weeks", () => {
    const weeks = calendarWeeks("2026-10"); // 1 October 2026 is a Thursday
    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks[4].at(-1)).toBeNull();
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
    expect(calendarWeeks("2026-06")[0][0]).toBe("2026-06-01"); // a Monday
  });

  it("labels days and months in plain English", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(dayLabel("2026-10-20")).toBe("Tue 20 Oct");
    expect(dayLabel("2026-10-20", "long")).toBe("Tuesday 20 October");
  });
});

describe("what a day says", () => {
  const today = "2026-10-20";
  it("follows the day through planned, writing, OK, scheduled, add, live and failed", () => {
    expect(slotState({ status: "planned", approvedAt: null }, "2026-10-22", today, false)).toBe("planned");
    expect(slotState({ status: "writing", approvedAt: null }, "2026-10-22", today, false)).toBe("writing");
    expect(slotState({ status: "ready", approvedAt: null }, "2026-10-22", today, false)).toBe("needs-ok");
    expect(slotState({ status: "ready", approvedAt: new Date() }, "2026-10-22", today, false)).toBe("scheduled");
    expect(slotState({ status: "ready", approvedAt: new Date() }, "2026-10-20", today, false)).toBe("add");
    expect(slotState({ status: "ready", approvedAt: new Date() }, "2026-10-18", today, false)).toBe("add");
    expect(slotState({ status: "ready", approvedAt: new Date() }, "2026-10-20", today, true)).toBe("scheduled"); // Shopify publishes it
    expect(slotState({ status: "published", approvedAt: new Date() }, "2026-10-20", today, false)).toBe("live");
    expect(slotState({ status: "failed", approvedAt: null }, "2026-10-20", today, false)).toBe("failed");
  });
});

describe("which question and products", () => {
  const q = (id: string, volume: number | null, cluster: string | null, rate: number | null = null): PickableQuestion => ({ id, text: `question ${id}`, volume, cluster, rate });

  it("takes the questions AI loses first, bigger searches first, and never two days in a row on one topic when it can help it", () => {
    const qs = [q("a", 500, "oil", 0.8), q("b", 300, "oil", 0), q("c", 200, "balm", 0.2), q("d", 150, "brush", null), q("e", 100, "oil", 0), q("f", 50, "oil", 0)];
    expect(pickQuestions(qs, new Set(), 6).map((x) => x.id)).toEqual(["b", "c", "e", "d", "f", "a"]);
  });
  it("skips used questions, caps the count and respects the topic of the day before", () => {
    const qs = [q("a", 500, "oil"), q("b", 300, "oil"), q("c", 200, "balm")];
    expect(pickQuestions(qs, new Set(["a"]), 1, "oil").map((x) => x.id)).toEqual(["c"]);
    expect(pickQuestions(qs, new Set(), 2).map((x) => x.id)).toEqual(["a", "c"]);
    expect(pickQuestions(qs, new Set(["a", "b", "c"]), 2)).toEqual([]);
  });
  it("falls back to the same topic when nothing else is left", () => {
    const qs = [q("a", 500, "oil"), q("b", 300, "oil")];
    expect(pickQuestions(qs, new Set(), 2).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("keeps the words of a question worth matching on", () => {
    expect(questionWords("What is the best beard oil for dry skin in Australia?")).toEqual(["beard", "oil", "dry", "skin", "australia"]);
    expect(questionWords("beard balms vs waxes")).toEqual(["beard", "balm", "wax"]);
  });
  it("puts the products a question is about first, titles counting most", () => {
    const products = [
      { title: "Boar Bristle Brush", productType: "Brush", description: "Spreads beard oil evenly." },
      { title: "Cedar Beard Balm", productType: "Balm", tags: ["dry skin"], description: "Shea butter." },
      { title: "Sandalwood Beard Oil", productType: "Oil", description: "Jojoba for dry skin." },
    ];
    const ranked = rankProductsForQuestion(products, "best beard oil for dry skin australia");
    expect(ranked.map((p) => p.title)).toEqual(["Sandalwood Beard Oil", "Cedar Beard Balm", "Boar Bristle Brush"]);
    // No words in common: the catalog's order stands.
    expect(rankProductsForQuestion(products, "gift ideas").map((p) => p.title)).toEqual(products.map((p) => p.title));
  });

  it("accepts only page addresses on the store's own site", () => {
    const shop = { domain: "stubble.myshopify.com", primaryDomain: "www.stubblebros.com.au" };
    expect(ownPageUrl("https://stubblebros.com.au/pages/best-beard-oil", shop)).toBe("https://stubblebros.com.au/pages/best-beard-oil");
    expect(ownPageUrl(" https://stubble.myshopify.com/pages/x ", shop)).toBe("https://stubble.myshopify.com/pages/x");
    expect(ownPageUrl("http://stubblebros.com.au/pages/x", shop)).toBeNull();
    expect(ownPageUrl("https://evil.com/stubblebros.com.au", shop)).toBeNull();
    expect(ownPageUrl("https://user:pw@stubblebros.com.au/pages/x", shop)).toBeNull();
    expect(ownPageUrl("not a link", shop)).toBeNull();
    expect(ownPageUrl(null, shop)).toBeNull();
  });
});
