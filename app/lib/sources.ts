// What kind of website is this source? Fast rules first; Claude handles the rest.

export type SourceType = "retailer" | "editorial" | "ugc" | "brand" | "marketplace" | "other";

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  editorial: "Review & roundup sites",
  retailer: "Retailers",
  ugc: "Reddit, forums & video",
  brand: "Brand websites",
  marketplace: "Marketplaces",
  other: "Other",
};

const MARKETPLACES = ["amazon.", "ebay.", "catch.com.au", "kogan.com", "temu.com", "etsy.com", "trademe.co.nz", "mydeal.com.au", "aliexpress."];
const RETAILERS = [
  "chemistwarehouse", "priceline.com.au", "bigw.com.au", "myer.com.au", "davidjones.com", "shavershop",
  "mecca.com", "sephora.", "adorebeauty", "target.com.au", "kmart.com.au", "woolworths", "coles.com.au",
  "jbhifi", "harveynorman", "theiconic", "asos.com", "farmers.co.nz", "lookfantastic", "boots.com",
  "walmart.com", "target.com", "ulta.com", "costco", "bunnings", "rebelsport", "bcf.com.au", "petbarn",
  "terrywhite", "mydeal", "booktopia", "officeworks",
];
const UGC = [
  "reddit.com", "quora.com", "youtube.com", "tiktok.com", "facebook.com", "instagram.com", "x.com",
  "twitter.com", "pinterest.", "productreview.com.au", "trustpilot.com", "whirlpool.net.au", "medium.com",
];
const EDITORIAL_DOMAINS = [
  "canstarblue", "choice.com.au", "menshealth", "womenshealth", "gq.com", "vogue.", "dmarge", "buzzfeed",
  "nytimes.com", "forbes.com", "theguardian.com", "news.com.au", "smh.com.au", "theage.com.au",
  "goodhousekeeping", "elle.", "harpersbazaar", "cosmopolitan", "byrdie", "allure.com", "refinery29",
  "esquire", "insider", "bestfive.com.au", "finder.com.au", "mamamia", "howtogeek", "techradar", "cnet.com",
  "wired.com", "theverge.com", "tomsguide", "rtings.com", "healthline", "verywell", "nestpath",
];
const EDITORIAL_PATH = /(\/blog|\/blogs\/|\/journal|\/news|\/article|\/guide|\/reviews?\b|best-|-best|top-\d|\/top-|-vs-|\/compare|roundup|buying-guide)/i;

export function guessSourceType(url: string, domain: string): SourceType | null {
  const d = domain.toLowerCase();
  if (MARKETPLACES.some((m) => d.includes(m))) return "marketplace";
  if (UGC.some((m) => d === m || d.endsWith(`.${m}`) || d.includes(m))) return "ugc";
  if (RETAILERS.some((m) => d.includes(m))) return "retailer";
  if (EDITORIAL_DOMAINS.some((m) => d.includes(m))) return "editorial";
  let path = "";
  try {
    path = new URL(url).pathname;
  } catch {
    /* ignore */
  }
  if (EDITORIAL_PATH.test(path)) return "editorial";
  if (/\/(products|collections|shop)\//i.test(path)) return "brand";
  return null;
}
