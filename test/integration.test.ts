/* eslint-disable @typescript-eslint/no-explicit-any -- reads raw third-party JSON of many shapes */
// Full flow against a real Postgres (set TEST_DATABASE_URL), with AI engines and Claude faked.
// Covers: scan job queue, answer parsing, scoring, competitors, fix apply + undo, plan limits, plan changes.

import { beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}
process.env.GEO_ALERT_EMAIL = "founder@example.test";

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
vi.mock("../app/lib/email.server", () => ({ emailConfigured: () => true, sendEmail: vi.fn(async () => {}) }));

const DAY = 86_400_000;

describe.skipIf(!url)("integration (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let shopId: string;

  beforeAll(async () => {
    db = (await import("../app/db.server")).default;
    await db.$executeRawUnsafe(`TRUNCATE "Shop", "Job", "ApiCost", "PlanIntent" CASCADE`);
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

  it("writes guide pages only up to the plan's monthly allowance", async () => {
    const { askJson } = await import("../app/lib/ai.server");
    const { generateFixes } = await import("../app/lib/fixes.server");
    const { startOfMonth } = await import("../app/lib/limits");
    const scan = await db.scan.findFirstOrThrow({ where: { shopId, status: "done" }, orderBy: { startedAt: "desc" } });
    // Written this month and skipped by the store: still counts. Written last month: doesn't.
    await db.fix.create({ data: { shopId, type: "guide_page", targetTitle: "Skipped guide", after: {}, reason: "test", status: "rejected" } });
    // One we couldn't publish (our Shopify error): doesn't use up the allowance.
    await db.fix.create({ data: { shopId, type: "guide_page", targetTitle: "Unpublished guide", after: {}, reason: "test", error: "Shopify said no" } });
    await db.fix.create({
      data: { shopId, type: "guide_page", targetTitle: "Old guide", after: {}, reason: "test", status: "applied", createdAt: new Date(startOfMonth().getTime() - DAY) },
    });
    const ai = vi.mocked(askJson);
    ai.mockImplementation((async (opts: any) => {
      if (opts.label === "fix-ideas") {
        return { ideas: [0, 1, 2].map(() => ({ type: "guide_page", product_index: null, question_indexes: [0], reason: "Shoppers ask this", impact: "high" })) };
      }
      if (opts.label === "fix-guide") return { title: "Best beard oil for dry skin", handle: "best-beard-oil", body_html: "<p>Guide</p>", missing_info: [] };
      if (opts.label === "claims-check") return { ok: true, problems: [], fixed_text: null };
      throw new Error(`unexpected AI call ${opts.label}`);
    }) as any);
    try {
      // Standard: 2 a month, 1 used, so 1 of the 3 suggested guides is written.
      expect(await generateFixes(shopId, scan.id)).toBe(1);
      expect(await generateFixes(shopId, scan.id)).toBe(0);
      expect(ai.mock.calls.at(-1)![0].prompt).toContain("no guide_page");
      // Done-for-you: 8 a month, 2 used.
      await db.shop.update({ where: { id: shopId }, data: { plan: "pro" } });
      expect(await generateFixes(shopId, scan.id)).toBe(3);
      expect(await db.fix.count({ where: { shopId, type: "guide_page", createdAt: { gte: startOfMonth() } } })).toBe(6);
    } finally {
      ai.mockImplementation(async () => {
        throw new Error("no AI in tests");
      });
      await db.shop.update({ where: { id: shopId }, data: { plan: "core" } });
      await db.fix.deleteMany({ where: { shopId, type: "guide_page" } });
    }
  });

  it("autopilot runs the claims check, then puts fixes live; softened, flagged or unchecked ones wait", async () => {
    await import("../app/lib/fixes.server");
    const { getHandler } = await import("../app/lib/jobs.server");
    const { unauthenticated } = await import("../app/shopify.server");
    const { askJson } = await import("../app/lib/ai.server");
    const pagesCreated: string[] = [];
    const productUpdates: any[] = [];
    const admin = {
      graphql: async (query: string, opts?: { variables?: any }) => {
        let data: any;
        if (query.includes("pageCreate")) {
          pagesCreated.push(opts?.variables.page.title);
          data = { pageCreate: { page: { id: "gid://shopify/Page/9", handle: "best-beard-oil" }, userErrors: [] } };
        } else if (query.includes("ProductForFix")) {
          data = { product: { id: "gid://shopify/Product/1", title: "Stubble Bros Beard Oil", handle: "beard-oil", descriptionHtml: "<p>Old</p>", productType: "", seo: { title: "", description: "" }, metafield: null, onlineStoreUrl: null } };
        } else if (query.includes("productUpdate")) {
          productUpdates.push(opts?.variables.product);
          data = { productUpdate: { product: { id: "gid://shopify/Product/1" }, userErrors: [] } };
        } else throw new Error(`autopilot made an unexpected call: ${query.slice(0, 60)}`);
        return new Response(JSON.stringify({ data }));
      },
    };
    vi.mocked(unauthenticated.admin).mockResolvedValue({ admin } as any);
    const ai = vi.mocked(askJson);
    const checked: string[] = [];
    ai.mockImplementation((async (opts: any) => {
      if (opts.label !== "claims-check") throw new Error(`unexpected AI call ${opts.label}`);
      checked.push(opts.prompt);
      if (opts.prompt.includes("cures dry skin")) return { ok: false, problems: ["'cures' is a medical claim"], fixed_text: "<p>This oil softens dry skin</p>" };
      if (opts.prompt.includes("Claude is down")) throw new Error("Claude unavailable");
      return { ok: true, problems: [], fixed_text: null };
    }) as any);
    const guide = { title: "Best beard oil", handle: "best-beard-oil", bodyHtml: "<p>Guide</p>" };
    await db.fix.deleteMany({ where: { shopId, status: "pending" } }); // left over from earlier tests
    const mk = (data: any) => db.fix.create({ data: { shopId, reason: "test", targetTitle: "x", ...data } });
    const clean = await mk({ type: "guide_page", targetTitle: "Clean guide", after: guide });
    const flagged = await mk({ type: "guide_page", targetTitle: "Flagged guide", after: guide, missingInfo: "What sizes do you stock?" });
    const description = await mk({ type: "product_description", targetGid: "gid://shopify/Product/1", after: { descriptionHtml: "<p>Clearer</p>" } });
    const claim = await mk({ type: "product_description", targetGid: "gid://shopify/Product/1", after: { descriptionHtml: "<p>This oil cures dry skin</p>" } });
    const unchecked = await mk({ type: "product_seo", targetGid: "gid://shopify/Product/1", after: { seoTitle: "Claude is down", seoDescription: "x" } });
    const ids = [clean.id, flagged.id, description.id, claim.id, unchecked.id];
    const run = () => getHandler("fixes.autopilot")!({ shopId } as any);
    const get = (id: string) => db.fix.findUniqueOrThrow({ where: { id } });
    try {
      // Standard has no autopilot, even if the flag is set.
      await db.shop.update({ where: { id: shopId }, data: { plan: "core", autopilot: true } });
      await run();
      expect(pagesCreated).toEqual([]);
      expect(checked).toEqual([]);

      await db.shop.update({ where: { id: shopId }, data: { plan: "pro", autopilot: true } });
      await run();
      // Live: the guide and the clean description (new descriptions and titles go live on Done-for-you too).
      expect(pagesCreated).toEqual(["Best beard oil"]);
      expect((await get(clean.id)).status).toBe("applied");
      expect((await get(description.id)).status).toBe("applied");
      expect(productUpdates).toEqual([{ id: "gid://shopify/Product/1", descriptionHtml: "<p>Clearer</p>" }]);
      // The check always ran on the text going live, health words or not, and never on a flagged fix.
      expect(checked.some((p) => p.includes("<p>Guide</p>"))).toBe(true);
      expect(checked.some((p) => p.includes("<p>Clearer</p>"))).toBe(true);
      expect(checked).toHaveLength(4);
      // Waiting: the fix that needs facts, the one the check softened (with the softer wording saved and
      // the reason shown), and the one the check couldn't run on (retried next time).
      expect((await get(flagged.id)).status).toBe("pending");
      const softened = await get(claim.id);
      expect(softened.status).toBe("pending");
      expect(softened.after).toEqual({ descriptionHtml: "<p>This oil softens dry skin</p>" });
      expect(softened.missingInfo).toMatch(/softened some wording.*cures/);
      expect(await get(unchecked.id)).toMatchObject({ status: "pending", missingInfo: null });
    } finally {
      vi.mocked(unauthenticated.admin).mockReset();
      ai.mockImplementation(async () => {
        throw new Error("no AI in tests");
      });
      await db.shop.update({ where: { id: shopId }, data: { plan: "core", autopilot: false } });
      await db.fix.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it("keeps writing fixes for an autopilot store with 10 descriptions waiting, and drops ones that would only wait", async () => {
    const { generateFixes } = await import("../app/lib/fixes.server");
    const { askJson } = await import("../app/lib/ai.server");
    const scan = await db.scan.findFirstOrThrow({ where: { shopId, status: "done" }, orderBy: { startedAt: "desc" } });
    const ai = vi.mocked(askJson);
    let ideas: any[] = [];
    let missing: string[] = [];
    ai.mockImplementation((async (opts: any) => {
      if (opts.label === "fix-ideas") return { ideas };
      if (opts.label.startsWith("fix-product_")) {
        return { title: null, description_html: null, seo_title: "Beard oil for dry skin", seo_description: "50ml beard oil.", product_type: "Beard Oil", faq: [{ q: "Size?", a: "50ml." }], missing_info: missing };
      }
      if (opts.label === "fix-guide") return { title: "Beard oil guide", handle: "beard-oil-guide", body_html: "<p>Guide</p>", missing_info: [] };
      if (opts.label === "claims-check") return { ok: true, problems: [], fixed_text: null };
      throw new Error(`unexpected AI call ${opts.label}`);
    }) as any);
    const idea = (type: string, product_index: number | null) => ({ type, product_index, question_indexes: [0], reason: "Shoppers ask this", impact: "high" });
    await db.fix.deleteMany({ where: { shopId } });
    await db.fix.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({ shopId, type: "product_description", targetGid: `gid://shopify/Product/w${i}`, targetTitle: "x", after: {}, reason: "test" })),
    });
    try {
      // Done-for-you with autopilot: the 10 waiting descriptions go live by themselves, so they don't block FAQs or guides.
      await db.shop.update({ where: { id: shopId }, data: { plan: "pro", autopilot: true } });
      ideas = [idea("product_faq", 0), idea("guide_page", null)];
      expect(await generateFixes(shopId, scan.id)).toBe(2);
      // Without autopilot, 12 waiting is a full queue: nothing new until the store catches up.
      await db.shop.update({ where: { id: shopId }, data: { autopilot: false } });
      expect(await generateFixes(shopId, scan.id)).toBe(0);
      // Autopilot again, but 12 fixes now wait on the store (facts missing): a new fix that would also wait is
      // dropped, and one autopilot can put live is still written.
      await db.shop.update({ where: { id: shopId }, data: { autopilot: true } });
      await db.fix.updateMany({ where: { shopId, status: "pending" }, data: { missingInfo: "What size is it?" } });
      ideas = [idea("product_type", 1)];
      missing = ["Is it vegan?"];
      expect(await generateFixes(shopId, scan.id)).toBe(0);
      ideas = [idea("product_seo", 1)];
      missing = [];
      expect(await generateFixes(shopId, scan.id)).toBe(1);
      expect(ai.mock.calls.filter((c: any) => c[0].label === "fix-ideas").at(-1)![0].prompt).toContain("Only suggest changes you can make fully");
      // Over the month's budget: no new round at all.
      const { recordCost } = await import("../app/lib/cost.server");
      await recordCost(shopId, "anthropic", "test", 150);
      expect(await generateFixes(shopId, scan.id)).toBe(0);
    } finally {
      ai.mockImplementation(async () => {
        throw new Error("no AI in tests");
      });
      await db.shop.update({ where: { id: shopId }, data: { plan: "core", autopilot: false, costThisMonth: 0, costMonth: null } });
      await db.apiCost.deleteMany({ where: { shopId } });
      await db.fix.deleteMany({ where: { shopId } });
    }
  });

  it("finds outreach targets only up to the plan's monthly limit", async () => {
    const { findOutreachTargets, findCandidates } = await import("../app/lib/outreach.server");
    const { startOfMonth } = await import("../app/lib/limits");
    // Article pages are never fetched in tests.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("no network in tests"));
    try {
      expect((await findCandidates(shopId)).length).toBeGreaterThan(0);
      const target = (i: number, createdAt?: Date) => ({ shopId, url: `https://example.com/roundup-${i}`, domain: "example.com", ...(createdAt ? { createdAt } : {}) });
      // Standard: 10 a month. 10 from last month don't count; 10 this month use it up.
      await db.outreachTarget.createMany({ data: Array.from({ length: 10 }, (_, i) => target(100 + i, new Date(startOfMonth().getTime() - DAY))) });
      await db.outreachTarget.createMany({ data: Array.from({ length: 10 }, (_, i) => target(i)) });
      expect(await findOutreachTargets(shopId)).toBe(0);
      // Done-for-you: 40 a month, so the same 10 leave room for the article AI cited.
      await db.shop.update({ where: { id: shopId }, data: { plan: "pro" } });
      expect(await findOutreachTargets(shopId)).toBeGreaterThan(0);
    } finally {
      fetchSpy.mockRestore();
      await db.shop.update({ where: { id: shopId }, data: { plan: "core" } });
      await db.outreachTarget.deleteMany({ where: { shopId } });
    }
  });

  it("switches plans once, keeps the store's autopilot choice, saves the one trial and tells the founder", async () => {
    const { onPlanChanged, syncPlanFromSubscriptions } = await import("../app/lib/billing.server");
    const { sendEmail } = await import("../app/lib/email.server");
    const { env } = await import("../app/lib/env.server");
    const jobs = await import("../app/lib/jobs.server");
    const sent = vi.mocked(sendEmail);
    sent.mockClear();
    await db.job.deleteMany({ where: { shopId } });
    // Not "done", so a plan change doesn't start a scan here.
    await db.shop.update({ where: { id: shopId }, data: { onboarding: "questions" } });
    const sub = (name: string, createdAt = new Date()) => ({ id: `gid://shopify/AppSubscription/${name}`, name, status: "ACTIVE", trialDays: 7, createdAt: createdAt.toISOString() });
    // The founder is told through a job (retried, and kept as a record): run whatever is queued.
    const runNotices = async () => {
      for (const job of await db.job.findMany({ where: { shopId, type: "founder.notice", status: "queued" }, orderBy: { createdAt: "asc" } })) {
        await jobs.getHandler("founder.notice")!(job);
        await db.job.update({ where: { id: job.id }, data: { status: "done" } });
      }
    };
    const trialEnds = new Date(Date.now() + 7 * DAY);
    try {
      // The plans page and the webhook can both report the same change: only one runs it.
      const results = await Promise.all([
        onPlanChanged(shopId, "pro", { billingName: "GEO Done-for-you yearly", trialEndsAt: trialEnds }),
        onPlanChanged(shopId, "pro", { billingName: "GEO Done-for-you yearly", trialEndsAt: trialEnds }),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      let shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
      expect(shop.plan).toBe("pro");
      expect(shop.autopilot).toBe(true);
      // Only 2 questions written: a top-up is queued to reach 100 (no scan, as setup isn't finished).
      expect((await db.job.findFirstOrThrow({ where: { shopId, type: "questions.topup" } })).payload).toEqual({ scan: false });
      await runNotices();
      expect(sent).toHaveBeenCalledTimes(1);
      expect(sent.mock.calls[0][0]).toEqual(["founder@example.test"]);
      expect(sent.mock.calls[0][1]).toContain("New Done-for-you store");
      expect(sent.mock.calls[0][2]).toContain("billed yearly");
      // Hand work starts after the first charge, not during the free week.
      expect(sent.mock.calls[0][2]).toMatch(/Free trial:<\/b> ends \d+ \w+ \d{4}/);
      expect(sent.mock.calls[0][2]).toContain("after the trial ends on");
      expect(sent.mock.calls[0][2]).not.toMatch(/\u2014| \u2013 /);

      // The first live trial subscription saves when the store's one trial ends; later ones never move it.
      await syncPlanFromSubscriptions(shopId, [sub("GEO Done-for-you")]);
      const savedEnd = (await db.shop.findUniqueOrThrow({ where: { id: shopId } })).trialEndsAt;
      expect(savedEnd).not.toBeNull();
      await syncPlanFromSubscriptions(shopId, [sub("GEO Done-for-you yearly", new Date(Date.now() + 3 * DAY))]);
      expect((await db.shop.findUniqueOrThrow({ where: { id: shopId } })).trialEndsAt).toEqual(savedEnd);

      // The store switches autopilot off (as the Fixes page does); plan changes never switch it back on.
      await db.shop.update({ where: { id: shopId }, data: { autopilot: false, autopilotOptOut: true } });
      expect(await syncPlanFromSubscriptions(shopId, [sub("GEO Done-for-you")])).toBe(false);
      expect((await db.shop.findUniqueOrThrow({ where: { id: shopId } })).autopilot).toBe(false);

      // Leaving Done-for-you: autopilot off, founder told.
      expect(await syncPlanFromSubscriptions(shopId, [sub("GEO Standard")])).toBe(true);
      shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
      expect(shop).toMatchObject({ plan: "core", autopilot: false });
      await runNotices();
      expect(sent).toHaveBeenCalledTimes(2);
      expect(sent.mock.calls[1][1]).toContain("left Done-for-you");

      // Back to Done-for-you: still off, because the store chose that.
      expect(await syncPlanFromSubscriptions(shopId, [sub("GEO Done-for-you")])).toBe(true);
      expect((await db.shop.findUniqueOrThrow({ where: { id: shopId } })).autopilot).toBe(false);
      await syncPlanFromSubscriptions(shopId, [sub("GEO Standard")]);

      // Standard monthly to yearly: the old one's CANCELLED webhook must not drop the store to free.
      expect(await syncPlanFromSubscriptions(shopId, [sub("GEO Standard yearly")])).toBe(false);
      expect((await db.shop.findUniqueOrThrow({ where: { id: shopId } })).plan).toBe("core");
      // No live subscription at all: back to the free scan.
      expect(await syncPlanFromSubscriptions(shopId, [])).toBe(true);
      expect((await db.shop.findUniqueOrThrow({ where: { id: shopId } })).plan).toBe("free");

      // No founder address: never silent. The notice job fails (and stays in the jobs table) instead of skipping.
      await runNotices();
      const before = sent.mock.calls.length;
      env.alertEmail = "";
      await onPlanChanged(shopId, "pro");
      const notice = await db.job.findFirstOrThrow({ where: { shopId, type: "founder.notice", status: "queued" } });
      await expect(jobs.getHandler("founder.notice")!(notice)).rejects.toThrow(/Nobody was told/);
      expect(sent).toHaveBeenCalledTimes(before);
    } finally {
      env.alertEmail = "founder@example.test";
      await db.job.deleteMany({ where: { shopId } });
      await db.shop.update({ where: { id: shopId }, data: { plan: "core", autopilot: false, autopilotOptOut: false, trialEndsAt: null, onboarding: "done" } });
    }
  });

  it("an upgrade reaches 50 questions on Standard and 100 on Done-for-you, keeping every existing one", async () => {
    const { onPlanChanged } = await import("../app/lib/billing.server");
    const { getHandler } = await import("../app/lib/jobs.server");
    const { askJson } = await import("../app/lib/ai.server");
    await import("../app/lib/onboarding.server");
    const ai = vi.mocked(askJson);
    let n = 0;
    ai.mockImplementation((async (opts: any) => {
      if (opts.label !== "questions") throw new Error(`unexpected AI call ${opts.label}`);
      const count = Number(/Write (\d+) different/.exec(opts.prompt)![1]);
      // Claude repeats one already tracked: it is skipped.
      return {
        questions: [{ question: "best beard oil for dry skin australia", keyword: "x" }, ...Array.from({ length: count }, () => ({ question: `beard question ${++n}`, keyword: `kw ${n}` }))],
      };
    }) as any);
    const original = (await db.question.findMany({ where: { shopId } })).map((q) => q.text);
    await db.question.create({ data: { shopId, text: "my own question", source: "merchant", active: true } });
    await db.job.deleteMany({ where: { shopId } });
    await db.shop.update({ where: { id: shopId }, data: { plan: "free", onboarding: "done" } });
    const runTopup = async () => {
      const job = await db.job.findFirstOrThrow({ where: { shopId, type: "questions.topup", status: "queued" } });
      await getHandler("questions.topup")!(job);
      await db.job.update({ where: { id: job.id }, data: { status: "done" } });
      return job;
    };
    const scansBefore = await db.scan.count({ where: { shopId } });
    try {
      expect(await onPlanChanged(shopId, "core")).toBe(true);
      expect((await runTopup()).payload).toEqual({ scan: true });
      expect(await db.question.count({ where: { shopId, active: true } })).toBe(50);
      // 3 existing, 47 written to fill the slots and 10 spares (inactive).
      expect(await db.question.count({ where: { shopId } })).toBe(60);
      for (const text of [...original, "my own question"]) {
        expect((await db.question.findUniqueOrThrow({ where: { shopId_text: { shopId, text } } })).active).toBe(true);
      }
      // Then the upgrade scan ran, with all 50.
      const scan = await db.scan.findFirstOrThrow({ where: { shopId, kind: "baseline" }, orderBy: { startedAt: "desc" } });
      expect(scan.total).toBe(50 * 4 * 2);
      await db.scan.update({ where: { id: scan.id }, data: { status: "done" } });

      // Done-for-you: the 10 spares go on first, then 40 more are written.
      expect(await onPlanChanged(shopId, "pro")).toBe(true);
      await runTopup();
      expect(await db.question.count({ where: { shopId, active: true } })).toBe(100);
      // Switching back and forth can't run up full scans: one upgrade scan a day at most.
      expect(await db.scan.count({ where: { shopId } })).toBe(scansBefore + 1);
      // A downgrade starts no scan, and trims to the plan's 50.
      expect(await onPlanChanged(shopId, "core")).toBe(true);
      expect(await db.question.count({ where: { shopId, active: true } })).toBe(50);
      expect(await db.scan.count({ where: { shopId } })).toBe(scansBefore + 1);
    } finally {
      ai.mockImplementation(async () => {
        throw new Error("no AI in tests");
      });
      await db.scan.deleteMany({ where: { shopId, kind: "baseline" } });
      await db.question.deleteMany({ where: { shopId, text: { notIn: original } } });
      await db.question.updateMany({ where: { shopId }, data: { active: true } });
      await db.job.deleteMany({ where: { shopId } });
      await db.shop.update({ where: { id: shopId }, data: { plan: "core" } });
    }
  });

  it("starts no upgrade scan over the month's cost cap", async () => {
    const { startUpgradeScan } = await import("../app/lib/billing.server");
    const { recordCost } = await import("../app/lib/cost.server");
    const before = await db.scan.count({ where: { shopId } });
    try {
      await recordCost(shopId, "treg", "test", 15);
      expect(await startUpgradeScan(shopId)).toBeNull();
      expect(await db.scan.count({ where: { shopId } })).toBe(before);
    } finally {
      await db.apiCost.deleteMany({ where: { shopId } });
      await db.shop.update({ where: { id: shopId }, data: { costThisMonth: 0, costMonth: null } });
    }
  });

  it("saves a plan picked on the website by shop domain, for 30 days", async () => {
    const { savePlanIntentFromLogin, planIntentFor, clearPlanIntent } = await import("../app/lib/plan-intent.server");
    const domain = "stubble-test.myshopify.com";
    const form = (fields: Record<string, string>) => {
      const f = new FormData();
      for (const [k, v] of Object.entries(fields)) f.set(k, v);
      return f;
    };
    try {
      await savePlanIntentFromLogin(form({ shop: "Stubble-Test", plan: "pro", cycle: "yearly" }), new URL("https://geo.test/auth/login"));
      expect(await planIntentFor(domain)).toEqual({ plan: "pro", cycle: "yearly" });
      // From the page address when the form doesn't carry it.
      await savePlanIntentFromLogin(form({ shop: domain }), new URL("https://geo.test/auth/login?plan=core&cycle=monthly"));
      expect(await planIntentFor(domain)).toEqual({ plan: "core", cycle: "monthly" });
      // Not a plan we sell, or not a myshopify domain: nothing saved.
      await savePlanIntentFromLogin(form({ shop: "other-store", plan: "free" }), new URL("https://geo.test/auth/login"));
      await savePlanIntentFromLogin(form({ shop: "www.example.com", plan: "pro" }), new URL("https://geo.test/auth/login"));
      expect(await db.planIntent.count()).toBe(1);
      // Older than 30 days: ignored.
      await db.planIntent.update({ where: { domain }, data: { createdAt: new Date(Date.now() - 31 * DAY) } });
      expect(await planIntentFor(domain)).toBeNull();
    } finally {
      await clearPlanIntent(domain);
    }
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
