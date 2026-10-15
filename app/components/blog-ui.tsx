import { type PostCard, isoDay, kindLabel, postPath } from "../lib/blog/pages";
import { formatUpdated } from "../lib/tools/format";

// The blog's list cards: on the hub (three across on a wide screen, `hub`) and under a post as "Read next". Plain
// links that work without JavaScript. Styles: app/styles/blog.css (bl-*).

export function PostCards({ cards, hub = false }: { cards: PostCard[]; hub?: boolean }) {
  const Title = hub ? "h2" : "h3";
  return (
    <ul className={`bl-list${hub ? " is-hub" : ""}`}>
      {cards.map((c) => (
        <li key={c.slug}>
          <a className="bl-card" href={postPath(c.slug)}>
            <span className="bl-tag">{kindLabel(c.kind)}</span>
            <Title className="bl-card-title">{c.title}</Title>
            <p className="bl-card-desc">{c.description}</p>
            <p className="bl-card-meta">
              <time dateTime={isoDay(c.publishedAt)}>{formatUpdated(isoDay(c.publishedAt))}</time> · {c.minutes} minute read
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}
