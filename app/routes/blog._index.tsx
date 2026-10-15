import type { MetaFunction } from "react-router";
import { data, useLoaderData } from "react-router";
import db from "../db.server";
import { PostCards } from "../components/blog-ui";
import { StoryShell, TryLine } from "../components/story-ui";
import { POST_CARD_SELECT } from "../lib/blog.server";
import { BLOG_HUB, blogHubJsonLd, toPostCard } from "../lib/blog/pages";
import { STORIES_HUB } from "../lib/stories/pages";
import { pageMeta } from "../lib/tools/seo";
import { toolHeaders } from "../lib/tools/http";

// The blog hub at /blog: every published post as a card, newest first. Posts are written by the blog.write job
// (lib/blog.server.ts); hidden ones (Admin > Blog) are left out here, in the sitemap and on their own address.

export const loader = async () => {
  const posts = await db.blogPost.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, select: POST_CARD_SELECT });
  return data({ cards: posts.map(toPostCard) }, { headers: { "Cache-Control": "public, max-age=300" } });
};

export const meta: MetaFunction<typeof loader> = ({ data: d }) =>
  pageMeta({
    path: BLOG_HUB.path,
    title: BLOG_HUB.title,
    description: BLOG_HUB.description,
    image: BLOG_HUB.ogImage,
    imageAlt: BLOG_HUB.ogAlt,
    jsonLd: blogHubJsonLd(d?.cards ?? []),
  });

export const headers = toolHeaders;

export default function BlogHub() {
  const { cards } = useLoaderData<typeof loader>();
  return (
    <StoryShell
      wide
      pill={{ label: "Stories", href: STORIES_HUB.path }}
      crumbs={[{ name: BLOG_HUB.name }]}
      hero={
        <section className="tl-hero">
          <h1 className="ck-h1">{BLOG_HUB.h1}</h1>
          <p className="ck-lead tl-intro">{BLOG_HUB.intro}</p>
        </section>
      }
    >
      <div className="bl">
        {cards.length ? <PostCards cards={cards} hub /> : <p className="bl-empty">The first articles are being written. Check back soon.</p>}
        <TryLine />
      </div>
    </StoryShell>
  );
}
