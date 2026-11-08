// The /compare pages: honest buying pages for store owners choosing between FirstPicked, an agency, a tool or an app
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
  /** Under 60 characters, ends in " | FirstPicked". */
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
  /** The day the page went live (YYYY-MM-DD). Default: COMPARE_LAUNCHED. */
  published?: string;
  sections: CompareSection[];
  faqs: Faq[];
  sources: CompareSource[];
  /** Other compare pages (their slug) or service pages (their path, like "/seo-agency-perth"). */
  related: string[];
}

export const COMPARE_HUB = {
  name: "Compare",
  path: "/compare",
  title: "Compare FirstPicked with agencies and tools | FirstPicked",
  description:
    "Honest comparisons for Shopify brands choosing how to get recommended by ChatGPT and other AI assistants: agencies, tools, apps and prices.",
  h1: "Choosing how to get recommended by AI",
  intro:
    "Simple comparisons for store owners choosing between an agency, a tool they run themselves, or FirstPicked. Each page says when the other option is the better pick. Every price from another company shows the day we checked it.",
  ogImage: "/og/home.png",
  ogAlt: "A small clay shop with a star in a speech bubble above it",
  updated: "2026-11-08",
} as const;

/** The day the first comparison pages went live. */
export const COMPARE_LAUNCHED = "2026-10-23";

export const comparePath = (slug: string) => `${COMPARE_HUB.path}/${slug}`;


const OPTIMISING = { title: "Optimising: How much does GEO cost? (June 2025)", url: "https://www.optimising.com.au/blog/geo-cost" };
const DEBUTIFY = { title: "Debutify: The best Shopify GEO agencies, ranked (July 2026)", url: "https://debutify.com/blog/best-shopify-geo-agencies-ranked" };
const FIRSTINDEX = { title: "FirstIndex home page and pricing", url: "https://firstindex.com" };
const PROFOUND = { title: "Profound pricing page", url: "https://www.tryprofound.com/pricing" };
const SHOPIFY_15X = {
  title: "The Canadian Press: Shopify reports Q4 profit (February 2026)",
  url: "https://www.cp24.com/news/canada/2026/02/11/shopify-reports-us743m-q4-profit-revenue-up-31-per-cent-from-year-ago/",
};
const GOOGLE_IO = { title: "Google: Sundar Pichai's I/O 2026 keynote (May 2026)", url: "https://blog.google/innovation-and-ai/sundar-pichai-io-2026/" };

// The Perth agencies' own home pages, read on 8 November 2026 (only what each says about itself).
const CONCISE = { title: "Concise Digital home page", url: "https://www.concise.digital/" };
const MUSEPROJECT = { title: "Museproject home page", url: "https://museproject.com.au/" };
const DIGITAL_HITMEN = { title: "Digital Hitmen home page", url: "https://www.digitalhitmen.com.au/" };
export const SEO_ROOM = { title: "The SEO Room home page and prices", url: "https://seoroom.com.au/" };
const LOADED = { title: "Loaded Communications home page", url: "https://loadedcommunications.com.au/" };
const DAISY = { title: "Daisy Digital home page", url: "https://daisydigital.com.au/" };

export const COMPARE_PAGES: ComparePage[] = [
  {
    slug: "best-seo-agencies-perth",
    title: "Best SEO agencies in Perth for online stores | FirstPicked",
    description:
      "Seven Perth SEO agencies for online stores, from their own websites: who each one suits, prices where shown, and lock-in. Checked November 2026.",
    short: "Seven Perth agencies for online stores: who each suits, prices and lock-in.",
    h1: "The best SEO agencies in Perth for online stores, and who each one suits",
    intro: [
      "Short answer: if your Shopify store also needs building or fixing, look at Concise Digital. For SEO across a whole store, look at Museproject or Digital Hitmen. The SEO Room suits local service businesses best. FirstPicked suits Shopify brands that want to be picked by AI and Google for one set price.",
      "We're FirstPicked, a Perth service, so we're on this list and we're biased. To keep it fair, we only used what each agency says on its own website.",
    ],
    checked: "2026-11-08",
    published: "2026-11-08",
    sections: [
      {
        heading: "Seven Perth agencies side by side",
        table: {
          head: ["Agency", "Where", "Best for", "Price on their site", "Lock-in"],
          rows: [
            ["Concise Digital", "Perth and Sydney", "Building and fixing Shopify stores, plus SEO and ads", "Not shown", "None, cancel any time"],
            ["Museproject", "Perth", "Specialist SEO for online stores", "Not shown", "Not shown"],
            ["Digital Hitmen", "Perth", "Ecommerce SEO, AI search, web design and ads", "Not shown", "A 6-month start, then month to month"],
            ["The SEO Room", "Canning Vale", "Local service businesses, like tradies and real estate", "A$1,500 to A$5,000 + GST a month", "None"],
            ["Loaded Communications", "Perth, since 2001", "Brand, WordPress websites and SEO", "Not shown", "Not shown"],
            ["Daisy Digital", "Leederville", "Social media, ads, websites and SEO", "Not shown", "Not shown"],
            ["FirstPicked", "Perth", "Shopify brands that want to be picked by AI and Google", "A$945 a month", "None, and a full refund after month 1"],
          ],
        },
        paragraphs: ["\"Not shown\" means we couldn't find it on their home page on 8 November 2026. Ask them. Many agencies quote each store on its own."],
      },
      {
        heading: "Concise Digital",
        paragraphs: [
          "A big team. Their site says they have 50+ specialists, with teams in Perth and Sydney. They are a Shopify partner that builds and fixes Shopify stores, and they also do SEO, Google Ads and social media.",
          "Pick them if your store itself needs work. Their site says there are no locked-in contracts and you can cancel any time.",
        ],
      },
      {
        heading: "Museproject",
        paragraphs: [
          "Their site calls them a specialist SEO and ecommerce agency that doesn't try to be a jack of all trades. It shows results for an online activewear store.",
          "ChatGPT named them first when we asked for the best Perth SEO agency for a Shopify store. Their home page shows no price or contract terms, so ask.",
        ],
      },
      {
        heading: "Digital Hitmen",
        paragraphs: [
          "Started in 2016. They do SEO, ecommerce SEO, AI search, web design and ads, and their site lists search awards. One case study is an online flooring store.",
          "Work starts with a 6-month sprint, then goes month to month. A good fit for a bigger brand that wants one team for everything.",
        ],
      },
      {
        heading: "The SEO Room",
        paragraphs: [
          "Based in Canning Vale, with clear prices: A$1,500 to A$5,000 + GST a month, and no lock-in. They work on Google, Google Maps and AI answers together.",
          "Most of their clients are tradies, builders, solar, real estate and other service businesses. Great if you're a local service. Less of a fit for an online store.",
        ],
      },
      {
        heading: "Loaded Communications",
        paragraphs: [
          "In Perth since 2001. They do branding, WordPress websites, SEO and AI search. A good pick if you want a new brand and website along with your SEO. Their site leads with WordPress, not Shopify.",
        ],
      },
      {
        heading: "Daisy Digital",
        paragraphs: [
          "A Leederville team for social media, content, websites and ads. Reviews on their site mention a Shopify store build, SEO and Google Ads. A good local all-rounder.",
        ],
      },
      {
        heading: "FirstPicked",
        paragraphs: [
          "That's us. FirstPicked is run from Perth by its founder, Ross Delport. One plan for Shopify brands: A$945 a month, done for you. Each day we check up to 100 buying questions in ChatGPT, Gemini, Perplexity and Google AI Overviews. Each month we make 50+ fixes to your pages, write up to 12 buying guides, and show you the sales AI sends you.",
          "We don't build stores, run ads or do Google Maps. If you need those, one of the agencies above is the better pick.",
        ],
      },
      {
        heading: "What ChatGPT says",
        paragraphs: [
          "On 8 November 2026 we asked ChatGPT for the \"best seo agency in perth for a shopify store\". It named Museproject, Perceptiv Digital, Concise Digital, The SEO Room and Digital Hitmen.",
          "It built that answer from lists on other sites, like Semrush's agency list and Local Digital's blog, not from the agencies' own pages. AI answers change from one run to the next, so treat this as one snapshot.",
        ],
      },
      {
        heading: "How to choose",
        bullets: [
          "Does your store need building or fixing? Start with a Shopify developer, like a Shopify partner.",
          "Ask to see work for another online store, not only local services.",
          "Get the monthly price in writing, and ask about lock-in.",
          "Ask how they'll show you sales, not only rankings.",
          "Ask which sites ChatGPT reads for your buying questions, and how they'll get you onto them.",
          "If anyone promises you the top spot on Google or ChatGPT, walk away. Nobody can promise that.",
        ],
      },
      {
        heading: "How we checked",
        paragraphs: [
          "We read each agency's own home page on 8 November 2026. Nobody paid to be on this page. We left out star ratings because they change every day.",
        ],
      },
    ],
    faqs: [
      {
        q: "How much does SEO cost in Perth?",
        a: "Most Perth agencies don't show a price on their website. The SEO Room shows A$1,500 to A$5,000 + GST a month. FirstPicked is A$945 a month. Always get the monthly price in writing.",
      },
      {
        q: "Do I need an agency in Perth?",
        a: "No. SEO work is done online, so a good agency anywhere can help. A Perth team is handy if you like to share a time zone or meet in person.",
      },
      {
        q: "Which Perth agency is best for a Shopify store?",
        a: "It depends on the job. To build or fix the store, a Shopify partner like Concise Digital. For SEO across the whole store, a specialist like Museproject or Digital Hitmen. To be picked by AI and Google for one set monthly price, FirstPicked.",
      },
      {
        q: "Is FirstPicked an SEO agency?",
        a: "Not a full-service one. We don't build stores, run ads or do Google Maps. We get Shopify brands found on Google and picked by AI, and show the sales that come from it.",
      },
    ],
    sources: [CONCISE, MUSEPROJECT, DIGITAL_HITMEN, SEO_ROOM, LOADED, DAISY],
    related: ["/seo-agency-perth", "geo-vs-seo-agency", "geo-cost-australia"],
  },
  {
    slug: "geo-vs-seo-agency",
    title: "GEO vs an SEO agency: which one do you need? | FirstPicked",
    description:
      "SEO agency or GEO? What each does in a month, where each one wins, and the questions to ask before you sign. For Australian Shopify brands.",
    short: "What each one does in a month, where each wins, and what to ask before you sign.",
    h1: "GEO or an SEO agency: which does an Australian Shopify brand need?",
    intro: [
      "If your problem is Google rankings, hire an SEO agency. Do ChatGPT and other AI apps name your rivals, and not you, when shoppers ask what to buy? Then you need GEO: work that gets AI to suggest your products.",
      "Plenty of brands need both. The two share a lot of groundwork, but they aim at different places and they report different things.",
    ],
    checked: "2026-10-23",
    sections: [
      {
        heading: "What each one does in a month",
        table: {
          head: ["", "SEO agency", "FirstPicked (done for you)"],
          rows: [
            ["The goal", "Rank higher in Google's results and Maps", "Get named when shoppers ask ChatGPT, Gemini, Perplexity or Google AI Overviews what to buy"],
            ["What they change", "Site speed, technical fixes, keywords, blog posts, links", "Product details AI reads, buying guides, and finding the sites AI quotes"],
            ["What they report", "Rankings and Google traffic", "Which buying questions name you, which sites AI quotes, and orders and sales from AI"],
            ["Price in Australia", "Quoted per store", "GEO agencies: about A$2,000 to A$20,000+ a month. FirstPicked: A$945 a month"],
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
        heading: "Where FirstPicked fits",
        paragraphs: [
          "FirstPicked is a done-for-you service for Shopify brands. It's A$945 a month, with no lock-in and a full refund if you're not happy after the first month. Our team and AI check 100 buying questions every day and fix your product pages. We write 12 buying guides a month and show you the sales AI sends you.",
          "We are not a full-service SEO agency. We don't do site speed, ads or full technical SEO. If you need those, keep your SEO agency and use us alongside it.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is GEO just SEO with a new name?",
        a: "No, but they share groundwork. SEO aims at Google's ranked results. GEO aims to be one of the few brands an AI app names in its answer. That depends a lot on the other sites it quotes, like review lists, shops and Reddit.",
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
    related: ["geo-cost-australia", "geo-vs-seo-vs-aeo", "best-seo-agencies-perth"],
  },
  {
    slug: "geo-vs-seo-vs-aeo",
    title: "GEO vs SEO vs AEO: what's the difference? | FirstPicked",
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
          "Google shows ten links. An AI answer names a few brands and quotes a few sites, often review lists, shops and Reddit threads. So for GEO, being mentioned on those outside sites counts as much as your own pages.",
          "AI is also big now. Google says AI Overviews reach over 2.5 billion people a month. And in February 2026, Shopify's president said orders from AI search were 15 times higher than in January 2025.",
        ],
      },
      {
        heading: "How to see the money from each in Shopify",
        bullets: [
          "ChatGPT adds utm_source=chatgpt.com to the links it shows, so those visits and orders can be counted.",
          "Perplexity, Gemini, Copilot and Claude show up as the site the visitor came from.",
          "Google AI Overviews and AI Mode can't be separated from normal Google traffic. Anyone who says otherwise is guessing.",
          "FirstPicked shows visits, orders and sales from AI and from search engines side by side. It uses a small code you paste into Shopify.",
        ],
      },
      {
        heading: "Which one to start with",
        bullets: [
          "Your site has technical problems or barely shows on Google: start with SEO.",
          "Your site is fine, but AI names rivals for your buying questions: start with GEO.",
          "You sell something people look into before buying (skincare, supplements, gear). Do GEO along with your SEO, because those shoppers ask AI first.",
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
    title: "How much does GEO cost in Australia? (2026) | FirstPicked",
    description:
      "GEO prices in Australia compared: agencies, tracking tools and done-for-you services, with what you get at each price and the costs people miss.",
    short: "Agency, tool and done-for-you prices side by side, with the costs people miss.",
    h1: "How much does GEO cost in Australia? Agency, tool and done-for-you prices compared",
    intro: [
      "Australian agencies charge about A$2,000 to A$20,000 or more a month for GEO, according to Optimising's price guide. Tracking tools cost far less, about A$50 to A$500 a month, but you do the work yourself.",
      "FirstPicked is A$945 a month, done for you, with no lock-in contract.",
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
            ["Done for you, Shopify brands", "FirstPicked", "A$945 a month, no lock-in", "100 questions checked daily, 50+ page fixes, 12 guides, sales from AI, weekly reports, a monthly call"],
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
          "Work out how many extra orders cover the cost. Say your average order is A$100 and you keep A$40 of it after costs. Then you need 24 extra orders a month from AI to cover A$945.",
          "Shopify's president said in February 2026 that orders from AI search were 15 times higher than a year earlier. Whether that reaches your store depends on whether AI names you, which is what to check first.",
        ],
      },
    ],
    faqs: [
      {
        q: "Why is FirstPicked cheaper than most agencies?",
        a: "We only work with Shopify brands and offer one plan. AI does most of the research and first drafts, and our team checks and sends everything. That keeps the cost down without cutting the work.",
      },
      { q: "Is there a contract?", a: "No lock-in. You pay monthly and can cancel any time." },
      { q: "What if it doesn't work?", a: "If you're not happy after the first month, you get a full refund and keep all the work we did." },
      { q: "Can I try it for free first?", a: "Yes. Our free AI Visibility Checker shows if ChatGPT and other AI apps name your products. No sign-up needed." },
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
        datePublished: p.published ?? COMPARE_LAUNCHED,
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
