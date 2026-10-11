// Outreach: find the pages AI assistants use that name rivals but not the store ("others only"), for each
// assistant, and give an honest next step for each kind of page:
//   article or roundup: find who to contact and draft a short pitch the store sends itself
//   video: a short review pitch to the creator (a sample offered as a question, gifted products disclosed)
//   forum or Q&A thread: never a drafted post. Plain guidance to join openly as the brand
//   directory or review site: a listing to-do (review sites: claim the profile, never write reviews)
//   shop or marketplace: a stocking or listing to-do
// Pages are read for free (cited-page.server.ts) to drop ones that already name the store and to see how
// fresh they are. Monthly limits come from plans.ts (Standard 10, Done-for-you 40).

import { z } from "zod";
import db from "../db.server";
import { aiConfigured, askJson } from "./ai.server";
import { findAuthorEmail } from "./treg.server";
import { cleanUrl } from "./answers";
import { brandKey } from "./match";
import { getPlan } from "./plans";
import { startOfMonth } from "./limits";
import { costThisMonth } from "./cost.server";
import { registerJob } from "./jobs.server";
import { trackedProductUrl } from "./fixes.server";
import { countryName } from "./onboarding.server";
import { isRivalDomain, noOutreach, outreachKind, pickAcrossEngines, targetScore, yearHint, type OutreachKind } from "./sources";
import {
  NAMED_STATUS,
  checkCitedPages,
  guardedFetch,
  logPageReads,
  merchantNames,
  pageChecksLeft,
  readCitedPage,
  type MerchantNames,
  type PageCheck,
  type PageFetcher,
} from "./cited-page.server";
import { tidyDashes } from "./guide";
import { pool } from "./pool";

const DAY = 86_400_000;
const MAX_NEW_PER_RUN = 10;
const PAID_LOOKUPS_PER_RUN = 3; // email finder (Treg, about US$0.005 to 0.009 each), articles only
const MAX_PER_KIND_PER_RUN: Partial<Record<OutreachKind, number>> = { retailer: 2, directory: 3 };
// Pages are read before they become targets, about twice as many as targets wanted, so the freshest
// and best ones win. Reading caps per kind are twice the target caps.
const READ_FACTOR = 2;
const READ_PER_KIND: Partial<Record<OutreachKind, number>> = { retailer: 4, directory: 6 };

export { NAMED_STATUS };

/** New targets made this month, for the plan's monthly limit. Pages kept aside as "named" don't count. */
export function outreachUsedThisMonth(shopId: string, now = new Date()): Promise<number> {
  return db.outreachTarget.count({ where: { shopId, createdAt: { gte: startOfMonth(now) }, NOT: { status: NAMED_STATUS } } });
}

export interface Candidate {
  url: string;
  domain: string;
  title: string | null;
  kind: OutreachKind;
  cited: number; // AI answers (recent scans) that used the page
  engines: string[]; // assistants that used it
  brands: string[]; // rival brands those answers named
  merchantNamed: number; // of those answers, how many named the store
  yearHint: number | null;
  score: number;
}

/**
 * Cited pages worth an outreach step, best first. From the store's recent scans (the last three, and
 * every scan from the newest fortnight, so Done-for-you's daily scans and its weekly Claude scan both count).
 * Skips the store's own site, brand sites (rivals won't feature the store), Wikipedia, search engines,
 * government and universities. Keeps pages where AI usually doesn't name the store, and once we know which
 * rivals AI names, only pages that sit next to at least one.
 */
export async function findCandidates(shopId: string, now = new Date()): Promise<Candidate[]> {
  const recent = await db.scan.findMany({
    where: { shopId, status: "done" },
    orderBy: { startedAt: "desc" },
    take: 10,
    select: { id: true, startedAt: true },
  });
  if (!recent.length) return [];
  const newest = recent[0].startedAt.getTime();
  const scanIds = recent.filter((s, i) => i < 3 || newest - s.startedAt.getTime() <= 14 * DAY).map((s) => s.id);

  const answers = await db.aiAnswer.findMany({
    where: { scanId: { in: scanIds }, status: "parsed" },
    select: {
      engine: true,
      mentioned: true,
      citations: { where: { isOwn: false, type: { not: "brand" } }, select: { url: true, domain: true, title: true, type: true } },
      mentions: { where: { isMerchant: false }, select: { brand: true } },
    },
  });
  const competitors = await db.competitor.findMany({ where: { shopId }, select: { name: true } });
  // Each brand's key once (not once per citation), and each domain decided once.
  const prepared = answers.map((a) => ({ ...a, mentions: a.mentions.map((m) => ({ brand: m.brand, key: brandKey(m.brand) || m.brand.toLowerCase() })) }));
  const rivalKeys = new Set<string>(competitors.map((c) => brandKey(c.name)).filter((k) => k.length >= 5));
  for (const a of prepared) for (const m of a.mentions) if (m.key.length >= 6) rivalKeys.add(m.key);
  const rivalSite = new Map<string, boolean>();
  const rivalsKnown = answers.some((a) => a.mentions.length > 0);

  type Building = Omit<Candidate, "score" | "yearHint" | "engines" | "brands"> & { engines: Set<string>; brands: Map<string, string> };
  const byUrl = new Map<string, Building>();
  for (const a of prepared) {
    for (const c of a.citations) {
      if (noOutreach(c.domain)) continue;
      const kind = outreachKind(c.url, c.domain, c.type);
      if (kind === "other") continue;
      // A rival's own site or blog: they won't feature the store. A shop or marketplace is never that
      // (AI naming "Amazon" as a place to buy doesn't make amazon.com a rival's own site).
      if (kind !== "retailer") {
        let rival = rivalSite.get(c.domain);
        if (rival === undefined) {
          rival = isRivalDomain(c.domain, rivalKeys);
          rivalSite.set(c.domain, rival);
        }
        if (rival) continue;
      }
      const url = cleanUrl(c.url);
      const cand: Building = byUrl.get(url) ?? {
        url,
        domain: c.domain,
        title: c.title,
        kind,
        cited: 0,
        engines: new Set<string>(),
        brands: new Map<string, string>(),
        merchantNamed: 0,
      };
      cand.cited++;
      cand.engines.add(a.engine);
      if (!cand.title && c.title) cand.title = c.title;
      for (const m of a.mentions) if (!cand.brands.has(m.key)) cand.brands.set(m.key, m.brand);
      if (a.mentioned) cand.merchantNamed++;
      byUrl.set(url, cand);
    }
  }

  return [...byUrl.values()]
    .filter((c) => c.merchantNamed < c.cited && (!rivalsKnown || c.brands.size > 0))
    .map((c) => {
      const engines = [...c.engines];
      const brands = [...c.brands.values()];
      const hint = yearHint(c.url, c.title, now);
      const score = targetScore({ cited: c.cited, engines, rivals: brands.length, merchantNamed: c.merchantNamed, kind: c.kind, yearHint: hint, domain: c.domain }, now);
      return { ...c, engines, brands, yearHint: hint, score };
    })
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
}

// ---------- Messages ----------

export const PitchSchema = z.object({
  subject: z.string().describe("Under 60 characters, specific to their article"),
  body: z.string().describe("Plain text email, 90-140 words, signed '[Your name]'"),
  product_index: z.number().int().describe("Which product to suggest, from the list"),
});

export const VideoPitchSchema = z.object({
  subject: z.string().describe("Under 60 characters, specific to their video"),
  body: z.string().describe("Plain text message, 70-120 words, signed '[Your name]'"),
  product_index: z.number().int().describe("Which product to suggest, from the list"),
});

const ARTICLE_SYSTEM =
  "You write short, honest emails from a small store owner to the editor of an article, asking to be considered for it. Be warm and specific to their article. Never flatter falsely, never claim awards, reviews or facts that aren't given, never offer payment for a link, never pretend to be a customer. Include one product link exactly as given. Offer a free sample only as a question.";

const VIDEO_SYSTEM =
  "You write short, honest messages from a small store owner to a video creator, asking whether they would like to try a product for a possible review. Be specific to their video. Never flatter falsely, never claim awards, reviews or facts that aren't given, never offer payment, never ask for a positive review or for any say over what they make, never pretend to be a fan or a customer. Offer a free sample as a question, say there is no obligation to post, and remind them that if they feature a gifted product they must say it was gifted. Include one product link exactly as given.";

const STOP = new Set(["the", "and", "for", "with", "best", "top", "your", "you", "our", "from", "that", "this", "are", "how", "what", "which", "review", "reviews"]);
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)));

/** The product whose title shares the most words with the page title (the first product if none do). */
export function bestProductIndex(pageTitle: string | null, products: { title: string; productType?: string | null }[]): number {
  const want = words(pageTitle ?? "");
  let best = 0;
  let bestScore = 0;
  products.forEach((p, i) => {
    const have = words(`${p.title} ${p.productType ?? ""}`);
    const score = [...have].filter((w) => want.has(w)).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}

/** "The 12 Best Beard Oils of 2026 | GQ" -> "The 12 Best Beard Oils of 2026", cut to `max` characters. */
export function shortTitle(title: string | null, max = 40): string {
  const t = (title ?? "").replace(/\s+[|\u2013\u2014-]\s+[^|\u2013\u2014-]{2,40}$/, "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

interface PitchContext {
  kind: "article" | "video";
  pageTitle: string | null;
  authorName: string | null;
  brand: string;
  summary: string;
  productTitle: string | null;
  productLink: string | null;
}

/** Used when Claude is unavailable: a plain, honest message the store edits before sending. */
export function fallbackPitch(p: PitchContext): { subject: string; body: string } {
  const hi = `Hi ${p.authorName?.split(/\s+/)[0] || "there"},`;
  const title = shortTitle(p.pageTitle, 80);
  const about = [`I run ${p.brand}.`, p.summary.trim()].filter(Boolean).join(" ");
  const product = p.productTitle && p.productLink ? `${p.productTitle}: ${p.productLink}` : null;
  if (p.kind === "video") {
    return {
      subject: "A product idea for your channel",
      body: [
        hi,
        title ? `I came across your video "${title}". ${about}` : about,
        product ? `I think this could suit your viewers: ${product}` : "I think our products could suit your viewers.",
        "Would you like one to try? We would send it free, with no obligation to post about it. If you do feature it, please say that it was gifted, as the platform's rules ask.",
        `Thanks for your time,\n[Your name]\n${p.brand}`,
      ].join("\n\n"),
    };
  }
  return {
    subject: (title ? `A suggestion for "${shortTitle(p.pageTitle, 36)}"` : `A suggestion from ${p.brand}`).slice(0, 60),
    body: [
      hi,
      title ? `I came across your article "${title}". ${about}` : about,
      product ? `If you update it, this might be worth a look for your readers: ${product}` : "If you update it, our range might be worth a look for your readers.",
      "Happy to send you one to try, if that would help. No pressure either way.",
      `Thanks for your time,\n[Your name]\n${p.brand}`,
    ].join("\n\n"),
  };
}

const NO_OBLIGATION = "There is no obligation to post about it.";
const GIFTED = "If you do feature it, please say that it was gifted, as the platform's rules ask.";

/**
 * A video message must offer the sample with no obligation and remind the creator to say it was gifted
 * (platform rules and advertising law). If Claude left either out, add our sentence before the sign-off.
 */
export function ensureVideoDisclosure(body: string): string {
  const missing = [!/no obligation/i.test(body) && NO_OBLIGATION, !/gift/i.test(body) && GIFTED].filter((x): x is string => Boolean(x));
  if (!missing.length) return body;
  const add = missing.join(" ");
  const paras = body.split(/\n{2,}/);
  const sign = paras.findIndex((p) => /\[your name\]|^(thanks|thank you|cheers|best|kind regards|regards|warmly)\b/i.test(p.trim()));
  if (sign > 0) return [...paras.slice(0, sign), add, ...paras.slice(sign)].join("\n\n");
  return `${body.trimEnd()}\n\n${add}`;
}

/** House style for every message: no em dashes or spaced en dashes; video messages carry the disclosure. */
export function tidyPitch(p: { subject: string; body: string }, kind: "article" | "video"): { subject: string; body: string } {
  const subject = tidyDashes(p.subject).replace(/\s+/g, " ").trim();
  const body = tidyDashes(p.body);
  return { subject, body: kind === "video" ? ensureVideoDisclosure(body) : body };
}

/**
 * Write (or rewrite) the message for an article or video target. Other kinds have no message to write.
 * `useClaude: false` (the store is over its monthly cost cap) writes the plain template instead.
 */
export async function draftPitch(targetId: string, opts: { useClaude?: boolean } = {}) {
  const target = await db.outreachTarget.findUniqueOrThrow({ where: { id: targetId }, include: { shop: { include: { profile: true } } } });
  const kind = target.kind === "video" ? "video" : target.kind === "article" ? "article" : null;
  if (!kind) throw new Error("There's no message to write for this kind of page.");
  const shop = target.shop;
  const products = await db.product.findMany({ where: { shopId: shop.id, status: "ACTIVE" }, take: 12 });
  const campaign = target.domain.replace(/\./g, "-");
  const links = products.map((p) => trackedProductUrl(shop, p.handle, "outreach", campaign));
  const brand = shop.profile?.brandName ?? shop.name ?? shop.domain.split(".")[0];
  const summary = shop.profile?.summary ?? "";

  let pitch: { subject: string; body: string } | null = null;
  if (aiConfigured() && opts.useClaude !== false) {
    try {
      const result = await askJson({
        schema: kind === "video" ? VideoPitchSchema : PitchSchema,
        tier: "smart",
        label: kind === "video" ? "outreach-video-pitch" : "outreach-pitch",
        shopId: shop.id,
        maxTokens: 3000,
        system: kind === "video" ? VIDEO_SYSTEM : ARTICLE_SYSTEM,
        prompt: `${kind === "video" ? "Video" : "Article"}: ${target.title ?? "(no title)"} | ${target.url}
Brands AI recommends when it uses this ${kind}: ${(target.namedBrands as string[]).slice(0, 6).join(", ") || "unknown"}
${kind === "video" ? "Creator" : "Author"} name: ${target.authorName ?? "unknown (use 'Hi there')"}

Our store: ${brand} (${countryName(shop.country)})
About us: ${summary}

Our products (index. title | link | details):
${products.map((p, i) => `${i}. ${p.title} | ${links[i]} | ${(p.description ?? "").slice(0, 160)}`).join("\n")}

Write the ${kind === "video" ? "message" : "email"}.`,
      });
      pitch = { subject: result.subject, body: result.body };
    } catch (err) {
      console.error(`[outreach] pitch by Claude failed, using the plain template: ${(err as Error).message}`);
    }
  }
  if (!pitch) {
    const i = bestProductIndex(target.title, products);
    pitch = fallbackPitch({
      kind,
      pageTitle: target.title,
      authorName: target.authorName,
      brand,
      summary,
      productTitle: products[i]?.title ?? null,
      productLink: links[i] ?? null,
    });
  }

  pitch = tidyPitch(pitch, kind);
  return db.outreachTarget.update({
    where: { id: targetId },
    data: { subject: pitch.subject.slice(0, 200), pitch: pitch.body.slice(0, 5000), status: target.status === "new" ? "drafted" : target.status },
  });
}

// ---------- Finding targets ----------

const sameList = (a: unknown, b: string[]) => Array.isArray(a) && a.length === b.length && b.every((x) => a.includes(x));

async function createTarget(shopId: string, c: Candidate, page: PageCheck, now: Date, paid: { left: number }): Promise<string | null> {
  let authorName = page.authorName ?? null;
  let email = page.email ?? null;
  let contactUrl = page.contactUrl ?? null;
  if (c.kind === "article") {
    if (!email && paid.left > 0) {
      paid.left--;
      const found = await findAuthorEmail(c.url, shopId);
      email = found.email;
      authorName = authorName ?? found.name;
    }
    contactUrl = contactUrl ?? `https://${c.domain}/contact`;
  } else if (c.kind === "forum" || c.kind === "qa") {
    // Threads: no names or emails. The step is to join in openly, not to message people.
    authorName = null;
    email = null;
    contactUrl = null;
  } else if (c.kind === "video") {
    email = null; // the message goes through the creator's channel
  }
  try {
    const target = await db.outreachTarget.create({
      data: {
        shopId,
        url: c.url,
        domain: c.domain,
        title: c.title ?? page.title ?? null,
        kind: c.kind,
        namedBrands: c.brands.slice(0, 10),
        timesCited: c.cited,
        engines: c.engines,
        authorName,
        email,
        contactUrl,
        mentionsMerchant: page.ok ? false : null,
        pageCheckedAt: now,
        pageModifiedAt: page.modifiedAt ?? null,
      },
    });
    return target.id;
  } catch {
    return null; // already saved (another run got there first)
  }
}

/** A page AI uses that already names the store: kept aside ("named"), not a target. */
function saveNamed(shopId: string, c: Candidate, page: PageCheck, now: Date) {
  return db.outreachTarget
    .create({
      data: {
        shopId,
        url: c.url,
        domain: c.domain,
        title: c.title ?? page.title,
        kind: c.kind,
        namedBrands: c.brands.slice(0, 10),
        timesCited: c.cited,
        engines: c.engines,
        status: NAMED_STATUS,
        mentionsMerchant: true,
        pageCheckedAt: now,
        pageModifiedAt: page.modifiedAt,
      },
    })
    .catch(() => null);
}

/**
 * Find new outreach targets for a store, up to its monthly limit (and 10 a run), taking turns between
 * the assistants. Every new page is read first (free, within the plan's weekly page reads), about twice
 * as many as targets wanted: pages that already name the store are kept aside (status "named"), and
 * the rest are scored again with their own dates so fresher pages win. A candidate is never saved
 * unread: when the week's reads run out it waits for the next run. Then re-reads older targets with
 * what's left (Done-for-you keeps some reads back for its next daily run).
 * Returns how many new targets were made.
 */
export async function findOutreachTargets(shopId: string, opts: { fetchPage?: PageFetcher; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const fetchPage = opts.fetchPage ?? guardedFetch;
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const plan = getPlan(shop.plan);
  if (plan.outreachPerMonth <= 0) return 0;

  const candidates = await findCandidates(shopId, now);
  const existing = await db.outreachTarget.findMany({ where: { shopId }, select: { id: true, url: true, timesCited: true, engines: true } });
  const known = new Map(existing.map((e) => [e.url, e]));
  // Keep known targets' counts and assistants in step with the latest scans.
  for (const c of candidates) {
    const e = known.get(c.url);
    if (e && (e.timesCited !== c.cited || !sameList(e.engines, c.engines))) {
      await db.outreachTarget.update({ where: { id: e.id }, data: { timesCited: c.cited, engines: c.engines } });
    }
  }

  let names: MerchantNames | null = null;
  const monthLeft = Math.max(0, plan.outreachPerMonth - (await outreachUsedThisMonth(shopId, now)));
  const budget = Math.min(monthLeft, MAX_NEW_PER_RUN);
  let checksLeft = await pageChecksLeft(shopId, now, plan.pageReadsPerWeek);
  // Over the month's cost cap: no paid email lookups and no Claude; free page reads and templates still work.
  const overCap = (await costThisMonth(shopId)) >= plan.costCapUsd;
  let made = 0;
  if (budget > 0 && checksLeft > 0) {
    names = await merchantNames(shopId);
    const fresh = candidates.filter((c) => !known.has(c.url));
    // The reading order, taking turns between the assistants. Never more than this week's reads.
    const order = pickAcrossEngines(fresh, Math.min(fresh.length, checksLeft), READ_PER_KIND);
    const paid = { left: overCap ? 0 : PAID_LOOKUPS_PER_RUN };
    const perKind = new Map<OutreachKind, number>();
    let readPool: { c: Candidate; page: PageCheck }[] = [];
    let next = 0;
    while (made < budget) {
      const want = Math.max(0, (budget - made) * READ_FACTOR - readPool.length);
      const toRead = order.slice(next, next + Math.min(want, checksLeft));
      next += toRead.length;
      if (toRead.length) {
        checksLeft -= toRead.length;
        await logPageReads(shopId, toRead.length, now);
        const pages = await pool(toRead, 4, (c) => readCitedPage(c.url, names!, fetchPage, c.kind, now));
        for (const [i, c] of toRead.entries()) {
          if (pages[i].mentionsMerchant) await saveNamed(shopId, c, pages[i], now);
          else readPool.push({ c, page: pages[i] });
        }
      }
      if (readPool.length) {
        // The best of what we've read, scored again with each page's own date.
        const scored = readPool.map((p) => ({
          ...p,
          engines: p.c.engines,
          kind: p.c.kind,
          score: targetScore(
            { cited: p.c.cited, engines: p.c.engines, rivals: p.c.brands.length, merchantNamed: p.c.merchantNamed, kind: p.c.kind, modifiedAt: p.page.modifiedAt, yearHint: p.c.yearHint, domain: p.c.domain },
            now,
          ),
        }));
        const caps = Object.fromEntries(Object.entries(MAX_PER_KIND_PER_RUN).map(([k, v]) => [k, Math.max(0, v - (perKind.get(k as OutreachKind) ?? 0))]));
        const chosen = pickAcrossEngines(scored, budget - made, caps);
        const picked = new Set(chosen.map((p) => p.c.url));
        readPool = readPool.filter((p) => !picked.has(p.c.url));
        for (const p of chosen) {
          const id = await createTarget(shopId, p.c, p.page, now, paid);
          if (!id) continue;
          made++;
          perKind.set(p.c.kind, (perKind.get(p.c.kind) ?? 0) + 1);
          if (p.c.kind === "article" || p.c.kind === "video") {
            await draftPitch(id, { useClaude: !overCap }).catch((err) => console.error(`[outreach] pitch failed: ${(err as Error).message}`));
          }
        }
      }
      if (!toRead.length) break; // nothing more to read this run
    }
  }

  // Older targets: re-read with what's left of the week (freshness, and pages that now name the store).
  // Done-for-you runs after every daily scan, so it keeps enough reads back for its next run's new pages.
  const reserve = plan.scanEveryDays && plan.scanEveryDays < 7 ? Math.min(Math.max(0, monthLeft - made), MAX_NEW_PER_RUN) : 0;
  const recheck = await checkCitedPages(shopId, { fetchPage, now, maxReads: Math.max(0, checksLeft - reserve), ...(names ? { names } : {}) }).catch((err) => {
    console.error(`[outreach] page check failed: ${(err as Error).message}`);
    return { read: 0, reopened: [] as string[] };
  });
  // Pages kept aside that no longer name the store are targets again: write their message.
  for (const id of recheck.reopened) {
    const t = await db.outreachTarget.findUnique({ where: { id }, select: { kind: true } });
    if (t && (t.kind === "article" || t.kind === "video")) {
      await draftPitch(id, { useClaude: !overCap }).catch((err) => console.error(`[outreach] pitch failed: ${(err as Error).message}`));
    }
  }
  return made;
}

registerJob("outreach.find", async (job) => {
  const n = await findOutreachTargets(job.shopId!);
  console.log(`[outreach] ${n} new targets for shop ${job.shopId}`);
});
