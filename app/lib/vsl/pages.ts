// The niche pages for Ross's video ads (Ross, 17 Nov 2026: "custom landing pages for EACH, speaking directly to them in
// their language, referencing exactly how much they are spending and how i can help them for a much better price.
// its going to be a VSL landing page with context and info underneath with a book a call button under the VSL").
// One page per niche in the niche test (doc "Niches to test the A$297 offer", 17 Nov 2026), at
// rankwithross.com.au/for/<slug>, drawn by ./render.ts into app/home/vsl.html and served by app/routes/for.$niche.tsx.
// Pure and browser-safe.
//
// The look and the flow (Ross, 17 Nov 2026, from a sketch inspired by forgoodprofits.com: "the overall flow of the
// website feels great. id rather it be a white background ... can you please simplify the text tho"): Ross's video
// first, then "Sound familiar?" (3 problems), "So here's what I do" (3 things), the honest table against agencies, one
// big line, the 3 steps and the price, a few questions. Ross speaks in the first person: he is the face of the business.
// Keep every line short.
//
// Honesty rules: every number is real and its source is listed on the page. Click prices and searches are Google's
// figures from DataForSEO (through Treg), Australia, Nov 2025 to Oct 2026, changed at A$1.42 per US$1. The ChatGPT
// answers were asked once each on 17 Nov 2026 and change from one ask to the next, so the page says so. No promised
// results, no "worth A$X" (Australian Consumer Law), no promise of emails to websites. Copy: grade 5 English, no
// dashes as punctuation. Every field is plain text (the page escapes it).

/** A heading: the plain words, then the words in purple italics. */
export type Heading = [plain: string, accent: string];

/** The simple line drawings render.ts puts next to a problem or a job, one per row, matching its words. */
export type Drawing = "chat" | "click" | "lead" | "bill" | "search";

export interface VslRow {
  h: string;
  p: string;
  draw: Drawing;
  /** A short handwritten note under the words. */
  note?: string;
  /** "chat": how many names AI gave, drawn as that many lines in its answer (the number in `h`). */
  names?: number;
  /** "click", "lead", "bill" and "search": the number from the words, written on the drawing's price tag. */
  tag?: string;
}

export interface VslPage {
  /** The address after /for/, like "mortgage-brokers". */
  slug: string;
  /** Who booked, for the calendar event and Ross's email, like "Mortgage broker". */
  label: string;
  /**
   * The page is for Shopify stores, so its button opens the normal /book with the two store questions. The other
   * pages open /book?for=<slug>, which skips the store questions (those businesses aren't online stores).
   */
  shopify?: boolean;
  /** The <title>, ending " | Rank with Ross", 60 characters at most. */
  title: string;
  description: string;
  /** Ross's handwritten hello above the heading, naming who the page is for. */
  hi: string;
  h1: Heading;
  /** "Sound familiar?": what AI says now and what they pay now. */
  problems: [VslRow, VslRow, VslRow];
  /** One big line after the table: what one new customer is worth next to our price. */
  big: { line: string; note: string };
  faq: { q: string; a: string }[];
  sources: { title: string; url: string }[];
}

// Plain "$" on these pages (Ross, 17 Nov 2026: "drop the A from the $ on every page. i will only be targeting
// australia anyway"). The rest of the site keeps "A$" from OFFER in app/lib/plans.ts.
export const VSL_PRICE = "$297";

/** What Australian agencies charge a month (Optimising's price guide), for the third problem and the table. */
export const AGENCY_PRICE = "$2,000 to $20,000+";

// Where the numbers in Ross's video come from (his video, 17 Nov 2026), shown in the page's small print with the video.
// He says "700 million questions a week", the slide and this note say people. The bonus is OpenAI's own offer: cut it
// from the video and from here after 31 December 2026.
export const VIDEO_NOTE =
  "In my video: people using ChatGPT each week, from OpenAI (700 million in July 2025, 1.2 billion in September 2026). Shoppers who came from AI bought 60% more often than other shoppers: Adobe, US online stores, July 2026. The ChatGPT ad credit is OpenAI’s offer for businesses new to ChatGPT ads, until 31 December 2026, and OpenAI’s terms apply.";
export const VIDEO_SOURCES = [
  { title: "OpenAI: how people use ChatGPT (July 2025 study)", url: "https://cdn.openai.com/pdf/a253471f-8260-40c6-a2cc-aa93fe9f142e/economic-research-chatgpt-usage-paper.pdf" },
  { title: "OpenAI: DevDay 2026 recap (September 2026)", url: "https://openai.com/index/devday-2026-recap/" },
  { title: "Adobe: AI traffic trends report (August 2026)", url: "https://business.adobe.com/assets/pdfs/resources/sdk/ai-traffic-trends-report-august-2026/ai-traffic-trends-report-2026-08-19.pdf" },
  { title: "OpenAI: the $500 ChatGPT ad credit offer", url: "https://ads.openai.com/holiday" },
  { title: "OpenAI: ad credit terms", url: "https://openai.com/policies/ad-credit-terms/" },
];

const AGENCIES: VslRow = {
  h: `Agencies charge ${AGENCY_PRICE} a month.`,
  p: "That’s what agencies in Australia charge for this kind of work.",
  draw: "bill",
  tag: "$20,000+",
};

const SRC = {
  optimising: { title: "Optimising: how much agencies charge for this work", url: "https://www.optimising.com.au/blog/geo-cost" },
  brightlocal: { title: "BrightLocal: Local Consumer Review Survey 2026 (1,002 US adults)", url: "https://brightlocal.com/local-consumer-review-survey/" },
  calsoBrokers: { title: "Calso: best mortgage brokers in Perth, 566 ranked", url: "https://calso.com.au/directory/wa/perth/mortgage-brokers" },
  calsoPlumbers: { title: "Calso: best plumbers in Perth, 671 ranked", url: "https://calso.com.au/directory/wa/perth/plumbers" },
  calsoSparkies: { title: "Calso: best electricians in Perth, 767 ranked", url: "https://calso.com.au/directory/wa/perth/electricians" },
  hunterGalloway: { title: "Hunter Galloway: mortgage broker fees in 2026 (updated 28 Oct 2026)", url: "https://www.huntergalloway.com.au/mortgage-broker-fees-australia-2026-guide-for-first-home-buyers/" },
  solarQuotes: { title: "SolarQuotes: the WA battery rebate (updated 2 Nov 2026)", url: "https://www.solarquotes.com.au/battery-storage/wa-rebate/" },
  whySolar: { title: "Why Solar: what solar leads cost in Australia (18 Feb 2026, a lead seller)", url: "https://www.whysolar.com.au/blog/solar-leads-cost-australia" },
  buyersAgentCost: { title: "What’s The Damage: buyers agent cost in Perth (Nov 2026)", url: "https://whatsthedamage.com.au/buyers-agent-cost-perth/" },
  hipages: { title: "What’s The Damage: hipages plan prices, checked against hipages’ own pages (Oct 2026, a lead seller)", url: "https://whatsthedamage.com.au/tradies/hipages-cost/" },
};

const NO_PROMISE = "No. Nobody can promise what AI says, and I won’t. I do the work that gives you the best chance, and show you what changed every week.";
const NO_LOCK_IN = "No lock-in. Pay monthly and stop any time. Not happy after month 1? Full refund, and you keep the work.";

// The questions every page answers (Ross, 17 Nov 2026: "really beef out the FAQ section for each page"). Only true
// answers: the refund is the terms page's (asked within 14 days after month 1 ends), local clients get up to 4 pages a
// month and stores up to 12.
const REFUND = {
  q: "How does the refund work?",
  a: "If you’re not happy after month 1, tell me within 14 days after it ends. I refund that month in full, and you keep the work. After that, stop any time. There are no refunds for part months.",
};
const FAKE = {
  q: "Will you post fake reviews?",
  a: "Never. Fake reviews break Australian law and Google’s rules, and they can be taken down. I only use real facts about your business.",
};
const PRICE = {
  q: "Why only $297 when agencies charge so much more?",
  a: "I use software for the checking and the first drafts, and I do the rest myself. No big office and no sales team. So it costs a lot less to run.",
};
const WHO = { q: "Who will I talk to?", a: "Me, Ross. I’m in Perth. Text me any time on 0400 369 865." };
const ADS = {
  q: "Is this the same as Google Ads?",
  a: "No. Google Ads charge you for every click. This work helps AI and Google name you on their own, with no charge per click.",
};

/** The questions every local page answers. `who` is one of the trade, like "a mortgage broker"; `extra` are its own. */
function localFaq(who: string, extra: VslPage["faq"]): VslPage["faq"] {
  return [
    {
      q: "What do you actually do each month?",
      a: `Every week I check what ChatGPT, Gemini, Perplexity and Google’s AI say when people ask for ${who} in Perth. I fix your Google profile and website, work on getting you onto the lists AI reads, and write up to 4 pages a month that answer your customers.`,
    },
    { q: "What do I have to do?", a: "One short call at the start, and access to your Google profile and website. Then I do the work." },
    {
      q: "How soon will I see a change?",
      a: "In month 1, I set things up and fix the basics. AI and Google can take weeks to notice changes, so think in months, not days. I can’t promise when AI will name you.",
    },
    { q: "Can you promise ChatGPT will name me?", a: NO_PROMISE },
    { q: "What will I see each week?", a: "A short report: what AI said about you, who it named, and the work I did that week." },
    { q: "Is there a contract?", a: NO_LOCK_IN },
    REFUND,
    FAKE,
    {
      q: "Do I need a new website?",
      a: "No. I work with the website you have. I add the new pages myself, or send them ready to paste if you’d rather do it.",
    },
    ...extra,
    ADS,
    PRICE,
    WHO,
  ];
}

export const VSL_PAGES: VslPage[] = [
  {
    slug: "mortgage-brokers",
    label: "Mortgage broker",
    title: "Perth mortgage brokers: get picked by AI | Rank with Ross",
    description:
      "ChatGPT named 5 mortgage brokers in Perth. I help you be one of them. $297 a month, done for you, no lock-in. Book a free 15 minute call.",
    hi: "G’day, Perth mortgage brokers.",
    h1: ["Home buyers ask ChatGPT which broker to use.", "Make it name you."],
    problems: [
      {
        h: "We asked ChatGPT for the best broker in Perth. It named 5.",
        p: "One directory it read ranks 566 Perth brokers. So 561 got no mention.",
        draw: "chat",
        names: 5,
      },
      {
        h: "Google charges $34 for one click.",
        p: "That’s one click on “mortgage broker perth”. A click on “home loan broker” is $42.",
        draw: "click",
        tag: "$34",
      },
      AGENCIES,
    ],
    big: {
      line: "One extra loan pays for about 11 months of this.",
      note: "On a $500,000 loan, the lender pays the broker about $3,250 to $3,500 upfront.",
    },
    faq: localFaq("a mortgage broker", [
      {
        q: "Will you write about interest rates or loan approvals?",
        a: "No. Rates change, and loan advice has strict rules. I write about how you work, who you help and the questions home buyers ask, using facts from you.",
      },
    ]),
    sources: [SRC.hunterGalloway, SRC.calsoBrokers, SRC.optimising],
  },
  {
    slug: "solar-installers",
    label: "Solar and battery installer",
    title: "Perth solar installers: get picked by AI | Rank with Ross",
    description:
      "ChatGPT named 5 battery installers in Perth. I help you be one of them. $297 a month, done for you, no lock-in. Book a free 15 minute call.",
    hi: "G’day, Perth solar installers.",
    h1: ["Perth homeowners ask ChatGPT who to buy a battery from.", "Make it name you."],
    problems: [
      {
        h: "We asked ChatGPT for the best battery installer in Perth. It named 5.",
        p: "If you’re not in the places it reads, it can’t name you.",
        draw: "chat",
        names: 5,
      },
      {
        h: "One solar lead costs $35 to $100+.",
        p: "That’s what lead sellers charge. A Google click on “solar companies” is $34.",
        draw: "lead",
        tag: "$35+",
      },
      AGENCIES,
    ],
    big: {
      line: "One battery job is a sale about 38 times our monthly fee.",
      note: "A 24 kWh battery costs about $11,260 installed in Perth after rebates.",
    },
    faq: localFaq("a battery or solar installer", [
      { q: "Do I need to stop buying leads?", a: "No. Keep what works. This adds a way to get named that doesn’t charge you per lead." },
      { q: "Will you write about rebates?", a: "Only with a link to the official page and the date I checked it. Rebates change, so I never guess." },
    ]),
    sources: [SRC.whySolar, SRC.solarQuotes, SRC.optimising],
  },
  {
    slug: "pool-spa-sauna-stores",
    label: "Pool, spa or sauna store",
    shopify: true,
    title: "Pool, spa and sauna stores: be picked by AI | Rank with Ross",
    description:
      "Shoppers ask ChatGPT which plunge pool, spa or sauna to buy. I help your Shopify store get picked. $297 a month, done for you, no lock-in.",
    hi: "G’day, pool, spa and sauna stores.",
    h1: ["Shoppers ask ChatGPT which plunge pool to buy.", "Make it pick yours."],
    problems: [
      {
        h: "We asked ChatGPT for the best plunge pool in Australia. It named 5 brands.",
        p: "To choose, it read buying guides. One was on another store’s own blog.",
        draw: "chat",
        names: 5,
      },
      {
        h: "22,200 searches a month in Australia for “infrared sauna”.",
        p: "And 14,800 for “plunge pool”. Google charges about $7 a click on “infrared sauna”.",
        draw: "search",
        tag: "22,200",
      },
      AGENCIES,
    ],
    big: {
      line: "One extra sale can pay for many months of this.",
      note: "ChatGPT said entry-level plunge pool packages cost $15,000 to $25,000.",
    },
    faq: [
      {
        q: "What do you actually do each month?",
        a: "Every day I check up to 100 buying questions in ChatGPT, Gemini, Perplexity and Google’s AI Overviews. I make 50+ fixes to your product pages and write up to 12 buying guides a month.",
      },
      { q: "What do I have to do?", a: "One short call, and I help you add a small code to your store. Then I do the work." },
      { q: "Do you only work with Shopify stores?", a: "Yes. Right now I only work with stores on Shopify." },
      {
        q: "How do you show the sales from AI?",
        a: "The small code in your store counts the visits and orders that came from AI, like ChatGPT. Google’s AI answers can’t be told apart from normal Google, so those count as Google.",
      },
      {
        q: "How soon will I see a change?",
        a: "In month 1, I set things up and fix the basics. AI and Google can take weeks to notice changes, so think in months, not days. I can’t promise when AI will pick your store.",
      },
      { q: "Can you promise ChatGPT will pick my store?", a: NO_PROMISE },
      {
        q: "What will I see each week?",
        a: "A short report: what AI said, who it picked, the work I did, and the visits, orders and sales that came from AI.",
      },
      { q: "Is there a contract?", a: NO_LOCK_IN },
      REFUND,
      FAKE,
      { q: "Do I need a new website?", a: "No. I work with your Shopify store as it is." },
      ADS,
      PRICE,
      WHO,
    ],
    sources: [SRC.optimising],
  },
  {
    slug: "buyers-agents",
    label: "Buyers agent",
    title: "Perth buyers agents: get picked by ChatGPT | Rank with Ross",
    description:
      "ChatGPT named 5 buyers agents in Perth. I help you be one of them. $297 a month, done for you, no lock-in. Book a free 15 minute call.",
    hi: "G’day, Perth buyers agents.",
    h1: ["Perth home buyers ask ChatGPT which buyers agent to use.", "Make it name you."],
    problems: [
      {
        h: "We asked ChatGPT for the best buyers agent in Perth. It named 5.",
        p: "If you’re not in the places it reads, it can’t name you.",
        draw: "chat",
        names: 5,
      },
      {
        h: "Google charges $40 for one click.",
        p: "That’s one click on “buyers agent perth”. A click on “buyers agent” is $19.",
        draw: "click",
        tag: "$40",
      },
      AGENCIES,
    ],
    big: {
      line: "One new client pays for about 20 months of this.",
      note: "Perth buyers agents charge about $6,000 to $18,000 for a full search on a home under about $1 million.",
    },
    faq: localFaq("a buyers agent", [
      {
        q: "Will you write about property prices or market tips?",
        a: "I don’t make market predictions. I write about how you work, the areas you know and the questions buyers ask, using facts from you.",
      },
    ]),
    sources: [SRC.buyersAgentCost, SRC.optimising],
  },
  {
    slug: "plumbers-electricians",
    label: "Plumber or electrician",
    title: "Perth plumbers and sparkies: get on ChatGPT | Rank with Ross",
    description:
      "One Google click on “emergency plumber” costs about $79. I help ChatGPT name your business instead. $297 a month, done for you, no lock-in.",
    hi: "G’day, Perth plumbers and sparkies.",
    h1: ["One Google click on “emergency plumber” costs about $79.", "ChatGPT names plumbers for free."],
    problems: [
      {
        h: "We asked ChatGPT for the best plumber in Perth. It named 4.",
        p: "One directory it read ranks 671 Perth plumbers. For electricians it named 5, and the same directory ranks 767.",
        draw: "chat",
        names: 4,
      },
      {
        h: "hipages plans cost $139 to $649 a month.",
        p: "Plus GST, and each lead costs credits on top. A Google click on “electrician near me” is $35.",
        draw: "lead",
        tag: "$139+",
      },
      AGENCIES,
    ],
    big: {
      line: "$297 a month is less than 4 clicks on “emergency plumber”.",
      note: "When ChatGPT names you, nobody charges you for the call.",
    },
    faq: localFaq("a plumber or electrician", [
      { q: "Do you work with electricians too?", a: "Yes. This page is for plumbers and electricians in Perth." },
      { q: "Do I need to stop using hipages or Google Ads?", a: "No. Keep what works. This adds a way to get named that doesn’t charge you per lead or per click." },
    ]),
    sources: [SRC.hipages, SRC.calsoPlumbers, SRC.calsoSparkies, SRC.optimising],
  },
];

export const VSL_SLUGS = VSL_PAGES.map((p) => p.slug);

export function vslPath(slug: string): string {
  return `/for/${slug}`;
}

export function vslBySlug(slug: unknown): VslPage | null {
  return VSL_PAGES.find((p) => p.slug === slug) ?? null;
}

/**
 * A niche page that books without the two store questions: /book?for=<slug> (brokers, installers, agents, tradies).
 * Null for anything else, including the Shopify store page, whose visitors answer the questions like everyone else.
 */
export function bookingNiche(slug: unknown): VslPage | null {
  const page = vslBySlug(slug);
  return page && !page.shopify ? page : null;
}

/** Where a page's "Book a call" buttons go, before an ad's own tags replace the default ones. */
export function vslBookHref(page: VslPage): string {
  const tags = `utm_medium=vsl&utm_campaign=${page.slug}`;
  return page.shopify ? `/book?${tags}` : `/book?for=${page.slug}&${tags}`;
}
