-- SEO traffic beside AI: visits and orders from search engines, per store per day.
ALTER TABLE "TrafficDay" ADD COLUMN "searchSessions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderDay" ADD COLUMN "searchOrders" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderDay" ADD COLUMN "searchRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- GEO's own blog (usegeo.app/blog), written and published by a background job three times a week.
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "topicKey" TEXT,
    "body" JSONB NOT NULL,
    "words" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'published',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE UNIQUE INDEX "BlogPost_topicKey_key" ON "BlogPost"("topicKey");
CREATE INDEX "BlogPost_status_publishedAt_idx" ON "BlogPost"("status", "publishedAt");
