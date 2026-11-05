import type { LinksFunction, LoaderFunctionArgs, MetaFunction, ShouldRevalidateFunction } from "react-router";
import { Form, Link, NavLink, Outlet, redirect, useLoaderData, useLocation } from "react-router";
import db from "../db.server";
import { ICONS, Icon, LoadBar, Logo, PageSkeleton, usePendingPage, useSlowLoad } from "../components/web";
import { BrandMark, flagOf } from "../components/hub";
import { isAdmin, requireSession } from "../lib/web-auth.server";
import { clientIdFromPath, frameKey, isHubPath, storeBase } from "../lib/hub-paths";
import { clientMenu } from "../lib/hub.server";
import { getPlan } from "../lib/plans";
import { outreachUsedThisMonth } from "../lib/outreach.server";
import { writersUsedThisMonth } from "../lib/trusted-sites.server";
import { countGuidePagesThisMonth } from "../lib/usage.server";
import { localMonthStart } from "../lib/guide-calendar";
import styles from "../styles/web.css?url";
import hubStyles from "../styles/hub.css?url";

// The FirstPicked web app's frame: the menu on the left (a top bar on phones) and the page on the right. Like RankPill's
// layout (Ross, 2026-10-14) in FirstPicked's colours: menu sections, this month's allowance, the store and the account at
// the bottom.
//
// Three menus (Ross, 5 Nov 2026: "i want the dash to be the hub for me"):
// - hub: an admin on the agency hub's own pages (all clients, daily log, add a client, admin): no store needed;
// - client: an admin on one client's pages (/dash/clients/<store id>/...): that client's pages and their store's tools;
// - store: everyone else, on their own store (as before).

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: styles },
  { rel: "stylesheet", href: hubStyles },
];
export const meta: MetaFunction = () => [{ title: "FirstPicked" }, { name: "robots", content: "noindex" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const pathname = new URL(request.url).pathname;
  const clientId = clientIdFromPath(pathname);
  const { user, shop } = await requireSession(request); // one round trip for the account and its store
  if (!clientId && isHubPath(pathname) && isAdmin(user.email)) return { mode: "hub" as const, email: user.email, clients: await clientMenu() };
  if (!shop) throw redirect("/start");
  const plan = getPlan(shop.plan);
  const [writersUsed, pitchesUsed, guidesUsed, client] = await Promise.all([
    plan.writersPerMonth ? writersUsedThisMonth(shop.id) : 0,
    plan.writersPerMonth ? outreachUsedThisMonth(shop.id) : 0,
    plan.writersPerMonth ? countGuidePagesThisMonth(shop.id, localMonthStart(new Date(), shop.country)) : 0,
    clientId ? db.client.findUnique({ where: { shopId: shop.id }, select: { status: true } }) : null,
  ]);
  return {
    mode: clientId ? ("client" as const) : ("store" as const),
    admin: isAdmin(user.email),
    email: user.email,
    base: storeBase(pathname),
    shopId: shop.id,
    clientStatus: client?.status ?? null,
    store: shop.name || shop.primaryDomain || shop.domain,
    host: shop.primaryDomain || shop.domain,
    country: shop.country,
    plan: plan.name,
    left: plan.writersPerMonth
      ? { writers: Math.max(0, plan.writersPerMonth - writersUsed), pitches: Math.max(0, plan.outreachPerMonth - pitchesUsed), guides: Math.max(0, plan.guidePagesPerMonth - guidesUsed) }
      : null,
  };
};

// The menu, store and allowance change when a form is sent (a writer lookup, a pitch, a new client) and when background
// work finds outreach targets. So the frame reloads after forms (not search forms or admin buttons), when moving
// between the hub, a client and a store, on refreshes of the same page (the dashboard's while a check runs) and when
// opening Sites AI trusts, where the allowance matters; moving between other pages keeps it as it is.
export const shouldRevalidate: ShouldRevalidateFunction = ({ formMethod, formAction, currentUrl, nextUrl, defaultShouldRevalidate }) => {
  if (formMethod) return formMethod.toUpperCase() !== "GET" && !formAction?.startsWith("/dash/admin") ? defaultShouldRevalidate : false;
  if (frameKey(currentUrl.pathname) !== frameKey(nextUrl.pathname)) return true;
  return currentUrl.href === nextUrl.href || nextUrl.pathname.endsWith("/sites") ? defaultShouldRevalidate : false;
};

type NavItem = { to: string; label: string; d: string; end?: boolean };

/** A store's own tools: under /dash for its owner, under /dash/clients/<id> in the hub. */
const storeTools = (base: string): NavItem[] => [
  { to: `${base}/questions`, label: "Buying questions", d: ICONS.question },
  { to: `${base}/sites`, label: "Sites AI trusts", d: ICONS.shield },
  { to: `${base}/reddit`, label: "Reddit threads", d: ICONS.chat },
  { to: `${base}/guides`, label: "Guide calendar", d: ICONS.calendar },
];

function NavGroup({ label, items, navClass, className }: { label: string; items: NavItem[]; navClass: NavClass; className?: string }) {
  return (
    <div className={`w-nav-group${className ? ` ${className}` : ""}`}>
      <span className="w-nav-label">{label}</span>
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end ?? false} prefetch="intent" className={navClass}>
          <Icon d={n.d} />
          {n.label}
        </NavLink>
      ))}
    </div>
  );
}

type NavClass = (s: { isActive: boolean; isPending: boolean }) => string | undefined;

function Me({ email }: { email: string }) {
  return (
    <div className="w-me">
      <span className="w-avatar" aria-hidden="true">
        {email.slice(0, 1).toUpperCase()}
      </span>
      <span className="w-me-email">{email}</span>
      <Form method="post" action="/logout">
        <button className="w-icon-btn" type="submit" title="Sign out" aria-label="Sign out">
          <Icon d={ICONS.out} />
        </button>
      </Form>
    </div>
  );
}

function Allowance({ left }: { left: { writers: number; pitches: number; guides: number } }) {
  return (
    <div className="w-allow" title="What’s left of this month’s allowance. It resets on the 1st.">
      <span className="w-nav-label">Left this month</span>
      <span>
        <Icon d={ICONS.user} /> {left.writers} writer lookups
      </span>
      <span>
        <Icon d={ICONS.send} /> {left.pitches} pitches
      </span>
      <span>
        <Icon d={ICONS.calendar} /> {left.guides} guide {left.guides === 1 ? "page" : "pages"}
      </span>
    </div>
  );
}

export default function Dash() {
  const data = useLoaderData<typeof loader>();
  const here = useLocation().pathname;
  const pending = usePendingPage();
  // Moving between admin tabs keeps the admin frame, and moving between one client's pages keeps the client's bar:
  // those pages show their own skeleton.
  const ownSkeleton =
    pending &&
    ((pending.path.startsWith("/dash/admin") && here.startsWith("/dash/admin")) ||
      (clientIdFromPath(pending.path) !== null && clientIdFromPath(pending.path) === clientIdFromPath(here)));
  const slow = useSlowLoad(pending && !ownSkeleton ? pending.key : null);
  // The menu moves to the page you clicked straight away, while it loads.
  const navClass: NavClass = ({ isActive, isPending }) => (isPending || (isActive && !pending) ? "active" : undefined);

  let nav;
  let foot;
  if (data.mode === "hub") {
    nav = (
      <>
        <NavGroup
          label="Agency"
          navClass={navClass}
          items={[
            { to: "/dash", label: "Clients", d: ICONS.home, end: true },
            { to: "/dash/log", label: "Daily log", d: ICONS.calendar },
            { to: "/dash/clients/new", label: "Add a client", d: ICONS.user },
          ]}
        />
        {data.clients.length ? (
          <div className="w-nav-group h-nav-clients">
            <span className="w-nav-label">Clients</span>
            {data.clients.map((c) => (
              <NavLink key={c.shopId} to={`/dash/clients/${c.shopId}`} prefetch="intent" className={navClass}>
                <BrandMark name={c.name} size={18} />
                <span className="h-nav-name">{c.name}</span>
                <span className={`h-nav-dot${c.status === "active" ? " active" : ""}`} title={c.status === "active" ? "Active" : c.status === "paused" ? "Paused" : "Ended"} />
              </NavLink>
            ))}
          </div>
        ) : null}
        <NavGroup label="Owner" navClass={navClass} items={[{ to: "/dash/admin", label: "Admin", d: ICONS.gauge }]} />
      </>
    );
    foot = <Me email={data.email} />;
  } else if (data.mode === "client") {
    const b = data.base;
    nav = (
      <>
        <Link to="/dash" className="h-back" prefetch="intent">
          ‹ All clients
        </Link>
        <div className="h-side-client">
          <BrandMark name={data.store} size={30} />
          <b>{data.store}</b>
          <span>{data.clientStatus ? `${data.clientStatus === "active" ? "Active" : data.clientStatus === "paused" ? "Paused" : "Ended"} · ${data.plan}` : "Not a client"}</span>
        </div>
        <NavGroup
          label="Client"
          navClass={navClass}
          items={[
            { to: b, label: "Overview", d: ICONS.home, end: true },
            { to: `${b}/log`, label: "Work log", d: ICONS.check },
            { to: `${b}/stats`, label: "Store stats", d: ICONS.money },
            { to: `${b}/reports`, label: "Reports", d: ICONS.mail },
            { to: `${b}/details`, label: "Details", d: ICONS.user },
          ]}
        />
        <NavGroup label="Their store" navClass={navClass} items={[...storeTools(b), { to: `${b}/tracking`, label: "Tracking code", d: ICONS.code }]} />
      </>
    );
    foot = (
      <>
        {data.left ? <Allowance left={data.left} /> : null}
        <Me email={data.email} />
      </>
    );
  } else {
    nav = (
      <>
        <NavGroup label="General" navClass={navClass} items={[{ to: "/dash", label: "Dashboard", d: ICONS.home, end: true }, ...storeTools("/dash")]} />
        <NavGroup label="Setup" navClass={navClass} items={[{ to: "/dash/tracking", label: "Tracking code", d: ICONS.code }]} />
        <div className="w-nav-group">
          <span className="w-nav-label">Support</span>
          <NavLink to="/dash/ask" prefetch="intent" className={navClass}>
            <Icon d={ICONS.spark} />
            Ask FirstPicked
          </NavLink>
          <a href="mailto:ross@firstpicked.com.au">
            <Icon d={ICONS.mail} />
            Email us
          </a>
        </div>
        {data.admin ? <NavGroup label="Owner" navClass={navClass} items={[{ to: "/dash/admin", label: "Admin", d: ICONS.gauge }]} /> : null}
      </>
    );
    foot = (
      <>
        {data.left ? <Allowance left={data.left} /> : null}
        <div className="w-store">
          <span className="w-store-mark" aria-hidden="true">
            {flagOf(data.country) ?? data.store.slice(0, 1).toUpperCase()}
          </span>
          <span className="w-store-name">
            <b>{data.store}</b>
            <span>{data.host}</span>
          </span>
          <span className="w-plan">{data.plan}</span>
        </div>
        <Me email={data.email} />
      </>
    );
  }

  return (
    <div className="w">
      <LoadBar />
      <div className="w-shell">
        <aside className="w-side">
          <Logo to="/dash" />
          <nav className="w-nav" aria-label="Main">
            {nav}
          </nav>
          <div className="w-side-foot">{foot}</div>
        </aside>
        <main className="w-main">{pending && slow ? <PageSkeleton path={pending.path} hub={data.mode === "hub"} /> : <Outlet />}</main>
      </div>
    </div>
  );
}
