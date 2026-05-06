import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import { getPolymarketMarketMeta } from "../utils/polymarketMarketMeta"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000"

const formatCurrency = (value) =>
  `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function BacktestPnlBreakdown() {
  const { backtestId } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [report, setReport] = useState(null)

  useEffect(() => {
    const loadReport = async () => {
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

    if (backtestId) loadReport()
  }, [backtestId])

  if (loading) {
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
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-slate-100">
        <Sidebar />
        <main className="ml-64 flex-1 px-8 py-8">
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-3 text-red-700">
              {error}
            </div>
            <button
              onClick={() => navigate(`/polymarket/backtest/${backtestId}`)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to Backtest Report
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!report) {
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
  }

  const { backtest } = report
  const trades = Array.isArray(report.trades) ? report.trades : []
  const markets = Array.isArray(report.markets) ? report.markets : []

  // Aggregate realized P/L per market across the entire backtest
  const byMarket = new Map()
  trades.forEach((trade) => {
    const id = String(trade.marketId || "")
    if (!id) return
    const entry = byMarket.get(id) || { profit: 0, sellCount: 0, buyCount: 0 }
    if (trade.action === "BUY") entry.buyCount += 1
    if (trade.action === "SELL") {
      entry.sellCount += 1
      if (typeof trade.profit === "number" && Number.isFinite(trade.profit)) {
        entry.profit += trade.profit
      }
    }
    byMarket.set(id, entry)
  })

  const rows = Array.from(byMarket.entries()).map(([marketId, info]) => {
    const market = markets.find((m) => String(m.marketId) === marketId)
    const displayName = market
      ? getPolymarketMarketMeta(market, `Market ${marketId}`).displayName
      : `Market ${marketId}`
    return { marketId, displayName, ...info }
  })
  rows.sort((a, b) => b.profit - a.profit)
  const totalProfit = rows.reduce((sum, r) => sum + r.profit, 0)

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <main className="ml-64 flex-1 px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => navigate(`/polymarket/backtest/${backtestId}`)}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to Backtest Report
            </button>
            <h1 className="mt-2 text-2xl font-bold text-gray-900">
              Profit/Loss Breakdown by Market
            </h1>
            <p className="text-sm text-gray-500">
              Backtest #{backtest?.id} · {backtest?.strategyName} · {backtest?.group?.name || "Unknown group"}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-3xl bg-white px-6 py-12 text-center text-gray-500 shadow-sm">
            No realized P/L recorded for any market in this backtest.
          </div>
        ) : (
          <div className="rounded-3xl bg-white px-6 py-6 shadow-sm">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {rows.length} market{rows.length === 1 ? "" : "s"}
              </h2>
              <span className="text-sm text-gray-500">
                Total realized:{" "}
                <span className={`font-semibold ${totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {totalProfit >= 0 ? "+" : ""}{formatCurrency(totalProfit)}
                </span>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Market</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">Buys</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">Sells</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">Realized P/L</th>
                    <th className="px-6 py-3 text-right font-semibold text-gray-900">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {rows.map((row) => {
                    const share = totalProfit !== 0 ? (row.profit / totalProfit) * 100 : 0
                    return (
                      <tr key={row.marketId} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          <div className="font-medium text-gray-900">{row.displayName}</div>
                          <div className="text-xs text-gray-500">ID {row.marketId}</div>
                        </td>
                        <td className="px-6 py-3 text-right text-gray-700">{row.buyCount}</td>
                        <td className="px-6 py-3 text-right text-gray-700">{row.sellCount}</td>
                        <td className={`px-6 py-3 text-right font-semibold ${row.profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          {row.profit >= 0 ? "+" : ""}{formatCurrency(row.profit)}
                        </td>
                        <td className={`px-6 py-3 text-right text-xs font-medium ${row.profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {share >= 0 ? "+" : ""}{share.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
