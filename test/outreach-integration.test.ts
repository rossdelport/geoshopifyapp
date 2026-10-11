// Outreach and per-assistant sources against a real Postgres (set TEST_DATABASE_URL), with page reads,
// the email finder and Claude faked. A scan's citations become "others only" targets, per assistant, with
// the right kind and next step; pages that already name the store are kept aside; page reads are cached
// and capped per week; and the Outreach and Competitors screens render with the seeded data.
//
// Runs in its own schema ("geo_outreach_test", created from the migrations), so the other database tests
// (which truncate tables and claim jobs) can run at the same time.

import { execSync } from "node:child_process";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageFetcher } from "../app/lib/cited-page.server";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_outreach_test";
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

const state = vi.hoisted(() => ({ shop: null as unknown, ai: false }));

vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));
vi.mock("../app/lib/treg.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/treg.server")>()),
  findAuthorEmail: vi.fn(async () => ({ email: "writer@beardmag.net", name: "Pat Author" })),
}));
vi.mock("../app/lib/ai.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/ai.server")>()),
  aiConfigured: () => state.ai,
  askJson: vi.fn(async () => {
    throw new Error("no AI in tests");
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
      const shop = state.shop as { plan: string };
      return { shop, plan: getPlan(shop.plan) };
    }),
  };
});

const DAY = 86_400_000;
const GQ = "https://www.gq.com/story/best-beard-oils";
const BLOG = "https://beardblog.net/best-beard-oil-for-dry-skin";
const YT = "https://www.youtube.com/watch?v=abc123";
const REDDIT = "https://www.reddit.com/r/beards/comments/xyz/best_beard_oil_for_dry_skin/";
const TRUSTPILOT = "https://www.trustpilot.com/review/beardco.net";
const CHEMIST = "https://www.chemistwarehouse.com.au/buy/123/milkman-beard-oil";
const MAG = "https://beardmag.net/top-10-beard-oils";
const QUORA = "https://www.quora.com/What-is-the-best-beard-oil-for-dry-skin";
const NICHE = "https://nichebeards.net/review";
const CR = "https://www.consumerreports.org/beard-oil-guide";

const html = (body: string, head = "", title = "Page") => `<!doctype html><html><head><title>${title}</title>${head}</head><body>${body}</body></html>`;

describe.skipIf(!url)("outreach and sources (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let outreach: typeof import("../app/lib/outreach.server");
  let findAuthorEmail: ReturnType<typeof vi.fn>;
  const NOW = new Date();
  const pages = new Map<string, string>();
  const reads: string[] = [];
  const fetchPage: PageFetcher = async (u) => {
    reads.push(u);
    if (u === REDDIT) return { status: 403, url: u, text: "Forbidden" };
    const text = pages.get(u);
    if (!text) throw new Error("not reachable");
    return { status: 200, url: u, text };
  };

  beforeAll(async () => {
    if (new URL(url!).searchParams.get("schema") !== SCHEMA) throw new Error("expected the outreach test schema");
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
    outreach = await import("../app/lib/outreach.server");
    findAuthorEmail = (await import("../app/lib/treg.server")).findAuthorEmail as unknown as ReturnType<typeof vi.fn>;
  }, 120_000);

  afterAll(async () => {
    await db?.$disconnect();
  });

  let shopId = "";

  beforeEach(async () => {
    await db.$executeRawUnsafe(`TRUNCATE "Shop", "Job", "ApiCost" CASCADE`);
    reads.length = 0;
    findAuthorEmail.mockClear();
    pages.clear();
    pages.set(
      GQ,
      html(
        '<p>Milkman and Bulldog top our list.</p><a href="mailto:editor@gq.com">Email the editor</a>',
        '<meta name="author" content="Sam Writer"><meta property="article:modified_time" content="2026-09-01T00:00:00Z">',
      ),
    );
    pages.set(BLOG, html("<p>Our top pick is Stubble Bros, then Milkman.</p>"));
    pages.set(
      YT,
      html(
        '<span itemprop="author" itemscope><link itemprop="url" href="http://www.youtube.com/@BeardReviews"><link itemprop="name" content="Beard Reviews"></span>',
        '<meta itemprop="uploadDate" content="2025-05-01T07:00:00-07:00">',
        "Beard oils tested for dry skin - YouTube",
      ),
    );
    pages.set(TRUSTPILOT, html("<p>Reviews of Beard Co.</p>"));
    pages.set(CHEMIST, html('<p>Milkman Beard Oil 50ml</p><a href="/sell-with-us">Sell with us</a>'));
    pages.set(CR, html('<script type="application/ld+json">{"@type":"Article","datePublished":"2023-01-01"}</script><p>Milkman is a good choice.</p>'));

    const shop = await db.shop.create({
      data: {
        domain: "stubble-test.myshopify.com",
        name: "Stubble Bros",
        primaryDomain: "stubblebros.com",
        plan: "core",
        country: "US",
        currency: "USD",
        onboarding: "done",
        profile: {
          create: { brandName: "Stubble Bros", summary: "Beard care made in small batches.", category: "beard care", audience: "men", pricePoint: "mid", country: "US" },
        },
        products: {
          create: [{ gid: "gid://shopify/Product/1", title: "Sandalwood Beard Oil", handle: "beard-oil", productType: "Beard Oil", status: "ACTIVE", description: "30ml beard oil" }],
        },
        questions: { create: [{ text: "best beard oil for dry skin", volume: 500 }] },
        competitors: { create: [{ name: "Milkman" }] },
      },
    });
    shopId = shop.id;
    state.shop = shop;
    const questionId = (await db.question.findFirstOrThrow({ where: { shopId } })).id;
    const daily = await db.scan.create({ data: { shopId, kind: "daily", status: "done", engines: ["chatgpt", "gemini", "perplexity", "aio"], runs: 2, startedAt: new Date(NOW.getTime() - DAY) } });
    const weekly = await db.scan.create({ data: { shopId, kind: "weekly", status: "done", engines: ["claude"], runs: 1, startedAt: new Date(NOW.getTime() - 3 * DAY) } });
    const type = (u: string) =>
      u.includes("youtube") || u.includes("reddit") || u.includes("trustpilot") || u.includes("quora")
        ? "ugc"
        : u.includes("chemistwarehouse")
          ? "retailer"
          : u.includes("stubblebros.com/products")
            ? "brand"
            : u.includes("wikipedia")
              ? "other"
              : "editorial";
    const answer = (scanId: string, engine: string, runNo: number, mentioned: boolean, brands: string[], cites: string[], title?: Record<string, string>) =>
      db.aiAnswer.create({
        data: {
          scanId,
          questionId,
          engine,
          runNo,
          status: "parsed",
          mentioned,
          text: "answer",
          mentions: { create: brands.map((b, i) => ({ brand: b, position: i + 1, isMerchant: b === "Stubble Bros" })) },
          citations: {
            create: cites.map((c) => {
              const domain = new URL(c).hostname.replace(/^www\./, "");
              return { url: c, domain, title: title?.[c] ?? null, type: type(c), isOwn: domain === "stubblebros.com" };
            }),
          },
        },
      });
    const titles = { [GQ]: "The 12 Best Beard Oils of 2026 | GQ" };
    await answer(daily.id, "chatgpt", 1, false, ["Milkman", "Bulldog"], [GQ, "https://milkman.com.au/blogs/best-beard-oil", "https://stubblebros.com/products/oil", "https://en.wikipedia.org/wiki/Beard_oil", CHEMIST], titles);
    await answer(daily.id, "chatgpt", 2, false, ["Milkman"], [`${GQ}?utm_source=chatgpt.com`, BLOG], titles);
    await answer(daily.id, "aio", 1, false, ["Milkman"], [YT, REDDIT, TRUSTPILOT]);
    await answer(daily.id, "aio", 2, false, ["Bulldog"], [YT, MAG]);
    await answer(daily.id, "perplexity", 1, true, ["Stubble Bros", "Milkman"], [NICHE, QUORA]);
    await answer(daily.id, "perplexity", 2, false, ["Milkman"], [QUORA]);
    await answer(daily.id, "gemini", 1, false, [], []);
    await answer(weekly.id, "claude", 1, false, ["Milkman"], [CR]);
  });

  it("turns a scan's citations into others-only targets, per assistant, with kinds and honest next steps", async () => {
    const made = await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW });
    expect(made).toBe(8);
    const all = await db.outreachTarget.findMany({ where: { shopId } });
    const by = (u: string) => all.find((t) => t.url === u);

    // Never targets: the store's own site, a rival's own blog, Wikipedia, and a page where AI named the store.
    expect(all.map((t) => t.url).sort()).toEqual([BLOG, CHEMIST, CR, GQ, MAG, QUORA, REDDIT, TRUSTPILOT, YT].sort());
    expect(by(NICHE)).toBeUndefined();

    // A page that already names the store is kept aside, not a target.
    expect(by(BLOG)).toMatchObject({ status: "named", mentionsMerchant: true, kind: "article" });

    // Article: read for free (date, author, email), pitch written (plain template without Claude).
    const gq = by(GQ)!;
    expect(gq).toMatchObject({ kind: "article", timesCited: 2, mentionsMerchant: false, authorName: "Sam Writer", email: "editor@gq.com", status: "drafted" });
    expect(gq.engines).toEqual(["chatgpt"]);
    expect(gq.namedBrands).toEqual(["Milkman", "Bulldog"]);
    expect(gq.pageModifiedAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(gq.subject).toContain("The 12 Best Beard Oils of 2026");
    expect(gq.pitch).toContain("Sandalwood Beard Oil");
    expect(gq.pitch).toContain("utm_medium=outreach");

    // Video: a review request through the creator's channel that asks for disclosure.
    const yt = by(YT)!;
    expect(yt).toMatchObject({ kind: "video", timesCited: 2, status: "drafted", authorName: "Beard Reviews", contactUrl: "http://www.youtube.com/@BeardReviews/about", email: null });
    expect(yt.engines).toEqual(["aio"]);
    expect(yt.title).toBe("Beard oils tested for dry skin"); // the citation had no title: taken from the page
    expect(yt.pitch).toContain("gifted");
    expect(yt.pageModifiedAt?.toISOString()).toBe("2025-05-01T14:00:00.000Z");

    // Threads: never a drafted post, no names or emails.
    for (const t of [by(REDDIT)!, by(QUORA)!]) {
      expect(t).toMatchObject({ pitch: null, subject: null, status: "new", authorName: null, email: null, contactUrl: null });
    }
    expect(by(REDDIT)).toMatchObject({ kind: "forum", mentionsMerchant: null }); // blocked: unknown, but checked
    expect(by(REDDIT)!.pageCheckedAt).not.toBeNull();
    expect(by(QUORA)).toMatchObject({ kind: "qa", timesCited: 2 });
    expect(by(QUORA)!.engines).toEqual(["perplexity"]);

    // Directory, shop, and the weekly scan's Claude source.
    expect(by(TRUSTPILOT)).toMatchObject({ kind: "directory", pitch: null, status: "new" });
    expect(by(CHEMIST)).toMatchObject({ kind: "retailer", pitch: null, contactUrl: "https://www.chemistwarehouse.com.au/sell-with-us" });
    expect(by(CR)).toMatchObject({ kind: "article", status: "drafted" });
    expect(by(CR)!.engines).toEqual(["claude"]);

    // The paid email finder only runs for articles whose page shows no email.
    expect(findAuthorEmail.mock.calls.map((c) => c[0]).sort()).toEqual([CR, MAG].sort());
    expect(by(MAG)).toMatchObject({ email: "writer@beardmag.net", authorName: "Pat Author", mentionsMerchant: null });

    // Each new page was read once; a second run reads nothing (cached) and finds nothing new.
    expect(reads.sort()).toEqual([BLOG, CHEMIST, CR, GQ, MAG, QUORA, REDDIT, TRUSTPILOT, YT].sort());
    expect(await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW })).toBe(0);
    expect(reads).toHaveLength(9);
  });

  it("re-reads targets after 14 days within the weekly cap, and moves pages that now name the store aside", async () => {
    await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW });
    reads.length = 0;
    const later = new Date(NOW.getTime() + 15 * DAY);
    pages.set(GQ, html("<p>New in: Stubble Bros, plus Milkman.</p>", '<meta property="article:modified_time" content="2026-10-01T00:00:00Z">'));
    // The page kept aside as "named" no longer names the store.
    pages.set(BLOG, html("<p>Our top pick is Milkman.</p>"));
    // Thread and video pages that now show names and emails: we never keep them.
    pages.set(QUORA, html('<a href="mailto:someone@quoramail.net">x</a>', '<meta name="author" content="A Person">'));
    pages.set(
      YT,
      html(
        '<span itemprop="author" itemscope><link itemprop="url" href="http://www.youtube.com/@BeardReviews"></span><a href="mailto:creator@beardreviews.net">Business</a>',
        "",
        "Beard oils tested for dry skin - YouTube",
      ),
    );

    // This week's 15 page reads are used up: nothing more is read.
    const usedAt = new Date(later.getTime() - DAY);
    await db.apiCost.createMany({ data: Array.from({ length: 15 }, () => ({ shopId, provider: "web", endpoint: "page.read", usd: 0, createdAt: usedAt })) });
    await outreach.findOutreachTargets(shopId, { fetchPage, now: later });
    expect(reads).toHaveLength(0);

    // Once the week has room, every target is read again, including the page kept aside.
    await db.apiCost.deleteMany({ where: { shopId, createdAt: usedAt } });
    await outreach.findOutreachTargets(shopId, { fetchPage, now: later });
    expect(reads.sort()).toEqual([BLOG, CHEMIST, CR, GQ, MAG, QUORA, REDDIT, TRUSTPILOT, YT].sort());
    const gq = await db.outreachTarget.findFirstOrThrow({ where: { shopId, url: GQ } });
    expect(gq.mentionsMerchant).toBe(true);
    expect(gq.pageModifiedAt?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(gq.status).toBe("named"); // not sent yet: nothing to pitch any more
    const blog = await db.outreachTarget.findFirstOrThrow({ where: { shopId, url: BLOG } });
    expect(blog).toMatchObject({ status: "drafted", mentionsMerchant: false });
    expect(blog.pitch).toContain("Sandalwood Beard Oil");
    expect(await db.outreachTarget.findFirstOrThrow({ where: { shopId, url: QUORA } })).toMatchObject({ authorName: null, email: null, contactUrl: null });
    expect((await db.outreachTarget.findFirstOrThrow({ where: { shopId, url: YT } })).email).toBeNull();
  });

  it("never saves a target it couldn't read: with no page reads left this week, candidates wait", async () => {
    await db.apiCost.createMany({ data: Array.from({ length: 15 }, () => ({ shopId, provider: "web", endpoint: "page.read", usd: 0, createdAt: new Date(NOW.getTime() - DAY) })) });
    expect(await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW })).toBe(0);
    expect(await db.outreachTarget.count({ where: { shopId } })).toBe(0);
    expect(reads).toHaveLength(0);
  });

  it("keeps a sent target's status when its page now names the store, and reads only what the week allows", async () => {
    await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW });
    await db.outreachTarget.update({ where: { shopId_url: { shopId, url: GQ } }, data: { status: "sent" } });
    pages.set(GQ, html("<p>New in: Stubble Bros.</p>"));
    reads.length = 0;
    const later = new Date(NOW.getTime() + 15 * DAY);
    // 12 of 15 reads used: only the 3 most-cited targets are read again.
    await db.apiCost.createMany({ data: Array.from({ length: 12 }, () => ({ shopId, provider: "web", endpoint: "page.read", usd: 0, createdAt: new Date(later.getTime() - DAY) })) });
    await outreach.findOutreachTargets(shopId, { fetchPage, now: later });
    expect(reads).toHaveLength(3);
    expect(reads).toContain(GQ);
    expect(await db.outreachTarget.findFirstOrThrow({ where: { shopId, url: GQ } })).toMatchObject({ status: "sent", mentionsMerchant: true });
  });

  it("keeps to the plan's monthly limit", async () => {
    await db.outreachTarget.createMany({ data: Array.from({ length: 10 }, (_, i) => ({ shopId, url: `https://roundup.example/${i}`, domain: "roundup.example" })) });
    expect(await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW })).toBe(0);
    await db.shop.update({ where: { id: shopId }, data: { plan: "pro" } });
    expect(await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW })).toBe(8);
  });

  it("makes no paid lookups once the store is over its monthly cost cap (free reads and templates still work)", async () => {
    await db.shop.update({ where: { id: shopId }, data: { costMonth: new Date().toISOString().slice(0, 7), costThisMonth: 20 } });
    expect(await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW })).toBe(8);
    expect(findAuthorEmail).not.toHaveBeenCalled();
    const gq = await db.outreachTarget.findFirstOrThrow({ where: { shopId, url: GQ } });
    expect(gq.pitch).toContain("Sandalwood Beard Oil");
  });

  it("Rewrite uses Claude only while the store is under its monthly cost cap", async () => {
    await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW });
    const askJson = (await import("../app/lib/ai.server")).askJson as unknown as ReturnType<typeof vi.fn>;
    const route = await import("../app/routes/app.outreach");
    const gq = await db.outreachTarget.findFirstOrThrow({ where: { shopId, url: GQ } });
    const rewrite = () =>
      route.action({
        request: new Request("https://geo.test/app/outreach", { method: "POST", body: new URLSearchParams({ intent: "redraft", id: gq.id }) }),
        params: {},
        context: {},
      } as unknown as ActionFunctionArgs);
    state.ai = true;
    try {
      askJson.mockClear();
      await db.shop.update({ where: { id: shopId }, data: { costMonth: new Date().toISOString().slice(0, 7), costThisMonth: 20 } });
      const over = await rewrite();
      expect(askJson).not.toHaveBeenCalled();
      expect(over).toMatchObject({ ok: true });
      expect((over as { message: string }).message).toContain("plain draft");
      await db.shop.update({ where: { id: shopId }, data: { costThisMonth: 1 } });
      await rewrite();
      expect(askJson).toHaveBeenCalledTimes(1);
    } finally {
      state.ai = false;
    }
  });

  it("renders the Competitors & sources screen with a view per assistant", async () => {
    await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW });
    const route = await import("../app/routes/app.competitors");
    const data = await route.loader({ request: new Request("https://geo.test/app/competitors"), params: {}, context: {} } as unknown as LoaderFunctionArgs);
    if (!data.scanned) throw new Error("expected a scan");
    // Claude comes from the weekly scan even though the newest scan is a daily one without it.
    expect(data.engines).toEqual(["chatgpt", "gemini", "perplexity", "aio", "claude"]);
    const gq = data.views.chatgpt.domains.find((d) => d.domain === "gq.com")!;
    expect(gq).toMatchObject({ answers: 2, share: 1, onIt: "no", type: "editorial" });
    expect(data.views.chatgpt.domains.find((d) => d.domain === "stubblebros.com")?.onIt).toBe("own");
    expect(data.views.chatgpt.domains.find((d) => d.domain === "beardblog.net")?.onIt).toBe("yes");
    expect(data.views.aio.domains[0]).toMatchObject({ domain: "youtube.com", answers: 2, share: 1 });
    expect(data.views.claude.domains.map((d) => d.domain)).toEqual(["consumerreports.org"]);
    expect(data.views.gemini.domains).toEqual([]);
    expect(data.shared).toEqual({ shared: 0, top: 5 });

    const Page = createRoutesStub([{ id: "page", path: "/", Component: route.default, loader: () => data }]);
    const out = renderToStaticMarkup(createElement(Page, { hydrationData: { loaderData: { page: data } } }));
    expect(out).toContain("Each AI assistant leans on different websites");
    expect(out).toContain("0 of the 5 sites each assistant uses most are used by all of them");
    expect(out).toContain("All assistants");
    expect(out).toContain("Google AI Overviews");
    expect(out).toContain("Claude");
    expect(out).toContain("gq.com");
    expect(out).toContain("Names you");
    expect(out).toContain("Your website");
    expect(out).not.toMatch(/—| – /);
  });

  it("renders the Outreach screen grouped by next step, with freshness and pages that already name the store", async () => {
    await outreach.findOutreachTargets(shopId, { fetchPage, now: NOW });
    const route = await import("../app/routes/app.outreach");
    const data = await route.loader({ request: new Request("https://geo.test/app/outreach"), params: {}, context: {} } as unknown as LoaderFunctionArgs);
    expect(data.targets).toHaveLength(8);
    expect(data.named.map((t) => t.url)).toEqual([BLOG]);
    expect(data.engines).toEqual(["chatgpt", "perplexity", "aio", "claude"]);
    expect(data.remaining).toBe(2); // Standard: 10 a month, 8 used (the page kept aside as "named" is not a target)
    expect(data.targets.find((t) => t.url === GQ)?.updated).toBe("Dated September 2026");
    expect(data.targets.find((t) => t.url === TRUSTPILOT)?.reviewSite).toBe(true);
    expect(data.listing.find((l) => l.label === "Based in")?.value).toBe("the US");

    const Page = createRoutesStub([{ id: "page", path: "/", Component: route.default, loader: () => data }]);
    const out = renderToStaticMarkup(createElement(Page, { hydrationData: { loaderData: { page: data } } }));
    for (const heading of ["Articles and roundups to pitch", "Videos: ask for a review", "Threads to join", "Directories and review sites", "Shops and marketplaces"]) {
      expect(out).toContain(heading);
    }
    expect(out).toContain("Never post as a customer");
    expect(out).toContain("Never write, buy or swap reviews.");
    expect(out).toContain("What to submit");
    expect(out).toContain("Dated September 2026");
    expect(out).toContain("When AI uses these pages, it recommends other");
    expect(out).toContain("We couldn&#x27;t read this page. Check it doesn&#x27;t already mention you before you reach out.");
    expect(out).toContain("Pages AI uses that already name you");
    expect(out).toContain("beardblog.net");
    expect(out).not.toMatch(/—| – /);
  });
});
