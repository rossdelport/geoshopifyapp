// New store email: a store installing GEO (or coming back after uninstalling) queues one "install.notice" email
// to GEO_ALERT_EMAIL; a store that is just logging in again does not. No database: the shop table is faked.

import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.GEO_ALERT_EMAIL = "founder@geo.test";

const state = vi.hoisted(() => ({
  shops: new Map<string, { status: string }>(),
  email: true,
}));

vi.mock("../app/db.server", () => ({
  default: {
    shop: {
      findUnique: vi.fn(async ({ where }: { where: { domain: string } }) => {
        const row = state.shops.get(where.domain);
        return row ? { ...row, domain: where.domain } : null;
      }),
      upsert: vi.fn(async ({ where }: { where: { domain: string } }) => {
        state.shops.set(where.domain, { status: "installed" });
        return { id: "shop-1", domain: where.domain };
      }),
    },
  },
}));
vi.mock("../app/lib/shopify-gql.server", () => ({
  gql: vi.fn(async () => ({
    shop: { name: "Beard Co", email: "hi@beard.co", currencyCode: "AUD", shopAddress: { countryCodeV2: "AU" }, plan: {} },
  })),
}));
vi.mock("../app/lib/pixel.server", () => ({ ensurePixel: vi.fn(async () => {}) }));
vi.mock("../app/lib/jobs.server", () => ({ enqueue: vi.fn(async () => null), registerJob: vi.fn() }));
vi.mock("../app/lib/email.server", () => ({ emailConfigured: () => state.email, sendEmail: vi.fn() }));

const { onInstalled, installNoticeEmail } = await import("../app/lib/install.server");
const { enqueue } = await import("../app/lib/jobs.server");

const install = (shop: string) => onInstalled({ shop } as never, {} as never);

describe("new store email", () => {
  beforeEach(() => {
    state.shops.clear();
    state.email = true;
    vi.mocked(enqueue).mockClear();
  });

  it("emails once for a new store, not when it logs in again", async () => {
    await install("beard.myshopify.com");
    expect(enqueue).toHaveBeenCalledWith(
      "install.notice",
      { domain: "beard.myshopify.com", again: false },
      { dedupeKey: "install-notice:beard.myshopify.com" },
    );
    await install("beard.myshopify.com");
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("emails again when a store comes back after uninstalling", async () => {
    state.shops.set("beard.myshopify.com", { status: "uninstalled" });
    await install("beard.myshopify.com");
    expect(enqueue).toHaveBeenCalledWith("install.notice", { domain: "beard.myshopify.com", again: true }, expect.anything());
  });

  it("logs instead of queueing when email isn't set up", async () => {
    state.email = false;
    await install("beard.myshopify.com");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("writes the email with the store, contact, country and test store flag, escaped", () => {
    const { subject, html } = installNoticeEmail(
      { domain: "beard.myshopify.com", name: "Beard <Co>", email: "hi@beard.co", country: "AU", devStore: true },
      true,
    );
    expect(subject).toBe("New store installed GEO: Beard <Co> (beard.myshopify.com)");
    expect(html).toContain("Beard &lt;Co&gt;");
    expect(html).toContain("hi@beard.co");
    expect(html).toContain("Test store:</b> yes");
    expect(html).toContain("came back");
    expect(html).not.toContain("—");
  });
});
