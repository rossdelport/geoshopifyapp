// Product Schema Checker (docs/tools/spec.md T3): read the product structured data (JSON-LD) on a product
// page, or pasted by the visitor, and check it against Google's merchant listing and product variant guides
// (facts-2026.md 2.2). Pure and browser-safe: the server runs it on fetched pages and on the on-load sample,
// and the browser runs it live on pasted text.
// Strangers choose this text (pages up to 2 MB), so it stays bounded: the JSON-LD blocks are found with
// indexOf (html.ts), each is parsed once, the walk visits at most 500 objects at most 6 levels deep, and
// no regex runs over the whole page.

import { joinLabels } from "../robots";
import { plural } from "./format";
import { hasMicrodataProduct, jsonLdBlocks } from "./html";
import {
  FOUND,
  PROBLEM,
  STOCK,
  VERDICT,
  WHERE,
  reviewsValue,
  type FieldGroupId,
  type FieldId,
  type VerdictState,
} from "./copy/product-schema-checker";

type Obj = Record<string, unknown>;

/** Where the text came from: a fetched page, pasted HTML, or pasted JSON-LD. */
export type InputSource = "page" | "html" | "json";

const MAX_DEPTH = 6;
const MAX_NODES = 500;
/** Variants we check one by one (more than this and the result says so). */
export const MAX_VARIANTS = 100;
const MAX_LIST = 2_000;
const MAX_TEXT = 160;
const MAX_JSON_SHOWN = 30_000;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);
/** A value as a list: arrays as they are (cut to `max`), one value as a list of one, nothing as []. */
const list = (v: unknown, max = MAX_LIST): unknown[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v.slice(0, max) : [v]);
const objs = (v: unknown, max = MAX_LIST): Obj[] => list(v, max).filter(isObj);
const clip = (s: string, max = MAX_TEXT) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s);

/** A short text: a string, a number, or a thing's name ("brand": { "name": "X" }). Null when empty. */
function textOf(v: unknown, max = MAX_TEXT, depth = 0): string | null {
  const x = Array.isArray(v) ? v[0] : v;
  const raw =
    typeof x === "string"
      ? x
      : typeof x === "number" && Number.isFinite(x)
        ? String(x)
        : isObj(x) && depth < 3
          ? textOf(x.name ?? x["@value"], max, depth + 1)
          : null;
  if (raw === null) return null;
  const s = raw.slice(0, max * 4).replace(/\s+/g, " ").trim();
  return s ? clip(s, max) : null;
}

const SCHEMA_PREFIX = /^(?:https?:\/\/schema\.org\/|schema:)/i;
/** "https://schema.org/InStock" -> "InStock" (a short slice: these are enum values, never page-sized). */
const bare = (s: string) => s.slice(0, 120).trim().replace(SCHEMA_PREFIX, "").replace(/\/+$/, "");

/** The node's types without the schema.org prefix: "Product", ["Product", "Thing"], "http://schema.org/Product". */
export function typesOf(node: Obj): string[] {
  return list(node["@type"], 10)
    .filter((t): t is string => typeof t === "string")
    .map(bare)
    .filter(Boolean);
}
const hasType = (node: Obj, name: string) => typesOf(node).some((t) => t.toLowerCase() === name.toLowerCase());
// schema.org's more specific kinds of Product (a supplement store may write DietarySupplement): still a product.
const PRODUCT_TYPES = new Set(
  ["Product", "IndividualProduct", "ProductModel", "SomeProducts", "DietarySupplement", "Drug", "Vehicle", "Car", "Motorcycle"].map((t) => t.toLowerCase()),
);
const isGroupNode = (node: Obj) => hasType(node, "ProductGroup");
const isProductNode = (node: Obj) => !isGroupNode(node) && typesOf(node).some((t) => PRODUCT_TYPES.has(t.toLowerCase()));
const idOf = (node: Obj) => (typeof node["@id"] === "string" && node["@id"] ? node["@id"] : null);

// ---------- reading the text ----------

/** A Product or ProductGroup on the page, with its variants (a group's hasVariant, or Products that point to it). */
export interface ProductEntity {
  kind: "ProductGroup" | "Product";
  node: Obj;
  variants: Obj[];
}

export interface Extracted {
  source: InputSource;
  /** JSON-LD blocks read (pasted JSON-LD counts as one). */
  jsonLd: number;
  /** Blocks that aren't valid JSON, and how many of those mention a Product. */
  invalid: number;
  invalidProduct: number;
  /** Top-level products, merged by @id, groups first. */
  entities: ProductEntity[];
  /** The entities that only appear inside an ItemList (a collection or "related products" list). */
  fromList: Set<ProductEntity>;
  /** Other kinds of data we skipped (Organization, BreadcrumbList), at most 10. */
  others: string[];
  /** Products inside an ItemList (a collection page). */
  listed: number;
  /** No JSON-LD product, but microdata describes one. */
  microdata: boolean;
  /** The parsed blocks that hold product data, for "Show the product data we found". */
  productBlocks: unknown[];
}

interface Walk {
  count: number;
  ids: Map<string, Obj>;
  groups: Obj[];
  products: Obj[];
  /** Groups only seen as a variant's isVariantOf (a short note about the group, not a block of its own). */
  stubs: Set<Obj>;
  /** Nodes found inside an ItemList. */
  inList: Set<Obj>;
  others: Set<string>;
  listed: number;
  found: boolean;
}

type Role = "top" | "variant" | "list" | "parent";

/**
 * Walk one parsed block: arrays, @graph, mainEntity, ItemList items, hasVariant and isVariantOf, at most
 * MAX_DEPTH levels and MAX_NODES objects in all. Products inside a group's hasVariant are its variants.
 */
function walk(v: unknown, depth: number, w: Walk, role: Role) {
  if (depth > MAX_DEPTH || w.count >= MAX_NODES) return;
  if (Array.isArray(v)) {
    for (const x of v.slice(0, MAX_NODES)) {
      if (w.count >= MAX_NODES) break;
      walk(x, depth + 1, w, role);
    }
    return;
  }
  if (!isObj(v)) return;
  w.count++;
  // The first node with this @id that says what it is (a bare { "@id" } reference never wins).
  const id = idOf(v);
  if (id && (!w.ids.has(id) || (w.ids.get(id)!["@type"] === undefined && v["@type"] !== undefined))) w.ids.set(id, v);
  if (isGroupNode(v)) {
    w.found = true;
    w.groups.push(v);
    if (role === "parent") w.stubs.add(v);
    if (role === "list") {
      w.listed++;
      w.inList.add(v);
    }
    walk(v.hasVariant, depth + 1, w, "variant");
    return;
  }
  if (isProductNode(v)) {
    w.found = true;
    if (role !== "variant") {
      w.products.push(v);
      if (role === "list") {
        w.listed++;
        w.inList.add(v);
      }
    }
    if (v.isVariantOf !== undefined) walk(v.isVariantOf, depth + 1, w, "parent");
    return;
  }
  if (role === "top") for (const t of typesOf(v)) if (w.others.size < 10 && t !== "ListItem") w.others.add(t);
  walk(v["@graph"], depth + 1, w, "top");
  walk(v.mainEntity, depth + 1, w, "top");
  walk(v.itemListElement, depth + 1, w, "list");
  if (role === "list") walk(v.item, depth + 1, w, "list");
}

/** Pasted text that starts with { or [ is JSON-LD; anything else is a page's HTML (docs/tools/spec.md T3). */
export function detectSource(text: string): "html" | "json" {
  const start = text.slice(0, 200).trimStart();
  return start.startsWith("{") || start.startsWith("[") ? "json" : "html";
}

/**
 * Merge nodes that are the same thing. Nodes with the same @id are one node in JSON-LD, so their facts are
 * joined (the first block wins a clash). A group that only appears in a variant's isVariantOf (a stub) also
 * joins a group with the same productGroupID or name. Two full blocks without an @id are never joined, so
 * a theme's block and an app's block that disagree are still compared.
 */
function mergeSame(nodes: Obj[], stubs: Set<Obj>, keysOf: (n: Obj) => string[]): { merged: Obj[]; byOriginal: Map<Obj, Obj>; byKey: Map<string, Obj> } {
  // First decide who joins whom, without copying anything (a node can have thousands of keys).
  const firstOf = new Map<Obj, Obj>();
  const keyed = new Map<string, Obj>();
  const members = new Map<Obj, Obj[]>();
  // Full blocks first, so a stub joins the full group it points to.
  for (const n of [...nodes.filter((x) => !stubs.has(x)), ...nodes.filter((x) => stubs.has(x))]) {
    const keys = keysOf(n);
    const matchBy = stubs.has(n) ? keys : keys.filter((k) => k.startsWith("id:"));
    const first = matchBy.map((k) => keyed.get(k)).find(Boolean) ?? n;
    firstOf.set(n, first);
    if (first === n) members.set(n, [n]);
    else members.get(first)!.push(n);
    for (const k of keys) if (!keyed.has(k)) keyed.set(k, first);
  }
  // Then join: a copy only where nodes really merge (the parsed blocks stay as they were, for display).
  const final = new Map<Obj, Obj>();
  const merged: Obj[] = [];
  for (const [first, list] of members) {
    let node = first;
    if (list.length > 1) {
      node = { ...first };
      for (const n of list.slice(1)) for (const [k, val] of Object.entries(n)) if (!(k in node)) node[k] = val; // the first block wins
    }
    final.set(first, node);
    merged.push(node);
  }
  const byOriginal = new Map([...firstOf].map(([n, first]) => [n, final.get(first)!] as const));
  const byKey = new Map([...keyed].map(([k, first]) => [k, final.get(first)!] as const));
  return { merged, byOriginal, byKey };
}

/** The ways a group can be named: its @id, its productGroupID and its name. */
const groupKeys = (n: Obj): string[] => {
  const keys: string[] = [];
  const id = idOf(n);
  if (id) keys.push(`id:${id}`);
  const pgid = textOf(n.productGroupID);
  if (pgid) keys.push(`pgid:${pgid}`);
  const name = textOf(n.name);
  if (name) keys.push(`name:${name.toLowerCase()}`);
  return keys;
};
const productKeys = (n: Obj): string[] => {
  const id = idOf(n);
  return id ? [`id:${id}`] : [];
};

/** JSON-LD nested deeper than this isn't product data (real blocks are a few levels deep), and parsing it is slow. */
const MAX_JSON_DEPTH = 64;
/** One linear pass over the block: true when its brackets nest deeper than MAX_JSON_DEPTH. */
function tooDeep(raw: string): boolean {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    if (inString) {
      if (c === 92) i++; // a backslash: skip the escaped character
      else if (c === 34) inString = false;
    } else if (c === 34) inString = true;
    else if (c === 123 || c === 91) {
      if (++depth > MAX_JSON_DEPTH) return true;
    } else if (c === 125 || c === 93) depth--;
  }
  return false;
}

/** Find the product data: JSON-LD blocks (from HTML) or the pasted JSON-LD, parsed and walked. */
export function extractNodes(input: string, source: InputSource = detectSource(input)): Extracted {
  const text = input ?? "";
  const blocks = source === "json" ? [text] : jsonLdBlocks(text, 20);
  const w: Walk = { count: 0, ids: new Map(), groups: [], products: [], stubs: new Set(), inList: new Set(), others: new Set(), listed: 0, found: false };
  let invalid = 0;
  let invalidProduct = 0;
  const productBlocks: unknown[] = [];
  for (const block of blocks) {
    // trimStart also drops a byte order mark, which JSON.parse refuses.
    const raw = block.trimStart();
    let parsed: unknown;
    try {
      if (tooDeep(raw)) throw new Error("too deep");
      parsed = JSON.parse(raw);
    } catch {
      invalid++;
      if (raw.includes("Product")) invalidProduct++;
      continue;
    }
    w.found = false;
    walk(parsed, 0, w, "top");
    if (w.found) productBlocks.push(parsed);
  }

  const groups = mergeSame(w.groups, w.stubs, groupKeys);
  const products = mergeSame(w.products, new Set(), productKeys);
  const used = new Set<Obj>();
  const entities: ProductEntity[] = groups.merged.map((g) => ({ kind: "ProductGroup" as const, node: g, variants: [] as Obj[] }));
  const entityOf = new Map<Obj, ProductEntity>(entities.map((e) => [e.node, e]));

  // A group's own hasVariant list: Products, or { "@id" } references to Products elsewhere on the page.
  for (const e of entities) {
    for (const v of objs(e.node.hasVariant)) {
      const ref = idOf(v);
      const node = isProductNode(v) ? v : ref ? w.ids.get(ref) : undefined;
      if (!node || !isProductNode(node)) continue;
      const mergedNode = products.byOriginal.get(node) ?? node;
      if (!e.variants.includes(mergedNode)) e.variants.push(mergedNode);
      used.add(mergedNode);
    }
  }
  // Products that point to their group (isVariantOf, or inProductGroupWithID matching the group's ID).
  for (const p of products.merged) {
    const parent = objs(p.isVariantOf, 5)[0];
    let group: Obj | undefined;
    if (parent) group = groups.byOriginal.get(parent) ?? groupKeys(parent).map((k) => groups.byKey.get(k)).find(Boolean);
    const pgid = textOf(p.inProductGroupWithID);
    if (!group && pgid) group = groups.byKey.get(`pgid:${pgid}`);
    const e = group ? entityOf.get(group) : undefined;
    if (!e) continue;
    if (!e.variants.includes(p)) e.variants.push(p);
    used.add(p);
  }
  for (const p of products.merged) if (!used.has(p)) entities.push({ kind: "Product", node: p, variants: [] });

  // Entities whose every block sits inside an ItemList: a collection, or a "related products" list.
  const direct = new Set<Obj>();
  for (const [orig, m] of [...groups.byOriginal, ...products.byOriginal]) if (!w.inList.has(orig)) direct.add(m);
  const fromList = new Set(entities.filter((e) => !direct.has(e.node)));

  const microdata = entities.length === 0 && source !== "json" && hasMicrodataProduct(text);
  return { source, jsonLd: blocks.length, invalid, invalidProduct, entities, fromList, others: [...w.others], listed: w.listed, microdata, productBlocks };
}

// ---------- Shopify's own product record (/products/<handle>.js) ----------

export interface ShopifyRecord {
  /** Variant prices in the currency's units (the file has cents). */
  prices: number[];
  /** True when any variant can be bought. */
  available: boolean | null;
  variants: number;
  /** Variants with a barcode, or null when the file has no barcode field at all. */
  barcodes: number | null;
}

/** Cents as units: 2400 -> 24. A decimal string ("24.00", as products.json has) is already in units. */
function centsToUnits(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v / 100 : null;
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, 30);
  if (/^\d+$/.test(s)) return Number(s) / 100;
  if (/^\d+\.\d+$/.test(s)) return Number(s);
  return null;
}

/**
 * Read Shopify's public product file defensively: `price` (cents), `available`, and per variant `price`,
 * `available` and `barcode`. The barcode field was in the file on Shopify's Horizon demo store on
 * 11 Oct 2026; when it's missing, barcode comparisons are skipped.
 */
export function parseShopifyRecord(json: unknown): ShopifyRecord | null {
  if (!isObj(json)) return null;
  const variants = objs(json.variants);
  let prices = variants.map((v) => centsToUnits(v.price)).filter((n): n is number => n !== null);
  if (!prices.length) prices = [centsToUnits(json.price ?? json.price_min)].filter((n): n is number => n !== null);
  const flags = variants.map((v) => v.available).filter((a): a is boolean => typeof a === "boolean");
  const available = typeof json.available === "boolean" ? json.available : flags.length ? flags.some(Boolean) : null;
  const barcodes = variants.some((v) => "barcode" in v) ? variants.filter((v) => textOf(v.barcode) !== null).length : null;
  if (!prices.length && available === null) return null;
  return { prices, available, variants: variants.length, barcodes };
}

// ---------- the facts ----------

export type FieldStatus = "found" | "missing" | "partial" | "unreadable" | "not-on-page" | "not-needed" | "none";

export interface FieldRow {
  id: FieldId;
  group: FieldGroupId;
  status: FieldStatus;
  value?: string;
  /** For "Some variants only (found of of)". */
  found?: number;
  of?: number;
}

export type ProblemTone = "bad" | "warn" | "info";

export interface BlockSummary {
  type: string;
  name: string | null;
  price: string | null;
  stock: string | null;
}

export interface Problem {
  id: string;
  tone: ProblemTone;
  text: string;
  /** Two product blocks side by side, when they disagree. */
  compare?: BlockSummary[];
}

export interface SchemaReport {
  source: InputSource;
  kind: "ProductGroup" | "Product" | null;
  /** Variants (a group) or offers (a product), all of them; the checks read the first MAX_VARIANTS. */
  units: number;
  unitNoun: "variant" | "offer";
  verdict: { state: VerdictState; headline: string };
  /** One line: what we found and where. */
  found: string;
  /** Extra lines under it (agreeing blocks, skipped data). */
  notes: string[];
  fields: FieldRow[];
  problems: Problem[];
  microdata: boolean;
  /** The page doesn't look like one product (a collection or home page). */
  listing: boolean;
  /** The product data we read, pretty printed (cut at 30,000 characters), or null. */
  json: string | null;
}

/** One unit the per-variant checks count: a variant (with its offers), or one offer of a product. */
interface Unit {
  node: Obj;
  offers: Obj[];
}

const offersOf = (node: Obj): Obj[] => objs(node.offers, 50);

const priceRaw = (o: Obj | undefined): unknown => {
  if (!o) return null;
  const spec = objs(o.priceSpecification, 10).find((s) => s.price !== undefined && s.price !== null && s.price !== "");
  const v = o.price ?? spec?.price ?? o.lowPrice;
  return v === undefined || v === "" ? null : v;
};
const currencyRaw = (o: Obj | undefined): unknown => {
  if (!o) return null;
  const spec = objs(o.priceSpecification, 10).find((s) => typeof s.priceCurrency === "string");
  const v = o.priceCurrency ?? spec?.priceCurrency;
  return v === undefined || v === "" ? null : v;
};
/** The unit's main offer: the first with a price, else the first. */
const mainOffer = (u: Unit): Obj | undefined => u.offers.find((o) => priceRaw(o) !== null) ?? u.offers[0];

/** A price Google can read: a number, or a string of digits with an optional decimal point. */
function readPrice(v: unknown): { ok: true; n: number; text: string } | { ok: false; text: string } | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? { ok: true, n: v, text: String(v) } : { ok: false, text: String(v) };
  const s = typeof v === "string" ? v.trim() : textOf(v) ?? "";
  if (!s) return null;
  const short = s.slice(0, 40);
  return /^\d{1,12}(?:\.\d{1,6})?$/.test(short) ? { ok: true, n: Number(short), text: short } : { ok: false, text: clip(short, 40) };
}
const readCurrency = (v: unknown): { ok: boolean; text: string } | null => {
  const s = typeof v === "string" ? v.trim() : textOf(v);
  if (!s) return null;
  return /^[A-Za-z]{3}$/.test(s) ? { ok: true, text: s.toUpperCase() } : { ok: false, text: clip(s, 40) };
};

function hasImage(v: unknown): boolean {
  return list(v, 20).some((x) => (typeof x === "string" ? x.trim() !== "" : isObj(x) && (textOf(x.url) !== null || textOf(x.contentUrl) !== null)));
}

const GTIN_KEYS = ["gtin", "gtin8", "gtin12", "gtin13", "gtin14", "isbn"] as const;
const gtinOf = (n: Obj | undefined): string | null => {
  if (!n) return null;
  for (const k of GTIN_KEYS) {
    const t = textOf(n[k], 40);
    if (t) return t;
  }
  return null;
};

/** "InStock" -> "In stock", "NewCondition" -> "New condition". */
const humanize = (s: string) => {
  const words = bare(s).replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const availabilityOf = (o: Obj | undefined) => (o && typeof o.availability === "string" && o.availability.trim() ? bare(o.availability) : null);
const IN_STOCK = new Set(["instock", "limitedavailability", "onlineonly", "instoreonly"]);
const OUT_OF_STOCK = new Set(["outofstock", "soldout", "discontinued"]);

/** Up to three different values, "a, b, c…". */
function sampleValues(values: (string | null)[]): string | undefined {
  const seen = [...new Set(values.filter((v): v is string => !!v))];
  if (!seen.length) return undefined;
  return seen.slice(0, 3).join(", ") + (seen.length > 3 ? "…" : "");
}

const statusOf = (found: number, of: number): "found" | "partial" | "missing" => (of > 0 && found === of ? "found" : found > 0 ? "partial" : "missing");

function unitsOf(e: ProductEntity): { units: Unit[]; total: number; noun: "variant" | "offer" } {
  if (e.kind === "ProductGroup") {
    return { units: e.variants.slice(0, MAX_VARIANTS).map((v) => ({ node: v, offers: offersOf(v) })), total: e.variants.length, noun: "variant" };
  }
  const offers = offersOf(e.node);
  if (offers.length > 1) return { units: offers.slice(0, MAX_VARIANTS).map((o) => ({ node: e.node, offers: [o] })), total: offers.length, noun: "offer" };
  return { units: [{ node: e.node, offers }], total: 1, noun: "offer" };
}

/** Prices, currency and stock across the units, for the verdict, comparisons and the store record check. */
function priceFacts(units: Unit[]) {
  const prices: { n: number; text: string }[] = [];
  const currencies = new Set<string>();
  let anyIn = false;
  let known = 0;
  let allOut = true;
  for (const u of units) {
    for (const o of u.offers) {
      const p = readPrice(priceRaw(o));
      if (p?.ok) prices.push({ n: p.n, text: p.text });
      const c = readCurrency(currencyRaw(o));
      if (c?.ok) currencies.add(c.text);
      const a = availabilityOf(o)?.toLowerCase();
      if (!a) continue;
      known++;
      if (IN_STOCK.has(a)) anyIn = true;
      if (!OUT_OF_STOCK.has(a)) allOut = false;
    }
  }
  const stock: boolean | null = anyIn ? true : known && allOut ? false : null;
  return { prices, currencies: [...currencies], stock };
}

/** "24.00 USD" or "24.00 to 34.00 USD". */
function priceText(prices: { n: number; text: string }[], currencies: string[]): string | null {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a.n - b.n);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const range = high.n - low.n > 0.005 ? `${low.text} to ${high.text}` : low.text;
  return currencies.length ? `${range} ${currencies.join(", ")}` : range;
}

/** Facts one product block states, for comparing blocks. */
function summarize(e: ProductEntity) {
  const { units } = unitsOf(e);
  const facts = priceFacts(units);
  const low = facts.prices.length ? Math.min(...facts.prices.map((p) => p.n)) : null;
  return {
    summary: {
      type: e.kind,
      name: textOf(e.node.name),
      price: priceText(facts.prices, facts.currencies),
      stock: facts.stock === null ? null : facts.stock ? STOCK.in : STOCK.out,
    } satisfies BlockSummary,
    low,
    currencies: facts.currencies,
    stock: facts.stock,
  };
}

const sameName = (a: string, b: string) => {
  const x = a.toLowerCase().replace(/\s+/g, " ").trim();
  const y = b.toLowerCase().replace(/\s+/g, " ").trim();
  return x.includes(y) || y.includes(x);
};

/** How main and other disagree on name, price, currency or stock (empty when they agree). */
function disagreements(main: ReturnType<typeof summarize>, other: ReturnType<typeof summarize>): string[] {
  const out: string[] = [];
  const a = main.summary;
  const b = other.summary;
  if (a.name && b.name && !sameName(a.name, b.name)) out.push(PROBLEM.disagreeName(a.name, b.name));
  // Prices are only compared in the same currency (a different currency is its own disagreement).
  const otherCurrency = main.currencies.length > 0 && other.currencies.length > 0 && main.currencies.join() !== other.currencies.join();
  const priceOff = main.low !== null && other.low !== null && Math.abs(main.low - other.low) > 0.01;
  if (priceOff && !otherCurrency && a.price && b.price) out.push(PROBLEM.disagreePrice(a.price, b.price));
  if (otherCurrency) out.push(PROBLEM.disagreeCurrency(main.currencies.join(", "), other.currencies.join(", ")));
  if (main.stock !== null && other.stock !== null && main.stock !== other.stock && a.stock && b.stock) out.push(PROBLEM.disagreeStock(a.stock, b.stock));
  return out;
}

/** How complete a product block is, to pick the one we report on. */
const completeness = (e: ProductEntity) => (e.kind === "ProductGroup" ? 1_000 + e.variants.length : 0) + (offersOf(e.node).length ? 100 : 0) + Object.keys(e.node).length;

const LISTING_PATH = /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?\/)?(?:collections|search|blogs|pages|cart)(?:\/|$)/i;
/** A link that is plainly not one product: the home page, a collection, search, blog or page. */
export function looksLikeListingUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.slice(0, 300);
    return !/\/products\//i.test(path) && (path === "/" || path === "" || LISTING_PATH.test(path));
  } catch {
    return false;
  }
}

const TONE_ORDER: Record<ProblemTone, number> = { bad: 0, warn: 1, info: 2 };

/**
 * Check the product data against Google's required and recommended facts and look for the problems Shopify
 * stores really have: blocks that disagree, typos, prices with symbols, and data that doesn't match the
 * store's own record. `url` is the page we fetched (link mode), for the "not a product page" note.
 */
export function evaluate(x: Extracted, record: ShopifyRecord | null = null, opts: { url?: string } = {}): SchemaReport {
  const where = WHERE[x.source];
  const pasted = x.source === "json";
  const problems: Problem[] = [];
  const notes: string[] = [];
  if (x.invalid) {
    problems.push({ id: "invalid", tone: x.invalidProduct ? "bad" : "warn", text: pasted ? PROBLEM.invalidPasted : PROBLEM.invalid(x.invalid, x.invalidProduct > 0) });
  }

  // The page's own products. Products inside a list (a collection, or "related products" on a product page)
  // only count when the page has nothing else.
  const own = x.entities.filter((e) => !x.fromList.has(e));
  const pool = own.length ? own : x.entities;
  const names = new Set(pool.map((e) => textOf(e.node.name)?.toLowerCase()).filter(Boolean));
  const listing = (own.length === 0 && x.listed > 0) || names.size >= 3 || (opts.url ? looksLikeListingUrl(opts.url) : false);
  if (listing) problems.push({ id: "not-product", tone: "info", text: PROBLEM.notProduct });
  if (x.microdata) problems.push({ id: "microdata", tone: "info", text: PROBLEM.microdata });
  // The ItemList that holds listed products is reported with them, not as other data.
  const otherTypes = x.listed ? x.others.filter((t) => t !== "ItemList") : x.others;
  const othersLine = otherTypes.length ? FOUND.others(joinLabels(otherTypes.slice(0, 4))) : null;

  if (!x.entities.length) {
    if (othersLine) notes.push(othersLine);
    // A product block with a typo is product data Google can't read, not "no product data".
    const verdict: SchemaReport["verdict"] = x.invalidProduct
      ? { state: "broken", headline: VERDICT.broken }
      : x.microdata
        ? { state: "unread", headline: VERDICT.microdata }
        : { state: "none", headline: pasted ? VERDICT.nonePasted : VERDICT.nonePage };
    return {
      source: x.source,
      kind: null,
      units: 0,
      unitNoun: "offer",
      verdict,
      found: pasted
        ? x.invalid
          ? FOUND.pastedUnreadable
          : FOUND.pastedNoProduct
        : x.jsonLd
          ? FOUND.noProduct(x.jsonLd, where, x.invalid > 0)
          : FOUND.noJsonLd(where),
      notes,
      fields: [],
      problems: sortProblems(problems),
      microdata: x.microdata,
      listing,
      json: null,
    };
  }

  const main = [...pool].sort((a, b) => completeness(b) - completeness(a))[0];
  const others = pool.filter((e) => e !== main);
  if (own.length && x.fromList.size) notes.push(FOUND.listed(x.fromList.size));
  const { units, total, noun } = unitsOf(main);
  if (main.kind === "ProductGroup" && total > MAX_VARIANTS) problems.push({ id: "many-variants", tone: "info", text: PROBLEM.manyVariants(total) });

  // Other product blocks: do they agree with the one we report on? (A collection page lists many on purpose.)
  if (others.length && !listing) {
    const m = summarize(main);
    let clash: { parts: string[]; other: ReturnType<typeof summarize> } | null = null;
    for (const e of others) {
      const o = summarize(e);
      const parts = disagreements(m, o);
      if (parts.length) {
        clash = { parts, other: o };
        break;
      }
    }
    if (clash) {
      problems.push({ id: "disagree", tone: "bad", text: PROBLEM.disagree(pool.length, joinLabels(clash.parts)), compare: [m.summary, clash.other.summary] });
    } else {
      notes.push(FOUND.agreeing(others.length));
    }
  }
  if (othersLine) notes.push(othersLine);

  // Facts from the page's other blocks about this product count (an app may add the rating); on a
  // collection page the other products are different products, so only the one shown counts.
  const fields = checkFields(main, units, listing ? [main] : pool, problems);
  const facts = priceFacts(units);

  // Shopify's own record: prices and stock should match what the data says.
  if (record) {
    if (record.prices.length && facts.prices.length && facts.currencies.length <= 1) {
      const off = facts.prices.find((p) => !record.prices.some((r) => Math.abs(r - p.n) <= 0.01));
      if (off) {
        const cur = facts.currencies[0] ? ` ${facts.currencies[0]}` : "";
        const lo = Math.min(...record.prices);
        const hi = Math.max(...record.prices);
        const theirs = hi - lo > 0.005 ? `${lo.toFixed(2)} to ${hi.toFixed(2)}${cur}` : `${lo.toFixed(2)}${cur}`;
        problems.push({ id: "record-price", tone: "bad", text: PROBLEM.recordPrice(`${off.text}${cur}`, theirs) });
      }
    }
    if (record.available === false && facts.stock === true) problems.push({ id: "record-stock", tone: "bad", text: PROBLEM.recordInStock });
    if (record.available === true && facts.stock === false) problems.push({ id: "record-stock", tone: "bad", text: PROBLEM.recordOutOfStock });
    // Barcodes only when we checked every variant (a product with more than 100 would undercount).
    const inData = fields.find((f) => f.id === "gtin")?.found ?? 0;
    if (record.barcodes !== null && record.variants > 0 && total <= MAX_VARIANTS && record.barcodes > inData) {
      problems.push({ id: "record-barcodes", tone: "warn", text: PROBLEM.barcodes(record.barcodes, record.variants, inData) });
    }
  }

  const sorted = sortProblems(problems);
  const missing = fields.filter((f) => f.group === "required" && f.status !== "found").length;
  const serious = sorted.filter((p) => p.tone === "bad").length;
  // A collection or home page: what we found is shown, but "ready" would mislead.
  const verdict: SchemaReport["verdict"] = listing
    ? { state: "problems", headline: VERDICT.notProduct }
    : missing
      ? { state: "missing", headline: VERDICT.missing(missing) }
      : serious
        ? { state: "problems", headline: VERDICT.problems(serious) }
        : { state: "ready", headline: VERDICT.ready };

  return {
    source: x.source,
    kind: main.kind,
    units: total,
    unitNoun: noun,
    verdict,
    found:
      listing && pool.length > 1
        ? FOUND.listing(pool.length, where)
        : main.kind === "ProductGroup"
          ? FOUND.group(total, where)
          : FOUND.product(total, where),
    notes,
    fields,
    problems: sorted,
    microdata: false,
    listing,
    json: prettyJson(x.productBlocks),
  };
}

const sortProblems = (p: Problem[]) => [...p].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);

function prettyJson(blocks: unknown[]): string | null {
  if (!blocks.length) return null;
  try {
    const s = JSON.stringify(blocks.length === 1 ? blocks[0] : blocks, null, 2);
    return s.length > MAX_JSON_SHOWN ? `${s.slice(0, MAX_JSON_SHOWN)}\n…` : s;
  } catch {
    return null; // nested too deeply to print: the checks above still ran
  }
}

/** Every fact row, in page order. Adds price and currency format problems to `problems`. */
function checkFields(main: ProductEntity, units: Unit[], all: ProductEntity[], problems: Problem[]): FieldRow[] {
  const rows: FieldRow[] = [];
  const group = main.kind === "ProductGroup";
  const node = main.node;
  const of = units.length;
  const add = (row: FieldRow) => rows.push(row);
  const yes = (ok: boolean) => (ok ? "yes" : null);

  /**
   * A per-unit fact: Found, Some variants only, or Missing (`none` is the softer word some facts use when
   * they're missing everywhere). `shown` leaves out the value for yes/no facts like "has an image".
   */
  const perUnit = (id: FieldId, g: FieldGroupId, get: (u: Unit) => string | null, opts: { none?: FieldStatus; shown?: boolean } = {}) => {
    const values = units.map(get);
    const found = values.filter(Boolean).length;
    const status = statusOf(found, of);
    add({ id, group: g, status: status === "missing" ? (opts.none ?? "missing") : status, value: opts.shown === false ? undefined : sampleValues(values), found, of });
  };
  /** A fact on the product (or the group), else on every variant. */
  const onProduct = (id: FieldId, g: FieldGroupId, own: string | null, perVariant: (n: Obj) => string | null) => {
    if (own) return add({ id, group: g, status: "found", value: own });
    if (group && of) return perUnit(id, g, (u) => perVariant(u.node));
    add({ id, group: g, status: "missing" });
  };
  /** A fact on the product, a variant or another product block: found anywhere counts. */
  const anywhere = (id: FieldId, get: (n: Obj) => string | null, none: FieldStatus = "missing") => {
    const value = sampleValues([get(node), ...units.map((u) => get(u.node)), ...all.filter((e) => e !== main).map((e) => get(e.node))]);
    add(value ? { id, group: "extra", status: "found", value } : { id, group: "extra", status: none });
  };

  // ----- Needed by Google -----
  const name = textOf(node.name);
  add(name ? { id: "name", group: "required", status: "found", value: name } : { id: "name", group: "required", status: "missing" });
  if (group) {
    perUnit("variantName", "required", (u) => textOf(u.node.name));
    perUnit("image", "required", (u) => yes(hasImage(u.node.image)), { shown: false });
  } else {
    add(hasImage(node.image) ? { id: "image", group: "required", status: "found", value: plural(list(node.image, 20).length, "image") } : { id: "image", group: "required", status: "missing" });
  }
  perUnit("offers", "required", (u) => yes(u.offers.length > 0), { shown: false });

  // Price and currency: a value Google can't read ("$24.00", "dollars") is its own status and a problem.
  let badPrice: string | null = null;
  const prices: { n: number; text: string }[] = [];
  let badCurrency: string | null = null;
  const currencies: string[] = [];
  let curFound = 0;
  for (const u of units) {
    const o = mainOffer(u);
    const p = readPrice(priceRaw(o));
    if (p?.ok) prices.push(p);
    else if (p) badPrice ??= p.text;
    const c = readCurrency(currencyRaw(o));
    if (c?.ok) {
      curFound++;
      if (!currencies.includes(c.text)) currencies.push(c.text);
    } else if (c) badCurrency ??= c.text;
  }
  if (badPrice !== null) {
    add({ id: "price", group: "required", status: "unreadable", value: badPrice });
    problems.push({ id: "price-format", tone: "bad", text: PROBLEM.priceFormat(badPrice) });
  } else {
    add({ id: "price", group: "required", status: statusOf(prices.length, of), value: priceText(prices, currencies) ?? undefined, found: prices.length, of });
  }
  if (badCurrency !== null) {
    add({ id: "currency", group: "required", status: "unreadable", value: badCurrency });
    problems.push({ id: "currency-format", tone: "bad", text: PROBLEM.currencyFormat(badCurrency) });
  } else {
    add({ id: "currency", group: "required", status: statusOf(curFound, of), value: currencies.join(", ") || undefined, found: curFound, of });
  }

  // ----- Recommended by Google -----
  onProduct("brand", "recommended", textOf(node.brand), (n) => textOf(n.brand));
  onProduct("description", "recommended", textOf(node.description, 140), (n) => textOf(n.description, 140));
  perUnit("availability", "recommended", (u) => {
    const a = availabilityOf(mainOffer(u));
    return a ? humanize(a) : null;
  });
  // IDs sit on the variant (or product), and older themes put them on the offer.
  const idFact = (get: (n: Obj) => string | null) => (u: Unit) => {
    const o = mainOffer(u);
    return get(u.node) ?? (o ? get(o) : null);
  };
  perUnit("gtin", "recommended", idFact(gtinOf));
  perUnit("sku", "recommended", idFact((n) => textOf(n.sku, 60)));
  perUnit("mpn", "recommended", idFact((n) => textOf(n.mpn, 60)));
  perUnit("condition", "recommended", (u) => {
    const c = textOf(mainOffer(u)?.itemCondition, 80);
    return c ? humanize(c) : null;
  });
  const offerUrl = (u: Unit) => textOf(mainOffer(u)?.url, 300);
  perUnit("url", "recommended", offerUrl, { shown: false });
  rows[rows.length - 1].value = units.map(offerUrl).find(Boolean) ?? undefined; // one link is enough to show
  if (group) {
    onProduct("productGroupID", "recommended", textOf(node.productGroupID, 60), (n) => textOf(n.inProductGroupWithID, 60));
    const varies = list(node.variesBy, 10)
      .map((v) => (typeof v === "string" && v.trim() ? humanize(v) : null))
      .filter((v): v is string => !!v);
    add(varies.length ? { id: "variesBy", group: "recommended", status: "found", value: varies.join(", ") } : { id: "variesBy", group: "recommended", status: "missing" });
  }
  const saleEnd = sampleValues(units.map((u) => textOf(mainOffer(u)?.priceValidUntil, 40)));
  add(saleEnd ? { id: "saleEnd", group: "recommended", status: "found", value: saleEnd } : { id: "saleEnd", group: "recommended", status: "not-needed" });
  // Shipping and returns can be set store-wide or in Merchant Center: "not on this page", never "missing".
  perUnit("shipping", "recommended", (u) => yes(objs(mainOffer(u)?.shippingDetails, 5).length > 0), { none: "not-on-page", shown: false });
  perUnit("returns", "recommended", (u) => yes(objs(mainOffer(u)?.hasMerchantReturnPolicy, 5).length > 0), { none: "not-on-page", shown: false });
  // Reviews: never a problem when missing (only real reviews may be marked up).
  const rated = [...units.map((u) => u.node), ...all.map((e) => e.node)].find((n) => isObj(n.aggregateRating) || objs(n.review, 1).length > 0);
  if (rated) {
    const r = isObj(rated.aggregateRating) ? rated.aggregateRating : null;
    add({ id: "reviews", group: "recommended", status: "found", value: reviewsValue(r ? textOf(r.ratingValue, 10) : null, r ? textOf(r.reviewCount ?? r.ratingCount, 12) : null) });
  } else {
    add({ id: "reviews", group: "recommended", status: "none" });
  }

  // ----- Extra facts AI shopping tools can use (our advice) -----
  anywhere("category", (n) => textOf(n.category));
  anywhere("color", (n) => textOf(n.color, 60));
  anywhere("size", (n) => textOf(n.size, 60));
  anywhere("material", (n) => textOf(n.material, 60));
  anywhere("audience", (n) => (n.audience === undefined || n.audience === null ? null : (textOf(n.audience, 60) ?? audienceText(n.audience))));
  // Only a real certification belongs here, so its absence is "None", never "Missing".
  anywhere("certification", (n) => (n.hasCertification === undefined || n.hasCertification === null ? null : (textOf(n.hasCertification, 80) ?? "Found")), "none");
  return rows;
}

/** A PeopleAudience without a name: "Male, 18+" from its gender and ages, or "Found". */
function audienceText(v: unknown): string {
  const a = objs(v, 1)[0];
  if (!a) return "Found";
  const parts = [textOf(a.suggestedGender, 20), textOf(a.audienceType, 40), a.suggestedMinAge !== undefined ? `${textOf(a.suggestedMinAge, 4)}+` : null].filter(Boolean);
  return parts.length ? parts.join(", ") : "Found";
}

/** Read and check pasted text or a fetched page in one step. */
export function checkSchema(text: string, opts: { source?: InputSource; record?: ShopifyRecord | null; url?: string } = {}): SchemaReport {
  return evaluate(extractNodes(text, opts.source ?? detectSource(text)), opts.record ?? null, { url: opts.url });
}

/** How many facts Google needs are missing (tests and the page's announcement). */
export const missingRequired = (r: SchemaReport) => r.fields.filter((f) => f.group === "required" && f.status !== "found").length;
