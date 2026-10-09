import { useEffect, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import db from "../db.server";
import { requireShop, getUsage } from "../lib/shop.server";
import { canTrackMoreQuestions } from "../lib/limits";
import { generateQuestions } from "../lib/onboarding.server";
import { sameBrand } from "../lib/match";
import { formatNumber, formatPct } from "../lib/format";
import { Bar, Empty } from "../components/ui";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop, plan } = await requireShop(request);
  const [questions, scan, usage] = await Promise.all([
    db.question.findMany({ where: { shopId: shop.id }, orderBy: [{ active: "desc" }, { volume: { sort: "desc", nulls: "last" } }] }),
    db.scan.findFirst({ where: { shopId: shop.id, status: "done" }, orderBy: { startedAt: "desc" } }),
    getUsage(shop.id),
  ]);

  const stats = new Map<string, { n: number; named: number; best: number | null; winners: Map<string, number> }>();
  if (scan) {
    const answers = await db.aiAnswer.findMany({
      where: { scanId: scan.id, status: "parsed" },
      select: { questionId: true, mentioned: true, position: true, mentions: { where: { isMerchant: false }, select: { brand: true }, take: 3 } },
    });
    for (const a of answers) {
      const s = stats.get(a.questionId) ?? { n: 0, named: 0, best: null, winners: new Map() };
      s.n++;
      if (a.mentioned) {
        s.named++;
        if (a.position !== null && (s.best === null || a.position < s.best)) s.best = a.position;
      }
      for (const m of a.mentions) {
        const key = [...s.winners.keys()].find((k) => sameBrand(k, m.brand)) ?? m.brand;
        s.winners.set(key, (s.winners.get(key) ?? 0) + 1);
      }
      stats.set(a.questionId, s);
    }
  }

  return {
    limit: plan.questions,
    planName: plan.name,
    active: usage.activeQuestions,
    scanned: Boolean(scan),
    questions: questions.map((q) => {
      const s = stats.get(q.id);
      return {
        id: q.id,
        text: q.text,
        volume: q.volume,
        active: q.active,
        source: q.source,
        rate: s && s.n ? s.named / s.n : null,
        answers: s?.n ?? 0,
        best: s?.best ?? null,
        winners: s ? [...s.winners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b) : [],
      };
    }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, plan } = await requireShop(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "toggle") {
    const id = String(form.get("id"));
    const on = form.get("active") === "true";
    if (on && !canTrackMoreQuestions(plan, await getUsage(shop.id))) {
      return { ok: false, message: `Your plan tracks ${plan.questions} questions. Switch one off first, or upgrade.` };
    }
    await db.question.updateMany({ where: { id, shopId: shop.id }, data: { active: on } });
    return { ok: true, message: on ? "Now tracking this question" : "Stopped tracking this question" };
  }
  if (intent === "add") {
    const text = String(form.get("text") ?? "").trim().slice(0, 200);
    if (text.length < 8) return { ok: false, message: "Write the question the way a shopper would ask it." };
    const canAdd = canTrackMoreQuestions(plan, await getUsage(shop.id));
    await db.question.upsert({
      where: { shopId_text: { shopId: shop.id, text } },
      create: { shopId: shop.id, text, source: "merchant", active: canAdd },
      update: { active: canAdd },
    });
    return { ok: true, message: canAdd ? "Question added. It's checked on the next scan." : "Saved, but switched off: you're at your plan's limit." };
  }
  if (intent === "delete") {
    await db.question.deleteMany({ where: { id: String(form.get("id")), shopId: shop.id, source: "merchant" } });
    return { ok: true, message: "Question removed" };
  }
  if (intent === "regenerate") {
    await generateQuestions(shop.id);
    return { ok: true, message: "Fresh questions written. They're checked on the next scan." };
  }
  return { ok: false, message: "Unknown action" };
};

export default function Questions() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [text, setText] = useState("");

  useEffect(() => {
    if (fetcher.data?.message) shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
  }, [fetcher.data, shopify]);

  const submit = (data: Record<string, string>) => fetcher.submit(data, { method: "post" });

  return (
    <s-page heading="Questions">
      <s-button slot="primary-action" onClick={() => submit({ intent: "regenerate" })} {...(fetcher.state !== "idle" && fetcher.formData?.get("intent") === "regenerate" ? { loading: true } : {})}>
        Suggest new questions
      </s-button>

      <s-section>
        <s-paragraph>
          These are the questions shoppers ask AI assistants. We check each one{" "}
          {data.scanned ? "on every scan" : "on your first scan"} and record whether you&apos;re recommended. Tracking{" "}
          <s-text type="strong">
            {data.active} of {data.limit}
          </s-text>{" "}
          on {data.planName}.
        </s-paragraph>
        <div className="geo-row" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <div className="geo-grow">
            <s-text-field
              label="Add a question"
              placeholder="e.g. best natural deodorant for sensitive skin in Australia"
              value={text}
              onInput={(e) => setText(e.currentTarget.value)}
              onChange={(e) => setText(e.currentTarget.value)}
            />
          </div>
          <s-button
            onClick={() => {
              submit({ intent: "add", text });
              setText("");
            }} {...(!text.trim() ? { disabled: true } : {})}>
            Add
          </s-button>
        </div>
      </s-section>

      <s-section padding="none">
        {data.questions.length ? (
          <table className="geo-table" style={{ margin: "4px 0" }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 16 }}>Question</th>
                <th>Searches / mo</th>
                <th style={{ minWidth: 140 }}>You&apos;re named</th>
                <th>AI picks instead</th>
                <th style={{ paddingRight: 16 }}>Track</th>
              </tr>
            </thead>
            <tbody>
              {data.questions.map((q) => (
                <tr key={q.id} style={{ opacity: q.active ? 1 : 0.55 }}>
                  <td style={{ paddingLeft: 16 }}>
                    <s-link href={`/app/questions/${q.id}`}>{q.text}</s-link>
                    {q.source === "merchant" && <span className="geo-small"> · added by you</span>}
                  </td>
                  <td className="geo-num">{q.volume ? formatNumber(q.volume) : <span className="geo-small">–</span>}</td>
                  <td>
                    {q.rate === null ? (
                      <span className="geo-small">Not checked yet</span>
                    ) : (
                      <div>
                        <div className="geo-row" style={{ gap: 8, marginBottom: 4 }}>
                          <span className="geo-num">{formatPct(q.rate)}</span>
                          {q.best && <span className="geo-small">best #{q.best}</span>}
                        </div>
                        <Bar value={q.rate} />
                      </div>
                    )}
                  </td>
                  <td className="geo-small">{q.winners.join(", ") || "–"}</td>
                  <td style={{ paddingRight: 16 }}>
                    <s-switch
                      label="Track"
                      labelAccessibilityVisibility="exclusive"
                      checked={q.active}
                      onChange={() => submit({ intent: "toggle", id: q.id, active: String(!q.active) })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No questions yet">Start your scan from the dashboard and we&apos;ll write them for you.</Empty>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
