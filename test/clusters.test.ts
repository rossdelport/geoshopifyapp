// Long-tail questions and topic clusters; guide links between a hub and its specific guides; the
// "Updated" line; and the house style on product fixes.

import { describe, expect, it, vi } from "vitest";
import { looksLongTail, mainCluster, normalizeClusterLabel, pickActive, rankLost, roundRobinByCluster, tidyClusters } from "../app/lib/clusters";
import {
  faqFromGuideHtml,
  guideContentText,
  guideProductHandles,
  relatedBlock,
  relatedLinks,
  setRelatedBlock,
  setUpdatedLine,
  stripRelated,
  updatedLineOf,
} from "../app/lib/guide";

vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));

describe("topic clusters", () => {
  it("normalises labels", () => {
    expect(normalizeClusterLabel("  Beard Oil, for DRY Skin! ")).toBe("beard oil for dry skin");
    expect(normalizeClusterLabel("")).toBe("general");
    expect(normalizeClusterLabel(null)).toBe("general");
    expect(normalizeClusterLabel("Crème & Sérum")).toBe("crème & sérum");
  });

  it("keeps at most 8 clusters and moves the rest to the closest kept one", () => {
    const items = [
      ...Array.from({ length: 3 }, (_, i) => ({ question: `best beard oil ${i}`, cluster: "Beard Oil" })),
      ...Array.from({ length: 2 }, (_, i) => ({ question: `beard balm ${i}`, cluster: "beard balm" })),
      { question: "beard oil for sensitive skin", cluster: "sensitive skin beard oil" },
    ];
    const out = tidyClusters(items, 2);
    expect(new Set(out.map((o) => o.cluster))).toEqual(new Set(["beard oil", "beard balm"]));
    expect(out[5].cluster).toBe("beard oil"); // shares "beard" and "oil" with the bigger cluster
    expect(out.map((o) => o.question)).toEqual(items.map((i) => i.question));
  });

  it("keeps the store's existing topics first, so a top-up doesn't start more topics than the cap", () => {
    const items = [
      ...Array.from({ length: 4 }, (_, i) => ({ question: `beard wax ${i}`, cluster: "Beard Wax" })),
      { question: "best beard oil for itchy skin", cluster: "itchy beard oil" },
      { question: "beard balm for travel", cluster: "travel balm" },
    ];
    // The store already has 2 topics and the cap is 3: one new topic (the biggest) fits, the rest fold in.
    const out = tidyClusters(items, 3, ["beard oil", "Beard Balm"]);
    expect(new Set(out.map((o) => o.cluster))).toEqual(new Set(["beard oil", "beard balm", "beard wax"]));
    expect(out[4].cluster).toBe("beard oil");
    expect(out[5].cluster).toBe("beard balm");
    // A store already at the cap gets no new topic at all.
    expect(new Set(tidyClusters(items, 2, ["beard oil", "beard balm"]).map((o) => o.cluster))).toEqual(new Set(["beard oil", "beard balm"]));
  });

  it("guesses long-tail questions that Claude didn't label", () => {
    expect(looksLongTail("best beard oil for sensitive skin")).toBe(true);
    expect(looksLongTail("beard oil under $40")).toBe(true);
    expect(looksLongTail("beard oil gift for my dad")).toBe(true);
    expect(looksLongTail("beard oil without fragrance")).toBe(true);
    expect(looksLongTail("best beard oil")).toBe(false);
    expect(looksLongTail("beard oil australia")).toBe(false);
  });

  it("keeps about 35% of slots for long-tail questions whatever their volume, taken in turn from each cluster", () => {
    const broad = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, longTail: false, volume: 1000 - i, cluster: "beard oil" }));
    const specific = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `oil${i}`, longTail: true, volume: null, cluster: "beard oil" })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `balm${i}`, longTail: true, volume: null, cluster: "beard balm" })),
    ];
    const chosen = pickActive([...broad, ...specific], 10);
    expect(chosen).toHaveLength(10);
    const lt = chosen.filter((c) => c.longTail);
    expect(lt).toHaveLength(4); // round(10 * 0.35)
    expect(lt.map((c) => c.id)).toEqual(["oil0", "balm0", "oil1", "balm1"]);
    expect(chosen.filter((c) => !c.longTail).map((c) => c.id)).toEqual(["b0", "b1", "b2", "b3", "b4", "b5"]);
    // Short of one kind, the other fills in.
    expect(pickActive(specific, 5)).toHaveLength(5);
    expect(pickActive(broad, 5).map((c) => c.id)).toEqual(["b0", "b1", "b2", "b3", "b4"]);
    expect(pickActive(broad, 0)).toEqual([]);
  });

  it("hands the fix writer the questions lost most, across clusters, with volume only breaking ties", () => {
    const qs = [
      { id: "a", mentionRate: 0.4, volume: 5000, cluster: "oil" },
      { id: "b", mentionRate: 0, volume: null, cluster: "oil" },
      { id: "c", mentionRate: 0, volume: 300, cluster: "oil" },
      { id: "d", mentionRate: 0.25, volume: null, cluster: "balm" },
      { id: "e", mentionRate: 0, volume: 10, cluster: "gifts" },
    ];
    expect(rankLost(qs, 4).map((q) => q.id)).toEqual(["c", "e", "d", "b"]);
    expect(rankLost(qs).map((q) => q.id)).toEqual(["c", "e", "d", "b", "a"]);
    expect(roundRobinByCluster([{ cluster: null }, { cluster: null }])).toHaveLength(2);
    expect(mainCluster([{ cluster: "oil" }, { cluster: "balm" }, { cluster: "balm" }, { cluster: null }])).toBe("balm");
    expect(mainCluster([])).toBeNull();
  });
});

describe("links between guides on a topic", () => {
  const body = "<p><strong>Short answer:</strong> A light oil.</p>\n<h2>How often?</h2>\n<p>Daily.</p>";

  it("builds a hub's list and a specific guide's link back, with plain links and escaped titles", () => {
    const hub = relatedBlock("hub", [
      { title: "Beard oil for sensitive skin?", url: "https://shop.com/pages/sensitive" },
      { title: "Oils <under> $40", url: "https://shop.com/pages/budget" },
    ]);
    expect(hub).toContain("<h2>More guides on this topic</h2>");
    expect(hub).toContain("Oils &lt;under&gt; $40");
    expect(hub).not.toContain("utm_");
    expect(relatedBlock("spoke", [{ title: "Best beard oil", url: "https://shop.com/pages/best" }])).toContain("Part of our guide:");
    expect(relatedBlock("hub", [])).toBe("");
    expect(relatedBlock("hub", [{ title: "x", url: "javascript:alert(1)" }])).toBe("");
  });

  it("replaces only our block, and removes it when there's nothing to link", () => {
    const one = setRelatedBlock(body, relatedBlock("spoke", [{ title: "Hub", url: "https://shop.com/pages/hub" }]));
    expect(relatedLinks(one)).toEqual(["https://shop.com/pages/hub"]);
    const edited = one.replace("Daily.", "Daily, after a shower."); // the store's own edit elsewhere
    const two = setRelatedBlock(edited, relatedBlock("spoke", [{ title: "Hub 2", url: "https://shop.com/pages/hub-2" }]));
    expect(relatedLinks(two)).toEqual(["https://shop.com/pages/hub-2"]);
    expect(two).toContain("Daily, after a shower.");
    expect(two.match(/geo-related/g)).toHaveLength(1);
    const none = setRelatedBlock(two, "");
    expect(relatedLinks(none)).toEqual([]);
    expect(stripRelated(none)).toBe(none);
    // The links never become FAQ data.
    expect(faqFromGuideHtml("Which oil?", setRelatedBlock(body, relatedBlock("hub", [{ title: "Guide?", url: "https://shop.com/pages/g" }]))).map((f) => f.q)).toEqual([
      "Which oil?",
      "How often?",
    ]);
  });

  it("dates a guide and compares content without the date line or links", () => {
    const dated = setUpdatedLine(body, new Date("2026-10-11T00:00:00Z"));
    expect(dated.startsWith('<p class="geo-updated"><em>Updated October 2026</em></p>')).toBe(true);
    expect(updatedLineOf(dated)).toBe("October 2026");
    const redated = setUpdatedLine(dated, new Date("2027-01-02T00:00:00Z"));
    expect(updatedLineOf(redated)).toBe("January 2027");
    expect(redated.match(/geo-updated/g)).toHaveLength(1);
    const linked = setRelatedBlock(redated, relatedBlock("spoke", [{ title: "Hub", url: "https://shop.com/pages/hub" }]));
    expect(guideContentText(linked)).toBe(guideContentText(body));
    expect(guideContentText(body.replace("Daily.", "Twice a day."))).not.toBe(guideContentText(body));
    expect(faqFromGuideHtml("Which oil?", dated)[0]).toEqual({ q: "Which oil?", a: "A light oil." });
  });

  it("reads the products a guide links to", () => {
    const html = '<ul><li><a href="https://shop.com/products/beard-oil?utm_source=geo-app">Oil</a></li><li><a href="https://shop.com/products/balm">Balm</a></li><li><a href="https://shop.com/products/beard-oil">Again</a></li></ul>';
    expect(guideProductHandles(html)).toEqual(["beard-oil", "balm"]);
    // A long link with no closing quote stays quick.
    const started = performance.now();
    expect(guideProductHandles(`<a href="${"/products/a".repeat(5_000)}`)).toEqual([]);
    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe("house style on product fixes", () => {
  it("takes em dashes out of everything Claude writes for a product", async () => {
    const { tidyProductWrite, sameFaqText } = await import("../app/lib/fixes.server");
    const out = tidyProductWrite({
      title: "Beard Oil — 30 ml",
      description_html: "<p>For dry skin — made with argan. Sizes 30–50 ml.</p>",
      seo_title: null,
      seo_description: "Soft beard – every day",
      product_type: null,
      faq: [{ q: "Size — how big?", a: "30 ml — a month's use." }],
      missing_info: [],
    });
    expect(JSON.stringify(out)).not.toMatch(/—| – /);
    expect(out.description_html).toContain("30 to 50 ml");
    expect(sameFaqText('[{"q":"Size?","a":"30 ml"}]', [{ q: "size?", a: " 30  ml" }])).toBe(true);
    expect(sameFaqText([{ q: "Size?", a: "30 ml" }], [{ q: "Size?", a: "50 ml" }])).toBe(false);
    expect(sameFaqText(null, null)).toBe(true);
  });
});
