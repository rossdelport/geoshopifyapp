-- Visits to firstpicked.com.au/book and calls booked there, with the ad's tags (admin Overview chart).
-- See app/lib/book-stats.server.ts. geo schema only (like every table here).

-- CreateTable
CREATE TABLE "BookEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "visitor" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "fbclid" BOOLEAN NOT NULL DEFAULT false,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookEvent_createdAt_idx" ON "BookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "BookEvent_visitor_createdAt_idx" ON "BookEvent"("visitor", "createdAt");
