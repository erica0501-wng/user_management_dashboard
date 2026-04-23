/**
 * Run backtest for a single group with custom date window.
 * Usage: node scripts/run-backtest-window.js <groupName> [strategy] [startISO] [endISO]
 * Default window: 2023-01-01 to today (covers all backfilled history)
 */
require('dotenv').config()
const prisma = require('../src/prisma')
const engine = require('../src/services/backtestEngine')

const args = process.argv.slice(2)
const groupName = args[0] || 'Movies'
const strategy = args[1] || 'momentum'
const startTime = new Date(args[2] || '2023-01-01T00:00:00Z')
const endTime = new Date(args[3] || new Date().toISOString())

;(async () => {
  console.log(`Running ${strategy} backtest for "${groupName}" from ${startTime.toISOString()} to ${endTime.toISOString()}`)
  try {
    const result = await engine.runBacktest(groupName, strategy, {}, { startTime, endTime })
    console.log(`[ok] ${groupName}/${strategy}: ROI ${result.roi?.toFixed(2)}%, trades=${result.totalTrades} (${result.winningTrades}W/${result.losingTrades}L), winRate=${result.winRate?.toFixed(1)}%, backtestId=${result.backtestId}`)
  } catch (e) {
    console.log(`[fail] ${groupName}/${strategy}: ${e.message}`)
  }
  await prisma.$disconnect()
})()
