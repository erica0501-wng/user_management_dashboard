-- AlterTable
ALTER TABLE "Backtest" ADD COLUMN     "marketId" TEXT,
ADD COLUMN     "marketQuestion" TEXT;

-- CreateIndex
CREATE INDEX "Backtest_marketId_idx" ON "Backtest"("marketId");
