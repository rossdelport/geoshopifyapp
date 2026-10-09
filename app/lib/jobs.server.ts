// Tiny Postgres job queue. Jobs are idempotent: safe to run twice, safe to resume.

import type { Job, Prisma } from "@prisma/client";
import db from "../db.server";

export type JobHandler = (job: Job) => Promise<void>;
const handlers = new Map<string, JobHandler>();

export function registerJob(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}
export const getHandler = (type: string) => handlers.get(type);

interface EnqueueOptions {
  shopId?: string | null;
  runAfter?: Date;
  /** Only one active (queued/running) job per key. Finished jobs with the key are reused. */
  dedupeKey?: string;
}

export async function enqueue(
  type: string,
  payload: Prisma.InputJsonValue = {},
  opts: EnqueueOptions = {},
): Promise<Job | null> {
  const data = {
    type,
    payload,
    shopId: opts.shopId ?? null,
    runAfter: opts.runAfter ?? new Date(),
    status: "queued",
    attempts: 0,
    error: null,
    lockedAt: null,
  };
  if (!opts.dedupeKey) return db.job.create({ data });

  const existing = await db.job.findUnique({ where: { dedupeKey: opts.dedupeKey } });
  if (existing && (existing.status === "queued" || existing.status === "running")) return null;
  if (existing) return db.job.update({ where: { id: existing.id }, data });
  try {
    return await db.job.create({ data: { ...data, dedupeKey: opts.dedupeKey } });
  } catch {
    return null; // another process created it first
  }
}

/** Atomically claim jobs that are ready to run. */
export async function claimJobs(limit: number): Promise<Job[]> {
  return db.$queryRaw<Job[]>`
    UPDATE "Job" SET status = 'running', "lockedAt" = now(), attempts = attempts + 1, "updatedAt" = now()
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE status = 'queued' AND "runAfter" <= now()
      ORDER BY "runAfter" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

export const MAX_ATTEMPTS = 4;

export async function finishJob(job: Job, error?: unknown) {
  if (!error) {
    await db.job.update({ where: { id: job.id }, data: { status: "done", lockedAt: null, error: null } });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  const retry = job.attempts < MAX_ATTEMPTS;
  await db.job.update({
    where: { id: job.id },
    data: {
      status: retry ? "queued" : "failed",
      lockedAt: null,
      error: message.slice(0, 2000),
      runAfter: new Date(Date.now() + 2 ** job.attempts * 60_000),
    },
  });
}

/** Jobs whose worker died (deploy, crash) go back in the queue. */
export async function requeueStuckJobs(olderThanMs = 10 * 60_000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  await db.job.updateMany({
    where: { status: "running", lockedAt: { lt: cutoff } },
    data: { status: "queued", lockedAt: null },
  });
}

export async function heartbeat(jobId: string) {
  await db.job.update({ where: { id: jobId }, data: { lockedAt: new Date() } }).catch(() => {});
}

export async function activeJob(shopId: string, type: string) {
  return db.job.findFirst({
    where: { shopId, type, status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "desc" },
  });
}
