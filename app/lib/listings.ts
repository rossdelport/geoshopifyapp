// Listing sites for a local business (Ross, 19 Nov 2026: "this needs to be added now please"). AI builds its local
// picks from reviews, directories and "best of" lists, so each client gets onto the listing sites that matter: first
// the ones AI quoted in their own AI checks, then a short list of free Australian ones, then the ones for their trade.
// One a day, from the client's Listing sites page; Ross marks each one Listed (with its link) or Not for them.
// Pure rules, tested in test/listings.test.ts; lib/listings.server.ts reads the checks and the saved rows.

export interface ListingSite {
  domain: string; // "yellow.com.au"
  name: string;
  /** Where to sign up or claim the business. */
  url: string;
  why: string;
  /** Only for these trades (words in what the business does). */
  trades?: RegExp;
  /** Members of a trade body only. */
  members?: boolean;
}

// Checked 19 Nov 2026. Free to list unless it says otherwise; never pay for a listing without the client's OK.
export const STARTER_SITES: ListingSite[] = [
  { domain: "bingplaces.com", name: "Bing Places", url: "https://www.bingplaces.com/", why: "Bing’s own business listing. Bing’s results feed AI assistants like Microsoft Copilot." },
  { domain: "businessconnect.apple.com", name: "Apple Business Connect", url: "https://businessconnect.apple.com/", why: "How the business shows on Apple Maps and Siri on iPhones." },
  { domain: "facebook.com", name: "Facebook page", url: "https://www.facebook.com/pages/create", why: "A free business page. Many people check it for reviews, hours and photos." },
  { domain: "yelp.com.au", name: "Yelp", url: "https://biz.yelp.com.au/", why: "A review site that AI assistants quote in local answers." },
  { domain: "yellow.com.au", name: "Yellow Pages", url: "https://www.yellow.com.au/", why: "Australia’s best known business directory. The basic listing is free." },
  { domain: "truelocal.com.au", name: "True Local", url: "https://www.truelocal.com.au/", why: "An Australian business directory with reviews." },
  { domain: "localsearch.com.au", name: "Localsearch", url: "https://www.localsearch.com.au/", why: "An Australian business directory with reviews." },
  { domain: "startlocal.com.au", name: "StartLocal", url: "https://www.startlocal.com.au/", why: "An Australian business directory." },
  { domain: "hotfrog.com.au", name: "Hotfrog", url: "https://www.hotfrog.com.au/", why: "An Australian business directory." },
  { domain: "wordofmouth.com.au", name: "Word of Mouth", url: "https://www.wordofmouth.com.au/", why: "An Australian review site for local businesses." },
  { domain: "nextdoor.com", name: "Nextdoor", url: "https://business.nextdoor.com/", why: "A free business page where neighbours recommend local businesses." },
  { domain: "cleaningsearch.com.au", name: "CleaningSearch", url: "https://www.cleaningsearch.com.au/", why: "A directory of cleaning businesses.", trades: /clean|wash|gutter|window|solar panel/i },
  { domain: "mfaa.com.au", name: "MFAA Find a Broker", url: "https://www.mfaa.com.au/", why: "The mortgage brokers’ association lists its members.", trades: /broker|mortgage|home loan|finance/i, members: true },
  { domain: "fbaa.com.au", name: "FBAA Find a Broker", url: "https://www.fbaa.com.au/", why: "The finance brokers’ association lists its members.", trades: /broker|mortgage|home loan|finance/i, members: true },
  { domain: "masterelectricians.com.au", name: "Master Electricians", url: "https://www.masterelectricians.com.au/", why: "The electricians’ association lists its members.", trades: /electric/i, members: true },
];

const bare = (d: string) => d.toLowerCase().replace(/^www\./, "");

/** The same site whatever its ending: "yelp.com" and "biz.yelp.com.au" are both Yelp. */
export function siteKey(domain: string): string {
  const d = bare(domain);
  const known = STARTER_SITES.find((s) => d === s.domain || d.endsWith(`.${s.domain}`) || s.domain.split(".")[0] === d.split(".").slice(-3)[0]);
  if (known) return known.domain;
  return d;
}

export interface AiSite {
  domain: string;
  answers: number; // AI answers that quoted it in this client's checks
  url: string; // the page AI quoted most
}

export interface ListingRow {
  domain: string;
  status: string; // listed | skip
  url: string | null;
  updatedAt: Date | string;
}

export interface ListingItem {
  domain: string;
  name: string;
  url: string;
  why: string;
  members: boolean;
  /** AI quoted it in this client's checks. */
  answers: number;
  status: "todo" | "listed" | "skip";
  link: string | null;
  doneAt: string | null;
}

/** Every site for this client: AI-quoted first (most quoted first), then the free starters, then their trade's. */
export function listingPlan(o: { trade: string; aiSites: AiSite[]; rows: ListingRow[] }): ListingItem[] {
  const rows = new Map(o.rows.map((r) => [siteKey(r.domain), r]));
  const out: ListingItem[] = [];
  const seen = new Set<string>();
  const push = (item: Omit<ListingItem, "status" | "link" | "doneAt">) => {
    const key = siteKey(item.domain);
    if (seen.has(key)) {
      const had = out.find((i) => siteKey(i.domain) === key);
      if (had && item.answers > had.answers) had.answers = item.answers;
      return;
    }
    seen.add(key);
    const row = rows.get(key);
    out.push({
      ...item,
      domain: key,
      status: row?.status === "listed" ? "listed" : row?.status === "skip" ? "skip" : "todo",
      link: row?.url ?? null,
      doneAt: row ? new Date(row.updatedAt).toISOString() : null,
    });
  };
  for (const s of [...o.aiSites].sort((a, b) => b.answers - a.answers)) {
    const starter = STARTER_SITES.find((x) => x.domain === siteKey(s.domain));
    push({
      domain: s.domain,
      name: starter?.name ?? bare(s.domain),
      url: starter?.url ?? s.url,
      why: `AI quoted this site in ${s.answers.toLocaleString("en-US")} ${s.answers === 1 ? "answer" : "answers"} in their AI checks.${starter ? ` ${starter.why}` : ""}`,
      members: Boolean(starter?.members),
      answers: s.answers,
    });
  }
  for (const s of STARTER_SITES) {
    if (s.trades && !s.trades.test(o.trade)) continue;
    push({ domain: s.domain, name: s.name, url: s.url, why: s.why, members: Boolean(s.members), answers: 0 });
  }
  return out;
}

/** Today's listing: the first one still to do. */
export const nextListing = (items: ListingItem[]) => items.find((i) => i.status === "todo") ?? null;

/** A link to their page on a listing site: only an https address on that site. */
export function cleanListingUrl(raw: unknown, domain: string): string | null {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    const host = bare(u.hostname);
    const key = siteKey(domain);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (siteKey(host) !== key && !host.endsWith(bare(domain))) return null;
    return u.href.slice(0, 500);
  } catch {
    return null;
  }
}
