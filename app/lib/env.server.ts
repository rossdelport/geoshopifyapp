// All environment settings in one place.

export const env = {
  appUrl: (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, ""),
  tregToken: process.env.TREG_API_KEY || process.env.TREG_TOKEN || "",
  tregBaseUrl: (process.env.TREG_BASE_URL || "https://treg.to").replace(/\/$/, ""),
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  // Fast model reads AI answers; smart model writes merchant-facing copy.
  modelFast: process.env.AI_MODEL_FAST || "claude-haiku-5-5",
  modelSmart: process.env.AI_MODEL_SMART || "claude-opus-5-5",
  resendKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.GEO_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "",
  // Who hears when a store starts or leaves Done-for-you (hand outreach, the monthly call).
  alertEmail: process.env.GEO_ALERT_EMAIL || "",
  billingTest: process.env.SHOPIFY_BILLING_TEST !== "false",
  runWorker: process.env.RUN_WORKER !== "false",
  utmSource: process.env.GEO_UTM_SOURCE || "geo-app",
  jobsSecret: process.env.JOBS_SECRET || "",
  // Key for scrambling free-check visitors' IPs. Unset: a random key per process (limits reset on deploy).
  checkIpSecret: process.env.CHECK_IP_SECRET || "",
};

export const isProd = process.env.NODE_ENV === "production";

// Test billing means no store is ever charged. Fine for development stores; at launch set
// SHOPIFY_BILLING_TEST=false on Railway (see the launch checklist in CLAUDE.md section 18).
if (isProd && env.billingTest) {
  console.warn("[billing] WARNING: test billing is on (SHOPIFY_BILLING_TEST is not \"false\"). Subscriptions are test charges and nobody is billed.");
}
if (isProd && !env.alertEmail) {
  console.warn("[billing] WARNING: GEO_ALERT_EMAIL is not set. Nobody is emailed when a store starts or leaves Done-for-you.");
}
