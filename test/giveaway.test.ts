// The 3-month giveaway at firstpicked.com.au/giveaway (Ross, 3 Nov 2026). The page (no database needed) and, against a
// real Postgres (set TEST_DATABASE_URL), entries in their own schema: saving one with where it came from, the
// checks on each box, one entry per store, the hidden bot field, the per-IP limit, closing on time, the random draw,
// the founder email and the clean-up after 24 months.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { GIVEAWAY, GIVEAWAY_CONSENT_TEXT, cleanPhone, isOpen } from "../app/lib/giveaway";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_giveaway_test";
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

const OPEN = new Date("2026-11-04T02:00:00Z"); // Wednesday, while entries are open
const AFTER = new Date("2026-11-07T04:00:00Z"); // the draw, 12pm Saturday in Perth

describe("giveaway page", () => {
  const page = async () => {
    const { loader } = await import("../app/routes/giveaway");
    const res = await loader({ request: new Request("https://geo.test/giveaway"), params: {}, context: {} } as unknown as LoaderFunctionArgs);
    return { res, html: await res.text() };
  };

  it("serves one HTML page with the form at the top, kept out of search", async () => {
    const { res, html } = await page();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('<link rel="canonical" href="https://firstpicked.com.au/giveaway">');
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain("One Australian brand wins <b>3 months of GEO, free.</b>");
    // the route filled in the font, Ross's photo and the closing time
    expect(html).not.toMatch(/__[A-Z_]+__/);
    expect(html).toContain(`data-closes="${GIVEAWAY.closesAt.toISOString()}"`);
    // the four boxes the server reads, the bot trap, and the words saved with each entry
    for (const name of ["store", "name", "email", "phone", "website"]) expect(html).toContain(`name="${name}"`);
    expect(html).toContain('placeholder="amazingproduct.com.au"');
    expect(html).toContain(GIVEAWAY_CONSENT_TEXT);
    expect(html).toContain("fetch('/giveaway'");
    // Ross's rules: no em dashes (or a spaced en dash standing in for one), and no "Example" pills on screen
    expect(html).not.toContain("—");
    expect(html).not.toMatch(/ – /);
    expect(html).not.toContain('<span class="ex">');
    // every link to a part of the page has somewhere to go
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const [, a] of html.matchAll(/href="#([^"]+)"/g)) expect(ids.has(a), `href="#${a}" has no matching id`).toBe(true);
  });

  it("says the same dates and prize as the rules in app/lib/giveaway.ts", async () => {
    const { html } = await page();
    const perth = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-AU", { ...o, timeZone: "Australia/Perth" });
    expect(perth(GIVEAWAY.closesAt, { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })).toBe(
      "Friday 6 November at 11:59 pm",
    );
    expect(perth(GIVEAWAY.drawAt, { weekday: "long", day: "numeric", month: "long", hour: "numeric" })).toBe("Saturday 7 November at 12 pm");
    expect(html).toContain("close at 11:59pm on Friday 6 November 2026, Perth time (AWST)");
    expect(html).toContain("at 12pm on Saturday 7 November 2026, Perth time, in Perth, Western Australia");
    expect(html).toContain("worth A$3,000 including GST (A$1,000 a month)");
    expect(html).toContain("isn’t run, backed or linked with Facebook, Instagram, Meta or Shopify");
  });

  it("loads GEO's Meta pixel and cookie notice like the home page, and tells Meta about a new entry without any details", async () => {
    const { html } = await page();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain(readFileSync(join(ROOT, "design", "overview", "pixel-head.js"), "utf8").trim());
    expect(html.match(/28710910728563304/g)).toHaveLength(1);
    expect(html).toContain('<div class="ck" id="ck" role="region" aria-label="Cookies" hidden>');
    expect(html).toContain(readFileSync(join(ROOT, "design", "overview", "parts", "47-cookies.js"), "utf8").trim());
    expect(html).toContain("if (isNew && typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_name: 'giveaway' });");
  });
});

describe("giveaway rules in code", () => {
  it("is open until 11:59:59pm Friday 6 November, Perth time", () => {
    expect(isOpen(OPEN)).toBe(true);
    expect(isOpen(new Date("2026-11-06T15:59:59Z"))).toBe(true);
    expect(isOpen(new Date("2026-11-06T16:00:00Z"))).toBe(false);
    expect(GIVEAWAY.drawAt.toISOString()).toBe("2026-11-07T04:00:00.000Z");
  });

  it("tidies phone numbers and refuses ones that are too short or too long", () => {
    expect(cleanPhone(" 0400  369 865 ")).toBe("0400 369 865");
    expect(cleanPhone("+61 (8) 9123-4567")).toBe("+61 (8) 9123-4567");
    expect(cleanPhone("call me <b>0400369865</b>")).toBe("0400369865");
    expect(cleanPhone("1234567")).toBeNull();
    expect(cleanPhone("1".repeat(16))).toBeNull();
    expect(cleanPhone("")).toBeNull();
  });
});

describe.skipIf(!url)("giveaway entries (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let gw: typeof import("../app/lib/giveaway.server");
  let route: typeof import("../app/routes/giveaway");
  let enqueue: ReturnType<typeof vi.fn>;

  const IP = "203.0.113.7";
  const enter = (fields: Record<string, string>, now = OPEN, ip = IP) =>
    gw.enterGiveaway(
      {
        store: fields.store,
        name: fields.name,
        email: fields.email,
        phone: fields.phone,
        honeypot: fields.website,
        utmSource: fields.utm_source,
        utmCampaign: fields.utm_campaign,
        fbclid: fields.fbclid,
        referrer: fields.referrer,
        ip,
      },
      now,
    );
  const ok = { store: "amazingproduct.com.au", name: "Sam Lee", email: "sam@amazingproduct.com.au", phone: "0400 369 865" };
  const post = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
    route.action({
      request: new Request("https://geo.test/giveaway", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": IP, ...headers },
        body: new URLSearchParams(fields).toString(),
      }),
      params: {},
      context: {},
    } as unknown as ActionFunctionArgs);

  beforeAll(async () => {
    if (new URL(url!).searchParams.get("schema") !== SCHEMA) throw new Error("expected the giveaway test schema");
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
    gw = await import("../app/lib/giveaway.server");
    route = await import("../app/routes/giveaway");
    enqueue = (await import("../app/lib/jobs.server")).enqueue as unknown as ReturnType<typeof vi.fn>;
  });
  beforeEach(async () => {
    await db.giveawayEntry.deleteMany({});
    enqueue.mockClear();
    state.email = true;
  });
  afterAll(async () => {
    await db?.giveawayEntry.deleteMany({});
    await db?.$disconnect();
  });

  it("saves an entry with the store, the person and where the visit came from, and tells the founder", async () => {
    const out = await enter({
      ...ok,
      store: "https://www.AmazingProduct.com.au/products/thing?x=1",
      name: "  Sam   Lee ",
      email: "Sam@AmazingProduct.com.au",
      utm_source: "facebook",
      utm_campaign: "giveaway-nov",
      fbclid: "IwAR123",
      referrer: "https://l.facebook.com/l.php?u=https%3A%2F%2Ffirstpicked.com.au%2Fgiveaway&h=secret",
    });
    expect(out).toEqual({ status: 200, result: { ok: true, isNew: true } });
    const row = await db.giveawayEntry.findUniqueOrThrow({ where: { store: "amazingproduct.com.au" } });
    expect(row).toMatchObject({
      name: "Sam Lee",
      email: "sam@amazingproduct.com.au",
      phone: "0400 369 865",
      utmSource: "facebook",
      utmCampaign: "giveaway-nov",
      fbclid: "IwAR123",
      referrer: "l.facebook.com", // just the site, never the full address
      consentText: GIVEAWAY_CONSENT_TEXT,
      drawnAt: null,
    });
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(enqueue).toHaveBeenCalledWith("giveaway.notice", { id: row.id });
  });

  it("checks each box and says which one is wrong", async () => {
    const cases: [Record<string, string>, string][] = [
      [{ ...ok, store: "not a website" }, "store"],
      [{ ...ok, name: "  " }, "name"],
      [{ ...ok, email: "nope" }, "email"],
      [{ ...ok, phone: "123" }, "phone"],
    ];
    for (const [fields, field] of cases) {
      const out = await enter(fields);
      expect(out.status).toBe(400);
      expect(out.result).toMatchObject({ ok: false, field });
    }
    expect(await db.giveawayEntry.count()).toBe(0);
  });

  it("keeps one entry per store: the same person can fix their details, anyone else is told it's in", async () => {
    expect((await enter(ok)).result).toEqual({ ok: true, isNew: true });
    expect((await enter({ ...ok, store: "www.amazingproduct.com.au", name: "Samantha Lee", phone: "0411 111 111" })).result).toEqual({
      ok: true,
      isNew: false,
    });
    expect((await enter({ ...ok, name: "Someone Else", email: "other@example.com", phone: "0422 222 222" })).result).toEqual({
      ok: true,
      isNew: false,
    });
    const rows = await db.giveawayEntry.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: "Samantha Lee", email: "sam@amazingproduct.com.au", phone: "0411 111 111" });
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it("says yes to bots that fill the hidden field, and saves nothing", async () => {
    expect((await enter({ ...ok, website: "https://spam.example" })).result).toEqual({ ok: true });
    expect(await db.giveawayEntry.count()).toBe(0);
  });

  it("limits new entries from one connection to 10 a day", async () => {
    for (let i = 0; i < 10; i++) expect((await enter({ ...ok, store: `store${i}.com.au` })).status).toBe(200);
    const out = await enter({ ...ok, store: "one-more.com.au" });
    expect(out).toEqual({ status: 429, result: { ok: false, error: "You’ve entered a lot today. Please try again tomorrow." } });
    expect((await enter({ ...ok, store: "other.com.au" }, OPEN, "198.51.100.9")).status).toBe(200);
  });

  it("refuses entries once entries close", async () => {
    const out = await enter(ok, new Date("2026-11-06T16:00:00Z"));
    expect(out.status).toBe(403);
    expect(out.result).toMatchObject({ ok: false });
    expect(await db.giveawayEntry.count()).toBe(0);
  });

  it("still saves the entry when email isn't set up", async () => {
    state.email = false;
    expect((await enter(ok)).status).toBe(200);
    expect(await db.giveawayEntry.count()).toBe(1);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("refuses posts from other websites and posts too big to be the form", async () => {
    expect((await post(ok, { origin: "https://evil.example" })).status).toBe(403);
    expect((await post({ ...ok, name: "x".repeat(9_000) })).status).toBe(413);
    expect(await db.giveawayEntry.count()).toBe(0);
  });

  it("draws only after entries close, one entry at random, and again from the rest", async () => {
    for (const s of ["a.com.au", "b.com.au", "c.com.au"]) await enter({ ...ok, store: s });
    expect(await gw.drawWinner(OPEN)).toBeNull();
    const first = await gw.drawWinner(AFTER);
    expect(first?.drawnAt?.toISOString()).toBe(AFTER.toISOString());
    const second = await gw.drawWinner(new Date(AFTER.getTime() + 60_000));
    const third = await gw.drawWinner(new Date(AFTER.getTime() + 120_000));
    expect(new Set([first!.store, second!.store, third!.store]).size).toBe(3);
    expect(await gw.drawWinner(new Date(AFTER.getTime() + 180_000))).toBeNull();
  });

  it("writes the founder email with the store and the ad, escaped", () => {
    const { subject, html } = gw.giveawayNoticeEmail({
      store: "amazingproduct.com.au",
      name: "Sam <Lee>",
      email: "sam@example.com",
      phone: "0400 369 865",
      utmSource: "facebook",
      utmCampaign: "nov",
      referrer: "l.facebook.com",
    });
    expect(subject).toBe("New giveaway entry: amazingproduct.com.au");
    expect(html).toContain('<a href="https://amazingproduct.com.au">amazingproduct.com.au</a>');
    expect(html).toContain("Sam &lt;Lee&gt;");
    expect(html).toContain("0400 369 865");
    expect(html).toContain("facebook / nov");
    expect(html).not.toContain("—");
  });

  it("deletes entries 24 months after they were made, and the hashed IP after a day", async () => {
    const { purgeOldData } = await import("../app/lib/retention.server");
    await enter({ ...ok, store: "old.com.au" });
    await enter({ ...ok, store: "new.com.au" });
    const now = new Date();
    await db.$executeRaw`UPDATE "GiveawayEntry" SET "createdAt" = ${new Date(now.getTime() - 25 * 30.44 * 86_400_000)} WHERE store = 'old.com.au'`;
    await db.$executeRaw`UPDATE "GiveawayEntry" SET "createdAt" = ${new Date(now.getTime() - 2 * 86_400_000)} WHERE store = 'new.com.au'`;
    const out = await purgeOldData(now);
    expect(out.giveaway).toBe(1);
    const left = await db.giveawayEntry.findMany();
    expect(left.map((r) => r.store)).toEqual(["new.com.au"]);
    expect(left[0].ipHash).toBeNull();
  });
});
