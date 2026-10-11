// AI Crawler Checker result pieces: the verdict, the pages tested, every bot in its group (blocked first,
// with the exact line that blocks it), the "Fix it on Shopify" box with the lines to delete, the
// "What robots.txt can't show" box, and the "Every bot we check" table. Plain presentational components:
// the same view renders a fetched site's report (server) and a pasted file's live report (browser).
// Styles: app/styles/tool-crawler.css (tl-crawler-*), on top of tools.css.

import { Fragment, type ReactNode } from "react";
import { CopyBox, ResultHeading, StatusChip, type ChipTone, type FaqSource } from "../tool-ui";
import { joinLabels } from "../../lib/robots";
import {
  BOT_GROUPS,
  TOOL_BOTS,
  VERDICT_COPY,
  botByToken,
  isShopifyKind,
  rowsIn,
  verdict,
  type BlockReason,
  type BotRow,
  type CrawlerReport,
  type SiteCheck,
  type Verdict,
} from "../../lib/tools/crawler";
import { BOT_TABLE, FIX, LIMITS, RESULT, SITE_COPY, fallbackLine, pagesLine } from "../../lib/tools/copy/ai-crawler-checker";

/** Text with `backticks` shown as code (copy strings only; never strangers' text). */
export function WithCode({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <code key={i} className="tl-crawler-code">
            {p}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

const sourceLabel = (s: FaqSource) => {
  if (s.label) return s.label;
  try {
    return new URL(s.url).hostname.replace(/^www\./, "");
  } catch {
    return s.url;
  }
};

/** "Source: OpenAI's crawler page" or "Sources: a, b": plain links to the primary sources. */
export function Sources({ sources }: { sources: readonly FaqSource[] }) {
  if (!sources.length) return null;
  return (
    <p className="tl-sources">
      {sources.length === 1 ? "Source: " : "Sources: "}
      {sources.map((s, i) => (
        <span key={s.url}>
          {i ? ", " : ""}
          <a href={s.url} rel="noopener noreferrer" target="_blank">
            {sourceLabel(s)}
          </a>
        </span>
      ))}
    </p>
  );
}

/** The chip beside the verdict. */
const CHIP: Record<Verdict["tone"], { tone: ChipTone; text: string }> = {
  good: { tone: "good", text: "All clear" },
  bad: { tone: "bad", text: "Action needed" },
  warn: { tone: "warn", text: "Couldn't check" },
};

// ---------- one bot ----------

function chipFor(row: BotRow): { tone: ChipTone; text: string } {
  const bot = botByToken(row.token)!;
  if (!row.blocked) return { tone: "good", text: RESULT.allowed };
  const blocked = row.pages.filter((p) => !p.allowed).length;
  const text = blocked === row.pages.length ? RESULT.blocked : RESULT.blockedSome(blocked, row.pages.length);
  // A training-only or "may ignore" bot being blocked is a choice, not a problem: grey, never red.
  const tone: ChipTone = bot.level === "info" ? "neutral" : bot.level === "low" ? "warn" : "bad";
  return { tone, text };
}

/** "Blocked by line 10: `Disallow: /products/` (in the `User-agent: PerplexityBot` group)" */
function RuleLine({ reason, labels }: { reason: BlockReason; labels?: string }) {
  return (
    <p className="tl-crawler-rule">
      Blocked by line {reason.rule.line}: <code className="tl-crawler-code">{reason.rule.text}</code> (in the{" "}
      <code className="tl-crawler-code">{reason.agent.text}</code> group){labels ? `, on ${labels}` : ""}.
    </p>
  );
}

function BotRowView({ row }: { row: BotRow }) {
  const bot = botByToken(row.token)!;
  const chip = chipFor(row);
  const blocked = row.pages.filter((p) => !p.allowed);
  const allowed = row.pages.filter((p) => p.allowed);
  // One line per rule that blocks it (several pages are often blocked by the same line).
  const rules = new Map<string, { reason: BlockReason; labels: string[] }>();
  for (const p of blocked) {
    if (!p.reason) continue;
    const key = `${p.reason.rule.line}:${p.reason.rule.text}`;
    const r = rules.get(key) ?? { reason: p.reason, labels: [] };
    r.labels.push(p.label);
    rules.set(key, r);
  }
  return (
    <li className={`tl-crawler-bot${row.blocked ? " is-blocked" : ""}`}>
      <div className="tl-crawler-bot-head">
        <p className="tl-crawler-bot-id">
          <a className="tl-crawler-bot-name" href={bot.docs} rel="noopener noreferrer" target="_blank">
            {bot.token}
          </a>
          <span className="tl-crawler-owner">{bot.owner}</span>
        </p>
        <span className="tl-crawler-chips">
          <StatusChip tone={chip.tone}>{chip.text}</StatusChip>
          {bot.mayIgnore ? <StatusChip tone="neutral">{RESULT.mayIgnore}</StatusChip> : null}
        </span>
      </div>
      <p className="tl-crawler-what">{bot.what}</p>
      {row.blocked ? (
        <div className="tl-crawler-why">
          <p>
            {pagesLine(false, joinLabels(blocked.map((p) => p.label)))}
            {allowed.length ? ` ${pagesLine(true, joinLabels(allowed.map((p) => p.label)))}` : ""}
          </p>
          {[...rules.values()].map((r) => (
            <RuleLine key={`${r.reason.rule.line}:${r.reason.rule.text}`} reason={r.reason} labels={rules.size > 1 ? joinLabels(r.labels) : undefined} />
          ))}
        </div>
      ) : null}
      {row.rulesFrom ? <p className="tl-crawler-note">{fallbackLine(bot.token, bot.owner, row.rulesFrom)}</p> : null}
    </li>
  );
}

// ---------- the report ----------

/**
 * A report: verdict (the result heading, which takes focus when a new result arrives), the training line,
 * notes, the pages tested, then the three groups of bots. `status` is a line about the file itself
 * ("You have no robots.txt file..."), `pasted` switches the words for a pasted file.
 */
export function CrawlerReportView({
  report,
  pasted = false,
  status,
  pathNote,
  checkedUrl,
  hostNote,
  label,
}: {
  report: CrawlerReport;
  pasted?: boolean;
  status?: string | null;
  pathNote?: string | null;
  /** The robots.txt address we read (site checks). */
  checkedUrl?: string;
  /** Why we read another address than the one typed (site checks). */
  hostNote?: string | null;
  /** Above the heading: the sample label, or nothing. */
  label?: ReactNode;
}) {
  const v = verdict(report);
  const chip = CHIP[v.tone];
  return (
    <div className="tl-card tl-crawler-report">
      {label}
      <div className="tl-crawler-verdict">
        <StatusChip tone={chip.tone}>{chip.text}</StatusChip>
        <ResultHeading>{v.headline}</ResultHeading>
        <p className="tl-crawler-lead">
          <WithCode text={v.training} />
        </p>
        {status && !report.tooComplex ? <p className="tl-crawler-lead">{status}</p> : null}
        {v.shopifyStandard ? <p className="tl-crawler-lead">{VERDICT_COPY.shopifyStandard}</p> : null}
        {checkedUrl ? (
          <p className="tl-small tl-url">
            We read <span className="tl-crawler-mono">{checkedUrl}</span>
          </p>
        ) : null}
        {hostNote ? <p className="tl-small">{hostNote}</p> : null}
      </div>
      {report.tooComplex ? null : <ReportDetail report={report} pasted={pasted} pathNote={pathNote} />}
    </div>
  );
}

/** The notes, the pages tested, the three groups of bots and the sitemaps. */
function ReportDetail({ report, pasted, pathNote }: { report: CrawlerReport; pasted: boolean; pathNote?: string | null }) {
  return (
    <>
      {report.notes.length ? (
        <ul className="tl-crawler-notes">
          {report.notes.map((n, i) => (
            <li key={`${n.id}-${i}`} className={`tl-crawler-notes-${n.tone}`}>
              {n.tone === "tip" ? <strong>Tip: </strong> : null}
              {n.text}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="tl-crawler-pages">
        <p className="tl-label">{pasted ? RESULT.pagesPasted : RESULT.pagesTested}</p>
        <ul>
          {report.paths.map((p) => (
            <li key={p.path} className="tl-crawler-page">
              <span>{p.label}</span> <span className="tl-crawler-mono tl-url">{p.path}</span>
            </li>
          ))}
        </ul>
        {pathNote ? <p className="tl-small">{pathNote}</p> : null}
      </div>
      {BOT_GROUPS.map((g) => (
        <section className="tl-crawler-group" key={g.id} aria-labelledby={`bots-${g.id}`}>
          <h3 className="ck-h3 tl-crawler-group-h" id={`bots-${g.id}`}>
            {g.heading}
          </h3>
          <ul className="tl-rows">
            {rowsIn(report, g.id).map((row) => (
              <BotRowView key={row.token} row={row} />
            ))}
          </ul>
        </section>
      ))}
      {report.sitemaps.length ? (
        <div className="tl-crawler-sitemaps">
          <p className="tl-label">{RESULT.sitemaps}</p>
          <ul>
            {report.sitemaps.map((s) => (
              <li key={s} className="tl-crawler-mono tl-url">
                {s}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/**
 * "Fix it on Shopify": shown when the site is on Shopify or a bot that matters is blocked. Lists the
 * exact lines to delete (never a new rule that blocks anything). A pasted file is treated as a Shopify
 * store's, since the tool is for Shopify stores.
 */
export function FixBox({ report, shopify, pasted = false }: { report: CrawlerReport; shopify: boolean; pasted?: boolean }) {
  const v = verdict(report);
  const onShopify = shopify || pasted;
  if (report.tooComplex || (!v.blocked && !shopify)) return null;
  if (!v.blocked) {
    // "Want Shopify's standard rules back?" only makes sense when the file isn't the standard one already
    // (the 2026 default; a store still serving the older layout has usually edited it).
    const custom = report.kind !== "shopify-new-default";
    return (
      <div className="tl-card tl-card-soft tl-crawler-box">
        <h3 className="ck-h3">{FIX.cleanTitle}</h3>
        <p>{FIX.cleanSteps}</p>
        {custom ? <p>{FIX.restore}</p> : null}
        <Sources sources={[FIX.restoreSource]} />
      </div>
    );
  }
  const code = report.deletions.map((l) => `Line ${l.line}: ${l.text}`).join("\n");
  return (
    <div className="tl-card tl-card-soft tl-crawler-box">
      <h3 className="ck-h3">{onShopify ? FIX.title : FIX.otherTitle}</h3>
      <p>{onShopify ? FIX.steps : FIX.otherSteps}</p>
      {code ? <CopyBox label={FIX.linesLabel} code={code} /> : null}
      {v.trainingBlocked ? <p className="tl-small">{FIX.trainingNote}</p> : null}
      {onShopify ? (
        <>
          <p>{FIX.noLiquid}</p>
          <p>{FIX.restore}</p>
          <Sources sources={[FIX.restoreSource]} />
        </>
      ) : null}
    </div>
  );
}

/** "What robots.txt can't show": always there, because a clean robots.txt is never the whole story. */
export function LimitsBox() {
  return (
    <div className="tl-card tl-card-soft tl-crawler-box">
      <h3 className="ck-h3">{LIMITS.title}</h3>
      <p>{LIMITS.text}</p>
      <Sources sources={LIMITS.sources} />
    </div>
  );
}

/** A fetched site's result: the report (or why we couldn't read the file), the fix box and the limits box. */
export function SiteResultView({ site }: { site: SiteCheck }) {
  if (!site.report) {
    const lines =
      site.status === "turned-away"
        ? [SITE_COPY.turnedAway(site.httpStatus ?? 403)]
        : [SITE_COPY.serverError(site.httpStatus ?? 500), SITE_COPY.serverErrorGoogle];
    return (
      <>
        <div className="tl-card tl-crawler-report">
          <div className="tl-crawler-verdict">
            <StatusChip tone={site.status === "turned-away" ? "bad" : "warn"}>{site.status === "turned-away" ? "Turned away" : "Server error"}</StatusChip>
            <ResultHeading>{SITE_COPY.couldNotRead}</ResultHeading>
            {lines.map((l) => (
              <p key={l} className="tl-crawler-lead">
                {l}
              </p>
            ))}
            <p className="tl-small tl-url">
              We tried <span className="tl-crawler-mono">{site.robotsUrl}</span>
            </p>
            {site.hostNote ? <p className="tl-small">{site.hostNote}</p> : null}
          </div>
        </div>
        <LimitsBox />
      </>
    );
  }
  const status = site.status === "no-file" ? (site.html ? SITE_COPY.htmlFile : SITE_COPY.noFile) : null;
  return (
    <>
      <CrawlerReportView report={site.report} status={status} pathNote={site.pathNote} checkedUrl={site.robotsUrl} hostNote={site.hostNote} />
      <FixBox report={site.report} shopify={site.shopify} />
      <LimitsBox />
    </>
  );
}

/** A pasted file's result (also the on-load sample). */
export function PastedResultView({ report, label }: { report: CrawlerReport; label?: ReactNode }) {
  return (
    <>
      <CrawlerReportView report={report} pasted label={label} />
      <FixBox report={report} shopify={isShopifyKind(report.kind)} pasted />
      <LimitsBox />
    </>
  );
}

/** "Every bot we check": every bot in TOOL_BOTS with its company, what it does and a link to its docs. */
export function BotTable({ checked }: { checked: string }) {
  return (
    <div className="tl-crawler-table-wrap">
      <table className="tl-crawler-table">
        <caption>{BOT_TABLE.caption(checked)}</caption>
        <thead>
          <tr>
            {BOT_TABLE.columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TOOL_BOTS.map((b) => (
            <tr key={b.token}>
              <th scope="row">
                <a href={b.docs} rel="noopener noreferrer" target="_blank">
                  {b.token}
                </a>
              </th>
              <td>{b.owner}</td>
              <td>{b.what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
