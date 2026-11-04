import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";

// firstpicked.com.au/fr: the home page in French (built from design/overview/i18n/fr.json by assemble.mjs).
import home from "../home/home-fr.html?raw";

export const loader = async ({ request }: LoaderFunctionArgs) => serveHome(request, home);
