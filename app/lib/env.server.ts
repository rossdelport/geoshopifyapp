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
  alertEmail: process.env.GEO_ALERT_EMAIL || "",
  billingTest: process.env.SHOPIFY_BILLING_TEST !== "false",
  runWorker: process.env.RUN_WORKER !== "false",
  utmSource: process.env.GEO_UTM_SOURCE || "geo-app",
  jobsSecret: process.env.JOBS_SECRET || "",
};

export const isProd = process.env.NODE_ENV === "production";
