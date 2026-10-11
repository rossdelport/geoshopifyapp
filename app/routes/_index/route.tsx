import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { publicHostRedirect } from "../../lib/tools/host.server";

// The public home page. It is built from design/overview by `node design/overview/assemble.mjs`.
import home from "../../home/home.html?raw";

// No component: this route sends the finished HTML page as-is.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Shopify opens the app with ?shop=...; send those visits straight into the app.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // One public address: www.usegeo.app and the Railway address send visitors to https://usegeo.app.
  const moved = publicHostRedirect(request);
  if (moved) throw moved;

  return new Response(home, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
};
