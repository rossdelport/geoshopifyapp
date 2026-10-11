import type { ActionFunctionArgs, LinksFunction, MetaFunction } from "react-router";
import { data, useActionData } from "react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  HoneypotField,
  HowItWorks,
  RelatedTools,
  SampleLabel,
  SubmitButton,
  ToolError,
  ToolFaq,
  ToolHero,
  ToolShell,
  UpdatedLine,
  WhatItChecks,
  useHydrated,
} from "../components/tool-ui";
import { FaqEditor, FaqResult, type EditorRow, type FaqField, type OutputKey } from "../components/tools/faq-editor";
import { MAX_ROWS, SPARE_ROWS, buildFaq, faqVerdict, questionKey, rowsFromForm, type FaqRow } from "../lib/tools/faq-schema";
import {
  ANNOUNCE,
  CTA,
  FAQS,
  FORM,
  HOW_IT_WORKS,
  INTRO,
  LIMIT_COPY,
  NOTE,
  RESULT,
  SAMPLE_LABEL,
  WHAT_IT_CHECKS,
} from "../lib/tools/copy/faq-schema-generator";
import { SAMPLE_ROWS } from "../lib/tools/samples/faq-sample";
import { noStore, toolHeaders } from "../lib/tools/http";
import { toolBySlug } from "../lib/tools/registry";
import { pageMeta, toolJsonLd } from "../lib/tools/seo";
import { PASTE_FORM_BYTES, startToolPost } from "../lib/tools/guard.server";
import { LIMIT_STATUS, TOOL_LIMITS, takeToolSlot } from "../lib/tools/limits.server";
import faqCss from "../styles/tool-faq.css?url";

// The FAQ Schema Generator (docs/tools/spec.md T4): questions and answers in; FAQPage JSON-LD, a Shopify
// section and a product metafield version out. Everything runs in the browser as people type (faq-schema.ts),
// starting from a made-up example that the server already renders with its code. Without JavaScript the
// form posts here once, the action reads the rows (nothing is kept or fetched), and the page comes back
// with the same output built on the server, plus 4 empty rows to add more questions.

const TOOL = toolBySlug("faq-schema-generator");

export const meta: MetaFunction = () =>
  pageMeta({
    path: TOOL.path,
    title: TOOL.title,
    description: TOOL.description,
    image: TOOL.ogImage,
    imageAlt: TOOL.ogAlt,
    jsonLd: toolJsonLd(TOOL, FAQS),
  });

export const links: LinksFunction = () => [{ rel: "stylesheet", href: faqCss }];

export const headers = toolHeaders;

/** `rows: null`: show the example again (a tripped honeypot, or a post we couldn't read). */
type ActionData = { ok: true; rows: FaqRow[] | null } | { ok: false; rows: FaqRow[] | null; error: string };

const reply = (body: ActionData, status = 200) => data(body, { status, headers: noStore });

/**
 * Posts without JavaScript. Order (spec 4.2): other websites (403) and big bodies (413), the honeypot (the
 * normal result: the page shows its example), the rows (400 when there are too many or they're too long),
 * the paste limit (60 an hour), then the rows go back for the page to build the code. No fetch, no cost.
 */
export async function action({ request }: ActionFunctionArgs) {
  const start = await startToolPost(request, PASTE_FORM_BYTES);
  if (!start.ok) return reply({ ok: false, rows: null, error: start.status === 413 ? LIMIT_COPY.tooBig : start.error }, start.status);
  const { form, ipHash, trapped } = start;
  if (trapped) return reply({ ok: true, rows: null });

  const { rows, error } = rowsFromForm(form.getAll("question"), form.getAll("answer"));
  if (error) return reply({ ok: false, rows, error: LIMIT_COPY[error] }, 400);
  const slot = takeToolSlot("faq-paste", ipHash, TOOL_LIMITS.paste);
  if (!slot.ok) return reply({ ok: false, rows, error: slot.error }, LIMIT_STATUS);
  return reply({ ok: true, rows });
}

const blankRow = (id: number): EditorRow => ({ id, q: "", a: "" });
const SAMPLE_TEXT = new Set(SAMPLE_ROWS.flatMap((r) => [r.q, r.a]));
/**
 * The example label stays while any of the example's text is still in the form (its code is still in the
 * result then). It also means the label doesn't disappear, pulling every row up, at the first key press.
 */
const hasSampleText = (rows: FaqRow[]) => rows.some((r) => SAMPLE_TEXT.has(r.q) || SAMPLE_TEXT.has(r.a));

/** Focus a field or button in a row once React has drawn it. */
function focusLater(selector: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
}

export default function FaqSchemaGenerator() {
  const posted = useActionData<ActionData>();
  const live = useHydrated();

  // A post without JavaScript fills the rows with what was sent; otherwise the example does.
  const startRows = posted?.rows ?? SAMPLE_ROWS;
  const [rows, setRows] = useState<EditorRow[]>(() => (startRows.length ? startRows.map((r, i) => ({ id: i, q: r.q, a: r.a })) : [blankRow(0)]));
  const nextId = useRef(Math.max(startRows.length, 1));
  const [announce, setAnnounce] = useState("");
  const [active, setActive] = useState<OutputKey>("jsonLd");
  // Clear first, then say it: a screen reader reads a polite region again only when its text changes.
  const say = (text: string) => {
    setAnnounce("");
    requestAnimationFrame(() => setAnnounce(text));
  };

  // The code follows the rows about 250 ms after the last key press.
  const [checked, setChecked] = useState<FaqRow[]>(rows);
  useEffect(() => {
    if (checked === rows) return;
    const t = setTimeout(() => setChecked(rows), 250);
    return () => clearTimeout(t);
  }, [rows, checked]);
  const out = useMemo(() => buildFaq(checked), [checked]);

  const full = rows.length >= MAX_ROWS;
  const isSample = hasSampleText(rows);
  const asked = useMemo(() => new Set(rows.map((r) => questionKey(r.q)).filter(Boolean)), [rows]);
  const hasQuestion = useCallback((q: string) => asked.has(questionKey(q)), [asked]);
  // Without JavaScript nobody can add rows, so empty ones come with the form (and each post adds 4 more).
  const spare = live ? 0 : Math.max(0, Math.min(SPARE_ROWS, MAX_ROWS - rows.length));
  const formError = posted && !posted.ok ? posted.error : null;

  const onChange = (id: number, field: FaqField, value: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const addRow = (q = "") => {
    if (full) return;
    const id = nextId.current++;
    const n = rows.length + 1;
    setRows((rs) => [...rs, { id, q, a: "" }]);
    // At 20 the add buttons switch off; say why, here and under them (FaqEditor).
    say(n >= MAX_ROWS ? `${ANNOUNCE.added(n)} ${LIMIT_COPY.maxRows}` : ANNOUNCE.added(n));
    focusLater(`[data-faq-row="${id}"] ${q ? "textarea" : "input"}`);
  };

  const onStarter = (q: string) => {
    // Fill the first empty row if there is one, else add a row. The answer always stays empty.
    const empty = rows.findIndex((r) => !r.q.trim() && !r.a.trim());
    if (empty < 0) return addRow(q);
    const id = rows[empty].id;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, q } : r)));
    focusLater(`[data-faq-row="${id}"] textarea`);
  };

  const onRemove = (id: number) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return;
    say(ANNOUNCE.removed(i + 1));
    if (rows.length === 1) {
      // The last row is cleared rather than removed, so there's always somewhere to type.
      setRows([blankRow(id)]);
      focusLater(`[data-faq-row="${id}"] input`);
      return;
    }
    const next = rows[i + 1] ?? rows[i - 1];
    setRows((rs) => rs.filter((r) => r.id !== id));
    focusLater(`[data-faq-row="${next.id}"] input`);
  };

  const onMoveUp = (id: number) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 1) return;
    setRows((rs) => {
      const copy = [...rs];
      [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
      return copy;
    });
    say(ANNOUNCE.moved(i));
    // Keep focus on the row that moved: its "Move up" button, or its question once it's first.
    focusLater(i - 1 === 0 ? `[data-faq-row="${id}"] input` : `[data-faq-row="${id}"] [data-faq-move]`);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // With JavaScript the code is already built here in the browser; nothing is sent.
    e.preventDefault();
    setChecked(rows);
    const v = faqVerdict(rows);
    say(v.count ? `${RESULT.done} ${v.text}.` : v.text);
    focusLater(".tl-result [data-tl-focus]");
  };

  const hero = (
    <ToolHero h1={TOOL.h1} intro={INTRO} timing={TOOL.timing}>
      <p className="tl-note tl-faq-honest">
        <strong>{NOTE.lead}</strong> {NOTE.text}{" "}
        <a href={NOTE.source.url} rel="noopener noreferrer" target="_blank">
          Source: {NOTE.source.label}
        </a>
      </p>
      <form method="post" className="tl-form tl-faq-form" onSubmit={live ? onSubmit : undefined}>
        <HoneypotField />
        {isSample ? <SampleLabel>{SAMPLE_LABEL}</SampleLabel> : null}
        <FaqEditor
          rows={rows}
          spare={spare}
          live={live}
          full={full}
          onChange={onChange}
          onRemove={onRemove}
          onMoveUp={onMoveUp}
          onAdd={() => addRow()}
          onStarter={onStarter}
          hasQuestion={hasQuestion}
        />
        {formError ? <ToolError message={formError} /> : null}
        <div className="tl-faq-submit">
          <SubmitButton>{FORM.submit}</SubmitButton>
          {live ? <p className="tl-hint">{FORM.live}</p> : null}
        </div>
      </form>
    </ToolHero>
  );

  return (
    <ToolShell
      page={TOOL}
      hero={hero}
      resultLabel="Your FAQ code"
      result={<FaqResult out={out} live={live} active={active} onSelect={setActive} />}
      cta={CTA}
      announce={announce}
    >
      <WhatItChecks items={WHAT_IT_CHECKS} />
      <HowItWorks
        updated={TOOL.updated}
        items={HOW_IT_WORKS.map((item) => (
          <Fragment key={item.text}>
            {item.text}
            {item.source ? (
              <>
                {" "}
                <a className="tl-faq-source" href={item.source.url} rel="noopener noreferrer" target="_blank">
                  Source: {item.source.label}
                </a>
              </>
            ) : null}
          </Fragment>
        ))}
      />
      <ToolFaq faqs={FAQS} />
      <RelatedTools slugs={TOOL.related} />
      <UpdatedLine date={TOOL.updated} />
    </ToolShell>
  );
}
