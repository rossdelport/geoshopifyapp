import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { isoDay, postPath } from "../lib/blog/pages";
import { sitemapXml } from "../lib/tools/site-files";
import { publicHostRedirect } from "../lib/tools/host.server";

// /sitemap.xml: the home page, the tools hub, the 7 tools, the stories hub, every story, the blog and every
// published post, and the privacy page, each with the date it last really changed. Built from the tool registry,
// the stories and the blog posts in the database by app/lib/tools/site-files.ts.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  const posts = await db.blogPost.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, select: { slug: true, updatedAt: true } });
  return new Response(sitemapXml(posts.map((p) => ({ path: postPath(p.slug), updated: isoDay(p.updatedAt) }))), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
};
