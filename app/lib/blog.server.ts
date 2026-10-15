// GEO's own blog at usegeo.app/blog (Ross, 2026-10-15: "practise what we preach"). A background job (`blog.write`)
// writes one article at a time from the topics in lib/blog/topics.ts, has Claude check every fact against the
// knowledge pack, tidies it (`finishPost`) and publishes it. Timing (`blogDue`): a first batch of six, half an hour
// apart, then one on Monday, Wednesday and Friday from 9am Sydney time. Ross gets an email for every post; Admin >
// Blog can hide a post or write one now. Costs are logged like every other Claude call (labels blog-*, no store).
//
// Honesty rules, in the prompts, the check pass and `finishPost`: only numbers that are in the knowledge pack
// (docs/facts.md with its source links, docs/geo-research.md, the stories, the Ask GEO guide); sources are only the
// outside pages in that pack; never a line that says a brand in the stories uses GEO; no em dashes; never advice to
// fake reviews, pose as a customer on Reddit, buy links or stuff keywords.

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import db from "../db.server";
import facts from "../../docs/facts.md?raw";
import research from "../../docs/geo-research.md?raw";
import guide from "../../docs/ask-geo-guide.md?raw";
import { aiConfigured, askJson } from "./ai.server";
import { emailConfigured, sendEmailMessage } from "./email.server";
import { env } from "./env.server";
import { tidyDashes } from "./guide";
import { enqueue, registerJob } from "./jobs.server";
import { STORIES, storyBySlug } from "./stories";
import { storyPath } from "./stories/pages";
import { TOOLS, isToolSlug } from "./tools/registry";
import { SITE_HOST, abs } from "./tools/site";
import { type BlogBody, bodyText, postPath, readMinutes, slugify, wordCount } from "./blog/pages";
import { BLOG_KINDS, BLOG_KIND_LABELS, BLOG_KIND_NOTES, BLOG_TOPICS, type BlogKind, type BlogTopic, nextTopic } from "./blog/topics";

// ---------- when a post is due ----------

/** The first posts go up quickly, half an hour apart, so the blog isn't empty on day one. */
export const BLOG_FIRST_BATCH = 6;
export const BLOG_FIRST_GAP_MS = 30 * 60_000;
/** Then Monday, Wednesday and Friday (Sydney), from this hour. */
export const BLOG_PUBLISH_DAYS = new Set([1, 3, 5]);
export const BLOG_PUBLISH_HOUR = 9;
export const BLOG_TZ = "Australia/Sydney";
/** After a failed write (4 attempts), wait this long before trying a fresh one. */
const RETRY_AFTER_FAIL_MS = 3 * 3_600_000;

export interface BlogState {
  /** Posts written so far, hidden ones included. */
  posts: number;
  lastPublishedAt: Date | null;
  /** When the last `blog.write` job gave up, if it did. */
  lastFailedAt: Date | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The Sydney calendar day ("2026-10-15"), weekday (0 Sunday to 6 Saturday) and hour (0 to 23) of a moment. */
export function sydneyClock(d: Date): { day: string; weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: BLOG_TZ,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS.indexOf(get("weekday").slice(0, 3)),
    hour: Number(get("hour")) % 24,
  };
}

/** Is it time to write the next post? Pure, so the schedule is tested without a database. */
export function blogDue(now: Date, s: BlogState): boolean {
  if (s.lastFailedAt && now.getTime() - s.lastFailedAt.getTime() < RETRY_AFTER_FAIL_MS) return false;
  if (s.posts < BLOG_FIRST_BATCH) return !s.lastPublishedAt || now.getTime() - s.lastPublishedAt.getTime() >= BLOG_FIRST_GAP_MS;
  const c = sydneyClock(now);
  if (!BLOG_PUBLISH_DAYS.has(c.weekday) || c.hour < BLOG_PUBLISH_HOUR) return false;
  return !s.lastPublishedAt || sydneyClock(s.lastPublishedAt).day !== c.day;
}

/** One line for the admin page on what happens next. */
export function blogScheduleLine(s: BlogState): string {
  if (s.posts < BLOG_FIRST_BATCH) {
    return `First batch: ${s.posts} of ${BLOG_FIRST_BATCH} written. The next one is written about 30 minutes after the last.`;
  }
  return "One new post on Monday, Wednesday and Friday from 9am Sydney time.";
}

export async function blogState(): Promise<BlogState> {
  const [posts, last, failed] = await Promise.all([
    db.blogPost.count(),
    db.blogPost.findFirst({ orderBy: { publishedAt: "desc" }, select: { publishedAt: true } }),
    db.job.findFirst({ where: { type: "blog.write", status: "failed" }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } }),
  ]);
  return { posts, lastPublishedAt: last?.publishedAt ?? null, lastFailedAt: failed?.updatedAt ?? null };
}

let lastCheck = 0;
let warnedNoAi = false;

/** Called by the worker every minute; looks at most every 5 minutes and queues one `blog.write` when due. */
export async function queueBlogIfDue(now = new Date()) {
  if (now.getTime() - lastCheck < 5 * 60_000) return;
  lastCheck = now.getTime();
  if (!aiConfigured()) {
    if (!warnedNoAi) console.warn("[blog] Claude is not set up (ANTHROPIC_API_KEY), so no posts are written");
    warnedNoAi = true;
    return;
  }
  if (!blogDue(now, await blogState())) return;
  await enqueue("blog.write", {}, { dedupeKey: "blog.write" });
}

// ---------- the knowledge pack: the only facts a post may use ----------

function storiesDigest(): string {
  return STORIES.map((s) =>
    [
      `### ${s.brand} (${s.business}). Story slug: ${s.slug}. Our page: ${abs(storyPath(s.slug))}`,
      s.h1,
      s.intro,
      s.keyNumbers.length ? `Key numbers: ${s.keyNumbers.map((n) => `${n.value} (${n.label})`).join("; ")}.` : "",
      `What other stores can take from it: ${s.lessons.join(" | ")}`,
      s.caveat ? `Caveat: ${s.caveat}` : "",
      `Source: "${s.source.title}", ${s.source.publisher}${s.source.date ? `, ${s.source.date}` : ""}: ${s.source.url}`,
      ...(s.moreSources ?? []).map((m) => `Also: "${m.title}", ${m.publisher}: ${m.url}`),
      `${s.brand} is not a GEO customer; this is their result as reported by the source.`,
    ]
      .filter(Boolean)
      .join("\n"),
  ).join("\n\n");
}

const toolsDigest = () => TOOLS.map((t) => `- ${t.name} (tool slug: ${t.slug}, ${abs(t.path)}): ${t.short}`).join("\n");

/** Everything the writer and the checker may draw on, as one text. */
export function knowledgePack(): string {
  return [
    "# KNOWLEDGE PACK: the only facts, numbers, quotes and names the article may use",
    "## 1. Facts sheet (every number with its source and date)",
    facts,
    "## 2. What we know about getting recommended by AI (research notes)",
    research,
    "## 3. How GEO works (the product guide)",
    guide,
    "## 4. Stories: other brands' results from AI, as their sources reported them (none are GEO customers)",
    storiesDigest(),
    "## 5. GEO's free tools (link one when it genuinely helps the reader)",
    toolsDigest(),
  ].join("\n\n");
}

const URL_RE = /https?:\/\/[^\s)>\]"'`]+/g;
const normUrl = (u: string) => u.trim().replace(/[.,;:]+$/, "").replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();

/**
 * The outside pages a post may list as sources: every link in the facts and research notes and every story's
 * source. Keyed by the normalised form (lowercase, no trailing slash or #part) for matching, with the URL as the
 * pack writes it as the value, so a saved source keeps its exact address.
 */
export function allowedSourceUrls(): Map<string, string> {
  const map = new Map<string, string>();
  const add = (u: string) => {
    const key = normUrl(u);
    if (key.includes(`//${SITE_HOST}`) || key.includes(`.${SITE_HOST}`)) return;
    if (!map.has(key)) map.set(key, u.trim().replace(/[.,;:]+$/, ""));
  };
  for (const m of `${facts}\n${research}`.matchAll(URL_RE)) add(m[0]);
  for (const s of STORIES) {
    add(s.source.url);
    for (const m of s.moreSources ?? []) add(m.url);
  }
  return map;
}

// ---------- what Claude returns ----------

export const PostSchema = z.object({
  title: z.string().describe("The headline: under 80 characters, a question or a plain promise, no subtitle after a colon"),
  description: z.string().describe("The meta description: one or two sentences under 160 characters on what the reader gets"),
  intro: z.array(z.string()).describe("1 or 2 paragraphs that answer the title directly, before anything else"),
  sections: z
    .array(
      z.object({
        heading: z.string().describe("A plain heading a reader might search for"),
        paragraphs: z.array(z.string()).describe("1 to 3 paragraphs; each makes sense on its own"),
        bullets: z.array(z.string()).nullable().describe("Short bullet points after the paragraphs when they help; null when none"),
      }),
    )
    .describe("4 to 7 sections"),
  takeaways: z.array(z.string()).describe("3 to 5 one-sentence takeaways"),
  faqs: z.array(z.object({ q: z.string(), a: z.string().describe("2 to 4 sentences that stand on their own") })).describe("3 to 5 questions people really ask about this"),
  sources: z
    .array(z.object({ url: z.string().describe("Exactly as it appears in the knowledge pack"), title: z.string().describe("The page's title or publisher") }))
    .describe("The outside pages from the pack whose facts the article uses; empty when it uses none"),
  related_stories: z.array(z.string()).describe("Up to 3 story slugs from the pack that fit this article"),
  related_tools: z.array(z.string()).describe("Up to 3 free tool slugs from the pack that help with this article"),
});
export type PostDraft = z.infer<typeof PostSchema>;

export const CheckSchema = z.object({
  changes: z.array(z.string()).describe("One plain-English line per change made; empty when the article needed none"),
  article: PostSchema,
});

export const TopicSchema = z.object({
  kind: z.string().describe(`One of: ${BLOG_KINDS.join(", ")}`),
  title: z.string().describe("The working title, under 80 characters"),
  brief: z.string().describe("Two or three sentences on what the piece covers and why a store owner would read it"),
});

const WRITER_SYSTEM = `You write GEO's blog: short, honest articles for Shopify store owners about getting their products recommended by AI assistants (ChatGPT, Gemini, Perplexity, Google AI Overviews) and about the search traffic around it.

Rules:
- Plain English a busy shop owner reads in one go. Short sentences. Australian spelling. No jargon: say "AI assistants" or "ChatGPT and co", never "LLM", "AEO", "generative engine optimisation" or "GEO" as a technique. GEO is only the name of our product.
- Never use an em dash. Use a full stop, comma, colon or "and".
- Facts: use only numbers, quotes, names, studies and dates that appear in the knowledge pack, and say where each comes from (the source and its year, for example "OpenAI said in July 2025"). If the pack has no number for something, say so plainly or leave it out. Never invent a statistic, a study, a quote, a customer or a result.
- The brands in the stories are other companies. Never say or imply that any of them uses GEO or is a GEO customer.
- Never recommend fake reviews, posting on Reddit as a customer, buying links or link swaps, or stuffing keywords. Where a topic touches these, say they are against the platforms' rules and hurt the store.
- No promises of results, no medical or legal claims. Say what tends to help and why.
- Answer first: the intro answers the title directly. Every section stands on its own, so an AI assistant could quote it alone. Never "as mentioned above".
- Mention GEO at most once, in one plain sentence, only where it genuinely helps the reader. This is advice, not an ad.
- Length: 900 to 1,400 words in total.`;

const CHECK_SYSTEM = `You are the fact checker for GEO's blog. You get an article as JSON and the knowledge pack it was written from. Return the same article, corrected:
- Any number, date, quote, name, study or result the pack does not support: change it to what the pack says, or remove that sentence.
- Any sentence that says or implies a brand uses GEO or is a GEO customer: remove it.
- Any promise of results, medical or legal claim, or advice to fake reviews, pose as a customer, buy links or stuff keywords: remove it or soften it.
- Any em dash: replace it with a full stop, comma or colon.
- Any source URL that is not in the pack: remove that source.
Keep everything else exactly as written. List every change you made in plain English; an empty list means the article was fine.`;

const TOPIC_SYSTEM = `You plan GEO's blog for Shopify store owners who want their products recommended by AI assistants (ChatGPT, Gemini, Perplexity, Google AI Overviews). Propose one new article topic a store owner would search for, that can be answered honestly from the knowledge pack alone, and that none of the existing posts already covers. Never a comparison that names another company's product. No em dashes.`;

function writerPrompt(topic: BlogTopic, existingTitles: string[], allowed: Map<string, string>, pack: string): string {
  return [
    "Write the article.",
    "",
    `Kind: ${BLOG_KIND_LABELS[topic.kind]}. ${BLOG_KIND_NOTES[topic.kind]}`,
    `Working title: ${topic.title}`,
    `Brief: ${topic.brief}`,
    "",
    "Already on the blog (do not repeat these):",
    ...(existingTitles.length ? existingTitles.map((t) => `- ${t}`) : ["- nothing yet"]),
    "",
    "Sources may only be these pages:",
    ...[...allowed.values()].map((u) => `- ${u}`),
    "",
    pack,
  ].join("\n");
}

// ---------- tidying and checking what comes back ----------

/** A post that can't be published as written; the job tries again with a fresh draft. */
export class PostProblem extends Error {}

const clean = (s: unknown) => tidyDashes(String(s ?? "").replace(/\s+/g, " ").trim());
const list = (xs: readonly unknown[] | null | undefined) => (xs ?? []).map(clean).filter(Boolean);
const uniq = <T>(xs: T[]) => [...new Set(xs)];

/** Under 160 characters: whole sentences while they fit, else cut at a word. */
export function fitDescription(d: string, max = 160): string {
  if (d.length <= max) return d;
  const sentences = d.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((s) => s.trim()) ?? [d];
  let out = "";
  for (const s of sentences) {
    if (`${out} ${s}`.trim().length > max) break;
    out = `${out} ${s}`.trim();
  }
  if (out) return out;
  const cut = d.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}.`;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Phrases that would make a reader think someone is a GEO customer, or that GEO caused a result. */
const CUSTOMER_CLAIM = /\bGEO(?:'s)? (?:customer|client|user|member)s?\b|\b(?:uses?|used|using|switched to|signed up (?:to|for)|joined|installed|thanks to|because of) GEO\b|\bGEO (?:helped|got|gave|grew|drove)\b/i;
const BRAND_RES = STORIES.map((s) => new RegExp(`\\b${escapeRe(s.brand)}\\b`));

/** The first sentence that says a story's brand uses GEO or that GEO did something, or null. */
export function customerClaim(text: string): string | null {
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (CUSTOMER_CLAIM.test(sentence)) return sentence;
    if (/\bGEO\b/.test(sentence) && BRAND_RES.some((re) => re.test(sentence))) return sentence;
  }
  return null;
}

/** Up to 3 real story slugs, the writer's picks first, topped up with the first shop stories. */
export function pickStories(slugs: string[]): string[] {
  const picked = uniq(slugs.filter((s) => storyBySlug(s))).slice(0, 3);
  for (const s of STORIES) {
    if (picked.length >= 3) break;
    if (s.ecommerce && !picked.includes(s.slug)) picked.push(s.slug);
  }
  return picked;
}

export interface FinishedPost {
  title: string;
  description: string;
  kind: BlogKind;
  topicKey: string;
  body: BlogBody;
  words: number;
}

/**
 * Turns Claude's article into what we save: dashes tidied, sources only from the pack, related links only to real
 * pages, and the article refused (PostProblem) when it is too short or long, thin, or claims a brand uses GEO.
 */
export function finishPost(a: PostDraft, topic: Pick<BlogTopic, "key" | "kind">, allowed: Map<string, string>): FinishedPost {
  const title = clean(a.title).replace(/[.:]+$/, "");
  if (title.length < 15 || title.length > 80) throw new PostProblem(`the title is ${title.length} characters`);
  const description = fitDescription(clean(a.description));
  if (description.length < 40) throw new PostProblem("the description is too short");
  const sections = a.sections
    .map((s) => {
      const bullets = list(s.bullets);
      return { heading: clean(s.heading).replace(/[.:]+$/, ""), paragraphs: list(s.paragraphs), ...(bullets.length ? { bullets } : {}) };
    })
    .filter((s) => s.heading && s.paragraphs.length);
  const seen = new Set<string>();
  const sources: BlogBody["sources"] = [];
  for (const s of a.sources) {
    const key = normUrl(s.url);
    const url = allowed.get(key);
    const title = clean(s.title);
    if (!url || seen.has(key) || !title) continue;
    seen.add(key);
    sources.push({ url, title });
  }
  const body: BlogBody = {
    intro: list(a.intro),
    sections,
    takeaways: list(a.takeaways).slice(0, 6),
    faqs: a.faqs.map((f) => ({ q: clean(f.q), a: clean(f.a) })).filter((f) => f.q && f.a).slice(0, 6),
    sources,
    relatedStories: pickStories(a.related_stories),
    relatedTools: uniq(a.related_tools.filter(isToolSlug)).slice(0, 3),
  };
  if (!body.intro.length) throw new PostProblem("no intro");
  if (sections.length < 3) throw new PostProblem(`only ${sections.length} sections`);
  if (body.takeaways.length < 2) throw new PostProblem("fewer than 2 takeaways");
  const words = wordCount(body);
  if (words < 600 || words > 1800) throw new PostProblem(`${words} words (we publish 600 to 1,800)`);
  const claim = customerClaim([title, description, ...bodyText(body)].join("\n"));
  if (claim) throw new PostProblem(`says a brand uses GEO: "${claim.slice(0, 120)}"`);
  return { title, description, kind: topic.kind, topicKey: topic.key, body, words };
}

// ---------- writing ----------

/** Writes, fact-checks and tidies one post. Throws PostProblem when the result can't be published. */
export async function writePost(topic: BlogTopic, existingTitles: string[]): Promise<FinishedPost & { changes: string[] }> {
  const pack = knowledgePack();
  const allowed = allowedSourceUrls();
  const draft = await askJson({
    schema: PostSchema,
    system: WRITER_SYSTEM,
    prompt: writerPrompt(topic, existingTitles, allowed, pack),
    tier: "smart",
    maxTokens: 12_000,
    label: "blog-write",
    shopId: null,
  });
  const checked = await askJson({
    schema: CheckSchema,
    system: CHECK_SYSTEM,
    prompt: `ARTICLE (JSON):\n${JSON.stringify(draft, null, 1)}\n\n${pack}`,
    tier: "smart",
    effort: "low",
    maxTokens: 12_000,
    label: "blog-check",
    shopId: null,
    style: false,
  });
  return { ...finishPost(checked.article, topic, allowed), changes: checked.changes.map(clean).filter(Boolean) };
}

/** When every seed topic is written: Claude proposes the next one, rotating through the kinds. */
export async function proposeTopic(existingTitles: string[], postsSoFar: number): Promise<BlogTopic> {
  const preferred = BLOG_KINDS[postsSoFar % BLOG_KINDS.length];
  const t = await askJson({
    schema: TopicSchema,
    system: TOPIC_SYSTEM,
    prompt: [
      `Kinds and what each asks for:`,
      ...BLOG_KINDS.map((k) => `- ${k}: ${BLOG_KIND_NOTES[k]}`),
      `Preferred kind this time: ${preferred}.`,
      "",
      "Already on the blog:",
      ...(existingTitles.length ? existingTitles.map((x) => `- ${x}`) : ["- nothing yet"]),
      "",
      knowledgePack(),
    ].join("\n"),
    tier: "fast",
    label: "blog-topic",
    shopId: null,
  });
  const kind = (BLOG_KINDS as readonly string[]).includes(t.kind) ? (t.kind as BlogKind) : preferred;
  const title = clean(t.title);
  if (title.length < 15) throw new PostProblem("the proposed topic has no usable title");
  return { key: `auto-${slugify(title)}`, kind, title, brief: clean(t.brief) };
}

/** `slug`, or `slug-2`, `slug-3`... when a post already has it. */
async function freeSlug(base: string): Promise<string> {
  for (let n = 1; n < 50; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await db.blogPost.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  throw new Error(`no free slug for ${base}`);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Tells Ross a post is live, with the link, what the fact check changed, and how to hide it. */
async function notifyPublished(post: { id: string; slug: string; title: string; description: string; kind: string; words: number }, changes: string[]) {
  if (!env.alertEmail || !emailConfigured()) return;
  const url = abs(postPath(post.slug));
  const adminUrl = `${env.appUrl || abs("")}/dash/admin/blog`;
  const changesHtml = changes.length
    ? `<p>The fact check changed ${changes.length} thing${changes.length === 1 ? "" : "s"}:</p><ul>${changes.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`
    : "<p>The fact check found nothing to change.</p>";
  await sendEmailMessage({
    to: [env.alertEmail],
    subject: `New blog post: ${post.title}`,
    html: `<p>A new post is live on the GEO blog.</p><p><a href="${esc(url)}"><strong>${esc(post.title)}</strong></a><br>${esc(BLOG_KIND_LABELS[post.kind as BlogKind] ?? "Article")} · ${post.words} words · about ${readMinutes(post.words)} minute read</p><p>${esc(post.description)}</p>${changesHtml}<p>Not happy with it? Hide it in <a href="${esc(adminUrl)}">Admin, Blog</a>. It disappears from the blog, the sitemap and search within minutes.</p>`,
    text: `A new post is live on the GEO blog: ${post.title}\n${url}\n\n${post.description}\n\n${changes.length ? `The fact check changed:\n${changes.map((c) => `- ${c}`).join("\n")}` : "The fact check found nothing to change."}\n\nNot happy with it? Hide it in Admin, Blog: ${adminUrl}`,
    idempotencyKey: `blog:${post.id}`,
  });
}

export const POST_CARD_SELECT = { slug: true, title: true, description: true, kind: true, publishedAt: true, words: true } as const;

/** One post: the next seed topic (or the one named in the payload, or a proposed one), written, checked, saved, emailed. */
registerJob("blog.write", async (job) => {
  if (!aiConfigured()) throw new Error("Claude is not set up (ANTHROPIC_API_KEY), so the blog can't be written");
  const payload = (job.payload ?? {}) as { topicKey?: string };
  const posts = await db.blogPost.findMany({ select: { topicKey: true, title: true }, orderBy: { publishedAt: "desc" } });
  const used = posts.map((p) => p.topicKey).filter((k): k is string => Boolean(k));
  const titles = posts.map((p) => p.title);
  const asked = payload.topicKey && !used.includes(payload.topicKey) ? BLOG_TOPICS.find((t) => t.key === payload.topicKey) : null;
  const topic = asked ?? nextTopic(used) ?? (await proposeTopic(titles, posts.length));
  const post = await writePost(topic, titles);
  const slug = await freeSlug(slugify(post.title));
  const saved = await db.blogPost.create({
    data: {
      slug,
      title: post.title,
      description: post.description,
      kind: post.kind,
      topicKey: post.topicKey,
      body: post.body as unknown as Prisma.InputJsonValue,
      words: post.words,
    },
    select: { id: true, slug: true, title: true, description: true, kind: true, words: true },
  });
  console.log(`[blog] published ${abs(postPath(slug))} (${post.words} words, ${post.changes.length} fact-check change(s))`);
  await notifyPublished(saved, post.changes).catch((err) => console.error("[blog] email failed:", (err as Error).message));
});
