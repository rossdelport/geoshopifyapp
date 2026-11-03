import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";
import { bookCall, freeSlots, type BookResult } from "../lib/booking.server";
import { BOOK_ERRORS } from "../lib/booking";
import { clientIp, fromAnotherSite, readSmallForm } from "../lib/public-form.server";
import font from "../fonts/inter-geo.woff2?url";
import rossPhoto from "../home/ross.webp?url";
// The home page's Meta pixel and cookie notice, from the same files the home page copies.
import pixelHead from "../../design/overview/pixel-head.js?raw";
import cookieScript from "../../design/overview/parts/47-cookies.js?raw";
import raw from "../home/book.html?raw";

// usegeo.app/book: book a call with Ross (Ross, 3 Nov 2026). Every "Get started" button on the home page opens it.
// GET: the page (app/home/book.html) with Ross's free times from his Google Calendar, or "Text Ross" when his
// calendar isn't connected yet. POST: urlencoded `start` (one of those times), `name`, `email`, `store`, `website`
// (honeypot) and the utm_* tags; JSON reply BookResult. The call goes into Ross's calendar with a Meet link.

const page = raw
  .replaceAll("__FONT_URL__", () => font)
  .replace("__ROSS_PHOTO__", () => rossPhoto)
  .replace("<!-- META_PIXEL -->", () => `<script>\n${pixelHead.trim()}\n</script>`)
  .replace("<!-- COOKIE_SCRIPT -->", () => `<script>\n${cookieScript.trim()}\n</script>`);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const slots = await freeSlots();
  const res = serveHome(request, page.replace("__SLOTS__", () => JSON.stringify(slots).replace(/</g, "\\u003c")));
  // The free times change as calls are booked, so the page is never kept in a cache.
  res.headers.set("Cache-Control", "no-store");
  return res;
};

const reply = (body: BookResult, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") return reply({ ok: false, error: BOOK_ERRORS.generic }, 405);
  if (fromAnotherSite(request)) return reply({ ok: false, error: BOOK_ERRORS.crossSite }, 403);
  const form = await readSmallForm(request);
  if (!form) return reply({ ok: false, error: BOOK_ERRORS.generic }, 413);
  try {
    const out = await bookCall({
      start: form.get("start"),
      name: form.get("name"),
      email: form.get("email"),
      store: form.get("store"),
      honeypot: form.get("website"),
      from: Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((k) => [k, form.get(k)])),
      ip: clientIp(request),
    });
    return reply(out.result, out.status);
  } catch (err) {
    console.error("[book] could not book a call", err);
    return reply({ ok: false, error: BOOK_ERRORS.generic }, 500);
  }
};
