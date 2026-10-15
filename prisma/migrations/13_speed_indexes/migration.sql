-- Faster dashboard pages: find a person's store, and a store's latest setup job, without reading whole tables.
CREATE INDEX IF NOT EXISTS "Shop_userId_createdAt_idx" ON "Shop"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Job_shopId_type_createdAt_idx" ON "Job"("shopId", "type", "createdAt");
