import type { LinksFunction, MetaFunction } from "react-router";
import { CheckForm } from "../components/check-ui";
import { HowItWorks, RelatedTools, ToolFaq, ToolHero, ToolShell, UpdatedLine, WhatItChecks } from "../components/tool-ui";
import { VisibilitySample } from "../components/tools/visibility-sample";
import { CTA, FAQS, HOW_IT_WORKS, INTRO, SAMPLE, WHAT_IT_CHECKS } from "../lib/tools/copy/ai-visibility-checker";
import { SAMPLE_PRODUCT, SAMPLE_QUESTIONS, SAMPLE_REPORT } from "../lib/tools/samples/visibility-sample";
import { toolHeaders } from "../lib/tools/http";
import { toolBySlug } from "../lib/tools/registry";
import { pageMeta, toolJsonLd } from "../lib/tools/seo";
import visibilityCss from "../styles/tool-visibility.css?url";

// The AI Visibility Checker (docs/tools/spec.md T7): the search landing page for the free product check.
// No server code of its own: the form is the free check's CheckForm, a plain <form method="post"
// action="/check"> that works without JavaScript, keeps the check's limits and honeypot, and redirects to
// the report at /check/:id (errors show on /check). /check keeps working for the home page form and points
// its canonical here, so this is the one page search engines list (spec decision R1).
// On load: a sample report for a made-up store, labelled as such (spec 0.8 and R5).
// No trust line under the form: CheckForm's own hint already says "Free. No sign-up." and the intro says how
// long it takes ("a few minutes", like the registry's timing), so the line would repeat both.

const TOOL = toolBySlug("ai-visibility-checker");

export const meta: MetaFunction = () =>
  pageMeta({
    path: TOOL.path,
    title: TOOL.title,
    description: TOOL.description,
    image: TOOL.ogImage,
    imageAlt: TOOL.ogAlt,
    jsonLd: toolJsonLd(TOOL, FAQS),
  });

export const links: LinksFunction = () => [{ rel: "stylesheet", href: visibilityCss }];

export const headers = toolHeaders;

export default function AiVisibilityChecker() {
  return (
    <ToolShell
      page={TOOL}
      hero={
        <ToolHero h1={TOOL.h1} intro={INTRO}>
          <CheckForm />
        </ToolHero>
      }
      resultLabel={SAMPLE.region}
      result={<VisibilitySample report={SAMPLE_REPORT} product={SAMPLE_PRODUCT} questions={SAMPLE_QUESTIONS} />}
      cta={CTA}
    >
      <WhatItChecks items={WHAT_IT_CHECKS} />
      <HowItWorks items={HOW_IT_WORKS} updated={TOOL.updated} />
      <ToolFaq faqs={FAQS} />
      <RelatedTools slugs={TOOL.related} />
      <UpdatedLine date={TOOL.updated} />
    </ToolShell>
  );
}
