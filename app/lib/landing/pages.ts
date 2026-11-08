// The service pages and guides at the top level of the site: one page per thing a store owner searches for, like
// firstpicked.com.au/seo-agency-perth for "seo agency perth" (Ross, 8 Nov 2026: "go after all the buying ones in perth
// first", then "build them all"). Built from the searches in /mnt/project-files/keywords/ (DataForSEO through Treg).
// One page per search group, never near-copies for other cities or wordings (Google's doorway page rules). Same honesty
// rules as the compare pages: say who we're not for, date every outside price and fact, never promise results.
// Service pages ("I want to hire") get Service JSON-LD; guides ("I want to learn", kind "guide") get Article JSON-LD.
// Pure and browser-safe. Served by app/landing/route.tsx at the paths in ./paths.ts. Copy rules: grade 5 English, no
// dashes as punctuation.

import {
  COMPARE_HUB,
  COMPARE_PAGES,
  GEO_PAPER,
  GOOGLE_IO,
  GOOGLE_SPAM,
  OPENAI_DEVDAY,
  OPENAI_MERCHANTS,
  OPENAI_SHOPPING,
  OPTIMISING,
  SEO_ROOM,
  SHOPIFY_15X,
  SHOPIFY_AI,
  SHOPIFY_SEO,
  compareBySlug,
  comparePath,
  type ComparePage,
} from "../compare/pages";
import { HOME_CRUMB, ORG_NODE, PART_OF, breadcrumbs, stripBrand } from "../tools/seo";
import { abs } from "../tools/site";

export interface LandingPage extends Omit<ComparePage, "slug"> {
  /** The address after the slash, like "seo-agency-perth". Must be in LANDING_SLUGS. */
  slug: string;
  /** The small tag above the H1. */
  tag: string;
  /** "service" (default): a page for people ready to hire. "guide": a page for people learning. */
  kind?: "service" | "guide";
  /** The city the page is about, for areaServed in the JSON-LD. */
  city?: string;
}

const SHOPIFY_PARTNERS = { title: "Shopify Partner Directory", url: "https://www.shopify.com/partners/directory" };

/** What the plan does each month, the same on every service page (keep in step with the home page). */
const MONTHLY_WORK = [
  "Check up to 100 buying questions every day in ChatGPT, Gemini, Perplexity and Google AI Overviews, plus Claude every week. You see who gets picked.",
  "Make 50+ fixes to your product pages, so Google and AI can tell what you sell and who it's for.",
  "Write up to 12 buying guides a month. Each one answers a real buyer question, like \"best beard oil for dry skin in Australia\".",
  "Find the sites AI reads before it picks a brand, and show you which ones name your rivals.",
  "Show you the visits, orders and sales that came from AI and from Google.",
  "Send you a report every week, and have a call with you each month about what's next.",
  "Check everything we write against your real product facts. No made-up claims or reviews.",
];

const RESULTS_FAQ = {
  q: "How long until I see results?",
  a: "It builds over about three months. In month 1 we start the work. In month 2, Google and AI start to find the new pages. In month 3, clicks and sales can grow. Nobody can promise exact results, and we won't.",
};
const CONTRACT_FAQ = { q: "Is there a contract?", a: "No lock-in. You pay monthly and can stop any time." };
const FREE_CHECK_FAQ = {
  q: "Can I check my store for free first?",
  a: "Yes. Our free AI Visibility Checker shows if ChatGPT and other AI apps name your products. No sign-up needed.",
};

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
        bullets: MONTHLY_WORK,
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
      RESULTS_FAQ,
      CONTRACT_FAQ,
      {
        q: "How is this different from normal SEO?",
        a: "Normal SEO aims for a high spot on Google. We aim for that, and for being one of the few brands ChatGPT and other AI apps name when shoppers ask what to buy. Then we show you the sales that came from AI.",
      },
      FREE_CHECK_FAQ,
    ],
    sources: [SEO_ROOM, SHOPIFY_PARTNERS],
    related: ["best-seo-agencies-perth", "/shopify-seo-agency", "geo-vs-seo-agency"],
  },
  {
    slug: "ai-seo-agency",
    tag: "AI SEO",
    title: "AI SEO agency for Shopify brands in Australia | FirstPicked",
    description:
      "AI SEO for Australian Shopify brands: get named by ChatGPT, Gemini and Google's AI, and see the sales. A$945 a month, done for you, no lock-in.",
    short: "AI SEO for Shopify brands: get picked by ChatGPT and Google's AI, and see the sales.",
    h1: "An AI SEO agency for Australian Shopify brands. Get picked by ChatGPT, and see the sales.",
    intro: [
      "FirstPicked is an AI SEO agency for Shopify brands. Some people call it GEO or AEO. It's all the same goal: when a shopper asks ChatGPT, Gemini, Perplexity or Google's AI what to buy, your products get named.",
      "It's A$945 a month, done for you, with no lock-in contract. If you're not happy after the first month, you get a full refund and keep all the work.",
    ],
    checked: "2026-11-08",
    published: "2026-11-08",
    sections: [
      {
        heading: "What AI SEO means for a store",
        paragraphs: [
          "Normal SEO tries to get your pages high in Google's list of links. AI SEO tries to get your brand named inside the answer. An AI answer often names just a few brands.",
          "It picks them from what it can read: clear product details, and other sites it trusts, like review lists, shops and Reddit threads. OpenAI says ChatGPT looks at product details like price and description, other sites' content, and reviews from public websites. So that's what we work on.",
        ],
      },
      { heading: "What we do for your store each month", bullets: MONTHLY_WORK },
      {
        heading: "How you'll know it's working",
        bullets: [
          "You see which of your buying questions name you, in each AI app, every day.",
          "You see who AI picks instead of you, and which sites it reads.",
          "You see the visits, orders and sales from AI. A small code you add to Shopify counts them. ChatGPT adds utm_source=chatgpt.com to its links, so those visits can be counted.",
          "Google AI Overviews can't be split from normal Google visits, so we show them as Google and say so.",
        ],
      },
      {
        heading: "Is this the right fit?",
        table: {
          head: ["If you...", "Then"],
          rows: [
            ["Sell on Shopify, A$5,000 a month or more", "Yes. This is who we built FirstPicked for."],
            ["Want ChatGPT and Google's AI to name your products", "Yes. That's all we work on."],
            ["Sell software or services, not products", "No. An agency that works with your kind of business will suit you better."],
            ["Need digital PR or press coverage", "No. A bigger agency with a PR team is the better pick."],
            ["Want Google or Facebook ads run for you", "No. We don't run ads."],
          ],
        },
      },
      {
        heading: "Why AI matters for your store now",
        paragraphs: [
          "1.2 billion people use ChatGPT every week, OpenAI said in September 2026. Google says its AI Overviews reach over 2.5 billion people a month. And in February 2026, Shopify's president said orders from AI search were 15 times higher than in January 2025.",
          "When a shopper asks AI what to buy and it names three brands, the fourth brand doesn't get a look.",
        ],
      },
      {
        heading: "What AI SEO costs in Australia",
        paragraphs: [
          "Optimising's Australian price guide puts agency GEO at about A$2,000 to A$20,000 or more a month. Tools that only track AI answers cost less, but you do the work.",
          "FirstPicked is A$945 a month, done for you. There's no lock-in, and you can stop any time.",
        ],
      },
      {
        heading: "Questions to ask any AI SEO agency",
        bullets: [
          "Which AI apps do you check, and how often?",
          "Do you ask each question more than once? AI answers change from one run to the next.",
          "How will you show me sales from AI, not only mentions?",
          "Do you post on Reddit, and as who? Fake customer posts break Reddit's rules.",
          "Do you buy links or paid spots in list articles? Google's spam rules say buying links to rank is link spam.",
          "Can you promise me a spot in ChatGPT? (If they say yes, walk away. Nobody can promise that.)",
        ],
      },
    ],
    faqs: [
      {
        q: "What is an AI SEO agency?",
        a: "A team that works to get your brand named in AI answers, like ChatGPT, Gemini, Perplexity and Google AI Overviews. Some call it a GEO agency or an AEO agency.",
      },
      {
        q: "Is AI SEO the same as GEO?",
        a: "Yes, near enough. AI SEO, GEO (generative engine optimisation) and AEO (answer engine optimisation) are names for the same kind of work. Our guide \"What is GEO?\" explains it in plain words.",
      },
      {
        q: "Will AI SEO hurt my Google rankings?",
        a: "It shouldn't. Clear product pages and honest buying guides help Google too, and Google's AI Overviews are built on its own results.",
      },
      {
        q: "Which AI apps do you check?",
        a: "ChatGPT, Gemini, Perplexity and Google AI Overviews every day, and Claude every week. We ask each question more than once, because answers change.",
      },
      RESULTS_FAQ,
      CONTRACT_FAQ,
    ],
    sources: [OPENAI_SHOPPING, OPENAI_DEVDAY, GOOGLE_IO, SHOPIFY_15X, OPTIMISING, GOOGLE_SPAM],
    related: ["best-ai-seo-agencies-australia", "/what-is-geo", "geo-cost-australia"],
  },
  {
    slug: "shopify-seo-agency",
    tag: "Shopify SEO",
    title: "Shopify SEO agency for Google and AI search | FirstPicked",
    description:
      "Shopify SEO, done for you: product page fixes, buying guides and sales tracking, so Google and ChatGPT find your products. A$945 a month, no lock-in.",
    short: "Shopify SEO done for you: found on Google, named by AI, with the sales tracked.",
    h1: "Shopify SEO, done for you. Get your products found on Google and named by AI.",
    intro: [
      "FirstPicked is an SEO agency that only works with Shopify stores. We fix your product pages, write buying guides and track your sales, so Google and AI apps like ChatGPT can find your products and suggest them.",
      "It's A$945 a month, with no lock-in contract. If you're not happy after the first month, you get a full refund and keep all the work.",
    ],
    checked: "2026-11-08",
    published: "2026-11-08",
    sections: [
      {
        heading: "What Shopify already does for you",
        paragraphs: [
          "Shopify does some SEO on its own. It makes your sitemap and robots.txt files, adds canonical tags so copies of a page don't compete, and turns on SSL. Most themes add product details for Google, like price and stock.",
          "What Shopify can't do is write your pages well. That's where most stores lose.",
        ],
      },
      {
        heading: "What Shopify SEO covers",
        bullets: [
          "Product titles and descriptions that say what it is, who it's for and the key facts, like size, materials or ingredients.",
          "Page titles and meta descriptions for each product and collection.",
          "Collection pages with a short, useful intro.",
          "Alt text on product images, so Google can tell what's in them.",
          "Buying guides that answer the questions shoppers ask before they buy.",
          "Mentions on other trusted sites, earned honestly. Never bought.",
        ],
      },
      { heading: "What we do for your store each month", bullets: MONTHLY_WORK },
      {
        heading: "Shopify SEO and AI search, together",
        paragraphs: [
          "Shoppers now ask AI what to buy, as well as Google. Shopify's own help pages say AI systems need full product facts: specs, sizing, materials and care. OpenAI says ChatGPT picks products using details like price and description, plus other sites and public reviews.",
          "OpenAI also says stores that sell through Shopify already have their catalog linked to ChatGPT shopping, which is live in the US for now. So the same product facts that help Google help ChatGPT too. We work on both at once.",
        ],
      },
      {
        heading: "Is this the right fit?",
        table: {
          head: ["If you...", "Then"],
          rows: [
            ["Sell on Shopify, A$5,000 a month or more", "Yes. This is who we built FirstPicked for."],
            ["Sell on another platform, like WooCommerce", "Not right now. We only work with Shopify stores."],
            ["Need a theme built, or a store moved to Shopify", "No. Start with a Shopify developer from Shopify's Partner Directory."],
            ["Want Google or Facebook ads run for you", "No. We don't run ads."],
          ],
        },
      },
      {
        heading: "What it costs",
        paragraphs: [
          "A$945 a month. There's no lock-in contract, and you can stop any time. If you're not happy after the first month, you get a full refund and keep all the work.",
          "Most ecommerce SEO agencies in Australia quote each store on its own. Our list of the best SEO agencies in Perth shows the prices that are public.",
        ],
      },
      {
        heading: "Questions to ask any Shopify SEO agency",
        bullets: [
          "Can you show me work for another Shopify store?",
          "Who writes the product copy, and how do you check it's true?",
          "How will you show me sales, not only rankings?",
          "Is there a lock-in contract?",
          "Do you buy links? Google's spam rules say buying links to rank is link spam, and it can hurt your store.",
          "Can you promise me the top spot on Google? (If they say yes, walk away. Nobody can promise that.)",
        ],
      },
    ],
    faqs: [
      {
        q: "Does Shopify do SEO for me?",
        a: "Some of it. Shopify makes your sitemap and robots.txt files and adds canonical tags. The words on your pages, your product details and your guides are up to you.",
      },
      {
        q: "What's the difference between Shopify SEO and ecommerce SEO?",
        a: "Ecommerce SEO is the work of getting any online store found. Shopify SEO is that work done on Shopify, using Shopify's own product fields and settings.",
      },
      {
        q: "Do you work with stores outside Australia?",
        a: "Right now we work with Australian Shopify brands. We have 5 spots.",
      },
      RESULTS_FAQ,
      CONTRACT_FAQ,
      FREE_CHECK_FAQ,
    ],
    sources: [SHOPIFY_SEO, SHOPIFY_AI, OPENAI_SHOPPING, OPENAI_MERCHANTS, GOOGLE_SPAM, SHOPIFY_PARTNERS],
    related: ["/chatgpt-shopping", "/ai-seo-agency", "best-seo-agencies-perth"],
  },
  {
    slug: "chatgpt-shopping",
    kind: "guide",
    tag: "Guide",
    title: "How to get your products on ChatGPT shopping | FirstPicked",
    description:
      "How ChatGPT shopping picks products, if it's live in Australia, and what a Shopify store can do to get recommended. From OpenAI's own pages, Nov 2026.",
    short: "How ChatGPT picks products to show, and what a Shopify store can do about it.",
    h1: "ChatGPT shopping: how to get your products recommended",
    intro: [
      "When a shopper asks ChatGPT what to buy, it can name brands, show products with pictures and prices, and link to the shops. OpenAI says ChatGPT picks those products on its own. They're not ads.",
      "Here's how it chooses, what's live in Australia, and what a Shopify store can do about it. Everything here is from OpenAI's and Shopify's own pages, read on 8 November 2026.",
    ],
    checked: "2026-11-08",
    published: "2026-11-08",
    sections: [
      {
        heading: "How ChatGPT shopping works",
        bullets: [
          "A shopper asks something that sounds like shopping, like \"best running shoes for flat feet under $200\".",
          "ChatGPT can show products with pictures, prices, details and links to shops.",
          "The shopper can ask it to compare products, explain trade-offs or change the list.",
          "For clothes and accessories, a Try on button can show how an item might look on them.",
          "The shopper buys on the store's own website. OpenAI says it's moving away from its own Instant Checkout, and there are no fees on sales that start in ChatGPT.",
        ],
      },
      {
        heading: "How ChatGPT picks products",
        paragraphs: ["OpenAI's help page says ChatGPT looks at:"],
        bullets: [
          "Product details from stores and other providers, like price and description.",
          "Other sites' content about the product.",
          "Reviews from public websites, which it sums up into likes and dislikes.",
          "What the shopper asked, and what it knows about them, like their budget.",
        ],
      },
      {
        heading: "What ChatGPT does with your product details",
        paragraphs: [
          "Not every product gets shown. OpenAI says ChatGPT may write its own shorter titles and descriptions, because stores name the same product in different ways. Labels like \"Budget-friendly\" come from what reviewers say, not from a price check.",
          "Prices come from outside providers, and OpenAI says there can be a delay before a price change shows. So clear, current product details matter.",
        ],
      },
      {
        heading: "Is ChatGPT shopping live in Australia?",
        paragraphs: [
          "OpenAI's page for stores says shopping is live for ChatGPT users in the US for now, and will reach more countries over time.",
          "In Australia, ChatGPT already names brands in its answers and links to their sites. Those links carry utm_source=chatgpt.com, so the visits can be counted in Shopify.",
        ],
      },
      {
        heading: "Do Shopify stores need to sign up?",
        paragraphs: [
          "No. OpenAI says stores that sell through Shopify already have their catalog linked, with no sign-up needed. Stores on other platforms can apply to share a product feed.",
        ],
      },
      {
        heading: "How to get your products recommended",
        bullets: [
          "Fill in your product details: a clear title, a full description, price, sizes, materials or ingredients, and who it's for. Shopify's help pages say AI needs these facts.",
          "Answer the questions shoppers ask. Write buying guides like \"best X for Y\", with honest comparisons.",
          "Get real reviews. ChatGPT sums up reviews from public websites. Never fake them.",
          "Be on the sites ChatGPT reads. Ask it your top buying questions and look at which sites it links to.",
          "Keep prices and stock up to date in Shopify.",
          "Check often. Ask the same questions more than once, because answers change from one run to the next.",
        ],
      },
      {
        heading: "What doesn't work",
        bullets: [
          "Paying for a spot. OpenAI says its product picks are not ads, and ads sit apart from them.",
          "Fake reviews or fake Reddit posts. They break the rules, and they can get your brand banned.",
        ],
      },
      {
        heading: "How to see your sales from ChatGPT",
        paragraphs: [
          "ChatGPT adds utm_source=chatgpt.com to the links it shows, so you can find those visits and orders in Shopify. FirstPicked's small tracking code does it for you, and counts visits from other AI apps too.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can I pay to show up in ChatGPT shopping?",
        a: "No. OpenAI says the products ChatGPT shows are picked by ChatGPT and are not ads. ChatGPT does have ads, but they're kept apart from the product picks.",
      },
      {
        q: "Does ChatGPT take a fee on sales?",
        a: "OpenAI says there are no fees on purchases that start in ChatGPT. Shoppers buy on your own website.",
      },
      {
        q: "Is ChatGPT shopping in Australia?",
        a: "OpenAI says shopping is live in the US for now, and will reach more countries over time. In Australia, ChatGPT already names brands and links to their sites.",
      },
      {
        q: "What is ChatGPT SEO?",
        a: "Work that helps ChatGPT name your brand in its answers. It's the same idea as GEO. Our guide \"What is GEO?\" explains it.",
      },
      {
        q: "How do I check if ChatGPT names my products?",
        a: "Ask it the questions your shoppers ask, a few times each. Or use our free AI Visibility Checker. No sign-up needed.",
      },
    ],
    sources: [OPENAI_SHOPPING, OPENAI_MERCHANTS, SHOPIFY_AI],
    related: ["/what-is-geo", "/shopify-seo-agency", "geo-vs-seo-vs-aeo"],
  },
  {
    slug: "what-is-geo",
    kind: "guide",
    tag: "Guide",
    title: "What is GEO (generative engine optimisation)? | FirstPicked",
    description:
      "GEO in plain words: what generative engine optimisation is, where the name comes from, how it differs from SEO and AEO, and what a store can do.",
    short: "GEO in plain words: what it is, where the name comes from, and what a store can do.",
    h1: "What is GEO? Generative engine optimisation, in plain words",
    intro: [
      "GEO stands for generative engine optimisation. It's the work of getting your brand named in answers from AI apps like ChatGPT, Gemini, Perplexity and Google's AI Overviews.",
      "SEO helps you show up in Google's list of links. GEO helps you show up inside the answer, which often names just a few brands.",
    ],
    checked: "2026-11-08",
    published: "2026-11-08",
    sections: [
      {
        heading: "Where the name comes from",
        paragraphs: [
          "The name comes from a 2023 research paper by six computer scientists, called \"GEO: Generative Engine Optimization\". A big computer science conference, KDD, accepted it in 2024.",
          "In their tests, changes to a page made it show up as much as 40% more in AI answers. They also found that what works changes from topic to topic.",
        ],
      },
      {
        heading: "GEO, SEO and AEO",
        bullets: [
          "SEO (search engine optimisation): getting your pages high in Google's links.",
          "AEO (answer engine optimisation): getting your words used as the direct answer to a question.",
          "GEO (generative engine optimisation): getting your brand named in an AI app's answer.",
          "AEO and GEO overlap so much that most people use the words for the same thing. Some call it all AI SEO.",
        ],
      },
      {
        heading: "How AI picks what to name",
        paragraphs: [
          "An AI app reads lots of pages, then writes one answer. When it suggests products, it leans on what it can trust: clear product details, review lists, shops and forums like Reddit.",
          "OpenAI says ChatGPT picks products using details like price and description, other sites' content, and reviews from public websites. It also says those product picks are not ads.",
        ],
      },
      {
        heading: "Why it matters for online stores",
        paragraphs: [
          "1.2 billion people use ChatGPT every week, OpenAI said in September 2026. Google says AI Overviews reach over 2.5 billion people a month. And in February 2026, Shopify's president said orders from AI search were 15 times higher than in January 2025.",
        ],
      },
      {
        heading: "What GEO work looks like for a store",
        bullets: [
          "Clear product pages: what it is, who it's for, sizes, materials or ingredients, and price. Shopify's own help pages say AI needs these facts.",
          "Buying guides that answer real questions, like \"best beard oil for dry skin in Australia\".",
          "Being on the sites AI reads for your questions, like honest review lists and shops.",
          "Honest replies on Reddit, from you, saying who you are.",
          "Checking the same questions often, because answers change from one run to the next.",
          "Counting the visits and sales that come from AI.",
        ],
      },
      {
        heading: "What GEO can't do",
        paragraphs: [
          "Nobody can promise that ChatGPT will name you. Answers change from person to person and from one run to the next. And OpenAI says its product picks are not ads, so you can't pay to be named in them. Be careful with anyone who sells a guaranteed spot.",
        ],
      },
    ],
    faqs: [
      {
        q: "What does GEO stand for?",
        a: "Generative engine optimisation. \"Generative\" means AI that writes its own answers, like ChatGPT.",
      },
      {
        q: "Is GEO the same as AEO?",
        a: "Close enough. AEO is about being the answer; GEO is about being the brand AI names. The work overlaps so much that most people use the words for the same thing.",
      },
      {
        q: "Is GEO replacing SEO?",
        a: "No. Google is still a big source of visits, and Google's AI Overviews are built on its own results. Most stores need both.",
      },
      {
        q: "How long does GEO take?",
        a: "Product page fixes can show up fast. Guides and mentions on other sites take months. Nobody can promise a date.",
      },
      {
        q: "How do I check if AI names my store?",
        a: "Ask ChatGPT the questions your shoppers ask, a few times each. Or use our free AI Visibility Checker. No sign-up needed.",
      },
    ],
    sources: [GEO_PAPER, OPENAI_SHOPPING, OPENAI_DEVDAY, GOOGLE_IO, SHOPIFY_15X, SHOPIFY_AI],
    related: ["geo-vs-seo-vs-aeo", "/chatgpt-shopping", "/ai-seo-agency"],
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

/**
 * One @graph per page: Organization, then WebPage and Service for a service page or Article for a guide, then
 * FAQPage and BreadcrumbList.
 */
export function landingJsonLd(p: LandingPage): Record<string, unknown> {
  const url = abs(landingPath(p.slug));
  const main =
    p.kind === "guide"
      ? [
          {
            "@type": "Article",
            "@id": `${url}#article`,
            url,
            mainEntityOfPage: url,
            headline: p.h1,
            description: p.description,
            datePublished: p.published ?? p.checked,
            dateModified: p.checked,
            inLanguage: "en-AU",
            image: abs(COMPARE_HUB.ogImage),
            author: { "@id": ORG_ID },
            publisher: { "@id": ORG_ID },
            citation: p.sources.map((s) => ({ "@type": "CreativeWork", name: s.title, url: s.url })),
            isPartOf: PART_OF,
          },
        ]
      : [
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
        ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORG_NODE,
      ...main,
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: p.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumbs(`${url}#crumbs`, [{ name: HOME_CRUMB, path: "/" }, { name: stripBrand(p.title) }]),
    ],
  };
}
