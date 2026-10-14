import type { LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, NavLink, Outlet, useLoaderData } from "react-router";
import { ICONS, Icon, Logo } from "../components/web";
import { requireWebShop } from "../lib/web-auth.server";
import { isAdmin } from "../lib/admin.server";
import { getPlan } from "../lib/plans";
import { outreachUsedThisMonth } from "../lib/outreach.server";
import { writersUsedThisMonth } from "../lib/trusted-sites.server";
import styles from "../styles/web.css?url";

// The GEO web app's frame: the menu on the left (a top bar on phones) and the page on the right. Like RankPill's
// layout (Ross, 2026-10-14) in GEO's colours: menu sections, this month's allowance, the store and the account at
// the bottom.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];
export const meta: MetaFunction = () => [{ title: "GEO" }, { name: "robots", content: "noindex" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { user, shop } = await requireWebShop(request);
  const plan = getPlan(shop.plan);
  const [writersUsed, pitchesUsed] = plan.writersPerMonth
    ? await Promise.all([writersUsedThisMonth(shop.id), outreachUsedThisMonth(shop.id)])
    : [0, 0];
  return {
    admin: isAdmin(user.email),
    email: user.email,
    store: shop.name || shop.primaryDomain || shop.domain,
    host: shop.primaryDomain || shop.domain,
    country: shop.country,
    plan: plan.name,
    left: plan.writersPerMonth
      ? { writers: Math.max(0, plan.writersPerMonth - writersUsed), pitches: Math.max(0, plan.outreachPerMonth - pitchesUsed) }
      : null,
  };
};

const SECTIONS = [
  {
    label: "General",
    items: [
      { to: "/dash", label: "Dashboard", end: true, d: ICONS.home },
      { to: "/dash/questions", label: "Buying questions", d: ICONS.question },
      { to: "/dash/sites", label: "Sites AI trusts", d: ICONS.shield },
      { to: "/dash/reddit", label: "Reddit threads", d: ICONS.chat },
    ],
  },
  { label: "Setup", items: [{ to: "/dash/tracking", label: "Tracking code", d: ICONS.code }] },
];

/** "AU" -> the Australian flag emoji. */
const flag = (cc: string | null) =>
  cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : null;

export default function Dash() {
  const { admin, email, store, host, country, plan, left } = useLoaderData<typeof loader>();
  return (
    <div className="w">
      <div className="w-shell">
        <aside className="w-side">
          <Logo />
          <nav className="w-nav" aria-label="Main">
            {SECTIONS.map((s) => (
              <div key={s.label} className="w-nav-group">
                <span className="w-nav-label">{s.label}</span>
                {s.items.map((n) => (
                  <NavLink key={n.to} to={n.to} end={"end" in n ? n.end : false} className={({ isActive }) => (isActive ? "active" : undefined)}>
                    <Icon d={n.d} />
                    {n.label}
                  </NavLink>
                ))}
              </div>
            ))}
            <div className="w-nav-group">
              <span className="w-nav-label">Support</span>
              <NavLink to="/dash/ask" className={({ isActive }) => (isActive ? "active" : undefined)}>
                <Icon d={ICONS.spark} />
                Ask GEO
              </NavLink>
              <a href="mailto:ross@usegeo.app">
                <Icon d={ICONS.mail} />
                Email us
              </a>
            </div>
            {admin ? (
              <div className="w-nav-group">
                <span className="w-nav-label">Owner</span>
                <NavLink to="/dash/admin" className={({ isActive }) => (isActive ? "active" : undefined)}>
                  <Icon d={ICONS.gauge} />
                  Admin
                </NavLink>
              </div>
            ) : null}
          </nav>

          <div className="w-side-foot">
            {left ? (
              <div className="w-allow" title="What’s left of this month’s allowance. It resets on the 1st.">
                <span className="w-nav-label">Left this month</span>
                <span>
                  <Icon d={ICONS.user} /> {left.writers} writer lookups
                </span>
                <span>
                  <Icon d={ICONS.send} /> {left.pitches} pitches
                </span>
              </div>
            ) : null}

            <div className="w-store">
              <span className="w-store-mark" aria-hidden="true">
                {flag(country) ?? store.slice(0, 1).toUpperCase()}
              </span>
              <span className="w-store-name">
                <b>{store}</b>
                <span>{host}</span>
              </span>
              <span className="w-plan">{plan}</span>
            </div>

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
          </div>
        </aside>
        <main className="w-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
