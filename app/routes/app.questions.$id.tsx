import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop } from "../lib/shop.server";
import { ENGINE_LABELS, type Engine } from "../lib/plans";
import { SOURCE_TYPE_LABELS, type SourceType } from "../lib/sources";
import { formatDate, formatNumber, formatPct } from "../lib/format";
import { EnginePill, HighlightedAnswer, Empty } from "../components/ui";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { shop } = await requireShop(request);
  const question = await db.question.findFirst({ where: { id: params.id, shopId: shop.id } });
  if (!question) throw new Response("Not found", { status: 404 });

  const scans = await db.scan.findMany({
    where: { shopId: shop.id, status: "done", answers: { some: { questionId: question.id } } },
    orderBy: { startedAt: "desc" },
    take: 8,
    select: { id: true, startedAt: true },
  });
  const latest = scans[0];
  const answers = latest
    ? await db.aiAnswer.findMany({
        where: { scanId: latest.id, questionId: question.id },
        include: { mentions: { orderBy: { position: "asc" } }, citations: true },
        orderBy: [{ engine: "asc" }, { runNo: "asc" }],
      })
    : [];
  const history = await Promise.all(
    scans.map(async (s) => {
      const [n, named] = await Promise.all([
        db.aiAnswer.count({ where: { scanId: s.id, questionId: question.id, status: "parsed" } }),
        db.aiAnswer.count({ where: { scanId: s.id, questionId: question.id, status: "parsed", mentioned: true } }),
      ]);
      return { date: s.startedAt, rate: n ? named / n : 0 };
    }),
  );
  const profile = await db.brandProfile.findUnique({ where: { shopId: shop.id } });
  const names = [profile?.brandName, shop.name, ...((profile?.aliases as string[]) ?? [])].filter(Boolean) as string[];

  return {
    question: { text: question.text, volume: question.volume },
    names,
    scannedAt: latest?.startedAt ?? null,
    history: history.reverse(),
    answers: answers.map((a) => ({
      id: a.id,
      engine: a.engine,
      runNo: a.runNo,
      status: a.status,
      mentioned: a.mentioned,
      position: a.position,
      text: a.text ?? "",
      error: a.error,
      brands: a.mentions.map((m) => ({ name: m.brand, product: m.product, you: m.isMerchant })),
      sources: a.citations.map((c) => ({ url: c.url, domain: c.domain, title: c.title, type: c.type, own: c.isOwn })),
    })),
  };
};

export default function QuestionDetail() {
  const data = useLoaderData<typeof loader>();
  const engines = [...new Set(data.answers.map((a) => a.engine))];

  return (
    <s-page heading={data.question.text} inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app/questions">
        Questions
      </s-link>

      <s-section>
        <s-stack direction="inline" gap="base" alignItems="center">
          {data.question.volume ? <s-badge>{formatNumber(data.question.volume)} Google searches / month</s-badge> : null}
          {data.scannedAt && <s-text color="subdued">Last checked {formatDate(data.scannedAt)}</s-text>}
        </s-stack>
        {data.history.length > 1 && (
          <div className="geo-legend" style={{ marginTop: 10 }}>
            {data.history.map((h, i) => (
              <span key={i}>
                {formatDate(h.date)}: <b>{formatPct(h.rate)}</b>
              </span>
            ))}
          </div>
        )}
      </s-section>

      {!data.answers.length && (
        <s-section>
          <Empty title="Not checked yet">This question is included in your next scan.</Empty>
        </s-section>
      )}

      {engines.map((engine) => (
        <s-section key={engine} heading={ENGINE_LABELS[engine as Engine] ?? engine}>
          <s-stack direction="block" gap="large">
            {data.answers
              .filter((a) => a.engine === engine)
              .map((a) => (
                <s-stack key={a.id} direction="block" gap="small-200">
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-text type="strong">Run {a.runNo}</s-text>
                    {a.status === "empty" ? (
                      <s-badge>No AI answer shown for this search</s-badge>
                    ) : a.status === "failed" ? (
                      <s-badge tone="warning">Couldn&apos;t read this answer</s-badge>
                    ) : a.status !== "parsed" ? (
                      <s-badge>Waiting</s-badge>
                    ) : a.mentioned ? (
                      <s-badge tone="success">{`You're #${a.position ?? "?"}`}</s-badge>
                    ) : (
                      <s-badge tone="critical">Not named</s-badge>
                    )}
                  </s-stack>
                  {a.brands.length > 0 && (
                    <div className="geo-engines" style={{ justifyContent: "flex-start", margin: "4px 0" }}>
                      {a.brands.map((b, i) => (
                        <EnginePill key={i} engine={b.you ? "ours" : "other_ai"} label={`${i + 1}. ${b.name}${b.you ? " (you)" : ""}`} />
                      ))}
                    </div>
                  )}
                  {a.text && (
                    <details>
                      <summary className="geo-muted" style={{ cursor: "pointer" }}>
                        Read the full answer
                      </summary>
                      <HighlightedAnswer text={a.text} names={data.names} />
                    </details>
                  )}
                  {a.sources.length > 0 && (
                    <details>
                      <summary className="geo-muted" style={{ cursor: "pointer" }}>
                        {a.sources.length} sources the AI used
                      </summary>
                      <table className="geo-table">
                        <tbody>
                          {a.sources.map((s, i) => (
                            <tr key={i}>
                              <td>
                                <a href={s.url} target="_blank" rel="noreferrer">
                                  {s.title || s.domain}
                                </a>
                                <div className="geo-small">{s.domain}</div>
                              </td>
                              <td className="geo-small">{s.own ? "Your website" : SOURCE_TYPE_LABELS[s.type as SourceType] ?? s.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                  {a.error && a.status === "failed" && <div className="geo-small">{a.error.slice(0, 200)}</div>}
                </s-stack>
              ))}
          </s-stack>
        </s-section>
      ))}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
