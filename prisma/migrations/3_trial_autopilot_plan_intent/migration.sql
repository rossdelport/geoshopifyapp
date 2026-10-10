-- One free trial per store, and keep a store's "autopilot off" choice across plan changes.
ALTER TABLE "Shop" ADD COLUMN "autopilotOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shop" ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- A plan picked on the website before installing.
CREATE TABLE "PlanIntent" (
    "domain" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanIntent_pkey" PRIMARY KEY ("domain")
);
