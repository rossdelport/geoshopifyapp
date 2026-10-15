import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Outlet, isRouteErrorResponse, useRouteError } from "react-router";
import { CHECK_FONT_LINKS } from "../components/check-ui";
import { StoryShell } from "../components/story-ui";
import { BLOG_HUB } from "../lib/blog/pages";
import { publicHostRedirect } from "../lib/tools/host.server";
import { toolHeaders } from "../lib/tools/http";
import checkCss from "../styles/check.css?url";
import toolsCss from "../styles/tools.css?url";
import storyCardCss from "../styles/story-card.css?url";
import storiesCss from "../styles/stories.css?url";
import blogCss from "../styles/blog.css?url";

// Layout for the blog: /blog (the hub) and every /blog/<slug> post. Same frame as the stories (fonts, the free
// tools' stylesheets, the story card and reading column) plus blog.css, the canonical host (www and the Railway
// address get a 301 to usegeo.app), the default headers and an error page in the site's frame. Each page sets its
// own `meta`; the meta here only fills in for the error page.

export const loader = ({ request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  return null;
};

export const links: LinksFunction = () => [
  ...CHECK_FONT_LINKS,
  { rel: "stylesheet", href: checkCss },
  { rel: "stylesheet", href: toolsCss },
  { rel: "stylesheet", href: storyCardCss },
  { rel: "stylesheet", href: storiesCss },
  { rel: "stylesheet", href: blogCss },
];

export const headers = toolHeaders;

/** Only for the error page (every page under /blog exports its own meta). */
export const meta: MetaFunction = ({ error }) =>
  error ? [{ title: "Something went wrong | GEO" }, { name: "robots", content: "noindex" }] : [];

export default function BlogLayout() {
  return <Outlet />;
}

/** Anything that breaks under /blog still shows the site frame, a way back to the blog and the footer. */
export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  if (!missing) console.error("[blog] page error", error);
  return (
    <StoryShell
      wide
      pill={{ label: "All posts", href: BLOG_HUB.path }}
      crumbs={[{ name: BLOG_HUB.name, path: BLOG_HUB.path }, { name: missing ? "Not found" : "Error" }]}
      hero={
        <section className="tl-hero">
          <h1 className="ck-h1">{missing ? "We couldn't find that page." : "Something went wrong. Please try again."}</h1>
          <p className="ck-lead tl-intro">
            <a href={BLOG_HUB.path}>See all posts</a>
          </p>
        </section>
      }
    />
  );
}
