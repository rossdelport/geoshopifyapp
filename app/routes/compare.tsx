import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Outlet, isRouteErrorResponse, useRouteError } from "react-router";
import { ARTICLE_LINKS } from "../components/page-article";
import { StoryShell } from "../components/story-ui";
import { COMPARE_HUB } from "../lib/compare/pages";
import { publicHostRedirect } from "../lib/tools/host.server";
import { toolHeaders } from "../lib/tools/http";

// Layout for the comparison pages: /compare (the hub) and every /compare/<slug> page. Same frame as the blog
// (fonts, the free tools' stylesheets, the reading column and blog.css for the FAQ and sources) plus compare.css
// for the tables and the Get started box, the canonical host, the default headers and an error page in the site's frame.

export const loader = ({ request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  return null;
};

export const links = ARTICLE_LINKS;

export const headers = toolHeaders;

/** Only for the error page (every page under /compare exports its own meta). */
export const meta: MetaFunction = ({ error }) =>
  error ? [{ title: "Something went wrong | FirstPicked" }, { name: "robots", content: "noindex" }] : [];

export default function CompareLayout() {
  return <Outlet />;
}

/** Anything that breaks under /compare still shows the site frame, a way back to the hub and the footer. */
export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  if (!missing) console.error("[compare] page error", error);
  return (
    <StoryShell
      wide
      pill={{ label: "All comparisons", href: COMPARE_HUB.path }}
      crumbs={[{ name: COMPARE_HUB.name, path: COMPARE_HUB.path }, { name: missing ? "Not found" : "Error" }]}
      hero={
        <section className="tl-hero">
          <h1 className="ck-h1">{missing ? "We couldn't find that page." : "Something went wrong. Please try again."}</h1>
          <p className="ck-lead tl-intro">
            <a href={COMPARE_HUB.path}>See all comparisons</a>
          </p>
        </section>
      }
    />
  );
}
