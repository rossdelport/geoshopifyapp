import type { MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { ShopifyKey, StoryCards, StoryShell, TryLine } from "../components/story-ui";
import { STORIES } from "../lib/stories";
import { STORIES_HUB, storiesHubJsonLd, toCard } from "../lib/stories/pages";
import { pageMeta } from "../lib/tools/seo";
import { toolHeaders } from "../lib/tools/http";

// The hub at /stories: every story as a card, stores first, then software companies, in stories.json order.
// Each story page links back here (breadcrumb, header pill, "See all stories"), and the home page's moving row
// links here too. The loader passes only what the cards need.

export const loader = () => ({ cards: STORIES.map(toCard) });

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  pageMeta({
    path: STORIES_HUB.path,
    title: STORIES_HUB.title,
    description: STORIES_HUB.description,
    image: STORIES_HUB.ogImage,
    imageAlt: STORIES_HUB.ogAlt,
    jsonLd: storiesHubJsonLd(data?.cards ?? []),
  });

export const headers = toolHeaders;

export default function StoriesHub() {
  const { cards } = useLoaderData<typeof loader>();
  const groups = [
    { id: "stores", heading: "Stores and product brands", cards: cards.filter((c) => c.ecommerce) },
    { id: "software", heading: "Software companies", cards: cards.filter((c) => !c.ecommerce) },
  ].filter((g) => g.cards.length);
  return (
    <StoryShell
      wide
      crumbs={[{ name: STORIES_HUB.name }]}
      hero={
        <section className="tl-hero">
          <h1 className="ck-h1">{STORIES_HUB.h1}</h1>
          <p className="ck-lead tl-intro">{STORIES_HUB.intro}</p>
        </section>
      }
    >
      {groups.map((g) => (
        <section className="st-group" key={g.id} aria-labelledby={`st-${g.id}`}>
          <div className="st-group-head">
            <h2 className="ck-h2" id={`st-${g.id}`}>
              {g.heading}
            </h2>
            {g.cards.some((c) => c.onShopify) ? <ShopifyKey /> : null}
          </div>
          <StoryCards cards={g.cards} />
        </section>
      ))}
      <p className="st-hub-note">
        None of these brands are GEO customers. Each story is our summary of what the source reported, and links to it. The figures and quotes are
        theirs.
      </p>
      <TryLine />
    </StoryShell>
  );
}
