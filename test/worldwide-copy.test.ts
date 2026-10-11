import { describe, expect, it, vi } from "vitest";

vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));
vi.mock("../app/lib/cost.server", () => ({ recordCost: vi.fn(async () => {}), costThisMonth: vi.fn(async () => 0) }));

// Stores sell worldwide: questions, fixes and the claims check follow the store's own country,
// never a fixed Australian default.
describe("worldwide wording", async () => {
  const { countryName, budgetExample } = await import("../app/lib/onboarding.server");
  const { guardrails, claimsSystem } = await import("../app/lib/fixes.server");

  it("names any country the way a shopper says it", () => {
    expect(countryName("US")).toBe("the US");
    expect(countryName("GB")).toBe("the UK");
    expect(countryName("DE")).toBe("Germany");
    expect(countryName("JP")).toBe("Japan");
    expect(countryName("NL")).toBe("the Netherlands");
    expect(countryName("au")).toBe("Australia");
    expect(countryName("ZA")).toBe("South Africa");
  });

  it("leaves anything that isn't a country code alone", () => {
    expect(countryName("")).toBe("");
    expect(countryName("XX")).toBe("XX");
    expect(countryName("Europe")).toBe("Europe");
  });

  it("uses the store's own currency for budget questions", () => {
    expect(budgetExample("USD")).toBe("$50");
    expect(budgetExample("GBP")).toBe("£50");
    expect(budgetExample("EUR")).toBe("€50");
    expect(budgetExample("JPY")).toBe("¥5,000");
    expect(budgetExample("")).toBe("50");
    expect(budgetExample(null)).toBe("50");
  });

  it("spells fixes for the store's country, not always Australian", () => {
    expect(guardrails("US")).toContain("shoppers in the US spell");
    expect(guardrails("DE")).toContain("shoppers in Germany spell");
    expect(guardrails("US")).not.toMatch(/australian/i);
  });

  it("checks claims against the store's country, with the strictest rule when unsure", () => {
    expect(claimsSystem("GB")).toContain("sells from the UK");
    expect(claimsSystem("GB")).toContain("strictest");
    expect(claimsSystem("US")).not.toMatch(/^You check Australian/);
  });

  it("never uses an em dash or a spaced en dash", () => {
    for (const text of [guardrails("US"), claimsSystem("US")]) expect(text).not.toMatch(/—| – /);
  });
});

// The rest of the app: Claude's spelling, money, the country picker and where AI is asked from.
describe("worldwide defaults", async () => {
  const { STYLE_RULE } = await import("../app/lib/ai.server");
  const { formatMoney } = await import("../app/lib/format");
  const { countryOptions, regionName, MARKET_COUNTRIES } = await import("../app/lib/countries");
  const { locationCode } = await import("../app/lib/treg.server");

  it("spells the way the named country does, US spelling when none is named", () => {
    expect(STYLE_RULE).not.toMatch(/australian/i);
    expect(STYLE_RULE).toContain("otherwise use US spelling");
    expect(STYLE_RULE).not.toMatch(/—| – /);
  });

  it("shows a store's money in its own symbol, not 'USD 4,820'", () => {
    expect(formatMoney(4820, "USD")).toBe("$4,820");
    expect(formatMoney(4820, "GBP")).toBe("£4,820");
    expect(formatMoney(4820, "EUR")).toBe("€4,820");
    expect(formatMoney(4820, "AUD")).toBe("$4,820");
    expect(formatMoney(12.5)).toBe("$12.50");
    expect(formatMoney(40)).toBe("$40");
  });

  it("offers countries by name with none pinned first, and always the store's own", () => {
    const opts = countryOptions("US");
    const names = opts.map(([, n]) => n);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    expect(opts.find(([c]) => c === "US")?.[1]).toBe("United States");
    expect(opts).toHaveLength(MARKET_COUNTRIES.length);
    // A store somewhere not in the list still sees its own country selected.
    expect(countryOptions("KE").find(([c]) => c === "KE")?.[1]).toBe("Kenya");
    expect(countryOptions("junk")).toHaveLength(MARKET_COUNTRIES.length);
    expect(regionName("ZZ")).toBe("ZZ");
  });

  it("asks AI as a shopper in the store's country, or the US when we don't have it", () => {
    expect(locationCode("US")).toBe(2840);
    expect(locationCode("gb")).toBe(2826);
    expect(locationCode("DE")).toBe(2276);
    expect(locationCode("SG")).toBe(2702);
    expect(locationCode("KE")).toBe(2840);
    expect(locationCode("")).toBe(2840);
    // Every country in the Settings picker has its own code (none quietly falls back to the US).
    for (const c of MARKET_COUNTRIES.filter((x) => x !== "US")) expect(locationCode(c), c).not.toBe(2840);
  });

  it("asks every provider as the same country in one scan: a country we don't have is the US for all of them", async () => {
    const { askEngine, scanCountry } = await import("../app/lib/treg.server");
    const { env } = await import("../app/lib/env.server");
    const { isCountryCode } = await import("../app/lib/countries");
    expect(scanCountry("KE")).toBe("US");
    expect(scanCountry("de")).toBe("DE");
    expect(scanCountry(null)).toBe("US");
    expect(isCountryCode("KE")).toBe(true);
    expect(isCountryCode("ZZ")).toBe(false);
    expect(isCountryCode("Germany")).toBe(false);
    const sent: { url: string; body: string | null }[] = [];
    const token = env.tregToken;
    (env as { tregToken: string }).tregToken = "test-token";
    vi.stubGlobal("fetch", async (u: string, init?: RequestInit) => {
      sent.push({ url: String(u), body: typeof init?.body === "string" ? init.body : null });
      return new Response(JSON.stringify({}), { status: 500 });
    });
    try {
      for (const engine of ["chatgpt", "gemini", "perplexity", "aio", "claude"] as const) await askEngine(engine, "best beard oil", "KE").catch(() => null);
      await askEngine("chatgpt", "best beard oil", "DE").catch(() => null);
    } finally {
      vi.unstubAllGlobals();
      (env as { tregToken: string }).tregToken = token;
    }
    const by = (part: string) => sent.filter((x) => x.url.includes(part));
    expect(JSON.parse(by("cloro.ai-search.chatgpt.scrape")[0].body!).country).toBe("US");
    expect(JSON.parse(by("cloro.ai-search.gemini.scrape")[0].body!).country).toBe("US");
    expect(JSON.parse(by("perplexity-llm-responses-live")[0].body!)[0].web_search_country_iso_code).toBe("US");
    expect(JSON.parse(by("claude-llm-responses-live")[0].body!)[0].web_search_country_iso_code).toBe("US");
    expect(new URL(by("litescrape.google.serp.ai_overview")[0].url).searchParams.get("gl")).toBe("us");
    expect(JSON.parse(by("chat-gpt-llm-scraper")[0].body!)[0].location_code).toBe(2840);
    expect(JSON.parse(by("cloro.ai-search.chatgpt.scrape")[1].body!).country).toBe("DE");
  });

  it("asks DataForSEO first for a country cloro refuses (Hong Kong), never a refused cloro call", async () => {
    const { askEngine } = await import("../app/lib/treg.server");
    const { env } = await import("../app/lib/env.server");
    const sent: string[] = [];
    const token = env.tregToken;
    (env as { tregToken: string }).tregToken = "test-token";
    vi.stubGlobal("fetch", async (u: string) => {
      sent.push(String(u));
      return new Response(JSON.stringify({}), { status: 500 });
    });
    try {
      for (const engine of ["chatgpt", "gemini", "perplexity"] as const) await askEngine(engine, "best beard oil", "HK").catch(() => null);
    } finally {
      vi.unstubAllGlobals();
      (env as { tregToken: string }).tregToken = token;
    }
    expect(sent.some((u) => u.includes("cloro."))).toBe(false);
    expect(sent.some((u) => u.includes("chat-gpt-llm-scraper"))).toBe(true);
    expect(sent.some((u) => u.includes("gemini-llm-scraper"))).toBe(true);
    expect(sent.some((u) => u.includes("perplexity-llm-responses-live"))).toBe(true);
  });

  it("writes fixes in the store's own language, never English over another language's catalogue", async () => {
    const { guardrails } = await import("../app/lib/fixes.server");
    expect(guardrails("DE")).toContain("same language as the store's product data");
  });
});
