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
import { EvidenceBox, PastedReportView, SiteReportView, Sources, StarterEditor, StarterPlaceholder } from "../components/tools/llms-result";
import { llmsReport, llmsVerdict, type LlmsSite } from "../lib/tools/llms";
import {
  CTA,
  FAQS,
  FORM,
  HOW_IT_WORKS,
  HOW_IT_WORKS_SOURCE,
  INTRO,
  MAX_PASTE,
  PASTE_TOO_LONG,
  RESULT,
  SAMPLE_LABEL,
  WHAT_IT_CHECKS,
} from "../lib/tools/copy/llms-txt-checker";
import { siteLlmsTxt } from "../lib/tools/site-files";
import { noStore, toolHeaders } from "../lib/tools/http";
import { toolBySlug } from "../lib/tools/registry";
import { pageMeta, toolJsonLd } from "../lib/tools/seo";
import { normalizeSiteInput } from "../lib/tools/site-input";
import { checkLlmsSite } from "../lib/tools/llms.server";
import { PASTE_FORM_BYTES, startToolPost } from "../lib/tools/guard.server";
import { LIMIT_STATUS, TOOL_LIMITS, takeToolSlot } from "../lib/tools/limits.server";
import llmsCss from "../styles/tool-llms.css?url";

// The llms.txt Checker (docs/tools/spec.md T5): a site's /llms.txt checked line by line against the
// llmstxt.org format, Shopify's automatic file spotted, /llms-full.txt and /agents.md noted, and a starter
// file built from the home page (plain, and as a Shopify llms.txt.liquid). Two forms: a website (the server
// reads the files and the home page, POST only) and a pasted llms.txt (checked live in the browser as people
// type; without JavaScript the form posts here once and the page comes back with the result).
// On load, the paste box holds this site's own /llms.txt (the real file, from site-files.ts) and its result.

const TOOL = toolBySlug("llms-txt-checker");
/** The on-load example: usegeo.app's own llms.txt, exactly as /llms.txt serves it. */
const SAMPLE = siteLlmsTxt();

export const meta: MetaFunction = () =>
  pageMeta({
    path: TOOL.path,
    title: TOOL.title,
    description: TOOL.description,
    image: TOOL.ogImage,
    imageAlt: TOOL.ogAlt,
    jsonLd: toolJsonLd(TOOL, FAQS),
  });

export const links: LinksFunction = () => [{ rel: "stylesheet", href: llmsCss }];

export const headers = toolHeaders;

type ActionData =
  | { ok: true; intent: "fetch"; url: string; site: LlmsSite | null }
  | { ok: true; intent: "paste"; text: string | null }
  | { ok: false; intent: "fetch"; url: string; error: string }
  /** `text` null: nothing to put back in the box (a body too big to read), so the example shows. */
  | { ok: false; intent: "paste"; text: string | null; error: string };

const reply = (body: ActionData, status = 200) => data(body, { status, headers: noStore });

/**
 * Both forms post here. Order (spec 4.2): other websites (403) and big bodies (413), the honeypot (the
 * normal empty result: the page shows its example), the input, the limits, then the work.
 */
export async function action({ request }: ActionFunctionArgs) {
  const start = await startToolPost(request, PASTE_FORM_BYTES);
  if (!start.ok) {
    // Only a pasted file can be that big (a long file in another alphabet can pass 1 MB once encoded), so a
    // 413 shows next to the paste box; another website's post (403) shows by the address field.
    if (start.status === 413) return reply({ ok: false, intent: "paste", text: null, error: start.error }, start.status);
    return reply({ ok: false, intent: "fetch", url: "", error: start.error }, start.status);
  }
  const { form, ipHash, trapped } = start;

  if (form.get("intent") === "paste") {
    const text = String(form.get("text") ?? "");
    if (trapped) return reply({ ok: true, intent: "paste", text: null });
    if (text.length > MAX_PASTE) return reply({ ok: false, intent: "paste", text: text.slice(0, MAX_PASTE), error: PASTE_TOO_LONG }, 400);
    const slot = takeToolSlot("llms-paste", ipHash, TOOL_LIMITS.paste);
    if (!slot.ok) return reply({ ok: false, intent: "paste", text, error: slot.error }, LIMIT_STATUS);
    // The page checks the text itself (llms.ts runs in the server's render too).
    return reply({ ok: true, intent: "paste", text });
  }

  const url = String(form.get("url") ?? "").slice(0, 2_000);
  if (trapped) return reply({ ok: true, intent: "fetch", url, site: null });
  const input = normalizeSiteInput(url);
  if (!input.ok) return reply({ ok: false, intent: "fetch", url, error: input.error }, 400);
  const slot = takeToolSlot("llms", ipHash, TOOL_LIMITS.llms);
  if (!slot.ok) return reply({ ok: false, intent: "fetch", url, error: slot.error }, LIMIT_STATUS);
  const out = await checkLlmsSite(input);
  if (!out.ok) return reply({ ok: false, intent: "fetch", url, error: out.error }, 502);
  return reply({ ok: true, intent: "fetch", url, site: out.site });
}

/** Focus the result's heading (the verdict), as useToolSubmit does for posted results. */
function focusResult() {
  document.querySelector<HTMLElement>(".tl-result [data-tl-focus]")?.focus();
}

export default function LlmsTxtChecker() {
  const { Form, data: result, busy, fetcher } = useToolSubmit<ActionData>();
  const hydrated = useHydrated();

  // A pasted file that came back from a no-JavaScript post fills the box; otherwise the example does.
  const posted = result && result.intent === "paste" && typeof result.text === "string" ? result.text : null;
  const [text, setText] = useState(posted ?? SAMPLE);
  const [checked, setChecked] = useState(text);
  useEffect(() => {
    if (text === checked) return;
    const t = setTimeout(() => setChecked(text), 250);
    return () => clearTimeout(t);
  }, [text, checked]);
  const pastedReport = useMemo(() => llmsReport(checked.slice(0, MAX_PASTE)), [checked]);

  const site = result && result.ok && result.intent === "fetch" ? result.site : null;
  // After a site result, "Paste an llms.txt" brings the paste box back; a new site result hides it again.
  const [pasteOpen, setPasteOpen] = useState(false);
  const lastSite = useRef(fetcher.data);
  useEffect(() => {
    if (fetcher.data === lastSite.current) return;
    lastSite.current = fetcher.data;
    setPasteOpen(false);
  }, [fetcher.data]);
  const showSite = site && !pasteOpen ? site : null;

  // useToolSubmit moves focus to the result heading when an answer arrives, but not after an error, which
  // shows under the address field instead: bring focus (and the page) there.
  useEffect(() => {
    const d = fetcher.data;
    if (fetcher.state !== "idle" || !d || d.ok || d.intent !== "fetch") return;
    document.querySelector<HTMLInputElement>('.tl-form input[name="url"]')?.focus();
  }, [fetcher.state, fetcher.data]);

  const fetchBusy = busy && fetcher.formData?.get("intent") === "fetch";
  const fetchError = result && !result.ok && result.intent === "fetch" ? result.error : null;
  const pasteError = result && !result.ok && result.intent === "paste" ? result.error : null;
  const postedUrl = result && result.intent === "fetch" ? result.url : undefined;
  const announce = showSite ? `${RESULT.ready} ${llmsVerdict(showSite.report).headline}` : "";

  const onPasteSubmit = (e: FormEvent<HTMLFormElement>) => {
    // With JavaScript the check runs here in the browser; nothing is sent.
    e.preventDefault();
    setChecked(text);
    requestAnimationFrame(focusResult);
  };
  const openPaste = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    setPasteOpen(true);
    // The link goes away with the site result, so focus moves to the paste box (keyboard users keep their place).
    requestAnimationFrame(() => {
      document.getElementById("paste")?.scrollIntoView({ block: "start" });
      document.querySelector<HTMLTextAreaElement>("#paste textarea")?.focus({ preventScroll: true });
    });
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
    <div className="tl-card tl-card-soft tl-llms-paste" id="paste">
      {text === SAMPLE ? <SampleLabel>{SAMPLE_LABEL}</SampleLabel> : null}
      <form method="post" onSubmit={hydrated ? onPasteSubmit : undefined}>
        <input type="hidden" name="intent" value="paste" />
        <HoneypotField />
        <TextArea
          name="text"
          label={FORM.pasteLabel}
          value={text}
          onChange={setText}
          rows={10}
          maxLength={MAX_PASTE}
          code
          hint={hydrated ? FORM.pasteLive : undefined}
        />
        {pasteError ? <ToolError message={pasteError} /> : null}
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
        showSite ? (
          <>
            <SiteReportView site={showSite} />
            <StarterEditor key={showSite.llmsUrl} site={showSite} />
            <p className="tl-llms-back">
              {FORM.backToPasteLead}{" "}
              <a href={`${TOOL.path}#paste`} onClick={openPaste}>
                {FORM.backToPaste}
              </a>
            </p>
            <EvidenceBox />
          </>
        ) : (
          <>
            {pasteCard}
            <PastedReportView report={pastedReport} />
            <StarterPlaceholder />
            <EvidenceBox />
          </>
        )
      }
      cta={CTA}
      announce={announce}
    >
      <WhatItChecks items={WHAT_IT_CHECKS} />
      <HowItWorks
        updated={TOOL.updated}
        items={HOW_IT_WORKS.map((item, i) => (
          <Fragment key={item}>
            {item}
            {i === 1 ? (
              <>
                {" "}
                <Sources sources={[HOW_IT_WORKS_SOURCE]} inline />
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
