// Onboarding: pull the catalog, understand the brand, write the buyer questions.

import { z } from "zod";
import { oneOf, pick } from "./oneof";
import db from "../db.server";
import { askJson } from "./ai.server";
import { keywordVolumes } from "./treg.server";
import { gql, type AdminClient } from "./shopify-gql.server";
import { PLANS, getPlan } from "./plans";
import { registerJob } from "./jobs.server";
import { startUpgradeScan } from "./billing.server";
import { simpleProfile, templateQuestions } from "./fallbacks";
import { LONG_TAIL_SHARE, MAX_CLUSTERS, looksLongTail, pickActive, tidyClusters } from "./clusters";
import { shopperCountryName } from "./countries";

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

/**
 * Save up to `max` products (newest first) into our cache. When that read the whole catalogue, products
 * we still have that Shopify no longer lists were deleted there: they're marked DELETED, so nothing
 * features them again (everything that picks products asks for ACTIVE ones).
 */
export async function syncCatalog(shopId: string, admin: AdminClient, max = 250): Promise<number> {
  const started = new Date();
  let cursor: string | null = null;
  let count = 0;
  let complete = false;
  do {
    const data: ProductsPage = await gql<ProductsPage>(admin, PRODUCTS_QUERY, { cursor });
    const page: ProductsPage["products"] = data.products;
    let saved = 0;
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
      saved++;
    }
    // The whole catalogue was read: this is the last page and none of it was cut off by `max`.
    complete = !page.pageInfo.hasNextPage && saved === page.nodes.length;
    cursor = page.pageInfo.hasNextPage && count < max ? page.pageInfo.endCursor : null;
  } while (cursor);
  if (complete) {
    await db.product.updateMany({ where: { shopId, syncedAt: { lt: started }, NOT: { status: "DELETED" } }, data: { status: "DELETED" } });
  }
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

export const ProfileSchema = z.object({
  brand_name: z.string().describe("The brand name customers would use"),
  aliases: z.array(z.string()).describe("Other names or spellings of the brand, may be empty"),
  summary: z.string().describe("2-3 plain-English sentences: what they sell and who for"),
  category: z.string().describe("Short category, e.g. men's grooming"),
  audience: z.string().describe("Who buys, in a few words"),
  price_point: oneOf(["budget", "mid", "premium"]),
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
  }).catch((err: Error) => {
    console.error(`[profile] Claude unavailable, using a simple profile: ${err.message.slice(0, 200)}`);
    return simpleProfile(shop.name ?? shop.domain, products);
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
      pricePoint: pick(["budget", "mid", "premium"], profile.price_point, "mid"),
      country: shop.country,
    },
    update: {
      brandName: profile.brand_name,
      aliases: profile.aliases,
      summary: profile.summary,
      category: profile.category,
      audience: profile.audience,
      pricePoint: pick(["budget", "mid", "premium"], profile.price_point, "mid"),
      country: shop.country,
    },
  });
}

/** "DE" -> "Germany", "US" -> "the US". Anything that isn't a known country code comes back unchanged. */
export function countryName(code: string): string {
  return shopperCountryName(code);
}

/** A round "under X" budget in the store's own currency for example questions: "$50", "£50", "€50", "¥5,000". */
export function budgetExample(currency: string | null | undefined): string {
  const code = (currency ?? "").trim().toUpperCase();
  // Currencies where 50 buys very little: use a bigger round number.
  const amount = /^(JPY|KRW|INR|IDR|VND|HUF|CLP|COP|ISK|PHP|THB|TWD|PKR|LKR|NGN|KES)$/.test(code) ? 5000 : 50;
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount}`;
  }
}

export const QuestionsSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string().describe("How a real shopper would ask an AI assistant"),
      keyword: z.string().describe("The same need as a short Google search, 2-5 words, no country"),
      cluster: z.string().describe("The topic it belongs to: a short lowercase label of 2-5 words, reused for questions on the same topic"),
      long_tail: z.boolean().describe("true for a specific question: a particular need, ingredient or material, budget, gift or comparison"),
    }),
  ),
});

export interface ScoredQuestion {
  question: string;
  keyword: string;
  cluster: string;
  longTail: boolean;
  volume: number | null;
}

/** "best beard oil" / "cheap beard oil" / "beard oil gift" -> "beard oil": a template question's topic. */
const templateTopic = (keyword: string) => keyword.replace(/^(best|cheap|natural)\s+/i, "").replace(/\s+gift$/i, "").trim();

// Questions written at onboarding: enough for Done-for-you's 100 plus spares, so an upgrade only has to
// switch more on. Free tracks 10 and Standard 50 of them; the rest wait, inactive, ranked by search volume.
export const QUESTION_POOL = Math.max(30, PLANS.pro.questions + 10);

const loadShop = (shopId: string) => db.shop.findUniqueOrThrow({ where: { id: shopId }, include: { profile: true } });
type ShopWithProfile = Awaited<ReturnType<typeof loadShop>>;

/**
 * Ask Claude for `count` new buyer questions (templates if Claude is unavailable), skipping any in `avoid`.
 * About 40% are long-tail (specific needs, ingredients or materials from the catalogue, budgets, gifts,
 * comparisons), and each has a topic cluster (at most 8). Returns them with search volume, best first.
 */
async function writeQuestionList(shop: ShopWithProfile, count: number, avoid: string[] = [], topics: string[] = []): Promise<ScoredQuestion[]> {
  const profile = shop.profile;
  const products = await db.product.findMany({ where: { shopId: shop.id, status: "ACTIVE" }, take: 40 });
  const where = countryName(shop.country);

  const result = await askJson({
    schema: QuestionsSchema,
    tier: "smart",
    label: "questions",
    shopId: shop.id,
    // About 30 output tokens per question; plenty of room so 110 never runs out (Claude ran out = templates).
    maxTokens: Math.max(6000, count * 80 + 4000),
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
${avoid.length ? `\nAlready tracked (write different ones):\n${avoid.map((q) => `- ${q}`).join("\n")}\n` : ""}
Write ${count} different buyer questions this store's products could answer. Mix:
- "best X for Y" questions (e.g. "best beard oil for dry skin in ${where}")
- problem questions ("what helps with ...")
- comparison and gift questions
- price questions ("affordable ... under ${budgetExample(shop.currency)}")
About 40% should be long-tail (long_tail: true): specific questions about a particular need (skin or hair type, a use, an occasion), an ingredient or material (only ones that appear in the products above, never invented), a budget in the store's currency (like "under ${budgetExample(shop.currency)}"), a gift, or a comparison. Word them the way people really ask, not stuffed with keywords.
Give each question a cluster: a short lowercase topic label (2 to 5 words, like "beard oil for dry skin"). Use at most ${MAX_CLUSTERS} clusters in total and reuse the same label for questions on the same topic.${topics.length ? ` Topics the store already has (use these exact labels where a question fits; a new label only for a clearly different topic): ${topics.join(", ")}.` : ""}
About half should mention ${where}. Write them the way a shopper in ${where} types, with their spelling. Keep each under 15 words.`,
  }).catch((err: Error) => {
    console.error(`[questions] Claude unavailable, using templates: ${err.message.slice(0, 200)}`);
    return {
      questions: templateQuestions([...products.map((p) => p.productType), profile?.category ?? null], where).map((q) => ({
        ...q,
        cluster: templateTopic(q.keyword),
        long_tail: looksLongTail(q.question),
      })),
    };
  });

  const seen = new Set(avoid.map((q) => q.trim().toLowerCase()));
  const unique = new Map<string, { question: string; keyword: string; cluster: string; longTail: boolean }>();
  for (const q of result.questions) {
    const key = q.question.trim().toLowerCase();
    if (key && !seen.has(key) && !unique.has(key)) {
      unique.set(key, { question: q.question.trim(), keyword: q.keyword.trim(), cluster: q.cluster ?? "", longTail: q.long_tail === true });
    }
  }
  const list = tidyClusters([...unique.values()].slice(0, count), MAX_CLUSTERS, topics);

  let volumes: Record<string, number> = {};
  try {
    volumes = list.length ? await keywordVolumes(list.map((q) => q.keyword), shop.country, shop.id) : {};
  } catch (err) {
    console.error(`[questions] volume lookup failed: ${(err as Error).message}`);
  }
  return list
    .map((q) => ({ ...q, volume: volumes[q.keyword.toLowerCase()] ?? null }))
    .sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1));
}

/**
 * Write the buyer questions, look up how often people search for them, and keep the best ones active:
 * about 35% of the slots for long-tail questions whatever their volume (see clusters.ts), the rest by volume.
 */
export async function generateQuestions(shopId: string) {
  const shop = await loadShop(shopId);
  const plan = getPlan(shop.plan);
  // Questions the store added are never rewritten: Claude is told to write different ones, so the
  // upsert below can't switch one of theirs off or relabel it.
  const merchant = await db.question.findMany({ where: { shopId, source: "merchant" }, select: { text: true } });
  const scored = await writeQuestionList(shop, QUESTION_POOL, merchant.map((q) => q.text));

  // Keep merchant-added questions; switch off older AI-written ones (their history stays).
  await db.question.updateMany({ where: { shopId, source: "ai" }, data: { active: false } });
  const manualActive = await db.question.count({ where: { shopId, source: "merchant", active: true } });
  const active = new Set(pickActive(scored, Math.max(0, plan.questions - manualActive)));
  for (const q of scored) {
    const on = active.has(q);
    await db.question.upsert({
      where: { shopId_text: { shopId, text: q.question } },
      create: { shopId, text: q.question, keyword: q.keyword, volume: q.volume, cluster: q.cluster, longTail: q.longTail, active: on, source: "ai" },
      update: { keyword: q.keyword, volume: q.volume, cluster: q.cluster, longTail: q.longTail, active: on },
    });
  }
  return scored.length;
}

/**
 * Fill the plan's question slots after an upgrade: switch on unused questions first (best search volume),
 * then write new ones if there still aren't enough. Never switches off or changes an existing question,
 * including ones the store added. Returns how many new questions were written.
 */
export async function topUpQuestions(shopId: string) {
  const shop = await loadShop(shopId);
  const plan = getPlan(shop.plan);
  const activeNow = () => db.question.count({ where: { shopId, active: true } });

  let active = await activeNow();
  if (active < plan.questions) {
    // Long-tail questions first, up to their share of the plan's slots; then by search volume.
    const unused = await db.question.findMany({
      where: { shopId, active: false },
      orderBy: [{ volume: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
      select: { id: true, longTail: true, volume: true, cluster: true },
    });
    const ltActive = await db.question.count({ where: { shopId, active: true, longTail: true } });
    const ltWanted = Math.max(0, Math.round(plan.questions * LONG_TAIL_SHARE) - ltActive);
    const room = plan.questions - active;
    const lt = unused.filter((q) => q.longTail).slice(0, Math.min(ltWanted, room));
    const rest = unused.filter((q) => !lt.includes(q)).slice(0, room - lt.length);
    await db.question.updateMany({ where: { id: { in: [...lt, ...rest].map((q) => q.id) } }, data: { active: true } });
    active = await activeNow();
  }
  const existing = await db.question.findMany({ where: { shopId }, select: { text: true, cluster: true } });
  const missing = plan.questions - existing.length;
  if (missing <= 0 || active >= plan.questions) return 0;

  // The store's topics, biggest first: new questions join them instead of starting more topics (each
  // topic gets its own overview guide page).
  const topicCounts = new Map<string, number>();
  for (const q of existing) if (q.cluster) topicCounts.set(q.cluster, (topicCounts.get(q.cluster) ?? 0) + 1);
  const topics = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  // A few spares, as some come back as repeats.
  const scored = await writeQuestionList(shop, missing + 10, existing.map((q) => q.text), topics);
  const on = new Set(pickActive(scored, plan.questions - active));
  let written = 0;
  for (const q of scored) {
    const row = await db.question
      .create({ data: { shopId, text: q.question, keyword: q.keyword, volume: q.volume, cluster: q.cluster, longTail: q.longTail, active: on.has(q), source: "ai" } })
      .catch(() => null); // already there (same text)
    if (!row) continue;
    written++;
  }
  return written;
}

// Upgrade: more questions first, then the upgrade scan (queued by billing.server's onPlanChanged).
registerJob("questions.topup", async (job) => {
  const n = await topUpQuestions(job.shopId!);
  console.log(`[questions] ${n} new questions for shop ${job.shopId}`);
  if ((job.payload as { scan?: boolean }).scan) await startUpgradeScan(job.shopId!);
});
