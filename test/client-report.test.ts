// Client reports (app/lib/client-report.ts): the days a report covers, the words for its numbers, the work a client may
// see, and the email that sends it. Pure functions only: no network, no database.

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  type ClientReportData,
  assistantRows,
  engineScores,
  firstName,
  hasWork,
  headlines,
  isReportKind,
  isReportToken,
  moneyChange,
  periodDays,
  periodLabel,
  periodStartScore,
  plural,
  pointsChange,
  previousPeriod,
  questionSummary,
  readReportData,
  readReportNote,
  reportEmail,
  reportPeriod,
  reportTitle,
  shareText,
  workFromLog,
  workStartScore,
} from "../app/lib/client-report";
import { type LogEntry, CLIENT_SEES } from "../app/lib/work-log";

const sample = (over: Partial<ClientReportData> = {}): ClientReportData => ({
  v: 1,
  brand: "Beard & Co",
  host: "beardco.com.au",
  currency: "AUD",
  kind: "week",
  fromDay: "2026-10-30",
  toDay: "2026-11-05",
  madeAt: "2026-11-05T01:41:00.000Z",
  startedOn: "2026-10-01",
  month: 2,
  note: null,
  tracking: true,
  sales: { revenue: 1240, orders: 7, visits: 85 },
  salesBefore: { revenue: 1000, orders: 5, visits: 60 },
  store: { revenue: 31000, orders: 410 },
  share: 0.04,
  byAssistant: [{ name: "ChatGPT", revenue: 1240, orders: 7, visits: 85 }],
  score: { now: 42, periodStart: 36, workStart: 24, byAssistant: [{ name: "ChatGPT", score: 40 }] },
  questions: { tracked: 100, checked: 96, named: 12, top: [{ text: "best beard oil australia", searches: 1900, named: true }] },
  rivals: [{ brand: "Milkman", share: 0.34 }],
  work: { guidesWritten: ["Best beard oil for dry skin"], guidesLive: [], changes: [], calls: [], checks: 7, reddit: [], writers: [] },
  next: [{ day: "2026-11-10", title: "Beard oil or balm?" }],
  ...over,
});

describe("the days a report covers", () => {
  it("a week is the 7 days up to and including today", () => {
    const p = reportPeriod("week", "2026-11-05");
    expect(p).toEqual({ from: "2026-10-30", to: "2026-11-05" });
    expect(periodDays(p)).toBe(7);
    expect(reportPeriod("week", "2027-01-03")).toEqual({ from: "2026-12-28", to: "2027-01-03" });
  });

  it("a month runs from the day after the same date last month", () => {
    expect(reportPeriod("month", "2026-11-05")).toEqual({ from: "2026-10-06", to: "2026-11-05" });
    expect(reportPeriod("month", "2026-01-05")).toEqual({ from: "2025-12-06", to: "2026-01-05" });
  });

  it("handles month ends and leap years", () => {
    // 31 March: last month has no 31st, so it starts on 1 March, never in February.
    expect(reportPeriod("month", "2026-03-31")).toEqual({ from: "2026-03-01", to: "2026-03-31" });
    expect(reportPeriod("month", "2026-03-30")).toEqual({ from: "2026-03-01", to: "2026-03-30" });
    expect(reportPeriod("month", "2026-03-01")).toEqual({ from: "2026-02-02", to: "2026-03-01" });
    expect(reportPeriod("month", "2028-03-30")).toEqual({ from: "2028-03-01", to: "2028-03-30" });
    expect(reportPeriod("month", "2026-01-31")).toEqual({ from: "2026-01-01", to: "2026-01-31" });
    expect(reportPeriod("month", "2026-12-31")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("the period before is just as long and ends the day before", () => {
    expect(previousPeriod({ from: "2026-10-30", to: "2026-11-05" })).toEqual({ from: "2026-10-23", to: "2026-10-29" });
    const month = reportPeriod("month", "2026-11-05");
    const before = previousPeriod(month);
    expect(before.to).toBe("2026-10-05");
    expect(periodDays(before)).toBe(periodDays(month));
    expect(previousPeriod(reportPeriod("month", "2026-03-31"))).toEqual({ from: "2026-01-29", to: "2026-02-28" });
  });

  it("names the days plainly, with years only across new year", () => {
    expect(periodLabel("2026-10-30", "2026-11-05")).toBe("30 Oct to 5 Nov");
    expect(periodLabel("2026-12-28", "2027-01-03")).toBe("28 Dec 2026 to 3 Jan 2027");
    expect(reportTitle({ kind: "week", fromDay: "2026-10-30", toDay: "2026-11-05" })).toBe("Weekly report, 30 Oct to 5 Nov");
    expect(reportTitle({ kind: "month", fromDay: "2026-10-06", toDay: "2026-11-05" })).toBe("Monthly report, 6 Oct to 5 Nov");
  });

  it("knows its two kinds", () => {
    expect(isReportKind("week")).toBe(true);
    expect(isReportKind("month")).toBe(true);
    expect(isReportKind("year")).toBe(false);
    expect(isReportKind(null)).toBe(false);
  });
});

describe("words for the numbers", () => {
  it("says singular and plural right", () => {
    expect(plural(1, "order", "orders")).toBe("1 order");
    expect(plural(0, "order", "orders")).toBe("0 orders");
    expect(plural(1900, "search", "searches")).toBe("1,900 searches");
  });

  it("says how sales changed: up green, down red, the same grey", () => {
    expect(moneyChange(1250, 1000, "AUD", "week")).toEqual({ tone: "up", text: "Up 25% from $1,000 the week before" });
    expect(moneyChange(900, 1000, "AUD", "month")).toEqual({ tone: "down", text: "Down 10% from $1,000 the month before" });
    expect(moneyChange(500, 500, "AUD", "week")).toEqual({ tone: "same", text: "The same as the week before" });
    expect(moneyChange(300, 0, "AUD", "week")).toEqual({ tone: "up", text: "Up from $0 the week before" });
    expect(moneyChange(1002, 1000, "AUD", "week").text).toBe("Up less than 1% from $1,000 the week before");
    expect(moneyChange(0, 200, "AUD", "week")).toEqual({ tone: "down", text: "Down 100% from $200 the week before" });
  });

  it("says how the AI score changed, in points", () => {
    expect(pointsChange(42, 36, "this week")).toEqual({ tone: "up", text: "Up 6 points this week" });
    expect(pointsChange(42, 41, "this week")).toEqual({ tone: "up", text: "Up 1 point this week" });
    expect(pointsChange(20, 23, "since we started")).toEqual({ tone: "down", text: "Down 3 points since we started" });
    expect(pointsChange(42, 42, "this month")).toEqual({ tone: "same", text: "No change this month" });
    expect(pointsChange(42, null, "this week")).toBeNull();
    expect(pointsChange(null, 10, "this week")).toBeNull();
  });

  it("says AI's share of sales without showing a zero", () => {
    expect(shareText(0.04)).toBe("4%");
    expect(shareText(0.004)).toBe("less than 1%");
    expect(shareText(0)).toBeNull();
    expect(shareText(null)).toBeNull();
  });

  it("finds a first name", () => {
    expect(firstName("Sarah Jones")).toBe("Sarah");
    expect(firstName("  Sam ")).toBe("Sam");
    expect(firstName("")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});

const entry = (id: string, kind: LogEntry["kind"], at: string, over: Partial<LogEntry> = {}): LogEntry => ({ id, shopId: "s", kind, at, text: id, ...over });

describe("the work a client sees", () => {
  const log: LogEntry[] = [
    entry("n1", "note", "2026-11-03T02:00:00Z", { text: "Private: they are slow to pay", noteId: "n1" }),
    entry("st", "client", "2026-11-03T02:00:00Z", { text: "Paused the work" }),
    entry("cf", "check-failed", "2026-11-03T02:00:00Z", { text: "The AI check couldn’t read any answers: Treg 500" }),
    entry("sale", "sale", "2026-11-03T02:00:00Z", { text: "$80 order #1001 from ChatGPT" }),
    entry("rep", "report", "2026-11-03T02:00:00Z", { text: "Made the weekly report" }),
    entry("rf", "reddit-found", "2026-11-03T02:00:00Z", { text: "Found 6 Reddit threads to reply to" }),
    entry("gw2", "guide-written", "2026-11-04T02:00:00Z", { text: "Guide written: Beard oil or balm?", href: "/dash/clients/s/guides/x" }),
    entry("gw1", "guide-written", "2026-11-01T02:00:00Z", { text: "Guide written: Best beard oil for dry skin" }),
    entry("gl1", "guide-live", "2026-11-02T02:00:00Z", { text: "Guide live on their store: Best beard oil", href: "https://beardco.com.au/pages/best-beard-oil" }),
    entry("gl2", "guide-live", "2026-11-03T02:00:00Z", { text: "Guide live on their store: Balm guide", href: "/dash/clients/s/guides/y" }),
    entry("c1", "check", "2026-11-01T02:00:00Z"),
    entry("c2", "check", "2026-11-02T02:00:00Z"),
    entry("ch", "change", "2026-11-02T17:30:00Z", { text: "Rewrote 4 product pages", noteId: "ch" }), // 1:30am on the 3rd in Perth
    entry("call", "call", "2026-11-04T04:00:00Z", { text: "Monthly call: plans for December", noteId: "call" }),
    entry("rr", "reddit-replied", "2026-11-04T05:00:00Z", { text: "Replied on Reddit: Best beard oil?", href: "https://www.reddit.com/r/beards/comments/abc" }),
  ];
  const w = workFromLog(log, ["Stuga.com.au", "stuga.com.au", "beardguru.com.au"]);

  it("keeps only the kinds a client may see", () => {
    const shown = JSON.stringify(w);
    for (const hidden of ["Private", "Paused", "Treg", "#1001", "Made the weekly report", "Found 6 Reddit"]) expect(shown).not.toContain(hidden);
    expect(CLIENT_SEES.has("note")).toBe(false);
  });

  it("lists the work oldest first, without the log's own wording", () => {
    expect(w.guidesWritten).toEqual(["Best beard oil for dry skin", "Beard oil or balm?"]);
    expect(w.reddit).toEqual([{ title: "Best beard oil?", url: "https://www.reddit.com/r/beards/comments/abc" }]);
    expect(w.checks).toBe(2);
  });

  it("only keeps links to the web, never the hub's own pages", () => {
    expect(w.guidesLive).toEqual([
      { title: "Best beard oil", url: "https://beardco.com.au/pages/best-beard-oil" },
      { title: "Balm guide", url: null },
    ]);
  });

  it("dates Ross's changes and calls by Perth day", () => {
    expect(w.changes).toEqual([{ day: "2026-11-03", text: "Rewrote 4 product pages" }]);
    expect(w.calls).toEqual([{ day: "2026-11-04", text: "Monthly call: plans for December" }]);
  });

  it("names each site whose writer was found once", () => {
    expect(w.writers).toEqual(["stuga.com.au", "beardguru.com.au"]);
  });

  it("knows when nothing was done", () => {
    const none = workFromLog([entry("n", "note", "2026-11-03T02:00:00Z")]);
    expect(hasWork(none)).toBe(false);
    expect(hasWork(w)).toBe(true);
  });
});

describe("the AI score", () => {
  const scores = [
    { score: 20, date: "2026-09-20T02:00:00Z" },
    { score: 24, date: "2026-10-01T02:00:00Z" },
    { score: 36, date: "2026-10-29T15:00:00Z" }, // 11pm on 29 Oct in Perth: before the week
    { score: 39.6, date: "2026-10-29T17:00:00Z" }, // 1am on 30 Oct in Perth: inside the week
    { score: 42, date: "2026-11-05T01:00:00Z" },
  ];

  it("starts the period from the last score before it (Perth days)", () => {
    expect(periodStartScore(scores, "2026-10-30")).toBe(36);
  });

  it("with no score before the period, uses the first inside it, but only if a later one follows", () => {
    const inside = scores.slice(3);
    expect(periodStartScore(inside, "2026-10-30")).toBe(40);
    expect(periodStartScore(inside.slice(-1), "2026-10-30")).toBeNull();
    expect(periodStartScore([], "2026-10-30")).toBeNull();
  });

  it("finds the score when the work started, when there's something to compare", () => {
    expect(workStartScore(scores, "2026-10-01")).toBe(24);
    expect(workStartScore(scores.slice(-1), "2026-10-01")).toBeNull();
  });

  it("lists the score per AI assistant in the app's order", () => {
    expect(engineScores({ gemini: 12.4, chatgpt: 40, aio: 130, perplexity: "x", claude: -5 })).toEqual([
      { name: "ChatGPT", score: 40 },
      { name: "Gemini", score: 12 },
      { name: "Google AI Overviews", score: 100 },
      { name: "Claude", score: 0 },
    ]);
    expect(engineScores(null)).toEqual([]);
    expect(engineScores([1, 2])).toEqual([]);
  });
});

describe("sales per AI assistant", () => {
  it("joins orders and visits, names them, biggest first", () => {
    const rows = assistantRows(
      [
        { engine: "perplexity", revenue: 80, orders: 1 },
        { engine: "chatgpt", revenue: 900, orders: 5 },
      ],
      [
        { engine: "chatgpt", visits: 60 },
        { engine: "gemini", visits: 9 },
        { engine: "mystery", visits: 2 },
        { engine: "copilot", visits: 0 },
      ],
    );
    expect(rows).toEqual([
      { name: "ChatGPT", revenue: 900, orders: 5, visits: 60 },
      { name: "Perplexity", revenue: 80, orders: 1, visits: 0 },
      { name: "Gemini", revenue: 0, orders: 0, visits: 9 },
      { name: "Other AI", revenue: 0, orders: 0, visits: 2 },
    ]);
  });
});

describe("the buying questions", () => {
  const q = (text: string, volume: number | null, rate: number | null, active = true) => ({ text, volume, rate, active });

  it("counts the questions, how many the check asked and how many named the store", () => {
    const s = questionSummary([q("a", 10, 0.5), q("b", null, 0), q("c", 900, null), q("d", 50, 0.25), q("off", 5000, 1, false)], true);
    expect(s.tracked).toBe(4);
    expect(s.checked).toBe(3);
    expect(s.named).toBe(2);
    // The most searched of the questions the check asked; one with no search count goes last.
    expect(s.top).toEqual([
      { text: "d", searches: 50, named: true },
      { text: "a", searches: 10, named: true },
      { text: "b", searches: null, named: false },
    ]);
  });

  it("keeps the top 5 only", () => {
    const rows = Array.from({ length: 8 }, (_, i) => q(`q${i}`, i * 10, 0));
    expect(questionSummary(rows, true).top.map((t) => t.text)).toEqual(["q7", "q6", "q5", "q4", "q3"]);
  });

  it("before any check, names nothing yet", () => {
    const s = questionSummary([q("a", 10, null), q("b", 30, null)], false);
    expect(s.named).toBeNull();
    expect(s.top).toEqual([
      { text: "b", searches: 30, named: null },
      { text: "a", searches: 10, named: null },
    ]);
  });
});

describe("Ross's note", () => {
  it("keeps line breaks and drops tags", () => {
    expect(readReportNote("  Great week!\r\n\r\n\r\n\r\nTwo <b>guides</b> went live.  ")).toEqual({ ok: true, note: "Great week!\n\nTwo bguides/b went live." });
  });
  it("is empty when nothing was typed", () => {
    expect(readReportNote("   ")).toEqual({ ok: true, note: null });
    expect(readReportNote(undefined)).toEqual({ ok: true, note: null });
  });
  it("asks for a shorter note over 1,000 characters", () => {
    expect(readReportNote("x".repeat(1001)).ok).toBe(false);
    expect(readReportNote("x".repeat(1000)).ok).toBe(true);
  });
});

describe("saved reports", () => {
  it("reads a saved report back as it was", () => {
    const d = sample();
    expect(readReportData(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });

  it("refuses data it can't show", () => {
    expect(readReportData(null)).toBeNull();
    expect(readReportData({ ...sample(), v: 2 })).toBeNull();
    expect(readReportData({ ...sample(), kind: "year" })).toBeNull();
    expect(readReportData([sample()])).toBeNull();
  });

  it("reads missing lists as empty", () => {
    const d = readReportData({ v: 1, kind: "week", brand: "B", fromDay: "2026-10-30", toDay: "2026-11-05" });
    expect(d?.work.guidesWritten).toEqual([]);
    expect(d?.rivals).toEqual([]);
    expect(d?.score.now).toBeNull();
    expect(d?.sales).toEqual({ revenue: 0, orders: 0, visits: 0 });
  });

  it("only takes tokens shaped like ours", () => {
    expect(isReportToken(randomBytes(18).toString("base64url"))).toBe(true);
    expect(isReportToken("short")).toBe(false);
    expect(isReportToken("../../etc/passwd/aaaaaaaaaaaaaaaa")).toBe(false);
    expect(isReportToken(undefined)).toBe(false);
  });
});

describe("the report email", () => {
  const url = "https://firstpicked.com.au/results/abcDEF123_-abcDEF123_-xy";

  it("says hello by first name, names the days and has one button", () => {
    const mail = reportEmail(sample(), url, "Sarah Jones");
    expect(mail.subject).toBe("Your weekly report: Beard & Co");
    expect(mail.html).toContain("Hi Sarah,");
    expect(mail.html).toContain("30 Oct to 5 Nov");
    expect(mail.html).toContain("Open your report");
    expect(mail.html).toContain("Questions? Just reply to this email.");
    expect(mail.html.split(`href="${url}"`)).toHaveLength(3); // the button and the copy-this-link line
    expect(mail.text).toContain(`Open your report: ${url}`);
    expect(mail.text.startsWith("Hi Sarah,")).toBe(true);
  });

  it("shows sales from AI with orders, and the AI score with its change", () => {
    const mail = reportEmail(sample(), url, null);
    expect(mail.html).toContain("Hi there,");
    expect(mail.text).toContain("Sales from AI: $1,240 (7 orders)");
    expect(mail.text).toContain("Your AI score: 42 out of 100 (Up 6 points this week)");
    expect(mail.text).toContain("Guides written: 1 (this week)");
  });

  it("says one order, not one orders", () => {
    const mail = reportEmail(sample({ sales: { revenue: 80, orders: 1, visits: 3 } }), url, null);
    expect(mail.text).toContain("Sales from AI: $80 (1 order)");
  });

  it("says plainly when sales can't be counted yet, instead of showing zeros", () => {
    const d = sample({ tracking: false, sales: { revenue: 0, orders: 0, visits: 0 }, store: null, share: null });
    const lines = headlines(d);
    expect(lines[0]).toEqual({ label: "Sales from AI", value: "Not counted yet", sub: "The tracking code isn’t on your store yet" });
    expect(reportEmail(d, url, null).text).not.toContain("$0");
  });

  it("leaves out the score before the first check", () => {
    const d = sample({ score: { now: null, periodStart: null, workStart: null, byAssistant: [] } });
    expect(headlines(d).map((h) => h.label)).not.toContain("Your AI score");
  });

  it("calls a monthly report monthly", () => {
    const mail = reportEmail(sample({ kind: "month", fromDay: "2026-10-06" }), url, null);
    expect(mail.subject).toBe("Your monthly report: Beard & Co");
    expect(mail.text).toContain("Here is your monthly report for Beard & Co, 6 Oct to 5 Nov.");
  });

  it("escapes everything that came from the store or a person", () => {
    const mail = reportEmail(sample({ brand: `<script>alert("x")</script> & Sons` }), url, `<img src=x onerror=alert(1)>`);
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Sons");
  });

  it("has no em or en dashes", () => {
    for (const d of [sample(), sample({ tracking: false, store: null, share: null }), sample({ kind: "month" })]) {
      const mail = reportEmail(d, url, "Sarah");
      for (const s of [mail.subject, mail.html, mail.text]) expect(s).not.toMatch(/[—–]/);
    }
  });
});

describe("the report's files", () => {
  const files = [
    "app/lib/client-report.ts",
    "app/lib/client-report.server.ts",
    "app/routes/results.$token.tsx",
    "app/routes/dash.clients.$id.reports.tsx",
    "app/styles/client-report.css",
  ];
  it("never use em or en dashes, in copy or comments", () => {
    for (const f of files) expect(readFileSync(f, "utf8"), f).not.toMatch(/[—–]/);
  });
  it("never offer a price, a booking or an upsell on the client's page", () => {
    const page = readFileSync("app/routes/results.$token.tsx", "utf8");
    expect(page).not.toMatch(/\/book\b|A\$\d|OFFER|Get started|upgrade/i);
    expect(page).toContain("noindex");
  });
});
