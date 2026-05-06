import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import BacktestChart from "../components/BacktestChart"
import { getPolymarketEventUrl, getPolymarketMarketMeta } from "../utils/polymarketMarketMeta"

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

  // Aggregate gross gains vs gross losses across every SELL trade so the summary panels
  // can show *where* the net P/L is coming from (winners vs losers, biggest contributors).
  const pnlAttribution = (() => {
    const all = Array.isArray(trades) ? trades : []
    let grossGain = 0
    let grossLoss = 0
    let biggestWin = null   // { profit, marketName, marketId }
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
  })()
  const selectedMarket = markets.find((market) => String(market.marketId) === String(selectedMarketId)) || null
  const marketCard = selectedMarket || markets[0] || null
  const selectedTrades = (trades || []).filter((trade) => String(trade.marketId) === String(selectedMarketId))
  const sortedTrades = [...selectedTrades].sort((left, right) => new Date(left.time) - new Date(right.time))

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
            <button
              onClick={() => navigate("/polymarket/backtest")}
              className="mb-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              ← Back to Results
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{backtest.strategyName} Strategy</h1>
            <p className="mt-1 text-gray-600">
              {backtest.marketQuestion
                ? backtest.marketQuestion
                : `${backtest.groupName} Group`}
              {" • "}{backtest.totalTrades} trades
            </p>
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
              <div className={`mt-2 text-3xl font-bold ${winRateColor(backtest.winRate)}`}>
                {formatPercent(backtest.winRate)}
              </div>
            </div>
            <div className="rounded-2xl bg-white px-6 py-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-600 uppercase">Total Trades</div>
              <div className="mt-2 text-3xl font-bold text-gray-900">{backtest.totalTrades}</div>
              <div className="mt-1 text-xs text-gray-600">{backtest.winningTrades}W / {backtest.losingTrades}L</div>
            </div>
            <div className="rounded-2xl bg-white px-6 py-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-600 uppercase">P&L</div>
              <div className={`mt-2 text-3xl font-bold ${backtest.pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatCurrency(backtest.pnl)}
              </div>
            </div>
            <div className="rounded-2xl bg-white px-6 py-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-600 uppercase">Max Drawdown</div>
              <div className="mt-2 text-3xl font-bold text-rose-600">
                {formatPercent(-Math.abs(backtest.maxDrawdown))}
              </div>
            </div>
          </div>

          {/* Price Chart */}
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-slate-900 text-white shadow-sm">
              <div className="relative h-52">
                <img
                  src={chartImage}
                  alt={selectedMarket?.question || backtest.groupName || "Backtest market"}
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/50 to-transparent" />
                <div className="relative flex h-full items-end p-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/70">
                      <span>Polymarket</span>
                      <span>•</span>
                      <span>{marketStatus}</span>
                      {selectedMarket?.endDate ? (
                        <>
                          <span>•</span>
                          <span>{new Date(selectedMarket.endDate).toLocaleDateString()}</span>
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
                    <h2 className="text-2xl font-bold leading-tight">
                      {chartTitle}
                    </h2>
                    <p className="text-sm text-white/80">
                      {chartSubtitle}
                    </p>
                    <div className="pt-1">
                      {selectedMarket && (
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
                      )}
                    </div>
                  </div>
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

          {/* Trade Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Trade Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Trades</span>
                  <span className="font-semibold text-gray-900">{backtest.totalTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Buy Signals</span>
                  <span className="font-semibold text-gray-900">{summary.buyCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sell Signals</span>
                  <span className="font-semibold text-gray-900">{summary.sellCount}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="text-gray-600">Winning Trades</span>
                  <span className="font-semibold text-emerald-600">{backtest.winningTrades}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Losing Trades</span>
                  <span className="font-semibold text-rose-600">{backtest.losingTrades}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-3">
                  <span className="text-gray-600">Gains from winners</span>
                  <span className="font-semibold text-emerald-600">+{formatCurrency(pnlAttribution.grossGain)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Losses from losers</span>
                  <span className="font-semibold text-rose-600">{formatCurrency(pnlAttribution.grossLoss)}</span>
                </div>
                {pnlAttribution.biggestWin && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-600 truncate">Biggest winner</span>
                    <span className="font-semibold text-emerald-600 text-right truncate" title={pnlAttribution.biggestWin.marketName}>
                      +{formatCurrency(pnlAttribution.biggestWin.profit)}
                    </span>
                  </div>
                )}
                {pnlAttribution.biggestLoss && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-600 truncate">Biggest loser</span>
                    <span className="font-semibold text-rose-600 text-right truncate" title={pnlAttribution.biggestLoss.marketName}>
                      {formatCurrency(pnlAttribution.biggestLoss.profit)}
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
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">P/L attribution</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">+ Gains</span>
                    <span className="font-semibold text-emerald-600">+{formatCurrency(pnlAttribution.grossGain)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">− Losses</span>
                    <span className="font-semibold text-rose-600">{formatCurrency(pnlAttribution.grossLoss)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-100 pt-2 mt-2">
                    <span className="text-gray-700 font-medium">= Net realized</span>
                    <span className={`font-semibold ${pnlAttribution.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {pnlAttribution.netProfit >= 0 ? "+" : ""}{formatCurrency(pnlAttribution.netProfit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trade History Table */}
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Trade History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Trade</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Market</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Action</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Time</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Price</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Amount</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Profit/Loss</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sortedTrades.map((trade, idx) => {
                    const buyInfo = tradeLinkage.buyMeta.get(idx)
                    const sellInfo = tradeLinkage.sellMeta.get(idx)
                    const isBuy = trade.action === "BUY"
                    const isSell = trade.action === "SELL"
                    return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-900 font-medium">#{idx + 1}</td>
                      <td className="px-6 py-3">
                        <div className="font-medium text-gray-900">
                          {getPolymarketMarketMeta({ question: trade.marketQuestion, title: trade.marketTitle, category: trade.marketCategory, image: trade.marketImage, imageUrl: trade.marketImage, icon: trade.marketIcon }, `Market ${trade.marketId}`).displayName}
                        </div>
                        <div className="text-xs text-gray-500">ID {trade.marketId}</div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          trade.action === "BUY"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}>
                          {trade.action}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-600 text-xs">
                        <div>{formatTradeTime(trade.time)}</div>
                        {isBuy && buyInfo && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-300">
                            <span>↳ Sold</span>
                            <span>{formatTradeTime(buyInfo.closedBySellTime)}</span>
                            <span>@ ${buyInfo.closedBySellPrice.toFixed(4)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-900 font-medium">${trade.price.toFixed(4)}</td>
                      <td className="px-6 py-3 text-gray-600">${trade.amount.toFixed(2)}</td>
                      <td className="px-6 py-3">
                        {isBuy && buyInfo ? (
                          <div className="flex flex-col">
                            <span className={`font-semibold ${buyInfo.realizedProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {buyInfo.realizedProfit >= 0 ? "+" : ""}{formatCurrency(buyInfo.realizedProfit)}
                            </span>
                            <span className="mt-0.5 text-[11px] font-medium text-indigo-700">Closed by trade #{buyInfo.closedBySellRow}</span>
                          </div>
                        ) : isBuy ? (
                          <span className="text-xs font-medium text-amber-700">Open (not yet sold)</span>
                        ) : trade.profit !== null && trade.profit !== undefined ? (
                          <div className="flex flex-col">
                            <span className={`font-semibold ${trade.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                              {trade.profit >= 0 ? "+" : ""}{formatCurrency(trade.profit)}
                            </span>
                            {isSell && sellInfo && sellInfo.closedBuyRows.length > 0 && (
                              <span className="mt-0.5 text-[11px] font-medium text-indigo-700">
                                Closes {sellInfo.closedBuyRows.map((n) => `#${n}`).join(", ")}
                                {sellInfo.avgEntryPrice > 0 && ` · avg entry $${sellInfo.avgEntryPrice.toFixed(4)}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-600 text-xs">{trade.signal}</td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
