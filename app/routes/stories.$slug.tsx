import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { data, useLoaderData } from "react-router";
import { Fragment, type ReactNode } from "react";
import { StoryCards, StoryLogo, StoryShell, TryLine } from "../components/story-ui";
import { STORIES, storyBySlug, type Story, type StoryQuote, type StorySource } from "../lib/stories";
import {
  SHOPIFY_BAG_SRC,
  STORIES_HUB,
  STORIES_UPDATED,
  notCustomerNote,
  publisherName,
  splitLesson,
  storyJsonLd,
  storyPath,
  toCard,
} from "../lib/stories/pages";
import { pageMeta } from "../lib/tools/seo";
import { toolHeaders } from "../lib/tools/http";
import { formatUpdated } from "../lib/tools/format";

// One story at /stories/<slug>: our plain-English retelling of another company's result, answer first, then the
// numbers, what happened, their own words, what other stores can take from it, the caveat, and at the bottom the
// link to the original with the note that the brand is not a GEO customer. Then three related stories.
// Content: app/lib/stories/stories.json (research: docs/case-studies.md). An unknown slug is a real 404 with
// noindex that lists every story.

export const loader = ({ params }: LoaderFunctionArgs) => {
  const story = storyBySlug(params.slug ?? "");
  if (!story) {
    return data(
      { story: null, related: [], all: STORIES.map(toCard) },
      { status: 404, headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex" } },
    );
  }
  const related = story.related.map((s) => storyBySlug(s)).filter((s): s is Story => Boolean(s));
  return data({ story, related: related.map(toCard), all: [] });
};

export const meta: MetaFunction<typeof loader> = ({ data: d }) =>
  d?.story
    ? pageMeta({
        path: storyPath(d.story.slug),
        title: d.story.title,
        description: d.story.description,
        image: STORIES_HUB.ogImage,
        imageAlt: STORIES_HUB.ogAlt,
        jsonLd: storyJsonLd(d.story),
      })
    : pageMeta({
        path: STORIES_HUB.path,
        title: "We couldn't find that story | GEO",
        description: "This page doesn't exist. See every story of brands getting sales from AI.",
        noindex: true,
      });

export const headers = toolHeaders;

export default function StoryPage() {
  const { story, related, all } = useLoaderData<typeof loader>();
  if (!story) {
    return (
      <StoryShell
        wide
        crumbs={[{ name: STORIES_HUB.name, path: STORIES_HUB.path }, { name: "Not found" }]}
        hero={
          <section className="tl-hero">
            <h1 className="ck-h1">We couldn&apos;t find that story.</h1>
            <p className="ck-lead tl-intro">It may have moved, or the address has a typo. Here are all of them.</p>
          </section>
        }
      >
        <StoryCards cards={all} />
      </StoryShell>
    );
  }
  return (
    <StoryShell crumbs={[{ name: STORIES_HUB.name, path: STORIES_HUB.path }, { name: story.brand }]} hero={<StoryHero story={story} />}>
      <article className="st-article" aria-labelledby="story-h1">
        {story.keyNumbers.length ? (
          <section className="st-numbers" aria-label="Key numbers">
            <ul data-n={story.keyNumbers.length}>
              {story.keyNumbers.map((n) => (
                <li key={n.value + n.label}>
                  <span className="st-num">{n.value}</span>
                  <span className="st-num-label">{n.label}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="st-body">{withQuotes(story)}</div>

        <section className="st-lessons" aria-labelledby="lessons">
          <h2 className="ck-h2" id="lessons">
            What other stores can take from this
          </h2>
          <ol>
            {story.lessons.map((l) => {
              const [lead, rest] = splitLesson(l);
              return (
                <li key={l}>
                  <strong>{lead}</strong>
                  {rest ? ` ${rest}` : null}
                </li>
              );
            })}
          </ol>
        </section>

        {story.caveat ? (
          <div className="st-caveat" role="note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5" />
              <path d="M12 7.5h.01" />
            </svg>
            <p>
              <strong>Worth knowing:</strong> {story.caveat}
            </p>
          </div>
        ) : null}

        <SourceBox story={story} />
      </article>

      <section className="st-next" aria-labelledby="read-next">
        <h2 className="ck-h2" id="read-next">
          Read next
        </h2>
        <StoryCards cards={related} />
        <p className="tl-all">
          <a href={STORIES_HUB.path}>See all stories</a>
        </p>
      </section>
      <TryLine />
    </StoryShell>
  );
}

/** The band: who the brand is, the H1, the answer-first intro and a line on where the story comes from. */
function StoryHero({ story }: { story: Story }) {
  return (
    <header className="st-hero">
      <div className="st-brand">
        <StoryLogo logo={story.logo} shape={story.logoShape} className="st-logo" />
        <p className="st-brand-tx">
          <span className="st-brand-name">{story.brand}</span>
          <span className="st-brand-biz">{story.business}</span>
        </p>
        {story.onShopify ? (
          <span className="st-shopify">
            <img src={SHOPIFY_BAG_SRC} alt="" width={16} height={16} decoding="async" />
            Shopify store
          </span>
        ) : null}
      </div>
      <h1 className="ck-h1 st-h1" id="story-h1">
        {story.h1}
      </h1>
      <p className="ck-lead st-intro">{story.intro}</p>
      <p className="st-byline">
        Summary by GEO · <time dateTime={STORIES_UPDATED}>{formatUpdated(STORIES_UPDATED)}</time> · Source:{" "}
        <a href="#source">{publisherName(story.source.publisher)}</a>
      </p>
    </header>
  );
}

/** The sections, with the brand's own words as pull quotes: one after each section, any left over after the last. */
function withQuotes(story: Story): ReactNode {
  const last = story.sections.length - 1;
  return story.sections.map((sec, i) => (
    <Fragment key={sec.heading}>
      <section className="st-sec" aria-labelledby={`sec-${i}`}>
        <h2 className="ck-h2" id={`sec-${i}`}>
          {sec.heading}
        </h2>
        {sec.paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </section>
      {(i === last ? story.quotes.slice(i) : story.quotes.slice(i, i + 1)).map((q) => (
        <PullQuote key={q.text} quote={q} />
      ))}
    </Fragment>
  ));
}

function PullQuote({ quote }: { quote: StoryQuote }) {
  return (
    <figure className="st-quote">
      <blockquote>
        <p>{`“${quote.text}”`}</p>
      </blockquote>
      <figcaption>{quote.who}</figcaption>
    </figure>
  );
}

/**
 * "Modern Retail · Gabriela Barkho · 14 January 2025" (or the note on the page's missing date). An author that only
 * repeats the publisher ("The Drum, Editorial") is left out.
 */
function sourceLine(src: StorySource): string {
  const author = src.author && !src.author.startsWith(src.publisher) ? src.author : null;
  return [src.publisher, author, src.date ? formatUpdated(src.date) : src.dateNote].filter(Boolean).join(" · ");
}

const OUT_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

/** The original article (new tab), any other pages the story draws on, and the note that this is their story, not ours. */
function SourceBox({ story }: { story: Story }) {
  const { source } = story;
  return (
    <section className="st-source" id="source" aria-labelledby="source-h">
      <div className="st-source-main">
        <h2 className="st-source-h" id="source-h">
          Source
        </h2>
        <p className="st-source-title">{`“${source.title}”`}</p>
        <p className="st-source-meta">{sourceLine(source)}</p>
        <a className="ck-btn ck-btn-dark st-source-btn" href={source.url} target="_blank" rel="noopener noreferrer">
          Read the original article
          {OUT_ICON}
          <span className="ck-sr"> (opens in a new tab)</span>
        </a>
        {story.moreSources?.length ? (
          <div className="st-more">
            <p className="st-more-h">Also drawn from</p>
            <ul>
              {story.moreSources.map((m) => (
                <li key={m.url}>
                  <a href={m.url} target="_blank" rel="noopener noreferrer">
                    {m.title}
                    <span className="ck-sr"> (opens in a new tab)</span>
                  </a>
                  <span className="st-more-meta">{sourceLine(m)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="st-not-customer">{notCustomerNote(story)}</p>
    </section>
  );
}
