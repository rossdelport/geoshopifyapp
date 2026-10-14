// Sends one of the finished home pages (English at "/", the language copies at /de, /fr, /nl, /es, /it).
// The pages are built from design/overview by `node design/overview/assemble.mjs`.

import { redirect } from "react-router";
import { publicHostRedirect } from "./tools/host.server";

export function serveHome(request: Request, html: string): Response {
  const url = new URL(request.url);

  // Shopify opens the app with ?shop=...; send those visits straight into the app.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  // One public address: www.usegeo.app and the Railway address send visitors to https://usegeo.app.
  const moved = publicHostRedirect(request);
  if (moved) throw moved;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
