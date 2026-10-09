import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop } from "../lib/shop.server";
import { sameBrand } from "../lib/match";
import { SOURCE_TYPE_LABELS, type SourceType } from "../lib/sources";
import { ENGINE_LABELS, type Engine } from "../lib/plans";
import { formatPct } from "../lib/format";
import { Bar, Empty, EnginePill } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireShop(request);
  const scan = await db.scan.findFirst({ where: { shopId: shop.id, status: "done" }, orderBy: { startedAt: "desc" } });
  const competitors = await db.competitor.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "asc" } });
  if (!scan) return { scanned: false as const, competitors: [], you: 0, sources: [], typeTotals: [] };

  const answers = await db.aiAnswer.findMany({
    where: { scanId: scan.id, status: "parsed" },
    select: { engine: true, mentioned: true, mentions: { select: { brand: true, isMerchant: true } }, citations: true },
  });
  const total = answers.length || 1;

  const rows = competitors.map((c) => {
    const hits = answers.filter((a) => a.mentions.some((m) => !m.isMerchant && sameBrand(m.brand, c.name)));
    const engines = [...new Set(hits.map((h) => h.engine))];
    return { id: c.id, name: c.name, hidden: c.hidden, auto: c.auto, share: hits.length / total, engines };
  });

  // Sources: which sites the AI leans on, and whether it names you when it uses them.
  const byDomain = new Map<string, { domain: string; type: string; n: number; named: number; own: boolean; example: { url: string; title: string | null } }>();
  const typeCounts = new Map<string, number>();
  for (const a of answers) {
    const seen = new Set<string>();
    for (const c of a.citations) {
      if (seen.has(c.domain)) continue;
      seen.add(c.domain);
      typeCounts.set(c.isOwn ? "yours" : c.type, (typeCounts.get(c.isOwn ? "yours" : c.type) ?? 0) + 1);
      const d = byDomain.get(c.domain) ?? { domain: c.domain, type: c.type, n: 0, named: 0, own: c.isOwn, example: { url: c.url, title: c.title } };
      d.n++;
      if (a.mentioned) d.named++;
      byDomain.set(c.domain, d);
    }
  }
  const typeTotal = [...typeCounts.values()].reduce((s, v) => s + v, 0) || 1;

  return {
    scanned: true as const,
    you: answers.filter((a) => a.mentioned).length / total,
    competitors: rows.sort((a, b) => Number(a.hidden) - Number(b.hidden) || b.share - a.share),
    sources: [...byDomain.values()].sort((a, b) => b.n - a.n).slice(0, 40),
    typeTotals: [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ type, share: n / typeTotal })),
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
  ugc: "Genuine customer posts and reviews here carry weight.",
  brand: "AI reads competitors' own product pages; clear pages win.",
  marketplace: "Marketplace listings can be quoted by AI.",
  yours: "Your own pages. Fixes make these easier for AI to quote.",
};

export default function Competitors() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [name, setName] = useState("");

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
                      <EnginePill key={e} engine={e} label={ENGINE_LABELS[e as Engine] ?? e} />
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
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap="base">
          {data.typeTotals.map((t) => (
            <s-box key={t.type} padding="base" borderRadius="base" background="subdued">
              <s-stack direction="block" gap="small-200">
                <s-text type="strong">{t.type === "yours" ? "Your website" : SOURCE_TYPE_LABELS[t.type as SourceType] ?? t.type}</s-text>
                <span style={{ fontSize: 24, fontWeight: 700 }} className="geo-num">
                  {formatPct(t.share)}
                </span>
                <span className="geo-small">{TYPE_TIPS[t.type] ?? ""}</span>
              </s-stack>
            </s-box>
          ))}
        </s-grid>
      </s-section>

      <s-section heading="Most-used websites">
        <table className="geo-table">
          <thead>
            <tr>
              <th>Website</th>
              <th>Type</th>
              <th>Used in</th>
              <th>AI names you when it uses this</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((s) => (
              <tr key={s.domain}>
                <td>
                  <a href={s.example.url} target="_blank" rel="noreferrer">
                    {s.domain}
                  </a>
                  {s.example.title && <div className="geo-small">{s.example.title.slice(0, 70)}</div>}
                </td>
                <td className="geo-small">{s.own ? "Your website" : SOURCE_TYPE_LABELS[s.type as SourceType] ?? s.type}</td>
                <td className="geo-num">{s.n} answers</td>
                <td style={{ minWidth: 120 }}>
                  <div className="geo-row" style={{ gap: 8 }}>
                    <div className="geo-grow">
                      <Bar value={s.n ? s.named / s.n : 0} />
                    </div>
                    <span className="geo-num geo-small">{formatPct(s.n ? s.named / s.n : 0)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
