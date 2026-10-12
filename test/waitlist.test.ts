// Website waitlist against a real Postgres (set TEST_DATABASE_URL), in its own schema so it can run beside the
// other database tests. Covers: saving a signup with where it came from, the checks on name and email, the
// hidden bot field, joining twice, the per-IP limit, the founder email, other websites and big posts, and the
// clean-up after 24 months.

import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs } from "react-router";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_waitlist_test";
const url = (() => {
  if (!base) return null;
  const u = new URL(base);
  u.searchParams.set("schema", SCHEMA);
  return u.toString();
})();
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}
process.env.SHOPIFY_APP_URL = "https://geo.test";
process.env.CHECK_IP_SECRET = "test-secret";
process.env.GEO_ALERT_EMAIL = "founder@geo.test";

const state = vi.hoisted(() => ({ email: true }));
vi.mock("../app/lib/jobs.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/jobs.server")>()),
  enqueue: vi.fn(async () => null),
}));
vi.mock("../app/lib/email.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/email.server")>()),
  emailConfigured: () => state.email,
}));

describe.skipIf(!url)("website waitlist (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let wl: typeof import("../app/lib/waitlist.server");
  let route: typeof import("../app/routes/waitlist");
  let enqueue: ReturnType<typeof vi.fn>;

  const post = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
    route.action({
      request: new Request("https://geo.test/waitlist", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": "203.0.113.7", ...headers },
        body: new URLSearchParams(fields).toString(),
      }),
      params: {},
      context: {},
    } as unknown as ActionFunctionArgs);

  beforeAll(async () => {
    if (new URL(url!).searchParams.get("schema") !== SCHEMA) throw new Error("expected the waitlist test schema");
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
    wl = await import("../app/lib/waitlist.server");
    route = await import("../app/routes/waitlist");
    enqueue = (await import("../app/lib/jobs.server")).enqueue as unknown as ReturnType<typeof vi.fn>;
  });
  beforeEach(async () => {
    await db.waitlistSignup.deleteMany({});
    enqueue.mockClear();
    state.email = true;
  });
  afterAll(async () => {
    await db?.waitlistSignup.deleteMany({});
    await db?.$disconnect();
  });

  it("saves a signup with the button, the plan and where the visit came from, and tells the founder", async () => {
    const res = await post({
      name: "  Sam   Lee ",
      email: "Sam@BeardCo.com",
      source: "pricing",
      plan: "pro",
      cycle: "yearly",
      utm_source: "facebook",
      utm_medium: "paid",
      utm_campaign: "waitlist-oct",
      fbclid: "IwAR123",
      referrer: "https://l.facebook.com/l.php?u=https%3A%2F%2Fusegeo.app%2F&h=secret",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const row = await db.waitlistSignup.findUniqueOrThrow({ where: { email: "sam@beardco.com" } });
    expect(row).toMatchObject({
      name: "Sam Lee",
      source: "pricing",
      plan: "pro",
      cycle: "yearly",
      utmSource: "facebook",
      utmMedium: "paid",
      utmCampaign: "waitlist-oct",
      fbclid: "IwAR123",
      referrer: "l.facebook.com", // just the site, never the full address
      consentText: wl.WAITLIST_CONSENT_TEXT,
      joins: 1,
    });
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.ipHash).not.toContain("203.0.113.7");
    expect(enqueue).toHaveBeenCalledWith("waitlist.notice", { id: row.id });
  });

  it("checks the name and email, and ignores made-up buttons and plans", async () => {
    let res = await post({ name: "  ", email: "a@b.com" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: wl.WAITLIST_ERRORS.name });
    res = await post({ name: "Sam", email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: wl.WAITLIST_ERRORS.email });
    expect(await db.waitlistSignup.count()).toBe(0);

    await post({ name: "<b>Sam</b>", email: "sam@example.com", source: "admin", plan: "free", cycle: "yearly" });
    const row = await db.waitlistSignup.findUniqueOrThrow({ where: { email: "sam@example.com" } });
    expect(row).toMatchObject({ name: "b Sam /b", source: "link", plan: null, cycle: null });
  });

  it("says yes to bots that fill the hidden field, and saves nothing", async () => {
    const res = await post({ name: "Bot", email: "bot@example.com", website: "https://spam.example" });
    expect(await res.json()).toEqual({ ok: true });
    expect(await db.waitlistSignup.count()).toBe(0);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("joining again keeps one row and where they first came from, updates the name, and emails the founder once", async () => {
    await post({ name: "Sam", email: "sam@example.com", source: "hero", utm_campaign: "first" });
    await post({ name: "Sam Lee", email: "SAM@example.com", source: "footer", utm_campaign: "second" });
    const rows = await db.waitlistSignup.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Sam Lee", source: "hero", utmCampaign: "first", joins: 2 });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("limits joins from one connection to 10 a day", async () => {
    for (let i = 0; i < 10; i++) expect((await post({ name: `Person ${i}`, email: `p${i}@example.com` })).status).toBe(200);
    const res = await post({ name: "One more", email: "more@example.com" });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: wl.WAITLIST_ERRORS.perIp });
    // another connection still gets in
    expect((await post({ name: "Other", email: "other@example.com" }, { "x-real-ip": "198.51.100.9" })).status).toBe(200);
  });

  it("still saves the signup when email isn't set up (and logs it instead of queueing an email)", async () => {
    state.email = false;
    expect((await post({ name: "Sam", email: "sam@example.com" })).status).toBe(200);
    expect(await db.waitlistSignup.count()).toBe(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("refuses posts from other websites and posts too big to be the form, and sends GET to the home page popup", async () => {
    let res = await post({ name: "Sam", email: "sam@example.com" }, { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    res = await post({ name: "x".repeat(9_000), email: "sam@example.com" });
    expect(res.status).toBe(413);
    expect(await db.waitlistSignup.count()).toBe(0);
    const get = route.loader();
    expect(get.status).toBe(302);
    expect(get.headers.get("Location")).toBe("/#waitlist");
  });

  it("writes the founder email with the plan and the ad, escaped", () => {
    const { subject, html } = wl.waitlistNoticeEmail({
      name: "Sam <Lee>",
      email: "sam@example.com",
      source: "pricing",
      plan: "pro",
      cycle: "monthly",
      utmSource: "facebook",
      utmCampaign: "oct",
      referrer: "l.facebook.com",
    });
    expect(subject).toBe("New waitlist signup: Sam <Lee>");
    expect(html).toContain("Sam &lt;Lee&gt;");
    expect(html).toContain("pricing (Done-for-you, monthly)");
    expect(html).toContain("facebook / oct");
    expect(html).not.toContain("—");
  });

  it("deletes signups 24 months after they joined, and the hashed IP after a day", async () => {
    const { purgeOldData } = await import("../app/lib/retention.server");
    await post({ name: "Old", email: "old@example.com" });
    await post({ name: "New", email: "new@example.com" });
    const now = new Date();
    await db.$executeRaw`UPDATE "WaitlistSignup" SET "createdAt" = ${new Date(now.getTime() - 25 * 30.44 * 86_400_000)} WHERE email = 'old@example.com'`;
    await db.$executeRaw`UPDATE "WaitlistSignup" SET "updatedAt" = ${new Date(now.getTime() - 2 * 86_400_000)} WHERE email = 'new@example.com'`;
    const out = await purgeOldData(now);
    expect(out.waitlist).toBe(1);
    const left = await db.waitlistSignup.findMany();
    expect(left.map((r) => r.email)).toEqual(["new@example.com"]);
    expect(left[0].ipHash).toBeNull();
  });
});
