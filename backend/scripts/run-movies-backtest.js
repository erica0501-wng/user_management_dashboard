/**
 * Quick: run Movies backtest only (since Movies backfill completed first).
 */
require('dotenv').config()
const prisma = require('../src/prisma')
const engine = require('../src/services/backtestEngine')

;(async () => {
  try {
    const result = await engine.runBacktest('Movies', 'momentum', { buyThreshold: 0.005, sellThreshold: 0.005, positionSize: 1000 }, {})
    console.log(`[ok] Movies: ROI ${result.roi?.toFixed(2)}%, trades=${result.totalTrades}, backtestId=${result.backtestId}`)
  } catch (e) {
    console.log(`[fail] Movies: ${e.message}`)
  }
  await prisma.$disconnect()
})()
