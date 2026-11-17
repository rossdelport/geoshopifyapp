-- Any business in the agency hub (Ross, 17 Nov 2026: "so i can add any business"): a client that isn't an online store
-- (a mortgage broker, a solar installer, a tradie) is a "local" shop with the town or city it works in.
-- geo schema only (like every table here).

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'store',
ADD COLUMN "area" TEXT;
