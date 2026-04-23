/**
 * Run momentum backtest for the 4 boss-priority groups + Crypto.
 * Uses available history window (engine auto-selects from snapshots).
 */
require('dotenv').config()
const prisma = require('../src/prisma')
const engine = require('../src/services/backtestEngine')

const TARGETS = ['NBA', 'Elon Tweets', 'Movies', 'Economic Policy']

;(async () => {
  for (const groupName of TARGETS) {
    const group = await prisma.marketGroup.findUnique({ where: { name: groupName }, select: { id: true, name: true, markets: true } })
    if (!group) {
      console.log(`[skip] group "${groupName}" not in DB`)
      continue
    }
    const marketCount = Array.isArray(group.markets) ? group.markets.length : 0
    console.log(`\n=== Running backtest for "${groupName}" (${marketCount} markets) ===`)
    try {
      const result = await engine.runBacktest(groupName, 'momentum', {}, {})
      console.log(`[ok] ${groupName}: ROI ${result.roi?.toFixed(2)}%, trades=${result.totalTrades}, backtestId=${result.backtestId}`)
    } catch (e) {
      console.log(`[fail] ${groupName}: ${e.message}`)
    }
  }
  await prisma.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
