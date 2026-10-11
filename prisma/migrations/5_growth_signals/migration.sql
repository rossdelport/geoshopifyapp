-- AI crawler check, long-tail questions and topic clusters, guide refresh cycle, outreach target kinds.
ALTER TABLE "Shop" ADD COLUMN "crawlers" JSONB;
ALTER TABLE "Shop" ADD COLUMN "crawlersCheckedAt" TIMESTAMP(3);

ALTER TABLE "Question" ADD COLUMN "cluster" TEXT;
ALTER TABLE "Question" ADD COLUMN "longTail" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Fix" ADD COLUMN "cluster" TEXT;
ALTER TABLE "Fix" ADD COLUMN "hubFixId" TEXT;
ALTER TABLE "Fix" ADD COLUMN "refreshOfId" TEXT;
ALTER TABLE "Fix" ADD COLUMN "refreshedAt" TIMESTAMP(3);

ALTER TABLE "OutreachTarget" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'article';
ALTER TABLE "OutreachTarget" ADD COLUMN "mentionsMerchant" BOOLEAN;
ALTER TABLE "OutreachTarget" ADD COLUMN "pageCheckedAt" TIMESTAMP(3);
ALTER TABLE "OutreachTarget" ADD COLUMN "pageModifiedAt" TIMESTAMP(3);
