import { useState } from "react";
import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { requireClient } from "../lib/clients.server";
import { isLocal } from "../lib/business";
import { enqueue } from "../lib/jobs.server";
import { setSiteFix, siteFixesView } from "../lib/site-fixes.server";
import { SITE_FIX_WHERE } from "../lib/site-check";
import { removeSiteLink, saveSiteLink, siteLinkView } from "../lib/site-publish.server";
import { SITE_KINDS, SITE_KIND_LABEL, type SiteKind, readSiteLinkForm } from "../lib/site-publish";
import { dayLabel } from "../lib/guide-calendar";
import { timeAgo } from "../lib/format";
import { fromAnotherSite } from "../lib/public-form.server";
import { CopyButton, PageHead } from "../components/web";
import styles from "../styles/client-pages.css?url";

// One local business's website in the agency hub (Ross, 19 Nov 2026). Top: the connection that puts guides live by
// themselves (WordPress or a website kept on GitHub, lib/site-publish.server.ts; anything else stays copy and paste).
// Below: this week's website fixes, found by reading their pages (lib/site-fixes.server.ts), about one a day. Ross makes
// each change, then marks it made; made fixes go in the work log and the client's reports.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireClient(request);
  if (!isLocal(shop)) throw new Response("Not found", { status: 404 });
  const [fixes, link] = await Promise.all([siteFixesView(shop.id), siteLinkView(shop.id)]);
  return { host: shop.primaryDomain ?? shop.domain, checkedAt: shop.siteCheckedAt?.toISOString() ?? null, fixes, link };
};

type Result = { ok: true; message?: string } | { ok: false; error: string };

export const action = async ({ request }: ActionFunctionArgs): Promise<Result> => {
  const { user, shop } = await requireClient(request);
  if (fromAnotherSite(request) || !isLocal(shop)) return { ok: false, error: "Please use the page on Rank with Ross." };
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  if (intent === "fix") {
    const status = form.get("status");
    if (status !== "done" && status !== "skip" && status !== "todo") return { ok: false, error: "Something went wrong. Try again." };
    return (await setSiteFix(shop.id, String(form.get("id") ?? ""), status, user.email)) ? { ok: true } : { ok: false, error: "That fix isn’t on this website." };
  }
  if (intent === "check") {
    await enqueue("site.check", {}, { shopId: shop.id, dedupeKey: `site-check:${shop.id}` });
    return { ok: true, message: "Reading their website now. New fixes show up here in a minute or two." };
  }
  if (intent === "connect") {
    const read = readSiteLinkForm(form);
    if (!read.ok) return read;
    try {
      return { ok: true, message: await saveSiteLink(shop.id, read.value, user.email) };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
  if (intent === "disconnect") {
    await removeSiteLink(shop.id);
    return { ok: true, message: "Disconnected. Guides show the copy and paste steps again." };
  }
  return { ok: false, error: "Something went wrong. Try again." };
};

type Data = Awaited<ReturnType<typeof loader>>;
type Fix = Data["fixes"]["todo"][number];

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
};

function FixCard({ fix, today }: { fix: Fix; today: boolean }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const code = fix.kind === "schema";
  return (
    <li className={`w-box w-box-pad cp-fx${fix.status !== "todo" ? " cp-ls-done" : ""}`}>
      <div className="cp-ls-top">
        <b>{fix.what}</b>
        <a href={fix.page} target="_blank" rel="noreferrer">
          {pathOf(fix.page)} ↗
        </a>
        {today ? <span className="w-chip warn">Today</span> : null}
        {fix.status === "done" ? <span className="w-chip ok">✓ Made{fix.doneAt ? ` ${dayLabel(fix.doneAt.slice(0, 10))}` : ""}</span> : null}
        {fix.status === "skip" ? <span className="w-chip">Not needed</span> : null}
      </div>
      <p className="w-note">{fix.why}</p>
      {fix.status === "todo" ? (
        <>
          {fix.before ? (
            <p className="cp-fx-before">
              <span>Now:</span> {fix.before}
            </p>
          ) : null}
          <div className="cp-fx-after">
            <span>{code ? "Code to add" : "Change it to"}</span>
            {code ? <pre>{fix.after}</pre> : <p className="cp-notes">{fix.after}</p>}
            <CopyButton text={fix.after} label={code ? "Copy code" : "Copy"} />
          </div>
          <p className="w-note">Where: {SITE_FIX_WHERE[fix.kind]}</p>
        </>
      ) : null}
      {error ? <p className="w-err-text">{error}</p> : null}
      <fetcher.Form method="post" className="w-row" style={{ justifyContent: "flex-start" }}>
        <input type="hidden" name="intent" value="fix" />
        <input type="hidden" name="id" value={fix.id} />
        {fix.status === "todo" ? (
          <>
            <button className="w-btn w-btn-sm" name="status" value="done" disabled={busy}>
              I’ve made this change
            </button>
            <button className="w-btn w-btn-ghost w-btn-sm" name="status" value="skip" disabled={busy}>
              Not needed
            </button>
          </>
        ) : (
          <button className="w-btn w-btn-ghost w-btn-sm" name="status" value="todo" disabled={busy}>
            Undo
          </button>
        )}
      </fetcher.Form>
    </li>
  );
}

function Connection({ link, host }: { link: Data["link"]; host: string }) {
  const fetcher = useFetcher<typeof action>();
  const [kind, setKind] = useState<SiteKind>((link?.kind as SiteKind) ?? "wordpress");
  const busy = fetcher.state !== "idle";
  const res = fetcher.data;
  return (
    <section className="w-box w-box-pad w-sec" aria-labelledby="ws-link">
      <div className="w-sec-head">
        <h2 id="ws-link">Guides go live by themselves</h2>
        <p>
          Connect their website once, and each day’s guide goes live on it by itself, from 8am. WordPress and websites kept on GitHub work now. Squarespace, Wix and
          the rest keep the copy and paste steps on each guide.
        </p>
      </div>
      {link ? (
        <p>
          <span className={`w-dot ${link.error ? "warn" : "ok"}`}>{link.kind === "wordpress" ? "WordPress" : "GitHub"}</span> {link.address}
          {link.kind === "github" ? ` · ${link.branch ?? "main branch"} · folder ${link.folder || "top"}` : ` · signed in as ${link.login}`}
          {link.checkedAt ? ` · worked ${timeAgo(link.checkedAt)}` : ""}
          {link.error ? <span className="w-err-text"> Last try: {link.error}</span> : null}
        </p>
      ) : null}
      <fetcher.Form method="post" className="w-form" autoComplete="off">
        <input type="hidden" name="intent" value="connect" />
        <fieldset className="cp-choice">
          <legend>Their website runs on</legend>
          <div className="cp-options">
            {SITE_KINDS.map((k) => (
              <label key={k} className="cp-option">
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
                <b>{SITE_KIND_LABEL[k]}</b>
              </label>
            ))}
          </div>
        </fieldset>
        {kind === "wordpress" ? (
          <>
            <p className="w-note">
              In their WordPress: Users, Profile, Application passwords. Name it “Rank with Ross”, press Add, and paste the password below. Use an Editor or
              Administrator user. Their normal password is never needed.
            </p>
            <label className="w-field">
              <span className="w-label">Website address</span>
              <input className="w-input" name="address" defaultValue={link?.kind === "wordpress" ? link.address : `https://${host}`} required />
            </label>
            <label className="w-field">
              <span className="w-label">WordPress username</span>
              <input className="w-input" name="login" defaultValue={link?.login ?? ""} autoCapitalize="none" spellCheck={false} required />
            </label>
            <label className="w-field">
              <span className="w-label">Application password</span>
              <input className="w-input" name="secret" type="password" placeholder={link ? "Saved. Paste a new one to change it." : ""} required />
            </label>
          </>
        ) : (
          <>
            <p className="w-note">
              On GitHub: Settings, Developer settings, Fine-grained tokens, Generate new token. Pick only this website’s repository, and under Repository
              permissions set Contents to Read and write. Their host (Vercel, Netlify, GitHub Pages) puts each new page live as it does for any change.
            </p>
            <label className="w-field">
              <span className="w-label">Repository (owner/name)</span>
              <input className="w-input" name="address" defaultValue={link?.kind === "github" ? link.address : ""} placeholder="rossdelport/mysite" autoCapitalize="none" spellCheck={false} required />
            </label>
            <label className="w-field">
              <span className="w-label">Folder the pages are in (empty for the top)</span>
              <input className="w-input" name="folder" defaultValue={link?.folder ?? ""} placeholder="public" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="w-field">
              <span className="w-label">Branch (empty for the usual one)</span>
              <input className="w-input" name="login" defaultValue={link?.branch ?? ""} placeholder="main" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="w-field">
              <span className="w-label">Access key</span>
              <input className="w-input" name="secret" type="password" placeholder={link ? "Saved. Paste a new one to change it." : "github_pat_..."} required />
            </label>
          </>
        )}
        <div className="w-row" style={{ justifyContent: "flex-start" }}>
          <button className="w-btn" disabled={busy}>
            {busy ? <span className="w-spin" aria-hidden="true" /> : null}
            {link ? "Test and save" : "Test and connect"}
          </button>
        </div>
      </fetcher.Form>
      {res ? res.ok ? <p className="cp-msg-ok" role="status">{res.message}</p> : <p className="w-err" role="alert">{res.error}</p> : null}
      {link ? (
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="disconnect" />
          <button className="w-btn w-btn-ghost w-btn-sm" disabled={busy}>
            Disconnect
          </button>
        </fetcher.Form>
      ) : null}
    </section>
  );
}

export default function ClientWebsite() {
  const { host, checkedAt, fixes, link } = useLoaderData<typeof loader>();
  const check = useFetcher<typeof action>();
  return (
    <>
      <PageHead
        title="Website"
        intro={`Fixes for ${host} and how guides get onto it. Each week we read their home page and up to 5 other pages, and write about one fix a day. Only facts from their website and the facts box are used.`}
        right={
          <>
            <span className={`w-chip${fixes.todo.length ? " warn" : " ok"}`}>{fixes.todo.length} to make</span>
            <span className="w-chip">{checkedAt ? `Read ${timeAgo(checkedAt)}` : "Not read yet"}</span>
          </>
        }
      />

      <Connection link={link} host={host} />

      <section className="w-sec" aria-labelledby="ws-fixes">
        <div className="w-sec-head cp-head">
          <h2 id="ws-fixes">Website fixes</h2>
          <check.Form method="post">
            <input type="hidden" name="intent" value="check" />
            <button className="w-btn w-btn-ghost w-btn-sm" disabled={check.state !== "idle"}>
              Read their website now
            </button>
          </check.Form>
        </div>
        {check.data?.ok && check.data.message ? <p className="cp-msg-ok" role="status">{check.data.message}</p> : null}
        {fixes.todo.length ? (
          <ul className="cp-fx-list">
            {fixes.todo.map((f, i) => (
              <FixCard key={f.id} fix={f} today={i === 0} />
            ))}
          </ul>
        ) : (
          <p className="w-empty">{checkedAt ? "Nothing to fix right now. We read the website again every week." : "Their website is read soon after setup, then every week."}</p>
        )}
      </section>

      {fixes.done.length ? (
        <section className="w-sec" aria-labelledby="ws-done">
          <div className="w-sec-head">
            <h2 id="ws-done">Made or not needed ({fixes.done.length})</h2>
          </div>
          <ul className="cp-fx-list">
            {fixes.done.map((f) => (
              <FixCard key={f.id} fix={f} today={false} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
