// Any business in the agency hub (Ross, 17 Nov 2026: "so i can add any business"). A client whose website isn't a
// Shopify store (a mortgage broker, a solar installer, a tradie) is a "local" shop: no product list, no tracking code
// yet, buying questions about their kind of business in their town or city, and guides without products in them.
// Pure rules; the website is read in clients.server.ts.

export type ShopKind = "store" | "local";

/** A business that isn't an online store. */
export const isLocal = (shop: { kind?: string | null } | null | undefined) => shop?.kind === "local";

/** The town or city they work in, as typed: one short line, or null. */
export function cleanArea(raw: unknown): string | null {
  const s = String(raw ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.slice(0, 60) : null;
}

/** Where a local business's questions are asked: their town or city when we know it, else the country. */
export const placeFor = (shop: { kind?: string | null; area?: string | null }, countryName: string) => (isLocal(shop) && shop.area ? shop.area : countryName);

/** Signs a page is a Shopify store's: then it should have been read as a store, so we don't add it as a business. */
export const looksLikeShopify = (html: string) => /cdn\.shopify\.com|Shopify\.theme|shopify-section|myshopify\.com/i.test(html.slice(0, 400_000));

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "’")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The business's name from its home page: its og:site_name, else the part of the page title before a separator
 * ("Lee Finance | Mortgage Broker Perth" -> "Lee Finance"). Null when the page has neither.
 */
export function siteName(html: string): string | null {
  const head = html.slice(0, 200_000);
  const og =
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{2,120})/i.exec(head)?.[1] ??
    /<meta[^>]+content=["']([^"']{2,120})["'][^>]+property=["']og:site_name["']/i.exec(head)?.[1];
  if (og && decode(og)) return decode(og).slice(0, 80);
  const title = /<title[^>]*>([\s\S]{2,300}?)<\/title>/i.exec(head)?.[1];
  if (!title) return null;
  const first = decode(title)
    .split(/\s+[|·•–—-]\s+|\s*\|\s*/)[0]
    ?.trim();
  return first && first.length >= 2 ? first.slice(0, 80) : null;
}
