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
  const country = s.shopAddress?.countryCodeV2 || "AU";
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
      country,
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
    // Make sure there is at least a row so the app can load.
    await db.shop.upsert({
      where: { domain: session.shop },
      create: { domain: session.shop },
      update: { status: "installed", uninstalledAt: null },
    });
  }
}
