// Fix engine: suggest changes that help AI assistants recommend the store, then push them to
// Shopify when the merchant approves. Every change keeps the old values for one-click undo.

import { z } from "zod";
import { oneOf, pick } from "./oneof";
import type { Fix, Product } from "@prisma/client";
import db from "../db.server";
import { askJson } from "./ai.server";
import { env } from "./env.server";
import { getPlan } from "./plans";
import { canOptimiseProduct, guidePageDue, remainingFixes, remainingGuidePages } from "./limits";
import { countGuidePagesThisMonth, getUsageFor } from "./usage.server";
import { assertNoUserErrors, gql, type AdminClient } from "./shopify-gql.server";
import { enqueue, registerJob } from "./jobs.server";
import { adminFor } from "./onboard-job.server";
import { countryName } from "./onboarding.server";
import { parseFaq } from "./faq";

export { FIX_TYPE_LABELS } from "./fix-labels";
import type { FixAfter, FixBefore } from "./fix-labels";

// Autopilot (Done-for-you, on unless the store switches it off) applies every kind of fix: "fixes applied
// for you, still skipping risky claims". Before it applies one, it runs the claims check on the text that
// would go live; anything the check had to soften waits for the store, as does any fix that needs facts
// from the store (missingInfo). Every change keeps its old values for one-click undo.
const HEALTH_WORDS = /skin|beauty|groom|beard|hair|supplement|vitamin|health|cosmetic|wellness|baby|pet|food|nutrition|protein|tea|oil|cream|serum|balm/i;

const GUARDRAILS = `Rules you must follow:
- Only use facts that appear in the product data or store profile. Never invent ingredients, materials, sizes, certifications, awards, reviews, ratings, statistics or prices.
- If a helpful fact is missing, do not guess: add a short question for the store owner to missing_info instead.
- No medical or therapeutic claims (do not say a product treats, cures, heals, prevents or relieves a condition). Describe cosmetic benefits only, like "softens" or "moisturises".
- No fake urgency, no put-downs of other brands, no keyword stuffing.
- Plain, friendly English with Australian spelling. Short sentences.`;

// ---------- Generation ----------

const FIX_TYPES = ["product_description", "product_faq", "product_seo", "product_title", "product_type", "guide_page"] as const;

export const IdeasSchema = z.object({
  ideas: z.array(
    z.object({
      type: oneOf(FIX_TYPES),
      product_index: z.number().int().nullable().describe("Index from the product list; null for guide_page"),
      question_indexes: z.array(z.number().int()),
      reason: z.string().describe("One plain sentence a store owner understands: why this helps"),
      impact: oneOf(["high", "medium", "low"]),
    }),
  ),
});

export const ProductWriteSchema = z.object({
  title: z.string().nullable(),
  description_html: z.string().nullable().describe("Simple HTML: <p>, <ul>, <li>, <strong> only"),
  seo_title: z.string().nullable().describe("Max 60 characters"),
  seo_description: z.string().nullable().describe("Max 155 characters"),
  product_type: z.string().nullable(),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).nullable(),
  missing_info: z.array(z.string()),
});

export const GuideSchema = z.object({
  title: z.string(),
  handle: z.string().describe("url-friendly, lowercase, hyphens"),
  body_html: z.string().describe("Simple HTML. Link products using the exact URLs given."),
  missing_info: z.array(z.string()),
});

export const ClaimsSchema = z.object({
  ok: z.boolean(),
  problems: z.array(z.string()),
  fixed_text: z.string().nullable().describe("The same text with only the problem phrases softened; null if ok"),
});

interface LostQuestion {
  index: number;
  id: string;
  text: string;
  volume: number | null;
  mentionRate: number;
  winners: string[];
}

async function lostQuestions(scanId: string): Promise<LostQuestion[]> {
  const answers = await db.aiAnswer.findMany({
    where: { scanId, status: "parsed" },
    include: { question: true, mentions: { where: { isMerchant: false }, orderBy: { position: "asc" }, take: 3 } },
  });
  const byQ = new Map<string, { text: string; volume: number | null; n: number; named: number; winners: Map<string, number> }>();
  for (const a of answers) {
    const g = byQ.get(a.questionId) ?? { text: a.question.text, volume: a.question.volume, n: 0, named: 0, winners: new Map() };
    g.n++;
    if (a.mentioned) g.named++;
    for (const m of a.mentions) g.winners.set(m.brand, (g.winners.get(m.brand) ?? 0) + 1);
    byQ.set(a.questionId, g);
  }
  return [...byQ.entries()]
    .map(([id, g]) => ({
      id,
      text: g.text,
      volume: g.volume,
      mentionRate: g.n ? g.named / g.n : 0,
      winners: [...g.winners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([b]) => b),
    }))
    .filter((q) => q.mentionRate < 0.5)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 10)
    .map((q, index) => ({ ...q, index }));
}

const productLine = (p: Product, i: number) =>
  `${i}. ${p.title}${p.productType ? ` [${p.productType}]` : " [no product type]"}${p.price ? ` (${p.price})` : ""}: ${(p.description ?? "no description").slice(0, 220)}`;

function storeUrl(shop: { primaryDomain: string | null; domain: string }) {
  return `https://${shop.primaryDomain ?? shop.domain}`;
}

export function trackedProductUrl(shop: { primaryDomain: string | null; domain: string }, handle: string, medium: string, campaign: string) {
  const u = new URL(`${storeUrl(shop)}/products/${handle}`);
  u.searchParams.set("utm_source", env.utmSource);
  u.searchParams.set("utm_medium", medium);
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}

async function claimsCheck(shopId: string, text: string): Promise<{ text: string; note: string | null }> {
  const result = await askJson({
    schema: ClaimsSchema,
    tier: "fast",
    label: "claims-check",
    shopId,
    maxTokens: 4000,
    system:
      "You check Australian store copy against TGA and ACL rules. Flag therapeutic or medical claims (treats, cures, heals, prevents, relieves, clinically proven without evidence), invented facts, and misleading superlatives. Cosmetic claims like 'softens' or 'moisturises' are fine.",
    prompt: `Check this copy:\n"""\n${text}\n"""`,
  });
  if (result.ok) return { text, note: null };
  const problems = result.problems.join("; ") || "wording that may be a claim";
  // Flagged but not rewritten: keep the text and say what to check.
  if (!result.fixed_text) return { text, note: `Please check this wording before it goes live: ${problems}` };
  return { text: result.fixed_text, note: `We softened some wording to stay clear of health or other claims: ${problems}` };
}

export async function generateFixes(shopId: string, scanId: string) {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, include: { profile: true } });
  const plan = getPlan(shop.plan);
  const usage = await getUsageFor(shopId);
  // Unlimited fixes, but never past the month's data + AI budget.
  if (usage.costThisMonth >= plan.costCapUsd) return 0;
  const autopilotOn = plan.autopilot && shop.autopilot;
  // Fixes waiting for the store: at most 10 at a time, so the queue stays reviewable. With autopilot only
  // the ones it held back count (claims softened or facts missing); the rest go live by themselves, so
  // FAQs, guide pages and the rest keep coming even when a few wait for the store.
  const waiting = await db.fix.count({
    where: { shopId, status: "pending", ...(autopilotOn ? { missingInfo: { not: null } } : {}) },
  });
  const room = Math.max(0, 10 - waiting);
  const budget = Math.min(remainingFixes(plan, usage), 6, autopilotOn ? 6 : room);
  if (budget <= 0 || !shop.profile) return 0;
  // Guide pages have their own monthly allowance (Standard 2, Done-for-you 8). Done-for-you promises its
  // 8, so when the month's pace is behind, ask for exactly one.
  const guidesLeft = remainingGuidePages(plan, usage);
  const guideDue = guidePageDue(plan, usage);

  const lost = await lostQuestions(scanId);
  if (!lost.length) return 0;

  const open = await db.fix.findMany({
    where: { shopId, status: { in: ["pending", "applied"] } },
    select: { type: true, targetGid: true },
  });
  const products = await db.product.findMany({
    where: { shopId, status: "ACTIVE" },
    orderBy: [{ optimisedAt: { sort: "asc", nulls: "first" } }, { syncedAt: "desc" }],
    take: 40,
  });
  if (!products.length) return 0;

  const where = countryName(shop.country);
  const ideas = await askJson({
    schema: IdeasSchema,
    tier: "smart",
    label: "fix-ideas",
    shopId,
    maxTokens: 6000,
    system:
      "You help small online stores get recommended by AI shopping assistants (ChatGPT, Gemini, Perplexity, Google AI Overviews). AI assistants favour products whose pages clearly state who the product is for, key attributes, use cases and availability, and stores with helpful guides. Pick the few changes that most likely win the questions the store is losing.",
    prompt: `Store: ${shop.profile.brandName}. ${shop.profile.summary}
Country: ${where}

Questions where AI does NOT recommend this store yet (with who it recommends instead):
${lost.map((q) => `${q.index}. "${q.text}"${q.volume ? ` (${q.volume} searches/mo)` : ""}. AI picks: ${q.winners.join(", ") || "various"}`).join("\n")}

Store products:
${products.map(productLine).join("\n")}

Changes already suggested (don't repeat): ${open.map((o) => `${o.type}:${products.findIndex((p) => p.gid === o.targetGid)}`).join(", ") || "none"}

Suggest up to ${budget} changes. Prefer: product FAQs and clearer descriptions on the most relevant products; a product type where it's missing; ${guideDue ? "exactly one guide_page, built around the questions that share the clearest theme" : guidesLeft > 0 ? "at most one guide_page when several questions share a theme" : "no guide_page (this month's guide pages are used up)"}.${autopilotOn && room === 0 ? " Only suggest changes you can make fully from the product data shown: skip anything that would need facts the store hasn't given." : ""}`,
  });

  let created = 0;
  let heldRoom = room; // with autopilot: how many more fixes may wait for the store
  let guideSlots = guidesLeft;
  const cleanIdeas = ideas.ideas
    .map((i) => ({ ...i, type: pick([...FIX_TYPES, "skip"], i.type, "skip"), impact: pick(["high", "medium", "low"], i.impact, "medium") }))
    .filter((i) => i.type !== "skip")
    // Drop guide pages past the month's allowance so they don't use up the other slots.
    .filter((i) => i.type !== "guide_page" || guideSlots-- > 0);
  for (const idea of cleanIdeas.slice(0, budget)) {
    try {
      const questions = idea.question_indexes.map((i) => lost[i]).filter(Boolean);
      // With autopilot and a full queue for the store, drop fixes that would only wait (facts missing).
      const skipIfHeld = autopilotOn && heldRoom <= 0;
      const fix = idea.type === "guide_page"
        ? await writeGuide(shop, products, questions, idea.reason, idea.impact, plan, skipIfHeld)
        : await writeProductFix(shop, products[idea.product_index ?? -1], idea, questions, plan, usage, skipIfHeld);
      if (fix) created++;
      if (fix?.missingInfo) heldRoom--;
    } catch (err) {
      console.error(`[fixes] could not write ${idea.type}: ${(err as Error).message}`);
    }
  }

  return created;
}

/** Run autopilot for a shop (it checks the plan and the store's switch itself). */
export function queueAutopilot(shopId: string) {
  return enqueue("fixes.autopilot", {}, { shopId, dedupeKey: `autopilot:${shopId}` });
}

async function writeProductFix(
  shop: { id: string; country: string; profile: { brandName: string; summary: string; category: string } | null },
  product: Product | undefined,
  idea: z.infer<typeof IdeasSchema>["ideas"][number],
  questions: LostQuestion[],
  plan: ReturnType<typeof getPlan>,
  usage: Awaited<ReturnType<typeof getUsageFor>>,
  skipIfHeld = false,
): Promise<Fix | null> {
  if (!product) return null;
  if (!canOptimiseProduct(plan, usage, Boolean(product.optimisedAt))) return null;
  const exists = await db.fix.findFirst({ where: { shopId: shop.id, targetGid: product.gid, type: idea.type, status: "pending" } });
  if (exists) return null;

  const want: Record<string, string> = {
    product_description: "Rewrite description_html (120-250 words). Keep every fact, make it scannable: who it's for, what it does, key attributes, how to use, and availability. Leave other fields null except missing_info.",
    product_faq: "Write faq: 4-6 short questions and answers a shopper would ask before buying, answered only from the product data. Leave other fields null except missing_info.",
    product_seo: "Write seo_title (max 60 chars) and seo_description (max 155 chars) that say plainly what it is and who it's for. Leave other fields null except missing_info.",
    product_title: "Write a clearer title: keep the brand and product name, add the key attribute (e.g. size or variant) only if it's in the data. Leave other fields null except missing_info.",
    product_type: "Write product_type: a short, standard category (e.g. 'Beard Oil'). Leave other fields null except missing_info.",
  };

  const out = await askJson({
    schema: ProductWriteSchema,
    tier: "smart",
    label: `fix-${idea.type}`,
    shopId: shop.id,
    maxTokens: 6000,
    system: `You improve Shopify product pages so AI shopping assistants understand and recommend them.\n${GUARDRAILS}`,
    prompt: `Store: ${shop.profile?.brandName} (${countryName(shop.country)}). ${shop.profile?.summary}

Product data:
Title: ${product.title}
Type: ${product.productType ?? "(none)"}
Vendor: ${product.vendor ?? ""}
Tags: ${(product.tags as string[]).join(", ")}
Price: ${product.price ?? ""}
Current SEO title: ${product.seoTitle ?? "(none)"}
Current SEO description: ${product.seoDesc ?? "(none)"}
Description:
"""
${product.description ?? "(empty)"}
"""

Shopper questions this should help with:
${questions.map((q) => `- ${q.text}`).join("\n") || "- (general)"}

Task: ${want[idea.type]}`,
  });

  let after: Record<string, unknown> = {};
  let note: string | null = null;
  const check = async (text: string) => {
    if (!HEALTH_WORDS.test(`${shop.profile?.category} ${product.productType} ${product.title}`)) return text;
    const c = await claimsCheck(shop.id, text);
    note = c.note;
    return c.text;
  };

  switch (idea.type) {
    case "product_description":
      if (!out.description_html) return null;
      after = { descriptionHtml: await check(out.description_html) };
      break;
    case "product_faq": {
      if (!out.faq?.length) return null;
      const checked = await check(out.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n"));
      after = { faq: parseFaq(checked) ?? out.faq };
      break;
    }
    case "product_seo":
      if (!out.seo_title && !out.seo_description) return null;
      after = { seoTitle: (out.seo_title ?? product.seoTitle ?? product.title).slice(0, 70), seoDescription: (out.seo_description ?? "").slice(0, 160) };
      break;
    case "product_title":
      if (!out.title || out.title === product.title) return null;
      after = { title: out.title };
      break;
    case "product_type":
      if (!out.product_type || out.product_type === product.productType) return null;
      after = { productType: out.product_type };
      break;
  }

  const missing = [note, ...out.missing_info].filter(Boolean).join("\n");
  if (missing && skipIfHeld) return null;
  return db.fix.create({
    data: {
      shopId: shop.id,
      type: idea.type,
      targetGid: product.gid,
      targetTitle: product.title,
      before: currentValues(product, idea.type) as object,
      after: after as object,
      reason: idea.reason,
      impact: idea.impact,
      questionIds: questions.map((q) => q.id),
      missingInfo: missing || null,
    },
  });
}

/** What the product looks like right now, from our cache (shown as "before" in the preview). */
function currentValues(p: Product, type: string): Record<string, unknown> {
  switch (type) {
    case "product_description":
      return { description: p.description ?? "" };
    case "product_seo":
      return { seoTitle: p.seoTitle ?? "", seoDescription: p.seoDesc ?? "" };
    case "product_title":
      return { title: p.title };
    case "product_type":
      return { productType: p.productType ?? "" };
    default:
      return {};
  }
}

async function writeGuide(
  shop: { id: string; domain: string; primaryDomain: string | null; country: string; profile: { brandName: string; summary: string } | null },
  products: Product[],
  questions: LostQuestion[],
  reason: string,
  impact: string,
  plan: ReturnType<typeof getPlan>,
  skipIfHeld = false,
): Promise<Fix | null> {
  if (!questions.length) return null;
  // The month's allowance counts every guide written since the 1st (UTC), whatever happened to it.
  if ((await countGuidePagesThisMonth(shop.id)) >= plan.guidePagesPerMonth) return null;
  const where = countryName(shop.country);
  const slug = questions[0].text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  const list = products.slice(0, 15).map((p) => `- ${p.title} | ${trackedProductUrl(shop, p.handle, "ai-guide", slug)} | ${(p.description ?? "").slice(0, 200)}`);

  const out = await askJson({
    schema: GuideSchema,
    tier: "smart",
    label: "fix-guide",
    shopId: shop.id,
    maxTokens: 8000,
    system: `You write helpful, honest buying guides for a store's own website. The guide explains how to choose, then shows the store's own suitable products. It must be genuinely useful even to someone who doesn't buy.\n${GUARDRAILS}`,
    prompt: `Store: ${shop.profile?.brandName} (${where}). ${shop.profile?.summary}

Write one guide page (400-700 words) that answers these shopper questions:
${questions.map((q) => `- ${q.text}`).join("\n")}

Structure: short intro; "What to look for" (3-5 points); "Our picks" featuring 2-4 relevant products from the list below (link each with its exact URL); short FAQ (3 questions). Mention shipping in ${where} only if it's in the store info.

Products (title | link | description):
${list.join("\n")}`,
  });

  const checked = HEALTH_WORDS.test(`${shop.profile?.summary}`) ? await claimsCheck(shop.id, out.body_html) : { text: out.body_html, note: null };
  const missing = [checked.note, ...out.missing_info].filter(Boolean).join("\n");
  if (missing && skipIfHeld) return null;
  return db.fix.create({
    data: {
      shopId: shop.id,
      type: "guide_page",
      targetGid: null,
      targetTitle: out.title,
      before: {},
      after: { title: out.title, handle: out.handle.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 80), bodyHtml: checked.text },
      reason,
      impact: impact as string,
      questionIds: questions.map((q) => q.id),
      missingInfo: missing || null,
    },
  });
}

// ---------- Apply & undo ----------

const PRODUCT_FOR_FIX = `#graphql
  query ProductForFix($id: ID!) {
    product(id: $id) {
      id title handle descriptionHtml productType onlineStoreUrl
      seo { title description }
      metafield(namespace: "geo", key: "faq") { id value }
    }
  }`;
const PRODUCT_UPDATE = `#graphql
  mutation UpdateProduct($product: ProductUpdateInput!) {
    productUpdate(product: $product) { product { id title } userErrors { field message } }
  }`;
const METAFIELDS_SET = `#graphql
  mutation SetMeta($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) { metafields { id key namespace } userErrors { field message } }
  }`;
const METAFIELDS_DELETE = `#graphql
  mutation DelMeta($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) { deletedMetafields { key } userErrors { field message } }
  }`;
const PAGE_CREATE = `#graphql
  mutation CreatePage($page: PageCreateInput!) {
    pageCreate(page: $page) { page { id handle title } userErrors { field message } }
  }`;
const PAGE_DELETE = `#graphql
  mutation DeletePage($id: ID!) {
    pageDelete(id: $id) { deletedPageId userErrors { field message } }
  }`;

async function productUpdate(admin: AdminClient, product: Record<string, unknown>) {
  const data = await gql(admin, PRODUCT_UPDATE, { product });
  assertNoUserErrors(data.productUpdate);
}

async function setFaq(admin: AdminClient, ownerId: string, faq: unknown) {
  const data = await gql(admin, METAFIELDS_SET, {
    metafields: [{ ownerId, namespace: "geo", key: "faq", type: "json", value: typeof faq === "string" ? faq : JSON.stringify(faq) }],
  });
  assertNoUserErrors(data.metafieldsSet);
}

export async function applyFix(fixId: string, admin: AdminClient) {
  const fix = await db.fix.findUniqueOrThrow({ where: { id: fixId }, include: { shop: true } });
  if (fix.status === "applied") return fix;
  const after = fix.after as FixAfter;

  try {
    if (fix.type === "guide_page") {
      const data = await gql(admin, PAGE_CREATE, {
        page: { title: after.title, handle: after.handle, body: after.bodyHtml, isPublished: true },
      });
      assertNoUserErrors(data.pageCreate);
      const page = data.pageCreate.page;
      return db.fix.update({
        where: { id: fix.id },
        data: {
          status: "applied",
          appliedAt: new Date(),
          error: null,
          resultGid: page.id,
          resultUrl: `${storeUrl(fix.shop)}/pages/${page.handle}`,
        },
      });
    }

    const plan = getPlan(fix.shop.plan);
    const usage = await getUsageFor(fix.shopId);
    const product = await db.product.findFirst({ where: { shopId: fix.shopId, gid: fix.targetGid! } });
    if (!canOptimiseProduct(plan, usage, Boolean(product?.optimisedAt))) {
      throw new Error(`Your plan covers ${plan.products} optimised products. Upgrade to change more.`);
    }

    const live = (await gql(admin, PRODUCT_FOR_FIX, { id: fix.targetGid })).product;
    if (!live) throw new Error("This product no longer exists in your store.");
    const before: FixBefore = {
      title: live.title,
      descriptionHtml: live.descriptionHtml,
      productType: live.productType,
      seo: live.seo,
      faq: live.metafield?.value ?? null,
    };

    switch (fix.type) {
      case "product_description":
        await productUpdate(admin, { id: live.id, descriptionHtml: after.descriptionHtml });
        break;
      case "product_title":
        await productUpdate(admin, { id: live.id, title: after.title });
        break;
      case "product_seo":
        await productUpdate(admin, { id: live.id, seo: { title: after.seoTitle, description: after.seoDescription } });
        break;
      case "product_type":
        await productUpdate(admin, { id: live.id, productType: after.productType });
        break;
      case "product_faq":
        await setFaq(admin, live.id, after.faq);
        break;
      default:
        throw new Error(`Unknown fix type ${fix.type}`);
    }

    await db.product.updateMany({
      where: { shopId: fix.shopId, gid: live.id, optimisedAt: null },
      data: { optimisedAt: new Date() },
    });
    return db.fix.update({
      where: { id: fix.id },
      data: { status: "applied", appliedAt: new Date(), error: null, before: before as object, resultUrl: live.onlineStoreUrl ?? null },
    });
  } catch (err) {
    await db.fix.update({ where: { id: fix.id }, data: { error: (err as Error).message.slice(0, 500) } });
    throw err;
  }
}

export async function revertFix(fixId: string, admin: AdminClient) {
  const fix = await db.fix.findUniqueOrThrow({ where: { id: fixId } });
  if (fix.status !== "applied") return fix;
  const before = (fix.before ?? {}) as FixBefore;

  switch (fix.type) {
    case "guide_page":
      if (fix.resultGid) assertNoUserErrors((await gql(admin, PAGE_DELETE, { id: fix.resultGid })).pageDelete);
      break;
    case "product_description":
      await productUpdate(admin, { id: fix.targetGid, descriptionHtml: before.descriptionHtml ?? "" });
      break;
    case "product_title":
      await productUpdate(admin, { id: fix.targetGid, title: before.title });
      break;
    case "product_seo":
      await productUpdate(admin, { id: fix.targetGid, seo: { title: before.seo?.title ?? "", description: before.seo?.description ?? "" } });
      break;
    case "product_type":
      await productUpdate(admin, { id: fix.targetGid, productType: before.productType ?? "" });
      break;
    case "product_faq":
      if (before.faq) await setFaq(admin, fix.targetGid!, before.faq);
      else assertNoUserErrors((await gql(admin, METAFIELDS_DELETE, { metafields: [{ ownerId: fix.targetGid, namespace: "geo", key: "faq" }] })).metafieldsDelete);
      break;
  }
  return db.fix.update({ where: { id: fix.id }, data: { status: "reverted", revertedAt: new Date() } });
}

// ---------- Jobs ----------

registerJob("fixes.generate", async (job) => {
  const { scanId } = job.payload as { scanId?: string };
  const scan = scanId
    ? await db.scan.findUnique({ where: { id: scanId } })
    : await db.scan.findFirst({ where: { shopId: job.shopId!, status: "done" }, orderBy: { startedAt: "desc" } });
  if (!scan) return;
  const n = await generateFixes(job.shopId!, scan.id);
  console.log(`[fixes] ${n} new suggestions for shop ${job.shopId}`);
  // Autopilot runs after every round, new fixes or not (earlier ones may be waiting on a retry).
  const shop = await db.shop.findUnique({ where: { id: job.shopId! } });
  if (shop?.autopilot && getPlan(shop.plan).autopilot) await queueAutopilot(shop.id);
});

/** The text a fix would put live, by field (what the claims check reads before autopilot applies it). */
function liveText(fix: Fix): { key: string; text: string }[] {
  const a = fix.after as Record<string, unknown>;
  const fields: Record<string, string[]> = {
    guide_page: ["bodyHtml"],
    product_description: ["descriptionHtml"],
    product_title: ["title"],
    product_seo: ["seoTitle", "seoDescription"],
  };
  if (fix.type === "product_faq") {
    const faq = Array.isArray(a.faq) ? (a.faq as { q: string; a: string }[]) : [];
    return faq.length ? [{ key: "faq", text: faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n") }] : [];
  }
  return (fields[fix.type] ?? [])
    .map((key) => ({ key, text: typeof a[key] === "string" ? (a[key] as string) : "" }))
    .filter((f) => f.text.trim());
}

/**
 * Autopilot's claims check: always run, whatever the store sells (health words or not). If anything had
 * to be softened, save the softer wording, explain it and leave the fix waiting for the store. Returns
 * true when the fix is clear to go live. Throws if the check can't run (the fix then waits for a retry).
 */
export async function clearForAutopilot(fix: Fix): Promise<boolean> {
  const after = { ...(fix.after as Record<string, unknown>) };
  const notes: string[] = [];
  for (const { key, text } of liveText(fix)) {
    const checked = await claimsCheck(fix.shopId, text);
    if (!checked.note) continue;
    notes.push(checked.note);
    after[key] = key === "faq" ? (parseFaq(checked.text) ?? after.faq) : checked.text;
  }
  if (!notes.length) return true;
  await db.fix.update({
    where: { id: fix.id },
    data: { after: after as object, missingInfo: [fix.missingInfo, ...notes].filter(Boolean).join("\n") },
  });
  return false;
}

registerJob("fixes.autopilot", async (job) => {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: job.shopId! } });
  if (!shop.autopilot || !getPlan(shop.plan).autopilot) return;
  const admin = await adminFor(shop.domain);
  // Fixes that need facts from the store (or that the claims check softened before) wait for a person.
  const pending = await db.fix.findMany({ where: { shopId: shop.id, status: "pending", missingInfo: null } });
  for (const fix of pending) {
    try {
      if (await clearForAutopilot(fix)) await applyFix(fix.id, admin);
    } catch (err) {
      console.error(`[autopilot] ${fix.id}: ${(err as Error).message}`);
    }
  }
});
