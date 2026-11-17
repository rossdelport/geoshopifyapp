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
export type Drawing = "chat" | "click" | "lead" | "bill" | "search" | "check" | "list" | "write" | "sales";

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
  lead: string;
  /** "Sound familiar?": what AI says now and what they pay now. */
  problems: [VslRow, VslRow, VslRow];
  /** "So here's what I do." */
  help: [VslRow, VslRow, VslRow];
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

/** The three jobs for a local business (brokers, installers, agents, tradies), worded for each trade. */
function localHelp(t: { asks: string; picked: string; page: string }): VslPage["help"] {
  return [
    {
      h: "Every week, I check what AI says about you.",
      p: `I ask ChatGPT, Gemini, Perplexity and Google what your customers ask, like “${t.asks}”.`,
      note: "You see who gets named",
      draw: "check",
    },
    {
      h: "I fix your Google profile and get you on the lists AI reads.",
      p: `${t.picked} I make sure you show up in the right places.`,
      note: "Real facts only. Nothing fake.",
      draw: "list",
    },
    {
      h: "I write pages that answer your customers.",
      p: `AI reads pages like “${t.page}” before it picks a name.`,
      note: "Plus a short report every week",
      draw: "write",
    },
  ];
}

const NO_PROMISE = "No. Nobody can promise what AI says, and I won’t. I do the work that gives you the best chance, and show you what changed every week.";
const NO_LOCK_IN = "No lock-in. Pay monthly and stop any time. Not happy after month 1? Full refund, and you keep the work.";

/** The questions every local page answers. */
function localFaq(): VslPage["faq"] {
  return [
    { q: "What do I have to do?", a: "One short call at the start, and access to your Google profile and website. Then I do the work." },
    { q: "Can you promise ChatGPT will name me?", a: NO_PROMISE },
    { q: "Is there a contract?", a: NO_LOCK_IN },
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
    lead: "I do the work to get your name in the answer. $297 a month, done for you.",
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
    help: localHelp({
      asks: "best mortgage broker in Perth for first home buyers",
      picked: "ChatGPT picked from Google reviews, “best broker” lists and awards.",
      page: "Do I pay a mortgage broker in Perth?",
    }),
    big: {
      line: "One extra loan pays for about 11 months of this.",
      note: "On a $500,000 loan, the lender pays the broker about $3,250 to $3,500 upfront.",
    },
    faq: localFaq(),
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
    lead: "I do the work to make you one of the names, so you buy fewer leads. $297 a month, done for you.",
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
    help: localHelp({
      asks: "best battery installer in Perth",
      picked: "ChatGPT picked from SolarQuotes awards and “best installer” lists.",
      page: "How much is a home battery in Perth after the rebate?",
    }),
    big: {
      line: "One battery job is a sale about 38 times our monthly fee.",
      note: "A 24 kWh battery costs about $11,260 installed in Perth after rebates.",
    },
    faq: localFaq(),
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
    lead: "I do the work to get your store in the answer. $297 a month, done for you.",
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
    help: [
      {
        h: "Every day, I check 100 buying questions.",
        p: "In ChatGPT, Gemini, Perplexity and Google’s AI Overviews, like “best plunge pool for a small backyard”.",
        note: "You see who gets picked",
        draw: "check",
      },
      {
        h: "I fix your product pages and write your buying guides.",
        p: "50+ page fixes and up to 12 guides a month. The kind of guide ChatGPT reads before it picks.",
        note: "Real facts only. Nothing fake.",
        draw: "write",
      },
      {
        h: "I show you the sales that came from AI.",
        p: "The visits, orders and sales from AI and from Google, in a short report every week.",
        note: "Every week, in your inbox",
        draw: "sales",
      },
    ],
    big: {
      line: "One extra sale can pay for many months of this.",
      note: "ChatGPT said entry-level plunge pool packages cost $15,000 to $25,000.",
    },
    faq: [
      { q: "What do I have to do?", a: "One short call, and I help you add a small code to your store. Then I do the work." },
      { q: "Do you only work with Shopify stores?", a: "Yes. Right now I only work with stores on Shopify." },
      { q: "Can you promise ChatGPT will pick my store?", a: NO_PROMISE },
      { q: "Is there a contract?", a: NO_LOCK_IN },
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
    lead: "I do the work to get your name in the answer. $297 a month, done for you.",
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
    help: localHelp({
      asks: "best buyers agent in Perth for investors",
      picked: "ChatGPT picked from PropertyGo and a REIWA award.",
      page: "Is a buyers agent worth it in Perth?",
    }),
    big: {
      line: "One new client pays for about 20 months of this.",
      note: "Perth buyers agents charge about $6,000 to $18,000 for a full search on a home under about $1 million.",
    },
    faq: localFaq(),
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
    lead: "I help you be the one it names. $297 a month, done for you.",
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
    help: localHelp({
      asks: "best emergency plumber in Perth",
      picked: "ChatGPT read a directory and showed each pick’s Google reviews.",
      page: "Why is my hot water system leaking?",
    }),
    big: {
      line: "$297 a month is less than 4 clicks on “emergency plumber”.",
      note: "When ChatGPT names you, nobody charges you for the call.",
    },
    faq: localFaq(),
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
