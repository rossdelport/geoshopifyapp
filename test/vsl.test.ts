// The niche pages for Ross's video ads, rankwithross.com.au/for/<niche> (Ross, 17 Nov 2026): one page per niche in the
// niche test, Ross's video first with his booking calendar under it, then Eduardo's review, "Sound familiar?"
// (3 problems), the honest table against agencies, the 3 steps, the price and the questions (the look from 17 Nov 2026). Checks the house rules (no dashes, real sourced numbers, nothing promised that we
// don't do), the booking links and the page frame (noindex, Meta pixel, cookie notice).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { OFFER } from "../app/lib/plans";
import { AGENCY_PRICE, VIDEO_NOTE, VIDEO_SOURCES, VSL_PAGES, VSL_PRICE, VSL_SLUGS, bookingNiche, vslBookHref, vslBySlug } from "../app/lib/vsl/pages";
import { loomEmbed, renderVsl } from "../app/lib/vsl/render";
import { loader } from "../app/routes/for.$niche";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const open = async (slug: string) => {
  try {
    return (await loader({ request: new Request(`https://rankwithross.com.au/for/${slug}`), params: { niche: slug }, context: {} } as unknown as LoaderFunctionArgs)) as Response;
  } catch (thrown) {
    return thrown as Response;
  }
};

/** Every piece of text a page shows. */
const words = (p: (typeof VSL_PAGES)[number]) =>
  [
    p.title,
    p.description,
    p.hi,
    ...p.h1,
    ...p.problems.flatMap((r) => [r.h, r.p, r.note ?? ""]),
    p.big.line,
    p.big.note,
    ...p.faq.flatMap((f) => [f.q, f.a]),
  ].join("\n");

describe("the niche pages", () => {
  it("are the five niches Ross picked to test (17 Nov 2026), plus one page for every ad (18 Nov 2026)", () => {
    expect(VSL_SLUGS).toEqual(["mortgage-brokers", "solar-installers", "pool-spa-sauna-stores", "buyers-agents", "plumbers-electricians", "business"]);
    expect(new Set(VSL_SLUGS).size).toBe(6);
  });

  it("have one page for any business, whose heading is the line the ads open with, booking without the store questions", () => {
    const p = vslBySlug("business")!;
    expect(p.h1.join(" ")).toBe("Tired of paying Google and Meta for every lead? Get AIs to name you.");
    expect(p.shopify).toBeFalsy();
    expect(vslBookHref(p)).toBe("/book?for=business&utm_medium=vsl&utm_campaign=business");
    expect(bookingNiche("business")).toBe(p);
    // "one extra customer" is only ever an "if", never a promise
    expect(p.big.line).toMatch(/^If /);
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
      expect(p.title, p.slug).toMatch(/ \| Rank with Ross$/);
      expect(p.description.length, p.slug).toBeLessThanOrEqual(160);
      for (const s of p.sources) expect(s.url, p.slug).toMatch(/^https:\/\//);
      // every page says nobody can promise what AI says
      expect(p.faq.some((f) => /Nobody can promise what AI says/.test(f.a)), p.slug).toBe(true);
    }
  });

  it("send local businesses to /book without the store questions, and Shopify stores to the normal /book", () => {
    expect(vslBookHref(vslBySlug("mortgage-brokers")!)).toBe("/book?for=mortgage-brokers&utm_medium=vsl&utm_campaign=mortgage-brokers");
    expect(vslBookHref(vslBySlug("pool-spa-sauna-stores")!)).toBe("/book?utm_medium=vsl&utm_campaign=pool-spa-sauna-stores");
    expect(VSL_PAGES.filter((p) => bookingNiche(p.slug)).map((p) => p.slug)).toEqual(["mortgage-brokers", "solar-installers", "buyers-agents", "plumbers-electricians", "business"]);
    expect(bookingNiche("pool-spa-sauna-stores")).toBeNull();
    expect(bookingNiche("nope")).toBeNull();
    expect(bookingNiche(null)).toBeNull();
  });

  it("keep the words short (Ross, 17 Nov 2026: \"simplify the text\")", () => {
    for (const p of VSL_PAGES) {
      expect(p.problems, p.slug).toHaveLength(3);
      for (const r of p.problems) {
        expect(r.h.length, `${p.slug}: ${r.h}`).toBeLessThanOrEqual(90);
        expect(r.p.length, `${p.slug}: ${r.p}`).toBeLessThanOrEqual(150);
      }
      // a full set of questions (Ross, 17 Nov 2026: "really beef out the FAQ section"), each answer short
      expect(p.faq.length, p.slug).toBeGreaterThanOrEqual(10);
      expect(new Set(p.faq.map((f) => f.q)).size, p.slug).toBe(p.faq.length);
      for (const f of p.faq) expect(f.a.length, `${p.slug}: ${f.q}`).toBeLessThanOrEqual(300);
      // the agency prices on every page are the ones in the table and its source
      expect(p.problems.some((r) => r.h.includes(AGENCY_PRICE)), p.slug).toBe(true);
      expect(p.sources.some((s) => /optimising/i.test(s.url)), p.slug).toBe(true);
    }
  });

  it("draw what the words say (Ross, 17 Nov 2026: \"simple illustrations to match the text\")", () => {
    for (const p of VSL_PAGES) {
      for (const r of p.problems) {
        // the chat answer shows as many names as the words say AI gave
        if (r.draw === "chat") expect(r.h, p.slug).toContain(`It named ${r.names}`);
        // a price tag only carries a number from its own words
        if (r.tag) expect(`${r.h} ${r.p}`, `${p.slug}: ${r.tag}`).toContain(r.tag.replace(/\+$/, ""));
        if (["click", "lead", "bill", "search"].includes(r.draw)) expect(r.tag, `${p.slug}: ${r.h}`).toBeTruthy();
      }
    }
    const html = renderVsl(vslBySlug("plumbers-electricians")!, { rossPhoto: "/ross.webp", cover: "/cover.webp" });
    expect(html).toContain('<filter id="rr-rough"');
    expect(html).toContain(">$139+</text>");
    expect(html.match(/class="step-pic"/g)).toHaveLength(3);
    // no line under the heading, and "Watch this first!" beside the video on wide screens (Ross, 17 Nov 2026)
    expect(html).not.toContain('class="lead"');
    expect(html).toMatch(/<div class="vsl-box">\s*<div class="vsl[^]*?<p class="side-note" aria-hidden="true">Watch this<br>first!/);
  });


  it("escape everything they draw", () => {
    const p = { ...vslBySlug("buyers-agents")!, hi: 'Fish & <chips> "now"' };
    const html = renderVsl(p, { rossPhoto: "/ross.webp", cover: "/cover.webp" });
    expect(html).toContain("Fish &amp; &lt;chips&gt; &quot;now&quot;");
    expect(html).not.toContain("<chips>");
  });
});

describe("the page at /for/<niche>", () => {
  it("is Ross's video first, then his booking calendar, then the numbers", async () => {
    for (const slug of VSL_SLUGS) {
      const res = await open(slug);
      expect(res.status, slug).toBe(200);
      const html = await res.text();
      const p = vslBySlug(slug)!;
      expect(html).toContain(`<link rel="canonical" href="https://rankwithross.com.au/for/${slug}">`);
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html.match(/<h1[\s>]/g), slug).toHaveLength(1);
      // the route filled everything in
      expect(html, slug).not.toMatch(/__[A-Z_]+__|<!-- (META_PIXEL|COOKIE_SCRIPT|VSL_BODY) -->/);
      // Ross's video, then his booking calendar right under it (Ross, 17 Nov 2026: "put the actual booking calender here
      // instead of the button"): /book?embed=1 in a frame, the old button only without JavaScript
      const video = html.indexOf('class="vsl');
      const calendar = html.indexOf('<div class="cal-box" id="book">');
      expect(video, slug).toBeGreaterThan(html.indexOf("<h1"));
      expect(calendar, slug).toBeGreaterThan(video);
      expect(calendar, slug).toBeLessThan(html.indexOf('<section class="proof"'));
      expect(html, slug).toContain(`<iframe class="cal-frame" data-cal data-src="${`${vslBookHref(p)}&embed=1`.replace(/&/g, "&amp;")}" title="Book a call with Ross" loading="lazy"></iframe>`);
      expect(html, slug).toContain(`<noscript><a class="btn btn-pri btn-lg" href="${vslBookHref(p).replace(/&/g, "&amp;")}">Book a free 15 minute call</a></noscript>`);
      expect(html.match(/<iframe/g), slug).toHaveLength(1);
      // the other buttons jump to it
      expect(html.match(/href="#book">Book a/g), slug).toHaveLength(2);
      expect(html, slug).not.toContain("data-book");
      // the honest table: our price against Australian agencies' prices
      expect(html, slug).toContain(`<td class="me">${VSL_PRICE}</td><td>${AGENCY_PRICE}</td>`);
      expect(html, slug).toContain(p.big.line);
      // the only links: the calendar, /book, home, privacy, terms, texting Ross and the sources
      const links = new Set([...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")));
      const allowed = new Set(["#book", vslBookHref(p), "/", "/privacy", "/privacy#cookies", "/terms", "sms:+61400369865", "https://terratanks.com.au/", "https://www.loom.com/share/3fef7fa99b224d459f02d072445e2213", ...p.sources.map((s) => s.url), ...VIDEO_SOURCES.map((s) => s.url)]);
      for (const l of links) expect(allowed.has(l), `${slug}: ${l}`).toBe(true);
      expect(html, slug).not.toContain("A$");
      expect(html, slug).toContain("All prices on this page are in Australian dollars.");
      expect(html, slug).not.toContain("—");
      expect(html, slug).not.toMatch(/ – /);
    }
  });

  it("plays Ross's Loom video on every page, loading nothing from Loom until play, and says where its numbers come from", async () => {
    const embed = loomEmbed("3fef7fa99b224d459f02d072445e2213");
    expect(embed).toBe("https://www.loom.com/embed/3fef7fa99b224d459f02d072445e2213?hideEmbedTopBar=true&hide_owner=true&hide_share=true&hide_title=true&autoplay=1");
    for (const slug of VSL_SLUGS) {
      const html = await (await open(slug)).text();
      expect(html, slug).not.toContain("coming soon");
      // his photo with a play button; the script swaps in Loom's player on press, without it the button opens Loom
      expect(html, slug).toContain(`<div class="vsl" data-loom="${embed.replace(/&/g, "&amp;")}">`);
      expect(html, slug).toContain('href="https://www.loom.com/share/3fef7fa99b224d459f02d072445e2213" target="_blank" rel="noopener" data-loom-play');
      expect(html, slug).toContain("<b>Hi, I’m Ross. Watch this first.</b><small>4:52</small>");
      expect(html, slug).not.toMatch(/<iframe[^>]*loom/);
      // the cover is a frame from the video (Ross, 17 Nov 2026), not his photo
      expect(html, slug).toMatch(/<img class="vsl-cover" src="[^"]*ross-video-cover\.webp" alt="" width="1280" height="720"/);
      expect(html, slug).toContain("f.src = box.getAttribute('data-loom');");
      expect(html, slug).toContain(VIDEO_NOTE);
      for (const s of VIDEO_SOURCES) expect(html, slug).toContain(`href="${s.url}"`);
    }
    // the bonus is OpenAI's own offer, for businesses new to ChatGPT ads, and ends 31 December 2026
    expect(VIDEO_NOTE).toContain("new to ChatGPT ads, until 31 December 2026");
    expect(VIDEO_NOTE).not.toMatch(/[—–]/);
  });

  it("has the home page's Meta pixel and cookie notice", async () => {
    const html = await (await open("solar-installers")).text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain(readFileSync(join(ROOT, "design", "overview", "pixel-head.js"), "utf8").trim());
    expect(html).toContain('<div class="ck" id="ck" role="region" aria-label="Cookies" hidden>');
    expect(html).toContain(readFileSync(join(ROOT, "design", "overview", "parts", "47-cookies.js"), "utf8").trim());
  });

  it("passes an ad's tags on to the calendar, keeping the niche, and grows the frame to fit it", async () => {
    const html = await (await open("buyers-agents")).text();
    expect(html).toContain("if (url.searchParams.get('for')) keep.set('for', url.searchParams.get('for'));");
    expect(html).toContain("keep.set('embed', '1');");
    expect(html).toContain("f.src = url.pathname + url.search;");
    // only the calendar's own frame, from this site, may set its height
    expect(html).toContain("if (e.origin !== location.origin || e.source !== f.contentWindow || !e.data || typeof e.data.bookHeight !== 'number') return;");
  });

  it("shows Eduardo word for word on every page, with the note that results differ", async () => {
    const html = await (await open("pool-spa-sauna-stores")).text();
    // his words on the page are word for word from the video (the captions hold everything he says)
    const words = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]+/g, " ").replace(/\s+/g, " ").trim();
    const said = words(readFileSync(join(ROOT, "app", "home", "eduardo-review.vtt"), "utf8").split("\n").filter((l) => /[a-z]/i.test(l) && !l.includes("-->") && l !== "WEBVTT").join(" "));
    const quotes = [...html.matchAll(/<p>“([^”]+)”<\/p>/g)].map((m) => m[1]);
    expect(quotes).toHaveLength(2);
    for (const q of quotes) expect(said, q).toContain(words(q));
    expect(html).toContain("A real client, in his own words. Results are different for every store.");
    expect(html).toContain('preload="none"');
    // on every page (Ross, 17 Nov 2026), and the local pages say "business"
    for (const slug of VSL_SLUGS) {
      const page = await (await open(slug)).text();
      expect(page, slug).toContain("Hear it from Eduardo");
      expect([...page.matchAll(/<p>“([^”]+)”<\/p>/g)].map((m) => m[1]), slug).toEqual(quotes);
    }
    expect(await (await open("mortgage-brokers")).text()).toContain("A real client, in his own words. Results are different for every business.");
  });

  it("is Not found for anything else", async () => {
    for (const slug of ["nope", "Mortgage-Brokers", ""]) {
      const res = await open(slug);
      expect(res.status, slug).toBe(404);
      expect(res.headers.get("x-robots-tag")).toBe("noindex");
    }
  });
});
