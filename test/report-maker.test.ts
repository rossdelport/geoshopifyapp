// usegeo.app/report-maker (app/routes/report-maker.tsx): no sign-in. One store a time goes to createReports,
// the page follows that one report by its id (never anyone else's, never the script) and opens it when ready.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";

vi.mock("../app/lib/store-report.server", () => ({ createReports: vi.fn(), getReportItem: vi.fn() }));
vi.mock("../app/lib/public-form.server", () => ({ clientIp: (r: Request) => r.headers.get("x-real-ip"), fromAnotherSite: (r: Request) => r.headers.get("sec-fetch-site") === "cross-site" }));

const srv = await import("../app/lib/store-report.server");
const route = await import("../app/routes/report-maker");

const load = (q = "") => route.loader({ request: new Request(`https://usegeo.app/report-maker${q}`), params: {}, context: {} } as unknown as LoaderFunctionArgs);
const act = (store: string, headers: Record<string, string> = {}) =>
  route.action({
    request: new Request("https://usegeo.app/report-maker", { method: "POST", body: new URLSearchParams({ store }), headers: { "x-real-ip": "1.2.3.4", ...headers } }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs);

const item = {
  id: "r1",
  host: "sampledishco.example",
  slug: null,
  status: "asking",
  done: 9,
  total: 24,
  error: null,
  createdAt: "2026-11-04T03:00:00.000Z",
  brand: null,
  tags: ["Not named once"],
  notes: ["a note"],
  script: ["Episode ___ secret script"],
  named: null,
  answers: null,
  moves: 0,
};

beforeEach(() => {
  vi.mocked(srv.createReports).mockReset();
  vi.mocked(srv.getReportItem).mockReset();
});

describe("Report maker", () => {
  it("shows an empty box with no id, and only one report's progress with one (no script, tags or notes)", async () => {
    expect(await load()).toEqual({ report: null, missing: false });
    expect(srv.getReportItem).not.toHaveBeenCalled();

    vi.mocked(srv.getReportItem).mockResolvedValue(item as never);
    const data = await load("?id=r1");
    expect(srv.getReportItem).toHaveBeenCalledWith("r1");
    expect(data).toEqual({ report: { host: "sampledishco.example", brand: null, status: "asking", done: 9, total: 24, error: null, slug: null }, missing: false });
    expect(JSON.stringify(data)).not.toMatch(/script|Episode|Not named|a note/);

    vi.mocked(srv.getReportItem).mockResolvedValue(null);
    expect(await load("?id=gone")).toEqual({ report: null, missing: true });
  });

  it("starts one report for the first store typed, then follows it", async () => {
    vi.mocked(srv.createReports).mockResolvedValue({ ok: true, created: 1, ids: ["r9"], bad: [], capped: false, left: [] });
    const res = (await act("  https://www.sampledishco.example/  other.example")) as Response;
    expect(srv.createReports).toHaveBeenCalledWith("https://www.sampledishco.example/", "report maker");
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/report-maker?id=r9");
  });

  it("says why a report didn't start", async () => {
    expect(await act("   ")).toEqual({ error: "Type a store's website, like bondiwash.com." });
    vi.mocked(srv.createReports).mockResolvedValue({ ok: false, error: "That's more than 40 reports in a day. Try again tomorrow." });
    expect(await act("a.example", { "x-real-ip": "5.5.5.5" })).toEqual({ error: "That's more than 40 reports in a day. Try again tomorrow." });
    vi.mocked(srv.createReports).mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await act("a.example", { "x-real-ip": "5.5.5.5" })).toMatchObject({ error: expect.stringContaining("Something went wrong") });
  });

  it("refuses posts from other websites and more than 10 a day from one visitor", async () => {
    expect(await act("a.example", { "sec-fetch-site": "cross-site" })).toMatchObject({ error: expect.any(String) });
    expect(srv.createReports).not.toHaveBeenCalled();

    vi.mocked(srv.createReports).mockResolvedValue({ ok: true, created: 1, ids: ["r"], bad: [], capped: false, left: [] });
    for (let i = 0; i < 10; i++) expect(await act("a.example", { "x-real-ip": "9.9.9.9" })).toBeInstanceOf(Response);
    expect(await act("a.example", { "x-real-ip": "9.9.9.9" })).toEqual({ error: "That's a lot of reports today. Please try again tomorrow." });
    expect(srv.createReports).toHaveBeenCalledTimes(10);
    // Another visitor still can.
    expect(await act("a.example", { "x-real-ip": "8.8.8.8" })).toBeInstanceOf(Response);
  });

  it("is never cached or in search results", () => {
    const h = new Headers(route.headers({} as never));
    expect(h.get("Cache-Control")).toBe("no-store");
    expect(h.get("X-Robots-Tag")).toBe("noindex");
  });

  const render = (report: unknown) => {
    const data = { report, missing: false };
    const Stub = createRoutesStub([{ id: "maker", path: "/report-maker", Component: route.default, loader: () => data }]);
    return renderToStaticMarkup(createElement(Stub, { initialEntries: ["/report-maker"], hydrationData: { loaderData: { maker: data } } } as never));
  };

  it("shows the box, then progress, then Open report or Try again, with no em dashes", () => {
    const empty = render(null);
    for (const s of ["Report maker", "Store website", 'placeholder="bondiwash.com"', "Make report"]) expect(empty, s).toContain(s);

    const asking = render({ host: "sampledishco.example", brand: null, status: "asking", done: 9, total: 24, error: null, slug: null });
    for (const s of ["sampledishco.example", "Asking AI: 9 of 24", "the report opens by itself", 'href="/report-maker"']) expect(asking, s).toContain(s);
    expect(asking).not.toContain("Make report");

    const done = render({ host: "sampledishco.example", brand: "Sample Dish Co", status: "done", done: 24, total: 24, error: null, slug: "sample-dish-co" });
    for (const s of ["Sample Dish Co", "Ready", 'href="/report/sample-dish-co"', "Open report"]) expect(done, s).toContain(s);

    const failed = render({ host: "nope.example", brand: null, status: "failed", done: 0, total: 24, error: "We couldn't find a Shopify store at that address.", slug: null });
    for (const s of ["Failed", "We couldn&#x27;t find a Shopify store", 'value="nope.example"', "Try again"]) expect(failed, s).toContain(s);

    for (const html of [empty, asking, done, failed]) expect(html).not.toMatch(/—|―| –|– /);
  });
});
