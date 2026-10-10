// Send an email through Resend (monthly reports, operator alerts).

import { env } from "./env.server";
import { recordCost } from "./cost.server";

export const emailConfigured = () => Boolean(env.resendKey && env.emailFrom);

export async function sendEmail(to: string[], subject: string, html: string, shopId?: string) {
  if (!emailConfigured()) throw new Error("Email is not set up (RESEND_API_KEY / GEO_EMAIL_FROM)");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  await recordCost(shopId, "resend", "email", 0.0004).catch(() => {});
}
