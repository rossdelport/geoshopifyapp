import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";

// usegeo.app/de: the home page in German (built from design/overview/i18n/de.json by assemble.mjs).
import home from "../home/home-de.html?raw";

export const loader = async ({ request }: LoaderFunctionArgs) => serveHome(request, home);
