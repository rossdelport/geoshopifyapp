-- Daily work for local businesses (Ross, 19 Nov 2026): the facts box on each business, the listing sites they're on,
-- fixes for their own website, and how guides go live on a website that isn't Shopify. geo schema only (like every
-- table here).

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN "facts" TEXT,
ADD COLUMN "siteCheckedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SiteFix" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "what" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "doneAt" TIMESTAMP(3),
    "doneBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteFix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "url" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteLink" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "login" TEXT,
    "folder" TEXT,
    "secret" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_shopId_domain_key" ON "Listing"("shopId", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "SiteLink_shopId_key" ON "SiteLink"("shopId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteFix_shopId_page_kind_key" ON "SiteFix"("shopId", "page", "kind");

-- CreateIndex
CREATE INDEX "SiteFix_shopId_status_idx" ON "SiteFix"("shopId", "status");

-- AddForeignKey
ALTER TABLE "SiteFix" ADD CONSTRAINT "SiteFix_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteLink" ADD CONSTRAINT "SiteLink_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
