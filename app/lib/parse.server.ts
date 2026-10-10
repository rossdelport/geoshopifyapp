// Read one AI answer: which brands it recommends (in order), is the merchant one of them,
// and what kind of sites it used as sources.

import { z } from "zod";
import { oneOf, pick } from "./oneof";
import { askJson, aiConfigured } from "./ai.server";
import { domainOf, type EngineAnswer } from "./answers";
import { guessSourceType, type SourceType } from "./sources";
import { merchantPosition, sameBrand, sourcesIncludeDomain, textNamesBrand, textNamesShortBrand } from "./match";

export interface MerchantContext {
  shopId: string | null; // null for the public free check (no shop yet)
  brandNames: string[]; // brand name + aliases
  domains: string[]; // primary domain + myshopify domain
  productTitles: string[];
}

export interface ParsedAnswer {
  brands: { name: string; product: string | null }[];
  mentioned: boolean;
  position: number | null;
  citations: { url: string; domain: string; title: string | null; type: SourceType; isOwn: boolean }[];
  byClaude: boolean; // false when Claude couldn't read it (no key, or an error) and we fell back to text matching
}

const SOURCE_TYPES = ["retailer", "editorial", "ugc", "brand", "marketplace", "other"] as const;

export const ParseSchema = z.object({
  brands: z
    .array(z.object({ name: z.string(), product: z.string().nullable() }))
    .describe("Brands recommended or named as product options, in order of first appearance"),
  merchant_named: z.boolean().describe("True if the answer recommends or names the store or one of its products"),
  source_types: z
    .array(
      z.object({
        index: z.number().int(),
        type: oneOf(SOURCE_TYPES),
      }),
    )
    .describe("A type for each numbered source in the list given"),
});

export async function parseAnswer(answer: EngineAnswer, ctx: MerchantContext): Promise<ParsedAnswer> {
  const sources = answer.sources.slice(0, 40).map((s) => ({ ...s, domain: domainOf(s.url) }));
  const guessed = sources.map((s) => guessSourceType(s.url, s.domain));
  const unknown = sources.map((s, i) => ({ ...s, i })).filter((s) => guessed[s.i] === null);

  let brands: { name: string; product: string | null }[] = [];
  let claudeSaysNamed: boolean | null = null;
  let byClaude = false;
  const claudeTypes = new Map<number, SourceType>();

  if (aiConfigured() && answer.text.trim()) {
    try {
      const shopping = answer.products.length
        ? `\nShopping cards shown:\n${answer.products.map((p) => `- ${p.title}${p.brand ? ` (brand: ${p.brand})` : ""}`).join("\n")}`
        : "";
      const result = await askJson({
        schema: ParseSchema,
        tier: "fast",
        label: "parse-answer",
        shopId: ctx.shopId,
        maxTokens: 3000,
        system:
          "You extract facts from an AI assistant's shopping answer. List brands, not retailers: a shop like Chemist Warehouse only counts if it is recommended as a brand. Use the brand name (e.g. 'Jericho Australia'), and put the product name in `product` when given. Be literal; do not add brands that are not in the text.",
        prompt: `The store we are checking for: ${ctx.brandNames.join(" / ")} (website: ${ctx.domains.join(", ")})
Some of its products: ${ctx.productTitles.slice(0, 25).join("; ")}

AI answer:
"""
${answer.text}
"""${shopping}

Numbered sources to classify (retailer = shop selling many brands, editorial = review/roundup/blog/news, ugc = reddit/forums/video/social, brand = a single brand's own site, marketplace = amazon/ebay style):
${unknown.map((s) => `${s.i}. ${s.domain} — ${s.title ?? ""} ${s.url}`).join("\n") || "(none)"}`,
      });
      brands = result.brands.filter((b) => b.name.trim());
      claudeSaysNamed = result.merchant_named;
      byClaude = true;
      for (const t of result.source_types) claudeTypes.set(t.index, pick(SOURCE_TYPES, t.type, "other"));
    } catch (err) {
      console.error(`[parse] Claude parse failed, using text matching: ${(err as Error).message}`);
    }
  }

  if (!brands.length) {
    // Fallback: brands from shopping cards.
    brands = answer.products.filter((p) => p.brand).map((p) => ({ name: p.brand!, product: p.title }));
  }

  // De-duplicate brands, keep first appearance.
  const ordered: { name: string; product: string | null }[] = [];
  for (const b of brands) if (!ordered.some((o) => sameBrand(o.name, b.name))) ordered.push(b);

  let position = merchantPosition(ordered.map((b) => b.name), ctx.brandNames);
  const textMatch =
    textNamesBrand(answer.text, ctx.brandNames.filter((n) => n.length >= 4)) ||
    textNamesShortBrand(answer.text, ctx.brandNames.filter((n) => n.trim().length === 3)) ||
    textNamesBrand(answer.text, ctx.productTitles.filter((t) => t.length >= 12));
  const mentioned = position !== null || (claudeSaysNamed ?? textMatch);
  if (mentioned && position === null) {
    ordered.push({ name: ctx.brandNames[0], product: null });
    position = ordered.length;
  }

  const citations = sources.map((s, i) => ({
    url: s.url,
    domain: s.domain,
    title: s.title ?? null,
    type: (guessed[i] ?? claudeTypes.get(i) ?? "other") as SourceType,
    isOwn: sourcesIncludeDomain([s.domain], ctx.domains),
  }));

  return { brands: ordered.slice(0, 25), mentioned, position, citations, byClaude };
}
