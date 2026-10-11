// The AI Overview Checker's result: the verdict first, then the visitor's site, the start of the
// overview, every cited site in order, what it means, the normal results and "People also ask".
// The same component shows the on-load example (with its "Example" label) and a visitor's own search.
// Provider text is rendered as plain text by React (never as HTML). Styles: app/styles/tool-aio.css.

import { ResultHeading, SampleLabel, StatusChip, ToolError } from "../tool-ui";
import { formatUpdated } from "../../lib/tools/format";
import { toolBySlug } from "../../lib/tools/registry";
import { bestRank, isCited, meaningLines, sameSite, yourSiteLine, type AioMatch, type AioResult } from "../../lib/tools/aio";
import {
  ALSO_RANKS,
  CITED_MARK,
  MEANING,
  MEANING_HEADING,
  NEW_TAB,
  ORGANIC_HEADING,
  OVERVIEW,
  PAA_HEADING,
  PAA_LINK,
  SMALL_PRINT,
  SOURCES_HEADING,
  SOURCE_TYPE_CHIPS,
  TRACK_SOURCE,
  VERDICT,
  YOUR_SITE,
  liveLabel,
  sampleLabel,
} from "../../lib/tools/copy/ai-overview-checker";

const OUT = { rel: "nofollow noopener noreferrer", target: "_blank" } as const;

/** A link to another site, in a new tab, said out loud for screen readers. */
function OutLink({ href, children, className }: { href: string; children: string; className?: string }) {
  return (
    <a href={href} {...OUT} className={className}>
      {children}
      <span className="ck-sr"> {NEW_TAB}</span>
    </a>
  );
}

export function AioResultView({
  result,
  match = null,
  sample = false,
  domainError,
}: {
  result: AioResult;
  /** The visitor's website compared with the result, when they gave one. */
  match?: AioMatch | null;
  /** The on-load example (labelled as such). */
  sample?: boolean;
  /** Shown when the website couldn't be read; the search still ran. */
  domainError?: string;
}) {
  const checked = formatUpdated(result.checkedAt);
  const siteLine = match ? yourSiteLine(result, match) : null;
  const mine = (domain: string) => (match ? sameSite(domain, match.host) : false);
  const faqTool = toolBySlug("faq-schema-generator");

  return (
    <div className="tl-aio">
      <div className="tl-card tl-aio-main">
        {sample ? <SampleLabel>{sampleLabel(result.query, checked)}</SampleLabel> : <p className="tl-small tl-aio-search">{liveLabel(result.query, checked)}</p>}

        <div className="tl-verdict">
          <StatusChip tone={result.shown ? "good" : "neutral"}>{result.shown ? VERDICT.shownChip : VERDICT.noneChip}</StatusChip>
          <ResultHeading>{result.shown ? VERDICT.shown : VERDICT.none}</ResultHeading>
        </div>
        <p className="tl-aio-line">{VERDICT.line}</p>
        {result.aiMode ? <p className="tl-aio-line">{VERDICT.aiMode}</p> : null}

        {domainError ? <ToolError message={domainError} /> : null}
        {match && siteLine ? (
          <p className={`tl-aio-you${match.cited.length ? " is-cited" : ""}`}>
            <span className="tl-aio-you-label">
              {YOUR_SITE.label}: <span className="tl-url">{match.host}</span>
            </span>
            <span>{siteLine}</span>
          </p>
        ) : null}

        {result.shown ? (
          <>
            <section className="tl-aio-sec" aria-labelledby="aio-overview">
              <h3 className="ck-h3" id="aio-overview">
                {result.textCut ? OVERVIEW.headingStart : OVERVIEW.heading}
              </h3>
              <blockquote className="tl-aio-quote">
                <p>{result.text}</p>
              </blockquote>
              {result.provider === "crawl4ai" ? <p className="tl-small">{OVERVIEW.cutNote}</p> : null}
            </section>

            <section className="tl-aio-sec" aria-labelledby="aio-sources">
              <h3 className="ck-h3" id="aio-sources">
                {SOURCES_HEADING}
              </h3>
              {result.sources.length ? (
                <ol className="tl-aio-sources">
                  {result.sources.map((s, i) => {
                    const rank = bestRank(result, s.domain);
                    return (
                      <li key={`${i}-${s.url}`} className={`tl-aio-source${mine(s.domain) ? " is-mine" : ""}`}>
                        <span className="tl-aio-num" aria-hidden="true">
                          {i + 1}
                        </span>
                        <div className="tl-aio-source-body">
                          <p className="tl-aio-source-top">
                            <OutLink href={s.url} className="tl-aio-domain tl-url">
                              {s.domain}
                            </OutLink>
                            <StatusChip tone="neutral">{SOURCE_TYPE_CHIPS[s.type ?? "other"]}</StatusChip>
                            {rank ? <span className="tl-aio-tag">{ALSO_RANKS(rank)}</span> : null}
                            {mine(s.domain) ? <StatusChip tone="good">{YOUR_SITE.label}</StatusChip> : null}
                          </p>
                          {s.title && s.title !== s.domain ? <p className="tl-aio-title">{s.title}</p> : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="tl-aio-line">{OVERVIEW.noSources}</p>
              )}
            </section>
          </>
        ) : null}

        <section className="tl-aio-sec" aria-labelledby="aio-meaning">
          <h3 className="ck-h3" id="aio-meaning">
            {MEANING_HEADING}
          </h3>
          <ul className="tl-list tl-aio-meaning">
            {meaningLines(result).map((line) => (
              <li key={line}>
                {line}
                {line === MEANING.track ? (
                  <>
                    {" "}
                    <OutLink href={TRACK_SOURCE.url}>{TRACK_SOURCE.label}</OutLink>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      {result.organic.length || result.peopleAlsoAsk.length ? (
        <div className="tl-card tl-card-soft tl-aio-more">
          {result.organic.length ? (
            <section className="tl-aio-sec" aria-labelledby="aio-organic">
              <h3 className="ck-h3" id="aio-organic">
                {ORGANIC_HEADING}
              </h3>
              <ol className="tl-aio-organic">
                {result.organic.map((o) => (
                  <li key={`${o.position}-${o.url}`}>
                    <span className="tl-aio-rank">#{o.position}</span>
                    <OutLink href={o.url} className="tl-aio-domain tl-url">
                      {o.domain}
                    </OutLink>
                    {isCited(result, o.domain) ? <span className="tl-aio-tag is-cited">{CITED_MARK}</span> : null}
                    {mine(o.domain) ? <StatusChip tone="good">{YOUR_SITE.label}</StatusChip> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          {result.peopleAlsoAsk.length ? (
            <section className="tl-aio-sec" aria-labelledby="aio-paa">
              <h3 className="ck-h3" id="aio-paa">
                {PAA_HEADING}
              </h3>
              <ul className="tl-list">
                {result.peopleAlsoAsk.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              <p className="tl-aio-next">
                <a href={faqTool.path}>{PAA_LINK}</a>
              </p>
            </section>
          ) : null}
        </div>
      ) : null}

      <p className="tl-small tl-aio-print">{SMALL_PRINT}</p>
    </div>
  );
}
