// The stories pages (/stories and /stories/<slug>): the shared frame and the story card. Plain presentational
// components; the routes load the stories. Styles: app/styles/check.css (the ck-* frame), app/styles/tools.css
// (breadcrumb and header pill, tl-*), app/styles/story-card.css (the card, shared with the home page) and
// app/styles/stories.css (st-*), all linked by routes/stories.tsx. Everything renders on the server and works
// without JavaScript. Every story is another company's result: nothing here may suggest they use GEO.

import type { ReactNode } from "react";
import type { Crumb } from "../lib/tools/seo";
import { HOME_CRUMB } from "../lib/tools/seo";
import { SHOPIFY_BAG_SRC, STORIES_HUB, logoSrc, storyPath, type StoryCardData } from "../lib/stories/pages";
import { SiteFooter } from "./site-footer";

/** Home > Stories > {brand}. The last crumb is the page itself. */
function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="tl-crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <a href="/">{HOME_CRUMB}</a>
        </li>
        {crumbs.map((c, i) => (
          <li key={c.name}>{c.path && i < crumbs.length - 1 ? <a href={c.path}>{c.name}</a> : <span aria-current="page">{c.name}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * The page: the lilac band (header, breadcrumb, `hero`), then on white the page's own parts (`children`), then
 * the site footer. `wide` lets the band's text use the full width (the hub); story pages keep a reading column.
 */
export function StoryShell({
  crumbs,
  hero,
  children,
  wide = false,
  pill = { label: "All stories", href: STORIES_HUB.path },
}: {
  crumbs: Crumb[];
  hero: ReactNode;
  children?: ReactNode;
  wide?: boolean;
  /** The link at the top right (the blog passes its own). */
  pill?: { label: string; href: string };
}) {
  return (
    <div className="ck tl st">
      <main className="ck-page">
        <div className="ck-band">
          <div className="ck-band-grid" aria-hidden="true" />
          <header className="ck-top">
            <a className="ck-logo" href="/" aria-label="GEO home">
              <span className="ck-mark" aria-hidden="true">
                <i />
                <i />
              </span>
              <span className="ck-word">GEO</span>
            </a>
            <a className="ck-pill tl-pill" href={pill.href}>
              {pill.label}
            </a>
          </header>
          <div className={`ck-band-in${wide ? "" : " st-band-col"}`}>
            <Breadcrumb crumbs={crumbs} />
            {hero}
          </div>
        </div>
        <div className="ck-main st-main">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** The brand's logo on a small white tile (so dark logos always sit on a light background). */
export function StoryLogo({ logo, shape, className = "" }: { logo: string; shape?: "square" | "wide"; className?: string }) {
  const wide = shape === "wide";
  return (
    <span className={`sc-logo${wide ? " is-wide" : ""} ${className}`.trim()}>
      <img src={logoSrc(logo)} alt="" width={wide ? 76 : 28} height={wide ? 20 : 28} decoding="async" />
    </span>
  );
}

const ARROW = (
  <svg className="sc-go" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
);

/**
 * One story as a card: the headline, the Shopify bag at the top right (only for stores that run on Shopify) and
 * the logo and name at the bottom left; the whole card links to the story. The same markup as storyCardHtml in
 * design/overview/assemble.mjs (the home page's moving row).
 */
export function StoryCard({ card }: { card: StoryCardData }) {
  return (
    <li>
      <a className={`story-card${card.onShopify ? " is-shopify" : ""}`} href={storyPath(card.slug)}>
        <span className="sc-head">{card.cardHeadline}</span>
        {card.onShopify ? <img className="sc-shop" src={SHOPIFY_BAG_SRC} alt="Shopify store" width={22} height={22} decoding="async" /> : null}
        <span className="sc-foot">
          <StoryLogo logo={card.logo} shape={card.logoShape} />
          <span className="sc-name">{card.brand}</span>
          {ARROW}
        </span>
      </a>
    </li>
  );
}

/** Cards in a grid: the hub, "Read next" and the 404 page. */
export function StoryCards({ cards }: { cards: StoryCardData[] }) {
  return (
    <ul className="st-cards">
      {cards.map((c) => (
        <StoryCard key={c.slug} card={c} />
      ))}
    </ul>
  );
}

/** What the bag on the cards means. */
export function ShopifyKey() {
  return (
    <p className="st-key">
      <img src={SHOPIFY_BAG_SRC} alt="" width={16} height={16} decoding="async" /> Runs on Shopify
    </p>
  );
}

/** The one quiet invitation on these pages: GEO's free check, for the reader's own products. */
export function TryLine() {
  return (
    <p className="st-try">
      Want to see if ChatGPT recommends your products? <a href="/tools/ai-visibility-checker">Try our free AI Visibility Checker</a>.
    </p>
  );
}
