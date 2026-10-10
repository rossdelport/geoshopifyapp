/* eslint-disable @typescript-eslint/no-explicit-any -- reads product JSON of many shapes */
// Free product check: pure helpers for reading a product page (tested, no network here).
// URL checks, private-address checks (SSRF guard), Shopify .js + HTML/JSON-LD parsing,
// brand and category fallbacks, and tidying the buyer questions.
// Strangers choose these pages (up to 2 MB), so every pattern here is bounded: none may scan to
// the end of the page from many starting points, which could freeze the whole server.

import { domainOf } from "./answers";
import { textNamesBrand } from "./match";
import { guessSourceType } from "./sources";
import { CHECK_COUNTRIES, type CheckCountry, type CheckProduct, type CheckQuestion } from "./check-types";

// ---------- The link the visitor pasted ----------

const BAD_LINK = "Please paste a product link, like https://yourstore.com/products/your-product.";
export const NOT_YOUR_STORE =
  "That link is on a marketplace or big retailer. Please paste the product link from your own store's website.";

// Query parameters that can pick the product. Everything else (tracking, preview keys, tokens) is dropped,
// so "?x=1" can't dodge re-use and private keys never end up on a shareable report.
const KEEP_PARAMS = new Set(["variant", "id", "p", "pid", "product", "product_id", "sku"]);

/** The link we store and fetch: product parameters only, no #fragment, no trailing slash. */
export function cleanCheckUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (!KEEP_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
    u.hash = "";
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString().replace(/\?$/, "");
  } catch {
    return url;
  }
}

/** Amazon, eBay, Chemist Warehouse and co: their name and domain would count as "you" in the answers. */
export function isMarketplaceLink(url: string): boolean {
  const type = guessSourceType(url, domainOf(url));
  return type === "marketplace" || type === "retailer";
}

export function normalizeCheckUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  let raw = (input ?? "").trim();
  if (!raw) return { ok: false, error: BAD_LINK };
  if (raw.length > 2000) return { ok: false, error: "That link is too long. Please paste the product page link." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw.replace(/^\/+/, "")}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: BAD_LINK };
  }
  const host = u.hostname.replace(/\.$/, "");
  if (!fetchableUrl(u) || !host.includes(".") || isIpLiteral(host)) return { ok: false, error: BAD_LINK };
  const url = cleanCheckUrl(u.toString());
  if (isMarketplaceLink(url)) return { ok: false, error: NOT_YOUR_STORE };
  return { ok: true, url };
}

// ---------- SSRF guard (we fetch pages that strangers paste) ----------

/** Names that point inside a network, never at a public shop. */
export function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!h || h === "localhost" || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(h)) return true;
  return isIpLiteral(h) && isPrivateIp(h);
}

/** Checks we can make before looking up the address: web links on normal ports, no logins, no internal names. */
export function fetchableUrl(u: URL): boolean {
  return (
    (u.protocol === "http:" || u.protocol === "https:") &&
    !u.username &&
    !u.password &&
    (u.port === "" || u.port === "80" || u.port === "443") &&
    !isBlockedHostname(u.hostname)
  );
}

export const isIpLiteral = (host: string) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.replace(/^\[|\]$/g, "").includes(":");

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

/** "2001:db8::1" -> 8 numbers (16 bits each). Handles "::" and a dotted IPv4 tail. */
export function parseIpv6(ip: string): number[] | null {
  let s = ip.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
  const v4tail = s.match(/:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4tail) {
    const v4 = parseIpv4(v4tail[1]);
    if (!v4) return null;
    s = `${s.slice(0, -v4tail[1].length)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.length === 8 && nums.every((n) => !Number.isNaN(n)) ? nums : null;
}

function privateV4([a, b, c]: number[]): boolean {
  return (
    a === 0 || // "this network"
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224 // multicast + reserved + broadcast
  );
}

/** True for loopback, private, link-local, CGNAT, multicast, special and unspecified addresses (v4 and v6). Unreadable = true. */
export function isPrivateIp(ip: string): boolean {
  const v4 = parseIpv4(ip);
  if (v4) return privateV4(v4);
  const g = parseIpv6(ip);
  if (!g) return true;
  if (g.slice(0, 5).every((n) => n === 0) && (g[5] === 0xffff || g[5] === 0)) {
    if (g[5] === 0 && g[6] === 0 && g[7] <= 1) return true; // :: and ::1
    return privateV4([g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255]); // ::ffff:v4 (mapped), ::v4 (old form)
  }
  // Only global unicast (2000::/3) can be a public shop: this rules out unique-local, link-local,
  // multicast, NAT64 and the rest. Then the special blocks inside it:
  if ((g[0] & 0xe000) !== 0x2000) return true;
  if (g[0] === 0x2001 && g[1] < 0x200) return true; // 2001::/23 special use, Teredo included
  if (g[0] === 0x2001 && g[1] === 0xdb8) return true; // documentation
  if (g[0] === 0x3fff && g[1] < 0x1000) return true; // documentation (3fff::/20)
  if (g[0] === 0x2002) return privateV4([g[1] >> 8, g[1] & 255, g[2] >> 8, g[2] & 255]); // 6to4
  return false;
}

/** The part of an IP address that identifies one visitor: the full IPv4, or the IPv6 /64 network. */
export function ipBucket(ip: string): string {
  const s = ip.trim().toLowerCase().replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, "");
  if (parseIpv4(s)) return s;
  const g = parseIpv6(s);
  // Anything that isn't an address shares one bucket, so made-up header values can't each get 3 checks.
  return g ? g.slice(0, 4).map((n) => n.toString(16)).join(":") + "::/64" : "unknown";
}

// ---------- Text helpers ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

const TEXT_MAX = 20_000; // descriptions are cut to 1,500 characters later anyway

/** HTML -> plain text. Walks the tags with indexOf (linear time) and skips script, style and noscript. */
export function htmlToText(html: string): string {
  const s = html.length > TEXT_MAX ? html.slice(0, TEXT_MAX) : html;
  const lower = s.toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    const gt = lt === -1 ? -1 : s.indexOf(">", lt);
    if (gt === -1) {
      out += s.slice(i); // no more tags ("Size < 50ml" stays as it is)
      break;
    }
    out += `${s.slice(i, lt)} `;
    i = gt + 1;
    const name = /^<\s*([a-z]+)/.exec(lower.slice(lt, lt + 12))?.[1];
    if (name === "script" || name === "style" || name === "noscript") {
      const end = lower.indexOf(`</${name}`, i);
      const close = end === -1 ? -1 : s.indexOf(">", end);
      i = close === -1 ? s.length : close + 1;
    }
  }
  return decodeEntities(out).replace(/\s+/g, " ").trim();
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max).replace(/\s+\S*$/, "")}…` : s);

function absoluteImage(src: unknown, base: string): string | null {
  if (typeof src !== "string" || !src.trim()) return null;
  try {
    const u = new URL(src.trim().startsWith("//") ? `https:${src.trim()}` : src.trim(), base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.protocol = "https:";
    return u.toString();
  } catch {
    return null;
  }
}

function money(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  return value !== null && value !== undefined && value !== "" && Number.isFinite(n) && n > 0 ? n.toFixed(2) : null;
}

// ---------- Shopify ----------

/** The product handle from a Shopify product URL (/products/x or /collections/y/products/x). */
export function shopifyHandle(url: string): string | null {
  try {
    const m = new URL(url).pathname.match(/\/products\/([^/?#]+?)(?:\.(?:js|json|oembed))?\/?$/i);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export interface ShopifyJsFacts {
  title: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  description: string;
  price: string | null;
  image: string | null;
}

/** Read Shopify's public /products/<handle>.js JSON. Prices there are in cents. */
export function parseShopifyJs(json: any, pageUrl: string): ShopifyJsFacts | null {
  if (!json || typeof json !== "object" || typeof json.title !== "string") return null;
  const cents = Number(json.price ?? json.price_min);
  const tags = Array.isArray(json.tags) ? json.tags : typeof json.tags === "string" ? json.tags.split(",") : [];
  return {
    title: json.title.trim().slice(0, 300) || null,
    vendor: typeof json.vendor === "string" && json.vendor.trim() ? json.vendor.trim().slice(0, 100) : null,
    productType: typeof json.type === "string" && json.type.trim() ? json.type.trim().slice(0, 100) : null,
    tags: tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 20),
    description: htmlToText(String(json.description ?? "")),
    price: Number.isFinite(cents) && cents > 0 ? (cents / 100).toFixed(2) : null,
    image: absoluteImage(json.featured_image ?? json.images?.[0], pageUrl),
  };
}

// ---------- HTML page ----------

export interface LdProduct {
  name: string | null;
  brand: string | null;
  description: string | null;
  price: string | null;
  currency: string | null;
  image: string | null;
  category: string | null; // e.g. "Health & Beauty > Personal Care > Beard Oil"
}

export interface PageFacts {
  ld: LdProduct | null; // JSON-LD Product
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogSiteName: string | null;
  ogType: string | null; // "product" on most shops' product pages
  ogPrice: string | null;
  ogCurrency: string | null;
  title: string | null;
  metaDescription: string | null;
  shopDomain: string | null; // xxx.myshopify.com
  shopCurrency: string | null;
  shopifyCdn: boolean;
}

const MAX_META_TAGS = 300; // real pages have well under 100

function metaTags(html: string): Map<string, string> {
  const out = new Map<string, string>();
  let count = 0;
  for (const [tag] of html.matchAll(/<meta\b[^<>]{0,4000}>/gi)) {
    if (++count > MAX_META_TAGS) break;
    const attrs: Record<string, string> = {};
    // An attribute name only starts after a non-name character, so long runs of letters are read once.
    for (const m of tag.matchAll(/(?<![a-zA-Z0-9:_-])([a-zA-Z:_-]{1,40})\s{0,10}=\s{0,10}(?:"([^"]{0,3000})"|'([^']{0,3000})'|([^\s"'>]{1,3000}))/g)) {
      attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
    }
    const key = (attrs.property || attrs.name || attrs.itemprop || "").toLowerCase();
    if (key && attrs.content && !out.has(key)) out.set(key, decodeEntities(attrs.content).trim());
  }
  return out;
}

/** The contents of each <script type="application/ld+json"> block, found with indexOf (linear time). */
function jsonLdBlocks(html: string): string[] {
  const lower = html.toLowerCase();
  const out: string[] = [];
  for (let i = 0; out.length < 20; ) {
    const start = lower.indexOf("<script", i);
    const open = start === -1 ? -1 : lower.indexOf(">", start);
    const close = open === -1 ? -1 : lower.indexOf("</script", open);
    if (close === -1) break;
    if (/type\s{0,5}=\s{0,5}["']?application\/ld\+json/.test(lower.slice(start, Math.min(open, start + 500)))) {
      out.push(html.slice(open + 1, close));
    }
    i = close + 8;
  }
  return out;
}

/** The first match of `re` close after one of the first few `marker`s (cheap, whatever the page holds). */
function near(html: string, marker: string, re: RegExp, span = 400): string | null {
  for (let at = html.indexOf(marker), tries = 0; at !== -1 && tries < 5; at = html.indexOf(marker, at + 1), tries++) {
    const hit = re.exec(html.slice(at, at + span))?.[1];
    if (hit) return hit;
  }
  return null;
}

const isProductType = (t: unknown) =>
  (Array.isArray(t) ? t : [t]).some((x) => typeof x === "string" && /^(https?:\/\/schema\.org\/)?(Product|ProductGroup)$/i.test(x));

function findLdProduct(node: any, depth = 0): any {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findLdProduct(n, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (isProductType(node["@type"])) return node;
  return findLdProduct(node["@graph"], depth + 1) ?? findLdProduct(node.mainEntity, depth + 1);
}

const firstOf = (v: any) => (Array.isArray(v) ? v[0] : v);
const textOf = (v: any): string | null => {
  const x = firstOf(v);
  const s = typeof x === "string" ? x : x && typeof x === "object" && typeof x.name === "string" ? x.name : null;
  return s ? decodeEntities(s.slice(0, 300)).trim() || null : null;
};

function readLdProduct(p: any, pageUrl: string): LdProduct {
  const offers = [p.offers, p.hasVariant?.map?.((v: any) => v?.offers)].flat(2).filter(Boolean).slice(0, 50);
  let price: string | null = null;
  let currency: string | null = null;
  for (const o of offers) {
    price ??= money(o.price ?? o.lowPrice ?? o.priceSpecification?.price ?? firstOf(o.priceSpecification)?.price);
    currency ??= o.priceCurrency ?? o.priceSpecification?.priceCurrency ?? null;
  }
  const image = firstOf(p.image);
  return {
    name: textOf(p.name),
    brand: textOf(p.brand) ?? textOf(p.manufacturer),
    description: typeof p.description === "string" ? htmlToText(p.description) || null : null,
    price,
    currency: typeof currency === "string" ? currency.slice(0, 3).toUpperCase() : null,
    image: absoluteImage(typeof image === "object" && image ? image.url ?? image.contentUrl : image, pageUrl),
    category: textOf(p.category),
  };
}

export function parseProductHtml(html: string, pageUrl: string): PageFacts {
  let ld: LdProduct | null = null;
  for (const block of jsonLdBlocks(html)) {
    try {
      const found = findLdProduct(JSON.parse(block.trim()));
      if (found) {
        ld = readLdProduct(found, pageUrl);
        break;
      }
    } catch {
      /* broken JSON-LD: skip it */
    }
  }
  const meta = metaTags(html);
  const title = html.match(/<title\b[^<>]{0,200}>([^<]{0,1000})<\/title>/i)?.[1];
  return {
    ld,
    ogTitle: meta.get("og:title") || null,
    ogDescription: meta.get("og:description") || null,
    ogImage: absoluteImage(meta.get("og:image:secure_url") || meta.get("og:image"), pageUrl),
    ogSiteName: meta.get("og:site_name") || null,
    ogType: meta.get("og:type")?.toLowerCase() || null,
    ogPrice: money(meta.get("product:price:amount") || meta.get("og:price:amount")),
    ogCurrency: (meta.get("product:price:currency") || meta.get("og:price:currency") || "").slice(0, 3).toUpperCase() || null,
    title: title ? htmlToText(title) || null : null,
    metaDescription: meta.get("description") || null,
    shopDomain: near(html, "Shopify.shop", /^Shopify\.shop\s{0,5}=\s{0,5}["']([a-z0-9][a-z0-9-]{0,60}\.myshopify\.com)["']/i)?.toLowerCase() ?? null,
    shopCurrency: near(html, "Shopify.currency", /^Shopify\.currency\s{0,5}=\s{0,5}\{[^}]{0,300}?["']active["']\s{0,5}:\s{0,5}["']([A-Z]{3})["']/),
    shopifyCdn: /cdn\.shopify\.com|\/cdn\/shop\//i.test(html),
  };
}

// ---------- Putting it together ----------

const SUFFIX_LABELS = new Set(["com", "net", "org", "co", "au", "nz", "uk", "ca", "us", "io", "shop", "store", "online", "myshopify", "biz", "info", "ie", "gov", "edu", "ac", "id"]);

/** "shop.bondi-beard-co.com.au" -> "Bondi Beard Co". */
export function domainStem(domain: string): string {
  const labels = domain.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  while (labels.length > 1 && SUFFIX_LABELS.has(labels[labels.length - 1])) labels.pop();
  return labels[labels.length - 1] ?? domain;
}
export const titleCase = (s: string) => s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

/** "images.shop.com.au" -> "shop.com.au": the site a host belongs to. */
function siteOf(host: string): string {
  const labels = host.toLowerCase().replace(/^www\./, "").split(".");
  const countryPair = labels.length >= 3 && labels[labels.length - 1].length === 2 && SUFFIX_LABELS.has(labels[labels.length - 2]);
  return labels.slice(countryPair ? -3 : -2).join(".");
}

/** Only images from the shop's own site or Shopify's CDN: a third-party image server could log everyone who opens a report. */
function imageOnSite(src: string | null | undefined, domain: string): src is string {
  if (!src) return false;
  try {
    const host = new URL(src).hostname.toLowerCase();
    return host === "cdn.shopify.com" || siteOf(host) === siteOf(domain);
  } catch {
    return false;
  }
}

const JUNK_VENDOR = /^(default( vendor)?|vendor|unknown|n\/?a|none|my store|-)$/i;
const DOMAIN_LIKE = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|co|au|nz|uk|ca|us|io|shop|store)$/i;

/** Brand shoppers know: Shopify vendor, then JSON-LD brand, then og:site_name, then the domain. */
export function pickBrand(f: { vendor?: string | null; ldBrand?: string | null; siteName?: string | null; domain: string }): string {
  for (const v of [f.vendor, f.ldBrand, f.siteName]) {
    const clean = v?.trim();
    if (!clean || clean.length > 60 || JUNK_VENDOR.test(clean) || /\.myshopify\.com$/i.test(clean)) continue;
    return DOMAIN_LIKE.test(clean) ? titleCase(domainStem(clean)) : clean; // "Amazon.com.au" -> "Amazon"
  }
  return titleCase(domainStem(f.domain));
}

export type DescriptionSource = "shopify" | "jsonld" | "meta" | null;

/** What we read from the page. Not shown as is: check.server turns it into a CheckProduct. */
export type ReadProduct = Omit<CheckProduct, "category"> & {
  tags: string[];
  ldCategory: string | null;
  descriptionSource: DescriptionSource; // "meta" = only the short og/meta summary
  pageRead: boolean; // we read the HTML page, not only Shopify's JSON
  looksLikeProduct: boolean; // Shopify product JSON, JSON-LD Product, og:type product or a price
};

/** Merge what Shopify's JSON and the HTML page told us. Null when there's nothing usable. */
export function mergeProduct(url: string, js: ShopifyJsFacts | null, page: PageFacts | null): ReadProduct | null {
  const ld = page?.ld ?? null;
  const pageTitle = page?.title?.split(/\s+[|–—-]\s+/)[0]?.trim() || null;
  const title = (js?.title || ld?.name || page?.ogTitle || pageTitle || "").trim();
  if (!title || title.length < 2) return null;
  const domain = domainOf(url);
  const summary = page?.ogDescription || page?.metaDescription || "";
  const [description, descriptionSource]: [string, DescriptionSource] = js?.description
    ? [js.description, "shopify"]
    : ld?.description
      ? [ld.description, "jsonld"]
      : summary
        ? [summary, "meta"]
        : ["", null];
  let path = "/";
  try {
    path = new URL(url).pathname;
  } catch {
    /* keep "/" */
  }
  // A home page or Shopify's password page has a title but no product.
  const productPage = path !== "/" && !/^\/password/i.test(path);
  return {
    url,
    domain,
    title: clip(title, 200),
    brand: pickBrand({ vendor: js?.vendor, ldBrand: ld?.brand, siteName: page?.ogSiteName, domain }),
    productType: js?.productType ?? null,
    description: clip(htmlToText(description), 1500),
    price: js?.price ?? ld?.price ?? page?.ogPrice ?? null,
    currency: ld?.currency || page?.ogCurrency || page?.shopCurrency || null,
    image: [js?.image, ld?.image, page?.ogImage].find((src) => imageOnSite(src, domain)) ?? null,
    isShopify: Boolean(js || page?.shopDomain || page?.shopifyCdn || domain.endsWith(".myshopify.com")),
    shopDomain: page?.shopDomain ?? (domain.endsWith(".myshopify.com") ? domain : null),
    hasProductSchema: Boolean(ld),
    tags: js?.tags ?? [],
    ldCategory: ld?.category ?? null,
    descriptionSource,
    pageRead: Boolean(page),
    looksLikeProduct: productPage && Boolean(js || ld || /product/.test(page?.ogType ?? "") || page?.ogPrice),
  };
}

// ---------- Category and questions (used when Claude is unavailable, and to tidy Claude's) ----------

// Shop product types that say nothing about what the product is.
const GENERIC_TYPE = /^(default|bundles?|physical|gift ?cards?|products?|simple|variable|general|other|misc|all|sale|new|featured|merch|items?|goods|accessories|uncategori[sz]ed)$/;

/** The category we ask about: the shop's product type, the page's JSON-LD category, else a guess from the title. */
export function pickCategory(p: { productType: string | null; ldCategory?: string | null; title: string; brand: string }): string {
  for (const raw of [p.productType, p.ldCategory?.split(/[>/|]/).pop()]) {
    const c = raw?.replace(/\s+/g, " ").trim().toLowerCase();
    if (c && c.length <= 40 && c.split(" ").length <= 4 && /^[a-z][a-z0-9 '&-]*$/.test(c) && !GENERIC_TYPE.test(c)) return c;
  }
  return fallbackCategory(p.title, p.brand);
}

const STOP_WORDS = new Set(["the", "and", "with", "for", "new", "set", "of", "spf", "upf", "mini", "travel", "refill", "size", "edition", "limited"]);

const wordsOf = (s: string) =>
  s
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\b\d+(\.\d+)?\s?(ml|l|g|kg|mg|oz|lb|pack|pk|x|cm|mm|m|pcs|piece|pieces)\b/g, " ")
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

/** "Sandalwood Beard Oil 50ml – Bondi Beard Co" -> "beard oil"; "Beard Oil for Dry Skin" -> "beard oil". */
export function fallbackCategory(title: string, brand: string): string {
  const b = brand.toLowerCase().trim();
  for (const part of title.toLowerCase().split(/\s+[|–—-]\s+/)) {
    let t = ` ${part} `;
    if (b.length > 1) t = t.split(` ${b} `).join(" ");
    // What it is comes before "with", "for", "in"...: "Face Serum with Hyaluronic Acid" -> "face serum".
    const head = wordsOf(t.split(/\s(?:with|for|in|by|from|\+|&)\s|,\s/)[0]);
    const words = head.length ? head : wordsOf(t);
    if (words.length) return words.slice(-2).join(" ");
  }
  return "product";
}

export function fallbackQuestions(category: string, country: CheckCountry): CheckQuestion[] {
  const where = CHECK_COUNTRIES[country];
  return [
    { text: `best ${category} in ${where}`, keyword: `best ${category}` },
    { text: `what's the best ${category} to buy right now`, keyword: category },
    { text: `is ${category} worth it, and which brand should I pick in ${where}`, keyword: `${category} brands` },
  ];
}

const COUNTRY_WORDS: Record<CheckCountry, RegExp> = {
  AU: /australia|aussie|\bAU\b/i,
  NZ: /new zealand|\bNZ\b|aotearoa/i,
  US: /\bUSA?\b|[Uu]nited [Ss]tates|[Aa]merica/,
  GB: /\bUK\b|united kingdom|britain|england|scotland|wales/i,
  CA: /canada|canadian/i,
};
export const mentionsCountry = (text: string, country: CheckCountry) => COUNTRY_WORDS[country].test(text);

/** Exactly 3 questions: drop any that name the brand, fill gaps, and make sure 2 mention the country. */
export function tidyQuestions(
  raw: { question: string; keyword: string }[],
  opts: { brandNames: string[]; category: string; country: CheckCountry },
): CheckQuestion[] {
  const out: CheckQuestion[] = [];
  const add = (text: string, keyword: string, force = false) => {
    const t = text.replace(/\s+/g, " ").trim().slice(0, 200);
    if (t.length < 8 || out.some((q) => q.text.toLowerCase() === t.toLowerCase())) return;
    if (!force && textNamesBrand(t, opts.brandNames)) return;
    out.push({ text: t, keyword: (keyword || t).replace(/\s+/g, " ").trim().slice(0, 80) });
  };
  for (const q of raw) if (out.length < 3) add(q.question ?? "", q.keyword ?? "");
  for (const q of fallbackQuestions(opts.category, opts.country)) if (out.length < 3) add(q.text, q.keyword);
  // A brand that is also a plain word (e.g. "Oil") could knock out every question: keep the templates anyway.
  for (const q of fallbackQuestions(opts.category, opts.country)) if (out.length < 3) add(q.text, q.keyword, true);
  const where = CHECK_COUNTRIES[opts.country];
  for (const q of out) {
    if (out.filter((x) => mentionsCountry(x.text, opts.country)).length >= 2) break;
    if (!mentionsCountry(q.text, opts.country)) {
      const ask = /\?$/.test(q.text);
      q.text = `${q.text.replace(/[?.!\s]+$/, "")} in ${where}${ask ? "?" : ""}`;
    }
  }
  return out.slice(0, 3);
}

const SHOPPING_WORDS = /\b(best|top|which|recommend\w*|buy|worth|good)\b/i;
const LOOKS_UNSAFE = /https?:|www\.|@|\b[a-z0-9-]+\.(com|net|org|io|au|nz|uk|co|shop|xyz|ru)\b|\d{5,}/i;

/**
 * Claude's questions, or [] (so the templates are used) if any of them doesn't look like a short
 * shopping question. The page is written by a stranger and could try to make us ask the AI
 * assistants something else, which we would then show on a public report.
 */
export function screenQuestions(raw: { question: string; keyword: string }[], category: string): { question: string; keyword: string }[] {
  const catWords = category.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const ok = ({ question, keyword }: { question: string; keyword: string }) => {
    const q = (question ?? "").trim();
    const k = (keyword ?? "").trim();
    return (
      q.length > 0 &&
      q.length <= 120 &&
      q.split(/\s+/).length <= 15 &&
      k.length <= 80 &&
      !LOOKS_UNSAFE.test(q) &&
      !LOOKS_UNSAFE.test(k) &&
      (SHOPPING_WORDS.test(q) || catWords.some((w) => q.toLowerCase().includes(w)))
    );
  };
  return raw.length && raw.every(ok) ? raw : [];
}
