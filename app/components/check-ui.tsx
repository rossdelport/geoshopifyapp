// Free product check pages (/check and /check/:id): the public, no-install report.
// Plain presentational components; the routes load the data. Styles: app/styles/check.css (ck-*).

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  type AiReady,
  CHECK_COUNTRIES,
  CHECK_ENGINES,
  CHECK_RUNS,
  type CheckAnswer,
  type CheckCountry,
  type CheckEngine,
  type CheckPlanTeaser,
  type CountryHow,
  type CheckProduct,
  type CheckView,
} from "../lib/check-types";
import { ENGINE_LABELS, PLANS } from "../lib/plans";
import { AI_READY_NOTE } from "../lib/ai-ready";
import type { SourceType } from "../lib/sources";
import { sameBrand } from "../lib/match";
import { LeadProvider, LockIcon, MailIcon, planLine, useLead, type LeadView } from "./check-lead";

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

export function formatPrice(price: string | null, currency: string | null): string | null {
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

/** Header button on check pages: opens the email popup for the action plan (the plan is email-only). */
function HeaderAsk() {
  const { lead, open } = useLead();
  const sent = lead.status !== "none";
  return (
    <button type="button" className="ck-pill ck-pill-btn" onClick={() => open("ask")}>
      {sent ? "Action plan on its way" : "Get actionable steps"}
    </button>
  );
}


/**
 * The page, the same while a check runs and when it is done: a lilac gradient band (like the home page
 * hero) with a slim header in normal flow at its top, then `hero` (the intro, or the product card).
 * `children` follow on white in a container of the same width. Only what is inside changes.
 * With `lead` (running and done check pages), the email popup and its triggers are on (check-lead.tsx).
 * The polite live region (`announce`) sits here, outside the running view, so "Your report is ready"
 * is still heard when the live view is swapped for the report.
 */
export function CheckShell({
  hero,
  children,
  lead,
  announce,
}: {
  hero?: ReactNode;
  children?: ReactNode;
  lead?: LeadView | null;
  /** Read out politely when it changes: the step while a check runs, then "Your report is ready". */
  announce?: string;
}) {
  const page = (
    <>
      <main className="ck-page">
        <div className="ck-band">
          <div className="ck-band-grid" aria-hidden="true" />
          <header className="ck-top">
            <a className="ck-logo" href="/" aria-label="GEO home">
              <span className="ck-mark" aria-hidden="true">
                <i />
                <i />
              </span>
              <span className="ck-word">GEO</span>
            </a>
            {lead ? <HeaderAsk /> : <span className="ck-pill">Free product check</span>}
          </header>
          <div className="ck-band-in">{hero}</div>
        </div>
        {children ? <div className="ck-main">{children}</div> : null}
        {announce !== undefined ? (
          <p className="ck-sr" aria-live="polite">
            {announce}
          </p>
        ) : null}
      </main>
      <footer className="ck-foot">
        GEO · Helps ChatGPT &amp; co recommend your products · <a href="/privacy">Privacy</a>
      </footer>
    </>
  );
  return <div className="ck">{lead ? <LeadProvider view={lead}>{page}</LeadProvider> : page}</div>;
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
            <span className="ck-glow-halo">
              <span className="ck-glow-run">
                <i />
              </span>
            </span>
            <span className="ck-glow-ring">
              <span className="ck-glow-run">
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
  ["What to fix first", "Plain-English steps to help AI recommend you, based only on its answers and your page. Emailed to you free."],
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

/** One piece of the "Checked on..." line; `wide` pieces are left out on phones (check.css, .ck-wide). */
export type LinePart = { text: string; wide?: boolean };

/**
 * "Checked on ChatGPT, Gemini and Perplexity as a shopper in Australia (where your store is) · ...", or
 * "Checking on..." while the check runs (then "as a shopper where your store is" until we know the country,
 * so the line is about as long in every state and the card doesn't change height). On phones the notes in
 * brackets and "each" are left out, so it fits in about 3 lines.
 */
export function checkedParts(country: CheckCountry | null, how?: CountryHow, running = false): LinePart[] {
  const tail: LinePart[] = [{ text: " · 3 questions, " }, { text: "each ", wide: true }, { text: "asked twice" }];
  if (country && how === "unsupported") {
    return [
      { text: `Your store is in a country we don’t check yet, so we ${running ? "are asking" : "asked"} ChatGPT, Gemini and Perplexity as a shopper in ${CHECK_COUNTRIES[country]}` },
      ...tail,
    ];
  }
  const note = how && SURE_OF_STORE.includes(how) ? " (where your store is)" : how === "default" ? " (we couldn’t tell where your store is)" : "";
  const where = country ? ` as a shopper in ${CHECK_COUNTRIES[country]}` : running ? " as a shopper where your store is" : "";
  return [{ text: `${running ? "Checking" : "Checked"} on ChatGPT, Gemini and Perplexity${where}` }, ...(note ? [{ text: note, wide: true }] : []), ...tail];
}

/** The whole line as plain text (all pieces). */
export function checkedLine(country: CheckCountry | null, how?: CountryHow, running = false): string {
  return checkedParts(country, how, running)
    .map((p) => p.text)
    .join("");
}

function CheckedLine({ parts }: { parts: LinePart[] }) {
  return (
    <p className="ck-product-line">
      {parts.map((p, i) => (p.wide ? <span key={i} className="ck-wide">{p.text}</span> : <span key={i}>{p.text}</span>))}
    </p>
  );
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

/** "coolabahgrooming.com.au" from a pasted link (no www), or null when it isn't a web address. */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./i, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/**
 * The email button at the right of the product card, on running and finished checks alike, so the card
 * (and everything under it) sits at the same height in both. While the check runs: "Don't want to wait?
 * Email me the report". Once done: "Your action plan is ready. Email it to me". Once this browser
 * saved an email: where the report goes (masked).
 */
function LeadNudge() {
  const { lead, running, open } = useLead();
  if (lead.status !== "none") {
    const to = lead.maskedEmail ? <b>{lead.maskedEmail}</b> : "you";
    return (
      <div className="ck-product-aside">
        <p className="ck-nudge is-set" role="status">
          <span className="ck-nudge-tick">
            <Tick />
          </span>
          <span>
            {running ? (
              <>We’ll email your full report to {to} when it’s ready.</>
            ) : lead.status === "sent" ? (
              <>Your full report and action plan went to {to}.</>
            ) : (
              <>Your full report and action plan are on their way to {to}.</>
            )}
          </span>
        </p>
      </div>
    );
  }
  return (
    <div className="ck-product-aside">
      <button type="button" className="ck-nudge" onClick={() => open(running ? "ask" : "plan")}>
        <MailIcon className="ck-nudge-ic" />
        <span className="ck-nudge-tx">
          <small>{running ? "Don’t want to wait?" : "Your action plan is ready"}</small>
          {running ? "Email me the report" : "Email it to me"}
        </span>
      </button>
    </div>
  );
}

export function ProductCard({
  product,
  country,
  done = false,
  running = false,
  nudge = false,
  url = null,
}: {
  product: CheckProduct | null;
  country: CheckCountry | null;
  /** The report is ready: a guessed country can be corrected. */
  done?: boolean;
  /** The check is still running (the card says it is busy while we read the page). */
  running?: boolean;
  /** Show the email button at the right (running and finished checks; never a failed one). */
  nudge?: boolean;
  /** The pasted link, shown while we read the page. */
  url?: string | null;
}) {
  const line = <CheckedLine parts={checkedParts(country, product?.countryFrom, running)} />;
  if (!product) {
    const domain = domainOf(url);
    return (
      <section className="ck-card ck-product" aria-busy={running ? true : undefined}>
        <div className="ck-product-img ck-product-scan" aria-hidden="true">
          <span className="ck-scan-page">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="ck-scan-beam" />
        </div>
        <div className="ck-product-body">
          {domain ? (
            <p className="ck-domain">
              <LinkIcon />
              <span>{domain}</span>
            </p>
          ) : null}
          <h1 className="ck-product-title">
            Reading your product page
            <span className="ck-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </h1>
          <span className="ck-skel-lines" aria-hidden="true">
            <i />
          </span>
          {line}
        </div>
        {nudge ? <LeadNudge /> : null}
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
        {line}
        {done && country && product.countryFrom && UNSURE.includes(product.countryFrom) && safeHref(product.url) ? (
          <WrongCountry url={product.url} country={country} />
        ) : null}
      </div>
      {nudge ? <LeadNudge /> : null}
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

/**
 * A circular percentage ring: a lilac track and a coloured arc (tone by the score's label), the percentage
 * in the middle with a small caption under it. The arc sweeps from 0 and the number counts up (CSS only,
 * so it also works before the page's script loads). If the ring mounts out of view (the report replacing
 * the live view while the visitor is scrolled down), the sweep waits until it scrolls into view.
 * Reduced motion shows the value straight away.
 */
export function PercentRing({ value, tone, caption, label }: { value: number; tone: string; caption: string; label: string }) {
  const v = Math.round(Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)));
  const grad = `ck-score-grad-${useId().replace(/[^a-z0-9_-]/gi, "")}`;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const box = el.getBoundingClientRect();
    if (box.bottom > 0 && box.top < window.innerHeight) return; // in view: the sweep is already running
    el.classList.add("is-waiting");
    const watch = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.classList.remove("is-waiting");
        watch.disconnect();
      },
      { threshold: 0.6 },
    );
    watch.observe(el);
    return () => watch.disconnect();
  }, []);
  return (
    <div ref={ref} className={`ck-score-ring is-${tone}`} role="img" aria-label={label} style={{ "--ck-score": v } as CSSProperties}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" className="ck-score-a" />
            <stop offset="100%" className="ck-score-b" />
          </linearGradient>
        </defs>
        <circle className="ck-score-track" cx="60" cy="60" r="50" fill="none" strokeWidth="12" />
        {v > 0 ? (
          <circle
            className="ck-score-arc"
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={`url(#${grad})`}
            strokeWidth="12"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={100 - v}
            transform="rotate(-90 60 60)"
          />
        ) : null}
      </svg>
      <span className="ck-score-v" aria-hidden="true">
        <span className="ck-score-num">
          <b className="ck-score-n" data-n={v} />
          <span className="ck-score-pc">%</span>
        </span>
        <span className="ck-score-cap">{caption}</span>
      </span>
    </div>
  );
}

/** Bar widths for the blurred lines on the placeholder cards (never real content: the page doesn't have it). */
const GHOST_LINES = [
  ["72%", "94%", "58%"],
  ["64%", "88%", "70%"],
  ["80%", "90%", "46%"],
  ["56%", "84%", "66%"],
  ["68%", "92%", "52%"],
  ["60%", "86%", "74%"],
];

/**
 * One placeholder card per step of the emailed plan (3 to 6), in the plan's order (check-plan.ts: page
 * fixes first, the sites and rivals just before the last step). Only the counts the page already has
 * label a card ("3 fixes for your page"); everything else on it is a blurred bar.
 */
export function ghostCards(plan: CheckPlanTeaser | null): (string | null)[] {
  const n = Math.min(6, Math.max(3, plan?.steps ?? 4));
  const count = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const head = plan?.pageFixes ? [count(plan.pageFixes, "fix for your page", "fixes for your page")] : [];
  const tail = [
    plan?.sitesToPitch ? count(plan.sitesToPitch, "site to get featured on", "sites to get featured on") : null,
    plan?.rivalsToStudy ? count(plan.rivalsToStudy, "rival to study", "rivals to study") : null,
  ].filter((c): c is string => Boolean(c));
  const fill = Math.max(0, n - head.length - tail.length - 1);
  return [...head, ...Array<null>(fill).fill(null), ...tail, null].slice(0, n);
}

/** "What to fix first": the action plan is only sent by email, so the page shows it locked. */
function LockedPlan({ plan }: { plan: CheckPlanTeaser | null }) {
  const { lead, open } = useLead();
  const to = lead.maskedEmail ? <b>{lead.maskedEmail}</b> : "your inbox";
  const sent = lead.status !== "none";
  return (
    <section className={`ck-card ck-plan${sent ? " is-sent" : ""}`} aria-labelledby="ck-plan-h">
      <div className="ck-plan-ghosts" aria-hidden="true" onClick={() => open("plan")}>
        {ghostCards(plan).map((chip, i) => (
          <div key={i} className="ck-ghost">
            <span className="ck-tip-n">{i + 1}</span>
            <span className="ck-ghost-tx">
              {chip ? <span className="ck-ghost-chip">{chip}</span> : null}
              {GHOST_LINES[i % GHOST_LINES.length].slice(0, chip ? 2 : 3).map((w, j) => (
                <i key={j} className={j === 0 && !chip ? "is-t" : undefined} style={{ width: w }} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <div className="ck-plan-lock">
        <span className="ck-plan-badge">
          {sent ? (
            <>
              <MailIcon className="ck-plan-badge-ic" />
              <span className="ck-plan-badge-tick">
                <Tick />
              </span>
            </>
          ) : (
            <LockIcon className="ck-plan-badge-ic" />
          )}
        </span>
        <p className="ck-eyebrow">What to fix first</p>
        <h2 id="ck-plan-h" className="ck-h2 ck-plan-h">
          {sent ? (lead.status === "sent" ? "Your action plan is in your inbox" : "Your action plan is on its way") : "Your action plan is ready"}
        </h2>
        <p className="ck-plan-line">{planLine(plan)}</p>
        {!sent ? (
          <>
            <button type="button" className="ck-btn ck-btn-dark ck-plan-btn" onClick={() => open("plan")}>
              <MailIcon className="ck-plan-btn-ic" />
              Email me my action plan
            </button>
            <p className="ck-plan-small">Free. It comes as a PDF with your full report.</p>
          </>
        ) : (
          <>
            <p className="ck-plan-sent" role="status">
              <span className="ck-nudge-tick">
                <Tick />
              </span>
              <span>
                {lead.status === "sent" ? (
                  <>Sent to {to}. Check your inbox (and the promotions tab).</>
                ) : (
                  <>On its way to {to}. Check your inbox in a minute (and the promotions tab).</>
                )}
              </span>
            </p>
            <button type="button" className="ck-plan-again" onClick={() => open("plan")}>
              Send it to a different email
            </button>
          </>
        )}
      </div>
    </section>
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

/** "Is your page easy for AI to quote?": ticks and crosses from what we read on the page (ai-ready.ts). */
export function AiReadyCard({ ready }: { ready: AiReady }) {
  const { open } = useLead();
  const passed = ready.checks.filter((c) => c.pass).length;
  const tone = ready.score >= 80 ? "green" : ready.score >= 50 ? "amber" : "red";
  return (
    <section className="ck-card ck-ready" aria-labelledby="ck-ready-h">
      <div className="ck-ready-head">
        <div>
          <h2 id="ck-ready-h" className="ck-h3">
            Is your page easy for AI to quote?
          </h2>
          <p className="ck-small">
            {passed} of {ready.checks.length} checks passed, from what we read on your product page.
          </p>
        </div>
        <span className={`ck-ready-score is-${tone}`}>
          <b>{ready.score}</b>/100
        </span>
      </div>
      <ul className="ck-ready-list">
        {ready.checks.map((c) => (
          <li key={c.id} className={c.pass ? "is-pass" : "is-fail"}>
            <span className="ck-ready-ic" aria-hidden="true">
              {c.pass ? "\u2713" : "\u2715"}
            </span>
            <div>
              <h3 className="ck-ready-t">
                <span className="ck-sr">{c.pass ? "Passed: " : "Needs work: "}</span>
                {c.label}
              </h3>
              <p>{c.reason}</p>
              {c.pass ? null : (
                // The fix itself is only in the emailed action plan (the page never gets it).
                <button type="button" className="ck-ready-lock" onClick={() => open("fix")}>
                  <LockIcon className="ck-ready-lock-ic" />
                  <span>
                    <b>How to fix:</b> in your emailed action plan
                  </span>
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="ck-small ck-ready-note">{AI_READY_NOTE}</p>
    </section>
  );
}

export function CheckReport({ view }: { view: CheckView }) {
  const report = view.report;
  if (!report) return <CheckFailed view={{ ...view, error: view.error ?? "We couldn’t write this report. Please try again." }} />;
  const brand = view.product?.brand || "your product";
  const youShare = report.answerCount ? report.namedCount / report.answerCount : 0;
  // The ring and "Who AI recommends instead" show the same number: the share of answers that named you.
  const youPct = Math.round(youShare * 100);
  const topShare = Math.max(youShare, ...report.competitors.map((c) => c.share), 0.01);

  return (
    <>
      <section className="ck-card ck-score">
        {report.answerCount ? (
          <>
            <div className="ck-score-main">
              <PercentRing
                value={youPct}
                tone={TONES[report.label] ?? "blue"}
                caption="of answers"
                label={`AI named ${brand} in ${youPct}% of answers (${report.namedCount} of ${report.answerCount})`}
              />
              <div className="ck-score-head">
                <span className={`ck-chip is-${TONES[report.label] ?? "blue"}`}>
                  {report.label} · score {report.score}/100
                </span>
                <h2 className="ck-h2 ck-score-h" id="ck-score-h" tabIndex={-1}>
                  AI named {brand.length <= 28 ? <span className="ck-nowrap">{brand}</span> : brand} in {report.namedCount} of{" "}
                  {report.answerCount} answers
                </h2>
              </div>
              <p className="ck-muted ck-score-sum">{report.summary}</p>
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
              <b>What this means:</b> the ring is the share of answers that named you. Your AI visibility score (
              {report.score} out of 100) also counts where you were named: full points when AI names you in its top 3,
              two-thirds lower down, one-third when it only links to your website, averaged across each AI assistant.
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

      <LockedPlan plan={view.plan} />

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

      {report.aiReady ? <AiReadyCard ready={report.aiReady} /> : null}

      <section className="ck-cta">
        <div className="ck-cta-tx">
          <h2 className="ck-cta-h">Help AI recommend you, every week</h2>
          <p>
            GEO {PLANS.core.name} checks up to {PLANS.core.questions} buyer questions every week, writes fixes that help AI
            recommend your products (you approve each one), and counts the orders it can trace back to AI.
          </p>
          <p className="ck-cta-price">
            Your first scan is free. {PLANS.core.name} is US${PLANS.core.priceUsd} a month after a{" "}
            {PLANS.core.trialDays}-day free trial.
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
        {PLANS.core.questions} every week on {PLANS.core.name}, or {PLANS.pro.questions} every day on {PLANS.pro.name} (asked
        twice on the weekly full scan).
      </p>
    </>
  );
}
