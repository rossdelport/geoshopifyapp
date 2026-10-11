// The Product Schema Checker's on-load sample: the kind of product data a standard Shopify theme adds.
// MADE UP: the store, product, prices, SKUs and barcode are invented, and the page labels it as an example.
// The shape follows what Shopify's Horizon theme output on 11 Oct 2026 (docs/tools/research/facts-2026.md
// 2.4): a ProductGroup with brand, category, description and productGroupID, and one Product per variant with
// its own name, SKU, image and offer. Only the first variant has a barcode, so the sample shows a partial GTIN.
// The variant names use a plain hyphen because Shopify outputs "Title - Option"; that's data, not our copy.
// Pure and browser-safe: the page checks it on the server's render and again in the browser.

export const SAMPLE_PRODUCT = {
  "@context": "https://schema.org",
  "@type": "ProductGroup",
  "@id": "https://example-store.com/products/cedar-beard-oil#product",
  name: "Cedar Beard Oil",
  description: "Beard oil with jojoba and argan oil for dry skin under short to medium beards.",
  url: "https://example-store.com/products/cedar-beard-oil",
  brand: { "@type": "Brand", name: "Example Grooming Co" },
  category: "Beard Oil",
  productGroupID: "1000000001",
  hasVariant: [
    {
      "@type": "Product",
      "@id": "https://example-store.com/products/cedar-beard-oil?variant=1#variant",
      name: "Cedar Beard Oil - 30 ml",
      sku: "CBO-30",
      gtin: "0000000000017",
      image: "https://example-store.com/cdn/cedar-30.jpg",
      offers: {
        "@type": "Offer",
        price: "24.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://example-store.com/products/cedar-beard-oil?variant=1",
      },
    },
    {
      "@type": "Product",
      "@id": "https://example-store.com/products/cedar-beard-oil?variant=2#variant",
      name: "Cedar Beard Oil - 50 ml",
      sku: "CBO-50",
      image: "https://example-store.com/cdn/cedar-50.jpg",
      offers: {
        "@type": "Offer",
        price: "34.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: "https://example-store.com/products/cedar-beard-oil?variant=2",
      },
    },
  ],
};

/** The sample as it fills the paste box. */
export const SAMPLE_JSON = JSON.stringify(SAMPLE_PRODUCT, null, 2);
