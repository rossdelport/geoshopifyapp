// Free product check: "Is your page easy for AI to quote?" Pure (tested), no network.
// Scores the product page from what the check already read (Shopify's product JSON, the page's JSON-LD
// and its visible text). Each check is pass or fail with a plain reason and a short "how to fix".
// Score = the points of the checks that passed (weights below add up to 100).

import type { AiPageSignals, DescriptionSource } from "./check-read";
import type { AiReady, AiReadyCheck } from "./check-types";

export interface AiReadyInput {
  title: string;
  description: string; // plain text (the full one when we found it, else the short meta summary)
  descriptionSource: DescriptionSource; // "meta" = only the short summary
  tags: string[];
  productType: string | null;
  price: string | null; // from any source (Shopify JSON, JSON-LD or meta tags)
  ldFacts: { brand: boolean; price: boolean; availability: boolean } | null; // null = no JSON-LD Product
  signals: AiPageSignals | null; // null = we couldn't read the HTML page
}

/** Points per check. Shown in one line under the card. */
export const AI_READY_WEIGHTS = { audience: 15, facts: 15, top: 15, description: 15, faq: 15, schema: 15, origin: 10 } as const;

// How the points line names each check.
const NOTE_NAMES: Record<string, string> = {
  audience: "who it’s for",
  facts: "key facts",
  top: "key facts near the top",
  description: "the description",
  faq: "an FAQ",
  schema: "product data",
  origin: "where it ships or is made",
};

const andList = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * The points line for a report's own checks, so an older report (six checks, 20/20/20/15/15/10) still
 * explains its own score: "Points for each check passed: who it’s for, key facts and the description are
 * worth 20 each, an FAQ and product data 15 each, and where it ships or is made 10."
 */
export function aiReadyNote(checks: { id: string; weight: number }[]): string {
  const groups = new Map<number, string[]>();
  for (const c of checks) {
    const name = NOTE_NAMES[c.id];
    if (!name || !Number.isFinite(c.weight)) return AI_READY_NOTE;
    groups.set(c.weight, [...(groups.get(c.weight) ?? []), name]);
  }
  if (!groups.size) return AI_READY_NOTE;
  const parts = [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([w, names], i) => `${andList(names)} ${i === 0 ? (names.length > 1 ? "are worth " : "is worth ") : ""}${w}${names.length > 1 ? " each" : ""}`);
  const line = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return `Points for each check passed: ${line}.`;
}

export const AI_READY_NOTE =
  "Points for each check passed: who it’s for, key facts, key facts near the top, the description, an FAQ and product data are worth 15 each, and where it ships or is made 10.";

// Common English words that are not also common words in the other languages our stores write in.
const ENGLISH_WORDS = /\b(?:the|and|for|with|your|you|this|that|from|our|it|its|are)\b/gi;

/**
 * Is this text (or HTML) English? The answer-first check reads English phrases ("for dry skin", "made
 * with"), so it's only run on English descriptions. Too little text to tell counts as English.
 */
export function looksEnglish(text: string): boolean {
  const sample = text.slice(0, 5_000).replace(/<[^>]{0,500}>/g, " ").replace(/&[a-z]+;/gi, " ");
  const words = sample.match(/\p{L}+/gu) ?? [];
  if (words.length < 12) return true;
  return (sample.match(ENGLISH_WORDS) ?? []).length / words.length >= 0.06;
}

// "for men", "for dry skin", "ideal for", "suits", "suitable for"... The words after "for" must say who.
export const AUDIENCE =
  /\b(?:ideal|perfect|great|suitable|designed|made|best|recommended|formulated|created|built|safe) for\b|\bsuits?\b|\bfor (?:(?:all|every|any)\s+(?:skin|hair|ages?|body)|(?:dry|oily|sensitive|combination|normal|mature|acne[- ]prone|curly|fine|thick|coarse|thin|long|short|textured|coloured|colored)\s+(?:skin|hair|beards?|scalps?)|men|women|man|woman|him|her|kids|children|babies|baby|toddlers|teens|adults|boys|girls|mums|moms|mothers|dads|fathers|parents|dogs|cats|pets|puppies|beginners|runners|athletes|travel(?:lers|ers)?|everyday|daily|everyone|the gym)\b/i;
export const SIZE =
  /\b\d+(?:[.,]\d+)?\s?(?:ml|millilitres?|milliliters?|l|litres?|liters?|g|grams?|kg|mg|oz|fl\.? ?oz|lbs?|cm|mm|m|inch(?:es)?|capsules|tablets|caps|serves|servings|pack|pk|pieces|pcs)\b|\bsizes?\b|\bone size\b|\b(?:xs|s|m|l|xl|xxl)\s*[,/|-]\s*(?:s|m|l|xl|xxl)\b/i;
export const MATERIAL =
  /\bingredients?\b|\bmaterials?\b|\bfabric\b|\bmade (?:from|with|of)\b|\bformulated with\b|\bcontains\b|\binfused with\b|\b\d{1,3}\s?%\s?[a-z]|\b(?:cotton|linen|wool|merino|silk|bamboo|leather|polyester|nylon|stainless steel|ceramic|glass|timber|wood|oak|beeswax|shea|jojoba|argan|coconut|aloe|vitamin [a-e]|hyaluronic|niacinamide|retinol)\b/i;
// Marketing words that say nothing a shopper (or an AI assistant) could repeat as a fact.
const FLUFF =
  /\b(?:amazing|incredible|ultimate|luxurious|luxury|premium|revolutionary|game[- ]?changer|elevate[sd]?|indulge|unleash|transform(?:s|ative)?|experience|best[- ]ever|world[- ]class|next[- ]level|must[- ]have|iconic|perfect|stunning|epic|magic(?:al)?|unique|innovative|exceptional|unparalleled|superior|exquisite|irresistible)\b/gi;
// Countries and regions, written as nouns: adjectives like "French" or "German" are often ingredient names
// ("German chamomile"), and some countries are also product words (china, turkey, jersey), so they're left out.
const PLACES =
  "united states|usa|america|north america|canada|canadian|mexico|united kingdom|uk|britain|england|scotland|wales|ireland|" +
  "europe|european union|eu|germany|france|italy|spain|portugal|netherlands|belgium|switzerland|austria|sweden|denmark|norway|finland|" +
  "australia|australian|new zealand|aotearoa|nz|japan|korea|south korea|singapore|malaysia|hong kong|india|south africa|uae|dubai|" +
  "worldwide|international|internationally|globally|nationwide";
const PLACE = new RegExp(`\\b(?:${PLACES})\\b`, "i");
// "Made in Portland", "Grown in Kerala": a place, even one we don't list.
const MADE_IN = /\b(?:[Mm]ade|[Dd]esigned|[Pp]roduced|[Mm]anufactured|[Cc]rafted|[Gg]rown|[Bb]ottled|[Pp]rinted|[Ss]ewn) in (?:the )?[A-Z][a-z]+/;
// Shipping words; they only count next to a place ("Free shipping UK-wide", "Ships worldwide").
const SHIPS = /\b(?:ships?|shipping|delivery|delivers?|dispatch(?:es|ed)?|postage|sent from)\b/i;

const MIN_DESCRIPTION = 300;
const MAX_FLUFF_SHARE = 0.06; // fluff words per word

/** Text that is about the product itself (not the shop's menus and banners). */
const productText = (i: AiReadyInput) => [i.title, i.productType ?? "", i.tags.join(" "), i.description].join(" \n ");

function audienceCheck(i: AiReadyInput): AiReadyCheck {
  const pass = AUDIENCE.test(productText(i));
  return {
    id: "audience",
    label: "Says who it’s for",
    pass,
    weight: AI_READY_WEIGHTS.audience,
    reason: pass
      ? "The product text says who it suits, so AI can match it to a shopper’s question."
      : "We couldn’t find who it’s for (like “for dry skin” or “ideal for beginners”).",
    fix: "Add one plain line on who it suits, such as “For men with dry skin” or “Ideal for everyday use”.",
  };
}

function factsCheck(i: AiReadyInput): AiReadyCheck {
  const text = productText(i);
  const found = { size: SIZE.test(text), materials: MATERIAL.test(text), price: Boolean(i.price) };
  const names = { size: "the size or weight", materials: "ingredients or materials", price: "the price" };
  const have = (Object.keys(found) as (keyof typeof found)[]).filter((k) => found[k]);
  const missing = (Object.keys(found) as (keyof typeof found)[]).filter((k) => !found[k]);
  const pass = have.length >= 2;
  const list = (ks: (keyof typeof found)[]) => ks.map((k) => names[k]).join(" and ");
  return {
    id: "facts",
    label: "Key facts are there",
    pass,
    weight: AI_READY_WEIGHTS.facts,
    reason: !missing.length
      ? "We found the size, what it’s made of and the price."
      : have.length
        ? `We found ${list(have)}, but not ${list(missing)}.`
        : "We couldn’t find the size, what it’s made of or the price.",
    fix: "State the size or weight, the main ingredients or materials, and the price in the description.",
  };
}

const LEAD_MIN = 300;
const LEAD_MAX = 450;

/**
 * The top of a description, the part AI tends to quote first: its first two sentences, or its first
 * 300 characters if that's longer (never more than 450). Plain text in; HTML is stripped.
 */
export function leadText(description: string): string {
  const text = description
    .replace(/<[^>]{0,500}>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  const parts = text.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ");
  const lead = parts.length >= LEAD_MIN ? parts : text.slice(0, LEAD_MIN);
  return lead.slice(0, LEAD_MAX);
}

/** Do the first lines say who it's for and give a key fact (size, ingredients or materials)? Price doesn't count: the page shows it anyway. */
export function keyFactsNearTop(description: string): { audience: boolean; facts: boolean; pass: boolean } {
  const lead = leadText(description);
  const audience = AUDIENCE.test(lead);
  const facts = SIZE.test(lead) || MATERIAL.test(lead);
  return { audience, facts, pass: audience && facts };
}

function topCheck(i: AiReadyInput): AiReadyCheck {
  const d = i.description.trim();
  const t = keyFactsNearTop(d);
  return {
    id: "top",
    label: "Key facts near the top",
    pass: Boolean(d) && t.pass,
    weight: AI_READY_WEIGHTS.top,
    reason: !d
      ? "We couldn’t find a description to check."
      : t.pass
        ? "The first lines say who it’s for and give key facts, the part AI tends to quote first."
        : !t.audience && !t.facts
          ? "The first lines of the description don’t say who it’s for or give key facts like the size or what it’s made of."
          : !t.audience
            ? "The first lines give facts but don’t say who it’s for."
            : "The first lines say who it’s for but not the size or what it’s made of.",
    fix: "Start the description with one or two sentences that say what it is, who it’s for and its key facts (size, main ingredients or materials). Keep the brand story for later.",
  };
}

function faqCheck(i: AiReadyInput): AiReadyCheck {
  const s = i.signals;
  const questionsInText = (i.description.match(/\?/g) ?? []).length >= 3;
  const pass = Boolean(s && (s.faqSchema || s.faqHeading || s.questionHeadings >= 3)) || questionsInText;
  return {
    id: "faq",
    label: "Has questions and answers",
    pass,
    weight: AI_READY_WEIGHTS.faq,
    reason: pass
      ? s?.faqSchema
        ? "The page has FAQ data that AI can read and quote."
        : "The page answers common questions, which AI can quote directly."
      : "We didn’t find an FAQ or questions and answers on the page.",
    fix: "Add 4 to 6 short questions shoppers ask (size, use, shipping, who it suits) with plain answers.",
  };
}

function descriptionCheck(i: AiReadyInput): AiReadyCheck {
  const d = i.description.trim();
  const words = d.split(/\s+/).filter(Boolean).length;
  const fluff = (d.match(FLUFF) ?? []).length;
  const fluffy = words > 0 && fluff / words > MAX_FLUFF_SHARE;
  const short = i.descriptionSource === "meta" || d.length < MIN_DESCRIPTION;
  const pass = Boolean(d) && !short && !fluffy;
  return {
    id: "description",
    label: "Description is specific",
    pass,
    weight: AI_READY_WEIGHTS.description,
    reason: !d
      ? "We couldn’t find a product description."
      : i.descriptionSource === "meta"
        ? "We only found a short summary, not a full description."
        : d.length < MIN_DESCRIPTION
          ? `The description is only ${d.length} characters.`
          : fluffy
            ? "The description is long, but much of it is praise words rather than facts."
            : "The description is long and specific enough to quote.",
    fix: "Write at least a short paragraph of plain facts: what it is, who it’s for, what’s in it and how to use it.",
  };
}

function schemaCheck(i: AiReadyInput): AiReadyCheck {
  const f = i.ldFacts;
  const missing = f
    ? [!f.brand && "brand", !f.price && "price", !f.availability && "stock status"].filter((x): x is string => Boolean(x))
    : [];
  const pass = Boolean(f) && !missing.length;
  return {
    id: "schema",
    label: "Product data AI can read",
    pass,
    weight: AI_READY_WEIGHTS.schema,
    reason: !f
      ? "We didn’t find structured product data on the page."
      : missing.length
        ? `The page’s product data is missing the ${missing.join(" and ")}.`
        : "The page’s product data includes the brand, price and stock status.",
    fix: "Use a theme or app that adds product data (brand, price and stock status) to every product page.",
  };
}

function originCheck(i: AiReadyInput): AiReadyCheck {
  const product = productText(i);
  const pageText = i.signals?.text ?? "";
  // "Made in <place>" or a country in the product text, or shipping words and a country on the page.
  const pass = MADE_IN.test(product) || PLACE.test(product) || MADE_IN.test(pageText) || (PLACE.test(pageText) && SHIPS.test(pageText));
  return {
    id: "origin",
    label: "Says where it ships or is made",
    pass,
    weight: AI_READY_WEIGHTS.origin,
    reason: pass
      ? "The page mentions where it ships or where it’s made, which helps with questions that name a country."
      : "We didn’t see where it ships or where it’s made.",
    fix: "Add one true line on where it’s made and where you ship, like “Made in [your town], ships worldwide”.",
  };
}

/** The AI-ready score for one product page. Null when we couldn't read the page itself. */
export function scoreAiReady(i: AiReadyInput): AiReady | null {
  if (!i.signals) return null;
  const checks = [audienceCheck(i), factsCheck(i), topCheck(i), descriptionCheck(i), faqCheck(i), schemaCheck(i), originCheck(i)];
  const score = checks.reduce((n, c) => n + (c.pass ? c.weight : 0), 0);
  return { score: Math.max(0, Math.min(100, score)), checks };
}
