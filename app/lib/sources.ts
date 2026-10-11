// What kind of website is this source, what kind of outreach suits it, and which sites each AI assistant
// leans on. Pure functions (tested), shared by server and UI. Fast rules first; Claude handles the rest.

export type SourceType = "retailer" | "editorial" | "ugc" | "brand" | "marketplace" | "other";

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  editorial: "Review & roundup sites",
  retailer: "Retailers",
  ugc: "Reddit, forums & video",
  brand: "Brand websites",
  marketplace: "Marketplaces",
  other: "Other",
};

// Each list entry matches a domain in one of three ways (see matchesDomain):
//   "amazon."          a site name in any country: amazon.com, amazon.co.uk, smile.amazon.de
//   "boots.com"        that domain or its subdomains only (so "x.com" never matches "box.com")
//   "chemistwarehouse" anywhere in the domain
const MARKETPLACES = [
  "amazon.", "ebay.", "etsy.com", "temu.com", "aliexpress.", "shein.", "rakuten.", "mercadolibre.", "mercadolivre.",
  "flipkart.com", "noon.com", "allegro.pl", "bol.com", "otto.de", "cdiscount.com", "fruugo.", "onbuy.com", "wish.com",
  "lazada.", "shopee.", "tokopedia.com", "tmall.com", "taobao.com", "jd.com", "zalando.", "faire.com",
  "catch.com.au", "kogan.com", "mydeal.com.au", "trademe.co.nz",
];
const RETAILERS = [
  // North America
  "walmart.", "target.com", "ulta.com", "costco", "bestbuy.", "cvs.com", "walgreens.com", "nordstrom.", "macys.com",
  "kohls.com", "rei.com", "dickssportinggoods.com", "homedepot.", "lowes.com", "wayfair.", "chewy.com", "petco.com",
  "petsmart.", "sallybeauty.", "dermstore.com", "bluemercury.com", "revolve.com", "zappos.com", "gnc.com",
  "vitaminshoppe.com", "iherb.com", "thrivemarket.com", "williams-sonoma.com", "crateandbarrel.com", "potterybarn.com",
  "anthropologie.com", "urbanoutfitters.com", "shoppersdrugmart.ca", "canadiantire.ca", "well.ca", "thebay.com",
  "sportchek.ca", "londondrugs.com",
  // UK and Europe
  "boots.com", "superdrug.com", "johnlewis.com", "argos.co.uk", "currys.co.uk", "selfridges.com", "harrods.com",
  "next.co.uk", "marksandspencer.com", "tesco.com", "sainsburys.co.uk", "asda.com", "hollandandbarrett.", "cultbeauty.",
  "spacenk.com", "feelunique.com", "lookfantastic.", "notino.", "douglas.", "lyko.com", "ocado.com", "very.co.uk",
  "mediamarkt.", "fnac.", "dm.de", "rossmann.de", "elcorteingles.es", "galerieslafayette.com", "debijenkorf.nl",
  "coolblue.", "kicks.se", "apotea.se", "asos.com",
  // Asia, Africa, Middle East
  "nykaa.com", "myntra.com", "takealot.com", "clicks.co.za", "dischem.co.za", "watsons.", "sephora.", "mecca.",
  // Australia and New Zealand
  "chemistwarehouse", "priceline.com.au", "bigw.com.au", "myer.com.au", "davidjones.com", "shavershop", "adorebeauty",
  "target.com.au", "kmart.com.au", "woolworths", "coles.com.au", "jbhifi", "harveynorman", "theiconic", "farmers.co.nz",
  "bunnings", "rebelsport", "bcf.com.au", "petbarn", "terrywhite", "booktopia", "officeworks",
];
const UGC = [
  "reddit.com", "quora.com", "youtube.com", "youtu.be", "vimeo.com", "tiktok.com", "facebook.com", "instagram.com",
  "x.com", "twitter.com", "threads.net", "pinterest.", "linkedin.com", "tumblr.com", "medium.com", "stackexchange.com",
  "mumsnet.com", "whirlpool.net.au", "trustpilot.com", "productreview.com.au", "sitejabber.com", "yelp.",
];
const EDITORIAL_DOMAINS = [
  "nytimes.com", "nymag.com", "theguardian.com", "independent.co.uk", "telegraph.co.uk", "dailymail.co.uk",
  "standard.co.uk", "which.co.uk", "consumerreports.org", "usatoday.com", "cnn.com", "nbcnews.com", "today.com",
  "people.com", "forbes.com", "insider", "buzzfeed", "huffpost", "vice.com", "bustle.com", "popsugar.", "glamour",
  "marieclaire", "instyle.com", "self.com", "shape.com", "prevention.com", "realsimple.com", "thespruce",
  "bonappetit.com", "epicurious.com", "seriouseats.com", "foodandwine.com", "travelandleisure.com", "cntraveler.com",
  "outsideonline.com", "gearpatrol.com", "menshealth", "mensjournal.com", "askmen.com", "womenshealth", "gq.",
  "vogue.", "elle.", "harpersbazaar", "cosmopolitan", "townandcountrymag.com", "byrdie", "allure.com", "refinery29",
  "whowhatwear", "stylist.co.uk", "esquire", "goodhousekeeping", "womansday.com", "parents.com", "babylist.com",
  "whattoexpect.com", "thebump.com", "healthline", "verywell", "howtogeek", "techradar", "tomsguide", "rtings.com",
  "wired.com", "cnet.com", "theverge.com", "engadget.com", "zdnet.com", "pcmag.com", "digitaltrends.com", "t3.com",
  "trustedreviews.com", "expertreviews.co.uk",
  // Australia and New Zealand
  "canstarblue", "choice.com.au", "dmarge", "news.com.au", "smh.com.au", "theage.com.au", "bestfive.com.au",
  "finder.com.au", "mamamia", "nestpath", "stuff.co.nz", "nzherald.co.nz", "consumer.org.nz",
];
const EDITORIAL_PATH = /(\/blog|\/blogs\/|\/journal|\/news|\/article|\/guide|\/reviews?\b|best-|-best|top-\d|\/top-|-vs-|\/compare|roundup|buying-guide)/i;

/** Does a domain match one list entry? (See the note above the lists.) */
export function matchesDomain(domain: string, entry: string): boolean {
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (entry.endsWith(".")) return d.startsWith(entry) || d.includes(`.${entry}`);
  if (entry.includes(".")) return d === entry || d.endsWith(`.${entry}`);
  return d.includes(entry);
}
const inList = (domain: string, list: string[]) => list.some((e) => matchesDomain(domain, e));

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};

export function guessSourceType(url: string, domain: string): SourceType | null {
  if (inList(domain, MARKETPLACES)) return "marketplace";
  if (inList(domain, UGC)) return "ugc";
  if (inList(domain, RETAILERS)) return "retailer";
  if (inList(domain, EDITORIAL_DOMAINS)) return "editorial";
  const path = pathOf(url);
  if (EDITORIAL_PATH.test(path)) return "editorial";
  if (/\/(products|collections|shop)\//i.test(path)) return "brand";
  return null;
}

// ---------- Outreach kinds: what an honest next step looks like for each cited page ----------

export type OutreachKind = "article" | "video" | "forum" | "qa" | "directory" | "retailer" | "other";

export const OUTREACH_KINDS: OutreachKind[] = ["article", "video", "forum", "qa", "directory", "retailer", "other"];

export const OUTREACH_KIND_LABELS: Record<OutreachKind, string> = {
  article: "Articles and roundups",
  video: "Videos",
  forum: "Forum threads",
  qa: "Questions and answers",
  directory: "Directories and review sites",
  retailer: "Shops and marketplaces",
  other: "Other pages",
};

const VIDEO = ["youtube.com", "youtu.be", "vimeo.com", "tiktok.com"];
const QA = ["quora.com", "stackexchange.com", "answers.com"];
const FORUMS = ["reddit.com", "whirlpool.net.au", "mumsnet.com", "netmums.com"];
const FORUM_HOST = /^(forums?|community|boards?|discuss|discussions)\./;
const FORUM_PATH = /\/(forums?|threads?|community|discussions?|t)\/|\/r\/[^/]+\/comments\//i;
// Places a brand lists or claims itself. Review platforms are here too: the step is to claim the free
// profile and keep it right, never to write or buy reviews.
export const REVIEW_PLATFORMS = ["trustpilot.com", "productreview.com.au", "sitejabber.com", "reviews.io", "feefo.com", "yelp.", "bbb.org"];
const DIRECTORIES = [
  ...REVIEW_PLATFORMS, "yellowpages", "yell.com", "truelocal.com.au", "hotfrog.", "cylex.", "brownbook.net", "manta.com",
  "foursquare.com", "crunchbase.com", "producthunt.com", "goodonyou.eco", "buyaustralianmade.com.au", "madeinnz.",
];
// Blogs on shared platforms: articles with an author to contact, whatever the source type says.
const BLOG_PLATFORMS = ["medium.com", "substack.com", "wordpress.com", "blogspot.com", "ghost.io"];
const SOCIAL = ["facebook.com", "instagram.com", "x.com", "twitter.com", "threads.net", "pinterest.", "linkedin.com", "tumblr.com"];
// Pages nobody should be pitched on: encyclopedias, search engines, government and universities.
const NO_OUTREACH = ["wikipedia.org", "wikimedia.org", "wiktionary.org", "wikihow.com", "google.", "bing.com", "duckduckgo.com"];
const NO_OUTREACH_TLD = /\.(gov|edu|mil|int)(\.[a-z]{2})?$|\.(ac|govt)\.[a-z]{2}$/;

/** True for pages we never suggest outreach on (Wikipedia, search engines, government, universities). */
export function noOutreach(domain: string): boolean {
  const d = domain.toLowerCase();
  return !d || inList(d, NO_OUTREACH) || NO_OUTREACH_TLD.test(d);
}

/**
 * The kind of outreach that suits a cited page, from its address (and the source type, when known).
 * youtube / youtu.be / vimeo / tiktok: video. Reddit and forums: forum. Quora and Q&A sites: qa.
 * Directories and review platforms: directory. Retailers and marketplaces: retailer.
 * Brand sites and social profiles: other. Other community pages: forum. Everything else: article.
 */
export function outreachKind(url: string, domain: string, type?: string | null): OutreachKind {
  const d = domain.toLowerCase().replace(/^www\./, "");
  const path = pathOf(url);
  if (inList(d, VIDEO)) return "video";
  if (inList(d, QA)) return "qa";
  if (inList(d, FORUMS) || FORUM_HOST.test(d)) return "forum";
  if (inList(d, DIRECTORIES) || /directory/.test(d) || /\/(directory|brand-directory)\//i.test(path)) return "directory";
  if (type === "retailer" || type === "marketplace" || inList(d, RETAILERS) || inList(d, MARKETPLACES)) return "retailer";
  if (type === "brand" || inList(d, SOCIAL)) {
    // A Facebook group is a forum; other social pages and brand sites have no honest outreach step here.
    return /facebook\.com$/.test(d) && /^\/groups\//.test(path) ? "forum" : "other";
  }
  if (inList(d, BLOG_PLATFORMS)) return "article";
  if (type === "ugc" || (type !== "editorial" && FORUM_PATH.test(path))) return "forum";
  return "article";
}

/** Is this a review platform (claim the profile, never write reviews)? */
export const isReviewPlatform = (domain: string) => inList(domain, REVIEW_PLATFORMS);

// ---------- Freshness ----------

/** The newest plausible year named in a page's title or address ("best beard oil 2026"), or null. */
export function yearHint(url: string, title: string | null | undefined, now = new Date()): number | null {
  const max = now.getUTCFullYear() + 1;
  const years = [...`${title ?? ""} ${pathOf(url)}`.matchAll(/(?<![0-9])(20[0-9]{2})(?![0-9])/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y >= 2005 && y <= max);
  return years.length ? Math.max(...years) : null;
}

const MONTH_MS = 30.44 * 86_400_000;

/**
 * How much fresher pages are worth: AI assistants favour recently updated pages (Ahrefs found cited pages
 * were about 26% fresher than normal search results). A multiplier around 1: newer is higher, very old is
 * lower, unknown is neutral. Uses the page's own date when we have it, else a year in its title or address.
 */
export function freshnessFactor(modifiedAt: Date | string | null | undefined, hint: number | null | undefined, now = new Date()): number {
  if (modifiedAt) {
    const months = (now.getTime() - new Date(modifiedAt).getTime()) / MONTH_MS;
    if (!Number.isFinite(months)) return 1;
    if (months <= 6) return 1.3;
    if (months <= 12) return 1.15;
    if (months <= 24) return 1;
    return 0.75;
  }
  if (hint) {
    const year = now.getUTCFullYear();
    if (hint >= year) return 1.2;
    if (hint === year - 1) return 1.05;
    if (hint <= year - 3) return 0.75;
  }
  return 1;
}

/** "Updated March 2026" (the same on the server and in the browser). */
export function updatedLabel(date: Date | string | null | undefined): string | null {
  const m = monthYear(date);
  return m ? `Updated ${m}` : null;
}

/** "March 2026" in UTC, or null. */
export function monthYear(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * A cited page's own date, worded for what we know: "Updated March 2026" when the page gave an updated
 * date, "Published March 2026" when it only gave a published one, "Dated March 2026" when we stored the
 * date without knowing which (outreach targets keep one date column).
 */
export function pageDateLabel(date: Date | string | null | undefined, isModified?: boolean | null): string | null {
  const m = monthYear(date);
  if (!m) return null;
  return isModified === true ? `Updated ${m}` : isModified === false ? `Published ${m}` : `Dated ${m}`;
}

const STALE_MONTHS = 30;

/**
 * Too old to spend an outreach slot on: dated more than about 30 months ago, or a year in its title or
 * address three or more years back. (Pages two or more assistants cite still count: see targetScore.)
 */
export function isStalePage(modifiedAt: Date | string | null | undefined, hint: number | null | undefined, now = new Date()): boolean {
  if (modifiedAt) {
    const months = (now.getTime() - new Date(modifiedAt).getTime()) / MONTH_MS;
    return Number.isFinite(months) && months > STALE_MONTHS;
  }
  return Boolean(hint && hint <= now.getUTCFullYear() - 3);
}

const THREAD_OPEN_MONTHS = 6; // Reddit archives threads after 6 months; many forums lock old ones

/** A forum or Q&A thread that is probably closed to new replies: older than 6 months, or of unknown age on Reddit. */
export function threadMaybeClosed(kind: string, domain: string, modifiedAt: Date | string | null | undefined, now = new Date()): boolean {
  if (kind !== "forum" && kind !== "qa") return false;
  if (!modifiedAt) return /(^|\.)reddit\.com$/.test(domain.toLowerCase());
  const months = (now.getTime() - new Date(modifiedAt).getTime()) / MONTH_MS;
  return Number.isFinite(months) && months > THREAD_OPEN_MONTHS;
}

// ---------- Ranking outreach targets ----------

// How useful each kind of target tends to be. Roundups and reviews first; shops last (a stocking
// conversation is slow, and not every store wants one).
const KIND_WEIGHT: Record<OutreachKind, number> = { article: 1, video: 0.9, forum: 0.8, qa: 0.8, directory: 0.7, retailer: 0.5, other: 0.2 };

export interface RankInput {
  cited: number; // AI answers that used this page (recent scans)
  engines: string[]; // which assistants used it
  rivals: number; // other brands named in those answers
  merchantNamed: number; // of those answers, how many named the store
  kind: OutreachKind;
  modifiedAt?: Date | string | null; // the page's own date, once we've read it
  yearHint?: number | null;
}

/**
 * Higher = better target. Mostly how often AI uses the page (and how many assistants), then the rivals
 * it sits next to, less when AI already names the store with it, times the kind and freshness weights.
 * Stale pages (isStalePage) go to the back unless two or more assistants cite them, and threads that
 * are probably closed to replies (threadMaybeClosed) count for less.
 */
export function targetScore(t: RankInput & { domain?: string }, now = new Date()): number {
  const engines = new Set(t.engines).size;
  const base = t.cited * 2 + Math.max(0, engines - 1) * 1.5 + Math.min(t.rivals, 6) * 0.5 - t.merchantNamed * 3;
  let fresh = freshnessFactor(t.modifiedAt, t.yearHint, now);
  if (isStalePage(t.modifiedAt, t.yearHint, now) && engines < 2) fresh = 0.2;
  if (threadMaybeClosed(t.kind, t.domain ?? "", t.modifiedAt, now)) fresh = Math.min(fresh, 0.6);
  return Math.max(0.1, base) * KIND_WEIGHT[t.kind] * fresh;
}

// ---------- Rival brands' own websites ----------

// A brand's own site is often its name plus a word: milkmanshop.com, getmilkman.com, the-milkman.co.
const RIVAL_PREFIXES = ["", "the", "get", "shop", "try", "my", "buy"];
const RIVAL_SUFFIXES = ["", "co", "shop", "store", "skincare", "official", "brand", "hq", "online", "beauty", "us", "usa", "uk", "au", "nz", "ca", "global"];

/**
 * Is this a rival brand's own website? Compares each domain label (hyphens removed) with the rival
 * keys (brandKey, 5+ characters), allowing a few generic prefixes and suffixes. Never a substring
 * match anywhere in the domain: "native" must not catch alternativeto.net or nativeplanet.com.
 */
export function isRivalDomain(domain: string, keys: Set<string>): boolean {
  if (!keys.size) return false;
  const labels = domain.toLowerCase().replace(/^www\./, "").split(".");
  for (const raw of labels.slice(0, -1)) {
    const label = raw.replace(/-/g, "");
    for (const pre of RIVAL_PREFIXES) {
      if (!label.startsWith(pre)) continue;
      const rest = label.slice(pre.length);
      for (const suf of RIVAL_SUFFIXES) {
        if (rest.length > suf.length && rest.endsWith(suf) && keys.has(rest.slice(0, rest.length - suf.length))) return true;
      }
    }
  }
  return false;
}

/**
 * Pick `n` items, taking turns between the assistants so each one's own sources get worked (only 7 of the
 * top 50 domains cited by Google AI Overviews, ChatGPT and Perplexity were the same in Ahrefs' study).
 * Within each assistant, best score first. `maxPerKind` caps a kind per call (e.g. 2 shops at most).
 * Returns the picked items in the order picked.
 */
export function pickAcrossEngines<T extends { engines: string[]; score: number; kind?: OutreachKind }>(
  items: T[],
  n: number,
  maxPerKind: Partial<Record<OutreachKind, number>> = {},
): T[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  // Assistants in the order of their best item, so the strongest page still goes first.
  const engines: string[] = [];
  for (const it of sorted) for (const e of it.engines) if (!engines.includes(e)) engines.push(e);
  const picked: T[] = [];
  const taken = new Set<T>();
  const perKind = new Map<string, number>();
  const allowed = (it: T) => !it.kind || maxPerKind[it.kind] === undefined || (perKind.get(it.kind) ?? 0) < maxPerKind[it.kind]!;
  const take = (it: T) => {
    picked.push(it);
    taken.add(it);
    if (it.kind) perKind.set(it.kind, (perKind.get(it.kind) ?? 0) + 1);
  };
  let progress = true;
  while (picked.length < n && progress) {
    progress = false;
    for (const e of engines) {
      if (picked.length >= n) break;
      const next = sorted.find((it) => !taken.has(it) && it.engines.includes(e) && allowed(it));
      if (next) {
        take(next);
        progress = true;
      }
    }
  }
  // Items no assistant claimed (no engines recorded) come last, best first.
  for (const it of sorted) {
    if (picked.length >= n) break;
    if (!taken.has(it) && !it.engines.length && allowed(it)) take(it);
  }
  return picked;
}

// ---------- Which sites each AI assistant leans on ----------

export interface CitedAnswer {
  engine: string;
  mentioned: boolean; // the answer named the store
  citations: { url: string; domain: string; title: string | null; type: string; isOwn: boolean }[];
}

export interface DomainRow {
  domain: string;
  type: string;
  own: boolean;
  example: { url: string; title: string | null };
  answers: number; // answers that cited this domain
  share: number; // of all answers in this view (0 to 1)
  named: number; // of those answers, how many named the store
}

export interface SourcesView {
  answers: number;
  domains: DomainRow[]; // most-cited first
  types: { type: string; share: number }[]; // share of citations by kind of site ("yours" = the store's own site)
}

function buildView(answers: CitedAnswer[]): SourcesView {
  const byDomain = new Map<string, DomainRow>();
  const typeCounts = new Map<string, number>();
  for (const a of answers) {
    const seen = new Set<string>();
    for (const c of a.citations) {
      if (!c.domain || seen.has(c.domain)) continue;
      seen.add(c.domain);
      const typeKey = c.isOwn ? "yours" : c.type;
      typeCounts.set(typeKey, (typeCounts.get(typeKey) ?? 0) + 1);
      const row = byDomain.get(c.domain) ?? { domain: c.domain, type: c.type, own: c.isOwn, example: { url: c.url, title: c.title }, answers: 0, share: 0, named: 0 };
      row.answers++;
      if (a.mentioned) row.named++;
      if (!row.example.title && c.title) row.example = { url: c.url, title: c.title };
      byDomain.set(c.domain, row);
    }
  }
  const total = answers.length || 1;
  const typeTotal = [...typeCounts.values()].reduce((s, v) => s + v, 0) || 1;
  return {
    answers: answers.length,
    domains: [...byDomain.values()]
      .map((r) => ({ ...r, share: r.answers / total }))
      .sort((a, b) => b.answers - a.answers || a.domain.localeCompare(b.domain)),
    types: [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ type, share: n / typeTotal })),
  };
}

/** The sites AI cites, for all assistants together ("all") and for each assistant on its own. */
export function sourcesByEngine(answers: CitedAnswer[], engineOrder: string[] = []): { engines: string[]; views: Record<string, SourcesView> } {
  const present = [...new Set(answers.map((a) => a.engine))];
  const engines = [...engineOrder.filter((e) => present.includes(e)), ...present.filter((e) => !engineOrder.includes(e)).sort()];
  const views: Record<string, SourcesView> = { all: buildView(answers) };
  for (const e of engines) views[e] = buildView(answers.filter((a) => a.engine === e));
  return { engines, views };
}

/**
 * Of each assistant's `top` most-cited sites (not counting the store's own), how many appear in every
 * assistant's list. Null with fewer than two assistants.
 */
export function sharedTopDomains(views: Record<string, SourcesView>, engines: string[], top = 10): { shared: number; top: number } | null {
  const lists = engines.map((e) => (views[e]?.domains ?? []).filter((d) => !d.own).slice(0, top).map((d) => d.domain)).filter((l) => l.length);
  if (lists.length < 2) return null;
  const shared = lists[0].filter((d) => lists.every((l) => l.includes(d))).length;
  return { shared, top: Math.max(...lists.map((l) => l.length)) };
}

/**
 * For each assistant, the newest scan that has answers from it. Done-for-you's daily scans skip Claude and
 * run once, so the newest scan alone would hide Claude for six days a week.
 * `scans` newest first; `groups` = which engines each scan has answers for.
 */
export function latestScanPerEngine(scans: string[], groups: { scanId: string; engine: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const scanId of scans) {
    for (const g of groups) if (g.scanId === scanId && !out[g.engine]) out[g.engine] = scanId;
  }
  return out;
}
