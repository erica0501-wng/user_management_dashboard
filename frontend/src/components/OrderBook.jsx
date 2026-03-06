import { useState, useEffect } from "react"
import { BookOpen, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"

export default function OrderBook({ marketId, tokenId, outcome }) {
  const [orderBook, setOrderBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    fetchOrderBook()

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchOrderBook()
      }, 10000) // Refresh every 10 seconds

      return () => clearInterval(interval)
    }
  }, [tokenId, autoRefresh])

  const fetchOrderBook = async () => {
    try {
      setLoading(true)
      setError("")

      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"
      
      console.log(`📊 OrderBook Props - marketId: ${marketId}, tokenId: ${tokenId}, outcome: ${outcome}`)
      
      // Check if we have a valid tokenId
      if (!tokenId || tokenId === 'null' || tokenId === 'undefined') {
        console.warn(`⚠️ No valid tokenId provided for market ${marketId}`)
        throw new Error("No valid token ID available for this market")
      }
      
      // Use tokenId if provided, otherwise use a placeholder
      const id = tokenId
      
      console.log(`📊 Fetching order book for token: ${id}`)
      const response = await fetch(`${apiUrl}/polymarket/orderbook/${id}`)

      if (!response.ok) throw new Error("Failed to fetch order book")

      const data = await response.json()
      console.log(`📊 Order book response:`, data)
      console.log(`📊 Data source: ${data.source || 'unknown'}`)
      
      if (data.source === 'mock-data') {
        console.log(`📦 Using mock data. Reason: ${data.reason || 'Unknown'}`)
      }
      
      setOrderBook(data)
    } catch (err) {
      setError(err.message)
      console.error("❌ Error fetching order book:", err)
    } finally {
      setLoading(false)
    }
  }

  const formatVolume = (volume) => {
    if (!volume) return "0"
    const num = parseFloat(volume)
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toFixed(0)
  }

  const formatPrice = (price) => {
    return parseFloat(price).toFixed(2)
  }

  if (loading && !orderBook) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-600 text-sm text-center">{error}</div>
      </div>
    )
  }

  if (!orderBook) return null

  const { bids = [], asks = [], metrics = {}, source, note, reason } = orderBook

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <h3 className="text-xl font-semibold">Order Book</h3>
            {outcome && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                {outcome}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchOrderBook}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Market Metrics */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Spread</div>
            <div className="font-semibold">
              {metrics.spread?.toFixed(3) || "0.000"}
              <span className="text-xs text-gray-500 ml-1">
                ({metrics.spreadPercent?.toFixed(2) || "0.00"}%)
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Best Bid</div>
            <div className="font-semibold text-green-600">
              {metrics.bestBid?.toFixed(2) || "0.00"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Best Ask</div>
            <div className="font-semibold text-red-600">
              {metrics.bestAsk?.toFixed(2) || "0.00"}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Total Volume</div>
            <div className="font-semibold">
              {formatVolume(metrics.totalVolume)}
            </div>
          </div>
        </div>
      </div>

      {/* Order Book Table */}
      <div className="grid grid-cols-2 divide-x divide-gray-200 flex-1">
        {/* Bids (Buy Orders) */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold">Bids</h4>
            <span className="text-sm text-gray-500">
              ({formatVolume(metrics.bidVolume)})
            </span>
          </div>
          
          {/* Table Header */}
          <div className="grid grid-cols-3 gap-2 text-sm font-semibold text-gray-600 mb-3 px-2">
            <div>Price</div>
            <div className="text-right">Size</div>
            <div className="text-right">Total</div>
          </div>

          {/* Bid Rows */}
          <div className="space-y-1 max-h-[350px] overflow-y-auto pr-2">
            {bids.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-4">
                No bids
              </div>
            ) : (
              bids.map((bid, index) => (
                <div
                  key={index}
                  className="grid grid-cols-3 gap-2 px-3 py-2 hover:bg-green-50 rounded-lg transition"
                >
                  <div className="font-semibold text-green-600">
                    {formatPrice(bid.price)}
                  </div>
                  <div className="text-right text-gray-700 font-medium">
                    {formatVolume(bid.size)}
                  </div>
                  <div className="text-right text-gray-500">
                    {bid.total ? formatVolume(bid.total) : "-"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Asks (Sell Orders) */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold">Asks</h4>
            <span className="text-sm text-gray-500">
              ({formatVolume(metrics.askVolume)})
            </span>
          </div>
          
          {/* Table Header */}
          <div className="grid grid-cols-3 gap-2 text-sm font-semibold text-gray-600 mb-3 px-2">
            <div>Price</div>
            <div className="text-right">Size</div>
            <div className="text-right">Total</div>
          </div>

          {/* Ask Rows */}
          <div className="space-y-1 max-h-[350px] overflow-y-auto pr-2">
            {asks.length === 0 ? (
              <div className="text-center text-sm text-gray-400 py-4">
                No asks
              </div>
            ) : (
              asks.map((ask, index) => (
                <div
                  key={index}
                  className="grid grid-cols-3 gap-2 px-3 py-2 hover:bg-red-50 rounded-lg transition"
                >
                  <div className="font-semibold text-red-600">
                    {formatPrice(ask.price)}
                  </div>
                  <div className="text-right text-gray-700 font-medium">
                    {formatVolume(ask.size)}
                  </div>
                  <div className="text-right text-gray-500">
                    {ask.total ? formatVolume(ask.total) : "-"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Note if using mock data */}
      {(note || source === "mock-data") && (
        <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-200">
          <div className="text-xs text-yellow-800 text-center font-medium">
            ⚠️ {note || "Using mock data"}
          </div>
          {reason && (
            <div className="text-xs text-yellow-600 text-center mt-1">
              Reason: {reason}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
