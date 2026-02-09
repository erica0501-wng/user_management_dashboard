import { useEffect, useState } from "react"
import Sidebar from "../components/Sidebar"
import StockCard from "../components/StockCard"
import StockDetail from "../components/StockDetail"

export default function Watchlists() {
  const [user, setUser] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  const [stocksData, setStocksData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStock, setSelectedStock] = useState(null)

  // Load user and watchlist from localStorage
  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    }
    
    const savedWatchlist = localStorage.getItem("watchlist")
    if (savedWatchlist) {
      setWatchlist(JSON.parse(savedWatchlist))
    }
  }, [])

  // Fetch watchlist stocks data
  useEffect(() => {
    if (watchlist.length === 0) {
      setLoading(false)
      return
    }

    const fetchWatchlistData = async () => {
      setLoading(true)
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const results = await Promise.all(
        watchlist.map(async (symbol) => {
          try {
            const res = await fetch(
              `${apiUrl}/market/stocks?symbol=${symbol}&interval=1day&range=1w`,
              {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
              }
            )
            const data = await res.json()
            
            if (data.prices && data.prices.length >= 2) {
              const currentPrice = data.prices[data.prices.length - 1]
              const prevPrice = data.prices[data.prices.length - 2]
              const change = currentPrice - prevPrice
              const changePercent = (change / prevPrice) * 100
              const average = data.average || (data.prices.reduce((a, b) => a + b, 0) / data.prices.length)

              // 准备历史数据用于蜡烛图（取最近7天）
              const historicalData = data.candles?.slice(-7) || data.prices.slice(-7).map((price, i) => {
                const variance = price * 0.005
                return {
                  open: price - variance * Math.random(),
                  high: price + variance * Math.random(),
                  low: price - variance * Math.random(),
                  close: price,
                  date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000)
                }
              })

              return {
                symbol,
                name: getStockName(symbol),
                price: currentPrice,
                change,
                changePercent,
                average,
                historicalData
              }
            }
            return null
          } catch (error) {
            console.error(`Error fetching ${symbol}:`, error)
            return null
          }
        })
      )

      setStocksData(results.filter(stock => stock !== null))
      setLoading(false)
    }

    fetchWatchlistData()
  }, [watchlist])

  // Helper function to get stock name
  const getStockName = (symbol) => {
    const names = {
      AAPL: "Apple Inc.",
      TSLA: "Tesla Inc.",
      MSFT: "Microsoft Corp.",
      GOOGL: "Alphabet Inc.",
      AMZN: "Amazon.com Inc.",
      META: "Meta Platforms Inc."
    }
    return names[symbol] || symbol
  }

  // Toggle watchlist
  const toggleWatchlist = (symbol) => {
    setWatchlist(prev => {
      const newWatchlist = prev.filter(s => s !== symbol)
      localStorage.setItem("watchlist", JSON.stringify(newWatchlist))
      
      // Remove from displayed stocks
      setStocksData(prevStocks => prevStocks.filter(s => s.symbol !== symbol))
      
      return newWatchlist
    })
  }

  // Handle buy stock
  const handleBuy = (symbol, price) => {
    alert(`Buy order for ${symbol} at $${price?.toFixed(2) || '0.00'}\n\nThis is a demo feature. In production, this would open a trading interface.`)
  }

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="ml-64 flex-1 p-6">
          <p className="text-gray-600">Loading watchlist...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 p-6">
        {/* 如果选中了股票，显示详情 */}
        {selectedStock ? (
          <StockDetail
            symbol={selectedStock.symbol}
            name={selectedStock.name}
            onBack={() => setSelectedStock(null)}
          />
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Watchlist</h1>

            {watchlist.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No watchlist yet</h3>
                <p className="text-gray-500">
                  Start adding stocks to your watchlist by clicking the 🤍 icon on any stock card
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stocksData.map((stock) => (
                  <StockCard
                    key={stock.symbol}
                    symbol={stock.symbol}
                    name={stock.name}
                    price={stock.price}
                    change={stock.change}
                    changePercent={stock.changePercent}
                    average={stock.average}
                    historicalData={stock.historicalData}
                    isInWatchlist={true}
                    onToggleWatchlist={toggleWatchlist}
                    onBuy={handleBuy}
                    onClick={() => setSelectedStock(stock)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
