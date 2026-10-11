// llms.txt Checker result pieces: the verdict, the files row (/llms.txt, /llms-full.txt, /agents.md), the
// checks with line numbers and excerpts (problems first), what passed, the box for Shopify's automatic file,
// the starter file (editable, checked live, with a Shopify llms.txt.liquid version) and the evidence box.
// Plain presentational components: the same views render a fetched site's report (server) and a pasted
// file's live report (browser). Strangers' text (excerpts, section names) is only ever shown as escaped text.
// Styles: app/styles/tool-llms.css (tl-llms-*), on top of tools.css.

import { Fragment, useEffect, useMemo, useState } from "react";
import { CopyBox, ResultHeading, StatusChip, TextArea, useHydrated, type ChipTone, type FaqSource } from "../tool-ui";
import { llmsReport, llmsVerdict, toShopifyTemplate, type Check, type FileState, type LlmsReport, type LlmsSite, type VerdictTone } from "../../lib/tools/llms";
import { EVIDENCE, GENERATOR, MAX_PASTE, PASSED_COPY, RESULT, SHOPIFY_BOX, TONE_LABEL } from "../../lib/tools/copy/llms-txt-checker";
import { toolBySlug } from "../../lib/tools/registry";

/** Copy with `backticks` shown as code (copy strings only). */
export function WithCode({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <code key={i} className="tl-llms-code">
            {p}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

const sourceLabel = (s: FaqSource) => {
  if (s.label) return s.label;
  try {
    return new URL(s.url).hostname.replace(/^www\./, "");
  } catch {
    return s.url;
  }
};

/** "Source: Shopify changelog" or "Sources: a, b": plain links to the primary sources. `inline`: inside a sentence's line. */
export function Sources({ sources, inline = false }: { sources: readonly FaqSource[]; inline?: boolean }) {
  if (!sources.length) return null;
  const Tag = inline ? "span" : "p";
  return (
    <Tag className="tl-sources">
      {sources.length === 1 ? "Source: " : "Sources: "}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i ? ", " : ""}
          <a href={s.url} rel="noopener noreferrer" target="_blank">
            {sourceLabel(s)}
          </a>
        </span>
      ))}
    </Tag>
  );
}

// ---------- verdict and checks ----------

function chipFor(c: Check): { tone: ChipTone; text: string } {
  if (c.tone === "problem") return { tone: "bad", text: TONE_LABEL.problem };
  if (c.tone === "tip") return { tone: "warn", text: c.ourTip ? TONE_LABEL.ourTip : TONE_LABEL.tip };
  return { tone: "info", text: TONE_LABEL.info };
}

/** The verdict line, with a coloured dot. `asHeading`: the result's heading (focus moves there after a run). */
function Verdict({ tone, headline, asHeading }: { tone: VerdictTone; headline: string; asHeading: boolean }) {
  return (
    <div className={`tl-llms-verdict is-${tone}`}>
      <span className="tl-llms-dot" aria-hidden="true" />
      {asHeading ? <ResultHeading>{headline}</ResultHeading> : <p className="tl-llms-verdict-line">{headline}</p>}
    </div>
  );
}

/** Every check (problems, then tips, then info) with its line and excerpt, then what passed. */
export function ChecksList({ report, heading, headingId }: { report: LlmsReport; heading: string; headingId: string }) {
  return (
    <div className="tl-llms-checks">
      <h3 className="ck-h3" id={headingId}>
        {heading}
      </h3>
      {report.checks.length ? (
        <ul className="tl-rows" aria-labelledby={headingId}>
          {report.checks.map((c, i) => {
            const chip = chipFor(c);
            return (
              <li key={`${c.id}-${c.line ?? "f"}-${i}`} className={`tl-llms-check is-${c.tone}`}>
                <div className="tl-llms-check-head">
                  <StatusChip tone={chip.tone}>{chip.text}</StatusChip>
                  <p className="tl-llms-check-text">
                    <WithCode text={c.text} />
                  </p>
                </div>
                {c.line && c.excerpt !== undefined ? (
                  <p className="tl-llms-excerpt">
                    <span className="tl-llms-lineno">Line {c.line}</span>
                    <code>{c.excerpt}</code>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="tl-small">{RESULT.noChecks}</p>
      )}
      {report.passed.length ? (
        <div className="tl-llms-passed">
          <p className="tl-llms-passed-h">{PASSED_COPY.heading}</p>
          <ul>
            {report.passed.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const FILE_TONE: Record<FileState, ChipTone> = { found: "good", missing: "neutral", html: "warn", unchecked: "neutral" };

/** /llms.txt, /llms-full.txt and /agents.md: Found / Not found / Web page instead / Couldn't check. */
function FilesRow({ files }: { files: LlmsSite["files"] }) {
  const rows: [string, FileState][] = [
    ["/llms.txt", files.llms],
    ["/llms-full.txt", files.full],
    ["/agents.md", files.agents],
  ];
  return (
    <div className="tl-llms-files">
      <h3 className="ck-h3" id="llms-files">
        {RESULT.filesHeading}
      </h3>
      <ul aria-labelledby="llms-files">
        {rows.map(([path, state]) => (
          <li key={path}>
            <code className="tl-llms-code">{path}</code>
            <StatusChip tone={FILE_TONE[state]}>{RESULT.file[state]}</StatusChip>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The box for Shopify's automatic file. */
export function ShopifyBox() {
  return (
    <div className="tl-llms-box">
      <h3 className="ck-h3">{SHOPIFY_BOX.title}</h3>
      <p>{SHOPIFY_BOX.text}</p>
      <Sources sources={SHOPIFY_BOX.sources} />
    </div>
  );
}

/** A fetched site's result: verdict, the address checked, the files row, the checks, the Shopify box. */
export function SiteReportView({ site }: { site: LlmsSite }) {
  const v = llmsVerdict(site.report);
  return (
    <div className="tl-card tl-llms-report">
      <div className="tl-llms-top">
        <Verdict tone={v.tone} headline={v.headline} asHeading />
        <p className="tl-small">
          {RESULT.checked} <span className="tl-url">{site.llmsUrl}</span>
        </p>
      </div>
      <FilesRow files={site.files} />
      <ChecksList report={site.report} heading={RESULT.checksHeading} headingId="llms-checks" />
      {site.report.shopify ? <ShopifyBox /> : null}
    </div>
  );
}

/** A pasted file's result (checked in the browser, or by the server once when JavaScript is off). */
export function PastedReportView({ report }: { report: LlmsReport }) {
  const v = llmsVerdict(report);
  return (
    <div className="tl-card tl-llms-report">
      <Verdict tone={v.tone} headline={v.headline} asHeading />
      <ChecksList report={report} heading={RESULT.checksHeading} headingId="llms-checks" />
      {report.shopify ? <ShopifyBox /> : null}
    </div>
  );
}

// ---------- the starter file ----------

/** Re-check text a moment after the last key press (about 250 ms), so typing stays smooth. */
function useSettled(text: string, ms = 250): string {
  const [settled, setSettled] = useState(text);
  useEffect(() => {
    if (settled === text) return;
    const t = setTimeout(() => setSettled(text), ms);
    return () => clearTimeout(t);
  }, [text, settled, ms]);
  return settled;
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * The starter file built from the home page: an editable box whose checks update as people type, the file to
 * copy, and, for Shopify stores, the same file as a templates/llms.txt.liquid with where to add it.
 */
export function StarterEditor({ site }: { site: LlmsSite }) {
  const hydrated = useHydrated();
  const [text, setText] = useState(site.starter ?? "");
  const checked = useSettled(text);
  const report = useMemo(() => llmsReport(checked.slice(0, MAX_PASTE)), [checked]);
  const v = llmsVerdict(report);
  // The code to copy follows every key press (copying straight after typing never gets the old text);
  // only the checks wait for typing to settle.
  const template = useMemo(() => toShopifyTemplate(text), [text]);

  return (
    <section className="tl-card tl-llms-starter" id="starter" aria-labelledby="starter-h">
      <h2 className="ck-h2" id="starter-h">
        {GENERATOR.title(site.host)}
      </h2>
      {site.starter === null ? (
        <p className="tl-small">{GENERATOR.noHome}</p>
      ) : (
        <>
          <p className="tl-small">
            {GENERATOR.lead}
            {hydrated ? ` ${GENERATOR.live}` : ""}
          </p>
          {site.starterNote === "no-links" ? <p className="tl-llms-note">{GENERATOR.noLinks}</p> : null}
          <TextArea name="starter" label={GENERATOR.editLabel} value={text} onChange={setText} rows={12} maxLength={MAX_PASTE} code />
          <div className="tl-llms-mini">
            <Verdict tone={v.tone} headline={v.headline} asHeading={false} />
            <ChecksList report={report} heading={GENERATOR.checksHeading} headingId="starter-checks" />
          </div>
          <CopyBox label={GENERATOR.copyLabel} code={text} filename="llms.txt" />
          {site.shopify ? (
            <div className="tl-llms-shopify">
              <h3 className="ck-h3">{GENERATOR.shopifyTitle}</h3>
              <p>{GENERATOR.shopifyNote}</p>
              <CopyBox label={GENERATOR.shopifyCopyLabel} code={template} filename={GENERATOR.shopifyFile} />
              <p>{GENERATOR.shopifySteps}</p>
              <Sources sources={GENERATOR.shopifySources} />
            </div>
          ) : (
            <p className="tl-small">{GENERATOR.otherSite(originOf(site.llmsUrl))}</p>
          )}
        </>
      )}
    </section>
  );
}

/** In paste mode there is no home page to build from. */
export function StarterPlaceholder() {
  return (
    <section className="tl-card tl-card-soft tl-llms-starter" id="starter" aria-labelledby="starter-h">
      <h2 className="ck-h3" id="starter-h">
        {GENERATOR.titlePaste}
      </h2>
      <p className="tl-small">{GENERATOR.paste}</p>
    </section>
  );
}

// ---------- the evidence box ----------

/** "Before you spend time on it": what is known about who reads llms.txt, and what to fix first. */
export function EvidenceBox() {
  const crawler = toolBySlug("ai-crawler-checker");
  const schema = toolBySlug("product-schema-checker");
  return (
    <section className="tl-card tl-card-soft tl-llms-evidence" aria-labelledby="evidence-h">
      <h2 className="ck-h3" id="evidence-h">
        {EVIDENCE.title}
      </h2>
      <p>{EVIDENCE.text}</p>
      <p className="tl-llms-next">
        {EVIDENCE.linksLead} <a href={crawler.path}>{crawler.name}</a> · <a href={schema.path}>{schema.name}</a>
      </p>
      <Sources sources={EVIDENCE.sources} />
    </section>
  );
}
