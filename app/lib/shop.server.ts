// Load the signed-in shop (and make sure we have a row for it).

import db from "../db.server";
import { authenticate } from "../shopify.server";
import { getPlan } from "./plans";
import { refreshShopInfo } from "./install.server";

export async function requireShop(request: Request) {
  const ctx = await authenticate.admin(request);
  let shop = await db.shop.findUnique({ where: { domain: ctx.session.shop } });
  if (!shop) shop = await refreshShopInfo(ctx.session.shop, ctx.admin);
  else if (shop.status !== "installed") {
    shop = await db.shop.update({
      where: { id: shop.id },
      data: { status: "installed", uninstalledAt: null },
    });
  }
  return { ...ctx, shop, plan: getPlan(shop.plan) };
}

export { getUsageFor as getUsage } from "./usage.server";
