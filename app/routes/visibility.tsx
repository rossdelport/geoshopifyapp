import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";
import { HEATMAP_ERRORS } from "../lib/heatmap";
import { getPublicCheck, pickBusiness, startCheck, suggestBusinesses, type StartResult } from "../lib/heatmap.server";
import { readAdTags } from "../lib/book-stats";
import { clientIp, fromAnotherSite, readSmallForm } from "../lib/public-form.server";
import font from "../fonts/inter-geo.woff2?url";
import rossPhoto from "../home/ross.webp?url";
// The home page's Meta pixel and cookie notice, from the same files the home page copies.
import pixelHead from "../../design/overview/pixel-head.js?raw";
import cookieScript from "../../design/overview/parts/47-cookies.js?raw";
import raw from "../home/visibility.html?raw";

// rankwithross.com.au/visibility: the free Google Maps check (Ross, 25 Nov 2026: "people type in their first name, phone number
// and business, google grabs their business profile, runs a heat map and gives it to them there on the screen. i will
// then call anyone that uses it, so please save to a database and email" him). Ross's ads send people here.
// GET: the page (app/home/visibility.html). GET ?r=<id>: the page with that check on it (a finished map can be opened
// again by its link; it shows the business's public Google details and ranks, never the name or phone typed).
// GET ?poll=<id>: that check as JSON, asked every second or two while the 49 searches run.
// POST `intent=find` with `q`: the Google profiles that match what they have typed in the business box so far
// ({ ok, list }), shown under the box to tap. POST: urlencoded `first`, `phone`, `business`, `cid` and `asked` (the
// profile they tapped and the words that brought it up), `keyword` (only when they chose their own search word),
// `website` (honeypot) and the ad's tags; JSON reply StartResult ("running", "pick" with the businesses to choose
// from, "capped", or an error). POST `intent=pick` with `id` and `cid`: the business they tapped on "Which one is
// yours?". All the work is in app/lib/heatmap.server.ts.

const page = raw
  .replaceAll("__FONT_URL__", () => font)
  .replaceAll("__ROSS_PHOTO__", () => rossPhoto)
  .replace("<!-- META_PIXEL -->", () => `<script>\n${pixelHead.trim()}\n</script>`)
  .replace("<!-- COOKIE_SCRIPT -->", () => `<script>\n${cookieScript.trim()}\n</script>`);

const PRIVATE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const poll = url.searchParams.get("poll");
  if (poll !== null) return Response.json((await getPublicCheck(poll)) ?? { missing: true }, { headers: PRIVATE });
  const id = url.searchParams.get("r");
  const check = id ? await getPublicCheck(id) : null;
  const res = serveHome(request, page.replace("__CHECK__", () => JSON.stringify(check).replace(/</g, "\\u003c")));
  if (id) for (const [k, v] of Object.entries(PRIVATE)) res.headers.set(k, v);
  return res;
};

const reply = (body: StartResult, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") return reply({ ok: false, error: HEATMAP_ERRORS.generic }, 405);
  if (fromAnotherSite(request)) return reply({ ok: false, error: HEATMAP_ERRORS.crossSite }, 403);
  const form = await readSmallForm(request);
  if (!form) return reply({ ok: false, error: HEATMAP_ERRORS.generic }, 413);
  if (form.get("intent") === "find") {
    const list = await suggestBusinesses(form.get("q"), clientIp(request));
    return Response.json({ ok: true, list }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const out =
      form.get("intent") === "pick"
        ? await pickBusiness(form.get("id"), form.get("cid"))
        : await startCheck({
            firstName: form.get("first"),
            phone: form.get("phone"),
            business: form.get("business"),
            keyword: form.get("keyword"),
            cid: form.get("cid"),
            asked: form.get("asked"),
            honeypot: form.get("website"),
            ad: readAdTags(form),
            ip: clientIp(request),
          });
    return reply(out.result, out.status);
  } catch (err) {
    console.error("[heatmap] could not start a check", err);
    return reply({ ok: false, error: HEATMAP_ERRORS.generic }, 500);
  }
};
