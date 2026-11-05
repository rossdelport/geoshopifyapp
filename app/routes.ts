import type { RouteConfig, RouteConfigEntry } from "@react-router/dev/routes";
import { route } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

// Pages come from the files in app/routes (flat routes). One addition: in the agency hub (Ross, 5 Nov 2026) a client's
// store pages (guide calendar, buying questions...) open under /dash/clients/<store id>/..., inside that client's frame
// (routes/dash.clients.$id.tsx), using the same files as a store owner's own pages under /dash.
const CLIENT_STORE_PAGES: [path: string, file: string][] = [
  ["guides", "routes/dash.guides.tsx"],
  ["guides/:slot", "routes/dash.guides_.$slot.tsx"],
  ["questions", "routes/dash.questions.tsx"],
  ["sites", "routes/dash.sites.tsx"],
  ["reddit", "routes/dash.reddit.tsx"],
  ["tracking", "routes/dash.tracking.tsx"],
];

const CLIENT_FRAME = "routes/dash.clients.$id.tsx";

function addClientStorePages(entries: RouteConfigEntry[]): boolean {
  for (const e of entries) {
    if (e.file === CLIENT_FRAME) {
      e.children = [
        ...(e.children ?? []),
        ...CLIENT_STORE_PAGES.map(([path, file]) => route(path, file, { id: `client-${path.replace(/[/:]+/g, "-")}` })),
      ];
      return true;
    }
    if (e.children && addClientStorePages(e.children)) return true;
  }
  return false;
}

export default flatRoutes().then((routes) => {
  if (!addClientStorePages(routes)) throw new Error(`routes.ts: ${CLIENT_FRAME} is missing, so a client's store pages have nowhere to go`);
  return routes;
}) satisfies RouteConfig;
