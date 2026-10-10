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

  it("has the free product check form, which posts to /check on the live site", async () => {
    const html = await (await call("https://geo.test/")).text();
    expect(html).toContain('<form class="hero-check" id="check" method="post" action="/check">');
    expect(html).toContain('name="url"');
    expect(html).toContain('name="country"');
    expect(html).toContain('name="website"');
    expect(html).toContain("<script>window.GEO_LIVE=true</script>");
    expect(html).toContain('href="#check"><span class="nav-cta-long">Check a product free</span>');
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
