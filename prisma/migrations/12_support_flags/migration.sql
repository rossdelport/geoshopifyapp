-- Ask GEO: questions the help chat passed to the GEO team (a short summary, not the chat). geo schema only.
CREATE TABLE "SupportFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "shopId" TEXT,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportFlag_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportFlag_status_createdAt_idx" ON "SupportFlag"("status", "createdAt");
ALTER TABLE "SupportFlag" ADD CONSTRAINT "SupportFlag_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
