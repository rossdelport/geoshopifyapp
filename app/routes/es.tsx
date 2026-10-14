import type { LoaderFunctionArgs } from "react-router";
import { serveHome } from "../lib/home-page.server";

// usegeo.app/es: the home page in Spanish (built from design/overview/i18n/es.json by assemble.mjs).
import home from "../home/home-es.html?raw";

export const loader = async ({ request }: LoaderFunctionArgs) => serveHome(request, home);
