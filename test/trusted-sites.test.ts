// Sites AI trusts against a real Postgres (set TEST_DATABASE_URL), in its own schema. Covers: sites counted over
// every scan (not just the latest), the store's own site left out, how often answers that used a site named the
// store, the rivals named there and its most-used page; writer lookups once per site within the monthly allowance
// (misses count too); pitches within the pitch allowance, only for pages with a person to write to, and on
// Done-for-you our team is told to send it.

import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_sites_test";
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
process.env.GEO_ALERT_EMAIL = "founder@geo.test";
delete process.env.ANTHROPIC_API_KEY;

const author = vi.hoisted(() => ({ next: { email: "pat@beardmag.net", name: "Pat Author", position: "Editor", company: "Beard Mag", linkedin: "https://linkedin.com/in/pat", twitter: null } as Record<string, string | null>, calls: 0 }));
vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));
vi.mock("../app/lib/ai.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/ai.server")>()),
  aiConfigured: () => false,
}));
vi.mock("../app/lib/treg.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/treg.server")>()),
  findAuthor: vi.fn(async () => {
    author.calls++;
    return author.next;
  }),
}));
vi.mock("../app/lib/jobs.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/jobs.server")>()),
  enqueue: vi.fn(async () => null),
}));
vi.mock("../app/lib/email.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/email.server")>()),
  emailConfigured: () => true,
}));

describe.skipIf(!url)("Sites AI trusts (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let ts: typeof import("../app/lib/trusted-sites.server");
  let enqueue: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
    ts = await import("../app/lib/trusted-sites.server");
    enqueue = (await import("../app/lib/jobs.server")).enqueue as unknown as ReturnType<typeof vi.fn>;
  });
  beforeEach(async () => {
    await db.shop.deleteMany({});
    author.calls = 0;
    enqueue.mockClear();
  });
  afterAll(async () => {
    await db?.shop.deleteMany({});
    await db?.$disconnect();
  });

  /** Two scans: an old one and a new one, each answer citing some pages and naming some brands. */
  async function seed(plan = "core") {
    const shop = await db.shop.create({ data: { domain: "ridge.myshopify.com", primaryDomain: "ridge.com", name: "Ridgeback", plan, source: "web" } });
    const q = await db.question.create({ data: { shopId: shop.id, text: "best beard oil", active: true } });
    let n = 0;
    const answer = async (scanId: string, engine: string, mentioned: boolean, cites: [string, string, string][], brands: string[]) => {
      const a = await db.aiAnswer.create({ data: { scanId, questionId: q.id, engine, runNo: ++n, status: "parsed", mentioned } });
      for (const [u, d, type] of cites) await db.citation.create({ data: { answerId: a.id, url: u, domain: d, title: `${d} page`, type, isOwn: d === "ridge.com" } });
      for (const [i, b] of brands.entries()) await db.mention.create({ data: { answerId: a.id, brand: b, position: i + 1 } });
    };
    const old = await db.scan.create({ data: { shopId: shop.id, status: "done", kind: "baseline", engines: ["chatgpt", "gemini"], startedAt: new Date(Date.now() - 30 * 86_400_000) } });
    const now = await db.scan.create({ data: { shopId: shop.id, status: "done", kind: "weekly", engines: ["chatgpt", "perplexity"] } });
    const mag = ["https://beardmag.net/best-oils", "beardmag.net", "editorial"] as [string, string, string];
    await answer(old.id, "chatgpt", false, [mag, ["https://www.reddit.com/r/beards/x", "www.reddit.com", "ugc"]], ["Bold & Bare", "Milkman"]);
    await answer(old.id, "gemini", false, [mag, ["https://beardmag.net/other", "beardmag.net", "editorial"]], ["Bold & Bare"]);
    await answer(now.id, "chatgpt", true, [mag, ["https://ridge.com/", "ridge.com", "brand"]], ["Milkman"]);
    await answer(now.id, "perplexity", false, [["https://www.reddit.com/r/beards/y", "www.reddit.com", "ugc"]], ["Bold & Bare"]);
    return shop;
  }

  it("ranks the sites AI cites over every scan, without the store's own site", async () => {
    const shop = await seed();
    const sites = await ts.trustedSites(shop.id);
    expect(sites.map((s) => [s.domain, s.answers, s.engines, s.kind])).toEqual([
      ["beardmag.net", 3, ["chatgpt", "gemini"], "article"],
      ["www.reddit.com", 2, ["chatgpt", "perplexity"], "forum"],
    ]);
    const mag = sites[0];
    expect(mag.namedShare).toBeCloseTo(1 / 3);
    expect(mag.rivals).toEqual(["Bold & Bare", "Milkman"]);
    expect(mag.page.url).toBe("https://beardmag.net/best-oils"); // its most-used page
  });

  it("looks up a site's writer once, within the monthly allowance, and counts misses", async () => {
    const shop = await seed();
    expect(await ts.findWriter(shop.id, "beardmag.net")).toEqual({ ok: true });
    expect(await ts.findWriter(shop.id, "beardmag.net")).toEqual({ ok: true }); // already looked up: free
    expect(author.calls).toBe(1);
    const w = await db.siteWriter.findUniqueOrThrow({ where: { shopId_domain: { shopId: shop.id, domain: "beardmag.net" } } });
    expect(w).toMatchObject({ found: true, name: "Pat Author", position: "Editor", email: "pat@beardmag.net", pageUrl: "https://beardmag.net/best-oils" });

    author.next = { email: null, name: null, position: null, company: null, linkedin: null, twitter: null };
    await ts.findWriter(shop.id, "www.reddit.com");
    expect((await db.siteWriter.findUniqueOrThrow({ where: { shopId_domain: { shopId: shop.id, domain: "www.reddit.com" } } })).found).toBe(false);
    expect(await ts.writersUsedThisMonth(shop.id)).toBe(2);

    // Standard: 10 a month.
    await db.siteWriter.createMany({ data: Array.from({ length: 8 }, (_, i) => ({ shopId: shop.id, domain: `x${i}.com`, pageUrl: "https://x.com" })) });
    expect(await ts.findWriter(shop.id, "nope.com")).toEqual({ ok: false, error: ts.SITE_ERRORS.writersUsed });
    expect(await ts.findWriter(shop.id, "beardmag.net")).toEqual({ ok: true }); // already found still fine
  });

  it("is a paid feature", async () => {
    const shop = await seed("free");
    expect(await ts.findWriter(shop.id, "beardmag.net")).toEqual({ ok: false, error: ts.SITE_ERRORS.plan });
    expect(await ts.pitchSite(shop.id, "beardmag.net")).toEqual({ ok: false, error: ts.SITE_ERRORS.plan });
    expect(author.calls).toBe(0);
  });

  it("drafts a pitch to the writer as an outreach target, only for pages with a person to write to", async () => {
    author.next = { email: "pat@beardmag.net", name: "Pat Author", position: null, company: null, linkedin: null, twitter: null };
    const shop = await seed();
    await ts.findWriter(shop.id, "beardmag.net");
    const out = await ts.pitchSite(shop.id, "beardmag.net");
    expect(out.ok).toBe(true);
    const t = await db.outreachTarget.findFirstOrThrow({ where: { shopId: shop.id } });
    expect(t).toMatchObject({ url: "https://beardmag.net/best-oils", domain: "beardmag.net", authorName: "Pat Author", email: "pat@beardmag.net", status: "drafted", kind: "article" });
    expect(t.pitch).toContain("Pat");
    expect(t.pitch).not.toContain("—");
    expect(enqueue).not.toHaveBeenCalledWith("founder.pitch", expect.anything(), expect.anything()); // Standard: the store sends it

    // Again: the same pitch, no second target.
    expect(await ts.pitchSite(shop.id, "beardmag.net")).toEqual({ ok: true, targetId: t.id });
    expect(await db.outreachTarget.count({ where: { shopId: shop.id } })).toBe(1);
    // Reddit: no email to write.
    expect(await ts.pitchSite(shop.id, "www.reddit.com")).toEqual({ ok: false, error: ts.SITE_ERRORS.noPitch });
  });

  it("stops at the monthly pitch allowance, and on Done-for-you tells our team to send it", async () => {
    const shop = await seed("pro");
    await db.outreachTarget.createMany({ data: Array.from({ length: 40 }, (_, i) => ({ shopId: shop.id, url: `https://x${i}.com/a`, domain: `x${i}.com` })) });
    expect(await ts.pitchSite(shop.id, "beardmag.net")).toEqual({ ok: false, error: ts.SITE_ERRORS.pitchesUsed });
    await db.outreachTarget.deleteMany({ where: { shopId: shop.id } });
    const out = await ts.pitchSite(shop.id, "beardmag.net");
    expect(out.ok).toBe(true);
    expect(enqueue).toHaveBeenCalledWith("founder.pitch", { targetId: (out as { targetId: string }).targetId }, expect.objectContaining({ shopId: shop.id }));
  });
});
