// AI Bot Checker result pieces: the verdict (never a percentage, never "written by AI"), the text with its
// vague phrases marked, the phrases to rewrite (why and how), the 7 facts shoppers and AI assistants look
// for, the counts, the tips, and the static made-up before and after. Plain presentational components: the
// same view renders the on-load sample and posted text (server) and live typing (browser). The visitor's
// text is rendered as React text nodes, never as HTML (marks built like highlightSegments in check-ui.tsx).
// Styles: app/styles/tool-copy.css (tl-bot-*; tl-copy-* belongs to CopyBox in tools.css), on top of tools.css.

import { ResultHeading, SampleLabel, StatusChip, type ChipTone } from "../tool-ui";
import type { CopyFact, CopyNumbers, CopyPhrase, CopyReport, CopySegment } from "../../lib/tools/copy-check";
import { RESULT, SAMPLE_LABEL, VERDICT_CHIP, type VerdictId } from "../../lib/tools/copy/ai-bot-checker";
import { REWRITE_TEXT, SAMPLE_TEXT } from "../../lib/tools/samples/copy-sample";

const VERDICT_TONE: Record<VerdictId, ChipTone> = { specific: "good", mixed: "warn", generic: "bad" };

/** The checked text, vague phrases marked (the reason shows on hover and in the list below). */
function MarkedText({ segments }: { segments: CopySegment[] }) {
  return (
    <section className="tl-bot-sec" aria-labelledby="bot-text-h">
      <h3 className="ck-h3" id="bot-text-h">
        {RESULT.textHeading}
      </h3>
      {/* tabIndex: a long text scrolls inside its box, so keyboard users can scroll it */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be focusable */}
      <div className="tl-bot-text" tabIndex={0} role="region" aria-labelledby="bot-text-h">
        {segments.map((s, i) =>
          s.mark ? (
            <mark key={i} className={`tl-bot-mark is-${s.mark.kind}`} title={s.mark.why}>
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </div>
    </section>
  );
}

/** Phrases that share a reason, in one row (so the same advice isn't repeated five times). */
interface PhraseGroup {
  key: string;
  kind: CopyPhrase["kind"];
  why: string;
  how: string;
  phrases: CopyPhrase[];
}

function groupPhrases(phrases: CopyPhrase[]): PhraseGroup[] {
  const groups = new Map<string, PhraseGroup>();
  for (const p of phrases) {
    const key = `${p.kind}:${p.why}`;
    const g = groups.get(key);
    if (g) g.phrases.push(p);
    else groups.set(key, { key, kind: p.kind, why: p.why, how: p.how, phrases: [p] });
  }
  return [...groups.values()];
}

function PhraseList({ phrases }: { phrases: CopyPhrase[] }) {
  return (
    <section className="tl-bot-sec" aria-labelledby="bot-phrases-h">
      <h3 className="ck-h3" id="bot-phrases-h">
        {RESULT.phrasesHeading}
      </h3>
      <p className="tl-small">{RESULT.phrasesIntro}</p>
      <ul className="tl-rows">
        {groupPhrases(phrases).map((g) => (
          <li key={g.key} className="tl-bot-phrase">
            <p className="tl-bot-phrase-head">
              {g.phrases.map((p) => (
                <span key={p.key} className="tl-bot-phrase-item">
                  <mark className={`tl-bot-mark is-${p.kind}`}>{p.display}</mark>
                  {p.count > 1 ? <span className="tl-bot-count">{RESULT.times(p.count)}</span> : null}
                </span>
              ))}
              <span className="tl-bot-kind">{g.phrases.length > 1 ? RESULT.kindMany[g.kind] : RESULT.kind[g.kind]}</span>
            </p>
            <p className="tl-bot-why">{g.why}</p>
            <p className="tl-bot-how">{g.how}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FactList({ facts }: { facts: CopyFact[] }) {
  return (
    <section className="tl-bot-sec" aria-labelledby="bot-facts-h">
      <h3 className="ck-h3" id="bot-facts-h">
        {RESULT.factsHeading}
      </h3>
      <p className="tl-small">{RESULT.factsIntro}</p>
      <ul className="tl-rows">
        {facts.map((f) => (
          <li key={f.id} className="tl-bot-fact">
            <div className="tl-bot-fact-head">
              <p className="tl-bot-fact-label">{f.label}</p>
              <StatusChip tone={f.found ? "good" : "warn"}>{f.found ? RESULT.found : RESULT.missing}</StatusChip>
            </div>
            {f.found && f.match ? <p className="tl-bot-found">{RESULT.foundLine(f.match)}</p> : <p className="tl-bot-question">{f.question}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Counted, never estimated. Without English, only the words and sentences. */
function Numbers({ numbers, english }: { numbers: CopyNumbers; english: boolean }) {
  const rows: [string, string][] = [
    [RESULT.numbers.words, String(numbers.words)],
    [RESULT.numbers.sentences, String(numbers.sentences)],
    [RESULT.numbers.average, RESULT.wordsValue(numbers.averageSentence)],
    ...(english
      ? ([
          [RESULT.numbers.facts, RESULT.factsValue(numbers.facts)],
          [RESULT.numbers.vague, String(numbers.vague)],
        ] as [string, string][])
      : []),
  ];
  return (
    <section className="tl-bot-sec" aria-labelledby="bot-numbers-h">
      <h3 className="ck-h3" id="bot-numbers-h">
        {RESULT.numbersHeading}
      </h3>
      <dl className="tl-bot-numbers">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The whole result for one text. `sample`: the made-up example is in the box (it gets the grey chip).
 * `note`: where the text came from, or what we cut, shown under the verdict.
 */
export function CopyReportView({ report, sample = false, note }: { report: CopyReport; sample?: boolean; note?: string | null }) {
  const v = report.verdict;
  return (
    <div className="tl-card tl-bot-report">
      {sample ? <SampleLabel>{SAMPLE_LABEL}</SampleLabel> : null}
      <div className="tl-bot-verdict">
        {v ? <StatusChip tone={VERDICT_TONE[v.id]}>{VERDICT_CHIP[v.id]}</StatusChip> : null}
        <ResultHeading>{v ? v.label : report.empty ? RESULT.empty : RESULT.notEnglish}</ResultHeading>
        {v ? <p className="tl-bot-line">{v.line}</p> : null}
        {!report.empty && !report.english ? <p className="tl-small">{RESULT.notEnglishMore}</p> : null}
        {note ? <p className="tl-small tl-url">{note}</p> : null}
        {report.notes.map((n) => (
          <p key={n} className="tl-small">
            {n}
          </p>
        ))}
      </div>

      {v ? (
        report.flags.length ? (
          <>
            <MarkedText segments={report.segments} />
            <PhraseList phrases={report.phrases} />
          </>
        ) : (
          <p className="tl-bot-none">{RESULT.textNone}</p>
        )
      ) : null}
      {v ? <FactList facts={report.facts} /> : null}
      {!report.empty ? <Numbers numbers={report.numbers} english={report.english} /> : null}
      {report.tips.length ? (
        <section className="tl-bot-sec" aria-labelledby="bot-tips-h">
          <h3 className="ck-h3" id="bot-tips-h">
            {RESULT.tipsHeading}
          </h3>
          <ul className="tl-list">
            {report.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** The static before and after: the made-up sample, then the same product with plain facts. */
export function RewriteExample() {
  return (
    <section className="tl-card tl-card-soft tl-bot-rewrite" aria-labelledby="bot-rewrite-h">
      <h3 className="ck-h3" id="bot-rewrite-h">
        {RESULT.rewriteHeading}
      </h3>
      <p className="tl-small">{RESULT.rewriteNote}</p>
      <div className="tl-bot-ba">
        <div className="tl-bot-ba-col">
          <p className="tl-bot-ba-label">{RESULT.before}</p>
          <p className="tl-bot-ba-text">{SAMPLE_TEXT}</p>
        </div>
        <div className="tl-bot-ba-col is-after">
          <p className="tl-bot-ba-label">{RESULT.after}</p>
          <p className="tl-bot-ba-text">{REWRITE_TEXT}</p>
        </div>
      </div>
    </section>
  );
}
