import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { loader } from "../app/routes/_index/route";
import { TOOLS } from "../app/lib/tools/registry";

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
    // Each pricing card's trial button carries its plan to the login page (the toggle switches the cycle).
    expect(html).toContain('href="/auth/login?plan=core&amp;cycle=monthly" data-plan="core"');
    expect(html).toContain('href="/auth/login?plan=pro&amp;cycle=monthly" data-plan="pro"');
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

  it("has the free product check form, which posts to /check on the live site", async () => {
    const html = await (await call("https://geo.test/")).text();
    expect(html).toContain('<form class="hero-check" id="check" method="post" action="/check">');
    expect(html).toContain('name="url"');
    expect(html).toContain('name="website"');
    expect(html).toContain(">Check my product</button>");
    expect(html).toContain("<script>window.GEO_LIVE=true</script>");
    expect(html).toContain('href="#check"><span class="nav-cta-long">Check a product free</span>');
  });

  it("has no country picker on the hero form (the server works out the store's country)", async () => {
    const html = await (await call("https://geo.test/")).text();
    const start = html.indexOf('<form class="hero-check" id="check"');
    expect(start).toBeGreaterThan(-1);
    const form = html.slice(start, html.indexOf("</form>", start));
    expect(form).toContain('name="url"');
    expect(form).not.toContain("<select");
    expect(form).not.toContain('name="country"');
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

  it("explains itself in one line and shows a free check video that ships", async () => {
    const html = await (await call("https://geo.test/")).text();
    expect(html).toContain("Like SEO, but for ChatGPT’s answers.");
    expect(html).toContain("Shoppers ask. AI recommends. You get the sale.");
    const start = html.indexOf('<video class="vid"');
    expect(start).toBeGreaterThan(-1);
    const video = html.slice(start, html.indexOf("</video>", start));
    // Muted and inline so it may play; no autoplay attribute (11v-video.js starts it, never with reduced motion).
    expect(video).toContain(" muted ");
    expect(video).toContain(" playsinline ");
    expect(video).not.toMatch(/\sautoplay[\s>]/);
    expect(video).toContain('type="video/mp4"');
    expect(video).toContain('type="video/webm"');
    const files = [...video.matchAll(/(?:src|poster)="\/home\/img\/([^"]+)"/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThanOrEqual(5);
    // The phone poster is swapped in by script, so it must ship too.
    for (const f of [...files, "free-check-phone-poster.jpg"]) expect(existsSync(join(imgDir, f)), `public/home/img/${f} is missing`).toBe(true);
  });

  it("shows GEO's method as five numbered steps, each with an Example screen", async () => {
    const html = await (await call("https://geo.test/")).text();
    const start = html.indexOf('<section class="section alt how" id="how"');
    expect(start).toBeGreaterThan(-1);
    const how = html.slice(start, html.indexOf("</section>", start));
    expect(how).toContain('<h2 class="h2 how-h2" id="how-title" data-rise>How GEO works to get you recommended</h2>');
    expect(how).toContain('<ol class="how-steps">');
    const steps = [...how.matchAll(/<h3 class="how-t">([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(steps).toEqual(["Find where AI looks", "Let AI read your store", "Product pages AI can quote", "Guide pages, kept fresh", "Get named where AI looks"]);
    // the two kinds of work, and every small screen labelled "Example" with a sentence for screen readers
    expect(how).toContain("On your store</span>");
    expect(how).toContain("Across the web</span>");
    expect(how.match(/<div class="how-vis" role="img" aria-label="Example: [^"]+">/g)).toHaveLength(5);
    expect(how.match(/<span class="hv-tag">Example<\/span>/g)).toHaveLength(5);
    expect(how).toContain("Done-for-you:</b> we send pitches, add listings and follow up.");
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
