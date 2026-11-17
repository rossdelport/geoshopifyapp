-- Each client's checklist in the agency hub (Ross, 17 Nov 2026): the lines Ross ticked (lib/client-plan.ts has the
-- lines; unticking deletes the row). geo schema only (like every table here).

-- CreateTable
CREATE TABLE "ChecklistTick" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "doneBy" TEXT,

    CONSTRAINT "ChecklistTick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTick_shopId_key_key" ON "ChecklistTick"("shopId", "key");

-- AddForeignKey
ALTER TABLE "ChecklistTick" ADD CONSTRAINT "ChecklistTick_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
