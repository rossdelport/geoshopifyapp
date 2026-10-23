// The home page in German, French, Dutch, Spanish and Italian (usegeo.app/de, /fr, /nl, /es, /it), built by
// design/overview/i18n.mjs. Each page: its own language, address and title; the price in Australian dollars; the company details line;
// no explainer video; the waitlist form tells the server the language; the Meta pixel once; no English left in the
// big headings; no em dash. The English page points search engines at all five.

import type { LoaderFunctionArgs } from "react-router";
import { describe, expect, it } from "vitest";
import { HOME_LANGS } from "../app/lib/tools/site";
import * as en from "../app/routes/_index/route";
import * as de from "../app/routes/de";
import * as fr from "../app/routes/fr";
import * as nl from "../app/routes/nl";
import * as es from "../app/routes/es";
import * as it_ from "../app/routes/it";

const ROUTES = { de, fr, nl, es, it: it_ };
const get = async (route: { loader: (a: LoaderFunctionArgs) => Promise<Response> }, url: string) =>
  route.loader({ request: new Request(url), params: {}, context: {} } as unknown as LoaderFunctionArgs);

const PRICES: Record<string, string> = { de: "1.000 A$", fr: "1 000 A$", nl: "A$ 1.000", es: "1.000 A$", it: "1.000 A$" };
const LEGAL: Record<string, string> = { de: "Impressum", fr: "Mentions légales", nl: "Bedrijfsgegevens", es: "Aviso legal", it: "Note legali" };

describe("home page in other languages", () => {
  it("has a route for every language", () => {
    expect(Object.keys(ROUTES).sort()).toEqual([...HOME_LANGS].sort());
  });

  for (const lang of HOME_LANGS) {
    it(`/${lang} is the whole page in its language, with its price, company details and no video`, async () => {
      const res = await get(ROUTES[lang], `https://geo.test/${lang}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain(`<link rel="canonical" href="https://usegeo.app/${lang}">`);
      expect(html).toContain(`window.GEO_LANG="${lang}"`);
      expect(html).not.toContain("<title>GEO · Get your products recommended by AI</title>");
      // English words that must be gone
      for (const enText of ["The free sales channel", "Join the waitlist</button>", "Simple pricing", "Questions store owners ask"]) {
        expect(html, `"${enText}" is still in English`).not.toContain(enText);
      }
      // the one price, in Australian dollars written the local way
      expect(html).toContain(`>${PRICES[lang]}<`);
      expect(html).not.toContain(">A$1,000<");
      // the company details line, with the real address and email
      expect(html).toContain(`<p class="foot-legal">${LEGAL[lang]}: GEO, 237 Adelaide Terrace, East Perth WA 6000,`);
      expect(html).toContain('<a href="mailto:ross@usegeo.app">ross@usegeo.app</a>');
      // no explainer video section or its script
      expect(html).not.toContain('<video class="vid"');
      expect(html).not.toContain("// 11v-video.js");
      // the waitlist sends the language; the Meta pixel is there once
      expect(html).toContain("body.set('lang', window.GEO_LANG || 'en');");
      expect(html.match(/fbq\('init', '28710910728563304'\);/g)).toHaveLength(1);
      expect(html).not.toContain("—");
    });
  }

  it("the English page lists every language for search engines and keeps its video", async () => {
    const html = await (await get(en, "https://geo.test/")).text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<link rel="alternate" hreflang="x-default" href="https://usegeo.app/">');
    for (const lang of HOME_LANGS) expect(html).toContain(`<link rel="alternate" hreflang="${lang}" href="https://usegeo.app/${lang}">`);
    expect(html).toContain('<video class="vid"');
    expect(html).not.toContain('window.GEO_LANG="');
  });

  it("sends Shopify app opens on a language page into the app", async () => {
    await expect(get(de, "https://geo.test/de?shop=x.myshopify.com")).rejects.toMatchObject({ status: 302 });
  });
});
