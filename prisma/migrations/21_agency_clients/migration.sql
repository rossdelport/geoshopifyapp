-- Ross's done-for-you clients and the agency hub at firstpicked.com.au/dash (5 Nov 2026): the agency's facts about each
-- client store (Client), the work log's own entries (WorkNote) and the reports made for clients (ClientReport).
-- See app/lib/clients.server.ts, app/lib/work-log.server.ts and app/lib/client-report.server.ts. geo schema only (like every table here).

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "feeAud" INTEGER NOT NULL,
    "startedOn" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkNote" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'note',
    "text" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientReport" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromDay" TEXT NOT NULL,
    "toDay" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_shopId_key" ON "Client"("shopId");

-- CreateIndex
CREATE INDEX "WorkNote_shopId_doneAt_idx" ON "WorkNote"("shopId", "doneAt");

-- CreateIndex
CREATE INDEX "WorkNote_doneAt_idx" ON "WorkNote"("doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientReport_token_key" ON "ClientReport"("token");

-- CreateIndex
CREATE INDEX "ClientReport_shopId_createdAt_idx" ON "ClientReport"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkNote" ADD CONSTRAINT "WorkNote_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientReport" ADD CONSTRAINT "ClientReport_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

