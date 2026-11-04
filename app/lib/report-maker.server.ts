// The phone report maker (Ross, 4 Nov 2026: "a single page where I type a store address ... on my phone and
// don't want to log in"). Instead of a sign-in it lives at a private link, usegeo.app/report-maker/<key>. Anyone
// with the link can start reports (about US$0.30 each, at most REPORTS_PER_DAY a day), so the key is long and
// secret. Admin > Reports shows the link. REPORT_MAKER_KEY sets the key (change it to retire a leaked link);
// unset, the key is made from the sign-in secret, so it stays the same across deploys.

import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE } from "./tools/site";

function baseSecret(): string {
  return process.env.WEB_SESSION_SECRET || createHmac("sha256", process.env.DATABASE_URL || "geo-dev").update("geo:web-session").digest("hex");
}

/** The secret part of the private link: REPORT_MAKER_KEY when set (16+ characters), else made from the sign-in secret. */
export function makerKey(): string {
  const set = process.env.REPORT_MAKER_KEY?.trim();
  if (set && set.length >= 16) return set;
  return createHmac("sha256", baseSecret()).update("geo:report-maker").digest("base64url").slice(0, 24);
}

/** Whether a link's key is the right one (compared in constant time). */
export function makerKeyOk(key: unknown): boolean {
  if (typeof key !== "string" || !key || key.length > 200) return false;
  const want = Buffer.from(makerKey());
  const got = Buffer.from(key);
  return got.length === want.length && timingSafeEqual(got, want);
}

/** The full private link, for Admin > Reports. */
export const makerLink = (): string => `${SITE}/report-maker/${makerKey()}`;
