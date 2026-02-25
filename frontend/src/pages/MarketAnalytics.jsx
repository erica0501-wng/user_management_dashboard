import { useEffect, useState } from "react"
import { format } from "date-fns"
import { Chart } from "react-chartjs-2"
import {
  Chart as ChartJS,
  BarController,
  LineController,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
} from "chart.js"
import {
  CandlestickController,
  CandlestickElement
} from "chartjs-chart-financial"
import zoomPlugin from "chartjs-plugin-zoom"
import "chartjs-adapter-date-fns"

import Sidebar from "../components/Sidebar"
import GreetingBanner from "../components/GreetingBanner"
import StockCard from "../components/StockCard"
import StockDetail from "../components/StockDetail"
import TradingPanel from "../components/TradingPanel"
import { getWatchlist, toggleWatchlist as toggleWatchlistAPI } from "../services/watchlist"
ChartJS.register(
  BarController,
  LineController,
  LinearScale,
  TimeScale,
  TimeSeriesScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  CandlestickController,
  CandlestickElement,
  zoomPlugin
)

export default function MarketAnalytics() {
  const [user, setUser] = useState(null)
  const [selectedStock, setSelectedStock] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [stocksData, setStocksData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState("all") // all, rising, falling
  const [sortBy, setSortBy] = useState("symbol") // symbol, price, change
  const [watchlist, setWatchlist] = useState([]) // watchlist 状态
  const [showFilterPanel, setShowFilterPanel] = useState(false) // 过滤面板显示状态
  const [priceRange, setPriceRange] = useState("all") // all, under100, 100to500, over500
  const [selectedCategories, setSelectedCategories] = useState([]) // 股票分类
  const [showTradingPanel, setShowTradingPanel] = useState(false)
  const [tradingStock, setTradingStock] = useState(null)

  // 股票列表
  const availableStocks = [
    // Tech
    { symbol: "AAPL", name: "Apple Inc.", category: "Tech" },
    { symbol: "MSFT", name: "Microsoft Corp.", category: "Tech" },
    { symbol: "GOOGL", name: "Alphabet Inc.", category: "Tech" },
    { symbol: "META", name: "Meta Platforms Inc.", category: "Tech" },
    { symbol: "NVDA", name: "NVIDIA Corp.", category: "Tech" },
    { symbol: "NFLX", name: "Netflix Inc.", category: "Tech" },
    { symbol: "AMD", name: "Advanced Micro Devices", category: "Tech" },
    { symbol: "ORCL", name: "Oracle Corp.", category: "Tech" },
    { symbol: "INTC", name: "Intel Corp.", category: "Tech" },
    { symbol: "ADBE", name: "Adobe Inc.", category: "Tech" },
    
    // Auto
    { symbol: "TSLA", name: "Tesla Inc.", category: "Auto" },
    { symbol: "F", name: "Ford Motor Co.", category: "Auto" },
    { symbol: "GM", name: "General Motors Co.", category: "Auto" },
    
    // Retail
    { symbol: "AMZN", name: "Amazon.com Inc.", category: "Retail" },
    { symbol: "WMT", name: "Walmart Inc.", category: "Retail" },
    { symbol: "HD", name: "Home Depot Inc.", category: "Retail" },
    { symbol: "TGT", name: "Target Corp.", category: "Retail" },
    
    // Finance
    { symbol: "JPM", name: "JPMorgan Chase & Co.", category: "Finance" },
    { symbol: "BAC", name: "Bank of America Corp.", category: "Finance" },
    { symbol: "GS", name: "Goldman Sachs Group", category: "Finance" },
    { symbol: "V", name: "Visa Inc.", category: "Finance" },
    { symbol: "MA", name: "Mastercard Inc.", category: "Finance" },
    
    // Healthcare
    { symbol: "JNJ", name: "Johnson & Johnson", category: "Healthcare" },
    { symbol: "PFE", name: "Pfizer Inc.", category: "Healthcare" },
    { symbol: "UNH", name: "UnitedHealth Group", category: "Healthcare" },
    { symbol: "ABBV", name: "AbbVie Inc.", category: "Healthcare" },
    
    // Energy
    { symbol: "XOM", name: "Exxon Mobil Corp.", category: "Energy" },
    { symbol: "CVX", name: "Chevron Corp.", category: "Energy" },
    { symbol: "COP", name: "ConocoPhillips", category: "Energy" }
  ]

  const stockCategories = ["Tech", "Auto", "Retail", "Finance", "Healthcare", "Energy"]

  // Load user and watchlist
  useEffect(() => {
    const userData = localStorage.getItem("user")
    if (userData) {
      setUser(JSON.parse(userData))
    }
    
    // Load watchlist from database
    const loadWatchlist = async () => {
      try {
        const watchlistData = await getWatchlist()
        setWatchlist(watchlistData)
      } catch (error) {
        console.error('Failed to load watchlist:', error)
        setWatchlist([])
      }
    }
    loadWatchlist()
  }, [])

  // Toggle watchlist
  const toggleWatchlist = async (symbol) => {
    console.log('🔄 toggleWatchlist called with symbol:', symbol)
    try {
      console.log('📤 Calling API to toggle watchlist...')
      const result = await toggleWatchlistAPI(symbol)
      console.log('📥 API response:', result)
      // Update local state based on action
      if (result.action === 'added') {
        console.log('✅ Added to watchlist')
        setWatchlist(prev => [...prev, symbol])
      } else {
        console.log('❌ Removed from watchlist')
        setWatchlist(prev => prev.filter(s => s !== symbol))
      }
    } catch (error) {
      console.error('❌ Failed to toggle watchlist:', error)
      alert('Failed to update watchlist. Please try again.')
    }
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
  const handleTrade = () => {
    setShowTradingPanel(false)
    // No need to do anything here, TradingPanel handles order creation
  }

  // 获取所有股票的当前价格
  useEffect(() => {
    const fetchStocksData = async () => {
      setLoading(true)
      const token = localStorage.getItem("token")
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000"

      const results = await Promise.all(
        availableStocks.map(async (stock) => {
          try {
            const res = await fetch(
              `${apiUrl}/market/stocks?symbol=${stock.symbol}&interval=1day&range=1w`,
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
                // 如果没有蜡烛图数据，创建简化版本（使用价格作为所有OHLC值，添加小波动）
                const variance = price * 0.005 // 0.5% 波动
                return {
                  open: price - variance * Math.random(),
                  high: price + variance * Math.random(),
                  low: price - variance * Math.random(),
                  close: price,
                  date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000)
                }
              })

              return {
                ...stock,
                price: currentPrice,
                change,
                changePercent,
                average,
                historicalData,
                category: stock.category
              }
            }
            return { ...stock, price: null, change: 0, changePercent: 0, average: null, historicalData: [], category: stock.category }
          } catch (error) {
            console.error(`Error fetching ${stock.symbol}:`, error)
            return { ...stock, price: null, change: 0, changePercent: 0, average: null }
          }
        })
      )

      setStocksData(results)
      setLoading(false)
    }

    fetchStocksData()
  }, [])

  // 过滤股票
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

  // 获取用于 GreetingBanner 的数据（使用第一个股票）
  const bannerStock = stocksData[0] || {}

  if (loading) {
    return (
      <div className="flex">
        <Sidebar />
        <div className="ml-64 flex-1 p-6">
          <p className="text-gray-600">Loading market data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="ml-64 flex-1 p-6">
        {/* 只在未选中股票时显示欢迎横幅和标题 */}
        {!selectedStock && (
          <>
            <GreetingBanner user={user} />
          </>
        )}

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

            {/* 股票列表 */}
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
                  isInWatchlist={watchlist.includes(stock.symbol)}
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
