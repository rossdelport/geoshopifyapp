// Free product check: turn the 18 answers into the report (score, who AI picks instead,
// which sites it trusts, quick wins). Pure functions (tested). Tips only use what we saw.

import { visibilityScore, scoreLabel } from "./score";
import { sameBrand } from "./match";
import { ENGINE_LABELS } from "./plans";
import { domainStem, type DescriptionSource } from "./check-read";
import { CHECK_ENGINES, type CheckAnswer, type CheckProduct, type CheckReport } from "./check-types";
import type { SourceType } from "./sources";

// ---------- Brands when Claude can't read the answer ----------

const NOT_A_BRAND =
  /^(best|top|why|what|how|when|where|which|who|key|pros|cons|price|prices|pricing|cost|tips?|note|notes|summary|bottom line|overall|verdict|conclusion|ingredients?|features?|benefits?|considerations?|look for|budget|premium|value|option|options|choice|pick|winner|runner|recommendations?|alternatives?|availability|available|in short|tl;?dr|final|quick|also|other|honou?rable|great|good|ideal|perfect|for|if|skin|hair|size|scent|texture|application|usage|how to|step|important|warning|caution|disclaimer|sources?)\b/i;

// Shops, not brands (Claude leaves these out; the text fallback has to as well).
const RETAILER_NAMES =
  /^(amazon|ebay|chemist warehouse|priceline|big ?w|myer|david jones|shaver shop|mecca|sephora|adore beauty|target|kmart|woolworths|coles|walmart|ulta|boots|catch|kogan|the iconic|costco|bunnings|jb hi-?fi|harvey norman|terrywhite|lookfantastic|etsy|temu|google|reddit|youtube|tiktok)$/i;

// Ingredients, materials and plain describing words. A "name" made only of these (and the
// category's own words) is a product type, not a brand: "Jojoba Oil", "Fragrance Free", "Vitamin E".
const GENERIC_WORDS = new Set(
  (
    "oil oils blend blends free butter extract essential natural organic pure vegan vitamin vitamins jojoba argan shea " +
    "aloe vera coconut almond avocado hemp castor olive grapeseed rosehip squalane hyaluronic acid retinol niacinamide " +
    "ceramide ceramides peptide peptides collagen zinc salicylic glycolic tea tree sandalwood cedarwood cedar vanilla " +
    "lavender peppermint eucalyptus citrus rose bergamot musk fragrance unscented scented scent cotton linen merino wool " +
    "silk bamboo leather beeswax wax balm cream serum lotion gel spray wash shampoo conditioner cleanser toner " +
    "moisturiser moisturizer sunscreen spf soap powder mask scrub kit set pack gift sensitive dry oily daily light " +
    "lightweight men's mens women's womens beard hair skin face body sulfate paraben non-greasy"
  ).split(" "),
);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function cleanName(raw: string, category: string): string | null {
  let n = raw
    .slice(0, 200)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .split(/\s+[–—-]\s+|:\s|\s\(|,\s|\s\|\s/)[0]
    .replace(/[:.,;!?)\s]+$/, "")
    .trim();
  const cat = category.trim();
  if (cat.length >= 3) {
    // "Milkman Beard Oil 50ml" -> "Milkman" (keep the brand, not the product line).
    const m = n.match(new RegExp(`^(.+?)\\s+(?:\\S+\\s+)?${escapeRe(cat)}\\b`, "i"));
    if (m && m[1].trim().length >= 2) n = m[1].trim();
  }
  if (n.length < 2 || n.length > 40 || n.split(/\s+/).length > 5 || n.toLowerCase() === cat.toLowerCase()) return null;
  if (!/^[A-Z0-9]/.test(n) || NOT_A_BRAND.test(n) || RETAILER_NAMES.test(n)) return null;
  // Brands are written in Title Case; "Argan oil" or "Choose a scent-free one" are not brands.
  const words = n.split(/\s+/).filter((w) => /^[a-z]/i.test(w) && !/^(and|of|the|de|by|for|x|&)$/i.test(w));
  if (words.some((w) => !/^[A-Z]/.test(w))) return null;
  // "Jojoba Oil", "Vitamin E", or ending in what the product is ("Hydrating Serum" for "face serum").
  const catWords = cat.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = n.toLowerCase().split(/\s+/);
  if (lower.every((w) => w.length <= 1 || GENERIC_WORDS.has(w) || catWords.includes(w))) return null;
  if (catWords.length && lower.length > 1 && lower[lower.length - 1] === catWords[catWords.length - 1]) return null;
  return n;
}

/** Names from **bold** text and the start of numbered/bulleted list items, in order (max 8). */
export function extractListBrands(text: string, category = ""): string[] {
  const found: { name: string; at: number }[] = [];
  for (const m of text.matchAll(/\*\*([^*\n]{2,80})\*\*(:?)/g)) {
    if (m[2] || /:$/.test(m[1].trim())) continue; // "**Best for dry skin:**" is a heading
    const name = cleanName(m[1], category);
    if (name) found.push({ name, at: m.index ?? 0 });
  }
  for (const m of text.matchAll(/^[ \t]*(?:\d+[.)]|[-*•])[ \t]+(.+)$/gm)) {
    const name = cleanName(m[1], category);
    if (name) found.push({ name, at: m.index ?? 0 });
  }
  const out: string[] = [];
  for (const f of found.sort((a, b) => a.at - b.at)) {
    if (!out.some((o) => sameBrand(o, f.name) || o.toLowerCase() === f.name.toLowerCase())) out.push(f.name);
  }
  return out.slice(0, 8);
}

/**
 * Brands for one answer that Claude couldn't read: the shopping-card brands, or (when those are only
 * the merchant or none) the bold and list names from the text, so competitors still show.
 */
export function brandsWithFallback(parsed: string[], text: string, merchantNames: string[], category: string): string[] {
  const isMerchant = (b: string) => merchantNames.some((m) => sameBrand(b, m));
  if (parsed.some((b) => !isMerchant(b))) return parsed;
  const out = extractListBrands(text, category);
  for (const b of parsed) if (!out.some((o) => sameBrand(o, b))) out.push(b);
  return out;
}

/** First ~700 characters of an answer as plain text (markdown links, bold and headings removed). */
export function plainSnippet(text: string, max = 700): string {
  const plain = text
    .slice(0, max * 8)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/^[ \t]*#{1,6}[ \t]*/gm, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return plain.length > max ? `${plain.slice(0, max).replace(/\s+\S*$/, "")}…` : plain;
}

// ---------- The report ----------

type ReportProduct = Pick<CheckProduct, "brand" | "domain" | "description" | "hasProductSchema">;

/** What we know about how the check went, beyond the answers (none of it is shown as is). */
export interface ReportOptions {
  descriptionSource?: DescriptionSource; // "meta" = we only found the short og/meta summary
  pageRead?: boolean; // false when we only read Shopify's product JSON, not the page itself
  textFallback?: boolean; // some answers were read by text matching because Claude couldn't read them
}

const FALLBACK_NOTE =
  "We read some answers with simple text matching, so a few names in the brand list may be product types rather than brands.";

const list = (items: string[]) =>
  items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export function buildReport(
  answers: CheckAnswer[],
  product: ReportProduct,
  merchantNames: string[] = [],
  opts: ReportOptions = {},
): CheckReport {
  const names = [product.brand, ...merchantNames].filter(Boolean);
  const isMerchant = (b: string) => names.some((n) => sameBrand(b, n));
  const back = answers.filter((a) => a.ok && !a.empty);
  const answerCount = back.length;
  const namedCount = back.filter((a) => a.named).length;

  const scored = visibilityScore(
    back.map((a) => ({ engine: a.engine, mentioned: a.named, position: a.position, cited: a.sources.some((s) => s.isOwn) })),
  );
  const byEngine = Object.fromEntries(
    CHECK_ENGINES.map((e) => {
      const mine = back.filter((a) => a.engine === e);
      return [e, { named: mine.filter((a) => a.named).length, total: mine.length, score: scored.byEngine[e] ?? 0 }];
    }),
  ) as CheckReport["byEngine"];

  // Who AI recommends instead: each brand counts once per answer.
  const brandCounts: { name: string; count: number; first: number }[] = [];
  back.forEach((a, i) => {
    const seen: string[] = [];
    for (const b of a.brands) {
      if (isMerchant(b) || seen.some((s) => sameBrand(s, b))) continue;
      seen.push(b);
      const hit = brandCounts.find((c) => sameBrand(c.name, b));
      if (hit) hit.count++;
      else brandCounts.push({ name: b, count: 1, first: i });
    }
  });
  // Text matching can mistake a product type for a brand once; a real brand usually comes up again.
  const minCount = opts.textFallback ? 2 : 1;
  const competitors = brandCounts
    .filter((c) => c.count >= minCount)
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, 6)
    .map((c) => ({ name: c.name, count: c.count, share: answerCount ? Math.round((c.count / answerCount) * 100) / 100 : 0 }));

  // Sites AI trusts: each domain counts once per answer.
  const siteCounts = new Map<string, { domain: string; type: SourceType; count: number; isOwn: boolean; exampleUrl: string }>();
  for (const a of back) {
    const seen = new Set<string>();
    for (const s of a.sources) {
      if (!s.domain || seen.has(s.domain)) continue;
      seen.add(s.domain);
      const hit = siteCounts.get(s.domain);
      if (hit) {
        hit.count++;
        hit.isOwn ||= s.isOwn;
      } else siteCounts.set(s.domain, { domain: s.domain, type: s.type, count: 1, isOwn: s.isOwn, exampleUrl: s.url });
    }
  }
  const sources = [...siteCounts.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  const score = answerCount ? scored.score : 0;
  const report: Omit<CheckReport, "tips" | "summary"> = {
    score,
    label: scoreLabel(score).label,
    namedCount,
    answerCount,
    byEngine,
    competitors,
    sources,
  };
  const rivalNames = brandCounts.map((c) => c.name);
  const summary = buildSummary(report, product);
  return {
    ...report,
    tips: buildTips(report, product, [...siteCounts.values()], rivalNames, opts),
    summary: opts.textFallback && answerCount ? `${summary} ${FALLBACK_NOTE}` : summary,
  };
}

// Shown under the "AI named X in N of M answers" heading, so it adds to that line instead of repeating it.
function buildSummary(r: Omit<CheckReport, "tips" | "summary">, product: ReportProduct): string {
  if (!r.answerCount) return "We couldn't get answers from the AI assistants this time.";
  const top = r.competitors[0];
  if (!r.namedCount) {
    return top
      ? `Shoppers asking these questions were pointed to other brands instead, most often ${top.name}.`
      : "AI didn't recommend any brand by name for these questions.";
  }
  const best = CHECK_ENGINES.filter((e) => r.byEngine[e].total).sort((a, b) => r.byEngine[b].score - r.byEngine[a].score)[0];
  const where =
    best && r.namedCount < r.answerCount
      ? `${product.brand} came up most on ${ENGINE_LABELS[best]}.`
      : `${product.brand} came up in every answer.`;
  if (!top) return where;
  return top.count > r.namedCount
    ? `${where} ${top.name} was named more often, in ${top.count} answers.`
    : `${where} No other brand was named more often.`;
}

function buildTips(
  r: Omit<CheckReport, "tips" | "summary">,
  product: ReportProduct,
  sites: { domain: string; type: SourceType; count: number; isOwn: boolean }[],
  rivalNames: string[],
  opts: ReportOptions,
): CheckReport["tips"] {
  const tips: CheckReport["tips"] = [];
  const brand = product.brand;

  if (r.answerCount && !r.namedCount) {
    tips.push({
      title: `AI doesn't mention ${brand} yet`,
      body: `None of the ${r.answerCount} answers named ${brand}. AI assistants tend to name brands that review sites, retailers and forums already mention, and whose product pages give clear facts.`,
    });
  } else {
    const missing = CHECK_ENGINES.filter((e) => r.byEngine[e].total > 0 && r.byEngine[e].named === 0).map((e) => ENGINE_LABELS[e]);
    if (missing.length && missing.length < CHECK_ENGINES.length) {
      tips.push({
        title: `${list(missing)} ${missing.length > 1 ? "don't" : "doesn't"} mention you yet`,
        body: `You were named on some AI assistants but not on ${list(missing)}. Each one reads different sites, so being listed in more places helps you show up everywhere.`,
      });
    }
  }

  // Only judge the description's length when we read the real one (Shopify's JSON or the page's product data).
  const desc = product.description.trim();
  if (!desc) {
    tips.push({
      title: "Add a product description",
      body: "We couldn't find a description on this page. AI assistants need facts to repeat: who it's for, what it's made of, sizes and how to use it.",
    });
  } else if (opts.descriptionSource === "meta") {
    tips.push({
      title: "Add a full product description",
      body: "We couldn't find a full product description in the page's data, only a short summary. Say who it's for, what it's made of, sizes and how to use it, so AI has facts to repeat.",
    });
  } else if (desc.length < 300) {
    tips.push({
      title: "Write a fuller product description",
      body: `Your description is only ${desc.length} characters. Say who it's for, what it's made of, sizes and how to use it, so AI has facts to repeat.`,
    });
  }

  if (!product.hasProductSchema && opts.pageRead !== false) {
    tips.push({
      title: "Add product data AI can read",
      body: "We didn't find structured product data (name, brand, price) on the page we read. Shopping assistants can read this data.",
    });
  }

  // Review and roundup sites, but not a competitor's own blog (you can't get featured there).
  const rivalSite = (domain: string) => rivalNames.some((n) => sameBrand(domainStem(domain), n));
  const editorial = sites
    .filter((s) => s.type === "editorial" && !s.isOwn && !rivalSite(s.domain))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  if (editorial.length) {
    const uses = editorial.reduce((n, s) => n + s.count, 0);
    tips.push({
      title: `Get featured on ${list(editorial.map((s) => s.domain))}`,
      body: `AI used ${editorial.length > 1 ? "these review and roundup sites" : "this review site"} ${uses} ${uses === 1 ? "time" : "times"} when choosing what to recommend. Getting your product into articles like these often helps brands get named.`,
    });
  }

  // Only brands that came up more than once, so a one-off (or a misread) isn't named.
  const rivals = r.competitors.filter((c) => c.count >= 2).slice(0, 3).map((c) => c.name);
  if (rivals.length) {
    tips.push({
      title: `See why AI picks ${list(rivals)}`,
      body: `${rivals.length > 1 ? "These brands came" : "This brand came"} up most. Compare their product pages with yours: AI often repeats the details they give, like who it's for, sizes and materials.`,
    });
  }

  const extras = [
    {
      title: "Keep an eye on it every week",
      body: "AI answers change often. Tracking the same questions every week shows whether you're winning or slipping, and what to fix next.",
    },
    {
      title: "Check more of the questions shoppers ask",
      body: "This quick check used 3 questions. Shoppers ask AI many more, and you may be missing from some of them.",
    },
  ];
  while (tips.length < 2 && extras.length) tips.push(extras.shift()!);
  return tips.slice(0, 4);
}
