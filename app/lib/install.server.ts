// Runs after every OAuth (install or re-auth): save the shop, switch on AI click tracking.

import type { Session } from "@shopify/shopify-api";
import db from "../db.server";
import { gql, type AdminClient } from "./shopify-gql.server";
import { ensurePixel } from "./pixel.server";

const SHOP_QUERY = `#graphql
  query ShopInfo {
    shop {
      name
      email
      currencyCode
      myshopifyDomain
      primaryDomain { host url }
      shopAddress { countryCodeV2 }
    }
  }`;

export async function refreshShopInfo(domain: string, admin: AdminClient) {
  const data = await gql(admin, SHOP_QUERY);
  const s = data.shop;
  const country = s.shopAddress?.countryCodeV2 || "US"; // stores sell worldwide; Shopify nearly always gives the country
  // The country is "where your customers are" (Settings): the store may have changed it from its address.
  // This runs on every login, so only a store we never read properly (no name yet) takes Shopify's.
  const existing = await db.shop.findUnique({ where: { domain }, select: { name: true } });
  return db.shop.upsert({
    where: { domain },
    create: {
      domain,
      name: s.name,
      email: s.email,
      currency: s.currencyCode,
      country,
      primaryDomain: s.primaryDomain?.host ?? null,
      reportEmails: s.email,
    },
    update: {
      name: s.name,
      email: s.email,
      currency: s.currencyCode,
      ...(existing?.name ? {} : { country }),
      primaryDomain: s.primaryDomain?.host ?? null,
      status: "installed",
      uninstalledAt: null,
    },
  });
}

export async function onInstalled(session: Session, admin: AdminClient) {
  try {
    const shop = await refreshShopInfo(session.shop, admin);
    await ensurePixel(shop.id, shop.domain, admin).catch((err) =>
      console.error(`[install] pixel setup failed for ${shop.domain}:`, err.message),
    );
  } catch (err) {
    console.error(`[install] failed for ${session.shop}:`, (err as Error).message);
    // Make sure there is at least a row so the app can load. Stores sell worldwide: never assume a
    // country from the database defaults; the real country and currency arrive on the next load
    // (requireShop refreshes a shop that has no name yet).
    await db.shop.upsert({
      where: { domain: session.shop },
      create: { domain: session.shop, country: "US", currency: "USD" },
      update: { status: "installed", uninstalledAt: null },
    });
  }
}
