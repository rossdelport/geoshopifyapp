// The agency hub's database work (Ross, 5 Nov 2026): add a client, change their details, pause, end or delete them,
// and the buttons the hub shows when something needs Ross (try setup again, check AI now, read the catalog again).
// The rules are in lib/clients.ts; the pages are routes/dash._index.tsx (for admins) and routes/dash.clients.*.

import { Prisma } from "@prisma/client";
import db from "../db.server";
import { requireAdmin } from "./admin.server";
import { onPlanChanged } from "./billing.server";
import { activeScan, retrySetup } from "./dashboard.server";
import { enqueue } from "./jobs.server";
import { canRunScan } from "./limits";
import { getPlan } from "./plans";
import { STORE_ERRORS, findShopifyStore, storeHost } from "./public-catalog.server";
import { startScan } from "./scan.server";
import { getUsageFor } from "./usage.server";
import { requireWebShop } from "./web-auth.server";
import { clientIdFromPath } from "./hub-paths";
import { type ClientInput, type ClientStatus, type NoteKind, hubDay, noteTime, planForStatus } from "./clients";

/** The hub's own pages (all clients, add a client, the daily log): admins only, everyone else gets "Not found". */
export const requireHubAdmin = requireAdmin;

/** A client's page in the hub: the admin, the store the address names, and its client record (null: not a client yet). */
export async function requireClient(request: Request) {
  if (!clientIdFromPath(new URL(request.url).pathname)) throw new Response("Not found", { status: 404 });
  const { user, shop } = await requireWebShop(request); // checks the admin, and finds the store, for client addresses
  const client = await db.client.findUnique({ where: { shopId: shop.id } });
  return { user, shop, client };
}

const fields = (input: ClientInput) => ({
  contactName: input.contactName,
  email: input.email,
  phone: input.phone,
  feeAud: input.feeAud,
  startedOn: input.startedOn,
  notes: input.notes,
});

/**
 * Add a client from their store's address: the store is read from its own address (like /start), added to FirstPicked
 * if it's new (with no login of its own: only the hub opens it) and set up on Done for you straight away. A store
 * already on FirstPicked (someone signed up, or the old Shopify app) becomes a client as it is.
 */
export async function addClient(
  rawStore: unknown,
  input: ClientInput,
  by: string,
): Promise<{ ok: true; shopId: string } | { ok: false; error: string }> {
  const host = storeHost(rawStore);
  if (!host) return { ok: false, error: "Please type their store’s website, like theirstore.com.au." }; // STORE_ERRORS says "your store"
  const found = await findShopifyStore(host);
  if (!found) return { ok: false, error: STORE_ERRORS.notShopify };

  let shop = await db.shop.findUnique({ where: { domain: found.myshopifyDomain }, select: { id: true, status: true, onboarding: true, client: { select: { id: true } } } });
  if (shop?.client) return { ok: false, error: "That store is already one of your clients." };
  if (shop && shop.status !== "installed") return { ok: false, error: "That store was removed from FirstPicked. Please ask Claude to bring it back." };
  if (!shop) {
    try {
      shop = await db.shop.create({
        data: {
          domain: found.myshopifyDomain,
          primaryDomain: found.host,
          name: input.name ?? found.name,
          source: "web",
          status: "installed",
          ...(found.country ? { country: found.country } : {}),
          ...(found.currency ? { currency: found.currency } : {}),
        },
        select: { id: true, status: true, onboarding: true, client: { select: { id: true } } },
      });
    } catch {
      return { ok: false, error: "That store was added a moment ago. Please refresh the page." }; // two adds at once
    }
  } else if (input.name) {
    await db.shop.update({ where: { id: shop.id }, data: { name: input.name } });
  }

  try {
    await db.client.create({ data: { shopId: shop.id, status: input.status, ...fields(input) } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { ok: false, error: "That store is already one of your clients." };
    throw err;
  }
  // The plan first, so setup writes as many buying questions as Done for you checks and starts with its full first check.
  await onPlanChanged(shop.id, planForStatus(input.status), { quiet: true });
  if (shop.onboarding === "new") await enqueue("onboard", {}, { shopId: shop.id, dedupeKey: `onboard:${shop.id}` });
  if (input.status !== "active") await addStatusNote(shop.id, input.status, by);
  return { ok: true, shopId: shop.id };
}

/** Change a client's details (and their status, when it changed). */
export async function updateClient(shopId: string, input: ClientInput, by: string) {
  const before = await db.client.findUniqueOrThrow({ where: { shopId } });
  await db.$transaction([
    db.client.update({ where: { shopId }, data: fields(input) }),
    ...(input.name ? [db.shop.update({ where: { id: shopId }, data: { name: input.name } })] : []),
  ]);
  if (before.status !== input.status) await setClientStatus(shopId, input.status, by);
}

const STATUS_NOTE: Record<ClientStatus, string> = {
  active: "Started the work again",
  paused: "Paused the work",
  ended: "Ended the work",
};

const addStatusNote = (shopId: string, status: ClientStatus, by: string) =>
  db.workNote.create({ data: { shopId, kind: "status", text: STATUS_NOTE[status], createdBy: by } });

/**
 * Active runs the work on Done for you; paused and ended stop it (the free plan: no AI checks, guides or Reddit
 * looks). Everything made so far stays. Returns false when the status was already that.
 */
export async function setClientStatus(shopId: string, status: ClientStatus, by: string): Promise<boolean> {
  const changed = await db.client.updateMany({ where: { shopId, NOT: { status } }, data: { status } });
  if (!changed.count) return false;
  await onPlanChanged(shopId, planForStatus(status), { quiet: true });
  await addStatusNote(shopId, status, by);
  return true;
}

/**
 * Delete a client. A store added in the hub (no login of its own) goes completely, with everything made for it. A
 * store with its own login stays with its owner: only the client record goes, and its work stops. `typed` must be the
 * store's address, so a slip of the finger can't delete anyone.
 */
export async function deleteClient(shopId: string, typed: unknown): Promise<{ ok: true; removed: "store" | "client" } | { ok: false; error: string }> {
  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { domain: true, primaryDomain: true, userId: true, source: true, client: { select: { id: true } } } });
  if (!shop?.client) return { ok: false, error: "That store isn’t a client." };
  const want = (shop.primaryDomain || shop.domain).toLowerCase();
  if (storeHost(typed) !== want && String(typed ?? "").trim().toLowerCase() !== want) return { ok: false, error: `Please type ${want} to delete this client.` };
  if (!shop.userId && shop.source === "web") {
    await db.shop.delete({ where: { id: shopId } }); // its client record, notes, reports and all its data go with it
    return { ok: true, removed: "store" };
  }
  await db.client.delete({ where: { shopId } });
  await onPlanChanged(shopId, "free", { quiet: true });
  return { ok: true, removed: "client" };
}

/** Ross's own entry in a client's work log. */
export function addWorkNote(shopId: string, kind: NoteKind, text: string, day: string, by: string, now = new Date()) {
  return db.workNote.create({ data: { shopId, kind, text, doneAt: noteTime(day, hubDay(now), now), createdBy: by } });
}

/** Delete one of Ross's entries (not the hub's own status entries). */
export async function deleteWorkNote(shopId: string, noteId: string) {
  const gone = await db.workNote.deleteMany({ where: { id: noteId, shopId, kind: { in: ["change", "call", "note"] } } });
  return gone.count > 0;
}

/** The setup stopped partway: start it again (the hub's "Try again"). */
export async function retryClientSetup(shopId: string) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, select: { onboarding: true } });
  if (shop.onboarding === "done") return { ok: false as const, error: "This store is already set up." };
  await retrySetup(shopId);
  return { ok: true as const, message: "Setup started again. It takes a few minutes." };
}

/** Check what AI says now (a light check, like the daily one). Inside the month's cost cap, and once an hour at most. */
export async function checkClientNow(shopId: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, select: { plan: true, onboarding: true } });
  const plan = getPlan(shop.plan);
  if (plan.id === "free") return { ok: false, error: "The work is paused. Make them active to check AI again." };
  if (shop.onboarding !== "done") return { ok: false, error: "The store is still being set up." };
  if (await activeScan(shopId)) return { ok: false, error: "An AI check is already running." };
  const recent = await db.scan.findFirst({ where: { shopId, kind: "manual", status: { not: "failed" }, startedAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent) return { ok: false, error: "An AI check ran less than an hour ago." };
  const cap = canRunScan(plan, await getUsageFor(shopId), true);
  if (!cap.ok) return { ok: false, error: cap.reason ?? "This month’s cost cap is reached." };
  await startScan(shopId, "manual");
  return { ok: true, message: "Checking AI now. It takes a few minutes." };
}

/** Read the store's products again (after the client adds or changes products). */
export async function syncClientCatalog(shopId: string) {
  await enqueue("catalog.sync", {}, { shopId, dedupeKey: `catalog-sync:${shopId}:${hubDay()}` });
  return { ok: true as const, message: "Reading their products again. It takes a minute." };
}
