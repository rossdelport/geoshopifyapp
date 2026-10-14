/* eslint-disable @typescript-eslint/no-explicit-any -- reads raw third-party JSON */
// Reddit finder (Ross, 2026-10-15): once a week, find Reddit threads where people ask about the kind of product
// the store sells, and draft a neutral, honest reply. The owner reads the thread, edits the reply if they like,
// taps "Copy and open thread" and posts it themselves. Every reply says who they are ("I run X, so I'm biased")
// and never poses as a customer: that's astroturfing and against Reddit's rules.

import { z } from "zod";
import db from "../db.server";
import { aiConfigured, askJson } from "./ai.server";
import { tregCall } from "./treg.server";
import { getPlan } from "./plans";
import { registerJob } from "./jobs.server";
import { countryName } from "./onboarding.server";
import { bestProductIndex } from "./outreach.server";
import { tidyDashes } from "./guide";

const DAY = 86_400_000;
const PHRASES_PER_RUN = 6; // searches a week (about US$0.002 each)
const KEEP_PER_RUN = 20; // new threads kept (and replies drafted) a week
const KEEP_FREE = 10; // the free plan gets one look, not a weekly one

export interface RedditPost {
  postId: string;
  url: string;
  subreddit: string;
  title: string;
  body: string | null;
  author: string | null;
  score: number;
  comments: number;
  postedAt: Date | null;
}

// ---------- Search ----------

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

/** One post from either search provider, or null when it's unusable (removed, NSFW, no id). */
export function parsePost(p: any): RedditPost | null {
  if (!p || typeof p !== "object" || p.over_18 === true || p.nsfw === true) return null;
  const id = text(p.id, 20)?.replace(/^t3_/, "");
  const subreddit = text(p.subreddit, 60)?.replace(/^r\//i, "");
  const title = text(p.title, 300);
  if (!id || !/^[a-z0-9]+$/i.test(id) || !subreddit || !/^[A-Za-z0-9_]+$/.test(subreddit) || !title) return null;
  let body = text(p.selftext, 4000);
  if (body && /^\[(removed|deleted)\]$/i.test(body)) body = null;
  if (/^\[(removed|deleted)\]$/i.test(title)) return null;
  const created = num(p.created_utc ?? p.createdUtc ?? p.created);
  return {
    postId: id,
    url: `https://www.reddit.com/r/${subreddit}/comments/${id}/`,
    subreddit,
    title,
    body,
    author: text(p.author, 60),
    score: num(p.score ?? p.ups),
    comments: num(p.num_comments ?? p.numComments),
    postedAt: created > 0 ? new Date(created * 1000) : null,
  };
}

/** Posts across all of Reddit for a phrase (ScrapeCreators, then AnyAPI if that fails). */
export async function searchReddit(phrase: string, timeframe: "month" | "year", shopId?: string): Promise<RedditPost[]> {
  let raw: any[] = [];
  try {
    const r = await tregCall("scrapecreators.reddit.search.posts", {
      method: "GET",
      query: { query: phrase, sort: "relevance", timeframe, trim: true },
      shopId,
      timeoutMs: 30_000,
    });
    raw = Array.isArray(r?.posts) ? r.posts : [];
  } catch (err) {
    console.error(`[reddit] search failed, trying the other provider: ${(err as Error).message}`);
    const r = await tregCall("anyapi.reddit.search", { body: { query: phrase, sort: "relevance", timeframe }, shopId, timeoutMs: 30_000 });
    raw = Array.isArray(r?.output?.data?.posts) ? r.output.data.posts : [];
  }
  return raw.map(parsePost).filter((p): p is RedditPost => Boolean(p));
}

// ---------- What to search for ----------

const FILLER =
  /\b(right now|at the moment|these days|currently|best|top|good|great|really|actually|any|some|what|which|where|who|how|can|could|should|would|i|me|my|you|your|get|find|buy|is|are|do|does|the|a|an|for|in|at|on|to|of|that|with)\b/gi;

/** "Best wide leg track pants for lounging around in Australia?" -> "wide leg track pants lounging around". */
export function searchPhrase(question: string, country: string | null): string {
  let s = question.replace(/[?!.,"“”]/g, " ");
  if (country) {
    const name = countryName(country).replace(/^the /i, "");
    s = s.replace(new RegExp(`\\b(the )?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), " ");
  }
  s = s.replace(/\b(aussie|australian|kiwi|british|american|canadian)\b/gi, " ").replace(FILLER, " ");
  return s.replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join(" ");
}

/** Up to `max` different search phrases from the store's buying questions, most searched first. */
export function searchPhrases(questions: { text: string; volume: number | null }[], country: string | null, max = PHRASES_PER_RUN): string[] {
  const out: string[] = [];
  for (const q of [...questions].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))) {
    const p = searchPhrase(q.text, country);
    if (p.split(" ").length >= 2 && !out.some((o) => o.toLowerCase() === p.toLowerCase())) out.push(p);
    if (out.length >= max) break;
  }
  return out;
}

// ---------- Which threads to keep ----------

const ASKS = /\?|\b(recommend|recommendation|suggest|looking for|where (can|do|to) (i|you)|any (good|ideas|tips)|help me|which one|worth it|alternatives?|best)\b/i;
const keyWords = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4));

/** Without AI: someone asking for advice, whose post shares a word with what we searched for. */
export function looksRelevant(post: RedditPost, phrase: string): boolean {
  const all = `${post.title} ${post.body ?? ""}`;
  if (!ASKS.test(all)) return false;
  const have = keyWords(all);
  return [...keyWords(phrase)].some((w) => have.has(w) || have.has(`${w}s`) || have.has(w.replace(/s$/, "")));
}

const KeepSchema = z.object({ keep: z.array(z.string()) });

async function relevantByAi(posts: RedditPost[], about: string, shopId: string): Promise<Set<string>> {
  const result = await askJson({
    schema: KeepSchema,
    tier: "fast",
    label: "reddit-relevance",
    shopId,
    style: false,
    maxTokens: 2000,
    system:
      "You sort Reddit posts for a store owner who will join some of them openly, as the owner. Keep a post only when the person is asking for advice, recommendations or where to buy something the store sells (or a close alternative), so a helpful reply from the owner would fit naturally. Drop posts about one specific brand's order or complaint, selling or giveaway posts, memes, news, and anything the store's products don't fit. Reply with the ids to keep.",
    prompt: `The store: ${about}\n\nPosts (id | subreddit | title | start of text):\n${posts
      .map((p) => `${p.postId} | r/${p.subreddit} | ${p.title} | ${(p.body ?? "").slice(0, 300).replace(/\s+/g, " ")}`)
      .join("\n")}`,
  });
  return new Set(result.keep);
}

// ---------- The reply ----------

const DISCLOSED = /\b(i run|i own|i'm the (founder|owner|co-?founder)|i am the (founder|owner|co-?founder)|i work (at|for)|i make|we make|founder of|owner of)\b/i;

/** Make sure the reply says who's writing it, near the start. */
export function ensureDisclosure(reply: string, brand: string): string {
  const r = tidyDashes(reply).trim();
  return DISCLOSED.test(r.slice(0, 220)) ? r : `(I run ${brand}, so I'm biased.) ${r}`;
}

/** Without AI: a short, honest reply that names the best matching product once. */
export function fallbackReply(o: { brand: string; summary: string | null; product: { title: string; price: string | null; description: string | null } | null }): string {
  const first = (o.product?.description ?? "").split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  const fact = first && first.length <= 180 ? ` ${first.replace(/[.!?]?$/, ".")}` : "";
  const what = o.product
    ? `For what you're after, our ${o.product.title}${o.product.price ? ` (${o.product.price})` : ""} might be worth a look.${fact}`
    : o.summary
      ? `${o.summary.split(/(?<=[.!?])\s+/)[0]}`
      : "";
  return `(I run ${o.brand}, so I'm biased.) ${what} Either way, I'd compare a few options and check the sizing or details before you buy. Happy to answer any questions.`
    .replace(/\s+/g, " ")
    .trim();
}

const ReplySchema = z.object({ reply: z.string() });

const REPLY_SYSTEM = `You write a Reddit reply for the owner of an online store. The owner will read it, maybe edit it, and post it themselves from their own account.

Rules:
- Say who is writing in the first line, plainly, for example "(I run Brand, so I'm biased.)". Never hide it.
- Be genuinely helpful and neutral. Answer what they asked first: what to look for, fit, materials, sizing or care, using common knowledge and the store's own facts.
- Mention one of the store's products only if it really fits what they asked, by name, once. Say other options could suit them too.
- Never pretend to be a customer. Never write "I bought" or "I've been using" about the store's products. Never invent reviews, ratings, discounts, stats, awards, delivery times or any fact that isn't in the product details.
- No links, no hashtags, no emojis, no sales talk ("check out", "game changer", "amazing deal").
- 40 to 120 words, casual and friendly, like a normal Reddit comment. Write in the post's language.`;

async function replyByAi(post: RedditPost, o: { brand: string; about: string; country: string; products: string }, shopId: string): Promise<string> {
  const result = await askJson({
    schema: ReplySchema,
    tier: "smart",
    label: "reddit-reply",
    shopId,
    maxTokens: 1500,
    system: REPLY_SYSTEM,
    prompt: `The store: ${o.brand} (${o.country})
About it: ${o.about}
Its products (title | price | details):
${o.products}

The Reddit post in r/${post.subreddit}:
Title: ${post.title}
Text: ${(post.body ?? "(no text, just the title)").slice(0, 2500)}

Write the reply.`,
  });
  return result.reply;
}

// ---------- The weekly job ----------

/** Whether a store is due its look for threads: the first time for every store, then weekly on paid plans. */
export function redditDue(shop: { plan: string; redditCheckedAt: Date | null }, now = new Date()): boolean {
  if (!shop.redditCheckedAt) return true;
  if (getPlan(shop.plan).id === "free") return false;
  return now.getTime() - shop.redditCheckedAt.getTime() >= 7 * DAY - 3_600_000;
}

/** Find this week's threads for a store, keep the ones worth replying to, and draft a reply for each. */
export async function findThreads(shopId: string, now = new Date()): Promise<number> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, include: { profile: true } });
  const free = getPlan(shop.plan).id === "free";
  const questions = await db.question.findMany({ where: { shopId, active: true }, select: { text: true, volume: true } });
  const phrases = searchPhrases(questions, shop.country);
  const brand = shop.profile?.brandName ?? shop.name ?? shop.domain.split(".")[0];
  const about = [shop.profile?.summary, shop.profile?.category, shop.profile?.audience].filter(Boolean).join(" ").slice(0, 600) || brand;

  // Search (a year back the first time, a month after that), skipping threads we already have.
  const known = new Set((await db.redditThread.findMany({ where: { shopId }, select: { postId: true } })).map((t) => t.postId));
  const found = new Map<string, { post: RedditPost; phrases: string[] }>();
  for (const phrase of phrases) {
    try {
      for (const post of await searchReddit(phrase, shop.redditCheckedAt ? "month" : "year", shopId)) {
        if (known.has(post.postId)) continue;
        const f = found.get(post.postId);
        if (f) f.phrases.push(phrase);
        else found.set(post.postId, { post, phrases: [phrase] });
      }
    } catch (err) {
      console.error(`[reddit] ${shop.domain} search "${phrase}" failed: ${(err as Error).message}`);
    }
  }

  // Keep the ones where a reply from the owner fits.
  let picks = [...found.values()];
  let byAi: Set<string> | null = null;
  if (aiConfigured() && picks.length) {
    try {
      byAi = await relevantByAi(picks.map((f) => f.post).slice(0, 80), about, shopId);
    } catch (err) {
      console.error(`[reddit] relevance by AI failed, using word matching: ${(err as Error).message}`);
    }
  }
  picks = picks.filter((f) => (byAi ? byAi.has(f.post.postId) : f.phrases.some((p) => looksRelevant(f.post, p))));
  picks.sort((a, b) => (b.post.postedAt?.getTime() ?? 0) - (a.post.postedAt?.getTime() ?? 0));
  picks = picks.slice(0, free ? KEEP_FREE : KEEP_PER_RUN);

  // Draft a reply for each and save.
  const products = await db.product.findMany({ where: { shopId, status: "ACTIVE" }, take: 40 });
  const productList = products
    .slice(0, 20)
    .map((p) => `${p.title} | ${p.price ?? "?"} | ${(p.description ?? "").slice(0, 160).replace(/\s+/g, " ")}`)
    .join("\n");
  let saved = 0;
  for (const { post, phrases: matched } of picks) {
    let draft: string | null = null;
    if (aiConfigured()) {
      try {
        draft = await replyByAi(post, { brand, about, country: countryName(shop.country ?? "US"), products: productList }, shopId);
      } catch (err) {
        console.error(`[reddit] reply by AI failed, using the plain one: ${(err as Error).message}`);
      }
    }
    if (!draft) {
      const p = products[bestProductIndex(`${post.title} ${post.body ?? ""}`, products)] ?? null;
      draft = fallbackReply({ brand, summary: shop.profile?.summary ?? null, product: p ? { title: p.title, price: p.price, description: p.description } : null });
    }
    try {
      await db.redditThread.create({ data: { shopId, ...post, query: matched[0], draft: ensureDisclosure(draft, brand).slice(0, 3000) } });
      saved++;
    } catch {
      // Saved by another run already.
    }
  }
  await db.shop.update({ where: { id: shopId }, data: { redditCheckedAt: now } });
  return saved;
}

registerJob("reddit.find", async (job) => {
  if (!job.shopId) return;
  await findThreads(job.shopId);
});
