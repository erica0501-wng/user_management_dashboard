import { useState, useEffect } from "react"
import { getOrders } from "../services/portfolio"

export default function TradeHistory() {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("all") // all, buy, sell
  const [symbolFilter, setSymbolFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  useEffect(() => {
    fetchTrades()
  }, [])

  const fetchTrades = async () => {
    try {
      setLoading(true)
      setError("")
      const data = await getOrders({ status: "Filled" })
      
      // Only show filled orders (completed trades)
      const filledTrades = data.orders || []
      setTrades(filledTrades)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics
  const stats = {
    totalTrades: trades.length,
    totalBuys: trades.filter(t => t.direction === "Buy").length,
    totalSells: trades.filter(t => t.direction === "Sell").length,
    totalInvested: trades
      .filter(t => t.direction === "Buy")
      .reduce((sum, t) => sum + (Number(t.price) * Number(t.quantity)), 0),
    totalReturns: trades
      .filter(t => t.direction === "Sell")
      .reduce((sum, t) => sum + (Number(t.price) * Number(t.quantity)), 0),
    netProfitLoss: 0
  }

  // Calculate net P&L (simplified - matches buy/sell pairs)
  stats.netProfitLoss = stats.totalReturns - stats.totalInvested

  // Filter trades
  const filteredTrades = trades.filter(trade => {
    // Direction filter
    if (filter === "buy" && trade.direction !== "Buy") return false
    if (filter === "sell" && trade.direction !== "Sell") return false

    // Symbol filter
    if (symbolFilter && !trade.symbol.toLowerCase().includes(symbolFilter.toLowerCase())) {
      return false
    }

    // Date filter
    if (startDate) {
      const tradeDate = new Date(trade.createdAt)
      const filterDate = new Date(startDate)
      if (tradeDate < filterDate) return false
    }

    if (endDate) {
      const tradeDate = new Date(trade.createdAt)
      const filterDate = new Date(endDate)
      if (tradeDate > filterDate) return false
    }

    return true
  })

  // Group trades by symbol for summary
  const tradesBySymbol = filteredTrades.reduce((acc, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = { buys: [], sells: [] }
    }
    if (trade.direction === "Buy") {
      acc[trade.symbol].buys.push(trade)
    } else {
      acc[trade.symbol].sells.push(trade)
    }
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Total Trades</div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalTrades}</div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.totalBuys} Buys • {stats.totalSells} Sells
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Total Invested</div>
          <div className="text-2xl font-bold text-blue-600">
            ${stats.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">Buy orders</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Total Returns</div>
          <div className="text-2xl font-bold text-green-600">
            ${stats.totalReturns.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">Sell orders</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Net P&L</div>
          <div className={`text-2xl font-bold ${stats.netProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.netProfitLoss >= 0 ? '+' : ''}${stats.netProfitLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs mt-1 ${stats.netProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {stats.totalInvested > 0 ? `${((stats.netProfitLoss / stats.totalInvested) * 100).toFixed(2)}% return` : 'No data'}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-sm text-gray-600 mr-2">Type:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Trades</option>
              <option value="buy">Buy Only</option>
              <option value="sell">Sell Only</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-600 mr-2">Symbol:</label>
            <input
              type="text"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              placeholder="Search symbol..."
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          {(filter !== "all" || symbolFilter || startDate || endDate) && (
            <button
              onClick={() => {
                setFilter("all")
                setSymbolFilter("")
                setStartDate("")
                setEndDate("")
              }}
              className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Trade History Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredTrades.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg mb-2">No trades found</p>
            <p className="text-sm">Your completed trade history will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Date & Time</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Symbol</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Company</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Price</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Quantity</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Total Value</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Order Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTrades.map((trade) => {
                  const totalValue = Number(trade.price) * Number(trade.quantity)
                  return (
                    <tr key={trade.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(trade.createdAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                        <div className="text-xs text-gray-400">
                          {new Date(trade.createdAt).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          trade.direction === "Buy" 
                            ? "bg-green-100 text-green-700" 
                            : "bg-red-100 text-red-700"
                        }`}>
                          {trade.direction === "Buy" ? "↑" : "↓"} {trade.direction}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-blue-600">{trade.symbol}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {trade.name || trade.symbol}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm">
                        ${Number(trade.price).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-sm">
                        {Number(trade.quantity).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-sm">
                        <span className={trade.direction === "Buy" ? "text-red-600" : "text-green-600"}>
                          {trade.direction === "Buy" ? "-" : "+"}${totalValue.toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {trade.orderType || "LMT"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary by Symbol */}
      {Object.keys(tradesBySymbol).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary by Symbol</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(tradesBySymbol).map(([symbol, data]) => {
              const totalBought = data.buys.reduce((sum, t) => sum + (Number(t.price) * Number(t.quantity)), 0)
              const totalSold = data.sells.reduce((sum, t) => sum + (Number(t.price) * Number(t.quantity)), 0)
              const totalShares = data.buys.reduce((sum, t) => sum + Number(t.quantity), 0) - 
                                 data.sells.reduce((sum, t) => sum + Number(t.quantity), 0)
              const netPL = totalSold - totalBought

              return (
                <div key={symbol} className="border border-gray-200 rounded-lg p-3">
                  <div className="font-semibold text-blue-600 mb-2">{symbol}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Trades:</span>
                      <span className="font-medium">{data.buys.length + data.sells.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Shares:</span>
                      <span className="font-medium">{totalShares}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bought:</span>
                      <span className="text-red-600">${totalBought.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Sold:</span>
                      <span className="text-green-600">${totalSold.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-gray-200">
                      <span className="text-gray-600 font-medium">Net P&L:</span>
                      <span className={`font-semibold ${netPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {netPL >= 0 ? '+' : ''}${netPL.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
