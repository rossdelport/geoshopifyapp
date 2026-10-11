// Free product check: working out where the store is (the shopper country we ask the AI assistants as).
import { describe, expect, it } from "vitest";
import { detectCountry, domainCountry, localeRegion, mergeProduct, parseProductHtml, parseShopifyMeta, storeCountryFromMeta } from "../app/lib/check-read";

describe("detectCountry", () => {
  it("trusts Shopify's store country first (the shape of a real /meta.json)", () => {
    const meta = { name: "Coolabah Grooming Co.", country: "AU", currency: "AUD", myshopify_domain: "coolabah-grooming.myshopify.com" };
    expect(detectCountry({ storeCountry: parseShopifyMeta(meta)?.country, domain: "coolabahgrooming.com", locales: ["en-SG"], currencies: ["SGD"] })).toEqual({
      country: "AU",
      how: "store",
    });
    // It beats a country web address and signals that follow the visitor.
    expect(detectCountry({ storeCountry: "NZ", domain: "shop.com.au", locales: ["en_GB"], currencies: ["USD"] })).toEqual({ country: "NZ", how: "store" });
  });

  it("uses the domain ending next", () => {
    expect(detectCountry({ domain: "coolabahgrooming.co.nz" })).toEqual({ country: "NZ", how: "domain" });
    expect(detectCountry({ domain: "shop.coolabah.com.au", currencies: ["USD"] })).toEqual({ country: "AU", how: "domain" });
    expect(detectCountry({ domain: "banksia.co.uk" })).toEqual({ country: "GB", how: "domain" });
    expect(detectCountry({ domain: "wattle.ca" })).toEqual({ country: "CA", how: "domain" });
    expect(detectCountry({ domain: "ridgeback.us" })).toEqual({ country: "US", how: "domain" });
  });

  it("then a currency other than USD, then the page's language region, then USD", () => {
    expect(detectCountry({ domain: "saltbush.com", currencies: [null, "cad"] })).toEqual({ country: "CA", how: "currency" });
    // A shop's own AUD, NZD, GBP or CAD prices beat a language setting (an Australian shop set to English (UK)).
    expect(detectCountry({ domain: "saltbush.com", locales: ["en_GB"], currencies: ["NZD"] })).toEqual({ country: "NZ", how: "currency" });
    expect(detectCountry({ domain: "saltbush.com", locales: ["en-GB"] })).toEqual({ country: "GB", how: "language" });
    // USD is a common "international" default, so a language region beats it.
    expect(detectCountry({ domain: "saltbush.com", locales: [null, "en_NZ"], currencies: ["USD"] })).toEqual({ country: "NZ", how: "language" });
    expect(detectCountry({ domain: "saltbush.com", currencies: ["USD"] })).toEqual({ country: "US", how: "currency" });
  });

  it("treats en-US as a weak default: a currency we check wins over it", () => {
    expect(detectCountry({ domain: "saltbush.com", locales: ["en_US"], currencies: ["AUD"] })).toEqual({ country: "AU", how: "currency" });
    expect(detectCountry({ domain: "saltbush.com", locales: ["en_US"], currencies: ["EUR"] })).toEqual({ country: "US", how: "language" });
  });

  it("skips signals for countries we don't check (they may just follow our server, which is in Singapore)", () => {
    expect(detectCountry({ domain: "saltbush.com", locales: ["en-SG"], currencies: ["SGD", "GBP"] })).toEqual({ country: "GB", how: "currency" });
    expect(detectCountry({ domain: "shop.co", locales: ["en-SG"], currencies: ["SGD"] })).toEqual({ country: "AU", how: "default" });
  });

  it("for a store based somewhere we don't check yet, uses its web address or own currency, else Australia", () => {
    // USD and en-US say nothing about where it is (they often follow the visitor), so they are skipped.
    expect(detectCountry({ storeCountry: "DE", domain: "shop.com", locales: ["en-US"], currencies: ["USD"] })).toEqual({ country: "AU", how: "unsupported" });
    expect(detectCountry({ storeCountry: "DE", domain: "shop.com", locales: ["en-GB"] })).toEqual({ country: "AU", how: "unsupported" });
    expect(detectCountry({ storeCountry: "DE", domain: "banksia.co.uk", currencies: ["EUR"] })).toEqual({ country: "GB", how: "domain" });
    expect(detectCountry({ storeCountry: "SG", domain: "shop.com", currencies: ["SGD", "GBP"] })).toEqual({ country: "GB", how: "currency" });
  });

  it("uses Australia when nothing is found", () => {
    expect(detectCountry({})).toEqual({ country: "AU", how: "default" });
    expect(detectCountry({ storeCountry: "", domain: "shop.myshopify.com", locales: ["en"], currencies: ["", null] })).toEqual({ country: "AU", how: "default" });
  });

  it("lets a chosen country (old forms and links) win, if it's one we check", () => {
    expect(detectCountry({ override: "ca", storeCountry: "AU", domain: "shop.com.au" })).toEqual({ country: "CA", how: "chosen" });
    expect(detectCountry({ override: "XX", storeCountry: "NZ" })).toEqual({ country: "NZ", how: "store" });
    expect(detectCountry({ override: "auto", domain: "shop.co.uk" })).toEqual({ country: "GB", how: "domain" });
  });
});

describe("country signals", () => {
  it("reads the store country from /meta.json and ignores anything else", () => {
    expect(parseShopifyMeta({ country: "nz", myshopify_domain: "Wattlebird.myshopify.com" })).toEqual({ country: "NZ", myshopifyDomain: "wattlebird.myshopify.com", currency: null });
    expect(parseShopifyMeta({ country: "US", currency: "usd", myshopify_domain: "x.myshopify.com" })?.currency).toBe("USD");
    expect(parseShopifyMeta({ country: "AU", myshopify_domain: "evil.com" })).toEqual({ country: "AU", myshopifyDomain: null, currency: null });
    for (const junk of [null, "AU", [], { country: "Australia" }, { country: 36 }, { currency: "AUD" }]) expect(parseShopifyMeta(junk)).toBeNull();
  });

  it("only uses /meta.json when it is the product page's own shop", () => {
    const meta = { country: "NZ", myshopifyDomain: "wattlebird.myshopify.com", host: "wattlebird.com" };
    expect(storeCountryFromMeta(meta, { shopDomain: "wattlebird.myshopify.com", host: "wattlebird.com" })).toBe("NZ");
    // The page redirected to another shop: its Shopify.shop doesn't match.
    expect(storeCountryFromMeta(meta, { shopDomain: "saltbush.myshopify.com", host: "saltbush.com" })).toBeNull();
    // The page names no shop (it only shows images from Shopify's CDN): /meta.json must have come from the page's own host.
    expect(storeCountryFromMeta(meta, { shopDomain: null, host: "wattlebird.com" })).toBe("NZ");
    expect(storeCountryFromMeta(meta, { shopDomain: null, host: "banksia-wax.com" })).toBeNull();
    // A /meta.json that doesn't name its shop can't be matched.
    expect(storeCountryFromMeta({ ...meta, myshopifyDomain: null }, { shopDomain: "wattlebird.myshopify.com", host: "wattlebird.com" })).toBeNull();
    expect(storeCountryFromMeta({ ...meta, myshopifyDomain: null }, { shopDomain: null, host: "wattlebird.com" })).toBeNull();
    expect(storeCountryFromMeta(null, { shopDomain: "wattlebird.myshopify.com", host: "wattlebird.com" })).toBeNull();
  });

  it("only maps the domain endings of the countries we check", () => {
    expect(domainCountry("shop.com.au.")).toBe("AU");
    expect(domainCountry("shop.org.nz")).toBe("NZ");
    for (const d of ["shop.com", "shop.co", "shop.io", "x.myshopify.com", "shop.de", "", null]) expect(domainCountry(d)).toBeNull();
  });

  it("reads the region of a language tag", () => {
    expect(localeRegion("en-AU")).toBe("AU");
    expect(localeRegion("en_nz")).toBe("NZ");
    expect(localeRegion("en-UK")).toBe("GB");
    expect(localeRegion("zh-Hant-TW")).toBe("TW");
    for (const t of ["en", "", null, "en-001", "english"]) expect(localeRegion(t)).toBeNull();
  });

  it("collects the page's language and currency for detection", () => {
    const url = "https://saltbush.com/products/oil";
    const html = `<!doctype html><html class="no-js" lang="en-NZ"><head><title>Oil</title>
<meta property="og:locale" content="en_GB"><meta property="og:type" content="product">
<script>Shopify.shop = "saltbush.myshopify.com"; Shopify.currency = {"active":"NZD","rate":"1.0"};</script></head></html>`;
    const page = parseProductHtml(html, url);
    expect(page).toMatchObject({ ogLocale: "en_GB", htmlLang: "en-NZ", shopCurrency: "NZD" });
    expect(mergeProduct(url, null, page)!.countrySignals).toEqual({
      storeCountry: null,
      domain: "saltbush.com",
      locales: ["en_GB", "en-NZ"],
      currencies: [null, null, "NZD"],
    });
    // The shop's own NZD prices beat the en-GB language setting.
    expect(detectCountry(mergeProduct(url, null, page)!.countrySignals)).toEqual({ country: "NZ", how: "currency" });
    expect(parseProductHtml("<html><head><title>x</title></head></html>", url)).toMatchObject({ ogLocale: null, htmlLang: null });
  });

  it("reads lang= only as its own attribute on the <html> tag", () => {
    const url = "https://a.com/products/x";
    expect(parseProductHtml(`<html data-lang="en-GB" lang="en-NZ"><title>x</title>`, url).htmlLang).toBe("en-NZ");
    expect(parseProductHtml(`<html data-lang="en-GB" class="js"><title>x</title>`, url).htmlLang).toBeNull();
    expect(parseProductHtml(`<html xml:lang="en-GB"><title>x</title>`, url).htmlLang).toBeNull();
    expect(parseProductHtml(`<html\nlang=en-AU><title>x</title>`, url).htmlLang).toBe("en-AU");
  });

  it("only looks for <html lang> near the top of the page", () => {
    const late = `<title>x</title>${" ".repeat(6000)}<html lang="en-AU">`;
    expect(parseProductHtml(late, "https://a.com/products/x").htmlLang).toBeNull();
  });
});
