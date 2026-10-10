// Tiny Postgres job queue. Jobs are idempotent: safe to run twice, safe to resume.

import { Prisma, type Job } from "@prisma/client";
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

/** Atomically claim jobs that are ready to run (optionally only some types, or all but some). */
export async function claimJobs(limit: number, filter: { types?: string[]; notTypes?: string[] } = {}): Promise<Job[]> {
  const only = filter.types?.length
    ? Prisma.sql`AND type IN (${Prisma.join(filter.types)})`
    : filter.notTypes?.length
      ? Prisma.sql`AND type NOT IN (${Prisma.join(filter.notTypes)})`
      : Prisma.empty;
  return db.$queryRaw<Job[]>`
    UPDATE "Job" SET status = 'running', "lockedAt" = now(), attempts = attempts + 1, "updatedAt" = now()
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE status = 'queued' AND "runAfter" <= now() ${only}
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

/**
 * Jobs whose worker died (deploy, crash) go back in the queue, up to MAX_ATTEMPTS tries in all.
 * A job that kills the worker every time is stopped instead of looping forever.
 */
export async function requeueStuckJobs(olderThanMs = 10 * 60_000) {
  const cutoff = new Date(Date.now() - olderThanMs);
  await db.job.updateMany({
    where: { status: "running", lockedAt: { lt: cutoff }, attempts: { gte: MAX_ATTEMPTS } },
    data: { status: "failed", lockedAt: null, error: "Stopped: the worker stopped during every attempt" },
  });
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
