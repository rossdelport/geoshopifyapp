// The agency hub against a real Postgres (set TEST_DATABASE_URL), in its own schema, with reading stores from the web
// faked. Covers: adding a client (a new store, a store already on FirstPicked, twice, a wrong address), pausing and
// starting the work again (the plan follows), changing details, Ross's own work log entries, the work log built from
// the work itself, the brand cards and their alerts, the hub's own buttons, and deleting a client.

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_agency_hub_test";
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

// Reading a store from its own address goes to the web: fake the stores it knows.
const web = vi.hoisted(() => ({
  stores: {
    "peacelily.com.au": { myshopifyDomain: "peace-lily.myshopify.com", host: "peacelily.com.au", name: "Peace Lily", country: "AU", currency: "AUD" },
    "selfserve.com.au": { myshopifyDomain: "self-serve.myshopify.com", host: "selfserve.com.au", name: "Self Serve", country: "AU", currency: "AUD" },
  } as Record<string, unknown>,
}));
vi.mock("../app/lib/public-catalog.server", async (original) => ({
  ...(await original<typeof import("../app/lib/public-catalog.server")>()),
  findShopifyStore: vi.fn(async (host: string) => web.stores[host.replace(/^www\./, "")] ?? null), // like following the store's redirect
}));

const BY = "rossdelport1998@gmail.com";
const input = (over: Record<string, unknown> = {}) => ({
  name: null,
  contactName: "Jess",
  email: "jess@peacelily.com.au",
  phone: "0412 555 019",
  feeAud: 945,
  startedOn: "2026-11-05",
  status: "active" as const,
  notes: "Likes email",
  ...over,
});

describe.skipIf(!url)("the agency hub (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let clients: typeof import("../app/lib/clients.server");
  let hub: typeof import("../app/lib/hub.server");
  let log: typeof import("../app/lib/work-log.server");
  let STORE_ERRORS: typeof import("../app/lib/public-catalog.server").STORE_ERRORS;
  let peaceId = "";
  let selfId = "";

  beforeAll(async () => {
    if (new URL(url!).searchParams.get("schema") !== SCHEMA) throw new Error("expected the agency hub test schema");
    // The tables straight from schema.prisma, in this test's own schema (see guide-calendar-db.test.ts for why not the migrations).
    execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
    await db.shop.deleteMany({}); // everything made for a store goes with it
    await db.user.deleteMany({});
    await db.job.deleteMany({});
    clients = await import("../app/lib/clients.server");
    hub = await import("../app/lib/hub.server");
    log = await import("../app/lib/work-log.server");
    STORE_ERRORS = (await import("../app/lib/public-catalog.server")).STORE_ERRORS;
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("adds a new store as a client: no login of its own, on Done for you, setting up", async () => {
    const added = await clients.addClient("https://www.PeaceLily.com.au/collections/all", input({ name: "Peace Lily Botanics" }), BY);
    expect(added.ok).toBe(true);
    peaceId = added.ok ? added.shopId : "";
    const shop = await db.shop.findUniqueOrThrow({ where: { id: peaceId }, include: { client: true } });
    expect(shop).toMatchObject({ domain: "peace-lily.myshopify.com", primaryDomain: "peacelily.com.au", name: "Peace Lily Botanics", source: "web", userId: null, plan: "pro", onboarding: "new" });
    expect(shop.client).toMatchObject({ status: "active", contactName: "Jess", feeAud: 945, startedOn: "2026-11-05", notes: "Likes email" });
    expect(await db.job.count({ where: { shopId: peaceId, type: "onboard", status: "queued" } })).toBe(1);
    // The founder email is for Done-for-you changes Ross didn't make himself.
    expect(await db.job.count({ where: { type: "founder.notice" } })).toBe(0);
  });

  it("won't add the same client twice, or a store it can't read", async () => {
    expect(await clients.addClient("peacelily.com.au", input(), BY)).toEqual({ ok: false, error: "That store is already one of your clients." });
    expect(await clients.addClient("not a web address", input(), BY)).toEqual({ ok: false, error: "Please type their store’s website, like theirstore.com.au." });
    expect(await clients.addClient("unknown.com.au", input(), BY)).toEqual({ ok: false, error: STORE_ERRORS.notShopify });
    expect(await db.client.count()).toBe(1);
  });

  it("makes a store already on FirstPicked a client as it is, keeping its owner", async () => {
    const owner = await db.user.create({ data: { email: "owner@selfserve.com.au" } });
    const shop = await db.shop.create({ data: { domain: "self-serve.myshopify.com", primaryDomain: "selfserve.com.au", name: "Self Serve", source: "web", userId: owner.id, onboarding: "done" } });
    selfId = shop.id;
    const added = await clients.addClient("selfserve.com.au", input({ status: "paused", email: null }), BY);
    expect(added).toEqual({ ok: true, shopId: selfId });
    expect(await db.shop.findUniqueOrThrow({ where: { id: selfId } })).toMatchObject({ userId: owner.id, plan: "free", name: "Self Serve" });
    expect(await db.job.count({ where: { shopId: selfId, type: "onboard" } })).toBe(0); // already set up
    expect(await db.workNote.findMany({ where: { shopId: selfId }, select: { kind: true, text: true } })).toEqual([{ kind: "status", text: "Paused the work" }]);
  });

  it("pauses and starts the work again, and the plan follows", async () => {
    expect(await clients.setClientStatus(peaceId, "paused", BY)).toBe(true);
    expect(await clients.setClientStatus(peaceId, "paused", BY)).toBe(false);
    expect((await db.shop.findUniqueOrThrow({ where: { id: peaceId } })).plan).toBe("free");
    expect(await clients.setClientStatus(peaceId, "active", BY)).toBe(true);
    expect((await db.shop.findUniqueOrThrow({ where: { id: peaceId } })).plan).toBe("pro");
    const notes = await db.workNote.findMany({ where: { shopId: peaceId }, orderBy: { createdAt: "asc" }, select: { kind: true, text: true } });
    expect(notes).toEqual([
      { kind: "status", text: "Paused the work" },
      { kind: "status", text: "Started the work again" },
    ]);
  });

  it("changes a client's details, name and status together", async () => {
    await clients.updateClient(peaceId, input({ name: "Peace Lily Co", feeAud: 800, status: "ended", notes: null }), BY);
    const shop = await db.shop.findUniqueOrThrow({ where: { id: peaceId }, include: { client: true } });
    expect(shop.name).toBe("Peace Lily Co");
    expect(shop.plan).toBe("free");
    expect(shop.client).toMatchObject({ feeAud: 800, status: "ended", notes: null });
    await clients.updateClient(peaceId, input({ name: null, status: "active" }), BY);
    expect(await db.shop.findUniqueOrThrow({ where: { id: peaceId } })).toMatchObject({ name: "Peace Lily Co", plan: "pro" });
  });

  it("keeps Ross's own work log entries, and only lets him delete his own", async () => {
    const now = new Date("2026-11-05T04:00:00Z"); // midday Perth
    const change = await clients.addWorkNote(peaceId, "change", "Rewrote 6 product pages", "2026-11-05", BY, now);
    const call = await clients.addWorkNote(peaceId, "call", "Kick-off call", "2026-11-04", BY, now);
    expect(change.doneAt).toEqual(now);
    expect(call.doneAt.toISOString()).toBe("2026-11-04T04:00:00.000Z");
    const status = await db.workNote.findFirstOrThrow({ where: { shopId: peaceId, kind: "status" } });
    expect(await clients.deleteWorkNote(peaceId, status.id)).toBe(false);
    expect(await clients.deleteWorkNote(selfId, call.id)).toBe(false); // another client's address
    expect(await clients.deleteWorkNote(peaceId, call.id)).toBe(true);
    expect(await clients.deleteWorkNote(peaceId, call.id)).toBe(false);
  });

  it("builds the work log from the work itself and Ross's entries", async () => {
    // Pin the times the database stamped when the client was added and paused (otherwise: whenever the test runs).
    await db.client.update({ where: { shopId: peaceId }, data: { createdAt: new Date("2026-11-04T23:00:00Z") } }); // 7am on the 5th, Perth
    await db.workNote.updateMany({ where: { shopId: peaceId, kind: "status" }, data: { doneAt: new Date("2026-11-01T02:00:00Z") } });
    const q = await db.question.create({ data: { shopId: peaceId, text: "best indoor plants for low light", volume: 900 } });
    const fix = await db.fix.create({ data: { shopId: peaceId, type: "guide_page", targetTitle: "Indoor plants for low light", after: {}, reason: "", status: "applied", resultUrl: "https://peacelily.com.au/pages/low-light", createdAt: new Date("2026-11-05T01:00:00Z") } });
    await db.guideSlot.create({ data: { shopId: peaceId, day: "2026-11-05", questionId: q.id, status: "published", fixId: fix.id, approvedAt: new Date("2026-11-05T01:00:00Z"), publishedAt: new Date("2026-11-05T02:00:00Z") } });
    const scan = await db.scan.create({ data: { shopId: peaceId, kind: "daily", status: "done", engines: ["chatgpt", "gemini"], runs: 1, total: 2, done: 2, score: 31.4, startedAt: new Date("2026-11-04T21:00:00Z"), finishedAt: new Date("2026-11-04T21:30:00Z") } });
    await db.visibilitySnapshot.create({ data: { shopId: peaceId, scanId: scan.id, score: 31.4, byEngine: {}, date: new Date("2026-11-04T21:30:00Z") } });
    await db.aiOrder.create({ data: { shopId: peaceId, orderGid: "o1", orderName: "#1001", engine: "chatgpt", reason: "", revenue: 120, currency: "AUD", orderedAt: new Date("2026-11-05T03:00:00Z") } });
    await db.redditThread.createMany({
      data: [1, 2].map((i) => ({ shopId: peaceId, postId: `p${i}`, url: `https://reddit.com/r/x/${i}`, subreddit: "x", title: `Thread ${i}`, createdAt: new Date("2026-11-05T00:30:00Z") })),
    });
    const entries = await log.workLog([peaceId], "2026-11-05", "2026-11-05");
    expect(entries.map((e) => e.kind).sort()).toEqual(["change", "check", "client", "guide-live", "guide-written", "reddit-found", "sale"]);
    expect(entries.find((e) => e.kind === "client")?.text).toBe("Became a client");
    expect(entries.find((e) => e.kind === "guide-live")).toMatchObject({ text: "Guide live on their store: Indoor plants for low light", href: "https://peacelily.com.au/pages/low-light" });
    expect(entries.find((e) => e.kind === "check")?.text).toBe("Checked 1 buying question on 2 AI assistants. Score 31.");
    expect(entries.find((e) => e.kind === "reddit-found")?.text).toBe("Found 2 Reddit threads to reply to, each with a reply drafted");
    expect(entries.find((e) => e.kind === "change")?.noteId).toBeTruthy();
    // Newest first, and nothing from other days or other clients.
    expect(entries.map((e) => e.at)).toEqual([...entries.map((e) => e.at)].sort().reverse());
    expect(await log.workLog([peaceId], "2026-11-06", "2026-11-06")).toEqual([]);
    // The pause and restart show on their own day, as the hub's entries (no delete button).
    const nov1 = await log.workLog([peaceId], "2026-11-01", "2026-11-01");
    expect(nov1.map((e) => [e.kind, e.noteId])).toEqual([
      ["client", undefined],
      ["client", undefined],
      ["client", undefined],
      ["client", undefined],
    ]);
    expect(await log.workLog([], "2026-11-05", "2026-11-05")).toEqual([]);
  });

  it("fills in the brand cards with their numbers and what needs Ross", async () => {
    await db.shop.update({ where: { id: peaceId }, data: { onboarding: "done" } });
    const now = new Date("2026-11-05T05:00:00Z");
    const cards = await hub.clientCards({}, now);
    expect(cards.map((c) => c.shopId)).toEqual([peaceId, selfId]); // active first
    const peace = cards[0];
    expect(peace).toMatchObject({ name: "Peace Lily Co", status: "active", month: 1, score: 31, tracking: false, sales: { revenue: 120, orders: 1, visits: 0 } });
    expect(peace.week).toMatchObject({ guidesWritten: 1, guidesLive: 1, checks: 1, reddit: 2, changes: 1 });
    expect(peace.alerts.map((a) => a.key)).toEqual(["tracking"]);
    expect(peace.health).toBe("warn");
    expect(cards[1]).toMatchObject({ status: "paused", health: "off", alerts: [] });
    expect(await hub.clientCard(peaceId, now)).toMatchObject({ shopId: peaceId });
    const menu = await hub.clientMenu();
    expect(menu.map((m) => m.name)).toEqual(["Peace Lily Co", "Self Serve"]);
  });

  it("runs the hub's own buttons only when they make sense", async () => {
    expect(await clients.retryClientSetup(peaceId)).toEqual({ ok: false, error: "This store is already set up." });
    expect(await clients.checkClientNow(selfId)).toEqual({ ok: false, error: "The work is paused. Make them active to check AI again." });
    const check = await clients.checkClientNow(peaceId);
    expect(check.ok).toBe(true);
    expect(await db.scan.count({ where: { shopId: peaceId, kind: "manual" } })).toBe(1);
    expect(await clients.checkClientNow(peaceId)).toEqual({ ok: false, error: "An AI check is already running." });
    expect(await clients.syncClientCatalog(peaceId)).toMatchObject({ ok: true });
    expect(await db.job.count({ where: { shopId: peaceId, type: "catalog.sync" } })).toBe(1);
  });

  it("deletes a client only with the store's address typed, keeping a store that has its own login", async () => {
    expect(await clients.deleteClient(peaceId, "wrong.com.au")).toEqual({ ok: false, error: "Please type peacelily.com.au to delete this client." });
    expect(await clients.deleteClient(selfId, "https://selfserve.com.au/")).toEqual({ ok: true, removed: "client" });
    expect(await db.shop.findUniqueOrThrow({ where: { id: selfId } })).toMatchObject({ plan: "free" });
    expect(await db.client.count({ where: { shopId: selfId } })).toBe(0);
    expect(await clients.deleteClient(peaceId, "PeaceLily.com.au")).toEqual({ ok: true, removed: "store" });
    expect(await db.shop.count({ where: { id: peaceId } })).toBe(0);
    expect(await db.workNote.count({ where: { shopId: peaceId } })).toBe(0);
    expect(await clients.deleteClient(peaceId, "peacelily.com.au")).toEqual({ ok: false, error: "That store isn’t a client." });
  });
});
