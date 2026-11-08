// The service pages: one page per thing a store owner searches for when they're ready to hire, like
// firstpicked.com.au/seo-agency-perth for "seo agency perth" (Ross, 8 Nov 2026: "go after all the buying ones in perth
// first"). Built from the searches in /mnt/project-files/keywords/ (DataForSEO through Treg). One page per search group,
// never near-copies for other cities or wordings (Google's doorway page rules). Same honesty rules as the compare pages:
// say who we're not for, date every outside price, never promise results. Pure and browser-safe. Served by
// app/landing/route.tsx at the paths in ./paths.ts. Copy rules: grade 5 English, no dashes as punctuation.

import { COMPARE_PAGES, SEO_ROOM, compareBySlug, comparePath, type ComparePage } from "../compare/pages";
import { HOME_CRUMB, ORG_NODE, PART_OF, breadcrumbs, stripBrand } from "../tools/seo";
import { abs } from "../tools/site";

export interface LandingPage extends Omit<ComparePage, "slug"> {
  /** The address after the slash, like "seo-agency-perth". Must be in LANDING_SLUGS. */
  slug: string;
  /** The small tag above the H1. */
  tag: string;
  /** The city the page is about, for areaServed in the JSON-LD. */
  city?: string;
}

const SHOPIFY_PARTNERS = { title: "Shopify Partner Directory", url: "https://www.shopify.com/partners/directory" };

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: "seo-agency-perth",
    tag: "Perth",
    city: "Perth",
    title: "Perth SEO agency for Shopify brands | FirstPicked",
    description:
      "A Perth team that gets Shopify brands found on Google and picked by ChatGPT. A$945 a month, done for you, no lock-in. Free 15 minute call.",
    short: "Get your Shopify store found on Google and picked by AI, from a Perth team.",
    h1: "A Perth SEO agency for Shopify brands. Get found on Google and picked by AI.",
    intro: [
      "FirstPicked is run from Perth by its founder, Ross Delport. We help Shopify brands sell more from Google and from AI apps like ChatGPT. We only work with online stores.",
      "It's A$945 a month, done for you, with no lock-in contract. If you're not happy after the first month, you get a full refund and keep all the work.",
    ],
    checked: "2026-11-08",
    published: "2026-11-08",
    sections: [
      {
        heading: "What we do for your store each month",
        bullets: [
          "Check up to 100 buying questions every day in ChatGPT, Gemini, Perplexity and Google AI Overviews, plus Claude every week. You see who gets picked.",
          "Make 50+ fixes to your product pages, so Google and AI can tell what you sell and who it's for.",
          "Write up to 12 buying guides a month. Each one answers a real buyer question, like \"best beard oil for dry skin in Australia\".",
          "Find the sites AI reads before it picks a brand, and show you which ones name your rivals.",
          "Show you the visits, orders and sales that came from AI and from Google.",
          "Send you a report every week, and have a call with you each month about what's next.",
          "Check everything we write against your real product facts. No made-up claims or reviews.",
        ],
      },
      {
        heading: "Is this the right fit?",
        table: {
          head: ["If you...", "Then"],
          rows: [
            ["Sell on Shopify, A$5,000 a month or more", "Yes. This is who we built FirstPicked for."],
            ["Want Google and ChatGPT to name your products", "Yes. That's all we work on."],
            ["Run a local service, like a plumber or a clinic", "No. A local SEO agency that does Google Maps will suit you better."],
            ["Need a new store built, or moved to Shopify", "No. Start with a Shopify developer, and come back once your store is live."],
            ["Want Google or Facebook ads run for you", "No. We don't run ads."],
          ],
        },
      },
      {
        heading: "Why AI matters for your store now",
        paragraphs: [
          "Shoppers now ask ChatGPT what to buy. It names a few brands, and it picks them from sites it trusts, like review lists, shops and Reddit. It trusts those sites more than what a brand says about itself.",
          "We saw this for ourselves. On 8 November 2026 we asked ChatGPT for the best SEO agency in Perth for a Shopify store. It named five agencies, and it chose them from lists on other sites, not from the agencies' own pages. Your buyers' questions work the same way. That's why we work on the sites AI reads, not just your own pages.",
        ],
      },
      {
        heading: "What it costs",
        paragraphs: [
          "A$945 a month. There's no lock-in contract, and you can stop any time. If you're not happy after the first month, you get a full refund and keep all the work.",
          "Most Perth SEO agencies don't show a price on their website. One that does, The SEO Room, lists retainers from A$1,500 to A$5,000 + GST a month. Our list of the best SEO agencies in Perth for online stores compares seven of them.",
        ],
      },
      {
        heading: "How it works",
        paragraphs: ["You do the onboarding. We do the rest."],
        bullets: [
          "Book a free 15 minute call with Ross. No obligation.",
          "Fast onboarding. We read your store, agree what we can change, and help you add one small code to Shopify so we can count your sales from AI.",
          "We do the work every week. You get a weekly report and a monthly call.",
        ],
      },
      {
        heading: "Looking for a Shopify expert in Perth?",
        paragraphs: [
          "We don't build or design Shopify stores. If you need a new theme, an app set up, or a store moved to Shopify, a Shopify developer is the right call. Shopify lists them in its Partner Directory.",
          "Once your store is live, that's where we come in: getting it found and picked.",
        ],
      },
      {
        heading: "Questions to ask any Perth SEO agency",
        bullets: [
          "Have you worked with online stores, or mostly local services?",
          "What's the price each month, in writing?",
          "Is there a lock-in contract?",
          "How will you show me sales, not just rankings?",
          "Which sites does ChatGPT read for my buying questions, and are we on them?",
          "Can you promise me the top spot on Google or ChatGPT? (If they say yes, walk away. Nobody can promise that.)",
        ],
      },
    ],
    faqs: [
      {
        q: "Are you based in Perth?",
        a: "Yes. FirstPicked is run from Perth, Western Australia, by its founder, Ross Delport. Calls are on Google Meet, so we work with Shopify brands all over Australia.",
      },
      {
        q: "Do you do local SEO or Google Maps?",
        a: "No. We only help online stores sell their products. For Google Maps and local service pages, a local SEO agency is the better pick.",
      },
      {
        q: "How long until I see results?",
        a: "It builds over about three months. In month 1 we start the work. In month 2, Google and AI start to find the new pages. In month 3, clicks and sales can grow. Nobody can promise exact results, and we won't.",
      },
      { q: "Is there a contract?", a: "No lock-in. You pay monthly and can stop any time." },
      {
        q: "How is this different from normal SEO?",
        a: "Normal SEO aims for a high spot on Google. We aim for that, and for being one of the few brands ChatGPT and other AI apps name when shoppers ask what to buy. Then we show you the sales that came from AI.",
      },
      {
        q: "Can I check my store for free first?",
        a: "Yes. Our free AI Visibility Checker shows if ChatGPT and other AI apps name your products. No sign-up needed.",
      },
    ],
    sources: [SEO_ROOM, SHOPIFY_PARTNERS],
    related: ["best-seo-agencies-perth", "geo-vs-seo-agency", "geo-cost-australia"],
  },
];

export const landingPath = (slug: string) => `/${slug}`;

export function landingBySlug(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((p) => p.slug === slug);
}

/**
 * Links for a page's "related" list: a compare page by its slug, a service page by its path ("/seo-agency-perth").
 * Anything else is dropped (a test makes sure every related entry resolves).
 */
export function relatedLinks(related: string[]): { name: string; href: string }[] {
  return related.flatMap((r) => {
    if (r.startsWith("/")) {
      const p = landingBySlug(r.slice(1));
      return p ? [{ name: p.h1, href: landingPath(p.slug) }] : [];
    }
    const c = compareBySlug(r);
    return c ? [{ name: c.h1, href: comparePath(c.slug) }] : [];
  });
}

/** Every page a related list may point at (for the tests). */
export const relatedTargets = () => [...COMPARE_PAGES.map((p) => p.slug), ...LANDING_PAGES.map((p) => landingPath(p.slug))];

// ---------- JSON-LD ----------

const ORG_ID = ORG_NODE["@id"];

/** One @graph for a service page: Organization, WebPage, Service, FAQPage and BreadcrumbList. */
export function landingJsonLd(p: LandingPage): Record<string, unknown> {
  const url = abs(landingPath(p.slug));
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG_NODE,
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: stripBrand(p.title),
        headline: p.h1,
        description: p.description,
        datePublished: p.published ?? p.checked,
        dateModified: p.checked,
        inLanguage: "en-AU",
        mainEntity: { "@id": `${url}#service` },
        isPartOf: PART_OF,
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: stripBrand(p.title),
        description: p.description,
        provider: { "@id": ORG_ID },
        areaServed: [...(p.city ? [{ "@type": "City", name: p.city }] : []), { "@type": "Country", name: "Australia" }],
        url,
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: p.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumbs(`${url}#crumbs`, [{ name: HOME_CRUMB, path: "/" }, { name: stripBrand(p.title) }]),
    ],
  };
}
