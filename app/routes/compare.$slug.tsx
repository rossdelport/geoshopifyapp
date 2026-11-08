import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, useLoaderData } from "react-router";
import { ArticleHero, PageArticle, bookHref } from "../components/page-article";
import { StoryShell } from "../components/story-ui";
import { COMPARE_HUB, COMPARE_PAGES, compareBySlug, compareJsonLd, comparePath } from "../lib/compare/pages";
import { relatedLinks } from "../lib/landing/pages";
import { pageMeta, stripBrand } from "../lib/tools/seo";
import { toolHeaders } from "../lib/tools/http";

// One comparison at /compare/<slug>: the answer first, the sections (tables where the page compares), the Get started
// box (opens /book), the questions people ask and the sources with the day they were checked. Then the related pages
// (comparisons or service pages). Content: app/lib/compare/pages.ts; the page itself: components/page-article.tsx.
// An unknown slug is a real 404 with noindex that lists every page.

export const loader = ({ params }: LoaderFunctionArgs) => {
  const page = compareBySlug(params.slug ?? "");
  if (!page) {
    return data({ page: null, related: [] }, { status: 404, headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" } });
  }
  return data({ page, related: relatedLinks(page.related) });
};

export const meta: MetaFunction<typeof loader> = ({ data: d }) =>
  d?.page
    ? pageMeta({
        path: comparePath(d.page.slug),
        title: d.page.title,
        description: d.page.description,
        image: COMPARE_HUB.ogImage,
        imageAlt: COMPARE_HUB.ogAlt,
        jsonLd: compareJsonLd(d.page),
      })
    : pageMeta({
        path: COMPARE_HUB.path,
        title: "We couldn't find that page | FirstPicked",
        description: "This page doesn't exist. See every comparison of agencies, tools and FirstPicked.",
        noindex: true,
      });

export const headers = toolHeaders;

const PILL = { label: "All comparisons", href: COMPARE_HUB.path };

export default function ComparePageView() {
  const { page, related } = useLoaderData<typeof loader>();
  if (!page) {
    return (
      <StoryShell
        wide
        pill={PILL}
        crumbs={[{ name: COMPARE_HUB.name, path: COMPARE_HUB.path }, { name: "Not found" }]}
        hero={
          <section className="tl-hero">
            <h1 className="ck-h1">We couldn&apos;t find that page.</h1>
            <p className="ck-lead tl-intro">It may have moved, or the address has a typo. Here are all of them.</p>
          </section>
        }
      >
        <div className="bl">
          <ul className="cp-links">
            {COMPARE_PAGES.map((p) => (
              <li key={p.slug}>
                <a href={comparePath(p.slug)}>{p.h1}</a>
              </li>
            ))}
          </ul>
        </div>
      </StoryShell>
    );
  }
  return (
    <StoryShell pill={PILL} crumbs={[{ name: COMPARE_HUB.name, path: COMPARE_HUB.path }, { name: stripBrand(page.title) }]} hero={<ArticleHero page={page} tag="Compare" />}>
      <PageArticle page={page} book={bookHref("compare", page.slug)} related={related} relatedHeading="More pages like this" />
    </StoryShell>
  );
}
