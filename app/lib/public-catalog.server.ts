// Shopify stores on the GEO web app, read from their public pages only (no Shopify app connection needed):
// /meta.json (shop name, myshopify address, country, currency) and /products.json (the catalog every Shopify store
// shows publicly). Product ids are the same as in the Admin API, so a later Shopify connection matches the rows.

import db from "../db.server";
import { safeFetch } from "./check.server";

export const STORE_ERRORS = {
  address: "Please type your store’s address, like yourstore.com.",
  notShopify: "We couldn’t find a Shopify store at that address. Please check it and try again.",
  taken: "That store is already on GEO under another email. Ask the person who added it, or email ross@usegeo.app.",
};

/** "https://www.Store.com/products/x?y" -> "www.store.com". Null when it isn't a web address. */
export function storeHost(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase().slice(0, 300);
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//.test(s) ? s : `https://${s}`);
    const host = u.hostname.replace(/\.$/, "");
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host) && /\.[a-z]{2,}$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

export interface FoundStore {
  myshopifyDomain: string;
  host: string; // the address the store really lives at (after redirects)
  name: string | null;
  country: string | null;
  currency: string | null;
}

/** Shopify's /meta.json for a typed address, or null when it isn't a Shopify store. */
export async function findShopifyStore(host: string): Promise<FoundStore | null> {
  try {
    const res = await safeFetch(`https://${host}/meta.json`, "application/json", { timeoutMs: 10_000, maxRedirects: 4, maxBytes: 200_000 });
    if (res.status !== 200) return null;
    return parseMeta(JSON.parse(res.text), new URL(res.url).hostname);
  } catch {
    return null;
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- public JSON of any shape */
export function parseMeta(json: any, host: string): FoundStore | null {
  if (!json || typeof json !== "object") return null;
  const d = typeof json.myshopify_domain === "string" ? json.myshopify_domain.trim().toLowerCase() : "";
  if (!/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(d)) return null;
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const country = text(json.country, 2);
  const currency = text(json.currency, 3);
  return {
    myshopifyDomain: d,
    host,
    name: text(json.name, 120),
    country: country && /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : null,
    currency: currency && /^[a-z]{3}$/i.test(currency) ? currency.toUpperCase() : null,
  };
}

export interface PublicProduct {
  gid: string;
  title: string;
  handle: string;
  productType: string | null;
  vendor: string | null;
  tags: string[];
  description: string | null;
  price: string | null;
  imageUrl: string | null;
}

const stripHtml = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h\d|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "’")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();

/** One product from /products.json, in the shape our product cache keeps. */
export function parsePublicProduct(p: any, currency: string | null): PublicProduct | null {
  if (!p || typeof p !== "object" || typeof p.title !== "string" || typeof p.handle !== "string") return null;
  const id = typeof p.id === "number" || /^\d+$/.test(String(p.id)) ? String(p.id) : null;
  if (!id) return null;
  const prices = (Array.isArray(p.variants) ? p.variants : [])
    .map((v: any) => Number(v?.price))
    .filter((n: number) => Number.isFinite(n) && n >= 0);
  const tags = Array.isArray(p.tags) ? p.tags : typeof p.tags === "string" ? p.tags.split(",") : [];
  const description = typeof p.body_html === "string" ? stripHtml(p.body_html).slice(0, 5000) : "";
  return {
    gid: `gid://shopify/Product/${id}`,
    title: p.title.trim().slice(0, 300),
    handle: p.handle.slice(0, 300),
    productType: typeof p.product_type === "string" && p.product_type.trim() ? p.product_type.trim() : null,
    vendor: typeof p.vendor === "string" && p.vendor.trim() ? p.vendor.trim() : null,
    tags: tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 30),
    description: description || null,
    price: prices.length ? `${Math.min(...prices).toFixed(2)}${currency ? ` ${currency}` : ""}` : null,
    imageUrl: typeof p.images?.[0]?.src === "string" ? p.images[0].src : null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Save up to `max` products from the store's public /products.json into our cache (250 a page). When the whole
 * catalog was read, products that are no longer listed are marked DELETED, like the Shopify sync does.
 */
export async function syncPublicCatalog(shopId: string, max = 250): Promise<number> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const host = shop.primaryDomain || shop.domain;
  const started = new Date();
  let count = 0;
  let complete = false;
  for (let page = 1; page <= 20 && count < max; page++) {
    const res = await safeFetch(`https://${host}/products.json?limit=250&page=${page}`, "application/json", { timeoutMs: 15_000, maxRedirects: 3 });
    if (res.status !== 200) throw new Error(`products.json answered ${res.status}`);
    const list: unknown[] = JSON.parse(res.text)?.products ?? [];
    for (const raw of list) {
      if (count >= max) break;
      const p = parsePublicProduct(raw, shop.currency);
      if (!p) continue;
      const values = { ...p, status: "ACTIVE", syncedAt: new Date() };
      await db.product.upsert({
        where: { shopId_gid: { shopId, gid: p.gid } },
        create: { shopId, ...values },
        update: values,
      });
      count++;
    }
    if (list.length < 250) {
      complete = count < max || list.length === 0;
      break;
    }
  }
  if (complete) {
    await db.product.updateMany({ where: { shopId, syncedAt: { lt: started }, NOT: { status: "DELETED" } }, data: { status: "DELETED" } });
  }
  return count;
}

/** Add a store to a GEO account (or give back the one it already has). */
export async function addWebStore(
  userId: string,
  found: FoundStore,
): Promise<{ ok: true; shopId: string; isNew: boolean } | { ok: false; error: string }> {
  const existing = await db.shop.findUnique({ where: { domain: found.myshopifyDomain } });
  if (existing) {
    if (existing.userId === userId) return { ok: true, shopId: existing.id, isNew: false };
    // Anyone can type any address, so a store already on GEO (another account, or installed from Shopify with
    // its orders) is never handed to whoever typed it.
    return { ok: false, error: STORE_ERRORS.taken };
  }
  const shop = await db.shop.create({
    data: {
      domain: found.myshopifyDomain,
      primaryDomain: found.host,
      name: found.name,
      source: "web",
      userId,
      status: "installed",
      ...(found.country ? { country: found.country } : {}),
      ...(found.currency ? { currency: found.currency } : {}),
    },
  });
  return { ok: true, shopId: shop.id, isNew: true };
}
