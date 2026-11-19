// Website fixes for a local business (Ross, 19 Nov 2026: "this needs to be added now please"). Each week the hub reads
// the business's home page and up to 5 of its other pages and finds what helps Google and AI understand them: a clear
// page title and description, a main heading, business details code (LocalBusiness structured data) and questions and
// answers on the home page. The pure parts, tested in test/site-check.test.ts; lib/site-fixes.server.ts reads the
// pages, writes the new words and saves each fix.

export type SiteFixKind = "title" | "description" | "h1" | "schema" | "faq";
export const SITE_FIX_KINDS: SiteFixKind[] = ["title", "description", "h1", "schema", "faq"];

export const SITE_FIX_WHAT: Record<SiteFixKind, string> = {
  title: "Page title",
  description: "Page description",
  h1: "Main heading",
  schema: "Business details code",
  faq: "Questions and answers",
};

/** Where each fix goes, in words the client can follow. */
export const SITE_FIX_WHERE: Record<SiteFixKind, string> = {
  title: "The page’s SEO title (in WordPress, Yoast or Rank Math; in Squarespace, the page’s SEO settings).",
  description: "The page’s SEO description (the same place as the title).",
  h1: "The biggest heading at the top of the page.",
  schema: "Paste the code into the page’s header code (in Squarespace, Settings, Advanced, Code injection, Header; in WordPress, a header code plugin).",
  faq: "A new section near the bottom of the home page, as headings and short answers.",
};

export interface PageFacts {
  url: string;
  title: string | null;
  description: string | null;
  h1s: string[];
  types: string[]; // structured data types on the page ("LocalBusiness", "FAQPage"...)
  hasFaq: boolean;
  phone: string | null;
  text: string; // the page's words, for writing fixes
}

const decode = (s: string) =>
  s
    .replace(/<[^>]{0,500}>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/** What a page says about itself, read from its HTML. */
export function readPage(html: string, url: string): PageFacts {
  const page = html.slice(0, 600_000);
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(page)?.[1];
  const desc =
    /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(page)?.[1] ??
    /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(page)?.[1];
  const h1s = [...page.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1])).filter(Boolean);
  const types = new Set<string>();
  for (const m of page.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const t of m[1].matchAll(/"@type"\s*:\s*(\[[^\]]*\]|"[^"]+")/g)) {
      for (const one of t[1].matchAll(/"([^"]+)"/g)) types.add(one[1]);
    }
  }
  const headings = [...page.matchAll(/<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/gi)].map((m) => decode(m[1]));
  const hasFaq = types.has("FAQPage") || headings.some((h) => /\b(faqs?|frequently asked|questions)\b/i.test(h));
  const phone = /href=["']tel:([+\d\s().-]{6,20})["']/i.exec(page)?.[1]?.trim() ?? null;
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(page)?.[1] ?? page;
  const text = decode(body.replace(/<(script|style|noscript|svg|nav|footer)\b[\s\S]*?<\/\1>/gi, " ")).slice(0, 6000);
  return { url, title: title ? decode(title) || null : null, description: desc ? decode(desc) || null : null, h1s, types: [...types], hasFaq, phone, text };
}

// schema.org types that say "this is a business" (LocalBusiness and the kinds under it that local clients are).
const BUSINESS_TYPES = new Set([
  "LocalBusiness",
  "ProfessionalService",
  "HomeAndConstructionBusiness",
  "Electrician",
  "Plumber",
  "HVACBusiness",
  "RoofingContractor",
  "GeneralContractor",
  "HousePainter",
  "Locksmith",
  "MovingCompany",
  "FinancialService",
  "InsuranceAgency",
  "RealEstateAgent",
  "LegalService",
  "Attorney",
  "AccountingService",
  "AutomotiveBusiness",
  "AutoRepair",
  "MedicalBusiness",
  "Dentist",
  "HealthAndBeautyBusiness",
  "SportsActivityLocation",
  "Store",
  "FoodEstablishment",
  "Restaurant",
  "ChildCare",
  "DryCleaningOrLaundry",
  "EmergencyService",
  "EntertainmentBusiness",
  "LodgingBusiness",
  "AnimalShelter",
  "TravelAgency",
  "EmploymentAgency",
]);
export const hasBusinessData = (types: string[]) => types.some((t) => BUSINESS_TYPES.has(t));

export interface Problem {
  kind: SiteFixKind;
  before: string | null;
  why: string;
}

/** What to fix on one page. The home page also gets the business details code and questions and answers. */
export function pageProblems(p: PageFacts, o: { home: boolean; area: string | null }): Problem[] {
  const out: Problem[] = [];
  const area = o.area?.trim().toLowerCase();
  if (!p.title) out.push({ kind: "title", before: null, why: "The page has no title. Google and AI show the title first and use it to tell what the page is about." });
  else if (p.title.length > 65) out.push({ kind: "title", before: p.title, why: `The title is ${p.title.length} letters long, so Google cuts it off. About 50 to 60 fits.` });
  else if (p.title.length < 20) out.push({ kind: "title", before: p.title, why: "The title is too short to say what they do and where." });
  else if (o.home && area && !p.title.toLowerCase().includes(area)) out.push({ kind: "title", before: p.title, why: `The title doesn’t say ${o.area}. People ask AI for a business in their town.` });

  if (!p.description) out.push({ kind: "description", before: null, why: "The page has no description, so Google and AI make one up from bits of the page." });
  else if (p.description.length < 70) out.push({ kind: "description", before: p.description, why: "The description is short. A clear sentence or two says what they do, where, and why pick them." });
  else if (p.description.length > 165) out.push({ kind: "description", before: p.description, why: `The description is ${p.description.length} letters long, so Google cuts it off. About 140 to 155 fits.` });

  if (!p.h1s.length) out.push({ kind: "h1", before: null, why: "The page has no main heading. It tells people and AI what the page is about at a glance." });

  if (o.home && !hasBusinessData(p.types)) {
    out.push({ kind: "schema", before: null, why: "The home page has no business details code. It gives Google and AI their name, phone, website and area in a form they read easily." });
  }
  if (o.home && !p.hasFaq) {
    out.push({ kind: "faq", before: null, why: "AI answers questions. Short, true answers to what customers ask give AI words to quote." });
  }
  return out;
}

const SKIP = /\.(?:jpe?g|png|gif|webp|svg|pdf|zip|mp4|mp3|css|js|xml|txt|ico)(?:$|\?)|\/(?:wp-admin|wp-login|cart|checkout|account|login|feed|tag|author|category)\b|privacy|terms|cookie/i;

/** Up to `max` of the website's own pages linked from the home page, in the order they appear (menus first). */
export function pagesToRead(html: string, home: string, max = 5): string[] {
  let origin: URL;
  try {
    origin = new URL(home);
  } catch {
    return [];
  }
  const host = origin.hostname.replace(/^www\./, "");
  const out: string[] = [];
  const seen = new Set([pageKey(origin.href)]);
  for (const m of html.slice(0, 600_000).matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    let u: URL;
    try {
      u = new URL(m[1], origin);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || u.hostname.replace(/^www\./, "") !== host || SKIP.test(u.pathname) || u.search) continue;
    const key = pageKey(u.href);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(`${origin.origin}${u.pathname}`);
    if (out.length >= max) break;
  }
  return out;
}

/** The same page whatever the ending: "https://x.com/about/" and "https://www.x.com/about" match. */
export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/index\.html?$/i, "/").replace(/\/+$/, "") || "/"}`;
  } catch {
    return url;
  }
}

/** The business details code, only from facts we have: the name, website, phone on their page, town, and what they do. */
export function businessSchema(o: { name: string; url: string; phone: string | null; area: string | null; description: string | null }): string {
  const data: Record<string, unknown> = { "@context": "https://schema.org", "@type": "LocalBusiness", name: o.name, url: o.url };
  if (o.phone) data.telephone = o.phone;
  if (o.area) data.areaServed = { "@type": "City", name: o.area };
  if (o.description) data.description = o.description;
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n</script>`;
}

/** Fixes worth keeping: the right length and no dashes as punctuation. Null when the words don't fit the rules. */
export function fixFits(kind: SiteFixKind, after: string): boolean {
  const t = after.trim();
  if (!t) return false;
  if (/[—―]|\s–\s/.test(t)) return false;
  if (kind === "title") return t.length >= 20 && t.length <= 65;
  if (kind === "description") return t.length >= 70 && t.length <= 165;
  if (kind === "h1") return t.length >= 10 && t.length <= 90;
  if (kind === "faq") return /\?/.test(t) && t.length >= 120 && t.length <= 3000;
  return true;
}

/** How many new fixes one weekly read may add: about one a day. */
export const FIXES_PER_WEEK = 7;
