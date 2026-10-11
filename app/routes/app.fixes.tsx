import { useEffect, useState, type ReactNode } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop, getUsage } from "../lib/shop.server";
import { applyFix, queueAutopilot, rejectFix, revertFix } from "../lib/fixes.server";
import { FIX_TYPE_LABELS, type FaqItem, type FixAfter, type FixBefore } from "../lib/fix-labels";
import { parseFaq } from "../lib/faq";
import { remainingFixes, remainingGuidePages } from "../lib/limits";
import { PLANS, limitLabel } from "../lib/plans";
import { enqueue } from "../lib/jobs.server";
import { sanitizeHtml } from "../lib/sanitize";
import { timeAgo } from "../lib/format";
import { ROBOTS_FIX, ROBOTS_LIMIT, botLine, crawlerIssues, turnedAway, type CrawlerCheck } from "../lib/robots";
import { checkCrawlers } from "../lib/robots.server";
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
    guidesLeft: remainingGuidePages(plan, usage),
    guidesPerMonth: plan.guidePagesPerMonth,
    themeEditorUrl: `https://${shop.domain}/admin/themes/current/editor?template=product&addAppBlockId=${process.env.SHOPIFY_API_KEY ?? ""}/product-faq&target=mainSection`,
    hasFaqLive: fixes.some((f) => f.type === "product_faq" && f.status === "applied"),
    crawlers: (shop.crawlers ?? null) as CrawlerCheck | null,
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
        refresh: Boolean(f.refreshOfId),
        cluster: f.cluster,
        hub: f.type === "guide_page" && Boolean(f.cluster) && !f.hubFixId,
        questions: ((f.questionIds as string[]) ?? []).map((id) => qText.get(id)).filter(Boolean) as string[],
      }))
      .sort((a, b) => (impactOrder[a.impact] ?? 3) - (impactOrder[b.impact] ?? 3)),
  };
};

const GENERATE_EVERY_MS = 3 * 3_600_000;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, plan, admin } = await requireShop(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const id = String(form.get("id") ?? "");
  const fix = id ? await db.fix.findFirst({ where: { id, shopId: shop.id } }) : null;

  try {
    switch (intent) {
      case "crawlers": {
        // A free read of the store's robots.txt; at most once every two minutes.
        if (shop.crawlersCheckedAt && Date.now() - shop.crawlersCheckedAt.getTime() < 120_000) return { ok: true, message: "Checked just now" };
        const r = await checkCrawlers(shop.id);
        return { ok: true, message: r.status === "unreachable" ? "We couldn't read your robots.txt" : "Checked your robots.txt" };
      }
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
        await rejectFix(fix);
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
        if (!plan.autopilot) return { ok: false, message: `Autopilot comes with ${PLANS.pro.name}.` };
        const on = form.get("on") === "true";
        // Remember a store that switches it off, so a plan change never switches it back on.
        await db.shop.update({ where: { id: shop.id }, data: { autopilot: on, autopilotOptOut: !on } });
        if (on) await queueAutopilot(shop.id); // apply what's already waiting, not just the next round
        return { ok: true, message: on ? "Autopilot on: fixes go live for you, unless they need your input" : "Autopilot off" };
      }
      case "generate": {
        // Fixes are unlimited, but each round costs AI time: inside the month's budget, and not more
        // often than every few hours (a round also runs after every scan).
        const usage = await getUsage(shop.id);
        if (usage.costThisMonth >= plan.costCapUsd) {
          return { ok: false, message: "This month's AI budget is used up. New fixes start again next month." };
        }
        const last = await db.job.findUnique({ where: { dedupeKey: `fixes:${shop.id}` } });
        if (last && (last.status === "queued" || last.status === "running")) return { ok: true, message: "Already writing fixes…" };
        if (last && Date.now() - last.updatedAt.getTime() < GENERATE_EVERY_MS) {
          return { ok: false, message: "New fixes were written in the last 3 hours. Review those first, or try again later." };
        }
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

const REFRESH_LABELS: Record<string, string> = { guide_page: "Updated buying guide", product_faq: "Updated product FAQs" };

/** A FAQ kept as a JSON string (live metafield) or a list. */
function faqList(v: unknown): FaqItem[] {
  if (Array.isArray(v)) return v as FaqItem[];
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as FaqItem[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function FaqView({ items }: { items: FaqItem[] }) {
  return (
    <dl className="geo-faq">
      {items.map((f, i) => (
        <div key={i}>
          <dt>{f.q}</dt>
          <dd>{f.a}</dd>
        </div>
      ))}
    </dl>
  );
}

function Preview({ fix }: { fix: FixView }) {
  const a = fix.after;
  const b = (fix.before ?? {}) as FixBefore & { bodyHtml?: string };
  const html = (s: string) => <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(s) }} />;

  let before: ReactNode = null;
  let after: ReactNode = null;
  switch (fix.type) {
    case "product_description":
      before = b.description || b.descriptionHtml ? (b.descriptionHtml ? html(b.descriptionHtml) : <p>{b.description}</p>) : <p>(empty)</p>;
      after = html(a.descriptionHtml ?? "");
      break;
    case "product_faq": {
      const now = faqList(b.faq);
      before = now.length ? <FaqView items={now} /> : <p>No FAQs on this product.</p>;
      after = <FaqView items={a.faq ?? []} />;
      break;
    }
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
      before = fix.refresh && b.bodyHtml ? html(b.bodyHtml) : <p>New page on your website.</p>;
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
              : fix.refresh
                ? { bodyHtml: a.bodyHtml ?? "" } // an update to a live page changes its content, not its title
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

/** "Can AI assistants read your store?": the weekly robots.txt check, with a plain fix. */
function CrawlerCard({ check, submit, busy }: { check: CrawlerCheck | null; submit: (d: Record<string, string>) => void; busy: boolean }) {
  const issues = crawlerIssues(check);
  const serious = issues.filter((b) => b.level !== "info");
  const training = issues.filter((b) => b.level === "info");
  const critical = serious.some((b) => b.level === "critical");
  return (
    <s-section heading="Can AI assistants read your store?">
      <s-stack direction="block" gap="base">
        {!check ? (
          <s-paragraph>We check your store&apos;s robots.txt each week to make sure the bots AI assistants use can read your product pages.</s-paragraph>
        ) : turnedAway(check) ? (
          <s-banner tone="warning" heading="Your store turned our check away">
            <s-paragraph>
              When we asked for {check.robotsUrl}, your store refused (it answered {check.httpStatus}). That&apos;s usually a firewall or bot
              protection, and it may turn away the bots AI assistants use too. Check its settings and allow OAI-SearchBot, PerplexityBot,
              Googlebot and Bingbot. We&apos;ll check again tomorrow.
            </s-paragraph>
          </s-banner>
        ) : check.status === "unreachable" ? (
          <s-banner tone="warning" heading="We couldn't read your robots.txt">
            <s-paragraph>
              Your store didn&apos;t send it when we asked for {check.robotsUrl}. If it keeps failing, search engines may stop reading your store
              until it works. We&apos;ll check again tomorrow.
            </s-paragraph>
          </s-banner>
        ) : serious.length ? (
          <s-banner tone={critical ? "critical" : "warning"} heading={critical ? "Some AI assistants can't read your store" : "One or more AI bots can't read your store"}>
            {serious.map((b) => (
              <s-paragraph key={b.token}>{botLine(b)}</s-paragraph>
            ))}
            <s-paragraph>
              <b>How to fix it:</b> {ROBOTS_FIX}
            </s-paragraph>
          </s-banner>
        ) : check.status === "no-file" ? (
          <s-paragraph>
            Good news: your store has no robots.txt, so nothing there stops the bots that ChatGPT, Perplexity, Google AI Overviews, Gemini and
            Claude use from reading your product pages.
          </s-paragraph>
        ) : (
          <s-paragraph>
            Good news: your robots.txt lets the bots that ChatGPT, Perplexity, Google AI Overviews, Gemini and Claude use read your product pages.
          </s-paragraph>
        )}
        {training.length > 0 && (
          <div className="geo-small">
            You block {training.map((b) => b.name).join(", ")}. {training.some((b) => b.token === "GPTBot" || b.token === "ClaudeBot") ? "Training bots only collect pages to train AI models: blocking them doesn't stop AI answers from recommending you. It's your call." : ""}
            {training.some((b) => b.token === "ChatGPT-User" || b.token === "Perplexity-User") ? " Bots that fetch a page when someone asks about it may not follow robots.txt anyway." : ""}
          </div>
        )}
        <div className="geo-small">{ROBOTS_LIMIT}</div>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button onClick={() => submit({ intent: "crawlers" })} {...(busy ? { loading: true } : {})}>
            {check ? "Check again" : "Check now"}
          </s-button>
          {check && <s-text color="subdued">Checked {timeAgo(check.checkedAt)}</s-text>}
        </s-stack>
      </s-stack>
    </s-section>
  );
}

function FixCard({ fix, busy, submit }: { fix: FixView; busy: boolean; submit: (d: Record<string, string>) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{(fix.refresh ? REFRESH_LABELS[fix.type] : null) ?? FIX_TYPE_LABELS[fix.type] ?? fix.type}</s-text>
          {fix.impact === "high" && <s-badge tone="success">Big win</s-badge>}
          {fix.impact === "low" && <s-badge>Small win</s-badge>}
          {fix.status === "applied" && <s-badge tone="success">Live</s-badge>}
          {fix.status === "reverted" && <s-badge>Undone</s-badge>}
          {fix.status === "rejected" && <s-badge>Skipped</s-badge>}
          <s-text color="subdued">· {fix.title}</s-text>
        </s-stack>
        <s-paragraph>{fix.reason}</s-paragraph>
        {fix.type === "guide_page" && fix.cluster && (
          <div className="geo-small">
            Topic: {fix.cluster} · {fix.hub ? "the overview guide for this topic" : "a specific guide that links to the topic's overview"}
          </div>
        )}
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

  const crawlerBusy = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "crawlers";

  if (data.planId === "free") {
    return (
      <s-page heading="Fixes">
        <CrawlerCard check={data.crawlers} submit={submit} busy={crawlerBusy} />
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
            Changes that make it easier for AI assistants to understand and recommend your products.{" "}
            {data.autopilotAllowed && data.autopilot
              ? "Autopilot puts fixes live for you. Any that need facts from you, or wording we had to soften, wait here for you. Every change can be undone."
              : "Nothing goes live until you approve it, and every change can be undone."}
          </s-paragraph>
          <div className="geo-legend" style={{ marginTop: 0 }}>
            <span>
              Fixes this month: <b>{data.remaining < 0 ? "unlimited" : `${data.remaining} left of ${data.perMonth}`}</b>
            </span>
            <span>
              Products optimised: <b>{data.optimised} of {data.productLimit.toLocaleString("en")}</b>
            </span>
            {data.guidesPerMonth > 0 && (
              <span>
                Guide pages this month: <b>{data.guidesLeft} left of {data.guidesPerMonth}</b>
              </span>
            )}
          </div>
          {data.autopilotAllowed && (
            <s-switch
              label="Autopilot: put fixes live for you (ones that need your input still wait)"
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

      <CrawlerCard check={data.crawlers} submit={submit} busy={crawlerBusy} />

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
