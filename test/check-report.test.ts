import { describe, expect, it } from "vitest";
import { brandsWithFallback, buildReport, dropPhraseBrands, extractListBrands, isPhraseBrand, plainSnippet, shopDomains } from "../app/lib/check-report";
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

const product = { brand: "Coolabah Grooming Co", domain: "coolabahgrooming.com.au", description: "Short.", hasProductSchema: false };

describe("brands from the answer text (no Claude)", () => {
  const text = `Here are some great options in Australia:

1. **Milkman Beard Oil** \u2013 light and great for dry skin.
2. **The Groomed Man Co** \u2014 Aussie made.
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

- **Jojoba Oil** \u2013 moisturises.
- **Argan Oil** \u2013 softens.
- **Vitamin E** \u2013 protects.
- **Sandalwood** \u2013 a warm scent.
- **Fragrance Free** \u2013 for sensitive skin.
- **Argan Oil Blend** \u2013 light.
- **Hydrating Serum** \u2013 for dry beards.

1. **Milkman** \u2013 light.
2. **The Groomed Man Co** \u2013 Aussie made.
3. **Linen House** \u2013 not a beard brand, but a real one.`;
    expect(extractListBrands(ingredients, "beard serum")).toEqual(["Milkman", "The Groomed Man Co", "Linen House"]);
    expect(brandsWithFallback([], "- **Jojoba Oil** \u2013 moisturises.\n- **Argan Oil** \u2013 softens.\n- **Vitamin E** \u2013 protects.", ["Coolabah Grooming Co"], "beard oil")).toEqual([]);
  });

  it("keeps product names when no category is given", () => {
    expect(extractListBrands("1. **Milkman Beard Oil** \u2013 nice", "")).toEqual(["Milkman Beard Oil"]);
  });

  it("only steps in when Claude found no one but the merchant", () => {
    const merchant = ["Coolabah Grooming Co"];
    expect(brandsWithFallback(["Milkman", "Coolabah Grooming Co"], text, merchant, "beard oil")).toEqual(["Milkman", "Coolabah Grooming Co"]);
    expect(brandsWithFallback(["Coolabah Grooming Co"], text, merchant, "beard oil")).toEqual([
      "Milkman",
      "The Groomed Man Co",
      "Bulldog",
      "Coolabah Grooming Co",
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
    expect(long.endsWith("word\u2026")).toBe(true);
  });

  // Real answers from the live check: markdown escapes, HTML entities and source links glued together.
  it("unescapes markdown backslash escapes", () => {
    expect(plainSnippet("Try Milkman Beard Oil\\. It costs \\$29.67 at Shaver Shop\\.")).toBe(
      "Try Milkman Beard Oil. It costs $29.67 at Shaver Shop.",
    );
    expect(plainSnippet("1\\. Bulldog \\(30ml\\) \\- 5\\* rated \\#1 pick \\_easy\\_")).toBe("1. Bulldog (30ml) - 5* rated #1 pick _easy_");
    // Escaped twice by a provider: still plain.
    expect(plainSnippet("Only \\\\$24.95\\\\.")).toBe("Only $24.95.");
  });

  it("decodes HTML entities", () => {
    expect(plainSnippet("Salt &amp; Stone &lt;3 &quot;light&quot; it&#39;s&nbsp;great, &#36;30 &#x2B; free &apos;shipping&apos;")).toBe(
      "Salt & Stone <3 \"light\" it's great, $30 + free 'shipping'",
    );
    // An entity for a markdown character stays text.
    expect(plainSnippet("Rated 5&#42; by &#42;everyone&#42;")).toBe("Rated 5* by *everyone*");
  });

  it("keeps link text, keeps glued source titles apart and drops citation markers", () => {
    expect(
      plainSnippet(
        "Milkman is light.[Best Beard Oils Australia | Beard Grooming](https://www.canstarblue.com.au/x)[Beard Guru](https://beardguru.com.au/y)",
      ),
    ).toBe("Milkman is light. Best Beard Oils Australia | Beard Grooming, Beard Guru");
    expect(plainSnippet("The best overall pick is **Jack Black Beard Oil**.[3][8] Also try Bulldog.[2, 4]")).toBe(
      "The best overall pick is Jack Black Beard Oil. Also try Bulldog.",
    );
    expect(plainSnippet("Good for dry skin.Canstar Blue+2 Milkman uses aloe vera.")).toBe("Good for dry skin. Canstar Blue Milkman uses aloe vera.");
    expect(plainSnippet("See [Stuga](https://stuga.com.au/a_(b)) and ([Choice](https://choice.com.au)).")).toBe("See Stuga and (Choice).");
    expect(plainSnippet("![bottle](https://x.com/a.png)Pick [Milkman][1].\n\n[1]: https://milkman.com.au")).toBe("Pick Milkman.");
  });

  it("strips headings, emphasis, list markers, quotes and tables, and collapses spaces", () => {
    const md = [
      "### Best beard oils in Australia ###",
      "",
      "",
      "",
      "*   **Milkman**   \u00b7   *light* and __non-greasy__",
      "- ~~Old pick~~ `Bulldog`",
      "2) Professor Fuzzworthy",
      "> Great for _dry skin_ under a beard",
      "---",
      "| Brand | Price |",
      "|:---|---:|",
      "| Milkman | $30 |",
      "#1 pick: snake_case_name stays",
    ].join("\n");
    expect(plainSnippet(md)).toBe(
      [
        "Best beard oils in Australia",
        "",
        "Milkman \u00b7 light and non-greasy",
        "Old pick Bulldog",
        "2. Professor Fuzzworthy",
        "Great for dry skin under a beard",
        "",
        "Brand, Price",
        "",
        "Milkman, $30",
        "#1 pick: snake_case_name stays",
      ].join("\n"),
    );
  });

  it("turns spaced dashes into plain punctuation", () => {
    expect(plainSnippet("1. **Milkman Beard Oil** \u2013 light.\n- **Bulldog** \u2014 cheap, and easy \u2014 to find\nFrom $20 \u2013 $30 and 10\u201320 ml. Great\u2014really.")).toBe(
      "1. Milkman Beard Oil: light.\nBulldog: cheap, and easy, to find\nFrom $20 to $30 and 10\u201320 ml. Great, really.",
    );
  });

  it("handles ranges with units, one-sided dashes, labels in every sentence, and keeps look-alikes", () => {
    expect(plainSnippet("Sizes 30 ml \u2013 50 ml, or 5% \u2013 10% off.")).toBe("Sizes 30 ml to 50 ml, or 5% to 10% off.");
    expect(plainSnippet("Milkman \u2013light and Bulldog\u2014 cheap")).toBe("Milkman: light and Bulldog, cheap");
    expect(plainSnippet("Best overall \u2014 Milkman. Budget \u2014 Bulldog. It is light \u2014 and cheap.")).toBe(
      "Best overall: Milkman. Budget: Bulldog. It is light, and cheap.",
    );
    expect(plainSnippet("[Update]: prices changed today.\n\n[1]: https://milkman.com.au \"Milkman\"")).toBe("[Update]: prices changed today.");
    expect(plainSnippet("Rich in Omega+3 oils. Also Omega+3.")).toBe("Rich in Omega+3 oils. Also Omega+3.");
    expect(plainSnippet("Good for dry skin.Canstar Blue+2\nMilkman+1")).toBe("Good for dry skin. Canstar Blue\nMilkman");
  });

  it("cuts long answers at a word, with an ellipsis", () => {
    const text = `Milkman Beard Oil is light, ${"and very nice ".repeat(80)}`;
    const out = plainSnippet(text, 100);
    expect(out.length).toBeLessThanOrEqual(101);
    expect(out.endsWith("\u2026")).toBe(true);
    expect(out).toMatch(/(and|very|nice)\u2026$/);
    expect(plainSnippet("Short and sweet.", 100)).toBe("Short and sweet.");
    expect(plainSnippet(`${"x".repeat(120)}`, 100)).toBe(`${"x".repeat(100)}\u2026`);
  });
});

describe("phrases that are not brands", () => {
  const filter = {
    category: "beard oil",
    productType: "Beard Care",
    merchantNames: ["Coolabah Grooming Co", "Coolabahgrooming"],
    merchantDomains: ["coolabahgrooming.com.au", "coolabah-grooming.myshopify.com"],
  };

  it("drops clear phrases from any list: describing words plus a marker (best, top, made, store, a year, the category)", () => {
    for (const phrase of [
      "Australian Made",
      "Best Beard Oil Australia",
      "Best Beard Oil Australia 2026",
      "Top 10 Beard Oils",
      "Made in Australia",
      "Made in Melbourne", // where it's made, not who makes it
      "The Best Brand",
      "Online Store",
      "Beard Oil Australia",
      "Certified Organic",
      "Beard Oil Reviews",
    ]) {
      expect(isPhraseBrand(phrase, filter), phrase).toBe(true);
      expect(isPhraseBrand(phrase, { ...filter, fromText: true }), phrase).toBe(true);
    }
  });

  it("drops any name made only of describing words when it was read from the text, not from Claude's list", () => {
    for (const phrase of ["Pure Organic", "Natural", "Fragrance-Free", "New Zealand", "Beard Care", "Men's Grooming", "Jojoba"]) {
      expect(isPhraseBrand(phrase, { ...filter, fromText: true }), phrase).toBe(true);
      expect(isPhraseBrand(phrase, filter), phrase).toBe(false); // Claude listed it as a brand: no marker, so kept
    }
  });

  it("keeps real brands, even ones made of describing, place or number words", () => {
    for (const brand of ["Milkman", "The Groomed Man Co", "Bulldog", "Jericho Australia", "Oz Naturals", "Natural Instinct", "The Body Shop", "Every Man Jack", "Linen House", "Melbourne Made", "Organic Care"]) {
      expect(isPhraseBrand(brand, filter), brand).toBe(false);
    }
    // Brands that are all describing or place words, each checked in its own category (from Claude's list).
    const inCategory: [string, string][] = [
      ["Aussie", "shampoo"],
      ["Organic Care", "shampoo"],
      ["Cotton On", "t-shirt"],
      ["Women's Best", "protein powder"],
      ["Global", "kitchen knife"],
      ["Kiwi", "shoe polish"],
      ["Bamboo Body", "bamboo clothing"],
      ["100% Pure", "lip balm"],
      ["4711", "cologne"],
      ["Clean", "perfume"],
      ["Essentials", "hoodie"],
      ["Pure", "body wash"],
      ["New Zealand Natural", "ice cream"],
    ];
    for (const [brand, category] of inCategory) {
      expect(isPhraseBrand(brand, { category }), `${brand} (${category})`).toBe(false);
    }
    // Read from the text, a single word that is often a brand, and names with a place or number, stay too.
    for (const brand of ["Aussie", "Kiwi", "Global", "Cotton", "Bamboo", "100% Pure", "4711", "Melbourne Made", "Bulldog", "Clean"]) {
      expect(isPhraseBrand(brand, { category: "beard oil", fromText: true }), brand).toBe(false);
    }
  });

  it("drops shops: known retailers and the ones the answer cites", () => {
    expect(isPhraseBrand("Chemist Warehouse", filter)).toBe(true);
    expect(isPhraseBrand("Amazon Australia", filter)).toBe(true);
    expect(isPhraseBrand("Beard Guru", filter)).toBe(false);
    expect(isPhraseBrand("Beard Guru", { ...filter, retailerDomains: ["beardguru.com.au"] })).toBe(true);
  });

  it("only checks names against shops our own rules know, not every site Claude called a retailer", () => {
    const cited = [
      { url: "https://www.chemistwarehouse.com.au/buy/123/beard-oil", domain: "chemistwarehouse.com.au" },
      { url: "https://www.amazon.com.au/dp/B01", domain: "amazon.com.au" },
      // A brand's own shop that Claude typed "retailer" because it sells a range.
      { url: "https://thegroomedmanco.com.au/products/beard-oil", domain: "thegroomedmanco.com.au" },
      { url: "https://thegroomedmanco.com.au/", domain: "thegroomedmanco.com.au" },
    ];
    const shops = shopDomains(cited);
    expect(shops).toEqual(["chemistwarehouse.com.au", "amazon.com.au"]);
    expect(isPhraseBrand("The Groomed Man Co", { ...filter, retailerDomains: shops })).toBe(false);
    expect(dropPhraseBrands(["The Groomed Man Co", "Chemist Warehouse", "Milkman"], { ...filter, retailerDomains: shops })).toEqual(["The Groomed Man Co", "Milkman"]);
  });

  it("never drops the merchant, but drops its domain words when they aren't its brand", () => {
    expect(isPhraseBrand("Coolabah Grooming Co.", filter)).toBe(false);
    expect(isPhraseBrand("Coolabah Grooming", filter)).toBe(false);
    // A store whose brand isn't its (generic) domain: the domain words are not a brand mention.
    const generic = { category: "beard oil", merchantNames: ["Coolabah Grooming Co", "Bestbeardoilaustralia"], merchantDomains: ["bestbeardoilaustralia.com.au"] };
    expect(isPhraseBrand("Best Beard Oil Australia", generic)).toBe(true);
    expect(isPhraseBrand("Bestbeardoilaustralia", generic)).toBe(true);
    // The main brand is always kept, even when it's all describing words.
    expect(isPhraseBrand("Pure Organic Co.", { category: "beard oil", merchantNames: ["Pure Organic Co"] })).toBe(false);
  });

  it("filters a list and keeps its order", () => {
    expect(
      dropPhraseBrands(["Australian Made", "Milkman", "Best Beard Oil Australia", "Coolabah Grooming Co", "Aussie", "Top 10 Beard Oils", "Bulldog"], filter),
    ).toEqual(["Milkman", "Coolabah Grooming Co", "Aussie", "Bulldog"]);
    expect(dropPhraseBrands(["Milkman", "Pure Organic", "Natural", "Bulldog"], { ...filter, fromText: true })).toEqual(["Milkman", "Bulldog"]);
  });
});

describe("buildReport", () => {
  const roundup = src("https://stuga.com.au/blogs/journal/best-beard-oil", "editorial");
  const own = src("https://coolabahgrooming.com.au/products/oil", "brand", true);
  const answers: CheckAnswer[] = [
    // ChatGPT names us 2nd in both runs and cites the roundup.
    answer("chatgpt", { named: true, position: 2, brands: ["Milkman", "Coolabah Grooming Co"], sources: [roundup, roundup] }),
    answer("chatgpt", { run: 2, named: true, position: 2, brands: ["Milkman", "Coolabah Grooming Co."], sources: [roundup] }),
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
      { domain: "coolabahgrooming.com.au", type: "brand", count: 1, isOwn: true, exampleUrl: own.url },
    ]);
  });

  it("gives quick wins based only on what we saw", () => {
    const titles = r.tips.map((t) => t.title);
    expect(titles).toEqual([
      "Gemini doesn’t mention you yet",
      "Write a fuller product description",
      "Add product data AI can read",
      "Get featured on stuga.com.au",
    ]);
    expect(r.tips.length).toBeLessThanOrEqual(4);
    expect(r.summary).toBe("Coolabah Grooming Co came up most on ChatGPT. Milkman was named more often, in 3 answers.");
  });

  it("says plainly when the brand isn't named anywhere", () => {
    const none = buildReport(
      [answer("chatgpt", { brands: ["Milkman"] }), answer("gemini", { brands: ["Milkman", "Bulldog"] })],
      { ...product, description: "x".repeat(400), hasProductSchema: true },
    );
    expect(none.score).toBe(0);
    expect(none.label).toBe("Not named yet");
    // Bulldog came up once, so the tip doesn't name it.
    expect(none.tips.map((t) => t.title)).toEqual(["AI doesn’t mention Coolabah Grooming Co yet", "See why AI picks Milkman"]);
    expect(none.summary).toBe("Shoppers asking these questions were pointed to other brands instead, most often Milkman.");
  });

  it("always has at least 2 tips", () => {
    const great = buildReport(
      [answer("chatgpt", { named: true, position: 1, brands: ["Coolabah Grooming Co"] })],
      { ...product, description: "x".repeat(400), hasProductSchema: true },
    );
    expect(great.score).toBe(100);
    expect(great.tips.length).toBe(2);
    expect(great.tips.map((t) => t.title)).toEqual(["Keep an eye on it every week", "Check more of the questions shoppers ask"]);
    expect(great.summary).toBe("Coolabah Grooming Co came up in every answer.");
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
