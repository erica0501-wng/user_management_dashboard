-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('PriceTarget', 'MovingAverage', 'PriceChange');

-- CreateEnum
CREATE TYPE "TriggerCondition" AS ENUM ('Above', 'Below', 'CrossAbove', 'CrossBelow', 'Increase', 'Decrease');

-- CreateEnum
CREATE TYPE "TradeAction" AS ENUM ('Buy', 'Sell');

-- CreateTable
CREATE TABLE "AutoTrader" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "marketId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "outcome" TEXT,
    "strategyType" "StrategyType" NOT NULL,
    "triggerCondition" "TriggerCondition" NOT NULL,
    "targetPrice" DOUBLE PRECISION,
    "movingAvgPeriod" INTEGER,
    "action" "TradeAction" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "maxExecutions" INTEGER NOT NULL DEFAULT 1,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnExecution" BOOLEAN NOT NULL DEFAULT true,
    "notificationChannels" TEXT[] DEFAULT ARRAY['email']::TEXT[],
    "lastCheckedAt" TIMESTAMP(3),
    "lastExecutedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoTrader_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AutoTrader" ADD CONSTRAINT "AutoTrader_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
