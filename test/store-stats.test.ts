// A client's store stats in the agency hub (app/lib/store-stats.ts): the days a page shows and the days before them,
// filling in days with nothing, changes as a percent, where shoppers came from, each AI assistant, the products bought
// after asking AI, the AI score by day and by assistant, and the work log's summary line. No database.

import { describe, expect, it } from "vitest";
import {
  dailyScores,
  dayList,
  engineRows,
  engineScores,
  fillDays,
  fullyTracked,
  pctChange,
  readSpan,
  roundMoney,
  shareOf,
  shopperSources,
  statWindow,
  sumValues,
  topProducts,
  utcDay,
} from "../app/lib/store-stats";

describe("the days shown", () => {
  it("reads 7, 30 or 90 days, else the default", () => {
    expect(readSpan("7")).toBe(7);
    expect(readSpan("90")).toBe(90);
    expect(readSpan(null)).toBe(30);
    expect(readSpan("14")).toBe(30);
    expect(readSpan("abc", 7)).toBe(7);
  });

  it("ends today and compares with the same number of days just before", () => {
    expect(statWindow("2026-11-05", 7)).toEqual({ days: 7, from: "2026-10-30", to: "2026-11-05", prevFrom: "2026-10-23", prevTo: "2026-10-29" });
    const w = statWindow("2026-03-01", 30);
    expect(dayList(w.from, w.to)).toHaveLength(30);
    expect(dayList(w.prevFrom, w.prevTo)).toHaveLength(30);
    expect(w.prevTo < w.from).toBe(true);
  });

  it("lists every day across a month end, and never loops on a bad range", () => {
    expect(dayList("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(dayList("2026-11-02", "2026-10-30")).toEqual([]);
    expect(dayList("2020-01-01", "2030-01-01")).toHaveLength(400);
  });

  it("reads the date of a row saved by UTC day as it is", () => {
    expect(utcDay(new Date("2026-11-05T00:00:00Z"))).toBe("2026-11-05");
    expect(utcDay("2026-11-05T23:59:00.000Z")).toBe("2026-11-05");
  });
});

describe("filling in the days", () => {
  it("gives days with no rows a 0, adds rows on the same day, and leaves out rows outside", () => {
    const days = fillDays("2026-11-01", "2026-11-04", [
      { day: "2026-11-02", value: 10.1 },
      { day: "2026-11-02", value: 0.2 },
      { day: "2026-11-04", value: 5 },
      { day: "2026-10-31", value: 99 },
      { day: "2026-11-05", value: 99 },
    ]);
    expect(days).toEqual([
      { day: "2026-11-01", value: 0 },
      { day: "2026-11-02", value: 10.3 },
      { day: "2026-11-03", value: 0 },
      { day: "2026-11-04", value: 5 },
    ]);
    expect(sumValues(days)).toBe(15.3);
  });

  it("keeps money to the cent", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(19.999)).toBe(20);
  });
});

describe("changes and shares", () => {
  it("is the change in whole percent, and nothing when there was nothing before", () => {
    expect(pctChange(125, 100)).toBe(25);
    expect(pctChange(90, 100)).toBe(-10);
    expect(pctChange(100, 100)).toBe(0);
    expect(pctChange(1, 3)).toBe(-67);
    expect(pctChange(50, 0)).toBeNull();
    expect(pctChange(0, 0)).toBeNull();
  });

  it("is a share only when there is a whole", () => {
    expect(shareOf(25, 100)).toBe(0.25);
    expect(shareOf(5, 0)).toBeNull();
  });

  it("compares only when the tracking code counted all of the days before", () => {
    expect(fullyTracked("2026-09-01", "2026-10-06")).toBe(true);
    expect(fullyTracked("2026-10-06", "2026-10-06")).toBe(true);
    expect(fullyTracked("2026-10-20", "2026-10-06")).toBe(false);
    expect(fullyTracked(null, "2026-10-06")).toBe(false);
  });
});

describe("where shoppers came from", () => {
  it("is AI, search and what's left of everything", () => {
    const s = shopperSources({
      all: { visits: 1000, orders: 40, revenue: 4000 },
      ai: { visits: 50, orders: 3, revenue: 300.5 },
      search: { visits: 400, orders: 15, revenue: 1500 },
    });
    expect(s.other).toEqual({ visits: 550, orders: 22, revenue: 2199.5 });
    expect(s.all.revenue).toBe(4000);
  });

  it("never goes below 0 when the daily totals and single orders are dated a little apart", () => {
    const s = shopperSources({
      all: { visits: 10, orders: 1, revenue: 100 },
      ai: { visits: 12, orders: 2, revenue: 150 },
      search: { visits: 0, orders: 0, revenue: 0 },
    });
    expect(s.other).toEqual({ visits: 0, orders: 0, revenue: 0 });
  });
});

describe("each AI assistant", () => {
  it("counts orders, sales and visits by assistant, most sales first", () => {
    const rows = engineRows(
      [
        { engine: "chatgpt", revenue: 40 },
        { engine: "chatgpt", revenue: 60.1 },
        { engine: "perplexity", revenue: 200 },
        { engine: "ours", revenue: 30 },
      ],
      [{ engine: "chatgpt" }, { engine: "chatgpt" }, { engine: "gemini" }, { engine: "perplexity" }, { engine: "ours" }],
    );
    expect(rows.map((r) => r.engine)).toEqual(["perplexity", "chatgpt", "ours", "gemini"]);
    expect(rows[1]).toEqual({ engine: "chatgpt", label: "ChatGPT", orders: 2, revenue: 100.1, visits: 2 });
    expect(rows[2]).toEqual({ engine: "ours", label: "Pages we built", orders: 1, revenue: 30, visits: null });
    expect(rows[3]).toEqual({ engine: "gemini", label: "Gemini", orders: 0, revenue: 0, visits: 1 });
  });

  it("names an assistant it doesn't know Other AI", () => {
    expect(engineRows([{ engine: "mystery", revenue: 5 }], [])[0].label).toBe("Other AI");
  });
});

describe("products bought after asking AI", () => {
  it("adds up each product's quantity, most first, and skips what isn't a product", () => {
    const top = topProducts([
      [{ title: "Beard Oil", qty: 2 }, { title: "Balm", qty: 1 }],
      [{ title: "Beard Oil", qty: 1 }, { title: " ", qty: 5 }, { title: "Comb" }],
      "not a list",
      null,
      [{ title: "Balm", qty: 0 }, { qty: 3 }],
    ]);
    expect(top).toEqual([
      { title: "Beard Oil", qty: 3 },
      { title: "Balm", qty: 2 },
      { title: "Comb", qty: 1 },
    ]);
  });

  it("keeps the top few", () => {
    const lists = Array.from({ length: 8 }, (_, i) => [{ title: `P${i}`, qty: i + 1 }]);
    expect(topProducts(lists, 5).map((p) => p.title)).toEqual(["P7", "P6", "P5", "P4", "P3"]);
  });
});

describe("the AI score", () => {
  it("takes each Perth day's last check, with no score on days without one", () => {
    const days = dailyScores(
      [
        { date: "2026-11-02T01:00:00Z", score: 30.4 }, // 9am Perth, 2 Nov
        { date: "2026-11-02T10:00:00Z", score: 34.6 }, // 6pm Perth, 2 Nov: the day's last
        { date: "2026-11-03T17:00:00Z", score: 40 }, // 1am Perth, 4 Nov
      ],
      "2026-11-01",
      "2026-11-04",
    );
    expect(days).toEqual([
      { day: "2026-11-01", score: null },
      { day: "2026-11-02", score: 35 },
      { day: "2026-11-03", score: null },
      { day: "2026-11-04", score: 40 },
    ]);
  });

  it("gives each assistant's latest score in the usual order, with its change when the start asked it too", () => {
    expect(engineScores({ gemini: 12.4, chatgpt: 40, claude: 5, other: 3 }, { chatgpt: 35, gemini: 20 })).toEqual([
      { engine: "chatgpt", label: "ChatGPT", score: 40, change: 5 },
      { engine: "gemini", label: "Gemini", score: 12, change: -8 },
      { engine: "claude", label: "Claude", score: 5, change: null },
      { engine: "other", label: "Other AI", score: 3, change: null },
    ]);
  });

  it("copes with no start and with JSON that isn't scores", () => {
    expect(engineScores({ aio: 22 }, null)).toEqual([{ engine: "aio", label: "Google AI Overviews", score: 22, change: null }]);
    expect(engineScores("nope", null)).toEqual([]);
    expect(engineScores({ chatgpt: "40" }, null)).toEqual([]);
  });
});
