// GEO web app against a real Postgres (set TEST_DATABASE_URL), in its own schema. Covers: email-link sign-in (a
// link works once, for 30 minutes, at most 5 an hour, and opening it doesn't use it), only safe "next" pages, adding
// a store (real Shopify stores only, never one already on GEO), reading the public catalog, and the pages that need
// a signed-in account.

import { execSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

const base = process.env.TEST_DATABASE_URL;
const SCHEMA = "geo_web_test";
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

const sent = vi.hoisted(() => ({ mails: [] as { to: string[]; html: string; text?: string }[], on: true }));
vi.mock("../app/lib/email.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/email.server")>()),
  emailConfigured: () => sent.on,
  sendEmailMessage: vi.fn(async (m: { to: string[]; html: string; text?: string }) => {
    sent.mails.push(m);
    return { id: "x" };
  }),
}));
vi.mock("../app/lib/jobs.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/jobs.server")>()),
  enqueue: vi.fn(async () => null),
}));
const fetched = vi.hoisted(() => ({ pages: {} as Record<string, { status: number; text: string; url?: string }> }));
vi.mock("../app/lib/check.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/check.server")>()),
  safeFetch: vi.fn(async (u: string) => {
    const p = fetched.pages[u];
    if (!p) throw new Error(`no fake page for ${u}`);
    return { status: p.status, text: p.text, url: p.url ?? u };
  }),
}));

describe("public catalog parsing (no database)", async () => {
  const pc = await import("../app/lib/public-catalog.server");
  it("turns typed addresses into hosts", () => {
    expect(pc.storeHost("https://www.Beard.com/products/oil?x=1")).toBe("www.beard.com");
    expect(pc.storeHost("beard.com.au")).toBe("beard.com.au");
    expect(pc.storeHost("not a site")).toBeNull();
    expect(pc.storeHost("localhost")).toBeNull();
    expect(pc.storeHost("")).toBeNull();
  });
  it("reads Shopify's meta.json and refuses anything that isn't a Shopify store", () => {
    expect(pc.parseMeta({ myshopify_domain: "beard-co.myshopify.com", name: "Beard Co", country: "au", currency: "aud" }, "beard.com")).toEqual({
      myshopifyDomain: "beard-co.myshopify.com",
      host: "beard.com",
      name: "Beard Co",
      country: "AU",
      currency: "AUD",
    });
    expect(pc.parseMeta({ name: "WordPress site" }, "x.com")).toBeNull();
    expect(pc.parseMeta(null, "x.com")).toBeNull();
  });
  it("reads a products.json product into our cache's shape, with the Admin API id", () => {
    const p = pc.parsePublicProduct(
      {
        id: 123,
        title: " Beard Oil ",
        handle: "beard-oil",
        product_type: "Beard Oil",
        vendor: "Beard Co",
        tags: ["dry skin", "oil"],
        body_html: "<p>For dry beards.</p><script>x()</script><ul><li>30ml</li></ul>",
        variants: [{ price: "34.00" }, { price: "29.50" }],
        images: [{ src: "https://cdn.shopify.com/a.jpg" }],
      },
      "AUD",
    );
    expect(p).toEqual({
      gid: "gid://shopify/Product/123",
      title: "Beard Oil",
      handle: "beard-oil",
      productType: "Beard Oil",
      vendor: "Beard Co",
      tags: ["dry skin", "oil"],
      description: "For dry beards.\n30ml",
      price: "29.50 AUD",
      imageUrl: "https://cdn.shopify.com/a.jpg",
    });
    expect(pc.parsePublicProduct({ title: "No id", handle: "x" }, null)).toBeNull();
  });
});

describe.skipIf(!url)("web app (needs TEST_DATABASE_URL)", () => {
  let db: typeof import("../app/db.server").default;
  let auth: typeof import("../app/lib/web-auth.server");
  let pc: typeof import("../app/lib/public-catalog.server");
  let login: typeof import("../app/routes/login");
  let link: typeof import("../app/routes/login_.$token");
  let start: typeof import("../app/routes/start");
  let dash: typeof import("../app/routes/dash");

  const args = (req: Request, params: Record<string, string> = {}) => ({ request: req, params, context: {} }) as unknown as LoaderFunctionArgs & ActionFunctionArgs;
  const post = (path: string, fields: Record<string, string>, cookie = "") =>
    new Request(`https://usegeo.app${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://usegeo.app", ...(cookie ? { cookie } : {}) },
      body: new URLSearchParams(fields).toString(),
    });
  const tokenFrom = (text: string) => text.match(/\/login\/([\w-]+)/)![1];
  const caught = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return e as Response;
    }
    throw new Error("expected a redirect");
  };
  async function signIn(email = "ross@beard.com") {
    sent.mails.length = 0;
    await login.action(args(post("/login", { email, next: "/dash" })));
    const res = await caught(link.action(args(post(`/login/${tokenFrom(sent.mails[0].text!)}`, {}), { token: tokenFrom(sent.mails[0].text!) })));
    return res.headers.get("Set-Cookie")!.split(";")[0];
  }

  beforeAll(async () => {
    execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url!, DIRECT_URL: url! }, stdio: "pipe" });
    db = (await import("../app/db.server")).default;
    auth = await import("../app/lib/web-auth.server");
    pc = await import("../app/lib/public-catalog.server");
    login = await import("../app/routes/login");
    link = await import("../app/routes/login_.$token");
    start = await import("../app/routes/start");
    dash = await import("../app/routes/dash");
  });
  beforeEach(async () => {
    await db.shop.deleteMany({});
    await db.loginLink.deleteMany({});
    await db.user.deleteMany({});
    sent.mails.length = 0;
    sent.on = true;
    fetched.pages = {};
  });
  afterAll(async () => {
    await db?.shop.deleteMany({});
    await db?.loginLink.deleteMany({});
    await db?.user.deleteMany({});
    await db?.$disconnect();
  });

  it("emails a sign-in link that works once, and opening it doesn't use it up", async () => {
    const out = await login.action(args(post("/login", { email: " Ross@Beard.com ", next: "/dash/questions" })));
    expect(out).toEqual({ ok: true, email: "ross@beard.com" });
    expect(sent.mails).toHaveLength(1);
    expect(sent.mails[0].to).toEqual(["ross@beard.com"]);
    expect(sent.mails[0].text).toContain("https://usegeo.app/login/");
    const token = tokenFrom(sent.mails[0].text!);
    // only a hash is stored
    expect(JSON.stringify(await db.loginLink.findMany())).not.toContain(token);

    // An email scanner opening the link twice changes nothing.
    expect(await link.loader(args(new Request(`https://usegeo.app/login/${token}`), { token }))).toEqual({ usable: true });
    expect(await link.loader(args(new Request(`https://usegeo.app/login/${token}`), { token }))).toEqual({ usable: true });

    const res = await caught(link.action(args(post(`/login/${token}`, {}), { token })));
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/dash/questions");
    expect(res.headers.get("Set-Cookie")).toMatch(/^geo_session=.+HttpOnly/i);
    expect(await db.user.count({ where: { email: "ross@beard.com" } })).toBe(1);

    // used: no second sign-in
    expect(await link.action(args(post(`/login/${token}`, {}), { token }))).toEqual({ usable: false });
    expect(await link.loader(args(new Request(`https://usegeo.app/login/${token}`), { token }))).toEqual({ usable: false });
  });

  it("refuses old links, bad emails, more than 5 links an hour, and unsafe next pages", async () => {
    sent.mails.length = 0;
    await login.action(args(post("/login", { email: "a@b.com" })));
    const token = tokenFrom(sent.mails[0].text!);
    await db.loginLink.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await link.action(args(post(`/login/${token}`, {}), { token }))).toEqual({ usable: false });

    expect(await login.action(args(post("/login", { email: "nope" })))).toEqual({ ok: false, error: auth.LOGIN_ERRORS.email });
    for (let i = 0; i < 4; i++) await login.action(args(post("/login", { email: "a@b.com" })));
    expect(await login.action(args(post("/login", { email: "a@b.com" })))).toEqual({ ok: false, error: auth.LOGIN_ERRORS.tooMany });

    expect(auth.safeNext("https://evil.com")).toBe("/dash");
    expect(auth.safeNext("//evil.com")).toBe("/dash");
    expect(auth.safeNext("/dash/questions")).toBe("/dash/questions");
    expect(auth.safeNext("/start")).toBe("/start");
    expect(auth.safeNext("/app")).toBe("/dash");
  });

  it("sends signed-out visitors to sign in, then to add a store, then to the dashboard", async () => {
    const out = await caught(dash.loader(args(new Request("https://usegeo.app/dash"))));
    expect(out.headers.get("Location")).toBe("/login?next=%2Fdash");

    const cookie = await signIn();
    const noStore = await caught(dash.loader(args(new Request("https://usegeo.app/dash", { headers: { cookie } }))));
    expect(noStore.headers.get("Location")).toBe("/start");

    fetched.pages["https://beard.com/meta.json"] = {
      status: 200,
      text: JSON.stringify({ myshopify_domain: "beard-co.myshopify.com", name: "Beard Co", country: "AU", currency: "AUD" }),
    };
    const added = await caught(start.action(args(post("/start", { store: "https://beard.com/" }, cookie))));
    expect(added.headers.get("Location")).toBe("/dash");
    const shop = await db.shop.findUniqueOrThrow({ where: { domain: "beard-co.myshopify.com" } });
    expect(shop).toMatchObject({ source: "web", primaryDomain: "beard.com", name: "Beard Co", country: "AU", currency: "AUD", plan: "free" });
    const { enqueue } = await import("../app/lib/jobs.server");
    expect(enqueue).toHaveBeenCalledWith("onboard", {}, { shopId: shop.id, dedupeKey: `onboard:${shop.id}` });

    const data = await dash.loader(args(new Request("https://usegeo.app/dash", { headers: { cookie } })));
    expect(data).toEqual({ email: "ross@beard.com", store: "Beard Co" });
  });

  it("only adds real Shopify stores, and never one already on GEO", async () => {
    const cookie = await signIn();
    fetched.pages["https://notshop.com/meta.json"] = { status: 404, text: "" };
    expect(await start.action(args(post("/start", { store: "notshop.com" }, cookie)))).toEqual({ error: pc.STORE_ERRORS.notShopify });
    expect(await start.action(args(post("/start", { store: "??" }, cookie)))).toEqual({ error: pc.STORE_ERRORS.address });

    // Installed from Shopify (with its orders) or added by someone else: never handed over.
    await db.shop.create({ data: { domain: "taken.myshopify.com", name: "Taken" } });
    fetched.pages["https://taken.com/meta.json"] = { status: 200, text: JSON.stringify({ myshopify_domain: "taken.myshopify.com" }) };
    expect(await start.action(args(post("/start", { store: "taken.com" }, cookie)))).toEqual({ error: pc.STORE_ERRORS.taken });
    expect((await db.shop.findUniqueOrThrow({ where: { domain: "taken.myshopify.com" } })).userId).toBeNull();
  });

  it("reads the store's public catalog into the product cache and marks products gone from it", async () => {
    const shop = await db.shop.create({ data: { domain: "cat.myshopify.com", primaryDomain: "cat.com", currency: "USD", source: "web" } });
    await db.product.create({ data: { shopId: shop.id, gid: "gid://shopify/Product/9", title: "Old", handle: "old", status: "ACTIVE", syncedAt: new Date(Date.now() - 60_000) } });
    fetched.pages["https://cat.com/products.json?limit=250&page=1"] = {
      status: 200,
      text: JSON.stringify({ products: [{ id: 1, title: "Cat Toy", handle: "cat-toy", variants: [{ price: "9.00" }] }] }),
    };
    expect(await pc.syncPublicCatalog(shop.id)).toBe(1);
    const products = await db.product.findMany({ where: { shopId: shop.id }, orderBy: { title: "asc" } });
    expect(products.map((p) => [p.title, p.status, p.price])).toEqual([
      ["Cat Toy", "ACTIVE", "9.00 USD"],
      ["Old", "DELETED", null],
    ]);
  });

  it("the tracking code runs in Shopify's sandbox and sends a visit and an order with where the shopper came from", async () => {
    const tc = await import("../app/lib/tracking-code.server");
    const code = tc.trackingCode("geo_testkey1234567890");
    const handlers: Record<string, (e: unknown) => Promise<void>> = {};
    const store = (m: Map<string, string>) => ({ getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => void m.set(k, v) });
    const browser = { localStorage: store(new Map()), sessionStorage: store(new Map()) };
    const analytics = { subscribe: (name: string, fn: (e: unknown) => Promise<void>) => void (handlers[name] = fn) };
    const posts: Record<string, unknown>[] = [];
    const fetchStub = async (_u: string, o: { body: string }) => void posts.push(JSON.parse(o.body));
    new Function("analytics", "browser", "fetch", code)(analytics, browser, (u: string, o: { body: string }) => fetchStub(u, o).then(() => ({})));
    expect(Object.keys(handlers).sort()).toEqual(["checkout_completed", "page_viewed"]);

    await handlers.page_viewed({ clientId: "c1", context: { document: { referrer: "https://chatgpt.com/", location: { href: "https://beard.com/products/oil?utm_source=chatgpt.com" } } } });
    await handlers.page_viewed({ clientId: "c1", context: { document: { referrer: "", location: { href: "https://beard.com/cart" } } } }); // same visit: not sent
    await handlers.checkout_completed({
      data: { checkout: { order: { id: "555" }, totalPrice: { amount: 68, currencyCode: "AUD" }, lineItems: [{ title: "Beard Oil", quantity: 2 }], email: "never@sent.com" } },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({ k: "geo_testkey1234567890", ref: "https://chatgpt.com/", cid: "c1" });
    expect(posts[1]).toMatchObject({ k: "geo_testkey1234567890", type: "order", order: "555", total: 68, currency: "AUD", items: [{ title: "Beard Oil", qty: 2 }] });
    expect(posts[1].first).toMatchObject({ ref: "https://chatgpt.com/" });
    expect(JSON.stringify(posts)).not.toContain("never@sent.com");
  });

  it("counts a web store's AI orders from its tracking code, once each, and ignores other keys", async () => {
    const pixel = await import("../app/routes/api.pixel");
    const shop = await db.shop.create({ data: { domain: "px.myshopify.com", primaryDomain: "px.com", currency: "AUD", source: "web", trackKey: "geo_pxkey1234567890ab" } });
    const send = (body: Record<string, unknown>) =>
      pixel.action(args(new Request("https://usegeo.app/api/pixel", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(body) })));

    expect((await send({ k: "geo_pxkey1234567890ab", ref: "https://chatgpt.com/", url: "https://px.com/", cid: "c" })).status).toBe(204);
    expect((await db.shop.findUniqueOrThrow({ where: { id: shop.id } })).pixelId).toBe("custom-pixel");
    expect(await db.aiSession.count({ where: { shopId: shop.id, engine: "chatgpt" } })).toBe(1);

    const order = { k: "geo_pxkey1234567890ab", type: "order", order: "777", total: 50, currency: "AUD", items: [{ title: "Oil", qty: 1 }], first: { ref: "https://www.perplexity.ai/", url: "https://px.com/" }, last: { ref: "", url: "https://px.com/" } };
    await send(order);
    await send(order); // reloaded thank-you page
    await send({ ...order, order: "778", first: { ref: "https://google.com/", url: "https://px.com/" } }); // not from AI
    await send({ ...order, k: "geo_wrongkey123456789", order: "779" });
    const ai = await db.aiOrder.findMany({ where: { shopId: shop.id } });
    expect(ai.map((o) => [o.orderGid, o.engine, o.revenue])).toEqual([["gid://shopify/Order/777", "perplexity", 50]]);
    const day = await db.orderDay.findFirstOrThrow({ where: { shopId: shop.id } });
    expect([day.orders, day.revenue]).toEqual([2, 100]);
  });
});

