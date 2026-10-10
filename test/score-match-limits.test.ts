import { describe, expect, it } from "vitest";
import { answerPoints, scoreLabel, visibilityScore } from "../app/lib/score";
import { brandKey, merchantPosition, sameBrand, sourcesIncludeDomain, textNamesBrand } from "../app/lib/match";
import {
  canOptimiseProduct,
  canRunManualCheck,
  canRunScan,
  guidePageDue,
  canTrackMoreQuestions,
  remainingFixes,
  remainingGuidePages,
  remainingOutreach,
  type Usage,
} from "../app/lib/limits";
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
    expect(scoreLabel(0).label).toBe("Not named yet");
    // named once but still under 10: say so, never "not named"
    expect(scoreLabel(6, true).label).toBe("Rarely named");
    expect(scoreLabel(6, false).label).toBe("Not named yet");
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
    activeQuestions: 0,
    fixesThisMonth: 0,
    guidePagesThisMonth: 0,
    optimisedProducts: 0,
    outreachThisMonth: 0,
    freeScanUsed: false,
    costThisMonth: 0,
    ...u,
  });

  it("gives paid plans unlimited fixes and the free scan none", () => {
    expect(remainingFixes(PLANS.core, usage({ fixesThisMonth: 999 }))).toBe(Infinity);
    expect(remainingFixes(PLANS.pro, usage({ fixesThisMonth: 999 }))).toBe(Infinity);
    expect(remainingFixes(PLANS.free, usage())).toBe(0);
  });

  it("caps guide pages per month: Standard 2, Done-for-you 8", () => {
    expect(remainingGuidePages(PLANS.core, usage())).toBe(2);
    expect(remainingGuidePages(PLANS.core, usage({ guidePagesThisMonth: 1 }))).toBe(1);
    expect(remainingGuidePages(PLANS.core, usage({ guidePagesThisMonth: 2 }))).toBe(0);
    expect(remainingGuidePages(PLANS.core, usage({ guidePagesThisMonth: 5 }))).toBe(0);
    expect(remainingGuidePages(PLANS.pro, usage({ guidePagesThisMonth: 2 }))).toBe(6);
    expect(remainingGuidePages(PLANS.pro, usage({ guidePagesThisMonth: 8 }))).toBe(0);
    expect(remainingGuidePages(PLANS.free, usage())).toBe(0);
  });

  it("caps outreach per month: Standard 10, Done-for-you 40", () => {
    expect(remainingOutreach(PLANS.core, usage({ outreachThisMonth: 4 }))).toBe(6);
    expect(remainingOutreach(PLANS.core, usage({ outreachThisMonth: 10 }))).toBe(0);
    expect(remainingOutreach(PLANS.pro, usage({ outreachThisMonth: 10 }))).toBe(30);
    expect(remainingOutreach(PLANS.pro, usage({ outreachThisMonth: 40 }))).toBe(0);
    expect(remainingOutreach(PLANS.free, usage())).toBe(0);
  });

  it("caps questions and products", () => {
    expect(canTrackMoreQuestions(PLANS.core, usage({ activeQuestions: 49 }))).toBe(true);
    expect(canTrackMoreQuestions(PLANS.core, usage({ activeQuestions: 50 }))).toBe(false);
    expect(canTrackMoreQuestions(PLANS.pro, usage({ activeQuestions: 50 }))).toBe(true);
    expect(canTrackMoreQuestions(PLANS.pro, usage({ activeQuestions: 100 }))).toBe(false);
    expect(canOptimiseProduct(PLANS.core, usage({ optimisedProducts: 499 }), false)).toBe(true);
    expect(canOptimiseProduct(PLANS.core, usage({ optimisedProducts: 500 }), false)).toBe(false);
    expect(canOptimiseProduct(PLANS.core, usage({ optimisedProducts: 500 }), true)).toBe(true);
    expect(canOptimiseProduct(PLANS.pro, usage({ optimisedProducts: 1999 }), false)).toBe(true);
    expect(canOptimiseProduct(PLANS.pro, usage({ optimisedProducts: 2000 }), false)).toBe(false);
  });

  it("allows one free scan and stops scans over budget", () => {
    expect(canRunScan(PLANS.free, usage(), false).ok).toBe(true);
    expect(canRunScan(PLANS.free, usage({ freeScanUsed: true }), false).ok).toBe(false);
    expect(canRunScan(PLANS.core, usage({ costThisMonth: 14 }), true).ok).toBe(true);
    expect(canRunScan(PLANS.core, usage({ costThisMonth: 15 }), true).ok).toBe(false);
    expect(canRunScan(PLANS.core, usage({ costThisMonth: 15 }), false).ok).toBe(true);
    expect(canRunScan(PLANS.pro, usage({ costThisMonth: 149 }), true).ok).toBe(true);
    expect(canRunScan(PLANS.pro, usage({ costThisMonth: 150 }), true).ok).toBe(false);
  });

  it("maps billing names and keeps Done-for-you daily scans light", () => {
    expect(planFromBillingName("GEO Done-for-you")).toBe("pro");
    expect(planFromBillingName("something")).toBe("free");
    expect(scanSettings(PLANS.pro, "daily")).toEqual({ engines: ["chatgpt", "gemini", "perplexity", "aio"], runs: 1 });
    expect(scanSettings(PLANS.pro, "weekly")).toEqual({ engines: PLANS.pro.engines, runs: 2 });
    expect(scanSettings(PLANS.pro, "weekly").engines).toContain("claude");
    expect(scanSettings(PLANS.core, "weekly")).toEqual({ engines: PLANS.core.engines, runs: 2 });
    // The first scan and the scan after an upgrade are full ones.
    expect(scanSettings(PLANS.pro, "baseline")).toEqual({ engines: PLANS.pro.engines, runs: 2 });
  });

  it("runs every 'check AI now' as a light scan: 1 run, no Claude", () => {
    expect(scanSettings(PLANS.core, "manual")).toEqual({ engines: PLANS.core.engines, runs: 1 });
    expect(scanSettings(PLANS.pro, "manual")).toEqual({ engines: ["chatgpt", "gemini", "perplexity", "aio"], runs: 1 });
  });

  it("refuses 'check AI now' over the cost cap, too often, or without a plan", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
    expect(canRunManualCheck(PLANS.free, usage(), null, now).ok).toBe(false);
    expect(canRunManualCheck(PLANS.core, usage(), null, now).ok).toBe(true);
    // Over the cap: refused, however long ago the last one was (the old code let these through).
    expect(canRunManualCheck(PLANS.core, usage({ costThisMonth: 15 }), null, now)).toMatchObject({ ok: false, reason: expect.stringMatching(/budget/) });
    expect(canRunManualCheck(PLANS.pro, usage({ costThisMonth: 150 }), ago(30), now).ok).toBe(false);
    expect(canRunManualCheck(PLANS.pro, usage({ costThisMonth: 149 }), ago(30), now).ok).toBe(true);
    // Standard: once a week. Done-for-you: once every 3 days.
    expect(canRunManualCheck(PLANS.core, usage(), ago(5), now)).toMatchObject({ ok: false, reason: expect.stringMatching(/a week/) });
    expect(canRunManualCheck(PLANS.core, usage(), ago(7), now).ok).toBe(true);
    expect(canRunManualCheck(PLANS.pro, usage(), ago(2), now)).toMatchObject({ ok: false, reason: expect.stringMatching(/every 3 days/) });
    expect(canRunManualCheck(PLANS.pro, usage(), ago(3), now).ok).toBe(true);
    // Light scans every allowed time stay well inside Standard's US$15: 4.3 a month x 50 questions x 4 assistants x 1 run.
    expect(4.3 * PLANS.core.questions * scanSettings(PLANS.core, "manual").engines.length * scanSettings(PLANS.core, "manual").runs).toBeLessThan(900);
  });

  it("asks Done-for-you for a guide page whenever the month's pace of 8 falls behind", () => {
    const mid = new Date("2026-10-16T12:00:00Z"); // day 16 of 31: 5 of 8 due
    expect(guidePageDue(PLANS.pro, usage({ guidePagesThisMonth: 4 }), mid)).toBe(true);
    expect(guidePageDue(PLANS.pro, usage({ guidePagesThisMonth: 5 }), mid)).toBe(false);
    expect(guidePageDue(PLANS.pro, usage({ guidePagesThisMonth: 0 }), new Date("2026-10-01T09:00:00Z"))).toBe(true);
    expect(guidePageDue(PLANS.pro, usage({ guidePagesThisMonth: 7 }), new Date("2026-10-31T09:00:00Z"))).toBe(true);
    expect(guidePageDue(PLANS.pro, usage({ guidePagesThisMonth: 8 }), new Date("2026-10-31T09:00:00Z"))).toBe(false);
    // Standard approves its 2 by hand, so no pace push.
    expect(guidePageDue(PLANS.core, usage(), mid)).toBe(false);
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
