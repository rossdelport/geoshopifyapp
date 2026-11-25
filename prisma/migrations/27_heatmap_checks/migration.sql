-- The free Google Maps check at rankwithross.com.au/visibility (Ross, 25 Nov 2026): one row per person and business
-- checked, with where the business ranked in each of the 49 spots. geo schema only (like every table here).

-- CreateTable
CREATE TABLE "HeatmapCheck" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'finding',
    "candidates" JSONB,
    "cid" TEXT,
    "placeId" TEXT,
    "business" TEXT,
    "address" TEXT,
    "category" TEXT,
    "rating" DOUBLE PRECISION,
    "reviews" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "points" JSONB,
    "done" INTEGER NOT NULL DEFAULT 0,
    "top3" INTEGER,
    "found" INTEGER,
    "avgRank" DOUBLE PRECISION,
    "rivals" JSONB,
    "error" TEXT,
    "consentText" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "fbclid" BOOLEAN NOT NULL DEFAULT false,
    "referrer" TEXT,
    "ipHash" TEXT,
    "emailedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeatmapCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HeatmapCheck_createdAt_idx" ON "HeatmapCheck"("createdAt");

-- CreateIndex
CREATE INDEX "HeatmapCheck_phone_createdAt_idx" ON "HeatmapCheck"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "HeatmapCheck_ipHash_createdAt_idx" ON "HeatmapCheck"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "HeatmapCheck_startedAt_idx" ON "HeatmapCheck"("startedAt");
