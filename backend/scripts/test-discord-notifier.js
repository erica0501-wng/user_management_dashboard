/**
 * Test Discord webhook end-to-end. Set DISCORD_WEBHOOK_URL in .env first.
 */
require('dotenv').config()
const discord = require('../src/services/discordNotifier')

;(async () => {
  if (!process.env.DISCORD_WEBHOOK_URL) {
    console.log('DISCORD_WEBHOOK_URL is not set in .env — Discord notifications will be skipped.')
    process.exit(0)
  }

  console.log('Sending sample Archive notification...')
  console.log(await discord.notifyArchiveCompleted({
    success: true, skipped: false,
    archivedMarkets: 300, archivedOrderBooks: 600,
    elapsedMs: 217000, intervalStart: new Date().toISOString(),
  }))

  console.log('Sending sample Past Event notification...')
  console.log(await discord.notifyPastEventArchived({
    marketId: 'sample-id-123',
    question: 'Will the Lakers win the 2026 NBA Finals?',
    category: 'Sports',
    closedTime: new Date(),
    endDate: new Date(),
  }))

  console.log('Sending sample Backtest notification...')
  console.log(await discord.notifyBacktestCompleted({
    groupName: 'NBA',
    strategyName: 'momentum',
    marketId: 'sample-id-123',
    marketQuestion: 'Will the Lakers win the 2026 NBA Finals?',
    backtest: {
      id: 999,
      pnl: 123.45, roi: 12.34, winRate: 58.3,
      totalTrades: 24, winningTrades: 14, losingTrades: 10,
      maxDrawdown: 8.2, initialCapital: 1000, finalValue: 1123.45,
      startTime: new Date(Date.now() - 30 * 86400000), endTime: new Date(),
    }
  }))

  console.log('Sending sample Daily Digest...')
  console.log(await discord.notifyDailyDigest({
    archivedMarketsToday: 1234,
    archivedClosedMarketsToday: 56,
    backtestsToday: 4,
    topGroups: [
      { name: 'NBA', count: 48 }, { name: 'Politics', count: 127 }, { name: 'Sports', count: 135 },
    ],
  }))

  process.exit(0)
})().catch(e => { console.error(e); process.exit(1) })
