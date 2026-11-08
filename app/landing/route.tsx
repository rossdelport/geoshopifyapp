import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, isRouteErrorResponse, useLoaderData, useRouteError } from "react-router";
import { ARTICLE_LINKS, ArticleHero, PageArticle, bookHref } from "../components/page-article";
import { StoryShell } from "../components/story-ui";
import { COMPARE_HUB } from "../lib/compare/pages";
import { landingBySlug, landingJsonLd, landingPath, relatedLinks } from "../lib/landing/pages";
import { publicHostRedirect } from "../lib/tools/host.server";
import { toolHeaders } from "../lib/tools/http";
import { pageMeta, stripBrand } from "../lib/tools/seo";

// One service page, like firstpicked.com.au/seo-agency-perth: the answer first, what we do, who it's for and not for,
// the price, the Get started box (opens /book), the questions people ask, the sources and related pages. Content in
// app/lib/landing/pages.ts; app/routes.ts gives each slug in app/lib/landing/paths.ts its own route to this file
// (route id "landing-<slug>"), so the loader finds the page from the address.

export const loader = ({ request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  const slug = new URL(request.url).pathname.replace(/^\/+|\/+$/g, "");
  const page = landingBySlug(slug);
  if (!page) throw data(null, { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  return { page, related: relatedLinks(page.related) };
};

export const links = ARTICLE_LINKS;

export const headers = toolHeaders;

export const meta: MetaFunction<typeof loader> = ({ data: d, error }) =>
  d?.page && !error
    ? pageMeta({
        path: landingPath(d.page.slug),
        title: d.page.title,
        description: d.page.description,
        image: COMPARE_HUB.ogImage,
        imageAlt: COMPARE_HUB.ogAlt,
        jsonLd: landingJsonLd(d.page),
      })
    : [{ title: "Something went wrong | FirstPicked" }, { name: "robots", content: "noindex" }];

export default function LandingPageView() {
  const { page, related } = useLoaderData<typeof loader>();
  return (
    <StoryShell pill={{ label: "Book a call", href: bookHref("landing", page.slug) }} crumbs={[{ name: stripBrand(page.title) }]} hero={<ArticleHero page={page} tag={page.tag} />}>
      <PageArticle page={page} book={bookHref("landing", page.slug)} related={related} relatedHeading="Read next" />
    </StoryShell>
  );
}

/** Anything that breaks still shows the site frame and the footer. */
export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  if (!missing) console.error("[landing] page error", error);
  return (
    <StoryShell
      wide
      pill={{ label: "All comparisons", href: COMPARE_HUB.path }}
      crumbs={[{ name: missing ? "Not found" : "Error" }]}
      hero={
        <section className="tl-hero">
          <h1 className="ck-h1">{missing ? "We couldn't find that page." : "Something went wrong. Please try again."}</h1>
          <p className="ck-lead tl-intro">
            <a href="/">Go to the home page</a>
          </p>
        </section>
      }
    />
  );
}
