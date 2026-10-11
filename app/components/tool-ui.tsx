// Free tool pages (/tools and /tools/*): the shared frame and building blocks. Plain presentational
// components; each tool route loads its own data. Styles: app/styles/check.css (the ck-* frame, shared
// with the free check pages) and app/styles/tools.css (tl-*), both linked by routes/tools.tsx.
// Every page gets exactly one call-to-action button, always right under the result (docs/tools/spec.md 4.1).
// Everything renders on the server and works without JavaScript; JavaScript only adds live results,
// the copy buttons and focus moves.

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from "react";
import { useActionData, useFetcher } from "react-router";
import { HUB, TOOLS, toolBySlug, type ToolEntry, type ToolSlug } from "../lib/tools/registry";
import { HOME_CRUMB, type Faq } from "../lib/tools/seo";
import { formatUpdated } from "../lib/tools/format";
import { SiteFooter } from "./site-footer";

// ---------- page frame ----------

/** What the frame needs to know about the page: a tool, or the hub and the 404 page ({ name, path }). */
export type ShellPage = ToolEntry | { name: string; path: string };

export interface ToolCtaProps {
  /** The button's words, specific to the tool. */
  text: string;
  /** Where it goes: a home page section with the tool's ref, like "/?ref=tool-ai-crawler-checker#how". */
  href: string;
  /** The line beside the button. Default: what GEO is, in one sentence. */
  note?: string;
}

export const CTA_NOTE = "GEO is a Shopify app that helps your products get recommended by AI, then counts the orders AI sends you.";

const isTool = (p: ShellPage): p is ToolEntry => "slug" in p;

/** Home > Free tools > {tool}. On the hub, "Free tools" is the current page; on the 404 page it is a link. */
function Breadcrumb({ page }: { page: ShellPage }) {
  const onHub = page.path === HUB.path;
  return (
    <nav className="tl-crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <a href="/">{HOME_CRUMB}</a>
        </li>
        <li>
          {onHub ? (
            <span aria-current="page">{HUB.name}</span>
          ) : (
            <a href={HUB.path}>{HUB.name}</a>
          )}
        </li>
        {isTool(page) ? (
          <li>
            <span aria-current="page">{page.name}</span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

/** The one button under the result, on a lilac card (one of the few purple focal points). */
export function ToolCta({ text, href, note = CTA_NOTE }: ToolCtaProps) {
  return (
    <div className="tl-cta-card">
      <p className="tl-cta-note">{note}</p>
      <a className="ck-btn ck-btn-dark tl-cta" href={href}>
        {text}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      </a>
    </div>
  );
}

/**
 * The page: the lilac band (header, breadcrumb, `hero`), then on white the result (space kept so the page
 * doesn't jump), the one button, and `children` (what it checks, explainers, methodology, FAQ, more tools,
 * the updated line). A polite live region reads out `announce`. The site footer closes every page.
 * `cta` is required on every page except the 404 page.
 */
export function ToolShell({
  page,
  hero,
  result,
  cta,
  announce,
  resultLabel = "Result",
  children,
}: {
  page: ShellPage;
  hero: ReactNode;
  result?: ReactNode;
  /** The result area's name for screen readers. */
  resultLabel?: string;
  cta?: ToolCtaProps | null;
  /** Read out politely when it changes, like "Your result is ready". */
  announce?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ck tl">
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
            <a className="ck-pill tl-pill" href={HUB.path}>
              {HUB.name}
            </a>
          </header>
          <div className="ck-band-in">
            <Breadcrumb page={page} />
            {hero}
          </div>
        </div>
        <div className="ck-main">
          {result !== undefined ? (
            <section className="tl-result" id="result" aria-label={resultLabel}>
              {result}
            </section>
          ) : null}
          {cta ? <ToolCta {...cta} /> : null}
          {children}
        </div>
        <p className="ck-sr" aria-live="polite">
          {announce ?? ""}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

/** H1, the answer-first intro, the form (`children`), then "Free · No sign-up · {timing}". */
export function ToolHero({ h1, intro, timing, children }: { h1: string; intro: ReactNode; timing?: string; children?: ReactNode }) {
  return (
    <section className="tl-hero">
      <h1 className="ck-h1">{h1}</h1>
      <p className="ck-lead tl-intro">{intro}</p>
      {children}
      {timing ? <p className="tl-trust">{`Free · No sign-up · ${timing}`}</p> : null}
    </section>
  );
}

// ---------- result pieces ----------

/** The grey "Example" chip and its words, on every sample shown when the page loads. */
export function SampleLabel({ children }: { children?: ReactNode }) {
  return (
    <p className="tl-sample">
      <span className="ck-chip is-grey">Example</span>
      <span>{children}</span>
    </p>
  );
}

export type ChipTone = "good" | "warn" | "bad" | "info" | "neutral";

const CHIP_CLASS: Record<ChipTone, string> = {
  good: "is-green",
  warn: "is-amber",
  bad: "is-red",
  info: "tl-chip-info",
  neutral: "is-grey",
};

export function StatusChip({ tone, children }: { tone: ChipTone; children?: ReactNode }) {
  return <span className={`ck-chip ${CHIP_CLASS[tone]}`}>{children}</span>;
}

export function ToolError({ message }: { message: string }) {
  return (
    <p className="tl-error" role="alert">
      {message}
    </p>
  );
}

/**
 * The result's heading. useToolSubmit moves focus here when a new result arrives (tabIndex -1: it can
 * take focus from script, but isn't a tab stop).
 */
export function ResultHeading({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <h2 className={`ck-h2 tl-result-h ${className}`.trim()} tabIndex={-1} data-tl-focus="">
      {children}
    </h2>
  );
}

const noSubscribe = () => () => {};
/** False in the server's HTML and the first browser render, true once JavaScript has taken over the page. */
export const useHydrated = () =>
  useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

/**
 * Code to copy: scrolls inside its card (never the page) and has a real "Copy" button once JavaScript runs.
 * Without JavaScript the code is still there to select. The button says "Copied", politely, for screen readers too.
 */
export function CopyBox({ label, code, filename }: { label: string; code: string; filename?: string }) {
  const ready = useHydrated();
  const [said, setSaid] = useState("");
  const codeRef = useRef<HTMLElement>(null);
  const labelId = useId();
  useEffect(() => {
    if (!said) return;
    const t = setTimeout(() => setSaid(""), 2500);
    return () => clearTimeout(t);
  }, [said]);

  const selectCode = () => {
    const el = codeRef.current;
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    if (!el || !sel) return false;
    sel.selectAllChildren(el);
    return true;
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setSaid("Copied");
    } catch {
      // No clipboard access (an old browser, or a page in a frame): select the code instead.
      setSaid(selectCode() ? "Selected. Press Ctrl+C, or Cmd+C on a Mac, to copy." : "");
    }
  };

  return (
    <div className="tl-copy">
      <div className="tl-copy-head">
        <p className="tl-copy-label" id={labelId}>
          {label}
          {filename ? <span className="tl-copy-file">{filename}</span> : null}
        </p>
        {ready ? (
          <button type="button" className="ck-btn ck-btn-light ck-btn-sm tl-copy-btn" onClick={copy}>
            {said === "Copied" ? "Copied" : "Copy"}
          </button>
        ) : null}
      </div>
      {/* tabIndex: keyboard users can scroll a long line sideways */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable code region must be focusable */}
      <pre className="tl-code" tabIndex={0} aria-labelledby={labelId}>
        <code ref={codeRef}>{code}</code>
      </pre>
      <span className="ck-sr" aria-live="polite">
        {said}
      </span>
    </div>
  );
}

// ---------- forms ----------

/** The spam trap, exactly like the free check's: people never see or fill it. No visible field may be named "website". */
export function HoneypotField() {
  return (
    <div className="ck-sr" aria-hidden="true">
      <label>
        Website <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}

/** A labelled one-line text field. `url` sets the keyboard and switches off auto-correct for web addresses. */
export function TextField({
  name,
  label,
  placeholder,
  defaultValue,
  required,
  maxLength = 2000,
  url = false,
  hint,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  maxLength?: number;
  url?: boolean;
  hint?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="tl-field">
      <label className="tl-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="tl-input"
        type="text"
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...(url ? { inputMode: "url" as const, autoComplete: "url", autoCapitalize: "off", autoCorrect: "off", spellCheck: false } : {})}
      />
      {hint ? (
        <p className="tl-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A labelled text box for pasted text. Grows with the page, never wider than its card. */
export function TextArea({
  name,
  label,
  defaultValue,
  value,
  onChange,
  rows = 10,
  maxLength,
  placeholder,
  hint,
  code = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  hint?: ReactNode;
  /** Monospace, no spell check (robots.txt, llms.txt, JSON-LD). */
  code?: boolean;
}) {
  const id = useId();
  return (
    <div className="tl-field">
      <label className="tl-label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={`tl-textarea${code ? " tl-textarea-code" : ""}`}
        name={name}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        spellCheck={code ? false : undefined}
        autoCapitalize={code ? "off" : undefined}
        autoCorrect={code ? "off" : undefined}
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...(value !== undefined ? { value, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => onChange?.(e.target.value) } : { defaultValue })}
      />
      {hint ? (
        <p className="tl-hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A real submit button. Says "Checking…" while the result is on its way (with JavaScript). */
export function SubmitButton({
  busy = false,
  children,
  busyText = "Checking…",
  name,
  value,
}: {
  busy?: boolean;
  children?: ReactNode;
  busyText?: string;
  name?: string;
  value?: string;
}) {
  return (
    <button className="ck-btn ck-btn-dark tl-submit" type="submit" disabled={busy} aria-disabled={busy || undefined} name={name} value={value}>
      {busy ? busyText : children}
    </button>
  );
}

/** True for an action's `{ ok: false, error }` answer. */
const isFailure = (d: unknown) => typeof d === "object" && d !== null && (d as { ok?: unknown }).ok === false;

/**
 * Posts a tool form through a fetcher, so only the result changes: no new URL, no history entry (the back
 * button is never trapped). Without JavaScript the same <form method="post"> reloads the page with the
 * result (useActionData), so `data` covers both. When a new result arrives, focus moves to its heading.
 * After an error, focus only moves to an error shown in the result area (a focus target holding the
 * role="alert" message). Otherwise the heading there still belongs to the example or the last result, so
 * moving to it would read that out as if it were the answer: focus stays put and the tool may send it back
 * to its form, where the error shows.
 */
export function useToolSubmit<T = unknown>() {
  const fetcher = useFetcher<T>();
  const actionData = useActionData<T>();
  const data = fetcher.data ?? actionData;
  const busy = fetcher.state !== "idle";
  const seen = useRef(fetcher.data);
  useEffect(() => {
    if (fetcher.state !== "idle" || fetcher.data === undefined || fetcher.data === seen.current) return;
    seen.current = fetcher.data;
    const el = document.querySelector<HTMLElement>(".tl-result [data-tl-focus]");
    if (isFailure(fetcher.data) && !el?.querySelector('[role="alert"]')) return;
    el?.focus({ preventScroll: false });
  }, [fetcher.state, fetcher.data]);
  return { Form: fetcher.Form, data, busy, fetcher };
}

// ---------- page sections (below the button) ----------

/** "What this tool checks" and a short list. */
export function WhatItChecks({ items }: { items: string[] }) {
  return (
    <section className="tl-sec" aria-labelledby="what-it-checks">
      <h2 className="ck-h2" id="what-it-checks">
        What this tool checks
      </h2>
      <ul className="tl-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/** An H2 question, answered in its first sentence (80 to 200 words). */
export function Explainer({ id, question, children }: { id: string; question: string; children?: ReactNode }) {
  return (
    <section className="tl-sec" aria-labelledby={id}>
      <h2 className="ck-h2" id={id}>
        {question}
      </h2>
      <div className="tl-prose">{children}</div>
    </section>
  );
}

/** "How this tool works": the method, then "Maintained by GEO. Updated {date}." */
export function HowItWorks({ items, updated }: { items: ReactNode[]; updated: string }) {
  return (
    <section className="tl-sec" aria-labelledby="how-it-works">
      <h2 className="ck-h2" id="how-it-works">
        How this tool works
      </h2>
      <ul className="tl-list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <p className="tl-maintained">
        Maintained by GEO. Updated <time dateTime={updated}>{formatUpdated(updated)}</time>.
      </p>
    </section>
  );
}

export interface FaqSource {
  url: string;
  /** The link's words. Default: the site's name from the address. */
  label?: string;
}

/** A visible FAQ. `q` and `a` also feed the FAQPage JSON-LD word for word; `sources` show only on the page. */
export type ToolFaqItem = Faq & { sources?: FaqSource[] };

const sourceLabel = (s: FaqSource) => {
  if (s.label) return s.label;
  try {
    return new URL(s.url).hostname.replace(/^www\./, "");
  } catch {
    return s.url;
  }
};

/** "Questions people ask": every question an H3 with its answer, always visible (never folded away). */
export function ToolFaq({ faqs }: { faqs: ToolFaqItem[] }) {
  return (
    <section className="tl-sec tl-faq" aria-labelledby="faq">
      <h2 className="ck-h2" id="faq">
        Questions people ask
      </h2>
      {faqs.map((f) => (
        <div className="tl-faq-item" key={f.q}>
          <h3 className="ck-h3">{f.q}</h3>
          <p>{f.a}</p>
          {f.sources?.length ? (
            <p className="tl-sources">
              {f.sources.length === 1 ? "Source: " : "Sources: "}
              {f.sources.map((s, i) => (
                <span key={s.url}>
                  {i ? ", " : ""}
                  {/^https?:/i.test(s.url) ? (
                    <a href={s.url} rel="noopener noreferrer" target="_blank">
                      {sourceLabel(s)}
                    </a>
                  ) : (
                    <a href={s.url}>{sourceLabel(s)}</a>
                  )}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ))}
    </section>
  );
}

/** "More free tools": three cards (name and one line), then "See all free tools". */
export function RelatedTools({ slugs }: { slugs: readonly ToolSlug[] }) {
  return (
    <section className="tl-sec" aria-labelledby="more-tools">
      <h2 className="ck-h2" id="more-tools">
        More free tools
      </h2>
      <ul className="tl-cards">
        {slugs.map((s) => {
          const t = toolBySlug(s);
          return (
            <li key={s} className="tl-tool-card">
              <a href={t.path}>{t.name}</a>
              <p>{t.short}</p>
            </li>
          );
        })}
      </ul>
      <p className="tl-all">
        <a href={HUB.path}>See all free tools</a>
      </p>
    </section>
  );
}

/** "Updated 11 October 2026 · Made by GEO". */
export function UpdatedLine({ date }: { date: string }) {
  return (
    <p className="tl-updated">
      Updated <time dateTime={date}>{formatUpdated(date)}</time> · Made by <a href="/">GEO</a>
    </p>
  );
}

/** A tool card for the hub: name as a link, its one line and its timing. */
export function ToolCard({ tool, headingLevel = 3 }: { tool: ToolEntry; headingLevel?: 2 | 3 }) {
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <li className="tl-tool-card tl-hub-card">
      <H className="tl-hub-card-h">
        <a href={tool.path}>{tool.name}</a>
      </H>
      <p>{tool.short}</p>
      <p className="tl-hub-timing">{tool.timing}</p>
    </li>
  );
}

/** Every tool as a plain link list (the 404 page and error pages). */
export function AllToolLinks() {
  return (
    <ul className="tl-cards">
      {TOOLS.map((t) => (
        <li key={t.slug} className="tl-tool-card">
          <a href={t.path}>{t.name}</a>
          <p>{t.short}</p>
        </li>
      ))}
    </ul>
  );
}
