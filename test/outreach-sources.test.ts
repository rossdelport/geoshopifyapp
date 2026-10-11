// Which sites AI cites (per assistant), what kind of outreach suits each page, and how targets are ranked.

import { describe, expect, it } from "vitest";
import {
  freshnessFactor,
  guessSourceType,
  isRivalDomain,
  isStalePage,
  pageDateLabel,
  threadMaybeClosed,
  latestScanPerEngine,
  matchesDomain,
  noOutreach,
  outreachKind,
  pickAcrossEngines,
  sharedTopDomains,
  sourcesByEngine,
  targetScore,
  updatedLabel,
  yearHint,
  type CitedAnswer,
  type RankInput,
} from "../app/lib/sources";

const NOW = new Date("2026-10-11T00:00:00Z");
const months = (n: number) => new Date(NOW.getTime() - n * 30.44 * 86_400_000);

describe("source types (worldwide)", () => {
  it("knows retailers, marketplaces and publishers outside Australia too", () => {
    expect(guessSourceType("https://www.boots.com/x", "boots.com")).toBe("retailer");
    expect(guessSourceType("https://www.ulta.com/p/1", "ulta.com")).toBe("retailer");
    expect(guessSourceType("https://www.amazon.co.uk/dp/1", "amazon.co.uk")).toBe("marketplace");
    expect(guessSourceType("https://www.nytimes.com/wirecutter/reviews/x/", "nytimes.com")).toBe("editorial");
    expect(guessSourceType("https://www.which.co.uk/reviews/x", "which.co.uk")).toBe("editorial");
    expect(guessSourceType("https://uk.trustpilot.com/review/x", "uk.trustpilot.com")).toBe("ugc");
  });

  it("matches whole site names, so short entries don't catch other sites", () => {
    expect(matchesDomain("x.com", "x.com")).toBe(true);
    expect(matchesDomain("box.com", "x.com")).toBe(false);
    expect(matchesDomain("fedex.com", "x.com")).toBe(false);
    expect(matchesDomain("amazon.com.au", "amazon.")).toBe(true);
    expect(matchesDomain("smile.amazon.de", "amazon.")).toBe(true);
    expect(matchesDomain("notamazon.com", "amazon.")).toBe(false);
    expect(guessSourceType("https://box.com/blog", "box.com")).toBe("editorial"); // by its /blog path, not as social
  });
});

describe("outreach kinds", () => {
  const kind = (url: string, type?: string) => outreachKind(url, new URL(url).hostname.replace(/^www\./, ""), type);

  it("sorts cited pages into honest next steps", () => {
    expect(kind("https://www.youtube.com/watch?v=abc", "ugc")).toBe("video");
    expect(kind("https://youtu.be/abc")).toBe("video");
    expect(kind("https://www.tiktok.com/@x/video/1")).toBe("video");
    expect(kind("https://www.reddit.com/r/beards/comments/abc/best_oil/", "ugc")).toBe("forum");
    expect(kind("https://forums.example.com/t/beard-oil/12")).toBe("forum");
    expect(kind("https://www.facebook.com/groups/beardcare/posts/1")).toBe("forum");
    expect(kind("https://www.quora.com/What-is-the-best-beard-oil", "ugc")).toBe("qa");
    expect(kind("https://www.trustpilot.com/review/brand.com", "ugc")).toBe("directory");
    expect(kind("https://www.yelp.com/biz/shop")).toBe("directory");
    expect(kind("https://www.brand-directory.example/beard")).toBe("directory");
    expect(kind("https://www.chemistwarehouse.com.au/buy/1", "retailer")).toBe("retailer");
    expect(kind("https://www.amazon.com/dp/1", "marketplace")).toBe("retailer");
    expect(kind("https://somestore.example/products/oil", "retailer")).toBe("retailer");
    expect(kind("https://rivalbrand.example/products/oil", "brand")).toBe("other");
    expect(kind("https://www.instagram.com/p/abc")).toBe("other");
    expect(kind("https://beardblog.example/best-beard-oil", "editorial")).toBe("article");
    expect(kind("https://medium.com/@writer/best-oils", "ugc")).toBe("article");
    expect(kind("https://news.example/community/best-oils", "editorial")).toBe("article"); // a publisher's section, not a forum
    expect(kind("https://unknown-community.example/some-thread", "ugc")).toBe("forum");
  });

  it("never suggests outreach on encyclopedias, search engines, government or universities", () => {
    for (const d of ["en.wikipedia.org", "google.com", "support.google.com", "health.gov.au", "fda.gov", "mit.edu", "ox.ac.uk", "mpi.govt.nz"]) {
      expect(noOutreach(d)).toBe(true);
    }
    for (const d of ["nytimes.com", "googleusercontent-blog.example", "edutainment.com"]) expect(noOutreach(d)).toBe(false);
  });
});

describe("freshness", () => {
  it("reads a year from the title or address, ignoring years in the future", () => {
    expect(yearHint("https://x.example/best-beard-oil", "Best beard oil 2026", NOW)).toBe(2026);
    expect(yearHint("https://x.example/2019/05/best-oils", "Best oils for 2025", NOW)).toBe(2025);
    expect(yearHint("https://x.example/best-oils-2030", null, NOW)).toBeNull();
    expect(yearHint("https://x.example/top-20000-items", "Top picks", NOW)).toBeNull();
  });

  it("weights recently updated pages up and old ones down", () => {
    expect(freshnessFactor(months(2), null, NOW)).toBe(1.3);
    expect(freshnessFactor(months(9), null, NOW)).toBe(1.15);
    expect(freshnessFactor(months(18), null, NOW)).toBe(1);
    expect(freshnessFactor(months(40), null, NOW)).toBe(0.75);
    expect(freshnessFactor(null, 2026, NOW)).toBe(1.2);
    expect(freshnessFactor(null, 2025, NOW)).toBe(1.05);
    expect(freshnessFactor(null, 2021, NOW)).toBe(0.75);
    expect(freshnessFactor(null, null, NOW)).toBe(1);
    // The page's own date wins over a year in its title.
    expect(freshnessFactor(months(40), 2026, NOW)).toBe(0.75);
  });

  it("says when a page was updated, the same way everywhere", () => {
    expect(updatedLabel(new Date("2026-03-15T12:00:00Z"))).toBe("Updated March 2026");
    expect(updatedLabel("2025-12-31T23:30:00Z")).toBe("Updated December 2025");
    expect(updatedLabel(null)).toBeNull();
    expect(updatedLabel("not a date")).toBeNull();
  });

  it("words a cited page's date for what we know: updated, published, or just dated", () => {
    expect(pageDateLabel("2026-03-15T12:00:00Z", true)).toBe("Updated March 2026");
    expect(pageDateLabel("2026-03-15T12:00:00Z", false)).toBe("Published March 2026");
    expect(pageDateLabel("2026-03-15T12:00:00Z")).toBe("Dated March 2026");
    expect(pageDateLabel(null, true)).toBeNull();
  });

  it("knows stale pages and threads that are probably closed", () => {
    expect(isStalePage(months(31), null, NOW)).toBe(true);
    expect(isStalePage(months(20), 2019, NOW)).toBe(false); // the page's own date wins
    expect(isStalePage(null, 2023, NOW)).toBe(true);
    expect(isStalePage(null, 2024, NOW)).toBe(false);
    expect(isStalePage(null, null, NOW)).toBe(false);
    expect(threadMaybeClosed("forum", "reddit.com", months(7), NOW)).toBe(true);
    expect(threadMaybeClosed("forum", "reddit.com", months(2), NOW)).toBe(false);
    expect(threadMaybeClosed("forum", "old.reddit.com", null, NOW)).toBe(true); // unknown age on Reddit
    expect(threadMaybeClosed("forum", "boards.example", null, NOW)).toBe(false);
    expect(threadMaybeClosed("qa", "quora.com", months(12), NOW)).toBe(true);
    expect(threadMaybeClosed("article", "gq.com", months(40), NOW)).toBe(false);
  });
});

describe("rival brands' own websites", () => {
  const keys = new Set(["native", "milkman", "groomedman", "dovetail"]);
  it("matches whole domain labels, with a few generic prefixes and suffixes", () => {
    expect(isRivalDomain("milkman.com.au", keys)).toBe(true);
    expect(isRivalDomain("blog.milkman.com", keys)).toBe(true);
    expect(isRivalDomain("milkmanshop.com", keys)).toBe(true);
    expect(isRivalDomain("getmilkman.com", keys)).toBe(true);
    expect(isRivalDomain("the-groomed-man-co.com.au", keys)).toBe(true);
    expect(isRivalDomain("nativecos.com", keys)).toBe(false);
  });

  it("never drops a site whose name only contains a rival's name", () => {
    expect(isRivalDomain("alternativeto.net", keys)).toBe(false);
    expect(isRivalDomain("thealternativedaily.com", keys)).toBe(false);
    expect(isRivalDomain("nativeplanet.com", keys)).toBe(false);
    expect(isRivalDomain("milkmangrooming-reviews.net", keys)).toBe(false);
    expect(isRivalDomain("anything.com", new Set())).toBe(false);
  });
});

describe("ranking targets", () => {
  const base: RankInput = { cited: 4, engines: ["chatgpt"], rivals: 3, merchantNamed: 0, kind: "article" };

  it("ranks pages AI uses more, on more assistants, and fresher, higher", () => {
    expect(targetScore({ ...base, cited: 6 }, NOW)).toBeGreaterThan(targetScore(base, NOW));
    expect(targetScore({ ...base, engines: ["chatgpt", "perplexity"] }, NOW)).toBeGreaterThan(targetScore(base, NOW));
    expect(targetScore({ ...base, modifiedAt: months(1) }, NOW)).toBeGreaterThan(targetScore({ ...base, modifiedAt: months(30) }, NOW));
    expect(targetScore({ ...base, yearHint: 2026 }, NOW)).toBeGreaterThan(targetScore(base, NOW));
  });

  it("puts stale pages last unless two or more assistants cite them, and old threads lower", () => {
    const stale = targetScore({ ...base, cited: 8, modifiedAt: months(40) }, NOW);
    expect(stale).toBeLessThan(targetScore({ ...base, cited: 2, modifiedAt: months(3) }, NOW));
    expect(targetScore({ ...base, cited: 8, engines: ["chatgpt", "aio"], modifiedAt: months(40) }, NOW)).toBeGreaterThan(stale * 3);
    const thread = { ...base, kind: "forum" as const, domain: "reddit.com" };
    expect(targetScore({ ...thread, modifiedAt: months(9) }, NOW)).toBeLessThan(targetScore({ ...thread, modifiedAt: months(2) }, NOW));
    expect(targetScore(thread, NOW)).toBeLessThan(targetScore({ ...thread, domain: "boards.example" }, NOW));
  });

  it("ranks pages where AI already names the store, and shops, lower", () => {
    expect(targetScore({ ...base, merchantNamed: 1 }, NOW)).toBeLessThan(targetScore(base, NOW));
    expect(targetScore({ ...base, kind: "retailer" }, NOW)).toBeLessThan(targetScore(base, NOW));
    expect(targetScore({ ...base, kind: "video" }, NOW)).toBeLessThan(targetScore(base, NOW));
    expect(targetScore({ ...base, cited: 0, merchantNamed: 5 }, NOW)).toBeGreaterThan(0);
  });

  it("takes turns between assistants so each one's sources get worked", () => {
    const items = [
      { id: "gpt1", engines: ["chatgpt"], score: 10 },
      { id: "gpt2", engines: ["chatgpt"], score: 9 },
      { id: "gpt3", engines: ["chatgpt"], score: 8 },
      { id: "aio1", engines: ["aio"], score: 3 },
      { id: "pplx1", engines: ["perplexity"], score: 2 },
    ];
    expect(pickAcrossEngines(items, 3).map((i) => i.id)).toEqual(["gpt1", "aio1", "pplx1"]);
    expect(pickAcrossEngines(items, 5).map((i) => i.id)).toEqual(["gpt1", "aio1", "pplx1", "gpt2", "gpt3"]);
    // A page several assistants use is picked once.
    const shared = [
      { id: "both", engines: ["chatgpt", "aio"], score: 10 },
      { id: "aio2", engines: ["aio"], score: 5 },
    ];
    expect(pickAcrossEngines(shared, 5).map((i) => i.id)).toEqual(["both", "aio2"]);
  });

  it("caps a kind per run and puts pages with no assistant last", () => {
    const items = [
      { id: "shop1", engines: ["chatgpt"], score: 10, kind: "retailer" as const },
      { id: "shop2", engines: ["chatgpt"], score: 9, kind: "retailer" as const },
      { id: "shop3", engines: ["chatgpt"], score: 8, kind: "retailer" as const },
      { id: "art", engines: ["chatgpt"], score: 1, kind: "article" as const },
      { id: "loose", engines: [], score: 50, kind: "article" as const },
    ];
    expect(pickAcrossEngines(items, 10, { retailer: 2 }).map((i) => i.id)).toEqual(["shop1", "shop2", "art", "loose"]);
  });
});

describe("sites each assistant cites", () => {
  const cite = (domain: string, type = "editorial", isOwn = false) => ({ url: `https://${domain}/page`, domain, title: `${domain} page`, type, isOwn });
  const answers: CitedAnswer[] = [
    { engine: "chatgpt", mentioned: false, citations: [cite("gq.com"), cite("gq.com"), cite("nytimes.com")] },
    { engine: "chatgpt", mentioned: true, citations: [cite("gq.com"), cite("mystore.com", "brand", true)] },
    { engine: "aio", mentioned: false, citations: [cite("youtube.com", "ugc"), cite("reddit.com", "ugc")] },
    { engine: "aio", mentioned: false, citations: [cite("youtube.com", "ugc"), cite("gq.com")] },
    { engine: "aio", mentioned: false, citations: [] },
    { engine: "perplexity", mentioned: false, citations: [cite("nichebeards.example")] },
  ];

  it("shows each assistant's own list, with the share of its answers that cite each site", () => {
    const { engines, views } = sourcesByEngine(answers, ["chatgpt", "gemini", "perplexity", "aio", "claude"]);
    expect(engines).toEqual(["chatgpt", "perplexity", "aio"]);
    expect(views.chatgpt.answers).toBe(2);
    expect(views.chatgpt.domains.map((d) => [d.domain, d.answers, d.share])).toEqual([
      ["gq.com", 2, 1],
      ["mystore.com", 1, 0.5],
      ["nytimes.com", 1, 0.5],
    ]);
    expect(views.chatgpt.domains[0].named).toBe(1);
    expect(views.chatgpt.domains.find((d) => d.domain === "mystore.com")?.own).toBe(true);
    expect(views.aio.domains.map((d) => [d.domain, d.answers])).toEqual([
      ["youtube.com", 2],
      ["gq.com", 1],
      ["reddit.com", 1],
    ]);
    expect(views.aio.domains[0].share).toBeCloseTo(2 / 3);
    expect(views.all.answers).toBe(6);
    expect(views.all.domains[0]).toMatchObject({ domain: "gq.com", answers: 3, share: 0.5 });
    // The store's own site counts as "yours" in the kinds of sites.
    expect(views.chatgpt.types.find((t) => t.type === "yours")?.share).toBeCloseTo(1 / 4);
    expect(views.aio.types.find((t) => t.type === "ugc")?.share).toBeCloseTo(3 / 4);
  });

  it("counts how many of each assistant's top sites all of them share", () => {
    const { engines, views } = sourcesByEngine(answers);
    expect(sharedTopDomains(views, ["chatgpt", "aio"], 10)).toEqual({ shared: 1, top: 3 }); // gq.com (own site left out)
    expect(sharedTopDomains(views, engines, 10)).toEqual({ shared: 0, top: 3 });
    expect(sharedTopDomains(views, ["chatgpt"], 10)).toBeNull();
  });

  it("uses each assistant's newest scan, so Claude still shows between weekly scans", () => {
    const scans = ["daily3", "daily2", "weekly1"];
    const groups = [
      { scanId: "daily3", engine: "chatgpt" },
      { scanId: "daily3", engine: "aio" },
      { scanId: "weekly1", engine: "chatgpt" },
      { scanId: "weekly1", engine: "claude" },
      { scanId: "daily2", engine: "gemini" },
    ];
    expect(latestScanPerEngine(scans, groups)).toEqual({ chatgpt: "daily3", aio: "daily3", gemini: "daily2", claude: "weekly1" });
  });
});
