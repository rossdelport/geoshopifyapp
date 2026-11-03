// Admin > Reports (app/routes/dash.admin.reports.tsx): only admins, the paste goes to createReports with the
// admin's email, and the list shows each report's status, tags, link and script (the script lives only here).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";

vi.mock("../app/lib/store-report.server", () => ({ createReports: vi.fn(), deleteReport: vi.fn(), listReports: vi.fn() }));
vi.mock("../app/lib/admin.server", () => ({ requireAdmin: vi.fn() }));

const srv = await import("../app/lib/store-report.server");
const { requireAdmin } = await import("../app/lib/admin.server");
const route = await import("../app/routes/dash.admin.reports");

const req = (body?: Record<string, string>) =>
  new Request("https://usegeo.app/dash/admin/reports", body ? { method: "POST", body: new URLSearchParams(body) } : undefined);
const load = () => route.loader({ request: req(), params: {}, context: {} } as unknown as LoaderFunctionArgs);
const act = (body: Record<string, string>) => route.action({ request: req(body), params: {}, context: {} } as unknown as ActionFunctionArgs);

const base = { slug: null, done: 0, total: 24, error: null, createdAt: "2026-11-03T03:00:00.000Z", brand: null, tags: [], notes: [], script: [], named: null, answers: null, moves: 0 };
const rows = [
  {
    ...base,
    id: "a",
    host: "sampledishco.example",
    slug: "sample-dish-co",
    status: "done",
    done: 24,
    brand: "Sample Dish Co",
    tags: ["Not named once", "Easy search word"],
    notes: ["Only 20 of 24 AI answers came back."],
    script: ["Episode ___ of helping Aussie brands get picked by AI. Today it's Sample Dish Co.", "Line two."],
    named: 0,
    answers: 20,
    moves: 12,
  },
  { ...base, id: "b", host: "koala.example", status: "asking", done: 9 },
  { ...base, id: "c", host: "nope.example", status: "failed", error: "We couldn't find a Shopify store at that address." },
  { ...base, id: "d", host: "wait.example", status: "queued" },
];

beforeEach(() => {
  vi.mocked(requireAdmin).mockReset().mockResolvedValue({ id: "u1", email: "ross@example.com" } as never);
  vi.mocked(srv.createReports).mockReset();
  vi.mocked(srv.deleteReport).mockReset();
  vi.mocked(srv.listReports).mockReset().mockResolvedValue(rows as never);
});

describe("Admin > Reports", () => {
  it("is only for admins: the loader and the action both ask", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Response("Not found", { status: 404 }));
    await expect(load()).rejects.toMatchObject({ status: 404 });
    await expect(act({ intent: "create", stores: "a.example" })).rejects.toMatchObject({ status: 404 });
    await expect(act({ intent: "delete", id: "a" })).rejects.toMatchObject({ status: 404 });
    expect(srv.listReports).not.toHaveBeenCalled();
    expect(srv.createReports).not.toHaveBeenCalled();
    expect(srv.deleteReport).not.toHaveBeenCalled();
  });

  it("lists the reports", async () => {
    expect(await load()).toEqual({ reports: rows });
    expect(requireAdmin).toHaveBeenCalledTimes(1);
  });

  it("passes the paste and the admin's email to createReports", async () => {
    vi.mocked(srv.createReports).mockResolvedValue({ ok: true, created: 2, bad: [], capped: false, left: [] });
    expect(await act({ intent: "create", stores: "a.example\nb.example" })).toEqual({ ok: true, created: 2, bad: [], capped: false, left: [] });
    expect(srv.createReports).toHaveBeenCalledWith("a.example\nb.example", "ross@example.com");
    expect(srv.deleteReport).not.toHaveBeenCalled();
  });

  it("runs a failed report again: a new report for the same store takes its place", async () => {
    vi.mocked(srv.createReports).mockResolvedValue({ ok: true, created: 1, bad: [], capped: false, left: [] });
    expect(await act({ intent: "rerun", stores: "nope.example", id: "c" })).toMatchObject({ ok: true, created: 1 });
    expect(srv.createReports).toHaveBeenCalledWith("nope.example", "ross@example.com");
    expect(srv.deleteReport).toHaveBeenCalledWith("c");

    // When it can't start (40 a day), the failed one stays.
    vi.mocked(srv.deleteReport).mockClear();
    vi.mocked(srv.createReports).mockResolvedValue({ ok: false, error: "That's more than 40 reports in a day. Try again tomorrow." });
    expect(await act({ intent: "rerun", stores: "nope.example", id: "c" })).toMatchObject({ ok: false });
    expect(srv.deleteReport).not.toHaveBeenCalled();
  });

  it("turns an error starting reports into a message", async () => {
    vi.mocked(srv.createReports).mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await act({ intent: "create", stores: "a.example" })).toMatchObject({ ok: false });
  });

  it("deletes a report", async () => {
    await act({ intent: "delete", id: "a" });
    expect(srv.deleteReport).toHaveBeenCalledWith("a");
  });

  it("shows status, tags, the link and the script, with no em dashes", () => {
    const Stub = createRoutesStub([{ id: "reports", path: "/dash/admin/reports", Component: route.default, loader: () => ({ reports: rows }) }]);
    const html = renderToStaticMarkup(
      createElement(Stub, { initialEntries: ["/dash/admin/reports"], hydrationData: { loaderData: { reports: { reports: rows } } } } as never),
    );
    for (const s of [
      "Store addresses, one per line",
      "Make reports",
      "About 3 minutes each, about US$0.30 each. Up to 10 at a time.",
      "4 reports",
      "Sample Dish Co",
      "Ready",
      "Named 0 of 20, 12 moves",
      "Asking AI: 9 of 24",
      "Failed: We couldn&#x27;t find a Shopify store",
      "Waiting",
      "Not named once",
      "Copy link",
      'href="/report/sample-dish-co"',
      "Script",
      "Episode ___",
      "Only 20 of 24",
      "Copy script",
    ]) {
      expect(html, s).toContain(s);
    }
    expect(html).not.toMatch(/—|―| –|– /);
    // Only the ready report has a link to copy; only the failed one can be run again.
    expect(html.match(/Copy link/g)).toHaveLength(1);
    expect(html.match(/>Run again</g)).toHaveLength(1);
    expect(html).toMatch(/name="intent" value="rerun"\/><input type="hidden" name="stores" value="nope.example"\/><input type="hidden" name="id" value="c"\/>/);
    // A report without a brand shows its address once.
    expect(html.match(/>koala\.example</g)).toHaveLength(1);
    expect(html.match(/>sampledishco\.example</g)).toHaveLength(1);
  });
});
