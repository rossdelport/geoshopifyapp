// Free product check pages (/check and /check/:id): the public, no-install report.
// Plain presentational components; the routes load the data. Styles: app/styles/check.css (ck-*).

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CHECK_COUNTRIES,
  CHECK_ENGINES,
  CHECK_RUNS,
  type CheckAnswer,
  type CheckCountry,
  type CheckEngine,
  type CountryHow,
  type CheckProduct,
  type CheckView,
} from "../lib/check-types";
import { ENGINE_LABELS, PLANS } from "../lib/plans";
import type { SourceType } from "../lib/sources";
import { sameBrand } from "../lib/match";

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
  // A name ending in a full stop ("Ridgeback Beard Co.") also matches without it ("Ridgeback Beard Co: ...").
  const esc = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(clean.map((n) => (n.endsWith(".") ? `${esc(n.slice(0, -1))}\\.?` : esc(n))).join("|"), "gi");
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

// Clay illustrations, served from /home/img/ (design/overview/assemble.mjs copies them to public/home/img).
/** The "checking" state. */
export const CHECK_RUNNING_IMAGE = "/home/img/clay-magnifier.jpg";
/** Floating decorations on the /check band (white backgrounds, multiplied away over the lilac). */
const CHECK_DECOS = ["/home/img/clay-bubble.png", "/home/img/clay-bag.png"];
/** The clay shop front on the closing card, as on the home page. */
const CHECK_CTA_IMAGE = "/home/img/clay-storefront.jpg";

const Tick = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

// ---------- page frame ----------

/**
 * The page: floating header over a lilac gradient band (like the home page hero). `hero` sits in the
 * band (the intro, or the product card); `children` follow on white.
 */
export function CheckShell({ hero, children }: { hero?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ck">
      <header className="ck-top-wrap">
        <div className="ck-top">
          <a className="ck-logo" href="/" aria-label="GEO home">
            <span className="ck-mark" aria-hidden="true">
              <i />
              <i />
            </span>
            <span className="ck-word">GEO</span>
          </a>
          <span className="ck-pill">Free product check</span>
        </div>
      </header>
      <main>
        <div className="ck-band">
          <div className="ck-band-grid" aria-hidden="true" />
          <div className="ck-band-in">{hero}</div>
        </div>
        {children ? <div className="ck-main">{children}</div> : null}
      </main>
      <footer className="ck-foot">
        GEO · Helps ChatGPT &amp; co recommend your products · <a href="/privacy">Privacy</a>
      </footer>
    </div>
  );
}

// ---------- the form (same fields as the home page hero form) ----------

const LONG_HINT = "Paste a product link, e.g. yourstore.com/products/...";
const SHORT_HINT = "Paste your product link";

/**
 * The product link box and button. No country to pick: the check works out where the store is.
 * A soft light travels round the box (check.css, .ck-form-glow); it pauses while off screen.
 */
export function CheckForm({ url = "", error = null }: { url?: string; error?: string | null }) {
  const [busy, setBusy] = useState(false);
  // The page ships the short placeholder (it fits phones, also without JS); wider screens get the example.
  const [hint, setHint] = useState(SHORT_HINT);
  const glow = useRef<HTMLDivElement>(null);
  // Coming back with the browser's back button: make the button usable again.
  useEffect(() => {
    const reset = () => setBusy(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  // The short placeholder up to 760px wide so it is never cut off (same as the home page form).
  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 760px)");
    const fit = () => setHint(narrow.matches ? SHORT_HINT : LONG_HINT);
    fit();
    narrow.addEventListener("change", fit);
    return () => narrow.removeEventListener("change", fit);
  }, []);
  // The travelling light runs only when motion is allowed, and pauses while the box is off screen.
  useEffect(() => {
    const el = glow.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.classList.add("is-live");
    if (typeof IntersectionObserver === "undefined") return;
    const watch = new IntersectionObserver(([entry]) => el.classList.toggle("is-paused", !entry.isIntersecting));
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  return (
    <form className="ck-form" method="post" action="/check" onSubmit={() => setBusy(true)}>
      <div className="ck-form-glow" ref={glow}>
        <div className="ck-form-box">
          <span className="ck-glow" aria-hidden="true">
            <span className="ck-halo">
              <span className="ck-run">
                <i />
              </span>
            </span>
            <span className="ck-ring">
              <span className="ck-run">
                <i />
              </span>
            </span>
          </span>
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
          <button className="ck-btn ck-btn-dark ck-form-btn" type="submit" disabled={busy}>
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
      <p className="ck-form-hint">
        Free. No sign-up. We ask ChatGPT, Gemini and Perplexity 3 questions, twice each, as a shopper where your store is.
      </p>
    </form>
  );
}

// ---------- the /check start page ----------

/** Headline, lead and the form, shown in the lilac band. */
export function CheckIntro({ url, error }: { url?: string; error?: string | null }) {
  return (
    <section className="ck-intro">
      <img className="ck-deco ck-deco-a" src={CHECK_DECOS[0]} alt="" aria-hidden="true" width={180} height={180} loading="lazy" />
      <img className="ck-deco ck-deco-b" src={CHECK_DECOS[1]} alt="" aria-hidden="true" width={170} height={170} loading="lazy" />
      <h1 className="ck-h1">Does AI recommend your product?</h1>
      <p className="ck-lead">
        Shoppers ask ChatGPT, Gemini and Perplexity what to buy. Paste a product link to see if they recommend
        yours, and who they pick instead.
      </p>
      <CheckForm url={url} error={error} />
    </section>
  );
}

const PERK_ICONS: ReactNode[] = [
  // a score dial
  <svg key="score" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 16.5a8 8 0 1 1 15 0" />
    <path d="m12 13 3.5-4" />
    <circle cx="12" cy="13.5" r="1.2" />
  </svg>,
  // a ranked list
  <svg key="rank" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6h11M9 12h8M9 18h5" />
    <path d="M4 5.5 5 5v3M4 11.5c.4-.5 1.6-.6 1.8.2.2.7-1.8 1.8-1.8 2.3h2M4 17h1.6c.6 0 .6 1.2 0 1.2H4.8c.8 0 .9 1.3 0 1.3H4" />
  </svg>,
  // a checklist
  <svg key="fix" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="3.5" width="16" height="17" rx="3" />
    <path d="m8 9 1.5 1.5L12.5 7.5M8 15l1.5 1.5 3-3M15 9.5h1.5M15 15.5h1.5" />
  </svg>,
];

const PERKS: [string, string][] = [
  ["Are you recommended?", "A score out of 100, and how often each AI names your brand."],
  ["Who wins instead", "The brands AI picks for your buyers, and the websites it quotes."],
  ["What to fix first", "Plain-English steps to help AI recommend you, based only on its answers and your page."],
];

/** What the report shows, and why we ask twice. Under the band on /check. */
export function CheckPerks() {
  return (
    <>
      <ul className="ck-perks">
        {PERKS.map(([title, body], i) => (
          <li key={title} className="ck-card ck-perk">
            <span className="ck-perk-ic">{PERK_ICONS[i]}</span>
            <h2 className="ck-h3">{title}</h2>
            <p>{body}</p>
          </li>
        ))}
      </ul>
      <p className="ck-explain">
        <b>Why we ask twice:</b> AI answers change from one run to the next. Two runs give a fairer picture than one
        lucky, or unlucky, answer.
      </p>
    </>
  );
}

// ---------- product card ----------

/** Store settings and a country web address tell us where the store is; weaker signals only suggest it. */
const SURE_OF_STORE: CountryHow[] = ["store", "domain"];
/** Guesses the visitor may want to correct ("Wrong country?" on the report). */
const UNSURE: CountryHow[] = ["default", "unsupported", "language", "currency"];
const COUNTRY_BUTTONS: Record<CheckCountry, string> = { AU: "Australia", NZ: "New Zealand", US: "US", GB: "UK", CA: "Canada" };

/** "Checked on ChatGPT, Gemini and Perplexity as a shopper in Australia (where your store is) · ..." (no country until we know it). */
export function checkedLine(country: CheckCountry | null, how?: CountryHow): string {
  const tail = " · 3 questions, each asked twice";
  if (country && how === "unsupported") {
    return `Your store is in a country we don’t check yet, so we asked ChatGPT, Gemini and Perplexity as a shopper in ${CHECK_COUNTRIES[country]}${tail}`;
  }
  const note = how && SURE_OF_STORE.includes(how) ? " (where your store is)" : how === "default" ? " (we couldn’t tell where your store is)" : "";
  const where = country ? ` as a shopper in ${CHECK_COUNTRIES[country]}${note}` : "";
  return `Checked on ChatGPT, Gemini and Perplexity${where}${tail}`;
}

/** A guessed country can be corrected: the same link, asked again as a shopper in another country. */
function WrongCountry({ url, country }: { url: string; country: CheckCountry }) {
  return (
    <form className="ck-country" method="post" action="/check">
      <input type="hidden" name="url" value={url} />
      <span className="ck-country-q">Wrong country? Check again as a shopper in</span>
      <span className="ck-country-btns">
        {(Object.keys(COUNTRY_BUTTONS) as CheckCountry[])
          .filter((c) => c !== country)
          .map((c) => (
            <button key={c} className="ck-country-btn" type="submit" name="country" value={c}>
              {COUNTRY_BUTTONS[c]}
            </button>
          ))}
      </span>
    </form>
  );
}

export function ProductCard({
  product,
  country,
  done = false,
}: {
  product: CheckProduct | null;
  country: CheckCountry | null;
  /** The report is ready: a guessed country can be corrected. */
  done?: boolean;
}) {
  const line = checkedLine(country, product?.countryFrom);
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
        {done && country && product.countryFrom && UNSURE.includes(product.countryFrom) && safeHref(product.url) ? (
          <WrongCountry url={product.url} country={country} />
        ) : null}
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
      <div className="ck-run-head">
        <img className="ck-run-img" src={CHECK_RUNNING_IMAGE} alt="" width={200} height={200} />
        <div className="ck-run-body">
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
        </div>
      </div>
      <div className="ck-progress">
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
      </div>
      <div className="ck-run-boxes">
        {view.questions.length ? (
          <div className="ck-run-box">
            <h3 className="ck-h3">The questions we’re asking</h3>
            <ol className="ck-run-qs">
              {view.questions.map((q, i) => (
                <li key={i}>{q.text}</li>
              ))}
            </ol>
          </div>
        ) : null}
        <div className="ck-run-box is-soft">
          <h3 className="ck-h3">What’s happening now</h3>
          <p>
            Each AI assistant gets the same 3 questions, twice. For every answer we note which brands it names, in what
            order, and which websites it links to. Those links show where AI gets its opinions.
          </p>
        </div>
      </div>
      <div className="ck-note">
        <p>A check usually takes a few minutes. You can leave this page and come back to this link.</p>
        <a className="ck-btn ck-btn-light ck-btn-sm" href={`/check/${view.id}`}>
          Refresh
        </a>
      </div>
    </section>
  );
}

// ---------- failed ----------

export function CheckFailed({ view, url = null, asTitle = false }: { view: CheckView; url?: string | null; asTitle?: boolean }) {
  const link = view.product?.url ?? url ?? "";
  const Heading = asTitle ? "h1" : "h2";
  return (
    <section className="ck-card ck-msg">
      <Heading className="ck-h2">We couldn’t finish this check</Heading>
      <p>{view.error || "Something went wrong on our side. Please try again."}</p>
      {link ? (
        <p className="ck-small ck-fail-url">
          The link we checked: <b>{link}</b>
        </p>
      ) : null}
      <CheckForm url={link} />
    </section>
  );
}

// ---------- the report ----------

// Chip and ring colours for scoreLabel() labels. "Not named yet" is a plain fact, so it stays neutral.
const TONES: Record<string, string> = { "Not named yet": "grey", "Rarely named": "amber", Weak: "amber", Growing: "blue", Strong: "green" };

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const tone = TONES[label] ?? "blue";
  return (
    <div className={`ck-ring is-${tone}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--lilac-100)" strokeWidth="11" />
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
          <span className="ck-chip is-grey">Doesn’t name you</span>
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
  if (!report) return <CheckFailed view={{ ...view, error: view.error ?? "We couldn’t write this report. Please try again." }} />;
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
                    <span className="ck-engine-v">{s.total ? `Named in ${s.named} of ${s.total}` : "Didn’t answer"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="ck-small ck-score-note">
              <b>What this means:</b> full points when AI names you in its top 3, two-thirds when it names you lower
              down, one-third when it only links to your website, averaged across each AI assistant. 0 means no AI named
              or linked to you.
            </p>
          </>
        ) : (
          <div>
            <h2 className="ck-h2">The AI assistants didn’t answer this time</h2>
            <p className="ck-muted">This happens now and then. Please run the check again in a few minutes.</p>
          </div>
        )}
      </section>

      <div className="ck-two">
        <section className="ck-card">
          <h2 className="ck-h3">Who AI recommends instead</h2>
          <p className="ck-small">Share of answers that named each brand. These are the names your buyers hear first.</p>
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
          {report.competitors.length ? null : <p className="ck-small">AI didn’t name any other brands for these questions.</p>}
        </section>

        <section className="ck-card">
          <h2 className="ck-h3">Sites AI trusts for this</h2>
          <p className="ck-small">
            Websites the AI linked to in its answers. These are the sites it leaned on for these questions.
          </p>
          {report.sources.length ? (
            <ul className="ck-sources">
              {report.sources.map((s) => (
                <li key={s.domain}>
                  <a className="ck-source-d" href={safeHref(s.exampleUrl)} target="_blank" rel="noopener noreferrer nofollow">
                    {s.domain}
                  </a>
                  <span className="ck-source-tags">
                    <span className="ck-chip is-lav">{SOURCE_CHIPS[s.type] ?? "Other"}</span>
                    {s.isOwn ? <span className="ck-chip is-green">You’re on it</span> : null}
                  </span>
                  <span className="ck-source-n">
                    {s.count} {s.count === 1 ? "answer" : "answers"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ck-small">The AI answers didn’t link to any websites.</p>
          )}
        </section>
      </div>

      <section className="ck-card">
        <h2 className="ck-h3">What we asked</h2>
        <p className="ck-small">
          Questions a shopper might ask, each asked {CHECK_RUNS === 2 ? "twice" : `${CHECK_RUNS} times`} on every AI
          assistant. Open one to read the answers.
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
          <h2 className="ck-h3">What to fix first</h2>
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
        <div className="ck-cta-tx">
          <h2 className="ck-cta-h">Help AI recommend you, every week</h2>
          <p>
            GEO Core checks up to {PLANS.core.questions} buyer questions every week, writes fixes that help AI recommend
            your products (you approve each one), and counts the orders it can trace back to AI.
          </p>
          <p className="ck-cta-price">
            Your first scan is free. Core is US${PLANS.core.priceUsd} a month after a {PLANS.core.trialDays}-day free trial.
          </p>
          <div className="ck-cta-row">
            <a className="ck-btn ck-btn-dark" href={view.installUrl}>
              Install GEO: first scan free
            </a>
            <a className="ck-cta-link" href="/#check">
              Check another product
            </a>
          </div>
        </div>
        <div className="ck-cta-art" aria-hidden="true">
          <img src={CHECK_CTA_IMAGE} alt="" width={1200} height={896} loading="lazy" />
        </div>
      </section>

      <p className="ck-honest">
        Answers change from run to run, so we ask twice. This quick check uses 3 questions. The app tracks up to{" "}
        {PLANS.core.questions} every week on Core, or {PLANS.pro.questions} every day on Pro (asked twice on the weekly
        full scan).
      </p>
    </>
  );
}
