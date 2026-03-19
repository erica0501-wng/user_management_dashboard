-- CreateTable
CREATE TABLE "PolymarketMarketSnapshot" (
    "id" SERIAL NOT NULL,
    "marketId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "outcomes" JSONB,
    "outcomePrices" JSONB,
    "tokenIds" JSONB,
    "volume" DOUBLE PRECISION,
    "liquidity" DOUBLE PRECISION,
    "endDate" TIMESTAMP(3),
    "intervalStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketMarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolymarketOrderBookSnapshot" (
    "id" SERIAL NOT NULL,
    "marketId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "outcome" TEXT,
    "bidVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "askVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestBid" DOUBLE PRECISION,
    "bestAsk" DOUBLE PRECISION,
    "spread" DOUBLE PRECISION,
    "spreadPercent" DOUBLE PRECISION,
    "bidDepth" INTEGER NOT NULL DEFAULT 0,
    "askDepth" INTEGER NOT NULL DEFAULT 0,
    "bids" JSONB,
    "asks" JSONB,
    "intervalStart" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketOrderBookSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolymarketDataQualityReport" (
    "id" SERIAL NOT NULL,
    "windowHours" INTEGER NOT NULL,
    "intervalMinutes" INTEGER NOT NULL,
    "expectedIntervals" INTEGER NOT NULL,
    "distinctMarkets" INTEGER NOT NULL DEFAULT 0,
    "distinctTokens" INTEGER NOT NULL DEFAULT 0,
    "totalMarketSnapshots" INTEGER NOT NULL DEFAULT 0,
    "totalOrderBookSnapshots" INTEGER NOT NULL DEFAULT 0,
    "marketCoveragePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "orderBookCoveragePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "staleMinutes" INTEGER,
    "notes" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolymarketDataQualityReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PolymarketMarketSnapshot_intervalStart_idx" ON "PolymarketMarketSnapshot"("intervalStart");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketMarketSnapshot_marketId_intervalStart_key" ON "PolymarketMarketSnapshot"("marketId", "intervalStart");

-- CreateIndex
CREATE INDEX "PolymarketOrderBookSnapshot_marketId_intervalStart_idx" ON "PolymarketOrderBookSnapshot"("marketId", "intervalStart");

-- CreateIndex
CREATE INDEX "PolymarketOrderBookSnapshot_intervalStart_idx" ON "PolymarketOrderBookSnapshot"("intervalStart");

-- CreateIndex
CREATE UNIQUE INDEX "PolymarketOrderBookSnapshot_tokenId_intervalStart_key" ON "PolymarketOrderBookSnapshot"("tokenId", "intervalStart");

-- CreateIndex
CREATE INDEX "PolymarketDataQualityReport_generatedAt_idx" ON "PolymarketDataQualityReport"("generatedAt");
