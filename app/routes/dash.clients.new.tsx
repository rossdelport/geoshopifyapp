import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs } from "react-router";
import { type ReactNode, useEffect, useState } from "react";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import db from "../db.server";
import { PageHead } from "../components/web";
import { addClient, requireHubAdmin } from "../lib/clients.server";
import { type ClientErrors, type ClientField, DEFAULT_FEE, hubDay, readClientForm } from "../lib/clients";
import { spotsLine } from "../lib/hub-pages";
import { fromAnotherSite } from "../lib/public-form.server";
import styles from "../styles/hub-pages.css?url";

// firstpicked.com.au/dash/clients/new: add a client brand to the agency hub (Ross, 5 Nov 2026). Their store is read
// from its own website (like /start), added to FirstPicked and set up on Done for you, then the client's page opens.
// Nothing is sent to the client.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await requireHubAdmin(request);
  const active = await db.client.count({ where: { status: "active" } });
  return {
    store: (new URL(request.url).searchParams.get("store") ?? "").trim().slice(0, 200), // "Make them a client" links fill it in
    today: hubDay(),
    fee: DEFAULT_FEE,
    active,
  };
};

/** The form's fields, in the order they show (the first one with a problem gets the focus). */
const FIELDS: ClientField[] = ["store", "name", "contactName", "email", "phone", "feeAud", "startedOn", "status", "notes"];

type Result = { values: Partial<Record<ClientField, string>>; errors: ClientErrors; error?: string };

export const action = async ({ request }: ActionFunctionArgs): Promise<Result> => {
  const user = await requireHubAdmin(request);
  if (fromAnotherSite(request)) return { values: {}, errors: {}, error: "Please use the form on FirstPicked." };
  const form = await request.formData();
  // What was typed goes back with any problem, so nothing has to be typed again.
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "").slice(0, 4000)]));
  const parsed = readClientForm(form, hubDay());
  const noStore = !values.store.trim();
  if (!parsed.ok || noStore) {
    return { values, errors: { ...(parsed.ok ? {} : parsed.errors), ...(noStore ? { store: "Please type their store’s website." } : {}) } };
  }
  const added = await addClient(form.get("store"), parsed.value, user.email);
  if (!added.ok) return { values, errors: { store: added.error } };
  throw redirect(`/dash/clients/${added.shopId}`);
};

/** While the store is checked and added (a few seconds): three steps that tick off, so the page never looks frozen. */
function Adding({ address, paused }: { address: string; paused: boolean }) {
  const [at, setAt] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setAt((n) => Math.min(n + 1, 2)), 1600);
    return () => clearInterval(t);
  }, []);
  const steps = [`Looking up ${address || "their store"}`, "Checking it’s a Shopify store", paused ? "Adding them as a paused client" : "Setting it up on Done for you"];
  return (
    <div className="w-checking" aria-live="polite">
      <div className="w-progress w-progress-run">
        <span />
      </div>
      <ol className="w-steps">
        {steps.map((label, i) => (
          <li key={label} className={i < at ? "done" : i === at ? "now" : undefined}>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A label, its field, a hint under it and the field's problem, joined up for screen readers. */
function Field({ id, label, optional, hint, error, children }: { id: string; label: string; optional?: boolean; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="w-field">
      <label htmlFor={id}>
        {label}
        {optional ? <span className="hp-opt"> (optional)</span> : null}
      </label>
      {children}
      {hint ? (
        <p className="w-note" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="w-err-text" id={`${id}-err`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function AddClient() {
  const { store, today, fee, active } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const nav = useNavigation();
  // Only this form's own sending (and the client page loading after it), not a click elsewhere in the menu.
  const busy = nav.state !== "idle" && Boolean(nav.formAction?.startsWith("/dash/clients/new"));
  const v = result?.values ?? {};
  const err: ClientErrors = busy ? {} : result?.errors ?? {};
  const typed = String(nav.formData?.get("store") ?? "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .slice(0, 60);

  // After a problem, the cursor goes to the first field that needs fixing.
  useEffect(() => {
    const first = result && FIELDS.find((k) => result.errors[k]);
    if (first) document.getElementById(first === "status" ? "status-active" : first)?.focus();
  }, [result]);

  /** The hint and problem ids a field points to, and whether it has a problem. */
  const aria = (id: ClientField, hint = false) => {
    const ids = [hint ? `${id}-hint` : "", err[id] ? `${id}-err` : ""].filter(Boolean).join(" ");
    return { "aria-invalid": err[id] ? true : undefined, "aria-describedby": ids || undefined };
  };

  return (
    <>
      <PageHead title="Add a client" intro="Type their store’s website and how to reach them. You can change any of this later." right={<span className="w-chip">{spotsLine(active)}</span>} />
      <Form method="post" className="w-box hp-form">
        <fieldset disabled={busy}>
          <section className="hp-form-sec" aria-labelledby="store-h">
            <h2 id="store-h">Their store</h2>
            <Field id="store" label="Store website" error={err.store}>
              <input
                className="w-input"
                id="store"
                name="store"
                required
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="theirstore.com.au"
                defaultValue={v.store ?? store}
                {...aria("store")}
              />
            </Field>
            <Field id="name" label="Brand name" optional hint="Leave empty to use the name on their store." error={err.name}>
              <input className="w-input" id="name" name="name" maxLength={80} autoComplete="off" defaultValue={v.name} {...aria("name", true)} />
            </Field>
          </section>

          <section className="hp-form-sec" aria-labelledby="contact-h">
            <h2 id="contact-h">Who you deal with</h2>
            <div className="hp-pair">
              <Field id="contactName" label="Contact name" optional error={err.contactName}>
                <input className="w-input" id="contactName" name="contactName" maxLength={80} autoComplete="off" defaultValue={v.contactName} {...aria("contactName")} />
              </Field>
              <Field id="phone" label="Phone" optional error={err.phone}>
                <input className="w-input" id="phone" name="phone" type="tel" maxLength={30} autoComplete="off" defaultValue={v.phone} {...aria("phone")} />
              </Field>
            </div>
            <Field id="email" label="Email" optional hint="Where reports go. Add more with commas." error={err.email}>
              <input className="w-input" id="email" name="email" inputMode="email" autoComplete="off" spellCheck={false} defaultValue={v.email} {...aria("email", true)} />
            </Field>
          </section>

          <section className="hp-form-sec" aria-labelledby="work-h">
            <h2 id="work-h">The work</h2>
            <div className="hp-pair">
              <Field id="feeAud" label="Monthly fee in A$" error={err.feeAud}>
                <input className="w-input" id="feeAud" name="feeAud" inputMode="decimal" autoComplete="off" defaultValue={v.feeAud ?? String(fee)} {...aria("feeAud")} />
              </Field>
              <Field id="startedOn" label="Start date" error={err.startedOn}>
                <input className="w-input" id="startedOn" name="startedOn" type="date" defaultValue={v.startedOn ?? today} {...aria("startedOn")} />
              </Field>
            </div>
            <fieldset aria-describedby={err.status ? "status-err" : undefined}>
              <legend className="hp-legend">Status</legend>
              <div className="hp-choices">
                <label className="hp-choice">
                  <input type="radio" id="status-active" name="status" value="active" defaultChecked={v.status !== "paused"} />
                  <b>Active</b>
                  <span>We start the work now, on Done for you.</span>
                </label>
                <label className="hp-choice">
                  <input type="radio" name="status" value="paused" defaultChecked={v.status === "paused"} />
                  <b>Paused</b>
                  <span>Add them now and start the work later.</span>
                </label>
              </div>
              {err.status ? (
                <p className="w-err-text" id="status-err">
                  {err.status}
                </p>
              ) : null}
            </fieldset>
          </section>

          <section className="hp-form-sec">
            <Field id="notes" label="Notes" optional hint="Only you see these." error={err.notes}>
              <textarea className="w-input hp-textarea" id="notes" name="notes" rows={4} maxLength={4000} defaultValue={v.notes} {...aria("notes", true)} />
            </Field>
          </section>
        </fieldset>

        <div className="hp-form-foot">
          {result?.error && !busy ? (
            <p className="w-err" role="alert">
              {result.error}
            </p>
          ) : null}
          {busy ? (
            <Adding address={typed} paused={nav.formData?.get("status") === "paused"} />
          ) : (
            <div className="hp-btns">
              <button className="w-btn" type="submit">
                Add client
              </button>
              <Link to="/dash" className="w-btn w-btn-ghost" prefetch="intent">
                Cancel
              </Link>
            </div>
          )}
          <p className="w-note">We read their store, write their buying questions and run the first AI check. It takes a few minutes. Nothing is sent to the client.</p>
        </div>
      </Form>
    </>
  );
}
