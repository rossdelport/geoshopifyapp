import { useEffect, useState, type ReactNode } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop, getUsage } from "../lib/shop.server";
import { applyFix, revertFix } from "../lib/fixes.server";
import { FIX_TYPE_LABELS, type FaqItem, type FixAfter, type FixBefore } from "../lib/fix-labels";
import { parseFaq } from "../lib/faq";
import { remainingFixes } from "../lib/limits";
import { limitLabel } from "../lib/plans";
import { enqueue } from "../lib/jobs.server";
import { sanitizeHtml } from "../lib/sanitize";
import { timeAgo } from "../lib/format";
import { Empty } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, plan } = await requireShop(request);
  const [fixes, usage, questions] = await Promise.all([
    db.fix.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 150 }),
    getUsage(shop.id),
    db.question.findMany({ where: { shopId: shop.id }, select: { id: true, text: true } }),
  ]);
  const qText = new Map(questions.map((q) => [q.id, q.text]));
  const impactOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  return {
    planId: plan.id,
    autopilotAllowed: plan.autopilot,
    autopilot: shop.autopilot,
    remaining: Number.isFinite(remainingFixes(plan, usage)) ? remainingFixes(plan, usage) : -1, // -1 = unlimited
    perMonth: limitLabel(plan.fixesPerMonth),
    optimised: usage.optimisedProducts,
    productLimit: plan.products,
    themeEditorUrl: `https://${shop.domain}/admin/themes/current/editor?template=product&addAppBlockId=${process.env.SHOPIFY_API_KEY ?? ""}/product-faq&target=mainSection`,
    hasFaqLive: fixes.some((f) => f.type === "product_faq" && f.status === "applied"),
    fixes: fixes
      .map((f) => ({
        id: f.id,
        type: f.type,
        status: f.status,
        title: f.targetTitle,
        reason: f.reason,
        impact: f.impact,
        missingInfo: f.missingInfo,
        error: f.error,
        before: f.before as FixBefore | null,
        after: f.after as FixAfter,
        resultUrl: f.resultUrl,
        appliedAt: f.appliedAt,
        questions: ((f.questionIds as string[]) ?? []).map((id) => qText.get(id)).filter(Boolean) as string[],
      }))
      .sort((a, b) => (impactOrder[a.impact] ?? 3) - (impactOrder[b.impact] ?? 3)),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, plan, admin } = await requireShop(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const id = String(form.get("id") ?? "");
  const fix = id ? await db.fix.findFirst({ where: { id, shopId: shop.id } }) : null;

  try {
    switch (intent) {
      case "approve":
        if (!fix) break;
        await applyFix(fix.id, admin);
        return { ok: true, message: fix.type === "guide_page" ? "Page published to your store" : "Live in your store" };
      case "undo":
        if (!fix) break;
        await revertFix(fix.id, admin);
        return { ok: true, message: "Undone. Your store is back how it was." };
      case "reject":
        if (!fix) break;
        await db.fix.update({ where: { id: fix.id }, data: { status: "rejected" } });
        return { ok: true, message: "Skipped" };
      case "restore":
        if (!fix) break;
        await db.fix.update({ where: { id: fix.id }, data: { status: "pending" } });
        return { ok: true, message: "Moved back to waiting" };
      case "edit": {
        if (!fix || fix.status !== "pending") break;
        const after = { ...(fix.after as Record<string, unknown>) };
        for (const key of ["title", "productType", "seoTitle", "seoDescription", "descriptionHtml", "bodyHtml", "handle"]) {
          const v = form.get(key);
          if (typeof v === "string") after[key] = v;
        }
        const faqText = form.get("faq");
        if (typeof faqText === "string") after.faq = parseFaq(faqText) ?? after.faq;
        await db.fix.update({ where: { id: fix.id }, data: { after: after as object } });
        return { ok: true, message: "Saved your changes" };
      }
      case "autopilot": {
        if (!plan.autopilot) return { ok: false, message: "Autopilot is on the Pro plan." };
        const on = form.get("on") === "true";
        await db.shop.update({ where: { id: shop.id }, data: { autopilot: on } });
        return { ok: true, message: on ? "Autopilot on: safe fixes go live automatically" : "Autopilot off" };
      }
      case "generate": {
        const job = await enqueue("fixes.generate", {}, { shopId: shop.id, dedupeKey: `fixes:${shop.id}` });
        return { ok: true, message: job ? "Writing new fixes. They'll appear here in a minute or two." : "Already writing fixes…" };
      }
    }
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  return { ok: false, message: "That fix wasn't found" };
};

type FixView = Awaited<ReturnType<typeof loader>>["fixes"][number];

function Preview({ fix }: { fix: FixView }) {
  const a = fix.after;
  const b = fix.before ?? {};
  const html = (s: string) => <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(s) }} />;

  let before: ReactNode = null;
  let after: ReactNode = null;
  switch (fix.type) {
    case "product_description":
      before = b.description || b.descriptionHtml ? (b.descriptionHtml ? html(b.descriptionHtml) : <p>{b.description}</p>) : <p>(empty)</p>;
      after = html(a.descriptionHtml ?? "");
      break;
    case "product_faq":
      before = <p>No FAQs on this product.</p>;
      after = (
        <dl className="geo-faq">
          {(a.faq ?? []).map((f: FaqItem, i: number) => (
            <div key={i}>
              <dt>{f.q}</dt>
              <dd>{f.a}</dd>
            </div>
          ))}
        </dl>
      );
      break;
    case "product_seo":
      before = (
        <>
          <p><b>{b.seoTitle || b.seo?.title || "(no search title)"}</b></p>
          <p>{b.seoDescription || b.seo?.description || "(no search description)"}</p>
        </>
      );
      after = (
        <>
          <p><b>{a.seoTitle}</b></p>
          <p>{a.seoDescription}</p>
        </>
      );
      break;
    case "product_title":
      before = <p>{b.title}</p>;
      after = <p>{a.title}</p>;
      break;
    case "product_type":
      before = <p>{b.productType || "(none)"}</p>;
      after = <p>{a.productType}</p>;
      break;
    case "guide_page":
      before = <p>New page on your website.</p>;
      after = (
        <>
          <h3 style={{ marginTop: 0 }}>{a.title}</h3>
          {html(a.bodyHtml ?? "")}
        </>
      );
      break;
  }
  return (
    <div className="geo-diff">
      <div className="geo-diff__col geo-diff__before">
        <h4>Now</h4>
        {before}
      </div>
      <div className="geo-diff__col geo-diff__after">
        <h4>After</h4>
        {after}
      </div>
    </div>
  );
}

function Editor({ fix, onSave }: { fix: FixView; onSave: (fields: Record<string, string>) => void }) {
  const a = fix.after;
  const initial: Record<string, string> =
    fix.type === "product_description"
      ? { descriptionHtml: a.descriptionHtml ?? "" }
      : fix.type === "product_faq"
        ? { faq: (a.faq ?? []).map((f: FaqItem) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n") }
        : fix.type === "product_seo"
          ? { seoTitle: a.seoTitle ?? "", seoDescription: a.seoDescription ?? "" }
          : fix.type === "product_title"
            ? { title: a.title ?? "" }
            : fix.type === "product_type"
              ? { productType: a.productType ?? "" }
              : { title: a.title ?? "", bodyHtml: a.bodyHtml ?? "" };
  const [fields, setFields] = useState(initial);
  const LABELS: Record<string, string> = {
    descriptionHtml: "Description (HTML)",
    faq: "FAQs (Q: question, A: answer, blank line between)",
    seoTitle: "Search title",
    seoDescription: "Search description",
    title: "Title",
    productType: "Product type",
    bodyHtml: "Page content (HTML)",
  };
  return (
    <s-stack direction="block" gap="base">
      {Object.keys(fields).map((key) =>
        ["descriptionHtml", "faq", "bodyHtml", "seoDescription"].includes(key) ? (
          <s-text-area
            key={key}
            label={LABELS[key]}
            rows={key === "seoDescription" ? 3 : 10}
            value={fields[key]}
            onInput={(e) => setFields({ ...fields, [key]: e.currentTarget.value })}
            onChange={(e) => setFields({ ...fields, [key]: e.currentTarget.value })}
          />
        ) : (
          <s-text-field
            key={key}
            label={LABELS[key]}
            value={fields[key]}
            onInput={(e) => setFields({ ...fields, [key]: e.currentTarget.value })}
            onChange={(e) => setFields({ ...fields, [key]: e.currentTarget.value })}
          />
        ),
      )}
      <s-stack direction="inline" gap="base">
        <s-button variant="primary" onClick={() => onSave(fields)}>
          Save changes
        </s-button>
      </s-stack>
    </s-stack>
  );
}

function FixCard({ fix, busy, submit }: { fix: FixView; busy: boolean; submit: (d: Record<string, string>) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{FIX_TYPE_LABELS[fix.type] ?? fix.type}</s-text>
          {fix.impact === "high" && <s-badge tone="success">Big win</s-badge>}
          {fix.impact === "low" && <s-badge>Small win</s-badge>}
          {fix.status === "applied" && <s-badge tone="success">Live</s-badge>}
          {fix.status === "reverted" && <s-badge>Undone</s-badge>}
          {fix.status === "rejected" && <s-badge>Skipped</s-badge>}
          <s-text color="subdued">· {fix.title}</s-text>
        </s-stack>
        <s-paragraph>{fix.reason}</s-paragraph>
        {fix.questions.length > 0 && (
          <div className="geo-small">Helps with: {fix.questions.slice(0, 3).map((q) => `“${q}”`).join(", ")}</div>
        )}
        {fix.missingInfo && fix.status === "pending" && (
          <s-banner tone="warning" heading="Check before approving">
            {fix.missingInfo.split("\n").map((line, i) => (
              <s-paragraph key={i}>{line}</s-paragraph>
            ))}
          </s-banner>
        )}
        {fix.error && fix.status === "pending" && (
          <s-banner tone="critical" heading="Couldn't publish">
            <s-paragraph>{fix.error}</s-paragraph>
          </s-banner>
        )}
        {editing ? (
          <Editor
            fix={fix}
            onSave={(fields) => {
              submit({ intent: "edit", id: fix.id, ...fields });
              setEditing(false);
            }}
          />
        ) : (
          <Preview fix={fix} />
        )}
        <s-stack direction="inline" gap="base" alignItems="center">
          {fix.status === "pending" && !editing && (
            <>
              <s-button variant="primary" onClick={() => submit({ intent: "approve", id: fix.id })} {...(busy ? { loading: true } : {})}>
                {fix.type === "guide_page" ? "Approve & publish page" : "Approve & publish"}
              </s-button>
              <s-button onClick={() => setEditing(true)}>Edit</s-button>
              <s-button variant="tertiary" onClick={() => submit({ intent: "reject", id: fix.id })}>
                Skip
              </s-button>
            </>
          )}
          {editing && (
            <s-button variant="tertiary" onClick={() => setEditing(false)}>
              Cancel
            </s-button>
          )}
          {fix.status === "applied" && (
            <>
              {fix.resultUrl && (
                <s-button href={fix.resultUrl} target="_blank">
                  View in store
                </s-button>
              )}
              <s-button tone="critical" variant="tertiary" onClick={() => submit({ intent: "undo", id: fix.id })} {...(busy ? { loading: true } : {})}>
                Undo
              </s-button>
              <s-text color="subdued">Published {timeAgo(fix.appliedAt)}</s-text>
            </>
          )}
          {(fix.status === "rejected" || fix.status === "reverted") && (
            <s-button variant="tertiary" onClick={() => submit({ intent: "restore", id: fix.id })}>
              Move back to waiting
            </s-button>
          )}
        </s-stack>
      </s-stack>
    </s-section>
  );
}

const TABS = [
  { id: "pending", label: "Waiting for you" },
  { id: "applied", label: "Live" },
  { id: "other", label: "Skipped & undone" },
];

export default function Fixes() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "pending";

  useEffect(() => {
    if (fetcher.data?.message) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);

  const submit = (d: Record<string, string>) => fetcher.submit(d, { method: "post" });
  const busyId = fetcher.state !== "idle" ? String(fetcher.formData?.get("id") ?? "") : "";
  const list = data.fixes.filter((f) =>
    tab === "pending" ? f.status === "pending" : tab === "applied" ? f.status === "applied" : f.status === "rejected" || f.status === "reverted",
  );
  const counts = {
    pending: data.fixes.filter((f) => f.status === "pending").length,
    applied: data.fixes.filter((f) => f.status === "applied").length,
    other: data.fixes.filter((f) => f.status === "rejected" || f.status === "reverted").length,
  };

  if (data.planId === "free") {
    return (
      <s-page heading="Fixes">
        <s-section>
          <Empty title="Fixes come with a plan">
            <p>
              We write clearer product pages, FAQs and buying guides that AI assistants can quote, and publish them when you click
              approve. Every change can be undone.
            </p>
            <s-button variant="primary" href="/app/plans">
              See plans
            </s-button>
          </Empty>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Fixes">
      <s-button slot="primary-action" onClick={() => submit({ intent: "generate" })} {...(data.remaining === 0 ? { disabled: true } : {})}>
        Write more fixes
      </s-button>

      <s-section>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Changes that make it easier for AI assistants to understand and recommend your products. Nothing goes live until you
            approve it, and every change can be undone.
          </s-paragraph>
          <div className="geo-legend" style={{ marginTop: 0 }}>
            <span>
              Fixes this month: <b>{data.remaining < 0 ? "unlimited" : `${data.remaining} left of ${data.perMonth}`}</b>
            </span>
            <span>
              Products optimised: <b>{data.optimised} of {data.productLimit.toLocaleString()}</b>
            </span>
          </div>
          {data.autopilotAllowed && (
            <s-switch
              label="Autopilot: publish low-risk fixes (FAQs, search text, product types) automatically"
              checked={data.autopilot}
              onChange={() => submit({ intent: "autopilot", on: String(!data.autopilot) })}
            />
          )}
          {data.hasFaqLive && (
            <s-banner tone="info" heading="Show your FAQs on product pages">
              <s-paragraph>Add the &quot;AI-ready FAQs&quot; block to your product page once, and every approved FAQ appears there.</s-paragraph>
              <s-button slot="secondary-actions" href={data.themeEditorUrl} target="_top">
                Add to my theme
              </s-button>
            </s-banner>
          )}
        </s-stack>
      </s-section>

      <s-section padding="none">
        <div style={{ padding: "12px 16px" }}>
          <s-button-group>
            {TABS.map((t) => (
              <s-button
                key={t.id}
                slot="secondary-actions"
                variant={t.id === tab ? "primary" : "secondary"}
                onClick={() => setParams({ tab: t.id })}
              >
                {`${t.label} (${counts[t.id as keyof typeof counts]})`}
              </s-button>
            ))}
          </s-button-group>
        </div>
      </s-section>

      {list.length ? (
        list.map((f) => <FixCard key={f.id} fix={f} busy={busyId === f.id} submit={submit} />)
      ) : (
        <s-section>
          <Empty title={tab === "pending" ? "All caught up" : "Nothing here yet"}>
            {tab === "pending" ? "New fixes are written after each scan." : null}
          </Empty>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
