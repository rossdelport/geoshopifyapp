import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, useLoaderData } from "react-router";
import db from "../db.server";
import { PostCards } from "../components/blog-ui";
import { StoryCards, StoryShell, TryLine } from "../components/story-ui";
import { POST_CARD_SELECT } from "../lib/blog.server";
import { BLOG_HUB, type BlogBody, type PostView, isoDay, kindLabel, postJsonLd, postPath, readMinutes, toPostCard } from "../lib/blog/pages";
import { type Story, storyBySlug } from "../lib/stories";
import { toCard } from "../lib/stories/pages";
import { formatUpdated } from "../lib/tools/format";
import { isToolSlug, toolBySlug } from "../lib/tools/registry";
import { pageMeta } from "../lib/tools/seo";
import { toolHeaders } from "../lib/tools/http";

// One post at /blog/<slug>: the answer first, the sections, key takeaways, the questions people ask, the sources
// (only pages from the knowledge pack) and the note that it was written with AI help and checked against them. Then
// the stories and free tools it points to, and three more posts. Hidden or unknown slugs are a real 404 with
// noindex that lists every post.

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const slug = params.slug ?? "";
  const post = slug ? await db.blogPost.findUnique({ where: { slug } }) : null;
  if (!post || post.status !== "published") {
    const all = await db.blogPost.findMany({ where: { status: "published" }, orderBy: { publishedAt: "desc" }, select: POST_CARD_SELECT });
    return data(
      { post: null as PostView | null, next: [], stories: [], tools: [], all: all.map(toPostCard) },
      { status: 404, headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" } },
    );
  }
  const body = post.body as unknown as BlogBody;
  const next = await db.blogPost.findMany({ where: { status: "published", slug: { not: slug } }, orderBy: { publishedAt: "desc" }, take: 3, select: POST_CARD_SELECT });
  const view: PostView = {
    slug: post.slug,
    title: post.title,
    description: post.description,
    kind: post.kind,
    words: post.words,
    publishedAt: post.publishedAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    body,
  };
  return data(
    {
      post: view as PostView | null,
      next: next.map(toPostCard),
      stories: (body.relatedStories ?? []).map((s) => storyBySlug(s)).filter((s): s is Story => Boolean(s)).map(toCard),
      tools: (body.relatedTools ?? []).filter(isToolSlug).map(toolBySlug).map((t) => ({ slug: t.slug, name: t.name, path: t.path })),
      all: [],
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
};

export const meta: MetaFunction<typeof loader> = ({ data: d }) =>
  d?.post
    ? pageMeta({
        path: postPath(d.post.slug),
        title: `${d.post.title} | GEO`,
        description: d.post.description,
        image: BLOG_HUB.ogImage,
        imageAlt: BLOG_HUB.ogAlt,
        jsonLd: postJsonLd(d.post),
      })
    : pageMeta({
        path: BLOG_HUB.path,
        title: "We couldn't find that post | GEO",
        description: "This page doesn't exist. See every article on getting your store recommended by AI.",
        noindex: true,
      });

export const headers = toolHeaders;

const PILL = { label: "All posts", href: BLOG_HUB.path };

export default function BlogPostPage() {
  const { post, next, stories, tools, all } = useLoaderData<typeof loader>();
  if (!post) {
    return (
      <StoryShell
        wide
        pill={PILL}
        crumbs={[{ name: BLOG_HUB.name, path: BLOG_HUB.path }, { name: "Not found" }]}
        hero={
          <section className="tl-hero">
            <h1 className="ck-h1">We couldn&apos;t find that post.</h1>
            <p className="ck-lead tl-intro">It may have moved, or the address has a typo. Here is everything on the blog.</p>
          </section>
        }
      >
        <div className="bl">
          <PostCards cards={all} hub />
        </div>
      </StoryShell>
    );
  }
  const { body } = post;
  return (
    <StoryShell pill={PILL} crumbs={[{ name: BLOG_HUB.name, path: BLOG_HUB.path }, { name: post.title }]} hero={<PostHero post={post} />}>
      <div className="bl">
        <article className="st-article bl-article" aria-labelledby="post-h1">
          <div className="st-body">
            {body.sections.map((sec, i) => (
              <section className="st-sec" key={sec.heading} aria-labelledby={`sec-${i}`}>
                <h2 className="ck-h2" id={`sec-${i}`}>
                  {sec.heading}
                </h2>
                {sec.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {sec.bullets?.length ? (
                  <ul>
                    {sec.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          {body.takeaways.length ? (
            <section className="bl-takeaways" aria-labelledby="takeaways-h">
              <h2 className="ck-h2" id="takeaways-h">
                Key takeaways
              </h2>
              <ul>
                {body.takeaways.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {body.faqs.length ? (
            <section className="bl-faq" aria-labelledby="faq-h">
              <h2 className="ck-h2" id="faq-h">
                Questions people ask
              </h2>
              {body.faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </section>
          ) : null}

          <section className="bl-sources" aria-labelledby="sources-h">
            <h2 id="sources-h">{body.sources.length ? "Sources" : "About this article"}</h2>
            {body.sources.length ? (
              <ul>
                {body.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.title}
                      <span className="ck-sr"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="bl-sources-note">
              {body.sources.length ? "Every number in this article comes from one of these pages. " : ""}
              Written by the GEO team with help from AI, and checked against our facts sheet and these sources before publishing. Nothing here
              is a promise of results.
            </p>
          </section>
        </article>

        {stories.length ? (
          <section className="st-next bl-related" aria-labelledby="stories-h">
            <h2 className="ck-h2" id="stories-h">
              Stories worth reading
            </h2>
            <StoryCards cards={stories} />
          </section>
        ) : null}

        {tools.length ? (
          <section className="bl-related" aria-labelledby="tools-h">
            <h2 className="ck-h2" id="tools-h">
              Free tools that help
            </h2>
            <ul className="bl-tools">
              {tools.map((t) => (
                <li key={t.slug}>
                  <a href={t.path}>{t.name}</a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {next.length ? (
          <section className="st-next bl-related" aria-labelledby="read-next">
            <h2 className="ck-h2" id="read-next">
              Read next
            </h2>
            <PostCards cards={next} />
            <p className="tl-all">
              <a href={BLOG_HUB.path}>See all posts</a>
            </p>
          </section>
        ) : null}
        <TryLine />
      </div>
    </StoryShell>
  );
}

/** The band: the kind, the H1, the answer-first intro and the byline. */
function PostHero({ post }: { post: PostView }) {
  const day = isoDay(post.publishedAt);
  return (
    <header className="st-hero bl-hero">
      <span className="bl-tag">{kindLabel(post.kind)}</span>
      <h1 className="ck-h1 st-h1" id="post-h1">
        {post.title}
      </h1>
      {post.body.intro.map((p) => (
        <p className="ck-lead st-intro" key={p}>
          {p}
        </p>
      ))}
      <p className="st-byline">
        {BLOG_HUB.author} · <time dateTime={day}>{formatUpdated(day)}</time> · {readMinutes(post.words)} minute read
      </p>
    </header>
  );
}
