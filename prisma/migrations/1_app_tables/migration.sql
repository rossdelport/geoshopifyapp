-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "primaryDomain" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "country" TEXT NOT NULL DEFAULT 'AU',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'installed',
    "onboarding" TEXT NOT NULL DEFAULT 'new',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "baselineDate" TIMESTAMP(3),
    "freeScanUsedAt" TIMESTAMP(3),
    "lastScanAt" TIMESTAMP(3),
    "lastReportAt" TIMESTAMP(3),
    "autopilot" BOOLEAN NOT NULL DEFAULT false,
    "reportEmails" TEXT,
    "pixelId" TEXT,
    "costMonth" TEXT,
    "costThisMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costAlertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "aliases" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "pricePoint" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'AU',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "gid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "productType" TEXT,
    "vendor" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "description" TEXT,
    "seoTitle" TEXT,
    "seoDesc" TEXT,
    "price" TEXT,
    "imageUrl" TEXT,
    "status" TEXT,
    "optimisedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "keyword" TEXT,
    "volume" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "auto" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "engines" JSONB NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 2,
    "total" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAnswer" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "runNo" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "text" TEXT,
    "mentioned" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "product" TEXT,
    "position" INTEGER NOT NULL,
    "isMerchant" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "type" TEXT NOT NULL,
    "isOwn" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisibilitySnapshot" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "score" DOUBLE PRECISION NOT NULL,
    "byEngine" JSONB NOT NULL,
    "mentionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "VisibilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fix" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetGid" TEXT,
    "targetTitle" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT 'medium',
    "questionIds" JSONB NOT NULL DEFAULT '[]',
    "missingInfo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "resultGid" TEXT,
    "resultUrl" TEXT,
    "appliedAt" TIMESTAMP(3),
    "revertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachTarget" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "title" TEXT,
    "namedBrands" JSONB NOT NULL DEFAULT '[]',
    "timesCited" INTEGER NOT NULL DEFAULT 1,
    "engines" JSONB NOT NULL DEFAULT '[]',
    "authorName" TEXT,
    "email" TEXT,
    "contactUrl" TEXT,
    "subject" TEXT,
    "pitch" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutreachTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSession" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "referrer" TEXT,
    "landingUrl" TEXT,
    "utmSource" TEXT,
    "clientKey" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrafficDay" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "aiSessions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrafficDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiOrder" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderGid" TEXT NOT NULL,
    "orderName" TEXT,
    "engine" TEXT NOT NULL,
    "ours" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "products" JSONB NOT NULL DEFAULT '[]',
    "orderedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDay" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "OrderDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "error" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCost" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "usd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_domain_key" ON "Shop"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_shopId_key" ON "BrandProfile"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_gid_key" ON "Product"("shopId", "gid");

-- CreateIndex
CREATE UNIQUE INDEX "Question_shopId_text_key" ON "Question"("shopId", "text");

-- CreateIndex
CREATE UNIQUE INDEX "Competitor_shopId_name_key" ON "Competitor"("shopId", "name");

-- CreateIndex
CREATE INDEX "Scan_shopId_startedAt_idx" ON "Scan"("shopId", "startedAt");

-- CreateIndex
CREATE INDEX "AiAnswer_scanId_status_idx" ON "AiAnswer"("scanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AiAnswer_scanId_questionId_engine_runNo_key" ON "AiAnswer"("scanId", "questionId", "engine", "runNo");

-- CreateIndex
CREATE INDEX "Mention_answerId_idx" ON "Mention"("answerId");

-- CreateIndex
CREATE INDEX "Citation_answerId_idx" ON "Citation"("answerId");

-- CreateIndex
CREATE UNIQUE INDEX "VisibilitySnapshot_scanId_key" ON "VisibilitySnapshot"("scanId");

-- CreateIndex
CREATE INDEX "VisibilitySnapshot_shopId_date_idx" ON "VisibilitySnapshot"("shopId", "date");

-- CreateIndex
CREATE INDEX "Fix_shopId_status_idx" ON "Fix"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OutreachTarget_shopId_url_key" ON "OutreachTarget"("shopId", "url");

-- CreateIndex
CREATE INDEX "AiSession_shopId_occurredAt_idx" ON "AiSession"("shopId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiSession_shopId_clientKey_landingUrl_key" ON "AiSession"("shopId", "clientKey", "landingUrl");

-- CreateIndex
CREATE UNIQUE INDEX "TrafficDay_shopId_date_key" ON "TrafficDay"("shopId", "date");

-- CreateIndex
CREATE INDEX "AiOrder_shopId_orderedAt_idx" ON "AiOrder"("shopId", "orderedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiOrder_shopId_orderGid_key" ON "AiOrder"("shopId", "orderGid");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDay_shopId_date_key" ON "OrderDay"("shopId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Job_dedupeKey_key" ON "Job"("dedupeKey");

-- CreateIndex
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");

-- CreateIndex
CREATE INDEX "ApiCost_shopId_createdAt_idx" ON "ApiCost"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnswer" ADD CONSTRAINT "AiAnswer_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAnswer" ADD CONSTRAINT "AiAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "AiAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "AiAnswer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilitySnapshot" ADD CONSTRAINT "VisibilitySnapshot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisibilitySnapshot" ADD CONSTRAINT "VisibilitySnapshot_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fix" ADD CONSTRAINT "Fix_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachTarget" ADD CONSTRAINT "OutreachTarget_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSession" ADD CONSTRAINT "AiSession_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrafficDay" ADD CONSTRAINT "TrafficDay_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiOrder" ADD CONSTRAINT "AiOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDay" ADD CONSTRAINT "OrderDay_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCost" ADD CONSTRAINT "ApiCost_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

