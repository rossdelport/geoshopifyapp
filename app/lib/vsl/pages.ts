// The niche pages for Ross's video ads (Ross, 17 Nov 2026: "custom landing pages for EACH, speaking directly to them in
// their language, referencing exactly how much they are spending and how i can help them for a much better price.
// its going to be a VSL landing page with context and info underneath with a book a call button under the VSL").
// One page per niche in the niche test (doc "Niches to test the A$297 offer", 17 Nov 2026), at
// firstpicked.com.au/for/<slug>, drawn by ./render.ts into app/home/vsl.html and served by app/routes/for.$niche.tsx.
// Pure and browser-safe.
//
// Honesty rules: every number is real and its source is listed on the page. Click prices and searches are Google's
// figures from DataForSEO (through Treg), Australia, Nov 2025 to Oct 2026, changed at A$1.42 per US$1. The ChatGPT
// answers were asked once each on 17 Nov 2026 and change from one ask to the next, so the page says so. No promised
// results, no "worth A$X" (Australian Consumer Law), no promise of emails to websites. Copy: grade 5 English, no
// dashes as punctuation. Every field is plain text (the page escapes it).

/** A heading: the grey words, then the dark words on their own line (like the home page's headings). */
export type Heading = [grey: string, dark: string];

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
  /** The <title>, ending " | FirstPicked", 60 characters at most. */
  title: string;
  description: string;
  /** The small line above the main heading: who the page is for. */
  eyebrow: string;
  h1: Heading;
  lead: string;
  /** What they pay now, next to our price. */
  spend: { h: Heading; costs: { value: string; text: string }[]; line: string };
  /** What ChatGPT said when we asked. */
  ai: { h: Heading; question: string; points: string[] };
  help: { h: Heading; items: { h: string; p: string }[] };
  /** What one new customer is worth to them, next to our price. */
  maths?: { h: Heading; points: string[] };
  /** Show Eduardo's video review from Terra Tanks (only where it fits the niche: he sells stock tank pools). */
  review?: boolean;
  faq: { q: string; a: string }[];
  close: Heading;
  sources: { title: string; url: string }[];
}

// Plain "$" on these pages (Ross, 17 Nov 2026: "drop the A from the $ on every page. i will only be targeting
// australia anyway"). The rest of the site keeps "A$" from OFFER in app/lib/plans.ts.
export const VSL_PRICE = "$297";

const AGENCIES = { value: "$2,000 to $20,000+", text: "What agencies in Australia charge a month for this kind of work" };

const BRIGHTLOCAL_LINE = "In the US, 45% of people used ChatGPT or another AI to find a local business in 2026. A year before, it was 6%.";
const GOOGLE_STARS = "Next to each pick, it showed their Google star rating and how many reviews they have.";

const SRC = {
  optimising: { title: "Optimising: how much agencies charge for this work", url: "https://www.optimising.com.au/blog/geo-cost" },
  brightlocal: { title: "BrightLocal: Local Consumer Review Survey 2026 (1,002 US adults)", url: "https://brightlocal.com/local-consumer-review-survey/" },
  calsoBrokers: { title: "Calso: best mortgage brokers in Perth, 566 ranked", url: "https://calso.com.au/directory/wa/perth/mortgage-brokers" },
  calsoPlumbers: { title: "Calso: best plumbers in Perth, 671 ranked", url: "https://calso.com.au/directory/wa/perth/plumbers" },
  calsoSparkies: { title: "Calso: best electricians in Perth, 767 ranked", url: "https://calso.com.au/directory/wa/perth/electricians" },
  hunterGalloway: { title: "Hunter Galloway: mortgage broker fees in 2026 (updated 28 Oct 2026)", url: "https://www.huntergalloway.com.au/mortgage-broker-fees-australia-2026-guide-for-first-home-buyers/" },
  solarQuotes: { title: "SolarQuotes: the WA battery rebate (updated 2 Nov 2026)", url: "https://www.solarquotes.com.au/battery-storage/wa-rebate/" },
  waBatteries: { title: "WA Government: more than 20,000 WA families benefit from home batteries (19 May 2026)", url: "https://stateofenergy.wa.gov.au/news/more-than-20-000-wa-families-benefit-from-home-battery-savings" },
  whySolar: { title: "Why Solar: what solar leads cost in Australia (18 Feb 2026, a lead seller)", url: "https://www.whysolar.com.au/blog/solar-leads-cost-australia" },
  buyersAgentCost: { title: "What’s The Damage: buyers agent cost in Perth (Nov 2026)", url: "https://whatsthedamage.com.au/buyers-agent-cost-perth/" },
  hipages: { title: "What’s The Damage: hipages plan prices, checked against hipages’ own pages (Oct 2026, a lead seller)", url: "https://whatsthedamage.com.au/tradies/hipages-cost/" },
};

/** The work for a local business (brokers, installers, agents, tradies), worded for each trade. */
function localHelp(t: { asks: string; profile: string; lists: string; page: string }): VslPage["help"] {
  return {
    h: ["What we do for you.", "Every month."],
    items: [
      { h: "Check what your customers ask AI", p: `Every week we ask ChatGPT, Gemini, Perplexity and Google the questions your customers ask, like “${t.asks}”. You see who gets named, and if it’s you.` },
      { h: "Fix your Google profile", p: `AI reads your Google Business Profile. We make sure it says the right things: ${t.profile}.` },
      { h: "Get you on the lists AI reads", p: `We find ${t.lists} that AI trusts, and help you get listed on the ones that fit you.` },
      { h: "Write pages that answer people", p: `We write clear pages for your website, like “${t.page}”. AI reads pages like these before it picks.` },
      { h: "A report every week", p: "A short email on what we did and what changed. No jargon." },
      { h: "Nothing fake. Ever.", p: "No fake reviews and no made-up claims. Everything we write uses your real facts." },
    ],
  };
}

/** The questions every local page answers. */
function localFaq(): VslPage["faq"] {
  return [
    {
      q: "What do I have to do?",
      a: "One short call at the start, so we learn your business and get access to your Google profile and website. After that, we do the work.",
    },
    {
      q: "Can you promise ChatGPT will name me?",
      a: "No. Nobody can promise what AI says, and we won’t. We do the work that gives you the best chance, and we show you what changed every week.",
    },
    { q: "Will you write fake reviews?", a: "Never. Fake reviews break Australian law and Google’s rules. We only use your real facts and your real reviews." },
    {
      q: "Is there a contract?",
      a: "No lock-in. You pay monthly and can stop any time. If you’re not happy after month 1, you get a full refund and keep all the work.",
    },
    { q: "Who will I talk to?", a: "Ross Delport, the founder, who lives in Perth. On the free call he shows you what AI says about your business today, and what he’d do first." },
  ];
}

export const VSL_PAGES: VslPage[] = [
  {
    slug: "mortgage-brokers",
    label: "Mortgage broker",
    title: "Perth mortgage brokers: get picked by ChatGPT | FirstPicked",
    description:
      "ChatGPT named 5 mortgage brokers in Perth. We help you be one of them. $297 a month, done for you, no lock-in. Book a free 15 minute call.",
    eyebrow: "For Perth mortgage brokers",
    h1: ["ChatGPT named 5 brokers in Perth.", "Let’s make it name you."],
    lead: "Home buyers now ask ChatGPT and Google which broker to use. We do the work to get your name in the answer. $297 a month, done for you.",
    spend: {
      h: ["You already pay a lot", "for every new client."],
      costs: [
        { value: "$34", text: "Google’s price for one click on “mortgage broker perth”" },
        { value: "$42", text: "Google’s price for one click on “home loan broker”" },
        AGENCIES,
      ],
      line: "$297 a month is less than 9 Google clicks on “mortgage broker perth”. When ChatGPT names you, nobody charges you for the click.",
    },
    ai: {
      h: ["We asked ChatGPT for the best broker in Perth.", "It named 5."],
      question: "Who is the best mortgage broker in Perth?",
      points: [
        "It named 5 brokers. One directory it looked at ranks 566 Perth brokers. So 561 brokers got no mention.",
        GOOGLE_STARS,
        "It picked them from Google reviews, “best broker” lists and awards.",
        BRIGHTLOCAL_LINE,
      ],
    },
    help: localHelp({
      asks: "best mortgage broker in Perth for first home buyers",
      profile: "the suburbs you cover, the loans you do and how to reach you",
      lists: "the “best broker” lists, review sites and awards",
      page: "Do I pay a mortgage broker in Perth?",
    }),
    maths: {
      h: ["One extra loan", "pays for almost a year."],
      points: [
        "On a $500,000 loan, the lender pays the broker about $3,250 to $3,500 upfront. Then about $750 to $1,000 a year while the loan runs.",
        "FirstPicked is $297 a month. So one extra loan pays for about 11 months.",
      ],
    },
    faq: localFaq(),
    close: ["Want to be the broker", "ChatGPT names?"],
    sources: [SRC.hunterGalloway, SRC.calsoBrokers, SRC.optimising, SRC.brightlocal],
  },
  {
    slug: "solar-installers",
    label: "Solar and battery installer",
    title: "Perth solar installers: get picked by ChatGPT | FirstPicked",
    description:
      "ChatGPT named 5 battery installers in Perth. We help you be one of them. $297 a month, done for you, no lock-in. Book a free 15 minute call.",
    eyebrow: "For Perth solar and battery installers",
    h1: ["Perth homeowners ask ChatGPT who to buy a battery from.", "Does it say your name?"],
    lead: "We asked. It named 5 installers. We do the work to make you one of them, so you buy fewer leads. $297 a month, done for you.",
    spend: {
      h: ["Leads and clicks", "cost you a lot."],
      costs: [
        { value: "$35 to $100+", text: "What lead sellers charge for one solar lead" },
        { value: "$34", text: "Google’s price for one click on “solar companies”" },
        AGENCIES,
      ],
      line: "$297 a month is the price of about 3 bought leads at $100 each. When ChatGPT names you, nobody charges you for the lead.",
    },
    ai: {
      h: ["We asked ChatGPT for the best battery installer in Perth.", "It named 5."],
      question: "Who is the best solar battery installer in Perth?",
      points: [
        "It named 5 installers. It picked them from SolarQuotes awards and “best installer” lists.",
        GOOGLE_STARS,
        "People are looking. “solar installers near me” hit 8,100 Google searches in October 2026, its biggest month. WA’s battery scheme passed 20,000 homes by May 2026 and aims for 100,000.",
        BRIGHTLOCAL_LINE,
      ],
    },
    help: localHelp({
      asks: "best battery installer in Perth",
      profile: "the suburbs you cover, the brands you install and how to reach you",
      lists: "the “best installer” lists, review sites and awards",
      page: "How much is a home battery in Perth after the rebate?",
    }),
    maths: {
      h: ["One battery job is a big sale.", "We’re $297 a month."],
      points: [
        "A 24 kWh battery costs about $18,000 installed in Perth before rebates, and about $11,260 after.",
        "So one extra battery job is a sale about 38 times bigger than our monthly fee.",
      ],
    },
    faq: localFaq(),
    close: ["Want to be the installer", "ChatGPT names?"],
    sources: [SRC.whySolar, SRC.solarQuotes, SRC.waBatteries, SRC.optimising, SRC.brightlocal],
  },
  {
    slug: "pool-spa-sauna-stores",
    label: "Pool, spa or sauna store",
    shopify: true,
    title: "Pool, spa and sauna stores: get picked by AI | FirstPicked",
    description:
      "Shoppers ask ChatGPT which plunge pool, spa or sauna to buy. We help your Shopify store get picked. $297 a month, done for you, no lock-in.",
    eyebrow: "For Shopify stores that sell plunge pools, spas and saunas",
    h1: ["Shoppers ask ChatGPT which plunge pool to buy.", "Make it pick yours."],
    lead: "We asked. It named 5 brands. We do the work to get your store in the answer. $297 a month, done for you.",
    spend: {
      h: ["Big searches.", "A small monthly fee."],
      costs: [
        { value: "22,200", text: "Google searches a month in Australia for “infrared sauna”" },
        { value: "14,800", text: "Searches a month for “plunge pool”. Last January it was 33,100." },
        AGENCIES,
      ],
      line: "Google also charges about $7 for one click on “fibreglass pools” or “infrared sauna”. When ChatGPT picks your store, nobody charges you for the click.",
    },
    ai: {
      h: ["We asked ChatGPT for the best plunge pool in Australia.", "It named 5 brands."],
      question: "What is the best plunge pool to buy in Australia?",
      points: [
        "It named 5 brands, with sizes and prices for each.",
        "To choose, it read buying guides. One was a guide on another store’s own blog. That’s the kind of guide we write for your store.",
        "In the same answer, it said entry-level plunge pool packages cost $15,000 to $25,000. When one order is that big, one extra sale from AI pays for many months of FirstPicked.",
      ],
    },
    review: true,
    help: {
      h: ["What we do for your store.", "Every month."],
      items: [
        { h: "Check 100 buying questions every day", p: "In ChatGPT, Gemini, Perplexity and Google AI Overviews, like “best plunge pool for a small backyard”. You see who gets picked." },
        { h: "Fix your product pages", p: "50+ fixes, so Google and AI can tell what you sell, the sizes and who it’s for." },
        { h: "Write up to 12 buying guides a month", p: "Each one answers a real shopper question. The kind of guide ChatGPT reads before it picks." },
        { h: "Find the sites AI trusts", p: "We show you the sites AI reads before it picks a brand, and which ones name your rivals." },
        { h: "Show you the sales from AI", p: "See the visits, orders and sales that came from AI and from Google." },
        { h: "A report every week", p: "A short email on what we did and what changed. No jargon." },
      ],
    },
    faq: [
      { q: "What do I have to do?", a: "Just the start: one short call, and we help you add a small code to your store. After that, we do the work." },
      { q: "Do you only work with Shopify stores?", a: "Yes. Right now we only work with stores on Shopify." },
      {
        q: "Can you promise ChatGPT will pick my store?",
        a: "No. Nobody can promise what AI says, and we won’t. We do the work that gives you the best chance, and we show you what changed every week.",
      },
      {
        q: "Is there a contract?",
        a: "No lock-in. You pay monthly and can stop any time. If you’re not happy after month 1, you get a full refund and keep all the work.",
      },
    ],
    close: ["Want ChatGPT to pick", "your store?"],
    sources: [SRC.optimising],
  },
  {
    slug: "buyers-agents",
    label: "Buyers agent",
    title: "Perth buyers agents: get picked by ChatGPT | FirstPicked",
    description:
      "ChatGPT named 5 buyers agents in Perth. We help you be one of them. $297 a month, done for you, no lock-in. Book a free 15 minute call.",
    eyebrow: "For Perth buyers agents",
    h1: ["Perth home buyers ask ChatGPT which buyers agent to use.", "It named 5. Are you one?"],
    lead: "We do the work to get your name in the answer. $297 a month, done for you.",
    spend: {
      h: ["Every new client", "costs a lot to find."],
      costs: [
        { value: "$40", text: "Google’s price for one click on “buyers agent perth”" },
        { value: "$19", text: "Google’s price for one click on “buyers agent”" },
        AGENCIES,
      ],
      line: "$297 a month is about 7 Google clicks on “buyers agent perth”. When ChatGPT names you, nobody charges you for the click.",
    },
    ai: {
      h: ["We asked ChatGPT for the best buyers agent in Perth.", "It named 5."],
      question: "Who is the best buyers agent in Perth?",
      points: ["It named 5 buyers agents. It picked them from PropertyGo and a REIWA award.", GOOGLE_STARS, BRIGHTLOCAL_LINE],
    },
    help: localHelp({
      asks: "best buyers agent in Perth for investors",
      profile: "the suburbs you buy in, who you help and how to reach you",
      lists: "the “best buyers agent” lists, review sites and awards",
      page: "Is a buyers agent worth it in Perth?",
    }),
    maths: {
      h: ["One new client", "pays for 20 months or more."],
      points: [
        "Perth buyers agents charge about $6,000 to $18,000 for a full search on a home under about $1 million.",
        "FirstPicked is $297 a month. One new client at $6,000 pays for about 20 months.",
      ],
    },
    faq: localFaq(),
    close: ["Want to be the buyers agent", "ChatGPT names?"],
    sources: [SRC.buyersAgentCost, SRC.optimising, SRC.brightlocal],
  },
  {
    slug: "plumbers-electricians",
    label: "Plumber or electrician",
    title: "Perth plumbers and sparkies: get picked by AI | FirstPicked",
    description:
      "One Google click on “emergency plumber” costs about $79. We help ChatGPT name your business instead. $297 a month, done for you, no lock-in.",
    eyebrow: "For Perth plumbers and electricians",
    h1: ["One Google click on “emergency plumber” costs about $79.", "ChatGPT names plumbers for free."],
    lead: "We asked ChatGPT for the best plumber and the best electrician in Perth. We help you be the one it names. $297 a month, done for you.",
    spend: {
      h: ["You pay for every click", "and every lead."],
      costs: [
        { value: "$79", text: "Google’s price for one click on “emergency plumber”" },
        { value: "$35", text: "Google’s price for one click on “electrician near me”" },
        { value: "$139 to $649", text: "What hipages plans cost a month, plus GST. Each lead costs credits on top." },
      ],
      line: "$297 a month is less than 4 Google clicks on “emergency plumber”. When ChatGPT names you, nobody charges you for the call.",
    },
    ai: {
      h: ["We asked ChatGPT for the best tradies in Perth.", "It named 4 plumbers and 5 electricians."],
      question: "Who is the best emergency plumber in Perth?",
      points: [
        "It named 4 plumbers. One directory it looked at ranks 671 Perth plumbers.",
        "We also asked who the best electrician in Perth is. It named 5. The same directory ranks 767 Perth electricians.",
        "Next to each pick, it showed their Google stars and review count. The 5 electricians had 518 to 2,045 Google reviews each.",
        BRIGHTLOCAL_LINE,
      ],
    },
    help: localHelp({
      asks: "best emergency plumber in Perth",
      profile: "the suburbs you cover, your services, your hours and how to reach you",
      lists: "the “best tradie” lists and directories",
      page: "Why is my hot water system leaking?",
    }),
    faq: localFaq(),
    close: ["Want to be the tradie", "ChatGPT names?"],
    sources: [SRC.hipages, SRC.calsoPlumbers, SRC.calsoSparkies, SRC.brightlocal],
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
