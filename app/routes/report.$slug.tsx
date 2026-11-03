import { Fragment, useEffect, useState } from "react";
import type { HeadersFunction, LinksFunction, LoaderFunctionArgs, MetaFunction } from "react-router";
import { isRouteErrorResponse, useLoaderData, useRouteError } from "react-router";
import { getReport } from "../lib/store-report.server";
import { EASY_DIFFICULTY, SHOWN_MOVES, type MovePlace, type StoreReportData } from "../lib/store-report";
import { ENGINE_LABELS } from "../lib/plans";
import { publicHostRedirect } from "../lib/tools/host.server";
import { SECURITY_HEADERS } from "../lib/tools/http";
import styles from "../styles/report.css?url";

// A store's report for Ross's teardown videos (Ross, 3 Nov 2026): usegeo.app/report/<slug>. Ross films it on his
// phone with himself green-screened on top, tags the brand and DMs them the link, so it is phone first, every
// number on it is one we found, and the tone stays kind. It stands alone like the OpenSEO report it copies: no
// site menu, no price, no booking link and no call-to-action button (Ross does the ask out loud). The script,
// story tags and notes are for Admin > Reports only and never reach this page. Made by app/lib/store-report.server.ts.

/**
 * What the page shows: the report without Ross's script, tags and notes. `moves` holds only the moves on show;
 * the locked ones ("+N more moves") go out as their places only, so "view source" can't read them.
 */
type PageReport = Pick<
  StoreReportData,
  "store" | "checkedAt" | "questions" | "answers" | "named" | "rivals" | "rivalCount" | "sites" | "siteCount" | "searchWords" | "searches" | "picks" | "moves" | "months"
> & { locked: MovePlace[] };

// A list of what goes out, not a list of what stays in: anything added to the report later stays on the server
// until someone puts it here. (The loader's data is in the page's HTML too, so hiding it in the view isn't enough.)
function pageReport(d: StoreReportData): PageReport {
  const moves = d.moves ?? [];
  return {
    store: d.store,
    checkedAt: d.checkedAt,
    questions: d.questions ?? [],
    answers: d.answers ?? 0,
    named: d.named ?? 0,
    rivals: d.rivals ?? [],
    rivalCount: d.rivalCount ?? 0,
    sites: d.sites ?? [],
    siteCount: d.siteCount ?? 0,
    searchWords: d.searchWords ?? [],
    searches: d.searches ?? 0,
    picks: d.picks ?? null,
    moves: moves.slice(0, SHOWN_MOVES),
    locked: moves.slice(SHOWN_MOVES).map((m) => m.place),
    months: d.months ?? [],
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "3 Nov 2026" in Perth, where Ross is. Our own month names: some browsers write "Sept" in Australian English,
// and the date is made on the server so the page never changes when it loads.
function checkedDate(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Perth", day: "numeric", month: "numeric", year: "numeric" }).formatToParts(when);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const month = MONTHS[part("month") - 1];
  return month ? `${part("day")} ${month} ${part("year")}` : "";
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const moved = publicHostRedirect(request);
  if (moved) throw moved;
  const found = await getReport(params.slug ?? "");
  if (!found) throw new Response("Not found", { status: 404 });
  return { report: pageReport(found.data), checked: checkedDate(found.data.checkedAt) };
};

// Browsers may keep the page for 5 minutes. Never in search results: it's for the store and Ross's videos.
// A missing report is never kept (it may be made a minute later).
export const headers: HeadersFunction = ({ errorHeaders }) =>
  new Headers({ ...SECURITY_HEADERS, "Cache-Control": errorHeaders ? "no-store" : "public, max-age=300", "X-Robots-Tag": "noindex" });

export const meta: MetaFunction<typeof loader> = ({ data, error }) => {
  const brand = data?.report.store.brand;
  if (!brand) {
    const missing = !error || (isRouteErrorResponse(error) && error.status === 404);
    return [{ title: missing ? "Report not found | GEO" : "Something went wrong | GEO" }, { name: "robots", content: "noindex" }];
  }
  const title = `${brand}: how to get picked by AI | GEO`;
  const description = `What shoppers search, who AI picks today, and the next moves for ${brand}.`;
  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "noindex" },
    // The preview in a DM: the title and line, no picture.
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "GEO" },
  ];
};

export const links: LinksFunction = () => [{ rel: "stylesheet", href: styles }];

// Numbers the way the page writes them: 1,900.
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const answersWord = (n: number) => `${fmt(n)} ${n === 1 ? "answer" : "answers"}`;

export default function StoreReportPage() {
  const { report, checked } = useLoaderData<typeof loader>();
  return <Report report={report} checked={checked} />;
}

function Report({ report, checked }: { report: PageReport; checked: string }) {
  const { store } = report;
  return (
    <div className="rp">
      <TopBar brand={store.brand} checked={checked} />
      <main>
        <header className="rp-store">
          <p className="rp-kicker">Store report</p>
          <h1 className="rp-h1">{store.brand}</h1>
          {store.sells ? <p className="rp-sells">{store.sells}</p> : null}
          <p className="rp-where">
            {store.host} · {upperFirst(store.countryName)}
          </p>
        </header>
        <Standing report={report} />
        <SearchWords report={report} />
        <Picks report={report} />
        <Sites report={report} />
        <Moves report={report} />
        <Months report={report} />
      </main>
      <SmallPrint report={report} checked={checked} />
    </div>
  );
}

// "the US" starts a line as "The US".
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Logo() {
  return (
    <span className="rp-logo">
      <span className="mark" aria-hidden="true">
        <i></i>
        <i></i>
      </span>
      GEO
    </span>
  );
}

function TopBar({ brand, checked }: { brand: string; checked: string }) {
  return (
    <header className="rp-top">
      <div className="rp-head">
        <Logo />
        <ShareButton title={`${brand}: how to get picked by AI`} />
      </div>
      <p className="rp-made">
        Made with GEO{checked ? ` · Checked ${checked}` : ""}
      </p>
    </header>
  );
}

/** The phone's share sheet when there is one, else the link is copied ("Link copied" for 2 seconds). */
function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    const url = window.location.href.split("#")[0];
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return; // they closed the share sheet
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard (an old browser or a blocked page): the link is still in the address bar.
    }
  };

  return (
    <>
      <button type="button" className={copied ? "rp-share is-done" : "rp-share"} onClick={share}>
        {copied ? <TickIcon /> : <ShareIcon />}
        <span>{copied ? "Link copied" : "Share"}</span>
      </button>
      <span className="rp-sr" role="status">
        {copied ? "Link copied" : ""}
      </span>
    </>
  );
}

function Standing({ report }: { report: PageReport }) {
  const { named, answers, rivalCount, searches, siteCount, questions, store } = report;
  // Red when AI never named them, amber when under a third of the time, green otherwise.
  const tone = named === 0 ? "bad" : named / Math.max(answers, 1) < 1 / 3 ? "warn" : "good";
  const tiles: { label: string; value: string; of?: string; tone?: string }[] = [
    { label: "AI answers that name you", value: fmt(named), of: `of ${fmt(answers)}`, tone },
    { label: "Brands AI picked instead", value: fmt(rivalCount) },
    ...(searches > 0 ? [{ label: "Google searches a month", value: fmt(searches) }] : []),
    { label: "Sites AI used", value: fmt(siteCount) },
  ];
  return (
    <section className="rp-sec" aria-labelledby="rp-stand">
      <h2 className="rp-h2" id="rp-stand">
        Where you stand
      </h2>
      <dl className={tiles.length % 2 ? "rp-tiles is-odd" : "rp-tiles"}>
        {tiles.map((t) => (
          <div className={t.tone ? `rp-tile is-${t.tone}` : "rp-tile"} key={t.label}>
            <dt>{t.label}</dt>
            {/* Long numbers (11,970) get a smaller size so two tiles still fit side by side on a phone. */}
            <dd className={t.value.length >= 8 ? "is-longer" : t.value.length >= 6 ? "is-long" : undefined}>
              {t.value}
              {t.of ? <small> {t.of}</small> : null}
            </dd>
          </div>
        ))}
      </dl>
      <p className="rp-line">
        We asked ChatGPT, Gemini and Perplexity {fmt(questions.length)} questions shoppers ask, twice each. They named {store.brand}{" "}
        {fmt(named)} {named === 1 ? "time" : "times"} out of {fmt(answers)}.
      </p>
    </section>
  );
}

function SearchWords({ report }: { report: PageReport }) {
  const words = report.searchWords;
  if (!words.length) return null;
  // Difficulty only comes from Serpstat. With none at all the numbers came from the backup, so the column and
  // Serpstat's name go.
  const hasHard = words.some((w) => w.difficulty !== null);
  const place = report.store.countryName;
  return (
    <section className="rp-sec" aria-labelledby="rp-search">
      <h2 className="rp-h2" id="rp-search">
        What shoppers search
      </h2>
      <table className="rp-table">
        <thead>
          <tr>
            <th scope="col">
              Search words
              {/* On a phone the place goes under each search word, so this header says so too. */}
              <span className="rp-sub">Put it on</span>
            </th>
            <th scope="col" className="rp-n rp-month-col">
              A month
            </th>
            {hasHard ? (
              <th scope="col" className="rp-n rp-hard-col">
                How hard
              </th>
            ) : null}
            <th scope="col" className="rp-place">
              Put it on
            </th>
          </tr>
        </thead>
        <tbody>
          {words.map((w) => (
            <tr key={w.keyword}>
              <th scope="row">
                {w.keyword}
                <span className="rp-sub">{w.place}</span>
              </th>
              <td className="rp-n">{fmt(w.volume)}</td>
              {hasHard ? (
                <td className="rp-n">
                  {w.difficulty !== null ? (
                    <span className="rp-hard">
                      {w.difficulty <= EASY_DIFFICULTY ? <span className="rp-easy">easy</span> : null}
                      {fmt(w.difficulty)}
                    </span>
                  ) : null}
                </td>
              ) : null}
              <td className="rp-place">{w.place}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="rp-note">
        {hasHard
          ? `How hard is 0 to 100. ${EASY_DIFFICULTY} or less is easy to rank for. Search numbers are estimates from Serpstat for Google in ${place}.`
          : `Search numbers are estimates for Google in ${place}.`}
      </p>
    </section>
  );
}

function Picks({ report }: { report: PageReport }) {
  const { picks, store, rivals, answers, named } = report;
  if (!picks || !picks.brands.length) return null;
  const names = (store.names ?? [store.brand]).map((n) => n.toLowerCase());
  const last = picks.brands.length - 1;
  // AI named the store after the 8th: it sits in the last row with its real place, after a row for the brands between.
  const later = picks.named && picks.position !== null && picks.position > picks.brands.length ? picks.position : null;
  const skipped = later ? later - picks.brands.length : 0;
  const rank = (i: number) => (later && i === last ? later : i + 1);
  // The store's row: its place in the list, or its name when the place wasn't kept.
  const isYou = (brand: string, i: number) =>
    picks.named && (picks.position ? picks.position === rank(i) : names.includes(brand.toLowerCase()));
  // The store isn't in the rivals, so they are only the ones named "most" when the store was named less.
  const others = rivals.length > 0 && named >= rivals[0].count;
  return (
    <section className="rp-sec" aria-labelledby="rp-picks">
      <h2 className="rp-h2" id="rp-picks">
        Who AI picks now
      </h2>
      <figure className="rp-chat">
        <figcaption className="rp-asked">We asked {ENGINE_LABELS[picks.engine]}</figcaption>
        <blockquote className="rp-bubble">
          <p>&ldquo;{picks.question}&rdquo;</p>
        </blockquote>
        <ol className="rp-picks">
          {picks.brands.map((b, i) => {
            const you = isYou(b, i);
            return (
              <Fragment key={`${i}-${b}`}>
                {skipped > 0 && i === last ? (
                  <li className="is-gap">
                    <span className="rp-rank" aria-hidden="true">
                      &hellip;
                    </span>
                    <span className="rp-brand">
                      {fmt(skipped)} more {skipped === 1 ? "brand" : "brands"}
                    </span>
                  </li>
                ) : null}
                <li className={you ? "is-you" : undefined}>
                  <span className="rp-rank">{rank(i)}</span>
                  <span className="rp-brand">{b}</span>
                  {you ? <span className="rp-tag is-good">You</span> : null}
                </li>
              </Fragment>
            );
          })}
          {!picks.named ? (
            <li className="is-missing">
              <span className="rp-rank" aria-hidden="true">
                <CrossIcon />
              </span>
              <span className="rp-brand">{store.brand}: not named</span>
            </li>
          ) : null}
        </ol>
      </figure>
      {rivals.length ? (
        <>
          <p className="rp-line rp-most">
            {others ? "Other brands named most" : "Named most"} across all {answersWord(answers)}:
          </p>
          <ul className="rp-chips">
            {rivals.slice(0, 5).map((r) => (
              <li key={r.name}>
                {r.name} <span aria-hidden="true">·</span> <b>{fmt(r.count)}</b>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function Sites({ report }: { report: PageReport }) {
  const { sites, answers } = report;
  if (!sites.length) return null;
  return (
    <section className="rp-sec" aria-labelledby="rp-sites">
      <h2 className="rp-h2" id="rp-sites">
        Sites AI trusts
      </h2>
      <ul className="rp-sites">
        {sites.map((s) => (
          <li key={s.domain}>
            <div className="rp-site">
              <b>{s.domain}</b>
              {s.title ? <span className="rp-site-title">{s.title}</span> : null}
            </div>
            <span className="rp-site-n">{answersWord(s.count)}</span>
            {/* How often, as a bar: the share of all answers that used it. */}
            <span className="rp-bar-track" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.round((s.count / Math.max(answers, 1)) * 100))}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="rp-note">AI read these sites to decide. Getting onto them helps you get picked.</p>
    </section>
  );
}

// Made-up words under the blur, the same for every report: the locked moves' own words never reach the browser.
const FILLER = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit sed do.",
  "Ut enim ad minim veniam, quis nostrud exercitation ullamco.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse.",
  "Excepteur sint occaecat cupidatat non proident, sunt in culpa.",
];

function Moves({ report }: { report: PageReport }) {
  const shown = report.moves.slice(0, SHOWN_MOVES);
  const locked = report.locked ?? [];
  const more = locked.length;
  if (!shown.length) return null;
  return (
    <>
      <section className="rp-sec" aria-labelledby="rp-moves">
        <h2 className="rp-h2" id="rp-moves">
          {shown.length === 1 ? "Your next move" : `Your next ${shown.length} moves`}
        </h2>
        <ol className="rp-moves">
          {shown.map((m, i) => (
            <li key={m.text}>
              <span className="rp-step" aria-hidden="true">
                {i + 1}
              </span>
              <p>
                <b>{m.place}:</b> {m.text}
              </p>
            </li>
          ))}
        </ol>
      </section>
      {more > 0 ? (
        <section className="rp-sec" aria-labelledby="rp-more">
          <h2 className="rp-h2" id="rp-more">
            +{fmt(more)} more {more === 1 ? "move" : "moves"}
          </h2>
          <ul className="rp-locked">
            {locked.map((place, i) => (
              <li key={i}>
                <LockIcon />
                <b>{place}</b>
                <span className="rp-blur" aria-hidden="true">
                  {FILLER[i % FILLER.length]}
                </span>
                <span className="rp-sr">Hidden in the full plan</span>
              </li>
            ))}
          </ul>
          <p className="rp-note">These are in the full plan.</p>
        </section>
      ) : null}
    </>
  );
}

function Months({ report }: { report: PageReport }) {
  if (!report.months.length) return null;
  return (
    <section className="rp-sec" aria-labelledby="rp-months">
      <h2 className="rp-h2" id="rp-months">
        Month by month
      </h2>
      <ol className="rp-months">
        {report.months.map((m) => (
          <li key={m.month} className="rp-month">
            <p className="rp-kicker">Month {m.month}</p>
            <h3>{m.title}</h3>
            <ul>
              {m.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SmallPrint({ report, checked }: { report: PageReport; checked: string }) {
  const { store, questions } = report;
  return (
    <footer className="rp-small">
      <p>
        {checked ? `Checked on ${checked}. ` : ""}We asked ChatGPT, Gemini and Perplexity {fmt(questions.length)} buying questions, as a
        shopper in {store.countryName}, twice each. AI answers change from day to day, so this is a snapshot. Every store is different,
        so we can&apos;t promise exact results. GEO isn&apos;t linked to {store.brand}. Want this report taken down? Email{" "}
        <a href="mailto:ross@usegeo.app">ross@usegeo.app</a>.
      </p>
      <p className="rp-site-link">
        <a href="https://usegeo.app/">usegeo.app</a>
      </p>
    </footer>
  );
}

/** A missing or broken report: the same plain page, no site menu. */
export function ErrorBoundary() {
  const error = useRouteError();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  if (!missing) console.error("[report] page error", error);
  return (
    <div className="rp">
      <header className="rp-top">
        <div className="rp-head">
          <Logo />
        </div>
      </header>
      <main className="rp-store">
        <h1 className="rp-h1">{missing ? "We couldn't find that report." : "Something went wrong."}</h1>
        <p className="rp-sells">
          {missing ? "The link may be wrong, or the report was taken down." : "Please try again in a minute."}
        </p>
        <p className="rp-site-link">
          <a href="https://usegeo.app/">usegeo.app</a>
        </p>
      </main>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15V3" />
      <path d="M7.5 7.5 12 3l4.5 4.5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="rp-lock" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
