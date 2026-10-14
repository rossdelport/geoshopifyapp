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
import { countryName, syncCatalog } from "./onboarding.server";
import { parseFaq } from "./faq";
import { costThisMonth } from "./cost.server";
import { mainCluster, rankLost } from "./clusters";
import { MATERIAL, SIZE, keyFactsNearTop, looksEnglish } from "./ai-ready";
import {
  applyClaimsText,
  buildAllowlist,
  buildGuideHtml,
  faqFromGuideHtml,
  filterSourceLinks,
  guideClaimsText,
  guideContentText,
  guideProblems,
  guideProductHandles,
  relatedBlock,
  setRelatedBlock,
  setUpdatedLine,
  tidyDashes,
  tidyGuide,
  type GuideDraft,
  type GuideLink,
  type GuideProductLink,
} from "./guide";

export { FIX_TYPE_LABELS } from "./fix-labels";
import type { FaqItem, FixAfter, FixBefore } from "./fix-labels";

/** What a refresh keeps for undo: the live page body (guides) or FAQ (products), and the last refresh date. */
type RefreshBefore = FixBefore & { bodyHtml?: string; refreshedAt?: string | null };

const DAY = 86_400_000;

// Autopilot (Done-for-you, on unless the store switches it off) applies every kind of fix: "fixes applied
// for you, still skipping risky claims". Before it applies one, it runs the claims check on the text that
// would go live; anything the check had to soften waits for the store, as does any fix that needs facts
// from the store (missingInfo). Every change keeps its old values for one-click undo.
const HEALTH_WORDS = /skin|beauty|groom|beard|hair|supplement|vitamin|health|cosmetic|wellness|baby|pet|food|nutrition|protein|tea|oil|cream|serum|balm/i;

/**
 * The writing rules for every fix. Stores sell worldwide: copy goes out in the language the store's own
 * product data is written in (never English over a German or French catalogue), and English copy is
 * spelled the way the store's country spells.
 */
export function guardrails(country: string) {
  return `Rules you must follow:
- Only use facts that appear in the product data or store profile. Never invent ingredients, materials, sizes, certifications, awards, reviews, ratings, statistics or prices.
- If a helpful fact is missing, do not guess: add a short question for the store owner to missing_info instead.
- No medical or therapeutic claims (do not say a product treats, cures, heals, prevents or relieves a condition). Describe cosmetic benefits only, like "softens" or "moisturises".
- No fake urgency, no put-downs of other brands, no keyword stuffing.
- Write in the same language as the store's product data (usually English). Plain, friendly words and short sentences; in English, spell words the way shoppers in ${countryName(country)} spell.`;
}

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

// Strict question-and-answer guide (see guide.ts). Claude never writes HTML or links: we build both.
export const GuideSchema = z.object({
  question: z.string().describe("The shopper's question, as they would ask an AI assistant. This is the page title (H1)."),
  handle: z.string().describe("url-friendly, lowercase, hyphens"),
  short_answer: z.string().describe("2 to 3 sentences that answer the question directly and make sense on their own"),
  sections: z
    .array(z.object({ question: z.string().describe("A real buyer question"), answer: z.string().describe("One self-contained paragraph") }))
    .describe("4 to 6 sections"),
  picks: z
    .array(z.object({ product_index: z.number().int().describe("Index from the product list"), why: z.string().describe("One sentence: why it fits, from the product data only") }))
    .describe("1 to 4 of the store's products that fit"),
  source_urls: z.array(z.string()).describe("URLs from the allowed sources list that you used facts from; may be empty"),
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
  cluster: string | null;
  longTail: boolean;
}

/**
 * The questions AI names the store in least (under half the answers), ranked by how rarely it's named
 * and spread across topic clusters, with search volume only breaking ties (clusters.ts rankLost): the
 * specific questions that win often have no measurable volume. At most 10.
 */
async function lostQuestions(scanId: string): Promise<LostQuestion[]> {
  const answers = await db.aiAnswer.findMany({
    where: { scanId, status: "parsed" },
    include: { question: true, mentions: { where: { isMerchant: false }, orderBy: { position: "asc" }, take: 3 } },
  });
  const byQ = new Map<
    string,
    { text: string; volume: number | null; cluster: string | null; longTail: boolean; n: number; named: number; winners: Map<string, number> }
  >();
  for (const a of answers) {
    const g = byQ.get(a.questionId) ?? {
      text: a.question.text,
      volume: a.question.volume,
      cluster: a.question.cluster,
      longTail: a.question.longTail,
      n: 0,
      named: 0,
      winners: new Map(),
    };
    g.n++;
    if (a.mentioned) g.named++;
    for (const m of a.mentions) g.winners.set(m.brand, (g.winners.get(m.brand) ?? 0) + 1);
    byQ.set(a.questionId, g);
  }
  const lost = [...byQ.entries()]
    .map(([id, g]) => ({
      id,
      text: g.text,
      volume: g.volume,
      cluster: g.cluster,
      longTail: g.longTail,
      mentionRate: g.n ? g.named / g.n : 0,
      winners: [...g.winners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([b]) => b),
    }))
    .filter((q) => q.mentionRate < 0.5);
  return rankLost(lost, 10).map((q, index) => ({ ...q, index }));
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

/** The claims check's instructions for a store in `country`: that country's rules, or the strictest common ones. */
export function claimsSystem(country: string) {
  return `You check online store copy for a store that sells from ${countryName(country)}, against the advertising rules for health, beauty, supplement and wellness products and the consumer law that apply there (for example the FDA and FTC in the US, the ASA in the UK, the TGA and ACL in Australia). When unsure, use the strictest common rule. Flag therapeutic or medical claims (treats, cures, heals, prevents, relieves, clinically proven without evidence), invented facts, and misleading superlatives. Cosmetic claims like 'softens' or 'moisturises' are fine.`;
}

async function claimsCheck(shopId: string, country: string, text: string): Promise<{ text: string; note: string | null }> {
  const result = await askJson({
    schema: ClaimsSchema,
    tier: "fast",
    label: "claims-check",
    shopId,
    maxTokens: 4000,
    system: claimsSystem(country),
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
  // Guide pages are planned per topic cluster: an overview guide first, then specific guides that link to it.
  const hubs = await db.fix.findMany({
    where: { shopId, type: "guide_page", refreshOfId: null, hubFixId: null, cluster: { not: null }, status: { in: ["pending", "applied"] } },
    select: { cluster: true },
  });
  const hubTopics = [...new Set(hubs.map((h) => h.cluster!))];
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
${lost.map((q) => `${q.index}. "${q.text}"${q.longTail ? " (specific)" : ""}${q.cluster ? ` [topic: ${q.cluster}]` : ""}${q.volume ? ` (${q.volume} searches/mo)` : ""}. AI picks: ${q.winners.join(", ") || "various"}`).join("\n")}

Guide pages are planned per topic: the first guide on a topic is an overview of it, later ones each answer one specific question on that topic. Topics that already have an overview guide: ${hubTopics.join(", ") || "none yet"}.

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
        ? await writeGuide(shop, products, questions, idea.reason, idea.impact, plan, skipIfHeld, mainCluster(questions))
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
    product_description:
      "Rewrite description_html (120-250 words). The first 1 to 2 sentences must say what it is, who it is for, and the 2 or 3 key facts (size, main ingredients or materials) found in the data. Say who it's for in plain words like \"for dry skin\", \"for men\" or \"ideal for beginners\". No brand story or greeting first. Never add a fact that isn't in the data. Then keep every other fact, scannable: what it does, how to use it, and availability. Leave other fields null except missing_info.",
    product_faq: "Write faq: 4-6 short questions and answers a shopper would ask before buying, answered only from the product data. Leave other fields null except missing_info.",
    product_seo: "Write seo_title (max 60 chars) and seo_description (max 155 chars) that say plainly what it is and who it's for. Leave other fields null except missing_info.",
    product_title: "Write a clearer title: keep the brand and product name, add the key attribute (e.g. size or variant) only if it's in the data. Leave other fields null except missing_info.",
    product_type: "Write product_type: a short, standard category (e.g. 'Beard Oil'). Leave other fields null except missing_info.",
  };

  const write = (extra = "") =>
    askJson({
      schema: ProductWriteSchema,
      tier: "smart",
      label: `fix-${idea.type}`,
      shopId: shop.id,
      maxTokens: 6000,
      system: `You improve Shopify product pages so AI shopping assistants understand and recommend them.\n${guardrails(shop.country)}\n- Never use an em dash or a spaced en dash.`,
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

Task: ${want[idea.type]}${extra}`,
    }).then(tidyProductWrite);

  let out = await write();
  // Answer first: AI quotes the top of a description, so the first two sentences must say who it's for
  // and the key facts. One retry when the data has those facts; otherwise the store is asked for them.
  const source = `${product.title} ${product.productType ?? ""} ${(product.tags as string[]).join(" ")} ${product.description ?? ""}`;
  const dataHasFacts = SIZE.test(source) || MATERIAL.test(source);
  let answerFirstNote: string | null = null;
  // The check reads English phrases, so it only runs when the new description is English (one written
  // in German for a German catalogue would always "fail" it, costing a retry and a wrong note). The
  // draft is read rather than the product data, which is often too terse to tell.
  const checkable = looksEnglish(out.description_html ?? "");
  if (idea.type === "product_description" && checkable && out.description_html && !keyFactsNearTop(out.description_html).pass) {
    if (dataHasFacts) {
      const retry = await write(
        "\n\nYour last draft didn't open with the key facts. Start again: the first sentence says what it is and who it's for; the second gives the size and main ingredients or materials from the data.",
      );
      if (retry.description_html) out = retry;
    }
    if (out.description_html && !keyFactsNearTop(out.description_html).pass) {
      answerFirstNote = dataHasFacts
        ? "The first two sentences don't yet say who it's for and its key facts (size, ingredients or materials). Please check the opening before approving."
        : "Your product data doesn't give a size, ingredients or materials, so the description can't open with them. Add them to the product if you can, and we'll use them.";
    }
  }

  let after: Record<string, unknown> = {};
  let note: string | null = null;
  const check = async (text: string) => {
    if (!HEALTH_WORDS.test(`${shop.profile?.category} ${product.productType} ${product.title}`)) return text;
    const c = await claimsCheck(shop.id, shop.country, text);
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

  const missing = [note, answerFirstNote, ...out.missing_info].filter(Boolean).join("\n");
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

/** House style on everything Claude writes for a product: no em dashes or spaced en dashes. */
export function tidyProductWrite<T extends z.infer<typeof ProductWriteSchema>>(out: T): T {
  const t = (v: string | null) => (v === null ? null : tidyDashes(v));
  return {
    ...out,
    title: t(out.title),
    description_html: t(out.description_html),
    seo_title: t(out.seo_title),
    seo_description: t(out.seo_description),
    product_type: t(out.product_type),
    faq: out.faq ? out.faq.map((f) => ({ q: tidyDashes(f.q), a: tidyDashes(f.a) })) : null,
  };
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

/** The store's own pages a guide may cite: the home page (read at onboarding) and the catalog's product pages. */
export function guideSourceUrls(shop: { primaryDomain: string | null; domain: string; profile: { brandName: string } | null }, products: Product[]) {
  const base = storeUrl(shop);
  return [
    { url: `${base}/`, label: `${shop.profile?.brandName ?? "Store"} home page` },
    ...products.map((p) => ({ url: `${base}/products/${p.handle}`, label: p.title })),
  ];
}

async function writeGuide(
  shop: { id: string; domain: string; primaryDomain: string | null; country: string; profile: { brandName: string; summary: string } | null },
  products: Product[],
  questions: LostQuestion[],
  reason: string,
  impact: string,
  plan: ReturnType<typeof getPlan>,
  skipIfHeld = false,
  cluster: string | null = null,
): Promise<Fix | null> {
  if (!questions.length) return null;
  // The month's allowance counts every guide written since the 1st (UTC), whatever happened to it.
  if ((await countGuidePagesThisMonth(shop.id)) >= plan.guidePagesPerMonth) return null;
  const where = countryName(shop.country);
  // Topic clusters: the first guide on a topic is its hub (an overview); later ones are specific guides
  // that link back to it. Links are added when pages go live (applyFix), never in the draft.
  const hub = cluster
    ? await db.fix.findFirst({
        where: { shopId: shop.id, type: "guide_page", cluster, hubFixId: null, refreshOfId: null, status: { in: ["pending", "applied"] } },
        orderBy: { createdAt: "asc" },
      })
    : null;
  const role: "single" | "hub" | "spoke" = !cluster ? "single" : hub ? "spoke" : "hub";
  if (role === "spoke") questions = [...questions].sort((a, b) => Number(b.longTail) - Number(a.longTail));
  const roleNote =
    role === "hub"
      ? `\nThis is the overview guide for the topic "${cluster}": answer the broad question and how to choose. More specific guides on this topic will link to it.`
      : role === "spoke"
        ? `\nThis guide answers one specific question on the topic "${cluster}". It sits under the overview guide "${hub!.targetTitle}", so don't repeat the overview: go deep on this question.`
        : "";
  const slug = questions[0].text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
  const shortlist = products.slice(0, 15);
  const links: GuideProductLink[] = shortlist.map((p) => ({ title: p.title, url: trackedProductUrl(shop, p.handle, "ai-guide", slug) }));
  const allowed = guideSourceUrls(shop, shortlist);

  const out = await askJson({
    schema: GuideSchema,
    tier: "smart",
    label: "fix-guide",
    shopId: shop.id,
    maxTokens: 8000,
    system: `You write helpful, honest buying guides for a store's own website, in strict question-and-answer form, so AI assistants can quote any part on its own. It must be genuinely useful even to someone who doesn't buy.\n${guardrails(shop.country)}\n- Plain text only: no HTML, no markdown, no links or URLs in any answer.\n- Never use an em dash or a spaced en dash.`,
    prompt: `Store: ${shop.profile?.brandName} (${where}). ${shop.profile?.summary}

Write one guide page (400-700 words) that answers these shopper questions:
${questions.map((q) => `- ${q.text}`).join("\n")}
${roleNote}

Structure:
- question: the main shopper question, worded the way a shopper asks an AI assistant. It becomes the page title.
- short_answer: 2 to 3 sentences that answer it directly and make sense on their own.
- sections: 4 to 6 real buyer questions (how to choose, what to look for, who it suits, how to use, sizes) each answered in one self-contained paragraph. Never refer to other sections ("as mentioned above", "see below").
- picks: 1 to 4 relevant products from the list below, by index, each with one sentence on why it fits (only facts from its description).
- source_urls: only URLs copied exactly from "Allowed sources" whose facts you used. Never any other URL.
Mention shipping in ${where} only if it's in the store info.

Products (index. title: description):
${shortlist.map((p, i) => `${i}. ${p.title}: ${(p.description ?? "").slice(0, 200)}`).join("\n")}

Allowed sources (the only URLs you may list):
${allowed.map((a) => `- ${a.url}`).join("\n")}`,
  });

  let draft = tidyGuide(
    {
      question: out.question,
      shortAnswer: out.short_answer,
      sections: out.sections,
      picks: out.picks.map((p) => ({ productIndex: p.product_index, why: p.why })),
      sources: out.source_urls,
    },
    shortlist.length,
  );
  const problems = guideProblems(draft);
  if (problems.blocking.length) {
    console.warn(`[fixes] guide skipped: ${problems.blocking.join(" ")}`);
    return null;
  }

  let claimsNote: string | null = null;
  if (HEALTH_WORDS.test(`${shop.profile?.summary}`)) {
    const original = guideClaimsText(draft);
    const checked = await claimsCheck(shop.id, shop.country, original);
    claimsNote = checked.note;
    if (checked.text !== original) {
      const softened = applyClaimsText(draft, parseFaq(checked.text));
      if (softened) draft = tidyGuide(softened, shortlist.length);
      else claimsNote = `Please check this wording before it goes live: ${checked.note ?? "some phrases may read as claims"}`;
    }
  }

  // Sources: only the store's own pages we know about. Anything else Claude listed is dropped.
  const sources = filterSourceLinks(draft.sources, buildAllowlist(allowed));
  const bodyHtml = buildGuideHtml(draft, links, sources);
  const missing = [claimsNote, ...problems.notes, ...out.missing_info].filter(Boolean).join("\n");
  if (missing && skipIfHeld) return null;
  return db.fix.create({
    data: {
      shopId: shop.id,
      type: "guide_page",
      targetGid: null,
      targetTitle: draft.question,
      before: {},
      after: { title: draft.question, handle: out.handle.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 80), bodyHtml },
      reason,
      impact: impact as string,
      questionIds: questions.map((q) => q.id),
      missingInfo: missing || null,
      cluster,
      hubFixId: role === "spoke" ? hub!.id : null,
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
const PAGE_READ = `#graphql
  query PageForFix($id: ID!) {
    page(id: $id) { id title handle body }
  }`;
const PAGE_UPDATE = `#graphql
  mutation UpdatePage($id: ID!, $page: PageUpdateInput!) {
    pageUpdate(id: $id, page: $page) { page { id handle } userErrors { field message } }
  }`;

interface LivePage {
  id: string;
  title: string;
  handle: string;
  body: string;
}

async function readPage(admin: AdminClient, id: string): Promise<LivePage | null> {
  return ((await gql(admin, PAGE_READ, { id })) as { page: LivePage | null }).page;
}

async function updatePage(admin: AdminClient, id: string, page: { body: string; title?: string }) {
  assertNoUserErrors((await gql(admin, PAGE_UPDATE, { id, page })).pageUpdate);
}

/** The guide's Q&A pairs in the page metafield geo.faq (the theme embed turns them into FAQPage data). */
async function setPageFaq(admin: AdminClient, pageId: string, title: string, body: string) {
  const faq = faqFromGuideHtml(title, body);
  if (faq.length) await setFaq(admin, pageId, faq);
}

// ---------- Topic clusters: links between live guides ----------

const isLive = (f: Pick<Fix, "status" | "resultUrl" | "revertedAt">) => f.status === "applied" && Boolean(f.resultUrl) && !f.revertedAt;

/**
 * The links block a guide should carry now: a specific guide links back to its hub, a hub lists its
 * specific guides, and only guides that are live right now count.
 */
async function relatedFor(fix: Pick<Fix, "id" | "shopId" | "cluster" | "hubFixId">): Promise<string> {
  if (fix.hubFixId) {
    const hub = await db.fix.findUnique({ where: { id: fix.hubFixId } });
    return hub && isLive(hub) ? relatedBlock("spoke", [{ title: hub.targetTitle ?? "Our guide", url: hub.resultUrl! }]) : "";
  }
  if (!fix.cluster) return "";
  const spokes = await db.fix.findMany({
    where: { shopId: fix.shopId, hubFixId: fix.id, type: "guide_page", refreshOfId: null, status: "applied", revertedAt: null, resultUrl: { not: null } },
    orderBy: { appliedAt: "asc" },
  });
  const links: GuideLink[] = spokes.map((s) => ({ title: s.targetTitle ?? "Guide", url: s.resultUrl! }));
  return relatedBlock("hub", links);
}

/**
 * After a guide goes live or is undone, rebuild the links block on the live pages that link to it: its
 * hub (for a specific guide), or its specific guides (for a hub). Each page's own body is read from
 * Shopify right before the write and only our block changes. Best effort: a page we can't update keeps
 * its old links until the next change.
 */
async function updateLinkedPages(fix: Pick<Fix, "id" | "shopId" | "cluster" | "hubFixId">, admin: AdminClient) {
  const others = fix.hubFixId
    ? await db.fix.findMany({ where: { id: fix.hubFixId } })
    : fix.cluster
      ? await db.fix.findMany({ where: { shopId: fix.shopId, hubFixId: fix.id, type: "guide_page", refreshOfId: null } })
      : [];
  for (const page of others.filter((o) => isLive(o) && o.resultGid)) {
    try {
      const live = await readPage(admin, page.resultGid!);
      if (!live) continue;
      const body = setRelatedBlock(live.body ?? "", await relatedFor(page));
      if (body !== live.body) await updatePage(admin, live.id, { body });
    } catch (err) {
      console.error(`[fixes] couldn't update links on ${page.resultUrl}: ${(err as Error).message}`);
    }
  }
}

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
      if (fix.refreshOfId) return await applyGuideRefresh(fix, admin);
      // Live now: the "Updated <Month Year>" line, and links to the guides on this topic that are live.
      const now = new Date();
      const body = setUpdatedLine(setRelatedBlock(after.bodyHtml ?? "", await relatedFor(fix)), now);
      // The Q&A pairs also go in the page metafield geo.faq, read from the HTML that goes live. The theme
      // app embed "AI-ready guide data" turns them into FAQPage structured data (the same way product
      // FAQs work). Deleting the page on undo deletes the metafield with it.
      const faq = faqFromGuideHtml(after.title ?? "", body);
      const data = await gql(admin, PAGE_CREATE, {
        page: {
          title: after.title,
          handle: after.handle,
          body,
          isPublished: true,
          ...(faq.length ? { metafields: [{ namespace: "geo", key: "faq", type: "json", value: JSON.stringify(faq) }] } : {}),
        },
      });
      assertNoUserErrors(data.pageCreate);
      const page = data.pageCreate.page;
      const applied = await db.fix.update({
        where: { id: fix.id },
        data: {
          status: "applied",
          appliedAt: now,
          error: null,
          resultGid: page.id,
          resultUrl: `${storeUrl(fix.shop)}/pages/${page.handle}`,
        },
      });
      await updateLinkedPages(applied, admin);
      return applied;
    }

    const plan = getPlan(fix.shop.plan);
    const usage = await getUsageFor(fix.shopId);
    const product = await db.product.findFirst({ where: { shopId: fix.shopId, gid: fix.targetGid! } });
    if (!canOptimiseProduct(plan, usage, Boolean(product?.optimisedAt))) {
      throw new Error(`Your plan covers ${plan.products} optimised products. Upgrade to change more.`);
    }

    const live = (await gql(admin, PRODUCT_FOR_FIX, { id: fix.targetGid })).product;
    if (!live) throw new Error("This product no longer exists in your store.");
    const original = fix.refreshOfId ? await db.fix.findUnique({ where: { id: fix.refreshOfId } }) : null;
    if (fix.refreshOfId) {
      if (!original || original.status !== "applied") throw new RefreshOutdated("The FAQs this updates are no longer live, so there's nothing to update.");
      // Never overwrite FAQs the store changed after we wrote this update.
      if (!sameFaqText(live.metafield?.value ?? null, (fix.before as RefreshBefore).faq ?? null)) {
        throw new RefreshOutdated("These FAQs were changed in your store after we wrote this update, so we didn't overwrite them.");
      }
    }
    const before: RefreshBefore = {
      title: live.title,
      descriptionHtml: live.descriptionHtml,
      productType: live.productType,
      seo: live.seo,
      faq: live.metafield?.value ?? null,
      ...(original ? { refreshedAt: original.refreshedAt?.toISOString() ?? null } : {}),
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
    const now = new Date();
    if (original) await db.fix.update({ where: { id: original.id }, data: { refreshedAt: now } });
    return db.fix.update({
      where: { id: fix.id },
      data: { status: "applied", appliedAt: now, error: null, before: before as object, resultUrl: live.onlineStoreUrl ?? null },
    });
  } catch (err) {
    // An update written before the store changed the page (or undid it): retire it, a fresh one comes next cycle.
    const outdated = err instanceof RefreshOutdated;
    await db.fix.update({ where: { id: fix.id }, data: { error: (err as Error).message.slice(0, 500), ...(outdated ? { status: "failed" } : {}) } });
    throw err;
  }
}

/** A refresh that can't go live any more (the page changed or was undone since it was written). */
class RefreshOutdated extends Error {}

/** Two FAQs (JSON strings or lists) with the same questions and answers, ignoring case and spacing. */
export function sameFaqText(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): string => {
    let list: unknown = v;
    if (typeof v === "string") {
      try {
        list = JSON.parse(v);
      } catch {
        return v.toLowerCase().replace(/\s+/g, " ").trim();
      }
    }
    if (!Array.isArray(list)) return "";
    return (list as FaqItem[])
      .map((f) => `${f?.q ?? ""} ${f?.a ?? ""}`)
      .join(" ")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  };
  return norm(a) === norm(b);
}

/**
 * Put a guide refresh live: the refreshed Q&A in place on the same page (pageUpdate), with today's
 * "Updated" line and the topic's current links. Skipped if the store changed the page after the
 * refresh was written. Keeps the live body for undo.
 */
async function applyGuideRefresh(fix: Fix & { shop: { primaryDomain: string | null; domain: string } }, admin: AdminClient) {
  const original = await db.fix.findUnique({ where: { id: fix.refreshOfId! } });
  if (!original || !isLive(original) || !original.resultGid) throw new RefreshOutdated("The guide this updates is no longer live, so there's nothing to update.");
  const live = await readPage(admin, original.resultGid);
  if (!live) throw new RefreshOutdated("This guide's page no longer exists in your store.");
  const wroteFrom = (fix.before as RefreshBefore).bodyHtml;
  if (wroteFrom !== undefined && guideContentText(wroteFrom) !== guideContentText(live.body ?? "")) {
    throw new RefreshOutdated("This page was changed in your store after we wrote this update, so we didn't overwrite it.");
  }
  const after = fix.after as FixAfter;
  const now = new Date();
  const body = setUpdatedLine(setRelatedBlock(after.bodyHtml ?? "", await relatedFor(original)), now);
  await updatePage(admin, live.id, { body });
  await setPageFaq(admin, live.id, live.title, body);
  await db.fix.update({ where: { id: original.id }, data: { refreshedAt: now } });
  const before: RefreshBefore = { title: live.title, bodyHtml: live.body ?? "", refreshedAt: original.refreshedAt?.toISOString() ?? null };
  return db.fix.update({
    where: { id: fix.id },
    data: { status: "applied", appliedAt: now, error: null, before: before as object, resultGid: original.resultGid, resultUrl: original.resultUrl },
  });
}

/** Undo a refresh: the previous version back in place (with the topic's current links), or nothing to do if the page has gone. */
async function revertRefresh(fix: Fix, admin: AdminClient) {
  const before = (fix.before ?? {}) as RefreshBefore;
  // Updates come off newest first: undoing an older one under a newer live one would put stale content
  // back under a fix still marked live (and undoing the newer one next would bring the older back).
  const newer = await db.fix.findFirst({
    where: { shopId: fix.shopId, refreshOfId: fix.refreshOfId, status: "applied", id: { not: fix.id }, appliedAt: { gt: fix.appliedAt ?? new Date(0) } },
    select: { id: true },
  });
  if (newer) throw new Error("A newer update of this page is live. Undo that one first.");
  const original = await db.fix.findUnique({ where: { id: fix.refreshOfId! } });
  if (original && original.status === "applied") {
    if (fix.type === "guide_page" && original.resultGid && before.bodyHtml !== undefined) {
      const live = await readPage(admin, original.resultGid);
      if (live) {
        const body = setRelatedBlock(before.bodyHtml, await relatedFor(original));
        await updatePage(admin, live.id, { body });
        await setPageFaq(admin, live.id, live.title, body);
      }
    } else if (fix.type === "product_faq" && fix.targetGid) {
      if (before.faq) await setFaq(admin, fix.targetGid, before.faq);
      else assertNoUserErrors((await gql(admin, METAFIELDS_DELETE, { metafields: [{ ownerId: fix.targetGid, namespace: "geo", key: "faq" }] })).metafieldsDelete);
    }
    await db.fix.update({ where: { id: original.id }, data: { refreshedAt: before.refreshedAt ? new Date(before.refreshedAt) : null } });
  }
  return db.fix.update({ where: { id: fix.id }, data: { status: "reverted", revertedAt: new Date() } });
}

export async function revertFix(fixId: string, admin: AdminClient) {
  const fix = await db.fix.findUniqueOrThrow({ where: { id: fixId } });
  if (fix.status !== "applied") return fix;
  if (fix.refreshOfId) return revertRefresh(fix, admin);
  const before = (fix.before ?? {}) as FixBefore;

  switch (fix.type) {
    case "guide_page": {
      if (fix.resultGid) assertNoUserErrors((await gql(admin, PAGE_DELETE, { id: fix.resultGid })).pageDelete);
      // The page is gone, with any refreshes of it; then the guides that linked to it drop the link.
      const now = new Date();
      await db.fix.updateMany({ where: { refreshOfId: fix.id, status: "applied" }, data: { status: "reverted", revertedAt: now } });
      const reverted = await db.fix.update({ where: { id: fix.id }, data: { status: "reverted", revertedAt: now } });
      await updateLinkedPages(reverted, admin);
      return reverted;
    }
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
      // Its refreshes went with it.
      await db.fix.updateMany({ where: { refreshOfId: fix.id, status: "applied" }, data: { status: "reverted", revertedAt: new Date() } });
      break;
  }
  return db.fix.update({ where: { id: fix.id }, data: { status: "reverted", revertedAt: new Date() } });
}

/** Skip a waiting fix. A skipped refresh restarts its page's cycle (looked at again in 60 to 90 days, not tomorrow). */
export async function rejectFix(fix: Pick<Fix, "id" | "shopId" | "refreshOfId">, now = new Date()) {
  await db.fix.update({ where: { id: fix.id }, data: { status: "rejected" } });
  if (fix.refreshOfId) await db.fix.updateMany({ where: { id: fix.refreshOfId, shopId: fix.shopId }, data: { refreshedAt: now } });
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
  const shop = await db.shop.findUniqueOrThrow({ where: { id: fix.shopId }, select: { country: true } });
  for (const { key, text } of liveText(fix)) {
    const checked = await claimsCheck(fix.shopId, shop.country, text);
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
  if (shop.source === "web") return; // no Shopify connection: the store pastes fixes in itself
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

// ---------- Freshness: refresh guides and product FAQs every 60 to 90 days ----------
// AI assistants favour recently updated pages. Every applied guide page and product FAQ is looked at
// again once it is 60 days old (Done-for-you) or 90 days old (Standard): rebuilt from today's catalogue
// (products no longer for sale drop out, only catalogue facts), with at most 2 new questions from the
// latest scan on the same topic, and the claims check as always. Only a real change in the Q&A makes a
// refresh fix (a refresh never just bumps the date). The refresh updates the same page or metafield in
// place, keeps the live version for undo, and goes through the same approval or autopilot as any fix.
// Refreshes don't use the month's guide page allowance (usage.server.ts counts new guides only).
// Cost: one smart Claude call per refresh (about US$0.02 to 0.05) plus a fast claims check for health
// and beauty stores. At most 1 refresh a day on Standard and 3 on Done-for-you, never over the cost cap.

export const REFRESH_AFTER_DAYS: Partial<Record<string, number>> = { core: 90, pro: 60 };
export const REFRESHES_PER_DAY: Partial<Record<string, number>> = { core: 1, pro: 3 };
const MAX_NEW_QUESTIONS = 2;

export const RefreshFaqSchema = z.object({
  faq: z.array(z.object({ q: z.string(), a: z.string() })).describe("4 to 8 questions and answers, answered only from the product data"),
  missing_info: z.array(z.string()),
});

/** Applied guides and product FAQs whose last update (or first publish) is older than the plan's refresh age, oldest first. */
export async function dueForRefresh(shopId: string, planId: string, now = new Date()): Promise<Fix[]> {
  const days = REFRESH_AFTER_DAYS[planId];
  if (!days) return [];
  const cutoff = new Date(now.getTime() - days * DAY);
  const due = await db.fix.findMany({
    where: {
      shopId,
      status: "applied",
      refreshOfId: null,
      type: { in: ["guide_page", "product_faq"] },
      OR: [{ refreshedAt: { lt: cutoff } }, { refreshedAt: null, appliedAt: { lt: cutoff } }],
    },
    orderBy: [{ refreshedAt: { sort: "asc", nulls: "first" } }, { appliedAt: "asc" }],
    take: 50,
  });
  if (!due.length) return [];
  // One refresh at a time per page: skip any with a refresh still waiting.
  const waiting = await db.fix.findMany({ where: { shopId, refreshOfId: { in: due.map((f) => f.id) }, status: "pending" }, select: { refreshOfId: true } });
  const busy = new Set(waiting.map((w) => w.refreshOfId));
  return due.filter((f) => !busy.has(f.id));
}

const sameQuestion = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Up to 2 questions from the latest scan on this topic that AI rarely names the store in and the page doesn't answer yet. */
async function newQuestionsFor(shopId: string, cluster: string | null, answered: string[]): Promise<LostQuestion[]> {
  if (!cluster) return [];
  const scan = await db.scan.findFirst({ where: { shopId, status: "done" }, orderBy: { startedAt: "desc" }, select: { id: true } });
  if (!scan) return [];
  return (await lostQuestions(scan.id)).filter((q) => q.cluster === cluster && !answered.some((a) => sameQuestion(a, q.text))).slice(0, MAX_NEW_QUESTIONS);
}

/** Mark a guide or FAQ as looked at today, so the cycle starts again (also when nothing needed changing). */
const markRefreshed = (fixId: string, now: Date) => db.fix.update({ where: { id: fixId }, data: { refreshedAt: now } });

/** What the app last put live for a guide or FAQ: its newest live refresh, else the fix itself. */
async function lastWritten(fix: Fix): Promise<FixAfter> {
  const refresh = await db.fix.findFirst({
    where: { shopId: fix.shopId, refreshOfId: fix.id, status: "applied" },
    orderBy: { appliedAt: "desc" },
    select: { after: true },
  });
  return ((refresh ?? fix).after ?? {}) as FixAfter;
}

/**
 * The store deleted a guide's page in Shopify: mark it (and its updates) undone, and take its link off
 * the guides on the same topic, so no live page links to a page that's gone.
 */
async function retireDeletedGuide(fix: Fix, admin: AdminClient, now: Date) {
  await db.fix.updateMany({ where: { shopId: fix.shopId, refreshOfId: fix.id, status: "applied" }, data: { status: "reverted", revertedAt: now } });
  const gone = await db.fix.update({ where: { id: fix.id }, data: { status: "reverted", revertedAt: now, refreshedAt: now } });
  await updateLinkedPages(gone, admin);
}

type ShopForFix = { id: string; domain: string; primaryDomain: string | null; country: string; profile: { brandName: string; summary: string; category: string } | null };

/** Rebuild an applied guide from today's catalogue and its live page. Returns the refresh fix, or null when nothing changed. */
export async function refreshGuide(shop: ShopForFix, fix: Fix, admin: AdminClient, now = new Date()): Promise<Fix | null> {
  if (!fix.resultGid) return null;
  const live = await readPage(admin, fix.resultGid);
  if (!live) {
    await retireDeletedGuide(fix, admin, now); // the store deleted the page in Shopify
    return null;
  }
  // The store edited this page in Shopify since we last published it: it's theirs now. A rebuild keeps
  // only the questions and answers, so their own additions (pictures, paragraphs) would be lost, and
  // autopilot would publish that unseen. Leave the page alone; the cycle starts again.
  const wrote = await lastWritten(fix);
  if (typeof wrote.bodyHtml === "string" && guideContentText(wrote.bodyHtml) !== guideContentText(live.body ?? "")) {
    await markRefreshed(fix.id, now);
    return null;
  }
  const after = fix.after as FixAfter;
  const title = after.title ?? fix.targetTitle ?? live.title;
  const current = faqFromGuideHtml(title, live.body ?? "");
  const linked = guideProductHandles(live.body ?? "");
  const active = await db.product.findMany({ where: { shopId: shop.id, status: "ACTIVE" }, orderBy: { syncedAt: "desc" }, take: 60 });
  // The products it featured come first, when they are still for sale; the rest of the catalogue after.
  const shortlist = [...active.filter((p) => linked.includes(p.handle)), ...active.filter((p) => !linked.includes(p.handle))].slice(0, 15);
  if (!shortlist.length) return null;
  const newQs = await newQuestionsFor(shop.id, fix.cluster, current.map((c) => c.q));
  const slug = (after.handle ?? "guide").slice(0, 50);
  const links: GuideProductLink[] = shortlist.map((p) => ({ title: p.title, url: trackedProductUrl(shop, p.handle, "ai-guide", slug) }));
  const allowed = guideSourceUrls(shop, shortlist);

  const out = await askJson({
    schema: GuideSchema,
    tier: "smart",
    label: "fix-guide-refresh",
    shopId: shop.id,
    maxTokens: 8000,
    system: `You keep a store's buying guide up to date, in strict question-and-answer form, so AI assistants can quote any part on its own.\n${guardrails(shop.country)}\n- Plain text only: no HTML, no markdown, no links or URLs in any answer.\n- Never use an em dash or a spaced en dash.\n- Keep everything that is still right, word for word. If nothing needs to change, return the guide exactly as it is.`,
    prompt: `Store: ${shop.profile?.brandName} (${countryName(shop.country)}). ${shop.profile?.summary}

The guide today:
question: ${title}
${current.map((c, i) => (i === 0 ? `short_answer: ${c.a}` : `section: ${c.q}\n${c.a}`)).join("\n")}

Update it:
- Use only facts from the products below. They are what the store sells today: a product that isn't listed is no longer for sale, so don't feature or mention it.
- Correct anything the product data now contradicts.${newQs.length ? `\n- Add one section for each of these new shopper questions, if the products and store data can answer it honestly:\n${newQs.map((q) => `  - ${q.text}`).join("\n")}` : ""}
- Keep the same main question. 4 to 6 sections in all (drop the weakest if you add new ones).
- picks: 1 to 4 products from the list, by index, with one sentence each from the product data.
- source_urls: only URLs copied exactly from "Allowed sources" whose facts you used.

Products (index. title: description):
${shortlist.map((p, i) => `${i}. ${p.title}: ${(p.description ?? "").slice(0, 200)}`).join("\n")}

Allowed sources (the only URLs you may list):
${allowed.map((a) => `- ${a.url}`).join("\n")}`,
  });

  let draft: GuideDraft = tidyGuide(
    { question: title, shortAnswer: out.short_answer, sections: out.sections, picks: out.picks.map((p) => ({ productIndex: p.product_index, why: p.why })), sources: out.source_urls },
    shortlist.length,
  );
  const problems = guideProblems(draft);
  if (problems.blocking.length) {
    console.warn(`[fixes] guide refresh skipped: ${problems.blocking.join(" ")}`);
    await markRefreshed(fix.id, now);
    return null;
  }
  let claimsNote: string | null = null;
  if (HEALTH_WORDS.test(`${shop.profile?.summary}`)) {
    const original = guideClaimsText(draft);
    const checked = await claimsCheck(shop.id, shop.country, original);
    claimsNote = checked.note;
    if (checked.text !== original) {
      const softened = applyClaimsText(draft, parseFaq(checked.text));
      if (softened) draft = tidyGuide(softened, shortlist.length);
      else claimsNote = `Please check this wording before it goes live: ${checked.note ?? "some phrases may read as claims"}`;
    }
  }
  const sources = filterSourceLinks(draft.sources, buildAllowlist(allowed));
  const bodyHtml = buildGuideHtml(draft, links, sources);
  // Only a real change in the Q&A counts: the same words (without the date line and our links) mean no update.
  if (guideContentText(bodyHtml) === guideContentText(live.body ?? "")) {
    await markRefreshed(fix.id, now);
    return null;
  }
  const missing = [claimsNote, ...problems.notes, ...out.missing_info].filter(Boolean).join("\n");
  const before: RefreshBefore = { title: live.title, bodyHtml: live.body ?? "" };
  return db.fix.create({
    data: {
      shopId: shop.id,
      type: "guide_page",
      targetGid: null,
      targetTitle: fix.targetTitle,
      before: before as object,
      after: { title, handle: after.handle, bodyHtml },
      reason: newQs.length
        ? "An update to this guide: today's products and details, plus new questions shoppers are asking AI."
        : "An update to this guide with today's products and details. AI assistants favour pages that are kept up to date.",
      impact: "medium",
      questionIds: [...new Set([...((fix.questionIds as string[]) ?? []), ...newQs.map((q) => q.id)])],
      missingInfo: missing || null,
      cluster: fix.cluster,
      hubFixId: fix.hubFixId,
      refreshOfId: fix.id,
    },
  });
}

/** Rebuild an applied product FAQ from today's product data and its live metafield. Returns the refresh fix, or null when nothing changed. */
export async function refreshFaq(shop: ShopForFix, fix: Fix, admin: AdminClient, now = new Date()): Promise<Fix | null> {
  const product = fix.targetGid ? await db.product.findFirst({ where: { shopId: shop.id, gid: fix.targetGid } }) : null;
  if (!product || product.status !== "ACTIVE") {
    await markRefreshed(fix.id, now); // no longer for sale: nothing to refresh
    return null;
  }
  const live = (await gql(admin, PRODUCT_FOR_FIX, { id: fix.targetGid })).product;
  if (!live) {
    await markRefreshed(fix.id, now);
    return null;
  }
  const liveValue: string | null = live.metafield?.value ?? null;
  // The store changed (or removed) these FAQs since we last published them: leave them alone.
  if (!sameFaqText(liveValue, (await lastWritten(fix)).faq ?? null)) {
    await markRefreshed(fix.id, now);
    return null;
  }
  let current: FaqItem[] = [];
  try {
    current = liveValue ? (JSON.parse(liveValue) as FaqItem[]) : ((fix.after as FixAfter).faq ?? []);
  } catch {
    current = (fix.after as FixAfter).faq ?? [];
  }
  const questions = await db.question.findMany({ where: { id: { in: (fix.questionIds as string[]) ?? [] } }, select: { cluster: true } });
  const newQs = await newQuestionsFor(shop.id, mainCluster(questions), current.map((c) => c.q));

  const out = await askJson({
    schema: RefreshFaqSchema,
    tier: "smart",
    label: "fix-faq-refresh",
    shopId: shop.id,
    maxTokens: 4000,
    system: `You keep a Shopify product's FAQ up to date so AI shopping assistants can quote it.\n${guardrails(shop.country)}\n- Never use an em dash or a spaced en dash.\n- Keep every answer that is still right, word for word. If nothing needs to change, return the FAQ exactly as it is.`,
    prompt: `Store: ${shop.profile?.brandName} (${countryName(shop.country)}). ${shop.profile?.summary}

Product data today:
Title: ${product.title}
Type: ${product.productType ?? "(none)"}
Tags: ${(product.tags as string[]).join(", ")}
Price: ${product.price ?? ""}
Description:
"""
${product.description ?? "(empty)"}
"""

The FAQ today:
${current.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n") || "(empty)"}

Update it: correct any answer the product data now contradicts, and answer only from the product data.${newQs.length ? `\nAdd these new shopper questions if the product data answers them honestly:\n${newQs.map((q) => `- ${q.text}`).join("\n")}` : ""}
4 to 8 questions in all.`,
  });

  let faq = out.faq.map((f) => ({ q: tidyDashes(f.q.trim()), a: tidyDashes(f.a.trim()) })).filter((f) => f.q && f.a).slice(0, 8);
  if (faq.length < 2) {
    await markRefreshed(fix.id, now);
    return null;
  }
  let note: string | null = null;
  if (HEALTH_WORDS.test(`${shop.profile?.category} ${product.productType} ${product.title}`)) {
    const checked = await claimsCheck(shop.id, shop.country, faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n"));
    note = checked.note;
    faq = parseFaq(checked.text) ?? faq;
  }
  if (sameFaqText(faq, current)) {
    await markRefreshed(fix.id, now);
    return null;
  }
  const before: RefreshBefore = { faq: liveValue };
  return db.fix.create({
    data: {
      shopId: shop.id,
      type: "product_faq",
      targetGid: product.gid,
      targetTitle: product.title,
      before: before as object,
      after: { faq } as object,
      reason: newQs.length
        ? "An update to these FAQs: today's product details, plus new questions shoppers are asking AI."
        : "An update to these FAQs with today's product details. AI assistants favour pages that are kept up to date.",
      impact: "medium",
      questionIds: [...new Set([...((fix.questionIds as string[]) ?? []), ...newQs.map((q) => q.id)])],
      missingInfo: [note, ...out.missing_info].filter(Boolean).join("\n") || null,
      refreshOfId: fix.id,
    },
  });
}

/**
 * The daily refresh for one store: up to the plan's refreshes a day (Standard 1, Done-for-you 3), oldest
 * first, never over the month's cost cap. Returns how many refresh fixes were written (each then waits
 * for approval, or goes live through autopilot after its claims check).
 */
export async function refreshDueFixes(shopId: string, opts: { admin?: AdminClient; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, include: { profile: true } });
  const plan = getPlan(shop.plan);
  const perDay = REFRESHES_PER_DAY[plan.id] ?? 0;
  if (!perDay || shop.status !== "installed" || shop.source === "web") return 0;
  if ((await costThisMonth(shopId)) >= plan.costCapUsd) return 0;
  const due = (await dueForRefresh(shopId, plan.id, now)).slice(0, perDay);
  if (!due.length) return 0;
  const admin = opts.admin ?? (await adminFor(shop.domain));
  // Today's catalogue, not the one cached at install: products changed, archived or deleted in Shopify
  // since then (a deleted product would otherwise stay "for sale" and keep its link). If Shopify can't
  // be read, the job fails and retries later rather than refreshing from stale facts.
  await syncCatalog(shopId, admin, 1000);
  let made = 0;
  for (const fix of due) {
    try {
      const refresh = fix.type === "guide_page" ? await refreshGuide(shop, fix, admin, now) : await refreshFaq(shop, fix, admin, now);
      if (refresh) made++;
    } catch (err) {
      console.error(`[fixes] refresh of ${fix.id} failed: ${(err as Error).message}`);
    }
  }
  if (made && shop.autopilot && plan.autopilot) await queueAutopilot(shop.id);
  return made;
}

const REFRESH_EVERY_MS = 20 * 3_600_000;
const refreshLookedAt = new Map<string, number>(); // per process: the scheduler runs every minute

/** Queue the store's daily refresh job, at most once every 20 hours. */
export async function queueRefresh(shopId: string, now = new Date()) {
  const seen = refreshLookedAt.get(shopId);
  if (seen && now.getTime() - seen < 3_600_000) return null; // looked at within the hour: skip the database
  refreshLookedAt.set(shopId, now.getTime());
  const key = `refresh:${shopId}`;
  const last = await db.job.findUnique({ where: { dedupeKey: key }, select: { status: true, updatedAt: true } });
  if (last && (last.status === "queued" || last.status === "running")) return null;
  if (last && now.getTime() - last.updatedAt.getTime() < REFRESH_EVERY_MS) return null;
  return enqueue("fixes.refresh", {}, { shopId, dedupeKey: key });
}

registerJob("fixes.refresh", async (job) => {
  const n = await refreshDueFixes(job.shopId!);
  if (n) console.log(`[fixes] ${n} refreshes written for shop ${job.shopId}`);
});
