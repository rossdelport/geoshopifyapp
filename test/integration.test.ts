/* eslint-disable @typescript-eslint/no-explicit-any -- reads raw third-party JSON of many shapes */
// Full flow against a real Postgres (set TEST_DATABASE_URL), with AI engines and Claude faked.
// Covers: scan job queue, answer parsing, scoring, competitors, fix apply + undo, plan limits.

import { beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}

// Fake AI engines: ChatGPT names us 2nd, Gemini never does.
vi.mock("../app/lib/treg.server", () => ({
  askEngine: vi.fn(async (engine: string, prompt: string) => ({
    provider: `fake.${engine}`,
    products: [],
    text:
      engine === "chatgpt"
        ? `For "${prompt}": 1. Milkman Beard Oil 2. Stubble Bros Beard Oil 3. Bulldog`
        : `For "${prompt}": Milkman and Bulldog are popular.`,
    sources: [
      { url: "https://nestpath.com.au/best-beard-oil-australia", title: "Best beard oil" },
      ...(engine === "chatgpt" ? [{ url: "https://stubblebros.com.au/products/oil", title: "Stubble Bros" }] : []),
    ],
  })),
  keywordVolumes: vi.fn(async () => ({})),
  findAuthorEmail: vi.fn(async () => ({ email: null, name: null })),
}));
// No Claude in tests: parsing falls back to text matching.
vi.mock("../app/lib/ai.server", () => ({
  aiConfigured: () => false,
  askJson: vi.fn(async () => {
    throw new Error("no AI in tests");
  }),
}));
vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));

describe.skipIf(!url)("integration (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let shopId: string;

  beforeAll(async () => {
    db = (await import("../app/db.server")).default;
    await db.$executeRawUnsafe(`TRUNCATE "Shop", "Job", "ApiCost" CASCADE`);
    const shop = await db.shop.create({
      data: {
        domain: "stubble-test.myshopify.com",
        name: "Stubble Bros",
        primaryDomain: "stubblebros.com.au",
        plan: "core",
        onboarding: "scanning",
        profile: {
          create: { brandName: "Stubble Bros", summary: "Beard care", category: "men's grooming", audience: "men", pricePoint: "mid" },
        },
        products: {
          create: [{ gid: "gid://shopify/Product/1", title: "Stubble Bros Beard Oil", handle: "beard-oil", status: "ACTIVE", description: "50ml beard oil" }],
        },
        questions: {
          create: [
            { text: "best beard oil for dry skin australia", volume: 500 },
            { text: "beard oil gift ideas", volume: 100 },
          ],
        },
      },
    });
    shopId = shop.id;
  });

  it("runs a scan end to end through the job queue", async () => {
    const { startScan } = await import("../app/lib/scan.server");
    const jobs = await import("../app/lib/jobs.server");
    const scan = await startScan(shopId, "weekly");
    // core plan: 2 questions x 4 engines x 2 runs
    expect(scan.total).toBe(16);

    const claimed = await jobs.claimJobs(5);
    expect(claimed.map((j) => j.type)).toEqual(["scan.run"]);
    await jobs.getHandler("scan.run")!(claimed[0]);
    await jobs.finishJob(claimed[0]);

    const done = await db.scan.findUniqueOrThrow({ where: { id: scan.id } });
    expect(done.status).toBe("done");
    expect(done.done).toBe(16);
    // chatgpt: named 2nd -> 100; gemini/perplexity/aio: not named, not cited -> 0. Average = 25.
    expect(done.score).toBe(25);

    const snap = await db.visibilitySnapshot.findUniqueOrThrow({ where: { scanId: scan.id } });
    expect(snap.byEngine).toEqual({ chatgpt: 100, gemini: 0, perplexity: 0, aio: 0 });

    const ownCitations = await db.citation.count({ where: { isOwn: true } });
    expect(ownCitations).toBe(4); // chatgpt cites stubblebros.com.au in every run

    const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
    expect(shop.onboarding).toBe("done");
    expect(shop.baselineDate).not.toBeNull();

    // Follow-up jobs were queued for this paid plan.
    const queued = await db.job.findMany({ where: { shopId, status: "queued" } });
    expect(queued.map((j) => j.type).sort()).toEqual(["fixes.generate", "outreach.find"]);

    // A second start while nothing is running creates a new scan; dedupe stops double jobs.
    const again = await jobs.enqueue("fixes.generate", {}, { shopId, dedupeKey: `fixes:${shopId}` });
    expect(again).toBeNull();
  });

  it("applies a product fix and undoes it", async () => {
    const { applyFix, revertFix } = await import("../app/lib/fixes.server");
    const calls: { query: string; variables?: any }[] = [];
    const live = { title: "Stubble Bros Beard Oil", descriptionHtml: "<p>Old</p>", productType: "", seo: { title: "", description: "" }, metafield: null };
    const admin = {
      graphql: async (query: string, opts?: { variables?: any }) => {
        calls.push({ query, variables: opts?.variables });
        const data = query.includes("ProductForFix")
          ? { product: { id: "gid://shopify/Product/1", handle: "beard-oil", onlineStoreUrl: null, ...live } }
          : query.includes("productUpdate")
            ? { productUpdate: { product: { id: "gid://shopify/Product/1" }, userErrors: [] } }
            : { metafieldsDelete: { deletedMetafields: [], userErrors: [] }, metafieldsSet: { metafields: [], userErrors: [] } };
        return new Response(JSON.stringify({ data }));
      },
    };

    const fix = await db.fix.create({
      data: { shopId, type: "product_description", targetGid: "gid://shopify/Product/1", targetTitle: "Stubble Bros Beard Oil", after: { descriptionHtml: "<p>New and clearer</p>" }, reason: "test" },
    });
    const applied = await applyFix(fix.id, admin);
    expect(applied.status).toBe("applied");
    expect((applied.before as any).descriptionHtml).toBe("<p>Old</p>");
    expect(calls.at(-1)!.variables.product).toEqual({ id: "gid://shopify/Product/1", descriptionHtml: "<p>New and clearer</p>" });
    expect((await db.product.findFirstOrThrow({ where: { shopId } })).optimisedAt).not.toBeNull();

    const reverted = await revertFix(fix.id, admin);
    expect(reverted.status).toBe("reverted");
    expect(calls.at(-1)!.variables.product).toEqual({ id: "gid://shopify/Product/1", descriptionHtml: "<p>Old</p>" });

    // FAQ that didn't exist before is deleted on undo.
    const faq = await db.fix.create({
      data: { shopId, type: "product_faq", targetGid: "gid://shopify/Product/1", targetTitle: "x", after: { faq: [{ q: "Q?", a: "A." }] }, reason: "test" },
    });
    await applyFix(faq.id, admin);
    expect(calls.at(-1)!.variables.metafields[0]).toMatchObject({ namespace: "geo", key: "faq", type: "json" });
    await revertFix(faq.id, admin);
    expect(calls.at(-1)!.query).toContain("metafieldsDelete");
  });

  it("blocks fixes beyond the plan's product limit", async () => {
    const { applyFix } = await import("../app/lib/fixes.server");
    await db.shop.update({ where: { id: shopId }, data: { plan: "free" } });
    await db.product.create({ data: { shopId, gid: "gid://shopify/Product/2", title: "Other", handle: "other", status: "ACTIVE" } });
    const fix = await db.fix.create({
      data: { shopId, type: "product_type", targetGid: "gid://shopify/Product/2", targetTitle: "Other", after: { productType: "Beard Oil" }, reason: "test" },
    });
    const admin = { graphql: async () => new Response(JSON.stringify({ data: {} })) };
    await expect(applyFix(fix.id, admin)).rejects.toThrow(/plan covers 0 optimised products/);
    await db.shop.update({ where: { id: shopId }, data: { plan: "core" } });
  });

  it("clears old visit ids and deletes long-uninstalled shops", async () => {
    const { purgeOldData } = await import("../app/lib/retention.server");
    const old = new Date(Date.now() - 120 * 86_400_000);
    await db.aiSession.create({ data: { shopId, engine: "chatgpt", clientKey: "abc", landingUrl: "/old", occurredAt: old } });
    await db.aiSession.create({ data: { shopId, engine: "chatgpt", clientKey: "def", landingUrl: "/new" } });
    const gone = await db.shop.create({
      data: { domain: "gone-test.myshopify.com", status: "uninstalled", uninstalledAt: new Date(Date.now() - 40 * 86_400_000) },
    });
    await purgeOldData();
    const visits = await db.aiSession.findMany({ where: { shopId }, orderBy: { occurredAt: "asc" } });
    expect(visits.map((v) => v.clientKey)).toEqual([null, "def"]);
    expect(await db.shop.findUnique({ where: { id: gone.id } })).toBeNull();
    expect(await db.shop.findUnique({ where: { id: shopId } })).not.toBeNull();
  });

  it("schedules a weekly scan when one is due", async () => {
    const { scheduleDueWork } = await import("../app/lib/worker.server");
    await db.job.deleteMany({ where: { shopId } });
    await db.shop.update({ where: { id: shopId }, data: { lastScanAt: new Date(Date.now() - 8 * 86_400_000) } });
    await scheduleDueWork();
    const job = await db.job.findFirst({ where: { shopId, type: "scan.start" } });
    expect(job?.payload).toEqual({ kind: "weekly" });
  });

  it("stops a job that dies on every attempt, and claims free checks separately", async () => {
    const jobs = await import("../app/lib/jobs.server");
    await db.job.deleteMany({});
    const old = new Date(Date.now() - 20 * 60_000);
    const dying = await db.job.create({ data: { type: "scan.run", status: "running", attempts: jobs.MAX_ATTEMPTS, lockedAt: old } });
    const stuck = await db.job.create({ data: { type: "scan.run", status: "running", attempts: 1, lockedAt: old } });
    await jobs.requeueStuckJobs();
    expect((await db.job.findUniqueOrThrow({ where: { id: dying.id } })).status).toBe("failed");
    expect((await db.job.findUniqueOrThrow({ where: { id: stuck.id } })).status).toBe("queued");

    await db.job.create({ data: { type: "check.run" } });
    expect((await jobs.claimJobs(5, { notTypes: ["check.run"] })).map((j) => j.type)).toEqual(["scan.run"]);
    expect((await jobs.claimJobs(5, { types: ["check.run"] })).map((j) => j.type)).toEqual(["check.run"]);
    await db.job.deleteMany({});
  });
});
