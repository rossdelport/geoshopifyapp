import type { ReactNode } from "react";
import type { HeadersFunction, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { isRouteErrorResponse, useLoaderData, useRouteError } from "react-router";
import { reportByToken } from "../lib/client-report.server";
import {
  type ClientReportData,
  type Tone,
  KIND_LABEL,
  hasWork,
  moneyChange,
  periodLabel,
  plural,
  pointsChange,
  shareText,
  shortDay,
  thisPeriod,
} from "../lib/client-report";
import { dayOf } from "../lib/clients";
import { dayLabel } from "../lib/guide-calendar";
import { formatMoney } from "../lib/format";
import { publicHostRedirect } from "../lib/tools/host.server";
import { SECURITY_HEADERS } from "../lib/tools/http";
import styles from "../styles/client-report.css?url";

// A client's report (Ross, 5 Nov 2026): firstpicked.com.au/results/<token>, a private link the client opens without
// logging in, from the email or a message from Ross. Phone first and calm: what AI sold, the AI score, what we did,
// where AI names them, who it names instead and what comes next. Every number was read when Ross made the report and
// saved with it (lib/client-report.server.ts). No site menu, no price, no upsell, no booking link: it's their report.

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  const report = await reportByToken(params.token ?? "");
  if (!report) throw new Response("Not found", { status: 404 });
  return { r: report };
};

// Only the client's browser may keep it, never search engines. No referrer, so the private link never travels to the
// sites it links to. A missing report is never kept (Ross may send a new link a minute later).
export const headers: HeadersFunction = ({ errorHeaders }) =>
  new Headers({
    ...SECURITY_HEADERS,
    "Referrer-Policy": "no-referrer",
    "Cache-Control": errorHeaders ? "no-store" : "private, max-age=300",
    "X-Robots-Tag": "noindex, nofollow",
  });

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const r = data?.r;
  if (!r) return [{ title: "Report not found | FirstPicked" }, { name: "robots", content: "noindex, nofollow" }];
  const title = `${r.brand}: ${KIND_LABEL[r.kind].toLowerCase()} report | FirstPicked`;
  return [
    { title },
    { name: "robots", content: "noindex, nofollow" },
    // The preview when Ross sends the link in a message: the brand and the days, no numbers.
    { property: "og:title", content: `${r.brand}: ${KIND_LABEL[r.kind].toLowerCase()} report` },
    { property: "og:description", content: periodLabel(r.fromDay, r.toDay) },
    { property: "og:site_name", content: "FirstPicked" },
  ];
};

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function ResultsPage() {
  const { r } = useLoaderData<typeof loader>();
  return (
    <div className="cr">
      <header className="cr-top">
        <Logo />
      </header>
      <main className="cr-main">
        <header className="cr-hero">
          <p className="cr-kicker">
            {KIND_LABEL[r.kind]} report · {periodLabel(r.fromDay, r.toDay)}
          </p>
          <h1>{r.brand}</h1>
          <p className="cr-where">
            {r.host}
            {r.month ? ` · Month ${r.month} of our work together` : ""}
          </p>
        </header>
        {r.note ? (
          <aside className="cr-note" aria-label="A note from Ross">
            <p className="cr-note-head">A note from Ross</p>
            <p className="cr-note-text">{r.note}</p>
          </aside>
        ) : null}
        <Sales r={r} />
        <Score r={r} />
        <Work r={r} />
        <Questions r={r} />
        <Rivals r={r} />
        <Next r={r} />
        <HowWeCount r={r} />
      </main>
      <footer className="cr-foot">
        <p>
          Made by FirstPicked for {r.brand}. Questions? Reply to the email or text Ross on <a href="sms:+61400369865">0400 369 865</a>.
        </p>
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <span className="cr-logo">
      <i aria-hidden="true" />
      FirstPicked
    </span>
  );
}

function Section({ id, title, sub, children }: { id: string; title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="cr-sec" aria-labelledby={id}>
      <div className="cr-sec-head">
        <h2 id={id}>{title}</h2>
        {sub ? <p>{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** A change line: green when up, red when down, grey when the same. */
function Change({ tone, text }: { tone: Tone; text: string }) {
  return (
    <p className={`cr-change ${tone}`}>
      <span aria-hidden="true">{tone === "up" ? "↑" : tone === "down" ? "↓" : "="}</span>
      {text}
    </p>
  );
}

function Sales({ r }: { r: ClientReportData }) {
  const when = thisPeriod(r.kind);
  if (!r.tracking) {
    return (
      <Section id="cr-sales" title="Sales from AI">
        <div className="cr-card cr-quiet">
          <p className="cr-strong">We can’t count sales from AI yet.</p>
          <p>
            The small tracking code isn’t sending visits from your store yet. Once it is on, this part shows the sales, orders and visits that
            came from AI.
          </p>
        </div>
      </Section>
    );
  }
  const quiet = !r.sales.revenue && !r.salesBefore.revenue;
  const change = quiet ? null : moneyChange(r.sales.revenue, r.salesBefore.revenue, r.currency, r.kind);
  const share = shareText(r.share);
  return (
    <Section id="cr-sales" title="Sales from AI" sub={`Orders where the shopper came to your store from an AI assistant, ${when}.`}>
      <div className="cr-card">
        <p className="cr-big">{formatMoney(r.sales.revenue, r.currency)}</p>
        <p className="cr-facts">
          {plural(r.sales.orders, "order", "orders")} · {plural(r.sales.visits, "visit", "visits")} from AI
        </p>
        {change ? <Change {...change} /> : null}
        {r.store ? (
          <p className="cr-line">
            All your store’s sales {when}: {formatMoney(r.store.revenue, r.currency)} from {plural(r.store.orders, "order", "orders")}.
            {share ? ` Sales from AI were ${share} of that.` : ""}
          </p>
        ) : null}
      </div>
      {r.byAssistant.length ? (
        <ul className="cr-card cr-rows" aria-label="By AI assistant">
          {r.byAssistant.map((a) => (
            <li key={a.name}>
              <span className="cr-row-name">{a.name}</span>
              <span className="cr-row-num">{formatMoney(a.revenue, r.currency)}</span>
              <span className="cr-row-sub">
                {plural(a.orders, "order", "orders")} · {plural(a.visits, "visit", "visits")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function Score({ r }: { r: ClientReportData }) {
  const { score } = r;
  const sub = "How often AI names you when shoppers ask it your buying questions. 100 means every time.";
  if (score.now === null) {
    return (
      <Section id="cr-score" title="Your AI score" sub={sub}>
        <div className="cr-card cr-quiet">
          <p>Your first AI check hasn’t finished yet. Your score shows here once it has.</p>
        </div>
      </Section>
    );
  }
  const changes = [pointsChange(score.now, score.periodStart, thisPeriod(r.kind)), pointsChange(score.now, score.workStart, "since we started")].filter(
    (c): c is NonNullable<typeof c> => c !== null,
  );
  return (
    <Section id="cr-score" title="Your AI score" sub={sub}>
      <div className="cr-card">
        <p className="cr-big">
          {score.now}
          <small> out of 100</small>
        </p>
        {changes.map((c) => (
          <Change key={c.text} {...c} />
        ))}
        {score.byAssistant.length ? (
          <ul className="cr-bars" aria-label="Score by AI assistant">
            {score.byAssistant.map((a) => (
              <li key={a.name}>
                <span>{a.name}</span>
                <span className="cr-bar-num">{a.score}</span>
                <span className="cr-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(0, Math.min(100, a.score))}%` }} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}

function Work({ r }: { r: ClientReportData }) {
  const w = r.work;
  const when = thisPeriod(r.kind);
  if (!hasWork(w)) {
    return (
      <Section id="cr-work" title={`What we did ${when}`}>
        <div className="cr-card cr-quiet">
          <p>Nothing new was finished {when}.</p>
        </div>
      </Section>
    );
  }
  const tiles = [
    { n: w.guidesWritten.length, one: "Guide written", many: "Guides written" },
    { n: w.guidesLive.length, one: "Guide now live", many: "Guides now live" },
    { n: w.changes.length, one: "Change made", many: "Changes made" },
    { n: w.checks, one: "AI check", many: "AI checks" },
    { n: w.reddit.length, one: "Reddit reply", many: "Reddit replies" },
    { n: w.writers.length, one: "Writer found", many: "Writers found" },
    { n: w.calls.length, one: "Call", many: "Calls" },
  ].filter((t) => t.n > 0);
  return (
    <Section id="cr-work" title={`What we did ${when}`}>
      <ul className="cr-tiles">
        {tiles.map((t) => (
          <li key={t.many}>
            <b>{fmt(t.n)}</b>
            <span>{t.n === 1 ? t.one : t.many}</span>
          </li>
        ))}
      </ul>
      <div className="cr-card cr-work">
        {w.guidesWritten.length ? (
          <WorkPart title="Buying guides written for you">
            <ul className="cr-list">
              {w.guidesWritten.map((t, i) => (
                <li key={`${t}-${i}`}>{t}</li>
              ))}
            </ul>
          </WorkPart>
        ) : null}
        {w.guidesLive.length ? (
          <WorkPart title="Guides now live on your store">
            <ul className="cr-list">
              {w.guidesLive.map((g, i) => (
                <li key={`${g.title}-${i}`}>
                  {g.url ? (
                    <a href={g.url} target="_blank" rel="noreferrer">
                      {g.title} ↗
                    </a>
                  ) : (
                    g.title
                  )}
                </li>
              ))}
            </ul>
          </WorkPart>
        ) : null}
        {w.changes.length ? (
          <WorkPart title="Changes we made">
            <Dated items={w.changes} />
          </WorkPart>
        ) : null}
        {w.checks ? (
          <WorkPart title="AI checks">
            <p>
              We asked AI your buying questions and read every answer, {w.checks === 1 ? "once" : `${fmt(w.checks)} times`} {when}.
            </p>
          </WorkPart>
        ) : null}
        {w.reddit.length ? (
          <WorkPart title="Reddit replies">
            <ul className="cr-list">
              {w.reddit.map((t, i) => (
                <li key={`${t.title}-${i}`}>
                  {t.url ? (
                    <a href={t.url} target="_blank" rel="noreferrer">
                      {t.title} ↗
                    </a>
                  ) : (
                    t.title
                  )}
                </li>
              ))}
            </ul>
          </WorkPart>
        ) : null}
        {w.writers.length ? (
          <WorkPart title="Writers found">
            <p>
              We found who writes for {w.writers.length === 1 ? "this site" : "these sites"} AI trusts: {w.writers.join(", ")}.
            </p>
          </WorkPart>
        ) : null}
        {w.calls.length ? (
          <WorkPart title={w.calls.length === 1 ? "Our call" : "Our calls"}>
            <Dated items={w.calls} />
          </WorkPart>
        ) : null}
      </div>
    </Section>
  );
}

function WorkPart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="cr-part">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/** Ross's own entries: the day, then what he wrote. */
function Dated({ items }: { items: { day: string; text: string }[] }) {
  return (
    <ul className="cr-dated">
      {items.map((c, i) => (
        <li key={`${c.day}-${i}`}>
          <span>{dayLabel(c.day)}</span>
          <p>{c.text}</p>
        </li>
      ))}
    </ul>
  );
}

function Questions({ r }: { r: ClientReportData }) {
  const q = r.questions;
  if (!q.tracked) return null;
  return (
    <Section
      id="cr-questions"
      title="Where AI names you"
      sub={`We track ${plural(q.tracked, "buying question", "buying questions")}: the things shoppers ask AI before they buy.`}
    >
      <div className={q.named === null || !q.checked ? "cr-card cr-quiet" : "cr-card"}>
        {q.named === null || !q.checked ? (
          <p>Your first AI check hasn’t finished yet.</p>
        ) : (
          <p className="cr-lead">
            In the latest check, AI named you for <b>{fmt(q.named)}</b> of the {plural(q.checked, "question", "questions")} we asked.
          </p>
        )}
      </div>
      {q.top.length ? (
        <div className="cr-card cr-qs">
          <h3>
            The questions people search for most <span>Did AI name you?</span>
          </h3>
          <ul>
            {q.top.map((t, i) => (
              <li key={`${t.text}-${i}`}>
                <span className="cr-q">
                  {t.text}
                  {t.searches ? <small>{plural(t.searches, "Google search", "Google searches")} a month</small> : null}
                </span>
                <span className={`cr-pill${t.named ? " ok" : ""}`}>{t.named === null ? "Not asked yet" : t.named ? "Yes" : "No"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

function Rivals({ r }: { r: ClientReportData }) {
  if (!r.rivals.length) return null;
  return (
    <Section id="cr-rivals" title="Who AI names instead" sub="The brands AI named most in its latest answers.">
      <ol className="cr-card cr-rivals">
        {r.rivals.map((b, i) => (
          <li key={b.brand}>
            <span className="cr-rank">{i + 1}</span>
            <span className="cr-rival">{b.brand}</span>
            <span className="cr-rival-share">{shareText(b.share) ?? "less than 1%"} of answers</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Next({ r }: { r: ClientReportData }) {
  if (!r.next.length) return null;
  return (
    <Section id="cr-next" title="Coming next" sub="The next buying guides on your calendar.">
      <ul className="cr-card cr-next">
        {r.next.map((g) => (
          <li key={g.day}>
            <span className="cr-day">{dayLabel(g.day)}</span>
            <span>{g.title}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function HowWeCount({ r }: { r: ClientReportData }) {
  return (
    <section className="cr-how" aria-labelledby="cr-how">
      <h2 id="cr-how">How we count</h2>
      <p>
        Sales from AI are orders where the shopper came to your store from an AI assistant, like ChatGPT, Gemini or Perplexity. The small
        tracking code on your store sees where each visit came from. Google’s AI Overviews send shoppers the same way Google search does, so we
        can’t tell them apart, and they aren’t counted here. Some of these shoppers might have found you anyway, so not every sale is down to
        our work.
      </p>
      <p>
        AI answers change from day to day, so your score moves a little on its own. These numbers are from {shortDay(dayOf(r.madeAt), true)}, when
        this report was made.
      </p>
    </section>
  );
}

/** A wrong or deleted link: the same plain page, no site menu. */
export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  if (!missing) console.error("[results] page error", error);
  return (
    <div className="cr">
      <header className="cr-top">
        <Logo />
      </header>
      <main className="cr-main">
        <header className="cr-hero">
          <h1>{missing ? "This report link doesn’t work." : "Something went wrong."}</h1>
          <p className="cr-where">{missing ? "Ask Ross for a new one." : "Please try again in a minute."}</p>
        </header>
      </main>
      <footer className="cr-foot">
        <p>
          Text Ross on <a href="sms:+61400369865">0400 369 865</a>.
        </p>
      </footer>
    </div>
  );
}
