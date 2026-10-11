import { siteRobotsTxt } from "../lib/tools/site-files";

// /robots.txt: every public page open to search engines and AI assistants, the app and private paths
// closed, and the sitemap. Served on every host (bots must read it there, not be redirected).
// Text in app/lib/tools/site-files.ts. HEAD works too (React Router drops the body).

export const loader = () =>
  new Response(siteRobotsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
