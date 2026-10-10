import "@shopify/shopify-app-react-router/adapters/node";
import { randomBytes } from "node:crypto";
import { ApiVersion, AppDistribution, shopifyApp } from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { BILLING_CONFIG } from "./lib/billing-config.server";
import { onInstalled } from "./lib/install.server";

// Until the real secret is set, use a random one: the server can start (background jobs,
// health check), but no Shopify login or webhook can be verified, so nothing is exposed.
if (!process.env.SHOPIFY_API_SECRET) {
  console.warn("[shopify] SHOPIFY_API_SECRET is not set: Shopify login and webhooks are disabled.");
}
const apiSecretKey = process.env.SHOPIFY_API_SECRET || randomBytes(32).toString("hex");

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey,
  apiVersion: ApiVersion.October26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  // Standard and Done-for-you, monthly or yearly (see lib/billing-config.server.ts).
  billing: BILLING_CONFIG,
  hooks: {
    afterAuth: async ({ session, admin }) => {
      await onInstalled(session, admin);
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
