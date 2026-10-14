-- GEO web app: accounts that sign in by email link, and stores added on the web. geo schema only.
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "LoginLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "next" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LoginLink_tokenHash_key" ON "LoginLink"("tokenHash");
CREATE INDEX "LoginLink_email_createdAt_idx" ON "LoginLink"("email", "createdAt");

ALTER TABLE "Shop" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'shopify';
ALTER TABLE "Shop" ADD COLUMN "userId" TEXT;
ALTER TABLE "Shop" ADD COLUMN "trackKey" TEXT;
CREATE UNIQUE INDEX "Shop_trackKey_key" ON "Shop"("trackKey");
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
