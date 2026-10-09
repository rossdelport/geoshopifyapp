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
import { maybeRunSelftest } from "./selftest.server";

const MAX_RUNNING = 4;
let running = 0;
let started = false;

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
  if (running >= MAX_RUNNING) return;
  try {
    const jobs = await claimJobs(MAX_RUNNING - running);
    for (const job of jobs) {
      running++;
      runJob(job).finally(() => running--);
    }
  } catch (err) {
    console.error("[worker] tick failed:", (err as Error).message);
  }
}

const DAY = 86_400_000;

export async function scheduleDueWork(now = new Date()) {
  await requeueStuckJobs();
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
              where: { shopId: shop.id, kind: { in: ["weekly", "baseline", "manual"] }, status: "done" },
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

export function startWorker() {
  if (started) return;
  started = true;
  console.log("[worker] started");
  setInterval(tick, 3_000);
  setInterval(() => scheduleDueWork().catch((err) => console.error("[worker] schedule failed:", err.message)), 60_000);
  setTimeout(() => scheduleDueWork().catch(() => {}), 10_000);
  setTimeout(() => maybeRunSelftest().catch((err) => console.error("[selftest] could not start:", err.message)), 5_000);
}
