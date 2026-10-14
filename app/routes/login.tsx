import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { Solo } from "../components/web";
import { currentUser, safeNext, sendLoginLink } from "../lib/web-auth.server";
import { fromAnotherSite } from "../lib/public-form.server";
import styles from "../styles/web.css?url";

// usegeo.app/login: type your email, get a sign-in link. No passwords (Ross, 2026-10-14).

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];
export const meta: MetaFunction = () => [{ title: "Sign in · GEO" }, { name: "robots", content: "noindex" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const next = safeNext(new URL(request.url).searchParams.get("next"));
  if (await currentUser(request)) throw redirect(next);
  return { next };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (fromAnotherSite(request)) return { ok: false as const, error: "Please use the form on the GEO website." };
  const form = await request.formData();
  try {
    return await sendLoginLink(form.get("email"), form.get("next"));
  } catch (err) {
    console.error("[login] could not send a link", err);
    return { ok: false as const, error: "Something went wrong. Please try again." };
  }
};

export default function Login() {
  const { next } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";

  if (result?.ok) {
    return (
      <Solo>
        <h1>Check your email</h1>
        <p>
          We sent a sign-in link to <b>{result.email}</b>. Click it to sign in. It works once, for 30 minutes.
        </p>
        <p className="w-note">Nothing there? Check your spam folder, or go back and try again.</p>
        <a className="w-btn w-btn-ghost" href={`/login?next=${encodeURIComponent(next)}`}>
          Use another email
        </a>
      </Solo>
    );
  }

  return (
    <Solo>
      <div>
        <h1>Sign in to GEO</h1>
        <p style={{ marginTop: 6 }}>Type your email and we’ll send you a link. No password needed.</p>
      </div>
      <Form method="post" className="w-form">
        <input type="hidden" name="next" value={next} />
        <div className="w-field">
          <label htmlFor="email">Email</label>
          <input className="w-input" id="email" name="email" type="email" autoComplete="email" required placeholder="you@yourstore.com" />
        </div>
        {result && !result.ok ? (
          <p className="w-err" role="alert">
            {result.error}
          </p>
        ) : null}
        <button className="w-btn" type="submit" disabled={busy}>
          {busy ? "Sending…" : "Email me a sign-in link"}
        </button>
      </Form>
      <p className="w-note">New to GEO? The same link creates your account.</p>
    </Solo>
  );
}
