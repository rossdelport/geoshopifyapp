import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";

// usegeo.app/nl: the home page in Dutch (built from design/overview/i18n/nl.json by assemble.mjs).
import home from "../home/home-nl.html?raw";

export const loader = async ({ request }: LoaderFunctionArgs) => serveHome(request, home);
