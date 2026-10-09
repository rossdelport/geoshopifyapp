// Web Pixel: counts store visits and spots the ones that came from AI assistants.

import db from "../db.server";
import { env } from "./env.server";
import { gql, assertNoUserErrors, type AdminClient } from "./shopify-gql.server";

const CREATE = `#graphql
  mutation CreatePixel($webPixel: WebPixelInput!) {
    webPixelCreate(webPixel: $webPixel) { webPixel { id settings } userErrors { field message } }
  }`;
const UPDATE = `#graphql
  mutation UpdatePixel($id: ID!, $webPixel: WebPixelInput!) {
    webPixelUpdate(id: $id, webPixel: $webPixel) { webPixel { id } userErrors { field message } }
  }`;

export async function ensurePixel(shopId: string, shopDomain: string, admin: AdminClient) {
  if (!env.appUrl) return;
  const settings = JSON.stringify({ accountID: shopDomain, endpoint: `${env.appUrl}/api/pixel` });
  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { pixelId: true } });

  if (shop?.pixelId) {
    const data = await gql(admin, UPDATE, { id: shop.pixelId, webPixel: { settings } });
    if (!data.webPixelUpdate.userErrors.length) return;
  }
  const data = await gql(admin, CREATE, { webPixel: { settings } });
  const result = data.webPixelCreate;
  if (result.userErrors.some((e: { message: string }) => /taken|exist/i.test(e.message))) {
    // A pixel from an earlier install is still there: find it and update its settings.
    const existing = await gql(admin, `#graphql
      query AppPixel { webPixel { id } }`);
    const id = existing.webPixel?.id;
    if (!id) return;
    assertNoUserErrors((await gql(admin, UPDATE, { id, webPixel: { settings } })).webPixelUpdate);
    await db.shop.update({ where: { id: shopId }, data: { pixelId: id } });
    return;
  }
  assertNoUserErrors(result);
  await db.shop.update({ where: { id: shopId }, data: { pixelId: result.webPixel.id } });
}
