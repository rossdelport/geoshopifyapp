import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { loader } from "../app/routes/_index/route";
import { TOOLS } from "../app/lib/tools/registry";
import { STORIES } from "../app/lib/stories";
import { WAITLIST_CONSENT_TEXT } from "../app/lib/waitlist.server";

const imgDir = join(fileURLToPath(new URL("..", import.meta.url)), "public", "home", "img");
const call = (url: string) => loader({ request: new Request(url), params: {}, context: {} } as unknown as LoaderFunctionArgs);

describe("home page", () => {
  it("serves the GEO home page as HTML", async () => {
    const res = await call("https://geo.test/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("The free sales channel <br class=\"hero-br\">your store is missing");
    // The headline calls the AI channel free; the title sits next to "GEO", so it never says "free".
    expect(html).toContain("<title>GEO · Get your products recommended by AI</title>");
    expect(html).not.toMatch(/<title>[^<]*free/i);
    expect(html).not.toContain("—");
    expect(html).toContain('src="/home/img/');
    // No free trial and no install from the website any more: every sign-up button joins the waitlist.
    expect(html).not.toMatch(/free trial/i);
    expect(html).not.toContain("/auth/login");
    expect(html).toContain('data-waitlist="pricing" data-plan="core" aria-haspopup="dialog">Join the waitlist</button>');
    expect(html).toContain('data-waitlist="pricing" data-plan="pro" aria-haspopup="dialog">Join the waitlist</button>');
  });

  it("uses the GEO logo as its icon (svg, ico and the home screen icon)", async () => {
    const html = await (await call("https://geo.test/")).text();
    expect(html).toContain('<link rel="icon" href="/favicon.svg" type="image/svg+xml">');
    expect(html).toContain('<link rel="icon" href="/favicon.ico" sizes="any">');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">');
    for (const f of ["favicon.svg", "favicon.ico", "apple-touch-icon.png"]) {
      expect(existsSync(join(imgDir, "..", "..", f)), `public/${f} is missing`).toBe(true);
    }
  });

  it("has a Join the waitlist box in the hero, a waitlist button in the nav and footer, and one popup for them all", async () => {
    const html = await (await call("https://geo.test/")).text();
    // the hero: no link box any more, one button that opens the popup
    expect(html).not.toContain('action="/check"');
    expect(html).not.toContain('name="url"');
    expect(html).toContain('<button class="hero-check-box hero-join-box" type="button" data-waitlist="hero" aria-haspopup="dialog">');
    expect(html).toContain('<span class="btn btn-dark hero-check-btn">Join the waitlist</span>');
    expect(html).toContain('href="#waitlist" data-waitlist="nav" aria-haspopup="dialog"><span class="nav-cta-long">Join the waitlist</span>');
    expect(html).toContain('href="#waitlist" data-waitlist="footer" aria-haspopup="dialog">Join the waitlist');
    // the popup: name, email, a hidden field for bots, the words saved with each signup, and the done screen
    const start = html.indexOf('<dialog class="wl" id="waitlist-dialog"');
    expect(start).toBeGreaterThan(-1);
    const popup = html.slice(start, html.indexOf("</dialog>", start));
    expect(popup).toContain('<h2 class="wl-h" id="wl-title">Join the waitlist</h2>');
    expect(popup).not.toContain("Be first to get GEO"); // Ross: just the heading
    expect(popup).toContain('name="name" autocomplete="name"');
    expect(popup).toContain('type="email" name="email"');
    expect(popup).toContain('name="website" tabindex="-1"');
    expect(popup).toContain(`<p class="wl-small">${WAITLIST_CONSENT_TEXT}</p>`);
    expect(popup).toContain("You’re on the waitlist!");
    expect(popup).toContain("We’ll reach out shortly.");
    expect(popup).toContain('<canvas class="wl-confetti" aria-hidden="true"></canvas>');
    // the live page posts it for real (the design preview doesn't)
    expect(html).toContain("<script>window.GEO_LIVE=true</script>");
    expect(html).toContain("fetch('/waitlist'");
  });

  it("has no dead in-page links, keeps its honesty labels and only uses images that ship", async () => {
    const html = await (await call("https://geo.test/")).text();
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    const anchors = [...new Set([...html.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]))];
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) expect(ids.has(a), `href="#${a}" has no matching id`).toBe(true);

    expect(html.toLowerCase()).toContain("our 2025 estimate");
    expect(html).toContain("Sample data");
    expect(html).not.toMatch(/ \u2013 /); // no spaced en dash standing in for an em dash

    const imgs = [...new Set([...html.matchAll(/src="\/home\/img\/([^"]+)"/g)].map((m) => m[1]))];
    expect(imgs.length).toBeGreaterThan(0);
    for (const f of imgs) expect(existsSync(join(imgDir, f)), `public/home/img/${f} is missing`).toBe(true);
  });

  it("explains itself in one line and shows the explainer video that ships", async () => {
    const html = await (await call("https://geo.test/")).text();
    expect(html).toContain("Like SEO, but for ChatGPT’s answers.");
    expect(html).toContain("Shoppers ask. AI recommends. You get the sale.");
    // the video section is hidden on phones (Ross); it only loads when on screen, so phones never download it
    expect(html).toMatch(/@media \(max-width: 760px\) \{\s*\.vid-sec \{ display: none; \}/);
    expect(html).toContain('preload="none"');
    const start = html.indexOf('<video class="vid"');
    expect(start).toBeGreaterThan(-1);
    const video = html.slice(start, html.indexOf("</video>", start));
    expect(html).toContain(">How GEO can increase your sales</h2>");
    // A made-up store: the label says it is an example, and the honest "it takes time" line is in the description.
    expect(video).toContain('aria-label="Short explainer, with a made-up store and sample numbers');
    expect(video).toContain("weeks or months to catch up");
    expect(video).toContain(" loop ");
    expect(video).toContain('preload="none"');
    expect(video).toContain('poster="/home/img/explainer-poster.jpg"');
    // Muted and inline so it may play; no autoplay attribute (11v-video.js starts it, never with reduced motion).
    expect(video).toContain(" muted ");
    expect(video).toContain(" playsinline ");
    expect(video).not.toMatch(/\sautoplay[\s>]/);
    expect(video).toContain('type="video/mp4"');
    expect(video).toContain('type="video/webm"');
    const files = [...video.matchAll(/(?:src|poster)="\/home\/img\/([^"]+)"/g)].map((m) => m[1]);
    // desktop only: the section is hidden on phones, so there is no phone version
    expect(files).toEqual(["explainer-poster.jpg", "explainer.webm", "explainer.mp4"]);
    for (const f of files) expect(existsSync(join(imgDir, f)), `public/home/img/${f} is missing`).toBe(true);
  });

  it("shows every story as a card in a moving row right under the hero, each linking to its own page", async () => {
    const html = await (await call("https://geo.test/")).text();
    const hero = html.indexOf('<section class="hero" id="overview">');
    const start = html.indexOf('<section class="stories" id="stories" aria-labelledby="stories-h">');
    const video = html.indexOf('<section class="vid-sec" id="watch"');
    expect(hero).toBeGreaterThan(-1);
    expect(start).toBeGreaterThan(hero);
    expect(video).toBeGreaterThan(start);
    // nothing else between the hero and the stories, and the old four-card version further down is gone
    expect(html.slice(hero + 1, start).match(/<section[\s>]/g)).toBeNull();
    expect(html.match(/<section class="[^"]*\bstories\b/g)).toHaveLength(1);
    const sec = html.slice(start, video);
    expect(sec).toContain('<h2 class="h2" id="stories-h">Stores already getting sales from AI</h2>');
    // one short line saying these are press stories (so the logos never read as GEO's customer list)
    expect(sec).toContain("As reported by Modern Retail, Digital&nbsp;Commerce&nbsp;360 and others.");
    expect(sec).toContain('<a class="btn btn-light btn-sm stories-all" href="/stories">See all stories');

    // The track holds the cards twice: the second copy is hidden from screen readers and skipped by the keyboard.
    const groups = [...sec.matchAll(/<ul class="stories-group" role="list"( aria-hidden="true")?>([\s\S]*?)<\/ul>/g)];
    expect(groups.map((g) => Boolean(g[1]))).toEqual([false, true]);
    const esc = (t: string) => t.replace(/&/g, "&amp;");
    for (const [, hidden, body] of groups) {
      const cards = body.split("<li>").slice(1);
      expect(cards).toHaveLength(STORIES.length);
      cards.forEach((card, i) => {
        const story = STORIES[i];
        expect(card).toContain(` href="/stories/${story.slug}"`);
        expect(card).toContain(`<span class="sc-head">${esc(story.cardHeadline)}</span>`);
        expect(card).toContain(`<span class="sc-name">${esc(story.brand)}</span>`);
        expect(card).toContain(`src="/home/img/${story.logo}"`);
        // the Shopify bag only on stores that run on Shopify
        expect(card.includes("logos/shopify.svg"), story.slug).toBe(story.onShopify);
        expect(card.includes('tabindex="-1"'), story.slug).toBe(Boolean(hidden));
      });
      expect(body.match(/logos\/shopify\.svg/g)).toHaveLength(STORIES.filter((st) => st.onShopify).length);
    }
    expect(STORIES).toHaveLength(15);
    expect(STORIES.filter((st) => st.onShopify)).toHaveLength(6);
    // a way to stop the motion for people who can't hover (shown by 11s-stories.js, which also starts the motion)
    expect(sec).toContain('<button class="stories-toggle" type="button" hidden>');
    // every logo ships, also for the /stories pages that load them from /home/img/logos/
    for (const f of [...STORIES.map((st) => st.logo), "logos/shopify.svg"]) expect(existsSync(join(imgDir, f)), `public/home/img/${f} is missing`).toBe(true);

    // "Not GEO customers" moved to each story page, next to the link to the original.
    expect(html).not.toMatch(/not GEO customers/i);
    expect(sec).not.toMatch(/\u2014|\s\u2013\s/);
    expect(html).toContain('<a href="/stories">Stories</a>');
  });

  it("shows GEO's method as six numbered steps, each with what we do and an Example screen", async () => {
    const html = await (await call("https://geo.test/")).text();
    const start = html.indexOf('<section class="section alt how" id="how"');
    expect(start).toBeGreaterThan(-1);
    const how = html.slice(start, html.indexOf("</section>", start));
    expect(how).toContain('<h2 class="h2 how-h2" id="how-title" data-rise>How GEO works to get you recommended</h2>');
    expect(how).toContain('<ol class="how-steps">');
    const steps = [...how.matchAll(/<h3 class="how-t">([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(steps).toEqual([
      "Find where AI looks",
      "Let AI read your store",
      "Rewrite your product pages",
      "Write buying guides",
      "Get you on sites AI trusts",
      "Check again every week",
    ]);
    // who does what, in one line up top
    expect(how).toContain('We do the work. You click approve, or on <span class="nw">Done-for-you</span> we do that too.');
    // the two kinds of work, and every small screen labelled "Example" with a sentence for screen readers
    expect(how).toContain("On your store</span>");
    expect(how).toContain("Across the web</span>");
    expect(how.match(/<div class="how-vis" role="img" aria-label="Example: [^"]+">/g)).toHaveLength(6);
    expect(how.match(/<span class="hv-tag">Example<\/span>/g)).toHaveLength(6);
    for (const chip of ["One-click undo", "Only your store’s facts", "No fake reviews or posts"]) expect(how).toContain(`${chip}</li>`);
    // honest about outreach: threads are joined by the store itself, and nothing promises rankings or sales
    expect(how).toContain("You join in");
    expect(how).not.toMatch(/guarantee|rank #?1|more sales/i);
    // it no longer repeats the hero cards or the sample app's money numbers
    expect(how).not.toContain("$4,820");
    expect(how).not.toContain("You get the sale");
  });

  it("links the free tools hub and every tool from the footer, and the hub from the nav", async () => {
    const html = await (await call("https://geo.test/")).text();
    const start = html.indexOf('<nav class="foot-tools" aria-label="Free tools">');
    expect(start).toBeGreaterThan(-1);
    const footer = html.slice(start, html.indexOf("</nav>", start));
    expect(footer).toContain('<a href="/tools">All free tools</a>');
    for (const t of TOOLS) expect(footer, t.path).toContain(`<a href="${t.path}">${t.name}</a>`);
    expect(html).toContain('<li><a href="/tools">Free tools</a></li>');
    expect(html).toContain('<link rel="canonical" href="https://usegeo.app/">');
  });

  it("sends Shopify app opens straight into the app", async () => {
    const res = await call("https://geo.test/?shop=demo.myshopify.com&host=abc").catch((r: Response) => r);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/app?shop=demo.myshopify.com&host=abc");
  });
});
