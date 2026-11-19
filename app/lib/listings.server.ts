// Listing sites for a local business (lib/listings.ts has the rules and the starter list): the sites AI quoted in the
// client's own checks, joined with what Ross marked, and the business details to copy onto each one.

import type { Client, Shop } from "@prisma/client";
import db from "../db.server";
import { trustedSites } from "./trusted-sites.server";
import { type ListingItem, cleanListingUrl, listingPlan, siteKey } from "./listings";

/** Every listing site for this client, in the order to do them. */
export async function listingsFor(shopId: string): Promise<ListingItem[]> {
  const [shop, sites, rows] = await Promise.all([
    db.shop.findUniqueOrThrow({ where: { id: shopId }, select: { profile: { select: { category: true, summary: true } } } }),
    trustedSites(shopId, 60),
    db.listing.findMany({ where: { shopId } }),
  ]);
  const aiSites = sites.filter((s) => s.kind === "directory").map((s) => ({ domain: s.domain, answers: s.answers, url: s.page.url }));
  const trade = `${shop.profile?.category ?? ""} ${shop.profile?.summary ?? ""}`;
  return listingPlan({ trade, aiSites, rows });
}

/** Mark a site Listed (with their page's link), Not for them, or back to do. */
export async function setListing(shopId: string, domain: unknown, status: "listed" | "skip" | "todo", url: unknown, by: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof domain !== "string" || !domain || domain.length > 200) return { ok: false, error: "That site isn’t on the list." };
  const key = siteKey(domain);
  if (status === "todo") {
    await db.listing.deleteMany({ where: { shopId, domain: key } });
    return { ok: true };
  }
  const link = status === "listed" ? cleanListingUrl(url, key) : null;
  if (status === "listed" && typeof url === "string" && url.trim() && !link) return { ok: false, error: `Paste their page’s address on ${key}, or leave it empty.` };
  await db.listing.upsert({
    where: { shopId_domain: { shopId, domain: key } },
    create: { shopId, domain: key, status, url: link, createdBy: by },
    update: { status, url: link, createdBy: by },
  });
  return { ok: true };
}

/** The details to put on every listing, the same each time (Google and AI check they match). */
export function listingDetails(shop: Shop & { profile: { brandName: string | null; summary: string | null } | null }, client: Client | null) {
  const host = shop.primaryDomain ?? shop.domain;
  return [
    { label: "Business name", value: shop.profile?.brandName ?? shop.name ?? host },
    { label: "Website", value: `https://${host}` },
    { label: "Town or area", value: shop.area ?? "" },
    { label: "Phone (check it’s the business number)", value: client?.phone ?? "" },
    { label: "Email", value: (client?.email ?? "").split(",")[0]?.trim() ?? "" },
    { label: "What they do", value: shop.profile?.summary ?? "" },
    { label: "Facts", value: shop.facts ?? "" },
  ].filter((d) => d.value);
}
