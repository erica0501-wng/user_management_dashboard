// Quick check script: shows snapshot growth so you can prove archiving is working.
// Run from backend/: node check-archive-growth.js
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

function fmtTime(d) {
  if (!d) return '—'
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
}

async function main() {
  console.log('📦 Polymarket Archive Growth Check')
  console.log('='.repeat(60))

  const now = new Date()
  const h1   = new Date(now.getTime() - 1   * 60 * 60 * 1000)
  const h24  = new Date(now.getTime() - 24  * 60 * 60 * 1000)
  const d7   = new Date(now.getTime() - 7   * 24 * 60 * 60 * 1000)
  const d30  = new Date(now.getTime() - 30  * 24 * 60 * 60 * 1000)

  // Market snapshots
  const [msTotal, ms1h, ms24h, ms7d, ms30d, msFirst, msLast] = await Promise.all([
    prisma.polymarketMarketSnapshot.count(),
    prisma.polymarketMarketSnapshot.count({ where: { createdAt: { gte: h1 } } }),
    prisma.polymarketMarketSnapshot.count({ where: { createdAt: { gte: h24 } } }),
    prisma.polymarketMarketSnapshot.count({ where: { createdAt: { gte: d7 } } }),
    prisma.polymarketMarketSnapshot.count({ where: { createdAt: { gte: d30 } } }),
    prisma.polymarketMarketSnapshot.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.polymarketMarketSnapshot.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ])

  // Order book snapshots
  const [obTotal, ob1h, ob24h, ob7d, obLast] = await Promise.all([
    prisma.polymarketOrderBookSnapshot.count(),
    prisma.polymarketOrderBookSnapshot.count({ where: { createdAt: { gte: h1 } } }),
    prisma.polymarketOrderBookSnapshot.count({ where: { createdAt: { gte: h24 } } }),
    prisma.polymarketOrderBookSnapshot.count({ where: { createdAt: { gte: d7 } } }),
    prisma.polymarketOrderBookSnapshot.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ])

  // Distinct markets covered
  const distinctMarkets = await prisma.polymarketMarketSnapshot.groupBy({
    by: ['marketId'],
    _count: { _all: true },
  })

  console.log()
  console.log('📈 Market Snapshots')
  console.log('-'.repeat(60))
  console.log(`  Total:                ${msTotal.toLocaleString()}`)
  console.log(`  Last 1 hour:          ${ms1h.toLocaleString()}`)
  console.log(`  Last 24 hours:        ${ms24h.toLocaleString()}`)
  console.log(`  Last 7 days:          ${ms7d.toLocaleString()}`)
  console.log(`  Last 30 days:         ${ms30d.toLocaleString()}`)
  console.log(`  First captured:       ${fmtTime(msFirst?.createdAt)}`)
  console.log(`  Latest captured:      ${fmtTime(msLast?.createdAt)}`)
  console.log(`  Distinct markets:     ${distinctMarkets.length.toLocaleString()}`)

  console.log()
  console.log('📚 Order Book Snapshots')
  console.log('-'.repeat(60))
  console.log(`  Total:                ${obTotal.toLocaleString()}`)
  console.log(`  Last 1 hour:          ${ob1h.toLocaleString()}`)
  console.log(`  Last 24 hours:        ${ob24h.toLocaleString()}`)
  console.log(`  Last 7 days:          ${ob7d.toLocaleString()}`)
  console.log(`  Latest captured:      ${fmtTime(obLast?.createdAt)}`)

  // Health check
  console.log()
  console.log('🩺 Health Check')
  console.log('-'.repeat(60))
  const minutesSinceLast = msLast ? Math.round((now - msLast.createdAt) / 60000) : null
  if (minutesSinceLast === null) {
    console.log(`  ❌ No snapshots found at all.`)
  } else if (minutesSinceLast < 180) {
    console.log(`  ✅ Latest snapshot is ${minutesSinceLast} minutes old. Archiving is healthy.`)
  } else if (minutesSinceLast < 720) {
    console.log(`  ⚠️  Latest snapshot is ${minutesSinceLast} minutes old. Should be < 3 hours.`)
  } else {
    console.log(`  ❌ Latest snapshot is ${minutesSinceLast} minutes old. Archive may be stuck.`)
  }

  if (ms24h > 0) {
    const dailyRate = ms24h
    console.log(`  📊 Last 24h ingest rate: ${dailyRate.toLocaleString()} market snapshots/day`)
    console.log(`  📊 Projected 7-day growth: +${(dailyRate * 7).toLocaleString()} snapshots`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})

