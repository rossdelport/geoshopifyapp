import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { requireWebShop } from "../lib/web-auth.server";
import { questionRows } from "../lib/question-stats.server";
import { formatNumber, formatPct } from "../lib/format";
import { PageHead } from "../components/web";

// usegeo.app/dash/questions: every buying question we ask AI for the store, how often AI named the store, its
// best position, and who AI named instead.

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { shop } = await requireWebShop(request);
  const rows = await questionRows(shop.id);
  return { scanned: rows.scanned, questions: rows.questions.filter((q) => q.active) };
};

export default function Questions() {
  const { scanned, questions } = useLoaderData<typeof loader>();
  return (
    <>
      <PageHead
        title="Buying questions"
        intro="The questions shoppers ask AI before they buy. We ask each one twice on every AI assistant."
        right={<span className="w-chip">{questions.length} tracked</span>}
      />
      <section className="w-box">
        {questions.length ? (
          <div className="w-table-wrap">
            <table className="w-table">
              <thead>
                <tr>
                  <th>Buying question</th>
                  <th>Searches a month</th>
                  <th>AI names you</th>
                  <th>AI names instead</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id}>
                    <td className="w-q">{q.text}</td>
                    <td className="num">{q.volume ? formatNumber(q.volume) : "Not known"}</td>
                    <td className="num">
                      {q.rate === null ? (
                        <span className="w-dot">{scanned ? "Not asked yet" : "Checking"}</span>
                      ) : (
                        <span className={`w-dot ${q.rate >= 0.5 ? "ok" : q.rate > 0 ? "warn" : "no"}`}>
                          {q.rate > 0 ? `${formatPct(q.rate)}${q.best ? `, best #${q.best}` : ""}` : "Not named"}
                        </span>
                      )}
                    </td>
                    <td>{q.winners.join(", ") || "None"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="w-empty">We’re still writing your buying questions. Check back in a few minutes.</p>
        )}
      </section>
    </>
  );
}
