import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { Solo } from "../components/web";
import { currentUser, safeNext } from "../lib/web-auth.server";
import { adminPassword, isAdmin, passwordSignIn } from "../lib/admin.server";
import { clientIp, fromAnotherSite } from "../lib/public-form.server";
import styles from "../styles/web.css?url";

// firstpicked.com.au/admin: the admin area's password page (Ross, 4 Nov 2026: "have it password protected not link
// protected"). The right password (GEO_ADMIN_PASSWORD on Railway) signs this browser in for 30 days and opens the
// admin Overview. Signed-out visits to /dash/admin come here (web-auth.server.ts).

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];
export const meta: MetaFunction = () => [{ title: "Admin · FirstPicked" }, { name: "robots", content: "noindex" }];

/** Only somewhere inside the admin area. */
const adminNext = (raw: unknown) => {
  const next = safeNext(raw);
  return next.startsWith("/dash/admin") ? next : "/dash/admin";
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const next = adminNext(new URL(request.url).searchParams.get("next"));
  const user = await currentUser(request);
  if (user && isAdmin(user.email)) throw redirect(next);
  return { next, on: Boolean(adminPassword()) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (fromAnotherSite(request)) return { error: "Please use the form on the FirstPicked website." };
  const form = await request.formData();
  const out = await passwordSignIn(form.get("password"), clientIp(request));
  if (!out.ok) return { error: out.error };
  throw redirect(adminNext(form.get("next")), { headers: { "Set-Cookie": out.setCookie, "Cache-Control": "no-store" } });
};

export default function AdminPassword() {
  const { next, on } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  const emailLink = `/login?next=${encodeURIComponent(next)}`;
  if (!on) {
    return (
      <Solo>
        <h1>Admin</h1>
        <p>The admin password isn’t set up yet. Please sign in with an email link.</p>
        <a className="w-btn" href={emailLink}>
          Email me a sign-in link
        </a>
      </Solo>
    );
  }
  return (
    <Solo>
      <div>
        <h1>Admin</h1>
        <p style={{ marginTop: 6 }}>Type the password. This phone or computer then stays signed in for 30 days.</p>
      </div>
      <Form method="post" className="w-form">
        <input type="hidden" name="next" value={next} />
        <div className="w-field">
          <label htmlFor="password">Password</label>
          <input className="w-input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {result?.error ? (
          <p className="w-err" role="alert">
            {result.error}
          </p>
        ) : null}
        <button className="w-btn" type="submit" disabled={busy}>
          {busy ? (
            <>
              <span className="w-spin" aria-hidden="true" /> Opening…
            </>
          ) : (
            "Open admin"
          )}
        </button>
      </Form>
      <p className="w-note">
        Or <a href={emailLink}>sign in with an email link</a>.
      </p>
    </Solo>
  );
}
