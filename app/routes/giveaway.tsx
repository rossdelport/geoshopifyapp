import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";
import { enterGiveaway, type GiveawayResult } from "../lib/giveaway.server";
import { GIVEAWAY, GIVEAWAY_ERRORS } from "../lib/giveaway";
import { clientIp, fromAnotherSite, readSmallForm } from "../lib/public-form.server";
import font from "../fonts/inter-geo.woff2?url";
import rossPhoto from "../home/ross.webp?url";

// firstpicked.com.au/giveaway (Ross, 3 Nov 2026): one Australian Shopify brand wins 3 months of FirstPicked Done for you, drawn
// on Saturday 7 November. Facebook ads send people here. One HTML file in the home page's style, with the entry
// form at the top and the rules at the bottom (app/home/giveaway.html). The dates live in app/lib/giveaway.ts.
// POST /giveaway: the form's fields `store`, `name`, `email`, `phone`, `website` (honeypot), the utm_* fields,
// `fbclid` and `referrer`; JSON reply GiveawayResult. Entries are in Admin > Giveaway.
import raw from "../home/giveaway.html?raw";

const page = raw
  .replaceAll("__FONT_URL__", () => font)
  .replaceAll("__ROSS_PHOTO__", () => rossPhoto)
  .replace("__CLOSES_AT__", () => GIVEAWAY.closesAt.toISOString());

export const loader = async ({ request }: LoaderFunctionArgs) => serveHome(request, page);

const reply = (body: GiveawayResult, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") return reply({ ok: false, error: GIVEAWAY_ERRORS.generic }, 405);
  if (fromAnotherSite(request)) return reply({ ok: false, error: GIVEAWAY_ERRORS.crossSite }, 403);
  const form = await readSmallForm(request);
  if (!form) return reply({ ok: false, error: GIVEAWAY_ERRORS.tooBig }, 413);
  try {
    const out = await enterGiveaway({
      store: form.get("store"),
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone"),
      honeypot: form.get("website"),
      utmSource: form.get("utm_source"),
      utmMedium: form.get("utm_medium"),
      utmCampaign: form.get("utm_campaign"),
      utmContent: form.get("utm_content"),
      utmTerm: form.get("utm_term"),
      fbclid: form.get("fbclid"),
      referrer: form.get("referrer"),
      ip: clientIp(request),
    });
    return reply(out.result, out.status);
  } catch (err) {
    console.error("[giveaway] could not save an entry", err);
    return reply({ ok: false, error: GIVEAWAY_ERRORS.generic }, 500);
  }
};
