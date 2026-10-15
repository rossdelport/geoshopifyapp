import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useLoaderData, useNavigation } from "react-router";
import { Solo } from "../components/web";
import { loginLinkUsable, redeemLoginLink } from "../lib/web-auth.server";
import styles from "../styles/web.css?url";

// usegeo.app/login/<token>: the link in the sign-in email. Opening it only shows a button: email scanners open
// links before people do, and a link works once. The button signs this browser in and goes on to the app.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];
export const meta: MetaFunction = () => [{ title: "Sign in · GEO" }, { name: "robots", content: "noindex" }];

export const loader = async ({ params }: LoaderFunctionArgs) => ({ usable: await loginLinkUsable(params.token ?? "") });

export const action = async ({ params }: ActionFunctionArgs) => {
  const signedIn = await redeemLoginLink(params.token ?? "");
  if (signedIn) throw redirect(signedIn.next, { headers: { "Set-Cookie": signedIn.setCookie, "Cache-Control": "no-store" } });
  return { usable: false };
};

export default function LoginLink() {
  const { usable } = useLoaderData<typeof loader>();
  const busy = useNavigation().state !== "idle";
  if (!usable) {
    return (
      <Solo>
        <h1>This link has expired</h1>
        <p>Sign-in links work once, for 30 minutes. Ask for a new one and it’ll arrive in a few seconds.</p>
        <a className="w-btn" href="/login">
          Get a new link
        </a>
      </Solo>
    );
  }
  return (
    <Solo>
      <h1>Welcome to GEO</h1>
      <p>Click the button to finish signing in.</p>
      <Form method="post">
        <button className="w-btn" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? (
            <>
              <span className="w-spin" aria-hidden="true" /> Signing in…
            </>
          ) : (
            "Continue to GEO"
          )}
        </button>
      </Form>
    </Solo>
  );
}
