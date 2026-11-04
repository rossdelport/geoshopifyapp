import { Links, Meta, Outlet, Scripts, ScrollRestoration, type LoaderFunctionArgs } from "react-router";
import { publicHostRedirect } from "./lib/tools/host.server";

// One address for every page: www, the old firstpicked.com.au and the Railway address get a 301 to
// https://firstpicked.com.au (lib/tools/host.server.ts says what stays where it is).
export const loader = ({ request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  return null;
};

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {/* Our logo mark: public/favicon.svg, with .ico and Apple touch fallbacks. */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
