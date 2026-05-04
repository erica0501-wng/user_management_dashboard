/**
 * Diagnose archive coverage for the 4 boss-priority groups.
 * Reports: market count, snapshot count per group, distinct intervals,
 * latest snapshot timestamp.
 */
require('dotenv').config()
const prisma = require('../src/prisma')

const TARGETS = ['Elon Tweets', 'Economic Policy', 'NBA', 'Movies']

;(async () => {
  for (const name of TARGETS) {
    const group = await prisma.marketGroup.findUnique({
      where: { name },
      select: { id: true, name: true, markets: true, updatedAt: true },
    })
    if (!group) { console.log(`\n[${name}] NOT FOUND in MarketGroup table`); continue }

    const marketIds = Array.isArray(group.markets) ? group.markets : []
    console.log(`\n=== ${name} ===`)
    console.log(`  group.markets count: ${marketIds.length}`)
    console.log(`  group.updatedAt   : ${group.updatedAt?.toISOString()}`)

    if (marketIds.length === 0) continue

    // Sample first 3 markets
    console.log(`  sample marketIds  : ${marketIds.slice(0, 3).join(', ')}`)

    const snapCount = await prisma.polymarketMarketSnapshot.count({
      where: { marketId: { in: marketIds } },
    })
    const distinctIntervals = await prisma.polymarketMarketSnapshot.findMany({
      where: { marketId: { in: marketIds } },
      select: { intervalStart: true },
      distinct: ['intervalStart'],
    })
    const marketsWithHistory = await prisma.polymarketMarketSnapshot.findMany({
      where: { marketId: { in: marketIds } },
      select: { marketId: true },
      distinct: ['marketId'],
    })
    const latest = await prisma.polymarketMarketSnapshot.findFirst({
      where: { marketId: { in: marketIds } },
      orderBy: { intervalStart: 'desc' },
      select: { intervalStart: true, marketId: true },
    })

    console.log(`  total snapshots   : ${snapCount}`)
    console.log(`  distinctIntervals : ${distinctIntervals.length}`)
    console.log(`  marketsWithHistory: ${marketsWithHistory.length} / ${marketIds.length}`)
    console.log(`  latest snapshot   : ${latest?.intervalStart?.toISOString() || 'none'} (market ${latest?.marketId || '-'})`)
  }

  await prisma.$disconnect()
})()
