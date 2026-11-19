import type { ActionFunctionArgs, LinksFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import db from "../db.server";
import { requireClient } from "../lib/clients.server";
import { isLocal } from "../lib/business";
import { listingDetails, listingsFor, setListing } from "../lib/listings.server";
import { nextListing } from "../lib/listings";
import { dayLabel } from "../lib/guide-calendar";
import { fromAnotherSite } from "../lib/public-form.server";
import { CopyButton, PageHead } from "../components/web";
import styles from "../styles/client-pages.css?url";

// One local business's listing sites in the agency hub (Ross, 19 Nov 2026): the sites AI quoted in their own AI checks
// first, then free Australian directories and the ones for their trade (lib/listings.ts). The same details go on every
// one. Ross marks each Listed (with the link to their page) or Not for them; listings go in the work log and reports.

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, client } = await requireClient(request);
  if (!isLocal(shop)) throw new Response("Not found", { status: 404 });
  const [items, full] = await Promise.all([listingsFor(shop.id), db.shop.findUniqueOrThrow({ where: { id: shop.id }, include: { profile: { select: { brandName: true, summary: true } } } })]);
  return { items, details: listingDetails(full, client), next: nextListing(items)?.domain ?? null };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { user, shop } = await requireClient(request);
  if (fromAnotherSite(request) || !isLocal(shop)) return { ok: false as const, error: "Please use the page on Rank with Ross." };
  const form = await request.formData();
  const status = form.get("status");
  if (status !== "listed" && status !== "skip" && status !== "todo") return { ok: false as const, error: "Something went wrong. Try again." };
  return setListing(shop.id, form.get("domain"), status, form.get("url"), user.email);
};

type Item = Awaited<ReturnType<typeof loader>>["items"][number];

function Row({ item, next }: { item: Item; next: boolean }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  return (
    <li className={`cp-ls${item.status !== "todo" ? " cp-ls-done" : ""}`}>
      <div className="cp-ls-main">
        <div className="cp-ls-top">
          <b>{item.name}</b>
          {next ? <span className="w-chip warn">Today</span> : null}
          {item.answers ? <span className="w-chip">Quoted by AI</span> : null}
          {item.members ? <span className="w-chip">Members only</span> : null}
          {item.status === "listed" ? <span className="w-chip ok">✓ Listed{item.doneAt ? ` ${dayLabel(item.doneAt.slice(0, 10))}` : ""}</span> : null}
          {item.status === "skip" ? <span className="w-chip">Not for them</span> : null}
        </div>
        <p className="w-note">{item.why}</p>
        {item.link ? (
          <a href={item.link} target="_blank" rel="noreferrer">
            Their page ↗
          </a>
        ) : null}
        {error ? <p className="w-err-text">{error}</p> : null}
      </div>
      <fetcher.Form method="post" className="cp-ls-act">
        <input type="hidden" name="domain" value={item.domain} />
        {item.status === "todo" ? (
          <>
            <a className="w-btn w-btn-ghost w-btn-sm" href={item.url} target="_blank" rel="noreferrer">
              Open {item.domain} ↗
            </a>
            <input className="w-input cp-ls-url" name="url" type="url" placeholder="Link to their page (optional)" aria-label={`Their page on ${item.name}`} />
            <button className="w-btn w-btn-sm" name="status" value="listed" disabled={busy}>
              Listed
            </button>
            <button className="w-btn w-btn-ghost w-btn-sm" name="status" value="skip" disabled={busy}>
              Not for them
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

export default function ClientListings() {
  const { items, details, next } = useLoaderData<typeof loader>();
  const listed = items.filter((i) => i.status === "listed").length;
  const todo = items.filter((i) => i.status === "todo");
  const done = items.filter((i) => i.status !== "todo");
  return (
    <>
      <PageHead
        title="Listing sites"
        intro="AI picks local businesses from reviews, directories and “best of” lists. Get them onto the sites that matter, one a day: first the ones AI quoted in their own checks. Join the free listing only, and ask the client before anything that costs money."
        right={<span className={`w-chip${listed ? " ok" : ""}`}>{listed} listed</span>}
      />

      <section className="w-box w-box-pad w-sec" aria-labelledby="ls-details">
        <div className="w-sec-head">
          <h2 id="ls-details">The same details on every site</h2>
          <p>When the name, phone and address don’t match, Google and AI can’t tell which one is right.</p>
        </div>
        <dl className="w-facts cp-facts">
          {details.map((d) => (
            <div key={d.label} className="cp-ls-detail">
              <dt>{d.label}</dt>
              <dd className="cp-notes">
                {d.value} <CopyButton text={d.value} label="Copy" />
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="w-sec" aria-labelledby="ls-todo">
        <div className="w-sec-head">
          <h2 id="ls-todo">To do ({todo.length})</h2>
        </div>
        {todo.length ? (
          <ul className="w-box cp-ls-list">
            {todo.map((i) => (
              <Row key={i.domain} item={i} next={i.domain === next} />
            ))}
          </ul>
        ) : (
          <p className="w-empty">All done. New sites show up here when AI quotes them in a check.</p>
        )}
      </section>

      {done.length ? (
        <section className="w-sec" aria-labelledby="ls-done">
          <div className="w-sec-head">
            <h2 id="ls-done">Done ({done.length})</h2>
          </div>
          <ul className="w-box cp-ls-list">
            {done.map((i) => (
              <Row key={i.domain} item={i} next={false} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
