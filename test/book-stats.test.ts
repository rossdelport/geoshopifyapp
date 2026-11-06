// Ross's morning chart (4 Nov 2026): people who opened firstpicked.com.au/book and the calls they booked, by ad, on
// the admin Overview; and the admin area's password page. The rules (no database) and, against a real Postgres (set
// TEST_DATABASE_URL), saving visits once per person per day, counting by Sydney day, the page's beacon, signing in
// with the password and clearing the scrambled ids after 2 days.

import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { NOT_SHOPIFY, NO_NAME, adName, answerLabel, bookedRate, hostOf, readAdTags, summarise } from "../app/lib/book-stats";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_book_stats_test";
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

const none = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, fbclid: false, referrer: null };

describe("which ad a visit came from", () => {
  it("uses the ad's name, then the campaign, then the source", () => {
    expect(adName({ ...none, utmSource: "facebook", utmCampaign: "GEO - Waitlist", utmContent: "50_million" })).toBe("50_million");
    expect(adName({ ...none, utmSource: "facebook", utmCampaign: "GEO - Waitlist" })).toBe("GEO - Waitlist");
    expect(adName({ ...none, utmSource: "instagram" })).toBe("instagram");
  });

  it("with no tags: Facebook or Instagram, our home page, or not from an ad", () => {
    expect(adName({ ...none, fbclid: true })).toBe(NO_NAME.meta);
    expect(adName({ ...none, referrer: "m.facebook.com" })).toBe(NO_NAME.meta);
    expect(adName({ ...none, referrer: "l.instagram.com" })).toBe(NO_NAME.meta);
    expect(adName({ ...none, referrer: "firstpicked.com.au" })).toBe(NO_NAME.home);
    expect(adName({ ...none, referrer: "google.com" })).toBe(NO_NAME.none);
    expect(adName(none)).toBe(NO_NAME.none);
    expect(adName({ ...none, referrer: "notfacebook.com" })).toBe(NO_NAME.none);
  });

  it("reads the tags the page sends, short and plain", () => {
    const form = new URLSearchParams({ utm_source: " facebook ", utm_content: "50_<b>million</b>", fb: "1", ref: "https://www.m.facebook.com/x?y=1", seen: "1" });
    expect(readAdTags(form)).toEqual({ ...none, utmSource: "facebook", utmContent: "50_ b million /b", fbclid: true, referrer: "m.facebook.com" });
    expect(readAdTags(new URLSearchParams({ utm_term: "x".repeat(300) })).utmTerm).toHaveLength(100);
    expect(hostOf("javascript:alert(1)")).toBeNull();
    expect(hostOf("not a url")).toBeNull();
    expect(hostOf("https://www.firstpicked.com.au/")).toBe("firstpicked.com.au");
  });
});

describe("the numbers", () => {
  it("counts people and calls booked per day and per ad, most people first, and leaves out other days", () => {
    const row = (kind: string, day: string, utmContent: string | null = null) => ({ ...none, kind, day, utmContent });
    const out = summarise(
      [row("view", "2026-11-03", "50_million"), row("view", "2026-11-04", "50_million"), row("view", "2026-11-04", "90_more"), row("view", "2026-11-04", "50_million"), row("booked", "2026-11-04", "90_more"), row("view", "2026-11-02", "old")],
      ["2026-11-03", "2026-11-04"],
    );
    expect(out.days).toEqual([
      { day: "2026-11-03", people: 1, booked: 0 },
      { day: "2026-11-04", people: 3, booked: 1 },
    ]);
    expect(out.ads).toEqual([
      { name: "50_million", people: 3, booked: 0 },
      { name: "90_more", people: 1, booked: 1 },
    ]);
    expect(out.totals).toEqual({ people: 4, booked: 1 });
  });

  it("counts what people answered (Ross, 6 Nov 2026), without counting the answers as more people", () => {
    const row = (kind: string, shopify: string | null, sales: string | null) => ({ ...none, kind, day: "2026-11-06", shopify, sales });
    const out = summarise(
      [
        row("view", null, null),
        row("view", null, null),
        row("view", null, null),
        row("answered", "no", null),
        row("answered", "yes", "under-5k"),
        row("answered", null, "under-5k"), // picked the drop-down before Yes or No: still too small
        row("answered", "yes", "20k-50k"),
        row("booked", "yes", "20k-50k"),
        row("booked", null, null), // booked before the questions: no answer
        row("answered", "yes", "a lot"), // not one of the choices: left out
      ],
      ["2026-11-06"],
    );
    expect(out.totals).toEqual({ people: 3, booked: 2 });
    expect(out.answers).toEqual([
      { label: NOT_SHOPIFY, people: 1, booked: 0 },
      { label: "Under A$5,000", people: 2, booked: 0 },
      { label: "A$5,000 to A$20,000", people: 0, booked: 0 },
      { label: "A$20,000 to A$50,000", people: 1, booked: 1 },
      { label: "A$50,000 to A$100,000", people: 0, booked: 0 },
      { label: "Over A$100,000", people: 0, booked: 0 },
    ]);
    expect(answerLabel("no", "over-100k")).toBe(NOT_SHOPIFY);
    expect(answerLabel("yes", null)).toBeNull();
  });

  it("shows the share who booked as a whole percent, or nothing when nobody came", () => {
    expect(bookedRate(8, 1)).toBe("13%");
    expect(bookedRate(0, 0)).toBe("");
  });
});

describe("signing in to the admin area", () => {
  it("sends signed-out visits to the admin area to the password page, and the rest to the email link", async () => {
    const { signInPage } = await import("../app/lib/web-auth.server");
    expect(signInPage("/dash/admin")).toBe("/admin?next=%2Fdash%2Fadmin");
    expect(signInPage("/dash/admin/giveaway")).toBe("/admin?next=%2Fdash%2Fadmin%2Fgiveaway");
    expect(signInPage("/dash/sites")).toBe("/login?next=%2Fdash%2Fsites");
  });

  it("says to use an email link when no password is set", async () => {
    delete process.env.GEO_ADMIN_PASSWORD;
    const { passwordSignIn, PASSWORD_ERRORS } = await import("../app/lib/admin.server");
    expect(await passwordSignIn("anything", "203.0.113.1")).toEqual({ ok: false, error: PASSWORD_ERRORS.off });
  });

  it("refuses a wrong password, and stops after 5 wrong tries in 15 minutes", async () => {
    process.env.GEO_ADMIN_PASSWORD = "purple-ticket-river";
    const { passwordSignIn, PASSWORD_ERRORS } = await import("../app/lib/admin.server");
    const now = Date.parse("2026-11-04T10:00:00Z");
    for (let i = 0; i < 5; i++) expect(await passwordSignIn("12345", "203.0.113.2", now + i)).toEqual({ ok: false, error: PASSWORD_ERRORS.wrong });
    // now even the right one waits
    expect(await passwordSignIn("purple-ticket-river", "203.0.113.2", now + 10)).toEqual({ ok: false, error: PASSWORD_ERRORS.tooMany });
    // someone else isn't locked out
    expect(await passwordSignIn("nope", "203.0.113.3", now + 10)).toEqual({ ok: false, error: PASSWORD_ERRORS.wrong });
  });
});

describe.skipIf(!url)("saving and counting (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let stats: typeof import("../app/lib/book-stats.server");
  let book: typeof import("../app/routes/book");
  let admin: typeof import("../app/routes/admin");

  const post = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) =>
    new Request(`https://geo.test${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": "203.0.113.20", "user-agent": "Phone 1", ...headers },
      body: new URLSearchParams(fields).toString(),
    });

  beforeAll(async () => {
    if (new URL(url!).searchParams.get("schema") !== SCHEMA) throw new Error("expected the book stats test schema");
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
    stats = await import("../app/lib/book-stats.server");
    book = await import("../app/routes/book");
    admin = await import("../app/routes/admin");
  });
  beforeEach(async () => {
    await db.bookEvent.deleteMany({});
  });
  afterAll(async () => {
    await db?.bookEvent.deleteMany({});
    await db?.user.deleteMany({});
    await db?.$disconnect();
  });

  it("counts the page once it is on screen, with the ad's tags and nothing about the person", async () => {
    const res = (await book.action({ request: post("/book", { seen: "1", utm_source: "facebook", utm_content: "50_million", fb: "1", ref: "https://m.facebook.com/" }), params: {}, context: {} } as unknown as ActionFunctionArgs)) as Response;
    expect(res.status).toBe(204);
    const rows = await db.bookEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "view", utmSource: "facebook", utmContent: "50_million", fbclid: true, referrer: "m.facebook.com" });
    expect(rows[0].visitor).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(rows[0])).not.toContain("203.0.113.20");
  });

  it("refuses counts posted from other websites", async () => {
    const res = (await book.action({ request: post("/book", { seen: "1" }, { "sec-fetch-site": "cross-site" }), params: {}, context: {} } as unknown as ActionFunctionArgs)) as Response;
    expect(res.status).toBe(403);
    expect(await db.bookEvent.count()).toBe(0);
  });

  it("counts a person once a Sydney day: a refresh doesn't count again, the next day does, another person does", async () => {
    const tags = readAdTags(new URLSearchParams({ utm_content: "50_million" }));
    const am = new Date("2026-11-04T00:00:00Z"); // 11 am in Sydney
    expect(await stats.saveBookView(tags, "a", am)).toBe(true);
    expect(await stats.saveBookView(tags, "a", new Date(am.getTime() + 3_600_000))).toBe(false);
    expect(await stats.saveBookView(tags, "b", new Date(am.getTime() + 3_600_000))).toBe(true);
    expect(await stats.saveBookView(tags, "a", new Date("2026-11-04T14:00:00Z"))).toBe(true); // 1 am on the 5th in Sydney
    await stats.saveBooking(tags, "20k-50k", am);
    const out = await stats.bookStats("2026-11-04", "2026-11-05");
    expect(out.days.map((d) => [d.day, d.people])).toEqual([
      ["2026-11-04", 2],
      ["2026-11-05", 1],
    ]);
    expect(out.ads).toEqual([{ name: "50_million", people: 3, booked: 1 }]);
  });

  it("keeps each person's answers once a day, changed if they change them, and counts them with the calls booked", async () => {
    const res = (await book.action({ request: post("/book", { answered: "1", shopify: "yes", sales: "under-5k", utm_content: "50_million" }), params: {}, context: {} } as unknown as ActionFunctionArgs)) as Response;
    expect(res.status).toBe(204);
    // they change their mind: the same row changes
    await book.action({ request: post("/book", { answered: "1", shopify: "yes", sales: "20k-50k", utm_content: "50_million" }), params: {}, context: {} } as unknown as ActionFunctionArgs);
    let rows = await db.bookEvent.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "answered", shopify: "yes", sales: "20k-50k", utmContent: "50_million" });
    expect(JSON.stringify(rows[0])).not.toContain("203.0.113.20");
    // "No" to Shopify keeps no sales answer; nothing is kept without an answer
    const tags = readAdTags(new URLSearchParams());
    expect(await stats.saveAnswers(tags, "c", { shopify: "no", sales: "over-100k" })).toBe(true);
    expect(await stats.saveAnswers(tags, "d", { shopify: "maybe", sales: "lots" })).toBe(false);
    rows = await db.bookEvent.findMany({ where: { visitor: "c" } });
    expect(rows).toMatchObject([{ kind: "answered", shopify: "no", sales: null }]);
    await stats.saveBooking(tags, "20k-50k");
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
    const out = await stats.bookStats(today, today);
    expect(out.totals).toEqual({ people: 0, booked: 1 });
    expect(out.answers.filter((a) => a.people || a.booked)).toEqual([
      { label: NOT_SHOPIFY, people: 1, booked: 0 },
      { label: "A$20,000 to A$50,000", people: 1, booked: 1 },
    ]);
  });

  it("deletes a booked call's details 24 months after booking", async () => {
    const { purgeOldData } = await import("../app/lib/retention.server");
    const now = new Date();
    const call = { startsAt: now, name: "Jane", email: "jane@shopjane.com.au", store: "shopjane.com.au", sales: "20k-50k" };
    await db.callBooking.createMany({ data: [{ ...call, createdAt: new Date(now.getTime() - 25 * 30.44 * 86_400_000) }, { ...call, name: "New" }] });
    expect((await purgeOldData(now)).calls).toBe(1);
    expect((await db.callBooking.findMany()).map((c) => c.name)).toEqual(["New"]);
    await db.callBooking.deleteMany({});
  });

  it("clears the scrambled ids after 2 days and keeps the counts", async () => {
    const { purgeOldData } = await import("../app/lib/retention.server");
    const now = new Date();
    const tags = readAdTags(new URLSearchParams({ utm_content: "old" }));
    await stats.saveBookView(tags, "old-visitor", new Date(now.getTime() - 3 * 86_400_000));
    await stats.saveBookView(tags, "new-visitor", now);
    await purgeOldData(now);
    const rows = await db.bookEvent.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.visitor)).toEqual([null, "new-visitor"]);
  });

  it("signs in with the admin password for 30 days and opens the admin area", async () => {
    process.env.GEO_ADMIN_PASSWORD = "purple-ticket-river";
    const call = (fields: Record<string, string>) => admin.action({ request: post("/admin", fields, { "x-real-ip": "203.0.113.30" }), params: {}, context: {} } as unknown as ActionFunctionArgs);
    expect(await call({ password: "12345" })).toEqual({ error: "That’s not the password. Please try again." });
    let res: Response | null = null;
    try {
      await call({ password: "purple-ticket-river", next: "/dash/admin/giveaway" });
    } catch (thrown) {
      res = thrown as Response;
    }
    expect(res?.status).toBe(302);
    expect(res?.headers.get("location")).toBe("/dash/admin/giveaway");
    const cookie = res!.headers.get("set-cookie")!;
    expect(cookie).toContain("geo_session=");
    expect(cookie).toContain("Max-Age=2592000");
    expect(await db.user.findUnique({ where: { email: "rossdelport1998@gmail.com" } })).not.toBeNull();
    // somewhere outside the admin area and the agency hub isn't allowed as the next page: the hub opens instead
    try {
      await call({ password: "purple-ticket-river", next: "/dash/sites" });
    } catch (thrown) {
      res = thrown as Response;
    }
    expect(res?.headers.get("location")).toBe("/dash");
    // once signed in, the password page goes straight on
    let again: Response | null = null;
    try {
      await admin.loader({ request: new Request("https://geo.test/admin", { headers: { cookie: cookie.split(";")[0] } }), params: {}, context: {} } as unknown as LoaderFunctionArgs);
    } catch (thrown) {
      again = thrown as Response;
    }
    expect(again?.headers.get("location")).toBe("/dash");
  });
});
