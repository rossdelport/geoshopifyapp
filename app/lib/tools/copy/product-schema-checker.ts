// Copy for the Product Schema Checker (/tools/product-schema-checker). Final text from docs/tools/spec.md T3;
// every fact keeps its source comment, and the FAQ array feeds both the visible FAQ and the FAQPage JSON-LD,
// word for word. The checks themselves live in schema.ts, which builds its sentences from the helpers here.
// House rules: plain English, no em dashes, no invented numbers. Pure and browser-safe.

import type { FaqSource, ToolFaqItem } from "../../../components/tool-ui";
import { plural } from "../format";

// Primary sources (docs/tools/research/facts-2026.md section 2, all read 11 Oct 2026). The variants guide:
// "also follow the merchant listing required properties for each variant".
const GOOGLE_MERCHANT: FaqSource = {
  url: "https://developers.google.com/search/docs/appearance/structured-data/merchant-listing",
  label: "Google's merchant listing guide",
};
const GOOGLE_VARIANTS: FaqSource = {
  url: "https://developers.google.com/search/docs/appearance/structured-data/product-variants",
  label: "Google's product variants guide",
};
const GOOGLE_AI_GUIDE: FaqSource = {
  url: "https://developers.google.com/search/docs/fundamentals/ai-optimization-guide",
  label: "Google's AI features guide",
};
const GOOGLE_UPDATES: FaqSource = { url: "https://developers.google.com/search/updates", label: "Google Search Central updates" };
const OPENAI_SHOPPING: FaqSource = { url: "https://help.openai.com/en/articles/11128490-shopping-in-chatgpt", label: "OpenAI Help: shopping in ChatGPT" };
const SHOPIFY_FILTER: FaqSource = { url: "https://shopify.dev/docs/api/liquid/filters/structured_data", label: "Shopify's structured_data filter" };
const DAWN_PRODUCT: FaqSource = {
  url: "https://raw.githubusercontent.com/Shopify/dawn/main/sections/main-product.liquid",
  label: "Dawn's product section",
};

export const INTRO =
  "The Product Schema Checker is a free tool that reads the product structured data (JSON-LD) on a product page and shows which facts Google and AI shopping tools can read, what's missing, and where to fix it in Shopify.";

// ---------- the forms ----------

export const FORM = {
  urlLabel: "Product page link",
  urlPlaceholder: "yourstore.com/products/...",
  submit: "Check product",
  pasteLabel: "Or paste the product's JSON-LD or the page's HTML",
  pasteSubmit: "Check this product data",
  // Shown once JavaScript runs: the check then happens in the browser (privacy page, "Free tools").
  pasteLive: "The result updates as you paste or type, right in your browser. Code that starts with { or [ is read as JSON-LD, anything else as a page's HTML.",
  backLead: "Have the code instead?",
  back: "Paste product data",
} as const;

/** Next to the grey "Example" chip above the on-load sample (it is made up, and the page says so). */
export const SAMPLE_LABEL = "The kind of product data a standard Shopify theme adds (made-up product). Paste your own, or check a link above.";

/** The longest text people can paste (docs/tools/spec.md T3). */
export const MAX_PASTE = 300_000;
export const PASTE_TOO_LONG = "That's a lot of text. Paste just the JSON-LD block, or up to 300,000 characters.";
/** A no-JavaScript post of an empty paste box (with JavaScript an empty box just shows no result). */
export const PASTE_EMPTY = "Paste your product's JSON-LD or the page's HTML first.";

/** Errors for the link form (the shared fetch copy covers sites that turn us away or fail). */
export const URL_COPY = {
  marketplace: "That link is on a marketplace or big retailer. This tool checks your own store's product pages.",
  missing: "We couldn't find that page. Check the link and try again.",
  // Shopify sends every page of a password-protected store (a new or paused one) to /password.
  password: "That store is password protected, so we can't see its product pages. Check again once the password is off, or paste the page's HTML below.",
} as const;

// ---------- the result ----------

export const RESULT = {
  ready: "Your result is ready.",
  readPage: (url: string) => `We read ${url}`,
  readRecord: "and your store's own product record",
  /** The chip beside the verdict. */
  chip: { ready: "Ready", problems: "Check problems", missing: "Missing facts", none: "Not found", broken: "Can't be read", unread: "Not checked" },
  problemsHeading: "Problems to fix",
  notesHeading: "Good to know",
  problemChip: { bad: "Fix", warn: "Check", info: "Note" },
  rawSummary: "Show the product data we found",
  rawLabel: "Product data (JSON-LD)",
  rawCut: "(cut short: the full data is longer)",
  compareBlock: (n: number) => `Block ${n}`,
  compareRows: { type: "Type", name: "Name", price: "Price", stock: "Stock" },
  compareNone: "Not given",
  fixLabel: "Where to fix it in Shopify:",
} as const;

export type VerdictState = "ready" | "problems" | "missing" | "none" | "broken" | "unread";

export const VERDICT = {
  ready: "Ready for Google's product results: all required facts found",
  missing: (n: number) => `Missing ${plural(n, "fact")} Google needs`,
  problems: (n: number) => `All required facts found, but ${n === 1 ? "1 problem needs" : `${n} problems need`} fixing`,
  nonePage: "No product data found on this page",
  nonePasted: "No product data found in what you pasted",
  notProduct: "This doesn't look like a product page",
  /** The only product data has a typo: it's there, but nothing can read it. */
  broken: "Your product data has a typo, so Google can't read it",
  /** Microdata only: the page has product data, in a format this tool doesn't read. */
  microdata: "This page uses microdata, which this tool doesn't read",
} as const;

/** Where the data came from, for the "found" line. */
export const WHERE = {
  page: "the page's HTML",
  html: "the HTML you pasted",
  json: "the JSON-LD you pasted",
} as const;

export const FOUND = {
  /** `linked`: variants written only as a link to their own page elsewhere (Google's multi-page pattern). */
  group: (variants: number, where: string, linked = 0) =>
    linked
      ? variants
        ? `Found a ProductGroup with ${plural(variants, "variant")} in ${where}, plus ${plural(linked, "linked variant")} on other pages.`
        : `Found a ProductGroup in ${where} with no variants of its own, only ${plural(linked, "link")} to variants on other pages.`
      : variants
        ? `Found a ProductGroup with ${plural(variants, "variant")} in ${where}.`
        : `Found a ProductGroup with no variants in ${where}.`,
  // Google's product variants guide (updated 8 Sep 2026), multi-page sites: the group on each page has "a full
  // definition of the variants on the page as well as a variant with only the url property to link to the
  // variants on the other page, which helps Google find your variants", and "each page must have full and
  // self-contained markup for the entities defined on that page".
  linked: (linked: number, variants: number) =>
    variants
      ? `${linked === 1 ? "The linked variant only gives the link to its own page" : `The ${linked} linked variants only give the link to their own page`}, like another colour. That's how Google suggests doing it, so we check the ${plural(variants, "variant")} on this page.`
      : "Google asks each page to fully describe the variants it sells: a name, image, price and currency for each.",
  product: (offers: number, where: string) => (offers > 1 ? `Found a Product with ${plural(offers, "offer")} in ${where}.` : `Found a Product in ${where}.`),
  listing: (products: number, where: string) => `Found ${plural(products, "product")} in ${where}. The facts below are for the most complete one.`,
  agreeing: (more: number) =>
    more === 1 ? "There's 1 more product data block, and it agrees with this one." : `There are ${more} more product data blocks, and they agree with this one.`,
  others: (types: string) => `We also found ${types} data. It isn't product data, so we skip it.`,
  listed: (n: number) => `We also found ${plural(n, "product")} in a list on the page, like related products, so we skip ${n === 1 ? "it" : "them"}.`,
  noJsonLd: (where: string) => `We found no JSON-LD in ${where}.`,
  noProduct: (blocks: number, where: string, someUnreadable = false) =>
    `We found ${plural(blocks, "JSON-LD block")} in ${where}, but none ${someUnreadable ? "we could read describes" : "describes"} a product.`,
  pastedNoProduct: "The JSON-LD you pasted doesn't describe a product.",
  pastedUnreadable: "We read what you pasted as JSON-LD, because it starts with { or [.",
} as const;

/** Status words (docs/tools/spec.md T3). "Can't be read" and "None" are for bad prices and missing reviews. */
export const STATUS = {
  found: "Found",
  missing: "Missing",
  partial: (found: number, of: number, noun: string) => `Some ${noun}s only (${found} of ${of})`,
  unreadable: "Can't be read",
  notOnPage: "Not on this page",
  notNeeded: "Not needed",
  none: "None",
} as const;

export type FieldGroupId = "required" | "recommended" | "extra";

export const GROUPS: { id: FieldGroupId; heading: string; intro: string; source?: FaqSource; variantsSource?: FaqSource }[] = [
  {
    id: "required",
    heading: "Needed by Google",
    // source: merchant listing guide (updated 8 Sep 2026), required properties; variants guide for groups
    intro: "Google requires these for product results on pages where shoppers can buy.",
    source: GOOGLE_MERCHANT,
    variantsSource: GOOGLE_VARIANTS,
  },
  {
    id: "recommended",
    heading: "Recommended by Google",
    intro: "Not required, but Google recommends them, and they make your product easier to understand.",
    source: GOOGLE_MERCHANT,
  },
  {
    id: "extra",
    heading: "Extra facts AI shopping tools can use",
    // <!-- source: https://help.openai.com/en/articles/11128490-shopping-in-chatgpt -->
    intro:
      "Our advice: OpenAI says ChatGPT shopping reads structured product data such as price and description. These extra facts make your product easier to match to a shopper's question.",
    source: OPENAI_SHOPPING,
  },
];

// "Where to fix it in Shopify" (docs/tools/spec.md T3 table, exact copy where the table has a row).
const FIX_BRAND = "Products > the product > Vendor. Most themes use Vendor as the brand.";
const FIX_BARCODE = "Products > the product > the variant > Barcode (ISBN, UPC, GTIN, etc.). Fill it in for every variant that has one.";
const FIX_SKU = "Products > the product > the variant > SKU.";
const FIX_DESCRIPTION = "Products > the product > Description. Start with who it's for and its key facts.";
const FIX_IMAGE = "Products > the product > Media. Add at least one image.";
const FIX_STOCK = "Comes from your inventory settings. If it's wrong, check the variant's inventory and 'Continue selling when out of stock'.";
// facts-2026.md 2.3: Organization-level shipping and returns markup, Search Console and Merchant Center settings
const FIX_SHIPPING =
  "Add them once for the whole store: in Google Merchant Center or Search Console's shipping and returns settings, or with store-wide markup on your home page. Google reads those too.";
const FIX_OPTIONS = "Use clear variant option names (Colour, Size) and fill in the product's category and metafields in Shopify admin.";
// Fields Shopify's structured_data filter outputs (facts-2026.md 2.4): a theme without them needs the filter.
const FIX_THEME = "Your theme writes this part. Shopify's own structured_data filter adds it, so ask your theme developer to switch to that filter.";
// Not in Shopify's default product data (facts-2026.md 2.4, Horizon observed 11 Oct 2026).
const FIX_EXTRA_CODE = "Not in Shopify's standard product data. A developer or an SEO app can add it.";

export type FieldId =
  | "name"
  | "variantName"
  | "image"
  | "offers"
  | "price"
  | "currency"
  | "brand"
  | "description"
  | "availability"
  | "gtin"
  | "sku"
  | "mpn"
  | "condition"
  | "url"
  | "saleEnd"
  | "shipping"
  | "returns"
  | "productGroupID"
  | "variesBy"
  | "reviews"
  | "category"
  | "color"
  | "size"
  | "material"
  | "audience"
  | "certification";

export interface FieldCopy {
  /** The plain name people see. */
  label: string;
  /** The schema.org property, shown small for developers. */
  prop: string;
  /** Why it matters, in one line. */
  why: string;
  /** Where to fix it in Shopify (shown when it isn't found). */
  fix?: string;
}

export const FIELDS: Record<FieldId, FieldCopy> = {
  name: { label: "Product name", prop: "name", why: "Required: it's how Google and AI tools know what the product is.", fix: "Products > the product > Title." },
  variantName: {
    label: "Variant names",
    prop: "hasVariant[].name",
    why: "Required: Google asks for the same required facts on every variant, starting with its name.",
    fix: FIX_THEME,
  },
  image: { label: "Image", prop: "image", why: "Required: Google needs at least one image to show the product.", fix: FIX_IMAGE },
  offers: { label: "Offer", prop: "offers", why: "Required: the offer holds the price, currency and stock status.", fix: FIX_THEME },
  price: { label: "Price", prop: "offers.price", why: "Required: shoppers and AI tools compare products by price.", fix: FIX_THEME },
  currency: {
    label: "Currency",
    prop: "offers.priceCurrency",
    why: "Required: a price needs its currency, as a 3-letter code like USD.",
    fix: FIX_THEME,
  },
  brand: { label: "Brand", prop: "brand.name", why: "Lets shoppers and AI tools match your product to searches for your brand.", fix: FIX_BRAND },
  description: { label: "Description", prop: "description", why: "Tells machines who the product is for and what it does, in your words.", fix: FIX_DESCRIPTION },
  availability: { label: "Stock status", prop: "offers.availability", why: "Shows whether shoppers can buy it now.", fix: FIX_STOCK },
  gtin: { label: "Barcode (GTIN)", prop: "gtin", why: "Shopping tools use barcodes to tell exactly which product it is.", fix: FIX_BARCODE },
  // facts-2026.md 2.2 (variants guide): "each variant needs a unique ID (sku or gtin)"
  sku: { label: "SKU", prop: "sku", why: "Your own product code. Google uses a SKU or barcode to tell variants apart.", fix: FIX_SKU },
  mpn: { label: "Part number (MPN)", prop: "mpn", why: "The maker's part number. Useful when a product has no barcode.", fix: FIX_EXTRA_CODE },
  condition: { label: "Condition", prop: "offers.itemCondition", why: "Says whether the product is new, used or refurbished.", fix: FIX_EXTRA_CODE },
  // facts-2026.md 2.2: "each variant must be pre-selectable by its own URL (query parameter)"
  url: { label: "Offer link", prop: "offers.url", why: "The link that opens this exact product or variant, so shoppers land on the right one.", fix: FIX_THEME },
  saleEnd: { label: "Sale end date", prop: "offers.priceValidUntil", why: "Only needed for a sale price that ends on a set date." },
  // facts-2026.md 2.1: merchant listings "can show price, availability, and shipping and return information"
  shipping: {
    label: "Shipping",
    prop: "offers.shippingDetails",
    why: "Shipping costs and times can show in Google's results. They can also be set for the whole store.",
    fix: FIX_SHIPPING,
  },
  returns: {
    label: "Returns",
    prop: "offers.hasMerchantReturnPolicy",
    why: "Your return policy can show in Google's results. It can also be set for the whole store.",
    fix: FIX_SHIPPING,
  },
  productGroupID: { label: "Product group ID", prop: "productGroupID", why: "Tells Google that the variants belong to one product.", fix: FIX_THEME },
  variesBy: { label: "What the variants differ by", prop: "variesBy", why: "Tells Google what changes between variants, like size or colour.", fix: FIX_EXTRA_CODE },
  // Google changelog 24 Jul 2026: review guideline on fake and undisclosed incentivised reviews.
  reviews: { label: "Reviews", prop: "aggregateRating", why: "Only add ratings markup if real customer reviews show on the page." },
  // facts-2026.md 2.2: Product.category accepts text or a Google category code (7 Jul 2026)
  category: { label: "Category", prop: "category", why: "Says what kind of product it is, in your words or as a Google category.", fix: "Products > the product > Category." },
  color: { label: "Colour", prop: "color", why: "Helps match questions that name a colour.", fix: FIX_OPTIONS },
  size: { label: "Size", prop: "size", why: "Helps match questions that name a size.", fix: FIX_OPTIONS },
  material: { label: "Material", prop: "material", why: "Helps match questions that name a material, like cotton or leather.", fix: FIX_OPTIONS },
  audience: { label: "Who it's for", prop: "audience", why: "Says who the product is for, like adults or children.", fix: FIX_EXTRA_CODE },
  certification: {
    label: "Certification",
    prop: "hasCertification",
    why: "Only if the product really has one, like an organic certification. Leave it out otherwise.",
  },
};

/** The ratings rule: missing reviews are never a problem (Google changelog 24 Jul 2026). */
export const REVIEWS_NONE = "None in the product data.";
export const reviewsValue = (rating: string | null, count: string | null) =>
  rating && count ? `${rating} from ${count} reviews` : rating ? `Rated ${rating}` : count ? `${count} reviews` : "Found";

export const PROBLEM = {
  invalid: (n: number, product: boolean) =>
    n === 1
      ? product
        ? "One product data block has a typo, so Google can't read it."
        : "One data block on this page has a typo, so Google can't read it."
      : `${n} ${product ? "product " : ""}data blocks have a typo, so Google can't read them.`,
  invalidPasted: "The JSON-LD you pasted has a typo, so Google can't read it.",
  disagree: (n: number, parts: string) =>
    `Your page has ${n} product data blocks that disagree on ${parts}. Usually one comes from your theme and one from an app. Keep one.`,
  disagreeName: (a: string, b: string) => `the name ("${a}" vs "${b}")`,
  disagreePrice: (a: string, b: string) => `the price (${a} vs ${b})`,
  disagreeCurrency: (a: string, b: string) => `the currency (${a} vs ${b})`,
  disagreeStock: (a: string, b: string) => `stock (${a} vs ${b})`,
  recordPrice: (a: string, b: string) =>
    `Your product data says ${a}, but your store's product record says ${b}. Your store's record is the price shoppers pay, so check which theme code or app writes the product data.`,
  recordInStock:
    "Your product data says it's in stock, but your store's product record says no variant can be bought. Check the variants' inventory, then which theme code or app writes the product data.",
  recordOutOfStock:
    "Your product data says it's out of stock, but your store's product record says it can be bought. Check which theme code or app writes the product data.",
  priceFormat: (raw: string) =>
    `The price is written as "${raw}". Google needs a plain number like 24.00: no currency sign, no comma, and the currency in its own field.`,
  currencyFormat: (raw: string) => `The currency is written as "${raw}". Google needs a 3-letter code like USD or EUR.`,
  // Merchant listing guide (updated 8 Sep 2026): the Offer needs `price` or `priceSpecification.price`; an
  // AggregateOffer's lowPrice is only listed for product snippets (facts-2026.md 2.2).
  priceRange: (low: string) =>
    `Your product data gives a price range ("from ${low}") instead of a price. For product results on store pages, Google needs each offer to have its own price.`,
  barcodes: (inStore: number, variants: number, inData: number) =>
    `Your store has a barcode on ${inStore} of ${plural(variants, "variant")}, but the product data includes ${inData ? inData : "none"}. Your theme may leave barcodes out of its product data.`,
  microdata: "This page describes the product with microdata. This tool reads JSON-LD only, which is what Shopify themes use.",
  notProduct: "This doesn't look like a product page. Google's product results only support pages about one product (or its variants).",
  manyVariants: (n: number) => `This product has ${plural(n, "variant")}. We checked the first 100.`,
} as const;

/** Stock words for comparisons: "in stock" / "out of stock". */
export const STOCK = { in: "in stock", out: "out of stock" } as const;

/** The "Fix it in Shopify" box (docs/tools/spec.md T3, result layout 5). Backticks mark code. */
export const FIX = {
  title: "Fix it in Shopify",
  admin:
    "Most of these are fixed in Shopify admin, not in code: your theme turns your product's fields into product data. Fill in the fields above, then check again.",
  // Exact, from Shopify's docs (structured_data filter; Dawn main-product.liquid, facts-2026.md 2.4)
  codeLead:
    "Ask your developer, or in Online Store > Themes > Edit code, open your product section (often `sections/main-product.liquid`) and add this line:",
  code: '<script type="application/ld+json">{{ product | structured_data }}</script>',
  codeLabel: "Add to your product section",
  codeAfter:
    "This uses Shopify's own `structured_data` filter, so the facts always match your product. Add it only if your theme has no product data already, or you'll have two blocks.",
  codeSources: [SHOPIFY_FILTER, DAWN_PRODUCT],
} as const;

// ---------- the page ----------

export const WHAT_IT_CHECKS = [
  "Google's required product facts: name, image, price and currency",
  "Recommended facts like brand, barcode, SKU, stock status, shipping and returns",
  "Variants grouped as a ProductGroup",
  "Problems like two product blocks that disagree, or a price that doesn't match your store",
];

export interface HowItem {
  text: string;
  source?: FaqSource;
}

export const HOW_IT_WORKS: HowItem[] = [
  // merchant listing guide: "we recommend putting Product structured data in the initial HTML for best results",
  // JavaScript-generated markup "can make Shopping crawls less frequent and less reliable"
  {
    text: "We download the product page the way a crawler first sees it, before any JavaScript runs, and read every JSON-LD block (up to 20). Google recommends putting product data in the page's HTML, because data added later by JavaScript can make shopping crawls less reliable.",
    source: GOOGLE_MERCHANT,
  },
  { text: "On Shopify stores we also read the product's public data file (/products/{handle}.js) to compare price and stock." },
  {
    text: "We check the facts against Google's merchant listing and product variant guides (required and recommended). The extra facts group is our own advice.",
    source: GOOGLE_VARIANTS,
  },
  { text: "We read JSON-LD only, not microdata or RDFa." },
  {
    text: "Shipping and returns can be set for the whole store or in Google Merchant Center, so when they're not on the page we say 'not on this page', not 'missing'.",
  },
  { text: "We don't run Google's Rich Results Test, and passing here doesn't guarantee a rich result." },
];

export const FAQS: ToolFaqItem[] = [
  {
    q: "What is product schema?",
    // <!-- source: https://developers.google.com/search/docs/appearance/structured-data/merchant-listing ; OpenAI shopping help -->
    a: "Product schema is a small block of code on a product page that states the product's facts, like its name, price, currency, stock status and brand, in a format machines can read without guessing. Most stores add it as JSON-LD. Google uses it for product results in Search, and AI shopping tools can read the same facts.",
    sources: [GOOGLE_MERCHANT, OPENAI_SHOPPING],
  },
  {
    q: "Does Shopify add product schema automatically?",
    // <!-- source: https://shopify.dev/docs/api/liquid/filters/structured_data ; Horizon demo observed 11 Oct 2026 (facts §2.4) -->
    a: "Shopify's own themes, like Dawn and Horizon, do. They use Shopify's structured_data filter, which outputs a Product for products without variants and a ProductGroup for products with variants, with the brand, description, price, currency, stock status and, when you've filled in the barcode field, the GTIN. Other themes vary, so check yours. Shipping, returns and ratings usually need extra setup.",
    sources: [SHOPIFY_FILTER, DAWN_PRODUCT],
  },
  {
    q: "Which product schema fields does Google require?",
    // <!-- source: merchant listing doc, updated 8 Sep 2026 -->
    a: "For product results on pages where shoppers can buy, Google requires the product name, an image, and an offer with a price and currency. It recommends many more, including brand, GTIN, SKU, stock status, shipping details and a return policy.",
    sources: [GOOGLE_MERCHANT],
  },
  {
    q: "Does product schema help me get recommended by ChatGPT?",
    // <!-- source: https://developers.google.com/search/docs/fundamentals/ai-optimization-guide ; https://help.openai.com/en/articles/11128490-shopping-in-chatgpt -->
    a: "It helps AI tools read your facts correctly, but it won't get you recommended on its own. Google says its AI features need no special schema, and OpenAI says ChatGPT already gets Shopify product data through Shopify Catalog with no extra work from merchants. Clear facts on the page and mentions on sites AI trusts matter more.",
    sources: [GOOGLE_AI_GUIDE, OPENAI_SHOPPING],
  },
  {
    q: "Should I add review stars to my product schema?",
    // <!-- source: https://developers.google.com/search/updates (24 Jul 2026); merchant listing doc -->
    a: "Only if real customer reviews show on the page. Google's review guidelines don't allow fake or undisclosed incentivised reviews. If a reviews app adds ratings, check it puts them in the page's HTML: Google says data added later by JavaScript can make shopping crawls less reliable.",
    sources: [GOOGLE_UPDATES, GOOGLE_MERCHANT],
  },
  {
    q: "Why does my page have two product blocks?",
    // <!-- our advice (competitors §5) -->
    a: "Usually your theme adds one and an app, often a reviews or SEO app, adds another. If they disagree, for example on price or stock, machines can't tell which is right. Keep one complete block: turn off the app's product data if your theme already has it, or the other way round.",
  },
];

export const CTA = {
  text: "See how GEO fixes your product pages for AI",
  href: "/?ref=tool-product-schema-checker#how",
} as const;
