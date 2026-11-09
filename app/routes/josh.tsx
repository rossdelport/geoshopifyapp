import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";
import font from "../fonts/inter-geo.woff2?url";
import raw from "../home/josh.html?raw";

// firstpicked.com.au/josh (Ross, 10 Nov 2026): a sample "Search and AI report" on Rentec Direct in FirstIndex's style,
// for Ross's application to Josh Pigford's FirstIndex sales role. One hand-written page (app/home/josh.html), every
// number checked on 9 Nov 2026 (evidence in /mnt/project-files/firstindex/rentec-direct-ai-check.md). It says plainly
// that it isn't made or approved by FirstIndex, and it's kept out of search (noindex, not in the sitemap).

const page = raw.replaceAll("__FONT_URL__", () => font);

export const loader = ({ request }: LoaderFunctionArgs) => {
  const res = serveHome(request, page);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
};
