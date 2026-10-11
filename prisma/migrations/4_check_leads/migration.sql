-- Free product check: email capture. People who asked for the full report (and, only if they ticked
-- the box and confirmed it, occasional tips), each emailed copy of a report, and a hash-only list of
-- addresses that unsubscribed. geo schema only (like every table here).

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'free-check',
    "consentText" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentCheckId" TEXT,
    "tipsConsentText" TEXT,
    "tipsConsentAt" TIMESTAMP(3),
    "tipsCheckId" TEXT,
    "tipsConfirmedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribedAt" TIMESTAMP(3),
    "unsubscribeToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "emailHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("emailHash")
);

-- CreateTable
CREATE TABLE "ReportEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_unsubscribeToken_key" ON "Subscriber"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "ReportEmail_checkId_idx" ON "ReportEmail"("checkId");

-- CreateIndex
CREATE INDEX "ReportEmail_ipHash_createdAt_idx" ON "ReportEmail"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "ReportEmail_email_createdAt_idx" ON "ReportEmail"("email", "createdAt");

-- CreateIndex
CREATE INDEX "ReportEmail_createdAt_idx" ON "ReportEmail"("createdAt");
