import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import type { CheckAnswer, CheckView } from "../app/lib/check-types";

vi.mock("../app/lib/check.server", () => ({ createCheck: vi.fn(), getCheckView: vi.fn(), getCheckUrl: vi.fn() }));

const { createCheck, getCheckView, getCheckUrl } = await import("../app/lib/check.server");
const { action } = await import("../app/routes/check._index");
const { loader } = await import("../app/routes/check.$id");
const { CheckFailed, CheckForm, CheckIntro, CheckPerks, CheckReport, CheckRunning, ProductCard, checkedLine, highlightSegments, stepIndex } =
  await import("../app/components/check-ui");

const post = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
  action({
    request: new Request("https://geo.test/check", { method: "POST", body: new URLSearchParams(fields), headers }),
    params: {},
    context: {},
  } as unknown as ActionFunctionArgs);

const answer = (over: Partial<CheckAnswer>): CheckAnswer => ({
  question: 0,
  engine: "chatgpt",
  run: 1,
  ok: true,
  empty: false,
  named: false,
  position: null,
  brands: [],
  sources: [],
  snippet: "",
  ...over,
});

const doneView: CheckView = {
  id: "ckabc123",
  status: "done",
  step: "Done",
  country: "AU",
  createdAt: "2026-10-10T00:00:00.000Z",
  product: {
    url: "https://coolabahgrooming.com.au/products/sandalwood-beard-oil",
    domain: "coolabahgrooming.com.au",
    title: "Sandalwood Beard Oil",
    brand: "Coolabah Grooming Co",
    productType: "Beard oil",
    category: "beard oil",
    description: "A light beard oil.",
    price: "34.00",
    currency: "AUD",
    image: "javascript:alert(1)",
    isShopify: true,
    shopDomain: "coolabah-grooming.myshopify.com",
    hasProductSchema: false,
  },
  questions: [{ text: "best beard oil for dry skin in Australia", keyword: "beard oil dry skin" }],
  total: 18,
  done: 18,
  answers: [
    answer({ named: true, position: 2, brands: ["Milkman", "Coolabah Grooming Co"], snippet: "Try Milkman or Coolabah Grooming Co. Boldly scented <script>x</script>." }),
    answer({ run: 2, brands: ["Milkman"], snippet: "Milkman is popular." }),
    answer({ engine: "gemini", ok: false }),
  ],
  report: {
    score: 33,
    label: "Growing",
    namedCount: 1,
    answerCount: 2,
    byEngine: {
      chatgpt: { named: 1, total: 2, score: 33 },
      gemini: { named: 0, total: 0, score: 0 },
      perplexity: { named: 0, total: 0, score: 0 },
    },
    competitors: [{ name: "Milkman", count: 2, share: 1 }],
    sources: [{ domain: "stuga.com.au", type: "editorial", count: 2, isOwn: false, exampleUrl: "https://stuga.com.au/best-beard-oil" }],
    tips: [{ title: "Get onto stuga.com.au", body: "AI leans on this roundup." }],
    summary: "ChatGPT named you once.",
  },
  error: null,
  installUrl: "/auth/login?shop=coolabah-grooming.myshopify.com",
};

beforeEach(() => {
  vi.mocked(createCheck).mockReset();
});

describe("POST /check", () => {
  it("starts a check with the visitor's IP and goes to the report page (no country: the check finds it)", async () => {
    vi.mocked(createCheck).mockResolvedValue({ ok: true, id: "ck1" });
    const res = (await post(
      { url: " coolabahgrooming.com.au/products/oil ", website: "" },
      { "x-real-ip": "203.0.113.9", "x-forwarded-for": "6.6.6.6, 203.0.113.9" },
    )) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/check/ck1");
    expect(createCheck).toHaveBeenCalledWith({ url: "coolabahgrooming.com.au/products/oil", country: null, ip: "203.0.113.9", honeypot: "" });
  });

  it("still passes on the country an old form sends", async () => {
    vi.mocked(createCheck).mockResolvedValue({ ok: true, id: "ck1" });
    await post({ url: "coolabahgrooming.com.au/products/oil", country: "NZ", website: "" }, { "x-real-ip": "203.0.113.9" });
    expect(createCheck).toHaveBeenCalledWith({ url: "coolabahgrooming.com.au/products/oil", country: "NZ", ip: "203.0.113.9", honeypot: "" });
  });

  it("falls back to the last x-forwarded-for entry and passes the spam trap through", async () => {
    vi.mocked(createCheck).mockResolvedValue({ ok: false, error: "Something went wrong. Please try again." });
    const res = await post({ url: "x.com/products/a", website: "spam" }, { "x-forwarded-for": "6.6.6.6, 198.51.100.4" });
    expect(createCheck).toHaveBeenCalledWith({ url: "x.com/products/a", country: null, ip: "198.51.100.4", honeypot: "spam" });
    expect(res).toEqual({ error: "Something went wrong. Please try again.", url: "x.com/products/a" });
  });

  it("refuses posts from other websites", async () => {
    const others: Record<string, string>[] = [{ origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }, { origin: "null" }];
    for (const headers of others) {
      const res = (await post({ url: "x.com/products/a" }, headers)) as unknown as { data: { error: string }; init: { status: number } };
      expect(res.init.status).toBe(403);
      expect(res.data.error).toBe("Please start your check from the GEO website.");
    }
    expect(createCheck).not.toHaveBeenCalled();
    // Our own pages are fine.
    vi.mocked(createCheck).mockResolvedValue({ ok: true, id: "ck2" });
    const ok = (await post({ url: "x.com/products/a" }, { origin: "https://geo.test", "sec-fetch-site": "same-origin" })) as Response;
    expect(ok.status).toBe(302);
  });

  it("refuses bodies far bigger than the form", async () => {
    const res = (await post({ url: "x.com/products/a", website: "a".repeat(20_000) })) as unknown as { init: { status: number } };
    expect(res.init.status).toBe(413);
    const declared = (await post({ url: "x.com/products/a" }, { "content-length": "900000000" })) as unknown as { init: { status: number } };
    expect(declared.init.status).toBe(413);
    expect(createCheck).not.toHaveBeenCalled();
  });

  it("shows a friendly error when starting the check throws", async () => {
    vi.mocked(createCheck).mockRejectedValue(new Error("db down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await post({ url: "x.com/products/a" });
    expect(res).toMatchObject({ error: "Something went wrong. Please try again." });
    quiet.mockRestore();
  });
});

describe("GET /check/:id", () => {
  const load = (id: string) =>
    loader({ request: new Request(`https://geo.test/check/${id}`), params: { id }, context: {} } as unknown as LoaderFunctionArgs);

  it("404s for unknown or odd ids", async () => {
    vi.mocked(getCheckView).mockResolvedValue(null);
    await expect(load("nope")).rejects.toMatchObject({ status: 404 });
    await expect(load("../../etc")).rejects.toMatchObject({ status: 404 });
  });

  it("returns the check", async () => {
    vi.mocked(getCheckView).mockResolvedValue(doneView);
    await expect(load("ckabc123")).resolves.toEqual({ view: doneView, url: null });
  });

  it("returns the link a failed check started with, even with no product", async () => {
    vi.mocked(getCheckView).mockResolvedValue({ ...doneView, status: "failed", product: null, report: null, error: "We couldn't read that page." });
    vi.mocked(getCheckUrl).mockResolvedValue("https://shop.com/products/typo");
    await expect(load("ckabc123")).resolves.toMatchObject({ url: "https://shop.com/products/typo" });
  });
});

describe("report page", () => {
  it("highlights brand names as whole words, marking the visitor's own brand", () => {
    const segs = highlightSegments("Milkman, Coolabah Grooming Co and Boldly. coolabah grooming co again", ["Milkman", "Coolabah Grooming Co", "Bold"], ["Coolabah Grooming Co"]);
    expect(segs.filter((s) => s.kind)).toEqual([
      { text: "Milkman", kind: "brand" },
      { text: "Coolabah Grooming Co", kind: "you" },
      { text: "coolabah grooming co", kind: "you" },
    ]);
    expect(segs.map((s) => s.text).join("")).toBe("Milkman, Coolabah Grooming Co and Boldly. coolabah grooming co again");
    expect(highlightSegments("plain", [], [])).toEqual([{ text: "plain", kind: null }]);
  });

  it("matches a name that ends in a full stop with or without it", () => {
    const segs = highlightSegments("Ridgeback Beard Co: a favourite. Ridgeback Beard Co. again", ["Ridgeback Beard Co."], []);
    expect(segs.filter((s) => s.kind).map((s) => s.text)).toEqual(["Ridgeback Beard Co", "Ridgeback Beard Co."]);
    expect(segs.map((s) => s.text).join("")).toBe("Ridgeback Beard Co: a favourite. Ridgeback Beard Co. again");
  });

  it("knows which step is running", () => {
    expect(stepIndex({ status: "queued", product: null, questions: [] })).toBe(0);
    expect(stepIndex({ status: "reading", product: doneView.product, questions: [] })).toBe(1);
    expect(stepIndex({ status: "asking", product: doneView.product, questions: doneView.questions })).toBe(2);
    expect(stepIndex({ status: "writing", product: doneView.product, questions: doneView.questions })).toBe(3);
  });

  it("renders the finished report safely", () => {
    const html = renderToStaticMarkup(createElement(CheckReport, { view: doneView }));
    expect(html).toContain("AI named Coolabah Grooming Co in 1 of 2 answers");
    expect(html).toContain("Who AI recommends instead");
    expect(html).toContain("Named in 1 of 2");
    expect(html).toContain('<mark class="ck-hl-you">Coolabah Grooming Co</mark>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('href="/auth/login?shop=coolabah-grooming.myshopify.com"');
    expect(html).toContain('href="/#check"');
    // Honest about what's free: the first scan is; weekly tracking and fixes are the paid plan, after a trial.
    expect(html).toContain("Install GEO: first scan free");
    // The closing card says what GEO is for, and only claims the orders it can trace.
    expect(html).toContain("Help AI recommend you, every week");
    expect(html).toContain("counts the orders it can trace back to AI");
    expect(html).not.toContain("orders AI sends you");
    expect(html).toContain("Core is US$49 a month after a 7-day free trial.");
    expect(html).not.toContain("Install GEO free");
    expect(html).toContain("What to fix first");
    expect(html).not.toMatch(/[\u2014\u2013]/); // no em or en dashes in the copy
    expect(html).not.toMatch(/real buyer questions/i);
  });

  it("labels every brand's website as a brand site (we don't guess who is a rival)", () => {
    const view: CheckView = {
      ...doneView,
      report: {
        ...doneView.report!,
        sources: [
          { domain: "milkman.com.au", type: "brand", count: 2, isOwn: false, exampleUrl: "https://milkman.com.au/products/oil" },
          { domain: "coolabahgrooming.com.au", type: "brand", count: 1, isOwn: true, exampleUrl: "https://coolabahgrooming.com.au/products/oil" },
        ],
      },
    };
    const html = renderToStaticMarkup(createElement(CheckReport, { view }));
    expect(html).not.toContain("Competitor site");
    expect(html.match(/Brand site/g)).toHaveLength(2);
    expect(html).toContain("You’re on it");
  });

  it("shows the form with the error on the /check page", () => {
    const html = renderToStaticMarkup(createElement(CheckForm, { url: "x.com", error: "This connection has reached the free check limit for now (3 checks in 24 hours)." }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("This connection has reached the free check limit for now (3 checks in 24 hours).");
    expect(html).toContain('value="x.com"');
  });

  it("renders the /check start page: the link box, the button and what the report shows", () => {
    const html = renderToStaticMarkup(createElement("div", null, createElement(CheckIntro, {}), createElement(CheckPerks)));
    expect(html).toContain("Does AI recommend your product?");
    expect(html).toContain('action="/check"');
    for (const field of ['name="url"', 'name="website"']) expect(html).toContain(field);
    // No country to pick: the check works out where the store is.
    expect(html).not.toContain("<select");
    expect(html).not.toContain('name="country"');
    expect(html).toContain('class="ck-form-glow"');
    expect(html).toContain('<span class="ck-sr">Product link</span>');
    expect(html).toContain("What to fix first");
    expect(html).toContain("Why we ask twice:");
    expect(html).not.toMatch(/[\u2014\u2013]/);
  });

  it("names the shopper country only once the check knows it", () => {
    const reading = renderToStaticMarkup(createElement(ProductCard, { product: null, country: null }));
    expect(reading).toContain("Checked on ChatGPT, Gemini and Perplexity · 3 questions, each asked twice");
    expect(reading).not.toContain("shopper in");
    const store = renderToStaticMarkup(createElement(ProductCard, { product: { ...doneView.product!, countryFrom: "store" }, country: "NZ", done: true }));
    expect(store).toContain("Checked on ChatGPT, Gemini and Perplexity as a shopper in New Zealand (where your store is) · 3 questions, each asked twice");
    expect(store).not.toContain("Wrong country?"); // the shop's own settings: nothing to correct
    expect(checkedLine("GB", "domain")).toContain("as a shopper in the UK (where your store is)");
    // A guess says so; a weak sign or an old check: just the country.
    expect(checkedLine("AU", "default")).toBe(
      "Checked on ChatGPT, Gemini and Perplexity as a shopper in Australia (we couldn’t tell where your store is) · 3 questions, each asked twice",
    );
    expect(checkedLine("AU", "unsupported")).toBe(
      "Your store is in a country we don’t check yet, so we asked ChatGPT, Gemini and Perplexity as a shopper in Australia · 3 questions, each asked twice",
    );
    expect(checkedLine("US", "currency")).toBe("Checked on ChatGPT, Gemini and Perplexity as a shopper in the US · 3 questions, each asked twice");
    expect(checkedLine("CA")).toBe("Checked on ChatGPT, Gemini and Perplexity as a shopper in Canada · 3 questions, each asked twice");
  });

  it("lets the visitor correct a guessed country on the finished report", () => {
    const product = { ...doneView.product!, countryFrom: "default" as const };
    const html = renderToStaticMarkup(createElement(ProductCard, { product, country: "AU", done: true }));
    expect(html).toContain("Wrong country? Check again as a shopper in");
    expect(html).toContain('<form class="ck-country" method="post" action="/check">');
    expect(html).toContain(`<input type="hidden" name="url" value="${product.url}"/>`);
    for (const c of ["NZ", "US", "GB", "CA"]) expect(html).toContain(`name="country" value="${c}"`);
    expect(html).not.toContain('value="AU"'); // not the country it already used
    for (const how of ["unsupported", "language", "currency"] as const) {
      const guess = renderToStaticMarkup(createElement(ProductCard, { product: { ...product, countryFrom: how }, country: "GB", done: true }));
      expect(guess).toContain("Wrong country?");
      expect(guess).not.toContain('value="GB"');
    }
    // Not while the check is running, not for the shop's own settings or web address, not for a chosen country.
    expect(renderToStaticMarkup(createElement(ProductCard, { product, country: "AU" }))).not.toContain("Wrong country?");
    for (const how of ["store", "domain", "chosen"] as const) {
      expect(renderToStaticMarkup(createElement(ProductCard, { product: { ...product, countryFrom: how }, country: "AU", done: true }))).not.toContain("Wrong country?");
    }
    expect(html).not.toMatch(/[\u2014\u2013]/);
  });

  it("shows which link failed and lets the visitor try again", () => {
    const failed: CheckView = { ...doneView, status: "failed", product: null, report: null, answers: [], error: "We couldn’t read that page." };
    const html = renderToStaticMarkup(createElement(CheckFailed, { view: failed, url: "https://shop.com/products/typo" }));
    expect(html).toContain("We couldn’t read that page.");
    expect(html).toContain("<b>https://shop.com/products/typo</b>");
    expect(html).toContain('value="https://shop.com/products/typo"');
    expect(html).toContain('action="/check"');
    expect(html).not.toContain("<select");
  });

  it("renders progress while running", () => {
    const html = renderToStaticMarkup(createElement(CheckRunning, { view: { ...doneView, status: "asking", done: 11, report: null } }));
    expect(html).toContain("<b>11</b> of 18 answers in");
    expect(html).toContain("best beard oil for dry skin in Australia");
    expect(html).toContain("A check usually takes a few minutes. You can leave this page and come back to this link.");
    expect(html).not.toMatch(/[\u2014\u2013]/);
    expect(html).toContain("What’s happening now");
    expect(html).toContain('src="/home/img/clay-magnifier.jpg"');
  });
});
