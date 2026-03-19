-- AddForeignKey
ALTER TABLE "PolymarketOrderBookSnapshot" ADD CONSTRAINT "PolymarketOrderBookSnapshot_marketId_intervalStart_fkey" FOREIGN KEY ("marketId", "intervalStart") REFERENCES "PolymarketMarketSnapshot"("marketId", "intervalStart") ON DELETE NO ACTION ON UPDATE NO ACTION;
