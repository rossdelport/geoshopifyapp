// Onboarding: pull the catalog, understand the brand, write the buyer questions.

import { z } from "zod";
import db from "../db.server";
import { askJson } from "./ai.server";
import { keywordVolumes } from "./treg.server";
import { gql, type AdminClient } from "./shopify-gql.server";
import { getPlan } from "./plans";

const PRODUCTS_QUERY = `#graphql
  query Products($cursor: String) {
    products(first: 100, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id title handle productType vendor tags status description
        seo { title description }
        featuredMedia { preview { image { url } } }
        priceRangeV2 { minVariantPrice { amount currencyCode } }
      }
    }
  }`;

interface ProductNode {
  id: string;
  title: string;
  handle: string;
  productType: string;
  vendor: string;
  tags: string[];
  status: string;
  description: string;
  seo: { title: string | null; description: string | null } | null;
  featuredMedia: { preview: { image: { url: string } | null } | null } | null;
  priceRangeV2: { minVariantPrice: { amount: string; currencyCode: string } } | null;
}
interface ProductsPage {
  products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ProductNode[] };
}

/** Save up to `max` products (newest first) into our cache. */
export async function syncCatalog(shopId: string, admin: AdminClient, max = 250): Promise<number> {
  let cursor: string | null = null;
  let count = 0;
  do {
    const data: ProductsPage = await gql<ProductsPage>(admin, PRODUCTS_QUERY, { cursor });
    const page: ProductsPage["products"] = data.products;
    for (const p of page.nodes) {
      if (count >= max) break;
      const price = p.priceRangeV2?.minVariantPrice;
      const values = {
        title: p.title,
        handle: p.handle,
        productType: p.productType || null,
        vendor: p.vendor || null,
        tags: p.tags ?? [],
        description: p.description || null,
        seoTitle: p.seo?.title || null,
        seoDesc: p.seo?.description || null,
        price: price ? `${price.amount} ${price.currencyCode}` : null,
        imageUrl: p.featuredMedia?.preview?.image?.url ?? null,
        status: p.status,
        syncedAt: new Date(),
      };
      await db.product.upsert({
        where: { shopId_gid: { shopId, gid: p.id } },
        create: { shopId, gid: p.id, ...values },
        update: values,
      });
      count++;
    }
    cursor = page.pageInfo.hasNextPage && count < max ? page.pageInfo.endCursor : null;
  } while (cursor);
  return count;
}

/** Read the store's homepage text (title, meta description, headings). Best effort. */
export async function readHomepage(domain: string | null): Promise<string> {
  if (!domain) return "";
  try {
    const res = await fetch(`https://${domain}`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; GEO-app/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return "";
    const html = (await res.text()).slice(0, 400_000);
    const pick = (re: RegExp) => [...html.matchAll(re)].map((m) => m[1].replace(/<[^>]+>/g, " ").trim());
    const parts = [
      ...pick(/<title[^>]*>([\s\S]*?)<\/title>/gi),
      ...pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/gi),
      ...pick(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi),
    ]
      .map((t) => t.replace(/\s+/g, " "))
      .filter((t) => t.length > 2);
    return [...new Set(parts)].join("\n").slice(0, 3000);
  } catch {
    return "";
  }
}

function catalogDigest(products: { title: string; productType: string | null; vendor: string | null; tags: unknown; price: string | null; description: string | null }[]) {
  return products
    .slice(0, 60)
    .map((p, i) => {
      const tags = Array.isArray(p.tags) ? (p.tags as string[]).slice(0, 6).join(", ") : "";
      const desc = i < 12 && p.description ? ` | ${p.description.slice(0, 280)}` : "";
      return `- ${p.title}${p.productType ? ` [${p.productType}]` : ""}${p.price ? ` (${p.price})` : ""}${tags ? ` tags: ${tags}` : ""}${desc}`;
    })
    .join("\n");
}

const ProfileSchema = z.object({
  brand_name: z.string().describe("The brand name customers would use"),
  aliases: z.array(z.string()).describe("Other names or spellings of the brand, may be empty"),
  summary: z.string().describe("2-3 plain-English sentences: what they sell and who for"),
  category: z.string().describe("Short category, e.g. men's grooming"),
  audience: z.string().describe("Who buys, in a few words"),
  price_point: z.enum(["budget", "mid", "premium"]),
});

export async function buildBrandProfile(shopId: string) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const products = await db.product.findMany({ where: { shopId, status: "ACTIVE" }, orderBy: { syncedAt: "desc" }, take: 60 });
  const homepage = await readHomepage(shop.primaryDomain);
  const vendors = [...new Set(products.map((p) => p.vendor).filter(Boolean))].slice(0, 5);

  const profile = await askJson({
    schema: ProfileSchema,
    tier: "smart",
    label: "brand-profile",
    shopId,
    maxTokens: 4000,
    system:
      "You describe online stores in plain, factual English. Only use what the store data shows. Never invent awards, certifications or claims.",
    prompt: `Store name: ${shop.name ?? shop.domain}
Website: ${shop.primaryDomain ?? shop.domain}
Country: ${shop.country}
Product vendors: ${vendors.join(", ") || "unknown"}

Homepage text:
${homepage || "(not available)"}

Products:
${catalogDigest(products) || "(no products yet)"}

Write the brand profile.`,
  });

  return db.brandProfile.upsert({
    where: { shopId },
    create: {
      shopId,
      brandName: profile.brand_name,
      aliases: profile.aliases,
      summary: profile.summary,
      category: profile.category,
      audience: profile.audience,
      pricePoint: profile.price_point,
      country: shop.country,
    },
    update: {
      brandName: profile.brand_name,
      aliases: profile.aliases,
      summary: profile.summary,
      category: profile.category,
      audience: profile.audience,
      pricePoint: profile.price_point,
      country: shop.country,
    },
  });
}

const COUNTRY_NAMES: Record<string, string> = {
  AU: "Australia", NZ: "New Zealand", US: "the US", GB: "the UK", CA: "Canada", IE: "Ireland",
};
export const countryName = (code: string) => COUNTRY_NAMES[code] ?? code;

const QuestionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe("How a real shopper would ask an AI assistant"),
      keyword: z.string().describe("The same need as a short Google search, 2-5 words, no country"),
    }),
  ),
});

/** Write ~30 buyer questions, look up how often people search for them, keep the best ones active. */
export async function generateQuestions(shopId: string) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, include: { profile: true } });
  const plan = getPlan(shop.plan);
  const profile = shop.profile;
  const products = await db.product.findMany({ where: { shopId, status: "ACTIVE" }, take: 40 });
  const where = countryName(shop.country);

  const result = await askJson({
    schema: QuestionsSchema,
    tier: "smart",
    label: "questions",
    shopId,
    maxTokens: 6000,
    system:
      "You know how shoppers ask ChatGPT, Gemini and Perplexity for product recommendations. Write natural questions, the way people actually type them. Never include the store's own brand name: these are unbranded buying questions where the store wants to be recommended.",
    prompt: `Store: ${profile?.brandName ?? shop.name}
What they sell: ${profile?.summary ?? ""}
Category: ${profile?.category ?? ""}
Shoppers: ${profile?.audience ?? ""}
Price point: ${profile?.pricePoint ?? ""}
Country: ${where}

Some products:
${products.map((p) => `- ${p.title}${p.productType ? ` [${p.productType}]` : ""}`).join("\n")}

Write 30 different buyer questions this store's products could answer. Mix:
- "best X for Y" questions (e.g. "best beard oil for dry skin in ${where}")
- problem questions ("what helps with ...")
- comparison and gift questions
- price questions ("affordable ... under $50")
About half should mention ${where}. Keep each under 15 words.`,
  });

  const unique = new Map<string, { question: string; keyword: string }>();
  for (const q of result.questions) {
    const key = q.question.trim().toLowerCase();
    if (key && !unique.has(key)) unique.set(key, { question: q.question.trim(), keyword: q.keyword.trim() });
  }
  const list = [...unique.values()].slice(0, 40);

  let volumes: Record<string, number> = {};
  try {
    volumes = await keywordVolumes(list.map((q) => q.keyword), shop.country, shopId);
  } catch (err) {
    console.error(`[questions] volume lookup failed: ${(err as Error).message}`);
  }

  const scored = list
    .map((q) => ({ ...q, volume: volumes[q.keyword.toLowerCase()] ?? null }))
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));

  // Keep merchant-added questions; switch off older AI-written ones (their history stays).
  await db.question.updateMany({ where: { shopId, source: "ai" }, data: { active: false } });
  const manualActive = await db.question.count({ where: { shopId, source: "merchant", active: true } });
  let slots = Math.max(0, plan.questions - manualActive);
  for (const q of scored) {
    await db.question.upsert({
      where: { shopId_text: { shopId, text: q.question } },
      create: { shopId, text: q.question, keyword: q.keyword, volume: q.volume, active: slots > 0, source: "ai" },
      update: { keyword: q.keyword, volume: q.volume, active: slots > 0 },
    });
    slots--;
  }
  return scored.length;
}
