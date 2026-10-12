import type { LoaderFunctionArgs } from "react-router";
import { sitemapXml } from "../lib/tools/site-files";
import { publicHostRedirect } from "../lib/tools/host.server";

// /sitemap.xml: the home page, the tools hub, the 7 tools, the stories hub, every story and the privacy page,
// each with the date it last really changed. Built from the tool registry and the stories in
// app/lib/tools/site-files.ts.

export const loader = ({ request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  return new Response(sitemapXml(), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
};
