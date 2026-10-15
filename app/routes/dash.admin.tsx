import type { LoaderFunctionArgs } from "react-router";
import { Outlet, useLocation, useNavigation } from "react-router";
import { requireAdmin } from "../lib/admin.server";
import { AdminSkeleton, PageHead, Tabs } from "../components/web";

// usegeo.app/dash/admin: Ross's admin area (lib/admin.server.ts). Everyone else gets "Not found".

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireAdmin(request);
  return null;
};

// The admin check runs when the area opens; each admin page and button checks again for itself, so this frame
// never needs reloading.
export const shouldRevalidate = () => false;

const TABS = [
  { to: "/dash/admin", label: "Overview", end: true },
  { to: "/dash/admin/usage", label: "Usage" },
  { to: "/dash/admin/users", label: "Users" },
  { to: "/dash/admin/waitlist", label: "Waitlist" },
  { to: "/dash/admin/support", label: "Support" },
  { to: "/dash/admin/system", label: "System" },
];

export default function Admin() {
  const nav = useNavigation();
  const here = useLocation().pathname;
  // While another admin tab loads, its tab is chosen straight away and its numbers show as grey shapes.
  const next = nav.state === "loading" && !nav.formMethod && nav.location.pathname.startsWith("/dash/admin") ? nav.location.pathname : null;
  const path = next ?? here;
  const active = (t: (typeof TABS)[number]) => (t.end ? path === t.to : path.startsWith(t.to));
  return (
    <>
      <PageHead title="Admin" right={<span className="w-chip">Only you can see this</span>} />
      <Tabs label="Admin" items={TABS.map((t) => ({ to: t.to, label: t.label, active: active(t) }))} />
      {next && next !== here ? <AdminSkeleton /> : <Outlet />}
    </>
  );
}
