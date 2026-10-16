import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, redirect, useFetcher, useLoaderData } from "react-router";
import { requireWebShop } from "../lib/web-auth.server";
import { getPlan } from "../lib/plans";
import { approveSlot, markAdded, publishSlot, retrySlot, skipSlot, slotView } from "../lib/guide-calendar.server";
import { STATE_LABEL, STATE_TONE, dayLabel, monthOf } from "../lib/guide-calendar";
import { GUIDE_KIND_LABELS, type GuideKind } from "../lib/guide";
import { sanitizeHtml } from "../lib/sanitize";
import { formatNumber } from "../lib/format";
import { CopyButton, PageHead } from "../components/web";

// usegeo.app/dash/guides/<day> (the file's underscore keeps it out of the calendar's layout): one guide page from the calendar, as it will look on the store's site, with what it
// is at and what the store can do: OK it, skip it, try again, or add it to the store (copy and paste) when the store
// has no Shopify connection yet.

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const view = await slotView(shop, params.slot ?? "");
  if (!view) throw new Response("Not found", { status: 404 });
  return { ...view, doneForYou: getPlan(shop.plan).doneForYou, storeHandle: shop.domain.replace(/\.myshopify\.com$/, ""), store: shop.primaryDomain ?? shop.domain };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const id = params.slot ?? "";
  try {
    if (intent === "approve") await approveSlot(shop.id, id);
    else if (intent === "retry") await retrySlot(shop.id, id);
    else if (intent === "added") await markAdded(shop.id, id, String(form.get("url") ?? "").slice(0, 500) || null);
    else if (intent === "publish") await publishSlot(id, shop.id);
    else if (intent === "skip") {
      await skipSlot(shop.id, id);
      return redirect("/dash/guides");
    } else return { ok: false as const, error: "Unknown action" };
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
};

export default function GuideDay() {
  const d = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const intent = fetcher.formData?.get("intent");
  const error = fetcher.data && !fetcher.data.ok ? fetcher.data.error : null;
  const tone = STATE_TONE[d.state];
  const kind = d.kind && d.kind in GUIDE_KIND_LABELS ? GUIDE_KIND_LABELS[d.kind as GuideKind] : null;
  const title = d.title ?? d.question?.text ?? "Guide page";
  const addUrl = `https://admin.shopify.com/store/${d.storeHandle}/pages/new`;
  // One action button; a plain function (not a component) so React keeps the same buttons between renders.
  const act = (value: string, label: string, ghost = false) => (
    <button className={`w-btn w-btn-sm${ghost ? " w-btn-ghost" : ""}`} type="submit" name="intent" value={value} disabled={busy}>
      {busy && intent === value ? (
        <>
          <span className="w-spin" aria-hidden="true" /> Working…
        </>
      ) : (
        label
      )}
    </button>
  );

  return (
    <>
      <PageHead
        title={title}
        right={
          <>
            <span className="w-chip">{dayLabel(d.day)}</span>
            {kind ? <span className="w-chip">{kind}</span> : null}
            <span className={`w-chip${tone ? ` ${tone}` : ""}`}>{STATE_LABEL[d.state]}</span>
          </>
        }
      />
      <p className="w-note" style={{ marginTop: -8 }}>
        <Link to={`/dash/guides?m=${monthOf(d.day)}`}>‹ Back to the calendar</Link>
      </p>

      <div className="w-guide-wrap">
        {d.bodyHtml ? (
          <article className="w-box w-guide" aria-label="The page as it will look">
            <h1>{d.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(d.bodyHtml) }} />
          </article>
        ) : (
          <section className="w-box w-guide-empty">
            <b>{d.state === "writing" ? "Writing it now." : d.state === "failed" ? "Not written yet." : `We’ll write this guide on ${dayLabel(d.writeDay, "long")}.`}</b>
            <span>It answers: {d.question?.text ?? "a buying question from your list"}.</span>
            <span>Once it is written, the whole page shows here for you to read before it goes anywhere.</span>
          </section>
        )}

        <aside className="w-sec">
          <section className="w-box w-box-pad w-sec" aria-live="polite">
            <div className="w-sec-head">
              <h2>{STATE_LABEL[d.state]}</h2>
            </div>
            {d.state === "planned" ? (
              <p>Planned for {dayLabel(d.day, "long")}. We write it two days before, on {dayLabel(d.writeDay)}, and you can read it here then.</p>
            ) : null}
            {d.state === "writing" ? <p>Being written now. Give it a minute, then refresh.</p> : null}
            {d.state === "needs-ok" ? (
              <p>Written and ready for your OK. Read it on the left. If it is right, approve it and it goes live on {dayLabel(d.day, "long")}.</p>
            ) : null}
            {d.state === "scheduled" ? (
              d.connected ? (
                <p>
                  {d.day <= d.today ? "Going live shortly through your Shopify connection." : `Approved. It goes live on ${dayLabel(d.day, "long")}, in the morning, through your Shopify connection.`}
                </p>
              ) : (
                <p>Approved. On {dayLabel(d.day, "long")} this page shows the two-minute steps to add it to your store.</p>
              )
            ) : null}
            {d.state === "add" ? <p>Its day is here. Follow the steps below to put it on your site, then press “I’ve added it”.</p> : null}
            {d.state === "live" ? (
              <p>
                Live since {d.publishedAt ? dayLabel(d.publishedAt.slice(0, 10), "long") : "today"}.{" "}
                {d.liveUrl ? (
                  <a href={d.liveUrl} target="_blank" rel="noreferrer">
                    Open the page
                  </a>
                ) : null}
              </p>
            ) : null}
            {d.state === "failed" ? <p className="w-err-text">{d.error ?? "We couldn’t write this one."}</p> : null}
            {d.notes ? (
              <div className="w-note w-block">
                <b>Please check before it goes live</b>
                <br />
                {d.notes}
              </div>
            ) : null}
            {error ? <p className="w-err-text">{error}</p> : null}

            <fetcher.Form method="post" className="w-row" style={{ justifyContent: "flex-start" }}>
              {d.state === "needs-ok" ? act("approve", `Approve for ${dayLabel(d.day)}`) : null}
              {d.state === "scheduled" && d.connected && d.day <= d.today ? act("publish", "Publish now") : null}
              {d.state === "failed" ? act("retry", "Try again") : null}
              {d.state !== "live" && d.state !== "writing" ? act("skip", "Skip this one", true) : null}
            </fetcher.Form>
          </section>

          {d.state === "add" && d.bodyHtml ? (
            <section className="w-box w-box-pad w-sec">
              <div className="w-sec-head">
                <h2>Add it to your store (about two minutes)</h2>
                <p>Until your store is connected to Shopify, you paste the page in yourself.</p>
              </div>
              <ol className="w-ol">
                <li>
                  Copy the title. <CopyButton text={d.title ?? title} label="Copy title" />
                </li>
                <li>
                  Copy the page content. <CopyButton text={d.bodyHtml} label="Copy content" />
                </li>
                <li>
                  Open{" "}
                  <a href={addUrl} target="_blank" rel="noreferrer">
                    Add page in Shopify
                  </a>
                  . Paste the title. In the content box click the <b>&lt;&gt;</b> button (show HTML) and paste the content. Under Visibility choose Visible, then Save.
                </li>
                <li>Come back here and press the button below.</li>
              </ol>
              <fetcher.Form method="post" className="w-form">
                <label className="w-field">
                  <span className="w-label">The page’s address (optional)</span>
                  <input className="w-input" type="url" name="url" placeholder={`https://${d.store}/pages/${d.handle ?? ""}`} />
                </label>
                <div>{act("added", "I’ve added it")}</div>
              </fetcher.Form>
            </section>
          ) : null}

          <section className="w-box w-box-pad w-sec">
            <div className="w-sec-head">
              <h2>About this guide</h2>
            </div>
            <dl className="w-facts">
              <dt>Buying question</dt>
              <dd>{d.question?.text ?? "Removed from your list"}</dd>
              <dt>Searches a month</dt>
              <dd>{d.question?.volume ? formatNumber(d.question.volume) : "Not known"}</dd>
              <dt>Kind</dt>
              <dd>{kind ?? "Decided when it is written"}</dd>
              <dt>Goes live</dt>
              <dd>{dayLabel(d.day, "long")}</dd>
              {d.reason ? (
                <>
                  <dt>Why this one</dt>
                  <dd>{d.reason}</dd>
                </>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
