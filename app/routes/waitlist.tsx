import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { WAITLIST_ERRORS, joinWaitlist, type WaitlistResult } from "../lib/waitlist.server";
import { clientIp, fromAnotherSite, readSmallForm } from "../lib/public-form.server";

// POST /waitlist: the home page's "Join the waitlist" popup. Resource route (no page): urlencoded fields
// `name`, `email`, `website` (honeypot), `source`, `plan`, `cycle`, the utm_* fields, `fbclid` and
// `referrer`; JSON reply WaitlistResult. GET /waitlist opens the popup on the home page.

const reply = (body: WaitlistResult, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const loader = () => redirect("/#waitlist");

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") return reply({ ok: false, error: WAITLIST_ERRORS.generic }, 405);
  if (fromAnotherSite(request)) return reply({ ok: false, error: WAITLIST_ERRORS.crossSite }, 403);
  const form = await readSmallForm(request);
  if (!form) return reply({ ok: false, error: WAITLIST_ERRORS.tooBig }, 413);
  try {
    const out = await joinWaitlist({
      name: form.get("name"),
      email: form.get("email"),
      honeypot: form.get("website"),
      source: form.get("source"),
      plan: form.get("plan"),
      cycle: form.get("cycle"),
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
    console.error("[waitlist] could not save a signup", err);
    return reply({ ok: false, error: WAITLIST_ERRORS.generic }, 500);
  }
};
