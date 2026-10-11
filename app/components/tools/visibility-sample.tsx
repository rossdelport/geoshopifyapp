// The AI Visibility Checker's on-load sample: a compact copy of the free check's report (/check/:id) for a
// made-up store, labelled as a sample. The product line, the ring (the share of answers that named the
// brand), a row per assistant, what the ring and the score mean (as on the real report), the top 3 brands
// named instead, the top 3 cited sites and the 3 questions.
// Every number comes from the report buildReport made (samples/visibility-sample.ts), never typed in.
// Cited sites show as plain text, not links: the sample's sites are made up. Styles: app/styles/tool-visibility.css.

import { PercentRing, formatPrice } from "../check-ui";
import { SampleLabel, StatusChip, type ChipTone } from "../tool-ui";
import { ENGINE_LABELS } from "../../lib/plans";
import { CHECK_ENGINES, type CheckProduct, type CheckQuestion, type CheckReport } from "../../lib/check-types";
import { SAMPLE, SAMPLE_LABEL, SOURCE_TYPE_CHIPS } from "../../lib/tools/copy/ai-visibility-checker";

// The report's label as a ring colour and a chip tone, as on the real report (check-ui.tsx): "Not named yet"
// is a plain fact, so it stays neutral.
const TONES: Record<string, { ring: string; chip: ChipTone }> = {
  "Not named yet": { ring: "grey", chip: "neutral" },
  "Rarely named": { ring: "amber", chip: "warn" },
  Weak: { ring: "amber", chip: "warn" },
  Growing: { ring: "blue", chip: "info" },
  Strong: { ring: "green", chip: "good" },
};

/** How many brands and sites the compact card lists (the full report lists up to 6 and 8). */
const TOP = 3;

export function VisibilitySample({
  report,
  product,
  questions,
}: {
  report: CheckReport;
  product: Pick<CheckProduct, "brand" | "title" | "price" | "currency">;
  questions: CheckQuestion[];
}) {
  const brand = product.brand || product.title;
  const price = formatPrice(product.price, product.currency);
  // The ring shows the same number as "Named in X of Y answers": the share of answers that named the brand.
  const pct = report.answerCount ? Math.round((report.namedCount / report.answerCount) * 100) : 0;
  const tone = TONES[report.label] ?? TONES.Growing;
  const rivals = report.competitors.slice(0, TOP);
  const sites = report.sources.slice(0, TOP);

  return (
    <div className="tl-card tl-vis">
      <SampleLabel>{SAMPLE_LABEL}</SampleLabel>

      <div className="tl-vis-product">
        <p className="ck-eyebrow">{brand}</p>
        <p className="tl-vis-title">
          {product.title}
          {price ? <span className="tl-vis-price">{price}</span> : null}
        </p>
      </div>

      <div className="tl-vis-score">
        <PercentRing value={pct} tone={tone.ring} caption={SAMPLE.ringCaption} label={SAMPLE.ring(brand, pct, report.namedCount, report.answerCount)} />
        <div className="tl-vis-head">
          <StatusChip tone={tone.chip}>{SAMPLE.scoreChip(report.label, report.score)}</StatusChip>
          <h2 className="ck-h2 tl-vis-h">{SAMPLE.named(report.namedCount, report.answerCount)}</h2>
          <p className="ck-muted tl-vis-sum">{report.summary}</p>
        </div>
      </div>

      <ul className="tl-vis-engines" aria-label={SAMPLE.byAssistant}>
        {CHECK_ENGINES.map((e) => {
          const s = report.byEngine[e];
          return (
            <li key={e}>
              <span className="ck-engine-n">
                <i className={`ck-dot is-${e}`} aria-hidden="true" />
                {ENGINE_LABELS[e]}
              </span>
              <span className="ck-track" aria-hidden="true">
                <i className={`is-${e}`} style={{ width: `${s.total ? Math.round((s.named / s.total) * 100) : 0}%` }} />
              </span>
              {!s.total ? (
                <StatusChip tone="neutral">{SAMPLE.engineNoAnswer}</StatusChip>
              ) : s.named ? (
                <StatusChip tone="good">{SAMPLE.engineNamed(s.named, s.total)}</StatusChip>
              ) : (
                <StatusChip tone="neutral">{SAMPLE.engineNotNamed(s.total)}</StatusChip>
              )}
            </li>
          );
        })}
      </ul>
      {report.answerCount ? (
        <p className="tl-small tl-vis-meaning">
          <b>{SAMPLE.meaningLead}</b> {SAMPLE.meaning(brand, report.score)}
        </p>
      ) : null}

      <div className="tl-vis-two">
        <section className="tl-vis-part" aria-labelledby="tl-vis-brands">
          <h3 className="ck-h3 tl-vis-part-h" id="tl-vis-brands">
            {SAMPLE.brandsHeading}
          </h3>
          {rivals.length ? (
            <ol className="tl-vis-list">
              {rivals.map((c, i) => (
                <li key={`${c.name}-${i}`}>
                  <span className="tl-vis-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="tl-vis-name">{c.name}</span>
                  <span className="tl-vis-count">{SAMPLE.brandCount(c.count, report.answerCount)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="tl-small">{SAMPLE.noBrands}</p>
          )}
        </section>

        <section className="tl-vis-part" aria-labelledby="tl-vis-sites">
          <h3 className="ck-h3 tl-vis-part-h" id="tl-vis-sites">
            {SAMPLE.sitesHeading}
          </h3>
          {sites.length ? (
            <ul className="tl-vis-list">
              {sites.map((s) => (
                <li key={s.domain}>
                  <span className="tl-vis-name tl-url">{s.domain}</span>
                  {s.isOwn ? <StatusChip tone="good">{SAMPLE.ownSite}</StatusChip> : <StatusChip tone="neutral">{SOURCE_TYPE_CHIPS[s.type] ?? SOURCE_TYPE_CHIPS.other}</StatusChip>}
                  <span className="tl-vis-count">{SAMPLE.siteCount(s.count)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tl-small">{SAMPLE.noSites}</p>
          )}
        </section>
      </div>

      <section className="tl-vis-part" aria-labelledby="tl-vis-qs">
        <h3 className="ck-h3 tl-vis-part-h" id="tl-vis-qs">
          {SAMPLE.questionsHeading(questions.length)}
        </h3>
        <p className="tl-small">{SAMPLE.questionsNote}</p>
        <ol className="tl-vis-qs">
          {questions.map((q) => (
            <li key={q.text}>&ldquo;{q.text}&rdquo;</li>
          ))}
        </ol>
      </section>

      <p className="tl-small tl-vis-more">{SAMPLE.more}</p>
    </div>
  );
}
