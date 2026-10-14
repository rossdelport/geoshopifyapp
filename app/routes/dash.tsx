import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, NavLink, Outlet, useLoaderData } from "react-router";
import { Logo } from "../components/web";
import { requireWebShop } from "../lib/web-auth.server";
import styles from "../styles/web.css?url";

// The GEO web app's frame: the menu on the left (a top bar on phones) and the page on the right.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];
export const meta: MetaFunction = () => [{ title: "GEO" }, { name: "robots", content: "noindex" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { user, shop } = await requireWebShop(request);
  return { email: user.email, store: shop.name || shop.primaryDomain || shop.domain };
};

const icon = (d: string) => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const NAV = [
  { to: "/dash", label: "Dashboard", end: true, d: "M3 10.5 10 4l7 6.5V17h-5v-4H8v4H3z" },
  { to: "/dash/questions", label: "Buying questions", d: "M7.5 7.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M10 15h.01M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" },
  { to: "/dash/sites", label: "Sites AI trusts", d: "M10 2.5 3.5 5v4.5c0 4 2.8 7 6.5 8 3.7-1 6.5-4 6.5-8V5zM7 10l2 2 4-4" },
  { to: "/dash/tracking", label: "Tracking code", d: "M7 6 3 10l4 4M13 6l4 4-4 4" },
];

export default function Dash() {
  const { email, store } = useLoaderData<typeof loader>();
  return (
    <div className="w">
      <div className="w-shell">
        <aside className="w-side">
          <Logo />
          <nav className="w-nav" aria-label="Main">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
                {icon(n.d)}
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="w-side-foot">
            <span>
              <b>{store}</b>
              <span className="w-note">{email}</span>
            </span>
            <Form method="post" action="/logout">
              <button className="w-link-btn" type="submit">
                Sign out
              </button>
            </Form>
          </div>
        </aside>
        <main className="w-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
