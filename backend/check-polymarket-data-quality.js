require("dotenv").config()

const prisma = require("./src/prisma")

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function toPercent(numerator, denominator) {
  if (!denominator || denominator <= 0) {
    return 0
  }
  return Number(((numerator / denominator) * 100).toFixed(2))
}

function countByKey(records, keyName) {
  const counts = new Map()

  for (const record of records) {
    const key = record[keyName]
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return counts
}

function latestTime(records) {
  if (!records.length) {
    return null
  }

  let latest = null
  for (const record of records) {
    const current = record.intervalStart
    if (!latest || current > latest) {
      latest = current
    }
  }

  return latest
}

async function main() {
  const windowHours = parsePositiveInt(
    process.argv[2] || process.env.POLYMARKET_QUALITY_WINDOW_HOURS,
    24
  )

  const intervalMs = parsePositiveInt(
    process.env.POLYMARKET_ARCHIVE_INTERVAL_MS,
    5 * 60 * 1000
  )

  const intervalMinutes = Math.max(1, Math.floor(intervalMs / 60000))
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000)
  const expectedIntervals = Math.floor((windowHours * 60) / intervalMinutes) + 1

  const [marketSnapshots, orderBookSnapshots] = await Promise.all([
    prisma.polymarketMarketSnapshot.findMany({
      where: {
        intervalStart: {
          gte: windowStart
        }
      },
      select: {
        marketId: true,
        intervalStart: true
      }
    }),
    prisma.polymarketOrderBookSnapshot.findMany({
      where: {
        intervalStart: {
          gte: windowStart
        }
      },
      select: {
        tokenId: true,
        intervalStart: true
      }
    })
  ])

  const marketCounts = countByKey(marketSnapshots, "marketId")
  const tokenCounts = countByKey(orderBookSnapshots, "tokenId")

  const distinctMarkets = marketCounts.size
  const distinctTokens = tokenCounts.size
  const totalMarketSnapshots = marketSnapshots.length
  const totalOrderBookSnapshots = orderBookSnapshots.length

  const marketExpectedTotal = distinctMarkets * expectedIntervals
  const orderBookExpectedTotal = distinctTokens * expectedIntervals

  const marketCoveragePct = toPercent(totalMarketSnapshots, marketExpectedTotal)
  const orderBookCoveragePct = toPercent(totalOrderBookSnapshots, orderBookExpectedTotal)

  const latestMarketSnapshot = latestTime(marketSnapshots)
  const latestOrderBookSnapshot = latestTime(orderBookSnapshots)
  const latestSnapshot =
    latestMarketSnapshot && latestOrderBookSnapshot
      ? latestMarketSnapshot > latestOrderBookSnapshot
        ? latestMarketSnapshot
        : latestOrderBookSnapshot
      : latestMarketSnapshot || latestOrderBookSnapshot

  const staleMinutes = latestSnapshot
    ? Math.max(0, Math.floor((now.getTime() - latestSnapshot.getTime()) / 60000))
    : null

  const notes =
    staleMinutes !== null && staleMinutes > intervalMinutes * 2
      ? "Latest snapshot appears stale relative to configured archive interval"
      : null

  await prisma.polymarketDataQualityReport.create({
    data: {
      windowHours,
      intervalMinutes,
      expectedIntervals,
      distinctMarkets,
      distinctTokens,
      totalMarketSnapshots,
      totalOrderBookSnapshots,
      marketCoveragePct,
      orderBookCoveragePct,
      staleMinutes,
      notes
    }
  })

  console.log("\nPolymarket Archive Data Quality Report")
  console.log("------------------------------------")
  console.log(`Window Hours: ${windowHours}`)
  console.log(`Interval Minutes: ${intervalMinutes}`)
  console.log(`Expected Intervals per key: ${expectedIntervals}`)
  console.log(`Distinct Markets: ${distinctMarkets}`)
  console.log(`Distinct Tokens: ${distinctTokens}`)
  console.log(`Market Snapshots: ${totalMarketSnapshots}`)
  console.log(`Order Book Snapshots: ${totalOrderBookSnapshots}`)
  console.log(`Market Coverage: ${marketCoveragePct}%`)
  console.log(`Order Book Coverage: ${orderBookCoveragePct}%`)
  console.log(`Stale Minutes: ${staleMinutes === null ? "N/A" : staleMinutes}`)

  if (notes) {
    console.log(`Notes: ${notes}`)
  }

  console.log("\n[ok] Data quality report saved to PolymarketDataQualityReport table")
}

main()
  .catch((error) => {
    console.error("[error] Failed to generate Polymarket data quality report:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
