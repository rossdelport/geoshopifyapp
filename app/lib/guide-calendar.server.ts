// The guide calendar for web app stores (Ross, 2026-10-16): a month view of the guide pages GEO writes for the store,
// one per buying question AI doesn't name it for. Each day's guide is written two days before (the guide.write job,
// through the fix engine's writer, so the same checks apply: strict question-and-answer form, the claims check, links
// only to pages we know) and goes live on the day: through the store's Shopify connection when it has one
// (guide.publish), otherwise the page shows the two-minute copy and paste steps and the store marks it added.
// Standard stores OK each guide first; Done-for-you guides are OK'd when written ("written and published for you"),
// unless the store switched autopilot off. A skipped day is deleted, so the calendar plans another.

import type { BrandProfile, Fix, GuideSlot, Question, Shop } from "@prisma/client";
import db from "../db.server";
import { enqueue, registerJob } from "./jobs.server";
import { getPlan, type Plan } from "./plans";
import { applyFix, clearForAutopilot, rejectFix, storeUrl, writeGuide, type LostQuestion } from "./fixes.server";
import { adminFor } from "./onboard-job.server";
import { questionRows } from "./question-stats.server";
import { countGuidePagesThisMonth } from "./usage.server";
import {
  PUBLISH_FROM_HOUR,
  WRITE_DAYS_AHEAD,
  addDays,
  dayLabel,
  localDay,
  localHour,
  localMonthStart,
  monthOf,
  ownPageUrl,
  pickQuestions,
  rankProductsForQuestion,
  shiftMonth,
  slotDaysForMonth,
  slotState,
  writeDay,
  type SlotState,
} from "./guide-calendar";

const RETRY_MS = 6 * 3_600_000;
// A day left in "writing" this long was abandoned (the worker died mid-write): it is written again.
const STALE_WRITE_MS = 20 * 60_000;

/** What the fix engine stores for a guide page (Fix.after). */
export interface GuideAfter {
  title?: string;
  handle?: string;
  bodyHtml?: string;
  kind?: string;
}

type ShopLite = Pick<Shop, "id" | "source" | "status" | "onboarding" | "plan" | "country" | "domain" | "primaryDomain" | "shopifyConnectedAt">;

/** The calendar runs for web app stores on a plan with guide pages, once they are set up. */
export function calendarOn(shop: Pick<Shop, "source" | "status" | "onboarding">, plan: Plan): boolean {
  return shop.source === "web" && shop.status === "installed" && shop.onboarding === "done" && plan.guidePagesPerMonth > 0;
}

/**
 * True when this account connected the store's Shopify, so pages can be published for it: the connection must have
 * been made from the signed-in web session (shopifyConnectedAt) and the app's token must still be there. An app
 * install by itself is not enough: anyone can add a store to the web app by its address, so a token that merely
 * matches the domain could belong to the store's real owner, not to this account. Web stores mostly aren't connected yet.
 */
export async function shopifyConnected(shop: Pick<Shop, "domain" | "shopifyConnectedAt">): Promise<boolean> {
  if (!shop.shopifyConnectedAt) return false;
  return Boolean(await db.session.findFirst({ where: { shop: shop.domain, isOnline: false }, select: { id: true } }));
}

/**
 * Plan the rest of this month and next month: a day for each guide the plan allows that isn't planned yet, from the
 * day after tomorrow (a guide is written two days ahead), each with the buying question it will answer. A day skipped
 * before it was written earns one replacement day. Safe to run any time; it only adds what is missing. Returns how
 * many days it added.
 */
export async function autofillCalendar(shopId: string, now = new Date()): Promise<number> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const plan = getPlan(shop.plan);
  if (!calendarOn(shop, plan)) return 0;
  const today = localDay(now, shop.country);
  const earliest = addDays(today, WRITE_DAYS_AHEAD);
  const [slots, guideFixes, rows, writtenThisMonth] = await Promise.all([
    db.guideSlot.findMany({ where: { shopId }, select: { day: true, questionId: true, cluster: true, status: true, fixId: true }, orderBy: { day: "asc" } }),
    db.fix.findMany({ where: { shopId, type: "guide_page", refreshOfId: null, status: { not: "rejected" } }, select: { questionIds: true } }),
    questionRows(shopId, { activeOnly: true }),
    countGuidePagesThisMonth(shopId, localMonthStart(now, shop.country)),
  ]);
  // No question gets two guides: not one on another day, not one written already.
  const used = new Set<string>(slots.flatMap((s) => (s.questionId ? [s.questionId] : [])));
  for (const f of guideFixes) for (const id of (f.questionIds as unknown[]) ?? []) if (typeof id === "string") used.add(id);
  const taken = new Set(slots.map((s) => s.day));
  let lastCluster = slots.filter((s) => s.day < earliest).at(-1)?.cluster ?? null;
  let made = 0;
  for (const month of [monthOf(today), shiftMonth(monthOf(today), 1)]) {
    const inMonth = slots.filter((s) => s.day.startsWith(month));
    const active = inMonth.filter((s) => s.status !== "skipped");
    // The month's allowance: the guides already written this month (a skipped guide that was written still used its
    // allowance) plus the days still to be written.
    const have = (month === monthOf(today) ? writtenThisMonth : 0) + active.filter((s) => !s.fixId).length;
    const room = plan.guidePagesPerMonth - have;
    if (room <= 0) continue;
    // The plan's own days first; a day skipped before it was written earns one replacement from the denser list.
    const primary = slotDaysForMonth(month, plan.guidePagesPerMonth).filter((d) => d >= earliest && !taken.has(d));
    const replacements = inMonth.filter((s) => s.status === "skipped" && !s.fixId).length;
    const makeup = replacements
      ? slotDaysForMonth(month, 12)
          .filter((d) => d >= earliest && !taken.has(d) && !primary.includes(d))
          .slice(0, replacements)
      : [];
    const days = [...primary, ...makeup].sort().slice(0, room);
    const picks = pickQuestions(rows.questions, used, days.length, lastCluster);
    for (let i = 0; i < picks.length; i++) {
      try {
        await db.guideSlot.create({ data: { shopId, day: days[i], questionId: picks[i].id, cluster: picks[i].cluster } });
      } catch (err) {
        if ((err as { code?: string }).code === "P2002") continue; // two schedulers at once: the other one planned this day
        throw err;
      }
      taken.add(days[i]);
      used.add(picks[i].id);
      lastCluster = picks[i].cluster;
      made++;
    }
  }
  return made;
}

const lookedAt = new Map<string, number>(); // per process: the worker runs every minute, this needs an hourly look

/**
 * Hourly per store, from the worker: plan the calendar, queue the guides whose writing day has come (two days before
 * their day) and, for a store with a Shopify connection, publish the OK'd guides whose day has come (from 8am on the
 * store's clock). A day that couldn't be written is tried again after 6 hours, until its day has passed; a day left
 * in "writing" by a worker that died is written again.
 */
export async function queueGuideWork(shop: ShopLite, plan: Plan, now = new Date(), opts: { force?: boolean } = {}): Promise<void> {
  if (!calendarOn(shop, plan)) return;
  const seen = lookedAt.get(shop.id);
  if (!opts.force && seen && now.getTime() - seen < 3_600_000) return;
  lookedAt.set(shop.id, now.getTime());
  await autofillCalendar(shop.id, now);
  const today = localDay(now, shop.country);
  const slots = await db.guideSlot.findMany({
    where: { shopId: shop.id, status: { in: ["planned", "failed", "ready", "writing"] }, day: { lte: addDays(today, WRITE_DAYS_AHEAD) } },
  });
  const dueLive = slots.filter((s) => s.status === "ready" && s.approvedAt && s.day <= today);
  const connected = dueLive.length && localHour(now, shop.country) >= PUBLISH_FROM_HOUR ? await shopifyConnected(shop) : false;
  for (const s of slots) {
    const retry = s.status === "failed" && now.getTime() - s.updatedAt.getTime() >= RETRY_MS && s.day >= today;
    const abandoned = s.status === "writing" && now.getTime() - s.updatedAt.getTime() >= STALE_WRITE_MS;
    if (s.status === "planned" || retry || abandoned) {
      await enqueue("guide.write", { slotId: s.id }, { shopId: shop.id, dedupeKey: `guide-write:${s.id}`, ifFailedWaitMs: RETRY_MS });
    } else if (connected && dueLive.includes(s)) {
      await enqueue("guide.publish", { slotId: s.id }, { shopId: shop.id, dedupeKey: `guide-publish:${s.id}`, ifFailedWaitMs: RETRY_MS });
    }
  }
}

/** Questions that already have a day on the calendar (other than `exceptSlotId`) or a guide that wasn't set aside. */
async function usedQuestionIds(shopId: string, exceptSlotId?: string): Promise<Set<string>> {
  const [slots, fixes] = await Promise.all([
    db.guideSlot.findMany({ where: { shopId, ...(exceptSlotId ? { id: { not: exceptSlotId } } : {}) }, select: { questionId: true } }),
    db.fix.findMany({ where: { shopId, type: "guide_page", refreshOfId: null, status: { not: "rejected" } }, select: { questionIds: true } }),
  ]);
  const used = new Set<string>();
  for (const s of slots) if (s.questionId) used.add(s.questionId);
  for (const f of fixes) for (const id of (f.questionIds as unknown[]) ?? []) if (typeof id === "string") used.add(id);
  return used;
}

// ---------- Writing ----------

type SlotForWriting = GuideSlot & { shop: Shop & { profile: BrandProfile | null }; question: Question | null };

const NOT_PASSED =
  "The draft didn’t pass our checks (a guide needs a clear question, a short answer, at least four answered questions and one of your products), or this month’s guide pages are used up. We’ll try again later.";

async function writeSlot(slot: SlotForWriting, plan: Plan): Promise<{ ok: true; fix: Fix } | { ok: false; reason: string }> {
  const { shop, question } = slot;
  if (!question) return { ok: false, reason: "This day’s buying question was removed. Skip the day and the calendar will plan another." };
  if (!shop.profile) return { ok: false, reason: "We don’t have your store’s profile yet." };
  const [products, rows, used] = await Promise.all([
    db.product.findMany({ where: { shopId: shop.id, NOT: { status: "DELETED" } }, orderBy: { syncedAt: "desc" }, take: 200 }),
    questionRows(shop.id, { activeOnly: true }),
    usedQuestionIds(shop.id, slot.id),
  ]);
  if (!products.length) return { ok: false, reason: "We couldn’t find any products in your store’s catalog to feature." };
  const main = rows.questions.find((q) => q.id === question.id);
  // The guide answers its question and, when the topic has them, up to two more questions on it that AI loses and
  // that no other day or guide covers (so two guides on one topic never answer the same things).
  const more = rows.questions
    .filter((q) => q.id !== question.id && !used.has(q.id) && q.cluster && q.cluster === question.cluster && (q.rate ?? 0) < 0.5)
    .slice(0, 2);
  const first = main ?? { id: question.id, text: question.text, volume: question.volume, cluster: question.cluster, longTail: question.longTail, rate: null, winners: [] as string[] };
  const lost: LostQuestion[] = [first, ...more].map((q, index) => ({
    index,
    id: q.id,
    text: q.text,
    volume: q.volume,
    mentionRate: q.rate ?? 0,
    winners: q.winners,
    cluster: q.cluster,
    longTail: q.longTail,
  }));
  const why =
    !main || main.rate === null
      ? "AI hasn’t been asked this one yet"
      : main.rate === 0
        ? "AI doesn’t name you for this question"
        : `AI names you in ${Math.round(main.rate * 100)}% of answers to this question`;
  const reason = `On your guide calendar for ${dayLabel(slot.day)}: ${why}.`;
  const impact = (question.volume ?? 0) >= 500 || (main?.rate ?? 0) === 0 ? "high" : "medium";
  const fix = await writeGuide(shop, rankProductsForQuestion(products, question.text), lost, reason, impact, plan, false, question.cluster, localMonthStart(new Date(), shop.country));
  if (!fix) return { ok: false, reason: NOT_PASSED };
  // Done-for-you: written and published for you, under autopilot's own rules: never a guide that needs a fact from
  // the store, and always the claims check first; anything softened waits for the store's OK.
  let auto = plan.doneForYou && !shop.autopilotOptOut && !fix.missingInfo;
  if (auto) {
    try {
      auto = await clearForAutopilot(fix);
    } catch (err) {
      auto = false; // the check couldn't run: the store OKs this one itself
      console.warn(`[guides] ${shop.domain}: claims check didn’t run, leaving the guide for the store’s OK: ${(err as Error).message}`);
    }
  }
  const kept = await db.guideSlot.updateMany({ where: { id: slot.id, status: "writing" }, data: { status: "ready", fixId: fix.id, error: null, approvedAt: auto ? new Date() : null } });
  if (!kept.count) {
    // The day was skipped while the guide was being written: set the guide aside, nothing to show.
    await rejectFix(fix);
    return { ok: false, reason: "This day was skipped while its guide was being written." };
  }
  return { ok: true, fix };
}

registerJob("guide.write", async (job) => {
  const { slotId } = job.payload as { slotId?: string };
  if (!slotId) return;
  const slot = await db.guideSlot.findUnique({ where: { id: slotId }, include: { shop: { include: { profile: true } }, question: true } });
  if (!slot) return;
  const abandoned = slot.status === "writing" && Date.now() - slot.updatedAt.getTime() >= STALE_WRITE_MS;
  if (!["planned", "failed"].includes(slot.status) && !abandoned) return;
  const plan = getPlan(slot.shop.plan);
  if (!calendarOn(slot.shop, plan)) return;
  await db.guideSlot.update({ where: { id: slot.id }, data: { status: "writing", error: null } });
  try {
    const result = await writeSlot(slot, plan);
    if (!result.ok) {
      // A draft that didn't pass is not a broken job: the day is tried again later (queueGuideWork), not right away.
      // (updateMany: the day may have been skipped, and deleted, meanwhile.)
      await db.guideSlot.updateMany({ where: { id: slot.id }, data: { status: "failed", error: result.reason } });
      console.warn(`[guides] ${slot.shop.domain} ${slot.day}: ${result.reason}`);
    } else {
      console.log(`[guides] ${slot.shop.domain} ${slot.day}: written "${(result.fix.after as GuideAfter).title ?? ""}"`);
    }
  } catch (err) {
    await db.guideSlot.updateMany({ where: { id: slot.id }, data: { status: "failed", error: `Something went wrong while writing: ${(err as Error).message}`.slice(0, 300) } });
    throw err; // the job retries (Claude or the database being down is temporary)
  }
});

// ---------- Publishing ----------

/**
 * Put an OK'd guide live on the store through its Shopify connection: the fix engine's apply, which adds the links
 * to the store's other guides on the topic and the question-and-answer data. `shopId` checks the day is the store's.
 */
export async function publishSlot(slotId: string, shopId?: string): Promise<GuideSlot> {
  const slot = await db.guideSlot.findFirstOrThrow({ where: { id: slotId, ...(shopId ? { shopId } : {}) }, include: { shop: true } });
  if (slot.status === "published") return slot;
  if (slot.status !== "ready" || !slot.approvedAt || !slot.fixId) throw new Error("This guide isn’t ready to publish.");
  if (!(await shopifyConnected(slot.shop))) throw new Error("Your store isn’t connected to Shopify yet. Follow the steps on the page to add it yourself.");
  if (slot.day > localDay(new Date(), slot.shop.country)) throw new Error(`This guide goes live on ${dayLabel(slot.day, "long")}.`);
  const admin = await adminFor(slot.shop.domain);
  const applied = await applyFix(slot.fixId, admin);
  return db.guideSlot.update({ where: { id: slot.id }, data: { status: "published", publishedAt: applied.appliedAt ?? new Date(), error: null } });
}

registerJob("guide.publish", async (job) => {
  const { slotId } = job.payload as { slotId?: string };
  if (!slotId) return;
  try {
    await publishSlot(slotId);
  } catch (err) {
    // The day says why, and offers the copy and paste steps meanwhile; the job retries later.
    await db.guideSlot.updateMany({ where: { id: slotId, status: "ready" }, data: { error: `Shopify didn’t accept the page: ${(err as Error).message}`.slice(0, 300) } });
    throw err;
  }
});

// ---------- What the store can do on a day ----------

async function ownSlot(shopId: string, slotId: string) {
  const slot = await db.guideSlot.findFirst({ where: { id: slotId, shopId }, include: { fix: true, shop: true } });
  if (!slot) throw new Error("This guide isn’t on your calendar.");
  return slot;
}

/** The store's OK: the guide goes live on its day (Done-for-you guides have it from the start). */
export async function approveSlot(shopId: string, slotId: string): Promise<GuideSlot> {
  const slot = await ownSlot(shopId, slotId);
  if (slot.status !== "ready") throw new Error("This guide isn’t written yet.");
  return db.guideSlot.update({ where: { id: slot.id }, data: { approvedAt: slot.approvedAt ?? new Date() } });
}

/**
 * Drop the day and its question. A written guide is set aside (it still used this month's allowance); a day skipped
 * before it was written gets a replacement day with another question when the month has room.
 */
export async function skipSlot(shopId: string, slotId: string, now = new Date()): Promise<void> {
  const slot = await ownSlot(shopId, slotId);
  if (slot.status === "published") throw new Error("This guide is already live. Remove the page in Shopify if you don’t want it.");
  if (slot.status === "skipped") return;
  if (slot.status === "writing" && Date.now() - slot.updatedAt.getTime() < STALE_WRITE_MS) {
    throw new Error("This guide is being written right now. Give it a minute, then skip it.");
  }
  if (slot.fix && slot.fix.status === "pending") await rejectFix(slot.fix);
  await db.guideSlot.update({ where: { id: slot.id }, data: { status: "skipped", error: null } });
  await autofillCalendar(shopId, now);
}

/** Try a day that couldn't be written again, now. */
export async function retrySlot(shopId: string, slotId: string): Promise<void> {
  const slot = await ownSlot(shopId, slotId);
  if (slot.status !== "failed") throw new Error("This guide isn’t waiting for another try.");
  await db.guideSlot.update({ where: { id: slot.id }, data: { status: "planned", error: null } });
  await enqueue("guide.write", { slotId: slot.id }, { shopId, dedupeKey: `guide-write:${slot.id}` });
}

/** The store added the page itself (copy and paste): live, at the address it gave or the page's usual address. */
export async function markAdded(shopId: string, slotId: string, url: string | null): Promise<void> {
  const slot = await ownSlot(shopId, slotId);
  if (slot.status !== "ready" || !slot.fix) throw new Error("This guide isn’t ready yet.");
  const after = slot.fix.after as GuideAfter;
  const pageUrl = ownPageUrl(url, slot.shop) ?? `${storeUrl(slot.shop)}/pages/${after.handle ?? ""}`;
  const now = new Date();
  await db.$transaction([
    db.fix.update({ where: { id: slot.fix.id }, data: { status: "applied", appliedAt: now, revertedAt: null, error: null, resultUrl: pageUrl } }),
    db.guideSlot.update({ where: { id: slot.id }, data: { status: "published", publishedAt: now, approvedAt: slot.approvedAt ?? now, error: null } }),
  ]);
}

// ---------- What the pages show ----------

export interface SlotCard {
  id: string;
  day: string;
  state: SlotState;
  question: { text: string; volume: number | null } | null;
  title: string | null;
  kind: string | null;
}

/** One month of the calendar: its days with their state, and whether the store can publish through Shopify. */
export async function monthView(shop: ShopLite, month: string, now = new Date()) {
  const today = localDay(now, shop.country);
  const [slots, connected] = await Promise.all([
    db.guideSlot.findMany({
      where: { shopId: shop.id, day: { gte: `${month}-01`, lte: `${month}-31` }, status: { not: "skipped" } },
      include: { question: { select: { text: true, volume: true } }, fix: { select: { after: true } } },
      orderBy: { day: "asc" },
    }),
    shopifyConnected(shop),
  ]);
  const cards: SlotCard[] = slots.map((s) => {
    const after = (s.fix?.after ?? {}) as GuideAfter;
    return { id: s.id, day: s.day, state: slotState(s, s.day, today, connected), question: s.question, title: after.title ?? null, kind: after.kind ?? null };
  });
  return { today, connected, slots: cards };
}

/** One day in full: the page as written, where it is at, and what the store can do. Null when it isn't the store's. */
export async function slotView(shop: ShopLite, slotId: string, now = new Date()) {
  const [slot, connected] = await Promise.all([
    db.guideSlot.findFirst({ where: { id: slotId, shopId: shop.id }, include: { question: true, fix: true } }),
    shopifyConnected(shop),
  ]);
  if (!slot) return null;
  const today = localDay(now, shop.country);
  const after = (slot.fix?.after ?? {}) as GuideAfter;
  return {
    id: slot.id,
    day: slot.day,
    writeDay: writeDay(slot.day),
    today,
    connected,
    state: slotState(slot, slot.day, today, connected),
    approved: Boolean(slot.approvedAt),
    question: slot.question ? { text: slot.question.text, volume: slot.question.volume } : null,
    title: after.title ?? null,
    bodyHtml: after.bodyHtml ?? null,
    kind: after.kind ?? null,
    handle: after.handle ?? null,
    reason: slot.fix?.reason ?? null,
    notes: slot.fix?.missingInfo ?? null,
    error: slot.error,
    liveUrl: slot.fix?.resultUrl ?? null,
    publishedAt: slot.publishedAt?.toISOString() ?? null,
  };
}
