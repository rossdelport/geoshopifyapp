import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Outlet, isRouteErrorResponse, useRouteError } from "react-router";
import { CHECK_FONT_LINKS } from "../components/check-ui";
import { AllToolLinks, ToolHero, ToolShell } from "../components/tool-ui";
import { HUB } from "../lib/tools/registry";
import { publicHostRedirect } from "../lib/tools/host.server";
import { toolHeaders } from "../lib/tools/http";
import checkCss from "../styles/check.css?url";
import toolsCss from "../styles/tools.css?url";

// Layout for the free tools: /tools (the hub) and every /tools/* page. One place for the fonts and
// stylesheets, the canonical host (www and the Railway address get a 301 to usegeo.app), the default
// headers and an error page in the site's frame. Each page sets its own `meta` (React Router uses the
// deepest route's meta only); the meta here only fills in for the error page.

export const loader = ({ request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  return null;
};

export const links: LinksFunction = () => [
  ...CHECK_FONT_LINKS,
  { rel: "stylesheet", href: checkCss },
  { rel: "stylesheet", href: toolsCss },
];

export const headers = toolHeaders;

/** Only for the error page (every page under /tools exports its own meta). */
export const meta: MetaFunction = ({ error }) =>
  error ? [{ title: "Something went wrong | GEO" }, { name: "robots", content: "noindex" }] : [];

export default function ToolsLayout() {
  return <Outlet />;
}

/** Anything that breaks under /tools still shows the site frame, the tool links and the footer. */
export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  if (!missing) console.error("[tools] page error", error);
  return (
    <ToolShell
      page={{ name: HUB.name, path: "/tools/error" }}
      hero={<ToolHero h1={missing ? "We couldn't find that page." : "Something went wrong. Please try again."} intro="Here are all our free tools." />}
      result={<AllToolLinks />}
    />
  );
}
