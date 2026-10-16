-- The schedule runs from the last scheduled scan, so a manual "check AI now" never postpones the weekly one.
ALTER TABLE "Shop" ADD COLUMN "lastScheduledScanAt" TIMESTAMP(3);
UPDATE "Shop" SET "lastScheduledScanAt" = "lastScanAt";

-- Every order a store's tracking code reports, once: a reloaded thank-you page or a replayed request can't count twice.
CREATE TABLE "PixelOrder" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderGid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PixelOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PixelOrder_shopId_orderGid_key" ON "PixelOrder"("shopId", "orderGid");
ALTER TABLE "PixelOrder" ADD CONSTRAINT "PixelOrder_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
