import { describe, expect, it } from "vitest";
import type { LoaderFunctionArgs } from "react-router";
import { loader } from "../app/routes/_index/route";

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

  it("sends Shopify app opens straight into the app", async () => {
    const res = await call("https://geo.test/?shop=demo.myshopify.com&host=abc").catch((r: Response) => r);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/app?shop=demo.myshopify.com&host=abc");
  });
});
