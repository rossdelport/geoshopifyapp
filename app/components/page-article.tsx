// The reading page shared by the /compare pages and the service pages (like /seo-agency-perth): the band with its
// tag, H1, answer-first intro and checked date; the sections (tables, paragraphs, bullets); the "Get started" box
// that opens /book; the questions people ask; the sources; and the related pages. Plain presentational components,
// rendered on the server, working without JavaScript. Styles: ARTICLE_LINKS (blog.css for the FAQ and sources,
// compare.css for the tables and the box).

import type { LinksFunction } from "react-router";
import { CHECK_FONT_LINKS } from "./check-ui";
import { TryLine } from "./story-ui";
import type { CompareSection, CompareSource, CompareTable } from "../lib/compare/pages";
import { OFFER } from "../lib/plans";
import type { Faq } from "../lib/tools/seo";
import { formatUpdated } from "../lib/tools/format";
import checkCss from "../styles/check.css?url";
import toolsCss from "../styles/tools.css?url";
import storyCardCss from "../styles/story-card.css?url";
import storiesCss from "../styles/stories.css?url";
import blogCss from "../styles/blog.css?url";
import compareCss from "../styles/compare.css?url";

/** Fonts and stylesheets for every page that uses PageArticle. */
export const ARTICLE_LINKS: LinksFunction = () => [
  ...CHECK_FONT_LINKS,
  { rel: "stylesheet", href: checkCss },
  { rel: "stylesheet", href: toolsCss },
  { rel: "stylesheet", href: storyCardCss },
  { rel: "stylesheet", href: storiesCss },
  { rel: "stylesheet", href: blogCss },
  { rel: "stylesheet", href: compareCss },
];

/** What PageArticle needs from a page (a ComparePage or a LandingPage). */
export interface ArticleContent {
  h1: string;
  intro: string[];
  checked: string;
  sections: CompareSection[];
  faqs: Faq[];
  sources: CompareSource[];
}

/**
 * The booking page, tagged so Admin can see which page a visit or a booked call came from
 * (/book keeps the utm tags; Ross, 3 Nov 2026: every button says "Get started" and opens /book).
 */
export const bookHref = (medium: string, campaign: string) => `/book?utm_source=firstpicked&utm_medium=${medium}&utm_campaign=${campaign}`;

/** The band: a tag, the H1, the answer-first intro and the day it was checked. */
export function ArticleHero({ page, tag }: { page: ArticleContent; tag: string }) {
  return (
    <header className="st-hero bl-hero">
      <span className="bl-tag">{tag}</span>
      <h1 className="ck-h1 st-h1" id="page-h1">
        {page.h1}
      </h1>
      {page.intro.map((p) => (
        <p className="ck-lead st-intro" key={p}>
          {p}
        </p>
      ))}
      <p className="st-byline">
        By the FirstPicked team · Checked <time dateTime={page.checked}>{formatUpdated(page.checked)}</time>
      </p>
    </header>
  );
}

/** The page under the band: sections, the Get started box, the FAQ, the sources and the related pages. */
export function PageArticle({
  page,
  book,
  related,
  relatedHeading,
}: {
  page: ArticleContent;
  /** Where "Get started" goes (bookHref). */
  book: string;
  related: { name: string; href: string }[];
  relatedHeading: string;
}) {
  return (
    <div className="bl">
      <article className="st-article bl-article" aria-labelledby="page-h1">
        <div className="st-body">
          {page.sections.map((sec, i) => (
            <section className="st-sec" key={sec.heading} aria-labelledby={`sec-${i}`}>
              <h2 className="ck-h2" id={`sec-${i}`}>
                {sec.heading}
              </h2>
              {sec.table ? <Table table={sec.table} /> : null}
              {sec.paragraphs?.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {sec.bullets?.length ? (
                <ul>
                  {sec.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <section className="cp-cta" aria-labelledby="cta-h">
          <h2 className="ck-h2" id="cta-h">
            Want us to do it for you?
          </h2>
          <p>
            FirstPicked is {OFFER.price}, done for you, for 5 Australian Shopify brands. No lock-in, and a full refund if you&apos;re not happy after the
            first month.
          </p>
          <a className="ck-btn ck-btn-dark" href={book}>
            Get started
          </a>
          <p className="cp-cta-note">15 minute FREE introduction call with Ross, the founder. No obligation.</p>
        </section>

        {page.faqs.length ? (
          <section className="bl-faq" aria-labelledby="faq-h">
            <h2 className="ck-h2" id="faq-h">
              Questions people ask
            </h2>
            {page.faqs.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </section>
        ) : null}

        <section className="bl-sources" aria-labelledby="sources-h">
          <h2 id="sources-h">Sources</h2>
          <ul>
            {page.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                  <span className="ck-sr"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="bl-sources-note">
            Other companies&apos; prices and features were checked on {formatUpdated(page.checked)} and can change. Tell us if something is out of date
            and we&apos;ll fix it. FirstPicked is not linked to any company named here.
          </p>
        </section>
      </article>

      {related.length ? (
        <section className="bl-related" aria-labelledby="read-next">
          <h2 className="ck-h2" id="read-next">
            {relatedHeading}
          </h2>
          <ul className="cp-links">
            {related.map((p) => (
              <li key={p.href}>
                <a href={p.href}>{p.name}</a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <TryLine />
    </div>
  );
}

/** A comparison table that scrolls sideways on a phone instead of squashing; the first column names each row. */
function Table({ table }: { table: CompareTable }) {
  return (
    <div className="cp-table">
      <table>
        <thead>
          <tr>
            {table.head.map((h, i) => (
              <th key={h || i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {c}
                  </th>
                ) : (
                  <td key={i}>{c}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
