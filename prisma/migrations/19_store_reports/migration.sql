-- Store reports for Ross's teardown videos (Admin > Reports, usegeo.app/report/<slug>). See app/lib/store-report.server.ts.
-- geo schema only (like every table here).

-- CreateTable
CREATE TABLE "StoreReport" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "slug" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "total" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB,
    "error" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "StoreReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreReport_slug_key" ON "StoreReport"("slug");

-- CreateIndex
CREATE INDEX "StoreReport_createdAt_idx" ON "StoreReport"("createdAt");
