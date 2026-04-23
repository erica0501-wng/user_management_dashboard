-- AlterTable
ALTER TABLE "PolymarketMarketSnapshot"
ADD COLUMN "category" TEXT,
ADD COLUMN "closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "closedTime" TIMESTAMP(3),
ADD COLUMN "eventStartAt" TIMESTAMP(3),
ADD COLUMN "eventEndAt" TIMESTAMP(3),
ADD COLUMN "sourceCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PolymarketMarketSnapshot_eventStartAt_idx" ON "PolymarketMarketSnapshot"("eventStartAt");

-- CreateIndex
CREATE INDEX "PolymarketMarketSnapshot_eventEndAt_idx" ON "PolymarketMarketSnapshot"("eventEndAt");

-- CreateIndex
CREATE INDEX "PolymarketMarketSnapshot_closedTime_idx" ON "PolymarketMarketSnapshot"("closedTime");
