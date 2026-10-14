-- Reddit finder: threads where buyers ask about the store's kind of product, with a drafted reply the owner
-- copies and posts themselves. Found once a week. geo schema only.
CREATE TABLE "RedditThread" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "author" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "postedAt" TIMESTAMP(3),
    "query" TEXT,
    "draft" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RedditThread_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RedditThread_shopId_postId_key" ON "RedditThread"("shopId", "postId");
CREATE INDEX "RedditThread_shopId_createdAt_idx" ON "RedditThread"("shopId", "createdAt");
ALTER TABLE "RedditThread" ADD CONSTRAINT "RedditThread_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shop" ADD COLUMN "redditCheckedAt" TIMESTAMP(3);
