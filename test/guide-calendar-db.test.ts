// The guide calendar against a real Postgres (set TEST_DATABASE_URL), in its own schema, with Claude and Shopify
// faked. Covers: planning the month (the plan's allowance, from the day after tomorrow, one question per day, no
// topic twice in a row), writing a day's guide two days ahead through the fix engine, the store's OK and the
// copy-and-paste "I've added it" step, Done-for-you guides OK'd when written, a draft that doesn't pass, skipping a
// day, and publishing through a Shopify connection.

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_guides_test";
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

const ai = vi.hoisted(() => ({ draft: null as null | Record<string, unknown>, labels: [] as string[] }));
vi.mock("../app/lib/ai.server", () => ({
  askJson: vi.fn(async (opts: { label: string }) => {
    ai.labels.push(opts.label);
    if (opts.label === "claims-check") return { ok: true, problems: [], fixed_text: null };
    if (opts.label === "fix-guide") {
      if (!ai.draft) throw new Error("Claude is down");
      return ai.draft;
    }
    throw new Error(`unexpected AI call ${opts.label}`);
  }),
}));
const shopify = vi.hoisted(() => ({ pages: [] as { title: string; handle: string; body: string }[] }));
vi.mock("../app/shopify.server", () => ({
  authenticate: {},
  unauthenticated: {
    admin: vi.fn(async () => ({
      admin: {
        graphql: async (query: string, opts?: { variables?: { page?: { title: string; handle: string; body: string } } }) => {
          let data: unknown;
          if (query.includes("pageCreate")) {
            shopify.pages.push(opts!.variables!.page!);
            data = { pageCreate: { page: { id: "gid://shopify/Page/9", handle: opts!.variables!.page!.handle }, userErrors: [] } };
          } else if (query.includes("pageUpdate")) data = { pageUpdate: { page: { id: "gid://shopify/Page/9" }, userErrors: [] } };
          else data = { page: null };
          return new Response(JSON.stringify({ data }));
        },
      },
    })),
  },
}));

const GUIDE = {
  question: "What is the best beard oil for dry skin in Australia",
  handle: "Best Beard Oil for Dry Skin",
  short_answer: "A light oil with jojoba or argan suits dry skin. Use a few drops daily. Choose unscented if your skin reacts easily.",
  sections: [
    { question: "What should I look for in a beard oil for dry skin", answer: "Look for jojoba, argan or sweet almond oil, which sit close to the skin's own oils." },
    { question: "How often should I use it?", answer: "Once a day after a shower is enough for most beards." },
    { question: "Does scent matter for dry skin?", answer: "Strong fragrance can bother dry skin, so unscented or lightly scented oils are the safer pick." },
    { question: "How much should I apply?", answer: "Three to five drops for a short beard, a little more as it grows." },
  ],
  picks: [{ product_index: 0, why: "A jojoba based oil made for dry skin." }],
  source_urls: [],
  missing_info: [],
};
const NOW = new Date("2026-10-10T00:00:00Z"); // 11am on Saturday 10 October in Sydney

describe.skipIf(!url)("guide calendar (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let cal: typeof import("../app/lib/guide-calendar.server");
  let jobs: typeof import("../app/lib/jobs.server");
  let plans: typeof import("../app/lib/plans");
  let shopId: string;
  let shop: Awaited<ReturnType<typeof db.shop.findUniqueOrThrow>>;
  const q: Record<string, string> = {};

  // Run the queued job for one day (jobs are keyed "guide-write:<day id>" / "guide-publish:<day id>").
  const runJob = async (type: string, slotId: string) => {
    const job = await db.job.findUniqueOrThrow({ where: { dedupeKey: `${type.replace(".", "-")}:${slotId}` } });
    expect(job.status).toBe("queued");
    await db.job.update({ where: { id: job.id }, data: { status: "running" } });
    try {
      await jobs.getHandler(type)!(job);
      await jobs.finishJob(job);
    } catch (err) {
      await jobs.finishJob(job, err);
      throw err;
    }
  };

  beforeAll(async () => {
    // The tables straight from schema.prisma: a brand-new schema can't take the migrations in order (Prisma applies
    // folders alphabetically, so "10_" runs before "1_"; production took them one at a time, which works).
    execSync("npx prisma db push --skip-generate --accept-data-loss", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
    cal = await import("../app/lib/guide-calendar.server");
    jobs = await import("../app/lib/jobs.server");
    plans = await import("../app/lib/plans");
    await db.shop.deleteMany({});
    await db.session.deleteMany({});
    await db.job.deleteMany({});
    const created = await db.shop.create({
      data: {
        domain: "stubble-web.myshopify.com",
        name: "Stubble Bros",
        primaryDomain: "stubblebros.com.au",
        plan: "core",
        source: "web",
        onboarding: "done",
        country: "AU",
        profile: { create: { brandName: "Stubble Bros", summary: "Beard oils and balms for men.", category: "men's grooming", audience: "men", pricePoint: "mid" } },
        products: {
          create: [
            { gid: "gid://shopify/Product/1", title: "Stubble Bros Beard Oil", handle: "beard-oil", status: "ACTIVE", productType: "Beard Oil", description: "A jojoba based oil for dry skin, 50ml." },
            { gid: "gid://shopify/Product/2", title: "Cedar Beard Balm", handle: "beard-balm", status: "ACTIVE", productType: "Beard Balm", description: "Shea butter balm." },
            { gid: "gid://shopify/Product/3", title: "Boar Bristle Beard Brush", handle: "beard-brush", status: "ACTIVE", productType: "Brush", description: "Spreads oil evenly." },
          ],
        },
        questions: {
          create: [
            { text: "best beard oil for dry skin australia", volume: 500, cluster: "beard oil" },
            { text: "beard oil vs beard balm", volume: 300, cluster: "beard oil" },
            { text: "best beard balm for coarse hair", volume: 200, cluster: "beard balm" },
            { text: "how to use a beard brush", volume: 150, cluster: "beard brush" },
            { text: "beard oil gift ideas", volume: 100, cluster: "beard oil" },
            { text: "is beard oil worth it", volume: 50, cluster: "beard oil" },
            { text: "old question nobody asks", volume: 900, cluster: "beard oil", active: false },
          ],
        },
      },
    });
    shopId = created.id;
    shop = created;
    for (const row of await db.question.findMany({ where: { shopId } })) q[row.text] = row.id;
  });
  afterAll(async () => {
    await db?.shop.deleteMany({});
    await db?.session.deleteMany({});
    await db?.job.deleteMany({});
    await db?.$disconnect();
  });

  it("plans this month and next from the day after tomorrow, one question per day, no topic twice in a row", async () => {
    expect(await cal.autofillCalendar(shopId, NOW)).toBe(6);
    const slots = await db.guideSlot.findMany({ where: { shopId }, orderBy: { day: "asc" } });
    // Standard: 4 a month on the 4th, 12th, 19th and 27th; the 4th has passed and the 12th is the first day that can
    // still be written two days ahead. November has 4 days but only 3 questions are left.
    expect(slots.filter((s) => s.day.startsWith("2026-10")).map((s) => s.day)).toEqual(["2026-10-12", "2026-10-19", "2026-10-27"]);
    expect(slots.filter((s) => s.day.startsWith("2026-11")).map((s) => s.day)).toEqual(["2026-11-04", "2026-11-11", "2026-11-19"]);
    expect(slots.slice(0, 4).map((s) => s.questionId)).toEqual([
      q["best beard oil for dry skin australia"],
      q["best beard balm for coarse hair"],
      q["beard oil vs beard balm"],
      q["how to use a beard brush"],
    ]);
    expect(slots.map((s) => s.questionId)).not.toContain(q["old question nobody asks"]);
    expect(new Set(slots.map((s) => s.questionId)).size).toBe(6);
    // Running it again adds nothing.
    expect(await cal.autofillCalendar(shopId, NOW)).toBe(0);
  });

  it("does nothing for Shopify app stores, free plans or stores still being set up", async () => {
    const plan = plans.getPlan("core");
    expect(cal.calendarOn({ source: "shopify", status: "installed", onboarding: "done" }, plan)).toBe(false);
    expect(cal.calendarOn({ source: "web", status: "installed", onboarding: "done" }, plans.getPlan("free"))).toBe(false);
    expect(cal.calendarOn({ source: "web", status: "installed", onboarding: "scanning" }, plan)).toBe(false);
    expect(cal.calendarOn({ source: "web", status: "installed", onboarding: "done" }, plan)).toBe(true);
  });

  it("queues the writing of a day's guide two days before, through the fix engine, and waits for the store's OK", async () => {
    await cal.queueGuideWork(shop, plans.getPlan("core"), NOW, { force: true });
    const queued = await db.job.findMany({ where: { type: "guide.write" } });
    const oct12 = await db.guideSlot.findFirstOrThrow({ where: { shopId, day: "2026-10-12" } });
    expect(queued.map((j) => (j.payload as { slotId: string }).slotId)).toEqual([oct12.id]); // the 19th is not due yet

    ai.draft = GUIDE;
    await runJob("guide.write", oct12.id);
    const slot = await db.guideSlot.findUniqueOrThrow({ where: { id: oct12.id }, include: { fix: true } });
    expect(slot.status).toBe("ready");
    expect(slot.approvedAt).toBeNull(); // Standard: the store OKs it
    expect(slot.fix).toMatchObject({ type: "guide_page", status: "pending", cluster: "beard oil", hubFixId: null, questionIds: [q["best beard oil for dry skin australia"], q["beard oil vs beard balm"], q["beard oil gift ideas"]] });
    const after = slot.fix!.after as { title: string; handle: string; bodyHtml: string; kind: string };
    expect(after.title).toBe("What is the best beard oil for dry skin in Australia?");
    expect(after.handle).toBe("best-beard-oil-for-dry-skin");
    expect(after.kind).toBe("how-to-choose"); // the first guide on a topic is its overview
    expect(after.bodyHtml).toContain("Stubble Bros Beard Oil"); // the product that fits the question came first in the list
    expect(after.bodyHtml).toContain("utm_medium=ai-guide");
    expect(slot.fix!.reason).toContain("On your guide calendar for Mon 12 Oct");
    expect(ai.labels).toEqual(["fix-guide", "claims-check"]);

    const view = await cal.slotView(shop, oct12.id, NOW);
    expect(view).toMatchObject({ state: "needs-ok", title: after.title, kind: "how-to-choose", question: { text: "best beard oil for dry skin australia", volume: 500 } });
    expect((await cal.monthView(shop, "2026-10", NOW)).slots.map((s) => s.state)).toEqual(["needs-ok", "planned", "planned"]);
    expect(await cal.slotView(shop, "nope", NOW)).toBeNull();
  });

  it("after the OK, the day shows the copy and paste step and 'I've added it' makes it live", async () => {
    const oct12 = await db.guideSlot.findFirstOrThrow({ where: { shopId, day: "2026-10-12" } });
    await cal.approveSlot(shopId, oct12.id);
    const onTheDay = new Date("2026-10-12T00:00:00Z");
    expect((await cal.slotView(shop, oct12.id, NOW))!.state).toBe("scheduled");
    expect((await cal.slotView(shop, oct12.id, onTheDay))!.state).toBe("add"); // no Shopify connection: the store pastes it in
    // No publish job without a connection, even on the day.
    await cal.queueGuideWork(shop, plans.getPlan("core"), onTheDay, { force: true });
    expect(await db.job.count({ where: { type: "guide.publish" } })).toBe(0);

    await cal.markAdded(shopId, oct12.id, "http://not-their-site.com/pages/x"); // an address that isn't theirs is ignored
    const slot = await db.guideSlot.findUniqueOrThrow({ where: { id: oct12.id }, include: { fix: true } });
    expect(slot.status).toBe("published");
    expect(slot.publishedAt).not.toBeNull();
    expect(slot.fix).toMatchObject({ status: "applied", resultUrl: "https://stubblebros.com.au/pages/best-beard-oil-for-dry-skin" });
    expect((await cal.slotView(shop, oct12.id, onTheDay))!.state).toBe("live");
    await expect(cal.skipSlot(shopId, oct12.id)).rejects.toThrow(/already live/);
    // Nobody else's calendar.
    await expect(cal.approveSlot("other-shop", oct12.id)).rejects.toThrow(/isn’t on your calendar/);
  });

  it("Done-for-you guides are OK'd when written, a draft that doesn't pass is tried later, and a skipped day frees its question", async () => {
    await db.shop.update({ where: { id: shopId }, data: { plan: "pro" } });
    const brush = await db.guideSlot.create({ data: { shopId, day: "2026-10-13", questionId: q["how to use a beard brush"], cluster: "beard brush" } });
    await db.guideSlot.deleteMany({ where: { shopId, day: "2026-11-04" } }); // the brush question was planned there
    ai.draft = { ...GUIDE, question: "How do I use a beard brush", handle: "how-to-use-a-beard-brush", picks: [{ product_index: 0, why: "Boar bristles spread oil evenly." }] };
    await jobs.enqueue("guide.write", { slotId: brush.id }, { shopId, dedupeKey: `guide-write:${brush.id}` });
    await runJob("guide.write", brush.id);
    const written = await db.guideSlot.findUniqueOrThrow({ where: { id: brush.id }, include: { fix: true } });
    expect(written.status).toBe("ready");
    expect(written.approvedAt).not.toBeNull(); // written and published for you
    expect((written.fix!.after as { bodyHtml: string }).bodyHtml).toContain("Boar Bristle Beard Brush");

    // A draft with too few sections is set aside; the day waits for another try (no job failure, so no retry storm).
    await db.guideSlot.deleteMany({ where: { shopId, day: "2026-11-11" } }); // the gift question was planned there
    const gift = await db.guideSlot.create({ data: { shopId, day: "2026-10-14", questionId: q["beard oil gift ideas"], cluster: "beard oil" } });
    ai.draft = { ...GUIDE, sections: GUIDE.sections.slice(0, 1) };
    await jobs.enqueue("guide.write", { slotId: gift.id }, { shopId, dedupeKey: `guide-write:${gift.id}` });
    await runJob("guide.write", gift.id);
    let failed = await db.guideSlot.findUniqueOrThrow({ where: { id: gift.id } });
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("didn’t pass our checks");
    expect((await cal.slotView(shop, gift.id, NOW))!.state).toBe("failed");
    // Claude being down is a job failure: recorded on the day and retried by the queue.
    await cal.retrySlot(shopId, gift.id);
    ai.draft = null;
    await expect(runJob("guide.write", gift.id)).rejects.toThrow(/Claude is down/);
    failed = await db.guideSlot.findUniqueOrThrow({ where: { id: gift.id } });
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("Something went wrong");

    // A day can't be skipped while its guide is being written; afterwards, skipping sets the guide aside and deletes
    // the day, and the question is free for another day.
    await db.guideSlot.update({ where: { id: brush.id }, data: { status: "writing" } });
    await expect(cal.skipSlot(shopId, brush.id)).rejects.toThrow(/being written right now/);
    await db.guideSlot.update({ where: { id: brush.id }, data: { status: "ready" } });
    await cal.skipSlot(shopId, brush.id);
    expect(await db.guideSlot.findUnique({ where: { id: brush.id } })).toBeNull();
    expect((await db.fix.findUniqueOrThrow({ where: { id: written.fixId! } })).status).toBe("rejected");
    const before = await db.guideSlot.count({ where: { shopId } });
    const made = await cal.autofillCalendar(shopId, NOW);
    expect(made).toBeGreaterThan(0);
    const slots = await db.guideSlot.findMany({ where: { shopId } });
    expect(slots).toHaveLength(before + made);
    expect(new Set(slots.map((s) => s.questionId)).size).toBe(slots.length);
    expect(slots.some((s) => s.questionId === q["how to use a beard brush"] && s.day >= "2026-10-12")).toBe(true);
  });

  it("publishes through the Shopify connection on the day, from 8am on the store's clock", async () => {
    await db.session.create({ data: { id: "offline_stubble-web.myshopify.com", shop: "stubble-web.myshopify.com", state: "", isOnline: false, accessToken: "shpat_test" } });
    // The owner installing the app is not this account's connection: the account has to have connected it itself.
    expect(await cal.shopifyConnected(shop)).toBe(false);
    shop = await db.shop.update({ where: { id: shopId }, data: { shopifyConnectedAt: new Date() } });
    expect(await cal.shopifyConnected(shop)).toBe(true);
    await db.guideSlot.deleteMany({ where: { shopId, day: "2026-11-19" } }); // that question was planned there
    const slot = await db.guideSlot.create({ data: { shopId, day: "2026-10-15", questionId: q["is beard oil worth it"], cluster: "beard oil" } });
    ai.draft = { ...GUIDE, question: "Is beard oil worth it", handle: "is-beard-oil-worth-it" };
    await jobs.enqueue("guide.write", { slotId: slot.id }, { shopId, dedupeKey: `guide-write:${slot.id}` });
    await runJob("guide.write", slot.id);

    const night = new Date("2026-10-14T18:00:00Z"); // 5am on the 15th in Sydney: too early
    await cal.queueGuideWork(shop, plans.getPlan("pro"), night, { force: true });
    expect(await db.job.count({ where: { type: "guide.publish" } })).toBe(0);
    // Nor by hand before its day (the page only offers the button on the day, but the server checks too).
    vi.useFakeTimers({ now: new Date("2026-10-13T00:00:00Z"), toFake: ["Date"] });
    await expect(cal.publishSlot(slot.id, shopId)).rejects.toThrow(/goes live on Thursday 15 October/);
    vi.useRealTimers();
    const morning = new Date("2026-10-14T22:30:00Z"); // 9:30am on the 15th
    await cal.queueGuideWork(shop, plans.getPlan("pro"), morning, { force: true });
    expect(await db.job.count({ where: { type: "guide.publish", status: "queued" } })).toBe(1);
    expect((await cal.slotView(shop, slot.id, morning))!.state).toBe("scheduled"); // Shopify will do it, not the store

    await runJob("guide.publish", slot.id);
    const live = await db.guideSlot.findUniqueOrThrow({ where: { id: slot.id }, include: { fix: true } });
    expect(live.status).toBe("published");
    expect(live.fix).toMatchObject({ status: "applied", resultGid: "gid://shopify/Page/9", resultUrl: "https://stubblebros.com.au/pages/is-beard-oil-worth-it" });
    expect(shopify.pages).toHaveLength(1);
    expect(shopify.pages[0].title).toBe("Is beard oil worth it?");
    expect(shopify.pages[0].body).toContain("Part of our guide"); // links back to the live overview guide on this topic
    expect(shopify.pages[0].body).toContain("https://stubblebros.com.au/pages/best-beard-oil-for-dry-skin");
    await expect(cal.publishSlot(slot.id, "other-shop")).rejects.toThrow();
  });
});
