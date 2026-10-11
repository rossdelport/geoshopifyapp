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
export const AI_READY_WEIGHTS = { audience: 20, facts: 20, description: 20, faq: 15, schema: 15, origin: 10 } as const;
export const AI_READY_NOTE =
  "Points for each check passed: who it’s for, key facts and the description are worth 20 each, an FAQ and product data 15 each, and where it ships or is made 10.";

// "for men", "for dry skin", "ideal for", "suits", "suitable for"... The words after "for" must say who.
const AUDIENCE =
  /\b(?:ideal|perfect|great|suitable|designed|made|best|recommended|formulated|created|built|safe) for\b|\bsuits?\b|\bfor (?:(?:all|every|any)\s+(?:skin|hair|ages?|body)|(?:dry|oily|sensitive|combination|normal|mature|acne[- ]prone|curly|fine|thick|coarse|thin|long|short|textured|coloured|colored)\s+(?:skin|hair|beards?|scalps?)|men|women|man|woman|him|her|kids|children|babies|baby|toddlers|teens|adults|boys|girls|mums|dads|dogs|cats|pets|puppies|beginners|runners|athletes|travel(?:lers|ers)?|everyday|daily|everyone|the gym)\b/i;
const SIZE =
  /\b\d+(?:[.,]\d+)?\s?(?:ml|millilitres?|milliliters?|l|litres?|liters?|g|grams?|kg|mg|oz|fl\.? ?oz|lbs?|cm|mm|m|inch(?:es)?|capsules|tablets|caps|serves|servings|pack|pk|pieces|pcs)\b|\bsizes?\b|\bone size\b|\b(?:xs|s|m|l|xl|xxl)\s*[,/|-]\s*(?:s|m|l|xl|xxl)\b/i;
const MATERIAL =
  /\bingredients?\b|\bmaterials?\b|\bfabric\b|\bmade (?:from|with|of)\b|\bformulated with\b|\bcontains\b|\binfused with\b|\b\d{1,3}\s?%\s?[a-z]|\b(?:cotton|linen|wool|merino|silk|bamboo|leather|polyester|nylon|stainless steel|ceramic|glass|timber|wood|oak|beeswax|shea|jojoba|argan|coconut|aloe|vitamin [a-e]|hyaluronic|niacinamide|retinol)\b/i;
// Marketing words that say nothing a shopper (or an AI assistant) could repeat as a fact.
const FLUFF =
  /\b(?:amazing|incredible|ultimate|luxurious|luxury|premium|revolutionary|game[- ]?changer|elevate[sd]?|indulge|unleash|transform(?:s|ative)?|experience|best[- ]ever|world[- ]class|next[- ]level|must[- ]have|iconic|perfect|stunning|epic|magic(?:al)?|unique|innovative|exceptional|unparalleled|superior|exquisite|irresistible)\b/gi;
const PLACES =
  "australia|australian|new zealand|aotearoa|nz|united states|usa|america|united kingdom|uk|britain|england|scotland|wales|ireland|canada|canadian|europe|worldwide|international";
const PLACE = new RegExp(`\\b(?:${PLACES})\\b`, "i");
// "Made in Melbourne", "Grown in Byron Bay": a place, even one we don't list.
const MADE_IN = /\b(?:[Mm]ade|[Dd]esigned|[Pp]roduced|[Mm]anufactured|[Cc]rafted|[Gg]rown|[Bb]ottled|[Pp]rinted|[Ss]ewn) in (?:the )?[A-Z][a-z]+/;
// Shipping words; they only count next to a place ("Free shipping Australia-wide").
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
      ? "The page mentions where it ships or where it’s made, which helps with “in Australia” questions."
      : "We didn’t see where it ships or where it’s made.",
    fix: "Add a line like “Made in Melbourne, ships Australia-wide” (only what’s true).",
  };
}

/** The AI-ready score for one product page. Null when we couldn't read the page itself. */
export function scoreAiReady(i: AiReadyInput): AiReady | null {
  if (!i.signals) return null;
  const checks = [audienceCheck(i), factsCheck(i), descriptionCheck(i), faqCheck(i), schemaCheck(i), originCheck(i)];
  const score = checks.reduce((n, c) => n + (c.pass ? c.weight : 0), 0);
  return { score: Math.max(0, Math.min(100, score)), checks };
}
