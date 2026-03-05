-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('Open', 'Closed', 'Resolved');

-- CreateTable
CREATE TABLE "PolymarketPosition" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "marketId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "shares" DOUBLE PRECISION NOT NULL,
    "avgPrice" DOUBLE PRECISION NOT NULL,
    "totalCost" DOUBLE PRECISION NOT NULL,
    "currentPrice" DOUBLE PRECISION,
    "status" "PositionStatus" NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolymarketPosition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PolymarketPosition" ADD CONSTRAINT "PolymarketPosition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
