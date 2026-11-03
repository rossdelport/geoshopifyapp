// Store reports, server side (app/lib/store-report.server.ts and the Serpstat helpers in treg.server.ts).
// No database and no network: the parts that only read data or tidy Claude's answer.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckAnswer, CheckEngine, CheckQuestion } from "../app/lib/check-types";

vi.hoisted(() => {
  process.env.TREG_API_KEY = "test-token";
  process.env.ANTHROPIC_API_KEY = "test-key";
});

// No database here: costs are not logged, and StoreReport rows live in a Map (only what store-report.server.ts uses).
vi.mock("../app/lib/cost.server", () => ({ recordCost: vi.fn(async () => {}) }));
/* eslint-disable @typescript-eslint/no-explicit-any -- a small stand-in for Prisma */
const fake = vi.hoisted(() => {
  const rows = new Map<string, any>();
  let next = 0;
  const matches = (row: any, where: any = {}) =>
    Object.entries(where).every(([k, v]: [string, any]) =>
      v && typeof v === "object" && "gte" in v ? row[k] >= v.gte : v && typeof v === "object" && "startsWith" in v ? String(row[k] ?? "").startsWith(v.startsWith) : row[k] === v,
    );
  const apply = (row: any, data: any) => {
    for (const [k, v] of Object.entries(data) as [string, any][]) row[k] = v && typeof v === "object" && "increment" in v ? row[k] + v.increment : v;
  };
  const storeReport = {
    findUnique: async ({ where }: any) => (where.id ? rows.get(where.id) ?? null : [...rows.values()].find((r) => r.slug === where.slug) ?? null),
    findMany: async ({ where }: any = {}) => [...rows.values()].filter((r) => matches(r, where)),
    count: async ({ where }: any = {}) => [...rows.values()].filter((r) => matches(r, where)).length,
    create: async ({ data }: any) => {
      const row = { id: `r${++next}`, slug: null, status: "queued", total: 0, done: 0, data: null, error: null, createdBy: null, createdAt: new Date(), finishedAt: null, ...data };
      rows.set(row.id, row);
      return row;
    },
    update: async ({ where, data }: any) => {
      const row = rows.get(where.id);
      if (!row) throw new Error("not found");
      apply(row, data);
      return row;
    },
    updateMany: async ({ where, data }: any) => {
      const hit = [...rows.values()].filter((r) => matches(r, where));
      hit.forEach((r) => apply(r, data));
      return { count: hit.length };
    },
    deleteMany: async ({ where }: any) => ({ count: rows.delete(where.id) ? 1 : 0 }),
  };
  const db: any = { storeReport, $executeRaw: async () => 0 };
  db.$transaction = async (fn: (tx: any) => unknown) => fn(db);
  return { rows, db };
});
/* eslint-enable @typescript-eslint/no-explicit-any */
vi.mock("../app/db.server", () => ({ default: fake.db }));
vi.mock("../app/lib/jobs.server", () => ({ enqueue: vi.fn(async () => ({})), heartbeat: vi.fn(async () => {}), registerJob: vi.fn() }));

// The store's pages, the AI answers and Claude are stand-ins too; the Serpstat calls go through a stubbed fetch.
const page = vi.hoisted(() => ({ found: null as unknown }));
vi.mock("../app/lib/public-catalog.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../app/lib/public-catalog.server")>()),
  findShopifyStore: vi.fn(async () => page.found),
}));
vi.mock("../app/lib/check.server", () => ({
  safeFetch: vi.fn(async (url: string) => {
    if (url.includes("/products.json")) {
      const products = ["Lemon Myrtle Dish Soap 500ml", "Hand Wash", "Dish Brush"].map((title, i) => ({
        id: i + 1,
        title,
        handle: `p${i}`,
        product_type: "Dish Soap",
        variants: [{ price: "12.00" }],
      }));
      return { status: 200, url, text: JSON.stringify({ products }) };
    }
    return { status: 200, url, text: "<title>Bondi Wash &amp; Co</title><h1>Natural cleaning for Aussie homes</h1>" };
  }),
  askOne: vi.fn(),
}));
vi.mock("../app/lib/ai.server", () => ({ aiConfigured: () => true, askJson: vi.fn() }));

const { keywordIdeas, keywordStats, parseSerpstat } = await import("../app/lib/treg.server");
const { createReports, deleteReport, getReport, listReports, repeatsMove, runReport, tidyStore, templateQuestions } = await import("../app/lib/store-report.server");
const { askOne } = await import("../app/lib/check.server");
const { askJson } = await import("../app/lib/ai.server");
const { enqueue } = await import("../app/lib/jobs.server");

// Real answers from Treg (3 Nov 2026), trimmed: SerpstatKeywordProcedure.getKeywordsInfo for g_au ...
const VOLUME = {
  id: "1",
  result: {
    data: [
      {
        region_queries_count: 1900,
        region_queries_count_wide: 0,
        cost: 1.515494,
        concurrency: 89,
        keyword: "dish soap",
        found_results: 1340000,
        types: ["pic", "also_asks", "ai_overview", "video"],
        geo_names: [],
        social_domains: ["facebook"],
        right_spelling: null,
        difficulty: 26,
        lang: null,
        suggestions_count: 4953,
        keywords_count: 6740,
      },
    ],
    summary_info: { page: 1, left_lines: 1749938 },
  },
};
// ... and SerpstatKeywordProcedure.getKeywords (size 5, most searched first).
const IDEAS = {
  id: "1",
  result: {
    data: [
      { region_queries_count: 3600, keyword: "soap dishes", keyword_length: 2, difficulty: 24, geo_names: [], lang: null },
      { region_queries_count: 3600, keyword: "dish soap dish", keyword_length: 3, difficulty: 7, geo_names: [], lang: "en" },
      { region_queries_count: 3600, keyword: "dish soap for oil stains", keyword_length: 5, difficulty: 9, geo_names: [], lang: "en" },
    ],
    summary_info: { page: 1, total: 6740, left_lines: 1749933 },
  },
};

describe("parseSerpstat", () => {
  it("reads the volume answer", () => {
    expect(parseSerpstat(VOLUME)).toEqual([{ keyword: "dish soap", volume: 1900, difficulty: 26, geo: [] }]);
  });

  it("reads the ideas answer, in Serpstat's order", () => {
    expect(parseSerpstat(IDEAS).map((k) => [k.keyword, k.volume, k.difficulty])).toEqual([
      ["soap dishes", 3600, 24],
      ["dish soap dish", 3600, 7],
      ["dish soap for oil stains", 3600, 9],
    ]);
  });

  it("treats 'Data not found' as no numbers, and throws on other errors", () => {
    expect(parseSerpstat({ id: "1", error: { code: 32017, message: "Data not found" } })).toEqual([]);
    expect(() => parseSerpstat({ id: "1", error: { code: 32001, message: "Invalid params" } })).toThrow(/Invalid params/);
  });

  it("keeps a missing difficulty missing (never 0, 'easy'), lowercases words and places, skips rows without a word", () => {
    const out = parseSerpstat({
      id: "1",
      result: {
        data: [
          { keyword: "  Dish  Soap AUSTRALIA ", region_queries_count: "320", difficulty: null, geo_names: ["Australia", 3, ""] },
          { keyword: "bamboo brush", region_queries_count: null, difficulty: 140.6 },
          { region_queries_count: 50, difficulty: 10 },
          null,
        ],
      },
    });
    expect(out).toEqual([
      { keyword: "dish soap australia", volume: 320, difficulty: null, geo: ["australia"] },
      { keyword: "bamboo brush", volume: 0, difficulty: 100, geo: [] },
    ]);
  });

  it("gives nothing for an answer of the wrong shape", () => {
    expect(parseSerpstat(null)).toEqual([]);
    expect(parseSerpstat({ result: { data: "nope" } })).toEqual([]);
  });
});

describe("keywordStats and keywordIdeas", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(answer: unknown) {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body?: string }) => {
        calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
        return new Response(JSON.stringify(answer), { status: 200 });
      }),
    );
    return calls;
  }

  it("asks Serpstat for the store's country, each word once, and reads the answer", async () => {
    const calls = stubFetch(VOLUME);
    const out = await keywordStats(["Dish Soap", "dish  soap", "", "natural dish soap"], "AU");
    expect(out).toEqual([{ keyword: "dish soap", volume: 1900, difficulty: 26, geo: [] }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/call\/serpstat\.google\.keywords\.volume$/);
    expect(calls[0].body).toEqual({
      method: "SerpstatKeywordProcedure.getKeywordsInfo",
      id: "1",
      params: { keywords: ["dish soap", "natural dish soap"], se: "g_au" },
    });
  });

  it("sends nothing for no words", async () => {
    const calls = stubFetch(VOLUME);
    expect(await keywordStats(["", "  "], "AU")).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("asks for ideas, most searched first, with the size as the price dial", async () => {
    const calls = stubFetch(IDEAS);
    const out = await keywordIdeas(" Dish Soap ", "GB", 5);
    expect(out).toHaveLength(3);
    expect(calls[0].url).toMatch(/\/call\/serpstat\.google\.keywords\.ideas$/);
    expect(calls[0].body).toEqual({
      method: "SerpstatKeywordProcedure.getKeywords",
      id: "1",
      params: { keyword: "dish soap", se: "g_uk", size: 5, sort: { region_queries_count: "desc" } },
    });
  });
});

describe("tidyStore", () => {
  const base = { host: "bondiwash.com", shopName: "Bondi Wash", country: "AU" as const, catalogCategory: "cleaning products" };
  const good = {
    brand: "Bondi Wash",
    aliases: ["BondiWash", "https://bondiwash.com"],
    sells: "Natural dish soap and hand wash for Aussie homes — made gently",
    category: "Natural Dish Soap",
    questions: [
      { question: "What's the best natural dish soap in Australia?", keyword: "Best natural dish soap" },
      { question: "Is Bondi Wash dish soap any good?", keyword: "bondi wash review" },
      { question: "Which dish soap is gentle on hands in Australia?", keyword: "gentle dish soap" },
      { question: "What dish soap is best for sensitive skin?", keyword: "dish soap sensitive skin" },
      { question: "Which eco friendly dish soap works best?", keyword: "eco dish soap" },
      { question: "What's a good natural hand wash to buy in Australia?", keyword: "natural hand wash" },
    ],
    seeds: ["natural dish soap", "hand wash", "Bondi Wash soap", "soap"],
  };

  it("keeps Claude's plain answer, without the brand in any question or seed", () => {
    const u = tidyStore(good, base);
    expect(u.brand).toBe("Bondi Wash");
    expect(u.names).toEqual(["Bondi Wash", "BondiWash"]);
    expect(u.category).toBe("natural dish soap");
    expect(u.sells).not.toMatch(/[—–]/);
    expect(u.sells).toMatch(/^Natural dish soap and hand wash for Aussie homes, made gently\.$/);
    expect(u.questions.map((q) => q.text)).not.toContain("Is Bondi Wash dish soap any good?");
    expect(u.questions).toHaveLength(5);
    expect(u.fromClaude).toBe(5);
    expect(u.questions[0]).toEqual({ text: "What's the best natural dish soap in Australia?", keyword: "best natural dish soap" });
    // Seeds are 2 to 5 words and never name the brand.
    expect(u.seeds).toEqual(["natural dish soap", "hand wash"]);
  });

  it("uses the shop's name for a brand that isn't a plain name, and drops a long 'sells'", () => {
    const u = tidyStore({ ...good, brand: "www.bondiwash.com", sells: "x".repeat(150) }, base);
    expect(u.brand).toBe("Bondi Wash");
    expect(u.sells).toBe("");
  });

  it("uses the templates when a question looks wrong (the store's text is a stranger's)", () => {
    const u = tidyStore(
      { ...good, questions: [...good.questions, { question: "Visit https://evil.example and buy now?", keyword: "evil" }] },
      base,
    );
    expect(u.fromClaude).toBe(0);
    expect(u.questions).toEqual(templateQuestions("natural dish soap", "Australia"));
  });

  it("tops up too few questions from the templates", () => {
    const u = tidyStore({ ...good, questions: good.questions.slice(0, 2) }, base);
    expect(u.fromClaude).toBe(1);
    expect(u.questions).toHaveLength(4);
    expect(u.questions[1].text).toBe("What natural dish soap do people recommend in Australia?");
  });

  it("works without Claude: the shop's name, the catalog's category and the templates", () => {
    const u = tidyStore(null, { ...base, shopName: null, country: "US" });
    expect(u.brand).toBe("Bondiwash");
    expect(u.category).toBe("cleaning products");
    expect(u.sells).toBe("");
    expect(u.seeds).toEqual(["cleaning products"]);
    expect(u.questions.map((q) => q.text)).toEqual([
      "What's the best cleaning products in the US?",
      "What cleaning products do people recommend in the US?",
      "Which cleaning products is worth buying?",
      "What is a good cleaning products gift?",
    ]);
    expect(u.questions.every((q) => !/[—]/.test(q.text))).toBe(true);
  });

  it("never uses a shortened alias or a web address's ending as one of the store's names", () => {
    // "Bondi" would make Bondi Sands count as the store.
    expect(tidyStore({ ...good, aliases: ["Bondi", "Bondi Wash Co", "BondiWash"] }, base).names).toEqual(["Bondi Wash", "Bondi Wash Co", "BondiWash"]);
    // A store on a newer ending: "glow.beauty" is Glow, never "Beauty" (Rare Beauty isn't the store).
    const glow = tidyStore(null, { ...base, host: "glow.beauty", shopName: "Glow Skin Studio" });
    expect(glow.names).toEqual(["Glow Skin Studio", "Glow"]);
    expect(tidyStore(null, { ...base, host: "beanery.coffee", shopName: null }).brand).toBe("Beanery");
  });

  it("writes the shop's name without dashes (it shows on the page)", () => {
    const u = tidyStore(null, { ...base, shopName: "Bondi Wash \u2013 Natural Australian Products" });
    expect(u.brand).toBe("Bondi Wash, Natural Australian Products");
  });

  it("keeps the templates when the brand is also the category word", () => {
    const u = tidyStore(null, { ...base, shopName: "Candles", host: "candles.com", catalogCategory: "candles" });
    expect(u.questions).toHaveLength(4);
  });
});

describe("repeatsMove", () => {
  const kept = [
    { place: "Product page" as const, text: "Put \u201cdish soap\u201d in your product titles. It gets 1,900 Google searches a month." },
    { place: "Sites AI trusts" as const, text: "Ask choice.com.au to look at your soap. AI used it in 9 answers." },
    { place: "Comparison guide" as const, text: "Compare your soap with Koala Eco honestly. AI named Koala Eco in 9 answers." },
  ];

  it("spots a built move about the same search word, site or brand", () => {
    expect(repeatsMove({ place: "Product page", text: 'Aim it at "dish soap". About 1,900 Google searches a month.' }, kept)).toBe(true);
    expect(repeatsMove({ place: "Sites AI trusts", text: "Get your dish soap onto choice.com.au. AI used it in 9 of 23 answers." }, kept)).toBe(true);
    expect(
      repeatsMove({ place: "Comparison guide", text: "Write an honest guide on how your dish soap compares with Koala Eco. AI named Koala Eco in 9 answers." }, kept),
    ).toBe(true);
  });

  it("keeps a move about something new", () => {
    expect(repeatsMove({ place: "New guide", text: 'Aim it at "natural dish soap". About 390 Google searches a month.' }, kept)).toBe(false);
    expect(repeatsMove({ place: "Sites AI trusts", text: "Get your dish soap onto canstar.com.au. AI used it in 4 of 23 answers." }, kept)).toBe(false);
    expect(
      repeatsMove({ place: "Comparison guide", text: "Write an honest guide on how your dish soap compares with Earth Choice. AI named Earth Choice in 9 answers." }, kept),
    ).toBe(false);
  });
});

describe("runReport", () => {
  const STATS = [
    { keyword: "dish soap", region_queries_count: 1900, difficulty: 26, geo_names: [] },
    { keyword: "natural dish soap", region_queries_count: 390, difficulty: 12, geo_names: [] },
    { keyword: "best natural dish soap", region_queries_count: 170, difficulty: 18, geo_names: [] },
    { keyword: "gentle dish soap", region_queries_count: 20, difficulty: 5, geo_names: [] },
  ];
  const IDEA_ROWS = [
    { keyword: "dish soap for oil stains", region_queries_count: 3600, difficulty: 9, geo_names: [] },
    { keyword: "diy dish soap recipe", region_queries_count: 880, difficulty: 3, geo_names: [] },
    { keyword: "dish soap usa", region_queries_count: 700, difficulty: 30, geo_names: ["usa"] },
    { keyword: "hand wash refill", region_queries_count: 260, difficulty: null, geo_names: [] },
    // Brand searches: a rival's name and the store's own. Never search words for the report.
    { keyword: "koala eco dish soap", region_queries_count: 2400, difficulty: 20, geo_names: [] },
    { keyword: "bondi wash dish soap", region_queries_count: 90, difficulty: 4, geo_names: [] },
  ];
  let treg: { endpoint: string; body: { params: Record<string, unknown> } }[] = [];

  /** One AI answer: the store is named only by ChatGPT, on the first question; Gemini's last answer fails. */
  function answer(q: CheckQuestion, question: number, engine: CheckEngine, run: number): CheckAnswer {
    if (engine === "gemini" && question === 3 && run === 2) {
      return { question, engine, run, ok: false, empty: false, named: false, position: null, brands: [], sources: [], snippet: "" };
    }
    const named = engine === "chatgpt" && question === 0;
    return {
      question,
      engine,
      run,
      ok: true,
      empty: false,
      named,
      position: named ? 3 : null,
      brands: named ? ["Koala Eco", "Earth Choice", "Bondi Wash"] : ["Koala Eco", "Earth Choice"],
      sources: [
        { url: "https://www.choice.com.au/dish-soap", domain: "choice.com.au", title: "Best dish soaps", type: "editorial", isOwn: false },
        { url: "https://bondiwash.com/", domain: "bondiwash.com", title: "Bondi Wash", type: "brand", isOwn: true },
      ],
      snippet: q.text,
    } as CheckAnswer;
  }

  beforeEach(() => {
    fake.rows.clear();
    treg = [];
    page.found = { myshopifyDomain: "bondi-wash.myshopify.com", host: "www.bondiwash.com", name: "Bondi Wash", country: "AU", currency: "AUD" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: { body?: string }) => {
        const endpoint = url.split("/call/")[1];
        const body = JSON.parse(init.body ?? "{}");
        treg.push({ endpoint, body });
        const data = endpoint === "serpstat.google.keywords.volume" ? STATS : IDEA_ROWS;
        return new Response(JSON.stringify({ id: "1", result: { data, summary_info: {} } }), { status: 200 });
      }),
    );
    vi.mocked(askOne).mockReset();
    vi.mocked(askOne).mockImplementation(async (q, question, engine, run) => ({ answer: answer(q, question, engine, run), readByText: false }));
    vi.mocked(askJson).mockReset();
    vi.mocked(askJson).mockImplementation(async (opts: { label: string }) => {
      if (opts.label === "report-store") {
        return {
          brand: "Bondi Wash",
          aliases: [],
          sells: "Natural dish soap and hand wash for Aussie homes",
          category: "dish soap",
          questions: [
            { question: "Which dish soap is gentle on hands?", keyword: "gentle dish soap" },
            { question: "What's the best natural dish soap in Australia?", keyword: "best natural dish soap" },
            { question: "What dish soap do people recommend in Australia?", keyword: "dish soap" },
            { question: "Which natural dish soap is worth buying?", keyword: "natural dish soap" },
            { question: "What's a good eco dish soap to buy?", keyword: "eco dish soap" },
          ],
          seeds: ["dish soap", "hand wash"],
        };
      }
      return {
        search_words: [
          { keyword: "Dish Soap", place: "Product page" },
          { keyword: "made up word", place: "FAQ" },
          { keyword: "dish soap for oil stains", place: "Somewhere else" },
          { keyword: "natural dish soap", place: "New guide" },
        ],
        moves: [
          { place: "Product page", text: 'Put "dish soap" in your product page titles. It gets 1,900 Google searches a month.' },
          { place: "Reddit", text: "Reply to 5,000 shoppers on Reddit every day and say you're from Bondi Wash." },
          { place: "Sites AI trusts", text: "Ask choice.com.au to look at your dish soap. AI used it in 23 answers." },
        ],
      };
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  async function queued() {
    const result = await createReports("https://www.bondiwash.com/products/x?y=1", "Ross@Example.com");
    expect(result).toEqual({ ok: true, created: 1, bad: [], capped: false, left: [] });
    return [...fake.rows.values()].at(-1);
  }

  it("builds a report from real numbers only, and saves it under the brand's name", async () => {
    const row = await queued();
    expect(row).toMatchObject({ host: "bondiwash.com", status: "queued", total: 24, createdBy: "ross@example.com" });
    expect(enqueue).toHaveBeenCalledWith("report.run", { id: row.id }, { dedupeKey: `report:${row.id}` });

    await runReport(row.id, "job1", 1);
    expect(row.error).toBeNull();
    expect(row).toMatchObject({ status: "done", slug: "bondi-wash", done: 24 });
    const data = row.data;

    // Serpstat: the questions' words and the seeds in one call, then ideas for each seed, all for Google Australia.
    expect(treg.map((t) => t.endpoint)).toEqual(["serpstat.google.keywords.volume", "serpstat.google.keywords.ideas", "serpstat.google.keywords.ideas"]);
    expect(treg.every((t) => t.body.params.se === "g_au")).toBe(true);

    // 4 questions, the most searched first, at least 2 naming the country; every one asked 3 x 2 times.
    expect(data.questions).toHaveLength(4);
    expect(data.questions[0]).toBe("What dish soap do people recommend in Australia?");
    expect(data.questions.filter((q: string) => /Australia/.test(q)).length).toBeGreaterThanOrEqual(2);
    expect(askOne).toHaveBeenCalledTimes(24);
    expect(vi.mocked(askOne).mock.calls.every((c) => c[4] === "AU")).toBe(true);

    expect(data.store).toMatchObject({ host: "bondiwash.com", brand: "Bondi Wash", country: "AU", countryName: "Australia", products: 3, productsCapped: false });
    expect(data).toMatchObject({ answers: 23, named: 2 });
    expect(data.rivals[0]).toEqual({ name: "Koala Eco", count: 23 });
    expect(data.sites.map((s: { domain: string }) => s.domain)).toEqual(["choice.com.au"]);

    // Search words: only words Serpstat gave numbers for, with Serpstat's numbers; no DIY or other-country words.
    const words = data.searchWords.map((w: { keyword: string }) => w.keyword);
    expect(words).not.toContain("made up word");
    expect(words).not.toContain("diy dish soap recipe");
    expect(words).not.toContain("dish soap usa");
    expect(data.searchWords.find((w: { keyword: string }) => w.keyword === "dish soap")).toMatchObject({ volume: 1900, difficulty: 26, place: "Product page" });
    expect(data.searches).toBe(data.searchWords.reduce((sum: number, w: { volume: number }) => sum + w.volume, 0));

    // Claude's move with an invented number is gone; the rest are topped up from the data.
    const texts: string[] = data.moves.map((m: { text: string }) => m.text);
    expect(texts[0]).toMatch(/1,900 Google searches/);
    // Built moves never repeat Claude's: one "dish soap" move, one choice.com.au move.
    expect(texts.filter((t) => t.includes('"dish soap"'))).toHaveLength(1);
    expect(texts.filter((t) => t.includes("choice.com.au"))).toHaveLength(1);
    expect(texts.join(" ")).not.toMatch(/5,000/);
    expect(data.moves.length).toBeGreaterThanOrEqual(8);
    expect(data.moves.length).toBeLessThanOrEqual(12);
    expect(new Set(texts).size).toBe(texts.length);
    expect(data.notes).toContain("Only 23 of 24 AI answers came back.");
    expect(data.notes).toContain("Claude's moves didn't pass the number check, so some are simpler.");
    expect(JSON.stringify(data)).not.toMatch(/\u2014| \u2013 /);
    expect(data.months).toHaveLength(3);
    expect(data.script.length).toBeGreaterThan(3);

    // Claude never sees brand searches, and only product titles that carry the brand help spot the store.
    const plan = vi.mocked(askJson).mock.calls.map((c) => c[0] as { label: string; prompt: string }).find((c) => c.label === "report-plan");
    expect(plan?.prompt).toContain("dish soap for oil stains");
    expect(plan?.prompt).not.toContain("koala eco dish soap");
    expect(plan?.prompt).not.toContain("bondi wash dish soap");
    expect(words).not.toContain("koala eco dish soap");
    expect(vi.mocked(askOne).mock.calls[0][5].productTitles).toEqual([]);
    expect(data.notes.some((n: string) => n.includes("without Claude"))).toBe(false);

    // The public page and the admin list read it back.
    expect(await getReport("bondi-wash")).toEqual({ slug: "bondi-wash", data });
    expect(await getReport("Bondi Wash")).toBeNull();
    const [item] = await listReports();
    expect(item).toMatchObject({ id: row.id, status: "done", slug: "bondi-wash", brand: "Bondi Wash", named: 2, answers: 23, moves: data.moves.length });
  });

  it("gives the next free address when the brand's is taken", async () => {
    fake.rows.set("old", { id: "old", slug: "bondi-wash", status: "done", createdAt: new Date(Date.now() - 2 * 86_400_000) });
    const row = await queued();
    await runReport(row.id, undefined, 1);
    expect(row.slug).toBe("bondi-wash-2");
  });

  it("fails kindly when there's no Shopify store at the address", async () => {
    page.found = null;
    const row = await queued();
    await runReport(row.id, undefined, 1);
    expect(row).toMatchObject({ status: "failed", error: "We couldn't find a Shopify store at that address." });
    expect(askOne).not.toHaveBeenCalled();
  });

  it("never runs twice: a retry (or a report that isn't queued) stops without paying again", async () => {
    const row = await queued();
    await runReport(row.id, undefined, 2);
    expect(row).toMatchObject({ status: "failed", error: "This report was interrupted. Please run it again." });
    expect(askOne).not.toHaveBeenCalled();
    expect(treg).toHaveLength(0);
  });

  it("fails when no AI answered, and uses simple moves when Claude can't write them", async () => {
    vi.mocked(askOne).mockImplementation(async (_q, question, engine, run) => ({
      answer: { question, engine, run, ok: false, empty: false, named: false, position: null, brands: [], sources: [], snippet: "" },
      readByText: false,
    }));
    const row = await queued();
    await runReport(row.id, undefined, 1);
    expect(row).toMatchObject({ status: "failed", error: "We couldn't reach the AI assistants just now. Please try again in a few minutes." });

    vi.mocked(askOne).mockImplementation(async (q, question, engine, run) => ({ answer: answer(q, question, engine, run), readByText: false }));
    vi.mocked(askJson).mockRejectedValue(new Error("no credit"));
    const again = await queued();
    await runReport(again.id, undefined, 1);
    expect(again.status).toBe("done");
    expect(again.data.notes).toContain("Claude couldn't write good questions for this store, so they're simple ones.");
    expect(again.data.notes).toContain("Claude couldn't write the moves, so they're built from the numbers only.");
    expect(again.data.moves.length).toBeGreaterThanOrEqual(8);
  });

  it("notes answers read without Claude, and fails when most were (the counts would be guesses)", async () => {
    vi.mocked(askOne).mockImplementation(async (q, question, engine, run) => ({ answer: answer(q, question, engine, run), readByText: question === 0 && run === 1 }));
    const row = await queued();
    await runReport(row.id, undefined, 1);
    expect(row.status).toBe("done");
    expect(row.data.notes).toContain("3 of 23 AI answers were read without Claude, so who was named may be a little off.");

    vi.mocked(askOne).mockImplementation(async (q, question, engine, run) => ({ answer: answer(q, question, engine, run), readByText: question !== 0 }));
    const most = await queued();
    await runReport(most.id, undefined, 1);
    expect(most).toMatchObject({ status: "failed", error: "We couldn't read the AI answers properly just now. Please run it again in a few minutes." });
  });

  it("caps a day at 40 reports and says when only the first 10 were started", async () => {
    const many = Array.from({ length: 12 }, (_, i) => `store${i}.com`).join("\n");
    const first = await createReports(`${many}\nnot an address`, null);
    // What wasn't started goes back to Ross: the addresses past the first 10, then the bits that weren't addresses.
    expect(first).toEqual({ ok: true, created: 10, bad: ["not", "an", "address"], capped: true, left: ["store10.com", "store11.com", "not", "an", "address"] });
    // Exactly 10 (with repeats) isn't capped; an 11th after a ";" is.
    const ten = Array.from({ length: 10 }, (_, i) => `ten${i}.com`);
    expect(await createReports([...ten, "ten0.com", "https://www.ten1.com/"].join(", "), null)).toMatchObject({ ok: true, created: 10, capped: false });
    expect(await createReports(`${ten.join("\n")};eleven.com`, null)).toMatchObject({ ok: true, created: 10, capped: true });
    await createReports(many, null);
    expect(fake.rows.size).toBe(40);
    expect(await createReports("one-more.com", null)).toEqual({ ok: false, error: "That's more than 40 reports in a day. Try again tomorrow." });
    expect(await createReports("   ", null)).toEqual({ ok: false, error: "Please paste at least one store address, like bondiwash.com." });
  });

  it("shows a report stuck for 30 minutes as failed, and deletes one", async () => {
    const row = await queued();
    row.status = "asking";
    row.createdAt = new Date(Date.now() - 31 * 60_000);
    const [item] = await listReports();
    expect(item).toMatchObject({ status: "failed", error: "This report took too long. Please run it again.", slug: null, brand: null, moves: 0 });
    await deleteReport(row.id);
    expect(fake.rows.size).toBe(0);
  });
});
