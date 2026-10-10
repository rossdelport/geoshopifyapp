import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop, getUsage } from "../lib/shop.server";
import { remainingOutreach } from "../lib/limits";
import { enqueue } from "../lib/jobs.server";
import { draftPitch } from "../lib/outreach.server";
import { ENGINE_LABELS, type Engine } from "../lib/plans";
import { Empty, EnginePill } from "../components/ui";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  drafted: "Ready to send",
  sent: "Sent",
  replied: "Replied",
  won: "Featured 🎉",
  skipped: "Skipped",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, plan } = await requireShop(request);
  const [targets, usage, running] = await Promise.all([
    db.outreachTarget.findMany({ where: { shopId: shop.id }, orderBy: [{ timesCited: "desc" }, { createdAt: "desc" }] }),
    getUsage(shop.id),
    db.job.findFirst({ where: { shopId: shop.id, type: "outreach.find", status: { in: ["queued", "running"] } } }),
  ]);
  const order: Record<string, number> = { drafted: 0, new: 1, sent: 2, replied: 3, won: 4, skipped: 5 };
  return {
    planId: plan.id,
    perMonth: plan.outreachPerMonth,
    doneForYou: plan.doneForYou,
    remaining: remainingOutreach(plan, usage),
    finding: Boolean(running),
    targets: targets
      .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
      .map((t) => ({
        id: t.id,
        url: t.url,
        domain: t.domain,
        title: t.title,
        brands: t.namedBrands as string[],
        engines: t.engines as string[],
        cited: t.timesCited,
        authorName: t.authorName,
        email: t.email,
        contactUrl: t.contactUrl,
        subject: t.subject ?? "",
        pitch: t.pitch ?? "",
        status: t.status,
      })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await requireShop(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const id = String(form.get("id") ?? "");
  const target = id ? await db.outreachTarget.findFirst({ where: { id, shopId: shop.id } }) : null;
  try {
    if (intent === "find") {
      const job = await enqueue("outreach.find", {}, { shopId: shop.id, dedupeKey: `outreach:${shop.id}` });
      return { ok: true, message: job ? "Looking for articles to pitch. Check back in a minute." : "Already looking…" };
    }
    if (!target) return { ok: false, message: "Not found" };
    if (intent === "status") {
      await db.outreachTarget.update({ where: { id: target.id }, data: { status: String(form.get("status")) } });
      return { ok: true, message: "Updated" };
    }
    if (intent === "save") {
      await db.outreachTarget.update({
        where: { id: target.id },
        data: {
          subject: String(form.get("subject") ?? "").slice(0, 200),
          pitch: String(form.get("pitch") ?? "").slice(0, 5000),
          email: String(form.get("email") ?? "").trim() || null,
        },
      });
      return { ok: true, message: "Saved" };
    }
    if (intent === "redraft") {
      await draftPitch(target.id);
      return { ok: true, message: "New draft written" };
    }
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  return { ok: false, message: "Unknown action" };
};

type Target = Awaited<ReturnType<typeof loader>>["targets"][number];

function TargetCard({ t, submit }: { t: Target; submit: (d: Record<string, string>) => void }) {
  const shopify = useAppBridge();
  const [subject, setSubject] = useState(t.subject);
  const [pitch, setPitch] = useState(t.pitch);
  const [email, setEmail] = useState(t.email ?? "");
  const dirty = subject !== t.subject || pitch !== t.pitch || email !== (t.email ?? "");
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(pitch)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${pitch}`);
      shopify.toast.show("Copied. Paste it into your email.");
    } catch {
      shopify.toast.show("Couldn't copy here. Select the text and copy it.", { isError: true });
    }
  };

  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone={t.status === "won" ? "success" : t.status === "skipped" ? "neutral" : "info"}>{STATUS_LABELS[t.status] ?? t.status}</s-badge>
          <s-text type="strong">{t.title || t.domain}</s-text>
        </s-stack>
        <div className="geo-small">
          <a href={t.url} target="_blank" rel="noreferrer">
            {t.domain}
          </a>{" "}
          · used {t.cited} time{t.cited === 1 ? "" : "s"} by
        </div>
        <div className="geo-engines" style={{ justifyContent: "flex-start", margin: 0 }}>
          {t.engines.map((e) => (
            <EnginePill key={e} engine={e} label={ENGINE_LABELS[e as Engine] ?? e} />
          ))}
        </div>
        {t.brands.length > 0 && <div className="geo-small">AI recommends alongside it: {t.brands.slice(0, 6).join(", ")}</div>}

        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
          <s-text-field label="Send to" placeholder="editor@site.com" value={email} onInput={(e) => setEmail(e.currentTarget.value)} onChange={(e) => setEmail(e.currentTarget.value)} details={t.authorName ? `Author: ${t.authorName}` : !t.email ? "No email found. Try their contact page." : undefined} />
          <s-text-field label="Subject" value={subject} onInput={(e) => setSubject(e.currentTarget.value)} onChange={(e) => setSubject(e.currentTarget.value)} />
        </s-grid>
        <s-text-area label="Email" rows={9} value={pitch} onInput={(e) => setPitch(e.currentTarget.value)} onChange={(e) => setPitch(e.currentTarget.value)} />

        <s-stack direction="inline" gap="base" alignItems="center">
          {email ? (
            <s-button variant="primary" href={mailto} target="_blank" onClick={() => submit({ intent: "status", id: t.id, status: "sent" })}>
              Open in my email
            </s-button>
          ) : (
            t.contactUrl && (
              <s-button variant="primary" href={t.contactUrl} target="_blank">
                Open their contact page
              </s-button>
            )
          )}
          <s-button onClick={copy}>Copy email</s-button>
          {dirty && <s-button onClick={() => submit({ intent: "save", id: t.id, subject, pitch, email })}>Save edits</s-button>}
          <s-button variant="tertiary" onClick={() => submit({ intent: "redraft", id: t.id })}>
            Rewrite
          </s-button>
          <span className="geo-grow" />
          <s-select
            label="Status"
            labelAccessibilityVisibility="exclusive"
            value={t.status}
            onChange={(e) => submit({ intent: "status", id: t.id, status: e.currentTarget.value })}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <s-option key={value} value={value}>
                {label}
              </s-option>
            ))}
          </s-select>
        </s-stack>
      </s-stack>
    </s-section>
  );
}

export default function Outreach() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  useEffect(() => {
    if (fetcher.data?.message) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);
  const submit = (d: Record<string, string>) => fetcher.submit(d, { method: "post" });

  if (data.planId === "free") {
    return (
      <s-page heading="Outreach">
        <s-section>
          <Empty title="Get into the articles AI trusts">
            <p>
              AI assistants lean on &quot;best of&quot; roundups and reviews. On a plan, we find the ones that recommend your
              competitors, find who to contact, and draft a short, honest pitch for you to send.
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
    <s-page heading="Outreach">
      <s-button slot="primary-action" onClick={() => submit({ intent: "find" })} {...(data.finding ? { loading: true } : {})} {...(data.remaining <= 0 ? { disabled: true } : {})}>
        Find more articles
      </s-button>
      <s-section>
        <s-paragraph>
          These articles are used by AI assistants when they answer your shoppers&apos; questions, and they mention other brands
          but not you. A friendly note to the writer can get you included.{" "}
          {data.doneForYou
            ? "On Done-for-you, our team sends these pitches and follows up for you, including directories and roundups."
            : "You send the emails yourself, from your own inbox."}
        </s-paragraph>
        <div className="geo-small" style={{ marginTop: 8 }}>
          {data.remaining} of {data.perMonth} new targets left this month.
        </div>
      </s-section>
      {data.targets.length ? (
        data.targets.map((t) => <TargetCard key={t.id} t={t} submit={submit} />)
      ) : (
        <s-section>
          <Empty title={data.finding ? "Looking for articles…" : "No targets yet"}>
            {data.finding ? "This takes a minute or two." : "Targets are found after each scan, or click Find more articles."}
          </Empty>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
