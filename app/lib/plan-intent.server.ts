// A plan picked on the website before installing. The pricing cards link to /auth/login?plan=pro&cycle=yearly;
// the login form sends the store's domain, so the choice is saved by domain (a cookie wouldn't reach the
// app inside Shopify admin). The dashboard offers it once the free scan is done, and the plans page opens
// with it selected. Deleted once the store picks a plan.

import db from "../db.server";
import { myshopifyDomain, parsePlanChoice, type PlanChoice } from "./plans";

const MAX_AGE_MS = 30 * 86_400_000;

/** Save the choice from a login form post (plan, cycle and shop fields). Never throws. */
export async function savePlanIntentFromLogin(form: FormData, url: URL): Promise<void> {
  try {
    const choice = parsePlanChoice(form.get("plan") ?? url.searchParams.get("plan"), form.get("cycle") ?? url.searchParams.get("cycle"));
    const domain = myshopifyDomain(form.get("shop"));
    if (!choice || !domain) return;
    await db.planIntent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - MAX_AGE_MS) } } });
    await db.planIntent.upsert({
      where: { domain },
      create: { domain, ...choice },
      update: { ...choice, createdAt: new Date() },
    });
  } catch (err) {
    console.error(`[plan-intent] could not save: ${(err as Error).message}`);
  }
}

export async function planIntentFor(domain: string): Promise<PlanChoice | null> {
  const row = await db.planIntent.findUnique({ where: { domain } });
  if (!row || row.createdAt.getTime() < Date.now() - MAX_AGE_MS) return null;
  return parsePlanChoice(row.plan, row.cycle);
}

export async function clearPlanIntent(domain: string): Promise<void> {
  await db.planIntent.deleteMany({ where: { domain } });
}
