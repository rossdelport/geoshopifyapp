// The free Google Maps check at rankwithross.com.au/visibility (Ross, 25 Nov 2026), server side (app/lib/heatmap.server.ts):
// saving everyone who uses it, finding their business, "Which one is yours?", the limits, the 49 searches, a business
// that hides its address, and Ross's email. The database, Treg (Google Maps) and the email sender are stand-ins: no
// network, no database.

import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown> & { id: string; status: string; createdAt: Date; updatedAt: Date };

const h = vi.hoisted(() => {
  process.env.GEO_ALERT_EMAIL = "ross@geo.test";
  process.env.CHECK_IP_SECRET = "test-secret";
  return {
    rows: [] as Record<string, unknown>[],
    spend: 0,
    queued: [] as { type: string; payload: Record<string, unknown>; opts: Record<string, unknown> }[],
    handlers: new Map<string, (job: Record<string, unknown>) => Promise<void>>(),
    emails: [] as { to: string[]; subject: string; html: string; key?: string }[],
    emailFails: false,
    places: null as unknown,
    info: null as unknown,
    spot: (_keyword: string, _where: string): unknown => null,
    calls: [] as { endpoint: string; body: unknown }[],
  };
});

/** Does a saved row fit a Prisma-style `where`? Only the shapes this code uses. */
function fits(row: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([k, want]) => {
    const have = row[k];
    if (want === null || typeof want !== "object" || want instanceof Date) return have === want;
    const w = want as Record<string, unknown>;
    if ("in" in w) return (w.in as unknown[]).includes(have);
    if ("gte" in w) return have instanceof Date && have.getTime() >= (w.gte as Date).getTime();
    if ("lt" in w) return have instanceof Date && have.getTime() < (w.lt as Date).getTime();
    if ("not" in w) return have !== w.not;
    return false;
  });
}

vi.mock("../app/db.server", async () => {
  const { Prisma } = await import("@prisma/client");
  // Prisma's "set this JSON column to NULL" marker is a plain null in the stand-in.
  const plain = (data: Record<string, unknown>) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v === Prisma.DbNull ? null : v]));
  let n = 0;
  const table = {
    count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => h.rows.filter((r) => fits(r, where)).length),
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => [...h.rows].reverse().find((r) => fits(r, where)) ?? null),
    findUnique: vi.fn(async ({ where }: { where: { id: string } }) => h.rows.find((r) => r.id === where.id) ?? null),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const now = new Date();
      const row = {
        cid: null, placeId: null, business: null, address: null, category: null, rating: null, reviews: null, lat: null, lng: null, points: null, done: 0,
        top3: null, found: null, avgRank: null, rivals: null, startedAt: null, finishedAt: null,
        ...plain(data),
        id: `check${String(++n).padStart(4, "0")}`,
        createdAt: now,
        updatedAt: now,
      };
      h.rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const row = h.rows.find((r) => r.id === where.id);
      if (!row) throw new Error("no such row");
      Object.assign(row, plain(data), { updatedAt: new Date() });
      return row;
    }),
  };
  return { default: { heatmapCheck: table, apiCost: { aggregate: vi.fn(async () => ({ _sum: { usd: h.spend } })) } } };
});
vi.mock("../app/lib/jobs.server", () => ({
  MAX_ATTEMPTS: 4,
  registerJob: (type: string, fn: (job: Record<string, unknown>) => Promise<void>) => h.handlers.set(type, fn),
  enqueue: vi.fn(async (type: string, payload: Record<string, unknown>, opts: Record<string, unknown> = {}) => {
    h.queued.push({ type, payload, opts });
    return null;
  }),
}));
vi.mock("../app/lib/email.server", () => ({
  emailConfigured: () => true,
  sendEmail: vi.fn(async (to: string[], subject: string, html: string, _shop?: string, key?: string) => {
    if (h.emailFails) throw new Error("Resend 500");
    h.emails.push({ to, subject, html, key });
  }),
}));
vi.mock("../app/lib/treg.server", () => ({
  tregCall: vi.fn(async (endpoint: string, opts: { body: unknown }) => {
    h.calls.push({ endpoint, body: opts.body });
    if (endpoint === "serper.google.serp.places") {
      if (h.places instanceof Error) throw h.places;
      return h.places;
    }
    if (endpoint === "dataforseo.x.business-data-google-my-business-info-live") {
      if (!h.info) throw new Error("no answer");
      return h.info;
    }
    const task = (opts.body as { keyword: string; location_coordinate: string }[])[0];
    const out = h.spot(task.keyword, task.location_coordinate);
    if (out instanceof Error) throw out;
    return out;
  }),
}));

import { getPublicCheck, heatmapNoticeEmail, pickBusiness, rerunCheck, runCheck, startCheck, type StartInput } from "../app/lib/heatmap.server";
import { HEATMAP_CONSENT, HEATMAP_ERRORS } from "../app/lib/heatmap";

const NO_AD = { utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, fbclid: false, referrer: null };
const PSPC = { title: "Perth Solar Panel Cleaners", address: "237 Adelaide Terrace, East Perth WA 6000", latitude: -31.958584, longitude: 115.86664, rating: 5, ratingCount: 37, category: "House cleaning service", cid: "111" };
const OTHER = { title: "Perth Solar Panel Cleaning", address: "123 Adelaide Terrace, Perth WA 6000", latitude: -31.960388, longitude: 115.87303, rating: 4.5, ratingCount: 4, category: "Cleaning service", cid: "222" };
const HIDDEN = { title: "A1 Solar Cleaning", rating: 5, ratingCount: 143, category: "Window cleaning service", cid: "333" };

const input = (over: Partial<StartInput> = {}): StartInput => ({
  firstName: "Sam",
  phone: "0400 123 456",
  business: "Perth Solar Panel Cleaners",
  keyword: "Solar panel cleaning",
  honeypot: "",
  ad: { ...NO_AD, utmCampaign: "RWR maps", utmContent: "video 1", fbclid: true },
  ip: "1.2.3.4",
  ...over,
});

/** Google's answer at a spot: the business comes `rank`th (0: not listed) behind rivals R1, R2... */
function answer(rank: number, cid = "111") {
  const items = Array.from({ length: 20 }, (_, i) => ({ type: "maps_search", title: `Rival ${i + 1}`, cid: `r${i + 1}`, place_id: `rp${i + 1}`, rating: { value: 4.6, votes_count: 100 - i } }));
  if (rank) items.splice(rank - 1, 0, { type: "maps_search", title: "The business", cid, place_id: "own", rating: { value: 5, votes_count: 37 } });
  return { tasks: [{ status_code: 20000, result: [{ items }] }] };
}

const row = (id: string) => h.rows.find((r) => r.id === id) as Row;

beforeEach(() => {
  h.rows.length = 0;
  h.queued.length = 0;
  h.emails.length = 0;
  h.calls.length = 0;
  h.spend = 0;
  h.emailFails = false;
  h.places = { places: [PSPC, OTHER, HIDDEN] };
  h.info = null;
  h.spot = () => answer(1);
  delete process.env.GEO_HEATMAPS_PER_DAY;
  delete process.env.GEO_HEATMAP_USD_PER_DAY;
});

describe("the form", () => {
  it("saves the person, finds their business and queues the 49 searches", async () => {
    const out = await startCheck(input());
    expect(out.status).toBe(200);
    expect(out.result).toMatchObject({ ok: true, state: "running" });
    const id = (out.result as { id: string }).id;
    expect(row(id)).toMatchObject({
      firstName: "Sam",
      phone: "0400 123 456",
      query: "Perth Solar Panel Cleaners",
      keyword: "solar panel cleaning",
      status: "queued",
      cid: "111",
      business: "Perth Solar Panel Cleaners",
      address: "237 Adelaide Terrace, East Perth WA 6000",
      rating: 5,
      reviews: 37,
      lat: -31.958584,
      lng: 115.86664,
      consentText: HEATMAP_CONSENT,
      utmCampaign: "RWR maps",
      utmContent: "video 1",
      fbclid: true,
      candidates: null,
    });
    expect(row(id).ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row(id).startedAt).toBeInstanceOf(Date);
    // Google was asked for the name typed, in Australia
    expect(h.calls).toEqual([{ endpoint: "serper.google.serp.places", body: { q: "Perth Solar Panel Cleaners", gl: "au", hl: "en" } }]);
    // the map job, and Ross's "didn't finish" email 10 minutes later in case it never ends
    expect(h.queued.map((q) => q.type)).toEqual(["heatmap.notice", "heatmap.run"]);
    expect(h.queued[1]).toMatchObject({ payload: { id }, opts: { dedupeKey: `heatmap:${id}` } });
    const later = (h.queued[0].opts.runAfter as Date).getTime() - Date.now();
    expect(later).toBeGreaterThan(9 * 60_000);
    expect(later).toBeLessThan(11 * 60_000);
  });

  it("says which box is wrong and saves nothing", async () => {
    for (const [over, error, field] of [
      [{ firstName: " " }, HEATMAP_ERRORS.name, "name"],
      [{ phone: "12" }, HEATMAP_ERRORS.phone, "phone"],
      [{ business: "" }, HEATMAP_ERRORS.business, "business"],
      [{ keyword: "" }, HEATMAP_ERRORS.keyword, "keyword"],
    ] as const) {
      const out = await startCheck(input(over));
      expect(out.status).toBe(422);
      expect(out.result).toEqual({ ok: false, error, field });
    }
    expect((await startCheck(input({ honeypot: "http://spam.example" }))).result.ok).toBe(false);
    expect(h.rows).toHaveLength(0);
    expect(h.calls).toHaveLength(0);
  });

  it("asks which business is theirs when Google has a few, without giving away where they are", async () => {
    const out = await startCheck(input({ business: "solar panel cleaning perth" }));
    expect(out.result).toMatchObject({ ok: true, state: "pick" });
    const r = out.result as { id: string; candidates: Record<string, unknown>[] };
    expect(r.candidates.map((c) => c.name)).toEqual(["Perth Solar Panel Cleaners", "Perth Solar Panel Cleaning", "A1 Solar Cleaning"]);
    expect(r.candidates[2]).toEqual({ cid: "333", name: "A1 Solar Cleaning", address: null, rating: 5, reviews: 143, category: "Window cleaning service" });
    expect(row(r.id).status).toBe("pick");
    expect(h.queued.map((q) => q.type)).toEqual(["heatmap.notice"]);

    // a tap on theirs starts the map
    const picked = await pickBusiness(r.id, "222");
    expect(picked.result).toEqual({ ok: true, state: "running", id: r.id });
    expect(row(r.id)).toMatchObject({ status: "queued", cid: "222", business: "Perth Solar Panel Cleaning", candidates: null });
    // a second tap, a made-up business or a made-up check goes nowhere
    expect((await pickBusiness(r.id, "111")).status).toBe(404);
    expect((await pickBusiness("nope", "111")).result).toEqual({ ok: false, error: HEATMAP_ERRORS.gone });
    expect((await pickBusiness({ evil: 1 }, "111")).status).toBe(404);
  });

  it("keeps someone whose business isn't on Google Maps, so Ross can still call them", async () => {
    h.places = { places: [] };
    const out = await startCheck(input({ business: "Sams Secret Shed" }));
    expect(out.status).toBe(422);
    expect(out.result).toEqual({ ok: false, error: HEATMAP_ERRORS.notFound, field: "business" });
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]).toMatchObject({ status: "nomatch", firstName: "Sam", phone: "0400 123 456", query: "Sams Secret Shed" });

    // they fix the spelling: the same row, not a second person
    h.places = { places: [PSPC] };
    const again = await startCheck(input());
    expect(again.result).toMatchObject({ ok: true, state: "running" });
    expect(h.rows).toHaveLength(1);
    expect(h.rows[0]).toMatchObject({ status: "queued", query: "Perth Solar Panel Cleaners", error: null });
  });

  it("says so when Google Maps doesn't answer", async () => {
    h.places = new Error("timeout");
    const out = await startCheck(input());
    expect(out.status).toBe(502);
    expect(out.result).toEqual({ ok: false, error: HEATMAP_ERRORS.google });
    expect(h.rows[0].status).toBe("nomatch");
  });
});

describe("the limits", () => {
  it("stops one visitor after 8 people and one phone after 4 maps a day", async () => {
    for (let i = 0; i < 4; i++) expect((await startCheck(input({ ip: `9.9.9.${i}` }))).result.ok).toBe(true);
    const fifth = await startCheck(input({ ip: "9.9.9.9" }));
    expect(fifth.status).toBe(429);
    expect(fifth.result).toEqual({ ok: false, error: HEATMAP_ERRORS.tooMany });

    h.rows.length = 0;
    for (let i = 0; i < 8; i++) expect((await startCheck(input({ phone: `0400 000 00${i}`, ip: "7.7.7.7" }))).result.ok).toBe(true);
    expect((await startCheck(input({ phone: "0400 000 009", ip: "7.7.7.7" }))).status).toBe(429);
    expect((await startCheck(input({ phone: "0400 000 009", ip: "8.8.8.8" }))).result.ok).toBe(true);
  });

  it("past the day's budget, keeps the person, tells them Ross will send it and emails Ross", async () => {
    h.spend = 20;
    const out = await startCheck(input());
    expect(out.result).toMatchObject({ ok: true, state: "capped" });
    const id = (out.result as { id: string }).id;
    await vi.waitFor(() => expect(h.emails).toHaveLength(1));
    expect(row(id)).toMatchObject({ status: "capped", business: "Perth Solar Panel Cleaners", startedAt: null });
    expect(h.queued.some((q) => q.type === "heatmap.run")).toBe(false);
    expect(h.emails[0].subject).toBe("Map check waiting for you: Sam, Perth Solar Panel Cleaners");
    expect(h.emails[0].html).toContain("Press Run it in Admin, Map checks.");

    // Ross presses "Run it": no limit applies
    expect(await rerunCheck(id)).toBe(true);
    expect(row(id)).toMatchObject({ status: "queued", emailedAt: null });
    expect(h.queued.at(-1)).toMatchObject({ type: "heatmap.run", payload: { id } });
    expect(await rerunCheck(id)).toBe(false); // already queued
  });

  it("counts maps for everyone together too (GEO_HEATMAPS_PER_DAY)", async () => {
    process.env.GEO_HEATMAPS_PER_DAY = "2";
    expect((await startCheck(input({ phone: "0400 000 001", ip: "1.1.1.1" }))).result).toMatchObject({ state: "running" });
    expect((await startCheck(input({ phone: "0400 000 002", ip: "1.1.1.2" }))).result).toMatchObject({ state: "running" });
    expect((await startCheck(input({ phone: "0400 000 003", ip: "1.1.1.3" }))).result).toMatchObject({ state: "capped" });
  });
});

describe("the 49 searches", () => {
  const start = async (over: Partial<StartInput> = {}) => ((await startCheck(input(over))).result as { id: string }).id;

  it("searches Google Maps from every spot, saves the ranks and emails Ross the result", async () => {
    const id = await start();
    // top 3 in the first 20 spots, 8th in the next 20, not listed in the last 9
    let n = 0;
    h.spot = () => answer(n < 20 ? (n++ % 3) + 1 : n++ < 40 ? 8 : 0);
    h.calls.length = 0;
    await runCheck(id);

    expect(h.calls).toHaveLength(49);
    expect(h.calls.every((c) => c.endpoint === "dataforseo.x.serp-google-maps-live-advanced")).toBe(true);
    const tasks = h.calls.map((c) => (c.body as Record<string, unknown>[])[0]);
    expect(tasks.every((t) => t.keyword === "solar panel cleaning" && t.language_code === "en" && t.depth === 20)).toBe(true);
    expect(new Set(tasks.map((t) => t.location_coordinate)).size).toBe(49);
    expect(tasks.some((t) => t.location_coordinate === "-31.958584,115.866640,13z")).toBe(true); // the business itself

    const r = row(id);
    expect(r).toMatchObject({ status: "done", done: 49, top3: 20, found: 40, error: null });
    expect(r.avgRank).toBeCloseTo((20 * 2 + 20 * 8) / 40, 1);
    expect((r.points as number[]).filter((p) => p >= 1 && p <= 3)).toHaveLength(20);
    expect((r.points as number[]).filter((p) => p === 0)).toHaveLength(9);
    expect((r.rivals as { name: string; spots: number }[])[0]).toMatchObject({ name: "Rival 1", spots: 49 });
    expect(r.finishedAt).toBeInstanceOf(Date);

    expect(h.emails).toHaveLength(1);
    const mail = h.emails[0];
    expect(mail.to).toEqual(["ross@geo.test"]);
    expect(mail.subject).toBe("Map check: Sam from Perth Solar Panel Cleaners, top 3 in 20 of 49 spots");
    expect(mail.html).toContain('<a href="tel:0400123456">0400 123 456</a>');
    expect(mail.html).toContain("Top 3 in 20 of 49 spots, 4 to 10 in 20, 11 to 20 in 0, not in the top 20 in 9.");
    expect(mail.html).toContain(`https://rankwithross.com.au/visibility?r=${id}`);
    expect(mail.html).toContain("<b>Came from:</b> video 1");
    expect(mail.html).toContain("Rival 1 (49 spots)");
    expect(mail.html).not.toContain("—");
    expect(r.emailedAt).toBeInstanceOf(Date);

    // the page gets the map, never who asked
    const seen = await getPublicCheck(id);
    expect(seen).toMatchObject({ status: "done", headline: "You’re in the top 3 in 20 of 49 spots.", business: { name: "Perth Solar Panel Cleaners" } });
    expect(JSON.stringify(seen)).not.toMatch(/Sam|0400/);
    expect(await getPublicCheck("no such id!")).toBeNull();

    // the "didn't finish" email job has nothing left to say
    await h.handlers.get("heatmap.notice")!({ payload: { id }, attempts: 1 });
    expect(h.emails).toHaveLength(1);
    // and a job run twice doesn't search again
    h.calls.length = 0;
    await runCheck(id);
    expect(h.calls).toHaveLength(0);
  });

  it("centres a business that hides its address on a spot rounded to about 1 km", async () => {
    const id = await start({ business: "A1 Solar Cleaning Perth" });
    expect(row(id)).toMatchObject({ cid: "333", address: null, lat: null, lng: null });
    expect((await getPublicCheck(id))?.map).toBeNull();
    h.info = { tasks: [{ status_code: 20000, result: [{ items: [{ latitude: -31.7702884, longitude: 115.9879268, place_id: "own" }] }] }] };
    h.spot = () => answer(2, "333");
    h.calls.length = 0;
    await runCheck(id);
    expect(h.calls[0]).toEqual({ endpoint: "dataforseo.x.business-data-google-my-business-info-live", body: [{ keyword: "cid:333", location_code: 2036, language_code: "en" }] });
    expect(row(id)).toMatchObject({ status: "done", lat: -31.77, lng: 115.99, placeId: "own", top3: 49 });
    expect(h.emails[0].html).toContain("(no street address on Google)");
  });

  it("fails kindly when Google can't place a hidden business, or doesn't answer in too many spots", async () => {
    const hidden = await start({ business: "A1 Solar Cleaning Perth" });
    await runCheck(hidden);
    expect(row(hidden)).toMatchObject({ status: "failed" });
    expect(h.emails[0].subject).toBe("Map check failed: Sam, A1 Solar Cleaning");

    const id = await start({ phone: "0400 222 333" });
    const tried = new Set<string>();
    h.spot = (_k, where) => (tried.has(where) ? answer(1) : (tried.add(where), new Error("timeout"))); // each spot's first try fails
    await runCheck(id);
    expect(row(id)).toMatchObject({ status: "done", top3: 49 }); // every spot answered on its second try

    const bad = await start({ phone: "0400 444 555" });
    h.spot = () => new Error("timeout");
    await runCheck(bad);
    expect(row(bad)).toMatchObject({ status: "failed", error: "Google Maps didn't answer in 49 of 49 spots." });
    expect((row(bad).points as number[]).every((p) => p === -1)).toBe(true);
    expect((await getPublicCheck(bad))?.status).toBe("failed");
  });

  it("the job gives up for good on its last try instead of leaving the map running", async () => {
    const id = await start();
    const run = h.handlers.get("heatmap.run")!;
    const db = (await import("../app/db.server")).default as unknown as { heatmapCheck: { update: ReturnType<typeof vi.fn> } };
    db.heatmapCheck.update.mockRejectedValueOnce(new Error("database blip"));
    await expect(run({ payload: { id }, attempts: 1 })).rejects.toThrow("database blip"); // tried again later
    db.heatmapCheck.update.mockRejectedValueOnce(new Error("database blip"));
    await run({ payload: { id }, attempts: 4 });
    expect(row(id)).toMatchObject({ status: "failed" });
    expect(String(row(id).error)).toContain("database blip");
  });
});

describe("Ross's email", () => {
  it("tells him about someone who never finished, ten minutes on", async () => {
    h.places = { places: [] };
    await startCheck(input({ business: "Sams <b>Secret</b> Shed" }));
    const id = h.rows[0].id as string;
    await h.handlers.get("heatmap.notice")!({ payload: { id }, attempts: 1 });
    expect(h.emails).toHaveLength(1);
    expect(h.emails[0].subject).toBe("Map check: Sam couldn't find “Sams b Secret /b Shed” on Google Maps");
    expect(h.emails[0].html).toContain("They may not have a Google profile yet.");
    expect(h.emails[0].html).not.toContain("<b>Secret</b>");
    expect(h.emails[0].html).not.toContain("Open their map");
  });

  it("is tried again by the queue when the email can't be sent", async () => {
    h.places = { places: [PSPC, OTHER] };
    await startCheck(input({ business: "solar cleaning" }));
    const id = h.rows[0].id as string;
    h.emailFails = true;
    await expect(h.handlers.get("heatmap.notice")!({ payload: { id }, attempts: 1 })).rejects.toThrow("Resend 500");
    expect(row(id).emailedAt).toBeNull();
    h.emailFails = false;
    await h.handlers.get("heatmap.notice")!({ payload: { id }, attempts: 2 });
    expect(h.emails[0].subject).toBe("Map check not finished: Sam, “solar cleaning”");
    expect(row(id).emailedAt).toBeInstanceOf(Date);
  });

  it("never puts what someone typed into the email as HTML", () => {
    const base = {
      id: "x", firstName: "<i>Sam</i>", phone: "0400 123 456", query: "q", keyword: "<script>", status: "done", candidates: null, cid: "1", placeId: null,
      business: "A & B <Plumbing>", address: "1 High St", category: null, rating: 4.9, reviews: 12, lat: 1, lng: 1, points: [1, 2], done: 2, top3: 2, found: 2, avgRank: 1.5,
      rivals: [{ name: "<img>", rating: 5, reviews: 1, spots: 1 }], error: null, consentText: "", utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null,
      fbclid: false, referrer: null, ipHash: null, emailedAt: null, startedAt: null, finishedAt: null, createdAt: new Date("2026-11-25T05:00:00Z"), updatedAt: new Date(),
    };
    const { html } = heatmapNoticeEmail(base as never);
    expect(html).toContain("&lt;i&gt;Sam&lt;/i&gt;");
    expect(html).toContain("A &amp; B &lt;Plumbing&gt;, 1 High St, 4.9 stars from 12 reviews");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img&gt; (1 spot)");
    expect(html).toContain("Wed, 25 Nov, 1:00 pm, Perth time");
    expect(html).toContain("<b>Came from:</b> Not from an ad");
  });
});
