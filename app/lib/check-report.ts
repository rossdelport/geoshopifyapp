// Free product check: turn the 18 answers into the report (score, who AI picks instead,
// which sites it trusts, what to fix first). Pure functions (tested). Tips only use what we saw.

import { visibilityScore, scoreLabel } from "./score";
import { brandKey, sameBrand } from "./match";
import { ENGINE_LABELS } from "./plans";
import { decodeEntities, domainStem, type DescriptionSource } from "./check-read";
import { CHECK_ENGINES, type CheckAnswer, type CheckProduct, type CheckReport } from "./check-types";
import { guessSourceType, type SourceType } from "./sources";

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
    .split(/\s+[\u2013\u2014-]\s+|:\s|\s\(|,\s|\s\|\s/)[0]
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

// ---------- Names that are phrases, not brands ----------

// Words that describe, praise or place a product but never make a brand on their own:
// "Australian Made", "Best Beard Oil Australia", "Pure Organic", "Natural". GENERIC_WORDS adds
// ingredients and product types, and each check adds its own category and product type words.
const PHRASE_WORDS = new Set(
  (
    "best top good great better cheap cheapest affordable budget value premium luxury luxe quality popular " +
    "favourite favorite recommended rated rating award awards winning new original classic ultimate perfect ideal " +
    "essential essentials everyday advanced professional organic natural naturals pure clean certified made " +
    "handmade crafted handcrafted small batch local locally owned independent eco friendly non toxic cruelty " +
    "sustainable brand brands store stores product products range collection collections online buy buying " +
    "guide guides review reviews picks pick list compared comparison vs versus men women man woman kids unisex " +
    "beauty skincare grooming haircare care cosmetics wellness health personal greasy hydrating moisturising " +
    "moisturizing nourishing soothing softening conditioning repair repairing restoring strengthening growth " +
    "thickening anti itch itchy dandruff frizz shine smooth soft gentle mild extra ultra super deep rich lasting " +
    "long fast absorbing intense intensive normal combination mature type types every " +
    "australia australian australians aussie au new zealand nz kiwi aotearoa usa us america american united " +
    "states uk british britain england english scotland scottish wales welsh ireland irish canada canadian " +
    "global international world worldwide"
  ).split(" "),
);
const JOINING_WORDS = new Set(["and", "&", "of", "the", "a", "an", "in", "for", "with", "from", "by", "to", "at", "on", "x", "+"]);
// In a name made only of the words above, these show it is a phrase and not a brand: "Online Store",
// "Australian Made", "Certified Organic", "The Best Brand". Real brands use describing words too
// ("Organic Care", "Cotton On", "Women's Best"), so a describing word alone never drops a name.
const MARKER_WORDS = new Set(
  "rated rating review reviews reviewed guide guides certified brand brands store stores online made buy buying vs versus comparison compared".split(" "),
);
// "Best" and "top" only mark a phrase at the start ("Best Beard Oil", "The Top 5"): "Women's Best" is a brand.
const LEAD_MARKERS = new Set(["best", "top", "cheapest"]);
// "Made in Melbourne", "Proudly made in Australia": where it's made, not who makes it.
const MADE_IN = /^(?:proudly )?(?:made|designed|crafted|grown|owned|sourced) in\b/i;
// Single words that are real brands often enough (Aussie, Kiwi, Global) that the text fallback keeps them.
const BRANDLIKE_WORDS = new Set(["aussie", "kiwi", "global", "cotton", "bamboo"]);
const YEAR = /^(?:19|20)\d{2}$/;
const SIZE = /^\d+(?:[.,]\d+)?(?:ml|l|g|kg|oz|cm|mm)$/;
const COUNT = /^\d{1,3}$/; // "Top 10"; "4711" and "100%" are not counts

/** What we know about one check that helps tell a brand from a phrase. */
export interface BrandFilter {
  category: string; // "beard oil": its words are never a brand on their own
  productType?: string | null; // the shop's own product type, same
  merchantNames?: string[]; // the merchant's names, main brand first: never dropped
  merchantDomains?: string[]; // a name that only repeats the merchant's domain words isn't a brand name
  retailerDomains?: string[]; // shops cited in this answer: a name equal to one is a shop, not a brand
  // The name was read from the answer's text (Claude couldn't read it), not from Claude's brand list or a
  // shopping card. Then any name made only of describing words is dropped, since bold text is often a phrase.
  fromText?: boolean;
}

/** Lowercase letters and digits only: "Chemist Warehouse" and chemistwarehouse.com.au both give "chemistwarehouse". */
const squash = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

const wordsOfName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']s\b/g, "")
    .split(/[\s/-]+/)
    .map((w) => w.replace(/^[^a-z0-9&+]+|[^a-z0-9&+%]+$/g, ""))
    .filter(Boolean);

/**
 * The cited shops a brand name is checked against (see BrandFilter.retailerDomains): only sites our own
 * rules know as retailers or marketplaces. Claude's source types aren't enough here, because the cheap
 * model can call a brand's own shop a "retailer" (it sells a range), and that would hide a real rival.
 */
export function shopDomains(citations: { url: string; domain: string }[]): string[] {
  return citations
    .filter((c) => {
      const t = guessSourceType(c.url, c.domain);
      return t === "retailer" || t === "marketplace";
    })
    .map((c) => c.domain);
}

/**
 * True when a "brand" from an AI answer is really a phrase, a shop or the merchant's domain words.
 * - Always: a shop (Chemist Warehouse, or a retailer the answer cites), the merchant's domain words,
 *   "Made in ..." phrases, and names made only of describing, place, category, size or year words
 *   that also carry a phrase marker ("Best Beard Oil Australia 2026", "Australian Made", "Online Store").
 * - Names read from the text (fromText): also any name made only of describing words ("Pure Organic").
 * A describing word alone never drops a name from Claude's list ("Aussie", "Cotton On", "Women's Best").
 * A name that is one of the merchant's own names is never dropped. Pure (tested).
 */
export function isPhraseBrand(name: string, f: BrandFilter): boolean {
  const n = name.replace(/\s+/g, " ").trim();
  if (n.length < 2) return true;
  const domainKeys = (f.merchantDomains ?? []).map((d) => squash(domainStem(d))).filter((k) => k.length >= 3);
  // The main brand always counts as the merchant; other names only when they aren't just the domain.
  const merchant = (f.merchantNames ?? []).filter((m, i) => m.trim() && (i === 0 || !domainKeys.includes(squash(m))));
  const nameKey = brandKey(n);
  if (nameKey.length >= 2 && merchant.some((m) => brandKey(m) === nameKey)) return false; // "Pure Organic Co." for "Pure Organic Co"

  const words = wordsOfName(n);
  const countryless = words.filter((w) => !/^(australia|au|nz|uk|usa|us)$/.test(w)).join(" ");
  if (RETAILER_NAMES.test(n) || (countryless && RETAILER_NAMES.test(countryless))) return true; // "Amazon AU"
  const key = squash(n);
  if ((f.retailerDomains ?? []).some((d) => squash(domainStem(d)) === key)) return true;
  // "Best Beard Oil Australia" for bestbeardoilaustralia.com.au, unless it is how the brand is written ("Coolabah Grooming").
  if (domainKeys.includes(key)) return !merchant.some((m) => sameBrand(n, m));

  if (MADE_IN.test(n)) return true;

  const own = new Set(wordsOfName(`${f.category} ${f.productType ?? ""}`));
  // The category's main word ("oil" in "beard oil") marks a phrase: "Beard Oil Australia". Not the shop's
  // product type: it is often broad ("Hair Care"), and "Organic Care" is still a brand.
  const head = wordsOfName(f.category).at(-1);
  const heads = new Set(head ? [head] : []);
  const singular = (w: string) => (w.length > 3 ? w.replace(/s$/, "") : w); // "oils" -> "oil"
  const has = (set: Set<string>, w: string) => set.has(w) || set.has(singular(w));
  const generic = (w: string) =>
    JOINING_WORDS.has(w) || has(PHRASE_WORDS, w) || has(GENERIC_WORDS, w) || has(own, w) || YEAR.test(w) || SIZE.test(w) || COUNT.test(w);
  if (!words.length || !words.every(generic)) return false;

  const content = words.filter((w) => !JOINING_WORDS.has(w));
  const marked =
    LEAD_MARKERS.has(content[0] ?? "") ||
    words.some((w) => has(MARKER_WORDS, w) || has(heads, w) || YEAR.test(w) || SIZE.test(w));
  if (marked) return true;
  if (!f.fromText) return false;
  // Text fallback: a phrase of describing words ("Pure Organic") is dropped, and so is one ingredient,
  // material or product word ("Natural", "Jojoba"), but not a word that is often a brand ("Aussie").
  if (content.length > 1) return true;
  const one = content[0] ?? "";
  return !BRANDLIKE_WORDS.has(one) && (has(GENERIC_WORDS, one) || has(own, one));
}

/** The brand list without phrases (see isPhraseBrand), in the same order. */
export function dropPhraseBrands(names: string[], f: BrandFilter): string[] {
  return names.filter((b) => !isPhraseBrand(b, f));
}

// ---------- Answer snippets ----------

// While markdown is stripped, characters the answer escaped ("Oil\.", "\$29.67", "\*") are parked
// in Unicode's private use area, so they stay text. Then they are put back. Link text is wrapped in
// two more private characters (U+E101, U+E102) for a moment, to keep glued links apart.
const PARK = 0xe000;
const PARKED = /[\ue000-\ue07f]/g;
const park = (s: string) => s.replace(/[!-/:-@[-`{-~]/g, (c) => String.fromCharCode(PARK + c.charCodeAt(0)));

/**
 * "A \u2014 B" -> "A, B" (": " right after a list item's name or a short label that starts a sentence,
 * "Best overall \u2014 Milkman. Budget \u2014 Bulldog."), "$20 \u2013 $30" and "30 ml \u2013 50 ml" -> "... to ...".
 * A dash with a space on only one side ("Milkman \u2013light") counts as a spaced dash.
 */
function plainDashes(line: string): string {
  return line
    .replace(/(\S)[\u2013\u2014][ \t]+/g, "$1 \u2013 ")
    .replace(/[ \t]+[\u2013\u2014](?=\S)/g, " \u2013 ")
    .replace(/(\d(?: ?(?:ml|l|g|kg|oz|cm|mm|%))?)\s+[\u2013\u2014]\s+(?=[$\u20ac\u00a3]?\d)/gi, "$1 to ")
    .replace(/^((?:\d{1,3}\. )?[^.,:;!?\u2013\u2014]{1,80}?)\s+[\u2013\u2014]\s+/, "$1: ")
    .replace(/([.!?]\s+)([A-Z][^.,:;!?\u2013\u2014]{0,40}?)\s+[\u2013\u2014]\s+(?=[A-Z0-9$\u20ac\u00a3])/g, "$1$2: ")
    .replace(/\s+[\u2013\u2014]\s+|\s*\u2014\s*/g, ", ");
}

/**
 * First ~700 characters of an answer as plain text, for the report. The AI providers send markdown
 * with escapes ("Oil\.", "\$29.67"), HTML entities ("&amp;") and source links glued together, so:
 * unescape, decode entities, strip markdown (keeping link text), keep sources apart, collapse
 * spaces, then cut at a word with an ellipsis. Line breaks stay (the page shows them).
 */
export function plainSnippet(text: string, max = 700): string {
  const s = text
    .slice(0, max * 8)
    .replace(/[\ue000-\ue07f\ue101\ue102]/g, "")
    // Entities are text: "&amp;" is "&", and "&#42;" is a star, not markdown.
    .replace(/&(?:#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8});/gi, (m) => park(decodeEntities(m)).replace(/[\ue101\ue102]/g, ""))
    .replace(/\\r?\\n/g, "\n") // a literal "\n" from double-encoded JSON
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0\u2000-\u200b\u202f\u3000]+/g, " ")
    .replace(/\\+([!-/:-@[-`{-~])/g, (_, c: string) => park(c))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:b|i|u|em|strong|small|span|p|div|sup|sub|li|ul|ol)\b[^<>]{0,200}>/gi, "")
    .replace(/^ ?\[[^\]\n]+\]: ?<?(?:https?:\/\/|www\.)\S*.*$/gm, "") // reference link definitions (to a URL)
    .replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, "") // images
    .replace(/\[\^?\d{1,3}(?:, ?\d{1,3})*\]\([^)\n]*\)/g, "") // numbered source links: [3](url)
    // Links keep their text, marked so links glued together (or to a word) can be kept apart below.
    .replace(
      /\[([^\]\n]+)\]\((?:[^()\n]|\([^()\n]*\))*\)|\[([^\]\n]*[A-Za-z][^\]\n]*)\]\[[^\]\n]{0,40}\]/g,
      (_, a?: string, b?: string) => `\ue101${a ?? b}\ue102`,
    )
    .replace(/\[\^?\d{1,3}(?:, ?\d{1,3})*\]/g, "") // citation markers: [3], [3, 8], [^1]
    .replace(/\u3010[^\u3011\n]{0,80}\u3011/g, "")
    .replace(/<(https?:\/\/[^\s<>]+)>/g, "$1")
    .replace(/\ue102 ?\ue101/g, ", ") // "[Canstar Blue](..)[Beard Guru](..)" -> "Canstar Blue, Beard Guru"
    .replace(/([^\s(["\u201c\u2018\ue101])\ue101/g, "$1 ") // "dry skin.[Canstar Blue](..)" -> "dry skin. Canstar Blue"
    .replace(/\ue102(?=[A-Za-z0-9])/g, " ")
    .replace(/[\ue101\ue102]/g, "")
    .replace(/([A-Za-z])\+\d{1,2}(?=[ \t]+[A-Z]|[ \t]*$)/gm, "$1") // "Canstar Blue+2" source chips, not "Omega+3 oils"
    .replace(/([a-z)][.!?])(?=[A-Z][a-z])/g, "$1 ") // "dry skin.Canstar Blue"
    .replace(/\( ?\)/g, "")
    .replace(/^ ?\|? ?:?-{2,}:? ?(?:\| ?:?-{2,}:? ?)*\|? ?$/gm, "") // table rule rows
    .replace(/^ ?\|(.*?)\|? ?$/gm, (_, row: string) => row.split("|").map((c) => c.trim()).filter(Boolean).join(", ")) // table rows
    .replace(/^ ?(?:([-*_])(?: ?\1){2,}|={3,}) ?$/gm, "") // horizontal rules
    .replace(/^ ?(?:> ?)+/gm, "") // quotes
    .replace(/^ ?#{1,6}(?: (.*?))?(?: #+)? ?$/gm, "$1") // headings ("#1 pick" is not one)
    .replace(/^ ?[-*+\u2022] /gm, "") // bullets
    .replace(/^ ?(\d{1,3})[.)] /gm, "$1. ") // numbered items keep their number
    .replace(/\*\*|__|~~|`/g, "")
    .replace(/(^|[^\p{L}\p{N}*_])[*_](?=\S)([^*_\n]*?\S)[*_](?![\p{L}\p{N}*_])/gmu, "$1$2"); // *one* _word_

  const plain = s
    .replace(PARKED, (c) => String.fromCharCode(c.charCodeAt(0) - PARK))
    .split("\n")
    .map((line) => plainDashes(line.trim()).replace(/^\d{1,3}\.$/, "")) // a list number left with nothing after it
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max + 1);
  const atWord = /\s/.test(cut) ? cut.replace(/\s+\S*$/, "") : plain.slice(0, max);
  return `${atWord.replace(/[\s,;:\u2013\u2014-]+$/, "")}\u2026`;
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
    label: scoreLabel(score, namedCount > 0).label,
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
  if (!r.answerCount) return "We couldn’t get answers from the AI assistants this time.";
  const top = r.competitors[0];
  if (!r.namedCount) {
    return top
      ? `Shoppers asking these questions were pointed to other brands instead, most often ${top.name}.`
      : "AI didn’t recommend any brand by name for these questions.";
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
      title: `AI doesn’t mention ${brand} yet`,
      body: `None of the ${r.answerCount} answers named ${brand}. AI assistants mostly recommend brands that review sites, retailers and forums already talk about, and whose product pages spell out clear facts.`,
    });
  } else {
    const missing = CHECK_ENGINES.filter((e) => r.byEngine[e].total > 0 && r.byEngine[e].named === 0).map((e) => ENGINE_LABELS[e]);
    if (missing.length && missing.length < CHECK_ENGINES.length) {
      tips.push({
        title: `${list(missing)} ${missing.length > 1 ? "don’t" : "doesn’t"} mention you yet`,
        body: `You were named on some AI assistants but not on ${list(missing)}. Each one reads different sites. The more places mention you, the more of them can find you.`,
      });
    }
  }

  // Only judge the description's length when we read the real one (Shopify's JSON or the page's product data).
  const desc = product.description.trim();
  if (!desc) {
    tips.push({
      title: "Add a product description",
      body: "We couldn’t find a description on this page. AI assistants need facts to repeat: who it’s for, what it’s made of, the size and how to use it.",
    });
  } else if (opts.descriptionSource === "meta") {
    tips.push({
      title: "Add a full product description",
      body: "We couldn’t find a full product description in the page’s data, only a short summary. Say who it’s for, what it’s made of, the size and how to use it, so AI has facts to repeat.",
    });
  } else if (desc.length < 300) {
    tips.push({
      title: "Write a fuller product description",
      body: `Your description is only ${desc.length} characters. Say who it’s for, what it’s made of, the size and how to use it, so AI has facts to repeat.`,
    });
  }

  if (!product.hasProductSchema && opts.pageRead !== false) {
    tips.push({
      title: "Add product data AI can read",
      body: "We didn’t find structured product data (name, brand, price) on the page we read. Shopping assistants read this behind-the-scenes data.",
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
      body: `AI cited ${editorial.length > 1 ? "these review and roundup sites" : "this review site"} ${uses} ${uses === 1 ? "time" : "times"} in these answers. Getting your product into articles like these can help AI find you.`,
    });
  }

  // Only brands that came up more than once, so a one-off (or a misread) isn't named.
  const rivals = r.competitors.filter((c) => c.count >= 2).slice(0, 3).map((c) => c.name);
  if (rivals.length) {
    tips.push({
      title: `See why AI picks ${list(rivals)}`,
      body: `${rivals.length > 1 ? "These brands came" : "This brand came"} up most. Compare their product pages with yours: AI often repeats the details they give, like who it’s for, sizes and materials.`,
    });
  }

  const extras = [
    {
      title: "Keep an eye on it every week",
      body: "AI answers change often. Tracking the same questions every week shows whether you’re gaining or slipping, and what to fix next.",
    },
    {
      title: "Check more of the questions shoppers ask",
      body: "This quick check used 3 questions. Shoppers ask AI many more, and you may be missing from some of them.",
    },
  ];
  while (tips.length < 2 && extras.length) tips.push(extras.shift()!);
  return tips.slice(0, 4);
}
