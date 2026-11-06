-- The two questions on firstpicked.com.au/book (Ross, 6 Nov 2026): everyone's answers, counted like visits (no name
-- or email), and each call booked with the person's answers (Admin > Calls). geo schema only (like every table here).

-- AlterTable
ALTER TABLE "BookEvent" ADD COLUMN "shopify" TEXT,
ADD COLUMN "sales" TEXT;

-- CreateTable
CREATE TABLE "CallBooking" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "sales" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallBooking_createdAt_idx" ON "CallBooking"("createdAt");
