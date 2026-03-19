-- CreateTable
CREATE TABLE "MarketGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pattern" TEXT NOT NULL,
    "markets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backtest" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "strategyName" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "initialCapital" DOUBLE PRECISION NOT NULL,
    "finalValue" DOUBLE PRECISION NOT NULL,
    "pnl" DOUBLE PRECISION NOT NULL,
    "roi" DOUBLE PRECISION NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "totalTrades" INTEGER NOT NULL,
    "winningTrades" INTEGER NOT NULL,
    "losingTrades" INTEGER NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "params" JSONB NOT NULL,
    "tradeHistory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backtest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketGroup_name_key" ON "MarketGroup"("name");

-- CreateIndex
CREATE INDEX "Backtest_groupId_idx" ON "Backtest"("groupId");

-- CreateIndex
CREATE INDEX "Backtest_createdAt_idx" ON "Backtest"("createdAt");

-- AddForeignKey
ALTER TABLE "Backtest" ADD CONSTRAINT "Backtest_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MarketGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
