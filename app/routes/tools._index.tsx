import type { MetaFunction } from "react-router";
import { ToolCard, ToolHero, ToolShell, UpdatedLine } from "../components/tool-ui";
import { HUB, TOOL_GROUPS, toolBySlug } from "../lib/tools/registry";
import { hubJsonLd, pageMeta } from "../lib/tools/seo";
import { toolHeaders } from "../lib/tools/http";

// The hub at /tools: every free tool in three groups, where to start, and the one button.
// Copy: docs/tools/spec.md section 6. Each tool page links back here (breadcrumb, pill, "See all free tools").

export const meta: MetaFunction = () =>
  pageMeta({
    path: HUB.path,
    title: HUB.title,
    description: HUB.description,
    image: HUB.ogImage,
    imageAlt: HUB.ogAlt,
    jsonLd: hubJsonLd(),
  });

export const headers = toolHeaders;

const HUB_CTA = { text: "See how GEO works", href: "/?ref=tools-hub#how" };

export default function ToolsHub() {
  const visibility = toolBySlug("ai-visibility-checker");
  const crawler = toolBySlug("ai-crawler-checker");
  return (
    <ToolShell
      page={HUB}
      hero={<ToolHero h1={HUB.h1} intro={HUB.intro} />}
      resultLabel="All free tools"
      result={
        <>
          {TOOL_GROUPS.map((g) => (
            <section className="tl-hub-group" key={g.id} aria-labelledby={`group-${g.id}`}>
              <h2 className="ck-h2" id={`group-${g.id}`}>
                {g.heading}
              </h2>
              <ul className="tl-cards tl-hub-cards">
                {g.slugs.map((s) => (
                  <ToolCard key={s} tool={toolBySlug(s)} />
                ))}
              </ul>
            </section>
          ))}
          <section className="tl-sec" aria-labelledby="where-to-start">
            <h2 className="ck-h2" id="where-to-start">
              Where to start
            </h2>
            <p className="tl-start">
              Not sure? Start with the <a href={visibility.path}>{visibility.name}</a> to see if AI recommends your
              product today. Then check that AI bots can read your store with the <a href={crawler.path}>{crawler.name}</a>.
            </p>
          </section>
        </>
      }
      cta={HUB_CTA}
    >
      <UpdatedLine date={HUB.updated} />
    </ToolShell>
  );
}
