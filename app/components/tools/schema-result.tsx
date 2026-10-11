// Product Schema Checker result pieces: the verdict, what we found, the problems (worst first, two
// disagreeing blocks side by side), the three groups of facts (needed by Google, recommended by Google,
// extra facts for AI shopping tools) with where to fix each in Shopify, the "Fix it in Shopify" box, and
// the product data we read (closed, it's raw code). Plain presentational components: the same view renders
// a fetched page's report (server) and pasted data's live report (browser). Every value from the page is
// rendered as text, never as HTML.
// Styles: app/styles/tool-schema.css (tl-schema-*), on top of tools.css.

import { Fragment } from "react";
import { CopyBox, ResultHeading, StatusChip, type ChipTone, type FaqSource } from "../tool-ui";
import type { FieldRow, FieldStatus, Problem, ProblemTone, SchemaReport } from "../../lib/tools/schema";
import { FIELDS, FIX, GROUPS, RESULT, REVIEWS_NONE, STATUS, type VerdictState } from "../../lib/tools/copy/product-schema-checker";

/** Text with `backticks` shown as code (copy strings only; never strangers' text). */
function WithCode({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((p, i) =>
        i % 2 ? (
          <code key={i} className="tl-schema-code">
            {p}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/** "Source: Google's merchant listing guide" or "Sources: a, b". */
export function Sources({ sources }: { sources: readonly FaqSource[] }) {
  if (!sources.length) return null;
  return (
    <p className="tl-sources">
      {sources.length === 1 ? "Source: " : "Sources: "}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i ? ", " : ""}
          <a href={s.url} rel="noopener noreferrer" target="_blank">
            {s.label ?? s.url}
          </a>
        </span>
      ))}
    </p>
  );
}

const VERDICT_TONE: Record<VerdictState, ChipTone> = { ready: "good", problems: "warn", missing: "bad", none: "bad", broken: "bad", unread: "neutral" };
const PROBLEM_TONE: Record<ProblemTone, ChipTone> = { bad: "bad", warn: "warn", info: "neutral" };

/** The chip's tone and words for one fact. Missing extras are grey: they're our advice, not Google's rules. */
function chipFor(row: FieldRow, noun: string): { tone: ChipTone; text: string } {
  const required = row.group === "required";
  const tones: Record<FieldStatus, ChipTone> = {
    found: "good",
    partial: required ? "bad" : "warn",
    missing: required ? "bad" : row.group === "extra" ? "neutral" : "warn",
    unreadable: "bad",
    "not-on-page": "neutral",
    "not-needed": "neutral",
    none: "neutral",
  };
  const words: Record<FieldStatus, string> = {
    found: STATUS.found,
    partial: STATUS.partial(row.found ?? 0, row.of ?? 0, noun),
    missing: STATUS.missing,
    unreadable: STATUS.unreadable,
    "not-on-page": STATUS.notOnPage,
    "not-needed": STATUS.notNeeded,
    none: STATUS.none,
  };
  return { tone: tones[row.status], text: words[row.status] };
}

function FactRow({ row, noun }: { row: FieldRow; noun: string }) {
  const copy = FIELDS[row.id];
  const chip = chipFor(row, noun);
  const showFix = copy.fix && row.status !== "found" && row.status !== "not-needed" && row.status !== "none";
  return (
    <li className="tl-schema-row">
      <div className="tl-schema-row-head">
        <p className="tl-schema-label">
          {copy.label} <code className="tl-schema-prop">{copy.prop}</code>
        </p>
        <StatusChip tone={chip.tone}>{chip.text}</StatusChip>
      </div>
      {row.value ? <p className="tl-schema-value">{row.value}</p> : null}
      {row.id === "reviews" && row.status === "none" ? <p className="tl-schema-value">{REVIEWS_NONE}</p> : null}
      <p className="tl-schema-why">{copy.why}</p>
      {showFix ? (
        <p className="tl-schema-fix">
          <b>{RESULT.fixLabel}</b> {copy.fix}
        </p>
      ) : null}
    </li>
  );
}

function ProblemList({ problems }: { problems: Problem[] }) {
  const onlyNotes = problems.every((p) => p.tone === "info");
  return (
    <div className="tl-schema-problems">
      <h3 className="ck-h3">{onlyNotes ? RESULT.notesHeading : RESULT.problemsHeading}</h3>
      <ul>
        {problems.map((p) => (
          <li key={p.id} className={`tl-schema-problem is-${p.tone}`}>
            <StatusChip tone={PROBLEM_TONE[p.tone]}>{RESULT.problemChip[p.tone]}</StatusChip>
            <div className="tl-schema-problem-body">
              <p>{p.text}</p>
              {p.compare ? <Compare blocks={p.compare} /> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Two product blocks side by side: type, name, price and stock. */
function Compare({ blocks }: { blocks: NonNullable<Problem["compare"]> }) {
  const rows = [
    { label: RESULT.compareRows.type, get: (b: (typeof blocks)[number]) => b.type },
    { label: RESULT.compareRows.name, get: (b: (typeof blocks)[number]) => b.name },
    { label: RESULT.compareRows.price, get: (b: (typeof blocks)[number]) => b.price },
    { label: RESULT.compareRows.stock, get: (b: (typeof blocks)[number]) => b.stock },
  ];
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a table that scrolls sideways on phones must be focusable
    <div className="tl-schema-compare" tabIndex={0} role="region" aria-label="The product data blocks side by side">
      <table>
        <thead>
          <tr>
            <td />
            {blocks.map((_, i) => (
              <th key={i} scope="col">
                {RESULT.compareBlock(i + 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {blocks.map((b, i) => (
                <td key={i}>{r.get(b) ?? RESULT.compareNone}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The "Fix it in Shopify" box: Shopify's own filter only when there's no product data at all (not when a
 * block has a typo or uses microdata: adding the filter then would make two blocks), else admin first.
 */
function FixBox({ report }: { report: SchemaReport }) {
  const needsCode = report.verdict.state === "none" && !report.listing;
  const toFix = report.fields.some((f) => f.status === "missing" || f.status === "partial" || f.status === "unreadable" || f.status === "not-on-page");
  if (!needsCode && !toFix) return null;
  return (
    <div className="tl-schema-fixbox">
      <h3 className="ck-h3">{FIX.title}</h3>
      {needsCode ? (
        <>
          <p>
            <WithCode text={FIX.codeLead} />
          </p>
          <CopyBox label={FIX.codeLabel} code={FIX.code} filename="main-product.liquid" />
          <p>
            <WithCode text={FIX.codeAfter} />
          </p>
          <Sources sources={FIX.codeSources} />
        </>
      ) : (
        <p>{FIX.admin}</p>
      )}
    </div>
  );
}

/** The whole result for one product page or one paste. */
export function SchemaReportView({ report, readLine }: { report: SchemaReport; readLine?: string }) {
  const noun = report.unitNoun;
  const group = report.kind === "ProductGroup";
  return (
    <div className="tl-card tl-schema-report">
      <div className="tl-schema-verdict">
        <StatusChip tone={VERDICT_TONE[report.verdict.state]}>{RESULT.chip[report.verdict.state]}</StatusChip>
        <ResultHeading>{report.verdict.headline}</ResultHeading>
        <p className="tl-schema-lead">{report.found}</p>
        {report.notes.map((n) => (
          <p key={n} className="tl-small">
            {n}
          </p>
        ))}
        {readLine ? <p className="tl-small tl-url">{readLine}</p> : null}
      </div>

      {report.problems.length ? <ProblemList problems={report.problems} /> : null}

      {report.fields.length
        ? GROUPS.map((g) => {
            const rows = report.fields.filter((f) => f.group === g.id);
            if (!rows.length) return null;
            const sources = [g.source, group ? g.variantsSource : undefined].filter((s): s is FaqSource => !!s);
            return (
              <section key={g.id} className="tl-schema-group" aria-labelledby={`schema-${g.id}`}>
                <h3 className="ck-h3" id={`schema-${g.id}`}>
                  {g.heading}
                </h3>
                <p className="tl-schema-group-intro">{g.intro}</p>
                <Sources sources={sources} />
                <ul className="tl-rows">
                  {rows.map((row) => (
                    <FactRow key={row.id} row={row} noun={noun} />
                  ))}
                </ul>
              </section>
            );
          })
        : null}

      <FixBox report={report} />

      {report.json ? (
        <details className="tl-schema-raw">
          <summary>{RESULT.rawSummary}</summary>
          <CopyBox label={RESULT.rawLabel} code={report.json} />
        </details>
      ) : null}
    </div>
  );
}
