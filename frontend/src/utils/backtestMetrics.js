// Derived backtest analytics. Pure functions — no API calls — driven from the
// `trades` array that BacktestDetails already loads from /backtest/report.
//
// All returned numbers default to 0 / null when there's no data so the UI can
// render unconditionally without guard clauses.

const toNumber = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const mean = (arr) =>
  arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length

const stddev = (arr) => {
  if (arr.length < 2) return 0
  const m = mean(arr)
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

/**
 * Compute advanced risk-adjusted + position-quality metrics from the closed
 * trade rows. Only SELL rows carry realized P&L, so all stats are derived from
 * the SELL slice.
 */
export function computeAdvancedMetrics(trades = [], initialCapital = 0) {
  const list = Array.isArray(trades) ? trades : []
  const sells = list.filter((t) => String(t?.action).toUpperCase() === "SELL")
  const buys = list.filter((t) => String(t?.action).toUpperCase() === "BUY")

  const profits = sells.map((t) => toNumber(t.profit))
  const wins = profits.filter((p) => p > 0)
  const losses = profits.filter((p) => p < 0)
  const breakevens = profits.filter((p) => p === 0)

  const totalGain = wins.reduce((s, v) => s + v, 0)
  const totalLoss = Math.abs(losses.reduce((s, v) => s + v, 0))
  const netProfit = profits.reduce((s, v) => s + v, 0)

  // Per-trade returns scaled against initial capital so Sharpe/Sortino are
  // comparable across backtests of different sizes.
  const capital = toNumber(initialCapital) || 1
  const tradeReturns = profits.map((p) => p / capital)

  const avgReturn = mean(tradeReturns)
  const stdReturn = stddev(tradeReturns)
  const sharpeRatio = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0

  const downside = tradeReturns.filter((r) => r < 0)
  const downsideDev = (() => {
    if (downside.length < 2) return 0
    const sq = downside.reduce((s, v) => s + v * v, 0) / (downside.length - 1)
    return Math.sqrt(sq)
  })()
  const sortinoRatio = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252) : 0

  const profitFactor = totalLoss > 0 ? totalGain / totalLoss : totalGain > 0 ? Infinity : 0

  const decisive = wins.length + losses.length
  const winRate = decisive > 0 ? wins.length / decisive : 0
  const avgWin = wins.length > 0 ? totalGain / wins.length : 0
  const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0
  const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0
  // Expectancy: average $ you should expect per trade given the strategy stats.
  const expectancy =
    decisive > 0 ? winRate * avgWin - (1 - winRate) * avgLoss : 0

  // Equity / drawdown curve for peak-to-trough metrics.
  let cumulative = 0
  let peak = capital
  let maxDrawdownAmount = 0
  let maxDrawdownPct = 0
  let inDrawdown = false
  let drawdownStart = null
  let longestDrawdownMs = 0
  const sortedSells = [...sells].sort(
    (a, b) => new Date(a.time) - new Date(b.time)
  )
  sortedSells.forEach((t) => {
    cumulative += toNumber(t.profit)
    const equity = capital + cumulative
    if (equity >= peak) {
      peak = equity
      if (inDrawdown && drawdownStart) {
        const span = new Date(t.time) - drawdownStart
        if (span > longestDrawdownMs) longestDrawdownMs = span
        inDrawdown = false
        drawdownStart = null
      }
    } else {
      const dd = peak - equity
      if (dd > maxDrawdownAmount) {
        maxDrawdownAmount = dd
        maxDrawdownPct = peak > 0 ? dd / peak : 0
      }
      if (!inDrawdown) {
        inDrawdown = true
        drawdownStart = new Date(t.time)
      }
    }
  })

  // Average holding time: pair each BUY with the first subsequent SELL on the
  // same marketId. A SELL closes the full open position, so all queued BUYs
  // up to that point inherit the same exit timestamp.
  const holdingTimesMs = []
  const openByMarket = new Map() // marketId -> [{ time }]
  ;[...list]
    .sort((a, b) => new Date(a.time) - new Date(b.time))
    .forEach((t) => {
      const mid = String(t.marketId || "")
      if (t.action === "BUY") {
        if (!openByMarket.has(mid)) openByMarket.set(mid, [])
        openByMarket.get(mid).push(new Date(t.time))
      } else if (t.action === "SELL") {
        const open = openByMarket.get(mid) || []
        const sellTime = new Date(t.time)
        open.forEach((buyTime) => holdingTimesMs.push(sellTime - buyTime))
        openByMarket.set(mid, [])
      }
    })
  const avgHoldingMs = holdingTimesMs.length > 0 ? mean(holdingTimesMs) : 0

  return {
    totalTrades: sells.length,
    totalBuys: buys.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    winRatePct: winRate * 100,
    avgWin,
    avgLoss,
    winLossRatio,
    expectancy,
    profitFactor,
    netProfit,
    grossGain: totalGain,
    grossLoss: -totalLoss,
    sharpeRatio,
    sortinoRatio,
    maxDrawdownAmount,
    maxDrawdownPct: maxDrawdownPct * 100,
    longestDrawdownMs,
    avgHoldingMs,
  }
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "—"
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m`
  const hr = min / 60
  if (hr < 24) return `${hr.toFixed(1)}h`
  return `${(hr / 24).toFixed(1)}d`
}

export function formatRatio(value) {
  if (!Number.isFinite(value)) return "∞"
  return value.toFixed(2)
}

// ---------- Export helpers ----------

const escapeCsv = (val) => {
  if (val == null) return ""
  const s = String(val)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function tradesToCsv(trades = []) {
  const headers = [
    "index",
    "marketId",
    "marketQuestion",
    "action",
    "time",
    "price",
    "shares",
    "amount",
    "profit",
    "positionOutcome",
    "signal",
  ]
  const rows = (trades || []).map((t, i) => [
    t.index ?? i + 1,
    t.marketId ?? "",
    t.marketQuestion ?? "",
    t.action ?? "",
    t.time ?? "",
    t.price ?? "",
    t.shares ?? "",
    t.amount ?? "",
    t.profit ?? "",
    t.positionOutcome ?? "",
    t.signal ?? "",
  ])
  return [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n")
}

export function downloadFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
