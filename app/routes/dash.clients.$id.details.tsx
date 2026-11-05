import { type ReactNode, useState } from "react";
import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs } from "react-router";
import { Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import db from "../db.server";
import { deleteClient, requireClient, updateClient } from "../lib/clients.server";
import { CLIENT_STATUSES, type ClientErrors, type ClientField, type ClientStatus, STATUS_LABEL, hubDay, isClientStatus, readClientForm } from "../lib/clients";
import { getPlan } from "../lib/plans";
import { fromAnotherSite } from "../lib/public-form.server";
import { PageHead } from "../components/web";
import { ClientActionButton, flagOf } from "../components/hub";
import styles from "../styles/client-pages.css?url";

// One client's details in the agency hub (Ross, 5 Nov 2026: "add / update / delete clients"): their contact, fee,
// start day, status and Ross's notes; the facts about their store; and deleting the client.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

/** "AU" -> "Australia", worked out on the server so the page reads the same before and after it loads. */
function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, client } = await requireClient(request);
  const host = shop.primaryDomain || shop.domain;
  if (!client) return { view: "none" as const, shopId: shop.id, host };
  const products = await db.product.count({ where: { shopId: shop.id } });
  return {
    view: "client" as const,
    shopId: shop.id,
    host,
    savedAt: client.updatedAt.toISOString(),
    form: {
      name: shop.name ?? "",
      contactName: client.contactName ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      feeAud: String(client.feeAud),
      startedOn: client.startedOn,
      status: (isClientStatus(client.status) ? client.status : "active") as ClientStatus,
      notes: client.notes ?? "",
    },
    store: {
      myshopify: shop.domain,
      country: shop.country,
      countryName: countryName(shop.country),
      currency: shop.currency,
      plan: getPlan(shop.plan).name,
      tracking: Boolean(shop.pixelId),
      products,
    },
    // A store added in the hub (no login of its own) goes completely; one with its own login stays with its owner.
    removesStore: !shop.userId && shop.source === "web",
  };
};

type Result =
  | { intent: "save"; ok: true; message: string }
  | { intent: "save" | "delete"; ok: false; error?: string; errors?: ClientErrors };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { user, shop, client } = await requireClient(request);
  if (fromAnotherSite(request)) return { intent: "save", ok: false, error: "Please use the form on FirstPicked." } satisfies Result;
  const form = await request.formData();
  const intent = form.get("intent") === "delete" ? "delete" : "save";
  if (!client) return { intent, ok: false, error: "This store isn’t one of your clients." } satisfies Result;

  if (intent === "delete") {
    const gone = await deleteClient(shop.id, form.get("confirm"));
    if (gone.ok) return redirect("/dash");
    return { intent, ok: false, error: gone.error } satisfies Result;
  }

  const read = readClientForm(form, hubDay());
  if (!read.ok) return { intent, ok: false, errors: read.errors } satisfies Result;
  await updateClient(shop.id, read.value, user.email); // also pauses, ends or restarts the work when the status changed
  return { intent, ok: true, message: "Saved." } satisfies Result;
};

const STATUS_LINE: Record<ClientStatus, string> = {
  active: "The work runs: AI checks, guides and Reddit threads.",
  paused: "Nothing new runs. Everything made so far stays.",
  ended: "The work has finished. Everything made so far stays.",
};

/** A labelled field with its hint and, after a try that didn't save, what to fix. */
function Field({ name, label, hint, error, children }: { name: ClientField; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="w-field">
      <label htmlFor={`cp-${name}`}>{label}</label>
      {children}
      {hint ? (
        <span className="cp-hint" id={`cp-${name}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="cp-field-err" id={`cp-${name}-err`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** The id, name and error state an input needs to sit in its Field. */
const inputProps = (name: ClientField, errors: ClientErrors, hint = false) => ({
  id: `cp-${name}`,
  name,
  className: `w-input${errors[name] ? " cp-bad" : ""}`,
  "aria-invalid": errors[name] ? true : undefined,
  "aria-describedby": [hint ? `cp-${name}-hint` : "", errors[name] ? `cp-${name}-err` : ""].filter(Boolean).join(" ") || undefined,
});

export default function ClientDetails() {
  const data = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const nav = useNavigation();
  const [typed, setTyped] = useState("");

  if (data.view === "none") {
    return (
      <>
        <PageHead title="Details" />
        <section className="w-panel">
          <h2>This store isn’t one of your clients.</h2>
          <Link to={`/dash/clients/new?store=${encodeURIComponent(data.host)}`} className="w-btn cp-cta" prefetch="intent">
            Make them a client
          </Link>
        </section>
      </>
    );
  }

  const base = `/dash/clients/${data.shopId}`;
  const sending = nav.state === "submitting" ? String(nav.formData?.get("intent") ?? "") : "";
  const saved = result?.intent === "save" && result.ok ? result.message : null;
  const errors: ClientErrors = result && !result.ok && result.intent === "save" ? result.errors ?? {} : {};
  const saveError = result && !result.ok && result.intent === "save" ? result.error : undefined;
  const deleteError = result && !result.ok && result.intent === "delete" ? result.error : undefined;
  const f = data.form;
  const s = data.store;
  const flag = flagOf(s.country);
  const notesProps = inputProps("notes", errors, true);

  return (
    <>
      <PageHead title="Details" intro="Their contact details, fee and status. Only you see this page." />

      {/* A new key after each save, so the fields show what was saved (tidied emails, the fee as a number). */}
      <Form method="post" className="w-box w-box-pad cp-form" key={data.savedAt} aria-label="Client details">
        <input type="hidden" name="intent" value="save" />
        <div className="cp-form-grid">
          <Field name="name" label="Brand name" error={errors.name}>
            <input {...inputProps("name", errors)} defaultValue={f.name} autoComplete="organization" maxLength={80} />
          </Field>
          <Field name="contactName" label="Contact name" error={errors.contactName}>
            <input {...inputProps("contactName", errors)} defaultValue={f.contactName} autoComplete="name" maxLength={80} />
          </Field>
          <Field name="email" label="Email" hint="Where reports go. Add more with commas." error={errors.email}>
            <input {...inputProps("email", errors, true)} defaultValue={f.email} type="text" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field name="phone" label="Phone" error={errors.phone}>
            <input {...inputProps("phone", errors)} defaultValue={f.phone} type="tel" autoComplete="tel" />
          </Field>
          <Field name="feeAud" label="Monthly fee in A$" error={errors.feeAud}>
            <input {...inputProps("feeAud", errors)} defaultValue={f.feeAud} inputMode="decimal" />
          </Field>
          <Field name="startedOn" label="Start date" error={errors.startedOn}>
            <input {...inputProps("startedOn", errors)} defaultValue={f.startedOn} type="date" required />
          </Field>
        </div>

        <fieldset className="cp-choice" aria-describedby={errors.status ? "cp-status-err" : undefined}>
          <legend>Status</legend>
          <div className="cp-options">
            {CLIENT_STATUSES.map((st) => (
              <label key={st} className="cp-option">
                <input type="radio" name="status" value={st} defaultChecked={f.status === st} />
                <b>{STATUS_LABEL[st]}</b>
                <span className="w-note">{STATUS_LINE[st]}</span>
              </label>
            ))}
          </div>
          {errors.status ? (
            <span className="cp-field-err" id="cp-status-err">
              {errors.status}
            </span>
          ) : null}
        </fieldset>

        <Field name="notes" label="Notes" hint="Only you see these." error={errors.notes}>
          <textarea {...notesProps} className={`${notesProps.className} cp-textarea`} defaultValue={f.notes} maxLength={4000} />
        </Field>

        <div className="cp-foot">
          <button type="submit" className="w-btn" disabled={sending === "save"}>
            {sending === "save" ? <span className="w-spin" aria-hidden="true" /> : null}
            Save
          </button>
          {saved ? (
            <span className="cp-msg-ok" role="status">
              {saved}
            </span>
          ) : null}
          {Object.keys(errors).length ? (
            <span className="cp-field-err" role="alert">
              Please fix the fields marked above.
            </span>
          ) : null}
        </div>
        {saveError ? (
          <p className="w-err" role="alert">
            {saveError}
          </p>
        ) : null}
      </Form>

      <section className="w-sec" aria-labelledby="store-h">
        <div className="w-sec-head">
          <h2 id="store-h">Their store</h2>
        </div>
        <div className="w-box w-box-pad">
          <dl className="w-facts cp-facts">
            <dt>Website</dt>
            <dd>
              <a href={`https://${data.host}`} target="_blank" rel="noreferrer">
                {data.host} ↗
              </a>
            </dd>
            <dt>Shopify address</dt>
            <dd>{s.myshopify}</dd>
            <dt>Country</dt>
            <dd>
              {flag ? `${flag} ` : ""}
              {s.countryName}
            </dd>
            <dt>Currency</dt>
            <dd>{s.currency}</dd>
            <dt>Plan</dt>
            <dd>{s.plan}</dd>
            <dt>Products</dt>
            <dd>{s.products ? `${s.products.toLocaleString("en-US")} read from their store` : "None read yet"}</dd>
            <dt>Tracking code</dt>
            <dd>{s.tracking ? <span className="w-dot ok">Sending</span> : <span className="w-dot warn">Not sending yet</span>}</dd>
          </dl>
          <div className="cp-store-btns">
            <Link to={`${base}/tracking`} className="w-btn w-btn-ghost w-btn-sm" prefetch="intent">
              Tracking code
            </Link>
            <ClientActionButton shopId={data.shopId} intent="catalog-sync" label="Read their products again" />
          </div>
        </div>
      </section>

      <section className="w-panel" aria-labelledby="delete-h">
        <div>
          <h2 id="delete-h">Delete this client</h2>
          <p className="cp-danger-text">
            {data.removesStore
              ? "This deletes the store from FirstPicked with everything made for it: guides, AI checks, notes and reports. It can’t be undone. Pages already on their store stay there."
              : "They have their own FirstPicked login, so their store stays with them. Only the client record goes, and the Done for you work stops."}
          </p>
        </div>
        <Form method="post" className="cp-del">
          <input type="hidden" name="intent" value="delete" />
          <label htmlFor="cp-confirm">
            Type <code>{data.host}</code> to confirm
          </label>
          <input
            id="cp-confirm"
            name="confirm"
            className="w-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button type="submit" className="w-btn w-btn-ghost cp-btn-danger" disabled={typed.trim().toLowerCase() !== data.host.toLowerCase() || sending === "delete"}>
            {sending === "delete" ? <span className="w-spin" aria-hidden="true" /> : null}
            Delete this client
          </button>
          {deleteError ? (
            <p className="w-err" role="alert">
              {deleteError}
            </p>
          ) : null}
        </Form>
      </section>
    </>
  );
}
