// Runs after every OAuth (install or re-auth): save the shop, switch on AI click tracking.
// A store that is new (or coming back after uninstalling) also emails GEO_ALERT_EMAIL (job "install.notice").

import type { Session } from "@shopify/shopify-api";
import db from "../db.server";
import { gql, type AdminClient } from "./shopify-gql.server";
import { ensurePixel } from "./pixel.server";
import { env } from "./env.server";
import { enqueue, registerJob } from "./jobs.server";
import { emailConfigured, sendEmail } from "./email.server";

const SHOP_QUERY = `#graphql
  query ShopInfo {
    shop {
      name
      email
      currencyCode
      myshopifyDomain
      primaryDomain { host url }
      shopAddress { countryCodeV2 }
      plan { partnerDevelopment }
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
      devStore: Boolean(s.plan?.partnerDevelopment),
    },
    update: {
      name: s.name,
      email: s.email,
      currency: s.currencyCode,
      ...(existing?.name ? {} : { country }),
      primaryDomain: s.primaryDomain?.host ?? null,
      devStore: Boolean(s.plan?.partnerDevelopment),
      status: "installed",
      uninstalledAt: null,
    },
  });
}

export async function onInstalled(session: Session, admin: AdminClient) {
  const before = await db.shop.findUnique({ where: { domain: session.shop }, select: { status: true } });
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
  // Only a new install (or a return), never a re-login.
  if (before?.status !== "installed") await tellFounderNewStore(session.shop, Boolean(before));
}

async function tellFounderNewStore(domain: string, again: boolean) {
  if (!env.alertEmail || !emailConfigured()) {
    console.log(`[install] new store ${domain} (set GEO_ALERT_EMAIL to get an email for each one)`);
    return;
  }
  await enqueue("install.notice", { domain, again }, { dedupeKey: `install-notice:${domain}` }).catch((err) =>
    console.error(`[install] could not queue the new store email for ${domain}:`, err.message),
  );
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The email to GEO_ALERT_EMAIL when a store installs GEO (exported for tests). */
export function installNoticeEmail(
  s: { domain: string; name: string | null; email: string | null; country: string; devStore: boolean },
  again: boolean,
): { subject: string; html: string } {
  const store = s.name ? `${s.name} (${s.domain})` : s.domain;
  const lines = [
    `<b>Store:</b> ${esc(store)}`,
    `<b>Contact email:</b> ${esc(s.email ?? "not known")}`,
    `<b>Country:</b> ${esc(s.country)}`,
  ];
  if (s.devStore) lines.push("<b>Test store:</b> yes (a Shopify development store, never charged)");
  if (again) lines.push("They had GEO before and came back.");
  return { subject: `New store installed GEO: ${store}`, html: `<p>${lines.join("<br>")}</p>` };
}

registerJob("install.notice", async (job) => {
  const p = job.payload as { domain?: string; again?: boolean };
  const shop = await db.shop.findUnique({ where: { domain: String(p.domain ?? "") } });
  if (!shop) return; // deleted since
  if (!env.alertEmail || !emailConfigured()) throw new Error("GEO_ALERT_EMAIL or email is not set up");
  const { subject, html } = installNoticeEmail(shop, Boolean(p.again));
  await sendEmail([env.alertEmail], subject, html);
});
