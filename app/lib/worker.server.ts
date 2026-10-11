// Background worker: runs queued jobs and schedules recurring work (scans, reports).
// Runs inside the web server process (one Railway service, nothing extra to manage).

import db from "../db.server";
import { claimJobs, enqueue, finishJob, getHandler, heartbeat, requeueStuckJobs } from "./jobs.server";
import { getPlan } from "./plans";
import { canRunScan, startOfMonth } from "./limits";
import { getUsageFor } from "./usage.server";
import { env } from "./env.server";

// Register every job type.
import "./onboard-job.server";
import "./scan.server";
import "./orders.server";
import "./fixes.server";
import "./outreach.server";
import "./report.server";
import "./billing.server";
import "./check.server";
import { maybeRunSelftest } from "./selftest.server";
import { purgeOldData } from "./retention.server";
import { queueStrandedReportEmails } from "./check-lead.server";

const MAX_RUNNING = 4; // store jobs: onboarding, scans, orders, fixes...
// Free checks from the public website get their own small share, so a rush of them never holds up
// stores' jobs (and stores' jobs never stall a visitor's check).
const CHECK_JOB = "check.run";
const MAX_CHECKS = 2;
let running = 0;
let runningChecks = 0;
let started = false;
// Set when Railway asks this server to stop (a new version is live): take no new jobs, let the running
// ones finish (a free check takes a few minutes), then exit. RAILWAY_DEPLOYMENT_DRAINING_SECONDS on the
// service gives us that time before the container is killed.
let draining = false;
const DRAIN_MAX_MS = 330_000;

async function runJob(job: Awaited<ReturnType<typeof claimJobs>>[number]) {
  const handler = getHandler(job.type);
  const beat = setInterval(() => heartbeat(job.id), 60_000);
  try {
    if (!handler) throw new Error(`No handler for job type ${job.type}`);
    await handler(job);
    await finishJob(job);
  } catch (err) {
    console.error(`[worker] job ${job.type} ${job.id} failed (attempt ${job.attempts}):`, (err as Error).message);
    await finishJob(job, err);
  } finally {
    clearInterval(beat);
  }
}

async function tick() {
  if (draining) return;
  try {
    if (running < MAX_RUNNING) {
      for (const job of await claimJobs(MAX_RUNNING - running, { notTypes: [CHECK_JOB] })) {
        running++;
        runJob(job).finally(() => running--);
      }
    }
    if (runningChecks < MAX_CHECKS) {
      for (const job of await claimJobs(MAX_CHECKS - runningChecks, { types: [CHECK_JOB] })) {
        runningChecks++;
        runJob(job).finally(() => runningChecks--);
      }
    }
  } catch (err) {
    console.error("[worker] tick failed:", (err as Error).message);
  }
}

const DAY = 86_400_000;

let lastPurge = 0;

export async function scheduleDueWork(now = new Date()) {
  if (draining) return;
  await requeueStuckJobs();
  // Hourly, so hashed IPs on free checks are gone within about a day (see retention.server.ts).
  if (now.getTime() - lastPurge > 3_600_000) {
    lastPurge = now.getTime();
    await purgeOldData(now).catch((err) => console.error("[retention] failed:", err.message));
  }
  // Free check report emails that missed their queue (check-lead.server.ts also registers check.email).
  await queueStrandedReportEmails(now).catch((err) => console.error("[check] report email sweep failed:", err.message));
  const shops = await db.shop.findMany({ where: { status: "installed", onboarding: "done" } });

  for (const shop of shops) {
    const plan = getPlan(shop.plan);

    // Recurring scans.
    if (plan.scanEveryDays) {
      const due = !shop.lastScanAt || now.getTime() - shop.lastScanAt.getTime() >= plan.scanEveryDays * DAY - 3_600_000;
      if (due) {
        const usage = await getUsageFor(shop.id);
        const check = canRunScan(plan, usage, true);
        if (check.ok) {
          let kind: "weekly" | "daily" = "weekly";
          if (plan.id === "pro") {
            const lastDeep = await db.scan.findFirst({
              // "Check AI now" is a light scan (1 run, no Claude), so it doesn't count as the weekly full one.
              where: { shopId: shop.id, kind: { in: ["weekly", "baseline"] }, status: "done" },
              orderBy: { startedAt: "desc" },
            });
            kind = lastDeep && now.getTime() - lastDeep.startedAt.getTime() < 7 * DAY ? "daily" : "weekly";
          }
          await enqueue("scan.start", { kind }, { shopId: shop.id, dedupeKey: `scan-start:${shop.id}` });
        } else if (!shop.costAlertedAt) {
          console.warn(`[cost] ${shop.domain} paused: ${check.reason} ($${usage.costThisMonth.toFixed(2)})`);
          await db.shop.update({ where: { id: shop.id }, data: { costAlertedAt: now } });
        }
      }
    }

    // Monthly report in the first 3 days of the month, once.
    const monthStart = startOfMonth(now);
    if (
      plan.monthlyReport &&
      now.getUTCDate() <= 3 &&
      shop.installedAt < monthStart &&
      (!shop.lastReportAt || shop.lastReportAt < monthStart) &&
      env.resendKey
    ) {
      await enqueue("report.monthly", {}, { shopId: shop.id, dedupeKey: `report:${shop.id}` });
    }
  }
}

/** Stop taking jobs, wait for the running ones (at most DRAIN_MAX_MS), then exit. */
function drainAndExit(signal: string) {
  if (draining) return;
  draining = true;
  const startedAt = Date.now();
  console.log(`[worker] ${signal}: finishing ${running + runningChecks} running job(s) before stopping`);
  const wait = setInterval(() => {
    const busy = running + runningChecks;
    if (busy === 0 || Date.now() - startedAt > DRAIN_MAX_MS) {
      clearInterval(wait);
      if (busy) console.warn(`[worker] stopping with ${busy} job(s) still running`);
      else console.log("[worker] all jobs finished, stopping");
      process.exit(0);
    }
  }, 1_000);
}

export function startWorker() {
  if (started) return;
  started = true;
  console.log("[worker] started");
  // react-router-serve closes the web server on these signals but leaves the process running; we exit
  // once our jobs are done.
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => drainAndExit(signal));
  setInterval(tick, 3_000);
  setInterval(() => scheduleDueWork().catch((err) => console.error("[worker] schedule failed:", err.message)), 60_000);
  setTimeout(() => scheduleDueWork().catch(() => {}), 10_000);
  setTimeout(() => maybeRunSelftest().catch((err) => console.error("[selftest] could not start:", err.message)), 5_000);
}
