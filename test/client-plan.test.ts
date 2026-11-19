// Each client's plan in the agency hub (Ross, 17 Nov 2026): the checklist (first 24 hours, then the crucial next steps)
// and what runs for them today, next and later, with why. The pure rules in lib/client-plan.ts.

import { describe, expect, it } from "vitest";
import {
  type AutoFacts,
  type FlowFacts,
  LOCAL_CHECKLIST,
  STORE_CHECKLIST,
  checklistCount,
  checklistFor,
  checklistLine,
  checklistView,
  crawlersOk,
  dueDay,
  guideWhy,
  isTickable,
  planFlow,
} from "../app/lib/client-plan";

const NONE: AutoFacts = {
  setup: false,
  "first-check": false,
  contact: false,
  tracking: false,
  crawlers: false,
  "guide-live": false,
  "report-sent": false,
  reddit: false,
  "month-report": false,
  "site-fix": false,
  listings: false,
};
const BASE = "/dash/clients/abc";

describe("the checklists", () => {
  for (const [name, list] of [
    ["local businesses", LOCAL_CHECKLIST],
    ["online stores", STORE_CHECKLIST],
  ] as const) {
    it(`for ${name}: unique keys, plain words, a why on every line, links inside the client's pages`, () => {
      const keys = list.map((i) => i.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const i of list) {
        expect(i.text.length).toBeGreaterThan(10);
        expect(i.why.length).toBeGreaterThan(10);
        expect(`${i.text} ${i.why}`).not.toMatch(/—|–|\bGEO\b|\bAEO\b|\bLLM\b/); // no dashes, no jargon (CLAUDE.md)
        if (i.link) expect(i.link).toMatch(/^\/[a-z]+$/);
      }
      // The first 24 hours come first, and there's something crucial after them.
      expect(list.filter((i) => i.due === "day1").length).toBeGreaterThanOrEqual(8);
      expect(list.filter((i) => i.due !== "day1").length).toBeGreaterThanOrEqual(8);
    });
  }

  it("covers the bare minimum for a local business: Google profile, their website, the lists AI quotes, same details everywhere", () => {
    const keys = LOCAL_CHECKLIST.map((i) => i.key);
    for (const k of ["gbp-access", "gbp-fix", "guide-live", "lists", "same-details", "reviews"]) expect(keys).toContain(k);
    // A local business has no tracking code yet (lib/business.ts). Since 19 Nov 2026 it has Reddit, website fixes and
    // listing sites, and the lists line ticks itself once they're on 5.
    expect(keys).not.toContain("tracking");
    for (const k of ["reddit", "site-fix", "schema"]) expect(keys).toContain(k);
    expect(LOCAL_CHECKLIST.find((i) => i.key === "lists")).toMatchObject({ auto: "listings", link: "/listings" });
    expect(LOCAL_CHECKLIST.find((i) => i.key === "site-fix")).toMatchObject({ auto: "site-fix", link: "/website" });
  });

  it("has the tracking code and Shopify access for an online store, and no Google Business Profile", () => {
    const keys = STORE_CHECKLIST.map((i) => i.key);
    expect(keys).toContain("tracking");
    expect(keys).toContain("shopify-access");
    expect(keys).not.toContain("gbp-access");
  });

  it("never asks for fake reviews or rewards", () => {
    for (const i of [...LOCAL_CHECKLIST, ...STORE_CHECKLIST]) expect(`${i.text} ${i.why}`).not.toMatch(/\b(discount|gift|prize) for (a )?review/i);
    expect(LOCAL_CHECKLIST.find((i) => i.key === "reviews")?.text).toMatch(/every customer/);
    expect(STORE_CHECKLIST.find((i) => i.key === "reviews")?.why).toMatch(/Never pay or reward/);
  });

  it("only lets Ross tick the lines that don't tick themselves", () => {
    expect(isTickable("start-call", true)).toBe(true);
    expect(isTickable("gbp-access", true)).toBe(true);
    expect(isTickable("gbp-access", false)).toBe(false); // not on a store's list
    expect(isTickable("setup", true)).toBe(false); // ticks itself
    expect(isTickable("guide-live", false)).toBe(false);
    expect(isTickable("nope", true)).toBe(false);
    expect(isTickable(undefined, true)).toBe(false);
  });

  it("counts due days from the start day", () => {
    expect(dueDay("day1", "2026-11-17")).toBe("2026-11-18");
    expect(dueDay("week1", "2026-11-17")).toBe("2026-11-23");
    expect(dueDay("week2", "2026-11-17")).toBe("2026-11-30");
    expect(dueDay("week3", "2026-11-17")).toBe("2026-12-07");
    expect(dueDay("month1", "2026-11-17")).toBe("2026-12-16");
    expect(dueDay("month2", "2026-11-17")).toBe("2027-01-16");
  });
});

describe("the checklist as the pop-up shows it", () => {
  it("ticks Ross's lines from his ticks and the rest from the work, in the order they're due", () => {
    const view = checklistView(LOCAL_CHECKLIST, [{ key: "start-call", doneAt: "2026-11-17T02:00:00Z" }], { ...NONE, setup: true }, "2026-11-17", "2026-11-17", BASE);
    expect(view.groups.map((g) => g.title)).toEqual(["First 24 hours", "Next, the crucial ones"]);
    const [first, next] = view.groups;
    const line = (key: string) => [...first.lines, ...next.lines].find((l) => l.key === key)!;
    expect(line("setup")).toMatchObject({ done: true, auto: true, doneOn: null });
    expect(line("start-call")).toMatchObject({ done: true, auto: false, doneOn: "2026-11-17" });
    expect(line("gbp-access")).toMatchObject({ done: false, late: false, href: null });
    expect(line("questions").href).toBe(`${BASE}/questions`);
    expect(first.done).toBe(2);
    expect(view).toMatchObject({ done: 2, total: LOCAL_CHECKLIST.length });
    const order = ["week1", "week2", "week3", "month1", "month2"];
    const dues = next.lines.map((l) => order.indexOf(l.due));
    expect(dues).toEqual([...dues].sort((a, b) => a - b));
  });

  it("a tick saved for a line that ticks itself doesn't count", () => {
    const view = checklistView(STORE_CHECKLIST, [{ key: "tracking", doneAt: "2026-11-17T02:00:00Z" }], NONE, "2026-11-17", "2026-11-17", BASE);
    expect(view.done).toBe(0);
  });

  it("marks lines late once their day has passed", () => {
    const view = checklistView(LOCAL_CHECKLIST, [], NONE, "2026-11-01", "2026-11-10", BASE);
    const lines = view.groups.flatMap((g) => g.lines);
    expect(lines.find((l) => l.key === "gbp-access")?.late).toBe(true); // due 2 Nov
    expect(lines.find((l) => l.key === "gbp-fix")?.late).toBe(true); // due 7 Nov
    expect(lines.find((l) => l.key === "same-details")?.late).toBe(false); // due 14 Nov
  });

  it("gives the card the first 24 hours until they're done, then the whole list", () => {
    const some = checklistCount(true, ["start-call"], { ...NONE, setup: true });
    expect(some).toMatchObject({ done: 2, firstDone: 2, firstTotal: 10, total: LOCAL_CHECKLIST.length });
    expect(checklistLine(some)).toEqual({ label: "First 24 hours", done: 2, total: 10 });
    const firstDay = checklistFor(true).filter((i) => i.due === "day1" && !i.auto).map((i) => i.key);
    const all = checklistCount(true, firstDay, { ...NONE, setup: true, "first-check": true, contact: true });
    expect(checklistLine(all)).toEqual({ label: "Checklist", done: 10, total: LOCAL_CHECKLIST.length });
  });

  it("reads the crawler check: nothing serious blocked, or no robots.txt at all", () => {
    expect(crawlersOk({ status: "ok" })).toBe(true);
    expect(crawlersOk({ status: "no-file" })).toBe(true);
    expect(crawlersOk({ status: "blocked" })).toBe(false);
    expect(crawlersOk(null)).toBe(false);
  });
});

// 17 Nov 2026, 10am Perth (02:00 UTC).
const NOW = "2026-11-17T02:00:00.000Z";
const facts = (over: Partial<FlowFacts> = {}): FlowFacts => ({
  now: NOW,
  base: BASE,
  status: "active",
  running: true,
  local: false,
  onboarding: "done",
  setupFailed: false,
  startedOn: "2026-11-10",
  storeToday: "2026-11-17",
  connected: false,
  scan: null,
  checksToday: [],
  nextCheckAt: null,
  nextFull: false,
  nextFullAt: null,
  costCapHit: false,
  redditNextAt: null,
  siteFix: null,
  siteCheckNextAt: null,
  listing: null,
  guides: [],
  lastReportAt: "2026-11-16T03:00:00.000Z",
  ...over,
});
const keys = (items: { key: string }[]) => items.map((i) => i.key);

describe("what runs for a client", () => {
  it("shows setup while it runs, with the first AI check's progress", () => {
    const flow = planFlow(facts({ onboarding: "scanning", scan: { kind: "baseline", done: 30, total: 120 }, lastReportAt: null, startedOn: "2026-11-17" }));
    const setup = flow.today.filter((i) => i.key.startsWith("setup-"));
    expect(setup.map((i) => i.state).sort()).toEqual(["done", "done", "now"]);
    expect(setup.find((i) => i.state === "now")?.when).toBe("Running now · 30 of 120 answers read");
    for (const i of flow.today) expect(i.why.length).toBeGreaterThan(10);
  });

  it("asks Ross to try again when setup stopped", () => {
    const flow = planFlow(facts({ onboarding: "questions", setupFailed: true }));
    expect(flow.today.find((i) => i.key === "setup-1")).toMatchObject({ state: "you", who: "you", href: BASE });
  });

  it("says nothing runs while the work is paused", () => {
    const flow = planFlow(facts({ status: "paused", running: false, nextCheckAt: NOW }));
    expect(flow.note).toMatch(/paused/);
    expect([...flow.today, ...flow.next, ...flow.later]).toEqual([]);
  });

  it("lists today's AI checks, the one running now, and the next full one", () => {
    const flow = planFlow(
      facts({
        checksToday: [{ kind: "daily", at: "2026-11-17T01:10:00.000Z", score: 41.6 }],
        scan: { kind: "manual", done: 5, total: 50 },
        nextCheckAt: "2026-11-18T01:00:00.000Z",
        nextFullAt: "2026-11-20T01:00:00.000Z",
      }),
    );
    expect(flow.today[0]).toMatchObject({ key: "check-now", state: "now", title: "Extra AI check" });
    expect(flow.today.find((i) => i.key.startsWith("check-2026"))).toMatchObject({ state: "done", when: "Done 9:10 am · score 42" });
    expect(flow.next.find((i) => i.key === "check-full")).toMatchObject({ title: "Full weekly AI check", when: "Fri 20 Nov about 9:00 am" });
  });

  it("puts the next daily check today or tomorrow, and says when the cost cap stops checks", () => {
    expect(planFlow(facts({ nextCheckAt: "2026-11-17T07:00:00.000Z" })).today.find((i) => i.key === "check-next")).toMatchObject({ state: "today", when: "About 3:00 pm" });
    expect(planFlow(facts({ nextCheckAt: "2026-11-18T07:00:00.000Z" })).next.find((i) => i.key === "check-next")?.when).toBe("Tomorrow about 3:00 pm, then every day");
    const capped = planFlow(facts({ nextCheckAt: NOW, costCapHit: true }));
    expect(capped.today.find((i) => i.key === "check-cap")).toMatchObject({ state: "you" });
    expect(capped.today.find((i) => i.key === "check-next")).toBeUndefined();
  });

  it("follows the guide calendar: written two days ahead, OK'd, then live or added by hand", () => {
    const g = (over: Partial<FlowFacts["guides"][number]>) => ({
      id: "g",
      day: "2026-11-19",
      status: "planned",
      approvedAt: null,
      writtenAt: null,
      publishedAt: null,
      title: "Best plunge pool in Perth",
      volume: 320,
      rate: 0,
      ...over,
    });
    const flow = planFlow(
      facts({
        guides: [
          g({ id: "a" }), // written today, live Thu
          g({ id: "b", day: "2026-11-17", status: "ready", approvedAt: NOW, writtenAt: "2026-11-15T01:00:00.000Z" }), // its day, no Shopify link
          g({ id: "c", day: "2026-11-22", status: "ready", writtenAt: "2026-11-17T01:30:00.000Z" }), // written today, waits for an OK
          g({ id: "d", day: "2026-11-24" }), // written Sun 22 Nov
          g({ id: "e", day: "2026-12-04" }), // later
        ],
      }),
    );
    expect(flow.today.find((i) => i.key === "gp-a")).toMatchObject({ state: "today", when: "Today · live Thu 19 Nov", detail: "Best plunge pool in Perth" });
    expect(flow.today.find((i) => i.key === "ga-b")).toMatchObject({ state: "you", title: "Add the guide to their store" });
    expect(flow.today.find((i) => i.key === "gok-c")).toMatchObject({ state: "you" });
    expect(flow.today.find((i) => i.key === "gw-c")).toMatchObject({ state: "done" });
    expect(flow.next.find((i) => i.key === "gp-d")?.when).toBe("Sun 22 Nov · live Tue 24 Nov");
    expect(keys(flow.later)).toContain("gp-e");
    expect(flow.today.find((i) => i.key === "gp-a")?.why).toBe("AI doesn’t name them for this yet. About 320 Google searches a month. A clear page that answers it gives AI a reason to name them.");
    // With their Shopify connected, the guide goes live by itself.
    const live = planFlow(facts({ connected: true, guides: [g({ id: "b", day: "2026-11-17", status: "ready", approvedAt: NOW })] }));
    expect(live.today.find((i) => i.key === "gr-b")).toMatchObject({ state: "today", who: "auto" });
  });

  it("looks for Reddit threads for stores and local businesses", () => {
    expect(keys(planFlow(facts({ redditNextAt: "2026-11-20T02:00:00.000Z" })).next)).toContain("reddit");
    expect(keys(planFlow(facts({ local: true, redditNextAt: NOW })).today)).toContain("reddit");
  });

  it("gives a local business today's website fix and listing site, and the weekly read of its website", () => {
    const flow = planFlow(
      facts({ local: true, siteFix: { what: "Page title", page: "https://x.com.au/" }, listing: { name: "Bing Places" }, siteCheckNextAt: "2026-11-20T02:00:00.000Z" }),
    );
    expect(flow.today.find((i) => i.key === "site-fix")).toMatchObject({ title: "Website fix: page title", state: "you", href: `${BASE}/website` });
    expect(flow.today.find((i) => i.key === "listing")).toMatchObject({ title: "Listing site: Bing Places", state: "you", href: `${BASE}/listings` });
    expect(keys(flow.next)).toContain("site-check");
    // An online store has none of these.
    expect(keys(planFlow(facts({ siteFix: { what: "Page title", page: "https://x.com/" }, listing: { name: "Yelp" } })).today)).not.toContain("site-fix");
  });

  it("keeps the reports in view: the weekly one, the end of month 1 and the 3 month report", () => {
    const due = planFlow(facts({ lastReportAt: "2026-11-09T02:00:00.000Z" }));
    expect(due.today.find((i) => i.key === "report")).toMatchObject({ state: "you", when: "Due since Sun 15 Nov" }); // 7 days after the last one, less 12 hours: 10pm Perth on Sunday
    const fresh = planFlow(facts());
    expect(fresh.next.find((i) => i.key === "report")?.when).toBe("Sun 22 Nov"); // like the hub's alert: due 7 days less 12 hours after the last one
    expect(fresh.later.find((i) => i.key === "month-one")).toMatchObject({ when: "Wed 9 Dec" });
    expect(fresh.later.find((i) => i.key === "month-one")?.why).toMatch(/refund until Wed 23 Dec/);
    expect(keys(fresh.later)).toContain("month-three");
    // Today's list: what runs now, then what needs Ross, then the rest, then what's done.
    const order = ["now", "you", "today", "planned", "done"];
    const ranks = due.today.map((i) => order.indexOf(i.state));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("says why a guide is written from the real numbers only", () => {
    expect(guideWhy({ rate: 0.25, volume: null })).toBe("AI names them in 25% of answers. A clear page that answers it gives AI a reason to name them.");
    expect(guideWhy({ rate: null, volume: 1300 })).toBe("About 1,300 Google searches a month. A clear page that answers it gives AI a reason to name them.");
  });
});
