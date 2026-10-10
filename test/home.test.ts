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
    expect(html).toContain("Get your store recommended by ChatGPT");
    expect(html).toContain('src="/home/img/');
    expect(html).toContain('href="/auth/login"');
  });

  it("sends Shopify app opens straight into the app", async () => {
    const res = await call("https://geo.test/?shop=demo.myshopify.com&host=abc").catch((r: Response) => r);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/app?shop=demo.myshopify.com&host=abc");
  });
});
