import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop } from "../lib/shop.server";
import { sameBrand } from "../lib/match";
import { cleanUrl } from "../lib/answers";
import {
  SOURCE_TYPE_LABELS,
  latestScanPerEngine,
  sharedTopDomains,
  sourcesByEngine,
  type SourceType,
  type SourcesView,
} from "../lib/sources";
import { ENGINE_LABELS, type Engine } from "../lib/plans";
import { formatPct } from "../lib/format";
import { Bar, Empty, EnginePill } from "../components/ui";

const ENGINE_ORDER = Object.keys(ENGINE_LABELS);
const TOP_SITES = 40;

// own: the store's website. yes: a page AI cites here names the store. some: another page on this site
// names the store, but not the ones AI cites. no: the pages we read here don't name the store.
type OnIt = "own" | "yes" | "some" | "no" | null;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireShop(request);
  const [scans, competitors] = await Promise.all([
    db.scan.findMany({ where: { shopId: shop.id, status: "done" }, orderBy: { startedAt: "desc" }, take: 10, select: { id: true } }),
    db.competitor.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "asc" } }),
  ]);
  if (!scans.length) {
    return { scanned: false as const, competitors: [], you: 0, engines: [] as string[], views: {} as Record<string, SourcesView & { domains: (SourcesView["domains"][number] & { onIt: OnIt })[] }>, shared: null };
  }

  // Who AI recommends: the latest scan.
  const answers = await db.aiAnswer.findMany({
    where: { scanId: scans[0].id, status: "parsed" },
    select: { engine: true, mentioned: true, mentions: { select: { brand: true, isMerchant: true } } },
  });
  const total = answers.length || 1;
  const rows = competitors.map((c) => {
    const hits = answers.filter((a) => a.mentions.some((m) => !m.isMerchant && sameBrand(m.brand, c.name)));
    const engines = [...new Set(hits.map((h) => h.engine))];
    return { id: c.id, name: c.name, hidden: c.hidden, auto: c.auto, share: hits.length / total, engines };
  });

  // Sources: each assistant's newest scan (daily light scans skip Claude, so it comes from the weekly one).
  const scanIds = scans.map((s) => s.id);
  const groups = await db.aiAnswer.groupBy({ by: ["scanId", "engine"], where: { scanId: { in: scanIds }, status: "parsed" } });
  const perEngine = latestScanPerEngine(scanIds, groups);
  const sourceAnswers = Object.keys(perEngine).length
    ? await db.aiAnswer.findMany({
        where: { status: "parsed", OR: Object.entries(perEngine).map(([engine, scanId]) => ({ engine, scanId })) },
        select: { engine: true, mentioned: true, citations: { select: { url: true, domain: true, title: true, type: true, isOwn: true } } },
      })
    : [];
  const { engines, views } = sourcesByEngine(sourceAnswers, ENGINE_ORDER);

  // Is the store on the site? Known for pages outreach has read (the page itself names the store or not),
  // judged on the pages this view's answers actually cite there.
  const checked = await db.outreachTarget.findMany({
    where: { shopId: shop.id, mentionsMerchant: { not: null } },
    select: { url: true, domain: true, mentionsMerchant: true },
  });
  const byUrl = new Map(checked.map((t) => [t.url, Boolean(t.mentionsMerchant)]));
  const namesOnDomain = new Set(checked.filter((t) => t.mentionsMerchant).map((t) => t.domain));
  const citedUrls = (engine: string) => {
    const out = new Map<string, Set<string>>();
    for (const a of sourceAnswers) {
      if (engine !== "all" && a.engine !== engine) continue;
      for (const c of a.citations) {
        const set = out.get(c.domain) ?? new Set<string>();
        set.add(cleanUrl(c.url));
        out.set(c.domain, set);
      }
    }
    return out;
  };
  const onItFor = (domain: string, cited: Set<string> | undefined): OnIt => {
    const reads = [...(cited ?? [])].filter((u) => byUrl.has(u));
    if (reads.some((u) => byUrl.get(u))) return "yes";
    if (namesOnDomain.has(domain)) return "some";
    return reads.length ? "no" : null;
  };

  const trimmed = Object.fromEntries(
    Object.entries(views).map(([key, v]) => {
      const cited = citedUrls(key);
      return [key, { ...v, domains: v.domains.slice(0, TOP_SITES).map((d) => ({ ...d, onIt: (d.own ? "own" : onItFor(d.domain, cited.get(d.domain))) as OnIt })) }];
    }),
  );

  return {
    scanned: true as const,
    you: answers.filter((a) => a.mentioned).length / total,
    competitors: rows.sort((a, b) => Number(a.hidden) - Number(b.hidden) || b.share - a.share),
    engines,
    views: trimmed,
    shared: sharedTopDomains(views, engines, 10),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await requireShop(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  if (intent === "hide" || intent === "show") {
    await db.competitor.updateMany({ where: { id: String(form.get("id")), shopId: shop.id }, data: { hidden: intent === "hide" } });
    return { ok: true, message: intent === "hide" ? "Hidden from your competitor list" : "Back on your list" };
  }
  if (intent === "add") {
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    if (name.length < 2) return { ok: false, message: "Type the brand name" };
    await db.competitor.upsert({
      where: { shopId_name: { shopId: shop.id, name } },
      create: { shopId: shop.id, name, auto: false },
      update: { hidden: false },
    });
    return { ok: true, message: `${name} added` };
  }
  return { ok: false, message: "Unknown action" };
};

const TYPE_TIPS: Record<string, string> = {
  editorial: "Get featured in these roundups: see Outreach.",
  retailer: "Being stocked by these retailers helps AI find you.",
  ugc: "Real people's posts carry weight. Join threads openly as the brand: see Outreach.",
  brand: "AI reads competitors' own product pages; clear pages win.",
  marketplace: "Marketplace listings can be quoted by AI.",
  yours: "Your own pages. Fixes make these easier for AI to quote.",
};

const engineLabel = (e: string) => ENGINE_LABELS[e as Engine] ?? e;
const typeLabel = (t: string) => (t === "yours" ? "Your website" : SOURCE_TYPE_LABELS[t as SourceType] ?? t);

function OnItCell({ onIt }: { onIt: OnIt }) {
  if (onIt === "own") return <s-badge tone="success">Your website</s-badge>;
  if (onIt === "yes") return <s-badge tone="success">Names you</s-badge>;
  if (onIt === "some") return <span className="geo-small">One page here names you</span>;
  if (onIt === "no")
    return (
      <s-stack direction="block" gap="small-300">
        <s-badge tone="warning">Not yet</s-badge>
        <s-link href="/app/outreach">See outreach</s-link>
      </s-stack>
    );
  return <span className="geo-small">Not checked</span>;
}

export default function Competitors() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const asked = params.get("engine") ?? "all";
  const [view, setView] = useState(asked === "all" || data.engines.includes(asked) ? asked : "all");

  useEffect(() => {
    if (fetcher.data?.message) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);

  if (!data.scanned) {
    return (
      <s-page heading="Competitors & sources">
        <s-section>
          <Empty title="Nothing here yet">After your first scan you&apos;ll see who AI recommends instead of you.</Empty>
        </s-section>
      </s-page>
    );
  }

  const current = data.views[view] ?? data.views.all;
  const who = view === "all" ? "AI assistants" : engineLabel(view);

  return (
    <s-page heading="Competitors & sources">
      <s-section heading="Who AI recommends">
        <s-paragraph>
          <s-text color="subdued">Share of AI answers (latest scan) that name each brand.</s-text>
        </s-paragraph>
        <table className="geo-table">
          <tbody>
            <tr>
              <td style={{ width: "34%" }}>
                <s-text type="strong">You</s-text>
              </td>
              <td>
                <Bar value={data.you} tone="you" />
              </td>
              <td className="geo-num" style={{ width: 60, textAlign: "right" }}>
                {formatPct(data.you)}
              </td>
              <td style={{ width: 90 }} />
            </tr>
            {data.competitors.map((c) => (
              <tr key={c.id} style={{ opacity: c.hidden ? 0.45 : 1 }}>
                <td>
                  {c.name}
                  <div className="geo-engines" style={{ justifyContent: "flex-start", margin: "4px 0 0", gap: 4 }}>
                    {c.engines.map((e) => (
                      <EnginePill key={e} engine={e} label={engineLabel(e)} />
                    ))}
                  </div>
                </td>
                <td>
                  <Bar value={c.share} tone="them" />
                </td>
                <td className="geo-num" style={{ textAlign: "right" }}>
                  {formatPct(c.share)}
                </td>
                <td style={{ textAlign: "right" }}>
                  <s-button variant="tertiary" onClick={() => fetcher.submit({ intent: c.hidden ? "show" : "hide", id: c.id }, { method: "post" })}>
                    {c.hidden ? "Show" : "Not a rival"}
                  </s-button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="geo-row" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <div className="geo-grow">
            <s-text-field
              label="Add a competitor"
              placeholder="Brand name"
              value={name}
              onInput={(e) => setName(e.currentTarget.value)}
              onChange={(e) => setName(e.currentTarget.value)}
            />
          </div>
          <s-button
            onClick={() => {
              fetcher.submit({ intent: "add", name }, { method: "post" });
              setName("");
            }} {...(!name.trim() ? { disabled: true } : {})}>
            Add
          </s-button>
        </div>
      </s-section>

      <s-section heading="Where AI gets its answers">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Each AI assistant leans on different websites, so being on the sites one of them trusts doesn&apos;t win the others.
            Pick an assistant to see its own list.
            {data.shared && data.engines.length > 1
              ? ` In your latest scans, ${data.shared.shared} of the ${data.shared.top} sites each assistant uses most ${data.shared.shared === 1 ? "is" : "are"} used by all of them.`
              : ""}
          </s-paragraph>
          {data.engines.length > 1 && (
            <s-stack direction="inline" gap="small-200">
              {["all", ...data.engines].map((e) => (
                <s-button key={e} variant={view === e ? "primary" : "secondary"} onClick={() => setView(e)}>
                  {e === "all" ? "All assistants" : engineLabel(e)}
                </s-button>
              ))}
            </s-stack>
          )}
          {current.types.length ? (
            <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
              {current.types.map((t) => (
                <s-box key={t.type} padding="base" borderRadius="base" background="subdued">
                  <s-stack direction="block" gap="small-200">
                    <s-text type="strong">{typeLabel(t.type)}</s-text>
                    <span style={{ fontSize: 24, fontWeight: 700 }} className="geo-num">
                      {formatPct(t.share)}
                    </span>
                    <span className="geo-small">{TYPE_TIPS[t.type] ?? ""}</span>
                  </s-stack>
                </s-box>
              ))}
            </s-grid>
          ) : (
            <span className="geo-small">{who} didn&apos;t show any sources in your latest scan.</span>
          )}
          <span className="geo-small">Share of the websites {who} cited, by kind of site.</span>
        </s-stack>
      </s-section>

      <s-section heading={view === "all" ? "Most-used websites" : `Websites ${who} uses most`}>
        <s-paragraph>
          <s-text color="subdued">
            Used in: share of {who === "AI assistants" ? "all AI" : `${who}'s`} answers that cite the site. Names you alongside: how often the answer also
            names you. On it: whether the pages AI cites there name you (we read the pages worth pitching).
          </s-text>
        </s-paragraph>
        {current.domains.length ? (
          <table className="geo-table">
            <thead>
              <tr>
                <th>Website</th>
                <th>Type</th>
                <th>Used in</th>
                <th>Names you alongside</th>
                <th>On it</th>
              </tr>
            </thead>
            <tbody>
              {current.domains.map((s) => (
                <tr key={s.domain}>
                  <td>
                    <a href={s.example.url} target="_blank" rel="noreferrer">
                      {s.domain}
                    </a>
                    {s.example.title && <div className="geo-small">{s.example.title.slice(0, 70)}</div>}
                  </td>
                  <td className="geo-small">{s.own ? "Your website" : typeLabel(s.type)}</td>
                  <td className="geo-num">
                    {formatPct(s.share)}
                    <div className="geo-small">
                      {s.answers} answer{s.answers === 1 ? "" : "s"}
                    </div>
                  </td>
                  <td style={{ minWidth: 110 }}>
                    <div className="geo-row" style={{ gap: 8 }}>
                      <div className="geo-grow">
                        <Bar value={s.answers ? s.named / s.answers : 0} />
                      </div>
                      <span className="geo-num geo-small">{formatPct(s.answers ? s.named / s.answers : 0)}</span>
                    </div>
                  </td>
                  <td>
                    <OnItCell onIt={s.onIt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No websites yet">Sources show here once {who} cites websites in its answers.</Empty>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
