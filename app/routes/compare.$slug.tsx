import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, useLoaderData } from "react-router";
import { StoryShell, TryLine } from "../components/story-ui";
import { COMPARE_HUB, COMPARE_PAGES, type ComparePage, type CompareTable, compareBySlug, compareJsonLd, comparePath, waitlistHref } from "../lib/compare/pages";
import { formatUpdated } from "../lib/tools/format";
import { pageMeta, stripBrand } from "../lib/tools/seo";
import { toolHeaders } from "../lib/tools/http";

// One comparison at /compare/<slug>: the answer first, the sections (tables where the page compares), the waitlist
// box, the questions people ask and the sources with the day they were checked. Then the related comparisons.
// Content: app/lib/compare/pages.ts. An unknown slug is a real 404 with noindex that lists every page.

export const loader = ({ params }: LoaderFunctionArgs) => {
  const page = compareBySlug(params.slug ?? "");
  if (!page) {
    return data({ page: null, related: [] }, { status: 404, headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" } });
  }
  const related = page.related.map((s) => compareBySlug(s)).filter((p): p is ComparePage => Boolean(p));
  return data({ page: page as ComparePage | null, related });
};

export const meta: MetaFunction<typeof loader> = ({ data: d }) =>
  d?.page
    ? pageMeta({
        path: comparePath(d.page.slug),
        title: d.page.title,
        description: d.page.description,
        image: COMPARE_HUB.ogImage,
        imageAlt: COMPARE_HUB.ogAlt,
        jsonLd: compareJsonLd(d.page),
      })
    : pageMeta({
        path: COMPARE_HUB.path,
        title: "We couldn't find that page | GEO",
        description: "This page doesn't exist. See every comparison of agencies, tools and GEO.",
        noindex: true,
      });

export const headers = toolHeaders;

const PILL = { label: "All comparisons", href: COMPARE_HUB.path };

export default function ComparePageView() {
  const { page, related } = useLoaderData<typeof loader>();
  if (!page) {
    return (
      <StoryShell
        wide
        pill={PILL}
        crumbs={[{ name: COMPARE_HUB.name, path: COMPARE_HUB.path }, { name: "Not found" }]}
        hero={
          <section className="tl-hero">
            <h1 className="ck-h1">We couldn&apos;t find that page.</h1>
            <p className="ck-lead tl-intro">It may have moved, or the address has a typo. Here are all of them.</p>
          </section>
        }
      >
        <div className="bl">
          <ul className="cp-links">
            {COMPARE_PAGES.map((p) => (
              <li key={p.slug}>
                <a href={comparePath(p.slug)}>{p.h1}</a>
              </li>
            ))}
          </ul>
        </div>
      </StoryShell>
    );
  }
  return (
    <StoryShell pill={PILL} crumbs={[{ name: COMPARE_HUB.name, path: COMPARE_HUB.path }, { name: stripBrand(page.title) }]} hero={<CompareHero page={page} />}>
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
            <p>GEO is A$1,000 a month, done for you, for 5 Australian Shopify brands. No lock-in, and a full refund if you&apos;re not happy after the first month.</p>
            <a className="ck-btn ck-btn-dark" href={waitlistHref(page.slug)}>
              Join the waitlist
            </a>
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
              Other companies&apos; prices and features were checked on {formatUpdated(page.checked)} and can change. Tell us if something is out of
              date and we&apos;ll fix it. GEO is not linked to any company named here.
            </p>
          </section>
        </article>

        {related.length ? (
          <section className="bl-related" aria-labelledby="read-next">
            <h2 className="ck-h2" id="read-next">
              More comparisons
            </h2>
            <ul className="cp-links">
              {related.map((p) => (
                <li key={p.slug}>
                  <a href={comparePath(p.slug)}>{p.h1}</a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <TryLine />
      </div>
    </StoryShell>
  );
}

/** The band: a tag, the H1, the answer-first intro and the day it was checked. */
function CompareHero({ page }: { page: ComparePage }) {
  return (
    <header className="st-hero bl-hero">
      <span className="bl-tag">Compare</span>
      <h1 className="ck-h1 st-h1" id="page-h1">
        {page.h1}
      </h1>
      {page.intro.map((p) => (
        <p className="ck-lead st-intro" key={p}>
          {p}
        </p>
      ))}
      <p className="st-byline">
        By the GEO team · Checked <time dateTime={page.checked}>{formatUpdated(page.checked)}</time>
      </p>
    </header>
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
