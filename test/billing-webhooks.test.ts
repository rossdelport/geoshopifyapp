// Billing webhooks without a database: Shopify, the db and the billing helpers are faked.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const webhook = vi.fn();
vi.mock("../app/shopify.server", () => ({ authenticate: { webhook: (...a: unknown[]) => webhook(...a) } }));

const shopRow = { id: "shop1", domain: "s.myshopify.com", name: "S", email: null, country: "AU", plan: "core", status: "installed" };
const db = {
  shop: { findUnique: vi.fn(), update: vi.fn(async () => ({})), updateMany: vi.fn(async () => ({ count: 1 })) },
  session: { deleteMany: vi.fn(async () => ({})) },
  job: { updateMany: vi.fn(async () => ({})) },
};
vi.mock("../app/db.server", () => ({ default: db }));

const billing = {
  activeSubscriptions: vi.fn(),
  syncPlanFromSubscriptions: vi.fn(async () => true),
  onPlanChanged: vi.fn(async () => true),
  notifyFounder: vi.fn(async () => {}),
};
vi.mock("../app/lib/billing.server", () => billing);

const { action: subscriptionsUpdate } = await import("../app/routes/webhooks.app_subscriptions.update");
const { action: uninstalled } = await import("../app/routes/webhooks.app.uninstalled");
const call = (fn: typeof subscriptionsUpdate) => fn({ request: new Request("https://geo.test/webhooks") } as unknown as ActionFunctionArgs);

const payload = (name: string, status: string) => ({ app_subscription: { name, status } });

beforeEach(() => {
  vi.clearAllMocks();
  db.shop.findUnique.mockResolvedValue({ ...shopRow });
});

describe("app_subscriptions/update", () => {
  it("syncs from Shopify's live subscriptions when it can read them", async () => {
    const live = [{ id: "1", name: "GEO Standard yearly", status: "ACTIVE", createdAt: "2026-10-10T00:00:00Z", trialDays: 7 }];
    webhook.mockResolvedValue({ shop: shopRow.domain, admin: {}, payload: payload("GEO Standard", "CANCELLED") });
    billing.activeSubscriptions.mockResolvedValue(live);
    const res = await call(subscriptionsUpdate);
    expect(res.status).toBe(200);
    expect(billing.syncPlanFromSubscriptions).toHaveBeenCalledWith("shop1", live);
    expect(billing.onPlanChanged).not.toHaveBeenCalled();
  });

  it("asks Shopify to retry (500) instead of guessing when the read fails, so a paying store is never dropped", async () => {
    // Standard monthly to yearly: the old monthly's CANCELLED webhook names the store's current plan.
    webhook.mockResolvedValue({ shop: shopRow.domain, admin: {}, payload: payload("GEO Standard", "CANCELLED") });
    billing.activeSubscriptions.mockRejectedValue(new Error("401 token expired"));
    const res = await call(subscriptionsUpdate);
    expect(res.status).toBe(500);
    expect(billing.onPlanChanged).not.toHaveBeenCalled();
    expect(billing.syncPlanFromSubscriptions).not.toHaveBeenCalled();
  });

  it("without admin access, takes a new active plan but never drops an installed store on CANCELLED", async () => {
    webhook.mockResolvedValue({ shop: shopRow.domain, admin: undefined, payload: payload("GEO Standard", "CANCELLED") });
    await call(subscriptionsUpdate);
    expect(billing.onPlanChanged).not.toHaveBeenCalled();

    webhook.mockResolvedValue({ shop: shopRow.domain, admin: undefined, payload: payload("GEO Done-for-you", "ACTIVE") });
    await call(subscriptionsUpdate);
    expect(billing.onPlanChanged).toHaveBeenCalledWith("shop1", "pro", { billingName: "GEO Done-for-you" });
  });

  it("without admin access, drops the plan only for an uninstalled store", async () => {
    db.shop.findUnique.mockResolvedValue({ ...shopRow, status: "uninstalled" });
    webhook.mockResolvedValue({ shop: shopRow.domain, admin: undefined, payload: payload("GEO Standard", "CANCELLED") });
    await call(subscriptionsUpdate);
    expect(billing.onPlanChanged).toHaveBeenCalledWith("shop1", "free");
  });
});

describe("app/uninstalled", () => {
  it("tells the founder when a Done-for-you store uninstalls, once", async () => {
    db.shop.findUnique.mockResolvedValue({ ...shopRow, plan: "pro" });
    webhook.mockResolvedValue({ shop: shopRow.domain, session: {}, topic: "APP_UNINSTALLED" });
    await call(uninstalled);
    expect(billing.notifyFounder).toHaveBeenCalledTimes(1);
    expect(billing.notifyFounder).toHaveBeenCalledWith(expect.objectContaining({ id: "shop1" }), "pro", "free", { reason: "app uninstalled" });
    expect(db.shop.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ plan: "free", status: "uninstalled" }) }));
    // The queued jobs are stopped before the notice is queued, so it isn't stopped with them.
    expect(db.job.updateMany.mock.invocationCallOrder[0]).toBeLessThan(billing.notifyFounder.mock.invocationCallOrder[0]);

    // The same webhook again: the plan is no longer "pro" in the compare and swap, so no second email.
    db.shop.updateMany.mockResolvedValueOnce({ count: 0 });
    await call(uninstalled);
    expect(billing.notifyFounder).toHaveBeenCalledTimes(1);
  });

  it("doesn't email for a Standard store", async () => {
    webhook.mockResolvedValue({ shop: shopRow.domain, session: null, topic: "APP_UNINSTALLED" });
    await call(uninstalled);
    expect(billing.notifyFounder).not.toHaveBeenCalled();
    expect(db.shop.update).toHaveBeenCalled();
  });
});
