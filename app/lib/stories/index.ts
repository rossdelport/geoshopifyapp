// Customer stories shown on usegeo.app (scrolling cards + one page per story).
// The content lives in stories.json so the React pages and the plain-Node home
// page build can both read it. Every story is another company's result as
// reported by the source; none of them used GEO.
import data from "./stories.json";

export type StoryTrust = "high" | "medium" | "low";

export interface StoryNumber {
  value: string;
  label: string;
}

export interface StorySection {
  heading: string;
  paragraphs: string[];
}

export interface StoryQuote {
  text: string;
  who: string;
}

export interface StorySource {
  publisher: string;
  title: string;
  url: string;
  /** ISO date (YYYY-MM-DD), or null when the page shows no date (see dateNote). */
  date: string | null;
  author: string | null;
  dateNote?: string;
}

export interface Story {
  slug: string;
  brand: string;
  business: string;
  ecommerce: boolean;
  onShopify: boolean;
  shopifyEvidence: string;
  /** Path under design/overview/img/ (served from /home/img/). */
  logo: string;
  logoIsMonogram: boolean;
  /** "square" = icon or mark, "wide" = wordmark; size wide logos by height with a max width. */
  logoShape?: "square" | "wide";
  cardHeadline: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  keyNumbers: StoryNumber[];
  sections: StorySection[];
  quotes: StoryQuote[];
  lessons: string[];
  caveat?: string;
  source: StorySource;
  /** Extra pages the story draws on (e.g. an earlier post or an award entry). */
  moreSources?: StorySource[];
  trust: StoryTrust;
  related: string[];
}

export const STORIES: Story[] = data as Story[];

export function storyBySlug(slug: string): Story | undefined {
  return STORIES.find((s) => s.slug === slug);
}
