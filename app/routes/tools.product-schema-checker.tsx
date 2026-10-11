import type { ActionFunctionArgs, LinksFunction, MetaFunction } from "react-router";
import { data } from "react-router";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  HoneypotField,
  HowItWorks,
  RelatedTools,
  SampleLabel,
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
import { SchemaReportView } from "../components/tools/schema-result";
import { checkSchema } from "../lib/tools/schema";
import {
  CTA,
  FAQS,
  FORM,
  HOW_IT_WORKS,
  INTRO,
  MAX_PASTE,
  PASTE_EMPTY,
  PASTE_TOO_LONG,
  RESULT,
  SAMPLE_LABEL,
  URL_COPY,
  WHAT_IT_CHECKS,
} from "../lib/tools/copy/product-schema-checker";
import { SAMPLE_JSON } from "../lib/tools/samples/schema-sample";
import { NOT_YOUR_STORE, normalizeCheckUrl } from "../lib/check-read";
import { noStore, toolHeaders } from "../lib/tools/http";
import { toolBySlug } from "../lib/tools/registry";
import { pageMeta, toolJsonLd } from "../lib/tools/seo";
import { checkProductUrl, type UrlCheck } from "../lib/tools/schema.server";
import { PASTE_FORM_BYTES, startToolPost } from "../lib/tools/guard.server";
import { LIMIT_STATUS, TOOL_LIMITS, takeToolSlot } from "../lib/tools/limits.server";
import schemaCss from "../styles/tool-schema.css?url";

// The Product Schema Checker (docs/tools/spec.md T3): which product facts Google and AI shopping tools can
// read from a product page's JSON-LD, what's missing, and where to fix it in Shopify. Two forms: a product
// link (the server reads the page and, on Shopify, the store's product record; POST only) and pasted JSON-LD
// or HTML (checked live in the browser as people type; without JavaScript the form posts here once and the
// page comes back with the result). On load, the paste card shows a made-up sample and its result.

const TOOL = toolBySlug("product-schema-checker");

export const meta: MetaFunction = () =>
  pageMeta({
    path: TOOL.path,
    title: TOOL.title,
    description: TOOL.description,
    image: TOOL.ogImage,
    imageAlt: TOOL.ogAlt,
    jsonLd: toolJsonLd(TOOL, FAQS),
  });

export const links: LinksFunction = () => [{ rel: "stylesheet", href: schemaCss }];

export const headers = toolHeaders;

type ActionData =
  | { ok: true; intent: "fetch"; url: string; check: UrlCheck | null }
  | { ok: true; intent: "paste"; text: string | null }
  | { ok: false; intent: "fetch"; url: string; error: string }
  | { ok: false; intent: "paste"; text: string; error: string };

const reply = (body: ActionData, status = 200) => data(body, { status, headers: noStore });

/**
 * Both forms post here. Order (spec 4.2): other websites (403) and big bodies (413), the honeypot (the
 * normal empty result: the page shows its sample), the input, the limits, then the work.
 */
export async function action({ request }: ActionFunctionArgs) {
  const start = await startToolPost(request, PASTE_FORM_BYTES);
  if (!start.ok) return reply({ ok: false, intent: "fetch", url: "", error: start.error }, start.status);
  const { form, ipHash, trapped } = start;

  if (form.get("intent") === "paste") {
    const text = String(form.get("text") ?? "");
    if (trapped) return reply({ ok: true, intent: "paste", text: null });
    if (text.length > MAX_PASTE) return reply({ ok: false, intent: "paste", text: text.slice(0, MAX_PASTE), error: PASTE_TOO_LONG }, 400);
    if (!text.trim()) return reply({ ok: false, intent: "paste", text, error: PASTE_EMPTY }, 400);
    const slot = takeToolSlot("schema-paste", ipHash, TOOL_LIMITS.paste);
    if (!slot.ok) return reply({ ok: false, intent: "paste", text, error: slot.error }, LIMIT_STATUS);
    // The page checks the text itself (schema.ts runs on the server's render too).
    return reply({ ok: true, intent: "paste", text });
  }

  const url = String(form.get("url") ?? "").slice(0, 2_000);
  if (trapped) return reply({ ok: true, intent: "fetch", url, check: null });
  const input = normalizeCheckUrl(url);
  if (!input.ok) return reply({ ok: false, intent: "fetch", url, error: input.error === NOT_YOUR_STORE ? URL_COPY.marketplace : input.error }, 400);
  const slot = takeToolSlot("schema", ipHash, TOOL_LIMITS.schema);
  if (!slot.ok) return reply({ ok: false, intent: "fetch", url, error: slot.error }, LIMIT_STATUS);
  const out = await checkProductUrl(input.url);
  if (!out.ok) return reply({ ok: false, intent: "fetch", url, error: out.error }, out.status);
  return reply({ ok: true, intent: "fetch", url, check: out.check });
}

/** Focus the result's heading (the verdict), as useToolSubmit does for posted results. */
function focusResult() {
  document.querySelector<HTMLElement>(".tl-result [data-tl-focus]")?.focus();
}

export default function ProductSchemaChecker() {
  const { Form, data: result, busy, fetcher } = useToolSubmit<ActionData>();
  const hydrated = useHydrated();

  // Pasted data that came back from a no-JavaScript post fills the box; otherwise the sample does.
  const posted = result && result.intent === "paste" && typeof result.text === "string" ? result.text : null;
  const [text, setText] = useState(posted ?? SAMPLE_JSON);
  const [checked, setChecked] = useState(text);
  useEffect(() => {
    if (text === checked) return;
    const t = setTimeout(() => setChecked(text), 250);
    return () => clearTimeout(t);
  }, [text, checked]);
  const tooLong = checked.length > MAX_PASTE;
  // An empty box shows no result (not "no product data found").
  const pastedReport = useMemo(() => (tooLong || !checked.trim() ? null : checkSchema(checked)), [checked, tooLong]);

  const check = result && result.ok && result.intent === "fetch" ? result.check : null;
  // After a link result, "Paste product data" brings the paste card back; a new link result hides it again.
  const [pasteOpen, setPasteOpen] = useState(false);
  const lastCheck = useRef(fetcher.data);
  useEffect(() => {
    if (fetcher.data === lastCheck.current) return;
    lastCheck.current = fetcher.data;
    setPasteOpen(false);
  }, [fetcher.data]);
  const showCheck = check && !pasteOpen ? check : null;

  // A link error shows next to the form. useToolSubmit leaves focus alone after an error (the result heading
  // still shows the example), so put it in the link box: the page stays by the message, and people can fix
  // the link straight away.
  useEffect(() => {
    const d = fetcher.data;
    if (fetcher.state !== "idle" || !d || d.ok || d.intent !== "fetch") return;
    document.querySelector<HTMLInputElement>('.tl-form input[name="url"]')?.focus();
  }, [fetcher.state, fetcher.data]);

  const fetchBusy = busy && fetcher.formData?.get("intent") === "fetch";
  const fetchError = result && !result.ok && result.intent === "fetch" ? result.error : null;
  const pasteError = result && !result.ok && result.intent === "paste" && text === result.text ? result.error : null;
  const postedUrl = result && result.intent === "fetch" ? result.url : undefined;
  const announce = showCheck ? `${RESULT.ready} ${showCheck.report.verdict.headline}` : "";

  const onPasteSubmit = (e: FormEvent<HTMLFormElement>) => {
    // With JavaScript the check runs here in the browser; nothing is sent.
    e.preventDefault();
    setChecked(text);
    requestAnimationFrame(focusResult);
  };
  const openPaste = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setPasteOpen(true);
    requestAnimationFrame(() => document.getElementById("paste")?.scrollIntoView({ block: "start" }));
  };

  const hero = (
    <ToolHero h1={TOOL.h1} intro={INTRO} timing={TOOL.timing}>
      <Form method="post" className="tl-form">
        <input type="hidden" name="intent" value="fetch" />
        <HoneypotField />
        <div className="tl-form-row">
          <TextField name="url" label={FORM.urlLabel} placeholder={FORM.urlPlaceholder} defaultValue={postedUrl} required url />
          <SubmitButton busy={fetchBusy}>{FORM.submit}</SubmitButton>
        </div>
        {fetchError ? <ToolError message={fetchError} /> : null}
      </Form>
    </ToolHero>
  );

  const pasteCard = (
    <div className="tl-card tl-card-soft tl-schema-paste" id="paste">
      {text === SAMPLE_JSON ? <SampleLabel>{SAMPLE_LABEL}</SampleLabel> : null}
      <form method="post" onSubmit={hydrated ? onPasteSubmit : undefined}>
        <input type="hidden" name="intent" value="paste" />
        <HoneypotField />
        <TextArea name="text" label={FORM.pasteLabel} value={text} onChange={setText} rows={12} code hint={hydrated ? FORM.pasteLive : undefined} />
        {pasteError ? <ToolError message={pasteError} /> : tooLong ? <ToolError message={PASTE_TOO_LONG} /> : null}
        <div>
          <SubmitButton>{FORM.pasteSubmit}</SubmitButton>
        </div>
      </form>
    </div>
  );

  return (
    <ToolShell
      page={TOOL}
      hero={hero}
      resultLabel="Your result"
      result={
        showCheck ? (
          <>
            <SchemaReportView report={showCheck.report} readLine={`${RESULT.readPage(showCheck.url)}${showCheck.record ? ` ${RESULT.readRecord}` : ""}.`} />
            <p className="tl-schema-back">
              {FORM.backLead}{" "}
              <a href={`${TOOL.path}#paste`} onClick={openPaste}>
                {FORM.back}
              </a>
            </p>
          </>
        ) : (
          <>
            {pasteCard}
            {pastedReport && !pasteError ? <SchemaReportView report={pastedReport} /> : null}
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
                <a className="tl-schema-source" href={item.source.url} rel="noopener noreferrer" target="_blank">
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
