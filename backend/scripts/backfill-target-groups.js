 /**
 * Backfill historical Polymarket markets by tag_id for boss-priority groups.
 *
 * Usage: node scripts/backfill-target-groups.js [--limit=200] [--include-open]
 *
 * For each (groupName, tagIds) pair:
 *   1. Page through Polymarket Gamma /markets?tag_id=<id>&closed=true
 *   2. Upsert market snapshots into PolymarketMarketSnapshot
 *   3. Add market IDs to MarketGroup.markets array (de-duped)
 *
 * Note: This makes a single snapshot per market at the current moment.
 * Repeated runs (or the live archiver) build the time-series needed for backtests.
 */
require('dotenv').config()
const prisma = require('../src/prisma')
const archiver = require('../src/services/polymarketDataArchiver')

// Parsed via Polymarket Gamma /tags
const GROUP_TAGS = {
  Movies: [
    { id: '1164', label: 'hollywood' },
  ],
  'Economic Policy': [
    { id: '370',    label: 'GDP' },
    { id: '131',    label: 'interest rates' },
    { id: '100201', label: 'recession' },
    { id: '101794', label: 'Foreign Policy' },
    { id: '933',    label: 'federal government' },
  ],
  'Elon Tweets': [
    // Polymarket has no dedicated "elon tweets" tag.
    // Closest tags: tesla (id varies), spacex, etc. -- often grouped under Tech/Companies.
    // Keeping empty here; broader regex categorization in marketGrouping.js still picks these up
    // when they appear via the live archiver.
  ],
  NBA: [
    // NBA already populated via live archiver (48 markets); skip backfill.
  ],
}

const args = process.argv.slice(2)
const PAGE_LIMIT = Number((args.find(a => a.startsWith('--limit=')) || '--limit=200').split('=')[1])
const INCLUDE_OPEN = args.includes('--include-open')

async function fetchMarketsForTag(tagId, includeOpen) {
  const allMarkets = []
  // Closed markets
  for (let offset = 0; offset < 2000; offset += PAGE_LIMIT) {
    const url = `https://gamma-api.polymarket.com/markets?tag_id=${tagId}&closed=true&limit=${PAGE_LIMIT}&offset=${offset}`
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`[warn] tag ${tagId} closed page ${offset}: HTTP ${res.status}`)
      break
    }
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    allMarkets.push(...data)
    if (data.length < PAGE_LIMIT) break
  }
  if (includeOpen) {
    for (let offset = 0; offset < 2000; offset += PAGE_LIMIT) {
      const url = `https://gamma-api.polymarket.com/markets?tag_id=${tagId}&closed=false&limit=${PAGE_LIMIT}&offset=${offset}`
      const res = await fetch(url)
      if (!res.ok) break
      const data = await res.json()
      if (!Array.isArray(data) || data.length === 0) break
      allMarkets.push(...data)
      if (data.length < PAGE_LIMIT) break
    }
  }
  return allMarkets
}

function getIntervalStart(d = new Date()) {
  const ms = 5 * 60 * 1000
  return new Date(Math.floor(d.getTime() / ms) * ms)
}

async function backfillGroup(groupName, tags) {
  if (!tags || tags.length === 0) {
    console.log(`[skip] ${groupName} has no configured tags`)
    return
  }
  console.log(`\n=== Backfilling ${groupName} ===`)
  const seenMarketIds = new Set()
  let upserted = 0
  let firstClosedNotified = 0
  const intervalStart = getIntervalStart()

  for (const tag of tags) {
    process.stdout.write(`  fetch tag ${tag.id} (${tag.label})... `)
    const raws = await fetchMarketsForTag(tag.id, INCLUDE_OPEN)
    process.stdout.write(`${raws.length} markets\n`)
    for (const raw of raws) {
      const market = archiver.normalizeMarket(raw)
      if (!market.id || seenMarketIds.has(market.id)) continue
      seenMarketIds.add(market.id)
      try {
        await archiver.upsertMarketSnapshot(market, intervalStart)
        upserted += 1
      } catch (e) {
        console.warn(`    [warn] upsert ${market.id}: ${e.message}`)
      }
    }
  }

  // Update MarketGroup.markets (merge with existing)
  if (seenMarketIds.size > 0) {
    const existing = await prisma.marketGroup.findUnique({
      where: { name: groupName },
      select: { id: true, markets: true }
    })
    if (existing) {
      const merged = Array.from(new Set([...(existing.markets || []), ...seenMarketIds]))
      await prisma.marketGroup.update({
        where: { id: existing.id },
        data: { markets: merged }
      })
      console.log(`  -> ${groupName}: ${seenMarketIds.size} unique markets fetched, ${upserted} snapshots upserted; group now has ${merged.length} markets`)
    } else {
      console.log(`  [warn] MarketGroup "${groupName}" not found in DB`)
    }
  }
}

;(async () => {
  console.log(`Backfill starting (page limit=${PAGE_LIMIT}, include-open=${INCLUDE_OPEN})`)
  for (const [groupName, tags] of Object.entries(GROUP_TAGS)) {
    await backfillGroup(groupName, tags)
  }

  // Print summary
  console.log('\n=== Final group counts ===')
  for (const groupName of Object.keys(GROUP_TAGS)) {
    const g = await prisma.marketGroup.findUnique({ where: { name: groupName }, select: { markets: true } })
    console.log(`  ${groupName}: ${(g?.markets || []).length} markets`)
  }
  await prisma.$disconnect()
})().catch(e => { console.error(e); process.exit(1) })
