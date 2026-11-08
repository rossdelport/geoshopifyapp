-- Giveaway round 2 (Ross, 8 Nov 2026): the entry form asks what the store sells a month, and phone is optional.
-- geo schema only (like every table here).

-- AlterTable
ALTER TABLE "GiveawayEntry" ALTER COLUMN "phone" DROP NOT NULL,
ADD COLUMN "sales" TEXT;
