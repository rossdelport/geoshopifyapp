// Where a store's pages live (shared by server and pages). A store owner's own pages are under /dash (/dash/guides,
// /dash/reddit...). In the agency hub (Ross, 5 Nov 2026) the same pages open for one client under
// /dash/clients/<store id>/... (routes.ts gives them both addresses), so every link a page makes starts from its base.

/** The store id in a client address ("/dash/clients/abc/guides", or its data request "/dash/clients/abc.data"), else null. */
export function clientIdFromPath(pathname: string): string | null {
  const m = /^\/dash\/clients\/([A-Za-z0-9_-]{1,64})(?=[/.]|$)/.exec(pathname);
  return m && m[1] !== "new" ? m[1] : null;
}

/** The start of every link to the store's pages: "/dash" for an owner, "/dash/clients/<id>" in the hub. */
export function storeBase(pathname: string): string {
  const id = clientIdFromPath(pathname);
  return id ? `/dash/clients/${id}` : "/dash";
}

/**
 * The agency hub's own pages, which need no store: all clients (/dash), the daily log, adding a client, and the admin
 * area. For admins only; everyone else's /dash is their store's dashboard.
 */
export function isHubPath(pathname: string): boolean {
  return /^\/dash(\/(log|clients|clients\/new|admin(\/[\w-]*)*))?(\/|\.data)?$/.test(pathname);
}

/** Which frame a page sits in, so the menu reloads when it moves between them: one client's id, the hub, or a store. */
export const frameKey = (pathname: string) => clientIdFromPath(pathname) ?? (isHubPath(pathname) ? "hub" : "store");
