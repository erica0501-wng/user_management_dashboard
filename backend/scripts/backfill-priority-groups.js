/**
 * Local backfill: run polymarketDataArchiver.archiveSnapshots() for each priority
 * group sequentially in this Node process (no 300s Vercel limit). Use this to
 * recover after a stretch of missed cron runs.
 *
 * Usage:
 *   node scripts/backfill-priority-groups.js                # all 4 priority groups
 *   node scripts/backfill-priority-groups.js Movies         # one group only
 *   node scripts/backfill-priority-groups.js "Economic Policy" Movies
 */
require('dotenv').config()

const polymarketDataArchiver = require('../src/services/polymarketDataArchiver')

async function main() {
  const argGroups = process.argv.slice(2).filter(Boolean)
  const allGroupNames = polymarketDataArchiver.priorityGroups.map((g) => g.name)
  const targets = argGroups.length > 0 ? argGroups : allGroupNames

  console.log(`Backfilling ${targets.length} group(s) sequentially: ${targets.join(', ')}`)

  for (const name of targets) {
    const startedAt = Date.now()
    console.log(`\n=== ${name} ===`)
    try {
      // Each call must wait for the previous to finish — archiveSnapshots short-circuits
      // when isArchiving is true, so sequential awaits are required.
      const result = await polymarketDataArchiver.archiveSnapshots({
        priorityGroupNames: [name],
        skipGenericFeed: true
      })
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1)
      if (result?.skipped) {
        console.log(`  SKIPPED (${result.reason}) in ${seconds}s`)
      } else if (result?.success) {
        console.log(
          `  OK in ${seconds}s — archivedMarkets=${result.archivedMarkets}, archivedOrderBooks=${result.archivedOrderBooks}, intervalStart=${result.intervalStart}`
        )
      } else {
        console.log(`  FAIL in ${seconds}s — ${result?.error || 'unknown error'}`)
      }
    } catch (error) {
      console.error(`  EXCEPTION: ${error.message}`)
    }
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch((error) => {
  console.error('Fatal:', error)
  process.exit(1)
})
