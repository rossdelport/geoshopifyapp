/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON-LD graph */
// The Product Schema Checker (/tools/product-schema-checker): reading JSON-LD (blocks, @graph, type arrays and
// URLs, variants, @id references), the facts against Google's merchant listing and variant guides, the
// problems (disagreeing blocks, typos, prices with symbols, data that doesn't match the store's record),
// Shopify's product record, bounded parsing, the link check (fetches faked), the action's guards, the page
// (head, JSON-LD, copy, one button) and the copy rules.
// Fixtures: test/fixtures/tools/schema-*.html. schema-shopify-horizon.html and its -record.json were observed
// on Shopify's Horizon demo store on 11 Oct 2026 and trimmed; schema-allbirds-tree-runners.html and its
// -record.json were observed on allbirds.com on 11 Oct 2026 and trimmed; schema-google-multipage-*.html are
// Google's own examples from its product variants guide; every other fixture is made up and says so.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub, type ActionFunctionArgs, type MetaDescriptor } from "react-router";

vi.mock("../app/lib/check.server", () => ({ safeFetch: vi.fn() }));

const { safeFetch } = await import("../app/lib/check.server");
const schema = await import("../app/lib/tools/schema");
const { checkSchema, detectSource, extractNodes, parseShopifyRecord, looksLikeListingUrl, MAX_VARIANTS } = schema;
const { checkProductUrl, clearSchemaCache } = await import("../app/lib/tools/schema.server");
const copy = await import("../app/lib/tools/copy/product-schema-checker");
const { SAMPLE_JSON, SAMPLE_PRODUCT } = await import("../app/lib/tools/samples/schema-sample");
const { toolBySlug, TOOLS } = await import("../app/lib/tools/registry");
const { toolJsonLd } = await import("../app/lib/tools/seo");
const { OUTCOME_COPY } = await import("../app/lib/tools/fetch.server");
const { CROSS_SITE_COPY, TOO_BIG_COPY } = await import("../app/lib/tools/guard.server");
const { HOUR_COPY, resetToolLimits } = await import("../app/lib/tools/limits.server");
const { toolHeaders } = await import("../app/lib/tools/http");
const route = await import("../app/routes/tools.product-schema-checker");
const layout = await import("../app/routes/tools");

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const fixture = (name: string) => read(`test/fixtures/tools/schema-${name}`);
const TOOL = toolBySlug("product-schema-checker");
const text = (h: string) =>
  h
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<");
type Report = ReturnType<typeof checkSchema>;
const field = (r: Report, id: string) => r.fields.find((f) => f.id === id)!;
const problem = (r: Report, id: string) => r.problems.find((p) => p.id === id);
const HORIZON_RECORD = () => parseShopifyRecord(JSON.parse(fixture("shopify-horizon-record.json")))!;
const ALLBIRDS_URL = "https://www.allbirds.com/products/mens-tree-runners";
const ALLBIRDS_RECORD = () => parseShopifyRecord(JSON.parse(fixture("allbirds-tree-runners-record.json")))!;

// ---------- the on-load sample ----------

describe("the on-load sample", () => {
  const r = checkSchema(SAMPLE_JSON);

  it("is read as pasted JSON-LD: a ProductGroup with 2 variants", () => {
    expect(detectSource(SAMPLE_JSON)).toBe("json");
    expect(r.source).toBe("json");
    expect(r.kind).toBe("ProductGroup");
    expect(r.units).toBe(2);
    expect(r.found).toBe("Found a ProductGroup with 2 variants in the JSON-LD you pasted.");
  });

  it("finds every fact Google requires, so the verdict is ready", () => {
    for (const id of ["name", "variantName", "image", "offers", "price", "currency"]) {
      expect(field(r, id).group, id).toBe("required");
      expect(field(r, id).status, id).toBe("found");
    }
    expect(field(r, "price").value).toBe("24.00 to 34.00 USD");
    expect(r.verdict).toEqual({ state: "ready", headline: "Ready for Google's product results: all required facts found" });
    expect(r.problems).toEqual([]);
  });

  it("has a barcode on 1 of 2 variants, no variesBy, shipping, returns or condition, and no reviews", () => {
    expect(field(r, "gtin")).toMatchObject({ status: "partial", found: 1, of: 2 });
    expect(copy.STATUS.partial(1, 2, r.unitNoun)).toBe("Some variants only (1 of 2)");
    expect(field(r, "shipping").status).toBe("not-on-page");
    expect(field(r, "returns").status).toBe("not-on-page");
    expect(field(r, "variesBy").status).toBe("missing");
    expect(field(r, "condition").status).toBe("missing");
    expect(field(r, "saleEnd").status).toBe("not-needed");
    expect(field(r, "reviews").status).toBe("none");
    expect(field(r, "brand")).toMatchObject({ status: "found", value: "Example Grooming Co" });
    expect(field(r, "category")).toMatchObject({ group: "extra", status: "found", value: "Beard Oil" });
  });

  it("is made up: example domains and zeroed barcodes only", () => {
    expect(SAMPLE_JSON).toContain("example-store.com");
    expect(SAMPLE_PRODUCT.hasVariant[0].gtin).toMatch(/^0{10,}\d+$/);
  });
});

// ---------- fixtures ----------

describe("reading product data from pages", () => {
  it("reads Shopify's Horizon theme output (observed): all required facts, barcodes on every variant", () => {
    const r = checkSchema(fixture("shopify-horizon.html"), { source: "page" });
    expect(r.found).toBe("Found a ProductGroup with 24 variants in the page's HTML.");
    expect(r.verdict.state).toBe("ready");
    expect(field(r, "gtin")).toMatchObject({ status: "found", found: 24, of: 24 });
    expect(field(r, "brand").value).toBe("Horizon (Default)");
    expect(field(r, "availability").value).toBe("In stock"); // "http://schema.org/InStock"
    expect(field(r, "productGroupID").value).toBe("9971950616897");
    expect(r.notes).toEqual(["We also found Organization data. It isn't product data, so we skip it."]);
  });

  it("reads a Product without variants, with every fact Google lists", () => {
    const r = checkSchema(fixture("product-simple.html"));
    expect(r.kind).toBe("Product");
    expect(r.found).toBe("Found a Product in the HTML you pasted.");
    expect(r.verdict.state).toBe("ready");
    for (const id of ["brand", "description", "availability", "gtin", "sku", "mpn", "condition", "url", "shipping", "returns"]) {
      expect(field(r, id).status, id).toBe("found");
    }
    expect(field(r, "image").value).toBe("2 images");
    expect(field(r, "condition").value).toBe("New condition");
    expect(r.fields.some((f) => f.id === "variantName" || f.id === "variesBy")).toBe(false);
  });

  it("finds a ProductGroup inside @graph and mainEntity, and counts a variant without an image", () => {
    const r = checkSchema(fixture("group-graph.html"));
    expect(r.kind).toBe("ProductGroup");
    expect(field(r, "image")).toMatchObject({ status: "partial", found: 2, of: 3 });
    expect(r.verdict).toEqual({ state: "missing", headline: "Missing 1 fact Google needs" });
    expect(field(r, "price").value).toBe("45 to 49 EUR"); // numbers are fine
    expect(field(r, "variesBy").value).toBe("Size");
    expect(field(r, "size").value).toBe("S, M, L");
    expect(r.notes).toEqual(["We also found Organization, BreadcrumbList and WebPage data. It isn't product data, so we skip it."]);
  });

  it("reads @type as an array and as a full schema.org URL, and a price in priceSpecification", () => {
    const arr = checkSchema(fixture("type-array.html"));
    expect(arr.kind).toBe("Product");
    expect(field(arr, "price").value).toBe("12.00 GBP");
    expect(arr.verdict.state).toBe("ready");
    const url = checkSchema(fixture("type-url.html"));
    expect(url.kind).toBe("Product");
    expect(field(url, "availability").value).toBe("Out of stock");
    expect(url.verdict.state).toBe("ready");
  });

  it("raises two blocks that disagree on the price, side by side", () => {
    const r = checkSchema(fixture("two-blocks-disagree.html"));
    const p = problem(r, "disagree")!;
    expect(p.tone).toBe("bad");
    expect(p.text).toBe(
      "Your page has 2 product data blocks that disagree on the price (24.00 to 34.00 USD vs 26.00 USD). Usually one comes from your theme and one from an app. Keep one.",
    );
    expect(p.compare).toEqual([
      { type: "ProductGroup", name: "Cedar Beard Oil", price: "24.00 to 34.00 USD", stock: "in stock" },
      { type: "Product", name: "Cedar Beard Oil", price: "26.00 USD", stock: "in stock" },
    ]);
    expect(r.verdict).toEqual({ state: "problems", headline: "All required facts found, but 1 problem needs fixing" });
  });

  it("raises no problem for a theme block and a reviews app block that agree, and shows the rating", () => {
    const r = checkSchema(fixture("theme-plus-reviews.html"));
    expect(r.problems).toEqual([]);
    expect(r.verdict.state).toBe("ready");
    expect(r.notes).toContain("There's 1 more product data block, and it agrees with this one.");
    expect(field(r, "reviews")).toMatchObject({ status: "found", value: "4.8 from 12 reviews" });
  });

  it("reports a block with a typo and still reads the others", () => {
    const r = checkSchema(fixture("invalid-block.html"));
    expect(problem(r, "invalid")).toEqual({ id: "invalid", tone: "bad", text: "One product data block has a typo, so Google can't read it." });
    expect(field(r, "name").value).toBe("Beard Balm");
    expect(r.verdict.headline).toBe("All required facts found, but 1 problem needs fixing");
  });

  it("can't read a price written with a currency sign, or a currency that isn't 3 letters", () => {
    const r = checkSchema(fixture("price-symbol.html"));
    expect(field(r, "price")).toMatchObject({ status: "unreadable", value: "$24.00" });
    expect(problem(r, "price-format")?.text).toBe(
      'The price is written as "$24.00". Google needs a plain number like 24.00: no currency sign, no comma, and the currency in its own field.',
    );
    expect(r.verdict.headline).toBe("Missing 1 fact Google needs");
    const comma = checkSchema('{"@type":"Product","name":"X","image":"a.jpg","offers":{"price":"24,00","priceCurrency":"dollars"}}');
    expect(field(comma, "price").status).toBe("unreadable");
    expect(field(comma, "currency")).toMatchObject({ status: "unreadable", value: "dollars" });
    expect(problem(comma, "currency-format")?.text).toBe('The currency is written as "dollars". Google needs a 3-letter code like USD or EUR.');
  });

  it("notes microdata, and says when there's no product data at all", () => {
    const micro = checkSchema(fixture("microdata.html"));
    expect(micro.kind).toBeNull();
    expect(micro.microdata).toBe(true);
    expect(problem(micro, "microdata")?.text).toBe(copy.PROBLEM.microdata);
    const none = checkSchema(fixture("none.html"));
    expect(none.verdict).toEqual({ state: "none", headline: "No product data found on this page" });
    expect(none.found).toBe("We found 1 JSON-LD block in the HTML you pasted, but none describes a product.");
    expect(none.microdata).toBe(false);
    expect(none.fields).toEqual([]);
    expect(checkSchema("<p>hello</p>").found).toBe("We found no JSON-LD in the HTML you pasted.");
    expect(checkSchema("{}").verdict.headline).toBe("No product data found in what you pasted");
  });

  it("says a collection page isn't a product page, and never calls it ready", () => {
    const r = checkSchema(fixture("collection.html"));
    expect(r.listing).toBe(true);
    expect(r.verdict).toEqual({ state: "problems", headline: "This doesn't look like a product page" });
    expect(r.found).toBe("Found 3 products in the HTML you pasted. The facts below are for the most complete one.");
    expect(problem(r, "not-product")?.text).toBe(copy.PROBLEM.notProduct);
    expect(problem(r, "disagree")).toBeUndefined();
    expect(looksLikeListingUrl("https://shop.example/collections/beard-care")).toBe(true);
    expect(looksLikeListingUrl("https://shop.example/")).toBe(true);
    expect(looksLikeListingUrl("https://shop.example/collections/beard-care/products/oil")).toBe(false);
    expect(looksLikeListingUrl("https://shop.example/shop/item-123")).toBe(false);
  });

  it("joins variants that point to their group with isVariantOf (an object or an @id)", () => {
    const r = checkSchema(fixture("variant-of.html"));
    expect(r.kind).toBe("ProductGroup");
    expect(r.units).toBe(2);
    expect(r.problems).toEqual([]);
    expect(field(r, "variesBy").value).toBe("Color");
    expect(field(r, "color").value).toBe("Navy, Grey");
  });

  it("resolves hasVariant @id references and merges blocks with the same @id", () => {
    const html = `
      <script type="application/ld+json">{"@type":"ProductGroup","@id":"#g","name":"Oil","hasVariant":[{"@id":"#v1"},{"@id":"#v2"}]}</script>
      <script type="application/ld+json">[{"@type":"Product","@id":"#v1","name":"Oil - S","image":"a.jpg","offers":{"price":"1.00","priceCurrency":"USD"}},
        {"@type":"Product","@id":"#v2","name":"Oil - L","image":"b.jpg","offers":{"price":"2.00","priceCurrency":"USD"}}]</script>
      <script type="application/ld+json">{"@type":"ProductGroup","@id":"#g","brand":{"name":"Oil Co"}}</script>`;
    const x = extractNodes(html);
    expect(x.entities).toHaveLength(1);
    expect(x.entities[0].variants).toHaveLength(2);
    const r = checkSchema(html);
    expect(r.verdict.state).toBe("ready");
    expect(field(r, "brand").value).toBe("Oil Co");
    expect(r.notes).toEqual([]);
  });

  it("checks the first 100 variants of a very large product and says so", () => {
    const variants = Array.from({ length: 120 }, (_, i) => ({ "@type": "Product", name: `V${i}`, image: "a.jpg", offers: { price: "1.00", priceCurrency: "USD" } }));
    const r = checkSchema(JSON.stringify({ "@type": "ProductGroup", name: "Big", hasVariant: variants }));
    expect(r.units).toBe(120);
    expect(field(r, "price")).toMatchObject({ found: MAX_VARIANTS, of: MAX_VARIANTS });
    expect(problem(r, "many-variants")?.text).toBe("This product has 120 variants. We checked the first 100.");
  });

  it("never flags a brand that equals the store name", () => {
    const r = checkSchema('{"@type":"Product","name":"Oil","image":"a.jpg","brand":"Plain Example","offers":{"price":"1.00","priceCurrency":"USD"}}');
    expect(r.problems).toEqual([]);
    expect(field(r, "brand").value).toBe("Plain Example");
  });

  it("prints the product data it read, and leaves other data out", () => {
    const r = checkSchema(fixture("theme-plus-reviews.html"));
    const parsed = JSON.parse(r.json!);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]["@type"]).toBe("ProductGroup");
    expect(checkSchema(fixture("none.html")).json).toBeNull();
  });
});

describe("tricky product data", () => {
  const block = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
  const item = (name: string, price: string, extra: Record<string, unknown> = {}) => ({
    "@type": "Product",
    name,
    image: "a.jpg",
    offers: { price, priceCurrency: "USD" },
    ...extra,
  });

  it("compares two full groups without an @id instead of merging them by name", () => {
    const r = checkSchema(block({ "@type": "ProductGroup", name: "Oil", hasVariant: [item("Oil - S", "1.00")] }) + block({ "@type": "ProductGroup", name: "Oil", hasVariant: [item("Oil - S", "9.00")] }));
    expect(problem(r, "disagree")?.text).toContain("disagree on the price (1.00 USD vs 9.00 USD)");
    // Agreeing blocks with the same group ID are fine.
    const same = checkSchema(block({ "@type": "ProductGroup", productGroupID: "1", name: "Oil", hasVariant: [item("Oil - S", "1.00")] }).repeat(2));
    expect(same.problems).toEqual([]);
    expect(same.notes).toContain("There's 1 more product data block, and it agrees with this one.");
  });

  it("still joins variants whose isVariantOf names the group without an @id", () => {
    const stub = { "@type": "ProductGroup", name: "Beanie", productGroupID: "WB" };
    const r = checkSchema(JSON.stringify([item("Beanie - Navy", "30.00", { isVariantOf: stub }), item("Beanie - Grey", "30.00", { isVariantOf: { ...stub } })]));
    expect(r.kind).toBe("ProductGroup");
    expect(r.units).toBe(2);
    expect(r.problems).toEqual([]);
  });

  it("reads schema.org's more specific product types, like DietarySupplement", () => {
    const r = checkSchema(JSON.stringify({ ...item("Fish Oil", "20.00"), "@type": "DietarySupplement" }));
    expect(r.kind).toBe("Product");
    expect(r.verdict.state).toBe("ready");
    expect(r.notes).toEqual([]);
  });

  it("reads pasted JSON-LD that starts with a byte order mark", () => {
    expect(checkSchema(`\uFEFF${JSON.stringify(item("Oil", "1.00"))}`).verdict.state).toBe("ready");
  });

  it("says a product block with a typo is unreadable, not missing, and words pasted JSON-LD plainly", () => {
    const broken = checkSchema('<script type="application/ld+json">{"@type":"Product","name":"Oil",}</script>');
    expect(broken.verdict).toEqual({ state: "broken", headline: "Your product data has a typo, so Google can't read it" });
    expect(broken.found).toBe("We found 1 JSON-LD block in the HTML you pasted, but none we could read describes a product.");
    const pasted = checkSchema('{"@type":"Product",');
    expect(pasted.verdict).toEqual({ state: "broken", headline: "Your product data has a typo, so Google can't read it" });
    expect(pasted.found).toBe("We read what you pasted as JSON-LD, because it starts with { or [.");
    expect(problem(pasted, "invalid")?.text).toBe("The JSON-LD you pasted has a typo, so Google can't read it.");
    expect(checkSchema("{}").found).toBe("The JSON-LD you pasted doesn't describe a product.");
  });

  it("says a microdata page has data this tool doesn't read, not that it has none", () => {
    const r = checkSchema(fixture("microdata.html"), { source: "page" });
    expect(r.verdict).toEqual({ state: "unread", headline: "This page uses microdata, which this tool doesn't read" });
  });

  it("skips related products listed on a product page: no listing verdict, no borrowed facts or ratings", () => {
    const related = { "@type": "ItemList", itemListElement: [1, 2, 3].map((i) => ({ "@type": "ListItem", position: i, item: item(`Comb ${i}`, `${i}0.00`, { material: "Wood", aggregateRating: { ratingValue: "5", reviewCount: "9" } }) })) };
    const r = checkSchema(block({ "@type": "ProductGroup", name: "Oil", hasVariant: [item("Oil - S", "5.00")] }) + block(related), { source: "page", url: "https://shop.example/products/oil" });
    expect(r.listing).toBe(false);
    expect(r.verdict.state).toBe("ready");
    expect(r.notes).toEqual(["We also found 3 products in a list on the page, like related products, so we skip them."]);
    expect(field(r, "material").status).toBe("missing");
    expect(field(r, "reviews").status).toBe("none");
    expect(problem(r, "disagree")).toBeUndefined();
  });

  it("compares prices only in the same currency", () => {
    const r = checkSchema(block(item("Oil", "10.00")) + block({ ...item("Oil", "15.00"), offers: { price: "15.00", priceCurrency: "AUD" } }));
    expect(problem(r, "disagree")?.text).toBe(
      "Your page has 2 product data blocks that disagree on the currency (USD vs AUD). Usually one comes from your theme and one from an app. Keep one.",
    );
  });

  it("calls a missing certification None, never Missing", () => {
    expect(field(checkSchema(SAMPLE_JSON), "certification").status).toBe("none");
  });

  it("never points to a code box that isn't there", () => {
    for (const f of Object.values(copy.FIELDS)) expect(f.fix ?? "").not.toMatch(/see below/i);
  });
});

// Google's product variants guide (updated 8 Sep 2026), multi-page sites: "The ProductGroup on each page has a
// full definition of the variants on the page as well as a variant with only the url property to link to the
// variants on the other page, which helps Google find your variants."
describe("variants on other pages (Google's multi-page pattern)", () => {
  const required = ["name", "variantName", "image", "offers", "price", "currency"];
  const group = (variants: unknown[], extra: Record<string, unknown> = {}) => JSON.stringify({ "@type": "ProductGroup", name: "Oil", productGroupID: "OIL", hasVariant: variants, ...extra });
  const full = (name: string, url: string, extra: Record<string, unknown> = {}) => ({
    "@type": "Product",
    name,
    sku: name,
    image: "a.jpg",
    offers: { "@type": "Offer", price: "10.00", priceCurrency: "USD", url },
    ...extra,
  });

  it("reads Allbirds' real page (observed): 7 variants on the page plus 42 linked ones, ready, and only the barcode note", () => {
    const r = checkSchema(fixture("allbirds-tree-runners.html"), { source: "page", record: ALLBIRDS_RECORD(), url: ALLBIRDS_URL });
    expect(r.kind).toBe("ProductGroup");
    expect(r.units).toBe(7);
    expect(r.linked).toBe(42);
    expect(r.found).toBe("Found a ProductGroup with 7 variants in the page's HTML, plus 42 linked variants on other pages.");
    expect(r.notes[0]).toBe(
      "The 42 linked variants only give the link to their own page, like another colour. That's how Google suggests doing it, so we check the 7 variants on this page.",
    );
    for (const id of required) expect(field(r, id).status, id).toBe("found");
    expect(field(r, "price").value).toBe("100 USD");
    expect(r.verdict).toEqual({ state: "ready", headline: "Ready for Google's product results: all required facts found" });
    // The one real finding: the store has barcodes the product data leaves out.
    expect(r.problems.map((p) => p.id)).toEqual(["record-barcodes"]);
    expect(problem(r, "record-barcodes")?.text).toBe(
      "Your store has a barcode on 7 of 7 variants, but the product data includes none. Your theme may leave barcodes out of its product data.",
    );
    expect(field(r, "gtin")).toMatchObject({ status: "missing", found: 0, of: 7 });
    expect(field(r, "sku")).toMatchObject({ status: "found", found: 7, of: 7 });
    expect(field(r, "availability")).toMatchObject({ status: "found", value: "In stock, Out of stock" });
    expect(field(r, "brand").value).toBe("Allbirds");
    expect(field(r, "variesBy").value).toBe("Size, Color");
    // No row counts the linked variants.
    expect(r.fields.filter((f) => f.of !== undefined).every((f) => f.of === 7)).toBe(true);
  });

  it("reads Google's own multi-page examples: nested links with no @type, and separate Products that point to the group", () => {
    const nested = checkSchema(fixture("google-multipage-nested.html"));
    expect([nested.units, nested.linked]).toEqual([2, 1]);
    expect(nested.found).toBe("Found a ProductGroup with 2 variants in the HTML you pasted, plus 1 linked variant on other pages.");
    expect(nested.notes[0]).toBe(
      "The linked variant only gives the link to its own page, like another colour. That's how Google suggests doing it, so we check the 2 variants on this page.",
    );
    expect(nested.verdict.state).toBe("ready");
    expect(field(nested, "brand").value).toBe("Good brand"); // stated once, on the group
    const separate = checkSchema(fixture("google-multipage-separate.html"));
    expect([separate.units, separate.linked]).toEqual([1, 2]);
    expect(separate.found).toBe("Found a ProductGroup with 1 variant in the HTML you pasted, plus 2 linked variants on other pages.");
    expect(separate.verdict.state).toBe("ready");
    expect(separate.notes).toEqual([
      "The 2 linked variants only give the link to their own page, like another colour. That's how Google suggests doing it, so we check the 1 variant on this page.",
      "We also found OfferShippingDetails and MerchantReturnPolicy data. It isn't product data, so we skip it.",
    ]);
  });

  it("still checks a bare variant that links back to this same page: it's a variant here with facts missing", () => {
    const page = "https://shop.example/products/oil";
    const r = checkSchema(group([full("Oil - S", "/products/oil?variant=1"), { "@type": "Product", name: "Oil - L", sku: "L", url: "/products/oil?variant=2" }]), { url: page });
    expect([r.units, r.linked]).toEqual([2, 0]);
    expect(field(r, "offers")).toMatchObject({ status: "partial", found: 1, of: 2 });
    expect(r.verdict.state).toBe("missing");
    // The page we read is this page too, even when no variant on it has a link.
    const bare = checkSchema(group([{ "@type": "Product", url: "https://shop.example/products/oil?variant=1" }]), { url: page });
    expect([bare.units, bare.linked]).toEqual([1, 0]);
    expect(bare.verdict.state).toBe("missing");
  });

  it("never treats a variant with an image, an offer or other facts as a link", () => {
    const r = checkSchema(group([full("Oil - S", "/products/oil?v=1"), { "@type": "Product", url: "/products/oil-blue", image: "b.jpg" }, { "@type": "Product", url: "/products/oil-red", color: "Red" }]));
    expect([r.units, r.linked]).toEqual([3, 0]);
    expect(field(r, "offers")).toMatchObject({ status: "partial", found: 1, of: 3 });
  });

  it("says so when a group only links to variants on other pages", () => {
    const r = checkSchema(group([{ "@type": "Product", url: "/products/oil-blue" }, { url: "/products/oil-red" }, { "@type": "Product", url: "/products/oil-green" }]));
    expect([r.units, r.linked]).toEqual([0, 3]);
    expect(r.found).toBe("Found a ProductGroup in the JSON-LD you pasted with no variants of its own, only 3 links to variants on other pages.");
    expect(r.notes[0]).toBe("Google asks each page to fully describe the variants it sells: a name, image, price and currency for each.");
    expect(r.verdict.state).toBe("missing");
  });

  it("keeps a variant with an offer but no name as a variant, with its name missing", () => {
    const r = checkSchema(group([full("Oil - S", "/p?v=1"), { ...full("x", "/p?v=2"), name: undefined }]));
    expect([r.units, r.linked]).toEqual([2, 0]);
    expect(field(r, "variantName")).toMatchObject({ status: "partial", found: 1, of: 2 });
  });

  it("doesn't count the group's own offer for its variants (Google reads offers on each variant)", () => {
    const r = checkSchema(group([{ "@type": "Product", name: "Oil - S", sku: "S", image: "a.jpg" }], { offers: { "@type": "Offer", price: "10.00", priceCurrency: "USD" } }));
    expect(field(r, "offers")).toMatchObject({ status: "missing", found: 0, of: 1 });
    expect(r.verdict.state).toBe("missing");
  });

  it("needs each offer's own price: a price range (lowPrice) alone isn't enough for store results", () => {
    const range = JSON.stringify({ "@type": "Product", name: "Oil", image: "a.jpg", offers: { "@type": "AggregateOffer", lowPrice: "20.00", highPrice: "30.00", priceCurrency: "USD" } });
    const r = checkSchema(range);
    expect(field(r, "price").status).toBe("missing");
    expect(field(r, "currency").status).toBe("found");
    expect(problem(r, "price-range")).toEqual({
      id: "price-range",
      tone: "bad",
      text: 'Your product data gives a price range ("from 20.00") instead of a price. For product results on store pages, Google needs each offer to have its own price.',
    });
    expect(r.verdict.headline).toBe("Missing 1 fact Google needs");
    // An AggregateOffer that also states a price, and a price in priceSpecification, are fine.
    const both = JSON.stringify({ "@type": "Product", name: "Oil", image: "a.jpg", offers: { "@type": "AggregateOffer", price: "20.00", lowPrice: "20.00", priceCurrency: "USD" } });
    expect(checkSchema(both).verdict.state).toBe("ready");
    expect(checkSchema(fixture("type-array.html")).verdict.state).toBe("ready");
  });
});

// ---------- Shopify's product record ----------

describe("parseShopifyRecord", () => {
  it("turns cents into units and reads stock and barcodes (observed Horizon record)", () => {
    const rec = HORIZON_RECORD();
    expect(rec.variants).toBe(24);
    expect(new Set(rec.prices)).toEqual(new Set([145]));
    expect(rec.available).toBe(true);
    expect(rec.barcodes).toBe(24);
    expect(checkSchema(fixture("shopify-horizon.html"), { source: "page", record: rec }).problems).toEqual([]);
  });

  it("reads variants' availability when the top-level flag is missing, and decimal strings as units", () => {
    expect(parseShopifyRecord({ variants: [{ price: 2400, available: false }, { price: "34.00", available: true }] })).toEqual({
      prices: [24, 34],
      available: true,
      variants: 2,
      barcodes: null,
    });
    expect(parseShopifyRecord({ price: 1999, available: false })).toEqual({ prices: [19.99], available: false, variants: 0, barcodes: null });
  });

  it("doesn't crash on missing or odd fields", () => {
    for (const bad of [null, undefined, "x", 3, [], {}, { variants: "x" }, { variants: [null, 1, "a"] }, { price: "free" }]) {
      expect(() => parseShopifyRecord(bad)).not.toThrow();
    }
    expect(parseShopifyRecord({})).toBeNull();
    expect(parseShopifyRecord({ variants: [{ price: 100, barcode: "" }, { price: 100, barcode: "123" }] })?.barcodes).toBe(1);
  });
});

describe("comparing with the store's record", () => {
  const sample = (record: NonNullable<ReturnType<typeof parseShopifyRecord>>) => checkSchema(SAMPLE_JSON, { record });

  it("raises a price the store doesn't have", () => {
    const r = sample({ prices: [26, 34], available: true, variants: 2, barcodes: null });
    expect(problem(r, "record-price")?.text).toBe(
      "Your product data says 24.00 USD, but your store's product record says 26.00 to 34.00 USD. Your store's record is the price shoppers pay, so check which theme code or app writes the product data.",
    );
    // Within a cent is the same price; a theme showing one variant's price is fine.
    expect(problem(sample({ prices: [24.004, 34], available: true, variants: 2, barcodes: null }), "record-price")).toBeUndefined();
  });

  it("raises stock that disagrees, both ways", () => {
    expect(problem(sample({ prices: [24, 34], available: false, variants: 2, barcodes: null }), "record-stock")?.text).toBe(copy.PROBLEM.recordInStock);
    const out = checkSchema(fixture("type-url.html"), { record: { prices: [20], available: true, variants: 1, barcodes: null } });
    expect(problem(out, "record-stock")?.text).toBe(copy.PROBLEM.recordOutOfStock);
  });

  it("notes barcodes the store has but the data leaves out, only when the record has the field", () => {
    const r = sample({ prices: [24, 34], available: true, variants: 2, barcodes: 2 });
    expect(problem(r, "record-barcodes")).toEqual({
      id: "record-barcodes",
      tone: "warn",
      text: "Your store has a barcode on 2 of 2 variants, but the product data includes 1. Your theme may leave barcodes out of its product data.",
    });
    expect(problem(sample({ prices: [24, 34], available: true, variants: 2, barcodes: null }), "record-barcodes")).toBeUndefined();
  });

  it("skips the price check when the data has more than one currency", () => {
    const two = JSON.stringify({
      "@type": "Product",
      name: "X",
      image: "a.jpg",
      offers: [
        { price: "10.00", priceCurrency: "USD" },
        { price: "15.00", priceCurrency: "AUD" },
      ],
    });
    expect(problem(checkSchema(two, { record: { prices: [99], available: null, variants: 1, barcodes: null } }), "record-price")).toBeUndefined();
  });
});

// ---------- bounds ----------

describe("bounded parsing", () => {
  it("reads a 2 MB page of junk in under 200 ms", () => {
    const junk = "<div itemtype=x><script>".repeat(40_000) + "<".repeat(1_000_000);
    expect(junk.length).toBeGreaterThan(1_900_000);
    const t = performance.now();
    const r = checkSchema(junk.slice(0, 2_000_000), { source: "page" });
    expect(performance.now() - t).toBeLessThan(200);
    expect(r.kind).toBeNull();
  });

  it("survives deep nesting and huge graphs without throwing", () => {
    let deep = '{"@type":"Product","name":"Deep","image":"a.jpg","offers":{"price":"1","priceCurrency":"USD"},"brand":';
    for (let i = 0; i < 5_000; i++) deep += '{"name":';
    deep += '"x"' + "}".repeat(5_000) + "}";
    expect(() => checkSchema(deep)).not.toThrow();
    const graph = JSON.stringify({ "@graph": Array.from({ length: 5_000 }, (_, i) => ({ "@type": "Thing", name: `t${i}` })) });
    const t = performance.now();
    expect(checkSchema(graph).kind).toBeNull();
    expect(performance.now() - t).toBeLessThan(200);
  });

  it("refuses JSON-LD nested absurdly deep without spending time parsing it", () => {
    const deep = `<script type="application/ld+json">{"@type":"Product","x":${"[".repeat(900_000)}${"]".repeat(900_000)}}</script>`;
    const t = performance.now();
    const r = checkSchema(deep, { source: "page" });
    expect(performance.now() - t).toBeLessThan(200);
    expect(problem(r, "invalid")?.tone).toBe("bad");
    // A product node with 100,000 keys is read without copying it.
    const wide = `<script type="application/ld+json">{"@type":"Product","name":"A","image":"a","offers":{"price":"1","priceCurrency":"USD"},${Array.from({ length: 100_000 }, (_, i) => `"k${i}":1`).join(",")}}</script>`;
    const t2 = performance.now();
    expect(checkSchema(wide, { source: "page" }).verdict.state).toBe("ready");
    expect(performance.now() - t2).toBeLessThan(400);
  });

  it("reads at most 20 JSON-LD blocks", () => {
    const block = '<script type="application/ld+json">{"@type":"Thing"}</script>';
    expect(extractNodes(block.repeat(50)).jsonLd).toBe(20);
  });
});

// ---------- the link check (live fetches faked) ----------

type Answer = { status: number; url: string; text: string };
const fetchMock = vi.mocked(safeFetch);

/** Fake the product page and Shopify's record (any address ending in .js). */
function fakeStore(page: Answer | Error, record: Answer | Error | null = null) {
  fetchMock.mockImplementation(async (url: string) => {
    const answer = url.endsWith(".js") ? (record ?? { status: 404, url, text: "" }) : page;
    if (answer instanceof Error) throw answer;
    return answer;
  });
}

const PAGE_URL = "https://shop.example/products/cedar-beard-oil";
const samplePage = `<!doctype html><html><head><script type="application/ld+json">${SAMPLE_JSON}</script></head><body></body></html>`;

describe("checkProductUrl", () => {
  beforeEach(() => {
    clearSchemaCache();
    fetchMock.mockReset();
  });

  it("reads the page and Shopify's record in parallel, and compares them", async () => {
    fakeStore({ status: 200, url: PAGE_URL, text: samplePage }, { status: 200, url: `${PAGE_URL}.js`, text: JSON.stringify({ variants: [{ price: 2400, available: true }, { price: 3600, available: true }] }) });
    const out = await checkProductUrl(PAGE_URL);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(fetchMock.mock.calls.map((c) => c[0]).sort()).toEqual([PAGE_URL, `${PAGE_URL}.js`]);
    expect(out.check.url).toBe(PAGE_URL);
    expect(out.check.record).toBe(true);
    expect(out.check.report.source).toBe("page");
    expect(out.check.report.found).toBe("Found a ProductGroup with 2 variants in the page's HTML.");
    expect(problem(out.check.report, "record-price")?.text).toContain("Your product data says 34.00 USD, but your store's product record says 24.00 to 36.00 USD.");
  });

  it("skips the record for links that aren't /products/ pages, and when it isn't JSON", async () => {
    fakeStore({ status: 200, url: "https://shop.example/shop/oil", text: samplePage });
    const out = await checkProductUrl("https://shop.example/shop/oil");
    expect(out.ok && out.check.record).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    clearSchemaCache();
    fakeStore({ status: 200, url: PAGE_URL, text: samplePage }, { status: 200, url: `${PAGE_URL}.js`, text: "<!doctype html><html>" });
    const html = await checkProductUrl(PAGE_URL);
    expect(html.ok && html.check.record).toBe(false);
  });

  it("says we couldn't find a page that answers 404, and uses the shared copy otherwise", async () => {
    fakeStore({ status: 404, url: PAGE_URL, text: "Not found" });
    expect(await checkProductUrl(PAGE_URL)).toEqual({ ok: false, status: 400, error: "We couldn't find that page. Check the link and try again." });
    clearSchemaCache();
    fakeStore({ status: 403, url: PAGE_URL, text: "Forbidden" });
    expect(await checkProductUrl(PAGE_URL)).toEqual({ ok: false, status: 502, error: OUTCOME_COPY["turned-away"].replace("{status}", "403") });
    clearSchemaCache();
    fakeStore(new Error("getaddrinfo ENOTFOUND shop.example"));
    const gone = await checkProductUrl(PAGE_URL);
    expect(gone).toEqual({ ok: false, status: 502, error: OUTCOME_COPY.unreachable });
    expect(JSON.stringify(gone)).not.toContain("ENOTFOUND");
  });

  it("says a password-protected store can't be read, instead of 'no product data'", async () => {
    fakeStore({ status: 200, url: "https://shop.example/password", text: "<!doctype html><html><title>Opening soon</title></html>" });
    expect(await checkProductUrl(PAGE_URL)).toEqual({ ok: false, status: 400, error: copy.URL_COPY.password });
  });

  it("uses the shared copy for server errors, rate limits and timeouts, never the raw error", async () => {
    fakeStore({ status: 500, url: PAGE_URL, text: "boom" });
    expect(await checkProductUrl(PAGE_URL)).toEqual({ ok: false, status: 502, error: OUTCOME_COPY["server-error"].replace("{status}", "500") });
    clearSchemaCache();
    fakeStore({ status: 429, url: PAGE_URL, text: "slow down" });
    expect(await checkProductUrl(PAGE_URL)).toEqual({ ok: false, status: 502, error: OUTCOME_COPY["turned-away"].replace("{status}", "429") });
    clearSchemaCache();
    fakeStore(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }));
    const late = await checkProductUrl(PAGE_URL);
    expect(late).toEqual({ ok: false, status: 502, error: OUTCOME_COPY.unreachable });
    expect(JSON.stringify(late)).not.toMatch(/aborted|timeout/i);
  });

  it("still checks the page when the store's record fails or is junk", async () => {
    fakeStore({ status: 200, url: PAGE_URL, text: samplePage }, new Error("socket hang up"));
    const a = await checkProductUrl(PAGE_URL);
    expect(a.ok && a.check.record).toBe(false);
    clearSchemaCache();
    fakeStore({ status: 200, url: PAGE_URL, text: samplePage }, { status: 200, url: `${PAGE_URL}.js`, text: '{"price": "free", "variants": "x"' });
    const b = await checkProductUrl(PAGE_URL);
    expect(b.ok && b.check.report.verdict.state).toBe("ready");
  });

  it("answers a double submit from its one-minute cache", async () => {
    fakeStore({ status: 200, url: PAGE_URL, text: samplePage });
    await checkProductUrl(PAGE_URL);
    await checkProductUrl(PAGE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(2); // the page and the record, once
  });
});

// ---------- the action ----------

function post(fields: Record<string, string>, headers: Record<string, string> = {}, body?: string) {
  const request = new Request("https://usegeo.app/tools/product-schema-checker", {
    method: "POST",
    body: body ?? new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded", "x-real-ip": "203.0.113.9", ...headers },
  });
  return route.action({ request, params: {}, context: {} } as unknown as ActionFunctionArgs) as unknown as Promise<{
    data: { ok: boolean; error?: string; intent: string; check?: any; text?: string | null };
    init: ResponseInit | null;
  }>;
}
const headersOf = (r: { init: ResponseInit | null }) => new Headers(r.init?.headers);

describe("the action", () => {
  beforeEach(() => {
    clearSchemaCache();
    resetToolLimits();
    fetchMock.mockReset();
  });
  afterEach(() => resetToolLimits());

  it("checks a product link, with no-store and noindex headers", async () => {
    fakeStore({ status: 200, url: PAGE_URL, text: samplePage });
    const res = await post({ intent: "fetch", url: "Shop.Example/products/cedar-beard-oil?utm_source=x" });
    expect(res.init?.status ?? 200).toBe(200);
    expect(res.data.ok).toBe(true);
    expect(res.data.check.report.verdict.state).toBe("ready");
    expect(fetchMock.mock.calls[0][0]).toBe(PAGE_URL);
    expect(headersOf(res).get("Cache-Control")).toBe("no-store");
    expect(headersOf(res).get("X-Robots-Tag")).toBe("noindex");
  });

  it("refuses a post from another site (403) and a body that's too big (413)", async () => {
    const cross = await post({ intent: "fetch", url: PAGE_URL }, { "sec-fetch-site": "cross-site" });
    expect(cross.init?.status).toBe(403);
    expect(cross.data.error).toBe(CROSS_SITE_COPY);
    const evil = await post({ intent: "fetch", url: PAGE_URL }, { origin: "https://evil.example" });
    expect(evil.init?.status).toBe(403);
    const big = await post({}, {}, `intent=paste&text=${"a".repeat(1_100_000)}`);
    expect(big.init?.status).toBe(413);
    expect(big.data.error).toBe(TOO_BIG_COPY);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives a filled-in honeypot the normal empty result, with no fetch", async () => {
    const res = await post({ intent: "fetch", url: PAGE_URL, website: "spam.example" });
    expect(res.data).toEqual({ ok: true, intent: "fetch", url: PAGE_URL, check: null });
    const paste = await post({ intent: "paste", text: "{}", website: "x" });
    expect(paste.data).toEqual({ ok: true, intent: "paste", text: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses bad input (400): empty, an IP address, a marketplace link, a very long paste", async () => {
    for (const [url, error] of [
      ["", "Please paste a product link, like https://yourstore.com/products/your-product."],
      ["10.0.0.1/products/x", "Please paste a product link, like https://yourstore.com/products/your-product."],
      ["http://localhost/products/x", "Please paste a product link, like https://yourstore.com/products/your-product."],
      ["https://www.amazon.com/dp/B000000000", "That link is on a marketplace or big retailer. This tool checks your own store's product pages."],
    ] as const) {
      const res = await post({ intent: "fetch", url });
      expect(res.init?.status, url).toBe(400);
      expect(res.data.error, url).toBe(error);
    }
    const long = await post({ intent: "paste", text: "a".repeat(300_001) });
    expect(long.init?.status).toBe(400);
    expect(long.data.error).toBe("That's a lot of text. Paste just the JSON-LD block, or up to 300,000 characters.");
    expect(long.data.text).toHaveLength(300_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says we couldn't find a page that answers 404 (400), and can't reach a broken address (502)", async () => {
    fakeStore({ status: 404, url: PAGE_URL, text: "" });
    const missing = await post({ intent: "fetch", url: PAGE_URL });
    expect(missing.init?.status).toBe(400);
    expect(missing.data.error).toBe(copy.URL_COPY.missing);
    clearSchemaCache();
    fakeStore(new Error("connect ECONNREFUSED"));
    const down = await post({ intent: "fetch", url: PAGE_URL });
    expect(down.init?.status).toBe(502);
    expect(down.data.error).toBe(OUTCOME_COPY.unreachable);
  });

  it("limits link checks to 20 an hour per visitor (429)", async () => {
    fakeStore({ status: 404, url: PAGE_URL, text: "" });
    for (let i = 0; i < 20; i++) expect((await post({ intent: "fetch", url: `shop${i}.example/products/x` })).init?.status).toBe(400);
    const over = await post({ intent: "fetch", url: "shop99.example/products/x" });
    expect(over.init?.status).toBe(429);
    expect(over.data.error).toBe(HOUR_COPY);
    // Another visitor still gets through.
    expect((await post({ intent: "fetch", url: "shop99.example/products/x" }, { "x-real-ip": "198.51.100.7" })).init?.status).toBe(400);
  });

  it("refuses an empty no-JavaScript paste (400) with a plain message", async () => {
    const res = await post({ intent: "paste", text: "  \n " });
    expect(res.init?.status).toBe(400);
    expect(res.data.error).toBe(copy.PASTE_EMPTY);
    const page = renderPage(res.data);
    expect(page).toContain('role="alert"');
    expect(text(page)).toContain(copy.PASTE_EMPTY);
    expect(text(page)).not.toContain("No product data found");
  });

  it("answers a no-JavaScript paste with the text, so the page can show its result", async () => {
    const res = await post({ intent: "paste", text: '{"@type":"Product","name":"X"}' });
    expect(res.data).toEqual({ ok: true, intent: "paste", text: '{"@type":"Product","name":"X"}' });
    expect(headersOf(res).get("X-Robots-Tag")).toBe("noindex");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------- the page ----------

const callMeta = () => (route.meta as unknown as (a: unknown) => MetaDescriptor[])({ params: {}, location: {}, matches: [], data: undefined, error: undefined });

describe("the page head", () => {
  const list = callMeta();
  const find = (k: string, v: string) => list.find((m) => (m as Record<string, unknown>)[k] === v) as Record<string, string> | undefined;

  it("has the registry title and description, one canonical, Open Graph and Twitter tags, no robots meta", () => {
    expect(list.filter((m) => "title" in m)).toEqual([{ title: "Product Schema Checker: What Google and AI Can Read | GEO" }]);
    expect(TOOL.title.length).toBeLessThan(60);
    expect(find("name", "description")?.content).toBe(TOOL.description);
    expect(TOOL.description.length).toBeLessThan(155);
    const canonicals = list.filter((m) => (m as { rel?: string }).rel === "canonical") as { href: string }[];
    expect(canonicals.map((c) => c.href)).toEqual(["https://usegeo.app/tools/product-schema-checker"]);
    expect(find("property", "og:url")?.content).toBe("https://usegeo.app/tools/product-schema-checker");
    expect(find("property", "og:image")?.content).toBe("https://usegeo.app/og/product-schema-checker.png");
    expect(find("property", "og:image:width")?.content).toBe("1200");
    expect(find("property", "og:image:height")?.content).toBe("630");
    expect(find("name", "twitter:card")?.content).toBe("summary_large_image");
    expect(find("name", "robots")).toBeUndefined();
  });

  it("has one JSON-LD graph with the app (free, no ratings), the page, breadcrumbs, the company and the same FAQs", () => {
    const ld = (list.find((m) => "script:ld+json" in m) as Record<string, unknown>)["script:ld+json"] as { "@graph": Record<string, any>[] };
    expect(ld).toEqual(toolJsonLd(TOOL, copy.FAQS));
    const json = JSON.stringify(ld);
    expect(JSON.parse(json)).toBeTruthy();
    expect(json.length).toBeLessThan(8_000);
    expect(json).not.toMatch(/aggregateRating|"review"/);
    const byType = (t: string) => ld["@graph"].find((n) => n["@type"] === t)!;
    expect(byType("WebApplication").offers.price).toBe("0");
    expect(byType("WebPage").dateModified).toBe(TOOL.updated);
    expect(byType("BreadcrumbList").itemListElement).toHaveLength(3);
    expect(byType("Organization").name).toBe("GEO");
    expect(byType("FAQPage").mainEntity.map((q: any) => [q.name, q.acceptedAnswer.text])).toEqual(copy.FAQS.map((f) => [f.q, f.a]));
  });

  it("links its own stylesheet and uses the shared headers", () => {
    expect(route.links()).toHaveLength(1);
    expect(route.headers).toBe(toolHeaders);
  });
});

function renderPage(actionData?: unknown) {
  const Stub = createRoutesStub([
    {
      id: "tools",
      path: "/tools",
      Component: layout.default as ComponentType,
      children: [{ id: "schema", path: "product-schema-checker", Component: route.default as ComponentType, action: () => null }],
    },
  ]);
  return renderToStaticMarkup(
    createElement(Stub, {
      initialEntries: ["/tools/product-schema-checker"],
      ...(actionData ? { hydrationData: { loaderData: {}, actionData: { schema: actionData } } } : {}),
    }),
  );
}

/** The HTML between the FAQ heading and the next section. */
const faqSection = (out: string) => out.slice(out.indexOf('id="faq"'), out.indexOf('id="more-tools"'));

describe("the page (server render, no JavaScript)", () => {
  const out = renderPage();
  const plain = text(out);

  it("has one H1 with the search term, the intro, the link form and the trust line", () => {
    expect(out.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(out).toContain('<h1 class="ck-h1">Product Schema Checker</h1>');
    expect(plain).toContain(copy.INTRO);
    expect(plain.match(/The Product Schema Checker is a free tool/g)).toHaveLength(1);
    expect(out).toMatch(/<form[^>]*method="post"[^>]*class="tl-form"/);
    expect(out).toContain('name="url"');
    expect(out).toContain('inputMode="url"');
    expect(out).toContain('placeholder="yourstore.com/products/..."');
    expect(out).toContain('name="website"'); // the honeypot
    expect(plain).toContain("Check product");
    expect(plain).toContain("Free · No sign-up · Results in seconds");
  });

  it("shows the labelled made-up sample in the paste box, with its result and field cards", () => {
    expect(out).toContain(`<span class="ck-chip is-grey">Example</span><span>${copy.SAMPLE_LABEL.replace(/'/g, "&#x27;")}</span>`);
    expect(out).toContain('name="text"');
    expect(out).toContain('value="paste"');
    expect(plain).toContain("Example Grooming Co");
    expect(plain).toContain(copy.FORM.pasteLabel);
    expect(plain).toContain("Ready for Google's product results: all required facts found");
    expect(plain).toContain("Found a ProductGroup with 2 variants in the JSON-LD you pasted.");
    for (const g of copy.GROUPS) expect(plain).toContain(g.heading);
    expect(plain).toContain("Barcode (GTIN) gtinSome variants only (1 of 2)");
    expect(plain).toContain("Shipping offers.shippingDetailsNot on this page");
    expect(plain).toContain("Returns offers.hasMerchantReturnPolicyNot on this page");
    expect(plain).toContain("None in the product data.");
    expect(plain).toContain(copy.FIELDS.reviews.why);
    expect(plain).toContain(`Where to fix it in Shopify: ${copy.FIELDS.gtin.fix}`);
    expect(plain).toContain(copy.FIX.admin);
    expect(out).toContain("<details");
    expect(plain).toContain("Show the product data we found");
  });

  it("has exactly one button under the result, with the spec's words and link", () => {
    expect(out.match(/tl-cta"/g)).toHaveLength(1);
    expect(out).toMatch(/<a class="ck-btn ck-btn-dark tl-cta" href="\/\?ref=tool-product-schema-checker#how">See how GEO fixes your product pages for AI/);
    expect(out.indexOf('id="result"')).toBeLessThan(out.indexOf("tl-cta-card"));
    expect(out.indexOf("tl-cta-card")).toBeLessThan(out.indexOf('id="what-it-checks"'));
  });

  it("has what it checks, how it works, visible FAQs, more tools, the date and the footer", () => {
    expect(plain).toContain("What this tool checks");
    for (const item of copy.WHAT_IT_CHECKS) expect(plain).toContain(item);
    expect(plain).toContain("How this tool works");
    for (const item of copy.HOW_IT_WORKS) expect(plain).toContain(item.text);
    expect(plain).toContain("Maintained by GEO. Updated 11 October 2026.");
    for (const f of copy.FAQS) {
      expect(out).toContain(`<h3 class="ck-h3">${f.q.replace(/'/g, "&#x27;")}</h3>`);
      expect(plain).toContain(f.a);
    }
    expect(faqSection(out)).not.toMatch(/<details|\shidden[\s>=]/);
    for (const s of TOOL.related) expect(out).toContain(`<a href="${toolBySlug(s).path}">${toolBySlug(s).name}</a>`);
    expect(plain).toContain("Updated 11 October 2026 · Made by GEO");
    expect(out).toContain('class="tl-foot"');
    expect(out).toContain('href="/tools"');
    for (const t of TOOLS) expect(out).toContain(`href="${t.path}"`);
  });

  it("shows a no-JavaScript paste result in place of the sample", () => {
    const pasted = fixture("price-symbol.html");
    const page = text(renderPage({ ok: true, intent: "paste", text: pasted }));
    expect(page).not.toContain(copy.SAMPLE_LABEL);
    expect(page).toContain("Moustache Wax");
    expect(page).toContain("Missing 1 fact Google needs");
    expect(page).toContain("Found a Product in the HTML you pasted.");
    expect(page).toContain('The price is written as "$24.00".');
    expect(page).toContain("Can't be read");
  });

  it("shows the code fix when a page has no product data, and a paste error without a result", () => {
    const none = text(renderPage({ ok: true, intent: "paste", text: fixture("none.html") }));
    expect(none).toContain("No product data found on this page");
    expect(none).toContain('<script type="application/ld+json">{{ product | structured_data }}</script>');
    expect(none).toContain("sections/main-product.liquid");
    // A block with a typo, or microdata: adding Shopify's line would make two blocks, so no code box.
    for (const [name, headline] of [
      ["invalid-only", copy.VERDICT.broken],
      ["microdata.html", copy.VERDICT.microdata],
    ] as const) {
      const pasted = name === "invalid-only" ? '<script type="application/ld+json">{"@type":"Product","name":"X",}</script>' : fixture(name);
      const shown = text(renderPage({ ok: true, intent: "paste", text: pasted }));
      expect(shown, name).toContain(headline);
      expect(shown, name).not.toContain("structured_data }}");
    }
    const long = renderPage({ ok: false, intent: "paste", text: "x", error: copy.PASTE_TOO_LONG });
    expect(long).toContain('role="alert"');
    expect(text(long)).toContain(copy.PASTE_TOO_LONG);
    expect(text(long)).not.toContain("No product data found");
  });

  it("shows Allbirds' linked variants in plain words, and never 'Some variants only (7 of 49)'", async () => {
    clearSchemaCache();
    fetchMock.mockReset();
    fakeStore({ status: 200, url: ALLBIRDS_URL, text: fixture("allbirds-tree-runners.html") }, { status: 200, url: `${ALLBIRDS_URL}.js`, text: fixture("allbirds-tree-runners-record.json") });
    const checked = await checkProductUrl(ALLBIRDS_URL);
    expect(checked.ok && checked.check.record).toBe(true);
    const page = text(renderPage({ ok: true, intent: "fetch", url: "allbirds.com/products/mens-tree-runners", check: checked.ok ? checked.check : null }));
    expect(page).toContain("Ready for Google's product results: all required facts found");
    expect(page).toContain("Found a ProductGroup with 7 variants in the page's HTML, plus 42 linked variants on other pages.");
    expect(page).toContain("That's how Google suggests doing it, so we check the 7 variants on this page.");
    expect(page).toContain("Variant names hasVariant[].nameFound");
    expect(page).toContain("Barcode (GTIN) gtinMissing");
    expect(page).toContain("Your store has a barcode on 7 of 7 variants, but the product data includes none.");
    expect(page).not.toMatch(/of 49\)|Missing \d+ facts?/);
  });

  it("shows a link result with what we read, two blocks side by side, and errors next to the form", async () => {
    clearSchemaCache();
    fetchMock.mockReset();
    fakeStore({ status: 200, url: PAGE_URL, text: fixture("two-blocks-disagree.html") }, { status: 200, url: `${PAGE_URL}.js`, text: JSON.stringify({ price: 2400, available: true }) });
    const out1 = await checkProductUrl(PAGE_URL);
    const html = renderPage({ ok: true, intent: "fetch", url: "shop.example/products/cedar-beard-oil", check: out1.ok ? out1.check : null });
    const page = text(html);
    expect(page).toContain(`We read ${PAGE_URL} and your store's own product record.`);
    expect(page).toContain("Found a ProductGroup with 2 variants in the page's HTML.");
    expect(page).toContain("disagree on the price (24.00 to 34.00 USD vs 26.00 USD)");
    expect(html).toContain("<table>");
    expect(page).toContain("Block 1");
    expect(page).toContain("Block 2");
    expect(page).not.toContain(copy.SAMPLE_LABEL);
    expect(page).toContain(copy.FORM.back);

    const bad = renderPage({ ok: false, intent: "fetch", url: "amazon.com/dp/x", error: copy.URL_COPY.marketplace });
    expect(bad).toContain('role="alert"');
    expect(text(bad)).toContain(copy.URL_COPY.marketplace);
    expect(bad).toContain('value="amazon.com/dp/x"');
  });
});

// ---------- copy rules ----------

describe("copy rules", () => {
  const files = [
    "app/lib/tools/copy/product-schema-checker.ts",
    "app/lib/tools/schema.ts",
    "app/lib/tools/schema.server.ts",
    "app/lib/tools/samples/schema-sample.ts",
    "app/components/tools/schema-result.tsx",
    "app/routes/tools.product-schema-checker.tsx",
    "app/styles/tool-schema.css",
  ];

  it("has 4 to 6 FAQs, each with a source except our own advice", () => {
    expect(copy.FAQS.length).toBeGreaterThanOrEqual(4);
    expect(copy.FAQS.length).toBeLessThanOrEqual(6);
    expect(copy.FAQS.filter((f) => !f.sources?.length).map((f) => f.q)).toEqual(["Why does my page have two product blocks?"]);
  });

  it("has no em dash, no spaced en dash and no jargon", () => {
    for (const f of files) {
      const src = read(f);
      expect(src, f).not.toMatch(/\u2014/);
      expect(src, f).not.toMatch(/\s\u2013\s/);
      expect(src, f).not.toMatch(/AEO| LLM|generative engine optimization/i);
    }
    for (const page of [renderPage(), renderPage({ ok: true, intent: "paste", text: fixture("two-blocks-disagree.html") })]) {
      const shown = text(page);
      expect(shown).not.toMatch(/\u2014|\s\u2013\s/);
      expect(shown).not.toMatch(/\bAEO\b| LLM|generative engine optimization/);
      expect(shown.match(/\bGEO\b/g)?.length).toBeGreaterThan(0);
    }
  });

  it("never says schema gets anyone recommended or into rich results", () => {
    const all = JSON.stringify(copy);
    expect(all.match(/rich result/g)).toEqual(["rich result"]); // "Rich Results Test" is Google's tool's name
    expect(all).toContain("doesn't guarantee a rich result");
    expect(all).toContain("won't get you recommended on its own");
    expect(all).not.toMatch(/guarantees|will get you recommended|boost your ranking/i);
  });

  it("never calls missing reviews a problem", () => {
    const r = checkSchema(SAMPLE_JSON);
    expect(field(r, "reviews").status).toBe("none");
    expect(r.problems.some((p) => /review/i.test(p.text))).toBe(false);
  });
});
