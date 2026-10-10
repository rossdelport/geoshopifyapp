import { describe, expect, it } from "vitest";
import { brandsWithFallback, buildReport, extractListBrands, plainSnippet } from "../app/lib/check-report";
import type { CheckAnswer, CheckEngine, CheckSource } from "../app/lib/check-types";

const src = (url: string, type: CheckSource["type"] = "other", isOwn = false): CheckSource => ({
  url,
  domain: new URL(url).hostname.replace(/^www\./, ""),
  title: null,
  type,
  isOwn,
});

const answer = (engine: CheckEngine, o: Partial<CheckAnswer> = {}): CheckAnswer => ({
  question: 0,
  engine,
  run: 1,
  ok: true,
  empty: false,
  named: false,
  position: null,
  brands: [],
  sources: [],
  snippet: "",
  ...o,
});

const product = { brand: "Bondi Beard Co", domain: "bondibeardco.com.au", description: "Short.", hasProductSchema: false };

describe("brands from the answer text (no Claude)", () => {
  const text = `Here are some great options in Australia:

1. **Milkman Beard Oil** – light and great for dry skin.
2. **The Groomed Man Co** — Aussie made.
3. Bulldog Original Beard Oil: easy to find at Chemist Warehouse.
- **Chemist Warehouse** stocks most of these.

**Best for sensitive skin:** look for fragrance-free oils.
- Argan oil: very moisturising.
- Choose a scent you like.

**Bottom line**: pick one and use it daily.`;

  it("reads bold names and list items in order, without headings, retailers or ingredients", () => {
    expect(extractListBrands(text, "beard oil")).toEqual(["Milkman", "The Groomed Man Co", "Bulldog"]);
  });

  it("doesn't mistake ingredients, scents or product types for brands", () => {
    const ingredients = `What to look for:

- **Jojoba Oil** – moisturises.
- **Argan Oil** – softens.
- **Vitamin E** – protects.
- **Sandalwood** – a warm scent.
- **Fragrance Free** – for sensitive skin.
- **Argan Oil Blend** – light.
- **Hydrating Serum** – for dry beards.

1. **Milkman** – light.
2. **The Groomed Man Co** – Aussie made.
3. **Linen House** – not a beard brand, but a real one.`;
    expect(extractListBrands(ingredients, "beard serum")).toEqual(["Milkman", "The Groomed Man Co", "Linen House"]);
    expect(brandsWithFallback([], "- **Jojoba Oil** – moisturises.\n- **Argan Oil** – softens.\n- **Vitamin E** – protects.", ["Bondi Beard Co"], "beard oil")).toEqual([]);
  });

  it("keeps product names when no category is given", () => {
    expect(extractListBrands("1. **Milkman Beard Oil** – nice", "")).toEqual(["Milkman Beard Oil"]);
  });

  it("only steps in when Claude found no one but the merchant", () => {
    const merchant = ["Bondi Beard Co"];
    expect(brandsWithFallback(["Milkman", "Bondi Beard Co"], text, merchant, "beard oil")).toEqual(["Milkman", "Bondi Beard Co"]);
    expect(brandsWithFallback(["Bondi Beard Co"], text, merchant, "beard oil")).toEqual([
      "Milkman",
      "The Groomed Man Co",
      "Bulldog",
      "Bondi Beard Co",
    ]);
    expect(brandsWithFallback([], "No brands here.", merchant, "beard oil")).toEqual([]);
  });
});

describe("plainSnippet", () => {
  it("removes markdown and cuts at a word", () => {
    expect(plainSnippet("## Top picks\n\n**Milkman** is [great](https://x.com) for > dry skin.")).toBe(
      "Top picks\n\nMilkman is great for > dry skin.",
    );
    const long = plainSnippet("word ".repeat(300), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith("word…")).toBe(true);
  });
});

describe("buildReport", () => {
  const roundup = src("https://stuga.com.au/blogs/journal/best-beard-oil", "editorial");
  const own = src("https://bondibeardco.com.au/products/oil", "brand", true);
  const answers: CheckAnswer[] = [
    // ChatGPT names us 2nd in both runs and cites the roundup.
    answer("chatgpt", { named: true, position: 2, brands: ["Milkman", "Bondi Beard Co"], sources: [roundup, roundup] }),
    answer("chatgpt", { run: 2, named: true, position: 2, brands: ["Milkman", "Bondi Beard Co."], sources: [roundup] }),
    // Gemini: not named, but links to our site once.
    answer("gemini", { brands: ["Milkman", "The Groomed Man Co"], sources: [own, roundup] }),
    answer("gemini", { run: 2, brands: ["Groomed Man Co", "Bulldog"] }),
    // Perplexity: one failed, one empty answer.
    answer("perplexity", { ok: false }),
    answer("perplexity", { run: 2, empty: true }),
  ];
  const r = buildReport(answers, product);

  it("scores like the app and counts only answers that came back", () => {
    // chatgpt: 1 + 1 -> 100; gemini: 1/3 + 0 -> 17; perplexity: none -> left out. Average 59.
    expect(r.score).toBe(59);
    expect(r.label).toBe("Growing");
    expect(r.answerCount).toBe(4);
    expect(r.namedCount).toBe(2);
    expect(r.byEngine).toEqual({
      chatgpt: { named: 2, total: 2, score: 100 },
      gemini: { named: 0, total: 2, score: 17 },
      perplexity: { named: 0, total: 0, score: 0 },
    });
  });

  it("ranks competitors, merging spellings and leaving out the brand itself", () => {
    expect(r.competitors).toEqual([
      { name: "Milkman", count: 3, share: 0.75 },
      { name: "The Groomed Man Co", count: 2, share: 0.5 },
      { name: "Bulldog", count: 1, share: 0.25 },
    ]);
  });

  it("ranks sources, once per answer", () => {
    expect(r.sources).toEqual([
      { domain: "stuga.com.au", type: "editorial", count: 3, isOwn: false, exampleUrl: roundup.url },
      { domain: "bondibeardco.com.au", type: "brand", count: 1, isOwn: true, exampleUrl: own.url },
    ]);
  });

  it("gives quick wins based only on what we saw", () => {
    const titles = r.tips.map((t) => t.title);
    expect(titles).toEqual([
      "Gemini doesn't mention you yet",
      "Write a fuller product description",
      "Add product data AI can read",
      "Get featured on stuga.com.au",
    ]);
    expect(r.tips.length).toBeLessThanOrEqual(4);
    expect(r.summary).toBe("Bondi Beard Co came up most on ChatGPT. Milkman was named more often, in 3 answers.");
  });

  it("says plainly when the brand isn't named anywhere", () => {
    const none = buildReport(
      [answer("chatgpt", { brands: ["Milkman"] }), answer("gemini", { brands: ["Milkman", "Bulldog"] })],
      { ...product, description: "x".repeat(400), hasProductSchema: true },
    );
    expect(none.score).toBe(0);
    expect(none.label).toBe("Invisible");
    // Bulldog came up once, so the tip doesn't name it.
    expect(none.tips.map((t) => t.title)).toEqual(["AI doesn't mention Bondi Beard Co yet", "See why AI picks Milkman"]);
    expect(none.summary).toBe("Shoppers asking these questions were pointed to other brands instead, most often Milkman.");
  });

  it("always has at least 2 tips", () => {
    const great = buildReport(
      [answer("chatgpt", { named: true, position: 1, brands: ["Bondi Beard Co"] })],
      { ...product, description: "x".repeat(400), hasProductSchema: true },
    );
    expect(great.score).toBe(100);
    expect(great.tips.length).toBe(2);
    expect(great.tips.map((t) => t.title)).toEqual(["Keep an eye on it every week", "Check more of the questions shoppers ask"]);
    expect(great.summary).toBe("Bondi Beard Co came up in every answer.");
  });
});

describe("buildReport with what we know about the check", () => {
  const roundup = src("https://stuga.com.au/blogs/journal/best-beard-oil", "editorial");
  const rivalBlog = src("https://thegroomedmanco.com.au/blogs/news/best-beard-oil", "editorial");
  const answers: CheckAnswer[] = [
    answer("chatgpt", { brands: ["Milkman", "The Groomed Man Co", "Jojoba Oil"], sources: [rivalBlog, roundup] }),
    answer("chatgpt", { run: 2, brands: ["Milkman", "The Groomed Man Co"], sources: [rivalBlog] }),
    answer("gemini", { brands: ["Milkman", "Cedar Blend"] }),
  ];

  it("with text matching, only lists brands seen in 2 or more answers and says so", () => {
    const r = buildReport(answers, product, [], { textFallback: true });
    expect(r.competitors.map((c) => c.name)).toEqual(["Milkman", "The Groomed Man Co"]);
    expect(r.summary).toContain("simple text matching");
    expect(buildReport(answers, product).competitors.map((c) => c.name)).toEqual(["Milkman", "The Groomed Man Co", "Jojoba Oil", "Cedar Blend"]);
    expect(buildReport(answers, product).summary).not.toContain("text matching");
  });

  it("never suggests getting featured on a competitor's own blog", () => {
    const tips = buildReport(answers, product).tips.map((t) => t.title);
    expect(tips).toContain("Get featured on stuga.com.au");
    expect(tips.join(" ")).not.toContain("thegroomedmanco");
  });

  it("only judges the description's length when we read the real one", () => {
    const short = { ...product, description: "Light beard oil for dry skin.", hasProductSchema: true };
    const fromMeta = buildReport(answers, short, [], { descriptionSource: "meta" }).tips;
    expect(fromMeta.map((t) => t.title)).toContain("Add a full product description");
    expect(fromMeta.map((t) => t.body).join(" ")).not.toMatch(/only \d+ characters/);
    const fromShopify = buildReport(answers, short, [], { descriptionSource: "shopify" }).tips;
    expect(fromShopify.find((t) => t.title === "Write a fuller product description")?.body).toContain("only 29 characters");
  });

  it("doesn't claim the page lacks product data when we never read the page", () => {
    const titles = (pageRead: boolean) => buildReport(answers, product, [], { pageRead }).tips.map((t) => t.title);
    expect(titles(true)).toContain("Add product data AI can read");
    expect(titles(false)).not.toContain("Add product data AI can read");
  });
});
