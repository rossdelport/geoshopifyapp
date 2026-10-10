// Free product check against a real Postgres (set TEST_DATABASE_URL), with the shop's website,
// DNS, AI engines and Claude faked. Covers: createCheck limits and re-use (also under parallel
// posts), working out where the store is, the full check.run job, the SSRF guard (redirects, DNS
// rebinding, size and time caps), no paid re-runs, non-product and marketplace links, stale checks
// and the clean-up.
// Only touches the PublicCheck table (the job queue is faked so this can run beside integration.test.ts).

import type { LookupFunction } from "node:net";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}

const state = vi.hoisted(() => ({ ai: false, parse: false, enginesDown: false, open: 0, mostOpen: 0 }));

// Fake engines: ChatGPT and Perplexity list us 2nd (after a phrase that is not a brand, "Australian Made");
// Gemini only shows a Milkman shopping card.
// Perplexity fails on the second question (both runs).
// Each call stays open a moment, so we can see how many run at once. Like the real tregCall, each call
// holds a slot of the process-wide Treg gate while it is open.
vi.mock("../app/lib/treg.server", async (importOriginal) => {
  const real = await importOriginal<typeof import("../app/lib/treg.server")>();
  return { ...real, askEngine: vi.fn((engine: string, prompt: string) => real.tregGate.run(() => fakeAnswer(engine, prompt))) };
});
async function fakeAnswer(engine: string, prompt: string) {
  state.mostOpen = Math.max(state.mostOpen, ++state.open);
  await new Promise((resolve) => setTimeout(resolve, 5));
  state.open--;
  if (state.enginesDown || (engine === "perplexity" && prompt.startsWith("what's"))) {
    throw new Error("HTTP 500: provider exploded");
  }
  if (engine === "gemini") {
    return {
      provider: "fake.gemini",
      products: [{ title: "Milkman Beard Oil 50ml", brand: "Milkman" }],
      text: `Milkman is a popular pick for "${prompt}".`,
      sources: [{ url: "https://stuga.com.au/blogs/journal/best-beard-oil", title: "Best beard oil" }],
    };
  }
  return {
    provider: `fake.${engine}`,
    products: [],
    text: "Top picks:\n\n**Australian Made** oils are a good start.\n\n1. **Milkman Beard Oil** \u2013 light.\n2. **Coolabah Grooming Co Sandalwood Beard Oil** \u2013 Aussie made.\n3. **Bulldog Original Beard Oil** \u2013 easy to find.",
    sources: [
      { url: "https://stuga.com.au/blogs/journal/best-beard-oil", title: "Best beard oil" },
      { url: "https://coolabahgrooming.com.au/products/sandalwood-beard-oil", title: "Sandalwood Beard Oil" },
    ],
  };
}

// Claude: off by default. When on, it writes the questions but can't read answers (text fallback),
// unless state.parse is on too: then it reads every answer as a list with phrases and a shop in it.
vi.mock("../app/lib/ai.server", () => ({
  aiConfigured: () => state.ai,
  askJson: vi.fn(async (opts: { label: string; prompt: string }) => {
    if (opts.label === "parse-answer" && state.parse) {
      const names = ["Best Beard Oil Australia", "Milkman", "Aussie", "Chemist Warehouse", "Coolabah Grooming Co.", "Made in Australia", "Cotton On", "Bulldog"];
      return { brands: names.map((name) => ({ name, product: null })), merchant_named: true, source_types: [] };
    }
    if (opts.label !== "check-understand") throw new Error("no AI in tests");
    return {
      brand: "Coolabah Grooming Co",
      category: "Beard Oil",
      aliases: ["CGC"],
      questions: [
        { question: "Is Coolabah Grooming Co beard oil better than Milkman?", keyword: "coolabah grooming co vs milkman" },
        { question: "What's the best beard oil for itchy skin?", keyword: "beard oil itchy skin" },
        { question: "Which beard oil do Australian barbers recommend?", keyword: "barber beard oil" },
      ],
    };
  }),
}));

// The job queue is faked: we run the handler ourselves.
vi.mock("../app/lib/jobs.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/jobs.server")>()),
  enqueue: vi.fn(async () => null),
  heartbeat: vi.fn(async () => {}),
}));

// DNS: "evil." hosts point inside a private network, "rebind." answers public once and private after,
// "v6private." has a private IPv6 address, "nodns." never answers.
const dns = vi.hoisted(() => ({ calls: new Map<string, number>() }));
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    async resolve4(host: string) {
      const n = (dns.calls.get(host) ?? 0) + 1;
      dns.calls.set(host, n);
      if (host.startsWith("nodns.")) throw Object.assign(new Error("queryA ETIMEOUT"), { code: "ETIMEOUT" });
      if (host.startsWith("evil.")) return ["10.0.0.7"];
      if (host.startsWith("rebind.")) return n === 1 ? ["23.227.38.65"] : ["127.0.0.1"];
      return ["23.227.38.65"];
    }
    async resolve6(host: string) {
      if (host.startsWith("v6private.")) return ["fd00::1"];
      throw Object.assign(new Error("queryAaaa ENODATA"), { code: "ENODATA" });
    }
  },
}));

// The connection: like a real one, it first looks the host up with the lookup it was given
// (that's where DNS rebinding is caught), then "connects" to the faked website (global fetch).
vi.mock("../app/lib/http-get.server", () => ({
  httpGet: vi.fn(async (url: URL, opts: { lookup: LookupFunction; signal: AbortSignal }) => {
    await new Promise<void>((resolve, reject) => opts.lookup(url.hostname, { all: true }, (err) => (err ? reject(err) : resolve())));
    const res = await fetch(url, { signal: opts.signal });
    return {
      status: res.status,
      location: res.headers.get("location"),
      body: (res.body ?? (async function* () {})()) as unknown as AsyncIterable<Uint8Array>,
      cancel: () => void res.body?.cancel().catch(() => {}),
    };
  }),
}));

const PRODUCT_JS = {
  title: "Sandalwood Beard Oil 50ml",
  vendor: "Coolabah Grooming Co",
  type: "Beard Oil",
  tags: ["beard"],
  description: "<p>A light beard oil.</p>",
  price: 3400,
  featured_image: "//cdn.shopify.com/s/files/1/oil.jpg",
};
const PAGE = `<html><head><title>Sandalwood Beard Oil \u2013 Coolabah Grooming Co</title>
<meta property="og:site_name" content="Coolabah Grooming Co">
<script>Shopify.shop = "coolabah-grooming.myshopify.com"; Shopify.currency = {"active":"AUD","rate":"1.0"};</script>
</head><body></body></html>`;

const HOME = `<html><head><title>Coolabah Grooming Co | Natural beard care</title><meta property="og:type" content="website">
<script type="application/ld+json">{"@type":"Organization","name":"Coolabah Grooming Co"}</script></head></html>`;
const AMAZON = `<html><head><title>Beard Oil 50ml : Amazon.com.au</title><meta property="og:type" content="product">
<meta property="og:site_name" content="Amazon.com.au"></head></html>`;
let loops = 0;

// Where the store is: a Shopify shop on a .com whose settings say New Zealand (its page looks American
// to our server), a Shopify shop whose /meta.json is broken (its prices are in GBP), and a shop that
// isn't Shopify but answers /meta.json anyway (ignored: its prices are in CAD).
const shopifyPage = (extra: string) => `<html lang="en-US"><head><title>Beard Balm</title><meta property="og:locale" content="en_US">
<script>Shopify.shop = "x.myshopify.com";</script>${extra}</head><body></body></html>`;
const BALM_JS = { ...PRODUCT_JS, title: "Beard Balm 60g", vendor: "Wattlebird Grooming", type: "Beard Balm" };
const WOO_PAGE = `<html><head><title>Beard Wax</title><script type="application/ld+json">{"@type":"Product","name":"Beard Wax","brand":"Banksia Beard Co.",
"offers":{"price":"22.00","priceCurrency":"CAD"}}</script></head><body></body></html>`;

const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
  const u = new URL(String(input));
  if (u.hostname === "coolabahgrooming.com.au" && /^\/products\/(sandalwood|cedar)-beard-oil\.js$/.test(u.pathname)) {
    return new Response(JSON.stringify(PRODUCT_JS), { headers: { "content-type": "application/javascript" } });
  }
  if (u.hostname === "coolabahgrooming.com.au" && /^\/products\/(sandalwood|cedar)-beard-oil$/.test(u.pathname)) {
    return new Response(PAGE, { headers: { "content-type": "text/html" } });
  }
  // A shop domain that bounces us to the real one.
  if (u.hostname === "coolabah-grooming.myshopify.com") {
    return new Response(null, { status: 301, headers: { location: `https://coolabahgrooming.com.au${u.pathname}` } });
  }
  // A link that redirects to a private address.
  if (u.hostname === "sneaky.example.com") {
    return new Response(null, { status: 302, headers: { location: "http://evil.example.com/admin" } });
  }
  if (u.hostname === "evil.example.com" || u.hostname.startsWith("rebind.") || u.hostname.startsWith("v6private.")) {
    return new Response("secret admin page");
  }
  // A home page, and a shop whose products all bounce to its password page.
  if (u.hostname === "homepage-shop.com.au") return new Response(HOME, { headers: { "content-type": "text/html" } });
  if (u.hostname === "locked-shop.com.au" && u.pathname !== "/password") {
    return new Response(null, { status: 302, headers: { location: "/password" } });
  }
  if (u.hostname === "locked-shop.com.au") return new Response(HOME.replace("Natural beard care", "Opening soon"));
  // A short link that lands on Amazon.
  if (u.hostname === "short-link.com.au") return new Response(null, { status: 301, headers: { location: "https://www.amazon.com.au/dp/B01" } });
  if (u.hostname === "www.amazon.com.au") return new Response(AMAZON, { headers: { "content-type": "text/html" } });
  // Endless redirects, a huge page, and a server that never answers.
  if (u.hostname === "loop.example.com") return new Response(null, { status: 302, headers: { location: `/r${++loops}` } });
  if (u.hostname === "big.example.com") return new Response("a".repeat(3_000_000));
  if (u.hostname === "wattlebird.com" || u.hostname === "brokenmeta.com") {
    if (u.pathname === "/products/beard-balm.js") return new Response(JSON.stringify(BALM_JS), { headers: { "content-type": "application/javascript" } });
    if (u.pathname === "/products/beard-balm") {
      const currency = u.hostname === "wattlebird.com" ? "USD" : "GBP";
      return new Response(shopifyPage(`<meta property="og:price:currency" content="${currency}">`), { headers: { "content-type": "text/html" } });
    }
    if (u.pathname === "/meta.json" && u.hostname === "wattlebird.com") {
      return new Response(JSON.stringify({ name: "Wattlebird Grooming", country: "NZ", currency: "NZD", myshopify_domain: "x.myshopify.com" }));
    }
    if (u.pathname === "/meta.json") return new Response("<html>oops</html>", { status: 200 });
  }
  // /meta.json that bounces to a private address, one that never answers, and a link that moved to
  // another shop (whose /meta.json, on the old site, names a different shop).
  if (["privmeta.com", "hangmeta.co.nz", "movedshop.com", "othershop.com"].includes(u.hostname)) {
    if (u.pathname === "/products/beard-balm.js") return new Response(JSON.stringify(BALM_JS), { headers: { "content-type": "application/javascript" } });
    if (u.hostname === "movedshop.com" && u.pathname === "/products/beard-balm") {
      return new Response(null, { status: 301, headers: { location: "https://othershop.com/products/beard-balm" } });
    }
    if (u.pathname === "/products/beard-balm") {
      const page = shopifyPage('<meta property="og:price:currency" content="GBP">');
      return new Response(u.hostname === "othershop.com" ? page.replace("x.myshopify.com", "othershop.myshopify.com") : page, { headers: { "content-type": "text/html" } });
    }
    if (u.pathname === "/meta.json" && u.hostname === "privmeta.com") {
      return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/meta.json" } });
    }
    if (u.pathname === "/meta.json" && u.hostname === "hangmeta.co.nz") {
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    }
    if (u.pathname === "/meta.json" && u.hostname === "movedshop.com") {
      return new Response(JSON.stringify({ country: "NZ", myshopify_domain: "movedshop.myshopify.com" }));
    }
  }
  if (u.hostname === "banksia-wax.com") {
    if (u.pathname === "/products/beard-wax") return new Response(WOO_PAGE, { headers: { "content-type": "text/html" } });
    if (u.pathname === "/meta.json") return new Response(JSON.stringify({ country: "NZ" }));
  }
  if (u.hostname === "slow.example.com") {
    return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
  }
  return new Response("not found", { status: 404 });
});

describe.skipIf(!url)("free product check (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let check: typeof import("../app/lib/check.server");
  let enqueue: ReturnType<typeof vi.fn>;
  let askEngine: ReturnType<typeof vi.fn>;
  const LINK = "https://coolabahgrooming.com.au/products/sandalwood-beard-oil";
  const start = async (link: string, ip: string, country: string | null = "AU") => {
    const created = await check.createCheck({ url: link, country, ip });
    expect(created.ok, JSON.stringify(created)).toBe(true);
    return (created as { id: string }).id;
  };

  beforeAll(async () => {
    vi.stubGlobal("fetch", fetchMock);
    db = (await import("../app/db.server")).default;
    check = await import("../app/lib/check.server");
    enqueue = (await import("../app/lib/jobs.server")).enqueue as unknown as ReturnType<typeof vi.fn>;
    askEngine = (await import("../app/lib/treg.server")).askEngine as unknown as ReturnType<typeof vi.fn>;
    await db.$executeRawUnsafe(`TRUNCATE "PublicCheck"`);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    delete process.env.GEO_CHECKS_PER_DAY;
    delete process.env.GEO_CHECKS_USD_PER_DAY;
    await db.$executeRawUnsafe(`TRUNCATE "PublicCheck"`);
  });

  it("refuses bots and bad links without saving anything", async () => {
    expect(await check.createCheck({ url: LINK, country: "AU", ip: "1.1.1.1", honeypot: "spam.com" })).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
    const bad = await check.createCheck({ url: "http://localhost:3000/admin", country: "AU", ip: "1.1.1.1" });
    expect(bad.ok).toBe(false);
    expect(await db.publicCheck.count()).toBe(0);
  });

  it("creates a check, queues the job, and re-uses it for the same link", async () => {
    // No country: the job works out where the store is, and the page doesn't name one until then.
    const first = await check.createCheck({ url: `${LINK}?utm_source=chatgpt.com`, ip: "1.2.3.4" });
    expect(first.ok).toBe(true);
    const id = (first as { id: string }).id;
    const row = await db.publicCheck.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ url: LINK, country: "auto", status: "queued", total: 18, done: 0 });
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.ipHash).not.toContain("1.2.3.4");
    expect(enqueue).toHaveBeenCalledWith("check.run", { id }, { dedupeKey: `check:${id}` });
    expect((await check.getCheckView(id))!.country).toBeNull();

    // Same link from anyone within a day: same report, no new check. A country we don't check is ignored.
    expect(await check.createCheck({ url: LINK, ip: "9.9.9.9" })).toEqual({ ok: true, id });
    expect(await check.createCheck({ url: LINK, country: "XX", ip: "5.5.5.5" })).toEqual({ ok: true, id });
  });

  it("allows 3 new checks per visitor per day, then says so", async () => {
    expect((await check.createCheck({ url: "https://shop-a0.com.au/products/a", ip: "1.2.3.4" })).ok).toBe(true);
    const third = await check.createCheck({ url: "https://shop-a.com.au/products/a", country: "AU", ip: "1.2.3.4" });
    expect(third.ok).toBe(true);
    expect(await check.createCheck({ url: "https://shop-b.com.au/products/b", country: "AU", ip: "1.2.3.4" })).toEqual({
      ok: false,
      error: "This connection has reached the free check limit for now (3 checks in 24 hours). Try again tomorrow, or install GEO for a free scan of 10 questions.",
    });
    // Re-using an existing report still works when the allowance is used up.
    expect((await check.createCheck({ url: LINK, ip: "1.2.3.4" })).ok).toBe(true);
    // Someone else is fine.
    expect((await check.createCheck({ url: "https://shop-b.com.au/products/b", country: "AU", ip: "8.8.4.4" })).ok).toBe(true);
  });

  it("holds the per-visitor limit when many posts arrive at once", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => check.createCheck({ url: `https://rush-${i}.com.au/products/p`, country: "AU", ip: "2.2.2.2" })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error.startsWith("This connection has reached the free check limit"))).toBe(true);
  });

  it("doesn't count failed checks against the visitor's 3, up to 10 tries a day", async () => {
    const fail = (id: string) => db.publicCheck.update({ where: { id }, data: { status: "failed" } });
    for (let i = 0; i < 3; i++) await fail(await start(`https://typo-${i}.com.au/products/p`, "2.3.4.5"));
    // 3 failed checks: the visitor still has 3 to go.
    for (let i = 3; i < 6; i++) await start(`https://typo-${i}.com.au/products/p`, "2.3.4.5");
    expect((await check.createCheck({ url: "https://typo-6.com.au/products/p", country: "AU", ip: "2.3.4.5" })).ok).toBe(false);
    // Failed tries aren't free for ever: 10 a day at most.
    for (let i = 0; i < 10; i++) await fail(await start(`https://retry-${i}.com.au/products/p`, "2.3.4.6"));
    expect((await check.createCheck({ url: "https://retry-x.com.au/products/p", country: "AU", ip: "2.3.4.6" })).ok).toBe(false);
  });

  it("stops everyone when the daily total is reached, and 0 turns checks off", async () => {
    process.env.GEO_CHECKS_PER_DAY = String(await db.publicCheck.count());
    const busy = { ok: false, error: "We’re very busy right now. Please try again later." };
    expect(await check.createCheck({ url: "https://shop-c.com.au/products/c", country: "AU", ip: "7.7.7.7" })).toEqual(busy);
    process.env.GEO_CHECKS_PER_DAY = "0";
    expect(await check.createCheck({ url: "https://shop-c.com.au/products/c", country: "AU", ip: "7.7.7.7" })).toEqual(busy);
    delete process.env.GEO_CHECKS_PER_DAY;
  });

  it("pauses free checks when the day's spending cap is reached, even ones already queued", async () => {
    const id = await start(LINK, "7.7.7.8", "US");
    process.env.GEO_CHECKS_USD_PER_DAY = "0";
    try {
      const quiet = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      expect(await check.createCheck({ url: "https://capped-2.com.au/products/c", country: "AU", ip: "7.7.7.8" })).toEqual({
        ok: false,
        error: "We’re very busy right now. Please try again later.",
      });
      const before = askEngine.mock.calls.length;
      await check.runCheck(id);
      expect(askEngine.mock.calls.length).toBe(before);
      expect((await check.getCheckView(id))!.error).toBe("We’re very busy right now. Please try again later.");
      quiet.mockRestore();
    } finally {
      delete process.env.GEO_CHECKS_USD_PER_DAY;
    }
  });

  it("runs the whole check: reads the product, asks 18 times, writes the report", async () => {
    const created = await check.createCheck({ url: LINK, ip: "1.2.3.4" });
    const id = (created as { id: string }).id;
    const queued = await check.getCheckView(id);
    expect(queued).toMatchObject({ status: "queued", step: "Getting started", country: null, answers: [], report: null, installUrl: "/auth/login" });

    const { getHandler } = await import("../app/lib/jobs.server");
    state.mostOpen = 0;
    fetchMock.mockClear();
    await getHandler("check.run")!({ id: "job-1", payload: { id } } as never);
    expect(state.mostOpen).toBe(18); // all 18 engine calls at once

    const view = (await check.getCheckView(id))!;
    expect(view.status).toBe("done");
    expect(view.error).toBeNull();
    expect(view.done).toBe(18);
    // The shop's /meta.json isn't there (404), so the .com.au address says Australia.
    expect(fetchMock.mock.calls.map(([u]) => String(u))).toContain("https://coolabahgrooming.com.au/meta.json");
    expect(view.country).toBe("AU");
    expect(view.product?.countryFrom).toBe("domain");
    expect(view.product).toMatchObject({
      url: LINK,
      domain: "coolabahgrooming.com.au",
      title: "Sandalwood Beard Oil 50ml",
      brand: "Coolabah Grooming Co",
      category: "beard oil",
      price: "34.00",
      currency: "AUD",
      image: "https://cdn.shopify.com/s/files/1/oil.jpg",
      isShopify: true,
      shopDomain: "coolabah-grooming.myshopify.com",
      hasProductSchema: false,
    });
    expect(view.product).not.toHaveProperty("tags");
    expect(view.installUrl).toBe("/auth/login?shop=coolabah-grooming.myshopify.com");
    expect(view.questions.map((q) => q.text)).toEqual([
      "best beard oil in Australia",
      "what's the best beard oil to buy right now",
      "which beard oil brand is worth it in Australia",
    ]);

    expect(view.answers).toHaveLength(18);
    const failed = view.answers.filter((a) => !a.ok);
    expect(failed.map((a) => [a.engine, a.question])).toEqual([["perplexity", 1], ["perplexity", 1]]);
    const gpt = view.answers.find((a) => a.engine === "chatgpt")!;
    expect(gpt).toMatchObject({ named: true, position: 2, brands: ["Milkman", "Coolabah Grooming Co", "Bulldog"] });
    expect(gpt.sources.map((s) => [s.domain, s.type, s.isOwn])).toEqual([
      ["stuga.com.au", "editorial", false],
      ["coolabahgrooming.com.au", "brand", true],
    ]);
    expect(gpt.snippet).toContain("1. Milkman Beard Oil: light.");
    expect(gpt.snippet).not.toMatch(/[\u2013\u2014]/);
    expect(gpt.snippet).not.toContain("**");
    expect(view.answers.find((a) => a.engine === "gemini")).toMatchObject({ named: false, position: null, brands: ["Milkman"] });

    // chatgpt 100, gemini 0, perplexity 100 (its 2 failures left out) -> 67.
    const r = view.report!;
    expect(r).toMatchObject({ score: 67, label: "Strong", namedCount: 10, answerCount: 16 });
    expect(r.byEngine.perplexity).toEqual({ named: 4, total: 4, score: 100 });
    expect(r.competitors).toEqual([
      { name: "Milkman", count: 16, share: 1 },
      { name: "Bulldog", count: 10, share: 0.63 },
    ]);
    expect(r.sources[0]).toMatchObject({ domain: "stuga.com.au", count: 16, type: "editorial" });
    expect(r.tips.map((t) => t.title)).toContain("Gemini doesn’t mention you yet");

    expect(r.summary).toContain("simple text matching"); // no Claude in this test

    // Running the job again does nothing once done.
    await check.runCheck(id);
    expect((await db.publicCheck.findUniqueOrThrow({ where: { id } })).done).toBe(18);

    // The report is re-used whatever country it found, and when an old form chose that same country.
    expect(await check.createCheck({ url: LINK, ip: "9.9.9.9" })).toEqual({ ok: true, id });
    expect(await check.createCheck({ url: LINK, country: "AU", ip: "9.9.9.9" })).toEqual({ ok: true, id });
    // An old form that chose another country gets its own check, and that one is re-used too.
    const nz = await check.createCheck({ url: LINK, country: "NZ", ip: "9.9.9.9" });
    expect(nz.ok && nz.id !== id).toBe(true);
    const nzId = (nz as { id: string }).id;
    expect(await db.publicCheck.findUniqueOrThrow({ where: { id: nzId } })).toMatchObject({ country: "NZ" });
    expect((await check.getCheckView(nzId))!.country).toBe("NZ");
    expect(await check.createCheck({ url: LINK, country: "nz", ip: "5.5.5.6" })).toEqual({ ok: true, id: nzId });
  });

  it("never has more Treg calls open than TREG_MAX_OPEN, even with two checks running", async () => {
    const { tregGate } = await import("../app/lib/treg.server");
    const { getHandler } = await import("../app/lib/jobs.server");
    const link = "https://coolabahgrooming.com.au/products/cedar-beard-oil";
    const a = await start(link, "8.8.1.1", "AU");
    const b = await start(link, "8.8.1.2", "NZ");
    process.env.TREG_MAX_OPEN = "10";
    state.mostOpen = 0;
    tregGate.resetStats();
    fetchMock.mockClear();
    try {
      // The worker runs up to 2 checks at once: run both jobs together, as it would.
      await Promise.all([getHandler("check.run")!({ id: "job-a", payload: { id: a } } as never), getHandler("check.run")!({ id: "job-b", payload: { id: b } } as never)]);
    } finally {
      delete process.env.TREG_MAX_OPEN;
    }
    expect(state.mostOpen).toBe(10); // 36 calls, never more than 10 open
    expect(tregGate.stats()).toMatchObject({ open: 0, waiting: 0, mostOpen: 10 });
    for (const id of [a, b]) {
      const view = (await check.getCheckView(id))!;
      expect(view.status).toBe("done");
      expect(view.done).toBe(18);
    }
    // A chosen country (old forms) is kept as it is: no need to ask the shop where it is.
    expect((await check.getCheckView(b))!).toMatchObject({ country: "NZ", product: { countryFrom: "chosen" } });
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/meta.json"))).toBe(false);
  });

  it("works out where the store is from Shopify's settings, before writing the questions", async () => {
    const link = "https://wattlebird.com/products/beard-balm";
    const before = askEngine.mock.calls.length;
    const id = await start(link, "8.8.2.1", null);
    expect(await db.publicCheck.findUniqueOrThrow({ where: { id } })).toMatchObject({ country: "auto" });
    await check.runCheck(id);
    const view = (await check.getCheckView(id))!;
    expect(view.status).toBe("done");
    // The page looks American (en_US, USD), but the shop's settings say New Zealand.
    expect(view.country).toBe("NZ");
    expect(view.product?.countryFrom).toBe("store");
    expect(view.questions.filter((q) => q.text.includes("New Zealand")).length).toBeGreaterThanOrEqual(2);
    const calls = askEngine.mock.calls.slice(before);
    expect(calls).toHaveLength(18);
    expect(calls.every((c) => c[2] === "NZ")).toBe(true);

    // The same link is re-used whatever country was found, and when an old form chose that same country.
    expect(await check.createCheck({ url: link, ip: "8.8.2.2" })).toEqual({ ok: true, id });
    expect(await check.createCheck({ url: link, country: "NZ", ip: "8.8.2.2" })).toEqual({ ok: true, id });
    // A different chosen country is a new check.
    const au = await check.createCheck({ url: link, country: "AU", ip: "8.8.2.2" });
    expect(au.ok && au.id !== id).toBe(true);
  });

  it("never fails a check over the shop's /meta.json, and ignores it on shops that aren't Shopify", async () => {
    const broken = await start("https://brokenmeta.com/products/beard-balm", "8.8.3.1", null);
    await check.runCheck(broken);
    expect((await check.getCheckView(broken))!).toMatchObject({ status: "done", country: "GB", product: { countryFrom: "currency" } });

    const woo = await start("https://banksia-wax.com/products/beard-wax", "8.8.3.2", null);
    await check.runCheck(woo);
    expect((await check.getCheckView(woo))!).toMatchObject({ status: "done", country: "CA", product: { countryFrom: "currency", isShopify: false } });
  });

  it("keeps the shop's /meta.json behind the SSRF guard and never waits long for it", async () => {
    fetchMock.mockClear();
    // A redirect to a private address is refused; the page's GBP prices decide.
    const priv = await start("https://privmeta.com/products/beard-balm", "8.8.4.1", null);
    await check.runCheck(priv);
    expect((await check.getCheckView(priv))!).toMatchObject({ status: "done", country: "GB", product: { countryFrom: "currency" } });
    expect(fetchMock.mock.calls.map(([u]) => String(u))).toContain("https://privmeta.com/meta.json");
    expect(fetchMock.mock.calls.some(([u]) => new URL(String(u)).hostname === "127.0.0.1")).toBe(false);

    // A /meta.json that never answers holds the reading step up by 4 seconds at most; the .co.nz address decides.
    const hang = await start("https://hangmeta.co.nz/products/beard-balm", "8.8.4.2", null);
    const t0 = Date.now();
    const read = await check.readProduct("https://hangmeta.co.nz/products/beard-balm", { storeCountry: true });
    expect(Date.now() - t0).toBeLessThan(6_000);
    expect(read.countrySignals.storeCountry).toBeNull();
    await check.runCheck(hang);
    expect((await check.getCheckView(hang))!).toMatchObject({ status: "done", country: "NZ", product: { countryFrom: "domain" } });
  }, 30_000);

  it("ignores /meta.json when the link moved to another shop", async () => {
    const moved = await start("https://movedshop.com/products/beard-balm", "8.8.4.3", null);
    await check.runCheck(moved);
    // The old site's /meta.json says New Zealand for movedshop.myshopify.com, but the page is othershop's (GBP).
    expect((await check.getCheckView(moved))!).toMatchObject({
      status: "done",
      country: "GB",
      product: { countryFrom: "currency", url: "https://othershop.com/products/beard-balm" },
    });
  });

  it("doesn't name a country while it's still reading the page", async () => {
    const reading = await db.publicCheck.create({ data: { url: "https://reading-shop.com.au/products/p", country: "auto", status: "reading", total: 18 } });
    expect((await check.getCheckView(reading.id))!).toMatchObject({ country: null, step: "Reading your product" });
    await db.publicCheck.update({ where: { id: reading.id }, data: { country: "NZ", product: { title: "Oil", brand: "Step Co", countryFrom: "domain" } } });
    expect((await check.getCheckView(reading.id))!).toMatchObject({ country: "NZ", step: "Writing buyer questions" });
  });

  it("never re-runs (and pays again for) a check that was interrupted", async () => {
    const id = await start(LINK, "6.6.6.6", "NZ");
    await db.publicCheck.update({ where: { id }, data: { status: "asking", done: 11 } });
    const before = askEngine.mock.calls.length;
    await check.runCheck(id);
    const row = await db.publicCheck.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: "failed", error: "This check was interrupted. Please run it again.", done: 11 });
    expect(askEngine.mock.calls.length).toBe(before);

    // A retried job (second attempt) stops too, even if the check still looks queued.
    const queued = await start("https://retried-shop.com.au/products/p", "6.6.6.7");
    const { getHandler } = await import("../app/lib/jobs.server");
    await getHandler("check.run")!({ id: "job-2", attempts: 2, payload: { id: queued } } as never);
    expect((await check.getCheckView(queued))!.error).toBe("This check was interrupted. Please run it again.");
    expect(askEngine.mock.calls.length).toBe(before);
  });

  it("shows a check that never finished as failed, so the page stops waiting", async () => {
    const old = await db.publicCheck.create({
      data: { url: "https://stuck-shop.com.au/products/p", status: "asking", total: 18, done: 4, createdAt: new Date(Date.now() - 31 * 60_000) },
    });
    expect(await check.getCheckView(old.id)).toMatchObject({ status: "failed", error: "This check took too long. Please try again.", report: null });
    // One that waited that long in the queue isn't run (and paid for) after the page gave up on it.
    const late = await db.publicCheck.create({
      data: { url: "https://late-shop.com.au/products/p", status: "queued", total: 18, createdAt: new Date(Date.now() - 31 * 60_000) },
    });
    await check.runCheck(late.id);
    expect(await db.publicCheck.findUniqueOrThrow({ where: { id: late.id } })).toMatchObject({ status: "failed", error: "This check took too long. Please try again." });
    // And the same link starts a new check instead of re-using the stuck one.
    expect(await start("https://stuck-shop.com.au/products/p", "6.6.6.8")).not.toBe(old.id);
  });

  it("moves on to writing questions once the product is read, and says how long asking takes", async () => {
    const row = await db.publicCheck.create({
      data: { url: "https://step-shop.com.au/products/p", status: "reading", total: 18, product: { title: "Oil", brand: "Step Co" } },
    });
    expect((await check.getCheckView(row.id))!.step).toBe("Writing buyer questions");
    await db.publicCheck.update({ where: { id: row.id }, data: { status: "asking" } });
    expect((await check.getCheckView(row.id))!.step).toBe("Asking ChatGPT, Gemini and Perplexity. This is the slowest step.");
    await db.publicCheck.update({ where: { id: row.id }, data: { status: "reading", product: Prisma.DbNull } });
    expect((await check.getCheckView(row.id))!.step).toBe("Reading your product");
  });

  it("says so when the link is a home page or a password page, before asking anyone", async () => {
    const before = askEngine.mock.calls.length;
    for (const link of ["https://homepage-shop.com.au/", "https://locked-shop.com.au/products/oil"]) {
      const id = await start(link, "5.6.7.8");
      await check.runCheck(id);
      expect((await check.getCheckView(id))!.error, link).toBe(
        "That looks like a home page, not a product. Please paste the link to one product’s page.",
      );
    }
    expect(askEngine.mock.calls.length).toBe(before);
  });

  it("asks for the shop's own link when a link lands on a marketplace", async () => {
    const id = await start("https://short-link.com.au/products/oil", "5.6.7.9");
    await check.runCheck(id);
    expect((await check.getCheckView(id))!.error).toBe(
      "That link is on a marketplace or big retailer. Please paste the product link from your own store’s website.",
    );
  });

  it("uses Claude's questions but never branded ones", async () => {
    state.ai = true;
    try {
      const created = await check.createCheck({ url: LINK, country: "GB", ip: "6.6.6.6" });
      const id = (created as { id: string }).id;
      await check.runCheck(id);
      const view = (await check.getCheckView(id))!;
      expect(view.status).toBe("done");
      expect(view.product?.category).toBe("beard oil");
      const texts = view.questions.map((q) => q.text);
      expect(texts).toHaveLength(3);
      expect(texts.some((t) => /coolabah/i.test(t))).toBe(false);
      expect(texts[0]).toBe("What's the best beard oil for itchy skin in the UK?");
      expect(texts.filter((t) => / the UK\b/.test(t)).length).toBeGreaterThanOrEqual(2);
    } finally {
      state.ai = false;
    }
  });

  it("leaves phrases and shops out of Claude's brand lists before counting positions and competitors", async () => {
    state.ai = true;
    state.parse = true;
    try {
      const created = await check.createCheck({ url: LINK, country: "NZ", ip: "6.6.6.9" });
      const id = (created as { id: string }).id;
      await check.runCheck(id);
      const view = (await check.getCheckView(id))!;
      expect(view.status).toBe("done");
      const gpt = view.answers.find((a) => a.engine === "chatgpt" && a.ok)!;
      // "Best Beard Oil Australia", "Chemist Warehouse" and "Made in Australia" are gone: we're 3rd, not 5th.
      // Real brands made of describing words ("Aussie", "Cotton On") stay, as brands and as competitors.
      expect(gpt).toMatchObject({ named: true, position: 3, brands: ["Milkman", "Aussie", "Coolabah Grooming Co.", "Cotton On", "Bulldog"] });
      expect(view.report!.competitors.map((c) => c.name).sort()).toEqual(["Aussie", "Bulldog", "Cotton On", "Milkman"]);
      expect(view.report!.summary).not.toContain("text matching");
    } finally {
      state.ai = false;
      state.parse = false;
    }
  });

  it("follows a shop's redirect to its real domain", async () => {
    const product = await check.readProduct("https://coolabah-grooming.myshopify.com/products/sandalwood-beard-oil");
    expect(product.url).toBe(LINK);
    expect(product.domain).toBe("coolabahgrooming.com.au");
    expect(product.brand).toBe("Coolabah Grooming Co");
  });

  it("never fetches private addresses, even after a redirect", async () => {
    fetchMock.mockClear();
    const created = await check.createCheck({ url: "https://sneaky.example.com/products/x", country: "AU", ip: "4.4.4.4" });
    const id = (created as { id: string }).id;
    await check.runCheck(id);
    const view = (await check.getCheckView(id))!;
    expect(view).toMatchObject({
      status: "failed",
      step: "This check didn’t finish",
      error: "We couldn’t read that page. Please paste a public product page link.",
      report: null,
    });
    const fetched = fetchMock.mock.calls.map(([u]) => new URL(String(u)).hostname);
    expect(fetched).toContain("sneaky.example.com");
    expect(fetched).not.toContain("evil.example.com");

    // A failed check isn't re-used: the visitor can try again.
    const again = await check.createCheck({ url: "https://sneaky.example.com/products/x", country: "AU", ip: "4.4.4.4" });
    expect(again.ok && again.id !== id).toBe(true);
  });

  it("fails with a plain message when no AI answers come back", async () => {
    state.enginesDown = true;
    try {
      const created = await check.createCheck({ url: LINK, country: "CA", ip: "3.3.3.3" });
      const id = (created as { id: string }).id;
      await check.runCheck(id);
      const view = (await check.getCheckView(id))!;
      expect(view.status).toBe("failed");
      expect(view.error).toBe("We couldn’t reach the AI assistants just now. Please try again in a few minutes.");
      expect(view.error).not.toMatch(/HTTP|provider/);
      expect(view.done).toBe(18);
    } finally {
      state.enginesDown = false;
    }
  });

  it("connects only to addresses it checked (DNS rebinding)", async () => {
    fetchMock.mockClear();
    // First answer public, second private: the connection's own lookup refuses.
    await expect(check.safeFetch("https://rebind.example.com/products/x")).rejects.toThrow(/couldn’t read that page/);
    expect(dns.calls.get("rebind.example.com")).toBe(2);
    await expect(check.safeFetch("https://v6private.example.com/products/x")).rejects.toThrow(/couldn’t read that page/);
    await expect(check.safeFetch("https://nodns.example.com/products/x")).rejects.toThrow(/couldn’t read that page/);
    expect(fetchMock).not.toHaveBeenCalled();
    // The lookup the connection uses gives back only checked addresses.
    const viaLookup = await new Promise((resolve, reject) =>
      check.safeLookup("shop.example.com", { all: true }, (err, addresses) => (err ? reject(err) : resolve(addresses))),
    );
    expect(viaLookup).toEqual([{ address: "23.227.38.65", family: 4 }]);
  });

  it("stops after 4 redirects, at 2 MB, and after 10 seconds", async () => {
    fetchMock.mockClear();
    await expect(check.safeFetch("https://loop.example.com/start")).rejects.toThrow(/couldn’t read that page/);
    expect(fetchMock.mock.calls.filter(([u]) => new URL(String(u)).hostname === "loop.example.com")).toHaveLength(5);

    const big = await check.safeFetch("https://big.example.com/products/x");
    expect(big.text.length).toBe(2_000_000);

    const timer = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timer.signal);
    try {
      const slow = check.safeFetch("https://slow.example.com/products/x");
      await vi.waitFor(() => expect(timeout).toHaveBeenCalledWith(10_000));
      timer.abort();
      await expect(slow).rejects.toThrow();
    } finally {
      timeout.mockRestore();
    }
  });

  it("returns null for unknown checks", async () => {
    expect(await check.getCheckView("nope")).toBeNull();
    expect(await check.getCheckView("x".repeat(200))).toBeNull();
  });

  it("deletes checks older than 30 days, and hashed IPs after a day", async () => {
    const { purgeOldData } = await import("../app/lib/retention.server");
    const old = await db.publicCheck.create({ data: { url: "https://old.com/products/x", createdAt: new Date(Date.now() - 31 * 86_400_000) } });
    const dayOld = await db.publicCheck.create({ data: { url: "https://day.com/products/x", ipHash: "abc", createdAt: new Date(Date.now() - 25 * 3_600_000) } });
    const fresh = await db.publicCheck.create({ data: { url: "https://new.com/products/x", ipHash: "def" } });
    await purgeOldData();
    expect(await db.publicCheck.findUnique({ where: { id: old.id } })).toBeNull();
    expect((await db.publicCheck.findUniqueOrThrow({ where: { id: dayOld.id } })).ipHash).toBeNull();
    expect((await db.publicCheck.findUniqueOrThrow({ where: { id: fresh.id } })).ipHash).toBe("def");
  });
});
