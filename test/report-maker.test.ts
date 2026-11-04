// The phone report maker (app/routes/report-maker.$key.tsx, lib/report-maker.server.ts): a private link instead of a
// sign-in. A wrong key is a 404 and starts nothing; the right one lists reports and starts them like Admin > Reports.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";

vi.mock("../app/lib/store-report.server", () => ({ createReports: vi.fn(), deleteReport: vi.fn(), listReports: vi.fn() }));

const srv = await import("../app/lib/store-report.server");
const maker = await import("../app/lib/report-maker.server");
const route = await import("../app/routes/report-maker.$key");

const KEY = maker.makerKey();
const url = (key: string) => `https://usegeo.app/report-maker/${key}`;
const load = (key: string) => route.loader({ request: new Request(url(key)), params: { key }, context: {} } as unknown as LoaderFunctionArgs);
const act = (key: string, body: Record<string, string>) =>
  route.action({ request: new Request(url(key), { method: "POST", body: new URLSearchParams(body) }), params: { key }, context: {} } as unknown as ActionFunctionArgs);

const base = { slug: null, done: 0, total: 24, error: null, createdAt: "2026-11-04T03:00:00.000Z", brand: null, tags: [], notes: [], script: [], named: null, answers: null, moves: 0 };
const rows = [
  { ...base, id: "b", host: "koala.example", status: "asking", done: 9 },
  {
    ...base,
    id: "a",
    host: "sampledishco.example",
    slug: "sample-dish-co",
    status: "done",
    done: 24,
    brand: "Sample Dish Co",
    tags: ["Not named once"],
    notes: ["Only 20 of 24 AI answers came back."],
    script: ["Episode ___ of helping Aussie brands get picked by AI.", "Line two."],
    named: 0,
    answers: 20,
    moves: 12,
  },
  { ...base, id: "c", host: "nope.example", status: "failed", error: "We couldn't find a Shopify store at that address." },
];

const saved = { ...process.env };
beforeEach(() => {
  vi.mocked(srv.createReports).mockReset();
  vi.mocked(srv.deleteReport).mockReset();
  vi.mocked(srv.listReports).mockReset().mockResolvedValue(rows as never);
});
afterEach(() => {
  process.env = { ...saved };
});

describe("the private link", () => {
  it("is long, the same every time, and only the right key passes", () => {
    expect(KEY).toMatch(/^[\w-]{24}$/);
    expect(maker.makerKey()).toBe(KEY);
    expect(maker.makerKeyOk(KEY)).toBe(true);
    expect(maker.makerKeyOk(KEY.slice(0, -1))).toBe(false);
    expect(maker.makerKeyOk(`${KEY.slice(0, -1)}${KEY.endsWith("a") ? "b" : "a"}`)).toBe(false);
    expect(maker.makerKeyOk("")).toBe(false);
    expect(maker.makerKeyOk(undefined)).toBe(false);
    expect(maker.makerLink()).toBe(`https://usegeo.app/report-maker/${KEY}`);
  });

  it("changes with the sign-in secret, and REPORT_MAKER_KEY (16+ characters) replaces it", () => {
    process.env.WEB_SESSION_SECRET = "another-secret";
    expect(maker.makerKey()).not.toBe(KEY);
    process.env.REPORT_MAKER_KEY = "short";
    expect(maker.makerKey()).not.toBe("short");
    process.env.REPORT_MAKER_KEY = "  a-long-private-key-123  ";
    expect(maker.makerKey()).toBe("a-long-private-key-123");
    expect(maker.makerKeyOk("a-long-private-key-123")).toBe(true);
  });
});

describe("the report maker page", () => {
  it("is a 404 with a wrong key, and starts nothing", async () => {
    await expect(load("nope")).rejects.toMatchObject({ status: 404 });
    await expect(act("nope", { intent: "create", stores: "a.example" })).rejects.toMatchObject({ status: 404 });
    expect(srv.listReports).not.toHaveBeenCalled();
    expect(srv.createReports).not.toHaveBeenCalled();
  });

  it("lists the newest reports with the right key", async () => {
    expect(await load(KEY)).toEqual({ reports: rows });
    expect(srv.listReports).toHaveBeenCalledWith(15);
  });

  it("starts a report, marked as made from the phone link", async () => {
    vi.mocked(srv.createReports).mockResolvedValue({ ok: true, created: 1, bad: [], capped: false, left: [] });
    expect(await act(KEY, { intent: "create", stores: "bondiwash.com" })).toMatchObject({ ok: true, created: 1 });
    expect(srv.createReports).toHaveBeenCalledWith("bondiwash.com", "phone link");
  });

  it("runs a failed report again in its place, and keeps it when it can't start", async () => {
    vi.mocked(srv.createReports).mockResolvedValue({ ok: true, created: 1, bad: [], capped: false, left: [] });
    await act(KEY, { intent: "rerun", stores: "nope.example", id: "c" });
    expect(srv.deleteReport).toHaveBeenCalledWith("c");
    vi.mocked(srv.deleteReport).mockClear();
    vi.mocked(srv.createReports).mockResolvedValue({ ok: false, error: "That's more than 40 reports in a day. Try again tomorrow." });
    expect(await act(KEY, { intent: "rerun", stores: "nope.example", id: "c" })).toMatchObject({ ok: false });
    expect(srv.deleteReport).not.toHaveBeenCalled();
  });

  it("can't delete or do anything else", async () => {
    expect(await act(KEY, { intent: "delete", id: "a" })).toBeNull();
    expect(srv.deleteReport).not.toHaveBeenCalled();
  });

  it("turns an error starting a report into a message", async () => {
    vi.mocked(srv.createReports).mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await act(KEY, { intent: "create", stores: "a.example" })).toMatchObject({ ok: false });
  });

  it("is never cached or indexed, and never sends the link on", () => {
    const h = new Headers(route.headers({} as never));
    expect(h.get("Cache-Control")).toBe("no-store");
    expect(h.get("X-Robots-Tag")).toBe("noindex");
    expect(h.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("shows the box, progress, the ready report with its script, and Run again, with no em dashes", () => {
    const Stub = createRoutesStub([{ id: "maker", path: "/report-maker/:key", Component: route.default, loader: () => ({ reports: rows }) }]);
    const html = renderToStaticMarkup(
      createElement(Stub, { initialEntries: [`/report-maker/${KEY}`], hydrationData: { loaderData: { maker: { reports: rows } } } } as never),
    );
    for (const s of [
      "Store website",
      "Make report",
      "Asking AI: 9 of 24",
      "Sample Dish Co",
      "Ready",
      "AI named them 0 of 20 times. 12 moves.",
      "Not named once",
      'href="/report/sample-dish-co"',
      "Open report",
      "Copy link",
      "Script",
      "Episode ___",
      "Copy script",
      "Only 20 of 24",
      "Failed",
      "We couldn&#x27;t find a Shopify store",
      "Run again",
      "Keep this link private",
    ]) {
      expect(html, s).toContain(s);
    }
    expect(html).not.toMatch(/—|―| –|– /);
    // The newest ready report's script is open, ready to read out.
    expect(html).toMatch(/<details class="rm-script" open="">/);
    expect(html.match(/Open report/g)).toHaveLength(1);
    expect(html.match(/>Run again</g)).toHaveLength(1);
  });
});
