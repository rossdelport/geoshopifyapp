import type { ActionFunctionArgs, LinksFunction, MetaFunction } from "react-router";
import { data } from "react-router";
import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  Explainer,
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
import { BotTable, PastedResultView, SiteResultView, Sources, WithCode } from "../components/tools/crawler-result";
import { BOTS_CHECKED, checkBots, verdict, type SiteCheck } from "../lib/tools/crawler";
import {
  BOT_TABLE,
  CTA,
  EXPLAINERS,
  FAQS,
  FORM,
  INTRO,
  MAX_PASTE,
  PASTE_TOO_LONG,
  RESULT,
  SAMPLE_LABEL,
  SAMPLE_RESULT_LABEL,
  SITE_COPY,
  WHAT_IT_CHECKS,
  howItWorks,
} from "../lib/tools/copy/ai-crawler-checker";
import { PASTE_PATHS, SAMPLE_ROBOTS } from "../lib/tools/samples/crawler-sample";
import { formatUpdated } from "../lib/tools/format";
import { noStore, toolHeaders } from "../lib/tools/http";
import { toolBySlug } from "../lib/tools/registry";
import { pageMeta, toolJsonLd } from "../lib/tools/seo";
import { normalizeSiteInput } from "../lib/tools/site-input";
import { checkSite } from "../lib/tools/crawler.server";
import { PASTE_FORM_BYTES, startToolPost } from "../lib/tools/guard.server";
import { LIMIT_STATUS, TOOL_LIMITS, takeToolSlot } from "../lib/tools/limits.server";
import crawlerCss from "../styles/tool-crawler.css?url";

// The AI Crawler Checker (docs/tools/spec.md T2): which AI bots a site's robots.txt lets in, the line that
// blocks each one, and the lines to delete on Shopify. Two forms: a website (the server reads its live
// robots.txt and home page, POST only) and a pasted robots.txt (checked live in the browser as people
// type; without JavaScript the form posts here once and the page comes back with the result).
// On load, the paste card shows a made-up sample and its result, labelled as an example.

const TOOL = toolBySlug("ai-crawler-checker");

export const meta: MetaFunction = () =>
  pageMeta({
    path: TOOL.path,
    title: TOOL.title,
    description: TOOL.description,
    image: TOOL.ogImage,
    imageAlt: TOOL.ogAlt,
    jsonLd: toolJsonLd(TOOL, FAQS),
  });

export const links: LinksFunction = () => [{ rel: "stylesheet", href: crawlerCss }];

export const headers = toolHeaders;

type ActionData =
  | { ok: true; intent: "fetch"; url: string; site: SiteCheck | null }
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
    // Browsers send a text box's line breaks as CRLF but count them as one character for maxLength.
    const text = String(form.get("text") ?? "").replace(/\r\n?/g, "\n");
    if (trapped) return reply({ ok: true, intent: "paste", text: null });
    if (text.length > MAX_PASTE) return reply({ ok: false, intent: "paste", text: text.slice(0, MAX_PASTE), error: PASTE_TOO_LONG }, 400);
    const slot = takeToolSlot("crawler-paste", ipHash, TOOL_LIMITS.paste);
    if (!slot.ok) return reply({ ok: false, intent: "paste", text, error: slot.error }, LIMIT_STATUS);
    // The page reads the text itself (crawler.ts runs on the server's render too).
    return reply({ ok: true, intent: "paste", text });
  }

  const url = String(form.get("url") ?? "").slice(0, 2_000);
  if (trapped) return reply({ ok: true, intent: "fetch", url, site: null });
  const input = normalizeSiteInput(url);
  if (!input.ok) return reply({ ok: false, intent: "fetch", url, error: input.error }, 400);
  const slot = takeToolSlot("crawler", ipHash, TOOL_LIMITS.crawler);
  if (!slot.ok) return reply({ ok: false, intent: "fetch", url, error: slot.error }, LIMIT_STATUS);
  const out = await checkSite(input);
  if (!out.ok) return reply({ ok: false, intent: "fetch", url, error: out.error }, 502);
  return reply({ ok: true, intent: "fetch", url, site: out.site });
}

/** Focus the result's heading (the verdict), as useToolSubmit does for posted results. */
function focusResult() {
  document.querySelector<HTMLElement>(".tl-result [data-tl-focus]")?.focus();
}

export default function AiCrawlerChecker() {
  const { Form, data: result, busy, fetcher } = useToolSubmit<ActionData>();
  const hydrated = useHydrated();

  // A pasted file that came back from a no-JavaScript post fills the box; otherwise the sample does.
  const posted = result && result.intent === "paste" && typeof result.text === "string" ? result.text : null;
  const [text, setText] = useState(posted ?? SAMPLE_ROBOTS);
  const [checked, setChecked] = useState(text);
  useEffect(() => {
    if (text === checked) return;
    const t = setTimeout(() => setChecked(text), 250);
    return () => clearTimeout(t);
  }, [text, checked]);
  const pastedReport = useMemo(() => checkBots(checked.slice(0, MAX_PASTE), PASTE_PATHS), [checked]);

  const site = result && result.ok && result.intent === "fetch" ? result.site : null;
  // After a site result, "Test a robots.txt" brings the paste card back; a new site result hides it again.
  const [pasteOpen, setPasteOpen] = useState(false);
  const lastSite = useRef(fetcher.data);
  useEffect(() => {
    if (fetcher.data === lastSite.current) return;
    lastSite.current = fetcher.data;
    setPasteOpen(false);
  }, [fetcher.data]);
  const showSite = site && !pasteOpen ? site : null;

  const fetchBusy = busy && fetcher.formData?.get("intent") === "fetch";
  const fetchError = result && !result.ok && result.intent === "fetch" ? result.error : null;

  // useToolSubmit moves focus to the result heading when an answer arrives, but not after an error: that
  // heading is still the sample's, and reading out its verdict would sound like theirs. Send focus to the
  // address box instead and keep it in view (the error under it is read out too).
  useEffect(() => {
    const d = fetcher.data;
    if (fetcher.state !== "idle" || !d || d.ok || d.intent !== "fetch") return;
    const box = document.querySelector<HTMLInputElement>('.tl-form input[name="url"]');
    box?.focus({ preventScroll: true });
    box?.scrollIntoView({ block: "center" });
  }, [fetcher.state, fetcher.data]);
  // The text box stops at MAX_PASTE characters, so a longer file is cut short without a word: say so.
  const pasteError = result && !result.ok && result.intent === "paste" ? result.error : hydrated && text.length >= MAX_PASTE ? PASTE_TOO_LONG : null;
  const postedUrl = result && result.intent === "fetch" ? result.url : undefined;
  const announce = showSite ? `${RESULT.ready} ${showSite.report ? verdict(showSite.report).headline : SITE_COPY.couldNotRead}.` : "";

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
    <div className="tl-card tl-card-soft tl-crawler-paste" id="paste">
      {text === SAMPLE_ROBOTS ? <SampleLabel>{SAMPLE_LABEL}</SampleLabel> : null}
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
            <SiteResultView site={showSite} />
            <p className="tl-crawler-back">
              {FORM.backToPasteLead}{" "}
              <a href={`${TOOL.path}#paste`} onClick={openPaste}>
                {FORM.backToPaste}
              </a>
            </p>
          </>
        ) : (
          <>
            {pasteCard}
            <PastedResultView report={pastedReport} label={checked === SAMPLE_ROBOTS ? <SampleLabel>{SAMPLE_RESULT_LABEL}</SampleLabel> : undefined} />
          </>
        )
      }
      cta={CTA}
      announce={announce}
    >
      <WhatItChecks items={WHAT_IT_CHECKS} />
      {EXPLAINERS.map((e) => (
        <Explainer key={e.id} id={e.id} question={e.question}>
          {e.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <Sources sources={e.sources} />
        </Explainer>
      ))}
      <Explainer id={BOT_TABLE.id} question={BOT_TABLE.heading}>
        <BotTable checked={formatUpdated(BOTS_CHECKED)} />
      </Explainer>
      <HowItWorks
        updated={TOOL.updated}
        items={howItWorks(formatUpdated(BOTS_CHECKED)).map((item) => (
          <Fragment key={item.text}>
            <WithCode text={item.text} />
            {item.source ? (
              <>
                {" "}
                <a className="tl-crawler-source" href={item.source.url} rel="noopener noreferrer" target="_blank">
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
