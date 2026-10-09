import { describe, expect, it } from "vitest";
import { answerPoints, scoreLabel, visibilityScore } from "../app/lib/score";
import { brandKey, merchantPosition, sameBrand, sourcesIncludeDomain, textNamesBrand } from "../app/lib/match";
import { canOptimiseProduct, canRunScan, canTrackMoreQuestions, remainingFixes, remainingOutreach, type Usage } from "../app/lib/limits";
import { PLANS, planFromBillingName, scanSettings } from "../app/lib/plans";
import { parseFaq } from "../app/lib/faq";

describe("visibility score", () => {
  it("gives points for top 3, lower, cited-only and missing", () => {
    expect(answerPoints({ engine: "x", mentioned: true, position: 2, cited: false })).toBe(1);
    expect(answerPoints({ engine: "x", mentioned: true, position: 7, cited: false })).toBeCloseTo(2 / 3);
    expect(answerPoints({ engine: "x", mentioned: false, position: null, cited: true })).toBeCloseTo(1 / 3);
    expect(answerPoints({ engine: "x", mentioned: false, position: null, cited: false })).toBe(0);
  });

  it("averages engines equally", () => {
    const result = visibilityScore([
      { engine: "chatgpt", mentioned: true, position: 1, cited: false },
      { engine: "chatgpt", mentioned: true, position: 1, cited: false },
      { engine: "gemini", mentioned: false, position: null, cited: false },
      { engine: "gemini", mentioned: false, position: null, cited: false },
      { engine: "gemini", mentioned: false, position: null, cited: false },
      { engine: "gemini", mentioned: false, position: null, cited: false },
    ]);
    expect(result.byEngine).toEqual({ chatgpt: 100, gemini: 0 });
    expect(result.score).toBe(50);
    expect(result.mentionRate).toBeCloseTo(2 / 6);
  });

  it("is 0 with no answers", () => {
    expect(visibilityScore([]).score).toBe(0);
  });

  it("labels scores", () => {
    expect(scoreLabel(0).label).toBe("Invisible");
    expect(scoreLabel(75).tone).toBe("success");
  });
});

describe("brand matching", () => {
  it("treats close names as the same brand", () => {
    expect(sameBrand("The Groomed Man Co.", "Groomed Man Co")).toBe(true);
    expect(sameBrand("Jericho Australia", "Jericho")).toBe(true);
    expect(sameBrand("Bulldog", "Milkman")).toBe(false);
    expect(brandKey("Bold & Bare")).toBe("boldandbare");
  });

  it("finds whole-word brand names only", () => {
    expect(textNamesBrand("Try **Stuga** beard oil", ["Stuga"])).toBe(true);
    expect(textNamesBrand("Try Stugawood", ["Stuga"])).toBe(false);
    expect(textNamesBrand("anything", ["ab"])).toBe(false);
  });

  it("finds the merchant's position", () => {
    expect(merchantPosition(["Milkman", "Bulldog", "Stuga"], ["Stuga"])).toBe(3);
    expect(merchantPosition(["Milkman"], ["Stuga"])).toBeNull();
  });

  it("matches the merchant's own domains", () => {
    expect(sourcesIncludeDomain(["shop.stuga.com.au"], ["stuga.com.au"])).toBe(true);
    expect(sourcesIncludeDomain(["notstuga.com.au"], ["stuga.com.au"])).toBe(false);
  });
});

describe("plan limits", () => {
  const usage = (u: Partial<Usage> = {}): Usage => ({
    activeQuestions: 0, fixesThisMonth: 0, optimisedProducts: 0, outreachThisMonth: 0, freeScanUsed: false, costThisMonth: 0, ...u,
  });

  it("caps fixes per month", () => {
    expect(remainingFixes(PLANS.core, usage({ fixesThisMonth: 25 }))).toBe(5);
    expect(remainingFixes(PLANS.core, usage({ fixesThisMonth: 40 }))).toBe(0);
    expect(remainingFixes(PLANS.free, usage())).toBe(0);
    expect(remainingFixes(PLANS.pro, usage({ fixesThisMonth: 999 }))).toBe(Infinity);
  });

  it("caps outreach per month", () => {
    expect(remainingOutreach(PLANS.core, usage({ outreachThisMonth: 10 }))).toBe(0);
    expect(remainingOutreach(PLANS.pro, usage({ outreachThisMonth: 10 }))).toBe(30);
  });

  it("caps questions and products", () => {
    expect(canTrackMoreQuestions(PLANS.core, usage({ activeQuestions: 25 }))).toBe(false);
    expect(canTrackMoreQuestions(PLANS.pro, usage({ activeQuestions: 25 }))).toBe(true);
    expect(canOptimiseProduct(PLANS.core, usage({ optimisedProducts: 100 }), false)).toBe(false);
    expect(canOptimiseProduct(PLANS.core, usage({ optimisedProducts: 100 }), true)).toBe(true);
  });

  it("allows one free scan and stops scheduled scans over budget", () => {
    expect(canRunScan(PLANS.free, usage(), false).ok).toBe(true);
    expect(canRunScan(PLANS.free, usage({ freeScanUsed: true }), false).ok).toBe(false);
    expect(canRunScan(PLANS.core, usage({ costThisMonth: 9 }), true).ok).toBe(false);
    expect(canRunScan(PLANS.core, usage({ costThisMonth: 9 }), false).ok).toBe(true);
  });

  it("maps billing names and keeps Pro daily scans light", () => {
    expect(planFromBillingName("GEO Pro")).toBe("pro");
    expect(planFromBillingName("something")).toBe("free");
    expect(scanSettings(PLANS.pro, "daily")).toEqual({ engines: ["chatgpt", "gemini", "perplexity", "aio"], runs: 1 });
    expect(scanSettings(PLANS.pro, "weekly").engines).toContain("claude");
    expect(scanSettings(PLANS.core, "weekly")).toEqual({ engines: PLANS.core.engines, runs: 2 });
  });
});

describe("FAQ parsing", () => {
  it("reads Q/A blocks", () => {
    expect(parseFaq("Q: Is it scented?\nA: No, it's unscented.\n\nQ: How big?\nA: 50 ml.")).toEqual([
      { q: "Is it scented?", a: "No, it's unscented." },
      { q: "How big?", a: "50 ml." },
    ]);
    expect(parseFaq("nothing here")).toBeNull();
  });
});

describe("fallbacks when Claude is unavailable", async () => {
  const { simpleProfile, templateQuestions } = await import("../app/lib/fallbacks");
  it("builds a plain profile from the catalog", () => {
    const p = simpleProfile("Jericho", [
      { productType: "Beard Oil", vendor: "Jericho Australia" },
      { productType: "Beard Oil", vendor: "Jericho Australia" },
      { productType: "Beard Balm", vendor: null },
    ]);
    expect(p.brand_name).toBe("Jericho Australia");
    expect(p.aliases).toEqual(["Jericho"]);
    expect(p.category).toBe("beard oil");
    expect(p.summary).toBe("Jericho Australia sells beard oil, beard balm.");
  });
  it("writes template questions per product type", () => {
    const qs = templateQuestions(["Beard Oil", "beard oil", null, "Beard Balm"], "Australia");
    expect(qs).toHaveLength(10);
    expect(qs[0]).toEqual({ question: "best beard oil in Australia", keyword: "best beard oil" });
  });
});
