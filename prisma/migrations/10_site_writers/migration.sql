-- Sites AI trusts: writers looked up for the sites AI cites for a store. geo schema only.
CREATE TABLE "SiteWriter" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageTitle" TEXT,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "position" TEXT,
    "company" TEXT,
    "email" TEXT,
    "linkedin" TEXT,
    "twitter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteWriter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SiteWriter_shopId_domain_key" ON "SiteWriter"("shopId", "domain");
CREATE INDEX "SiteWriter_shopId_createdAt_idx" ON "SiteWriter"("shopId", "createdAt");
ALTER TABLE "SiteWriter" ADD CONSTRAINT "SiteWriter_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
