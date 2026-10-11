// Load the signed-in shop (and make sure we have a row for it).

import db from "../db.server";
import { authenticate } from "../shopify.server";
import { getPlan } from "./plans";
import { refreshShopInfo } from "./install.server";

export async function requireShop(request: Request) {
  const ctx = await authenticate.admin(request);
  let shop = await db.shop.findUnique({ where: { domain: ctx.session.shop } });
  // No row yet, or only the bare row saved when reading the shop failed at install (no name, no real
  // country or currency): read it from Shopify now.
  if (!shop || !shop.name) shop = await refreshShopInfo(ctx.session.shop, ctx.admin).catch((err) => {
    if (!shop) throw err;
    console.error(`[shop] couldn't refresh ${ctx.session.shop}: ${(err as Error).message}`);
    return shop;
  });
  if (shop.status !== "installed") {
    shop = await db.shop.update({
      where: { id: shop.id },
      data: { status: "installed", uninstalledAt: null },
    });
  }
  return { ...ctx, shop, plan: getPlan(shop.plan) };
}

export { getUsageFor as getUsage } from "./usage.server";
