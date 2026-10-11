import type { ActionFunctionArgs, LinksFunction, MetaFunction } from "react-router";
import { data } from "react-router";
import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  HoneypotField,
  HowItWorks,
  RelatedTools,
  ResultHeading,
  SubmitButton,
  TextArea,
  TextField,
  ToolError,
  ToolFaq,
  ToolHero,
  ToolShell,
  UpdatedLine,
  WhatItChecks,
  useHydrated,
  useToolSubmit,
} from "../components/tool-ui";
import { CopyReportView, RewriteExample } from "../components/tools/copy-result";
import { checkCopy } from "../lib/tools/copy-check";
import { ANNOUNCE, CTA, FAQS, FORM, HONESTY, HOW_IT_WORKS, INTRO, MAX_TEXT, NOTES, RESULT, WHAT_IT_CHECKS } from "../lib/tools/copy/ai-bot-checker";
import { SAMPLE_TEXT } from "../lib/tools/samples/copy-sample";
import { normalizeCheckUrl } from "../lib/check-read";
import { noStore, toolHeaders } from "../lib/tools/http";
import { toolBySlug } from "../lib/tools/registry";
import { pageMeta, toolJsonLd } from "../lib/tools/seo";
import { readLinkedDescription, type LinkedDescription } from "../lib/tools/copy-check.server";
import { PASTE_FORM_BYTES, startToolPost } from "../lib/tools/guard.server";
import { LIMIT_STATUS, TOOL_LIMITS, takeToolSlot } from "../lib/tools/limits.server";
import copyCss from "../styles/tool-copy.css?url";

// The AI Bot Checker (docs/tools/spec.md T6): does a product description read like generic, bot-style copy?
// Not an AI detector, and the first screen says so. The text box starts with a made-up description, checked
// live; with JavaScript every change is checked in the browser as people type (copy-check.ts, nothing is
// sent). Without JavaScript "Check my copy" posts here once and the page comes back with the result, built
// by the same code during the render. A product link (POST only) is read on the server with readProduct, and
// its description goes into the box and gets checked.

const TOOL = toolBySlug("ai-bot-checker");

export const meta: MetaFunction = () =>
  pageMeta({
    path: TOOL.path,
    title: TOOL.title,
    description: TOOL.description,
    image: TOOL.ogImage,
    imageAlt: TOOL.ogAlt,
    jsonLd: toolJsonLd(TOOL, FAQS),
  });

export const links: LinksFunction = () => [{ rel: "stylesheet", href: copyCss }];

export const headers = toolHeaders;

/** `text: null`: show the example again (a tripped honeypot, or a post we couldn't read). */
type ActionData =
  | { ok: true; intent: "paste"; text: string | null; cut: boolean }
  | { ok: false; intent: "paste"; text: string | null; error: string }
  | { ok: true; intent: "fetch"; url: string; product: LinkedDescription | null }
  | { ok: false; intent: "fetch"; url: string; error: string };

const reply = (body: ActionData, status = 200) => data(body, { status, headers: noStore });

/**
 * Both forms post here. Order (spec 4.2): other websites (403) and big bodies (413), the honeypot (the
 * normal empty result: the page shows its example), the input, the limits, then the work. Pasted text is
 * only sent back (the page checks it while it renders); nothing is kept.
 */
export async function action({ request }: ActionFunctionArgs) {
  const start = await startToolPost(request, PASTE_FORM_BYTES);
  if (!start.ok) return reply({ ok: false, intent: "paste", text: null, error: start.error }, start.status);
  const { form, ipHash, trapped } = start;

  if (form.get("intent") === "fetch") {
    const url = String(form.get("url") ?? "").slice(0, 2_000);
    if (trapped) return reply({ ok: true, intent: "fetch", url, product: null });
    const input = normalizeCheckUrl(url); // a marketplace link gets its own words
    if (!input.ok) return reply({ ok: false, intent: "fetch", url, error: input.error }, 400);
    const slot = takeToolSlot("copy", ipHash, TOOL_LIMITS.copy);
    if (!slot.ok) return reply({ ok: false, intent: "fetch", url, error: slot.error }, LIMIT_STATUS);
    const out = await readLinkedDescription(input.url);
    if (!out.ok) return reply({ ok: false, intent: "fetch", url, error: out.error }, out.status);
    return reply({ ok: true, intent: "fetch", url, product: out.product });
  }

  const full = String(form.get("text") ?? "");
  if (trapped) return reply({ ok: true, intent: "paste", text: null, cut: false });
  const text = full.slice(0, MAX_TEXT);
  const slot = takeToolSlot("copy-paste", ipHash, TOOL_LIMITS.paste);
  if (!slot.ok) return reply({ ok: false, intent: "paste", text, error: slot.error }, LIMIT_STATUS);
  return reply({ ok: true, intent: "paste", text, cut: full.length > MAX_TEXT });
}

/** Focus the result's heading (the verdict), as useToolSubmit does for posted results. */
function focusResult() {
  document.querySelector<HTMLElement>(".tl-result [data-tl-focus]")?.focus();
}

export default function AiBotChecker() {
  const { Form, data: result, busy, fetcher } = useToolSubmit<ActionData>();
  const hydrated = useHydrated();

  // What a post without JavaScript sent back fills the box: a product's description, or the pasted text.
  const linked = result && result.ok && result.intent === "fetch" ? result.product : null;
  const posted = result && result.intent === "paste" ? result.text : null;
  const [text, setText] = useState(() => linked?.text ?? posted ?? SAMPLE_TEXT);

  // The result follows the box about 250 ms after the last key press.
  const [checked, setChecked] = useState(text);
  useEffect(() => {
    if (text === checked) return;
    const t = setTimeout(() => setChecked(text), 250);
    return () => clearTimeout(t);
  }, [text, checked]);

  // A product link read with JavaScript: its description goes in the box and is checked straight away.
  // (State adjusted during render when a new answer arrives, as React's docs suggest, not in an effect.)
  const [seen, setSeen] = useState(fetcher.data);
  if (fetcher.data !== seen) {
    setSeen(fetcher.data);
    const d = fetcher.data;
    if (d && d.ok && d.intent === "fetch" && d.product) {
      setText(d.product.text);
      setChecked(d.product.text);
    }
  }

  // A product link's description comes as one line (readProduct flattens the page), so the tips about
  // paragraph and sentence length are skipped while it's in the box unchanged.
  const flat = Boolean(linked && checked === linked.text);
  const report = useMemo(() => checkCopy(checked, { flat }), [checked, flat]);

  // useToolSubmit moves focus to the result when an answer arrives, but leaves it alone after an error. A link
  // we couldn't read leaves the result as it was, so focus goes to the link box, where the error shows.
  useEffect(() => {
    const d = fetcher.data;
    if (fetcher.state === "idle" && d && !d.ok && d.intent === "fetch") {
      document.querySelector<HTMLInputElement>('.tl-bot-link input[name="url"]')?.focus();
    }
  }, [fetcher.state, fetcher.data]);

  const fetchBusy = busy && fetcher.formData?.get("intent") === "fetch";
  const fetchError = result && !result.ok && result.intent === "fetch" ? result.error : null;
  const pasteError = result && !result.ok && result.intent === "paste" && (result.text === null || result.text === text) ? result.error : null;
  // A post without JavaScript that hit a limit: no result for that text, only the error by the form.
  const blocked = Boolean(result && !result.ok && result.intent === "paste" && result.text !== null && result.text === checked);
  const postedUrl = result && result.intent === "fetch" ? result.url : undefined;

  // Under the verdict: where the text came from, while it's still the product's description.
  const fromLink = linked && flat ? RESULT.fromLink(linked.domain, linked.clipped, linked.summaryOnly) : null;
  const cut = result && result.ok && result.intent === "paste" && result.cut && checked === result.text ? NOTES.cut : null;
  const announce = fromLink && report.verdict ? ANNOUNCE.link(report.verdict.label) : "";

  const onPasteSubmit = (e: FormEvent<HTMLFormElement>) => {
    // With JavaScript the check runs here in the browser; nothing is sent.
    e.preventDefault();
    setChecked(text);
    requestAnimationFrame(focusResult);
  };

  const hero = (
    <ToolHero h1={TOOL.h1} intro={INTRO} timing={TOOL.timing}>
      <div className="tl-form tl-bot-forms">
        <form method="post" className="tl-bot-paste" onSubmit={hydrated ? onPasteSubmit : undefined}>
          <input type="hidden" name="intent" value="paste" />
          <HoneypotField />
          <TextArea name="text" label={FORM.textLabel} value={text} onChange={setText} rows={5} hint={hydrated ? FORM.live : undefined} />
          {pasteError ? <ToolError message={pasteError} /> : null}
          <div>
            <SubmitButton>{FORM.submit}</SubmitButton>
          </div>
        </form>
        <Form method="post" className="tl-bot-link">
          <input type="hidden" name="intent" value="fetch" />
          <HoneypotField />
          <div className="tl-form-row">
            <TextField name="url" label={FORM.urlLabel} placeholder={FORM.urlPlaceholder} defaultValue={postedUrl} required url />
            <SubmitButton busy={fetchBusy}>{FORM.urlSubmit}</SubmitButton>
          </div>
          {fetchError ? <ToolError message={fetchError} /> : null}
        </Form>
      </div>
      <p className="tl-note tl-bot-honest">
        <strong>{HONESTY.lead}</strong>
        {` ${HONESTY.rest}`}
      </p>
    </ToolHero>
  );

  return (
    <ToolShell
      page={TOOL}
      hero={hero}
      resultLabel="Your result"
      result={
        blocked ? (
          <div className="tl-card">
            <ResultHeading>{RESULT.blocked}</ResultHeading>
          </div>
        ) : (
          <>
            <CopyReportView report={report} sample={checked === SAMPLE_TEXT} note={fromLink ?? cut} />
            <RewriteExample />
          </>
        )
      }
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
                <a className="tl-bot-source" href={item.source.url} rel="noopener noreferrer" target="_blank">
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
