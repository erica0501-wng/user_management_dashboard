import { useState, useEffect } from "react"
import { getPolymarketPositions, closePolymarketPosition } from "../services/portfolio"

export default function PolymarketPositions({ onPositionClosed }) {
  const [positions, setPositions] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [closingPosition, setClosingPosition] = useState(null)
  const [filter, setFilter] = useState("all") // all, open, closed

  useEffect(() => {
    fetchPositions()
  }, [])

  const fetchPositions = async () => {
    try {
      setLoading(true)
      const data = await getPolymarketPositions()
      setPositions(data.positions || [])
      setStats(data.stats || {})
      setError(null)
    } catch (err) {
      console.error("Error fetching positions:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClosePosition = async (positionId, currentPrice) => {
    if (!window.confirm("Are you sure you want to close this position?")) {
      return
    }

    try {
      setClosingPosition(positionId)
      const result = await closePolymarketPosition(positionId, currentPrice)
      alert(result.message)
      fetchPositions() // Refresh positions
      
      // Notify parent component to refresh balance
      if (onPositionClosed) {
        onPositionClosed()
      }
    } catch (err) {
      alert(`Failed to close position: ${err.message}`)
    } finally {
      setClosingPosition(null)
    }
  }

  const filteredPositions = positions.filter(p => {
    if (filter === "open") return p.status === "Open"
    if (filter === "closed") return p.status === "Closed"
    return true
  })

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  const calculatePnL = (position) => {
    if (position.status === "Closed" || !position.currentPrice) {
      return null
    }
    const currentValue = position.shares * position.currentPrice
    let pnl = currentValue - position.totalCost
    let pnlPercent = (pnl / position.totalCost) * 100
    
    // Fix floating point precision issue: treat very small values as zero
    if (Math.abs(pnl) < 0.005) { // Less than half a cent
      pnl = 0
      pnlPercent = 0
    }
    
    return { pnl, pnlPercent }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        <p className="font-medium">Error loading positions</p>
        <p className="text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Positions</div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalPositions || 0}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total Invested</div>
            <div className="text-2xl font-bold text-gray-900">${stats.totalInvested?.toFixed(2) || "0.00"}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Current Value</div>
            <div className="text-2xl font-bold text-gray-900">${stats.currentValue?.toFixed(2) || "0.00"}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="text-sm text-gray-600 mb-1">Total P&L</div>
            <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${stats.totalPnL?.toFixed(2) || "0.00"}
              {stats.totalPnLPercent !== undefined && (
                <span className="text-sm ml-2">({stats.totalPnLPercent.toFixed(2)}%)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { id: "all", label: "All Positions" },
          { id: "open", label: "Open" },
          { id: "closed", label: "Closed" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === tab.id
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Positions List */}
      {filteredPositions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg">No positions found</p>
          <p className="text-gray-400 text-sm mt-2">
            Start trading on Polymarket to see your positions here
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Market
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Shares
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Cost
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Current
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      P&L
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPositions.map((position) => {
                    const pnlData = calculatePnL(position)
                    
                    return (
                      <tr key={position.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-gray-900 max-w-md">
                            {position.question}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {position.outcome}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(position.createdAt)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="text-sm text-gray-900">{position.shares.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">@${position.avgPrice.toFixed(3)}</div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="text-sm font-medium text-gray-900">${position.totalCost.toFixed(2)}</div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="text-sm text-gray-900">
                            {position.currentPrice ? `$${position.currentPrice.toFixed(3)}` : "-"}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {pnlData ? (
                            <div>
                              <div className={`text-sm font-medium ${
                                pnlData.pnl === 0 ? 'text-gray-600' : 
                                pnlData.pnl > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                ${pnlData.pnl.toFixed(2)}
                              </div>
                              <div className={`text-xs ${
                                pnlData.pnl === 0 ? 'text-gray-600' : 
                                pnlData.pnl > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                ({pnlData.pnl > 0 ? '+' : ''}{pnlData.pnlPercent.toFixed(1)}%)
                              </div>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {position.status === "Open" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></span>
                              Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Closed
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {position.status === "Open" && (
                            <button
                              onClick={() => handleClosePosition(position.id, position.currentPrice || position.avgPrice)}
                              disabled={closingPosition === position.id}
                              className="text-sm text-red-600 hover:text-red-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                              {closingPosition === position.id ? "Closing..." : "Close"}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View - Shown on mobile and tablet */}
          <div className="lg:hidden space-y-4">
            {filteredPositions.map((position) => {
              const pnlData = calculatePnL(position)
              
              return (
                <div key={position.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900 mb-2">
                        {position.question}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {position.outcome}
                        </span>
                        {position.status === "Open" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1"></span>
                            Open
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Closed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Shares</div>
                      <div className="text-sm font-medium text-gray-900">
                        {position.shares.toFixed(2)}
                        <span className="text-xs text-gray-500 ml-1">@${position.avgPrice.toFixed(3)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Total Cost</div>
                      <div className="text-sm font-medium text-gray-900">${position.totalCost.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Current Price</div>
                      <div className="text-sm font-medium text-gray-900">
                        {position.currentPrice ? `$${position.currentPrice.toFixed(3)}` : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">P&L</div>
                      {pnlData ? (
                        <div>
                          <div className={`text-sm font-medium ${
                            pnlData.pnl === 0 ? 'text-gray-600' : 
                            pnlData.pnl > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${pnlData.pnl.toFixed(2)}
                          </div>
                          <div className={`text-xs ${
                            pnlData.pnl === 0 ? 'text-gray-600' : 
                            pnlData.pnl > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ({pnlData.pnl > 0 ? '+' : ''}{pnlData.pnlPercent.toFixed(1)}%)
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500">{formatDate(position.createdAt)}</div>
                    {position.status === "Open" && (
                      <button
                        onClick={() => handleClosePosition(position.id, position.currentPrice || position.avgPrice)}
                        disabled={closingPosition === position.id}
                        className="px-3 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {closingPosition === position.id ? "Closing..." : "Close Position"}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
