import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

// The public home page. It is built from design/overview by `node design/overview/assemble.mjs`.
import home from "../../home/home.html?raw";

// No component: this route sends the finished HTML page as-is.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Shopify opens the app with ?shop=...; send those visits straight into the app.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return new Response(home, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
};
