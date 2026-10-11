// FAQ Schema Generator pieces: the question rows (the form's fields), and the result (verdict, checks, the
// three kinds of code with their steps, and a preview of the FAQ). Plain presentational components: the
// route keeps the rows in state and the same views render on the server (the example, or a post without
// JavaScript) and live in the browser. Visitors' text is only ever rendered as React text, never as HTML.
// Without JavaScript every output shows, one after another; with it a small switcher shows one at a time
// (the others stay in the page). Styles: app/styles/tool-faq.css (tl-faq-*), on top of tools.css.

import { useId, type KeyboardEvent, type ReactNode } from "react";
import { CopyBox, ResultHeading, StatusChip, type ChipTone, type FaqSource } from "../tool-ui";
import { CHECK_CHIP, FORM, LIMIT_COPY, OUTPUTS, OUTPUTS_NOJS, RESULT, STARTERS } from "../../lib/tools/copy/faq-schema-generator";
import { MAX_ANSWER, MAX_QUESTION, type FaqNoteTone, type FaqOutput, type FaqRow } from "../../lib/tools/faq-schema";

/** A row in the form. `id` keeps React's keys and the fields' ids steady when rows move. */
export interface EditorRow extends FaqRow {
  id: number;
}

export type FaqField = "q" | "a";

// ---------- the rows ----------

function Count({ id, n, max }: { id: string; n: number; max: number }) {
  return (
    <p className={`tl-faq-count${n >= max ? " is-full" : ""}`} id={id}>
      {FORM.count(n, max)}
      <span className="ck-sr"> characters</span>
    </p>
  );
}

function RowFields({
  row,
  n,
  live,
  first,
  onChange,
  onRemove,
  onMoveUp,
}: {
  row: EditorRow | null;
  n: number;
  live: boolean;
  first: boolean;
  onChange?: (id: number, field: FaqField, value: string) => void;
  onRemove?: (id: number) => void;
  onMoveUp?: (id: number) => void;
}) {
  const base = useId();
  const q = row?.q ?? "";
  const a = row?.a ?? "";
  const ids = { q: `${base}-q`, a: `${base}-a`, qCount: `${base}-qc`, aCount: `${base}-ac` };
  // Spare rows (null) are the empty rows shown without JavaScript: plain fields with nothing in them.
  const bind = (field: FaqField, value: string) =>
    row && onChange ? { value, onChange: (e: { target: { value: string } }) => onChange(row.id, field, e.target.value) } : { defaultValue: value };
  return (
    <li className="tl-faq-row" data-faq-row={row?.id ?? `spare-${n}`}>
      <div className="tl-faq-row-head">
        <label className="tl-label" htmlFor={ids.q}>
          {FORM.question(n)}
        </label>
        {live && row ? (
          <div className="tl-faq-row-tools">
            <button type="button" className="tl-faq-tool" data-faq-move="" disabled={first} onClick={() => onMoveUp?.(row.id)}>
              {FORM.moveUp}
              <span className="ck-sr">: {FORM.question(n)}</span>
            </button>
            <button type="button" className="tl-faq-tool" onClick={() => onRemove?.(row.id)}>
              {FORM.remove}
              <span className="ck-sr">: {FORM.question(n)}</span>
            </button>
          </div>
        ) : null}
      </div>
      <input
        id={ids.q}
        className="tl-input"
        type="text"
        name="question"
        maxLength={MAX_QUESTION}
        autoComplete="off"
        aria-describedby={ids.qCount}
        {...bind("q", q)}
      />
      <Count id={ids.qCount} n={q.length} max={MAX_QUESTION} />
      <label className="tl-label" htmlFor={ids.a}>
        {FORM.answer(n)}
      </label>
      <textarea id={ids.a} className="tl-textarea tl-faq-answer" name="answer" rows={3} maxLength={MAX_ANSWER} aria-describedby={ids.aCount} {...bind("a", a)} />
      <Count id={ids.aCount} n={a.length} max={MAX_ANSWER} />
    </li>
  );
}

/**
 * The numbered question rows. `spare` empty rows follow (only without JavaScript, which can't add rows).
 * With JavaScript each row can move up or go, and "Add a question" and the starter questions add rows.
 */
export function FaqEditor({
  rows,
  spare,
  live,
  full,
  onChange,
  onRemove,
  onMoveUp,
  onAdd,
  onStarter,
  hasQuestion,
}: {
  rows: EditorRow[];
  spare: number;
  live: boolean;
  /** 20 rows already. */
  full: boolean;
  onChange: (id: number, field: FaqField, value: string) => void;
  onRemove: (id: number) => void;
  onMoveUp: (id: number) => void;
  onAdd: () => void;
  onStarter: (question: string) => void;
  /** True when a row already asks this question (its starter button is then off). */
  hasQuestion: (question: string) => boolean;
}) {
  // A starter question fills the first empty row, so it still works at 20 rows while one is empty.
  const hasEmpty = rows.some((r) => !r.q.trim() && !r.a.trim());
  return (
    <>
      <ol className="tl-faq-rows">
        {rows.map((row, i) => (
          <RowFields key={row.id} row={row} n={i + 1} live={live} first={i === 0} onChange={onChange} onRemove={onRemove} onMoveUp={onMoveUp} />
        ))}
        {Array.from({ length: spare }, (_, i) => (
          <RowFields key={`spare-${i}`} row={null} n={rows.length + i + 1} live={false} first={false} />
        ))}
      </ol>
      {live ? (
        <div className="tl-faq-add">
          <button type="button" className="tl-faq-add-btn" data-faq-add="" onClick={onAdd} disabled={full}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {FORM.add}
          </button>
          <div className="tl-faq-starters" role="group" aria-label={FORM.startersLead}>
            <span className="tl-faq-starters-lead">{FORM.startersLead}</span>
            {STARTERS.map((s) => (
              <button key={s} type="button" className="tl-example" onClick={() => onStarter(s)} disabled={(full && !hasEmpty) || hasQuestion(s)}>
                {s}
              </button>
            ))}
          </div>
          {full ? <p className="tl-hint">{LIMIT_COPY.maxRows}</p> : null}
        </div>
      ) : (
        <p className="tl-hint">{full ? LIMIT_COPY.maxRows : FORM.moreRows}</p>
      )}
    </>
  );
}

// ---------- the result ----------

export type OutputKey = keyof typeof OUTPUTS;
export const OUTPUT_KEYS: OutputKey[] = ["jsonLd", "section", "metafield"];

const NOTE_TONE: Record<FaqNoteTone, ChipTone> = { warn: "warn", info: "info", tip: "neutral" };

function SourceLink({ source }: { source: FaqSource }) {
  return (
    <a className="tl-faq-source" href={source.url} rel="noopener noreferrer" target="_blank">
      Source: {source.label}
    </a>
  );
}

/** Tabs for the three outputs (with JavaScript). Arrow keys, Home and End move between them. */
function OutputTabs({ active, onSelect }: { active: OutputKey; onSelect: (k: OutputKey) => void }) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = OUTPUT_KEYS.indexOf(active);
    const next =
      e.key === "ArrowRight" ? (i + 1) % OUTPUT_KEYS.length : e.key === "ArrowLeft" ? (i + OUTPUT_KEYS.length - 1) % OUTPUT_KEYS.length : e.key === "Home" ? 0 : e.key === "End" ? OUTPUT_KEYS.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onSelect(OUTPUT_KEYS[next]);
    document.getElementById(`${OUTPUTS[OUTPUT_KEYS[next]].id}-tab`)?.focus();
  };
  return (
    <div className="tl-faq-tabs" role="tablist" aria-label={RESULT.outputsLabel}>
      {OUTPUT_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          id={`${OUTPUTS[k].id}-tab`}
          className="tl-faq-tab"
          aria-selected={active === k}
          aria-controls={OUTPUTS[k].id}
          tabIndex={active === k ? 0 : -1}
          onClick={() => onSelect(k)}
          onKeyDown={onKeyDown}
        >
          {OUTPUTS[k].tab}
        </button>
      ))}
    </div>
  );
}

function OutputPanel({ k, live, active, children }: { k: OutputKey; live: boolean; active: OutputKey; children: ReactNode }) {
  const o = OUTPUTS[k];
  return (
    <section
      id={o.id}
      className={`tl-faq-panel${live && active !== k ? " tl-faq-off" : ""}`}
      {...(live ? { role: "tabpanel", "aria-labelledby": `${o.id}-tab` } : { "aria-labelledby": `${o.id}-h` })}
    >
      <h3 className="ck-h3 tl-faq-panel-h" id={`${o.id}-h`}>
        {o.title}
      </h3>
      {children}
    </section>
  );
}

/** "How the FAQ looks on your page": the questions and answers as plain text, line breaks kept. */
function Preview({ rows }: { rows: FaqRow[] }) {
  return (
    <div className="tl-card tl-card-soft tl-faq-preview">
      <h3 className="ck-h3">{RESULT.previewTitle}</h3>
      <dl className="tl-faq-preview-list">
        {rows.map((r, i) => (
          <div key={i} className="tl-faq-preview-item">
            <dt>{r.q}</dt>
            <dd>{r.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** The verdict, the checks, the three outputs and the preview. `live`: JavaScript is running. */
export function FaqResult({ out, live, active, onSelect }: { out: FaqOutput; live: boolean; active: OutputKey; onSelect: (k: OutputKey) => void }) {
  const ready = out.verdict.count > 0;
  return (
    <>
      <div className="tl-card tl-faq-result">
        <div className="tl-faq-verdict">
          <StatusChip tone={ready ? "good" : "neutral"}>{ready ? RESULT.readyChip : RESULT.emptyChip}</StatusChip>
          <ResultHeading>{out.verdict.text}</ResultHeading>
          {ready ? null : <p className="tl-small">{RESULT.emptyHint}</p>}
        </div>
        {out.notes.length ? (
          <ul className="tl-faq-notes">
            {out.notes.map((note) => (
              <li key={note.text} className={`tl-faq-note is-${note.tone}`}>
                <StatusChip tone={NOTE_TONE[note.tone]}>{CHECK_CHIP[note.tone]}</StatusChip>
                <span>{note.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {ready ? (
          <div className="tl-faq-outputs">
            {live ? <OutputTabs active={active} onSelect={onSelect} /> : <p className="tl-small">{OUTPUTS_NOJS}</p>}
            <OutputPanel k="jsonLd" live={live} active={active}>
              <p className="tl-faq-lead">{OUTPUTS.jsonLd.lead}</p>
              <CopyBox label={OUTPUTS.jsonLd.copyLabel} code={out.scriptTag} />
            </OutputPanel>
            <OutputPanel k="section" live={live} active={active}>
              <p className="tl-faq-lead">{OUTPUTS.section.steps}</p>
              <CopyBox label={OUTPUTS.section.copyLabel} filename={OUTPUTS.section.filename} code={out.section} />
              <p className="tl-small">{OUTPUTS.section.after}</p>
              <p className="tl-small">{OUTPUTS.section.tip}</p>
            </OutputPanel>
            <OutputPanel k="metafield" live={live} active={active}>
              <p className="tl-faq-lead">{OUTPUTS.metafield.lead}</p>
              <ol className="tl-faq-steps">
                <li>
                  <p>{OUTPUTS.metafield.steps[0]}</p>
                </li>
                <li>
                  <p>{OUTPUTS.metafield.steps[1]}</p>
                  <CopyBox label={OUTPUTS.metafield.valueLabel} code={out.metafieldJson} />
                </li>
                <li>
                  <p>{OUTPUTS.metafield.steps[2]}</p>
                  <CopyBox label={OUTPUTS.metafield.sectionLabel} filename={OUTPUTS.metafield.filename} code={out.productSection} />
                </li>
              </ol>
              <p className="tl-small">
                <SourceLink source={OUTPUTS.metafield.stepsSource} />
              </p>
            </OutputPanel>
          </div>
        ) : null}
      </div>
      {ready ? <Preview rows={out.rows} /> : null}
    </>
  );
}
