import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import type { CheckAnswer, CheckView } from "../app/lib/check-types";

vi.mock("../app/lib/check.server", () => ({ createCheck: vi.fn(), getCheckView: vi.fn(), getCheckUrl: vi.fn() }));

const { createCheck, getCheckView, getCheckUrl } = await import("../app/lib/check.server");
const { action } = await import("../app/routes/check._index");
const { loader } = await import("../app/routes/check.$id");
const { CheckFailed, CheckForm, CheckIntro, CheckPerks, CheckReport, CheckShell, ProductCard, checkedLine, highlightSegments } =
  await import("../app/components/check-ui");
const { CheckLive, stageOf, liveAnnouncement } = await import("../app/components/check-live");
const { LeadDialog } = await import("../app/components/check-lead");
const { REPORT_CONSENT_TEXT, TIPS_CONSENT_TEXT } = await import("../app/lib/check-consent");
const text = (html: string) => html.replace(/<[^>]+>/g, "");

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
  joinUrl: "/#waitlist",
  plan: { steps: 4, pageFixes: 3, sitesToPitch: 2, rivalsToStudy: 3 },
  lead: { status: "none", maskedEmail: null },
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
    expect(stageOf({ status: "queued", product: null, questions: [] })).toBe(0);
    expect(stageOf({ status: "reading", product: doneView.product, questions: [] })).toBe(1);
    expect(stageOf({ status: "asking", product: doneView.product, questions: doneView.questions })).toBe(2);
    expect(stageOf({ status: "writing", product: doneView.product, questions: doneView.questions })).toBe(3);
  });

  it("renders the finished report safely", () => {
    const html = renderToStaticMarkup(createElement(CheckReport, { view: doneView }));
    expect(html.replace(/<[^>]+>/g, "")).toContain("AI named Coolabah Grooming Co in 1 of 2 answers");
    expect(html).toContain("Who AI recommends instead");
    expect(html).toContain("Named in 1 of 2");
    expect(html).toContain('<mark class="ck-hl-you">Coolabah Grooming Co</mark>');
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    // No trial and no install: the card sends people to the waitlist, and "Check another product" to the form.
    expect(html).toContain('href="/#waitlist"');
    expect(html).toContain(">Join the waitlist</a>");
    expect(html).toContain('href="/check"');
    // The closing card says what GEO is for, and only claims the orders it can trace.
    expect(html).toContain("Help AI recommend you, every week");
    expect(html).toContain("You see the orders it can trace back to AI.");
    expect(html).not.toContain("orders AI sends you");
    expect(html).toContain("Done for you is A$1,000 a month. Join the waitlist and we’ll reach out shortly.");
    expect(html).not.toMatch(/free trial|Install GEO/);
    expect(html).toContain("What to fix first");
    expect(html).not.toMatch(/[\u2014\u2013]/); // no em or en dashes in the copy
    expect(html).not.toMatch(/real buyer questions/i);
    // The ring shows the same number as the sentence beside it and the "You" row: 1 of 2 answers is 50%.
    expect(html).toContain('aria-label="AI named Coolabah Grooming Co in 50% of answers (1 of 2)"');
    expect(html).toContain('style="--ck-score:50"');
    expect(html).toContain("of answers");
    expect(text(html)).toContain("Growing · score 33/100"); // the score is still there, named
    expect(html).toContain('id="ck-score-h" tabindex="-1"'); // focus lands here when the report arrives
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
    const reading = text(renderToStaticMarkup(createElement(ProductCard, { product: null, country: null })));
    expect(reading).toContain("Checked on ChatGPT, Gemini and Perplexity · 3 questions, each asked twice");
    expect(reading).not.toContain("shopper in");
    // While it runs the line says so, and is about as long as the finished one (so the card keeps its height).
    const running = text(renderToStaticMarkup(createElement(ProductCard, { product: null, country: null, running: true })));
    expect(running).toContain("Checking on ChatGPT, Gemini and Perplexity as a shopper where your store is · 3 questions, each asked twice");
    expect(checkedLine("NZ", "store", true)).toBe(
      "Checking on ChatGPT, Gemini and Perplexity as a shopper in New Zealand (where your store is) · 3 questions, each asked twice",
    );
    const storeHtml = renderToStaticMarkup(createElement(ProductCard, { product: { ...doneView.product!, countryFrom: "store" }, country: "NZ", done: true }));
    // On phones the note in brackets and "each" are left out (.ck-wide), so the line fits in about 3 lines.
    expect(storeHtml).toContain('<span class="ck-wide"> (where your store is)</span>');
    expect(storeHtml).toContain('<span class="ck-wide">each </span>');
    const store = text(storeHtml);
    expect(store).toContain("Checked on ChatGPT, Gemini and Perplexity as a shopper in New Zealand (where your store is) · 3 questions, each asked twice");
    expect(store).not.toContain("Wrong country?"); // the shop's own settings: nothing to correct
    expect(checkedLine("GB", "domain")).toContain("as a shopper in the UK (where your store is)");
    // A guess says so; a weak sign or an old check: just the country.
    expect(checkedLine("US", "default")).toBe(
      "Checked on ChatGPT, Gemini and Perplexity as a shopper in the US (we couldn’t tell where your store is) · 3 questions, each asked twice",
    );
    expect(checkedLine("US", "unsupported")).toBe(
      "We asked ChatGPT, Gemini and Perplexity as a shopper in the US. Pick your country to check again · 3 questions, each asked twice",
    );
    expect(checkedLine("US", "unsupported", true)).toBe("We are asking ChatGPT, Gemini and Perplexity as a shopper in the US · 3 questions, each asked twice");
    // Stores worldwide: any of the 30 countries we check reads naturally.
    expect(checkedLine("DE", "store")).toContain("as a shopper in Germany (where your store is)");
    expect(checkedLine("JP", "domain")).toContain("as a shopper in Japan");
    expect(checkedLine("NL", "store")).toContain("as a shopper in the Netherlands");
    // Checks from before the worldwide launch used Australia for these; they still read correctly.
    expect(checkedLine("AU", "default")).toContain("as a shopper in Australia (we couldn’t tell where your store is)");
    expect(checkedLine("US", "currency")).toBe("Checked on ChatGPT, Gemini and Perplexity as a shopper in the US · 3 questions, each asked twice");
    expect(checkedLine("CA")).toBe("Checked on ChatGPT, Gemini and Perplexity as a shopper in Canada · 3 questions, each asked twice");
  });

  it("lets the visitor correct a guessed country on the finished report", () => {
    const product = { ...doneView.product!, countryFrom: "default" as const };
    const html = renderToStaticMarkup(createElement(ProductCard, { product, country: "AU", done: true }));
    expect(html).toContain("Wrong country? Check again as a shopper in");
    expect(html).toContain('<form class="ck-country" method="post" action="/check">');
    expect(html).toContain(`<input type="hidden" name="url" value="${product.url}"/>`);
    // Worldwide: every country we check, by name, in one list (not only five buttons).
    expect(html).toMatch(/<select id="ck-country-pick"[^>]*name="country"/);
    for (const c of ["NZ", "US", "GB", "CA", "DE", "JP", "FR", "ZA"]) expect(html).toContain(`<option value="${c}"`);
    expect(html).not.toContain('value="AU"'); // not the country it already used
    expect(html).toContain(">Check again</button>");
    const order = ["CA", "DE", "JP", "NZ", "GB", "US"].map((c) => html.indexOf(`value="${c}"`));
    expect([...order].sort((a, b) => a - b)).toEqual(order); // Canada, Germany, Japan, New Zealand, UK, US
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

  it("renders the live check while running: real progress, the questions, no made-up results", () => {
    const view: CheckView = { ...doneView, status: "asking", done: 7, report: null, answers: [], plan: null };
    const html = renderToStaticMarkup(createElement(CheckLive, { view, url: view.product!.url }));
    expect(html).toContain("<b>7</b> of 18 answers in");
    expect(html).toContain('aria-valuenow="7"');
    expect(html).toContain("Checking Coolabah Grooming Co");
    expect(html).toContain("best beard oil for dry skin in Australia");
    // Next to the slow step: the email ask, not "you can leave".
    expect(html).toContain("No need to wait here");
    expect(html).toContain("Email me the report");
    expect(html).toContain("usually 3 to 6 min");
    expect(html).toContain("One dot for every answer we get back (18 in all)");
    expect(html).toContain("Asking ChatGPT, Gemini and Perplexity (now)"); // the step strip, for screen readers
    expect(liveAnnouncement(view)).toBe("Step 3 of 4: Asking ChatGPT, Gemini and Perplexity");
    // 7 of the 18 dots are filled (one per answer in), the rest wait.
    expect(html.match(/class="is-in"/g)).toHaveLength(7);
    expect(html).not.toContain("Milkman"); // no brand names before the report
    expect(html).not.toMatch(/[\u2014\u2013]/);
  });

  it("shows the pasted web address while the page is being read", () => {
    const view: CheckView = { ...doneView, status: "reading", product: null, questions: [], done: 0, report: null, answers: [], plan: null };
    const html = renderToStaticMarkup(createElement(CheckLive, { view, url: "https://coolabahgrooming.com.au/products/oil" }));
    expect(html).toContain("coolabahgrooming.com.au");
    expect(html).toContain("<b>0</b> of 18 answers in");
    expect(html).not.toMatch(/[\u2014\u2013]/);
  });

  it("locks the action plan: no tips or fixes in the page, a button that asks for an email", () => {
    const view: CheckView = {
      ...doneView,
      report: {
        ...doneView.report!,
        tips: [],
        aiReady: {
          score: 50,
          checks: [
            { id: "faq", label: "Answers common questions", pass: false, weight: 50, reason: "We found no questions and answers.", fix: "" },
            { id: "facts", label: "Lists key facts", pass: true, weight: 50, reason: "Size and ingredients are listed.", fix: "" },
          ],
        },
      },
    };
    const html = renderToStaticMarkup(createElement(CheckReport, { view }));
    expect(html).toContain("Your action plan is ready");
    expect(html).toContain("4 steps: 3 fixes for your page, 2 sites to get featured on and 3 rivals to study.");
    // One placeholder card per step, labelled only with the counts the page already has.
    expect(html.match(/class="ck-ghost"/g)).toHaveLength(4);
    expect(html).toContain('<span class="ck-ghost-chip">3 fixes for your page</span>');
    expect(html).toContain('<span class="ck-ghost-chip">2 sites to get featured on</span>');
    expect(html).toContain('<span class="ck-ghost-chip">3 rivals to study</span>');
    expect(html).toContain("Email me my action plan");
    expect(html).toContain("in your emailed action plan");
    expect(html).not.toContain("Get onto stuga.com.au");
    // Once this browser left its email, the page says where it went (masked) instead of asking again.
    const saved: CheckView = { ...view, lead: { status: "sent", maskedEmail: "ro***@gmail.com" } };
    const Page = createRoutesStub([{ path: "/", Component: () => createElement(CheckShell, { lead: saved }, createElement(CheckReport, { view: saved })) }]);
    const sent = renderToStaticMarkup(createElement(Page));
    expect(sent).toContain("Sent to <b>ro***@gmail.com</b>");
    expect(sent).not.toContain("Email me my action plan");
    expect(sent).toContain("Your action plan is in your inbox");
    expect(sent).toContain("ck-plan-badge-tick"); // the lock becomes a letter with a tick
  });

  it("shows the popup with the exact consent words the server stores, and an unticked tips box", () => {
    const props = { id: "ckabc123", reason: "plan" as const, lead: { status: "none" as const, maskedEmail: null }, plan: doneView.plan, onClose: () => {}, onSaved: () => {} };
    const done = renderToStaticMarkup(createElement(LeadDialog, { ...props, running: false }));
    expect(done).toContain(`${REPORT_CONSENT_TEXT} <a href="/privacy"`);
    expect(done).toContain(`<span>${TIPS_CONSENT_TEXT}</span>`);
    expect(done).toMatch(/<input type="checkbox" name="tips" value="1"\/>/); // not checked
    expect(done).toContain("Get your action plan");
    expect(done).toContain("Email me my action plan");
    const running = renderToStaticMarkup(createElement(LeadDialog, { ...props, reason: "away", running: true }));
    expect(running).toContain("Welcome back");
    expect(running).toContain("Get your full report");
    expect(running).toContain("Email me the full report");
    // The consent line no longer repeats the button word for word.
    expect(REPORT_CONSENT_TEXT.startsWith("Email me")).toBe(false);
    expect(done + running).not.toMatch(/[\u2014]|\s\u2013\s/);
  });
});
