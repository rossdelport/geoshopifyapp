// The work log's rules (app/lib/work-log.ts) and the hub's addresses (app/lib/hub-paths.ts).

import { describe, expect, it } from "vitest";
import { type LogEntry, bunchByDay, byClient, byDay, checkText, countKinds, isExternal, logSummary, redditFoundText, writersText } from "../app/lib/work-log";
import { clientIdFromPath, frameKey, isHubPath, storeBase } from "../app/lib/hub-paths";
import { skeletonFor } from "../app/components/web";
import { signInPage } from "../app/lib/web-auth.server";

const entry = (id: string, at: string, over: Partial<LogEntry> = {}): LogEntry => ({ id, shopId: "a", at, kind: "check", text: id, ...over });

describe("the work log", () => {
  it("groups entries by Perth day, newest first", () => {
    const days = byDay([
      entry("late-4th-utc", "2026-11-04T17:00:00Z"), // 1am on the 5th in Perth
      entry("morning-4th", "2026-11-04T01:00:00Z"),
      entry("evening-4th", "2026-11-04T11:00:00Z"),
      entry("3rd", "2026-11-03T03:00:00Z"),
    ]);
    expect(days.map((d) => [d.day, d.entries.map((e) => e.id)])).toEqual([
      ["2026-11-05", ["late-4th-utc"]],
      ["2026-11-04", ["evening-4th", "morning-4th"]],
      ["2026-11-03", ["3rd"]],
    ]);
  });

  it("groups entries by client in the order given, leaving out clients with nothing", () => {
    const groups = byClient(
      [entry("1", "2026-11-04T01:00:00Z", { shopId: "b" }), entry("2", "2026-11-04T02:00:00Z", { shopId: "a" }), entry("3", "2026-11-04T03:00:00Z", { shopId: "b" })],
      [{ shopId: "a" }, { shopId: "b" }, { shopId: "c" }],
    );
    expect(groups.map((g) => [g.client.shopId, g.entries.map((e) => e.id)])).toEqual([
      ["a", ["2"]],
      ["b", ["3", "1"]],
    ]);
  });

  it("counts each kind, and everything a bunched entry holds", () => {
    expect(countKinds([entry("1", "x"), entry("2", "x"), entry("3", "x", { kind: "sale" })])).toEqual({ check: 2, sale: 1 });
    expect(countKinds([entry("1", "x", { kind: "reddit-found", count: 6 }), entry("2", "x", { kind: "reddit-found", count: 12 })])).toEqual({ "reddit-found": 18 });
  });

  it("sums it up in a line: only what happened, in the usual order", () => {
    expect(logSummary({ check: 30, call: 2, "guide-written": 12, "guide-live": 4, note: 0 })).toEqual(["12 guides written", "4 guides live", "30 AI checks", "2 calls"]);
    expect(logSummary({ call: 1, "reddit-replied": 1, "reddit-found": 18, writer: 1 })).toEqual(["18 Reddit threads found", "1 Reddit reply", "1 writer found", "1 call"]);
    expect(logSummary({ check: 1200 })).toEqual(["1,200 AI checks"]);
    // the hub's own status entries aren't work
    expect(logSummary({ client: 3 })).toEqual([]);
    expect(logSummary({})).toEqual([]);
  });

  it("describes an AI check in plain words", () => {
    expect(checkText({ total: 400, engines: ["chatgpt", "gemini", "perplexity", "google_aio"], runs: 1, score: 41.6 })).toBe(
      "Checked 100 buying questions on 4 AI assistants. Score 42.",
    );
    expect(checkText({ total: 2, engines: ["chatgpt"], runs: 2, score: null })).toBe("Checked 1 buying question on 1 AI assistant.");
    expect(checkText({ total: 0, engines: null, runs: 1, score: 10 })).toBe("Checked what AI says. Score 10.");
  });

  it("bunches Reddit threads and writers into one entry per client per day", () => {
    const groups = bunchByDay([
      { shopId: "a", at: "2026-11-04T01:00:00Z" },
      { shopId: "a", at: "2026-11-04T09:00:00Z" },
      { shopId: "a", at: "2026-11-04T17:00:00Z" }, // the 5th in Perth
      { shopId: "b", at: "2026-11-04T02:00:00Z" },
    ]);
    expect(groups.map((g) => [g.shopId, g.day, g.rows.length, g.at])).toEqual([
      ["a", "2026-11-04", 2, "2026-11-04T09:00:00.000Z"],
      ["a", "2026-11-05", 1, "2026-11-04T17:00:00.000Z"],
      ["b", "2026-11-04", 1, "2026-11-04T02:00:00.000Z"],
    ]);
    expect(redditFoundText(1)).toBe("Found 1 Reddit thread to reply to, each with a reply drafted");
    expect(redditFoundText(6)).toBe("Found 6 Reddit threads to reply to, each with a reply drafted");
    expect(writersText(["stuga.com.au"])).toBe("Found the writer at stuga.com.au");
    expect(writersText(["a.com", "b.com", "c.com", "d.com"])).toBe("Found 4 writers at sites AI trusts: a.com, b.com, c.com…");
  });

  it("tells links to other websites from pages in the app", () => {
    expect(isExternal("https://reddit.com/r/x")).toBe(true);
    expect(isExternal("/dash/clients/a/guides")).toBe(false);
  });
});

describe("the hub's addresses", () => {
  it("finds the client in an address, and its data requests", () => {
    expect(clientIdFromPath("/dash/clients/cm123abc")).toBe("cm123abc");
    expect(clientIdFromPath("/dash/clients/cm123abc/guides/xyz")).toBe("cm123abc");
    expect(clientIdFromPath("/dash/clients/cm123abc.data")).toBe("cm123abc");
    expect(clientIdFromPath("/dash/clients/new")).toBeNull();
    expect(clientIdFromPath("/dash/clients")).toBeNull();
    expect(clientIdFromPath("/dash/guides")).toBeNull();
    expect(clientIdFromPath("/dash/clientsx/abc")).toBeNull();
  });

  it("starts every store page's links from the right place", () => {
    expect(storeBase("/dash/guides")).toBe("/dash");
    expect(storeBase("/dash/clients/abc/reddit")).toBe("/dash/clients/abc");
  });

  it("knows the hub's own pages, which need no store", () => {
    for (const p of ["/dash", "/dash/", "/dash.data", "/dash/log", "/dash/clients", "/dash/clients/new", "/dash/admin", "/dash/admin/users", "/dash/admin/calendar"]) {
      expect(isHubPath(p), p).toBe(true);
    }
    for (const p of ["/dash/guides", "/dash/ask", "/dash/clients/abc", "/dash/clients/abc/log", "/dash/logs", "/dashboard"]) {
      expect(isHubPath(p), p).toBe(false);
    }
    expect(frameKey("/dash/clients/abc/stats")).toBe("abc");
    expect(frameKey("/dash/log")).toBe("hub");
    expect(frameKey("/dash/guides")).toBe("store");
  });

  it("sends signed-out visits to the hub's own pages to the admin password page", () => {
    expect(signInPage("/dash/clients/abc/log")).toBe("/admin?next=%2Fdash%2Fclients%2Fabc%2Flog");
    expect(signInPage("/dash/log")).toBe("/admin?next=%2Fdash%2Flog");
    expect(signInPage("/dash/admin")).toBe("/admin?next=%2Fdash%2Fadmin");
    expect(signInPage("/dash")).toBe("/login?next=%2Fdash");
    expect(signInPage("/dash/guides")).toBe("/login?next=%2Fdash%2Fguides");
    expect(signInPage("/dash/logs")).toBe("/login?next=%2Fdash%2Flogs");
  });

  it("shows a store page's skeleton for a client's copy of it too", () => {
    expect(skeletonFor("/dash/guides")).toBe("guides");
    expect(skeletonFor("/dash/clients/abc/guides")).toBe("guides");
    expect(skeletonFor("/dash/clients/abc")).toBe("home");
    expect(skeletonFor("/dash/clients/abc/log")).toBe("log");
    expect(skeletonFor("/dash/log", true)).toBe("log");
    expect(skeletonFor("/dash", true)).toBe("hub");
    expect(skeletonFor("/dash")).toBe("home");
    expect(skeletonFor("/dash/clients/new", true)).toBe("form");
  });
});
