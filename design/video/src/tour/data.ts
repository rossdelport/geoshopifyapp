// Every string and number shown in the member tour, in one place, so the copy check is one file
// (docs/video/storyboard.md section 4). Made-up store, sample numbers only: the video carries an "Example" tag on
// every frame. House rules: no em dashes or spaced en dashes, plain English, no promised results or dates.

export const STORE = { name: "Coolabah Grooming Co.", mono: "CG", domain: "coolabahgrooming.com" };
export const TABS = ["Dashboard", "Questions", "Competitors", "Fixes", "Outreach"] as const;
export type TabIndex = 0 | 1 | 2 | 3 | 4;

export type Engine = "chatgpt" | "gemini" | "perplexity" | "google";
export const ENGINE_NAME: Record<Engine, string> = {
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  perplexity: "Perplexity",
  google: "Google AI Overviews",
};
export const ENGINES: Engine[] = ["chatgpt", "gemini", "perplexity", "google"];

// One row per scene: the grey time chip, the Done-for-you note (split so "Done-for-you" can be bold) and the caption.
export type SceneCopy = { chip: string; note?: [string, string]; caption: string };
export const SCENE_COPY: SceneCopy[] = [
  { chip: "Minutes after you install", note: ["Done-for-you", ": 100 questions"], caption: "We write the questions your shoppers ask AI" },
  { chip: "Day one", note: ["Done-for-you", " also checks Claude"], caption: "Where you stand, and who AI picks instead" },
  { chip: "From day one", note: ["Done-for-you", ": we put fixes live for you"], caption: "Approve a fix. It’s live on your store." },
  { chip: "Every month", note: ["Done-for-you", ": we send them and follow up"], caption: "New guide pages, and pitches ready to send" },
  { chip: "Every week", note: ["Done-for-you", ": checked every day"], caption: "We ask AI again and show what changed" },
  { chip: "As orders come in", caption: "The money: sales, orders and clicks from AI" },
  { chip: "Start of each month", note: ["Done-for-you", ": plus a 30-minute call"], caption: "Plus a report in your inbox each month" },
];

// Scene 1: setup
export const SETUP = {
  title: "Checking how AI sees your store",
  steps: ["Reading your products", "Writing the questions shoppers ask AI", "Asking the AI assistants (twice each)", "Working out your score"],
  products: 48,
  productsUnit: "products",
  topics: [
    { label: "Beard oil", chips: ["best beard oil for dry skin", "unscented beard oil for sensitive skin"] },
    { label: "Beard wash", chips: ["gentle beard wash for sensitive skin"] },
    { label: "Beard balm", chips: ["beard balm that isn’t greasy"] },
    { label: "Gifts", chips: ["beard care gift for dad"] },
  ],
  summaryA: "50 questions in 6 topics",
  summaryB: "Edit them any time",
  answersTotal: 400, // 50 questions x 4 AIs x 2 runs
  answersRead: (n: number) => `${n} of 400 AI answers read`,
};

// Scene 2: the starting point
export const START = {
  title: "Your starting point",
  note: "Saved, so you can see what changes",
  scoreTitle: "How often AI names you",
  score: 29,
  scoreOf: "/100",
  engineScores: [
    ["chatgpt", 34],
    ["gemini", 31],
    ["perplexity", 27],
    ["google", 24],
  ] as [Engine, number][],
  scoreLine: "A score out of 100 for how often AI names you.",
  rivalsTitle: "Who AI recommends instead",
  rivalsSub: "Share of answers that name each brand",
  rivals: [
    { name: "Ridgeback Beard Co.", pct: 64 },
    { name: "Saltbush Beard Co.", pct: 49 },
    { name: "Banksia Beard Co.", pct: 33 },
    { name: "Coolabah Grooming Co.", pct: 30, you: true },
    { name: "Wattlebird Grooming", pct: 18 },
  ],
  you: "You",
  sitesTitle: "Sites AI trusts",
  sitesSub: "Sites AI linked to in its answers",
  sites: [
    { domain: "examplereviews.com", type: "Review site", count: "41 answers" },
    { domain: "examplebeardblog.com", type: "Review site", count: "27 answers" },
    { domain: "examplegrooming.com", type: "Retailer", count: "19 answers" },
    // the store's own site: the real Competitors screen labels it "Your website"
    { domain: "coolabahgrooming.com", type: "Your website", count: "12 answers", own: true },
  ],
};

// Scene 3: a fix
export const FIX = {
  title: "Fixes",
  note: "Only facts from your store",
  kind: "Clearer product description",
  product: "Gentle Beard Wash 200ml",
  waiting: "Waiting",
  live: "Live",
  before: "Before",
  beforeText: "Our best seller. Smells amazing.",
  after: "After",
  afterText: "Soap-free beard wash for sensitive skin. Ships worldwide. 200ml.",
  whyLabel: "Why:",
  why: " AI can now tell who it’s for. Only facts from your page.",
  approve: "Approve & publish",
  pushed: "Pushed to Shopify",
  edit: "Edit",
  undo: "Undo",
  toast: "Live in your store",
  tooltip: "One click puts the old text back",
  more: [
    { kind: "Product FAQs", product: "Beard Balm 60g" },
    { kind: "Clearer product title", product: "Dry Skin Beard Oil 30ml" },
  ],
};

// Scene 4: every month
export const MONTH = {
  title: "This month",
  guidesTitle: "Guide pages",
  guidesNote: "2 this month",
  guideLabel: "New buying guide page",
  guides: [
    { title: "Choosing a beard oil for dry skin", meta: "Links to 3 of your products", live: true },
    { title: "Beard care for sensitive skin", live: false },
  ],
  pitchTitle: "Sites to pitch",
  pitchNote: "Up to 10 this month",
  ready: "Ready to send",
  pitches: [
    { site: "examplereviews.com", what: "Roundup · names Ridgeback, Saltbush" },
    { site: "examplegiftguide.com", what: "Gift guide · names Banksia" },
    { site: "examplebeardblog.com", what: "Article · names Ridgeback" },
  ],
  toLabel: "To:",
  to: "sam@examplereviews.com",
  found: "Email found",
  subjectLabel: "Subject:",
  subject: "A beard oil for your dry skin roundup",
  body: "Hi Sam, I read your roundup of beard oils for dry skin. Would our Dry Skin Beard Oil 30ml be a fit? Happy to send a sample.",
  open: "Open in my email",
  copy: "Copy email",
};

// Scene 5: every week
export const WEEK = {
  title: "Does AI name you?",
  note: "Asked every week",
  scoreTitle: "How often AI names you",
  trend: [29, 30, 29, 32, 33, 35, 36],
  next: 38,
  since: (n: number) => `+${n} since you joined`,
  startLabel: "Starting point",
  checking: (n: number) => `Checking now… ${n} of 400`,
  // two sentences; the phone layout puts each on its own line
  wobble: ["Scores move up and down.", "Watch the trend."],
  qHead: "Question",
  colHead: ["ChatGPT", "Gemini", "Perplexity", "AI Overviews"],
  // y = named, n = not named, x = no overview. "yn" = named, then not named after the check; "ny" the other way.
  rows: [
    { q: "best beard oil for dry skin", marks: ["y", "y", "n", "n"] },
    { q: "beard balm that isn’t greasy", marks: ["n", "y", "yn", "n"] },
    { q: "gentle beard wash for sensitive skin", marks: ["n", "ny", "n", "n"] },
    { q: "beard care gift for dad", marks: ["y", "n", "n", "x"] },
  ],
  noOverview: "No overview",
};

// Scene 6: the money and the report
export const MONEY = {
  title: "Money from AI",
  seg: ["Last 4 weeks", "Since joining"],
  kpis: [
    { label: "AI revenue", value: 4820, money: true },
    { label: "AI orders", value: 61 },
    { label: "AI clicks", value: 1940 },
  ],
  vs: "▲ 38% vs before you joined",
  beforeA: "Before you joined: $3,490 a month",
  beforeB: " (from your last 60 days of orders)",
  srcTitle: "Where AI sales come from",
  sources: [
    { name: "ChatGPT", value: 2640, color: "chatgpt" },
    { name: "Perplexity", value: 880, color: "perplexity" },
    { name: "Gemini", value: 760, color: "gemini" },
    { name: "Other", value: 540, color: "other" },
  ],
  prodTitle: "Products bought via AI",
  products: [
    { name: "Dry Skin Beard Oil 30ml", n: 23 },
    { name: "Gentle Beard Wash 200ml", n: 14 },
    { name: "Beard Balm 60g", n: 9 },
  ],
  fine: "Only orders we can trace to AI. Google AI Overviews aren’t counted.",
  email: {
    from: "Your AI search report · Coolabah Grooming Co.",
    // No month named: the real email (app/lib/report.server.ts) is headed "Money from AI this month" but is sent in
    // the first days of the month, so neither "this month" nor "last month" would be honest here yet.
    heading: "Money from AI",
    tiles: [
      { value: "$4,820", label: "sales from AI" },
      { value: "61", label: "orders" },
      { value: "1,940", label: "clicks from AI" },
    ],
    score: "Visibility score: 38/100 (+9 since you joined)",
    fixes: "You have 4 fixes ready to approve. Each one takes a click.",
    button: "Open the app",
  },
};

// Scene 7: end card
export const END = {
  title: "What to expect, and when",
  stops: [
    { label: "Day one", line: "See where you stand" },
    { label: "The day you approve", line: "Fixes go live on your store" },
    { label: "Weeks to months", line: "AI answers catch up. Nobody can promise when." },
  ],
  button: "Start 7-day free trial",
  small: "Billed through Shopify. Cancel any time.",
};

export const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
export const num = (n: number) => Math.round(n).toLocaleString("en-US");
