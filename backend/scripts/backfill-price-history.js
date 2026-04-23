/**
 * Pull historical price time-series from Polymarket CLOB /prices-history
 * for each market in given groups, and write per-interval snapshots.
 *
 * This produces multi-interval snapshots so backtests can compute momentum.
 *
 * Usage: node scripts/backfill-price-history.js [--group=Movies] [--maxMarkets=50]
 */
require('dotenv').config()
const prisma = require('../src/prisma')

const args = process.argv.slice(2)
function arg(name, defaultVal) {
  const m = args.find(a => a.startsWith(`--${name}=`))
  return m ? m.split('=').slice(1).join('=') : defaultVal
}

const TARGET_GROUPS = arg('group', 'Movies,Economic Policy,NBA,Elon Tweets').split(',').map(s => s.trim())
const MAX_MARKETS_PER_GROUP = parseInt(arg('maxMarkets', '50'), 10)
const FIDELITY_SECONDS = parseInt(arg('fidelity', '3600'), 10) // hourly buckets
const INTERVAL = arg('interval', 'max') // max | 1m | 1w | 1d | 6h | 1h
const SNAPSHOT_BUCKET_MS = 5 * 60 * 1000 // 5-min, matches live archiver

function bucketize(ts) {
  return new Date(Math.floor(ts / SNAPSHOT_BUCKET_MS) * SNAPSHOT_BUCKET_MS)
}

async function fetchPriceHistory(tokenId) {
  const url = `https://clob.polymarket.com/prices-history?market=${tokenId}&interval=${INTERVAL}&fidelity=${FIDELITY_SECONDS}`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data?.history) ? data.history : []
}

async function backfillMarket(marketRow) {
  const tokenIds = marketRow.tokenIds || []
  if (tokenIds.length === 0) return { snapshots: 0, intervals: 0 }

  // Fetch history for both YES and NO tokens (if available)
  const yesHistory = await fetchPriceHistory(tokenIds[0])
  const noHistory  = tokenIds[1] ? await fetchPriceHistory(tokenIds[1]) : []

  if (yesHistory.length === 0) return { snapshots: 0, intervals: 0 }

  // Build time → {yes, no} map
  const noMap = new Map(noHistory.map(p => [p.t, p.p]))
  const distinctIntervals = new Set()
  let written = 0

  for (const point of yesHistory) {
    const tsSec = point.t
    if (typeof tsSec !== 'number') continue
    const intervalStart = bucketize(tsSec * 1000)
    const key = intervalStart.toISOString()
    if (distinctIntervals.has(key)) continue
    distinctIntervals.add(key)

    const yesPrice = Number(point.p)
    if (!Number.isFinite(yesPrice)) continue
    const noPrice = noMap.has(tsSec) ? Number(noMap.get(tsSec)) : (1 - yesPrice)

    try {
      await prisma.polymarketMarketSnapshot.upsert({
        where: {
          marketId_intervalStart: {
            marketId: marketRow.marketId,
            intervalStart
          }
        },
        update: {
          outcomes: marketRow.outcomes || ['Yes', 'No'],
          outcomePrices: [String(yesPrice), String(noPrice)],
          tokenIds: tokenIds,
        },
        create: {
          marketId: marketRow.marketId,
          intervalStart,
          question: marketRow.question,
          outcomes: marketRow.outcomes || ['Yes', 'No'],
          outcomePrices: [String(yesPrice), String(noPrice)],
          tokenIds: tokenIds,
          volume: marketRow.volume,
          liquidity: marketRow.liquidity,
          endDate: marketRow.endDate,
          category: marketRow.category,
          closed: marketRow.closed,
          closedTime: marketRow.closedTime,
        },
      })
      written += 1
    } catch (e) {
      // ignore individual upsert errors (likely missing columns); continue
    }
  }

  return { snapshots: written, intervals: distinctIntervals.size }
}

;(async () => {
  console.log(`Price-history backfill: groups=${TARGET_GROUPS.join('|')}, maxMarkets=${MAX_MARKETS_PER_GROUP}, fidelity=${FIDELITY_SECONDS}s, interval=${INTERVAL}`)

  for (const groupName of TARGET_GROUPS) {
    const group = await prisma.marketGroup.findUnique({ where: { name: groupName }, select: { markets: true } })
    if (!group || !group.markets || group.markets.length === 0) {
      console.log(`[skip] ${groupName}: no markets in group`)
      continue
    }
    const marketIds = group.markets.slice(0, MAX_MARKETS_PER_GROUP)
    console.log(`\n=== ${groupName} (${marketIds.length}/${group.markets.length} markets) ===`)

    // Pull most recent snapshot per market (to get tokenIds and metadata)
    const marketRows = await prisma.polymarketMarketSnapshot.findMany({
      where: { marketId: { in: marketIds } },
      orderBy: { intervalStart: 'desc' },
      distinct: ['marketId'],
    })

    let totalSnapshots = 0
    let marketsWithHistory = 0
    let i = 0
    for (const row of marketRows) {
      i += 1
      process.stdout.write(`  [${i}/${marketRows.length}] ${row.marketId}... `)
      try {
        const { snapshots, intervals } = await backfillMarket(row)
        process.stdout.write(`${snapshots} snapshots / ${intervals} intervals\n`)
        totalSnapshots += snapshots
        if (snapshots > 1) marketsWithHistory += 1
      } catch (e) {
        process.stdout.write(`error: ${e.message}\n`)
      }
    }
    console.log(`  -> ${groupName}: ${totalSnapshots} total snapshots written; ${marketsWithHistory} markets now have multi-interval history`)
  }

  await prisma.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
