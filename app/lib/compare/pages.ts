// The /compare pages: honest buying pages for store owners choosing between GEO, an agency, a tool or an app
// (Ross, 2026-10-23: write for people who are choosing, not learning; naming other companies is OK). Every page
// says where the other option wins, and every price of another company carries the day we checked it: re-check
// them monthly (docs/ads/ad-rules.md) and move `checked`. Written by hand, never by the blog job (whose rule of
// never naming another company stays). Pure and browser-safe. Copy rules: plain English, no dashes as punctuation.

import type { Faq } from "../tools/seo";
import { HOME_CRUMB, ORG_NODE, PART_OF, breadcrumbs, stripBrand } from "../tools/seo";
import { abs } from "../tools/site";

export interface CompareTable {
  head: string[];
  rows: string[][];
}

export interface CompareSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: CompareTable;
}

export interface CompareSource {
  title: string;
  url: string;
}

export interface ComparePage {
  slug: string;
  /** Under 60 characters, ends in " | GEO". */
  title: string;
  /** Under 155 characters. */
  description: string;
  /** The hub card's line. */
  short: string;
  h1: string;
  /** The answer first. */
  intro: string[];
  /** The day every outside price and fact on the page was last checked (YYYY-MM-DD). */
  checked: string;
  sections: CompareSection[];
  faqs: Faq[];
  sources: CompareSource[];
  related: string[];
}

export const COMPARE_HUB = {
  name: "Compare",
  path: "/compare",
  title: "Compare GEO with agencies, tools and apps | GEO",
  description:
    "Honest comparisons for Shopify brands choosing how to get recommended by ChatGPT and other AI assistants: agencies, tools, apps and prices.",
  h1: "Choosing how to get recommended by AI",
  intro:
    "Plain comparisons for store owners deciding between an agency, a tool they run themselves, or GEO. Each page says where the other option is the better pick, and every outside price shows the day we checked it.",
  ogImage: "/og/home.png",
  ogAlt: "A small clay shop with a star in a speech bubble above it",
  updated: "2026-10-23",
} as const;

export const comparePath = (slug: string) => `${COMPARE_HUB.path}/${slug}`;

/** The waitlist on the home page, tagged so a sign-up shows which page it came from. */
export const waitlistHref = (slug: string) => `/?utm_source=usegeo&utm_medium=compare&utm_campaign=${slug}#waitlist`;

const OPTIMISING = { title: "Optimising: How much does GEO cost? (June 2025)", url: "https://www.optimising.com.au/blog/geo-cost" };
const DEBUTIFY = { title: "Debutify: The best Shopify GEO agencies, ranked (July 2026)", url: "https://debutify.com/blog/best-shopify-geo-agencies-ranked" };
const FIRSTINDEX = { title: "FirstIndex home page and pricing", url: "https://firstindex.com" };
const PROFOUND = { title: "Profound pricing page", url: "https://www.tryprofound.com/pricing" };
const SHOPIFY_15X = {
  title: "The Canadian Press: Shopify reports Q4 profit (February 2026)",
  url: "https://www.cp24.com/news/canada/2026/02/11/shopify-reports-us743m-q4-profit-revenue-up-31-per-cent-from-year-ago/",
};
const GOOGLE_IO = { title: "Google: Sundar Pichai's I/O 2026 keynote (May 2026)", url: "https://blog.google/innovation-and-ai/sundar-pichai-io-2026/" };

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: "geo-vs-seo-agency",
    title: "GEO vs an SEO agency: which does your store need? | GEO",
    description:
      "SEO agency or GEO? What each does in a month, where each one wins, and the questions to ask before you sign. For Australian Shopify brands.",
    short: "What each one does in a month, where each wins, and what to ask before you sign.",
    h1: "GEO or an SEO agency: which does an Australian Shopify brand need?",
    intro: [
      "If your problem is Google rankings, hire an SEO agency. If ChatGPT and other AI assistants name your rivals when shoppers ask what to buy, and not you, you need GEO: work aimed at getting your products recommended by AI.",
      "Plenty of brands need both. The two share a lot of groundwork, but they aim at different places and they report different things.",
    ],
    checked: "2026-10-23",
    sections: [
      {
        heading: "What each one does in a month",
        table: {
          head: ["", "SEO agency", "GEO (done for you)"],
          rows: [
            ["The goal", "Rank higher in Google's results and Maps", "Get named when shoppers ask ChatGPT, Gemini, Perplexity or Google AI Overviews what to buy"],
            ["What they change", "Site speed, technical fixes, keywords, blog posts, links", "Product details AI reads, buying guides, pitches to the sites AI quotes, honest Reddit replies"],
            ["What they report", "Rankings and Google traffic", "Which buying questions name you, which sites AI quotes, and orders and sales from AI"],
            ["Price in Australia", "Quoted per store", "Agencies: about A$2,000 to A$20,000+ a month. GEO: A$1,000 a month"],
          ],
        },
        paragraphs: ["Agency GEO prices are from Optimising's Australian price guide. SEO prices vary too much to quote fairly, so ask for a fixed monthly price."],
      },
      {
        heading: "When an SEO agency is the better pick",
        bullets: [
          "Your site is slow, broken on phones, or Google can't read it properly.",
          "You want one supplier for SEO, ads, email and your website.",
          "Most of your sales come from Google searches for your product names, and those rankings are slipping.",
          "You need a bigger team with designers and developers on hand.",
        ],
      },
      {
        heading: "When GEO is the better pick",
        bullets: [
          "Shoppers ask ChatGPT questions like \"best beard oil for dry skin in Australia\" and it names other brands.",
          "You want to know which sites AI quotes for your products, and to get onto them.",
          "You want to see the actual orders and sales that came from AI, not just mentions.",
          "You'd rather pay one set monthly price with no lock-in.",
        ],
      },
      {
        heading: "Why the two overlap",
        paragraphs: [
          "Clear, honest pages help with both. Google AI Overviews are built on Google's own results, so good SEO helps there.",
          "The big difference is that an AI answer names only a few brands and quotes only a few sites. Being on the roundups, retailers and threads it quotes matters more than ranking on page one. That is the part most SEO agencies don't track.",
        ],
      },
      {
        heading: "Questions to ask any agency before you sign",
        bullets: [
          "Which sites does ChatGPT quote for my top 10 buying questions, and are we on them?",
          "How will you show me orders from AI, not only mentions?",
          "Do you post on Reddit, and if so, as who? Fake customer posts break Reddit's rules and can get your brand banned.",
          "Is there a lock-in contract, and what happens if nothing changes after the first month?",
          "Will you promise me a top spot in ChatGPT? (If yes, walk away. Nobody can promise that.)",
        ],
      },
      {
        heading: "Where GEO fits",
        paragraphs: [
          "GEO is a done-for-you service for Shopify brands: A$1,000 a month, no lock-in, and a full refund if you're not happy after the first month. Our team and AI check 100 buying questions every day, fix your product pages, write 12 buying guides a month, send up to 40 pitches and show you the sales AI sends you.",
          "We are not an SEO agency. We don't do site speed, ads or full technical SEO. If you need those, keep your SEO agency and use us alongside it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is GEO just SEO with a new name?",
        a: "No, but they share groundwork. SEO aims at Google's ranked results. GEO aims at the few brands an AI assistant names in its answer, which depends a lot on the outside sites it quotes, such as roundups, retailers and Reddit.",
      },
      {
        q: "Can my SEO agency do GEO?",
        a: "Some can. Ask them which sites ChatGPT quotes for your buying questions and how they will show you orders from AI. If they can't answer both, they are probably still doing SEO only.",
      },
      {
        q: "Do I need both?",
        a: "Many stores do. If Google is your main source of sales, keep SEO going. Add GEO when shoppers in your category start asking AI what to buy.",
      },
      {
        q: "How fast will AI start naming my store?",
        a: "Nobody can promise a date. AI answers change from one run to the next, so we ask each question more than once and report the average. Product fixes can show up quickly; guides and mentions on other sites take longer.",
      },
    ],
    sources: [OPTIMISING, GOOGLE_IO],
    related: ["geo-cost-australia", "geo-vs-seo-vs-aeo"],
  },
  {
    slug: "geo-vs-seo-vs-aeo",
    title: "GEO vs SEO vs AEO: what's the difference? | GEO",
    description:
      "SEO, AEO and GEO in plain words: where each shows up, what helps, and how a Shopify store sees the money from each. Plus which one to start with.",
    short: "The three in plain words, where they overlap, and which to start with.",
    h1: "GEO vs SEO vs AEO: what's the difference, and which one makes a store money?",
    intro: [
      "SEO gets your pages ranked on Google. AEO (answer engine optimisation) gets your words used as the answer to a question. GEO (generative engine optimisation) gets your brand named when someone asks an AI assistant like ChatGPT what to buy.",
      "For a Shopify store they share most of the groundwork. The difference is where you show up and how you see the money.",
    ],
    checked: "2026-10-23",
    sections: [
      {
        heading: "The three side by side",
        table: {
          head: ["", "SEO", "AEO", "GEO"],
          rows: [
            ["Aims for", "A high spot in Google's results", "Your words quoted as the answer", "Your brand named in AI's recommendations"],
            ["Shows up in", "Google and Bing results", "Featured answers, voice assistants, AI Overviews", "ChatGPT, Gemini, Perplexity, Google AI Overviews and AI Mode"],
            ["What helps most", "Fast pages, keywords, links", "Short, direct answers in question and answer form", "Clear product details, buying guides, and mentions on the sites AI quotes"],
            ["How you see the money", "Google traffic and orders in Shopify", "Hard to see: answers often get no click", "Visits and orders from AI assistants, tracked in Shopify"],
          ],
        },
      },
      {
        heading: "Where they overlap",
        paragraphs: [
          "All three reward clear, honest pages that answer real questions. A product page that says who it's for, what's in it, sizes and shipping helps Google and AI alike.",
          "AEO and GEO are mostly the same work. People use the names loosely, so don't pay twice for them.",
        ],
      },
      {
        heading: "Where they split",
        paragraphs: [
          "Google shows ten links. An AI answer names a handful of brands and quotes a handful of sites, often roundups, retailers and Reddit threads. So for GEO, being mentioned on those outside sites counts as much as your own pages.",
          "AI is also big now. Google says AI Overviews reach over 2.5 billion people a month, and Shopify's president said in February 2026 that orders from AI search were 15 times higher than in January 2025.",
        ],
      },
      {
        heading: "How to see the money from each in Shopify",
        bullets: [
          "ChatGPT adds utm_source=chatgpt.com to the links it shows, so those visits and orders can be counted.",
          "Perplexity, Gemini, Copilot and Claude show up as the site the visitor came from.",
          "Google AI Overviews and AI Mode can't be separated from normal Google traffic. Anyone who says otherwise is guessing.",
          "GEO shows visits, orders and sales from AI assistants and from search engines side by side, from a small tracking code you paste into Shopify.",
        ],
      },
      {
        heading: "Which one to start with",
        bullets: [
          "Your site has technical problems or barely shows on Google: start with SEO.",
          "Your site is fine, but AI names rivals for your buying questions: start with GEO.",
          "You sell something people research before buying (skincare, supplements, gear): do GEO alongside your SEO, since those shoppers ask AI first.",
        ],
      },
    ],
    faqs: [
      { q: "Is AEO the same as GEO?", a: "Close enough. AEO is about being the answer; GEO is about being the brand AI recommends. The work overlaps so much that most people use the words for the same thing." },
      { q: "Does SEO still matter?", a: "Yes. Google is still a big source of visits for most stores, and Google's AI answers are built on its own results." },
      { q: "Which one should a small store start with?", a: "Check first. Ask ChatGPT the questions your shoppers ask, or use our free AI Visibility Checker. If AI never names you, GEO is the gap." },
    ],
    sources: [GOOGLE_IO, SHOPIFY_15X],
    related: ["geo-vs-seo-agency", "geo-cost-australia"],
  },
  {
    slug: "geo-cost-australia",
    title: "How much does GEO cost in Australia? (2026) | GEO",
    description:
      "GEO prices in Australia compared: agencies, tracking tools and done-for-you services, with what you get at each price and the costs people miss.",
    short: "Agency, tool and done-for-you prices side by side, with the costs people miss.",
    h1: "How much does GEO cost in Australia? Agency, tool and done-for-you prices compared",
    intro: [
      "Australian agencies charge about A$2,000 to A$20,000 or more a month for GEO, according to Optimising's price guide. Tracking tools cost far less, about A$50 to A$500 a month, but you do the work yourself.",
      "GEO is A$1,000 a month, done for you, with no lock-in contract.",
    ],
    checked: "2026-10-23",
    sections: [
      {
        heading: "Prices side by side",
        table: {
          head: ["Option", "Example", "Price", "What you get"],
          rows: [
            ["Tracking tool", "Peec AI, Otterly, Profound", "About A$50 to A$500 a month for most tools. Profound lists a free trial and custom prices only", "Reports on where AI names you. You make the changes"],
            ["Australian agency, entry", "Various", "A$2,000 to A$4,000 a month", "Basic content changes, some list placements, light tracking"],
            ["Australian agency, mid", "Various", "A$4,000 to A$10,000 a month", "Audits, content written for AI, tracking across ChatGPT, Perplexity and Gemini"],
            ["Australian agency, full", "Various", "A$10,000 to A$20,000+ a month", "All of the above plus SEO, structured data and ongoing content"],
            ["Shopify GEO agency (overseas)", "Netalico (US)", "About US$3,000 a month", "Product data, schema and feed work for Shopify Plus stores"],
            ["Done for you, software only", "FirstIndex", "US$2,000 a month after a 3-month start, or US$1,500 a month on 12 months", "Daily site changes, up to 12 articles and 50+ page fixes a month"],
            ["Done for you, Shopify brands", "GEO", "A$1,000 a month, no lock-in", "100 questions checked daily, fixes, 12 guides, up to 40 pitches, Reddit replies, sales from AI, a monthly call"],
          ],
        },
        paragraphs: [
          "Agency price ranges are from Optimising's guide (June 2025). Netalico's price is from Debutify's review (July 2026). FirstIndex and Profound are from their own pages. All checked on 23 October 2026.",
        ],
      },
      {
        heading: "Costs people miss",
        bullets: [
          "Lock-in contracts. Some ask for several months up front (FirstIndex, for example, starts with 3 months).",
          "Audits sold separately. Optimising puts one-off AI audits at A$10,000 to A$20,000.",
          "Your own time. A tool is cheap, but someone still has to write the guides, fix the product pages and pitch the sites AI quotes. That takes real hours every week.",
          "Paying for reports with no sales attached. Ask to see orders and sales from AI, not only mentions.",
        ],
      },
      {
        heading: "When a cheaper option is the right call",
        bullets: [
          "You have a marketer with spare hours: a tracking tool plus their time can work well.",
          "You sell software, not products: a specialist like FirstIndex is built for that.",
          "You need full SEO, ads and web work too: a bigger agency covers more ground.",
        ],
      },
      {
        heading: "A quick sum before you spend",
        paragraphs: [
          "Work out how many extra orders cover the cost. If your average order is A$100 and you keep A$40 of it after costs, you need 25 extra orders a month from AI to cover A$1,000.",
          "Shopify's president said in February 2026 that orders from AI search were 15 times higher than a year earlier. Whether that reaches your store depends on whether AI names you, which is what to check first.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why is GEO cheaper than most agencies?",
        a: "We only work with Shopify brands and offer one plan. AI does most of the research and first drafts, and our team checks and sends everything. That keeps the cost down without cutting the work.",
      },
      { q: "Is there a contract?", a: "No lock-in. You pay monthly and can cancel any time." },
      { q: "What if it doesn't work?", a: "If you're not happy after the first month, you get a full refund and keep all the work we did." },
      { q: "Can I try it for free first?", a: "Yes. Our free AI Visibility Checker shows whether ChatGPT and other assistants name your products, with no sign-up." },
    ],
    sources: [OPTIMISING, DEBUTIFY, FIRSTINDEX, PROFOUND, SHOPIFY_15X],
    related: ["geo-vs-seo-agency", "geo-vs-seo-vs-aeo"],
  },
];

export function compareBySlug(slug: string): ComparePage | undefined {
  return COMPARE_PAGES.find((p) => p.slug === slug);
}

// ---------- JSON-LD ----------

const ORG_ID = ORG_NODE["@id"];

/** One @graph for a page: Organization, Article, FAQPage and BreadcrumbList. */
export function compareJsonLd(p: ComparePage): Record<string, unknown> {
  const url = abs(comparePath(p.slug));
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG_NODE,
      {
        "@type": "Article",
        "@id": `${url}#article`,
        url,
        mainEntityOfPage: url,
        headline: p.h1,
        description: p.description,
        datePublished: COMPARE_HUB.updated,
        dateModified: p.checked,
        inLanguage: "en-AU",
        image: abs(COMPARE_HUB.ogImage),
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
        citation: p.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })),
        isPartOf: PART_OF,
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: p.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumbs(`${url}#crumbs`, [{ name: HOME_CRUMB, path: "/" }, { name: COMPARE_HUB.name, path: COMPARE_HUB.path }, { name: stripBrand(p.title) }]),
    ],
  };
}

/** One @graph for the hub: Organization, CollectionPage, ItemList and BreadcrumbList. */
export function compareHubJsonLd(): Record<string, unknown> {
  const url = abs(COMPARE_HUB.path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG_NODE,
      {
        "@type": "CollectionPage",
        "@id": url,
        url,
        name: stripBrand(COMPARE_HUB.title),
        description: COMPARE_HUB.description,
        dateModified: COMPARE_HUB.updated,
        mainEntity: { "@id": `${url}#pages` },
        isPartOf: PART_OF,
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#pages`,
        numberOfItems: COMPARE_PAGES.length,
        itemListElement: COMPARE_PAGES.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.h1, url: abs(comparePath(p.slug)) })),
      },
      breadcrumbs(`${url}#crumbs`, [{ name: HOME_CRUMB, path: "/" }, { name: COMPARE_HUB.name }]),
    ],
  };
}
