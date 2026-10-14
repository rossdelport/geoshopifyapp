import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, redirect, useActionData, useNavigation } from "react-router";
import db from "../db.server";
import { Solo } from "../components/web";
import { requireUser } from "../lib/web-auth.server";
import { enqueue } from "../lib/jobs.server";
import { STORE_ERRORS, addWebStore, findShopifyStore, storeHost } from "../lib/public-catalog.server";
import { fromAnotherSite } from "../lib/public-form.server";
import styles from "../styles/web.css?url";

// usegeo.app/start: after the first sign-in, type the Shopify store's address. We read its public pages (no
// Shopify app needed), then set it up: catalog, brand profile, buying questions and the first AI scan.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];
export const meta: MetaFunction = () => [{ title: "Add your store · GEO" }, { name: "robots", content: "noindex" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireUser(request);
  if (await db.shop.findFirst({ where: { userId: user.id }, select: { id: true } })) throw redirect("/dash");
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await requireUser(request);
  if (fromAnotherSite(request)) return { error: "Please use the form on the GEO website." };
  const host = storeHost((await request.formData()).get("store"));
  if (!host) return { error: STORE_ERRORS.address };
  const found = await findShopifyStore(host);
  if (!found) return { error: STORE_ERRORS.notShopify };
  const added = await addWebStore(user.id, found);
  if (!added.ok) return { error: added.error };
  if (added.isNew) await enqueue("onboard", {}, { shopId: added.shopId, dedupeKey: `onboard:${added.shopId}` });
  throw redirect("/dash");
};

export default function Start() {
  const result = useActionData<typeof action>();
  const busy = useNavigation().state !== "idle";
  return (
    <Solo>
      <div>
        <h1>Add your Shopify store</h1>
        <p style={{ marginTop: 6 }}>Type your store’s address. We’ll read your products and ask AI about them. It takes a few minutes.</p>
      </div>
      <Form method="post" className="w-form">
        <div className="w-field">
          <label htmlFor="store">Store address</label>
          <input className="w-input" id="store" name="store" required autoComplete="url" inputMode="url" placeholder="yourstore.com" />
        </div>
        {result?.error ? (
          <p className="w-err" role="alert">
            {result.error}
          </p>
        ) : null}
        <button className="w-btn" type="submit" disabled={busy}>
          {busy ? "Finding your store…" : "Add my store"}
        </button>
      </Form>
      <p className="w-note">We only read what anyone can see on your store. Nothing in your Shopify admin changes.</p>
    </Solo>
  );
}
