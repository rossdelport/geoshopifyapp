import type { LoaderFunctionArgs } from "react-router";
import { NavLink, Outlet } from "react-router";
import { requireAdmin } from "../lib/admin.server";
import { PageHead } from "../components/web";

// usegeo.app/dash/admin: Ross's admin area (lib/admin.server.ts). Everyone else gets "Not found".

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  return null;
};

const TABS = [
  { to: "/dash/admin", label: "Overview", end: true },
  { to: "/dash/admin/usage", label: "Usage" },
  { to: "/dash/admin/users", label: "Users" },
  { to: "/dash/admin/waitlist", label: "Waitlist" },
  { to: "/dash/admin/support", label: "Support" },
  { to: "/dash/admin/system", label: "System" },
];

export default function Admin() {
  return (
    <>
      <PageHead title="Admin" right={<span className="w-chip">Only you can see this</span>} />
      <nav className="w-tabs" aria-label="Admin">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : undefined)}>
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
