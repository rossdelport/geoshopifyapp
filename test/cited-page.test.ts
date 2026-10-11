// Reading a cited page: does it name the store, when was it updated, and who to contact.
// Plus the outreach messages written without Claude.

import { describe, expect, it, vi } from "vitest";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

vi.mock("../app/shopify.server", () => ({ unauthenticated: { admin: vi.fn() }, authenticate: {} }));

const { brandVariants, contactFromHtml, findTags, ldBlocks, pageNamesMerchant, pageText, pageTitle, parsePageDate, parsePageDateInfo, readCitedPage } = await import(
  "../app/lib/cited-page.server"
);
const { PitchSchema, VideoPitchSchema, bestProductIndex, ensureVideoDisclosure, fallbackPitch, shortTitle, tidyPitch } = await import("../app/lib/outreach.server");

const NOW = new Date("2026-10-11T00:00:00Z");
const store = { brandNames: ["Stubble Bros", "The Groomed Man Co."], domains: ["www.stubblebros.com", "stubble-test.myshopify.com"] };
const page = (body: string, head = "") => `<!doctype html><html><head><title>Best beard oils</title>${head}</head><body>${body}</body></html>`;

describe("does the page name the store?", () => {
  it("writes the brand the ways pages do", () => {
    expect(brandVariants(["The Groomed Man Co."])).toEqual(["The Groomed Man Co", "Groomed Man Co", "Groomed Man"]);
    expect(brandVariants(["Bold & Bare"])).toEqual(["Bold & Bare", "Bold and Bare"]);
    expect(brandVariants(["  ", "Milkman", "milkman"])).toEqual(["Milkman"]);
    // Never shortened to one ordinary word.
    expect(brandVariants(["The Beard Co."])).toEqual(["The Beard Co", "Beard Co"]);
    expect(brandVariants(["The Honest Company"])).toEqual(["The Honest Company", "Honest Company"]);
    expect(brandVariants(["Skin Co"])).toEqual(["Skin Co"]);
    expect(brandVariants(["The Ordinary"])).toEqual(["The Ordinary"]);
  });

  it("never mistakes ordinary words in a roundup for a store whose name is one ordinary word plus Co or The", () => {
    const roundup = page(
      "<h1>The 10 best beard oils for dry skin</h1><p>Our honest review of every beard oil we tried. Pure argan oil and jojoba oil soften the skin. " +
        "Beard oil co-washes are popular, and milk and honey scents too. Nothing out of the ordinary. Oil choice matters for skin. " +
        "Skin type, oil weight and beard length all count.</p><p>Our picks: Milkman, Bulldog and Beardbrand.</p>",
    );
    for (const name of ["The Beard Co.", "Skin Co", "Oil Co", "The Honest Company", "Pure Co", "Milk Co.", "The Ordinary", "The Candle Company"]) {
      expect(pageNamesMerchant(roundup, { brandNames: [name], domains: [] }), name).toBe(false);
      expect(pageNamesMerchant(roundup, { brandNames: [name], domains: [], genericWords: ["beard", "oil", "skin"] }), name).toBe(false);
    }
    // The real brand, written the way it writes itself, still counts.
    expect(pageNamesMerchant(page("<p>Our pick is The Beard Co. sandalwood oil.</p>"), { brandNames: ["The Beard Co."], domains: [] })).toBe(true);
    expect(pageNamesMerchant(page("<p>We like Beard Co oils.</p>"), { brandNames: ["The Beard Co."], domains: [] })).toBe(true);
    expect(pageNamesMerchant(page("<p>Try THE HONEST COMPANY wipes.</p>"), { brandNames: ["The Honest Company"], domains: [] })).toBe(true);
    // When the one real word is what the store sells, only the full name (or a link to the store) counts.
    const beardShop = { brandNames: ["The Beard Co."], domains: ["thebeardco.com"], genericWords: ["beard", "oil"] };
    expect(pageNamesMerchant(page("<p>Beard Co-Wash is the new thing.</p>"), beardShop)).toBe(false);
    expect(pageNamesMerchant(page("<p>The Beard Co makes a lovely oil.</p>"), beardShop)).toBe(true);
    expect(pageNamesMerchant(page('<p><a href="https://thebeardco.com/products/oil">This oil</a></p>'), beardShop)).toBe(true);
  });

  it("finds the brand in the words a reader sees", () => {
    expect(pageNamesMerchant(page("<p>Our pick: Stubble Bros beard oil.</p>"), store)).toBe(true);
    expect(pageNamesMerchant(page("<p>We tried the groomed man oil and loved it.</p>"), store)).toBe(true);
    expect(pageNamesMerchant(page("<p>Milkman and Bulldog lead the list.</p>"), store)).toBe(false);
    // Part of a longer word doesn't count; a different brand that starts the same doesn't either.
    expect(pageNamesMerchant(page("<p>Stubble Brothers oil is great.</p>"), store)).toBe(false);
  });

  it("finds a long brand written as one word, and links to the store's site", () => {
    expect(pageNamesMerchant(page("<p>Try StubbleBros for dry skin.</p>"), store)).toBe(true);
    expect(pageNamesMerchant(page('<p>Try <a href="https://www.stubblebros.com/products/oil">this oil</a>.</p>'), store)).toBe(true);
    expect(pageNamesMerchant(page('<p><a href="https://stubble-test.myshopify.com/products/oil">Shop</a></p>'), store)).toBe(true);
    // A lookalike domain is not the store.
    expect(pageNamesMerchant(page('<p><a href="https://notstubblebros.com/x">Shop</a></p>'), { brandNames: ["Zed"], domains: ["stubblebros.com"] })).toBe(false);
  });

  it("does not count words hidden in scripts, but reads the description and a video's description", () => {
    expect(pageNamesMerchant(page('<script>var brand = "Stubble Bros";</script><p>Milkman wins.</p>'), store)).toBe(false);
    expect(pageNamesMerchant(page("<p>Milkman wins.</p>", '<meta name="description" content="Stubble Bros versus Milkman">'), store)).toBe(true);
    const yt = page('<script>var ytInitialPlayerResponse = {"videoDetails":{"shortDescription":"Oils tested:\\nStubble Bros\\nMilkman"}};</script>');
    expect(pageText(yt)).toContain("Stubble Bros");
    expect(pageNamesMerchant(yt, store)).toBe(true);
  });

  it("matches a three-letter brand only in its exact case", () => {
    const ego = { brandNames: ["Ego"], domains: [] };
    expect(pageNamesMerchant(page("<p>We like Ego beard balm.</p>"), ego)).toBe(true);
    expect(pageNamesMerchant(page("<p>Leave your ego at the door.</p>"), ego)).toBe(false);
  });
});

describe("when was the page updated?", () => {
  it("prefers the updated date to the published date, and says which it found", () => {
    const html = page("", '<meta property="article:published_time" content="2025-01-10T08:00:00Z"><meta property="article:modified_time" content="2026-08-02T08:00:00Z">');
    expect(parsePageDate(html, NOW)?.toISOString()).toBe("2026-08-02T08:00:00.000Z");
    expect(parsePageDateInfo(html, NOW)?.modified).toBe(true);
    const published = page("", '<meta property="article:published_time" content="2025-01-10T08:00:00Z">');
    expect(parsePageDateInfo(published, NOW)).toEqual({ date: new Date("2025-01-10T08:00:00Z"), modified: false });
  });

  it("reads JSON-LD, then microdata, then <time>", () => {
    const ld = page('<script type="application/ld+json">{"@type":"Article","datePublished":"2024-02-01","dateModified":"2026-05-20T10:00:00+10:00"}</script>');
    expect(parsePageDate(ld, NOW)?.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    const published = page('<script type="application/ld+json">{"@type":"Article","datePublished":"2024-02-01"}</script>');
    expect(parsePageDate(published, NOW)?.toISOString()).toBe("2024-02-01T00:00:00.000Z");
    const youtube = page("", '<meta itemprop="uploadDate" content="2025-05-01T07:00:00-07:00">');
    expect(parsePageDate(youtube, NOW)?.toISOString()).toBe("2025-05-01T14:00:00.000Z");
    const time = page('<p>By Sam <time datetime="2023-11-05">5 Nov</time></p><p><time class="updated" datetime="2026-01-09">Updated</time></p>');
    expect(parsePageDate(time, NOW)?.toISOString()).toBe("2026-01-09T00:00:00.000Z");
    const firstTime = page('<p><time datetime="2023-11-05">5 Nov</time></p>');
    expect(parsePageDate(firstTime, NOW)?.toISOString()).toBe("2023-11-05T00:00:00.000Z");
  });

  it("ignores dates that can't be right", () => {
    expect(parsePageDate(page("", '<meta property="article:modified_time" content="2031-01-01">'), NOW)).toBeNull();
    expect(parsePageDate(page("", '<meta property="article:modified_time" content="sometime">'), NOW)).toBeNull();
    expect(parsePageDate(page("", '<meta property="article:modified_time" content="1999-12-31">'), NOW)).toBeNull();
    expect(parsePageDate(page("<p>No dates here.</p>"), NOW)).toBeNull();
    // A bad updated date falls back to a good published one.
    const mixed = page("", '<meta property="article:modified_time" content="2031-01-01"><meta property="article:published_time" content="2026-02-02">');
    expect(parsePageDate(mixed, NOW)?.toISOString()).toBe("2026-02-02T00:00:00.000Z");
  });
});

describe("who to contact", () => {
  it("finds the author, an email on the site's own domain and a contact page", () => {
    const html = page(
      '<a href="mailto:noreply@beardmag.net">x</a><a href="mailto:ads@other.net">ads</a><a href="mailto:editor@beardmag.net">Editor</a><a href="/contact-us">Contact</a>',
      '<meta name="author" content="Sam Writer">',
    );
    expect(contactFromHtml(html, "https://www.beardmag.net/best-oils", "article")).toEqual({
      authorName: "Sam Writer",
      email: "editor@beardmag.net",
      contactUrl: "https://www.beardmag.net/contact-us",
    });
  });

  it("never returns a script link as a contact page", () => {
    const html = page('<a href="javascript:alert(1)//contact">Contact</a>');
    expect(contactFromHtml(html, "https://mag.example/x").contactUrl).toBeNull();
  });

  it("points video pitches at the creator's channel", () => {
    const html = page('<span itemprop="author" itemscope><link itemprop="url" href="http://www.youtube.com/@BeardReviews"><link itemprop="name" content="Beard Reviews"></span>');
    expect(contactFromHtml(html, "https://www.youtube.com/watch?v=abc", "video")).toEqual({
      authorName: "Beard Reviews",
      email: null,
      contactUrl: "http://www.youtube.com/@BeardReviews/about",
    });
  });
});

describe("page title", () => {
  it("prefers og:title, drops a trailing YouTube, and decodes entities", () => {
    expect(pageTitle(page("", '<meta property="og:title" content="Best Oils &amp; Balms">'))).toBe("Best Oils & Balms");
    expect(pageTitle("<html><head><title>Oils tested - YouTube</title></head></html>")).toBe("Oils tested");
    expect(pageTitle("<html><head></head><body>No title</body></html>")).toBeNull();
  });
});

describe("reading a page", () => {
  it("returns what the page says, and never throws", async () => {
    const html = page("<p>Milkman wins.</p>", '<meta property="article:modified_time" content="2026-09-01T00:00:00Z"><meta name="author" content="Sam Writer">');
    const ok = await readCitedPage("https://mag.example/x", store, async (url) => ({ status: 200, url, text: html }), "article", NOW);
    expect(ok).toMatchObject({ ok: true, title: "Best beard oils", mentionsMerchant: false, isModified: true, authorName: "Sam Writer" });
    expect(ok.modifiedAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    const blocked = await readCitedPage("https://mag.example/x", store, async (url) => ({ status: 403, url, text: "Forbidden" }));
    expect(blocked).toMatchObject({ ok: false, mentionsMerchant: null, modifiedAt: null });
    const broken = await readCitedPage("https://mag.example/x", store, async () => {
      throw new Error("private address");
    });
    expect(broken.ok).toBe(false);
  });
});

describe("hostile pages", () => {
  // Pages come from any site an AI cites. No pattern may rescan the page: each of these 2 MB inputs
  // must be read in under 300 ms (some took tens of seconds or minutes before).
  const MB2 = 2_000_000;
  const fill = (unit: string) => unit.repeat(Math.ceil(MB2 / unit.length)).slice(0, MB2);
  const inputs: Record<string, string> = {
    "repeated <title": fill("<title"),
    "repeated <title with attributes": fill("<title a='1' "),
    "repeated <meta": fill("<meta "),
    "meta name= with no content": fill('<meta name="author" x'),
    "JSON author blocks": fill('"author":{'),
    "unclosed JSON-LD": `<script type="application/ld+json">${fill("{")}`,
    "many unclosed JSON-LD tags": fill('<script type="application/ld+json">'),
    "unclosed hrefs": fill('href="a'),
    "contact-ish hrefs": fill("href='contact"),
    "video author blocks": fill('<span itemprop="author"><link itemprop="url" href="'),
    "repeated <time": fill("<time "),
    "mailtos": fill("mailto:"),
    "one long tag": `<meta ${"a".repeat(MB2)}>`,
  };
  for (const [name, html] of Object.entries(inputs)) {
    it(`reads ${name} in under 300 ms`, async () => {
      for (const kind of ["article", "video"] as const) {
        const started = performance.now();
        await readCitedPage("https://mag.example/x", store, async (url) => ({ status: 200, url, text: html }), kind, NOW);
        expect(performance.now() - started, kind).toBeLessThan(300);
      }
    });
  }

  it("finds tags and JSON-LD blocks without regex backtracking", () => {
    expect(findTags('<meta name="a" content="b"><metadata x><meta content="c">', "meta")).toEqual(['<meta name="a" content="b">', '<meta content="c">']);
    expect(findTags("<meta a <meta b>", "meta")).toEqual(["<meta b>"]);
    expect(ldBlocks('<script type="application/ld+json">{"a":1}</script><p>x</p><script type="application/ld+json">{"b":2}</script>')).toEqual(['{"a":1}', '{"b":2}']);
    expect(ldBlocks('<script type="application/ld+json">{"a":1}')).toEqual([]);
  });
});

describe("messages without Claude", () => {
  it("converts both message formats for Claude", () => {
    for (const schema of [PitchSchema, VideoPitchSchema]) {
      expect((betaZodOutputFormat(schema) as unknown as { schema: object }).schema).toHaveProperty("type", "object");
    }
  });

  it("writes an honest article pitch and a review request that asks for disclosure", () => {
    const ctx = {
      pageTitle: "The 12 Best Beard Oils of 2026 | GQ",
      authorName: "Sam Writer",
      brand: "Stubble Bros",
      summary: "We make beard oil in small batches.",
      productTitle: "Beard Oil",
      productLink: "https://stubblebros.com/products/oil?utm_source=geo-app",
    };
    const article = fallbackPitch({ ...ctx, kind: "article" });
    expect(article.subject.length).toBeLessThanOrEqual(60);
    expect(article.subject).toContain("The 12 Best Beard Oils of 2026");
    expect(article.body).toContain("Hi Sam,");
    expect(article.body).toContain(ctx.productLink);
    expect(article.body).toContain("[Your name]");
    const video = fallbackPitch({ ...ctx, kind: "video", authorName: null });
    expect(video.body).toContain("Hi there,");
    expect(video.body).toContain("no obligation to post");
    expect(video.body).toContain("gifted");
    for (const text of [article.subject, article.body, video.subject, video.body]) {
      expect(text).not.toMatch(/—| – /);
      expect(text).not.toMatch(/award|best-selling|reviewed by/i);
    }
  });

  it("adds the no-obligation line and the gifting reminder to a video message that leaves them out", () => {
    const bare = "Hi Sam,\n\nLoved your beard oil video. Would you like to try our sandalwood oil?\n\nThanks,\n[Your name]\nStubble Bros";
    const fixed = ensureVideoDisclosure(bare);
    expect(fixed).toMatch(/no obligation/i);
    expect(fixed).toMatch(/gifted/);
    // Before the sign-off, not after it.
    expect(fixed.indexOf("gifted")).toBeLessThan(fixed.indexOf("Thanks,"));
    const complete = "Hi,\n\nNo obligation to post. If you feature it, say it was gifted.\n\nThanks,\n[Your name]";
    expect(ensureVideoDisclosure(complete)).toBe(complete);
    expect(ensureVideoDisclosure("Would you like one?")).toMatch(/Would you like one\?\n\nThere is no obligation to post about it\. If you do feature it/);
  });

  it("takes em dashes and spaced en dashes out of every message", () => {
    const out = tidyPitch({ subject: "Your roundup \u2014 a suggestion", body: "Hi \u2013 I run a store. Sizes 30\u201350 ml.\u2014Thanks" }, "article");
    expect(out.subject).toBe("Your roundup, a suggestion");
    expect(out.body).not.toMatch(/\u2014| \u2013 /);
    expect(out.body).toContain("30 to 50 ml");
    expect(tidyPitch({ subject: "Hi", body: "A sample \u2014 free" }, "video").body).toMatch(/gifted/);
  });

  it("suggests the product that fits the page, and shortens titles", () => {
    const products = [{ title: "Beard Balm" }, { title: "Sandalwood Beard Oil", productType: "Beard Oil" }, { title: "Shampoo" }];
    expect(bestProductIndex("Best beard oil for dry skin", products)).toBe(1);
    expect(bestProductIndex("Something else entirely", products)).toBe(0);
    expect(shortTitle("The 12 Best Beard Oils of 2026 | GQ")).toBe("The 12 Best Beard Oils of 2026");
    expect(shortTitle("A very long article title about beard oils and balms for winter", 30)).toBe("A very long article title...");
  });
});
