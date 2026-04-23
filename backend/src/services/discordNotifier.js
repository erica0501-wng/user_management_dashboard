/**
 * Discord webhook notifier for archive + backtest events.
 * Configure via env: DISCORD_WEBHOOK_URL
 * Optional: DISCORD_NOTIFY_ARCHIVE=true|false (default true)
 *           DISCORD_NOTIFY_BACKTEST=true|false (default true)
 *           DISCORD_NOTIFY_DAILY_DIGEST=true|false (default true)
 */

const DEFAULT_USERNAME = "Polymarket Bot"

function isEnabled(envKey, defaultEnabled = true) {
  const raw = process.env[envKey]
  if (raw === undefined || raw === null || raw === "") {
    return defaultEnabled
  }
  return String(raw).toLowerCase() === "true"
}

async function postToDiscord(payload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) {
    return { success: false, skipped: true, reason: "DISCORD_WEBHOOK_URL not set" }
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: DEFAULT_USERNAME,
        ...payload,
      }),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      console.warn(`[discord] webhook responded ${response.status}: ${text.slice(0, 200)}`)
      return { success: false, status: response.status }
    }

    return { success: true }
  } catch (err) {
    console.warn(`[discord] webhook error: ${err.message}`)
    return { success: false, error: err.message }
  }
}

function fmtNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  return Number(n).toLocaleString("en-US")
}

function fmtPct(n, digits = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  return `${Number(n).toFixed(digits)}%`
}

/** Notify when archiver finishes a run. */
async function notifyArchiveCompleted(result) {
  if (!isEnabled("DISCORD_NOTIFY_ARCHIVE")) return { skipped: true }
  if (!result || result.success === false) {
    return postToDiscord({
      embeds: [{
        title: "❌ Polymarket archive failed",
        description: result?.error || "Unknown error",
        color: 0xE74C3C,
        timestamp: new Date().toISOString(),
      }],
    })
  }
  if (result.skipped) return { skipped: true }

  return postToDiscord({
    embeds: [{
      title: "📦 Polymarket archive completed",
      color: 0x2ECC71,
      timestamp: new Date().toISOString(),
      fields: [
        { name: "Market snapshots", value: fmtNum(result.archivedMarkets), inline: true },
        { name: "Order book snapshots", value: fmtNum(result.archivedOrderBooks), inline: true },
        { name: "Elapsed", value: `${(result.elapsedMs / 1000).toFixed(1)}s`, inline: true },
        { name: "Interval", value: result.intervalStart || "—", inline: false },
      ],
    }],
  })
}

/** Notify when a backtest finishes. Pass the saved Backtest row + group meta. */
async function notifyBacktestCompleted({ groupName, strategyName, backtest, marketId = null, marketQuestion = null }) {
  if (!isEnabled("DISCORD_NOTIFY_BACKTEST")) return { skipped: true }
  if (!backtest) return { skipped: true }

  const color = backtest.pnl >= 0 ? 0x2ECC71 : 0xE74C3C
  const emoji = backtest.pnl >= 0 ? "🟢" : "🔴"

  const rawBaseUrl = (process.env.FRONTEND_URL || "").trim()
  const baseUrl = (rawBaseUrl || "https://stocks.quadrawebs.com").replace(/\/+$/, "")
  const detailsUrl = backtest.id ? `${baseUrl}/polymarket/backtest/${backtest.id}` : null

  const trimmedQuestion = marketQuestion ? String(marketQuestion).trim().slice(0, 240) : null
  const marketField = trimmedQuestion
    ? { name: "Market", value: marketId ? `${trimmedQuestion}\n\`${marketId}\`` : trimmedQuestion, inline: false }
    : null

  console.log(`[discord] notifyBacktestCompleted backtestId=${backtest.id ?? "(none)"} marketId=${marketId ?? "(none)"} detailsUrl=${detailsUrl ?? "(none)"}`)

  return postToDiscord({
    embeds: [{
      title: `${emoji} Backtest completed: ${groupName} / ${strategyName}`,
      url: detailsUrl || undefined,
      description: detailsUrl ? `🔗 **[View full backtest report ↗](${detailsUrl})**` : undefined,
      color,
      timestamp: new Date().toISOString(),
      fields: [
        ...(marketField ? [marketField] : []),
        { name: "PnL", value: fmtNum(backtest.pnl), inline: true },
        { name: "ROI", value: fmtPct(backtest.roi), inline: true },
        { name: "Win rate", value: fmtPct(backtest.winRate), inline: true },
        { name: "Trades", value: `${fmtNum(backtest.totalTrades)} (${fmtNum(backtest.winningTrades)}W / ${fmtNum(backtest.losingTrades)}L)`, inline: true },
        { name: "Max drawdown", value: fmtPct(backtest.maxDrawdown), inline: true },
        { name: "Initial → Final", value: `${fmtNum(backtest.initialCapital)} → ${fmtNum(backtest.finalValue)}`, inline: true },
        { name: "Window", value: `${new Date(backtest.startTime).toISOString().slice(0, 10)} → ${new Date(backtest.endTime).toISOString().slice(0, 10)}`, inline: false },
        ...(detailsUrl ? [{ name: "Details", value: `[Open backtest report ↗](${detailsUrl})`, inline: false }] : []),
      ],
    }],
  })
}

/** Notify when a past event has been archived (i.e. a market just closed and is ready to backtest). */
async function notifyPastEventArchived({ marketId, question, category, closedTime, endDate }) {
  if (!isEnabled("DISCORD_NOTIFY_ARCHIVE")) return { skipped: true }
  return postToDiscord({
    embeds: [{
      title: "🗂️ Past event archived (ready for backtest)",
      color: 0x3498DB,
      timestamp: new Date().toISOString(),
      fields: [
        { name: "Market", value: question?.slice(0, 240) || marketId, inline: false },
        { name: "Category", value: category || "—", inline: true },
        { name: "Closed at", value: closedTime ? new Date(closedTime).toISOString() : "—", inline: true },
        { name: "Event end", value: endDate ? new Date(endDate).toISOString() : "—", inline: true },
        { name: "Market ID", value: `\`${marketId}\``, inline: false },
      ],
    }],
  })
}

/** Daily digest: sent once per day with totals. */
async function notifyDailyDigest({ archivedMarketsToday, archivedClosedMarketsToday, backtestsToday, topGroups }) {
  if (!isEnabled("DISCORD_NOTIFY_DAILY_DIGEST")) return { skipped: true }

  const groupLines = (topGroups || [])
    .map(g => `• **${g.name}**: ${fmtNum(g.count)} markets`)
    .join("\n") || "—"

  return postToDiscord({
    embeds: [{
      title: "📅 Polymarket daily digest",
      color: 0x9B59B6,
      timestamp: new Date().toISOString(),
      fields: [
        { name: "Markets archived today", value: fmtNum(archivedMarketsToday), inline: true },
        { name: "Closed (past events) today", value: fmtNum(archivedClosedMarketsToday), inline: true },
        { name: "Backtests run today", value: fmtNum(backtestsToday), inline: true },
        { name: "Top groups by market count", value: groupLines, inline: false },
      ],
    }],
  })
}

module.exports = {
  postToDiscord,
  notifyArchiveCompleted,
  notifyBacktestCompleted,
  notifyPastEventArchived,
  notifyDailyDigest,
}
