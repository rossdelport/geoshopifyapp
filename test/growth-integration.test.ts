/* eslint-disable @typescript-eslint/no-explicit-any -- fake Shopify and Claude replies */
// The growth features against a real Postgres (set TEST_DATABASE_URL), with Shopify, Claude and Treg
// faked: guide pages linked as topic clusters (and unlinked on undo), the refresh cycle for guides and
// product FAQs (in place, undoable, never a date bump alone), long-tail questions, answer-first product
// descriptions, and the AI crawler check.
//
// Runs in its own schema ("geo_growth_test", created from the migrations), so the other database tests
// can run at the same time.

import { execSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type LoaderFunctionArgs } from "react-router";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_growth_test";
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

const state = vi.hoisted(() => ({
  shop: null as unknown,
  claude: {} as Record<string, (opts: any, call: number) => unknown>,
  calls: [] as { label: string; prompt: string }[],
}));

vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));
vi.mock("../app/lib/treg.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/treg.server")>()),
  keywordVolumes: vi.fn(async (keywords: string[]) => Object.fromEntries(keywords.filter((k) => !k.includes("sensitive") && !k.includes("under")).map((k, i) => [k, 1000 - i]))),
}));
vi.mock("../app/lib/ai.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/ai.server")>()),
  aiConfigured: () => true,
  askJson: vi.fn(async (opts: any) => {
    const n = state.calls.filter((c) => c.label === opts.label).length;
    state.calls.push({ label: opts.label, prompt: opts.prompt });
    const reply = state.claude[opts.label];
    if (!reply) throw new Error(`no fake Claude reply for ${opts.label}`);
    return reply(opts, n);
  }),
}));
vi.mock("../app/lib/jobs.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/jobs.server")>()),
  enqueue: vi.fn(async () => null),
}));
vi.mock("../app/lib/shop.server", async (importOriginal) => {
  const { getPlan } = await import("../app/lib/plans");
  return {
    ...(await importOriginal<typeof import("../app/lib/shop.server")>()),
    requireShop: vi.fn(async () => {
      const shop = state.shop as { id: string; plan: string };
      const db = (await import("../app/db.server")).default;
      const fresh = await db.shop.findUniqueOrThrow({ where: { id: shop.id } });
      return { shop: fresh, plan: getPlan(fresh.plan), admin: {} };
    }),
  };
});

const DAY = 86_400_000;

type FakeProduct = { id: string; title: string; handle: string; status: string; description: string; productType?: string };

/** The catalogue the test shop is seeded with, as Shopify lists it. */
const SEEDED_CATALOG: FakeProduct[] = [
  { id: "gid://shopify/Product/1", title: "Sandalwood Beard Oil", handle: "beard-oil", status: "ACTIVE", productType: "Beard Oil", description: "30ml beard oil made with argan and jojoba oil." },
  { id: "gid://shopify/Product/2", title: "Old Balm", handle: "old-balm", status: "ARCHIVED", productType: "Beard Balm", description: "Discontinued." },
];

/** A fake Shopify store: pages, one product's FAQ metafield and the catalogue, enough for guides and FAQs. */
function fakeShopify(catalog: FakeProduct[] = SEEDED_CATALOG) {
  const pages = new Map<string, { id: string; title: string; handle: string; body: string }>();
  let faq: string | null = null;
  let n = 0;
  const calls: string[] = [];
  const admin = {
    graphql: async (query: string, opts?: { variables?: any }) => {
      const v = opts?.variables ?? {};
      const reply = (data: unknown) => new Response(JSON.stringify({ data }));
      if (query.includes("query Products(")) {
        calls.push("products");
        return reply({
          products: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: catalog.map((p) => ({ productType: "", vendor: "Stubble Bros", tags: [], seo: null, featuredMedia: null, priceRangeV2: null, ...p })),
          },
        });
      }
      if (query.includes("pageCreate")) {
        calls.push("pageCreate");
        const id = `gid://shopify/Page/${++n}`;
        pages.set(id, { id, title: v.page.title, handle: v.page.handle, body: v.page.body });
        return reply({ pageCreate: { page: { id, handle: v.page.handle, title: v.page.title }, userErrors: [] } });
      }
      if (query.includes("pageUpdate")) {
        calls.push(`pageUpdate:${v.id}`);
        const p = pages.get(v.id)!;
        pages.set(v.id, { ...p, ...v.page });
        return reply({ pageUpdate: { page: { id: v.id, handle: p.handle }, userErrors: [] } });
      }
      if (query.includes("pageDelete")) {
        calls.push(`pageDelete:${v.id}`);
        pages.delete(v.id);
        return reply({ pageDelete: { deletedPageId: v.id, userErrors: [] } });
      }
      if (query.includes("PageForFix")) return reply({ page: pages.get(v.id) ?? null });
      if (query.includes("metafieldsSet")) {
        calls.push("metafieldsSet");
        const m = v.metafields[0];
        if (m.ownerId.includes("Product")) faq = m.value;
        return reply({ metafieldsSet: { metafields: [{ id: "m1", key: "faq", namespace: "geo" }], userErrors: [] } });
      }
      if (query.includes("metafieldsDelete")) {
        faq = null;
        return reply({ metafieldsDelete: { deletedMetafields: [{ key: "faq" }], userErrors: [] } });
      }
      if (query.includes("ProductForFix")) {
        return reply({
          product: {
            id: v.id,
            title: "Sandalwood Beard Oil",
            handle: "beard-oil",
            descriptionHtml: "<p>30ml</p>",
            productType: "Beard Oil",
            onlineStoreUrl: "https://stubblebros.com/products/beard-oil",
            seo: { title: "", description: "" },
            metafield: faq ? { id: "m1", value: faq } : null,
          },
        });
      }
      throw new Error(`unexpected query ${query.slice(0, 60)}`);
    },
  };
  return { admin, pages, calls, getFaq: () => faq, setFaq: (v: string | null) => (faq = v) };
}

const guideBody = (answer: string) =>
  `<p><strong>Short answer:</strong> Pick a light oil. ${answer}</p>\n<h2>How often should you use it?</h2>\n<p>Daily, after a shower.</p>\n<h2>What size should you buy?</h2>\n<p>A 30 ml bottle lasts a month.</p>`;

const GUIDE_REPLY = (short: string, extra: { question: string; answer: string }[] = []) => ({
  question: "What is the best beard oil?",
  handle: "best-beard-oil",
  short_answer: short,
  sections: [
    { question: "How often should you use it?", answer: "Daily, after a shower." },
    { question: "What size should you buy?", answer: "A 30 ml bottle lasts a month." },
    { question: "Does it suit short beards?", answer: "Yes, a few drops soften short beards." },
    { question: "How do you apply it?", answer: "Warm three drops in your palms and work them in." },
    ...extra,
  ],
  picks: [{ product_index: 0, why: "A light sandalwood beard oil." }],
  source_urls: [],
  missing_info: [],
});

describe.skipIf(!url)("growth features (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let fixes: typeof import("../app/lib/fixes.server");
  let shopId = "";
  let questionId = "";

  beforeAll(async () => {
    if (new URL(url!).searchParams.get("schema") !== SCHEMA) throw new Error("expected the growth test schema");
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
    fixes = await import("../app/lib/fixes.server");
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(`TRUNCATE "Shop", "Job", "ApiCost" CASCADE`);
    state.calls.length = 0;
    state.claude = { "claims-check": () => ({ ok: true, problems: [], fixed_text: null }) };
    const shop = await db.shop.create({
      data: {
        domain: "stubble-test.myshopify.com",
        name: "Stubble Bros",
        primaryDomain: "stubblebros.com",
        plan: "core",
        country: "US",
        currency: "USD",
        onboarding: "done",
        profile: { create: { brandName: "Stubble Bros", summary: "Beard care made in small batches.", category: "beard care", audience: "men", pricePoint: "mid", country: "US" } },
        products: {
          create: [
            { gid: "gid://shopify/Product/1", title: "Sandalwood Beard Oil", handle: "beard-oil", productType: "Beard Oil", status: "ACTIVE", description: "30ml beard oil made with argan and jojoba oil." },
            { gid: "gid://shopify/Product/2", title: "Old Balm", handle: "old-balm", productType: "Beard Balm", status: "ARCHIVED", description: "Discontinued." },
          ],
        },
        questions: { create: [{ text: "best beard oil for sensitive skin", cluster: "beard oil", longTail: true }] },
      },
    });
    shopId = shop.id;
    state.shop = shop;
    questionId = (await db.question.findFirstOrThrow({ where: { shopId } })).id;
  });

  const guideFix = (data: Record<string, unknown>) =>
    db.fix.create({
      data: {
        shopId,
        type: "guide_page",
        reason: "A guide",
        impact: "high",
        before: {},
        questionIds: [questionId],
        ...data,
      } as any,
    });

  it("links a hub and its specific guides only while both are live, and unlinks them on undo", async () => {
    const shopify = fakeShopify();
    const hub = await guideFix({ targetTitle: "What is the best beard oil?", cluster: "beard oil", after: { title: "What is the best beard oil?", handle: "best-beard-oil", bodyHtml: guideBody("Hub.") } });
    const spoke = await guideFix({
      targetTitle: "What is the best beard oil for sensitive skin?",
      cluster: "beard oil",
      hubFixId: hub.id,
      after: { title: "What is the best beard oil for sensitive skin?", handle: "sensitive", bodyHtml: guideBody("Spoke.") },
    });
    const { relatedLinks, updatedLineOf } = await import("../app/lib/guide");

    const liveHub = await fixes.applyFix(hub.id, shopify.admin);
    const hubPage = () => shopify.pages.get(liveHub.resultGid!)!;
    expect(relatedLinks(hubPage().body)).toEqual([]); // no specific guide is live yet: no links to pages that don't exist
    expect(updatedLineOf(hubPage().body)).toMatch(/^[A-Z][a-z]+ \d{4}$/);

    const liveSpoke = await fixes.applyFix(spoke.id, shopify.admin);
    const spokePage = () => shopify.pages.get(liveSpoke.resultGid!)!;
    expect(relatedLinks(spokePage().body)).toEqual(["https://stubblebros.com/pages/best-beard-oil"]);
    expect(relatedLinks(hubPage().body)).toEqual(["https://stubblebros.com/pages/sensitive"]); // the hub gained the link
    expect(hubPage().body).not.toContain("utm_");
    // The store's own edits on the hub survive our link updates.
    expect(hubPage().body).toContain("Hub.");

    await fixes.revertFix(hub.id, shopify.admin);
    expect(shopify.pages.has(liveHub.resultGid!)).toBe(false);
    expect(relatedLinks(spokePage().body)).toEqual([]); // the spoke no longer links to the deleted hub
    expect(spokePage().body).toContain("Spoke.");

    // Hub back live: the links come back on both sides.
    await db.fix.update({ where: { id: hub.id }, data: { status: "pending", revertedAt: null } });
    const again = await fixes.applyFix(hub.id, shopify.admin);
    expect(relatedLinks(shopify.pages.get(again.resultGid!)!.body)).toEqual(["https://stubblebros.com/pages/sensitive"]);
    expect(relatedLinks(spokePage().body)).toEqual(["https://stubblebros.com/pages/best-beard-oil"]);

    // Undoing the spoke takes it off the hub's list.
    await fixes.revertFix(spoke.id, shopify.admin);
    expect(relatedLinks(shopify.pages.get(again.resultGid!)!.body)).toEqual([]);
  });

  it("refreshes a guide in place after 90 days on Standard, only when its content changes, and undoes it", async () => {
    const shopify = fakeShopify();
    const { buildGuideHtml, tidyGuide } = await import("../app/lib/guide");
    const first = GUIDE_REPLY("Pick a light oil. Old answer.");
    const firstDraft = tidyGuide(
      { question: first.question, shortAnswer: first.short_answer, sections: first.sections, picks: [{ productIndex: 0, why: first.picks[0].why }], sources: [] },
      1,
    );
    const firstBody = buildGuideHtml(firstDraft, [{ title: "Sandalwood Beard Oil", url: "https://stubblebros.com/products/beard-oil" }], []);
    const hub = await guideFix({ targetTitle: "What is the best beard oil?", cluster: "beard oil", after: { title: "What is the best beard oil?", handle: "best-beard-oil", bodyHtml: firstBody } });
    const live = await fixes.applyFix(hub.id, shopify.admin);
    const pageId = live.resultGid!;
    const now = new Date();

    // Not due yet (applied today): nothing happens, and no Claude call.
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin, now })).toBe(0);
    expect(state.calls).toEqual([]);

    // 100 days later, Claude returns the same guide: no refresh, no date bump, but the cycle restarts.
    const later = new Date(now.getTime() + 100 * DAY);
    const oldBody = shopify.pages.get(pageId)!.body;
    state.claude["fix-guide-refresh"] = () => GUIDE_REPLY("Pick a light oil. Old answer.");
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin, now: later })).toBe(0);
    expect(await db.fix.count({ where: { refreshOfId: hub.id } })).toBe(0);
    expect(shopify.pages.get(pageId)!.body).toBe(oldBody); // the date line stays as it was
    expect((await db.fix.findUniqueOrThrow({ where: { id: hub.id } })).refreshedAt?.toISOString()).toBe(later.toISOString());
    // Not due again for another 90 days.
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin, now: new Date(later.getTime() + 30 * DAY) })).toBe(0);
    expect(state.calls.filter((c) => c.label === "fix-guide-refresh")).toHaveLength(1);

    // Another 100 days: new facts and a new shopper question in the same topic.
    const scan = await db.scan.create({ data: { shopId, kind: "weekly", status: "done", engines: ["chatgpt"], runs: 1, startedAt: later } });
    const newQ = await db.question.create({ data: { shopId, text: "beard oil for itchy beards", cluster: "beard oil", longTail: true } });
    await db.aiAnswer.create({ data: { scanId: scan.id, questionId: newQ.id, engine: "chatgpt", runNo: 1, status: "parsed", mentioned: false, text: "x" } });
    const later2 = new Date(later.getTime() + 100 * DAY);
    state.claude["fix-guide-refresh"] = () => GUIDE_REPLY("Pick a light oil made with argan and jojoba. New answer.", [{ question: "Does beard oil help an itchy beard?", answer: "It softens the hair, which many find more comfortable." }]);
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin, now: later2 })).toBe(1);
    const prompt = state.calls.filter((c) => c.label === "fix-guide-refresh").at(-1)!.prompt;
    expect(prompt).toContain("beard oil for itchy beards"); // the new question from the latest scan
    expect(prompt).toContain("Sandalwood Beard Oil");
    expect(prompt).not.toContain("Old Balm"); // no longer for sale
    const refresh = await db.fix.findFirstOrThrow({ where: { refreshOfId: hub.id } });
    expect(refresh).toMatchObject({ type: "guide_page", status: "pending", cluster: "beard oil" });
    expect((refresh.before as any).bodyHtml).toBe(oldBody);
    // A refresh doesn't use up the month's guide allowance.
    const { countGuidePagesThisMonth } = await import("../app/lib/usage.server");
    expect(await countGuidePagesThisMonth(shopId)).toBe(1);

    // Approve: same page, new content, a fresh "Updated" line.
    await fixes.applyFix(refresh.id, shopify.admin);
    expect(shopify.calls.filter((c) => c === "pageCreate")).toHaveLength(1); // still the one page
    const updated = shopify.pages.get(pageId)!.body;
    expect(updated).toContain("New answer.");
    expect(updated).not.toContain("Old answer.");
    expect(updated).toContain("Does beard oil help an itchy beard?");
    expect(updated).toMatch(/<p class="geo-updated"><em>Updated [A-Z][a-z]+ \d{4}<\/em><\/p>/);
    expect((await db.fix.findUniqueOrThrow({ where: { id: hub.id } })).refreshedAt).not.toBeNull();

    // Undo: the previous version back in place.
    await fixes.revertFix(refresh.id, shopify.admin);
    expect(shopify.pages.get(pageId)!.body).toBe(oldBody);
    expect((await db.fix.findUniqueOrThrow({ where: { id: hub.id } })).refreshedAt?.toISOString()).toBe(later.toISOString());
  });

  it("never overwrites a page the store changed after the refresh was written", async () => {
    const shopify = fakeShopify();
    const hub = await guideFix({ targetTitle: "What is the best beard oil?", after: { title: "What is the best beard oil?", handle: "best-beard-oil", bodyHtml: guideBody("Old answer.") } });
    const live = await fixes.applyFix(hub.id, shopify.admin);
    await db.fix.update({ where: { id: hub.id }, data: { appliedAt: new Date(Date.now() - 100 * DAY) } });
    state.claude["fix-guide-refresh"] = () => GUIDE_REPLY("A new short answer for today.");
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin })).toBe(1);
    const refresh = await db.fix.findFirstOrThrow({ where: { refreshOfId: hub.id } });
    const page = shopify.pages.get(live.resultGid!)!;
    shopify.pages.set(page.id, { ...page, body: page.body.replace("Daily, after a shower.", "Every morning.") });
    await expect(fixes.applyFix(refresh.id, shopify.admin)).rejects.toThrow(/changed in your store/);
    expect((await db.fix.findUniqueOrThrow({ where: { id: refresh.id } })).status).toBe("failed");
    expect(shopify.pages.get(page.id)!.body).toContain("Every morning.");
  });

  it("refreshes a product FAQ from today's product data, applies it in place and undoes it", async () => {
    const shopify = fakeShopify();
    const original = await db.fix.create({
      data: {
        shopId,
        type: "product_faq",
        targetGid: "gid://shopify/Product/1",
        targetTitle: "Sandalwood Beard Oil",
        before: {},
        after: { faq: [{ q: "How big is it?", a: "30 ml." }, { q: "What's in it?", a: "Argan oil." }] },
        reason: "FAQs",
        impact: "medium",
        questionIds: [questionId],
      },
    });
    await fixes.applyFix(original.id, shopify.admin);
    const liveFaq = shopify.getFaq();
    await db.fix.update({ where: { id: original.id }, data: { appliedAt: new Date(Date.now() - 100 * DAY) } });
    state.claude["fix-faq-refresh"] = () => ({
      faq: [
        { q: "How big is it?", a: "30 ml — about a month." },
        { q: "What's in it?", a: "Argan and jojoba oil." },
      ],
      missing_info: [],
    });
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin })).toBe(1);
    const refresh = await db.fix.findFirstOrThrow({ where: { refreshOfId: original.id } });
    expect(JSON.stringify(refresh.after)).not.toMatch(/—/);
    await fixes.applyFix(refresh.id, shopify.admin);
    expect(shopify.getFaq()).toContain("Argan and jojoba oil.");
    await fixes.revertFix(refresh.id, shopify.admin);
    expect(shopify.getFaq()).toBe(liveFaq);
    expect((await db.fix.findUniqueOrThrow({ where: { id: refresh.id } })).status).toBe("reverted");
  });

  // Review fixes (October 2026): the refresh cycle never overwrites what the store changed in Shopify,
  // works from today's catalogue, and a skipped or undone update behaves.
  it("leaves a guide alone when the store edited it in Shopify since we published it (no Claude call)", async () => {
    const shopify = fakeShopify();
    const hub = await guideFix({ targetTitle: "What is the best beard oil?", after: { title: "What is the best beard oil?", handle: "best-beard-oil", bodyHtml: guideBody("Old answer.") } });
    const live = await fixes.applyFix(hub.id, shopify.admin);
    await db.fix.update({ where: { id: hub.id }, data: { appliedAt: new Date(Date.now() - 100 * DAY) } });
    // The store added its own paragraph and a picture: a rebuild from the Q&A alone would drop them.
    const page = shopify.pages.get(live.resultGid!)!;
    const edited = `${page.body}\n<p>Our founder's tip: warm it in your hands first.</p><img src="https://cdn.shopify.com/x.jpg">`;
    shopify.pages.set(page.id, { ...page, body: edited });
    state.claude["fix-guide-refresh"] = () => GUIDE_REPLY("A new short answer for today.");
    const now = new Date();
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin, now })).toBe(0);
    expect(state.calls.filter((c) => c.label === "fix-guide-refresh")).toHaveLength(0);
    expect(await db.fix.count({ where: { refreshOfId: hub.id } })).toBe(0);
    expect(shopify.pages.get(page.id)!.body).toBe(edited);
    expect((await db.fix.findUniqueOrThrow({ where: { id: hub.id } })).refreshedAt?.toISOString()).toBe(now.toISOString());
  });

  it("leaves product FAQs alone when the store changed or removed them in Shopify", async () => {
    const shopify = fakeShopify();
    const original = await db.fix.create({
      data: { shopId, type: "product_faq", targetGid: "gid://shopify/Product/1", targetTitle: "Sandalwood Beard Oil", before: {}, after: { faq: [{ q: "How big is it?", a: "30 ml." }, { q: "What's in it?", a: "Argan oil." }] }, reason: "FAQs", impact: "medium", questionIds: [questionId] },
    });
    await fixes.applyFix(original.id, shopify.admin);
    await db.fix.update({ where: { id: original.id }, data: { appliedAt: new Date(Date.now() - 100 * DAY) } });
    state.claude["fix-faq-refresh"] = () => ({ faq: [{ q: "How big is it?", a: "30 ml, about a month." }, { q: "What's in it?", a: "Argan and jojoba oil." }], missing_info: [] });
    shopify.setFaq(null); // the store deleted our FAQs in Shopify: we must not put them back
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin })).toBe(0);
    expect(shopify.getFaq()).toBeNull();
    shopify.setFaq(JSON.stringify([{ q: "How big is it?", a: "30 ml, our own words." }]));
    await db.fix.update({ where: { id: original.id }, data: { refreshedAt: new Date(Date.now() - 100 * DAY) } });
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin })).toBe(0);
    expect(state.calls.filter((c) => c.label === "fix-faq-refresh")).toHaveLength(0);
  });

  it("refreshes from today's catalogue: products archived or deleted in Shopify since install drop out", async () => {
    // Since install: the beard oil was archived in Shopify, a new balm was added, and the old balm deleted.
    const shopify = fakeShopify([
      { id: "gid://shopify/Product/1", title: "Sandalwood Beard Oil", handle: "beard-oil", status: "ARCHIVED", description: "30ml beard oil." },
      { id: "gid://shopify/Product/3", title: "Cedar Beard Balm", handle: "cedar-balm", status: "ACTIVE", description: "60g balm with shea butter, for men with coarse beards." },
    ]);
    const hub = await guideFix({ targetTitle: "What is the best beard oil?", after: { title: "What is the best beard oil?", handle: "best-beard-oil", bodyHtml: guideBody("Old answer.") } });
    await fixes.applyFix(hub.id, shopify.admin);
    await db.fix.update({ where: { id: hub.id }, data: { appliedAt: new Date(Date.now() - 100 * DAY) } });
    state.claude["fix-guide-refresh"] = () => GUIDE_REPLY("A balm suits most beards. New answer.");
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin })).toBe(1);
    const prompt = state.calls.find((c) => c.label === "fix-guide-refresh")!.prompt;
    expect(prompt).toContain("Cedar Beard Balm");
    expect(prompt).not.toContain("Sandalwood Beard Oil");
    expect(prompt).not.toContain("Old Balm");
    const products = await db.product.findMany({ where: { shopId }, orderBy: { gid: "asc" } });
    expect(products.map((p) => [p.handle, p.status])).toEqual([
      ["beard-oil", "ARCHIVED"],
      ["old-balm", "DELETED"], // gone from Shopify
      ["cedar-balm", "ACTIVE"],
    ]);
    // The new guide links only to the product that's for sale.
    const refresh = await db.fix.findFirstOrThrow({ where: { refreshOfId: hub.id } });
    expect((refresh.after as any).bodyHtml).toContain("/products/cedar-balm");
    expect((refresh.after as any).bodyHtml).not.toContain("/products/beard-oil");
  });

  it("a skipped refresh restarts the cycle instead of coming back the next day", async () => {
    const shopify = fakeShopify();
    const hub = await guideFix({ targetTitle: "What is the best beard oil?", after: { title: "What is the best beard oil?", handle: "best-beard-oil", bodyHtml: guideBody("Old answer.") } });
    await fixes.applyFix(hub.id, shopify.admin);
    await db.fix.update({ where: { id: hub.id }, data: { appliedAt: new Date(Date.now() - 100 * DAY) } });
    state.claude["fix-guide-refresh"] = () => GUIDE_REPLY("A new short answer for today.");
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin })).toBe(1);
    const refresh = await db.fix.findFirstOrThrow({ where: { refreshOfId: hub.id } });
    await fixes.rejectFix(refresh);
    expect((await db.fix.findUniqueOrThrow({ where: { id: refresh.id } })).status).toBe("rejected");
    const tomorrow = new Date(Date.now() + DAY);
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin, now: tomorrow })).toBe(0);
    expect(state.calls.filter((c) => c.label === "fix-guide-refresh")).toHaveLength(1);
  });

  it("undoes guide updates newest first", async () => {
    const shopify = fakeShopify();
    const hub = await guideFix({ targetTitle: "What is the best beard oil?", after: { title: "What is the best beard oil?", handle: "best-beard-oil", bodyHtml: guideBody("First answer.") } });
    const live = await fixes.applyFix(hub.id, shopify.admin);
    const pageId = live.resultGid!;
    await db.fix.update({ where: { id: hub.id }, data: { appliedAt: new Date(Date.now() - 300 * DAY) } });
    state.claude["fix-guide-refresh"] = () => GUIDE_REPLY("Second answer here.");
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin, now: new Date(Date.now() - 200 * DAY) })).toBe(1);
    const first = await db.fix.findFirstOrThrow({ where: { refreshOfId: hub.id } });
    await fixes.applyFix(first.id, shopify.admin);
    await db.fix.update({ where: { id: first.id }, data: { appliedAt: new Date(Date.now() - 200 * DAY) } });
    await db.fix.update({ where: { id: hub.id }, data: { refreshedAt: new Date(Date.now() - 200 * DAY) } });
    state.claude["fix-guide-refresh"] = () => GUIDE_REPLY("Third answer here.");
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin })).toBe(1);
    const second = await db.fix.findFirstOrThrow({ where: { refreshOfId: hub.id, status: "pending" } });
    await fixes.applyFix(second.id, shopify.admin);
    expect(shopify.pages.get(pageId)!.body).toContain("Third answer here.");

    await expect(fixes.revertFix(first.id, shopify.admin)).rejects.toThrow(/newer update/);
    expect(shopify.pages.get(pageId)!.body).toContain("Third answer here.");
    await fixes.revertFix(second.id, shopify.admin);
    expect(shopify.pages.get(pageId)!.body).toContain("Second answer here.");
    await fixes.revertFix(first.id, shopify.admin);
    expect(shopify.pages.get(pageId)!.body).toContain("First answer.");
  });

  it("drops the link to a guide the store deleted in Shopify", async () => {
    const shopify = fakeShopify();
    const hub = await guideFix({ targetTitle: "What is the best beard oil?", cluster: "beard oil", after: { title: "What is the best beard oil?", handle: "best-beard-oil", bodyHtml: guideBody("Hub.") } });
    const spoke = await guideFix({ targetTitle: "Sensitive skin?", cluster: "beard oil", hubFixId: hub.id, after: { title: "What is the best beard oil for sensitive skin?", handle: "sensitive", bodyHtml: guideBody("Spoke.") } });
    const liveHub = await fixes.applyFix(hub.id, shopify.admin);
    const liveSpoke = await fixes.applyFix(spoke.id, shopify.admin);
    const { relatedLinks } = await import("../app/lib/guide");
    expect(relatedLinks(shopify.pages.get(liveSpoke.resultGid!)!.body)).toEqual(["https://stubblebros.com/pages/best-beard-oil"]);
    shopify.pages.delete(liveHub.resultGid!); // deleted in Shopify admin, not through the app
    await db.fix.update({ where: { id: hub.id }, data: { appliedAt: new Date(Date.now() - 100 * DAY) } });
    expect(await fixes.refreshDueFixes(shopId, { admin: shopify.admin })).toBe(0);
    expect((await db.fix.findUniqueOrThrow({ where: { id: hub.id } })).status).toBe("reverted");
    expect(relatedLinks(shopify.pages.get(liveSpoke.resultGid!)!.body)).toEqual([]);
  });

  it("never calls robots.txt clear when the store turns the check away, and re-checks the next day", async () => {
    const { checkCrawlers, crawlerCheckDue } = await import("../app/lib/robots.server");
    for (const status of [401, 403, 429]) {
      const r = await checkCrawlers(shopId, { fetch: async (u) => ({ status, url: u, text: "<html>Access denied</html>" }) });
      expect(r).toMatchObject({ status: "unreachable", httpStatus: status, bots: [] });
    }
    expect((await checkCrawlers(shopId, { fetch: async (u) => ({ status: 410, url: u, text: "" }) })).status).toBe("no-file");
    await checkCrawlers(shopId, { fetch: async (u) => ({ status: 403, url: u, text: "" }) });
    const route = await import("../app/routes/app.fixes");
    const data = await route.loader({ request: new Request("https://geo.test/app/fixes"), params: {}, context: {} } as unknown as LoaderFunctionArgs);
    const Page = createRoutesStub([{ id: "page", path: "/", Component: route.default, loader: () => data }]);
    const out = renderToStaticMarkup(createElement(Page, { hydrationData: { loaderData: { page: data } } }));
    expect(out).toContain("Your store turned our check away");
    expect(out).not.toContain("Good news");
    expect(out).not.toMatch(/—| – /);
    const day = new Date("2026-10-11T00:00:00Z");
    const later = (h: number) => new Date(day.getTime() + h * 3_600_000);
    expect(crawlerCheckDue(day, later(24), "unreachable")).toBe(true);
    expect(crawlerCheckDue(day, later(24), "ok")).toBe(false);
    expect(crawlerCheckDue(day, later(7 * 24), "ok")).toBe(true);
  });

  it("keeps the country the store chose when it logs in again", async () => {
    const { refreshShopInfo } = await import("../app/lib/install.server");
    const shopInfo = { graphql: async () => new Response(JSON.stringify({ data: { shop: { name: "Stubble Bros", email: "a@b.co", currencyCode: "USD", myshopifyDomain: "stubble-test.myshopify.com", primaryDomain: { host: "stubblebros.com", url: "https://stubblebros.com" }, shopAddress: { countryCodeV2: "US" } } } })) };
    await db.shop.update({ where: { id: shopId }, data: { country: "GB" } }); // chosen in Settings
    expect((await refreshShopInfo("stubble-test.myshopify.com", shopInfo as any)).country).toBe("GB");
    // A brand-new store, or one we never read properly (no name), takes Shopify's country.
    await db.shop.update({ where: { id: shopId }, data: { name: null } });
    expect((await refreshShopInfo("stubble-test.myshopify.com", shopInfo as any)).country).toBe("US");
    expect((await refreshShopInfo("new-store.myshopify.com", shopInfo as any)).country).toBe("US");
  });

  it("never rewrites a question the store added, and new questions join the store's topics", async () => {
    await db.question.deleteMany({ where: { shopId } });
    await db.question.create({ data: { shopId, text: "best beard oil for travel", source: "merchant", active: true } });
    state.claude.questions = () => ({
      questions: [
        { question: "best beard oil for travel", keyword: "travel beard oil", cluster: "travel", long_tail: true },
        { question: "best beard oil for itchy skin", keyword: "beard oil itchy", cluster: "itchy beards", long_tail: true },
      ],
    });
    const { generateQuestions, topUpQuestions } = await import("../app/lib/onboarding.server");
    await generateQuestions(shopId);
    const mine = await db.question.findFirstOrThrow({ where: { shopId, text: "best beard oil for travel" } });
    expect(mine).toMatchObject({ source: "merchant", active: true, cluster: null });
    expect(state.calls.find((c) => c.label === "questions")!.prompt).toContain("- best beard oil for travel"); // told to write different ones

    // Topping up: the existing topic is offered, and a new label for the same topic folds into it.
    await db.question.updateMany({ where: { shopId, source: "ai" }, data: { cluster: "itchy beards" } });
    await db.shop.update({ where: { id: shopId }, data: { plan: "core" } });
    state.calls.length = 0;
    state.claude.questions = () => ({
      questions: Array.from({ length: 60 }, (_, i) => ({ question: `beard oil question number ${i}`, keyword: `beard oil ${i}`, cluster: i < 50 ? "itchy beards" : `topic ${i}`, long_tail: false })),
    });
    await topUpQuestions(shopId);
    expect(state.calls.find((c) => c.label === "questions")!.prompt).toContain("Topics the store already has");
    expect(state.calls.find((c) => c.label === "questions")!.prompt).toContain("itchy beards");
    const clusters = new Set((await db.question.findMany({ where: { shopId, cluster: { not: null } } })).map((q) => q.cluster));
    expect(clusters.has("itchy beards")).toBe(true);
    expect(clusters.size).toBeLessThanOrEqual(8);
  });

  it("writes long-tail questions with topic clusters and keeps about 35% of slots for them", async () => {
    await db.shop.update({ where: { id: shopId }, data: { plan: "free" } });
    await db.question.deleteMany({ where: { shopId } });
    const broad = Array.from({ length: 12 }, (_, i) => ({ question: `best beard oil brand ${i}`, keyword: `beard oil ${i}`, cluster: i % 2 ? "Beard Oil" : "beard balm", long_tail: false }));
    const specific = Array.from({ length: 8 }, (_, i) => ({
      question: `beard oil for sensitive skin under $40 number ${i}`,
      keyword: `beard oil sensitive ${i}`,
      cluster: i % 2 ? "Sensitive Skin!" : "beard oil",
      long_tail: true,
    }));
    state.claude.questions = () => ({ questions: [...broad, ...specific] });
    const { generateQuestions } = await import("../app/lib/onboarding.server");
    await generateQuestions(shopId);
    const qs = await db.question.findMany({ where: { shopId } });
    const active = qs.filter((q) => q.active);
    expect(active).toHaveLength(10); // the free scan's 10
    expect(active.filter((q) => q.longTail)).toHaveLength(4); // whatever their (unmeasured) volume
    expect(new Set(qs.map((q) => q.cluster))).toEqual(new Set(["beard oil", "beard balm", "sensitive skin"]));
    const prompt = state.calls.find((c) => c.label === "questions")!.prompt;
    expect(prompt).toContain("About 40% should be long-tail");
    expect(prompt).toContain("only ones that appear in the products above, never invented");
  });

  it("puts who it's for and the key facts first in a product description, retrying once", async () => {
    const scan = await db.scan.create({ data: { shopId, kind: "weekly", status: "done", engines: ["chatgpt"], runs: 1 } });
    await db.aiAnswer.create({ data: { scanId: scan.id, questionId, engine: "chatgpt", runNo: 1, status: "parsed", mentioned: false, text: "x" } });
    state.claude["fix-ideas"] = () => ({ ideas: [{ type: "product_description", product_index: 0, question_indexes: [0], reason: "Clearer", impact: "high" }] });
    const story = "<p>Our founder dreamed of a better beard oil for years. It took many late nights. Now it's here — and we love it.</p>";
    const good = "<p>For men with sensitive skin: a 30ml beard oil made with argan and jojoba oil. It softens the beard.</p>";
    const write = (description_html: string) => ({ title: null, description_html, seo_title: null, seo_description: null, product_type: null, faq: null, missing_info: [] });
    state.claude["fix-product_description"] = (_o, call) => write(call === 0 ? story : good);
    expect(await fixes.generateFixes(shopId, scan.id)).toBe(1);
    const fix = await db.fix.findFirstOrThrow({ where: { shopId, type: "product_description" } });
    expect((fix.after as any).descriptionHtml).toBe(good);
    expect(fix.missingInfo).toBeNull();
    expect(state.calls.filter((c) => c.label === "fix-product_description")).toHaveLength(2);
    expect(state.calls.find((c) => c.label === "fix-product_description")!.prompt).toContain("The first 1 to 2 sentences must say what it is, who it is for");

    // Still story-first after the retry: saved, with a note for the store, and no em dash.
    await db.fix.deleteMany({ where: { shopId } });
    state.calls.length = 0;
    state.claude["fix-product_description"] = () => write(story);
    expect(await fixes.generateFixes(shopId, scan.id)).toBe(1);
    const held = await db.fix.findFirstOrThrow({ where: { shopId, type: "product_description" } });
    expect(held.missingInfo).toMatch(/first two sentences/);
    expect((held.after as any).descriptionHtml).not.toMatch(/—/);
  });

  it("doesn't run the English answer-first check on a product written in another language", async () => {
    await db.product.update({
      where: { shopId_gid: { shopId, gid: "gid://shopify/Product/1" } },
      data: { title: "Sandelholz Bartöl", description: "Unser Bartöl mit Arganöl und Jojobaöl macht den Bart weich und pflegt die Haut darunter, jeden Tag und ohne Duftstoffe." },
    });
    const scan = await db.scan.create({ data: { shopId, kind: "weekly", status: "done", engines: ["chatgpt"], runs: 1 } });
    await db.aiAnswer.create({ data: { scanId: scan.id, questionId, engine: "chatgpt", runNo: 1, status: "parsed", mentioned: false, text: "x" } });
    state.claude["fix-ideas"] = () => ({ ideas: [{ type: "product_description", product_index: 0, question_indexes: [0], reason: "Clearer", impact: "high" }] });
    const german = "<p>Für Männer mit trockener Haut: 30 ml Bartöl mit Arganöl und Jojobaöl. Es macht den Bart weich.</p>";
    state.claude["fix-product_description"] = () => ({ title: null, description_html: german, seo_title: null, seo_description: null, product_type: null, faq: null, missing_info: [] });
    expect(await fixes.generateFixes(shopId, scan.id)).toBe(1);
    expect(state.calls.filter((c) => c.label === "fix-product_description")).toHaveLength(1); // no English-only retry
    const fix = await db.fix.findFirstOrThrow({ where: { shopId, type: "product_description" } });
    expect(fix.missingInfo).toBeNull();
    expect(state.calls.find((c) => c.label === "fix-product_description")!.prompt).toContain("Sandelholz Bartöl");
  });

  it("checks the store's robots.txt and shows AI bots that can't read product pages", async () => {
    const { checkCrawlers } = await import("../app/lib/robots.server");
    const robots = "User-agent: *\nDisallow: /cart\n\nUser-agent: OAI-SearchBot\nDisallow: /products/\n\nUser-agent: GPTBot\nDisallow: /\n";
    const asked: string[] = [];
    const r = await checkCrawlers(shopId, { fetch: async (u) => (asked.push(u), { status: 200, url: u, text: robots }) });
    expect(asked).toEqual(["https://stubblebros.com/robots.txt"]);
    expect(r.status).toBe("blocked");
    expect(r.paths.map((p) => p.path)).toEqual(["/products/beard-oil", "/"]);
    const saved = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
    expect(saved.crawlersCheckedAt).not.toBeNull();
    expect((saved.crawlers as any).bots.find((b: any) => b.token === "OAI-SearchBot").blocked).toEqual(["product pages"]);

    const route = await import("../app/routes/app.fixes");
    const data = await route.loader({ request: new Request("https://geo.test/app/fixes"), params: {}, context: {} } as unknown as LoaderFunctionArgs);
    const Page = createRoutesStub([{ id: "page", path: "/", Component: route.default, loader: () => data }]);
    const out = renderToStaticMarkup(createElement(Page, { hydrationData: { loaderData: { page: data } } }));
    expect(out).toContain("Can AI assistants read your store?");
    expect(out).toContain("OAI-SearchBot (OpenAI) can&#x27;t read product pages.");
    expect(out).toContain("robots.txt.liquid");
    expect(out).toContain("doesn&#x27;t stop AI answers from recommending you");
    expect(out).not.toMatch(/—| – /);

    // No robots.txt: everything allowed. A server error or a failed fetch: said plainly, no blocks claimed.
    expect((await checkCrawlers(shopId, { fetch: async (u) => ({ status: 404, url: u, text: "" }) })).status).toBe("no-file");
    expect((await checkCrawlers(shopId, { fetch: async (u) => ({ status: 503, url: u, text: "" }) })).status).toBe("unreachable");
    const failed = await checkCrawlers(shopId, {
      fetch: async () => {
        throw new Error("timeout");
      },
    });
    expect(failed).toMatchObject({ status: "unreachable", bots: [] });
  });
});
