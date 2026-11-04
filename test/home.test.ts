import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { loader } from "../app/routes/_index/route";
import { loader as oldPreviewLoader } from "../app/routes/newhomepage";
import { TOOLS } from "../app/lib/tools/registry";
import { ORG_NODE, WEBSITE_NODE } from "../app/lib/tools/seo";
import { HOME_LANGS } from "../app/lib/tools/site";
import { STORIES } from "../app/lib/stories";
import { WAITLIST_CONSENT_TEXT } from "../app/lib/waitlist.server";

// usegeo.app: the new design (app/home/new-home.html), the home page since 2 Nov 2026 (Ross). It was the preview at
// /newhomepage, which now sends people to "/".

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const call = (url: string) => loader({ request: new Request(url), params: {}, context: {} } as unknown as LoaderFunctionArgs);
const home = async () => (await call("https://geo.test/")).text();

describe("home page", () => {
  it("serves the new design as HTML, open to search engines", async () => {
    const res = await call("https://geo.test/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>GEO · Get your products recommended by AI</title>");
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain('<h1 class="h1" id="hero-h">Shoppers ask AI what to buy. <b>Make it <span class="hl">pick you</span>.</b></h1>');
    // no longer a hidden preview
    expect(html).not.toMatch(/<meta name="robots"/);
    expect(html).not.toMatch(/noindex/i);
    // the route filled in the font and the story cards
    expect(html).not.toContain("__FONT_URL__");
    expect(html).not.toContain("<!-- STORY_CARDS -->");
    // the one offer, and every button books a call with Ross (no free trial, no install from the website)
    expect(html).toContain('<p class="price"><b>A$1,000</b><span>a month</span></p>');
    expect(html).toContain('<a class="btn btn-pri" href="/book">Get started</a>');
    expect(html).not.toMatch(/free trial/i);
    expect(html).not.toContain("/auth/login");
    // Ross's rule: no em dashes, and no spaced en dash standing in for one
    expect(html).not.toContain("—");
    expect(html).not.toMatch(/ – /);
  });

  it("uses the GEO logo as its icon (svg, ico and the home screen icon)", async () => {
    const html = await home();
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="any">');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">');
    for (const f of ["favicon.svg", "favicon.ico", "apple-touch-icon.png"]) {
      expect(existsSync(join(ROOT, "public", f)), `public/${f} is missing`).toBe(true);
    }
  });

  it("opens with words on the left and, on the right, AI answers that take turns (Ross, 2 Nov 2026)", async () => {
    const html = await home();
    const start = html.indexOf('<section class="hero"');
    const hero = html.slice(start, html.indexOf("</section>", start));
    expect(hero).toContain('<div class="hero-tx">');
    expect(hero).toContain('<a class="btn btn-pri" href="/book">Get started</a>');
    // the picture: labelled as an example for screen readers, no "Example" pill on screen (Ross), and the page's
    // one pause button for the moving pictures
    expect(hero.match(/role="img" aria-label="Example: [^"]+"/g)).toHaveLength(1);
    expect(hero).not.toContain('<span class="ex">');
    expect(hero).toContain("data-anim");
    expect(hero).toContain('<button class="still-btn" type="button" aria-pressed="false" data-still');
    expect(html.match(/<button class="still-btn"/g)).toHaveLength(1);
    // the first answer is written in the page (no JavaScript, reduced motion); the script brings the others in this order
    expect(hero).toContain('<p class="bub-q">What’s the best beard oil for dry skin?</p>');
    expect(hero.match(/<li class="pick/g)).toHaveLength(3);
    const script = html.slice(html.indexOf("var HERO_ANSWERS = ["), html.indexOf("];", html.indexOf("var HERO_ANSWERS = [")));
    expect([...script.matchAll(/name: '([^']+)'/g)].map((m) => m[1])).toEqual(["ChatGPT", "Gemini", "Perplexity", "Google AI Overviews", "Claude"]);
    expect(script.match(/q: '/g)).toHaveLength(5);
    expect(html).toContain("var HOLD = 3000");
    // GEO can't tell sales from Google AI Overviews apart from normal Google, so that answer shows a place, not an order
    expect(script).toContain("chip: ['#1', 'in Google AI Overviews']");
    expect(script).not.toMatch(/order from Google/);
  });

  it("shows Ross's photo and number beside the main hero button, in place of See how it works (Ross, 3 Nov 2026)", async () => {
    const html = await home();
    expect(html).not.toContain("__ROSS_PHOTO__");
    expect(html).not.toContain("See how it works");
    const start = html.indexOf('<div class="hero-cta">');
    const cta = html.slice(start, html.indexOf("</div>", start));
    expect(cta).toContain('href="/book">Get started</a>');
    expect(cta).toMatch(/<img src="[^"]*ross[^"]*\.webp" alt="" width="46" height="46"/);
    expect(cta).toContain("Not sure if GEO suits your store?");
    expect(cta).toContain('Text Ross, the founder: <a href="sms:+61400369865">0400 369 865</a>');
  });

  it("has no 'Example' pills on its pictures, nor do the language pages (Ross, 2 Nov 2026)", async () => {
    const html = await home();
    expect(html).not.toMatch(/>\s*Example\s*</);
    // the pictures still tell screen readers they are examples
    expect(html.match(/aria-label="Example: /g)?.length).toBeGreaterThanOrEqual(5);
    for (const f of ["home.html", ...HOME_LANGS.map((l) => `home-${l}.html`)]) {
      const page = readFileSync(join(ROOT, "app/home", f), "utf8");
      expect(page, f).not.toMatch(/class="(?:hw-ex|hv-tag)"/);
    }
  });

  it("shows the first three months, one card each, with the full refund (Ross, 3 Nov 2026)", async () => {
    const html = await home();
    const start = html.indexOf('<section class="sec sec-soft" id="months"');
    expect(start).toBeGreaterThan(-1);
    const sec = html.slice(start, html.indexOf("</section>", start));
    expect(sec).toContain("How it builds up. <b>Month by month.</b>");
    expect([...sec.matchAll(/<span class="mo-when">([^<]+)<\/span>/g)].map((m) => m[1])).toEqual(["Month 1", "Month 2", "Month 3"]);
    expect([...sec.matchAll(/<h3>([^<]+)<\/h3>/g)].map((m) => m[1])).toEqual(["We start the work", "Google and AI find you", "Clicks and sales grow"]);
    expect(sec).toContain("Not happy after month 1? Full refund, and you keep the work.");
    // honest: no promised numbers
    expect(sec).toContain("we can’t promise exact results");
    expect(html).not.toContain("More ways");
    // the same promise as the price card
    expect(html).toContain("Not happy after the first month? Full refund, and you keep all the work.");
    // the price card (Ross, 3 Nov 2026: "make it POP"): no lock-in, the free intro call with Ross's photo, and the
    // numbers from the plan ("up to" where the plan says up to)
    const price = html.slice(html.indexOf('id="pricing"'), html.indexOf('id="faq"'));
    expect(price).toContain("</svg>No lock-in contract</li>");
    expect(price).toContain("15 minute <b>FREE</b> introduction call with Ross. No obligation.");
    expect(price).toMatch(/<p class="plan-call"><img src="[^"]*ross[^"]*\.webp"/);
    expect(html).not.toContain("__ROSS_PHOTO__");
    expect([...price.matchAll(/<span data-roll>(\d+)<\/span>/g)].map((m) => m[1])).toEqual(["100", "12", "20", "40"]);
    expect(price.match(/<small>up to<\/small>/g)).toHaveLength(2);
    // a soft light follows the mouse over the purple panel and the button (Ross, 3 Nov 2026)
    expect(price).toContain('<span class="plan-glow" aria-hidden="true"></span>');
    expect(price).toContain('<span class="btn-glow" aria-hidden="true"></span></a>');
    expect(html).toContain("matchMedia('(hover: hover) and (pointer: fine)')");
    // Ross (3 Nov 2026): the FAQ's "More questions?" chip is gone, and its question tile has a clean icon
    expect(html).not.toContain("More questions? Ask GEO inside the app");
    expect(html).toContain('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>');
    // "Why now" ends with a small graph going up, on the same line as "fast." (Ross, 3 Nov 2026), in gold since 4 Nov
    expect(html).toContain('<b>And it’s growing <span class="up">fast.<svg class="up-graph"');
    expect(html).toMatch(/\.up-graph\{[^}]*stroke:var\(--gold-deep\)/);
    // the stories row moves again: its keyframes went missing with the old guides card on 3 Nov 2026
    expect(html).toContain("animation:belt 90s linear infinite");
    expect(html).toContain("@keyframes belt{to{transform:translateX(-50%)}}");
  });

  it("has one canonical address, the five other languages, share tags and the same organisation as the tool pages", async () => {
    const html = await home();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head.match(/rel="canonical"/g)).toHaveLength(1);
    expect(head).toContain('<link rel="canonical" href="https://usegeo.app/">');
    expect(head).toContain('<link rel="alternate" hreflang="en" href="https://usegeo.app/">');
    expect(head).toContain('<link rel="alternate" hreflang="x-default" href="https://usegeo.app/">');
    for (const lang of HOME_LANGS) expect(head).toContain(`<link rel="alternate" hreflang="${lang}" href="https://usegeo.app/${lang}">`);
    expect(head).toContain('<meta property="og:url" content="https://usegeo.app/">');
    expect(head).toContain('<meta property="og:image" content="https://usegeo.app/og/home.png">');
    expect(head).toContain('<meta property="og:title" content="GEO · Get your products recommended by AI">');
    expect(head).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(existsSync(join(ROOT, "public", "og", "home.png"))).toBe(true);
    const json = /<script type="application\/ld\+json">([^<]*)<\/script>/.exec(head)?.[1];
    expect(json).toBeTruthy();
    expect((JSON.parse(json!) as { "@graph": unknown[] })["@graph"]).toEqual([ORG_NODE, WEBSITE_NODE]);
  });

  it("has six Get started buttons, all to /book, and keeps the waitlist popup for #waitlist links (Ross, 3 Nov 2026)", async () => {
    const html = await home();
    // nav, hero, two section heads, pricing and the last section: every one says Get started and books a call
    const buttons = [...html.matchAll(/<a class="btn btn-pri[^"]*" href="([^"]*)"[^>]*>([^<]*)/g)].map((m) => [m[1], m[2].trim()]);
    expect(buttons).toHaveLength(6);
    for (const b of buttons) expect(b).toEqual(["/book", "Get started"]);
    expect(html).not.toContain("data-waitlist=");
    expect(html).toContain("Book a free call with Ross, the founder.");
    // an ad's utm tags go along to /book
    expect(html).toContain("document.querySelectorAll('a[href=\"/book\"]')");
    // the popup stays for other pages' #waitlist links (the free check, the compare pages, /waitlist)
    expect(html.match(/<dialog[\s>]/g)).toHaveLength(1);
    const start = html.indexOf('<dialog class="wl" id="waitlist-dialog"');
    expect(start).toBeGreaterThan(-1);
    const popup = html.slice(start, html.indexOf("</dialog>", start));
    expect(popup).toContain('<h2 class="wl-h" id="wl-title">Join the waitlist</h2>');
    expect(popup).toContain('name="name" autocomplete="name"');
    expect(popup).toContain('type="email" name="email"');
    expect(popup).toContain('name="website" tabindex="-1"');
    expect(popup).toContain(`<p class="wl-small">${WAITLIST_CONSENT_TEXT}</p>`);
    expect(popup).toContain("You’re on the waitlist!");
    expect(popup).toContain('<canvas class="wl-confetti" aria-hidden="true"></canvas>');
    // the live page posts it for real, and an address ending in #waitlist (from /waitlist and the free check) opens it
    expect(html).toContain("<script>window.GEO_LIVE=true</script>");
    expect(html).toContain("fetch('/waitlist'");
    expect(html).toContain("location.hash !== '#waitlist'");
  });

  it("has no dead in-page links (the #waitlist links open the popup) and the anchors other pages link to", async () => {
    const html = await home();
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const anchors = [...new Set([...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]))].filter((a) => a !== "waitlist");
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) expect(ids.has(a), `href="#${a}" has no matching id`).toBe(true);
    // the site footer on every other page links to /#how and /#pricing
    for (const id of ["how", "pricing", "faq", "stories"]) expect(ids.has(id), id).toBe(true);
    expect(html.toLowerCase()).toContain("our 2025 estimate");
  });

  it("loads GEO's Meta pixel in the head (asking first in Europe and the UK), with the cookie notice and Lead on joining", async () => {
    const html = await home();
    const head = html.slice(0, html.indexOf("</head>"));
    // the same code as the pages in other languages (design/overview/pixel-head.js)
    expect(head).toContain(readFileSync(join(ROOT, "design", "overview", "pixel-head.js"), "utf8").trim());
    expect(head).toContain("fbq('init', '28710910728563304');");
    expect(head).toContain("fbq('track', 'PageView');");
    expect(head).toContain("window.GEO_ASK_FIRST = /^(Europe\\/");
    expect(html.match(/28710910728563304/g)).toHaveLength(1);
    // no <noscript> image: without JavaScript nobody could say no
    expect(html).not.toContain("facebook.com/tr?");
    // the cookie notice and its script, and "Lead" when someone joins the waitlist (no name or email in it)
    expect(html).toContain('<div class="ck" id="ck" role="region" aria-label="Cookies" hidden>');
    expect(html).toContain('<a href="/privacy#cookies">Privacy</a>');
    expect(html).toContain(readFileSync(join(ROOT, "design", "overview", "parts", "47-cookies.js"), "utf8").trim());
    expect(html).toContain("if (isNew && typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_name: 'waitlist' });");
  });

  it("shows every story as a card in a moving row, each linking to its own page", async () => {
    const html = await home();
    const start = html.indexOf('<section class="sec" id="stories"');
    expect(start).toBeGreaterThan(-1);
    const sec = html.slice(start, html.indexOf("</section>", start));
    expect(sec).toContain('href="/stories">See all stories');
    expect(sec).toContain("These brands don’t use GEO.");
    // The track holds the cards twice: the second copy is hidden from screen readers and skipped by the keyboard.
    const groups = [...sec.matchAll(/<ul class="st-group" role="list"( aria-hidden="true")?>([\s\S]*?)<\/ul>/g)];
    expect(groups.map((g) => Boolean(g[1]))).toEqual([false, true]);
    const esc = (t: string) => t.replace(/&/g, "&amp;");
    for (const [, hidden, body] of groups) {
      const cards = body.split("<li>").slice(1);
      expect(cards).toHaveLength(STORIES.length);
      cards.forEach((card, i) => {
        const story = STORIES[i];
        expect(card).toContain(` href="/stories/${story.slug}"`);
        expect(card).toContain(`<span class="st-h">${esc(story.cardHeadline)}</span>`);
        expect(card).toContain(esc(story.brand));
        expect(card).toMatch(/<img src="[^"]+" alt=""/);
        expect(card.includes('tabindex="-1"'), story.slug).toBe(Boolean(hidden));
      });
    }
  });

  it("links the free tools hub and every tool from the footer", async () => {
    const html = await home();
    const start = html.indexOf('<nav class="foot-tools"');
    expect(start).toBeGreaterThan(-1);
    const footer = html.slice(start, html.indexOf("</nav>", start));
    expect(footer).toContain('<a href="/tools">All free tools</a>');
    for (const t of TOOLS) expect(footer, t.path).toContain(`<a href="${t.path}">${t.name}</a>`);
    expect(footer.match(/<a href=/g)).toHaveLength(TOOLS.length + 1);
  });

  it("sends Shopify app opens straight into the app", async () => {
    const res = await call("https://geo.test/?shop=demo.myshopify.com&host=abc").catch((r: Response) => r);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/app?shop=demo.myshopify.com&host=abc");
  });
});

describe("the old preview address, /newhomepage", () => {
  const visit = (url: string) =>
    Promise.resolve()
      .then(() => oldPreviewLoader({ request: new Request(url), params: {}, context: {} } as unknown as LoaderFunctionArgs))
      .catch((r: Response) => r);

  it("sends people to the home page for good, keeping any ad tags", async () => {
    const res = (await visit("https://usegeo.app/newhomepage")) as Response;
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("/");
    const tagged = (await visit("https://usegeo.app/newhomepage?utm_source=x&utm_campaign=y")) as Response;
    expect(tagged.status).toBe(301);
    expect(tagged.headers.get("location")).toBe("/?utm_source=x&utm_campaign=y");
  });
});
