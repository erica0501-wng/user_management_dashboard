/**
 * Daily digest cron — call once per day to summarize last 24h.
 * Standalone CLI: node scripts/daily-discord-digest.js
 */
require('dotenv').config()
const prisma = require('../src/prisma')
const discord = require('../src/services/discordNotifier')

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

  console.log('[digest]', { archivedMarketsToday, archivedClosedMarketsToday, backtestsToday })
  const result = await discord.notifyDailyDigest({
    archivedMarketsToday,
    archivedClosedMarketsToday,
    backtestsToday,
    topGroups,
  })
  console.log('[digest] discord:', result)
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1) })
