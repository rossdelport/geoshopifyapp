import type { MetaFunction } from "react-router";
import { StoryShell, TryLine } from "../components/story-ui";
import { COMPARE_HUB, COMPARE_PAGES, compareHubJsonLd, comparePath } from "../lib/compare/pages";
import { BLOG_HUB } from "../lib/blog/pages";
import { formatUpdated } from "../lib/tools/format";
import { pageMeta } from "../lib/tools/seo";
import { toolHeaders } from "../lib/tools/http";

// The hub at /compare: every comparison page as a card, in COMPARE_PAGES order.

export const meta: MetaFunction = () =>
  pageMeta({
    path: COMPARE_HUB.path,
    title: COMPARE_HUB.title,
    description: COMPARE_HUB.description,
    image: COMPARE_HUB.ogImage,
    imageAlt: COMPARE_HUB.ogAlt,
    jsonLd: compareHubJsonLd(),
  });

export const headers = toolHeaders;

export default function CompareHub() {
  return (
    <StoryShell
      wide
      pill={{ label: "Blog", href: BLOG_HUB.path }}
      crumbs={[{ name: COMPARE_HUB.name }]}
      hero={
        <section className="tl-hero">
          <h1 className="ck-h1">{COMPARE_HUB.h1}</h1>
          <p className="ck-lead tl-intro">{COMPARE_HUB.intro}</p>
        </section>
      }
    >
      <div className="bl">
        <ul className="bl-list is-hub">
          {COMPARE_PAGES.map((p) => (
            <li key={p.slug}>
              <a className="bl-card" href={comparePath(p.slug)}>
                <span className="bl-tag">Compare</span>
                <h2 className="bl-card-title">{p.h1}</h2>
                <p className="bl-card-desc">{p.short}</p>
                <p className="bl-card-meta">
                  Checked <time dateTime={p.checked}>{formatUpdated(p.checked)}</time>
                </p>
              </a>
            </li>
          ))}
        </ul>
        <TryLine />
      </div>
    </StoryShell>
  );
}
