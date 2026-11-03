import { describe, expect, it } from "vitest";
import type { CheckAnswer, CheckEngine, CheckSource } from "../app/lib/check-types";
import { PLANS } from "../app/lib/plans";
import {
  EASY_DIFFICULTY,
  MOVE_PLACES,
  PLACES,
  REPORT_TOTAL,
  REPORTS_AT_ONCE,
  SHOWN_MOVES,
  articleSites,
  buildMonths,
  buildScript,
  cleanCandidates,
  cleanMoves,
  dropBrandSearches,
  fallbackMoves,
  guessPlace,
  knownNumbers,
  lockedCount,
  movesNumbersOk,
  noDashes,
  numbersOk,
  parseHosts,
  pickList,
  pickSearchWords,
  reportSlug,
  serpstatSe,
  storyTags,
  summarizeAnswers,
  topQuestions,
  type KeywordStat,
  type Move,
  type MoveFacts,
  type ReportFacts,
} from "../app/lib/store-report";

// A made-up store: none of these brands or numbers are real.
const src = (url: string, o: Partial<CheckSource> = {}): CheckSource => ({
  url,
  domain: new URL(url).hostname.replace(/^www\./, ""),
  title: null,
  type: "editorial",
  isOwn: false,
  ...o,
});

const answer = (o: Partial<CheckAnswer> = {}): CheckAnswer => ({
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
  ...o,
});

const stat = (keyword: string, volume: number, difficulty: number | null = null, geo: string[] = []): KeywordStat => ({ keyword, volume, difficulty, geo });

const facts = (o: Partial<ReportFacts> = {}): ReportFacts => ({
  store: {
    host: "sampledish.com.au",
    name: "Sample Dish Co",
    brand: "Sample Dish Co",
    sells: "Plant-based dish soap for busy Aussie kitchens.",
    category: "dish soap",
    country: "AU",
    countryName: "Australia",
    products: 37,
    productsCapped: false,
    names: ["Sample Dish Co"],
  },
  checkedAt: "2026-11-03T04:00:00.000Z",
  questions: [
    "What's the best natural dish soap in Australia?",
    "Which dish soap is gentle on hands?",
    "What eco dish soap do people recommend in Australia?",
    "Is plant-based dish soap worth it?",
  ],
  answers: 23,
  named: 0,
  rivals: [
    { name: "Fakebrand Eco", count: 9 },
    { name: "Madeup Suds", count: 7 },
    { name: "Pretend Clean", count: 4 },
  ],
  rivalCount: 14,
  sites: [
    { domain: "reviewsite.example", count: 8, url: "https://reviewsite.example/best-dish-soap", title: "Best dish soap 2026" },
    { domain: "shopping.example", count: 5, url: "https://shopping.example/dish", title: null },
    { domain: "forum.example", count: 3, url: "https://forum.example/t/1", title: "Dish soap chat" },
    { domain: "blog.example", count: 2, url: "https://blog.example/post", title: "Eco swaps" },
  ],
  siteCount: 17,
  searchWords: [
    { keyword: "dish soap", volume: 8100, difficulty: 54, place: "Collection page" },
    { keyword: "natural dish soap", volume: 1900, difficulty: 18, place: "Product page" },
    { keyword: "best eco dish soap", volume: 480, difficulty: 22, place: "New guide" },
    { keyword: "dish soap vs dishwashing liquid", volume: 140, difficulty: null, place: "Comparison guide" },
  ],
  searches: 10620,
  picks: null,
  ...o,
});

const EM = /\u2014/;
const SPACED_EN = /\s\u2013|\u2013\s/;
const noBadDashes = (lines: string[]) => {
  for (const l of lines) {
    expect(l).not.toMatch(EM);
    expect(l).not.toMatch(SPACED_EN);
  }
};

describe("reportSlug", () => {
  const free = () => false;

  it("makes a short web-safe name", () => {
    expect(reportSlug("Bondi Wash", free)).toBe("bondi-wash");
    expect(reportSlug("  Café Crème & Co.  ", free)).toBe("cafe-creme-and-co");
    expect(reportSlug("Nature\u2019s Way", free)).toBe("natures-way");
    expect(reportSlug("A--B__C", free)).toBe("a-b-c");
    expect(reportSlug("", free)).toBe("store");
    expect(reportSlug("!!!", free)).toBe("store");
    expect(reportSlug("\u5e97", free)).toBe("store");
  });

  it("keeps it to 40 characters, cut between words", () => {
    const slug = reportSlug("The Very Long Name Of A Small Family Soap Company From Bondi", free);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).toBe("the-very-long-name-of-a-small-family");
    expect(slug.endsWith("-")).toBe(false);
    // One long word can't be cut between words.
    expect(reportSlug("x".repeat(70), free)).toBe("x".repeat(40));
  });

  it("adds -2, -3 when the name is taken", () => {
    const taken = new Set(["bondi-wash", "bondi-wash-2"]);
    expect(reportSlug("Bondi Wash", (s) => taken.has(s))).toBe("bondi-wash-3");
    expect(reportSlug("Other", (s) => taken.has(s))).toBe("other");
  });

  it("goes past 50 with a short counter and never loops forever", () => {
    const taken = new Set(["soap", ...Array.from({ length: 49 }, (_, i) => `soap-${i + 2}`)]);
    const next = reportSlug("Soap", (s) => taken.has(s));
    expect(taken.has(next)).toBe(false);
    expect(next).toMatch(/^soap-[a-z0-9]{1,4}$/);
    // Same taken set, same answer.
    expect(reportSlug("Soap", (s) => taken.has(s))).toBe(next);

    let calls = 0;
    const always = reportSlug("Soap", () => {
      calls++;
      return true;
    });
    expect(always).toMatch(/^soap-[a-z0-9]+$/);
    expect(calls).toBeLessThan(10_000);
  });

  it("always fits the page address rule", () => {
    for (const name of ["Bondi Wash", "Ünïcödé Brånd", "x".repeat(200), "", "&&&"]) {
      expect(reportSlug(name, () => true)).toMatch(/^[a-z0-9-]{1,60}$/);
    }
  });
});

describe("serpstatSe", () => {
  it("maps countries to Serpstat's Google databases", () => {
    expect(serpstatSe("AU")).toBe("g_au");
    expect(serpstatSe("au")).toBe("g_au");
    expect(serpstatSe(" GB ")).toBe("g_uk");
    expect(serpstatSe("US")).toBe("g_us");
    expect(serpstatSe("NZ")).toBe("g_nz");
    expect(serpstatSe("JP")).toBe("g_jp");
    expect(serpstatSe("AE")).toBe("g_ae");
  });

  it("falls back to the US", () => {
    expect(serpstatSe("ZZ")).toBe("g_us");
    expect(serpstatSe("")).toBe("g_us");
  });
});

describe("parseHosts", () => {
  it("cleans addresses however they were pasted", () => {
    const { hosts, bad } = parseHosts("https://www.Store.com/products/x?y=1\nbondiwash.com.au, other-shop.co.nz  http://SHOP.example.org/");
    expect(hosts).toEqual(["store.com", "bondiwash.com.au", "other-shop.co.nz", "shop.example.org"]);
    expect(bad).toEqual([]);
  });

  it("drops repeats, including with and without www", () => {
    expect(parseHosts("store.com\nwww.store.com\nhttps://store.com/").hosts).toEqual(["store.com"]);
    expect(parseHosts("Https://WWW.KoalaEco.com/collections/all?x=1; koalaeco.com;other.com")).toEqual({ hosts: ["koalaeco.com", "other.com"], bad: [], more: [] });
  });

  it("lists the bits that aren't addresses", () => {
    const { hosts, bad } = parseHosts("bondiwash.com hello ross@usegeo.app localhost nope.");
    expect(hosts).toEqual(["bondiwash.com"]);
    expect(bad).toEqual(["hello", "ross@usegeo.app", "localhost", "nope."]);
  });

  it("ignores list markers and brackets", () => {
    expect(parseHosts("1. (store.com)\n2) <other.com>\n- \"third.com\"")).toEqual({ hosts: ["store.com", "other.com", "third.com"], bad: [], more: [] });
  });

  it("keeps at most REPORTS_AT_ONCE, and lists the rest", () => {
    const many = Array.from({ length: 14 }, (_, i) => `store${i}.com`).join("\n");
    const { hosts, more } = parseHosts(`${many}\nstore0.com`);
    expect(hosts).toHaveLength(REPORTS_AT_ONCE);
    expect(hosts[0]).toBe("store0.com");
    expect(more).toEqual(["store10.com", "store11.com", "store12.com", "store13.com"]);
  });

  it("handles nothing", () => {
    expect(parseHosts("")).toEqual({ hosts: [], bad: [], more: [] });
    expect(parseHosts("  \n , ")).toEqual({ hosts: [], bad: [], more: [] });
  });
});

describe("cleanCandidates", () => {
  it("keeps real searches, most searched first", () => {
    const out = cleanCandidates(
      [
        stat(" Dish Soap ", 8100, 54),
        stat("natural dish soap", 1900, 18),
        stat("tiny search", 9),
        stat("diy dish soap", 2000),
        stat("dish soap recipe", 900),
        stat("how to make dish soap", 700),
        stat("homemade dish soap", 600),
        stat("dish soap usa", 500, null, ["usa"]),
        stat("dish soap australia", 400, 12, ["australia"]),
        stat("dish soap sydney nsw", 300, null, ["sydney"]),
        stat("a b c d e f g h i", 300),
        stat("x".repeat(81), 300),
        stat("dish soap", 50),
        stat("eco soap", 400, null),
      ],
      "Australia",
    );
    expect(out.map((s) => s.keyword)).toEqual(["dish soap", "natural dish soap", "dish soap australia", "eco soap"]);
    expect(out[0]).toEqual({ keyword: "dish soap", volume: 8100, difficulty: 54, geo: [] });
  });

  it("dedupes, keeping the higher volume", () => {
    const out = cleanCandidates([stat("soap", 100, 10), stat("SOAP", 300, 40), stat("soap", 200, 20)], "Australia");
    expect(out).toEqual([{ keyword: "soap", volume: 300, difficulty: 40, geo: [] }]);
  });

  it("sorts ties by word", () => {
    expect(cleanCandidates([stat("b soap", 100), stat("a soap", 100)], "Australia").map((s) => s.keyword)).toEqual(["a soap", "b soap"]);
  });

  it("knows the other ways to say the US and the UK", () => {
    const us = cleanCandidates([stat("soap usa", 100, null, ["usa"]), stat("soap united states", 90, null, ["united states"]), stat("soap uk", 80, null, ["uk"])], "the US");
    expect(us.map((s) => s.keyword)).toEqual(["soap usa", "soap united states"]);
    const uk = cleanCandidates([stat("soap uk", 100, null, ["uk"]), stat("soap united kingdom", 90, null, ["united kingdom"]), stat("soap usa", 80, null, ["usa"])], "the UK");
    expect(uk.map((s) => s.keyword)).toEqual(["soap uk", "soap united kingdom"]);
  });

  it("treats a bad difficulty as none", () => {
    expect(cleanCandidates([stat("soap", 100, Number.NaN)], "Australia")[0].difficulty).toBeNull();
  });
});

describe("dropBrandSearches", () => {
  const words = [stat("dish soap", 8100), stat("dawn dish soap", 4000), stat("koala eco dish soap", 900), stat("sample dish co soap", 70), stat("natural dish soap", 1900), stat("dishwashing liquid", 500)];

  it("drops searches that name the store or another brand", () => {
    const out = dropBrandSearches(words, ["Sample Dish Co", "Dawn", "Koala Eco"], "dish soap");
    expect(out.map((w) => w.keyword)).toEqual(["dish soap", "natural dish soap", "dishwashing liquid"]);
  });

  it("never uses a name the category itself contains, so a store called Candles keeps its words", () => {
    const candles = [stat("candles", 9900), stat("soy candles", 1000), stat("yankee candles", 800)];
    expect(dropBrandSearches(candles, ["Candles", "Yankee"], "candles").map((w) => w.keyword)).toEqual(["candles", "soy candles"]);
    expect(dropBrandSearches(words, ["Dish", "Natural"], "natural dish soap")).toHaveLength(words.length);
  });

  it("handles nothing", () => {
    expect(dropBrandSearches([], ["Dawn"], "dish soap")).toEqual([]);
    expect(dropBrandSearches(words, [], "dish soap")).toHaveLength(words.length);
  });
});

describe("guessPlace", () => {
  it("picks a sensible place", () => {
    expect(guessPlace("dish soap vs dishwashing liquid")).toBe("Comparison guide");
    expect(guessPlace("ecover alternative")).toBe("Comparison guide");
    expect(guessPlace("best dish soap")).toBe("New guide");
    expect(guessPlace("What dish soap is safe")).toBe("New guide");
    expect(guessPlace("dish soap for sensitive skin")).toBe("New guide");
    expect(guessPlace("dish soap gift set")).toBe("Collection page");
    expect(guessPlace("cleaning bundle")).toBe("Collection page");
    expect(guessPlace("natural dish soap")).toBe("Product page");
    expect(PLACES).toContain(guessPlace("anything"));
  });

  it("only matches whole words", () => {
    expect(guessPlace("orange dish soap")).toBe("Product page"); // "or" inside "orange"
    expect(guessPlace("bestselling soap")).toBe("Product page");
    expect(guessPlace("sunset candle")).toBe("Product page");
  });
});

describe("pickSearchWords", () => {
  const candidates = [stat("dish soap", 8100, 54), stat("natural dish soap", 1900, 18), stat("best eco dish soap", 480, 22), stat("dish soap refill", 210, 9), stat("soap gift set", 90, null)];

  it("uses Claude's picks with numbers from the candidates only", () => {
    const chosen = [
      { keyword: "Natural Dish Soap", place: "product page", volume: 999_999, difficulty: 1 },
      { keyword: "made up words", place: "New guide" },
      { keyword: "dish soap refill", place: "Somewhere else" },
      { keyword: "natural dish soap", place: "FAQ" },
      { keyword: "dish soap", place: "Collection page" },
    ];
    const out = pickSearchWords(candidates, chosen);
    expect(out).toEqual([
      { keyword: "dish soap", volume: 8100, difficulty: 54, place: "Collection page" },
      { keyword: "natural dish soap", volume: 1900, difficulty: 18, place: "Product page" },
      { keyword: "dish soap refill", volume: 210, difficulty: 9, place: "Product page" },
    ]);
  });

  it("fills from the most searched when fewer than 3 picks survive", () => {
    const out = pickSearchWords(candidates, [{ keyword: "soap gift set", place: "Collection page" }, { keyword: "nope", place: "FAQ" }]);
    expect(out.map((w) => w.keyword)).toEqual(["dish soap", "natural dish soap", "best eco dish soap", "dish soap refill", "soap gift set"]);
    expect(out.find((w) => w.keyword === "best eco dish soap")?.place).toBe("New guide");
  });

  it("without picks, shows the most searched with guessed places", () => {
    const out = pickSearchWords(candidates, null, 3);
    expect(out).toEqual([
      { keyword: "dish soap", volume: 8100, difficulty: 54, place: "Product page" },
      { keyword: "natural dish soap", volume: 1900, difficulty: 18, place: "Product page" },
      { keyword: "best eco dish soap", volume: 480, difficulty: 22, place: "New guide" },
    ]);
  });

  it("keeps to max", () => {
    const many = Array.from({ length: 20 }, (_, i) => stat(`soap ${i}`, 1000 - i));
    expect(pickSearchWords(many, null)).toHaveLength(8);
    expect(pickSearchWords(many, many.map((s) => ({ keyword: s.keyword, place: "FAQ" })), 5)).toHaveLength(5);
  });

  it("returns nothing without candidates", () => {
    expect(pickSearchWords([], [{ keyword: "dish soap", place: "FAQ" }])).toEqual([]);
  });
});

describe("topQuestions", () => {
  it("asks the most searched first, keeping the order on ties", () => {
    const qs = [
      { text: "a", keyword: "unknown" },
      { text: "b", keyword: "Dish Soap" },
      { text: "c", keyword: "eco soap" },
      { text: "d", keyword: "refill" },
      { text: "e", keyword: "eco soap" },
    ];
    const volumes = new Map([
      ["dish soap", 8100],
      ["eco soap", 300],
      ["refill", 300],
    ]);
    expect(topQuestions(qs, volumes).map((q) => q.text)).toEqual(["b", "c", "d", "e"]);
    expect(topQuestions(qs, volumes, 2).map((q) => q.text)).toEqual(["b", "c"]);
    expect(topQuestions(qs, new Map()).map((q) => q.text)).toEqual(["a", "b", "c", "d"]);
    expect(qs[0].text).toBe("a"); // the input isn't changed
  });
});

describe("summarizeAnswers", () => {
  const names = ["Sample Dish Co", "Sample Dish"];
  const answers: CheckAnswer[] = [
    answer({
      named: true,
      position: 2,
      brands: ["Fakebrand Eco", "The Sample Dish Co.", "Madeup Suds"],
      sources: [
        src("https://www.reviewsite.example/best", { title: "Best dish soap" }),
        src("https://reviewsite.example/other"),
        src("https://sampledish.com.au/", { isOwn: true }),
        src("https://sampledish.com/about"),
      ],
    }),
    answer({
      engine: "gemini",
      brands: ["Fakebrand Eco", "fakebrand eco", "Pretend Clean"],
      sources: [src("https://shop.example/dish"), src("https://reviewsite.example/best", { title: "Best dish soap" }), src("https://reviewsite.example/best")],
    }),
    answer({ engine: "perplexity", brands: ["Madeup Suds", "Fakebrand Eco Dish Soap", "AB", "ab"], sources: [src("https://reviewsite.example/other", { title: "Other page" })] }),
    answer({ ok: false, brands: ["Ghost Brand"], sources: [src("https://ghost.example/")] }),
    answer({ empty: true, brands: ["Empty Brand"] }),
  ];
  const s = summarizeAnswers(answers, names);

  it("counts only answers that came back", () => {
    expect(s.answers).toBe(3);
    expect(s.named).toBe(1);
  });

  it("counts rivals once per answer, merging spellings and leaving out the store", () => {
    expect(s.rivals).toEqual([
      { name: "Fakebrand Eco", count: 3 },
      { name: "Madeup Suds", count: 2 },
      { name: "Pretend Clean", count: 1 },
      { name: "AB", count: 1 },
    ]);
    expect(s.rivalCount).toBe(4);
    expect(s.rivals.some((r) => /sample/i.test(r.name))).toBe(false);
    expect(s.rivals.some((r) => r.name === "Ghost Brand" || r.name === "Empty Brand")).toBe(false);
  });

  it("counts sites once per answer and leaves out the store's own site", () => {
    expect(s.sites.map((x) => [x.domain, x.count])).toEqual([
      ["reviewsite.example", 3],
      ["shop.example", 1],
    ]);
    expect(s.siteCount).toBe(2);
    // "/best" (with and without www) and "/other" were each used in 2 answers: the first seen wins.
    expect(s.sites[0].url).toBe("https://www.reviewsite.example/best");
    expect(s.sites[0].title).toBe("Best dish soap");
  });

  it("chooses a site's most-used page and keeps its title", () => {
    const out = summarizeAnswers(
      [
        answer({ sources: [src("https://site.example/a", { title: "A" })] }),
        answer({ sources: [src("https://site.example/b"), src("https://site.example/b")] }),
        answer({ sources: [src("https://site.example/b", { title: "B page" })] }),
      ],
      names,
    );
    expect(out.sites).toEqual([{ domain: "site.example", count: 3, url: "https://site.example/b", title: "B page", type: "editorial" }]);
  });

  it("keeps the top 8 rivals and top 5 sites but counts them all", () => {
    const letters = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima"];
    const many = Array.from({ length: 12 }, (_, i) =>
      answer({ brands: [`Rival ${letters[i]}`, `Rival ${letters[(i + 1) % 12]}`], sources: [src(`https://site${i}.example/`)] }),
    );
    const out = summarizeAnswers(many, names);
    expect(out.rivals).toHaveLength(8);
    expect(out.rivalCount).toBe(12);
    expect(out.sites).toHaveLength(5);
    expect(out.siteCount).toBe(12);
    // Ties go to the first seen.
    expect(out.sites[0].domain).toBe("site0.example");
  });

  it("handles no answers", () => {
    expect(summarizeAnswers([], names)).toEqual({ answers: 0, named: 0, rivals: [], rivalCount: 0, sites: [], siteCount: 0 });
  });

  it("lists only sites a store can get onto, but counts every site", () => {
    const out = summarizeAnswers(
      [
        answer({
          brands: ["Koala Eco", "Earth Choice"],
          sources: [
            src("https://koalaeco.com/products/dish-soap", { type: "brand" }), // a rival's shop
            src("https://koalaeco.com.au/blogs/news/best-dish-soap"), // a rival's own blog
            src("https://www.reddit.com/r/CleaningTips/comments/abc/dish_soap/", { type: "ugc" }),
            src("https://www.youtube.com/watch?v=abc", { type: "ugc" }),
            src("https://www.instagram.com/someone/", { type: "ugc" }),
            src("https://en.wikipedia.org/wiki/Dishwashing_liquid"),
            src("https://www.google.com/search?q=dish+soap"),
            src("https://www.chemistwarehouse.com.au/buy/1/koala-eco-dish-soap", { type: "retailer" }),
            src("https://www.choice.com.au/dish-soap-reviews", { title: "Best dish soaps \u2013 CHOICE" }),
          ],
        }),
      ],
      names,
    );
    expect(out.sites.map((x) => x.domain)).toEqual(["reddit.com", "youtube.com", "chemistwarehouse.com.au", "choice.com.au"]);
    expect(out.siteCount).toBe(9);
    // Each site keeps its page's kind, and page titles lose their dashes.
    expect(out.sites.find((x) => x.domain === "reddit.com")?.type).toBe("ugc");
    expect(out.sites.find((x) => x.domain === "choice.com.au")?.title).toBe("Best dish soaps, CHOICE");
  });

  it("counts a site only in answers where it wasn't a brand's own page", () => {
    const out = summarizeAnswers(
      [
        answer({ sources: [src("https://mixed.example/products/x", { type: "brand" })] }),
        answer({ sources: [src("https://mixed.example/best-soaps")] }),
      ],
      names,
    );
    expect(out.sites).toEqual([{ domain: "mixed.example", count: 1, url: "https://mixed.example/best-soaps", title: null, type: "editorial" }]);
    expect(out.siteCount).toBe(1);
  });

  it("writes rivals' names without dashes", () => {
    expect(summarizeAnswers([answer({ brands: ["Dash \u2014 Co", "Other Brand"] })], names).rivals.map((r) => r.name)).toEqual(["Dash, Co", "Other Brand"]);
  });
});

describe("articleSites", () => {
  it("keeps articles and roundups only", () => {
    const site = (domain: string, url: string, type: CheckSource["type"] | null = null) => ({ domain, count: 1, url, title: null, type });
    const out = articleSites([
      site("reddit.com", "https://www.reddit.com/r/x/comments/1/y/", "ugc"),
      site("youtube.com", "https://www.youtube.com/watch?v=1", "ugc"),
      site("chemistwarehouse.com.au", "https://www.chemistwarehouse.com.au/buy/1", "retailer"),
      site("productreview.com.au", "https://www.productreview.com.au/listings/x", "ugc"),
      site("choice.com.au", "https://www.choice.com.au/best", "editorial"),
      site("oldreport.example", "https://oldreport.example/best"), // saved before sites had a kind
    ]);
    expect(out.map((x) => x.domain)).toEqual(["choice.com.au", "oldreport.example"]);
  });
});

describe("pickList", () => {
  const qs = ["first question", "second question"];
  const a = (question: number, engine: CheckEngine, run: number, brands: string[], o: Partial<CheckAnswer> = {}) => answer({ question, engine, run, brands, ...o });

  it("prefers the top question, ChatGPT first, run 1 first", () => {
    const out = pickList(
      [
        a(0, "gemini", 1, ["G1", "G2"]),
        a(0, "chatgpt", 2, ["C2a", "C2b"]),
        a(0, "chatgpt", 1, ["C1a", "Sample Dish Co", "C1b"], { named: true, position: 2 }),
        a(1, "chatgpt", 1, ["Q1a", "Q1b"]),
      ],
      qs,
    );
    expect(out).toEqual({ question: "first question", engine: "chatgpt", brands: ["C1a", "Sample Dish Co", "C1b"], named: true, position: 2 });
  });

  it("needs 2+ brands from an answer that came back", () => {
    const out = pickList(
      [
        a(0, "chatgpt", 1, ["Only One"]),
        a(0, "gemini", 1, ["X", "Y"], { ok: false }),
        a(0, "gemini", 2, ["X", "Y"], { empty: true }),
        a(0, "perplexity", 2, ["P1", "P2"]),
        a(0, "perplexity", 1, ["P1", "P2", "P3"]),
      ],
      qs,
    );
    expect(out?.engine).toBe("perplexity");
    expect(out?.brands).toEqual(["P1", "P2", "P3"]);
  });

  it("moves on to the next question", () => {
    const out = pickList([a(0, "chatgpt", 1, ["Solo"]), a(1, "gemini", 1, ["A", "B"])], qs);
    expect(out?.question).toBe("second question");
    expect(out?.named).toBe(false);
    expect(out?.position).toBeNull();
  });

  it("keeps at most 8 brands", () => {
    const out = pickList([a(0, "chatgpt", 1, Array.from({ length: 10 }, (_, i) => `B${i}`))], qs);
    expect(out?.brands).toHaveLength(8);
  });

  it("keeps the store's real place when it came after the 8th (askOne keeps it in the last row)", () => {
    const brands = ["B0", "B1", "B2", "B3", "B4", "B5", "B6", "Sample Dish Co"];
    const out = pickList([a(0, "chatgpt", 1, brands, { named: true, position: 10 })], qs);
    expect(out?.position).toBe(10);
    expect(out?.brands.at(-1)).toBe("Sample Dish Co");
  });

  it("returns null when nothing fits", () => {
    expect(pickList([a(0, "chatgpt", 1, ["Solo"])], qs)).toBeNull();
    expect(pickList([], qs)).toBeNull();
    expect(pickList([a(2, "chatgpt", 1, ["A", "B"])], qs)).toBeNull();
  });
});

describe("knownNumbers and numbersOk", () => {
  it("finds every number in the values", () => {
    const known = knownNumbers({ volume: 1900, note: "about 12,400 searches", list: [100, 200], rate: 23.7 }, "24 answers", new Map([["x", 9]]), null, undefined);
    for (const n of ["1900", "12400", "100", "200", "23.7", "23", "24", "9"]) expect(known.has(n)).toBe(true);
    // [100,200] is two numbers, not 100,200.
    expect(known.has("100200")).toBe(false);
  });

  it("reads numbers in text the same way", () => {
    const known = knownNumbers({ volume: 1900, answers: 24, named: 0, difficulty: 18 });
    expect(numbersOk("About 1,900 Google searches a month.", known)).toBe(true);
    expect(numbersOk("AI named you 0 times in 24 answers, difficulty 18.", known)).toBe(true);
    expect(numbersOk("No numbers here.", known)).toBe(true);
  });

  it("rejects an invented number", () => {
    const known = knownNumbers({ volume: 1900, answers: 24 });
    expect(numbersOk("About 2,000 Google searches a month.", known)).toBe(false);
    expect(numbersOk("Sales could grow 40%.", known)).toBe(false);
    expect(numbersOk("Add 5 FAQs.", known)).toBe(false);
    expect(numbersOk("Seen in 24.5 answers.", known)).toBe(false);
  });

  it("always allows 1, 2 and 3, and ordinal words aren't numbers", () => {
    const known = knownNumbers({});
    expect(numbersOk("Step 1, then step 2, then month 3.", known)).toBe(true);
    expect(numbersOk("First, second and third.", known)).toBe(true);
    expect(numbersOk("Do it in 4 steps.", known)).toBe(false);
  });
});

describe("noDashes", () => {
  it("swaps dashes for commas and ranges for 'to'", () => {
    expect(noDashes("Great soap \u2014 made in Bondi")).toBe("Great soap, made in Bondi");
    expect(noDashes("Great soap\u2014made in Bondi")).toBe("Great soap, made in Bondi");
    expect(noDashes("Great soap \u2013 made in Bondi")).toBe("Great soap, made in Bondi");
    expect(noDashes("Costs 10\u201320 dollars")).toBe("Costs 10 to 20 dollars");
    expect(noDashes("Costs 1,900 \u2013 2,400")).toBe("Costs 1,900 to 2,400");
    expect(noDashes("Ends with a dash \u2014")).toBe("Ends with a dash");
    expect(noDashes("\u2014 starts with one")).toBe("starts with one");
    expect(noDashes("Soap \u2014, then more")).toBe("Soap, then more");
    expect(noDashes("Done \u2014.")).toBe("Done.");
  });

  it("leaves plain hyphens and unspaced en dashes between words alone", () => {
    expect(noDashes("Plant-based, eco-friendly soap")).toBe("Plant-based, eco-friendly soap");
    expect(noDashes("Open Mon\u2013Fri")).toBe("Open Mon\u2013Fri");
  });

  it("tidies spaces", () => {
    expect(noDashes("  two  spaces  ")).toBe("two spaces");
  });
});

// What a move may quote: the numbers Claude saw, each tied to its search word, site or brand.
const moveFacts = (o: Partial<MoveFacts> = {}): MoveFacts => ({
  answers: 24,
  named: 2,
  rivalCount: 17,
  siteCount: 23,
  products: 34,
  questions: ["What's the best natural dish soap in Australia?"],
  position: 4,
  keywords: [
    { keyword: "natural dish soap", volume: 1900, difficulty: 14 },
    { keyword: "dish soap refill", volume: 590, difficulty: 22 },
  ],
  rivals: [{ name: "Fern & Suds", count: 11 }],
  sites: [
    { domain: "reviewsite.example", count: 8 },
    { domain: "choice.com.au", count: 9 },
  ],
  brands: ["Little Kettle"],
  ...o,
});

describe("movesNumbersOk", () => {
  const f = moveFacts();

  it("lets a search word, site or brand carry only its own numbers", () => {
    expect(movesNumbersOk('Put "natural dish soap" in your title. About 1,900 searches a month, difficulty 14 of 100.', f)).toBe(true);
    expect(movesNumbersOk("Get onto choice.com.au. AI used it in 9 of 24 answers.", f)).toBe(true);
    expect(movesNumbersOk("Compare your soap with Fern & Suds. AI named them in 11 answers.", f)).toBe(true);
    // Another word's searches, or a difficulty given as a count.
    expect(movesNumbersOk('Aim your refill page at "dish soap refill". About 1,900 searches a month.', f)).toBe(false);
    expect(movesNumbersOk("Get onto choice.com.au. AI used it in 14 of 24 answers.", f)).toBe(false);
    expect(movesNumbersOk("Get onto choice.com.au. AI used it in 8 of 24 answers.", f)).toBe(false); // that's reviewsite.example's
    // A brand with no count can't carry one, even a real total.
    expect(movesNumbersOk("Little Kettle was named 17 times.", f)).toBe(false);
  });

  it("only uses the report's totals when the move names nothing", () => {
    expect(movesNumbersOk("AI named you in 2 of 24 answers. Fix that first.", f)).toBe(true);
    expect(movesNumbersOk("Fix all 34 product pages first.", f)).toBe(true);
    expect(movesNumbersOk("About 500 Google searches a month.", f)).toBe(false);
  });

  it("allows 1, 2 and 3 as steps, never as a count that isn't real", () => {
    expect(movesNumbersOk("Step 1: add an FAQ. Step 3: link it from your home page.", f)).toBe(true);
    expect(movesNumbersOk("Add 3 short FAQs to your top page.", f)).toBe(true);
    expect(movesNumbersOk("AI named Fern & Suds in 3 answers.", f)).toBe(false);
    expect(movesNumbersOk("AI named you in 3 of 24 answers.", f)).toBe(false);
    expect(movesNumbersOk('Aim at "natural dish soap". It gets 2 Google searches a month.', f)).toBe(false);
  });

  it("never allows numbers in words, shares or multiples", () => {
    expect(movesNumbersOk("AI used choice.com.au in nine answers.", f)).toBe(false);
    expect(movesNumbersOk("Half of the answers named Fern & Suds.", f)).toBe(false);
    expect(movesNumbersOk("AI named you in one of 24 answers.", f)).toBe(false);
    expect(movesNumbersOk("This could grow your sales 20%.", f)).toBe(false);
    expect(movesNumbersOk("Get 2x more visits from AI.", f)).toBe(false);
    expect(movesNumbersOk("Add one short FAQ to each product page.", f)).toBe(true);
  });

  it("doesn't read a quoted search word, a question or a site's address as a claim", () => {
    const g = moveFacts({ keywords: [{ keyword: "best dish soap 2026", volume: 320, difficulty: null }], sites: [{ domain: "top5reviews.com.au", count: 4 }] });
    expect(movesNumbersOk('Write a guide for "best dish soap 2026". About 320 searches a month.', g)).toBe(true);
    expect(movesNumbersOk('Write a guide for "best dish soap 2026". Difficulty 30 of 100.', g)).toBe(false);
    expect(movesNumbersOk("Get onto top5reviews.com.au. AI used it in 4 of 24 answers.", g)).toBe(true);
    expect(movesNumbersOk('Answer "What\'s the best natural dish soap in Australia?" on your product page.', f)).toBe(true);
    expect(movesNumbersOk('Add "Loved by 10,000 Aussies" to your page.', f)).toBe(false);
  });
});

describe("cleanMoves", () => {
  const known = moveFacts();

  it("keeps true, tidy moves with their canonical place", () => {
    const out = cleanMoves(
      [
        { place: "product page", text: 'Add who it\'s for to your "natural dish soap" page. About 1,900 searches a month.' },
        { place: "Sites AI Trusts", text: "Get onto reviewsite.example — AI used it in 8 of 24 answers." },
        { place: "reddit", text: "  Reply   honestly on Reddit and   say you're from the brand. " },
      ],
      known,
    );
    expect(out).toEqual([
      { place: "Product page", text: 'Add who it\'s for to your "natural dish soap" page. About 1,900 searches a month.' },
      { place: "Sites AI trusts", text: "Get onto reviewsite.example, AI used it in 8 of 24 answers." },
      { place: "Reddit", text: "Reply honestly on Reddit and say you're from the brand." },
    ]);
  });

  it("drops moves that break the rules", () => {
    const out = cleanMoves(
      [
        { place: "Blog", text: "Write a long blog post about soap." },
        { place: "FAQ", text: "Too short" },
        { place: "FAQ", text: `Answer this. ${"word ".repeat(60)}` },
        { place: "Product page", text: "About 5,000 searches a month go to this page." },
        { place: "Sites AI trusts", text: "Email https://reviewsite.example and ask nicely." },
        { place: "Sites AI trusts", text: "Set up a link swap with reviewsite.example." },
        { place: "Sites AI trusts", text: "Buy links on popular soap blogs." },
        { place: "Reddit", text: "Post on Reddit as a customer who loves the soap." },
        { place: "Reddit", text: "Pretend to be a happy shopper on Reddit." },
        { place: "Product page", text: "This guarantees you more sales next month." },
        { place: "FAQ", text: "Ask shoppers for fake reviews of the soap." },
        { place: "Sites AI trusts", text: "Pay reviewsite.example for a sponsored spot in their roundup. AI used it in 8 answers." },
        { place: "Sites AI trusts", text: "Ask choice.com.au for a paid feature in their next list." },
        { place: "Sites AI trusts", text: "Offer choice.com.au an affiliate deal so they add you to their roundup." },
        { place: "FAQ", text: "Add a short FAQ to each product page." },
        { place: "faq", text: "add a short FAQ to each product page." },
      ],
      known,
    );
    expect(out).toEqual([{ place: "FAQ", text: "Add a short FAQ to each product page." }]);
  });

  it("drops a Reddit move that doesn't say who's writing", () => {
    const out = cleanMoves(
      [
        { place: "Reddit", text: "Post in r/CleaningTips threads about dish soap and recommend your refills." },
        { place: "Sites AI trusts", text: "Share your refills on reddit.com when people ask for dish soap ideas." },
        { place: "Reddit", text: "Reply honestly in r/CleaningTips and always say who you are." },
        { place: "Reddit", text: "Answer dish soap threads on Reddit as the founder of the brand." },
      ],
      known,
    );
    expect(out.map((m) => m.text)).toEqual([
      "Reply honestly in r/CleaningTips and always say who you are.",
      "Answer dish soap threads on Reddit as the founder of the brand.",
    ]);
  });

  it("takes the place off the front of the text", () => {
    expect(cleanMoves([{ place: "FAQ", text: "FAQ: add a short answer to each product page." }], known)).toEqual([
      { place: "FAQ", text: "Add a short answer to each product page." },
    ]);
  });

  it("keeps to max", () => {
    const raw = Array.from({ length: 20 }, (_, i) => ({ place: "FAQ", text: `Answer question ${i % 3 === 0 ? "alpha" : "beta"} ${"x".repeat(i + 1)}.` }));
    expect(cleanMoves(raw, known)).toHaveLength(15);
    expect(cleanMoves(raw, known, 4)).toHaveLength(4);
  });

  it("every place it keeps is a move place", () => {
    const out = cleanMoves(MOVE_PLACES.map((p) => ({ place: p.toUpperCase(), text: "Do this one simple thing today." })), known);
    expect(out).toHaveLength(1); // the same text dedupes
    expect(MOVE_PLACES).toContain(out[0].place);
  });
});

describe("fallbackMoves", () => {
  const f = facts();
  const moves = fallbackMoves(f);

  it("leads with a product page word, a new guide, then the top site", () => {
    expect(moves[0]).toEqual({ place: "Product page", text: 'Aim it at "natural dish soap". About 1,900 Google searches a month, difficulty 18 of 100.' });
    expect(moves[1]).toEqual({ place: "New guide", text: 'Aim it at "best eco dish soap". About 480 Google searches a month, difficulty 22 of 100.' });
    expect(moves[2]).toEqual({ place: "Sites AI trusts", text: "Get your dish soap onto reviewsite.example. AI used it in 8 of 23 answers." });
  });

  it("mixes the rest and covers every kind", () => {
    const places = new Set(moves.map((m) => m.place));
    for (const p of ["Collection page", "Comparison guide", "FAQ", "Reddit", "Sites AI trusts"]) expect(places.has(p as Move["place"])).toBe(true);
    // 4 words + 3 sites + 2 rivals + 2 FAQs + 1 Reddit.
    expect(moves).toHaveLength(12);
    expect(moves.filter((m) => m.place === "Sites AI trusts")).toHaveLength(3);
    expect(moves).toContainEqual({ place: "Comparison guide", text: "Write an honest guide on how your dish soap compares with Fakebrand Eco. AI named Fakebrand Eco in 9 answers." });
    expect(moves).toContainEqual({ place: "Comparison guide", text: 'Aim it at "dish soap vs dishwashing liquid". About 140 Google searches a month.' });
    expect(moves).toContainEqual({ place: "FAQ", text: `Answer "${f.questions[0]}" in plain words on your product page.` });
    expect(moves).toContainEqual({ place: "Reddit", text: "Reply honestly where shoppers ask about dish soap, and always say you're from Sample Dish Co." });
  });

  it("uses only numbers from the data, with no dashes or repeats", () => {
    // "difficulty 18 of 100": 100 is the scale, which the facts sent to Claude also say.
    const known = knownNumbers(f, "Difficulty is 0 to 100.");
    for (const m of moves) {
      expect(numbersOk(m.text, known)).toBe(true);
      expect(MOVE_PLACES).toContain(m.place);
    }
    noBadDashes(moves.map((m) => m.text));
    expect(new Set(moves.map((m) => m.text.toLowerCase())).size).toBe(moves.length);
  });

  it("passes the same checks as Claude's moves", () => {
    const g = moveFacts({
      answers: f.answers,
      keywords: f.searchWords,
      rivals: f.rivals,
      sites: f.sites,
      questions: f.questions,
      brands: [],
    });
    expect(cleanMoves(moves, g)).toEqual(moves);
  });

  it("only sends a store to articles: never Reddit, a video site, a shop or a review platform", () => {
    const site = (domain: string, count: number, url: string, type: CheckSource["type"]) => ({ domain, count, url, title: null, type });
    const out = fallbackMoves(
      facts({
        sites: [
          site("reddit.com", 15, "https://www.reddit.com/r/x/comments/1/y/", "ugc"),
          site("youtube.com", 9, "https://www.youtube.com/watch?v=1", "ugc"),
          site("chemistwarehouse.com.au", 8, "https://www.chemistwarehouse.com.au/buy/1", "retailer"),
          site("productreview.com.au", 6, "https://www.productreview.com.au/listings/x", "ugc"),
          site("choice.com.au", 5, "https://www.choice.com.au/best", "editorial"),
        ],
      }),
    );
    const onto = out.filter((m) => m.place === "Sites AI trusts").map((m) => m.text);
    expect(onto).toEqual(["Get your dish soap onto choice.com.au. AI used it in 5 of 23 answers."]);
    // Reddit still gets its own honest move.
    expect(out.some((m) => m.place === "Reddit")).toBe(true);
  });

  it("says 1 answer, not 1 answers", () => {
    const out = fallbackMoves(facts({ rivals: [{ name: "Solo Brand", count: 1 }] }));
    expect(out.find((m) => m.place === "Comparison guide" && m.text.includes("Solo Brand"))?.text).toMatch(/in 1 answer\.$/);
  });

  it("works with little data", () => {
    const out = fallbackMoves(facts({ searchWords: [], sites: [], rivals: [], questions: [] }));
    expect(out).toEqual([{ place: "Reddit", text: "Reply honestly where shoppers ask about dish soap, and always say you're from Sample Dish Co." }]);
    const noCategory = fallbackMoves(facts({ store: { ...facts().store, category: " " }, searchWords: [], rivals: [], questions: [] }));
    expect(noCategory[0].text).toBe("Get your products onto reviewsite.example. AI used it in 8 of 23 answers.");
  });

  it("leads with the top word when none is for a product page", () => {
    const out = fallbackMoves(facts({ searchWords: [{ keyword: "best soap", volume: 300, difficulty: null, place: "New guide" }, { keyword: "soap set", volume: 200, difficulty: 5, place: "Collection page" }] }));
    expect(out[0].text).toContain('"best soap"');
    expect(out[1].place).toBe("Sites AI trusts");
  });
});

describe("buildMonths", () => {
  const months = buildMonths(facts());

  it("follows the home page's month by month", () => {
    expect(months.map((m) => [m.month, m.title])).toEqual([
      [1, "We start the work"],
      [2, "Google and AI find you"],
      [3, "Clicks and sales grow"],
    ]);
  });

  it("fills month 1 with this store's real numbers", () => {
    expect(months[0].items).toEqual([
      "Make your product pages clearer for AI: 37 products.",
      'Write your first buying guides, starting with "best eco dish soap".',
      "Email the sites AI trusts, starting with reviewsite.example and shopping.example.",
    ]);
  });

  it("uses the plan's limits in month 2", () => {
    expect(months[1].items).toEqual([
      `Up to ${PLANS.pro.guidePagesPerMonth} new buying guides a month, each aimed at a real search word.`,
      "Honest Reddit replies where shoppers ask about dish soap, always saying who's writing.",
      `Up to ${PLANS.pro.outreachPerMonth} emails a month to sites AI uses. AI used 17 different sites for these questions.`,
    ]);
    expect(months[2].items).toHaveLength(2);
  });

  it("only says what it knows", () => {
    const thin = buildMonths(facts({ store: { ...facts().store, products: 0 }, sites: [], siteCount: 0, searchWords: [] }));
    expect(thin[0].items).toEqual(["Make your product pages clearer for AI.", "Write your first buying guides."]);
    expect(thin[1].items[2]).toBe(`Up to ${PLANS.pro.outreachPerMonth} emails a month to sites AI uses.`);

    const capped = buildMonths(facts({ store: { ...facts().store, products: 250, productsCapped: true }, sites: facts().sites.slice(0, 1), siteCount: 1 }));
    expect(capped[0].items[0]).toBe("Make your product pages clearer for AI: 250+ products.");
    expect(capped[0].items[2]).toBe("Email the sites AI trusts, starting with reviewsite.example.");
    expect(capped[1].items[2]).toMatch(/AI used 1 different site for these questions\.$/);

    // With no guide word, the first word is used.
    const noGuide = buildMonths(facts({ searchWords: [{ keyword: "dish soap", volume: 8100, difficulty: 54, place: "Product page" }] }));
    expect(noGuide[0].items[1]).toBe('Write your first buying guides, starting with "dish soap".');
  });

  it("only names articles to email, never Reddit, a shop or a brand's own site", () => {
    const site = (domain: string, url: string, type: CheckSource["type"]) => ({ domain, count: 9, url, title: null, type });
    const reddit = site("reddit.com", "https://www.reddit.com/r/x/comments/1/y/", "ugc");
    const shop = site("chemistwarehouse.com.au", "https://www.chemistwarehouse.com.au/buy/1", "retailer");
    const article = site("choice.com.au", "https://www.choice.com.au/best", "editorial");
    expect(buildMonths(facts({ sites: [reddit, shop, article] }))[0].items[2]).toBe("Email the sites AI trusts, starting with choice.com.au.");
    expect(buildMonths(facts({ sites: [reddit, shop] }))[0].items).toHaveLength(2);
  });

  it("has no em dashes and only real numbers", () => {
    const f = facts({ store: { ...facts().store, category: "dish soap \u2014 refills" } });
    const known = knownNumbers(f, PLANS.pro.guidePagesPerMonth, PLANS.pro.outreachPerMonth);
    const items = buildMonths(f).flatMap((m) => m.items);
    noBadDashes(items);
    for (const item of items) expect(numbersOk(item, known)).toBe(true);
  });
});

describe("buildScript", () => {
  const f = facts();
  const moves = fallbackMoves(f);
  const script = buildScript(f, moves);

  it("reads like Ross talking, with this store's numbers", () => {
    expect(script[0]).toBe("Episode ___ of helping Aussie brands get picked by AI. Today it's Sample Dish Co.");
    expect(script[1]).toBe("They sell plant-based dish soap for busy Aussie kitchens. I asked ChatGPT, Gemini and Perplexity 4 questions their buyers ask, twice each.");
    expect(script[2]).toBe("Sample Dish Co came up 0 times out of 23. AI picked Fakebrand Eco and Madeup Suds the most.");
    expect(script[3]).toBe("\"natural dish soap\" gets 1,900 Google searches a month, and it's easy to rank for.");
    expect(script[4]).toBe(
      'Here\'s what I\'d do. First, aim your product page at "natural dish soap". Then, write a new guide for "best eco dish soap". Then, get your dish soap onto reviewsite.example.',
    );
    expect(script[5]).toBe("And there are 9 more moves on the list.");
    expect(script[6]).toBe("Month 2 and 3 keep it going: more guides, emails to the sites AI trusts, and checking AI every day.");
    expect(script[7]).toBe("If you're a Shopify brand and want this done for your store, comment your store and I'll send you your report.");
    expect(script).toHaveLength(8);
  });

  it("uses only numbers from the data and no em dashes", () => {
    const known = knownNumbers(f, lockedCount(moves));
    for (const line of script) expect(numbersOk(line.replace("___", ""), known)).toBe(true);
    noBadDashes(script);
    const dashy = buildScript(facts({ store: { ...f.store, brand: "Dash \u2014 Co", sells: "Soap \u2014 for kitchens" } }), [{ place: "FAQ", text: "Add sizes \u2014 like 500 ml \u2013 to each page." }]);
    noBadDashes(dashy);
  });

  it("calls brands by where they're from", () => {
    expect(buildScript(facts({ store: { ...f.store, country: "NZ" } }), [])[0]).toContain("helping Kiwi brands");
    expect(buildScript(facts({ store: { ...f.store, country: "US" } }), [])[0]).toContain("helping Shopify brands");
  });

  it("turns the store's one line into 'They ...'", () => {
    const line = (sells: string) => buildScript(facts({ store: { ...f.store, sells } }), [])[1].split("I asked")[0].trim();
    expect(line("")).toBe("");
    expect(line("We make soap for busy kitchens.")).toBe("They make soap for busy kitchens.");
    expect(line("We're a soap maker in Bondi.")).toBe("They're a soap maker in Bondi.");
    expect(line("They sell soap.")).toBe("They sell soap.");
    expect(line("Sells soap for families.")).toBe("They sell soap for families.");
    expect(line("Makes candles by hand.")).toBe("They make candles by hand.");
    expect(line("Our soaps are made by hand.")).toBe("Their soaps are made by hand.");
    expect(line("Sample Dish Co makes soap.")).toBe("Sample Dish Co makes soap.");
    expect(line("Australian-made soap for kitchens")).toBe("They sell Australian-made soap for kitchens.");
    expect(line("UV-safe sunscreen.")).toBe("They sell UV-safe sunscreen.");
  });

  it("says once, the top rival alone, and skips lines with nothing to say", () => {
    const s = buildScript(facts({ named: 1, rivals: [{ name: "Fakebrand Eco", count: 9 }], searchWords: [] }), []);
    expect(s[2]).toBe("Sample Dish Co came up 1 time out of 23. AI picked Fakebrand Eco the most.");
    expect(s.some((l) => l.startsWith("Here's what"))).toBe(false);
    expect(s.some((l) => l.includes("Google searches"))).toBe(false);
    expect(s.some((l) => l.includes("more move"))).toBe(false);
    expect(buildScript(facts({ named: 5, rivals: [] }), [])[2]).toBe("Sample Dish Co came up 5 times out of 23.");
  });

  it("never says rivals were picked the most when the store was named as often", () => {
    const rivals = [
      { name: "Fakebrand Eco", count: 9 },
      { name: "Madeup Suds", count: 6 },
    ];
    expect(buildScript(facts({ named: 14, answers: 24, rivals }), [])[2]).toBe(
      "Sample Dish Co came up 14 times out of 24. The other brands AI picked most were Fakebrand Eco and Madeup Suds.",
    );
    expect(buildScript(facts({ named: 9, answers: 24, rivals }), [])[2]).toMatch(/The other brands AI picked most were/);
    expect(buildScript(facts({ named: 9, answers: 24, rivals: rivals.slice(0, 1) }), [])[2]).toBe(
      "Sample Dish Co came up 9 times out of 24. The other brand AI picked most was Fakebrand Eco.",
    );
    expect(buildScript(facts({ named: 8, answers: 24, rivals }), [])[2]).toMatch(/AI picked Fakebrand Eco and Madeup Suds the most\.$/);
  });

  it("picks the most searched word when none is easy", () => {
    const s = buildScript(facts({ searchWords: [{ keyword: "dish soap", volume: 8100, difficulty: 54, place: "Product page" }, { keyword: "eco soap", volume: 300, difficulty: null, place: "Product page" }] }), []);
    expect(s).toContain('"dish soap" gets 8,100 Google searches a month.');
    const easy = buildScript(facts({ searchWords: [{ keyword: "x soap", volume: 300, difficulty: EASY_DIFFICULTY, place: "Product page" }] }), []);
    expect(easy).toContain("\"x soap\" gets 300 Google searches a month, and it's easy to rank for.");
  });

  it("speaks Claude's moves as one sentence each", () => {
    const s = buildScript(f, [
      { place: "Product page", text: "Add who each soap is for to your product pages. Shoppers ask about it." },
      { place: "Comparison guide", text: "Fakebrand Eco is named most, so write an honest comparison. AI named it in 9 answers." },
      { place: "FAQ", text: 'Answer "Is it safe for babies?" on every product page.' },
      { place: "Reddit", text: "Reply honestly on Reddit." },
    ]);
    expect(s[4]).toBe(
      'Here\'s what I\'d do. First, add who each soap is for to your product pages. Then, Fakebrand Eco is named most, so write an honest comparison. Then, answer "Is it safe for babies?" on every product page.',
    );
    expect(s[5]).toBe("And there's 1 more move on the list.");
  });
});

describe("storyTags", () => {
  it("tags what makes a good video", () => {
    expect(storyTags(facts())).toEqual(["Not named once", "Easy search word", "Big search demand"]);
    expect(storyTags(facts({ named: 7 }))).toEqual(["Rarely picked", "Easy search word", "Big search demand"]);
    expect(storyTags(facts({ named: 8, answers: 23 }))).toEqual(["Already picked", "Easy search word", "Big search demand"]);
    expect(storyTags(facts({ answers: 10, named: 0, searchWords: [], searches: 0 }))).toEqual(["Not named once", "Few answers"]);
    expect(storyTags(facts({ answers: 0 }))).toEqual(["No AI answers"]);
  });

  it("needs 100+ searches and difficulty 20 or under for an easy word", () => {
    const tags = (searchWords: ReportFacts["searchWords"]) => storyTags(facts({ searchWords, searches: 999 }));
    expect(tags([{ keyword: "a", volume: 99, difficulty: 5, place: "FAQ" }])).toEqual(["Not named once"]);
    expect(tags([{ keyword: "a", volume: 100, difficulty: 21, place: "FAQ" }])).toEqual(["Not named once"]);
    expect(tags([{ keyword: "a", volume: 100, difficulty: null, place: "FAQ" }])).toEqual(["Not named once"]);
    expect(tags([{ keyword: "a", volume: 100, difficulty: 20, place: "FAQ" }])).toEqual(["Not named once", "Easy search word"]);
  });
});

describe("lockedCount", () => {
  it("locks everything after the first 3", () => {
    const m = (n: number): Move[] => Array.from({ length: n }, (_, i) => ({ place: "FAQ", text: `Move ${i}` }));
    expect(SHOWN_MOVES).toBe(3);
    expect(lockedCount(m(0))).toBe(0);
    expect(lockedCount(m(3))).toBe(0);
    expect(lockedCount(m(12))).toBe(9);
  });

  it("matches the report's full answer count", () => {
    expect(REPORT_TOTAL).toBe(24);
  });
});
