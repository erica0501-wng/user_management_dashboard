import { useEffect, useState } from "react"
import Sidebar from "../components/Sidebar"
import StockCard from "../components/StockCard"
import StockDetail from "../components/StockDetail"
import TradingPanel from "../components/TradingPanel"

export default function Watchlists() {
  const [user, setUser] = useState(null)
  const [watchlist, setWatchlist] = useState([])
  const [stocksData, setStocksData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedStock, setSelectedStock] = useState(null)
  const [showTradingPanel, setShowTradingPanel] = useState(false)
  const [tradingStock, setTradingStock] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filterType, setFilterType] = useState("all") // all, rising, falling
  const [sortBy, setSortBy] = useState("symbol") // symbol, price, change
  const [priceRange, setPriceRange] = useState("all") // all, under100, 100to500, over500
  const [selectedCategories, setSelectedCategories] = useState([]) // 股票分类

  const stockCategories = ["Tech", "Auto", "Retail", "Finance", "Healthcare", "Energy"]

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

              const stockInfo = getStockInfo(symbol)
              return {
                symbol,
                name: stockInfo.name,
                category: stockInfo.category,
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

  // Helper function to get stock name and category
  const getStockInfo = (symbol) => {
    const stockMap = {
      AAPL: { name: "Apple Inc.", category: "Tech" },
      TSLA: { name: "Tesla Inc.", category: "Auto" },
      MSFT: { name: "Microsoft Corp.", category: "Tech" },
      GOOGL: { name: "Alphabet Inc.", category: "Tech" },
      AMZN: { name: "Amazon.com Inc.", category: "Retail" },
      META: { name: "Meta Platforms Inc.", category: "Tech" },
      NVDA: { name: "NVIDIA Corp.", category: "Tech" },
      NFLX: { name: "Netflix Inc.", category: "Tech" },
      AMD: { name: "Advanced Micro Devices", category: "Tech" },
      ORCL: { name: "Oracle Corp.", category: "Tech" },
      INTC: { name: "Intel Corp.", category: "Tech" },
      ADBE: { name: "Adobe Inc.", category: "Tech" },
      F: { name: "Ford Motor Co.", category: "Auto" },
      GM: { name: "General Motors Co.", category: "Auto" },
      WMT: { name: "Walmart Inc.", category: "Retail" },
      HD: { name: "Home Depot Inc.", category: "Retail" },
      TGT: { name: "Target Corp.", category: "Retail" },
      JPM: { name: "JPMorgan Chase & Co.", category: "Finance" },
      BAC: { name: "Bank of America Corp.", category: "Finance" },
      GS: { name: "Goldman Sachs Group", category: "Finance" },
      V: { name: "Visa Inc.", category: "Finance" },
      MA: { name: "Mastercard Inc.", category: "Finance" },
      JNJ: { name: "Johnson & Johnson", category: "Healthcare" },
      PFE: { name: "Pfizer Inc.", category: "Healthcare" },
      UNH: { name: "UnitedHealth Group", category: "Healthcare" },
      ABBV: { name: "AbbVie Inc.", category: "Healthcare" },
      XOM: { name: "Exxon Mobil Corp.", category: "Energy" },
      CVX: { name: "Chevron Corp.", category: "Energy" },
      COP: { name: "ConocoPhillips", category: "Energy" }
    }
    return stockMap[symbol] || { name: symbol, category: "Other" }
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

  // Handle buy stock - Open trading panel
  const handleBuy = (symbol, price) => {
    const stock = stocksData.find(s => s.symbol === symbol)
    if (stock) {
      setTradingStock(stock)
      setShowTradingPanel(true)
    }
  }

  // Handle trade submission
  const handleTrade = (tradeData) => {
    const orders = JSON.parse(localStorage.getItem("orders") || "[]")
    const newOrder = {
      id: Date.now(),
      ...tradeData,
      status: "Pending",
      time: new Date().toLocaleString(),
      name: tradingStock.name
    }
    orders.unshift(newOrder)
    localStorage.setItem("orders", JSON.stringify(orders))
    
    setShowTradingPanel(false)
    alert(`${tradeData.direction} order placed for ${tradeData.quantity} shares of ${tradeData.symbol}`)
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

  // 过滤和排序股票
  const filteredStocks = stocksData
    .filter((stock) =>
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((stock) => {
      if (filterType === "rising") return stock.change > 0
      if (filterType === "falling") return stock.change < 0
      return true
    })
    .filter((stock) => {
      if (priceRange === "under100") return stock.price < 100
      if (priceRange === "100to500") return stock.price >= 100 && stock.price <= 500
      if (priceRange === "over500") return stock.price > 500
      return true
    })
    .filter((stock) => {
      if (selectedCategories.length === 0) return true
      return selectedCategories.includes(stock.category)
    })
    .sort((a, b) => {
      if (sortBy === "price") return (b.price || 0) - (a.price || 0)
      if (sortBy === "change") return (b.changePercent || 0) - (a.changePercent || 0)
      return a.symbol.localeCompare(b.symbol)
    })

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 p-6">
        {/* 如果选中了股票，显示详情 */}
        {selectedStock ? (
          <StockDetail
            symbol={selectedStock.symbol}
            name={selectedStock.name}
            price={selectedStock.price}
            isInWatchlist={watchlist.includes(selectedStock.symbol)}
            onToggleWatchlist={toggleWatchlist}
            onBuy={handleBuy}
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
              <>
                {/* 搜索框和过滤器按钮 */}
                <div className="mb-6 mt-6 flex gap-3 relative">
                  <input
                    type="text"
                    placeholder="Search stocks by symbol or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  
                  {/* Filters & Sort 按钮 */}
                  <button
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                    className="px-6 py-3 rounded-xl border border-gray-300 bg-gray-800 text-white hover:bg-gray-700 transition-all flex items-center gap-2 font-medium"
                  >
                    <span>☰</span>
                    Filters & Sort
                  </button>

                  {/* 过滤面板 - 小弹出窗口 */}
                  {showFilterPanel && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-gray-800 text-white rounded-xl p-5 shadow-2xl z-50 border border-gray-700">
                      <h3 className="text-lg font-bold mb-4">Filters & Sort</h3>

                      {/* Sort By */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                          <h4 className="text-xs font-semibold">Sort By</h4>
                        </div>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="symbol">Symbol</option>
                          <option value="price">Price</option>
                          <option value="change">Change %</option>
                        </select>
                      </div>

                      {/* Market Trend */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                          <h4 className="text-xs font-semibold">Market Trend</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {["all", "rising", "falling"].map((type) => (
                            <button
                              key={type}
                              onClick={() => setFilterType(type)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                filterType === type
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                              }`}
                            >
                              {type === "all" ? "All" : type === "rising" ? "Rising" : "Falling"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Price Range */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                          <h4 className="text-xs font-semibold">Price Range</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { value: "all", label: "All" },
                            { value: "under100", label: "<$100" },
                            { value: "100to500", label: "$100-$500" },
                            { value: "over500", label: ">$500" }
                          ].map((range) => (
                            <button
                              key={range.value}
                              onClick={() => setPriceRange(range.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                priceRange === range.value
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                              }`}
                            >
                              {range.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Categories */}
                      <div>
                        <div className="flex items-center gap-2 mb-2 text-gray-400">
                          <h4 className="text-xs font-semibold">Categories</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {stockCategories.map((category) => (
                            <button
                              key={category}
                              onClick={() => {
                                setSelectedCategories(prev => 
                                  prev.includes(category)
                                    ? prev.filter(c => c !== category)
                                    : [...prev, category]
                                )
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                selectedCategories.includes(category)
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                              }`}
                            >
                              {category}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStocks.map((stock) => (
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

                {filteredStocks.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No stocks found matching "{searchQuery}"
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Trading Panel Modal */}
      {showTradingPanel && tradingStock && (
        <TradingPanel
          stock={tradingStock}
          onClose={() => setShowTradingPanel(false)}
          onTrade={handleTrade}
        />
      )}
    </div>
  )
}
