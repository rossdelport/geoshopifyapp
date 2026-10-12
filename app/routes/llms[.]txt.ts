import type { LoaderFunctionArgs } from "react-router";
import { siteLlmsTxt } from "../lib/tools/site-files";
import { publicHostRedirect } from "../lib/tools/host.server";

// /llms.txt: what GEO is and links to the free tools and the stories, in the llmstxt.org format, for AI
// assistants that read it. Built from the tool registry, the stories and the plans in app/lib/tools/site-files.ts.

export const loader = ({ request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  return new Response(siteLlmsTxt(), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
};
