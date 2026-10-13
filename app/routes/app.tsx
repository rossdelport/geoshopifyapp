import type { HeadersFunction, LinksFunction, LoaderFunctionArgs } from "react-router";
import { isRouteErrorResponse, Outlet, redirect, useLoaderData, useRouteError } from "react-router";
import { isbot } from "isbot";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { requireShop } from "../lib/shop.server";
import styles from "../styles/app.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

// On the address when the Shopify admin (or Shopify's mobile apps) opens the app.
const SHOPIFY_PARAMS = ["shop", "host", "embedded", "hmac", "id_token", "session", "timestamp", "locale"];
const SHOPIFY_APP_AGENT = /Shopify (POS|Mobile)\//;

/**
 * Someone typed usegeo.app/app (or opened a bookmark) in a normal browser tab. Shopify's check would answer
 * with a bare App Bridge page that does nothing outside the admin, so they go to the login page instead.
 * Inside the admin the app loads in a frame (Sec-Fetch-Dest "iframe") with shop and host on the address, and
 * data requests carry a session token, so none of that matches. Browsers that send no Sec-Fetch-Dest, and
 * bots (Shopify answers them 410), keep Shopify's own handling.
 */
function isPlainBrowserVisit(request: Request) {
  if (request.method !== "GET" || request.headers.get("authorization")) return false;
  if (request.headers.get("sec-fetch-dest") !== "document") return false;
  const agent = request.headers.get("user-agent") ?? "";
  if (SHOPIFY_APP_AGENT.test(agent) || isbot(agent)) return false;
  const params = new URL(request.url).searchParams;
  return !SHOPIFY_PARAMS.some((name) => params.has(name));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (isPlainBrowserVisit(request)) throw redirect("/auth/login");
  await requireShop(request);
  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/questions">Buying questions</s-link>
        <s-link href="/app/competitors">Competitors</s-link>
        <s-link href="/app/fixes">Fixes</s-link>
        <s-link href="/app/outreach">Outreach</s-link>
        <s-link href="/app/settings">Settings</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();
  // boundary.error spots a thrown Response by its class name, but the browser bundle is minified and renames
  // that class, so once the page loaded it threw again and React Router showed "Unhandled Thrown Response!".
  // Give the same markup boundary.error gives on the server; real crashes still go to boundary.error.
  if (isRouteErrorResponse(error) && error.status !== 404) {
    return <div dangerouslySetInnerHTML={{ __html: error.data || "Handling response" }} />;
  }
  // A page that doesn't exist, or a real crash (React Router logs it): a plain message and a way back.
  if (!isRouteErrorResponse(error)) console.error(error);
  const missing = isRouteErrorResponse(error);
  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", maxWidth: 560, margin: "64px auto", padding: "0 20px", color: "#303030", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 22, margin: "0 0 8px", color: "#0b0c2b" }}>{missing ? "We couldn't find that page" : "Something went wrong"}</h1>
      <p style={{ margin: "0 0 20px" }}>
        {missing ? "It may have been removed." : "Sorry, this page didn't load. Please try again in a moment."} Nothing in your store has changed.
      </p>
      <a href="/app" style={{ display: "inline-block", padding: "10px 16px", borderRadius: 10, background: "#303030", color: "#fff", textDecoration: "none", fontWeight: 600 }}>
        Back to the dashboard
      </a>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
