/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON-LD graph */
// The AI Crawler Checker (/tools/ai-crawler-checker): the bot list, reading robots.txt with line numbers
// (always agreeing with robots.ts), the Applebot fallback, Shopify file kinds, the lines to delete, the
// site check (live robots.txt and home page, faked here), the page (head, JSON-LD, copy, one button) and
// the action's guards. Fixtures: test/fixtures/tools/robots-*.txt (one observed, the rest made up).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type MetaDescriptor } from "react-router";

vi.mock("../app/lib/check.server", () => ({ safeFetch: vi.fn() }));
vi.mock("../app/lib/robots.server", () => ({ robotsFetch: vi.fn() }));

// For the guarded-fetch tests at the end, which run the real safeFetch and robotsFetch: DNS says "evil."
// hosts are inside a private network and "rebind." hosts turn private on the second look-up; the
// connection looks the host up with the lookup it was given (where rebinding is caught), then asks `web`.
const web = vi.hoisted(() => ({
  calls: [] as string[],
  lookups: new Map<string, number>(),
  answer: (() => ({ status: 404 })) as (u: URL) => { status: number; location?: string; body?: string; fail?: boolean },
}));
vi.mock("node:dns/promises", () => ({
  Resolver: class {
    async resolve4(host: string) {
      const n = (web.lookups.get(host) ?? 0) + 1;
      web.lookups.set(host, n);
      if (host.startsWith("evil.")) return ["10.0.0.7"];
      if (host.startsWith("rebind.")) return n === 1 ? ["23.227.38.65"] : ["127.0.0.1"];
      return ["23.227.38.65"];
    }
    async resolve6() {
      throw Object.assign(new Error("queryAaaa ENODATA"), { code: "ENODATA" });
    }
  },
}));
vi.mock("../app/lib/http-get.server", () => ({
  httpGet: vi.fn(async (url: URL, opts: { lookup: (h: string, o: object, cb: (err: Error | null) => void) => void }) => {
    await new Promise<void>((resolve, reject) => opts.lookup(url.hostname, { all: true }, (err) => (err ? reject(err) : resolve())));
    web.calls.push(url.toString());
    const a = web.answer(url);
    if (a.fail) throw new Error("The operation was aborted due to timeout");
    const bytes = new TextEncoder().encode(a.body ?? "");
    return {
      status: a.status,
      location: a.location ?? null,
      body: (async function* () {
        for (let i = 0; i < bytes.length; i += 65_536) yield bytes.subarray(i, i + 65_536);
      })(),
      cancel: () => {},
    };
  }),
}));

const { safeFetch } = await import("../app/lib/check.server");
const { robotsFetch } = await import("../app/lib/robots.server");
const { isAllowed, parseRobots } = await import("../app/lib/robots");
const crawler = await import("../app/lib/tools/crawler");
const { BOTS_CHECKED, BOT_GROUPS, FALLBACKS, TOOL_BOTS, checkBots, effectiveToken, explainBlock, robotsKind, verdict, withoutLines, isImportant } = crawler;
const { checkSite, clearCrawlerCache, findStorePages } = await import("../app/lib/tools/crawler.server");
const copy = await import("../app/lib/tools/copy/ai-crawler-checker");
const { PASTE_PATHS, SAMPLE_ROBOTS } = await import("../app/lib/tools/samples/crawler-sample");
const { toolBySlug, TOOLS } = await import("../app/lib/tools/registry");
const { toolJsonLd } = await import("../app/lib/tools/seo");
const { OUTCOME_COPY } = await import("../app/lib/tools/fetch.server");
const { SITE_INPUT_BAD, SITE_INPUT_EMPTY } = await import("../app/lib/tools/site-input");
const { CROSS_SITE_COPY, TOO_BIG_COPY } = await import("../app/lib/tools/guard.server");
const { HOUR_COPY, resetToolLimits } = await import("../app/lib/tools/limits.server");
const { toolHeaders } = await import("../app/lib/tools/http");
const route = await import("../app/routes/tools.ai-crawler-checker");
const { FixBox } = await import("../app/components/tools/crawler-result");
const layout = await import("../app/routes/tools");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const fixture = (name: string) => read(`test/fixtures/tools/robots-${name}.txt`);
/** Real pages captured on 11 Oct 2026 (each file says where from): test/fixtures/tools/hosts-*. */
const hosts = (name: string) => read(`test/fixtures/tools/hosts-${name}`);
const FIXTURES = ["shopify-new", "shopify-old", "cloudflare-style", "empty", "orphan-rules", "allow-wins"] as const;
const TOOL = toolBySlug("ai-crawler-checker");
const text = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
const row = (report: ReturnType<typeof checkBots>, token: string) => report.bots.find((b) => b.token === token)!;

// Paths every fixture is tested on: the paste paths plus odd ones that hit the fixtures' rules.
const PATHS = [
  ...PASTE_PATHS,
  { label: "a page", path: "/pages/about" },
  { label: "the cart", path: "/cart" },
  { label: "a remote product", path: "/products/oil-0123abcd-remote" },
  { label: "a filtered collection", path: "/collections/all+sale" },
  { label: "a search", path: "/search/?q=oil" },
  { label: "robots.txt", path: "/robots.txt" },
  { label: "an encoded path", path: "/products/caf%C3%A9" },
];

// ---------- the bot list ----------

describe("TOOL_BOTS", () => {
  it("has 25 bots, each with a unique token, a group, a level, a what line and an https docs page", () => {
    expect(TOOL_BOTS).toHaveLength(25);
    expect(new Set(TOOL_BOTS.map((b) => b.token.toLowerCase())).size).toBe(TOOL_BOTS.length);
    for (const b of TOOL_BOTS) {
      expect(["recommend", "fetch", "training"]).toContain(b.group);
      expect(["high", "medium", "low", "info"]).toContain(b.level);
      expect(b.what.length, b.token).toBeGreaterThan(20);
      expect(b.what.endsWith("."), b.token).toBe(true);
      expect(new URL(b.docs).protocol, b.token).toBe("https:");
      expect(b.owner).toBeTruthy();
    }
  });

  it("never calls a training bot a problem, and names no unverified bot", () => {
    for (const b of TOOL_BOTS.filter((x) => x.group === "training")) expect(b.level).toBe("info");
    const tokens = TOOL_BOTS.map((b) => b.token.toLowerCase());
    for (const t of ["bytespider", "grokbot", "xai-bot", "google-agent", "anthropic-ai", "claude-web"]) expect(tokens).not.toContain(t);
    expect(TOOL_BOTS.find((b) => b.token === "Claude-User")?.level).toBe("medium");
    expect(TOOL_BOTS.filter((b) => b.mayIgnore).map((b) => b.token)).toEqual(["ChatGPT-User", "Perplexity-User", "meta-externalfetcher", "Amzn-User"]);
    expect(BOT_GROUPS.map((g) => g.heading)).toEqual([
      "Can recommend or cite you",
      "Fetch a page when someone asks",
      "Training only: blocking these doesn't hide you from answers",
    ]);
    expect(BOTS_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------- the sample ----------

describe("the on-load sample", () => {
  const report = checkBots(SAMPLE_ROBOTS, PASTE_PATHS);
  const v = verdict(report);

  it("blocks GPTBot everywhere (training only) and PerplexityBot on the product page only", () => {
    expect(row(report, "GPTBot").pages.every((p) => !p.allowed)).toBe(true);
    const perplexity = row(report, "PerplexityBot");
    expect(perplexity.pages.map((p) => p.allowed)).toEqual([true, false, true]);
    expect(perplexity.pages[1].reason).toEqual({
      agent: { line: 9, text: "User-agent: PerplexityBot" },
      rule: { line: 10, text: "Disallow: /products/" },
      allow: false,
    });
    expect(report.bots.filter((b) => b.blocked).map((b) => b.token)).toEqual(["PerplexityBot", "GPTBot"]);
  });

  it("says 1 bot that affects AI answers is blocked, and 1 training bot", () => {
    expect(v.tone).toBe("bad");
    expect(v.headline).toBe("1 bot that affects AI answers is blocked");
    expect(v.training).toBe("1 training bot is blocked. That only stops AI training.");
    expect(v.shopifyStandard).toBe(false);
  });

  it("lists the PerplexityBot group as the lines to delete, never GPTBot's", () => {
    expect(report.deletions).toEqual([
      { line: 9, text: "User-agent: PerplexityBot" },
      { line: 10, text: "Disallow: /products/" },
    ]);
    const after = verdict(checkBots(withoutLines(SAMPLE_ROBOTS, report.deletions), PASTE_PATHS));
    expect(after.headline).toBe("All the bots that affect AI answers can read your pages");
    expect(after.trainingBlocked).toBe(1);
  });

  it("uses singular and plural correctly", () => {
    const two = verdict(checkBots("User-agent: OAI-SearchBot\nDisallow: /\nUser-agent: Bingbot\nDisallow: /\n", PASTE_PATHS));
    expect(two.headline).toBe("2 bots that affect AI answers are blocked");
    expect(two.training).toBe("Training bots are allowed too.");
    const trainers = verdict(checkBots("User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n", PASTE_PATHS));
    expect(trainers.headline).toBe("All the bots that affect AI answers can read your pages");
    expect(trainers.training).toBe("2 training bots are blocked. That only stops AI training.");
  });

  it("counts a blocked Claude-User (a fetcher that obeys robots.txt) as a block that matters", () => {
    const v2 = verdict(checkBots("User-agent: Claude-User\nDisallow: /\n", PASTE_PATHS));
    expect(v2.blocked).toBe(1);
    // ChatGPT-User says robots.txt may not apply: a note, not a problem.
    expect(verdict(checkBots("User-agent: ChatGPT-User\nDisallow: /\n", PASTE_PATHS)).blocked).toBe(0);
  });
});

// ---------- fallbacks ----------

describe("the Applebot fallback", () => {
  const apple = (t: string) => row(checkBots(t, PASTE_PATHS), "Applebot");

  it("follows the Googlebot group when the file doesn't name Applebot", () => {
    const r = apple("User-agent: *\nAllow: /\n\nUser-agent: Googlebot\nDisallow: /products/\n");
    expect(r.rulesFrom).toBe("Googlebot");
    expect(r.pages.map((p) => p.allowed)).toEqual([true, false, true]);
    expect(r.pages[1].reason?.agent.text).toBe("User-agent: Googlebot");
    expect(effectiveToken(parseRobots("User-agent: googlebot\nDisallow: /x\n"), "Applebot")).toBe("Googlebot");
  });

  it("follows * when neither is named", () => {
    const r = apple("User-agent: *\nDisallow: /collections/\n");
    expect(r.rulesFrom).toBeNull();
    expect(r.pages.map((p) => p.allowed)).toEqual([true, true, false]);
    expect(r.pages[2].reason?.agent.text).toBe("User-agent: *");
  });

  it("follows its own group when there is one", () => {
    const r = apple("User-agent: Googlebot\nDisallow: /\n\nUser-agent: Applebot\nDisallow: /collections/\n");
    expect(r.rulesFrom).toBeNull();
    expect(r.pages.map((p) => p.allowed)).toEqual([true, true, false]);
    expect(FALLBACKS).toEqual({ Applebot: ["Googlebot"] });
  });

  it("treats Amzn-SearchBot like any other bot (no fallback)", () => {
    expect(row(checkBots("User-agent: Googlebot\nDisallow: /\n", PASTE_PATHS), "Amzn-SearchBot").blocked).toBe(false);
  });
});

// ---------- explainBlock agrees with robots.ts ----------

describe("explainBlock", () => {
  it("always agrees with isAllowed, for every bot, path and fixture", () => {
    const tokens = [...TOOL_BOTS.map((b) => b.token), "*", "adsbot-google", "Nutch", "AhrefsBot", "googlebot"];
    let checks = 0;
    for (const name of [...FIXTURES, "sample"] as const) {
      const t = name === "sample" ? SAMPLE_ROBOTS : fixture(name);
      const groups = parseRobots(t);
      for (const token of tokens) {
        for (const p of PATHS) {
          const allowed = isAllowed(groups, token, p.path);
          const why = explainBlock(t, token, p.path);
          expect(why === null || why.allow, `${name} ${token} ${p.path}`).toBe(allowed);
          if (why) {
            expect(why.rule.text).toMatch(/^(allow|disallow)\s*:/i);
            expect(why.agent.text).toMatch(/^user-agent\s*:/i);
            expect(t.split(/\r\n|\r|\n/)[why.rule.line - 1]).toContain(why.rule.text);
          }
          checks++;
        }
      }
    }
    expect(checks).toBeGreaterThan(1_500);
  });

  it("keeps line numbers for run-together lines, BOMs, CRLF and comments", () => {
    const t = "﻿# hi\r\nUser-agent: PerplexityBot # comment\r\n\r\nDisallow: /a/Disallow: /products/\r\n";
    expect(explainBlock(t, "PerplexityBot", "/products/x")).toEqual({
      agent: { line: 2, text: "User-agent: PerplexityBot" },
      rule: { line: 4, text: "Disallow: /products/" },
      allow: false,
    });
    expect(explainBlock(t, "PerplexityBot", "/robots.txt")).toBeNull();
    expect(isAllowed(parseRobots(t), "PerplexityBot", "/products/x")).toBe(false);
  });

  it("names the matching user-agent line in a shared group", () => {
    const t = "User-agent: GPTBot\nUser-agent: PerplexityBot\nDisallow: /\n";
    expect(explainBlock(t, "PerplexityBot", "/")?.agent).toEqual({ line: 2, text: "User-agent: PerplexityBot" });
  });

  it("lets Allow win a tie and a longer Allow beat a shorter Disallow", () => {
    const t = fixture("allow-wins");
    expect(explainBlock(t, "OAI-SearchBot", "/collections/all")).toMatchObject({ rule: { text: "Allow: /collections" }, allow: true });
    expect(explainBlock(t, "OAI-SearchBot", "/products/example")).toMatchObject({ rule: { text: "Allow: /products/example" }, allow: true });
    expect(explainBlock(t, "OAI-SearchBot", "/products/other")).toMatchObject({ rule: { text: "Disallow: /products/" }, allow: false });
    expect(explainBlock(t, "PerplexityBot", "/")).toMatchObject({ rule: { text: "Allow: /$" }, allow: true });
  });
});

// ---------- file kinds and fixtures ----------

describe("robotsKind and the fixtures", () => {
  it("knows Shopify's new default, the old layout with a bot block, and other sites", () => {
    expect(robotsKind(fixture("shopify-new"))).toBe("shopify-new-default");
    expect(robotsKind(fixture("shopify-old"))).toBe("shopify-custom"); // names Amazonbot
    expect(robotsKind(fixture("shopify-old").replace(/User-agent: Amazonbot\nDisallow: \/\n/, ""))).toBe("shopify-old-default");
    expect(robotsKind(fixture("cloudflare-style"))).toBe("other");
    expect(robotsKind(fixture("empty"))).toBe("other");
    expect(robotsKind(fixture("orphan-rules"))).toBe("other");
    expect(robotsKind(fixture("allow-wins"))).toBe("other");
    expect(robotsKind(SAMPLE_ROBOTS)).toBe("other");
    // The new default with a bot block added is a custom Shopify file.
    expect(robotsKind(`${fixture("shopify-new")}\nUser-agent: GPTBot\nDisallow: /\n`)).toBe("shopify-custom");
  });

  it("finds Shopify's 2026 default open to every bot", () => {
    const report = checkBots(fixture("shopify-new"), PASTE_PATHS);
    const v = verdict(report);
    expect(report.bots.every((b) => !b.blocked)).toBe(true);
    expect(v.headline).toBe("All the bots that affect AI answers can read your pages");
    expect(v.training).toBe("Training bots are allowed too.");
    expect(v.shopifyStandard).toBe(true);
    expect(report.sitemaps).toEqual(["https://theme-horizon-demo.myshopify.com/sitemap.xml"]);
    expect(report.notes).toEqual([]);
  });

  it("never calls the older layout Shopify's standard file (www.gymshark.com's edited copy, 11 Oct 2026)", () => {
    const www = hosts("gymshark-www-robots.txt");
    expect(robotsKind(www)).toBe("shopify-old-default");
    const report = checkBots(www, PASTE_PATHS);
    expect(verdict(report).blocked).toBe(0);
    expect(verdict(report).shopifyStandard).toBe(false);
    // Its Crawl-delay lines only slow AhrefsBot, MJ12bot and Pinterest: nothing to say about AI bots.
    expect(report.notes.map((n) => n.id)).not.toContain("crawl-delay");
    // Its Sitemap line is repeated in three groups: listed once.
    expect(report.sitemaps).toEqual(["https://www.gymshark.com/sitemap.xml"]);
    // The made-up old layout without its Amazonbot block is not "standard" either.
    const old = checkBots(fixture("shopify-old").replace(/User-agent: Amazonbot\nDisallow: \/\n/, ""), PASTE_PATHS);
    expect(old.kind).toBe("shopify-old-default");
    expect(verdict(old).shopifyStandard).toBe(false);
    // Shopify's 2026 default still is, and the "standard rules back" line only shows for the other files.
    const checkout = checkBots(hosts("gymshark-checkout-robots.txt"), PASTE_PATHS);
    expect(checkout.kind).toBe("shopify-new-default");
    expect(verdict(checkout).shopifyStandard).toBe(true);
    const box = (r: typeof report) => text(renderToStaticMarkup(createElement(FixBox, { report: r, shopify: true })));
    expect(box(report)).toContain(copy.FIX.restore);
    expect(box(checkout)).not.toContain(copy.FIX.restore);
  });

  it("shows an Amazonbot block on the old layout as training only", () => {
    const report = checkBots(fixture("shopify-old"), PASTE_PATHS);
    const v = verdict(report);
    expect(v.blocked).toBe(0);
    expect(v.trainingBlocked).toBe(1);
    expect(row(report, "Amzn-SearchBot").blocked).toBe(false);
    // Shopify's Crawl-delay lines are for SEO crawlers (AhrefsBot, MJ12bot, Pinterest), not AI bots.
    expect(report.notes).toEqual([]);
  });

  it("notes Crawl-delay only when it applies to every bot or to a bot we list", () => {
    const seoOnly = checkBots("User-agent: AhrefsBot\nCrawl-delay: 10\n\nUser-agent: *\nDisallow: /cart\n", PASTE_PATHS);
    expect(seoOnly.notes.map((n) => n.id)).not.toContain("crawl-delay");
    const everyBot = checkBots("User-agent: *\nCrawl-delay: 5\nDisallow: /cart\n", PASTE_PATHS);
    expect(everyBot.notes.map((n) => n.id)).toContain("crawl-delay");
    expect(everyBot.notes.find((n) => n.id === "crawl-delay")!.text).toBe("Google ignores Crawl-delay. Some other bots follow it.");
    const aiBot = checkBots("User-agent: Bingbot\nUser-agent: GPTBot\nCrawl-delay: 2\nDisallow: /cart\n", PASTE_PATHS);
    expect(aiBot.notes.map((n) => n.id)).toContain("crawl-delay");
  });

  it("counts many blocks on a CDN-style file, and plans deletions that open every bot that matters", () => {
    const t = fixture("cloudflare-style");
    const report = checkBots(t, PASTE_PATHS);
    const v = verdict(report);
    expect(v.headline).toBe("4 bots that affect AI answers are blocked");
    expect(v.training).toBe("6 training bots are blocked. That only stops AI training.");
    // PerplexityBot and Claude-SearchBot share one group: deleting both user-agent lines and the rule.
    expect(report.deletions.map((d) => d.text)).toEqual([
      "User-agent: Google-Extended",
      "Disallow: /",
      "User-agent: PerplexityBot",
      "User-agent: Claude-SearchBot",
      "Disallow: /",
      "Disallow: /",
    ]);
    const after = checkBots(withoutLines(t, report.deletions), PASTE_PATHS);
    expect(verdict(after).blocked).toBe(0);
    expect(verdict(after).trainingBlocked).toBe(6); // training blocks are the owner's choice: untouched
  });

  it("notes an empty file and rules that sit under no user-agent", () => {
    const empty = checkBots(fixture("empty"), PASTE_PATHS);
    expect(empty.hasRules).toBe(false);
    expect(empty.notes.map((n) => n.text)).toEqual(["Your robots.txt has no rules, so every bot is allowed.", "Add a Sitemap line so bots can find all your pages."]);
    expect(checkBots("", PASTE_PATHS).notes).toEqual([{ id: "no-rules", tone: "info", text: "Your robots.txt has no rules, so every bot is allowed." }]);
    const orphans = checkBots(fixture("orphan-rules"), PASTE_PATHS);
    expect(orphans.notes.filter((n) => n.id === "orphan").map((n) => n.text)).toEqual([
      "Line 2 isn't under a User-agent line, so bots ignore it.",
      "Line 3 isn't under a User-agent line, so bots ignore it.",
    ]);
    // The orphan "Disallow: /" blocks nobody; Googlebot's own group blocks collections, and Applebot follows it.
    expect(row(orphans, "OAI-SearchBot").blocked).toBe(false);
    expect(row(orphans, "Applebot").rulesFrom).toBe("Googlebot");
    expect(row(orphans, "Applebot").blocked).toBe(true);
  });

  it("warns about a very large file and tips a blocked low-level bot", () => {
    const big = `User-agent: *\n${"Disallow: /private-folder-name-that-is-long/\n".repeat(12_000)}`;
    expect(checkBots(big, PASTE_PATHS).notes.map((n) => n.id)).toContain("large");
    const mistral = checkBots("User-agent: MistralAI-Index\nDisallow: /\nSitemap: https://a.com/s.xml\n", PASTE_PATHS);
    expect(verdict(mistral).blocked).toBe(0);
    expect(mistral.notes).toEqual([
      { id: "low-blocked", tone: "tip", text: expect.stringContaining("MistralAI-Index (Mistral) is blocked as well.") },
    ]);
  });

  it("never plans a deletion that leaves a bot that matters blocked, on any fixture", () => {
    for (const name of [...FIXTURES, "sample"] as const) {
      const t = name === "sample" ? SAMPLE_ROBOTS : fixture(name);
      const report = checkBots(t, PATHS.slice(0, 4));
      const after = checkBots(withoutLines(t, report.deletions), PATHS.slice(0, 4));
      expect(verdict(after).blocked, name).toBe(0);
      // Training bots that were blocked stay blocked.
      for (const b of report.bots.filter((x) => x.blocked && TOOL_BOTS.find((y) => y.token === x.token)!.group === "training")) {
        expect(row(after, b.token).blocked, `${name} ${b.token}`).toBe(true);
      }
    }
  });

  it("keeps other bots' rules when it takes one bot out of a shared group, and avoids merging groups", () => {
    // Deleting only the Disallow under "*" would make "*" join GPTBot's group: the "*" line goes too.
    const t = "User-agent: *\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /\n";
    const report = checkBots(t, PASTE_PATHS);
    expect(report.deletions).toEqual([
      { line: 1, text: "User-agent: *" },
      { line: 2, text: "Disallow: /" },
    ]);
    const shared = "User-agent: GPTBot\nUser-agent: OAI-SearchBot\nDisallow: /\n";
    expect(checkBots(shared, PASTE_PATHS).deletions).toEqual([{ line: 2, text: "User-agent: OAI-SearchBot" }]);
    // A bot's own group with other rules keeps them: only the blocking rule goes.
    const own = "User-agent: PerplexityBot\nDisallow: /cart\nDisallow: /products/\n";
    expect(checkBots(own, PASTE_PATHS).deletions).toEqual([{ line: 3, text: "Disallow: /products/" }]);
    for (const x of [t, shared, own]) {
      const r = checkBots(x, PASTE_PATHS);
      for (const b of TOOL_BOTS.filter(isImportant)) expect(row(checkBots(withoutLines(x, r.deletions), PASTE_PATHS), b.token).blocked).toBe(false);
    }
  });
});

// ---------- the site check (live fetches faked) ----------

type RobotsAnswer = { status: number; url: string; text: string };
const robotsMock = vi.mocked(robotsFetch);
const pageMock = vi.mocked(safeFetch);

function fakeSite(robots: RobotsAnswer | Error, home: RobotsAnswer | Error = { status: 200, url: "https://shop.example/", text: "<html><body>home</body></html>" }) {
  robotsMock.mockImplementation(async () => {
    if (robots instanceof Error) throw robots;
    return robots;
  });
  pageMock.mockImplementation(async () => {
    if (home instanceof Error) throw home;
    return home;
  });
}

const SHOPIFY_HOME = `<!doctype html><html><head><script>var Shopify = Shopify || {}; Shopify.shop = "x.myshopify.com";</script>
<link href="//cdn.shopify.com/s/files/theme.css" rel="stylesheet"></head><body>
<a href="/">Home</a><a href="/pages/about">About</a><a href="https://shop.example/collections/beard-care?sort=1">Beard care</a>
<a href="/collections/beard-care/products/cedar-oil">Cedar oil in collection</a><a href="/products/cedar-beard-oil?variant=1#top">Cedar oil</a>
<a href="https://other.example/products/not-ours">Elsewhere</a></body></html>`;

const site = (path = "/") => ({ origin: "https://shop.example", host: "shop.example", path });

describe("checkSite", () => {
  beforeEach(() => {
    clearCrawlerCache();
    robotsMock.mockReset();
    pageMock.mockReset();
  });

  it("finds a product and a collection page on the home page (same site, query dropped)", () => {
    expect(findStorePages(SHOPIFY_HOME, "https://shop.example/")).toEqual({ product: "/products/cedar-beard-oil", collection: "/collections/beard-care" });
    expect(findStorePages('<a href="/en-au/products/oil">x</a>', "https://shop.example/")).toEqual({ product: "/en-au/products/oil", collection: null });
    expect(findStorePages("<p>no links</p>", "https://shop.example/")).toEqual({ product: null, collection: null });
  });

  it("tests the home page, the page typed, a product and a collection page, and reads the live file", async () => {
    fakeSite({ status: 200, url: "https://shop.example/robots.txt", text: SAMPLE_ROBOTS }, { status: 200, url: "https://shop.example/", text: SHOPIFY_HOME });
    const out = await checkSite(site("/pages/about"));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(robotsMock).toHaveBeenCalledWith("https://shop.example/robots.txt");
    expect(pageMock.mock.calls[0][0]).toBe("https://shop.example/");
    expect(out.site.shopify).toBe(true);
    expect(out.site.status).toBe("file");
    expect(out.site.report!.paths).toEqual([
      { label: "your home page", path: "/" },
      { label: "the page you entered", path: "/pages/about" },
      { label: "a product page", path: "/products/cedar-beard-oil" },
      { label: "a collection page", path: "/collections/beard-care" },
    ]);
    expect(verdict(out.site.report!).headline).toBe("1 bot that affects AI answers is blocked");
    expect(out.site.pathNote).toBeNull();
  });

  it("uses typical Shopify pages when the home page links none, and says so on other sites", async () => {
    fakeSite({ status: 200, url: "https://shop.example/robots.txt", text: fixture("shopify-new") }, { status: 200, url: "https://shop.example/", text: "<html></html>" });
    const shop = await checkSite(site());
    expect(shop.ok && shop.site.report!.paths.map((p) => p.path)).toEqual(["/", "/products/example", "/collections/all"]);
    expect(shop.ok && shop.site.shopify).toBe(true);
    expect(shop.ok && verdict(shop.site.report!).shopifyStandard).toBe(true);

    clearCrawlerCache();
    fakeSite({ status: 200, url: "https://shop.example/robots.txt", text: "User-agent: *\nDisallow: /admin\n" });
    const other = await checkSite(site());
    expect(other.ok && other.site.shopify).toBe(false);
    expect(other.ok && other.site.report!.paths.map((p) => p.path)).toEqual(["/"]);
    expect(other.ok && other.site.pathNote).toBe("We couldn't find product links on your home page, so we tested your home page.");
  });

  it("says 'turned away' for 401, 403 and 429, and never all clear", async () => {
    for (const status of [401, 403, 429]) {
      clearCrawlerCache();
      fakeSite({ status, url: "https://shop.example/robots.txt", text: "Forbidden" });
      const out = await checkSite(site());
      expect(out.ok).toBe(true);
      if (!out.ok) continue;
      expect(out.site.status).toBe("turned-away");
      expect(out.site.httpStatus).toBe(status);
      expect(out.site.report).toBeNull();
    }
  });

  it("treats a 404 as no file (every bot allowed), and a web page at /robots.txt as no file too", async () => {
    fakeSite({ status: 404, url: "https://shop.example/robots.txt", text: "Not found" });
    const missing = await checkSite(site());
    expect(missing.ok && missing.site.status).toBe("no-file");
    expect(missing.ok && missing.site.report!.bots.every((b) => !b.blocked)).toBe(true);
    expect(missing.ok && missing.site.report!.notes).toEqual([]);

    clearCrawlerCache();
    fakeSite({ status: 200, url: "https://shop.example/robots.txt", text: "<!doctype html><html><body>Welcome</body></html>" });
    const page = await checkSite(site());
    expect(page.ok && page.site.status).toBe("no-file");
    expect(page.ok && page.site.html).toBe(true);
    expect(page.ok && verdict(page.site.report!).tone).toBe("good");
  });

  it("can't read a file behind a server error, and can't reach a private or broken address", async () => {
    fakeSite({ status: 503, url: "https://shop.example/robots.txt", text: "down" });
    const down = await checkSite(site());
    expect(down.ok && down.site.status).toBe("server-error");
    expect(down.ok && down.site.report).toBeNull();

    clearCrawlerCache();
    fakeSite(new Error("This address points to a private network: 10.0.0.1"), new Error("private"));
    const priv = await checkSite(site());
    expect(priv).toEqual({ ok: false, error: OUTCOME_COPY.unreachable });
  });

  it("answers a double submit from its one-minute cache", async () => {
    fakeSite({ status: 404, url: "https://shop.example/robots.txt", text: "" });
    await checkSite(site());
    await checkSite(site());
    expect(robotsMock).toHaveBeenCalledTimes(1);
  });
});

// ---------- a bare domain that lands on a checkout domain (gymshark.com, 11 Oct 2026) ----------

describe("checkSite reads the store's real address", () => {
  beforeEach(() => clearCrawlerCache());

  // What happened on 11 Oct 2026 (Treg fetches, fixtures in test/fixtures/tools/hosts-gymshark-*):
  // https://gymshark.com/ and /robots.txt redirect to us.checkout.gymshark.com, a Shopify store used only for
  // checkout: its home page is a noindex "Redirecting..." page whose script sends people to www.gymshark.com,
  // and its robots.txt is Shopify's 2026 default. The store itself is www.gymshark.com, with its own file.
  const page = (url: string, text: string) => ({ kind: "ok" as const, status: 200, url, text, html: true });
  function gymshark(opts: { wwwHome?: boolean } = {}) {
    const robotsCalls: string[] = [];
    const pageCalls: string[] = [];
    const deps = {
      robots: async (url: string) => {
        robotsCalls.push(url);
        if (url === "https://gymshark.com/robots.txt") return { status: 200, url: "https://us.checkout.gymshark.com/robots.txt", text: hosts("gymshark-checkout-robots.txt") };
        if (url === "https://www.gymshark.com/robots.txt") return { status: 200, url, text: hosts("gymshark-www-robots.txt") };
        return { status: 404, url, text: "" };
      },
      page: async (url: string) => {
        pageCalls.push(url);
        if (url === "https://gymshark.com/") return page("https://us.checkout.gymshark.com/", hosts("gymshark-redirect-page.html"));
        if (url === "https://www.gymshark.com/" && opts.wwwHome !== false) return page(url, hosts("gymshark-www-home.html"));
        return { kind: "missing" as const, status: 404 };
      },
    };
    return { deps, robotsCalls, pageCalls };
  }
  const typed = { origin: "https://gymshark.com", host: "gymshark.com", path: "/" };
  const FIRST_PRODUCT = "/products/gymshark-adapt-x-whitney-halter-neck-tank-sleeveless-tops-green-aw26-b7b9m-edjw";

  it("reads www.gymshark.com's own robots.txt, not the checkout domain's, and says so", async () => {
    const g = gymshark();
    const out = await checkSite(typed, g.deps);
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.host).toBe("www.gymshark.com");
    expect(out.site.robotsUrl).toBe("https://www.gymshark.com/robots.txt");
    expect(out.site.hostNote).toBe("gymshark.com goes to us.checkout.gymshark.com, so we checked www.gymshark.com, where your home page is.");
    expect(g.robotsCalls).toEqual(["https://gymshark.com/robots.txt", "https://www.gymshark.com/robots.txt"]);
    expect(g.pageCalls).toEqual(["https://gymshark.com/", "https://www.gymshark.com/"]);
    const report = out.site.report!;
    expect(report.kind).toBe("shopify-old-default");
    expect(report.sitemaps).toEqual(["https://www.gymshark.com/sitemap.xml"]);
    expect(report.notes.map((n) => n.id)).not.toContain("crawl-delay");
    expect(verdict(report).shopifyStandard).toBe(false);
    expect(verdict(report).headline).toBe("All the bots that affect AI answers can read your pages");
  });

  it("tests a real product page from the store's home page, never a made-up one", async () => {
    const out = await checkSite(typed, gymshark().deps);
    if (!out.ok) throw new Error("expected a result");
    const paths = out.site.report!.paths.map((p) => p.path);
    expect(paths[0]).toBe("/");
    expect(paths[1]).toBe(FIRST_PRODUCT);
    expect(paths).not.toContain("/products/example");
    expect(out.site.report!.paths[2].path).toMatch(/^\/collections\/[^/]+$/);
    expect(out.site.shopify).toBe(true);
  });

  it("shows the address it read and why, on the page", async () => {
    const out = await checkSite(typed, gymshark().deps);
    const page = text(renderPage({ ok: true, intent: "fetch", url: "gymshark.com", site: out.ok ? out.site : null }));
    expect(page).toContain("We read https://www.gymshark.com/robots.txt");
    expect(page).toContain("gymshark.com goes to us.checkout.gymshark.com, so we checked www.gymshark.com, where your home page is.");
    expect(page).not.toContain("Google ignores Crawl-delay");
    expect(page).not.toContain(crawler.VERDICT_COPY.shopifyStandard);
  });

  it("stays on the checkout domain, and names it, when www answers with no home page", async () => {
    const out = await checkSite(typed, gymshark({ wwwHome: false }).deps);
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.host).toBe("us.checkout.gymshark.com");
    expect(out.site.robotsUrl).toBe("https://us.checkout.gymshark.com/robots.txt");
    expect(out.site.hostNote).toBe("gymshark.com sends visitors to us.checkout.gymshark.com, so we checked that address.");
  });

  it("gives no note, and reads the file once, when the typed address is the store", async () => {
    const g = gymshark();
    const out = await checkSite({ origin: "https://www.gymshark.com", host: "www.gymshark.com", path: "/" }, g.deps);
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.hostNote).toBeUndefined();
    expect(g.robotsCalls).toEqual(["https://www.gymshark.com/robots.txt"]);
    expect(g.pageCalls).toEqual(["https://www.gymshark.com/"]);
  });

  it("finds a product linked only inside a collection, and tests its own page", () => {
    expect(findStorePages('<a href="/collections/sale/products/cedar-oil?variant=2">Oil</a><a href="/collections/sale">Sale</a>', "https://shop.example/")).toEqual({
      product: "/products/cedar-oil",
      collection: "/collections/sale",
    });
    expect(findStorePages('<a href="/en-au/collections/sale/products/oil">Oil</a>', "https://shop.example/")).toEqual({ product: "/en-au/products/oil", collection: null });
    // A plain product link still wins, even when it comes later.
    expect(findStorePages('<a href="/collections/a/products/x">X</a><a href="/products/y">Y</a>', "https://shop.example/").product).toBe("/products/y");
  });
});

// ---------- the action ----------

function post(fields: Record<string, string>, headers: Record<string, string> = {}, body?: string) {
  const request = new Request("https://usegeo.app/tools/ai-crawler-checker", {
    method: "POST",
    body: body ?? new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": "203.0.113.9", ...headers },
  });
  return route.action({ request, params: {}, context: {} } as unknown as ActionFunctionArgs) as unknown as Promise<{
    data: { ok: boolean; error?: string; intent: string; site?: unknown; text?: string | null };
    init: ResponseInit | null;
  }>;
}
const headersOf = (r: { init: ResponseInit | null }) => new Headers(r.init?.headers);

describe("the action", () => {
  beforeEach(() => {
    clearCrawlerCache();
    resetToolLimits();
    robotsMock.mockReset();
    pageMock.mockReset();
  });
  afterEach(() => resetToolLimits());

  it("checks a site, with no-store and noindex headers", async () => {
    fakeSite({ status: 200, url: "https://shop.example/robots.txt", text: SAMPLE_ROBOTS });
    const res = await post({ intent: "fetch", url: "Shop.Example/products/x?utm=1" });
    expect(res.init?.status ?? 200).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(robotsMock).toHaveBeenCalledWith("https://shop.example/robots.txt");
    expect(headersOf(res).get("Cache-Control")).toBe("no-store");
    expect(headersOf(res).get("X-Robots-Tag")).toBe("noindex");
  });

  it("refuses a post from another site (403) and a body that's too big (413)", async () => {
    const cross = await post({ intent: "fetch", url: "shop.example" }, { "sec-fetch-site": "cross-site" });
    expect(cross.init?.status).toBe(403);
    expect(cross.data.error).toBe(CROSS_SITE_COPY);
    const evil = await post({ intent: "fetch", url: "shop.example" }, { origin: "https://evil.example" });
    expect(evil.init?.status).toBe(403);
    const big = await post({}, {}, `intent=paste&text=${"a".repeat(1_100_000)}`);
    expect(big.init?.status).toBe(413);
    expect(big.data.error).toBe(TOO_BIG_COPY);
    expect(robotsMock).not.toHaveBeenCalled();
  });

  it("gives a filled-in honeypot the normal empty result, with no fetch", async () => {
    const res = await post({ intent: "fetch", url: "shop.example", website: "spam.example" });
    expect(res.data).toEqual({ ok: true, intent: "fetch", url: "shop.example", site: null });
    expect(robotsMock).not.toHaveBeenCalled();
    const paste = await post({ intent: "paste", text: "User-agent: *", website: "x" });
    expect(paste.data).toEqual({ ok: true, intent: "paste", text: null });
  });

  it("refuses bad input (400): empty, an IP address, localhost, a very long paste", async () => {
    for (const [url, error] of [
      ["", SITE_INPUT_EMPTY],
      ["10.0.0.1", SITE_INPUT_BAD],
      ["http://localhost/robots.txt", SITE_INPUT_BAD],
      ["shop.example:8080", SITE_INPUT_BAD],
    ] as const) {
      const res = await post({ intent: "fetch", url });
      expect(res.init?.status, url).toBe(400);
      expect(res.data.error).toBe(error);
    }
    const long = await post({ intent: "paste", text: "a".repeat(100_001) });
    expect(long.init?.status).toBe(400);
    expect(long.data.error).toBe("That's a very long file. Paste up to 100,000 characters.");
    expect(robotsMock).not.toHaveBeenCalled();
  });

  it("gives the unreachable copy (502) when the site can't be reached", async () => {
    fakeSite(new Error("getaddrinfo ENOTFOUND"), new Error("x"));
    const res = await post({ intent: "fetch", url: "nowhere.example" });
    expect(res.init?.status).toBe(502);
    expect(res.data.error).toBe(OUTCOME_COPY.unreachable);
    expect(JSON.stringify(res.data)).not.toContain("ENOTFOUND");
  });

  it("limits site checks to 20 an hour per visitor (429)", async () => {
    fakeSite({ status: 404, url: "https://shop.example/robots.txt", text: "" });
    for (let i = 0; i < 20; i++) expect((await post({ intent: "fetch", url: `shop${i}.example` })).data.ok).toBe(true);
    const over = await post({ intent: "fetch", url: "shop99.example" });
    expect(over.init?.status).toBe(429);
    expect(over.data.error).toBe(HOUR_COPY);
    // Another visitor still gets through.
    expect((await post({ intent: "fetch", url: "shop99.example" }, { "x-real-ip": "198.51.100.7" })).data.ok).toBe(true);
  });

  it("counts a pasted file's CRLF line breaks as one character, like the text box does", async () => {
    const lines = "Disallow: /x\r\n".repeat(7_000); // 98,000 characters with LF, 105,000 as sent
    const res = await post({ intent: "paste", text: `User-agent: *\r\n${lines}` });
    expect(res.init?.status ?? 200).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.text).not.toContain("\r");
  });

  it("answers a no-JavaScript paste with the text, so the page can show its result", async () => {
    const res = await post({ intent: "paste", text: "User-agent: GPTBot\nDisallow: /" });
    expect(res.data).toEqual({ ok: true, intent: "paste", text: "User-agent: GPTBot\nDisallow: /" });
    expect(headersOf(res).get("X-Robots-Tag")).toBe("noindex");
    expect(robotsMock).not.toHaveBeenCalled();
  });
});

// ---------- the page ----------

const callMeta = () => (route.meta as unknown as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });

describe("the page head", () => {
  const list = callMeta();
  const find = (k: string, v: string) => list.find((m) => (m as Record<string, unknown>)[k] === v) as Record<string, string> | undefined;

  it("has the registry title and description, one canonical, Open Graph and Twitter tags, no robots meta", () => {
    expect(list.filter((m) => "title" in m)).toEqual([{ title: "AI Crawler Checker: Which AI Bots Can Read Your Site | GEO" }]);
    expect(TOOL.title.length).toBeLessThan(60);
    expect(find("name", "description")?.content).toBe(TOOL.description);
    expect(TOOL.description.length).toBeLessThan(155);
    const canonicals = list.filter((m) => (m as { rel?: string }).rel === "canonical") as { href: string }[];
    expect(canonicals.map((c) => c.href)).toEqual(["https://usegeo.app/tools/ai-crawler-checker"]);
    expect(find("property", "og:url")?.content).toBe("https://usegeo.app/tools/ai-crawler-checker");
    expect(find("property", "og:image")?.content).toBe("https://usegeo.app/og/ai-crawler-checker.png");
    expect(find("property", "og:image:width")?.content).toBe("1200");
    expect(find("property", "og:image:height")?.content).toBe("630");
    expect(find("name", "twitter:card")?.content).toBe("summary_large_image");
    expect(find("name", "robots")).toBeUndefined();
  });

  it("has one JSON-LD graph with the app (free, no ratings), the page, breadcrumbs, the company and the same FAQs", () => {
    const ld = (list.find((m) => "script:ld+json" in m) as Record<string, unknown>)["script:ld+json"] as { "@graph": Record<string, any>[] };
    expect(ld).toEqual(toolJsonLd(TOOL, copy.FAQS));
    const json = JSON.stringify(ld);
    expect(JSON.parse(json)).toBeTruthy();
    expect(json.length).toBeLessThan(8_000);
    expect(json).not.toMatch(/aggregateRating|"review"/);
    const byType = (t: string) => ld["@graph"].find((n) => n["@type"] === t)!;
    expect(byType("WebApplication").offers.price).toBe("0");
    expect(byType("WebPage").dateModified).toBe(TOOL.updated);
    expect(byType("BreadcrumbList").itemListElement).toHaveLength(3);
    expect(byType("Organization").name).toBe("GEO");
    expect(byType("FAQPage").mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text])).toEqual(copy.FAQS.map((f) => [f.q, f.a]));
  });

  it("links its own stylesheet and uses the shared headers", () => {
    expect(route.links()).toHaveLength(1);
    expect(route.headers).toBe(toolHeaders);
  });
});

function renderPage(actionData?: unknown) {
  const Stub = createRoutesStub([
    {
      id: "tools",
      path: "/tools",
      Component: layout.default as ComponentType,
      children: [{ id: "crawler", path: "ai-crawler-checker", Component: route.default as ComponentType, action: () => null }],
    },
  ]);
  return renderToStaticMarkup(
    createElement(Stub, {
      initialEntries: ["/tools/ai-crawler-checker"],
      ...(actionData ? { hydrationData: { loaderData: {}, actionData: { crawler: actionData } } } : {}),
    }),
  );
}

describe("the page (server render, no JavaScript)", () => {
  const out = renderPage();
  const plain = text(out);

  it("has one H1 with the search term, the intro, the form and the trust line", () => {
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).toContain('<h1 class="ck-h1">AI Crawler Checker</h1>');
    expect(plain).toContain(copy.INTRO);
    expect(plain.match(/The AI Crawler Checker is a free tool/g)).toHaveLength(1);
    expect(out).toMatch(/<form[^>]*method="post"[^>]*class="tl-form"/);
    expect(out).toContain('name="url"');
    expect(out).toContain('inputMode="url"');
    expect(out).toContain('name="website"'); // the honeypot
    expect(plain).toContain("Free · No sign-up · Results in seconds");
  });

  it("shows the labelled made-up sample in the paste box, with its result", () => {
    expect(out).toMatch(/<span class="ck-chip is-grey">Example<\/span><span>A made-up robots.txt that blocks two bots. Edit it to test your own rules.<\/span>/);
    expect(out).toContain("# Example robots.txt (made up)");
    expect(out).toContain('name="text"');
    expect(out).toContain('value="paste"');
    expect(plain).toContain("Test this robots.txt");
    expect(plain).toContain("1 bot that affects AI answers is blocked");
    expect(plain).toContain("1 training bot is blocked. That only stops AI training.");
    expect(plain).toContain("Blocked by line 10: Disallow: /products/ (in the User-agent: PerplexityBot group).");
    for (const g of BOT_GROUPS) expect(plain).toContain(g.heading);
    for (const b of TOOL_BOTS) expect(out).toContain(`>${b.token}</a>`);
    expect(plain).toContain("Fix it on Shopify");
    expect(plain).toContain(copy.FIX.steps);
    expect(plain).toContain("Line 9: User-agent: PerplexityBot\nLine 10: Disallow: /products/");
    expect(plain).toContain("What robots.txt can't show");
    expect(plain).toContain(copy.LIMITS.text);
  });

  it("has exactly one button under the result, with the spec's words and link", () => {
    expect(out.match(/tl-cta"/g)).toHaveLength(1);
    expect(out).toMatch(/<a class="ck-btn ck-btn-dark tl-cta" href="\/\?ref=tool-ai-crawler-checker#how">Let GEO check this for you every week/);
    expect(out.indexOf('id="result"')).toBeLessThan(out.indexOf("tl-cta-card"));
    expect(out.indexOf("tl-cta-card")).toBeLessThan(out.indexOf('id="what-it-checks"'));
  });

  it("has what it checks, the explainers, the bot table, how it works, visible FAQs, more tools, the date and the footer", () => {
    expect(plain).toContain("What this tool checks");
    for (const item of copy.WHAT_IT_CHECKS) expect(plain).toContain(item);
    expect(plain).toContain("25 bots from OpenAI, Google");
    expect(out).toContain(">What is GPTBot?</h2>");
    expect(out).toContain(">What is OAI-SearchBot?</h2>");
    for (const e of copy.EXPLAINERS) for (const p of e.paragraphs) expect(plain).toContain(p);
    expect(out).toContain(">Every bot we check</h2>");
    expect(plain).toContain("From each company's own crawler pages, checked 11 October 2026");
    expect(out.match(/<tr>/g)?.length).toBe(TOOL_BOTS.length + 1);
    expect(plain).toContain("How this tool works");
    for (const item of copy.howItWorks("11 October 2026")) expect(plain).toContain(item.text.replace(/`/g, ""));
    for (const f of copy.FAQS) {
      expect(out).toContain(`<h3 class="ck-h3">${f.q.replace(/'/g, "&#x27;")}</h3>`);
      expect(plain).toContain(f.a);
    }
    expect(out).not.toMatch(/<details|\shidden[\s>=]/);
    for (const s of TOOL.related) expect(out).toContain(`<a href="${toolBySlug(s).path}">${toolBySlug(s).name}</a>`);
    expect(plain).toContain("Updated 11 October 2026 · Made by GEO");
    expect(out).toContain('class="tl-foot"');
    expect(out).toContain('href="/tools"');
    for (const t of TOOLS) expect(out).toContain(`href="${t.path}"`);
  });

  it("shows a no-JavaScript paste result in place of the sample", () => {
    const page = text(renderPage({ ok: true, intent: "paste", text: "User-agent: OAI-SearchBot\nDisallow: /" }));
    expect(page).not.toContain("A made-up robots.txt");
    expect(page).toContain("User-agent: OAI-SearchBot");
    expect(page).toContain("1 bot that affects AI answers is blocked");
    expect(page).toContain("Blocked by line 2: Disallow: / (in the User-agent: OAI-SearchBot group).");
  });

  it("shows a site result, a turned-away site, and errors next to the form", async () => {
    clearCrawlerCache();
    fakeSite({ status: 200, url: "https://shop.example/robots.txt", text: fixture("shopify-new") }, { status: 200, url: "https://shop.example/", text: SHOPIFY_HOME });
    const out1 = await checkSite(site());
    const page = text(renderPage({ ok: true, intent: "fetch", url: "shop.example", site: out1.ok ? out1.site : null }));
    expect(page).toContain("All the bots that affect AI answers can read your pages");
    expect(page).toContain("You have Shopify's standard robots.txt. It blocks no AI bot.");
    expect(page).toContain("We read https://shop.example/robots.txt");
    expect(page).toContain("/products/cedar-beard-oil");
    expect(page).toContain(copy.FIX.cleanTitle);
    expect(page).not.toContain(copy.FIX.restore); // it is the standard file already
    expect(page).not.toContain("A made-up robots.txt");
    // A customised Shopify file that blocks nothing that matters can still go back to the standard one.
    const custom = text(renderPage({ ok: true, intent: "paste", text: fixture("shopify-old") }));
    expect(custom).toContain(copy.FIX.cleanTitle);
    expect(custom).toContain(copy.FIX.restore);
    expect(page).toContain("Test a robots.txt before you publish it");

    const away = text(
      renderPage({
        ok: true,
        intent: "fetch",
        url: "shop.example",
        site: { host: "shop.example", robotsUrl: "https://shop.example/robots.txt", status: "turned-away", httpStatus: 403, shopify: false, report: null, pathNote: null },
      }),
    );
    expect(away).toContain("We couldn't read your robots.txt");
    expect(away).toContain(copy.SITE_COPY.turnedAway(403));
    expect(away).not.toContain("All clear");
    expect(away).not.toContain("can read your pages");

    const bad = renderPage({ ok: false, intent: "fetch", url: "not a site", error: SITE_INPUT_BAD });
    expect(bad).toContain('role="alert"');
    expect(text(bad)).toContain(SITE_INPUT_BAD);
    expect(bad).toContain('value="not a site"');
  });
});

// ---------- copy rules ----------

describe("copy rules", () => {
  const files = ["app/lib/tools/copy/ai-crawler-checker.ts", "app/lib/tools/crawler.ts", "app/lib/tools/samples/crawler-sample.ts", "app/components/tools/crawler-result.tsx", "app/routes/tools.ai-crawler-checker.tsx"];

  it("has 4 to 6 FAQs", () => {
    expect(copy.FAQS.length).toBeGreaterThanOrEqual(4);
    expect(copy.FAQS.length).toBeLessThanOrEqual(6);
  });

  it("has no em dash, no spaced en dash and no jargon", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/\u2014/);
      expect(src, f).not.toMatch(/\s\u2013\s/);
      expect(src, f).not.toMatch(/AEO| LLM|generative engine optimization/i);
    }
    const shown = text(renderPage());
    expect(shown).not.toMatch(/\u2014|\s\u2013\s/);
    expect(shown).not.toMatch(/\bAEO\b| LLM|generative engine optimization/);
    // "GEO" only as the brand name.
    expect(shown.match(/\bGEO\b/g)?.length).toBeGreaterThan(0);
  });

  it("never says FAQ markup or robots.txt gets anyone into AI answers or rich results", () => {
    const all = JSON.stringify(copy);
    expect(all).not.toMatch(/rich result/i);
    expect(all).not.toMatch(/guarantee/i);
  });
});

// ---------- bounded work (review fixes) ----------

// A small random robots.txt from pieces that hit the matcher's edge cases ("*", "$", percent-encoding,
// unicode, shared groups, run-together lines). Seeded, so a failure always repeats.
function randomRobots(seed: number): string {
  let x = seed;
  const rnd = (n: number) => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x % n;
  };
  const agents = ["*", "GPTBot", "OAI-SearchBot", "googlebot", "Applebot", "PerplexityBot", "Claude-User", "MistralAI-Index", "otherbot"];
  const paths = ["/", "/*", "/$", "/products/", "/products/*", "/products/ex*le$", "/collections/a", "/coll*ll$", "/*.js", "/caf%C3%A9", "/café", "/%2A", "/*?*", "/products/example", "/pages", "/**/all", "/collections/all$"];
  const lines: string[] = [];
  for (let g = 0, groups = 1 + rnd(5); g < groups; g++) {
    for (let a = 0, n = 1 + rnd(3); a < n; a++) lines.push(`User-agent: ${agents[rnd(agents.length)]}`);
    if (rnd(6) === 0) lines.push("Sitemap: https://shop.example/sitemap.xml");
    for (let r = 0, n = rnd(5); r < n; r++) lines.push(`${rnd(3) ? "Disallow" : "Allow"}: ${paths[rnd(paths.length)]}`);
    if (rnd(8) === 0) lines.push(`Disallow: /aDisallow: ${paths[rnd(paths.length)]}`);
  }
  return lines.join(rnd(2) ? "\n" : "\r\n");
}

describe("bounded work", () => {
  const EDGE_PATHS = [...PASTE_PATHS, { label: "a page", path: "/caf%C3%A9" }, { label: "a script", path: "/x.js" }, { label: "a star", path: "/*" }];

  it("never changes a decision: the screened, shared decisions equal isAllowed and explainBlock on 400 random files", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const t = randomRobots(seed);
      const groups = parseRobots(t);
      const report = checkBots(t, EDGE_PATHS);
      expect(report.tooComplex, String(seed)).toBeUndefined();
      for (const r of report.bots) {
        const token = effectiveToken(groups, r.token);
        for (const p of r.pages) {
          expect(p.allowed, `${seed} ${r.token} ${p.path}`).toBe(isAllowed(groups, token, p.path));
          const why = explainBlock(t, token, p.path);
          if (p.allowed) expect(p.reason).toBeNull();
          else expect(p.reason, `${seed} ${r.token} ${p.path}`).toEqual(why);
        }
      }
    }
  });

  it("answers a 500 KB file of repeated blocks quickly and correctly (the plan was 22 s before)", () => {
    const long = [{ label: "x", path: `/${"a".repeat(299)}` }, ...PASTE_PATHS];
    let t = "User-agent: *\n";
    while (t.length < 512_000) t += "Disallow: /\n";
    const started = performance.now();
    const report = checkBots(t, long);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(report.tooComplex).toBeUndefined();
    expect(verdict(report).headline).toBe("12 bots that affect AI answers are blocked");
    expect(report.deletions.length).toBeGreaterThan(0);
  });

  it("gives up on a file built to be slow, quickly, and never calls it all clear", () => {
    // Every rule passes the screen for this path, and each one makes the matcher retry a long piece.
    const crafted = [{ label: "your home page", path: "/" }, { label: "the page you entered", path: `/${"a".repeat(298)}b` }];
    let t = "User-agent: *\n";
    while (t.length < 512_000) t += `Disallow: /*${"a".repeat(150)}b\n`;
    const started = performance.now();
    const report = checkBots(t, crafted);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(report.tooComplex).toBe(true);
    const v = verdict(report);
    expect(v.tone).toBe("warn");
    expect(v.headline).toBe("We couldn't check this robots.txt");
    expect(v.headline).not.toBe(crawler.VERDICT_COPY.allClear);
    // A paste (fixed short pages) can't be made slow the same way.
    const pasted = performance.now();
    const p = checkBots(t.slice(0, copy.MAX_PASTE), PASTE_PATHS);
    expect(performance.now() - pasted).toBeLessThan(1_000);
    expect(p.tooComplex).toBeUndefined();
  });

  it("keeps a paste of 100,000 characters of shared groups fast", () => {
    let t = "";
    while (t.length < copy.MAX_PASTE) t += "User-agent: *\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nDisallow: /\nDisallow: /a\n";
    const started = performance.now();
    const report = checkBots(t.slice(0, copy.MAX_PASTE), PASTE_PATHS);
    expect(performance.now() - started).toBeLessThan(1_000);
    expect(verdict(report).blocked).toBe(12);
  });

  it("shows a too-complex file as 'couldn't check', with no verdict, no bots and no fix box", () => {
    const report = { ...checkBots("", PASTE_PATHS), bots: [], tooComplex: true as const };
    const away = text(
      renderPage({ ok: true, intent: "fetch", url: "shop.example", site: { host: "shop.example", robotsUrl: "https://shop.example/robots.txt", status: "file", shopify: true, report, pathNote: null } }),
    );
    expect(away).toContain("Couldn't check");
    expect(away).toContain("We couldn't check this robots.txt");
    expect(away).toContain("too many complicated rules");
    expect(away).not.toContain("All clear");
    expect(away).not.toContain("can read your pages");
    expect(away).not.toContain("Fix it on Shopify");
    expect(away).not.toContain("Your robots.txt on Shopify");
    expect(away).toContain("What robots.txt can't show");
  });
});

// ---------- the page around the result (review fixes) ----------

describe("the sample is labelled where its result is", () => {
  it("labels the paste box and the sample's result card, and drops both labels for a pasted file", () => {
    const out = renderPage();
    expect(out.match(/<span class="ck-chip is-grey">Example<\/span>/g)).toHaveLength(2);
    expect(text(out)).toContain(copy.SAMPLE_RESULT_LABEL);
    expect(out.indexOf(copy.SAMPLE_RESULT_LABEL)).toBeLessThan(out.indexOf("1 bot that affects AI answers is blocked"));
    const pasted = renderPage({ ok: true, intent: "paste", text: "User-agent: GPTBot\nDisallow: /" });
    expect(pasted).not.toContain(">Example</span>");
  });
});

// ---------- the real guarded fetch (review fixes) ----------

describe("checkSite through the real guarded fetch", () => {
  const SECRET = "secret admin page";
  beforeEach(async () => {
    clearCrawlerCache();
    web.calls = [];
    web.lookups.clear();
    const real = await vi.importActual<typeof import("../app/lib/check.server")>("../app/lib/check.server");
    const realRobots = await vi.importActual<typeof import("../app/lib/robots.server")>("../app/lib/robots.server");
    // robotsFetch and fetchSiteFile both end in safeFetch: route the mock to the real one.
    pageMock.mockReset();
    pageMock.mockImplementation(real.safeFetch);
    robotsMock.mockReset();
    robotsMock.mockImplementation(realRobots.robotsFetch);
    web.answer = (u) => {
      const h = u.hostname;
      if (h === "shop.example") return u.pathname === "/robots.txt" ? { status: 200, body: SAMPLE_ROBOTS } : { status: 200, body: SHOPIFY_HOME };
      if (h === "x.myshopify.com") return { status: 301, location: `https://shop.example${u.pathname}` };
      if (h === "sneaky.example") return { status: 302, location: "http://evil.example/robots.txt" };
      if (h === "local.example") return { status: 302, location: "http://127.0.0.1/robots.txt" };
      if (h === "v6.example") return { status: 302, location: "http://[::1]/robots.txt" };
      if (h.startsWith("evil.") || h.startsWith("rebind.") || h === "127.0.0.1") return { status: 200, body: `User-agent: *\nAllow: /\n# ${SECRET}` };
      if (h === "loop.example") return { status: 302, location: `/r${web.calls.length}` };
      if (h === "big.example") return u.pathname === "/robots.txt" ? { status: 200, body: `User-agent: *\n${"Disallow: /private-folder-name/\n".repeat(20_000)}` } : { status: 200, body: "<html></html>" };
      if (h === "slow.example") return { status: 0, fail: true };
      if (h === "homeaway.example") return u.pathname === "/robots.txt" ? { status: 200, body: "User-agent: *\nDisallow: /cart\n" } : { status: 302, location: "http://evil.example/" };
      // gymshark.com on 11 Oct 2026: the bare domain redirects to its checkout domain, whose home page is a
      // "Redirecting..." page; the store is www.gymshark.com.
      if (h === "gymshark.com") return { status: 301, location: `https://us.checkout.gymshark.com${u.pathname}` };
      if (h === "us.checkout.gymshark.com") return u.pathname === "/robots.txt" ? { status: 200, body: hosts("gymshark-checkout-robots.txt") } : { status: 200, body: hosts("gymshark-redirect-page.html") };
      if (h === "www.gymshark.com") return u.pathname === "/robots.txt" ? { status: 200, body: hosts("gymshark-www-robots.txt") } : { status: 200, body: hosts("gymshark-www-home.html") };
      if (h === "twinaway.example") return { status: 301, location: "https://checkout.twinaway.example/" };
      if (h === "checkout.twinaway.example") return { status: 200, body: "<html><head><title>Redirecting...</title></head><body>Redirecting...</body></html>" };
      if (h === "www.twinaway.example") return { status: 302, location: "http://evil.example/" };
      return { status: 404 };
    };
  });
  afterEach(() => {
    pageMock.mockReset();
    robotsMock.mockReset();
  });
  const at = (host: string, path = "/") => ({ origin: `https://${host}`, host, path });

  it("reads a store's live file and home page, following a redirect to the store's own domain", async () => {
    const out = await checkSite(at("x.myshopify.com"));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(web.calls).toContain("https://shop.example/robots.txt");
    expect(out.site.report!.paths.map((p) => p.path)).toEqual(["/", "/products/cedar-beard-oil", "/collections/beard-care"]);
    expect(verdict(out.site.report!).headline).toBe("1 bot that affects AI answers is blocked");
  });

  it("never follows a redirect into a private network, or a host that turns private (DNS rebinding)", async () => {
    for (const host of ["sneaky.example", "local.example", "v6.example", "rebind.example", "evil.example"]) {
      clearCrawlerCache();
      const out = await checkSite(at(host));
      expect(out, host).toEqual({ ok: false, error: OUTCOME_COPY.unreachable });
      expect(JSON.stringify(out)).not.toContain(SECRET);
    }
    expect(web.calls.some((c) => c.startsWith("http://evil.") || c.startsWith("http://127.") || c.includes("[::1]"))).toBe(false);
  });

  it("gives the friendly copy for endless redirects and timeouts, never the error's own words", async () => {
    for (const host of ["loop.example", "slow.example"]) {
      clearCrawlerCache();
      const out = await checkSite(at(host));
      expect(out, host).toEqual({ ok: false, error: OUTCOME_COPY.unreachable });
      expect(JSON.stringify(out)).not.toMatch(/abort|timeout/i);
    }
    // Two reads (robots.txt and the home page), each the first request plus at most 4 redirects.
    expect(web.calls.filter((c) => c.includes("loop.example")).length).toBeLessThanOrEqual(10);
  });

  it("reads only the first 512 KB of a huge file, and says Google reads only 500 KB", async () => {
    const out = await checkSite(at("big.example"));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.site.report!.notes.map((n) => n.id)).toContain("large");
    expect(verdict(out.site.report!).tone).toBe("good");
  });

  it("follows a bare domain past its checkout domain to the store's www address, every hop guarded", async () => {
    const out = await checkSite(at("gymshark.com"));
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.robotsUrl).toBe("https://www.gymshark.com/robots.txt");
    expect(out.site.hostNote).toBe("gymshark.com goes to us.checkout.gymshark.com, so we checked www.gymshark.com, where your home page is.");
    expect(verdict(out.site.report!).shopifyStandard).toBe(false);
    expect(out.site.report!.paths.map((p) => p.path)).not.toContain("/products/example");
    // Two home page reads and two robots.txt reads, the bare domain's each with one redirect.
    expect(web.calls.filter((c) => c.includes("gymshark.com")).sort()).toEqual([
      "https://gymshark.com/",
      "https://gymshark.com/robots.txt",
      "https://us.checkout.gymshark.com/",
      "https://us.checkout.gymshark.com/robots.txt",
      "https://www.gymshark.com/",
      "https://www.gymshark.com/robots.txt",
    ]);
  });

  it("never follows the www address into a private network", async () => {
    const out = await checkSite(at("twinaway.example"));
    if (!out.ok) throw new Error("expected a result");
    expect(out.site.host).toBe("checkout.twinaway.example");
    expect(web.calls.some((c) => c.startsWith("http://evil."))).toBe(false);
  });

  it("still checks the robots.txt when the home page redirects somewhere private (the home page is optional)", async () => {
    const out = await checkSite(at("homeaway.example"));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.site.status).toBe("file");
    expect(out.site.report!.paths.map((p) => p.path)).toEqual(["/"]);
    expect(web.calls.some((c) => c.startsWith("http://evil."))).toBe(false);
  });
});
