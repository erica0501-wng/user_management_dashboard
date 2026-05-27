import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import BacktestChart from "../components/BacktestChart"
import EquityCurveChart from "../components/EquityCurveChart"
import { getPolymarketEventUrl, getPolymarketMarketMeta } from "../utils/polymarketMarketMeta"
import {
  computeAdvancedMetrics,
  formatDuration,
  formatRatio,
  tradesToCsv,
  downloadFile,
} from "../utils/backtestMetrics"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000"

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`
const formatCurrency = (value) => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const getMarketHeroImage = (market) => {
  if (market?.image) return market.image
  if (market?.icon) return market.icon
  return `https://via.placeholder.com/1200x400.png?text=${encodeURIComponent(market?.question || market?.title || "Polymarket Market")}`
}
const formatTradeTime = (value) => {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value))
}

const roiColor = (roi) => {
  if (roi > 5) return "text-emerald-600"
  if (roi > -10) return "text-amber-600"
  return "text-rose-600"
}

const winRateColor = (winRate) => {
  if (winRate >= 60) return "text-emerald-600"
  if (winRate >= 40) return "text-amber-600"
  return "text-rose-600"
}

export default function BacktestDetails() {
  const { backtestId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [report, setReport] = useState(null)
  const [selectedMarketId, setSelectedMarketId] = useState("")
    const [tradeFilter, setTradeFilter] = useState("ALL") // ALL, BUY, SELL
  const [neutralEntries, setNeutralEntries] = useState([])
  const [neutralLoading, setNeutralLoading] = useState(false)
  const [neutralError, setNeutralError] = useState("")
  const [excludeNeutral, setExcludeNeutral] = useState(false)
  const [showNeutralPanel, setShowNeutralPanel] = useState(true)

  useEffect(() => {
    const loadBacktestReport = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${API_BASE}/polymarket/backtest/report/${backtestId}`)
        if (!response.ok) throw new Error("Failed to load backtest report")
        const data = await response.json()
        setReport(data.report)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (backtestId) {
      loadBacktestReport()
    }
  }, [backtestId])

  // Fetch neutral-trade audit log for this backtest (boss requirement: confirm
  // buy/sell timestamps for neutral trades and observe how often + why they
  // happen). Backend route: /api/neutral-sell-log?backtestId=…
  useEffect(() => {
    if (!backtestId) return
    let cancelled = false
    const loadNeutral = async () => {
      try {
        setNeutralLoading(true)
        setNeutralError("")
        const resp = await fetch(`${API_BASE}/api/neutral-sell-log?backtestId=${encodeURIComponent(backtestId)}`)
        if (!resp.ok) {
          // 404 just means no neutral trades have been logged yet — that's fine.
          if (resp.status === 404) {
            if (!cancelled) setNeutralEntries([])
            return
          }
          throw new Error(`HTTP ${resp.status}`)
        }
        const json = await resp.json()
        if (!cancelled) setNeutralEntries(Array.isArray(json?.data) ? json.data : [])
      } catch (err) {
        if (!cancelled) {
          setNeutralError(String(err?.message || err))
          setNeutralEntries([])
        }
      } finally {
        if (!cancelled) setNeutralLoading(false)
      }
    }
    loadNeutral()
    return () => { cancelled = true }
  }, [backtestId])

  useEffect(() => {
    const reportMarkets = Array.isArray(report?.markets) ? report.markets : []
    const reportTrades = Array.isArray(report?.trades) ? report.trades : []

    if (reportMarkets.length === 0) {
      setSelectedMarketId("")
      return
    }

    const marketTradeStats = reportTrades.reduce((stats, trade) => {
      const marketId = String(trade?.marketId || "").trim()
      if (!marketId) {
        return stats
      }

      const current = stats.get(marketId) || { total: 0, buys: 0 }
      current.total += 1
      if (String(trade?.action || "").toUpperCase() === "BUY") {
        current.buys += 1
      }
      stats.set(marketId, current)
      return stats
    }, new Map())

    setSelectedMarketId((current) => {
      const normalizedCurrent = String(current || "")
      const currentExists = reportMarkets.some((market) => String(market.marketId) === normalizedCurrent)

      if (currentExists) {
        return normalizedCurrent
      }

      const bestMarketId = Array.from(marketTradeStats.entries()).sort((left, right) => {
        const leftStats = left[1]
        const rightStats = right[1]

        if (rightStats.total !== leftStats.total) {
          return rightStats.total - leftStats.total
        }

        return rightStats.buys - leftStats.buys
      })[0]?.[0]

      if (bestMarketId && reportMarkets.some((market) => String(market.marketId) === String(bestMarketId))) {
        return String(bestMarketId)
      }

      return String(reportMarkets[0].marketId)
    })
  }, [report])

  if (loading)
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <main className="ml-64 flex-1 px-8 py-8">
          <div className="flex min-h-[60vh] items-center justify-center rounded-3xl bg-white shadow-sm">
            <div className="text-lg text-gray-500">Loading...</div>
          </div>
        </main>
      </div>
    )


  if (error)
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <main className="ml-64 flex-1 px-8 py-8">
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-3 text-red-700">
              {error}
            </div>
            <button
              onClick={() => navigate("/polymarket/backtest")}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to Backtests
            </button>
          </div>
        </main>
      </div>
    )

  // Show warning if trades were missing transactionId
  const warning = report?.warning;

  if (!report)
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <main className="ml-64 flex-1 px-8 py-8">
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="text-gray-500">Report not found</div>
          </div>
        </main>
      </div>
    )

  const { backtest, trades, summary } = report
  const markets = Array.isArray(report.markets) ? report.markets : []

  // Authoritative trade-row tally: every BUY + every SELL row in the trade table.
  // Older backtests stored backtest.totalTrades = winningTrades + losingTrades (e.g. 3W +
  // 16L = 19), which under-counts because it ignores BUYs and breakeven SELLs. We always
  // recompute from the actual trade rows so the headline reflects 42B + 19S = 61 instead
  // of the stale DB column. Falls back to `summary` then `backtest.totalTrades` only when
  // the trades array is missing entirely.
  const buyCountDerived = Array.isArray(trades)
    ? trades.filter(t => String(t?.action).toUpperCase() === "BUY").length
    : null
  const sellCountDerived = Array.isArray(trades)
    ? trades.filter(t => String(t?.action).toUpperCase() === "SELL").length
    : null
  const buyCountDisplay = buyCountDerived ?? Number(summary?.buyCount || 0)
  const sellCountDisplay = sellCountDerived ?? Number(summary?.sellCount || 0)
  const tradeRowsTotal = (() => {
    if (Array.isArray(trades) && trades.length > 0) return trades.length
    if (summary && (summary.buyCount != null || summary.sellCount != null)) {
      return Number(summary.buyCount || 0) + Number(summary.sellCount || 0)
    }
    return Number(backtest?.totalTrades || 0)
  })()

    // ===== 新增：统计 Buy/Sell/Total =====
    const buyTotal = (trades || []).filter(t => t.action === 'BUY').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    const sellTotal = (trades || []).filter(t => t.action === 'SELL').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
    const totalBuySell = buyTotal + sellTotal

    const formatCurrency = (value) => `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Build a P/L attribution breakdown over an arbitrary trade slice. Used twice below:
  //  - once for the selected market (so the Trade Summary panel is internally consistent)
  //  - once for ALL markets (so the Capital Summary panel reconciles with backtest.pnl)
  const buildPnlAttribution = (tradeSlice) => {
    const all = Array.isArray(tradeSlice) ? tradeSlice : []
    let grossGain = 0
    let grossLoss = 0
    let biggestWin = null
    let biggestLoss = null
    all.forEach((trade) => {
      if (trade.action !== "SELL") return
      const profit = Number(trade.profit)
      if (!Number.isFinite(profit)) return
      const market = markets.find((m) => String(m.marketId) === String(trade.marketId))
      const marketName = market
        ? getPolymarketMarketMeta(market, `Market ${trade.marketId}`).displayName
        : `Market ${trade.marketId}`
      const entry = { profit, marketName, marketId: String(trade.marketId) }
      if (profit > 0) {
        grossGain += profit
        if (!biggestWin || profit > biggestWin.profit) biggestWin = entry
      } else if (profit < 0) {
        grossLoss += profit
        if (!biggestLoss || profit < biggestLoss.profit) biggestLoss = entry
      }
    })
    return { grossGain, grossLoss, netProfit: grossGain + grossLoss, biggestWin, biggestLoss }
  }

  const overallPnlAttribution = buildPnlAttribution(trades)

  // Neutral-trade audit (boss requirement): split orphan SELLs from breakeven
  // BUYs, derive a holding-time histogram, and (when `excludeNeutral` is on)
  // compute an "exclude-neutral" view of P&L + win rate so the user can see
  // what the strategy looks like once unactionable trades are filtered out.
  const neutralOrphanSells = neutralEntries.filter((e) => e?.category === "ORPHAN_SELL")
  const neutralBreakevens = neutralEntries.filter((e) => e?.category === "BREAKEVEN")
  const neutralOrphanProfit = neutralOrphanSells.reduce((sum, e) => {
    const proceeds = Number(e?.matchedShares || 0) * Number(e?.sellPrice || 0)
    return sum + proceeds // proceeds attributed to this orphan SELL row
  }, 0)
  const neutralStrategyCounts = neutralEntries.reduce((acc, e) => {
    const k = `${e?.category || "?"} · ${e?.strategy || "unknown"}`
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  const neutralReasonCounts = neutralEntries.reduce((acc, e) => {
    const k = e?.reason || "unspecified"
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
  // Derived "exclude neutral" metrics. We keep the original numbers intact and
  // only surface these as an alternative view next to the toggle.
  const breakevenBuyIdxSet = new Set(neutralBreakevens.map((e) => Number(e?.tradeIdx)).filter((n) => Number.isFinite(n)))
  const orphanSellIdxSet = new Set(neutralOrphanSells.map((e) => Number(e?.tradeIdx)).filter((n) => Number.isFinite(n)))
  const filteredTradesForMetrics = (trades || []).filter((t, idx) => {
    // Trades are returned in original order with `index` = idx+1, so trade.index-1 lines up.
    const rowIdx = Number(t?.index) - 1
    if (Number.isFinite(rowIdx) && (breakevenBuyIdxSet.has(rowIdx) || orphanSellIdxSet.has(rowIdx))) return false
    return true
  })
  const filteredBuyTrades = filteredTradesForMetrics.filter((t) => String(t.action).toUpperCase() === "BUY")
  const filteredWins = filteredBuyTrades.filter((t) => t.positionOutcome === "WIN").length
  const filteredLosses = filteredBuyTrades.filter((t) => t.positionOutcome === "LOSS").length
  const filteredDecisive = filteredWins + filteredLosses
  const excludedWinRate = filteredDecisive > 0 ? (filteredWins / filteredDecisive) * 100 : 0
  const excludedNetPnl = filteredBuyTrades.reduce((sum, t) => sum + Number(t.positionProfit || 0), 0)
  const headlineWinRate = excludeNeutral ? excludedWinRate : Number(backtest?.winRate || 0)
  const headlinePnl = excludeNeutral ? excludedNetPnl : Number(backtest?.pnl || 0)

  const selectedMarket = markets.find((market) => String(market.marketId) === String(selectedMarketId)) || null
  const marketCard = selectedMarket || markets[0] || null
  const selectedTrades = (trades || []).filter((trade) => String(trade.marketId) === String(selectedMarketId))
  const sortedTrades = [...selectedTrades].sort((left, right) => new Date(left.time) - new Date(right.time))
    const filteredTrades = tradeFilter === "ALL"
      ? sortedTrades
      : sortedTrades.filter((trade) => trade.action === tradeFilter)
  const selectedPnlAttribution = buildPnlAttribution(selectedTrades)

  // Reconciliation: backtest.pnl should equal sum of all SELL profits when every BUY was
  // closed. If auto-close skipped a position (e.g. exitPrice <= 0), there will be a residual.
  const realizedNet = overallPnlAttribution.netProfit
  const unrealizedResidual = Number(backtest.pnl || 0) - realizedNet

  // Per-market trade stats so the Trade Summary numbers tally with the Trade History table
  // (which is filtered to the selected market). Otherwise users see e.g. "24 trades" in the
  // summary but a different number of rows in the table because the summary aggregates all
  // markets while the table is scoped to the focused market.
  const selectedTradeStats = (() => {
    const buyCount = selectedTrades.filter((t) => t.action === "BUY").length
    const sellTrades = selectedTrades.filter((t) => t.action === "SELL")
    const sellCount = sellTrades.length
    const winningCount = sellTrades.filter((t) => Number(t.profit || 0) > 0).length
    const losingCount = sellTrades.filter((t) => Number(t.profit || 0) < 0).length
    const breakevenCount = sellTrades.filter((t) => Number(t.profit || 0) === 0).length
    return {
      transactionCount: selectedTrades.length,
      buyCount,
      sellCount,
      winningCount,
      losingCount,
      breakevenCount
    }
  })()

  // Overall (all markets) closed-trade breakdown — winning + losing may not equal totalTrades
  // when a SELL closes at exactly the entry price, so surface the breakeven count too.
  const overallBreakeven = Math.max(
    0,
    Number(backtest.totalTrades || 0) - Number(backtest.winningTrades || 0) - Number(backtest.losingTrades || 0)
  )

  // Link BUY trades to the SELL that closed them (a SELL liquidates the entire open position
  // for that market, so all BUYs since the prior SELL are closed by it). This lets us show
  // per-buy realized profit/loss and which BUYs each SELL closed.
  const tradeLinkage = (() => {
    const buyMeta = new Map()   // sortedTrades index -> { closedBySellRow, realizedProfit }
    const sellMeta = new Map()  // sortedTrades index -> { closedBuyRows: number[], avgEntryPrice }
    let openBuys = []           // [{ rowIndex, shares, price }]
    sortedTrades.forEach((trade, idx) => {
      const rowNumber = idx + 1
      if (trade.action === "BUY") {
        openBuys.push({ rowIndex: idx, shares: Number(trade.shares) || 0, price: Number(trade.price) || 0 })
      } else if (trade.action === "SELL" && openBuys.length > 0) {
        const sellPrice = Number(trade.price) || 0
        const sellTime = trade.time
        const closedRows = []
        let totalShares = 0
        let totalCost = 0
        openBuys.forEach((buy) => {
          const realized = buy.shares * (sellPrice - buy.price)
          buyMeta.set(buy.rowIndex, {
            closedBySellRow: rowNumber,
            closedBySellTime: sellTime,
            closedBySellPrice: sellPrice,
            realizedProfit: realized
          })
          closedRows.push(buy.rowIndex + 1)
          totalShares += buy.shares
          totalCost += buy.shares * buy.price
        })
        const avgEntryPrice = totalShares > 0 ? totalCost / totalShares : 0
        sellMeta.set(idx, { closedBuyRows: closedRows, avgEntryPrice })
        openBuys = []
      }
    })
    return { buyMeta, sellMeta }
  })()
  const selectedPriceSeries = Array.isArray(report.marketPriceSeries?.[String(selectedMarketId)])
    ? report.marketPriceSeries[String(selectedMarketId)]
    : []

  // Advanced metrics derived client-side from the trade rows — gives users
  // Sharpe/Sortino/Profit Factor/Expectancy/avg holding time without any
  // backend changes. Recomputed whenever trades or capital change.
  const advancedMetrics = computeAdvancedMetrics(trades, backtest?.initialCapital)

  const handleExportCsv = () => {
    const csv = tradesToCsv(trades)
    downloadFile(`backtest-${backtest?.id || backtestId}-trades.csv`, csv, "text/csv;charset=utf-8")
  }
  const handleExportJson = () => {
    const payload = JSON.stringify({ report, advancedMetrics }, null, 2)
    downloadFile(`backtest-${backtest?.id || backtestId}-report.json`, payload, "application/json")
  }
  const handlePrintReport = () => {
    if (typeof window !== "undefined") window.print()
  }
  const selectedMarketMeta = getPolymarketMarketMeta(selectedMarket || {}, "Historical backtest market")
  const chartImage = getMarketHeroImage(marketCard || markets[0] || null)
  const chartTitle = selectedMarketMeta.displayName
  const chartSubtitle = selectedMarket
    ? selectedMarket.description || selectedMarket.category || "Historical backtest market"
    : "Select a market to inspect its price action and trade markers"
  const marketStatus = selectedMarket?.active ? "Live" : "Closed"

  return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <main className="ml-64 flex-1 px-8 py-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Header */}
            <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => navigate("/polymarket/backtest")}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  ← Back to Results
                </button>
                {/* Export / print actions. CSV exports trade rows, JSON exports the
                    full report + derived metrics, Print opens the browser dialog
                    so users can save the page as PDF. All purely client-side. */}
                <div className="flex flex-wrap items-center gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    title="Download all trade rows as CSV"
                  >
                    ⬇ Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    title="Download the full backtest report as JSON"
                  >
                    ⬇ Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintReport}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    title="Open the browser print dialog (Save as PDF)"
                  >
                    🖨 Print / PDF
                  </button>
                </div>
              </div>
              {/* ===== 策略标题和summary卡片，最顶部 ===== */}
              <h1 className="text-3xl font-bold text-gray-900">{backtest.strategyName} Strategy</h1>
              <p className="mt-1 text-gray-600 mb-6">
                {backtest.marketQuestion
                  ? backtest.marketQuestion
                  : `${backtest.groupName} Group`}
                {" • "}{tradeRowsTotal} total trade{tradeRowsTotal === 1 ? "" : "s"}
                {" · "}{summary?.buyCount ?? 0} BUY / {summary?.sellCount ?? 0} SELL{(summary?.settledCount ?? 0) > 0 ? ` / ${summary.settledCount} settled` : ""}
              </p>
              {/* ===== Buy/Sell/Total 统计卡片，第二行 ===== */}
              <div className="flex flex-wrap gap-6 mb-6">
                <div className="flex-1 min-w-[180px] rounded-2xl bg-white px-6 py-4 shadow-sm border border-blue-100">
                  <div className="text-gray-500 text-sm mb-1">Buy Total</div>
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(buyTotal)}</div>
                </div>
                <div className="flex-1 min-w-[180px] rounded-2xl bg-white px-6 py-4 shadow-sm border border-green-100">
                  <div className="text-gray-500 text-sm mb-1">Sell Total</div>
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(sellTotal)}</div>
                </div>
                <div className="flex-1 min-w-[180px] rounded-2xl bg-white px-6 py-4 shadow-sm border border-amber-100">
                  <div className="text-gray-500 text-sm mb-1">Total Buy+Sell</div>
                  <div className="text-2xl font-bold text-amber-600">{formatCurrency(totalBuySell)}</div>
                </div>
              </div>
              {/* ===== warning 保持在下方 ===== */}
              {warning && (
                <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-amber-800">
                  ⚠️ {warning}
                </div>
              )}
          </div>

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl bg-white px-6 py-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-600 uppercase">ROI</div>
              <div className={`mt-2 text-3xl font-bold ${roiColor(backtest.roi)}`}>
                {formatPercent(backtest.roi)}
              </div>
            </div>
            <div className="rounded-2xl bg-white px-6 py-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-600 uppercase">Win Rate</div>
              <div className={`mt-2 text-3xl font-bold ${winRateColor(headlineWinRate)}`}>
                {formatPercent(headlineWinRate)}
              </div>
              {excludeNeutral && (
                <div className="mt-1 text-[11px] text-amber-700">excl. neutral</div>
              )}
            </div>
            <div className="rounded-2xl bg-white px-6 py-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-600 uppercase">Total Trades</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{tradeRowsTotal}</div>
              <div className="mt-1 text-xs text-gray-600">
                {buyCountDisplay}B / {sellCountDisplay}S{(summary?.settledCount ?? 0) > 0 ? ` / ${summary.settledCount} settled` : ""}
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500">
                {summary?.winningCount ?? backtest.winningTrades}W · {summary?.losingCount ?? backtest.losingTrades}L
                {(summary?.breakevenCount ?? 0) > 0 ? ` · ${summary.breakevenCount}BE` : ""}
                {sellCountDisplay > 0 ? ` · ${sellCountDisplay}N` : ""}
              </div>
            </div>
            <div className="rounded-2xl bg-white px-6 py-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-600 uppercase">P&L</div>
              <div className={`mt-2 text-3xl font-bold ${headlinePnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatCurrency(headlinePnl)}
              </div>
              {excludeNeutral && (
                <div className="mt-1 text-[11px] text-amber-700">excl. neutral</div>
              )}
            </div>
            <div className="rounded-2xl bg-white px-6 py-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-600 uppercase">Max Drawdown</div>
              <div className="mt-2 text-3xl font-bold text-rose-600">
                {formatPercent(-Math.abs(backtest.maxDrawdown))}
              </div>
            </div>
          </div>

          {/* Neutral-trade audit (boss requirement). Lists ORPHAN_SELL rows
              (sells that had no matching open BUY — likely not actionable
              in real trading) and BREAKEVEN BUY positions (closed at exactly
              the entry price). The toggle lets the user reweigh win-rate and
              P&L without these unactionable trades. */}
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">⚠️ Neutral Trade Audit</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Confirms when buy/sell happened for trades the engine resolved as neutral
                  (orphan SELLs and breakeven BUY positions).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeNeutral}
                    onChange={(e) => setExcludeNeutral(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  Exclude neutral trades
                </label>
                <button
                  type="button"
                  onClick={() => setShowNeutralPanel((v) => !v)}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  {showNeutralPanel ? "Hide" : "Show"} details
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl border border-gray-200 px-3 py-2">
                <div className="text-[11px] uppercase text-gray-500">Total neutral</div>
                <div className="text-xl font-semibold text-gray-900">{neutralEntries.length}</div>
              </div>
              <div className="rounded-xl border border-gray-200 px-3 py-2">
                <div className="text-[11px] uppercase text-gray-500">Orphan SELLs</div>
                <div className="text-xl font-semibold text-amber-700">{neutralOrphanSells.length}</div>
              </div>
              <div className="rounded-xl border border-gray-200 px-3 py-2">
                <div className="text-[11px] uppercase text-gray-500">Breakeven BUYs</div>
                <div className="text-xl font-semibold text-amber-700">{neutralBreakevens.length}</div>
              </div>
              <div className="rounded-xl border border-gray-200 px-3 py-2">
                <div className="text-[11px] uppercase text-gray-500">Orphan SELL proceeds</div>
                <div className="text-xl font-semibold text-gray-900">{formatCurrency(neutralOrphanProfit)}</div>
              </div>
            </div>

            {excludeNeutral && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                With neutral trades excluded: <span className="font-semibold">{filteredBuyTrades.length}</span> BUY positions
                · <span className="font-semibold">{filteredWins}W / {filteredLosses}L</span>
                · win rate <span className="font-semibold">{formatPercent(excludedWinRate)}</span>
                · realized P&L <span className="font-semibold">{formatCurrency(excludedNetPnl)}</span>
              </div>
            )}

            {neutralLoading && (
              <div className="text-sm text-gray-500">Loading neutral-trade log…</div>
            )}
            {neutralError && (
              <div className="text-sm text-rose-600">Failed to load: {neutralError}</div>
            )}
            {!neutralLoading && !neutralError && neutralEntries.length === 0 && (
              <div className="text-sm text-emerald-700">✓ No neutral trades logged for this backtest.</div>
            )}

            {showNeutralPanel && neutralEntries.length > 0 && (
              <div className="space-y-4">
                {Object.keys(neutralReasonCounts).length > 0 && (
                  <div className="rounded-xl border border-gray-200 px-3 py-2">
                    <div className="text-[11px] uppercase text-gray-500 mb-2">Top reasons</div>
                    <ul className="space-y-1 text-xs text-gray-700">
                      {Object.entries(neutralReasonCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([reason, count]) => (
                          <li key={reason} className="flex justify-between gap-2">
                            <span className="truncate" title={reason}>{reason}</span>
                            <span className="font-semibold text-gray-900">{count}×</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Market</th>
                        <th className="px-3 py-2 text-left">BUY time</th>
                        <th className="px-3 py-2 text-left">SELL / exit time</th>
                        <th className="px-3 py-2 text-left">Holding</th>
                        <th className="px-3 py-2 text-left">Signal</th>
                        <th className="px-3 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {neutralEntries.slice(0, 50).map((e, i) => {
                        const isOrphan = e.category === "ORPHAN_SELL"
                        const buyTime = isOrphan
                          ? (e.matchedBuys?.[0]?.time || null)
                          : (e.buyTime || null)
                        const exitTime = isOrphan
                          ? e.sellTime
                          : (e.firstExitTime || e.lastExitTime || null)
                        const holdingMs = isOrphan
                          ? (buyTime && exitTime ? new Date(exitTime).getTime() - new Date(buyTime).getTime() : null)
                          : (Number.isFinite(e.holdingMsToFirstExit) ? e.holdingMsToFirstExit : null)
                        const holdingLabel = (() => {
                          if (holdingMs == null) return "—"
                          if (holdingMs < 1000) return "<1s"
                          if (holdingMs < 60000) return `${Math.round(holdingMs / 1000)}s`
                          if (holdingMs < 3600000) return `${Math.round(holdingMs / 60000)}m`
                          if (holdingMs < 86400000) return `${(holdingMs / 3600000).toFixed(1)}h`
                          return `${(holdingMs / 86400000).toFixed(1)}d`
                        })()
                        const signal = isOrphan ? e.sellSignal : (e.exits?.[0]?.signal || e.buySignal)
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${isOrphan ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                                {isOrphan ? "ORPHAN SELL" : "BREAKEVEN"}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] text-gray-600 truncate max-w-[140px]" title={e.marketId}>
                              {e.marketId}
                            </td>
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatTradeTime(buyTime)}</td>
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{formatTradeTime(exitTime)}</td>
                            <td className="px-3 py-2 text-gray-700">{holdingLabel}</td>
                            <td className="px-3 py-2 text-gray-600 truncate max-w-[160px]" title={signal || ""}>{signal || "—"}</td>
                            <td className="px-3 py-2 text-gray-600 truncate max-w-[200px]" title={e.reason || ""}>{e.reason || "—"}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {neutralEntries.length > 50 && (
                    <div className="bg-gray-50 px-3 py-2 text-[11px] text-gray-500 text-center">
                      Showing first 50 of {neutralEntries.length} entries.
                    </div>
                  )}
                </div>

                {Object.keys(neutralStrategyCounts).length > 0 && (
                  <div className="rounded-xl border border-gray-200 px-3 py-2">
                    <div className="text-[11px] uppercase text-gray-500 mb-2">By type · strategy</div>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700">
                      {Object.entries(neutralStrategyCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([key, count]) => (
                          <li key={key} className="flex justify-between gap-2">
                            <span className="truncate" title={key}>{key}</span>
                            <span className="font-semibold text-gray-900">{count}×</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Price Chart */}
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-slate-900 text-white shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
                {/* Left: market thumbnail (no text overlay) */}
                <div className="relative h-44 md:h-auto md:min-h-[220px] bg-slate-950">
                  <img
                    src={chartImage}
                    alt={selectedMarket?.question || backtest.groupName || "Backtest market"}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-slate-900/60" />
                </div>

                {/* Right: clean text panel */}
                <div className="flex flex-col gap-3 p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/60">
                    <span>Polymarket</span>
                    <span>•</span>
                    <span>{marketStatus}</span>
                    {selectedMarket?.endDate ? (
                      <>
                        <span>•</span>
                        <span>Ends {new Date(selectedMarket.endDate).toLocaleDateString()}</span>
                      </>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${selectedMarketMeta.categoryColor}`}>
                      {selectedMarketMeta.categoryLabel}
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/85">
                      Market ID: {selectedMarket?.marketId || "N/A"}
                    </span>
                  </div>

                  <h2 className="text-xl md:text-2xl font-bold leading-snug">
                    {chartTitle}
                  </h2>

                  {chartSubtitle && (
                    <p className="text-sm leading-relaxed text-white/75 line-clamp-4">
                      {chartSubtitle}
                    </p>
                  )}

                  {selectedMarket && (
                    <div className="pt-1">
                      <a
                        href={getPolymarketEventUrl(selectedMarket)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                      >
                        View on Polymarket
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4m-4-6l6 6m0 0l-6 6m6-6H3" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {markets.length > 1 && (
                <div className="border-t border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-white/60">Market focus</div>
                      <div className="mt-1 text-sm text-white/80">
                        Choose a market to inspect its price action and trade markers.
                      </div>
                    </div>

                    <div className="min-w-[280px] flex-1 max-w-md space-y-3">
                      <label className="block">
                        <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-white/60">
                          Selected market
                        </span>
                        <select
                          value={selectedMarketId}
                          onChange={(event) => setSelectedMarketId(event.target.value)}
                          className="w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/30"
                        >
                          {markets.map((market) => (
                            <option key={market.marketId} value={String(market.marketId)}>
                              {getPolymarketMarketMeta(market, `Market ${market.marketId}`).displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <h2 className="text-xl font-semibold text-gray-900 mb-4">Market Price & Trade Markers</h2>
            <BacktestChart trades={sortedTrades} priceSeries={selectedPriceSeries} />
          </div>

          {/* Equity / cumulative P&L curve — driven from the trade rows the
              report already returns. Shows running peak + drawdown shading
              so users can eyeball strategy stability over time. */}
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Equity Curve</h2>
                <p className="text-xs text-gray-500 mt-1">
                  Cumulative realized P&L across every closed trade in this backtest.
                </p>
              </div>
              <div className="text-xs text-gray-500">
                Start ${Number(backtest?.initialCapital || 0).toLocaleString("en-US")} →
                End ${Number((backtest?.initialCapital || 0) + advancedMetrics.netProfit).toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </div>
            </div>
            <EquityCurveChart trades={trades} initialCapital={backtest?.initialCapital} />
          </div>

          {/* Advanced risk + position-quality metrics, computed client-side from
              the trade rows so no backend change is required. */}
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold text-gray-900">Advanced Metrics</h2>
              <span className="text-[11px] uppercase tracking-wide text-gray-500">
                Derived from trade rows
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-[11px] uppercase text-gray-500">Sharpe Ratio</div>
                <div className={`mt-1 text-2xl font-semibold ${advancedMetrics.sharpeRatio >= 1 ? "text-emerald-600" : advancedMetrics.sharpeRatio >= 0 ? "text-amber-600" : "text-rose-600"}`}>
                  {formatRatio(advancedMetrics.sharpeRatio)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Annualized · risk-adjusted return</div>
              </div>
              <div className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-[11px] uppercase text-gray-500">Sortino Ratio</div>
                <div className={`mt-1 text-2xl font-semibold ${advancedMetrics.sortinoRatio >= 1 ? "text-emerald-600" : advancedMetrics.sortinoRatio >= 0 ? "text-amber-600" : "text-rose-600"}`}>
                  {formatRatio(advancedMetrics.sortinoRatio)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Only downside volatility penalised</div>
              </div>
              <div className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-[11px] uppercase text-gray-500">Profit Factor</div>
                <div className={`mt-1 text-2xl font-semibold ${advancedMetrics.profitFactor >= 1.5 ? "text-emerald-600" : advancedMetrics.profitFactor >= 1 ? "text-amber-600" : "text-rose-600"}`}>
                  {formatRatio(advancedMetrics.profitFactor)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Gross win $ ÷ gross loss $</div>
              </div>
              <div className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-[11px] uppercase text-gray-500">Expectancy</div>
                <div className={`mt-1 text-2xl font-semibold ${advancedMetrics.expectancy >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {advancedMetrics.expectancy >= 0 ? "+" : ""}{formatCurrency(advancedMetrics.expectancy)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Expected $ per closed trade</div>
              </div>
              <div className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-[11px] uppercase text-gray-500">Avg Win / Avg Loss</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatRatio(advancedMetrics.winLossRatio)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  +{formatCurrency(advancedMetrics.avgWin)} / −{formatCurrency(advancedMetrics.avgLoss)}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-[11px] uppercase text-gray-500">Max Drawdown ($)</div>
                <div className="mt-1 text-2xl font-semibold text-rose-600">
                  −{formatCurrency(advancedMetrics.maxDrawdownAmount)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  {formatPercent(advancedMetrics.maxDrawdownPct)} from peak
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-[11px] uppercase text-gray-500">Longest Drawdown</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatDuration(advancedMetrics.longestDrawdownMs)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Time spent below prior peak</div>
              </div>
              <div className="rounded-xl border border-gray-200 px-4 py-3">
                <div className="text-[11px] uppercase text-gray-500">Avg Holding Time</div>
                <div className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatDuration(advancedMetrics.avgHoldingMs)}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">BUY → matching SELL</div>
              </div>
            </div>
          </div>

          {/* Trade Summary — always tallied across ALL markets (boss requirement). When the
              backtest spans multiple markets the panel still totals every row instead of just
              the selected one in the chart above. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
              <div className="mb-4 flex items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold text-gray-900">Trade Summary</h3>
                <span className="text-[11px] uppercase tracking-wide text-gray-500">
                  All markets
                </span>
                {/*
                  Trade Summary 字段与后端 summary 完全一致（全部市场聚合）：
                  - buyCount  : 全部市场买入次数 (e.g. 42B)
                  - sellCount : 全部市场卖出次数 (e.g. 19S)
                  - winningCount / losingCount / breakevenCount: 全部市场每个 BUY 仓位最终判定
                  P/L 数字来自 overallPnlAttribution（全部市场的 SELL profit 累加）。
                */}
              </div>
              <div className="space-y-3">
                {/* All-markets row tally — always shown so single-market and multi-market
                    backtests look consistent. Source: summary.buyCount + summary.sellCount. */}
                <div className="flex justify-between border-t border-gray-200 pt-3 text-xs">
                  <span className="text-gray-500">Trade rows</span>
                  <span className="font-medium text-gray-700">
                    {tradeRowsTotal} ({buyCountDisplay}B / {sellCountDisplay}S · {summary?.winningCount ?? backtest.winningTrades}W / {summary?.losingCount ?? backtest.losingTrades}L{(summary?.breakevenCount ?? overallBreakeven) > 0 ? ` / ${summary?.breakevenCount ?? overallBreakeven}BE` : ""})
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="text-gray-600">Gains from winners</span>
                  <span className="font-semibold text-emerald-600">+{formatCurrency(overallPnlAttribution.grossGain)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Losses from losers</span>
                  <span className="font-semibold text-rose-600">{formatCurrency(overallPnlAttribution.grossLoss)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                  <span className="text-gray-700 font-medium">= Net realized</span>
                  <span className={`font-semibold ${overallPnlAttribution.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {overallPnlAttribution.netProfit >= 0 ? "+" : ""}{formatCurrency(overallPnlAttribution.netProfit)}
                  </span>
                </div>
                {overallPnlAttribution.biggestWin && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-600 truncate">Biggest winner</span>
                    <span className="font-semibold text-emerald-600 text-right truncate" title={overallPnlAttribution.biggestWin.marketName}>
                      +{formatCurrency(overallPnlAttribution.biggestWin.profit)}
                    </span>
                  </div>
                )}
                {overallPnlAttribution.biggestLoss && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-600 truncate">Biggest loser</span>
                    <span className="font-semibold text-rose-600 text-right truncate" title={overallPnlAttribution.biggestLoss.marketName}>
                      {formatCurrency(overallPnlAttribution.biggestLoss.profit)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Capital Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Initial Capital</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(backtest.initialCapital)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Final Value</span>
                  <span className={`font-semibold ${backtest.finalValue >= backtest.initialCapital ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatCurrency(backtest.finalValue)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="text-gray-600">Profit/Loss</span>
                  <span className={`font-semibold ${backtest.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatCurrency(backtest.pnl)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Return on Investment</span>
                  <span className={`font-semibold ${roiColor(backtest.roi)}`}>
                    {formatPercent(backtest.roi)}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">P/L attribution (all markets)</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">+ Gains</span>
                    <span className="font-semibold text-emerald-600">+{formatCurrency(overallPnlAttribution.grossGain)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">− Losses</span>
                    <span className="font-semibold text-rose-600">{formatCurrency(overallPnlAttribution.grossLoss)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-2 mt-2">
                    <span className="text-gray-700 font-medium">= Net realized</span>
                    <span className={`font-semibold ${overallPnlAttribution.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {overallPnlAttribution.netProfit >= 0 ? "+" : ""}{formatCurrency(overallPnlAttribution.netProfit)}
                    </span>
                  </div>
                  {Math.abs(unrealizedResidual) >= 0.01 && (
                    <>
                      <div className="flex justify-between text-sm pt-1" title="Difference between book P/L and the sum of realized SELL profits — caused by residual open positions that auto-close skipped.">
                        <span className="text-gray-600">+ Unrealized / residual</span>
                        <span className={`font-semibold ${unrealizedResidual >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {unrealizedResidual >= 0 ? "+" : ""}{formatCurrency(unrealizedResidual)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t border-gray-100 pt-2 mt-1">
                        <span className="text-gray-700 font-medium">= Profit/Loss</span>
                        <span className={`font-semibold ${backtest.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {backtest.pnl >= 0 ? "+" : ""}{formatCurrency(backtest.pnl)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Trade History Table */}
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold text-gray-900">Trade History</h2>
            </div>
            <div className="overflow-x-auto mb-2 flex gap-2 items-center">
              <button
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${tradeFilter === "ALL" ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-white text-gray-700 border-gray-300"}`}
                onClick={() => setTradeFilter("ALL")}
              >All</button>
              <button
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${tradeFilter === "BUY" ? "bg-blue-100 text-blue-800 border-blue-300" : "bg-white text-gray-700 border-gray-300"}`}
                onClick={() => setTradeFilter("BUY")}
              >Buy</button>
              <button
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${tradeFilter === "SELL" ? "bg-green-100 text-green-800 border-green-300" : "bg-white text-gray-700 border-gray-300"}`}
                onClick={() => setTradeFilter("SELL")}
              >Sell</button>
            </div>
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-blue-50 to-green-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-bold text-blue-900">#</th>
                    <th className="px-6 py-3 text-left font-bold text-blue-900">Market</th>
                    <th className="px-6 py-3 text-left font-bold text-blue-900">Action</th>
                    <th className="px-6 py-3 text-left font-bold text-blue-900">Time</th>
                    <th className="px-6 py-3 text-left font-bold text-blue-900">Price</th>
                    <th className="px-6 py-3 text-left font-bold text-blue-900">Amount</th>
                    <th className="px-6 py-3 text-left font-bold text-blue-900">P/L</th>
                    <th className="px-6 py-3 text-left font-bold text-blue-900">Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // 根据 filter 过滤
                    const filtered = tradeFilter === 'ALL' ? sortedTrades : sortedTrades.filter(t => t.action === tradeFilter);
                    if (filtered.length === 0) {
                      return <tr><td colSpan="8" className="text-center text-gray-400 py-6">No trades found for this filter.</td></tr>;
                    }
                    return filtered.map((trade, idx) => (
                      <tr key={trade.index || idx} className="transition-all group hover:bg-blue-50/40 border-l-4 border-blue-200">
                        <td className="px-6 py-3 text-gray-900 font-bold">#{idx + 1}</td>
                        <td className="px-6 py-3">
                          <div className="font-medium text-gray-900 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#3b82f6' }}></span>
                            {getPolymarketMarketMeta({ question: trade.marketQuestion, title: trade.marketTitle, category: trade.marketCategory, image: trade.marketImage, imageUrl: trade.marketImage, icon: trade.marketIcon }, `Market ${trade.marketId}`).displayName}
                          </div>
                          <div className="text-xs text-gray-500">ID {trade.marketId}</div>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${trade.action === 'BUY' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{trade.action}</span>
                            {trade.action === 'BUY' && trade.positionOutcome && (
                              <span
                                title={`Position ${trade.positionStatus || ''} · avg exit ${trade.positionAvgExitPrice != null ? '$' + Number(trade.positionAvgExitPrice).toFixed(4) : 'n/a'}`}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  trade.positionOutcome === 'WIN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  trade.positionOutcome === 'LOSS' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                  'bg-gray-100 text-gray-600 border-gray-200'
                                }`}
                              >
                                {trade.positionOutcome === 'WIN' ? 'W' : trade.positionOutcome === 'LOSS' ? 'L' : 'BE'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-gray-600 text-xs">{formatTradeTime(trade.time)}</td>
                        <td className="px-6 py-3 text-gray-900 font-bold">{trade.price !== undefined ? `$${Number(trade.price).toFixed(4)}` : '-'}</td>
                        <td className="px-6 py-3 text-gray-600 font-semibold">{trade.amount !== undefined ? `$${Number(trade.amount).toFixed(2)}` : '-'}</td>
                        <td className="px-6 py-3">
                          {trade.profit !== null && trade.profit !== undefined ? (
                            <span className={`font-bold ${trade.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {trade.profit >= 0 ? "+" : ""}{formatCurrency(trade.profit)}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-xs">
                          <span className="inline-block rounded px-2 py-1 font-semibold" style={{ background: '#f1f5f9', color: '#334155' }}>{trade.signal || '-'}</span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
      </main>
    </div>
  )
}


//ok