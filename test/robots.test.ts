// AI crawler check: an RFC 9309 robots.txt parser, and which AI bots can read the store's pages.

import { describe, expect, it } from "vitest";
import { AI_BOTS, botLine, checkRobots, crawlerIssues, isAllowed, parseRobots, patternMatches, ROBOTS_FIX, ROBOTS_LIMIT, type CrawlerCheck } from "../app/lib/robots";

const PATHS = [
  { label: "product pages", path: "/products/sandalwood-beard-oil" },
  { label: "your home page", path: "/" },
  { label: "guide pages", path: "/pages/best-beard-oil-for-dry-skin" },
];

// Shopify's default robots.txt (as served by a real store), with the quirks a naive parser trips on:
// groups with no blank line between them, indented lines, a line run into the next one, a pattern that
// doesn't start with "/", brackets, and "-remote" product rules.
const SHOPIFY_DEFAULT = `# we use Shopify as our ecommerce platform

User-agent: *
Disallow: /a/downloads/-/*
Disallow: /admin
Disallow: /cart
Disallow: /orders
Disallow: /checkouts/
Disallow: /checkout
Disallow: /58238025797/checkouts
Disallow: /carts
Disallow: /account
Disallow: /collections/*sort_by*
Disallow: /*/collections/*sort_by*
Disallow: /collections/*+*
Disallow: /collections/*%2B*
Disallow: */collections/*filter*&*filter*
Disallow: /blogs/*+*
Disallow: /*?*oseid=*
Disallow: /*preview_theme_id*
Disallow: /policies/
Disallow: /search
Allow: /search/
Disallow: /search/?*
Disallow: /recommendations/products
  Disallow: /*/recommendations/products
Disallow: /products/*-[a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9][a-f0-9]-remoteDisallow: /collections/*-loop
Disallow: /products/*-remote
Sitemap: https://www.example-store.com/sitemap.xml

# Google adsbot ignores robots.txt unless specifically named!
User-agent: adsbot-google
Disallow: /checkouts/
Disallow: /checkout
User-agent: Nutch
Disallow: /
User-agent: AhrefsBot
Crawl-delay: 10
Disallow: /a/downloads/-/*
User-agent: MJ12bot
Crawl-Delay: 10
User-agent: Pinterest
Crawl-delay: 1
`;

describe("parsing robots.txt (RFC 9309)", () => {
  it("lets every AI bot read product pages, the home page and guides on Shopify's default robots.txt", () => {
    const r = checkRobots(SHOPIFY_DEFAULT, PATHS);
    expect(r.status).toBe("ok");
    for (const b of r.bots) expect(b.blocked, b.name).toEqual([]);
    // Its own rules still work: carts and odd "-remote" product URLs are blocked for everyone.
    const groups = parseRobots(SHOPIFY_DEFAULT);
    expect(isAllowed(groups, "GPTBot", "/cart")).toBe(false);
    expect(isAllowed(groups, "OAI-SearchBot", "/products/x-remote")).toBe(false);
    expect(isAllowed(groups, "OAI-SearchBot", "/products/remote-control")).toBe(true);
    expect(isAllowed(groups, "Googlebot", "/collections/winter-loop")).toBe(false); // the run-together rule, split back out
    expect(isAllowed(groups, "Googlebot", "/search/beard")).toBe(true);
    // A group that starts without a blank line is its own group: Nutch is blocked, AhrefsBot isn't.
    expect(isAllowed(groups, "Nutch", "/products/a")).toBe(false);
    expect(isAllowed(groups, "AhrefsBot", "/products/a")).toBe(true);
  });

  it("starts a new group at a user-agent line that follows a rule, and shares a group between consecutive ones", () => {
    const groups = parseRobots("User-agent: GPTBot\nUser-agent: ClaudeBot\nDisallow: /\nUser-agent: OAI-SearchBot\nDisallow: /cart");
    expect(groups).toEqual([
      { agents: ["gptbot", "claudebot"], rules: [{ allow: false, path: "/" }] },
      { agents: ["oai-searchbot"], rules: [{ allow: false, path: "/cart" }] },
    ]);
  });

  it("matches the bot without case, and a named group beats '*'", () => {
    const txt = "user-agent: *\ndisallow: /\n\nUSER-AGENT: oai-searchbot\nALLOW: /";
    const groups = parseRobots(txt);
    expect(isAllowed(groups, "OAI-SearchBot", "/products/a")).toBe(true);
    expect(isAllowed(groups, "PerplexityBot", "/products/a")).toBe(false);
  });

  it("merges repeated groups for the same bot", () => {
    const groups = parseRobots("User-agent: PerplexityBot\nDisallow: /pages/\n\nUser-agent: *\nDisallow: /cart\n\nUser-agent: PerplexityBot\nDisallow: /products/");
    expect(isAllowed(groups, "PerplexityBot", "/products/a")).toBe(false);
    expect(isAllowed(groups, "PerplexityBot", "/pages/guide")).toBe(false);
    expect(isAllowed(groups, "PerplexityBot", "/cart")).toBe(true); // the "*" group doesn't apply to it
  });

  it("lets the longest rule win, and Allow win a tie", () => {
    const groups = parseRobots("User-agent: *\nDisallow: /products\nAllow: /products/\nDisallow: /pages/x\nAllow: /pages/x");
    expect(isAllowed(groups, "Googlebot", "/products/a")).toBe(true);
    expect(isAllowed(groups, "Googlebot", "/productsale")).toBe(false);
    expect(isAllowed(groups, "Googlebot", "/pages/x")).toBe(true);
  });

  it("treats only '*' and '$' as special", () => {
    expect(patternMatches("/products/*.json$", "/products/a.json")).toBe(true);
    expect(patternMatches("/products/*.json$", "/products/a.json?x=1")).toBe(false);
    expect(patternMatches("/products/*-[a-f0-9]-remote", "/products/oil-a-remote")).toBe(false);
    expect(patternMatches("/products/*-[a-f0-9]-remote", "/products/oil-[a-f0-9]-remote")).toBe(true);
    expect(patternMatches("/*?*oseid=*", "/products/a?oseid=1")).toBe(true);
    expect(patternMatches("/fish", "/fish.html")).toBe(true);
    expect(patternMatches("/fish$", "/fish.html")).toBe(false);
    expect(patternMatches("/caf%C3%A9", "/café")).toBe(true);
    // Odd patterns stay quick (no regex).
    const started = performance.now();
    expect(patternMatches(`/${"*a".repeat(400)}b`, `/${"a".repeat(300)}`)).toBe(false);
    expect(performance.now() - started).toBeLessThan(200);
  });

  it("ignores rules before any user-agent, comments, empty Disallow, and always allows /robots.txt", () => {
    const groups = parseRobots("Disallow: /\n# User-agent: *\nUser-agent: * # everyone\nDisallow:\nDisallow: / # all\n");
    expect(groups).toEqual([{ agents: ["*"], rules: [{ allow: false, path: "/" }] }]);
    expect(isAllowed(groups, "Googlebot", "/robots.txt")).toBe(true);
    expect(isAllowed(parseRobots(""), "Googlebot", "/")).toBe(true);
  });
});

describe("which AI bots are blocked", () => {
  it("flags a ChatGPT search block as critical, with a plain fix", () => {
    const r = checkRobots(`${SHOPIFY_DEFAULT}\nUser-agent: OAI-SearchBot\nDisallow: /products/\n`, PATHS);
    expect(r.status).toBe("blocked");
    const issues = crawlerIssues({ checkedAt: "", robotsUrl: "", paths: PATHS, ...r } as CrawlerCheck);
    expect(issues.map((b) => [b.token, b.level, b.blocked])).toEqual([["OAI-SearchBot", "critical", ["product pages"]]]);
    expect(botLine(issues[0])).toBe("OAI-SearchBot (OpenAI) can't read product pages. Decides whether your pages can show up in ChatGPT search answers.");
    expect(ROBOTS_FIX).toContain("robots.txt.liquid");
    expect(ROBOTS_LIMIT).toMatch(/firewall/i);
  });

  it("says a training-only block only stops training, never that it hides the store from answers", () => {
    const r = checkRobots("User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /", PATHS);
    expect(r.status).toBe("ok"); // nothing that decides answers is blocked
    const lines = r.bots.filter((b) => b.blocked.length).map(botLine);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toContain("only stops AI training");
      expect(line).not.toMatch(/hide|can't (be )?(found|seen)|won't show/i);
    }
  });

  it("ranks blocks critical first, then medium, then training-only", () => {
    const r = checkRobots("User-agent: GPTBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n\nUser-agent: Googlebot\nDisallow: /pages/", PATHS);
    const issues = crawlerIssues({ checkedAt: "", robotsUrl: "", paths: PATHS, ...r } as CrawlerCheck);
    expect(issues.map((b) => b.token)).toEqual(["Googlebot", "Google-Extended", "GPTBot"]);
    expect(issues[0].blocked).toEqual(["guide pages"]);
    expect(crawlerIssues(null)).toEqual([]);
  });

  it("knows the bots that decide each assistant's answers", () => {
    const level = Object.fromEntries(AI_BOTS.map((b) => [b.token, b.level]));
    expect(level).toMatchObject({
      Googlebot: "critical",
      "OAI-SearchBot": "critical",
      PerplexityBot: "critical",
      "Claude-SearchBot": "medium",
      "Claude-User": "medium",
      "Google-Extended": "medium",
      GPTBot: "info",
      ClaudeBot: "info",
    });
    for (const b of AI_BOTS) expect(b.what).not.toMatch(/—| – /);
    expect(AI_BOTS.find((b) => b.token === "Google-Extended")?.what).toContain("doesn't affect Google Search or AI Overviews");
  });
});
