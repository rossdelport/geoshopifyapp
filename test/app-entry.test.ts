// The embedded app's layout route (/app). A person who types usegeo.app/app in a normal browser tab
// (nothing from Shopify on the address) goes to the login page, and every request that comes from the
// Shopify admin (shop, host, embedded, hmac, id_token, a session token header, a page in the admin's
// frame) still goes to Shopify's own login check untouched. Its error boundary shows what the server
// sent for a thrown Response in the browser too, where the bundle renames React Router's error class.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, isRouteErrorResponse, UNSAFE_ErrorResponseImpl as ErrorResponseImpl, type LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Stands in for Shopify's check: in production it throws the App Bridge page, a redirect or a 410.
const SHOPIFY_CHECK = new Response("shopify check", { status: 299 });
vi.mock("../app/lib/shop.server", () => ({ requireShop: vi.fn(async () => { throw SHOPIFY_CHECK; }) }));

const { requireShop } = await import("../app/lib/shop.server");
const route = await import("../app/routes/app");

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
// What Chrome, Edge, Firefox and Safari 16.4+ send when someone types an address or opens a bookmark.
const TYPED = { "User-Agent": CHROME, Accept: "text/html", "Sec-Fetch-Dest": "document", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Site": "none" };
const HOST = "dGVzdC1zdG9yZS5teXNob3BpZnkuY29tL2FkbWlu"; // base64 of test-store.myshopify.com/admin

async function load(url: string, headers: Record<string, string>) {
  const request = new Request(url, { headers });
  try {
    return await route.loader({ request, params: {}, context: {} } as unknown as LoaderFunctionArgs);
  } catch (thrown) {
    return thrown;
  }
}

// Braces: a function returned from beforeEach runs as its clean-up, and that would call the mock.
beforeEach(() => {
  vi.mocked(requireShop).mockClear();
});

describe("/app opened outside Shopify", () => {
  it.each([
    "https://usegeo.app/app",
    "https://usegeo.app/app/",
    "https://usegeo.app/app/questions",
    "https://usegeo.app/app?utm_source=newsletter",
    "https://geo-shopify-app-production.up.railway.app/app",
  ])("sends a typed visit to %s to the login page", async (url) => {
    const out = await load(url, TYPED);
    expect(out).toBeInstanceOf(Response);
    const res = out as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/auth/login");
    expect(requireShop).not.toHaveBeenCalled();
  });
});

describe("/app opened by the Shopify admin", () => {
  const cases: [string, string, Record<string, string>][] = [
    ["shop on the address", `/app?shop=test-store.myshopify.com`, TYPED],
    ["shop and host", `/app?shop=test-store.myshopify.com&host=${HOST}`, TYPED],
    ["the admin's full launch address", `/app?embedded=1&hmac=abc&host=${HOST}&id_token=a.b.c&locale=en&session=s1&shop=test-store.myshopify.com&timestamp=1`, TYPED],
    ["host only", `/app?host=${HOST}`, TYPED],
    ["embedded=1 only", `/app?embedded=1`, TYPED],
    ["hmac only", `/app?hmac=abc&timestamp=1`, TYPED],
    ["id_token only", `/app?id_token=a.b.c`, TYPED],
    ["session only", `/app?session=s1`, TYPED],
    ["a session token header", `/app`, { ...TYPED, Authorization: "Bearer a.b.c" }],
    ["a page inside the admin's frame", `/app`, { ...TYPED, "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Site": "cross-site" }],
    ["a child page inside the admin's frame", `/app/fixes`, { ...TYPED, "Sec-Fetch-Dest": "iframe" }],
    ["a browser that sends no Sec-Fetch headers", `/app`, { "User-Agent": CHROME, Accept: "text/html" }],
    ["curl", `/app`, { "User-Agent": "curl/8.5.0" }],
    ["the Shopify mobile app", `/app`, { ...TYPED, "User-Agent": `${CHROME} Shopify Mobile/iOS/9.180.0` }],
    ["Shopify POS", `/app`, { ...TYPED, "User-Agent": `${CHROME} Shopify POS/9.0` }],
    ["a bot (Shopify answers 410)", `/app`, { ...TYPED, "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }],
  ];

  it.each(cases)("leaves %s to Shopify's login check", async (_label, path, headers) => {
    const out = await load(`https://usegeo.app${path}`, headers);
    expect(out).toBe(SHOPIFY_CHECK);
    expect(requireShop).toHaveBeenCalledTimes(1);
  });
});

describe("/app error boundary", () => {
  // The browser bundle minifies React Router's ErrorResponseImpl into an unnamed class (seen in
  // build/client/assets: `Ge=class{constructor(e,t,r,a=!1){this.status=e,...`), so its name is not
  // "ErrorResponseImpl". Shopify's boundary.error checks that name, threw again, and React Router
  // painted its own "Unhandled Thrown Response!" page over what the server sent.
  const Minified = class Ge {
    status: number; statusText: string; internal = false; data: unknown;
    constructor(status: number, statusText: string, data: unknown) {
      this.status = status; this.statusText = statusText; this.data = data;
    }
  };
  const APP_BRIDGE = '<script data-api-key="key" src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>';

  function render(error: unknown) {
    const Stub = createRoutesStub([{ id: "app", path: "/app", Component: () => null, ErrorBoundary: route.ErrorBoundary }]);
    return renderToStaticMarkup(createElement(Stub, { initialEntries: ["/app"], hydrationData: { errors: { app: error } } }));
  }

  it("shows the page Shopify threw (App Bridge) when the error class has another name", () => {
    const error = new Minified(200, "", APP_BRIDGE);
    expect(error.constructor.name).not.toBe("ErrorResponseImpl");
    expect(isRouteErrorResponse(error)).toBe(true);
    const html = render(error);
    expect(html).toBe(`<div>${APP_BRIDGE}</div>`);
    expect(html).not.toContain("Unhandled Thrown Response");
  });

  it("gives the same markup as Shopify's boundary.error on the server, so hydration keeps it", () => {
    // On the server the class keeps its real name and Shopify's check works.
    const real = new ErrorResponseImpl(200, "", APP_BRIDGE);
    expect(render(real)).toBe(renderToStaticMarkup(boundary.error(real)));
    expect(render(new ErrorResponseImpl(401, "Unauthorized", ""))).toBe(renderToStaticMarkup(boundary.error(new ErrorResponseImpl(401, "Unauthorized", ""))));
    expect(render(new Minified(401, "Unauthorized", ""))).toBe("<div>Handling response</div>");
  });

  it("shows a plain message and a way back for a real crash or a missing page, never the raw error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const crash = render(new Error("boom"));
    spy.mockRestore();
    expect(crash).toContain("Something went wrong");
    expect(crash).toContain('href="/app"');
    expect(crash).not.toContain("boom");
    const missing = render(new ErrorResponseImpl(404, "Not Found", "Not found"));
    expect(missing).toContain("We couldn&#x27;t find that page");
    expect(missing).toContain("Back to the dashboard");
  });
});
