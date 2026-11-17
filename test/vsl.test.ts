// The niche pages for Ross's video ads, firstpicked.com.au/for/<niche> (Ross, 17 Nov 2026): one page per niche in the
// niche test, Ross's video first with the "Book a call" button under it, then what they pay now, what ChatGPT said,
// what we do and the price. Checks the house rules (no dashes, real sourced numbers, nothing promised that we
// don't do), the booking links and the page frame (noindex, Meta pixel, cookie notice).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { OFFER } from "../app/lib/plans";
import { VSL_PAGES, VSL_PRICE, VSL_SLUGS, bookingNiche, vslBookHref, vslBySlug } from "../app/lib/vsl/pages";
import { renderVsl } from "../app/lib/vsl/render";
import { loader } from "../app/routes/for.$niche";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const open = async (slug: string) => {
  try {
    return (await loader({ request: new Request(`https://firstpicked.com.au/for/${slug}`), params: { niche: slug }, context: {} } as unknown as LoaderFunctionArgs)) as Response;
  } catch (thrown) {
    return thrown as Response;
  }
};

/** Every piece of text a page shows. */
const words = (p: (typeof VSL_PAGES)[number]) =>
  [
    p.title,
    p.description,
    p.eyebrow,
    ...p.h1,
    p.lead,
    ...p.spend.h,
    ...p.spend.costs.flatMap((c) => [c.value, c.text]),
    p.spend.line,
    ...p.ai.h,
    p.ai.question,
    ...p.ai.points,
    ...p.help.h,
    ...p.help.items.flatMap((i) => [i.h, i.p]),
    ...(p.maths ? [...p.maths.h, ...p.maths.points] : []),
    ...p.faq.flatMap((f) => [f.q, f.a]),
    ...p.close,
  ].join("\n");

describe("the five niche pages", () => {
  it("are the five niches Ross picked to test (17 Nov 2026)", () => {
    expect(VSL_SLUGS).toEqual(["mortgage-brokers", "solar-installers", "pool-spa-sauna-stores", "buyers-agents", "plumbers-electricians"]);
    expect(new Set(VSL_SLUGS).size).toBe(5);
  });

  it("show the live price", () => {
    // the same price as the rest of the site, with a plain "$" (Ross, 17 Nov 2026: his ads only target Australia)
    expect(OFFER.price.startsWith(`A${VSL_PRICE}`)).toBe(true);
    for (const p of VSL_PAGES) {
      expect(words(p)).toContain("$297 a month");
      expect(words(p), p.slug).not.toContain("A$");
    }
  });

  it("follow the copy rules: no dashes, short titles, no jargon, no promise of emails to websites, no promised results", () => {
    for (const p of VSL_PAGES) {
      const text = words(p);
      expect(text, p.slug).not.toMatch(/[—–]/);
      expect(text, p.slug).not.toMatch(/\b(GEO|AEO|LLM|SEO)\b/);
      expect(text, p.slug).not.toMatch(/email(s)? (to|the) (sites|websites)|pitch/i);
      expect(text, p.slug).not.toMatch(/guarantee|worth A\$/i);
      expect(p.title.length, p.slug).toBeLessThanOrEqual(60);
      expect(p.title, p.slug).toMatch(/ \| FirstPicked$/);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(160);
      for (const s of p.sources) expect(s.url, p.slug).toMatch(/^https:\/\//);
      // every page says nobody can promise what AI says
      expect(p.faq.some((f) => /Nobody can promise what AI says/.test(f.a)), p.slug).toBe(true);
    }
  });

  it("send local businesses to /book without the store questions, and Shopify stores to the normal /book", () => {
    expect(vslBookHref(vslBySlug("mortgage-brokers")!)).toBe("/book?for=mortgage-brokers&utm_medium=vsl&utm_campaign=mortgage-brokers");
    expect(vslBookHref(vslBySlug("pool-spa-sauna-stores")!)).toBe("/book?utm_medium=vsl&utm_campaign=pool-spa-sauna-stores");
    expect(VSL_PAGES.filter((p) => bookingNiche(p.slug)).map((p) => p.slug)).toEqual(["mortgage-brokers", "solar-installers", "buyers-agents", "plumbers-electricians"]);
    expect(bookingNiche("pool-spa-sauna-stores")).toBeNull();
    expect(bookingNiche("nope")).toBeNull();
    expect(bookingNiche(null)).toBeNull();
  });

  it("only show Eduardo's review where it fits (he sells stock tank pools)", () => {
    expect(VSL_PAGES.filter((p) => p.review).map((p) => p.slug)).toEqual(["pool-spa-sauna-stores"]);
  });

  it("escape everything they draw", () => {
    const p = { ...vslBySlug("buyers-agents")!, lead: 'Fish & <chips> "now"' };
    const html = renderVsl(p, { rossPhoto: "/ross.webp" });
    expect(html).toContain("Fish &amp; &lt;chips&gt; &quot;now&quot;");
    expect(html).not.toContain("<chips>");
  });
});

describe("the page at /for/<niche>", () => {
  it("is Ross's video first, then the Book a call button, then the numbers", async () => {
    for (const slug of VSL_SLUGS) {
      const res = await open(slug);
      expect(res.status, slug).toBe(200);
      const html = await res.text();
      const p = vslBySlug(slug)!;
      expect(html).toContain(`<link rel="canonical" href="https://firstpicked.com.au/for/${slug}">`);
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html.match(/<h1[\s>]/g), slug).toHaveLength(1);
      // the route filled everything in
      expect(html, slug).not.toMatch(/__[A-Z_]+__|<!-- (META_PIXEL|COOKIE_SCRIPT|VSL_BODY) -->/);
      // the video frame (coming soon until Ross films it) comes before the first big button, which opens /book
      const video = html.indexOf('class="vsl');
      const button = html.indexOf('class="btn btn-pri btn-lg"');
      expect(video, slug).toBeGreaterThan(html.indexOf("<h1"));
      expect(button, slug).toBeGreaterThan(video);
      expect(html).toContain(`href="${vslBookHref(p).replace(/&/g, "&amp;")}" data-book>Book a free 15 minute call</a>`);
      // the only links: /book, home, privacy, terms, texting Ross and the sources
      const links = new Set([...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")));
      const allowed = new Set([vslBookHref(p), "/", "/privacy", "/privacy#cookies", "/terms", "sms:+61400369865", "https://terratanks.com.au/", ...p.sources.map((s) => s.url)]);
      for (const l of links) expect(allowed.has(l), `${slug}: ${l}`).toBe(true);
      expect(html, slug).not.toContain("A$");
      expect(html, slug).toContain("All prices on this page are in Australian dollars.");
      expect(html, slug).not.toContain("—");
      expect(html, slug).not.toMatch(/ – /);
    }
  });

  it("has the home page's Meta pixel and cookie notice", async () => {
    const html = await (await open("solar-installers")).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain(readFileSync(join(ROOT, "design", "overview", "pixel-head.js"), "utf8").trim());
    expect(html).toContain('<div class="ck" id="ck" role="region" aria-label="Cookies" hidden>');
    expect(html).toContain(readFileSync(join(ROOT, "design", "overview", "parts", "47-cookies.js"), "utf8").trim());
  });

  it("passes an ad's tags on to /book, keeping the niche", async () => {
    const html = await (await open("buyers-agents")).text();
    expect(html).toContain("if (url.searchParams.get('for')) keep.set('for', url.searchParams.get('for'));");
    expect(html).toContain("a.setAttribute('href', '/book?' + keep);");
  });

  it("shows Eduardo word for word on the store page, with the note that results differ", async () => {
    const html = await (await open("pool-spa-sauna-stores")).text();
    // his words on the page are word for word from the video (the captions hold everything he says)
    const words = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
    const said = words(readFileSync(join(ROOT, "app", "home", "eduardo-review.vtt"), "utf8").split("\n").filter((l) => /[a-z]/i.test(l) && !l.includes("-->") && l !== "WEBVTT").join(" "));
    const quotes = [...html.matchAll(/<p>“([^”]+)”<\/p>/g)].map((m) => m[1]);
    expect(quotes).toHaveLength(2);
    for (const q of quotes) expect(said, q).toContain(words(q));
    expect(html).toContain("A real client, in his own words. Results are different for every store.");
    expect(html).toContain('preload="none"');
    expect(await (await open("mortgage-brokers")).text()).not.toContain("Hear it from Eduardo");
  });

  it("is Not found for anything else", async () => {
    for (const slug of ["nope", "Mortgage-Brokers", ""]) {
      const res = await open(slug);
      expect(res.status, slug).toBe(404);
      expect(res.headers.get("x-robots-tag")).toBe("noindex");
    }
  });
});
