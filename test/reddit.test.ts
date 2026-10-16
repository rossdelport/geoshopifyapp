// Reddit finder. Pure parts: search phrases from buying questions, reading both search providers' posts, the
// no-AI relevance check, honest replies (they always say who's writing) and the weekly timing. With a real
// Postgres (TEST_DATABASE_URL): a weekly run saves the relevant threads with a reply each, never twice, the free
// plan gets fewer, and the page's buttons only touch the store's own threads.

import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_reddit_test";
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
delete process.env.ANTHROPIC_API_KEY;

const search = vi.hoisted(() => ({ calls: [] as unknown[], posts: [] as unknown[], fail: false }));
vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));
vi.mock("../app/lib/ai.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/ai.server")>()),
  aiConfigured: () => false,
}));
vi.mock("../app/lib/treg.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/treg.server")>()),
  tregCall: vi.fn(async (endpoint: string, opts: unknown) => {
    search.calls.push({ endpoint, opts });
    if (search.fail && endpoint.startsWith("scrapecreators")) throw new Error("down");
    return endpoint.startsWith("anyapi") ? { output: { data: { posts: search.posts } } } : { posts: search.posts };
  }),
}));

// Imported only after the test database is set above (a static import would load the database code first).
let rd: typeof import("../app/lib/reddit.server");
beforeAll(async () => {
  rd = await import("../app/lib/reddit.server");
});

const post = (id: string, title: string, selftext = "", extra: Record<string, unknown> = {}) => ({
  id,
  subreddit: "streetwear",
  title,
  selftext,
  author: "someone",
  score: 12,
  num_comments: 8,
  created_utc: 1_790_000_000,
  ...extra,
});

describe("Reddit finder: the pure parts", () => {
  it("turns buying questions into short search phrases, most searched first, without the country", () => {
    expect(rd.searchPhrase("Best wide leg track pants for lounging around in Australia?", "AU")).toBe("wide leg track pants lounging around");
    expect(rd.searchPhrase("What hoodie brands are Aussie uni students wearing at the moment?", "AU")).toBe("hoodie brands uni students wearing");
    expect(rd.searchPhrase("Best beard oil for dry skin in the US?", "US")).toBe("beard oil dry skin");
    const phrases = rd.searchPhrases(
      [
        { text: "Good matching hoodies for couples?", volume: 260 },
        { text: "Best wide leg track pants for lounging around in Australia?", volume: 5400 },
        { text: "best wide leg track pants for lounging around?", volume: 10 }, // same phrase: once
        { text: "Best?", volume: 9000 }, // nothing left to search for
      ],
      "AU",
    );
    expect(phrases).toEqual(["wide leg track pants lounging around", "matching hoodies couples"]);
  });

  it("reads posts from both search providers and skips removed or adult ones", () => {
    expect(rd.parsePost(post("1abc", "Best wide leg sweats?", "Looking for comfy ones"))).toEqual({
      postId: "1abc",
      url: "https://www.reddit.com/r/streetwear/comments/1abc/",
      subreddit: "streetwear",
      title: "Best wide leg sweats?",
      body: "Looking for comfy ones",
      author: "someone",
      score: 12,
      comments: 8,
      postedAt: new Date(1_790_000_000 * 1000),
    });
    // AnyAPI's names.
    expect(rd.parsePost({ id: "t3_9zz", subreddit: "r/hoodies", title: "Hoodie help", numComments: 3, createdUtc: 1_790_000_000 })).toMatchObject({
      postId: "9zz",
      subreddit: "hoodies",
      comments: 3,
    });
    expect(rd.parsePost(post("1x", "ok", "[removed]"))?.body).toBeNull();
    expect(rd.parsePost(post("1y", "nsfw", "", { over_18: true }))).toBeNull();
    expect(rd.parsePost(post("../evil", "bad id"))).toBeNull();
    expect(rd.parsePost(post("1z", "bad sub", "", { subreddit: "x/../y" }))).toBeNull();
  });

  it("without AI, keeps posts that ask for advice about what we searched for", () => {
    const p = (title: string, body = "") => rd.parsePost(post("1a", title, body))!;
    expect(rd.looksRelevant(p("Any recommendations for wide leg track pants?"), "wide leg track pants")).toBe(true);
    expect(rd.looksRelevant(p("Where can I find hoodies that aren't too short", "I'm tall"), "oversized hoodies")).toBe(true);
    expect(rd.looksRelevant(p("My new track pants arrived", "Love them"), "wide leg track pants")).toBe(false); // not asking
    expect(rd.looksRelevant(p("Best pizza in Melbourne?"), "wide leg track pants")).toBe(false); // off topic
  });

  it("every reply says who's writing, and never has em dashes", () => {
    expect(rd.ensureDisclosure("Honestly the fit matters most — go a size up.", "sunday")).toBe(
      "(I run sunday, so I'm biased.) Honestly the fit matters most, go a size up.",
    );
    const own = "I'm the founder of sunday, so take this with a grain of salt. Go a size up.";
    expect(rd.ensureDisclosure(own, "sunday")).toBe(own);
    expect(rd.ensureDisclosure("I\u2019m the owner of Sunday. Go a size up.", "sunday")).toBe("I\u2019m the owner of Sunday. Go a size up.");
    expect(rd.ensureDisclosure("Full disclosure: I started sunday. Go a size up.", "sunday")).toBe("Full disclosure: I started sunday. Go a size up.");
    // Owner-sounding words without the brand are not a disclosure.
    expect(rd.ensureDisclosure("I own two pairs of their trackies and love them. Go a size up.", "sunday")).toMatch(/^\(I run sunday, so I'm biased\.\) I own two pairs/);
    expect(rd.ensureDisclosure("I make a point of checking fabric weight.", "sunday")).toMatch(/^\(I run sunday, so I'm biased\.\) I make/);
    // A reply that talks like a customer is never used, however it starts.
    expect(rd.posesAsCustomer("I've been using sunday's trackies for a year and they're the best thing I've bought")).toBe(true);
    expect(rd.posesAsCustomer("(I run sunday, so I'm biased.) I bought mine last winter and they held up.")).toBe(true);
    expect(rd.posesAsCustomer("Speaking as a happy customer, go a size up.")).toBe(true);
    expect(rd.posesAsCustomer("(I run sunday, so I'm biased.) For fleece this heavy, go a size up. Happy to answer questions.")).toBe(false);
    const plain = rd.fallbackReply({ brand: "sunday", summary: "Streetwear.", product: { title: "Flare Trackies", price: "120.00 AUD", description: "Heavyweight fleece. Made in Melbourne." } });
    expect(plain).toBe(
      "(I run sunday, so I'm biased.) For what you're after, our Flare Trackies (120.00 AUD) might be worth a look. Heavyweight fleece. Either way, I'd compare a few options and check the sizing or details before you buy. Happy to answer any questions.",
    );
    expect(plain).not.toMatch(/I bought|I've been using|—/);
  });

  it("looks the first time for every store, then weekly on paid plans only", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
    expect(rd.redditDue({ plan: "free", redditCheckedAt: null }, now)).toBe(true);
    expect(rd.redditDue({ plan: "free", redditCheckedAt: ago(30) }, now)).toBe(false);
    expect(rd.redditDue({ plan: "core", redditCheckedAt: ago(3) }, now)).toBe(false);
    expect(rd.redditDue({ plan: "core", redditCheckedAt: ago(7) }, now)).toBe(true);
    expect(rd.redditDue({ plan: "pro", redditCheckedAt: ago(8) }, now)).toBe(true);
  });
});

describe.skipIf(!url)("Reddit finder with a database (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;

  beforeAll(async () => {
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
  });
  beforeEach(async () => {
    await db.shop.deleteMany({});
    search.calls = [];
    search.fail = false;
    search.posts = [
      post("1aaa", "Best wide leg track pants for lounging?", "Want something comfy and baggy"),
      post("1bbb", "Any recommendations for matching hoodies for couples?"),
      post("1ccc", "My hoodie arrived today", "So happy"), // not asking: left out
      post("1ddd", "Best pizza in Melbourne?"), // off topic: left out
    ];
  });
  afterAll(async () => {
    await db?.shop.deleteMany({});
    await db?.$disconnect();
  });

  async function seed(plan = "core") {
    const shop = await db.shop.create({ data: { domain: "sun.myshopify.com", primaryDomain: "sundayaus.com", name: "sunday", plan, source: "web", country: "AU" } });
    await db.brandProfile.create({ data: { shopId: shop.id, brandName: "sunday", summary: "Melbourne streetwear: heavyweight hoodies and track pants.", category: "streetwear", audience: "young adults", pricePoint: "mid" } });
    for (const [text, volume] of [["Best wide leg track pants for lounging around in Australia?", 5400], ["Good matching hoodies for couples?", 260]] as const)
      await db.question.create({ data: { shopId: shop.id, text, volume, active: true } });
    await db.product.create({ data: { shopId: shop.id, gid: "gid://shopify/Product/1", title: "Wide Leg Trackies", handle: "wide-leg-trackies", price: "120.00 AUD", description: "Heavyweight brushed fleece.", status: "ACTIVE" } });
    return shop;
  }

  it("saves the relevant threads with an honest reply each, a year back the first time, and never twice", async () => {
    const shop = await seed();
    expect(await rd.findThreads(shop.id)).toBe(2);
    expect(search.calls).toHaveLength(2); // one search per phrase
    expect((search.calls[0] as { opts: { query: { timeframe: string } } }).opts.query.timeframe).toBe("year");
    const threads = await db.redditThread.findMany({ where: { shopId: shop.id }, orderBy: { postId: "asc" } });
    expect(threads.map((t) => t.postId)).toEqual(["1aaa", "1bbb"]);
    for (const t of threads) {
      expect(t.draft).toMatch(/^\(I run sunday, so I'm biased\.\)/);
      expect(t.status).toBe("new");
    }
    expect(threads[0].draft).toContain("Wide Leg Trackies");
    expect(threads[0].url).toBe("https://www.reddit.com/r/streetwear/comments/1aaa/");
    expect((await db.shop.findUniqueOrThrow({ where: { id: shop.id } })).redditCheckedAt).not.toBeNull();

    // Next week: a month back, and the same posts aren't saved again.
    search.calls = [];
    expect(await rd.findThreads(shop.id)).toBe(0);
    expect((search.calls[0] as { opts: { query: { timeframe: string } } }).opts.query.timeframe).toBe("month");
    expect(await db.redditThread.count({ where: { shopId: shop.id } })).toBe(2);
  });

  it("uses the other search provider when the first one fails", async () => {
    const shop = await seed();
    search.fail = true;
    expect(await rd.findThreads(shop.id)).toBe(2);
    expect(search.calls.some((c) => (c as { endpoint: string }).endpoint === "anyapi.reddit.search")).toBe(true);
  });

  it("keeps at most 10 threads on the free plan", async () => {
    const shop = await seed("free");
    search.posts = Array.from({ length: 15 }, (_, i) => post(`1p${i}`, `Best wide leg track pants for tall people ${i}?`));
    expect(await rd.findThreads(shop.id)).toBe(10);
  });

  it("the page's buttons only change the store's own threads", async () => {
    vi.doMock("../app/lib/web-auth.server", () => ({ requireWebShop: vi.fn(async () => ({ shop: current.shop })) }));
    const current: { shop: unknown } = { shop: null };
    const mine = await seed();
    const other = await db.shop.create({ data: { domain: "other.myshopify.com", name: "Other", source: "web" } });
    await rd.findThreads(mine.id);
    const theirs = await db.redditThread.create({ data: { shopId: other.id, postId: "9x", url: "https://www.reddit.com/r/a/comments/9x/", subreddit: "a", title: "t" } });
    current.shop = mine;
    const route = await import("../app/routes/dash.reddit");
    const act = (form: Record<string, string>) =>
      route.action({ request: new Request("https://usegeo.app/dash/reddit", { method: "POST", body: new URLSearchParams(form) }), params: {}, context: {} } as never);

    const t = (await db.redditThread.findFirstOrThrow({ where: { shopId: mine.id, postId: "1aaa" } })).id;
    expect(await act({ intent: "replied", id: t })).toEqual({ ok: true });
    expect((await db.redditThread.findUniqueOrThrow({ where: { id: t } })).status).toBe("replied");
    await act({ intent: "replied", id: t }); // undo
    expect((await db.redditThread.findUniqueOrThrow({ where: { id: t } })).status).toBe("new");
    await act({ intent: "save", id: t, draft: "(I run sunday, so I'm biased.) Edited." });
    expect((await db.redditThread.findUniqueOrThrow({ where: { id: t } })).draft).toBe("(I run sunday, so I'm biased.) Edited.");
    await act({ intent: "hide", id: t });
    const page = await route.loader({ request: new Request("https://usegeo.app/dash/reddit"), params: {}, context: {} } as never);
    expect(page.list.map((x) => x.title)).toEqual(["Any recommendations for matching hoodies for couples?"]);
    expect(page.counts).toEqual({ all: 1, todo: 1, replied: 0 });

    expect(await act({ intent: "hide", id: theirs.id })).toEqual({ ok: false }); // not this store's
    expect((await db.redditThread.findUniqueOrThrow({ where: { id: theirs.id } })).status).toBe("new");
    vi.doUnmock("../app/lib/web-auth.server");
  });
});
