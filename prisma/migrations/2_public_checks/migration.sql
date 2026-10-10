-- CreateTable
CREATE TABLE "PublicCheck" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'AU',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "product" JSONB,
    "questions" JSONB NOT NULL DEFAULT '[]',
    "answers" JSONB NOT NULL DEFAULT '[]',
    "report" JSONB,
    "total" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "PublicCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicCheck_url_country_createdAt_idx" ON "PublicCheck"("url", "country", "createdAt");

-- CreateIndex
CREATE INDEX "PublicCheck_ipHash_createdAt_idx" ON "PublicCheck"("ipHash", "createdAt");

-- CreateIndex
CREATE INDEX "PublicCheck_createdAt_idx" ON "PublicCheck"("createdAt");

