import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";

// usegeo.app/it: the home page in Italian (built from design/overview/i18n/it.json by assemble.mjs).
import home from "../home/home-it.html?raw";

export const loader = async ({ request }: LoaderFunctionArgs) => serveHome(request, home);
