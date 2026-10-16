-- The guide calendar (web app stores): one row per planned guide page day, with the buying question it answers,
-- the guide written for it two days before (a Fix of type guide_page) and whether it is live.
-- See app/lib/guide-calendar.server.ts.
-- A web account's Shopify connection, set only by a connect flow it starts itself (an app install by the store's owner
-- is not this account's connection).
ALTER TABLE "Shop" ADD COLUMN "shopifyConnectedAt" TIMESTAMP(3);
CREATE TABLE "GuideSlot" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "questionId" TEXT,
    "cluster" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "fixId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideSlot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuideSlot_fixId_key" ON "GuideSlot"("fixId");
CREATE UNIQUE INDEX "GuideSlot_shopId_day_key" ON "GuideSlot"("shopId", "day");
CREATE INDEX "GuideSlot_shopId_status_idx" ON "GuideSlot"("shopId", "status");
ALTER TABLE "GuideSlot" ADD CONSTRAINT "GuideSlot_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuideSlot" ADD CONSTRAINT "GuideSlot_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GuideSlot" ADD CONSTRAINT "GuideSlot_fixId_fkey" FOREIGN KEY ("fixId") REFERENCES "Fix"("id") ON DELETE SET NULL ON UPDATE CASCADE;
