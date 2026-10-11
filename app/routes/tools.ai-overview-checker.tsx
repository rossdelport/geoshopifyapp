import { useRef } from "react";
import type { ActionFunctionArgs, LinksFunction, MetaFunction } from "react-router";
import { data } from "react-router";
import {
  HoneypotField,
  HowItWorks,
  RelatedTools,
  SubmitButton,
  TextField,
  ToolError,
  ToolFaq,
  ToolHero,
  ToolShell,
  UpdatedLine,
  WhatItChecks,
  useToolSubmit,
} from "../components/tool-ui";
import { AioResultView } from "../components/tools/aio-result";
import { checkQuery, matchDomain, type AioMatch, type AioResult } from "../lib/tools/aio";
import { checkAio } from "../lib/tools/aio.server";
import { ANNOUNCE, CTA, EXAMPLES, FAQS, FORM, HOW_IT_WORKS, INTRO, WHAT_IT_CHECKS } from "../lib/tools/copy/ai-overview-checker";
import { URL_FORM_BYTES, startToolPost } from "../lib/tools/guard.server";
import { noStore, toolHeaders } from "../lib/tools/http";
import { toolBySlug } from "../lib/tools/registry";
import { AIO_SAMPLE } from "../lib/tools/samples/aio-sample";
import { pageMeta, toolJsonLd } from "../lib/tools/seo";
import { normalizeSiteInput } from "../lib/tools/site-input";
import aioCss from "../styles/tool-aio.css?url";

// AI Overview Checker (docs/tools/spec.md T1): type a shopping search, see if Google answered with an AI
// Overview, which sites it cited, and whether the visitor's site is one of them. The page loads with a
// real example search (labelled, with its date). The form is a real POST form: without JavaScript the
// action answers with the whole page; with JavaScript a fetcher swaps only the result (no new URL).
// Only POSTs search Google (links and crawlers can't spend money), through aio.server.ts.

const tool = toolBySlug("ai-overview-checker");

export const meta: MetaFunction = () =>
  pageMeta({
    path: tool.path,
    title: tool.title,
    description: tool.description,
    image: tool.ogImage,
    imageAlt: tool.ogAlt,
    jsonLd: toolJsonLd(tool, FAQS),
  });

export const links: LinksFunction = () => [{ rel: "stylesheet", href: aioCss }];

export const headers = toolHeaders;

export type AioActionData =
  | { ok: true; result: AioResult; match: AioMatch | null; domainError: string | null; query: string; domain: string }
  /** The spam trap was filled: nothing to show, nothing searched. */
  | { ok: true; result: null; query: string; domain: string }
  | { ok: false; error: string; query: string; domain: string };

const reply = (body: AioActionData, status = 200) => data(body, { status, headers: noStore });

export async function action({ request }: ActionFunctionArgs) {
  const start = await startToolPost(request, URL_FORM_BYTES);
  if (!start.ok) return reply({ ok: false, error: start.error, query: "", domain: "" }, start.status);
  const { form } = start;
  // An example button sends its search as `example` (it skips the browser's "required" check on the box).
  const example = String(form.get("example") ?? "");
  const typed = String(form.get("q") ?? "");
  const domain = String(form.get("domain") ?? "").trim().slice(0, 2_000);
  const asked = (example.trim() ? example : typed).slice(0, 2_000);
  if (start.trapped) return reply({ ok: true, result: null, query: asked, domain });

  const q = checkQuery(asked);
  if (!q.ok) return reply({ ok: false, error: q.error, query: asked, domain }, 400);

  // A website that can't be read doesn't stop the search: the "Your site" line is left out.
  let host: string | null = null;
  let domainError: string | null = null;
  if (domain) {
    const site = normalizeSiteInput(domain);
    if (site.ok) host = site.host;
    else domainError = site.error;
  }

  const out = await checkAio(q.query, start.ipHash);
  if (!out.ok) return reply({ ok: false, error: out.error, query: q.query, domain }, out.status);
  return reply({ ok: true, result: out.result, match: host ? matchDomain(out.result, host) : null, domainError, query: q.query, domain });
}

export default function AiOverviewChecker() {
  const { Form, data: reply, busy } = useToolSubmit<AioActionData>();
  const queryBox = useRef<HTMLDivElement>(null);
  const live = reply?.ok && reply.result ? reply : null;
  const error = reply && !reply.ok ? reply.error : null;

  /** With JavaScript, an example button also fills the search box, so the box matches the result. */
  const fillExample = (example: string) => {
    const input = queryBox.current?.querySelector<HTMLInputElement>('input[name="q"]');
    if (input) input.value = example;
  };

  return (
    <ToolShell
      page={tool}
      hero={
        <ToolHero h1={tool.h1} intro={INTRO} timing={tool.timing}>
          <Form method="post" className="tl-form tl-aio-form" aria-busy={busy || undefined}>
            <HoneypotField />
            <div ref={queryBox}>
              <TextField name="q" label={FORM.queryLabel} placeholder={FORM.queryPlaceholder} defaultValue={reply?.query ?? ""} required maxLength={200} />
            </div>
            <div className="tl-form-row">
              <TextField name="domain" label={FORM.domainLabel} placeholder={FORM.domainPlaceholder} defaultValue={reply?.domain ?? ""} url />
              <SubmitButton busy={busy} busyText={FORM.busy}>
                {FORM.submit}
              </SubmitButton>
            </div>
            <div className="tl-examples">
              <span>{FORM.examplesLabel}</span>
              {EXAMPLES.map((ex) => (
                <button key={ex} className="tl-example" type="submit" name="example" value={ex} formNoValidate disabled={busy} onClick={() => fillExample(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </Form>
        </ToolHero>
      }
      resultLabel="AI Overview result"
      result={
        <div className={busy ? "tl-aio-busy" : undefined}>
          {/* After a JavaScript run that failed, focus lands on the error, not on the example's heading below it. */}
          {error ? (
            <div className="tl-aio-error" tabIndex={-1} data-tl-focus="">
              <ToolError message={error} />
            </div>
          ) : null}
          {live ? <AioResultView result={live.result} match={live.match} domainError={live.domainError ?? undefined} /> : <AioResultView result={AIO_SAMPLE} sample />}
        </div>
      }
      cta={CTA}
      announce={busy ? ANNOUNCE.busy : live ? ANNOUNCE.ready : ""}
    >
      <WhatItChecks items={WHAT_IT_CHECKS} />
      <HowItWorks items={HOW_IT_WORKS} updated={tool.updated} />
      <ToolFaq faqs={FAQS} />
      <RelatedTools slugs={tool.related} />
      <UpdatedLine date={tool.updated} />
    </ToolShell>
  );
}
