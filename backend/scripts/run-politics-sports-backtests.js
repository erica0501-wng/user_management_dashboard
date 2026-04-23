/**
 * Run all strategies on Politics + Sports groups using newly backfilled history.
 */
require('dotenv').config()
const prisma = require('../src/prisma')
const engine = require('../src/services/backtestEngine')

const GROUPS = ['Politics', 'Sports']
const STRATEGIES = ['momentum', 'meanReversion', 'volatility']
const startTime = new Date('2023-01-01T00:00:00Z')
const endTime = new Date()

;(async () => {
  const results = []
  for (const groupName of GROUPS) {
    for (const strat of STRATEGIES) {
      console.log(`\n--- ${groupName} / ${strat} ---`)
      try {
        const r = await engine.runBacktest(groupName, strat, {}, { startTime, endTime })
        results.push({ group: groupName, strat, roi: r.roi, trades: r.totalTrades, winRate: r.winRate, id: r.backtestId })
      } catch (e) {
        results.push({ group: groupName, strat, error: e.message })
      }
    }
  }
  console.log('\n\n=== SUMMARY ===')
  console.table(results.map(r => ({
    group: r.group,
    strategy: r.strat,
    ROI: r.roi != null ? r.roi.toFixed(2) + '%' : '-',
    trades: r.trades ?? '-',
    winRate: r.winRate != null ? r.winRate.toFixed(1) + '%' : '-',
    id: r.id ?? (r.error || '').slice(0, 50)
  })))
  await prisma.$disconnect()
})()
