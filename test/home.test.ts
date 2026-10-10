import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { loader } from "../app/routes/_index/route";

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
    expect(html).toContain("<title>GEO · The free sales channel your store is missing</title>");
    expect(html).not.toContain("—");
    expect(html).toContain('src="/home/img/');
    expect(html).toContain('href="/auth/login"');
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

  it("sends Shopify app opens straight into the app", async () => {
    const res = await call("https://geo.test/?shop=demo.myshopify.com&host=abc").catch((r: Response) => r);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/app?shop=demo.myshopify.com&host=abc");
  });
});
