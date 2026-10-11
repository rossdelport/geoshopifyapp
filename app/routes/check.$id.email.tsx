import type { ActionFunctionArgs } from "react-router";
import { LEAD_ERRORS, submitCheckEmail } from "../lib/check-lead.server";
import { clientIp, fromAnotherSite, readSmallForm } from "../lib/public-form.server";
import type { CheckEmailResult } from "../lib/check-types";
import { TIPS_FIELD } from "../lib/check-consent";

// POST /check/:id/email: "Email me the full report". Resource route (no page): urlencoded fields
// `email`, `website` (honeypot) and the optional `tips` box ("1" when ticked), JSON reply
// CheckEmailResult. Saves the address (with the words it agreed to), queues the report email, and sets
// this browser's signed cookie so the report page knows. 503 (saving nothing) when email isn't set up.

const reply = (body: CheckEmailResult, status = 200, setCookie?: string) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...(setCookie ? { "Set-Cookie": setCookie } : {}) },
  });

export const loader = async () => reply({ ok: false, error: "Please use the form on the report page." }, 405);

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "POST") return reply({ ok: false, error: LEAD_ERRORS.generic }, 405);
  if (fromAnotherSite(request)) return reply({ ok: false, error: LEAD_ERRORS.crossSite }, 403);
  const form = await readSmallForm(request);
  if (!form) return reply({ ok: false, error: LEAD_ERRORS.tooBig }, 413);
  const id = params.id ?? "";
  if (!/^[a-z0-9_-]{1,64}$/i.test(id)) return reply({ ok: false, error: LEAD_ERRORS.missing }, 404);
  try {
    const out = await submitCheckEmail({
      checkId: id,
      email: form.get("email"),
      honeypot: form.get("website"),
      tips: form.get(TIPS_FIELD),
      ip: clientIp(request),
      request,
    });
    return reply(out.result, out.status, out.setCookie);
  } catch (err) {
    console.error("[check] could not save a report email", err);
    return reply({ ok: false, error: LEAD_ERRORS.generic }, 500);
  }
};
