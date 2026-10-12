import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Outlet, isRouteErrorResponse, useRouteError } from "react-router";
import { CHECK_FONT_LINKS } from "../components/check-ui";
import { StoryShell } from "../components/story-ui";
import { STORIES_HUB } from "../lib/stories/pages";
import { publicHostRedirect } from "../lib/tools/host.server";
import { toolHeaders } from "../lib/tools/http";
import checkCss from "../styles/check.css?url";
import toolsCss from "../styles/tools.css?url";
import storyCardCss from "../styles/story-card.css?url";
import storiesCss from "../styles/stories.css?url";

// Layout for the stories: /stories (the hub) and every /stories/<slug> page. One place for the fonts and
// stylesheets (the free tools' frame, the story card shared with the home page, then stories.css), the canonical
// host (www and the Railway address get a 301 to usegeo.app), the default headers and an error page in the site's
// frame. Each page sets its own `meta`; the meta here only fills in for the error page.

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
];

export const headers = toolHeaders;

/** Only for the error page (every page under /stories exports its own meta). */
export const meta: MetaFunction = ({ error }) =>
  error ? [{ title: "Something went wrong | GEO" }, { name: "robots", content: "noindex" }] : [];

export default function StoriesLayout() {
  return <Outlet />;
}

/** Anything that breaks under /stories still shows the site frame, a way back to every story and the footer. */
export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  if (!missing) console.error("[stories] page error", error);
  return (
    <StoryShell
      wide
      crumbs={[{ name: STORIES_HUB.name, path: STORIES_HUB.path }, { name: missing ? "Not found" : "Error" }]}
      hero={
        <section className="tl-hero">
          <h1 className="ck-h1">{missing ? "We couldn't find that page." : "Something went wrong. Please try again."}</h1>
          <p className="ck-lead tl-intro">
            <a href={STORIES_HUB.path}>See all stories</a>
          </p>
        </section>
      }
    />
  );
}
