import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop, getUsage } from "../lib/shop.server";
import { remainingOutreach } from "../lib/limits";
import { enqueue } from "../lib/jobs.server";
import { NAMED_STATUS, draftPitch, outreachUsedThisMonth } from "../lib/outreach.server";
import { countryName } from "../lib/onboarding.server";
import { costThisMonth } from "../lib/cost.server";
import { ENGINE_LABELS, type Engine } from "../lib/plans";
import { isReviewPlatform, pageDateLabel, targetScore, threadMaybeClosed, yearHint, type OutreachKind } from "../lib/sources";
import { Empty, EnginePill } from "../components/ui";

const ENGINE_ORDER = Object.keys(ENGINE_LABELS);
const STATUSES = ["new", "drafted", "sent", "replied", "won", "skipped"];

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  drafted: "Ready to send",
  sent: "Sent",
  replied: "Replied",
  won: "Featured 🎉",
  skipped: "Skipped",
};
// What each status means for kinds of page that don't get an email.
const KIND_STATUS_LABELS: Partial<Record<OutreachKind, Record<string, string>>> = {
  forum: { new: "To do", sent: "Joined in", skipped: "Skipped" },
  qa: { new: "To do", sent: "Answered", skipped: "Skipped" },
  directory: { new: "To do", sent: "Submitted", won: "Listed", skipped: "Skipped" },
  retailer: { new: "To do", sent: "Contacted", replied: "Replied", won: "Stocked", skipped: "Skipped" },
};
const statusLabels = (kind: string) => KIND_STATUS_LABELS[kind as OutreachKind] ?? STATUS_LABELS;

const GROUPS: { kinds: OutreachKind[]; heading: string; tip: string }[] = [
  {
    kinds: ["article"],
    heading: "Articles and roundups to pitch",
    tip: "Writers update these pages. A short, friendly email can get you added.",
  },
  {
    kinds: ["video"],
    heading: "Videos: ask for a review",
    tip: "Creators review products their viewers want. Offer a sample with no strings attached. If they feature a gifted product, they have to say so.",
  },
  {
    kinds: ["forum", "qa"],
    heading: "Threads to join",
    tip: "We never write posts for you. Join as yourself, say you're from the brand, answer the question helpfully and follow the community's rules.",
  },
  {
    kinds: ["directory"],
    heading: "Directories and review sites",
    tip: "Add or claim your free listing so AI finds the right details about you.",
  },
  {
    kinds: ["retailer"],
    heading: "Shops and marketplaces",
    tip: "AI quotes these shops' pages. If your products fit, ask about stocking, or list on the marketplace yourself.",
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, plan } = await requireShop(request);
  const [targets, usage, used, running, profile] = await Promise.all([
    db.outreachTarget.findMany({ where: { shopId: shop.id }, orderBy: [{ timesCited: "desc" }, { createdAt: "desc" }] }),
    getUsage(shop.id),
    outreachUsedThisMonth(shop.id),
    db.job.findFirst({ where: { shopId: shop.id, type: "outreach.find", status: { in: ["queued", "running"] } } }),
    db.brandProfile.findUnique({ where: { shopId: shop.id } }),
  ]);
  const now = new Date();
  const order: Record<string, number> = { drafted: 0, new: 1, sent: 2, replied: 3, won: 4, skipped: 5 };
  const view = (t: (typeof targets)[number]) => ({
    id: t.id,
    url: t.url,
    domain: t.domain,
    title: t.title,
    kind: t.kind as OutreachKind,
    brands: t.namedBrands as string[],
    engines: ENGINE_ORDER.filter((e) => (t.engines as string[]).includes(e)).concat((t.engines as string[]).filter((e) => !ENGINE_ORDER.includes(e))),
    cited: t.timesCited,
    authorName: t.authorName,
    email: t.email,
    contactUrl: t.contactUrl,
    subject: t.subject ?? "",
    pitch: t.pitch ?? "",
    status: t.status,
    mentionsMerchant: t.mentionsMerchant,
    updated: pageDateLabel(t.pageModifiedAt),
    threadClosed: threadMaybeClosed(t.kind, t.domain, t.pageModifiedAt, now),
    reviewSite: isReviewPlatform(t.domain),
    score: targetScore(
      {
        cited: t.timesCited,
        engines: t.engines as string[],
        rivals: (t.namedBrands as string[]).length,
        merchantNamed: 0,
        kind: t.kind as OutreachKind,
        modifiedAt: t.pageModifiedAt,
        yearHint: yearHint(t.url, t.title, now),
        domain: t.domain,
      },
      now,
    ),
  });
  const open = targets
    .filter((t) => t.status !== NAMED_STATUS)
    .map(view)
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.score - a.score);
  const named = targets.filter((t) => t.status === NAMED_STATUS).map(view);
  const brand = profile?.brandName ?? shop.name ?? shop.domain.split(".")[0];

  return {
    planId: plan.id,
    perMonth: plan.outreachPerMonth,
    doneForYou: plan.doneForYou,
    remaining: remainingOutreach(plan, { ...usage, outreachThisMonth: used }),
    finding: Boolean(running),
    brand,
    engines: ENGINE_ORDER.filter((e) => open.some((t) => t.engines.includes(e))),
    // What a directory listing asks for, filled in from the store's profile.
    listing: [
      { label: "Brand name", value: brand },
      { label: "Website", value: `https://${shop.primaryDomain ?? shop.domain}` },
      { label: "What you sell", value: profile?.summary || "One or two plain sentences about your products" },
      { label: "Category", value: profile?.category || "Your main product category" },
      { label: "Based in", value: countryName(profile?.country ?? shop.country) },
      { label: "Logo", value: "Square image, at least 400 pixels wide" },
      { label: "Contact", value: "The email or page customers use to reach you" },
    ],
    targets: open,
    named,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, plan } = await requireShop(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const id = String(form.get("id") ?? "");
  const target = id ? await db.outreachTarget.findFirst({ where: { id, shopId: shop.id } }) : null;
  try {
    if (intent === "find") {
      const job = await enqueue("outreach.find", {}, { shopId: shop.id, dedupeKey: `outreach:${shop.id}` });
      return { ok: true, message: job ? "Looking for pages to get onto. Check back in a minute." : "Already looking…" };
    }
    if (!target) return { ok: false, message: "Not found" };
    if (intent === "status") {
      const status = String(form.get("status"));
      if (!STATUSES.includes(status)) return { ok: false, message: "Unknown status" };
      await db.outreachTarget.update({ where: { id: target.id }, data: { status } });
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
      // Each rewrite is a Claude call: over the month's AI budget, write the plain draft instead.
      const overCap = (await costThisMonth(shop.id)) >= plan.costCapUsd;
      await draftPitch(target.id, { useClaude: !overCap });
      return { ok: true, message: overCap ? "This month's AI budget is used up, so we wrote a plain draft for you to edit." : "New draft written" };
    }
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  return { ok: false, message: "Unknown action" };
};

type Data = Awaited<ReturnType<typeof loader>>;
type Target = Data["targets"][number];
type Submit = (d: Record<string, string>) => void;

const engineLabel = (e: string) => ENGINE_LABELS[e as Engine] ?? e;

function StatusSelect({ t, submit }: { t: Target; submit: Submit }) {
  const labels = statusLabels(t.kind);
  const options = labels[t.status] ? labels : { ...labels, [t.status]: STATUS_LABELS[t.status] ?? t.status };
  return (
    <s-select
      label="Status"
      labelAccessibilityVisibility="exclusive"
      value={t.status}
      onChange={(e) => submit({ intent: "status", id: t.id, status: e.currentTarget.value })}
    >
      {Object.entries(options).map(([value, label]) => (
        <s-option key={value} value={value}>
          {label}
        </s-option>
      ))}
    </s-select>
  );
}

function TargetHead({ t, submit }: { t: Target; submit: Submit }) {
  const labels = statusLabels(t.kind);
  return (
    <s-stack direction="block" gap="small-200">
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-badge tone={t.status === "won" ? "success" : t.status === "skipped" ? "neutral" : "info"}>{labels[t.status] ?? STATUS_LABELS[t.status] ?? t.status}</s-badge>
        <s-text type="strong">{t.title || t.domain}</s-text>
      </s-stack>
      <div className="geo-small">
        <a href={t.url} target="_blank" rel="noreferrer">
          {t.domain}
        </a>
        {t.updated ? ` · ${t.updated}` : ""} · used {t.cited} time{t.cited === 1 ? "" : "s"} by
      </div>
      <div className="geo-engines" style={{ justifyContent: "flex-start", margin: 0 }}>
        {t.engines.map((e) => (
          <EnginePill key={e} engine={e} label={engineLabel(e)} />
        ))}
      </div>
      {t.brands.length > 0 && <div className="geo-small">When AI uses this page it recommends: {t.brands.slice(0, 6).join(", ")}</div>}
      {t.mentionsMerchant === false && <div className="geo-small">We read the page: it doesn&apos;t name you yet.</div>}
      {t.mentionsMerchant === null && (
        <div className="geo-small">We couldn&apos;t read this page. Check it doesn&apos;t already mention you before you reach out.</div>
      )}
      {t.mentionsMerchant === true && (
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-badge tone="success">This page names you now</s-badge>
          {(t.status === "sent" || t.status === "replied") && (
            <s-button variant="tertiary" onClick={() => submit({ intent: "status", id: t.id, status: "won" })}>
              Mark as done
            </s-button>
          )}
        </s-stack>
      )}
    </s-stack>
  );
}

/** Articles and videos: an editable message the store sends itself. */
function MessageCard({ t, submit }: { t: Target; submit: Submit }) {
  const shopify = useAppBridge();
  const video = t.kind === "video";
  const [subject, setSubject] = useState(t.subject);
  const [pitch, setPitch] = useState(t.pitch);
  const [email, setEmail] = useState(t.email ?? "");
  const dirty = subject !== t.subject || pitch !== t.pitch || email !== (t.email ?? "");
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(pitch)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(video ? pitch : `Subject: ${subject}\n\n${pitch}`);
      shopify.toast.show(video ? "Copied. Paste it into your message." : "Copied. Paste it into your email.");
    } catch {
      shopify.toast.show("Couldn't copy here. Select the text and copy it.", { isError: true });
    }
  };

  if (t.mentionsMerchant === true) {
    // The page names the store now: nothing to send.
    return (
      <s-box padding="base" border="base" borderRadius="base">
        <s-stack direction="block" gap="base">
          <TargetHead t={t} submit={submit} />
          <s-stack direction="inline" gap="base" alignItems="center">
            <s-button href={t.url} target="_blank">
              {video ? "Open the video" : "Open the page"}
            </s-button>
            <span className="geo-grow" />
            <StatusSelect t={t} submit={submit} />
          </s-stack>
        </s-stack>
      </s-box>
    );
  }

  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <TargetHead t={t} submit={submit} />
        {video ? (
          <s-paragraph>
            <s-text color="subdued">
              Watch the video first and make the message your own. Send it through the creator&apos;s channel page or the business email
              they list there.
            </s-text>
          </s-paragraph>
        ) : (
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(240px, 1fr))" gap="base">
            <s-text-field label="Send to" placeholder="editor@site.com" value={email} onInput={(e) => setEmail(e.currentTarget.value)} onChange={(e) => setEmail(e.currentTarget.value)} details={t.authorName ? `Author: ${t.authorName}` : !t.email ? "No email found. Try their contact page." : undefined} />
            <s-text-field label="Subject" value={subject} onInput={(e) => setSubject(e.currentTarget.value)} onChange={(e) => setSubject(e.currentTarget.value)} />
          </s-grid>
        )}
        <s-text-area label={video ? `Message to ${t.authorName ?? "the creator"}` : "Email"} rows={9} value={pitch} onInput={(e) => setPitch(e.currentTarget.value)} onChange={(e) => setPitch(e.currentTarget.value)} />

        <s-stack direction="inline" gap="base" alignItems="center">
          {video ? (
            <s-button variant="primary" href={t.contactUrl ?? t.url} target="_blank">
              {t.contactUrl ? "Open their channel" : "Open the video"}
            </s-button>
          ) : email ? (
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
          <s-button onClick={copy}>{video ? "Copy message" : "Copy email"}</s-button>
          {dirty && <s-button onClick={() => submit({ intent: "save", id: t.id, subject, pitch, email })}>Save edits</s-button>}
          <s-button variant="tertiary" onClick={() => submit({ intent: "redraft", id: t.id })}>
            Rewrite
          </s-button>
          <span className="geo-grow" />
          <StatusSelect t={t} submit={submit} />
        </s-stack>
      </s-stack>
    </s-box>
  );
}

/** Forum and Q&A threads: guidance only. We never write posts for the store. */
function ThreadCard({ t, brand, submit }: { t: Target; brand: string; submit: Submit }) {
  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <TargetHead t={t} submit={submit} />
        <s-unordered-list>
          <s-list-item>Read the whole thread first.</s-list-item>
          <s-list-item>Join as yourself and say you&apos;re from {brand}.</s-list-item>
          <s-list-item>Answer the question helpfully. Mention your product only where it truly fits.</s-list-item>
          <s-list-item>Follow the community&apos;s rules. Some don&apos;t allow brands or links.</s-list-item>
          <s-list-item>Never post as a customer, and don&apos;t ask others to post for you.</s-list-item>
        </s-unordered-list>
        {t.threadClosed && (
          <s-paragraph>
            <s-text color="subdued">
              Older threads are often closed to replies. If this one is, answer a newer thread on the same question, or ask the community
              openly as the brand if its rules allow.
            </s-text>
          </s-paragraph>
        )}
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button variant="primary" href={t.url} target="_blank">
            Open the thread
          </s-button>
          <span className="geo-grow" />
          <StatusSelect t={t} submit={submit} />
        </s-stack>
      </s-stack>
    </s-box>
  );
}

/** Directories and review sites: what to submit, filled in from the store's profile. */
function ListingCard({ t, listing, submit }: { t: Target; listing: Data["listing"]; submit: Submit }) {
  const shopify = useAppBridge();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(listing.map((l) => `${l.label}: ${l.value}`).join("\n"));
      shopify.toast.show("Copied your details.");
    } catch {
      shopify.toast.show("Couldn't copy here. Select the text and copy it.", { isError: true });
    }
  };
  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <TargetHead t={t} submit={submit} />
        {t.reviewSite ? (
          <s-unordered-list>
            <s-list-item>Claim your free brand profile and check the details are right.</s-list-item>
            <s-list-item>Invite real customers to leave a review, the way the site allows.</s-list-item>
            <s-list-item>Never write, buy or swap reviews.</s-list-item>
          </s-unordered-list>
        ) : (
          <s-paragraph>Check the site&apos;s listing rules first. A free listing is enough for AI to find you.</s-paragraph>
        )}
        <s-box padding="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="small-200">
            <s-text type="strong">What to submit</s-text>
            {listing.map((l) => (
              <div key={l.label} className="geo-small">
                <b>{l.label}:</b> {l.value}
              </div>
            ))}
          </s-stack>
        </s-box>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button variant="primary" href={t.url} target="_blank">
            Open the site
          </s-button>
          <s-button onClick={copy}>Copy my details</s-button>
          <span className="geo-grow" />
          <StatusSelect t={t} submit={submit} />
        </s-stack>
      </s-stack>
    </s-box>
  );
}

/** Shops and marketplaces: a stocking or listing to-do. */
function ShopCard({ t, submit }: { t: Target; submit: Submit }) {
  return (
    <s-box padding="base" border="base" borderRadius="base">
      <s-stack direction="block" gap="base">
        <TargetHead t={t} submit={submit} />
        <s-unordered-list>
          <s-list-item>Look for a &quot;Sell with us&quot; or &quot;Become a supplier&quot; page.</s-list-item>
          <s-list-item>Send your range, wholesale prices and where you ship.</s-list-item>
          <s-list-item>On a marketplace, list your products with the same clear details as your own store.</s-list-item>
        </s-unordered-list>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button variant="primary" href={t.contactUrl ?? t.url} target="_blank">
            {t.contactUrl ? "Open their contact page" : "Open the site"}
          </s-button>
          <span className="geo-grow" />
          <StatusSelect t={t} submit={submit} />
        </s-stack>
      </s-stack>
    </s-box>
  );
}

function TargetCard({ t, data, submit }: { t: Target; data: Data; submit: Submit }) {
  if (t.kind === "article" || t.kind === "video") return <MessageCard t={t} submit={submit} />;
  if (t.kind === "forum" || t.kind === "qa") return <ThreadCard t={t} brand={data.brand} submit={submit} />;
  if (t.kind === "directory") return <ListingCard t={t} listing={data.listing} submit={submit} />;
  return <ShopCard t={t} submit={submit} />;
}

export default function Outreach() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [engine, setEngine] = useState("all");
  useEffect(() => {
    if (fetcher.data?.message) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);
  const submit: Submit = (d) => fetcher.submit(d, { method: "post" });

  if (data.planId === "free") {
    return (
      <s-page heading="Outreach">
        <s-section>
          <Empty title="Get onto the pages AI trusts">
            <p>
              AI assistants lean on roundups, reviews, videos and forum threads. On a plan, we find the ones that recommend your
              competitors but not you, and give you an honest next step for each: a pitch to send, a review request, a thread to join
              or a listing to add.
            </p>
            <s-button variant="primary" href="/app/plans">
              See plans
            </s-button>
          </Empty>
        </s-section>
      </s-page>
    );
  }

  const shown = engine === "all" ? data.targets : data.targets.filter((t) => t.engines.includes(engine));
  const count = (e: string) => (e === "all" ? data.targets.length : data.targets.filter((t) => t.engines.includes(e)).length);
  const kindsInGroups = GROUPS.flatMap((g) => g.kinds);
  const leftover = shown.filter((t) => !kindsInGroups.includes(t.kind));

  return (
    <s-page heading="Outreach">
      <s-button slot="primary-action" onClick={() => submit({ intent: "find" })} {...(data.finding ? { loading: true } : {})} {...(data.remaining <= 0 ? { disabled: true } : {})}>
        Find more pages
      </s-button>
      <s-section>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            AI assistants use these pages when they answer your shoppers&apos; questions. When AI uses these pages, it recommends other
            brands and not you. Getting onto them is how brands get recommended. Each assistant leans on different sites, so work each one&apos;s list.{" "}
            {data.doneForYou
              ? "On Done-for-you, our team sends the pitches and review requests, adds your listings and follows up. Threads are best joined by you, as yourself from the brand."
              : "You send these yourself, from your own inbox and accounts."}
          </s-paragraph>
          <div className="geo-small">
            {data.remaining} of {data.perMonth} new targets left this month. Fresher pages come first: AI tends to favour recently updated pages.
          </div>
          {data.engines.length > 1 && (
            <s-stack direction="inline" gap="small-200">
              {["all", ...data.engines].map((e) => (
                <s-button key={e} variant={engine === e ? "primary" : "secondary"} onClick={() => setEngine(e)}>
                  {`${e === "all" ? "All assistants" : engineLabel(e)} (${count(e)})`}
                </s-button>
              ))}
            </s-stack>
          )}
        </s-stack>
      </s-section>

      {shown.length ? (
        <>
          {GROUPS.map((g) => {
            const list = shown.filter((t) => g.kinds.includes(t.kind));
            if (!list.length) return null;
            return (
              <s-section key={g.heading} heading={g.heading}>
                <s-stack direction="block" gap="base">
                  <s-paragraph>
                    <s-text color="subdued">{g.tip}</s-text>
                  </s-paragraph>
                  {list.map((t) => (
                    <TargetCard key={t.id} t={t} data={data} submit={submit} />
                  ))}
                </s-stack>
              </s-section>
            );
          })}
          {leftover.length > 0 && (
            <s-section heading="Other pages">
              <s-stack direction="block" gap="base">
                {leftover.map((t) => (
                  <TargetCard key={t.id} t={t} data={data} submit={submit} />
                ))}
              </s-stack>
            </s-section>
          )}
        </>
      ) : (
        <s-section>
          <Empty title={data.finding ? "Looking for pages…" : engine === "all" ? "No targets yet" : `No targets from ${engineLabel(engine)} yet`}>
            {data.finding ? "This takes a minute or two." : "Targets are found after each scan, or click Find more pages."}
          </Empty>
        </s-section>
      )}

      {data.named.length > 0 && (
        <s-section heading="Pages AI uses that already name you">
          <s-stack direction="block" gap="small-200">
            <s-paragraph>
              <s-text color="subdued">Good news: these pages mention you already. Keep your details on them up to date.</s-text>
            </s-paragraph>
            {data.named.map((t) => (
              <div key={t.id} className="geo-small">
                <a href={t.url} target="_blank" rel="noreferrer">
                  {t.title || t.domain}
                </a>
                {t.title ? ` · ${t.domain}` : ""}
                {t.updated ? ` · ${t.updated}` : ""}
                {t.engines.length ? ` · used by ${t.engines.map(engineLabel).join(", ")}` : ""}
              </div>
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
