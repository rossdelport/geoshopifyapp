// Website fixes for a local business (Ross, 19 Nov 2026). Once a week (the site.check job, queued by the worker) the
// hub reads the business's home page and up to 5 of its other pages, finds what to fix (lib/site-check.ts) and writes
// the new words: page titles, descriptions and main headings, and on the home page the business details code and
// questions and answers. Only facts from their own website and the facts box are used; nothing waits for the client.
// About one new fix a day (7 a week). Ross makes the change (or pastes it in), then marks it made, which goes in the
// work log and the client's reports.

import { z } from "zod";
import type { Shop } from "@prisma/client";
import db from "../db.server";
import { registerJob } from "./jobs.server";
import { aiConfigured, askJson } from "./ai.server";
import { isLocal } from "./business";
import { noDashes } from "./store-report";
import { FIXES_PER_WEEK, type Problem, SITE_FIX_WHAT, type SiteFixKind, businessSchema, fixFits, pageKey, pageProblems, pagesToRead, readPage } from "./site-check";

const DAY = 86_400_000;

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (compatible; RankWithRoss/1.0; +https://rankwithross.com.au)" }, signal: AbortSignal.timeout(15_000), redirect: "follow" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    return (await res.text()).slice(0, 600_000);
  } catch {
    return null;
  }
}

/** Whether a local business is due its weekly read (Done for you only, once set up). */
export function siteCheckDue(shop: Pick<Shop, "kind" | "plan" | "onboarding" | "siteCheckedAt">, planId: string, now = new Date()): boolean {
  if (!isLocal(shop) || planId !== "pro" || shop.onboarding !== "done") return false;
  return !shop.siteCheckedAt || now.getTime() - shop.siteCheckedAt.getTime() >= 7 * DAY - 3_600_000;
}

const WriteSchema = z.object({
  fixes: z.array(z.object({ id: z.string(), after: z.string() })),
});

interface Ask {
  id: string;
  page: string;
  kind: SiteFixKind;
  before: string | null;
  text: string;
}

/** The new words for the titles, descriptions, headings and questions and answers, written in one go. */
async function writeWords(shop: Shop & { profile: { brandName: string | null; summary: string | null } | null }, asks: Ask[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!asks.length || !aiConfigured()) return out;
  const name = shop.profile?.brandName ?? shop.name ?? shop.domain;
  const result = await askJson({
    schema: WriteSchema,
    tier: "smart",
    label: "site-fixes",
    shopId: shop.id,
    maxTokens: 6000,
    system: `You improve the website of a local business so Google and AI assistants understand what it does and where. You write only what is asked for each item, in plain, friendly English that a 10 year old can read.

Rules:
- Use only facts from the page's own words or the facts below. Never invent prices, licences, years, awards, reviews, ratings, guarantees or response times. If a fact isn't given, leave it out.
- title: 50 to 60 letters. What they do, the town, then the business name. No shouting, no "best" or "#1".
- description: 140 to 155 letters. What they do, where, and one true reason to pick them from the page.
- h1: 20 to 70 letters. What they do and where, as a heading.
- faq: 4 to 6 questions customers really ask before choosing a business like this, each on its own line ending with "?", the answer on the next line (1 to 3 short sentences), a blank line between pairs. Answers come from the page and the facts; when the page doesn't say, give honest general advice instead of a fact about the business.
- Never use a dash as punctuation.`,
    prompt: `Business: ${name}
Town or area: ${shop.area ?? "not given"}
What they do: ${shop.profile?.summary ?? "see the pages"}
Facts from the business (true, OK to use):
${shop.facts ?? "none given"}

Write each item:
${asks
  .map((a) => `--- id ${a.id}: ${a.kind} for ${a.page}
Now: ${a.before ?? "(none)"}
The page's words: ${a.text.slice(0, 1500)}`)
  .join("\n\n")}`,
  });
  for (const f of result.fixes) {
    const ask = asks.find((a) => a.id === f.id);
    if (!ask) continue;
    const after = ask.kind === "faq" ? f.after.split("\n").map((l) => noDashes(l)).join("\n").replace(/\n{3,}/g, "\n\n").trim() : noDashes(f.after).replace(/\s+/g, " ");
    if (fixFits(ask.kind, after)) out.set(ask.id, after);
  }
  return out;
}

/** Read the website and save new fixes (at most about one a day). Returns how many it added. */
export async function checkSite(shopId: string, now = new Date()): Promise<number> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, include: { profile: { select: { brandName: true, summary: true } } } });
  const home = `https://${shop.primaryDomain ?? shop.domain}`;
  const homeHtml = await fetchHtml(home);
  if (!homeHtml) throw new Error(`Couldn’t read ${home}`);
  const others = pagesToRead(homeHtml, home);
  const pages = [readPage(homeHtml, home)];
  for (const url of others) {
    const html = await fetchHtml(url);
    if (html) pages.push(readPage(html, url));
  }

  // Skip what was found before (made, set aside or still to do): each page and kind once.
  const known = new Set((await db.siteFix.findMany({ where: { shopId }, select: { page: true, kind: true } })).map((f) => `${pageKey(f.page)}|${f.kind}`));
  const todo: { page: (typeof pages)[number]; problem: Problem }[] = [];
  pages.forEach((p, i) => {
    for (const problem of pageProblems(p, { home: i === 0, area: shop.area })) {
      if (!known.has(`${pageKey(p.url)}|${problem.kind}`)) todo.push({ page: p, problem });
    }
  });
  // Home page first, then the order found; the business details code first of all (it needs no writing).
  const order: SiteFixKind[] = ["schema", "title", "description", "faq", "h1"];
  todo.sort((a, b) => Number(b.page.url === home) - Number(a.page.url === home) || order.indexOf(a.problem.kind) - order.indexOf(b.problem.kind));
  const pick = todo.slice(0, FIXES_PER_WEEK);

  const name = shop.profile?.brandName ?? shop.name ?? shop.domain;
  const asks: Ask[] = pick.filter((t) => t.problem.kind !== "schema").map((t, i) => ({ id: String(i + 1), page: t.page.url, kind: t.problem.kind, before: t.problem.before, text: t.page.text }));
  const words = await writeWords(shop, asks);

  let added = 0;
  for (const t of pick) {
    const after =
      t.problem.kind === "schema"
        ? businessSchema({ name, url: home, phone: t.page.phone, area: shop.area, description: shop.profile?.summary ?? null })
        : words.get(asks.find((a) => a.page === t.page.url && a.kind === t.problem.kind)?.id ?? "");
    if (!after) continue;
    try {
      await db.siteFix.create({
        data: { shopId, page: t.page.url, kind: t.problem.kind, what: SITE_FIX_WHAT[t.problem.kind], before: t.problem.before, after, why: t.problem.why },
      });
      added++;
    } catch {
      // Saved by another run already.
    }
  }
  await db.shop.update({ where: { id: shopId }, data: { siteCheckedAt: now } });
  return added;
}

registerJob("site.check", async (job) => {
  if (!job.shopId) return;
  const added = await checkSite(job.shopId);
  console.log(`[site] ${job.shopId}: ${added} new website fixes`);
});

/** Mark a fix made, set aside, or back to do. */
export async function setSiteFix(shopId: string, id: string, status: "todo" | "done" | "skip", by: string): Promise<boolean> {
  const done = status === "done";
  const r = await db.siteFix.updateMany({ where: { id, shopId }, data: { status, doneAt: done ? new Date() : null, doneBy: done ? by : null } });
  return r.count > 0;
}

/** Everything the Website page shows: what to do first, then what was made or set aside. */
export async function siteFixesView(shopId: string) {
  const rows = await db.siteFix.findMany({ where: { shopId }, orderBy: [{ createdAt: "asc" }] });
  const view = (f: (typeof rows)[number]) => ({
    id: f.id,
    page: f.page,
    kind: f.kind as SiteFixKind,
    what: f.what,
    before: f.before,
    after: f.after,
    why: f.why,
    status: f.status,
    doneAt: f.doneAt?.toISOString() ?? null,
  });
  return {
    todo: rows.filter((f) => f.status === "todo").map(view),
    done: rows.filter((f) => f.status !== "todo").sort((a, b) => (b.doneAt ?? b.updatedAt).getTime() - (a.doneAt ?? a.updatedAt).getTime()).map(view),
  };
}
