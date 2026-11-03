import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { requireAdmin } from "../lib/admin.server";
import { connectCalendar, consentUrl, googleReady } from "../lib/booking.server";

// usegeo.app/dash/admin/calendar: connects Ross's Google Calendar to the book-a-call page (usegeo.app/book).
// The "Connect Google Calendar" button in Admin > System comes here, we send Ross to Google's sign-in, and Google
// sends him back here with a code, which becomes the saved refresh token. Admin only. This exact address is the
// "Authorised redirect URI" on the Google Cloud OAuth client.

const COOKIE = "geo_cal_state";
const back = (result: string) => redirect(`/dash/admin/system?calendar=${result}#calendar`);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  if (!googleReady()) throw back("setup");
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // Start: a random state in a short-lived cookie, so only a sign-in Ross started can connect a calendar.
  if (!code) {
    if (url.searchParams.get("error")) throw back("denied");
    const state = randomBytes(24).toString("hex");
    return redirect(consentUrl(state), {
      headers: { "Set-Cookie": `${COOKIE}=${state}; Path=/dash/admin/calendar; Max-Age=600; HttpOnly; Secure; SameSite=Lax` },
    });
  }

  // Back from Google.
  const sent = Buffer.from(url.searchParams.get("state") ?? "");
  const kept = Buffer.from(/(?:^|;\s*)geo_cal_state=([a-f0-9]+)/.exec(request.headers.get("cookie") ?? "")?.[1] ?? "");
  const clear = { "Set-Cookie": `${COOKIE}=; Path=/dash/admin/calendar; Max-Age=0; HttpOnly; Secure; SameSite=Lax` };
  if (!kept.length || sent.length !== kept.length || !timingSafeEqual(sent, kept)) throw redirect("/dash/admin/system?calendar=failed#calendar", { headers: clear });
  try {
    await connectCalendar(code);
  } catch (err) {
    console.error("[book] could not connect Google Calendar", err);
    throw redirect("/dash/admin/system?calendar=failed#calendar", { headers: clear });
  }
  return redirect("/dash/admin/system?calendar=connected#calendar", { headers: clear });
};
