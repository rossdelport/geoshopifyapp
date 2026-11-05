import type { ActionFunctionArgs, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { Link, Outlet, redirect, useLoaderData } from "react-router";
import { PageSkeleton, usePendingPage, useSlowLoad } from "../components/web";
import { BrandMark, type ClientActionResult, StatusChip } from "../components/hub";
import {
  addWorkNote,
  checkClientNow,
  deleteWorkNote,
  requireClient,
  retryClientSetup,
  setClientStatus,
  syncClientCatalog,
} from "../lib/clients.server";
import { makeClientReport } from "../lib/client-report.server";
import { isReportKind } from "../lib/client-report";
import { STATUS_LABEL, clientMonth, hubDay, isClientStatus, readNoteForm } from "../lib/clients";
import { clientIdFromPath } from "../lib/hub-paths";
import { fromAnotherSite } from "../lib/public-form.server";

// One client in the agency hub (Ross, 5 Nov 2026): /dash/clients/<store id>/... The bar above every client page (back
// to all clients, the brand, its status and month of the work), and the buttons any client page can press without
// leaving it (they post here): try setup again, check AI now, read the products again, make a report, add or delete a
// work log entry, pause or start the work again.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, client } = await requireClient(request);
  return {
    shopId: shop.id,
    name: shop.name || shop.primaryDomain || shop.domain,
    host: shop.primaryDomain || shop.domain,
    status: client && isClientStatus(client.status) ? client.status : null,
    month: client ? clientMonth(client.startedOn, hubDay()) : 0,
  };
};

// Moving between one client's pages keeps the bar; a form (a new status, new details) or another client reloads it.
export const shouldRevalidate: ShouldRevalidateFunction = ({ formMethod, currentParams, nextParams, defaultShouldRevalidate }) =>
  formMethod ? defaultShouldRevalidate : currentParams.id !== nextParams.id;

const STATUS_DONE = { active: "The work is running again.", paused: "Paused. Nothing new runs until you start it again.", ended: "Ended. Everything made so far stays." };

export const action = async ({ request }: ActionFunctionArgs): Promise<ClientActionResult> => {
  const { user, shop, client } = await requireClient(request);
  if (fromAnotherSite(request)) return { ok: false, error: "Please use the buttons on FirstPicked." };
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  switch (intent) {
    case "retry-setup":
      return retryClientSetup(shop.id);
    case "check-now":
      return checkClientNow(shop.id);
    case "catalog-sync":
      return syncClientCatalog(shop.id);
    case "report": {
      const kind = form.get("kind");
      if (!client) return { ok: false, error: "Make them a client first." };
      const made = await makeClientReport(shop.id, isReportKind(kind) ? kind : "week", user.email);
      if (!made.ok) return made;
      // Straight to their Reports page, where the new report waits with its link, Copy link and Email it.
      throw redirect(`/dash/clients/${shop.id}/reports?made=${made.id}`);
    }
    case "add-note": {
      const note = readNoteForm(form, hubDay());
      if (!note.ok) return { ok: false, error: note.error };
      await addWorkNote(shop.id, note.kind, note.text, note.day, user.email);
      return { ok: true, message: "Added to the work log." };
    }
    case "delete-note":
      return (await deleteWorkNote(shop.id, String(form.get("noteId") ?? ""))) ? { ok: true, message: "Deleted." } : { ok: false, error: "That entry is already gone." };
    case "status": {
      const status = form.get("status");
      if (!client) return { ok: false, error: "Make them a client first." };
      if (!isClientStatus(status)) return { ok: false, error: "Please pick Active, Paused or Ended." };
      await setClientStatus(shop.id, status, user.email);
      return { ok: true, message: STATUS_DONE[status] };
    }
  }
  return { ok: false, error: "Unknown action." };
};

export default function ClientFrame() {
  const c = useLoaderData<typeof loader>();
  // Moving between this client's pages: a skeleton under the bar while the next page loads.
  const pending = usePendingPage();
  const same = pending && clientIdFromPath(pending.path) === c.shopId ? pending : null;
  const slow = useSlowLoad(same?.key ?? null);
  return (
    <>
      <nav className="h-crumb" aria-label="Client">
        <Link to="/dash" prefetch="intent">
          All clients
        </Link>
        <span className="h-crumb-sep" aria-hidden="true">
          /
        </span>
        <Link to={`/dash/clients/${c.shopId}`} className="h-crumb-name" prefetch="intent">
          <BrandMark name={c.name} size={22} />
          {c.name}
        </Link>
        {c.status ? <StatusChip status={c.status} /> : <span className="w-pill">Not a client</span>}
        {c.status && c.month ? <span>Month {c.month}</span> : null}
        <a href={`https://${c.host}`} target="_blank" rel="noreferrer">
          {c.host} ↗
        </a>
        {c.status && c.status !== "active" ? <span className="w-note">{STATUS_LABEL[c.status]}: nothing new runs</span> : null}
      </nav>
      {same && slow ? <PageSkeleton path={same.path} /> : <Outlet />}
    </>
  );
}
