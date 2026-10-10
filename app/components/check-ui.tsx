// Free product check pages (/check and /check/:id): the public, no-install report.
// Plain presentational components; the routes load the data. Styles: app/styles/check.css (ck-*).

import { useEffect, useState, type ReactNode } from "react";
import {
  CHECK_COUNTRIES,
  CHECK_ENGINES,
  CHECK_RUNS,
  type CheckAnswer,
  type CheckCountry,
  type CheckEngine,
  type CheckProduct,
  type CheckView,
} from "../lib/check-types";
import { ENGINE_LABELS, PLANS } from "../lib/plans";
import type { SourceType } from "../lib/sources";
import { sameBrand } from "../lib/match";

const COUNTRY_OPTIONS: [CheckCountry, string][] = [
  ["AU", "Australia"],
  ["NZ", "New Zealand"],
  ["US", "USA"],
  ["GB", "UK"],
  ["CA", "Canada"],
];

const SOURCE_CHIPS: Record<SourceType, string> = {
  editorial: "Review site",
  retailer: "Retailer",
  ugc: "Forum or video",
  brand: "Brand site",
  marketplace: "Marketplace",
  other: "Other",
};

/** Geist + Inter, like the home page. The routes add check.css after these. */
export const CHECK_FONT_LINKS = [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
  { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" },
];

export const CHECK_STEPS = [
  "Reading your product",
  "Writing buyer questions",
  "Asking ChatGPT, Gemini and Perplexity",
  "Writing your report",
];

/** Which of CHECK_STEPS is happening now (4 = all done). */
export function stepIndex(view: Pick<CheckView, "status" | "product" | "questions">): number {
  if (view.status === "done") return CHECK_STEPS.length;
  if (view.status === "writing") return 3;
  if (view.status === "asking" || view.questions.length) return 2;
  return view.product ? 1 : 0;
}

export type Segment = { text: string; kind: "you" | "brand" | null };

/** Split an answer into plain text and brand names, so React can highlight them without raw HTML. */
export function highlightSegments(text: string, names: string[], youNames: string[]): Segment[] {
  const clean = [...new Set(names.map((n) => n.trim()).filter((n) => n.length >= 3))].sort((a, b) => b.length - a.length);
  if (!clean.length || !text) return text ? [{ text, kind: null }] : [];
  const re = new RegExp(clean.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");
  const word = /[a-z0-9]/i;
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    // whole words only ("Bold" should not light up inside "Boldly")
    if (word.test(text[start - 1] ?? "") || word.test(text[end] ?? "")) continue;
    if (start > last) out.push({ text: text.slice(last, start), kind: null });
    out.push({ text: m[0], kind: youNames.some((y) => sameBrand(y, m[0]) || y.toLowerCase() === m[0].toLowerCase()) ? "you" : "brand" });
    last = end;
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: null });
  return out;
}

/** Only ever link to web pages (links come from shop pages and AI answers). */
const safeHref = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) ? url : undefined);

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

function formatPrice(price: string | null, currency: string | null): string | null {
  if (!price) return null;
  const n = Number(price);
  if (!currency || !Number.isFinite(n)) return currency ? `${price} ${currency}` : price;
  try {
    const amount = new Intl.NumberFormat("en-AU", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(n);
    return `${amount} ${currency}`;
  } catch {
    return `${price} ${currency}`;
  }
}

const LinkIcon = () => (
  <svg className="ck-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const Tick = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

// ---------- page frame ----------

export function CheckShell({ children }: { children: ReactNode }) {
  return (
    <div className="ck">
      <div className="ck-grid" aria-hidden="true" />
      <header className="ck-top">
        <a className="ck-logo" href="/" aria-label="GEO home">
          <span className="ck-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className="ck-word">GEO</span>
        </a>
        <span className="ck-pill">Free product check</span>
      </header>
      <main className="ck-main">{children}</main>
      <footer className="ck-foot">
        GEO · Get recommended by ChatGPT &amp; co · <a href="/privacy">Privacy</a>
      </footer>
    </div>
  );
}

// ---------- the form (same fields as the home page hero form) ----------

const LONG_HINT = "Paste a product link, e.g. yourstore.com/products/...";

export function CheckForm({ url = "", country = "AU", error = null }: { url?: string; country?: string; error?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(LONG_HINT);
  // Coming back with the browser's back button: make the button usable again.
  useEffect(() => {
    const reset = () => setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  // A shorter placeholder on phones so it isn't cut off (same as the home page form).
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 480px)");
    const fit = () => setHint(narrow.matches ? "Paste your product link" : LONG_HINT);
    fit();
    narrow.addEventListener("change", fit);
    return () => narrow.removeEventListener("change", fit);
  }, []);

  return (
    <form className="ck-form" method="post" action="/check" onSubmit={() => setBusy(true)}>
      <div className="ck-form-box">
        <label className="ck-form-field">
          <LinkIcon />
          <span className="ck-sr">Product link</span>
          <input
            type="text"
            name="url"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={2000}
            required
            defaultValue={url}
            placeholder={hint}
          />
        </label>
        <div className="ck-form-row">
          <label className="ck-form-country">
            <span className="ck-sr">Shopper country</span>
            <select name="country" defaultValue={country in CHECK_COUNTRIES ? country : "AU"}>
              {COUNTRY_OPTIONS.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </label>
          <button className="ck-btn ck-btn-dark" type="submit" disabled={busy}>
            {busy ? "Starting your check…" : "Check my product"}
          </button>
        </div>
      </div>
      {/* Spam trap: people never see or fill this. */}
      <div className="ck-sr" aria-hidden="true">
        <label>
          Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error ? (
        <p className="ck-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="ck-form-hint">Free. No sign-up. We ask ChatGPT, Gemini and Perplexity questions shoppers typically ask about products like yours.</p>
    </form>
  );
}

// ---------- product card ----------

export function ProductCard({ product, country }: { product: CheckProduct | null; country: CheckCountry }) {
  const line = `Checked as a shopper in ${CHECK_COUNTRIES[country]} on ChatGPT, Gemini and Perplexity · 3 questions, each asked twice`;
  if (!product) {
    return (
      <section className="ck-card ck-product">
        <div className="ck-product-img ck-skel" aria-hidden="true" />
        <div className="ck-product-body">
          <h1 className="ck-product-title">Reading your product…</h1>
          <p className="ck-product-line">{line}</p>
        </div>
      </section>
    );
  }
  const price = formatPrice(product.price, product.currency);
  const image = safeHref(product.image);
  return (
    <section className="ck-card ck-product">
      {image ? (
        <img className="ck-product-img" src={image} alt="" referrerPolicy="no-referrer" />
      ) : (
        <div className="ck-product-img ck-product-ph" aria-hidden="true">
          {(product.brand || product.title).slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="ck-product-body">
        <p className="ck-eyebrow">{product.brand}</p>
        <h1 className="ck-product-title">{product.title}</h1>
        <p className="ck-product-meta">
          {price ? <span className="ck-product-price">{price}</span> : null}
          <a href={safeHref(product.url)} target="_blank" rel="noopener noreferrer nofollow">
            {product.domain}
          </a>
        </p>
        <p className="ck-product-line">{line}</p>
      </div>
    </section>
  );
}

// ---------- running ----------

export function CheckRunning({ view }: { view: CheckView }) {
  const current = stepIndex(view);
  const share = view.total ? Math.min(1, view.done / view.total) : 0;
  return (
    <section className="ck-card ck-run">
      <h2 className="ck-h2">Checking your product</h2>
      <p className="ck-muted" aria-live="polite">
        {view.step}
      </p>
      <ol className="ck-steps">
        {CHECK_STEPS.map((s, i) => (
          <li key={s} className={i < current ? "is-done" : i === current ? "is-now" : undefined}>
            <span className="ck-step-dot">{i < current ? <Tick /> : i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div
        className="ck-bar"
        role="progressbar"
        aria-label="AI answers in"
        aria-valuemin={0}
        aria-valuemax={view.total}
        aria-valuenow={view.done}
      >
        <i style={{ width: `${Math.max(2, share * 100)}%` }} />
      </div>
      <p className="ck-bar-tx">
        <b>{view.done}</b> of {view.total} answers in
      </p>
      {view.questions.length ? (
        <div className="ck-run-qs">
          <h3 className="ck-h3">The questions we&apos;re asking</h3>
          <ol>
            {view.questions.map((q, i) => (
              <li key={i}>{q.text}</li>
            ))}
          </ol>
        </div>
      ) : null}
      <p className="ck-note">
        This takes a few minutes. You can leave this page and come back to this link.{" "}
        <a href={`/check/${view.id}`}>Refresh</a>
      </p>
    </section>
  );
}

// ---------- failed ----------

export function CheckFailed({ view, url = null }: { view: CheckView; url?: string | null }) {
  const link = view.product?.url ?? url ?? "";
  return (
    <section className="ck-card ck-msg">
      <h2 className="ck-h2">We couldn&apos;t finish this check</h2>
      <p>{view.error || "Something went wrong on our side. Please try again."}</p>
      {link ? (
        <p className="ck-small ck-fail-url">
          The link we checked: <b>{link}</b>
        </p>
      ) : null}
      <CheckForm url={link} country={view.country} />
    </section>
  );
}

// ---------- the report ----------

const TONES: Record<string, string> = { Invisible: "red", Weak: "amber", Growing: "blue", Strong: "green" };

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = TONES[label] ?? "blue";
  return (
    <div className={`ck-ring is-${tone}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--lav-2)" strokeWidth="11" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={`${(c * Math.max(0, Math.min(100, score))) / 100} ${c}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <span className="ck-ring-v">
        <b>{score}</b>
        <span>/100</span>
      </span>
    </div>
  );
}

function engineAnswers(answers: CheckAnswer[], question: number, engine: CheckEngine) {
  const got = answers
    .filter((a) => a.question === question && a.engine === engine && a.ok && !a.empty)
    .sort((a, b) => a.run - b.run);
  return { got, named: got.filter((a) => a.named).length };
}

function Snippet({ answer, brand }: { answer: CheckAnswer; brand: string }) {
  const segments = highlightSegments(answer.snippet, [...answer.brands, brand], [brand]);
  return (
    <div className="ck-snip">
      <div className="ck-snip-head">
        <span>
          {ENGINE_LABELS[answer.engine]} · answer {answer.run}
        </span>
        {answer.named ? (
          <span className="ck-chip is-green">Names you{answer.position ? ` · #${answer.position}` : ""}</span>
        ) : (
          <span className="ck-chip is-grey">Doesn&apos;t name you</span>
        )}
      </div>
      <p className="ck-snip-text">
        {segments.map((s, i) =>
          s.kind ? (
            <mark key={i} className={s.kind === "you" ? "ck-hl-you" : "ck-hl"}>
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </p>
      {answer.brands.length ? <p className="ck-snip-brands">Brands named: {answer.brands.join(", ")}</p> : null}
    </div>
  );
}

export function CheckReport({ view }: { view: CheckView }) {
  const report = view.report;
  if (!report) return <CheckFailed view={{ ...view, error: view.error ?? "We couldn't write this report. Please try again." }} />;
  const brand = view.product?.brand || "your product";
  const youShare = report.answerCount ? report.namedCount / report.answerCount : 0;
  const topShare = Math.max(youShare, ...report.competitors.map((c) => c.share), 0.01);

  return (
    <>
      <section className="ck-card ck-score">
        {report.answerCount ? (
          <>
            <div className="ck-score-main">
              <ScoreRing score={report.score} label={report.label} />
              <div>
                <span className={`ck-chip is-${TONES[report.label] ?? "blue"}`}>{report.label}</span>
                <h2 className="ck-h2 ck-score-h">
                  AI named {brand} in {report.namedCount} of {report.answerCount} answers
                </h2>
                <p className="ck-muted">{report.summary}</p>
              </div>
            </div>
            <ul className="ck-engines">
              {CHECK_ENGINES.map((e) => {
                const s = report.byEngine[e];
                return (
                  <li key={e} className="ck-engine">
                    <span className="ck-engine-n">
                      <i className={`ck-dot is-${e}`} />
                      {ENGINE_LABELS[e]}
                    </span>
                    <span className="ck-track">
                      <i className={`is-${e}`} style={{ width: `${s.total ? Math.max(3, s.score) : 0}%` }} />
                    </span>
                    <span className="ck-engine-v">{s.total ? `Named in ${s.named} of ${s.total}` : "Didn't answer"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="ck-small">
              The score is out of 100: full points when AI names you in its top 3, two-thirds lower down, one-third when it
              only links to your website.
            </p>
          </>
        ) : (
          <div>
            <h2 className="ck-h2">The AI assistants didn&apos;t answer this time</h2>
            <p className="ck-muted">This happens now and then. Please run the check again in a few minutes.</p>
          </div>
        )}
      </section>

      <div className="ck-two">
        <section className="ck-card">
          <h2 className="ck-h3">Who AI recommends instead</h2>
          <p className="ck-small">Share of answers that named each brand.</p>
          <ol className="ck-rank">
            <li className="is-you">
              <span className="ck-rank-n">You</span>
              <span className="ck-rank-name">{brand}</span>
              <span className="ck-rank-bar">
                <i style={{ width: `${(youShare / topShare) * 100}%` }} />
              </span>
              <span className="ck-rank-v">{pct(youShare)}</span>
            </li>
            {report.competitors.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <span className="ck-rank-n">{i + 1}</span>
                <span className="ck-rank-name">{c.name}</span>
                <span className="ck-rank-bar">
                  <i style={{ width: `${(c.share / topShare) * 100}%` }} />
                </span>
                <span className="ck-rank-v">{pct(c.share)}</span>
              </li>
            ))}
          </ol>
          {report.competitors.length ? null : <p className="ck-small">AI didn&apos;t name any other brands for these questions.</p>}
        </section>

        <section className="ck-card">
          <h2 className="ck-h3">Sites AI trusts for this</h2>
          <p className="ck-small">Websites the AI linked to for these questions. Being on these sites can help you get recommended.</p>
          {report.sources.length ? (
            <ul className="ck-sources">
              {report.sources.map((s) => (
                <li key={s.domain}>
                  <a className="ck-source-d" href={safeHref(s.exampleUrl)} target="_blank" rel="noopener noreferrer nofollow">
                    {s.domain}
                  </a>
                  <span className="ck-chip is-lav">
                    {s.type === "brand" && !s.isOwn ? "Competitor site" : (SOURCE_CHIPS[s.type] ?? "Other")}
                  </span>
                  {s.isOwn ? <span className="ck-chip is-green">You&apos;re on it</span> : null}
                  <span className="ck-source-n">
                    {s.count} {s.count === 1 ? "answer" : "answers"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ck-small">The AI answers didn&apos;t link to any websites.</p>
          )}
        </section>
      </div>

      <section className="ck-card">
        <h2 className="ck-h3">What we asked</h2>
        <p className="ck-small">
          Questions shoppers typically ask, each asked {CHECK_RUNS} times on every AI. Open one to read the answers.
        </p>
        <div className="ck-qs">
          {view.questions.map((q, qi) => (
            <article key={qi} className="ck-q">
              <h3 className="ck-q-t">&ldquo;{q.text}&rdquo;</h3>
              <ul className="ck-q-cells">
                {CHECK_ENGINES.map((e) => {
                  const { got, named } = engineAnswers(view.answers, qi, e);
                  return (
                    <li key={e} className={!got.length ? "is-off" : named ? "is-yes" : "is-no"}>
                      <span className="ck-q-e">
                        <i className={`ck-dot is-${e}`} />
                        {ENGINE_LABELS[e]}
                      </span>
                      <span className="ck-q-v">{got.length ? `Named in ${named} of ${got.length}` : "No answer"}</span>
                    </li>
                  );
                })}
              </ul>
              <details className="ck-q-more">
                <summary>See what the AI said</summary>
                <div className="ck-snips">
                  {CHECK_ENGINES.flatMap((e) => engineAnswers(view.answers, qi, e).got).map((a) => (
                    <Snippet key={`${a.engine}-${a.run}`} answer={a} brand={brand} />
                  ))}
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      {report.tips.length ? (
        <section className="ck-card ck-card-lav">
          <h2 className="ck-h3">Quick wins</h2>
          <ol className="ck-tips">
            {report.tips.map((t, i) => (
              <li key={i}>
                <span className="ck-tip-n">{i + 1}</span>
                <div>
                  <h3 className="ck-tip-t">{t.title}</h3>
                  <p>{t.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="ck-cta">
        <h2 className="ck-cta-h">Track this every week and fix it in one click</h2>
        <p>
          GEO checks up to {PLANS.core.questions} questions every week, writes the fixes for your product pages, and shows
          the sales AI sends you. Weekly tracking and one-click fixes are on Core, US${PLANS.core.priceUsd}/mo after the
          trial.
        </p>
        <div className="ck-cta-row">
          <a className="ck-btn ck-btn-light" href={view.installUrl}>
            Start your {PLANS.core.trialDays}-day free trial
          </a>
          <a className="ck-cta-link" href="/#check">
            Check another product
          </a>
        </div>
      </section>

      <p className="ck-honest">
        Answers change from run to run, so we ask twice. This quick check uses 3 questions; Core tracks{" "}
        {PLANS.core.questions} every week.
      </p>
    </>
  );
}
