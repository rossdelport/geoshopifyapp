import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cleanAnswerMarkup, cleanUrl, domainOf, normalizeAnswer } from "../app/lib/answers";
import { guessSourceType } from "../app/lib/sources";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

describe("normalizeAnswer", () => {
  it("cleans ChatGPT (cloro) markup and keeps product names and sources", () => {
    const a = normalizeAnswer("cloro.ai-search.chatgpt.scrape", fixture("cloro-chatgpt.json"));
    expect(a.text).toContain("Professor Fuzzworthy Weightless Luxe Face and Beard Oil Serum");
    expect(a.text).toContain("Jericho Australia Naked Beard Oil");
    expect(a.text).not.toMatch(/<Entity|<Cite|<box|turn442190/);
    expect(a.text).toContain("[Shop Professor Fuzzworthy](https://www.professorfuzzworthy.com.au/)");
    expect(a.sources.map((s) => s.url)).toContain("https://stuga.com.au/blogs/journal/best-beard-oil-in-australia-2026");
    // citation pills duplicate sources: no duplicates
    expect(new Set(a.sources.map((s) => s.url)).size).toBe(a.sources.length);
  });

  it("reads Gemini shopping cards as products", () => {
    const a = normalizeAnswer("cloro.ai-search.gemini.scrape", fixture("cloro-gemini.json"));
    expect(a.products).toEqual([
      { title: "Milkman Beard Oil 50ml", brand: "Milkman", store: "Shaver Shop" },
      { title: "BULLDOG Original Beard Oil", brand: "Bulldog", store: "Chemist Warehouse" },
    ]);
    expect(a.sources[0].url).toBe("https://www.canstarblue.com.au/health-beauty/best-beard-oils/");
  });

  it("reads Perplexity (DataForSEO) text and annotations", () => {
    const a = normalizeAnswer("dataforseo.x.ai-optimization-perplexity-llm-responses-live", fixture("dataforseo-perplexity.json"));
    expect(a.text).toContain("Jack Black Beard Oil");
    expect(a.sources).toHaveLength(3);
  });

  it("reads Google AI Overviews and marks 'no overview' as empty", () => {
    const a = normalizeAnswer("litescrape.google.serp.ai_overview", fixture("litescrape-aio.json"));
    expect(a.text).toContain("Sukin For Men Beard Oil");
    expect(a.text).toContain("Milkman Beard Oil 50ml");
    expect(a.sources.map((s) => domainOf(s.url))).toEqual(["thebeardedchap.com", "reddit.com"]);
    const none = normalizeAnswer("litescrape.google.serp.ai_overview", fixture("litescrape-aio-none.json"));
    expect(none.empty).toBe(true);
  });

  it("reads the AnyAPI AI Overview fallback", () => {
    const a = normalizeAnswer("anyapi.google.serp.ai_overview", fixture("anyapi-aio.json"));
    expect(a.text).toContain("**Milkman**");
    expect(a.sources).toHaveLength(1);
  });

  it("throws on DataForSEO task errors", () => {
    expect(() =>
      normalizeAnswer("dataforseo.x.ai-optimization-claude-llm-responses-live", {
        tasks: [{ status_code: 40501, status_message: "Invalid Field" }],
      }),
    ).toThrow(/40501/);
  });
});

describe("helpers", () => {
  it("strips tracking from URLs", () => {
    expect(cleanUrl("https://a.com/x?utm_source=chatgpt.com&srsltid=1&id=2#top")).toBe("https://a.com/x?id=2");
  });
  it("leaves plain text alone", () => {
    expect(cleanAnswerMarkup("Hello **world**")).toBe("Hello **world**");
  });
  it("guesses source types", () => {
    expect(guessSourceType("https://www.reddit.com/r/x", "reddit.com")).toBe("ugc");
    expect(guessSourceType("https://www.chemistwarehouse.com.au/buy/1", "chemistwarehouse.com.au")).toBe("retailer");
    expect(guessSourceType("https://nestpath.com.au/homeowner-hub/best-beard-oil-australia", "nestpath.com.au")).toBe("editorial");
    expect(guessSourceType("https://jerichoaustralia.com/products/naked", "jerichoaustralia.com")).toBe("brand");
    expect(guessSourceType("https://amazon.com.au/dp/1", "amazon.com.au")).toBe("marketplace");
    expect(guessSourceType("https://someplace.com/", "someplace.com")).toBeNull();
  });
});
