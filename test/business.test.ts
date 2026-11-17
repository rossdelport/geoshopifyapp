// Any business in the agency hub (Ross, 17 Nov 2026: "so i can add any business"): the pure rules in lib/business.ts.

import { describe, expect, it } from "vitest";
import { cleanArea, guidesPerMonth, isLocal, LOCAL_GUIDES_PER_MONTH, looksLikeShopify, placeFor, siteName } from "../app/lib/business";
import { PLANS } from "../app/lib/plans";

describe("a business that isn't an online store", () => {
  it("is a shop of kind local", () => {
    expect(isLocal({ kind: "local" })).toBe(true);
    expect(isLocal({ kind: "store" })).toBe(false);
    expect(isLocal({})).toBe(false);
    expect(isLocal(null)).toBe(false);
  });

  it("gets 4 guides a month, about one a week (Ross, 17 Nov 2026), while online stores keep their plan's number", () => {
    expect(LOCAL_GUIDES_PER_MONTH).toBe(4);
    expect(guidesPerMonth({ kind: "local" }, PLANS.pro)).toBe(4);
    expect(guidesPerMonth({ kind: "store" }, PLANS.pro)).toBe(PLANS.pro.guidePagesPerMonth);
    expect(guidesPerMonth({}, PLANS.pro)).toBe(PLANS.pro.guidePagesPerMonth);
    // Never more than the plan allows: a paused (free) business gets none.
    expect(guidesPerMonth({ kind: "local" }, PLANS.free)).toBe(0);
  });

  it("keeps the town or city as one short line", () => {
    expect(cleanArea("  Perth  ")).toBe("Perth");
    expect(cleanArea("Joondalup <b>WA</b>")).toBe("Joondalup bWA/b");
    expect(cleanArea("")).toBeNull();
    expect(cleanArea(null)).toBeNull();
    expect(cleanArea("y".repeat(90))).toHaveLength(60);
  });

  it("asks its questions about its town or city, else the country", () => {
    expect(placeFor({ kind: "local", area: "Perth" }, "Australia")).toBe("Perth");
    expect(placeFor({ kind: "local", area: null }, "Australia")).toBe("Australia");
    expect(placeFor({ kind: "store", area: "Perth" }, "Australia")).toBe("Australia"); // stores keep the country
  });

  it("spots a Shopify store's page, so it's never added as a business by mistake", () => {
    expect(looksLikeShopify('<link href="//cdn.shopify.com/s/files/1/theme.css">')).toBe(true);
    expect(looksLikeShopify("<script>window.Shopify = {}; Shopify.theme = {};</script>")).toBe(true);
    expect(looksLikeShopify('<div id="shopify-section-header">')).toBe(true);
    expect(looksLikeShopify("<html><head><title>Lee Finance</title></head><body>Home loans in Perth</body></html>")).toBe(false);
  });

  it("reads the business's name from its home page", () => {
    expect(siteName('<meta property="og:site_name" content="Lee Finance &amp; Co">')).toBe("Lee Finance & Co");
    expect(siteName('<meta content="Sun Bright Solar" property="og:site_name">')).toBe("Sun Bright Solar");
    expect(siteName("<title>Lee Finance | Mortgage Broker Perth</title>")).toBe("Lee Finance");
    expect(siteName("<title>Perth Plumbing Co - Plumbers in Perth</title>")).toBe("Perth Plumbing Co");
    expect(siteName("<title>Home</title>")).toBe("Home");
    expect(siteName("<p>No title</p>")).toBeNull();
  });
});
