import { describe, expect, it } from "vitest";
import { STARTER_SITES, cleanListingUrl, listingPlan, nextListing, siteKey } from "../app/lib/listings";

describe("listing sites", () => {
  it("puts the sites AI quoted first, most quoted first, then the free starters", () => {
    const plan = listingPlan({
      trade: "Solar panel cleaning",
      aiSites: [
        { domain: "goingrate.com.au", answers: 56, url: "https://www.goingrate.com.au/x" },
        { domain: "hipages.com.au", answers: 116, url: "https://hipages.com.au/y" },
        { domain: "www.yelp.com", answers: 3, url: "https://www.yelp.com/biz/z" },
      ],
      rows: [],
    });
    expect(plan.slice(0, 3).map((i) => i.domain)).toEqual(["hipages.com.au", "goingrate.com.au", "yelp.com.au"]);
    expect(plan[0].why).toBe("AI quoted this site in 116 answers in their AI checks.");
    // Yelp shows once, with its sign-up page, even though AI quoted yelp.com.
    expect(plan.filter((i) => i.domain === "yelp.com.au")).toHaveLength(1);
    expect(plan.find((i) => i.domain === "yelp.com.au")?.url).toBe("https://biz.yelp.com.au/");
    // Their trade's sites: cleaning yes, brokers no.
    expect(plan.some((i) => i.domain === "cleaningsearch.com.au")).toBe(true);
    expect(plan.some((i) => i.domain === "mfaa.com.au")).toBe(false);
  });

  it("marks what Ross did, and today's is the first one still to do", () => {
    const plan = listingPlan({
      trade: "Mortgage broker",
      aiSites: [],
      rows: [
        { domain: "bingplaces.com", status: "listed", url: "https://www.bing.com/maps?x", updatedAt: "2026-11-19T02:00:00Z" },
        { domain: "businessconnect.apple.com", status: "skip", url: null, updatedAt: "2026-11-19T02:00:00Z" },
      ],
    });
    expect(plan[0]).toMatchObject({ domain: "bingplaces.com", status: "listed", link: "https://www.bing.com/maps?x" });
    expect(plan[1].status).toBe("skip");
    expect(nextListing(plan)?.domain).toBe("facebook.com");
    expect(plan.find((i) => i.domain === "mfaa.com.au")).toMatchObject({ members: true });
  });

  it("knows a site by any of its addresses", () => {
    expect(siteKey("biz.yelp.com.au")).toBe("yelp.com.au");
    expect(siteKey("www.facebook.com")).toBe("facebook.com");
    expect(siteKey("m.facebook.com")).toBe("facebook.com");
    expect(siteKey("hipages.com.au")).toBe("hipages.com.au");
  });

  it("only keeps a link to their page on that site", () => {
    expect(cleanListingUrl("https://www.yellow.com.au/detail/123", "yellow.com.au")).toBe("https://www.yellow.com.au/detail/123");
    expect(cleanListingUrl("yellow.com.au/detail/123", "yellow.com.au")).toBe("https://yellow.com.au/detail/123");
    expect(cleanListingUrl("https://evil.com/yellow.com.au", "yellow.com.au")).toBeNull();
    expect(cleanListingUrl("javascript:alert(1)", "yellow.com.au")).toBeNull();
    expect(cleanListingUrl("", "yellow.com.au")).toBeNull();
  });

  it("has a sign-up page on the site itself for every starter", () => {
    for (const s of STARTER_SITES) expect(new URL(s.url).hostname.endsWith(s.domain.replace(/^yelp\.com\.au$/, "yelp.com.au"))).toBe(true);
  });
});
