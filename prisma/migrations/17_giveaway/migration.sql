-- The 3-month giveaway at usegeo.app/giveaway: one entry per store. geo schema only (like every table here).

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "id" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "fbclid" TEXT,
    "referrer" TEXT,
    "consentText" TEXT NOT NULL,
    "ipHash" TEXT,
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiveawayEntry_store_key" ON "GiveawayEntry"("store");

-- CreateIndex
CREATE INDEX "GiveawayEntry_ipHash_createdAt_idx" ON "GiveawayEntry"("ipHash", "createdAt");
