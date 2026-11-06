// How many people opened firstpicked.com.au/book, and booked a call, by ad (Ross, 4 Nov 2026: "track how many people
// are clicking thru on my ad to the /book page and i want you to visualise that so i can wake up in the morning and
// see"). Pure helpers: the database side is book-stats.server.ts, the chart is on the admin Overview.
// Since 6 Nov 2026 the page asks two questions before the times (a Shopify brand? sales a month?), and everyone's
// answers are counted the same way ("answered" rows, once a person a day), so Ross sees who the ads bring.

import { SALES } from "./booking";

/** The ad's tags, as the page sends them (from the address bar and the site that sent the visitor). */
export interface AdTags {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: boolean;
  referrer: string | null;
}

/** Short plain text: no control characters or angle brackets, at most 100 characters. Empty is null. */
function tag(raw: unknown): string | null {
  const s = String(raw ?? "")
    // eslint-disable-next-line no-control-regex -- removing control characters is the point
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return s || null;
}

/** "https://m.facebook.com/somewhere" -> "m.facebook.com" (www. dropped). Anything else is null. */
export function hostOf(raw: unknown): string | null {
  try {
    const u = new URL(String(raw ?? ""));
    return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, "").slice(0, 100) || null : null;
  } catch {
    return null;
  }
}

/** The tags in a form the book page posted: utm_*, fb=1 when the link had Facebook's click id, ref = document.referrer. */
export function readAdTags(form: URLSearchParams): AdTags {
  return {
    utmSource: tag(form.get("utm_source")),
    utmMedium: tag(form.get("utm_medium")),
    utmCampaign: tag(form.get("utm_campaign")),
    utmContent: tag(form.get("utm_content")),
    utmTerm: tag(form.get("utm_term")),
    fbclid: form.get("fb") === "1",
    referrer: hostOf(form.get("ref")),
  };
}

export const NO_NAME = {
  meta: "Facebook or Instagram, no ad name",
  home: "Home page, no ad name",
  none: "Not from an ad",
};

/**
 * The name a visit shows under: the ad's name (utm_content, as Meta fills it in with {{ad.name}}), else the campaign,
 * else the source. With no tags: Facebook or Instagram (Facebook's click id, or one of their sites sent them), our
 * own home page, or not from an ad (typed in, a bookmark, another site).
 */
export function adName(t: Pick<AdTags, "utmSource" | "utmCampaign" | "utmContent" | "fbclid" | "referrer">): string {
  const named = t.utmContent || t.utmCampaign || t.utmSource;
  if (named) return named;
  if (t.fbclid || /(^|\.)(facebook|instagram)\.com$/.test(t.referrer ?? "")) return NO_NAME.meta;
  if (/(^|\.)(firstpicked\.com\.au|usegeo\.app)$/.test(t.referrer ?? "")) return NO_NAME.home;
  return NO_NAME.none;
}

export type BookRow = Pick<AdTags, "utmSource" | "utmCampaign" | "utmContent" | "fbclid" | "referrer"> & {
  kind: string; // view | answered | booked
  day: string;
  shopify?: string | null;
  sales?: string | null;
};

export const NOT_SHOPIFY = "Not a Shopify brand";

/** The answer a row counts under: "Not a Shopify brand", a sales band ("A$5,000 to A$20,000"), or null (no answer). */
export function answerLabel(shopify: string | null | undefined, sales: string | null | undefined): string | null {
  if (shopify === "no") return NOT_SHOPIFY;
  return SALES.find((s) => s.value === sales)?.label ?? null;
}

export interface BookDay {
  day: string;
  people: number;
  booked: number;
}

export interface BookStats {
  days: BookDay[];
  ads: { name: string; people: number; booked: number }[];
  totals: { people: number; booked: number };
  /** What people answered, in the drop-down's order: how many gave each answer, and how many of them booked. */
  answers: { label: string; people: number; booked: number }[];
}

/**
 * Per day and per ad, for the days asked (each `day` a YYYY-MM-DD; rows on other days are left out). A "view" row is
 * one person on one day (book-stats.server.ts saves a person once a day), a "booked" row one call booked. An
 * "answered" row is one person's answers on one day: it only counts in `answers`, with the answers on booked rows.
 */
export function summarise(rows: BookRow[], days: string[]): BookStats {
  const byDay = new Map(days.map((day) => [day, { day, people: 0, booked: 0 }]));
  const byAd = new Map<string, { name: string; people: number; booked: number }>();
  const totals = { people: 0, booked: 0 };
  const answers = new Map([NOT_SHOPIFY, ...SALES.map((s) => s.label)].map((label) => [label, { label, people: 0, booked: 0 }]));
  for (const r of rows) {
    const d = byDay.get(r.day);
    if (!d) continue;
    const answer = answers.get(answerLabel(r.shopify, r.sales) ?? "");
    if (r.kind === "answered") {
      if (answer) answer.people++;
      continue;
    }
    if (r.kind === "booked" && answer) answer.booked++;
    const name = adName(r);
    let ad = byAd.get(name);
    if (!ad) byAd.set(name, (ad = { name, people: 0, booked: 0 }));
    const key = r.kind === "booked" ? "booked" : "people";
    d[key]++;
    ad[key]++;
    totals[key]++;
  }
  const ads = [...byAd.values()].sort((a, b) => b.people - a.people || b.booked - a.booked || a.name.localeCompare(b.name));
  return { days: [...byDay.values()], ads, totals, answers: [...answers.values()] };
}

/** "12%" of people who booked a call, or "" when nobody came. */
export function bookedRate(people: number, booked: number): string {
  return people ? `${Math.round((booked / people) * 100)}%` : "";
}
