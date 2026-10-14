import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../../lib/home-page.server";

// The public home page. It is built from design/overview by `node design/overview/assemble.mjs`.
import home from "../../home/home.html?raw";

// No component: this route sends the finished HTML page as-is.
export const loader = async ({ request }: LoaderFunctionArgs) => serveHome(request, home);
