/**
 * Daily digest cron — call once per day to summarize last 24h.
 * Standalone CLI: node scripts/daily-discord-digest.js
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const prisma = require('../src/prisma')
const discord = require('../src/services/discordNotifier')

const NEUTRAL_LOG_PATH = path.join(__dirname, '../neutral_sell_log.jsonl')

function readNeutralStats(sinceMs) {
  if (!fs.existsSync(NEUTRAL_LOG_PATH)) return null
  const entries = fs.readFileSync(NEUTRAL_LOG_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => { try { return JSON.parse(line) } catch { return null } })
    .filter((e) => e && (!sinceMs || (e.time && new Date(e.time).getTime() >= sinceMs)))

  const byCategory = {}
  const byStrategy = {}
  const byReason = {}
  const backtestIds = new Set()
  for (const e of entries) {
    const cat = e.category || e.type || 'UNKNOWN'
    byCategory[cat] = (byCategory[cat] || 0) + 1
    const strat = e.strategy || 'unknown'
    byStrategy[strat] = (byStrategy[strat] || 0) + 1
    const reason = e.reason || 'unspecified'
    byReason[reason] = (byReason[reason] || 0) + 1
    if (e.backtestId != null) backtestIds.add(e.backtestId)
  }
  return {
    total: entries.length,
    uniqueBacktests: backtestIds.size,
    byCategory,
    byStrategy,
    byReason,
  }
}

async function main() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const archivedMarketsToday = await prisma.polymarketMarketSnapshot.count({
    where: { createdAt: { gte: since } }
  })
  const archivedClosedMarketsToday = await prisma.polymarketMarketSnapshot.count({
    where: { createdAt: { gte: since }, closed: true }
  })
  const backtestsToday = await prisma.backtest.count({
    where: { createdAt: { gte: since } }
  })

  const groups = await prisma.marketGroup.findMany({
    select: { name: true, markets: true }
  })
  const topGroups = groups
    .map(g => ({ name: g.name, count: Array.isArray(g.markets) ? g.markets.length : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const neutralStats = readNeutralStats(since.getTime())

  console.log('[digest]', { archivedMarketsToday, archivedClosedMarketsToday, backtestsToday, neutralStats })
  const result = await discord.notifyDailyDigest({
    archivedMarketsToday,
    archivedClosedMarketsToday,
    backtestsToday,
    topGroups,
    neutralStats,
  })
  console.log('[digest] discord:', result)
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })
