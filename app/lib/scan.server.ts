// Scans: ask every tracked question on every AI engine (2 runs each), read the answers,
// score the shop. Resumable: if the server restarts, the job picks up where it stopped.

import type { AiAnswer, Question } from "@prisma/client";
import db from "../db.server";
import { askEngine } from "./treg.server";
import { parseAnswer, type MerchantContext } from "./parse.server";
import { visibilityScore } from "./score";
import { enqueue, heartbeat, registerJob } from "./jobs.server";
import { getPlan, scanSettings, type Engine } from "./plans";
import { sameBrand } from "./match";
import { pool } from "./pool";

const CONCURRENCY = 10;
const MAX_ANSWER_ATTEMPTS = 2;

export async function startScan(shopId: string, kind: "free" | "baseline" | "weekly" | "daily" | "manual") {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId } });
  const plan = getPlan(shop.plan);
  const running = await db.scan.findFirst({ where: { shopId, status: { in: ["queued", "running"] } } });
  if (running) return running;

  const { engines, runs } = scanSettings(plan, kind);
  const questions = await db.question.findMany({
    where: { shopId, active: true },
    orderBy: [{ volume: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
    take: plan.questions,
  });
  if (!questions.length) throw new Error("No questions to scan yet");

  const total = questions.length * engines.length * runs;
  const scan = await db.scan.create({
    data: { shopId, kind, engines, runs, total, status: "queued" },
  });
  const rows = questions.flatMap((q) =>
    engines.flatMap((engine) =>
      Array.from({ length: runs }, (_, i) => ({ scanId: scan.id, questionId: q.id, engine, runNo: i + 1 })),
    ),
  );
  await db.aiAnswer.createMany({ data: rows, skipDuplicates: true });
  if (kind === "free") await db.shop.update({ where: { id: shopId }, data: { freeScanUsedAt: new Date() } });
  await enqueue("scan.run", { scanId: scan.id }, { shopId, dedupeKey: `scan-run:${scan.id}` });
  return scan;
}

async function merchantContext(shopId: string): Promise<MerchantContext> {
  const shop = await db.shop.findUniqueOrThrow({ where: { id: shopId }, include: { profile: true } });
  const products = await db.product.findMany({
    where: { shopId, status: "ACTIVE" },
    select: { title: true },
    take: 40,
  });
  const aliases = (shop.profile?.aliases as string[] | undefined) ?? [];
  const brandNames = [shop.profile?.brandName, shop.name, ...aliases].filter(
    (n, i, all): n is string => Boolean(n) && all.findIndex((x) => x && sameBrand(x, n!)) === i,
  );
  return {
    shopId,
    brandNames: brandNames.length ? brandNames : [shop.domain.split(".")[0]],
    domains: [shop.primaryDomain, shop.domain].filter(Boolean) as string[],
    productTitles: products.map((p) => p.title),
  };
}

async function processAnswer(
  answer: AiAnswer & { question: Question },
  ctx: MerchantContext,
  country: string,
) {
  try {
    const result = await askEngine(answer.engine as Engine, answer.question.text, country, ctx.shopId ?? undefined);
    if (result.empty) {
      await db.aiAnswer.update({
        where: { id: answer.id },
        data: { status: "empty", provider: result.provider, text: null, lockedAt: null },
      });
    } else {
      const parsed = await parseAnswer(result, ctx);
      await db.$transaction([
        db.mention.deleteMany({ where: { answerId: answer.id } }),
        db.citation.deleteMany({ where: { answerId: answer.id } }),
        db.mention.createMany({
          data: parsed.brands.map((b, i) => ({
            answerId: answer.id,
            brand: b.name,
            product: b.product,
            position: i + 1,
            isMerchant: parsed.position === i + 1,
          })),
        }),
        db.citation.createMany({
          data: parsed.citations.map((c) => ({ answerId: answer.id, ...c })),
        }),
        db.aiAnswer.update({
          where: { id: answer.id },
          data: {
            status: "parsed",
            provider: result.provider,
            text: result.text,
            mentioned: parsed.mentioned,
            position: parsed.position,
            error: null,
            lockedAt: null,
          },
        }),
      ]);
    }
    await db.scan.update({ where: { id: answer.scanId }, data: { done: { increment: 1 } } });
  } catch (err) {
    const message = (err as Error).message.slice(0, 1000);
    const giveUp = answer.attempts + 1 >= MAX_ANSWER_ATTEMPTS;
    await db.aiAnswer.update({
      where: { id: answer.id },
      data: { attempts: { increment: 1 }, error: message, status: giveUp ? "failed" : "pending", lockedAt: null },
    });
    if (giveUp) {
      await db.scan.update({ where: { id: answer.scanId }, data: { failed: { increment: 1 }, done: { increment: 1 } } });
    }
    console.error(`[scan] ${answer.engine} failed (${answer.attempts + 1}): ${message}`);
  }
}

export async function runScan(scanId: string, jobId?: string) {
  const scan = await db.scan.findUnique({ where: { id: scanId }, include: { shop: true } });
  if (!scan || scan.status === "done") return;
  await db.scan.update({ where: { id: scanId }, data: { status: "running" } });
  const ctx = await merchantContext(scan.shopId);

  for (;;) {
    const staleLock = new Date(Date.now() - 5 * 60_000);
    const batch = await db.aiAnswer.findMany({
      where: {
        scanId,
        status: "pending",
        attempts: { lt: MAX_ANSWER_ATTEMPTS },
        OR: [{ lockedAt: null }, { lockedAt: { lt: staleLock } }],
      },
      include: { question: true },
      orderBy: [{ runNo: "asc" }, { createdAt: "asc" }],
      take: CONCURRENCY * 4,
    });
    if (!batch.length) break;
    await db.aiAnswer.updateMany({
      where: { id: { in: batch.map((a) => a.id) } },
      data: { lockedAt: new Date() },
    });
    if (jobId) await heartbeat(jobId);
    await pool(batch, CONCURRENCY, (a) => processAnswer(a, ctx, scan.shop.country));
  }
  await finishScan(scanId);
}

export async function finishScan(scanId: string) {
  const scan = await db.scan.findUniqueOrThrow({ where: { id: scanId }, include: { shop: true } });
  const answers = await db.aiAnswer.findMany({
    where: { scanId, status: "parsed" },
    include: { citations: { where: { isOwn: true }, select: { id: true } }, mentions: true },
  });
  const { score, byEngine, mentionRate } = visibilityScore(
    answers.map((a) => ({ engine: a.engine, mentioned: a.mentioned, position: a.position, cited: a.citations.length > 0 })),
  );

  const costs = await db.apiCost.aggregate({
    where: { shopId: scan.shopId, createdAt: { gte: scan.startedAt } },
    _sum: { usd: true },
  });

  await db.$transaction([
    db.visibilitySnapshot.upsert({
      where: { scanId },
      create: { shopId: scan.shopId, scanId, score, byEngine, mentionRate },
      update: { score, byEngine, mentionRate },
    }),
    db.scan.update({
      where: { id: scanId },
      data: {
        status: answers.length ? "done" : "failed",
        score,
        finishedAt: new Date(),
        costUsd: costs._sum.usd ?? 0,
        error: answers.length ? null : "No AI answers could be read. We'll try again on the next scan.",
      },
    }),
    db.shop.update({
      where: { id: scan.shopId },
      data: {
        lastScanAt: new Date(),
        baselineDate: scan.shop.baselineDate ?? new Date(),
        onboarding: "done",
      },
    }),
  ]);

  // Competitors = brands the AI names instead of the merchant, most frequent first.
  const counts = new Map<string, { name: string; n: number }>();
  for (const m of answers.flatMap((a) => a.mentions)) {
    if (m.isMerchant) continue;
    const existing = [...counts.values()].find((c) => sameBrand(c.name, m.brand));
    if (existing) existing.n++;
    else counts.set(m.brand, { name: m.brand, n: 1 });
  }
  const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 15);
  const known = await db.competitor.findMany({ where: { shopId: scan.shopId } });
  for (const c of top) {
    if (known.some((k) => sameBrand(k.name, c.name))) continue;
    await db.competitor.create({ data: { shopId: scan.shopId, name: c.name } }).catch(() => {});
  }

  const plan = getPlan(scan.shop.plan);
  if (plan.fixesPerMonth > 0) await enqueue("fixes.generate", { scanId }, { shopId: scan.shopId, dedupeKey: `fixes:${scan.shopId}` });
  if (plan.outreachPerMonth > 0) await enqueue("outreach.find", {}, { shopId: scan.shopId, dedupeKey: `outreach:${scan.shopId}` });
}

registerJob("scan.run", async (job) => {
  const { scanId } = job.payload as { scanId: string };
  await runScan(scanId, job.id);
});

registerJob("scan.start", async (job) => {
  const { kind } = job.payload as { kind: "free" | "baseline" | "weekly" | "daily" | "manual" };
  await startScan(job.shopId!, kind);
});
